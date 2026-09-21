import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppDb } from "../../db/index.js";
import type { GoGymClient } from "../../gogym/client.js";
import { HttpError } from "../errors.js";
import { requireAuth } from "../plugins/auth.js";
import { cancelPlan, createPlan, getPlan, listPlans, type PlanHooks } from "../services/plan.service.js";

const createPlanSchema = z.object({
  idgrelha: z.number().int().positive(),
});

export function registerPlanRoutes(
  app: FastifyInstance,
  db: AppDb,
  gogym: Pick<GoGymClient, "fetchWeekSchedule" | "cancelReservation">,
  hooks: PlanHooks = {},
): void {
  app.get("/api/v1/plans", { preHandler: requireAuth }, async (request) => {
    const query = request.query as { status?: string };
    const statuses = query.status?.split(",").map((item) => item.trim()).filter(Boolean);
    return listPlans(db, Number(request.session.get("userId")), statuses);
  });

  app.get("/api/v1/plans/:id", { preHandler: requireAuth }, async (request) => {
    const planId = Number((request.params as { id: string }).id);
    if (!Number.isInteger(planId)) throw new HttpError(400, "invalid_id", "Invalid plan id");
    return getPlan(db, Number(request.session.get("userId")), planId);
  });

  app.post("/api/v1/plans", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = createPlanSchema.safeParse(request.body);
    if (!parsed.success) throw new HttpError(400, "invalid_body", "idgrelha is required");
    const plan = await createPlan(db, gogym, Number(request.session.get("userId")), parsed.data.idgrelha, hooks);
    return reply.code(201).send(plan);
  });

  app.delete("/api/v1/plans/:id", { preHandler: requireAuth }, async (request) => {
    const planId = Number((request.params as { id: string }).id);
    if (!Number.isInteger(planId)) throw new HttpError(400, "invalid_id", "Invalid plan id");
    return cancelPlan(db, gogym, Number(request.session.get("userId")), planId, hooks);
  });
}
