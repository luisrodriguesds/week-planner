import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { createTestDb } from "../test-helpers.js";

describe("schedule routes", () => {
  let closeDb: () => void = () => {};

  afterEach(() => {
    closeDb();
  });

  it("should require auth on GET /schedule/week", async () => {
    const { db, close } = createTestDb();
    closeDb = close;
    const app = await buildApp({ db });
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/schedule/week",
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  // TODO: secure-session cookie auth hangs/fails under Vitest inject — revisit Phase 3
  it.skip("should enrich slots with windowStatus and availableSpots", async () => {});
});
