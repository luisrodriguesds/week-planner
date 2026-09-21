import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema.js";

export type AppDb = BetterSQLite3Database<typeof schema>;

const migrationsFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

export function openDatabase(dbPath: string): { db: AppDb; close: () => void } {
  if (dbPath !== ":memory:") {
    mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  return { db, close: () => sqlite.close() };
}

let singleton: { db: AppDb; close: () => void } | null = null;

export function getDb(dbPath = process.env.DATABASE_PATH ?? "data/planner.db"): AppDb {
  if (!singleton) singleton = openDatabase(dbPath);
  return singleton.db;
}

export function migrateDb(db: AppDb): void {
  migrate(db, { migrationsFolder });
}
