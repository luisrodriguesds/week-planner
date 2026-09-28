import { and, eq } from "drizzle-orm";
import type { AppDb } from "../db/index.js";
import { planExecutionLogs, plans, users } from "../db/schema.js";
import { formatGoGymDateTime } from "../gogym/book.js";
import type { GoGymClient } from "../gogym/client.js";
import { GoGymHttpError } from "../gogym/errors.js";
import type { BookResult, GoGymClass } from "../gogym/types.js";
import { loadBookingConfig, type BookingConfig } from "./booking-config.js";

const MAX_RESPONSE_BODY = 2048;

function nowIso(): string {
  return new Date().toISOString();
}

function truncate(text: string): string {
  return text.length <= MAX_RESPONSE_BODY ? text : text.slice(0, MAX_RESPONSE_BODY);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function insertLog(
  db: AppDb,
  planId: number,
  success: boolean,
  httpStatus: number | null,
  responseBody: string | null,
  errorMessage: string | null,
) {
  db.insert(planExecutionLogs).values({
    planId,
    attemptAt: nowIso(),
    success: success ? 1 : 0,
    httpStatus,
    responseBody: responseBody ? truncate(responseBody) : null,
    errorMessage,
  }).run();
}

async function markFailed(
  db: AppDb,
  planId: number,
  reason: string,
  httpStatus: number | null = null,
  responseBody: string | null = null,
) {
  db.update(plans).set({
    status: "FAILED",
    failureReason: reason,
    executedAt: nowIso(),
    updatedAt: nowIso(),
  }).where(eq(plans.id, planId)).run();
  insertLog(db, planId, false, httpStatus, responseBody, reason);
}

function isRetryableHttpError(error: unknown, config: BookingConfig): error is GoGymHttpError {
  return error instanceof GoGymHttpError && config.retryHttpStatuses.has(error.status);
}

async function bookWithRetries(
  db: AppDb,
  gogym: Pick<GoGymClient, "bookClass">,
  planId: number,
  idcliente: string,
  slot: GoGymClass,
  config: BookingConfig,
): Promise<BookResult> {
  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await gogym.bookClass(idcliente, slot);
    } catch (error) {
      const retryable = isRetryableHttpError(error, config) && attempt < config.maxAttempts;
      if (!retryable) throw error;

      insertLog(
        db,
        planId,
        false,
        error.status,
        error.responseBody,
        `${error.message} (retry ${attempt}/${config.maxAttempts})`,
      );
      await sleep(config.retryDelayMs);
    }
  }

  throw new Error("book_retry_exhausted");
}

export async function executePlan(
  db: AppDb,
  gogym: Pick<GoGymClient, "fetchWeekSchedule" | "bookClass">,
  planId: number,
  bookingConfig: BookingConfig = loadBookingConfig(),
): Promise<void> {
  const claimed = db.update(plans).set({
    status: "EXECUTING",
    updatedAt: nowIso(),
  }).where(and(eq(plans.id, planId), eq(plans.status, "PLANNED"))).returning().get();

  if (!claimed) return;

  try {
    const user = db.select().from(users).where(eq(users.id, claimed.userId)).get();
    if (!user?.gogymIdcliente) {
      await markFailed(db, planId, "gogym_idcliente em falta");
      return;
    }

    // Single mapa_aulas fetch — avoid clock.refresh() here (it would fetch again).
    const schedule = await gogym.fetchWeekSchedule();
    const slot = schedule.find((item) =>
      item.IDgrelha === claimed.idgrelha &&
      formatGoGymDateTime(item.DataHoraAula) === claimed.dataHoraAula
    );

    if (!slot) {
      await markFailed(db, planId, "slot desapareceu da semana");
      return;
    }

    const result = await bookWithRetries(
      db,
      gogym,
      planId,
      user.gogymIdcliente,
      slot,
      bookingConfig,
    );
    const body = JSON.stringify(result);

    if (result.sucesso) {
      db.update(plans).set({
        status: "BOOKED",
        idMarcacao: result.idMarcacao ?? null,
        failureReason: null,
        executedAt: nowIso(),
        updatedAt: nowIso(),
      }).where(eq(plans.id, planId)).run();
      insertLog(db, planId, true, 200, body, null);
      return;
    }

    await markFailed(db, planId, result.mensagem || "Falha ao marcar", null, body);
  } catch (error) {
    if (error instanceof GoGymHttpError) {
      await markFailed(db, planId, error.message, error.status, error.responseBody);
      return;
    }

    const message = error instanceof Error ? error.message : "Erro desconhecido";
    await markFailed(db, planId, message);
  }
}
