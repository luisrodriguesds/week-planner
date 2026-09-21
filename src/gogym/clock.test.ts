import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { appMeta } from "../db/schema.js";
import { createTestDb } from "../server/test-helpers.js";
import { createServerClock } from "./clock.js";

describe("createServerClock", () => {
  it("should compute offset from server time on refresh", async () => {
    const { db, close } = createTestDb();
    const serverTime = new Date("2026-09-21T15:00:00");
    const before = Date.now();
    const client = { getServerTime: vi.fn().mockResolvedValue(serverTime) };
    const clock = createServerClock(client, db);
    await clock.refresh();
    const offset = clock.getOffsetMs();
    expect(offset).toBeGreaterThanOrEqual(serverTime.getTime() - before - 50);
    expect(offset).toBeLessThanOrEqual(serverTime.getTime() - before + 50);
    expect(clock.now().getTime()).toBeCloseTo(serverTime.getTime(), -2);
    close();
  });

  it("should persist offset in app_meta", async () => {
    const { db, close } = createTestDb();
    const serverTime = new Date("2026-09-21T16:00:00");
    const client = { getServerTime: vi.fn().mockResolvedValue(serverTime) };
    const clock = createServerClock(client, db);
    await clock.refresh();
    const row = db.select().from(appMeta).where(eq(appMeta.key, "server_clock_offset_ms")).get();
    expect(row?.value).toBe(String(clock.getOffsetMs()));
    close();
  });
});
