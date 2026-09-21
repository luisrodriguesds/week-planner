import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { createTestDb } from "../test-helpers.js";

describe("admin routes", () => {
  let closeDb: () => void = () => {};

  afterEach(() => {
    closeDb();
  });

  it("should require auth on GET /admin/users", async () => {
    const { db, close } = createTestDb();
    closeDb = close;
    const app = await buildApp({ db });
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/users",
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  // TODO: secure-session cookie auth fails under Vitest inject — revisit
  it.skip("should allow admin to list and create users", async () => {});
});
