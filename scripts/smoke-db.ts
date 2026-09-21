import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { migrateDb, openDatabase } from "../src/db/index.js";
import { users } from "../src/db/schema.js";

const dir = mkdtempSync(path.join(tmpdir(), "gogym-smoke-"));
const { db, close } = openDatabase(path.join(dir, "planner.db"));
migrateDb(db);

const now = new Date().toISOString();
const user = db.insert(users).values({
  username: "smoke",
  email: "smoke@example.com",
  passwordHash: "hash",
  role: "user",
  displayName: "Smoke",
  active: 1,
  createdAt: now,
  updatedAt: now,
}).returning().get();

console.log(user.id);
close();
