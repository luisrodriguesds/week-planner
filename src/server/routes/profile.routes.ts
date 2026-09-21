import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppDb } from "../../db/index.js";
import { userSettings, users } from "../../db/schema.js";
import type { GoGymClient } from "../../gogym/client.js";
import { HttpError } from "../errors.js";
import { requireAuth } from "../plugins/auth.js";

const profileSchema = z.object({
  numcliente: z.string().optional(),
  idcliente: z.string().min(1),
});

const settingsSchema = z.object({
  digestEnabled: z.number().int().min(0).max(1).optional(),
  digestDay: z.number().int().min(0).max(6).optional(),
  digestHour: z.number().int().min(0).max(23).optional(),
  digestMinute: z.number().int().min(0).max(59).optional(),
  defaultClassFilter: z.string().nullable().optional(),
  centerId: z.number().int().positive().optional(),
});

export function registerProfileRoutes(
  app: FastifyInstance,
  db: AppDb,
  gogym: Pick<GoGymClient, "validateClient">,
): void {
  app.get("/api/v1/profile/gogym", { preHandler: requireAuth }, async (request) => {
    const user = requireUser(db, Number(request.session.get("userId")));
    return {
      numcliente: user.gogymNumcliente,
      idcliente: user.gogymIdcliente,
      displayName: user.gogymDisplayName,
    };
  });

  app.put("/api/v1/profile/gogym", { preHandler: requireAuth }, async (request) => {
    const parsed = profileSchema.safeParse(request.body);
    if (!parsed.success) throw new HttpError(400, "invalid_body", "idcliente is required");
    const userId = Number(request.session.get("userId"));
    requireUser(db, userId);
    db.update(users).set({
      gogymNumcliente: parsed.data.numcliente ?? null,
      gogymIdcliente: parsed.data.idcliente,
      updatedAt: new Date().toISOString(),
    }).where(eq(users.id, userId)).run();
    return {
      numcliente: parsed.data.numcliente ?? null,
      idcliente: parsed.data.idcliente,
    };
  });

  app.post("/api/v1/profile/gogym/validate", { preHandler: requireAuth }, async (request) => {
    const user = requireUser(db, Number(request.session.get("userId")));
    if (!user.gogymIdcliente) throw new HttpError(400, "gogym_not_linked", "Configure GoGym idcliente first");

    let info;
    try {
      info = await gogym.validateClient(user.gogymIdcliente);
    } catch {
      throw new HttpError(502, "gogym_unavailable", "Could not validate GoGym client");
    }

    db.update(users).set({
      gogymDisplayName: info.nome,
      updatedAt: new Date().toISOString(),
    }).where(eq(users.id, user.id)).run();

    let naoMarcaAulas: number | null = null;
    try {
      const settings = JSON.parse(info.settingsJSON) as { NaoMarcaAulas?: number };
      naoMarcaAulas = settings.NaoMarcaAulas ?? null;
    } catch {
      naoMarcaAulas = null;
    }

    return {
      status: info.status,
      nome: info.nome,
      inativo: info.inativo,
      naoMarcaAulas,
    };
  });

  app.get("/api/v1/profile/settings", { preHandler: requireAuth }, async (request) => {
    const userId = Number(request.session.get("userId"));
    requireUser(db, userId);
    const settings = db.select().from(userSettings).where(eq(userSettings.userId, userId)).get();
    if (!settings) throw new HttpError(404, "not_found", "Settings not found");
    return settings;
  });

  app.put("/api/v1/profile/settings", { preHandler: requireAuth }, async (request) => {
    const parsed = settingsSchema.safeParse(request.body);
    if (!parsed.success) throw new HttpError(400, "invalid_body", "Invalid settings payload");
    const userId = Number(request.session.get("userId"));
    requireUser(db, userId);
    const updated = db.update(userSettings).set(parsed.data).where(eq(userSettings.userId, userId)).returning().get();
    if (!updated) throw new HttpError(404, "not_found", "Settings not found");
    return updated;
  });
}

function requireUser(db: AppDb, userId: number) {
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user || user.active !== 1) throw new HttpError(401, "unauthorized", "Authentication required");
  return user;
}
