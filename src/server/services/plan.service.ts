import { and, eq, inArray } from "drizzle-orm";
import { buildBookPayload, formatGoGymDateTime } from "../../gogym/book.js";
import type { GoGymClient } from "../../gogym/client.js";
import type { AppDb } from "../../db/index.js";
import { plans, users } from "../../db/schema.js";
import { HttpError } from "../errors.js";
import { parseGoGymDate, windowStatus } from "./window-status.js";

export interface PlanHooks {
  registerPlanTimer?: (planId: number) => void;
  cancelPlanTimer?: (planId: number) => void;
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function createPlan(
  db: AppDb,
  gogym: Pick<GoGymClient, "fetchWeekSchedule">,
  userId: number,
  idgrelha: number,
  hooks: PlanHooks = {},
) {
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) throw new HttpError(401, "unauthorized", "Authentication required");
  if (!user.gogymIdcliente) {
    throw new HttpError(403, "gogym_not_linked", "Configure GoGym idcliente before creating a Plano");
  }

  const schedule = await gogym.fetchWeekSchedule();
  const slot = schedule.find((item) => item.IDgrelha === idgrelha);
  if (!slot) throw new HttpError(404, "slot_not_found", "Class not found in the current week");

  const now = parseGoGymDate(slot.HoraAtualServidor);
  if (windowStatus(now, slot.DataHoraInicioMarcacao, slot.DataHoraFimMarcacao) === "CLOSED") {
    throw new HttpError(409, "window_closed", "Booking window is closed");
  }

  const dataHoraAula = formatGoGymDateTime(slot.DataHoraAula);
  const existing = db.select().from(plans).where(and(
    eq(plans.userId, userId),
    eq(plans.idgrelha, idgrelha),
    eq(plans.dataHoraAula, dataHoraAula),
  )).get();
  if (existing) throw new HttpError(409, "duplicate_plan", "A Plano already exists for this class");

  const payload = buildBookPayload(user.gogymIdcliente, slot);
  const timestamp = nowIso();
  const created = db.insert(plans).values({
    userId,
    status: "PLANNED",
    idgrelha: slot.IDgrelha,
    idaula: slot.IDaula,
    nomeAula: slot.NomeAula,
    nomeProfessor: slot.NomeProfessor,
    nomeLocal: slot.NomeLocal,
    dataHoraAula,
    inicioMarcacao: payload.inicioMarcacao,
    fimMarcacao: payload.fimMarcacao,
    centroLocal: slot.CentroLocal,
    lotacaoReservaWeb: slot.LotacaoReservaWeb,
    fusoHorario: payload.fusoHorario,
    valorA: payload.valorA,
    valorB: payload.valorB,
    valorC: payload.valorC,
    valorBNumAlunos: Number(payload.valorBNumAlunos),
    valorCNumAlunos: Number(payload.valorCNumAlunos),
    scheduledExecuteAt: payload.inicioMarcacao,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).returning().get();

  hooks.registerPlanTimer?.(created.id);
  return created;
}

export function listPlans(db: AppDb, userId: number, statuses?: string[]) {
  const filters = [eq(plans.userId, userId)];
  if (statuses && statuses.length > 0) filters.push(inArray(plans.status, statuses));
  return db.select().from(plans).where(and(...filters)).all();
}

export function getPlan(db: AppDb, userId: number, planId: number) {
  const plan = db.select().from(plans).where(and(eq(plans.id, planId), eq(plans.userId, userId))).get();
  if (!plan) throw new HttpError(404, "not_found", "Plano not found");
  return plan;
}

export async function cancelPlan(
  db: AppDb,
  gogym: Pick<GoGymClient, "cancelReservation">,
  userId: number,
  planId: number,
  hooks: PlanHooks = {},
) {
  const plan = getPlan(db, userId, planId);
  if (plan.status === "EXECUTING") throw new HttpError(409, "conflict", "Plano is executing");
  if (plan.status === "CANCELLED") throw new HttpError(409, "conflict", "Plano is already cancelled");

  if (plan.status === "BOOKED") {
    if (plan.idMarcacao == null) throw new HttpError(409, "conflict", "Plano has no reservation id");
    const result = await gogym.cancelReservation(plan.idMarcacao);
    if (!result.sucesso) {
      throw new HttpError(502, "cancel_failed", result.mensagem || "Falha ao desmarcar reserva");
    }
  }

  const updated = db.update(plans).set({
    status: "CANCELLED",
    updatedAt: nowIso(),
  }).where(eq(plans.id, planId)).returning().get();

  hooks.cancelPlanTimer?.(planId);
  return updated;
}
