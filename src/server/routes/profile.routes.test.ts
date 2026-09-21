import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { createTestDb } from "../test-helpers.js";

describe("profile routes", () => {
  let closeDb: () => void = () => {};

  afterEach(() => {
    closeDb();
  });

  it("should require auth on PUT /profile/gogym", async () => {
    const { db, close } = createTestDb();
    closeDb = close;
    const app = await buildApp({ db });
    const res = await app.inject({
      method: "PUT",
      url: "/api/v1/profile/gogym",
      payload: { idcliente: "12345", numcliente: "88" },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  // TODO: secure-session cookie auth hangs/fails under Vitest inject — revisit Phase 3
  it.skip("should save idcliente and validate via ler_cliente", async () => {});
});
