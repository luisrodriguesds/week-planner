import type { FastifyInstance } from "fastify";
import { createGoGymClient, type GoGymClient } from "../../gogym/client.js";
import type { AppDb } from "../../db/index.js";
import { HttpError } from "../errors.js";
import { requireAuth } from "../plugins/auth.js";
import { getWeekSchedule } from "../services/schedule.service.js";

export function registerScheduleRoutes(
  app: FastifyInstance,
  db: AppDb,
  gogym: Pick<GoGymClient, "fetchWeekSchedule" | "listReservations">,
  options: { baseUrl: string; defaultCenterId: number },
): void {
  app.get("/api/v1/schedule/week", { preHandler: requireAuth }, async (request) => {
    const query = request.query as { center?: string; filter?: string };
    let client = gogym;
    if (query.center !== undefined) {
      const centerId = Number(query.center);
      if (!Number.isInteger(centerId) || centerId <= 0) {
        throw new HttpError(400, "invalid_center", "center must be a positive integer");
      }
      if (centerId !== options.defaultCenterId) {
        client = createGoGymClient({ baseUrl: options.baseUrl, centerId });
      }
    }
    return getWeekSchedule(db, client, Number(request.session.get("userId")), query.filter);
  });
}
