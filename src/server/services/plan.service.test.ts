import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { plans } from "../../db/schema.js";
import type { GoGymClass } from "../../gogym/types.js";
import { createTestDb, insertUser } from "../test-helpers.js";
import { cancelPlan, createPlan } from "./plan.service.js";

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

describe("plan.service", () => {
  it("should create a PLANNED row from idgrelha", async () => {
    const { db, close } = createTestDb();
    const { user } = insertUser(db, { gogymIdcliente: "12345" });
    const gogym = { fetchWeekSchedule: vi.fn().mockResolvedValue([baseSlot]) };
    const hooks = { registerPlanTimer: vi.fn() };
    const plan = await createPlan(db, gogym, user.id, 11701, hooks);
    expect(plan.status).toBe("PLANNED");
    expect(plan.fusoHorario).toBe("Europe/Lisbon");
    expect(plan.valorC).toBe("0");
    expect(hooks.registerPlanTimer).toHaveBeenCalledOnce();
    close();
  });

  it("should return 409 for duplicate plan", async () => {
    const { db, close } = createTestDb();
    const { user } = insertUser(db, { gogymIdcliente: "12345" });
    const gogym = { fetchWeekSchedule: vi.fn().mockResolvedValue([baseSlot]) };
    await createPlan(db, gogym, user.id, 11701);
    await expect(createPlan(db, gogym, user.id, 11701)).rejects.toMatchObject({ statusCode: 409 });
    close();
  });

  it("should cancel PLANNED without GoGym call", async () => {
    const { db, close } = createTestDb();
    const { user } = insertUser(db, { gogymIdcliente: "12345" });
    const gogym = {
      fetchWeekSchedule: vi.fn().mockResolvedValue([baseSlot]),
      cancelReservation: vi.fn(),
    };
    const plan = await createPlan(db, gogym, user.id, 11701);
    const cancelled = await cancelPlan(db, gogym, user.id, plan.id);
    expect(cancelled.status).toBe("CANCELLED");
    expect(gogym.cancelReservation).not.toHaveBeenCalled();
    close();
  });

  it("should cancel BOOKED via cancelReservation", async () => {
    const { db, close } = createTestDb();
    const { user } = insertUser(db, { gogymIdcliente: "12345" });
    const gogym = {
      fetchWeekSchedule: vi.fn().mockResolvedValue([baseSlot]),
      cancelReservation: vi.fn().mockResolvedValue({ sucesso: true, mensagem: "ok", tipo: "sucesso" }),
    };
    const plan = await createPlan(db, gogym, user.id, 11701);
    db.update(plans).set({ status: "BOOKED", idMarcacao: 179112 }).where(eq(plans.id, plan.id)).run();
    const cancelled = await cancelPlan(db, gogym, user.id, plan.id);
    expect(cancelled.status).toBe("CANCELLED");
    expect(gogym.cancelReservation).toHaveBeenCalledWith(179112);
    close();
  });

  it("should reject when idcliente is missing", async () => {
    const { db, close } = createTestDb();
    const { user } = insertUser(db);
    const gogym = { fetchWeekSchedule: vi.fn().mockResolvedValue([baseSlot]) };
    await expect(createPlan(db, gogym, user.id, 11701)).rejects.toMatchObject({ statusCode: 403 });
    close();
  });
});
