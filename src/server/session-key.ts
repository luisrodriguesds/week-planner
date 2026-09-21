import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

export function loadSessionSecret(filePath = "data/session.secret"): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (secret) return secret;
  if (existsSync(filePath)) return readFileSync(filePath, "utf8").trim();
  mkdirSync("data", { recursive: true });
  const generated = randomBytes(32).toString("hex");
  writeFileSync(filePath, generated, { mode: 0o600 });
  return generated;
}

export function loadSessionKey(filePath = "data/session.key"): Buffer {
  return createHash("sha256").update(loadSessionSecret(filePath.replace(".key", ".secret"))).digest();
}
