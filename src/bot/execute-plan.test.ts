import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { planExecutionLogs, plans } from "../db/schema.js";
import { GoGymHttpError } from "../gogym/errors.js";
import type { GoGymClass } from "../gogym/types.js";
import { createTestDb, insertUser } from "../server/test-helpers.js";
import type { BookingConfig } from "./booking-config.js";
import { executePlan } from "./execute-plan.js";

const baseSlot: GoGymClass = {
  IDgrelha: 11701,
  IDaula: 401,
  NomeAula: "Zumba 45",
  NomeProfessor: "Marta",
  NomeLocal: "Estudio 1",
  DataHoraAula: "2026-09-21 21:15:00",
  DataHoraInicioMarcacao: "2026-09-21 09:15:00.000000",
  DataHoraFimMarcacao: "2026-09-21 21:00:00.000000",
  LotacaoReservaWeb: 25,
  TotalMarcacoes: 10,
  CentroLocal: 1,
  NomeFuso: "Europe/Lisbon",
  ValorA: "13.65",
  ValorB: "16.00",
  ValorC: null,
  ValorBNumAlunos: 16,
  ValorCNumAlunos: null,
  HoraAtualServidor: "2026-09-21 15:00:00",
};

const fastRetryConfig: BookingConfig = {
  maxAttempts: 3,
  retryDelayMs: 0,
  retryHttpStatuses: new Set([500, 502, 503, 504]),
};

function insertPlannedPlan(db: ReturnType<typeof createTestDb>["db"], userId: number) {
  const now = new Date().toISOString();
  return db.insert(plans).values({
    userId,
    status: "PLANNED",
    idgrelha: 11701,
    idaula: 401,
    nomeAula: "Zumba 45",
    nomeProfessor: "Marta",
    nomeLocal: "Estudio 1",
    dataHoraAula: "2026-09-21 21:15:00",
    inicioMarcacao: "2026-09-21 09:15:00",
    fimMarcacao: "2026-09-21 21:00:00",
    centroLocal: 1,
    lotacaoReservaWeb: 25,
    fusoHorario: "Europe/Lisbon",
    valorA: "13.65",
    valorB: "16.00",
    valorC: "0",
    valorBNumAlunos: 16,
    valorCNumAlunos: 0,
    scheduledExecuteAt: "2026-09-21 09:15:00",
    createdAt: now,
    updatedAt: now,
  }).returning().get();
}

describe("executePlan", () => {
  it("should transition PLANNED to EXECUTING to BOOKED on success", async () => {
    const { db, close } = createTestDb();
    const { user } = insertUser(db, { gogymIdcliente: "12345" });
    const plan = insertPlannedPlan(db, user.id);
    const gogym = {
      fetchWeekSchedule: vi.fn().mockResolvedValue([baseSlot]),
      bookClass: vi.fn().mockResolvedValue({
        sucesso: true,
        idMarcacao: 179112,
        mensagem: "ok",
        tipo: "sucesso",
      }),
    };

    await executePlan(db, gogym, plan.id, fastRetryConfig);

    const updated = db.select().from(plans).where(eq(plans.id, plan.id)).get();
    expect(updated?.status).toBe("BOOKED");
    expect(updated?.idMarcacao).toBe(179112);
    expect(gogym.fetchWeekSchedule).toHaveBeenCalledTimes(1);
    expect(gogym.bookClass).toHaveBeenCalledWith("12345", baseSlot);

    const log = db.select().from(planExecutionLogs).where(eq(planExecutionLogs.planId, plan.id)).get();
    expect(log?.success).toBe(1);
    expect(log?.httpStatus).toBe(200);
    close();
  });

  it("should mark FAILED when slot is missing from schedule", async () => {
    const { db, close } = createTestDb();
    const { user } = insertUser(db, { gogymIdcliente: "12345" });
    const plan = insertPlannedPlan(db, user.id);
    const gogym = {
      fetchWeekSchedule: vi.fn().mockResolvedValue([]),
      bookClass: vi.fn(),
    };

    await executePlan(db, gogym, plan.id, fastRetryConfig);

    const updated = db.select().from(plans).where(eq(plans.id, plan.id)).get();
    expect(updated?.status).toBe("FAILED");
    expect(updated?.failureReason).toContain("slot");
    expect(gogym.bookClass).not.toHaveBeenCalled();

    const log = db.select().from(planExecutionLogs).where(eq(planExecutionLogs.planId, plan.id)).get();
    expect(log?.success).toBe(0);
    close();
  });

  it("should retry on HTTP 500 and book on a later attempt", async () => {
    const { db, close } = createTestDb();
    const { user } = insertUser(db, { gogymIdcliente: "12345" });
    const plan = insertPlannedPlan(db, user.id);
    const gogym = {
      fetchWeekSchedule: vi.fn().mockResolvedValue([baseSlot]),
      bookClass: vi.fn()
        .mockRejectedValueOnce(new GoGymHttpError("/app/php/insert_marcacao.php", 500, "temporary"))
        .mockResolvedValueOnce({
          sucesso: true,
          idMarcacao: 179112,
          mensagem: "ok",
          tipo: "sucesso",
        }),
    };

    await executePlan(db, gogym, plan.id, fastRetryConfig);

    const updated = db.select().from(plans).where(eq(plans.id, plan.id)).get();
    expect(updated?.status).toBe("BOOKED");
    expect(gogym.bookClass).toHaveBeenCalledTimes(2);

    const logs = db.select().from(planExecutionLogs).where(eq(planExecutionLogs.planId, plan.id)).all();
    expect(logs).toHaveLength(2);
    expect(logs[0]?.success).toBe(0);
    expect(logs[0]?.httpStatus).toBe(500);
    expect(logs[0]?.responseBody).toBe("temporary");
    expect(logs[1]?.success).toBe(1);
    close();
  });

  it("should mark FAILED after exhausting HTTP 500 retries", async () => {
    const { db, close } = createTestDb();
    const { user } = insertUser(db, { gogymIdcliente: "12345" });
    const plan = insertPlannedPlan(db, user.id);
    const gogym = {
      fetchWeekSchedule: vi.fn().mockResolvedValue([baseSlot]),
      bookClass: vi.fn().mockRejectedValue(
        new GoGymHttpError("/app/php/insert_marcacao.php", 500, "server boom"),
      ),
    };

    await executePlan(db, gogym, plan.id, fastRetryConfig);

    const updated = db.select().from(plans).where(eq(plans.id, plan.id)).get();
    expect(updated?.status).toBe("FAILED");
    expect(updated?.failureReason).toContain("HTTP 500");
    expect(gogym.bookClass).toHaveBeenCalledTimes(3);

    const logs = db.select().from(planExecutionLogs).where(eq(planExecutionLogs.planId, plan.id)).all();
    expect(logs).toHaveLength(3);
    expect(logs.every((log) => log.httpStatus === 500)).toBe(true);
    expect(logs.at(-1)?.responseBody).toBe("server boom");
    close();
  });
});
