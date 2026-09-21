import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { plans } from "../db/schema.js";
import { createTestDb, insertUser } from "../server/test-helpers.js";
import { createScheduler } from "./scheduler.js";

describe("createScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should register a timer for a PLANNED plan on reconcile", async () => {
    const { db, close } = createTestDb();
    const { user } = insertUser(db, { gogymIdcliente: "12345" });
    const now = new Date("2026-09-21T08:00:00");
    const clock = {
      now: () => now,
      refresh: vi.fn().mockResolvedValue(undefined),
      getOffsetMs: () => 0,
    };
    const gogym = {
      fetchWeekSchedule: vi.fn().mockResolvedValue([]),
      bookClass: vi.fn(),
      getServerTime: vi.fn().mockResolvedValue(now),
    };
    const nowIso = now.toISOString();
    db.insert(plans).values({
      userId: user.id,
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
      createdAt: nowIso,
      updatedAt: nowIso,
    }).run();

    const scheduler = createScheduler({ db, gogym, clock });
    scheduler.reconcileAllTimers();

    await vi.advanceTimersByTimeAsync(75 * 60 * 1000);

    const plan = db.select().from(plans).get();
    expect(plan?.status).toBe("FAILED");
    scheduler.stopScheduler();
    close();
  });
});
