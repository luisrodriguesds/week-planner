import { eq } from "drizzle-orm";
import { formatGoGymDateTime } from "../../gogym/book.js";
import type { GoGymClient } from "../../gogym/client.js";
import type { AppDb } from "../../db/index.js";
import { users } from "../../db/schema.js";
import { listPlans } from "./plan.service.js";
import { parseGoGymDate, windowStatus } from "./window-status.js";

export async function getWeekSchedule(
  db: AppDb,
  gogym: Pick<GoGymClient, "fetchWeekSchedule" | "listReservations">,
  userId: number,
  filter?: string,
) {
  const classes = await gogym.fetchWeekSchedule();
  const needle = filter?.trim().toLowerCase();
  const slots = needle
    ? classes.filter((item) => item.NomeAula.toLowerCase().includes(needle))
    : classes;

  const userPlans = listPlans(db, userId, ["PLANNED", "EXECUTING", "BOOKED"]);
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  const reservations = user?.gogymIdcliente
    ? await gogym.listReservations(user.gogymIdcliente)
    : [];

  return slots.map((slot) => {
    const dataHoraAula = formatGoGymDateTime(slot.DataHoraAula);
    const plan = userPlans.find((item) => item.idgrelha === slot.IDgrelha && item.dataHoraAula === dataHoraAula);
    const userHasReservation = reservations.some((reservation) =>
      reservation.NomeAula === slot.NomeAula && formatGoGymDateTime(reservation.DataHoraAula) === dataHoraAula
    );
    return {
      ...slot,
      windowStatus: windowStatus(
        parseGoGymDate(slot.HoraAtualServidor),
        slot.DataHoraInicioMarcacao,
        slot.DataHoraFimMarcacao,
      ),
      availableSpots: slot.LotacaoReservaWeb - slot.TotalMarcacoes,
      userPlanId: plan?.id ?? null,
      userPlanStatus: plan?.status ?? null,
      userHasReservation,
    };
  });
}
