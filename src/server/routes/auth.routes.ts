import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppDb } from "../../db/index.js";
import { userSettings, users } from "../../db/schema.js";
import { HttpError } from "../errors.js";
import { requireAuth } from "../plugins/auth.js";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export function registerAuthRoutes(app: FastifyInstance, db: AppDb): void {
  app.post("/api/v1/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) throw new HttpError(400, "invalid_body", "username and password are required");

    const user = db.select().from(users).where(eq(users.username, parsed.data.username)).get();
    const passwordOk = user ? bcrypt.compareSync(parsed.data.password, user.passwordHash) : false;
    if (!user || !passwordOk || user.active !== 1) {
      throw new HttpError(401, "invalid_credentials", "Invalid credentials");
    }

    request.session.set("userId", user.id);
    request.session.set("role", user.role);
    request.session.set("username", user.username);
    return reply.send({ id: user.id, username: user.username, role: user.role });
  });

  app.post("/api/v1/auth/logout", async (request, reply) => {
    request.session.delete();
    return reply.code(204).send();
  });

  app.get("/api/v1/auth/me", { preHandler: requireAuth }, async (request) => {
    const userId = Number(request.session.get("userId"));
    const user = db.select().from(users).where(eq(users.id, userId)).get();
    if (!user || user.active !== 1) throw new HttpError(401, "unauthorized", "Authentication required");
    const settings = db.select().from(userSettings).where(eq(userSettings.userId, userId)).get() ?? null;
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      displayName: user.displayName,
      gogymLinked: Boolean(user.gogymIdcliente),
      settings,
    };
  });
}
