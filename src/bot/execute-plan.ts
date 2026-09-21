import { and, eq } from "drizzle-orm";
import type { AppDb } from "../db/index.js";
import { planExecutionLogs, plans, users } from "../db/schema.js";
import { formatGoGymDateTime } from "../gogym/book.js";
import type { GoGymClient } from "../gogym/client.js";
import type { ServerClock } from "../gogym/clock.js";

const MAX_RESPONSE_BODY = 2048;

function nowIso(): string {
  return new Date().toISOString();
}

function truncate(text: string): string {
  return text.length <= MAX_RESPONSE_BODY ? text : text.slice(0, MAX_RESPONSE_BODY);
}

function insertLog(
  db: AppDb,
  planId: number,
  success: boolean,
  responseBody: string | null,
  errorMessage: string | null,
) {
  db.insert(planExecutionLogs).values({
    planId,
    attemptAt: nowIso(),
    success: success ? 1 : 0,
    httpStatus: null,
    responseBody: responseBody ? truncate(responseBody) : null,
    errorMessage,
  }).run();
}

async function markFailed(
  db: AppDb,
  planId: number,
  reason: string,
  responseBody: string | null = null,
) {
  db.update(plans).set({
    status: "FAILED",
    failureReason: reason,
    executedAt: nowIso(),
    updatedAt: nowIso(),
  }).where(eq(plans.id, planId)).run();
  insertLog(db, planId, false, responseBody, reason);
}

export async function executePlan(
  db: AppDb,
  gogym: Pick<GoGymClient, "fetchWeekSchedule" | "bookClass">,
  clock: Pick<ServerClock, "refresh">,
  planId: number,
): Promise<void> {
  const claimed = db.update(plans).set({
    status: "EXECUTING",
    updatedAt: nowIso(),
  }).where(and(eq(plans.id, planId), eq(plans.status, "PLANNED"))).returning().get();

  if (!claimed) return;

  try {
    await clock.refresh();

    const user = db.select().from(users).where(eq(users.id, claimed.userId)).get();
    if (!user?.gogymIdcliente) {
      await markFailed(db, planId, "gogym_idcliente em falta");
      return;
    }

    const schedule = await gogym.fetchWeekSchedule();
    const slot = schedule.find((item) =>
      item.IDgrelha === claimed.idgrelha &&
      formatGoGymDateTime(item.DataHoraAula) === claimed.dataHoraAula
    );

    if (!slot) {
      await markFailed(db, planId, "slot desapareceu da semana");
      return;
    }

    const result = await gogym.bookClass(user.gogymIdcliente, slot);
    const body = JSON.stringify(result);

    if (result.sucesso) {
      db.update(plans).set({
        status: "BOOKED",
        idMarcacao: result.idMarcacao ?? null,
        failureReason: null,
        executedAt: nowIso(),
        updatedAt: nowIso(),
      }).where(eq(plans.id, planId)).run();
      insertLog(db, planId, true, body, null);
      return;
    }

    await markFailed(db, planId, result.mensagem || "Falha ao marcar", body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    await markFailed(db, planId, message);
  }
}
