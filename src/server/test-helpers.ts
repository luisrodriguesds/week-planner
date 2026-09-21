import bcrypt from "bcrypt";
import type { FastifyInstance } from "fastify";
import { migrateDb, openDatabase, type AppDb } from "../db/index.js";
import { userSettings, users } from "../db/schema.js";
import { signSessionCookie } from "./plugins/auth.js";

export function createTestDb(): { db: AppDb; close: () => void } {
  const opened = openDatabase(":memory:");
  migrateDb(opened.db);
  return opened;
}

export function insertUser(db: AppDb, input: {
  username?: string;
  email?: string;
  password?: string;
  role?: string;
  gogymIdcliente?: string | null;
  active?: number;
} = {}) {
  const now = new Date().toISOString();
  const password = input.password ?? "secret";
  const user = db.insert(users).values({
    username: input.username ?? "ada",
    email: input.email ?? `${input.username ?? "ada"}@example.com`,
    passwordHash: bcrypt.hashSync(password, 4),
    role: input.role ?? "user",
    displayName: input.username ?? "ada",
    active: input.active ?? 1,
    gogymIdcliente: input.gogymIdcliente,
    createdAt: now,
    updatedAt: now,
  }).returning().get();
  db.insert(userSettings).values({ userId: user.id }).run();
  return { user, password };
}

export function createSessionCookie(
  app: FastifyInstance,
  data: { userId: number; role: string; username: string },
): string {
  return signSessionCookie(app, data);
}

export async function login(app: FastifyInstance, username: string, password: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { username, password },
  });
  const header = res.headers["set-cookie"];
  const raw = Array.isArray(header) ? header : [header ?? ""];
  const cookie = raw.map((item) => String(item).split(";")[0]).filter(Boolean).join("; ");
  return { res, cookie };
}
