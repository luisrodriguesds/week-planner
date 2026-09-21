import Fastify, { type FastifyInstance } from "fastify";
import type { AppDb } from "../db/index.js";
import { createGoGymClient, type GoGymClient } from "../gogym/client.js";
import { HttpError } from "./errors.js";
import { registerSession } from "./plugins/auth.js";
import { registerAdminRoutes } from "./routes/admin.routes.js";
import { registerAuthRoutes } from "./routes/auth.routes.js";
import { registerPlanRoutes } from "./routes/plans.routes.js";
import { registerProfileRoutes } from "./routes/profile.routes.js";
import { registerScheduleRoutes } from "./routes/schedule.routes.js";
import { registerStatic } from "./static.js";
import { loadSessionSecret } from "./session-key.js";
import type { PlanHooks } from "./services/plan.service.js";

export interface BuildAppOptions {
  db: AppDb;
  gogym?: GoGymClient;
  sessionSecret?: string;
  hooks?: PlanHooks;
  logger?: boolean;
  gogymBaseUrl?: string;
  defaultCenterId?: number;
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false });
  const baseUrl = options.gogymBaseUrl ?? process.env.GOGYM_BASE_URL ?? "https://gogym.gomygym.com";
  const defaultCenterId = options.defaultCenterId ?? Number(process.env.GOGYM_CENTER_ID ?? 1);
  const gogym = options.gogym ?? createGoGymClient({ baseUrl, centerId: defaultCenterId });

  await registerSession(app, options.sessionSecret ?? loadSessionSecret());
  registerAuthRoutes(app, options.db);
  registerProfileRoutes(app, options.db, gogym);
  registerPlanRoutes(app, options.db, gogym, options.hooks);
  registerScheduleRoutes(app, options.db, gogym, { baseUrl, defaultCenterId });
  registerAdminRoutes(app, options.db);

  if (process.env.NODE_ENV === "production") {
    await registerStatic(app);
  }

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) {
      return reply.code(error.statusCode).send({ error: error.code, message: error.message });
    }
    request.log.error(error);
    return reply.code(500).send({ error: "internal", message: "Internal error" });
  });

  await app.ready();
  return app;
}
