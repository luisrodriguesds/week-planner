import cookie from "@fastify/cookie";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

const SESSION_COOKIE = "session";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export interface SessionData {
  userId?: number;
  role?: string;
  username?: string;
}

class AppSession {
  private dirty = false;
  private deleted = false;

  constructor(
    private readonly reply: FastifyReply,
    private data: SessionData,
  ) {}

  get<K extends keyof SessionData>(key: K): SessionData[K] {
    return this.data[key];
  }

  set<K extends keyof SessionData>(key: K, value: SessionData[K]): void {
    this.data[key] = value;
    this.dirty = true;
  }

  delete(): void {
    this.deleted = true;
    this.dirty = true;
  }

  persist(): void {
    if (this.deleted) {
      this.reply.clearCookie(SESSION_COOKIE, { path: "/" });
      return;
    }
    if (!this.dirty) return;
    this.reply.setCookie(SESSION_COOKIE, JSON.stringify(this.data), {
      signed: true,
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: SESSION_TTL_SECONDS,
    });
  }
}

function readSessionData(request: FastifyRequest): SessionData {
  const raw = request.cookies[SESSION_COOKIE];
  if (!raw) return {};
  const unsigned = request.unsignCookie(raw);
  if (!unsigned.valid || !unsigned.value) return {};
  try {
    return JSON.parse(unsigned.value) as SessionData;
  } catch {
    return {};
  }
}

export async function registerSession(app: FastifyInstance, secret: string): Promise<void> {
  await app.register(cookie, { secret, hook: "onRequest" });

  app.addHook("onRequest", async (request, reply) => {
    const session = new AppSession(reply, readSessionData(request));
    request.session = session;
  });

  app.addHook("onSend", async (request) => {
    request.session.persist();
  });
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const userId = request.session.get("userId");
  if (!userId) {
    await reply.code(401).send({ error: "unauthorized", message: "Authentication required" });
  }
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const userId = request.session.get("userId");
  if (!userId) {
    await reply.code(401).send({ error: "unauthorized", message: "Authentication required" });
    return;
  }
  if (request.session.get("role") !== "admin") {
    await reply.code(403).send({ error: "forbidden", message: "Admin required" });
  }
}

export function signSessionCookie(app: FastifyInstance, data: SessionData): string {
  return `${SESSION_COOKIE}=${app.signCookie(JSON.stringify(data))}`;
}

declare module "fastify" {
  interface FastifyRequest {
    session: AppSession;
  }
}
