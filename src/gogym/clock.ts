import { eq } from "drizzle-orm";
import type { AppDb } from "../db/index.js";
import { appMeta } from "../db/schema.js";
import type { GoGymClient } from "./client.js";

export interface ServerClock {
  now(): Date;
  refresh(): Promise<void>;
  getOffsetMs(): number;
}

const OFFSET_KEY = "server_clock_offset_ms";
const UPDATED_AT_KEY = "server_clock_updated_at";

function readMeta(db: AppDb, key: string): string | null {
  return db.select().from(appMeta).where(eq(appMeta.key, key)).get()?.value ?? null;
}

function writeMeta(db: AppDb, key: string, value: string): void {
  db.insert(appMeta).values({ key, value }).onConflictDoUpdate({
    target: appMeta.key,
    set: { value },
  }).run();
}

export function createServerClock(
  client: Pick<GoGymClient, "getServerTime">,
  db: AppDb,
): ServerClock {
  let offsetMs = Number(readMeta(db, OFFSET_KEY) ?? 0);

  return {
    now() {
      return new Date(Date.now() + offsetMs);
    },
    getOffsetMs() {
      return offsetMs;
    },
    async refresh() {
      const serverTime = await client.getServerTime();
      offsetMs = serverTime.getTime() - Date.now();
      writeMeta(db, OFFSET_KEY, String(offsetMs));
      writeMeta(db, UPDATED_AT_KEY, new Date().toISOString());
    },
  };
}

export const CLOCK_REFRESH_MS = 15 * 60 * 1000;
