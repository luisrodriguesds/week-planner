import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppDb } from "../../db/index.js";
import { userSettings, users } from "../../db/schema.js";
import { HttpError } from "../errors.js";
import { requireAdmin } from "../plugins/auth.js";

const createUserSchema = z.object({
  username: z.string().min(1),
  email: z.string().email(),
  displayName: z.string().min(1),
  password: z.string().min(6),
  role: z.enum(["admin", "user"]).optional(),
});

const patchUserSchema = z.object({
  active: z.number().int().min(0).max(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
});

function toAdminUser(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    displayName: user.displayName,
    active: user.active,
    gogymLinked: Boolean(user.gogymIdcliente),
  };
}

export function registerAdminRoutes(app: FastifyInstance, db: AppDb): void {
  app.get("/api/v1/admin/users", { preHandler: requireAdmin }, async () => {
    return db.select().from(users).all().map(toAdminUser);
  });

  app.post("/api/v1/admin/users", { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = createUserSchema.safeParse(request.body);
    if (!parsed.success) throw new HttpError(400, "invalid_body", "Invalid user payload");

    const existing = db.select().from(users).where(eq(users.username, parsed.data.username)).get();
    if (existing) throw new HttpError(409, "duplicate_user", "Username already exists");

    const now = new Date().toISOString();
    const created = db.insert(users).values({
      username: parsed.data.username,
      email: parsed.data.email,
      displayName: parsed.data.displayName,
      passwordHash: bcrypt.hashSync(parsed.data.password, 12),
      role: parsed.data.role ?? "user",
      active: 1,
      createdAt: now,
      updatedAt: now,
    }).returning().get();

    db.insert(userSettings).values({ userId: created.id }).run();
    return reply.code(201).send(toAdminUser(created));
  });

  app.patch("/api/v1/admin/users/:id", { preHandler: requireAdmin }, async (request) => {
    const parsed = patchUserSchema.safeParse(request.body);
    if (!parsed.success) throw new HttpError(400, "invalid_body", "Invalid patch payload");

    const userId = Number((request.params as { id: string }).id);
    if (!Number.isInteger(userId)) throw new HttpError(400, "invalid_id", "Invalid user id");

    const updates: Partial<typeof users.$inferInsert> = { updatedAt: new Date().toISOString() };
    if (parsed.data.active !== undefined) updates.active = parsed.data.active;
    if (parsed.data.email !== undefined) updates.email = parsed.data.email;
    if (parsed.data.password !== undefined) {
      updates.passwordHash = bcrypt.hashSync(parsed.data.password, 12);
    }

    const updated = db.update(users).set(updates).where(eq(users.id, userId)).returning().get();
    if (!updated) throw new HttpError(404, "not_found", "User not found");
    return toAdminUser(updated);
  });

  app.delete("/api/v1/admin/users/:id", { preHandler: requireAdmin }, async (request) => {
    const userId = Number((request.params as { id: string }).id);
    if (!Number.isInteger(userId)) throw new HttpError(400, "invalid_id", "Invalid user id");

    const updated = db.update(users).set({
      active: 0,
      updatedAt: new Date().toISOString(),
    }).where(eq(users.id, userId)).returning().get();

    if (!updated) throw new HttpError(404, "not_found", "User not found");
    return toAdminUser(updated);
  });
}
