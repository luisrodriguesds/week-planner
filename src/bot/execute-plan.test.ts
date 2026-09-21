import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { planExecutionLogs, plans } from "../db/schema.js";
import type { GoGymClass } from "../gogym/types.js";
import { createTestDb, insertUser } from "../server/test-helpers.js";
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
    const clock = { refresh: vi.fn().mockResolvedValue(undefined) };

    await executePlan(db, gogym, clock, plan.id);

    const updated = db.select().from(plans).where(eq(plans.id, plan.id)).get();
    expect(updated?.status).toBe("BOOKED");
    expect(updated?.idMarcacao).toBe(179112);
    expect(gogym.bookClass).toHaveBeenCalledWith("12345", baseSlot);

    const log = db.select().from(planExecutionLogs).where(eq(planExecutionLogs.planId, plan.id)).get();
    expect(log?.success).toBe(1);
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
    const clock = { refresh: vi.fn().mockResolvedValue(undefined) };

    await executePlan(db, gogym, clock, plan.id);

    const updated = db.select().from(plans).where(eq(plans.id, plan.id)).get();
    expect(updated?.status).toBe("FAILED");
    expect(updated?.failureReason).toContain("slot");
    expect(gogym.bookClass).not.toHaveBeenCalled();

    const log = db.select().from(planExecutionLogs).where(eq(planExecutionLogs.planId, plan.id)).get();
    expect(log?.success).toBe(0);
    close();
  });
});
