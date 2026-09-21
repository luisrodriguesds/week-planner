import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { createTestDb, insertUser, login } from "../test-helpers.js";

describe("auth routes", () => {
  let closeDb: () => void = () => {};

  afterEach(() => {
    closeDb();
  });

  it("should reject unauthenticated /api/v1/auth/me", async () => {
    const { db, close } = createTestDb();
    closeDb = close;
    const app = await buildApp({ db });
    const res = await app.inject({ method: "GET", url: "/api/v1/auth/me" });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("should login and return the current user", async () => {
    const { db, close } = createTestDb();
    closeDb = close;
    const { password } = insertUser(db, { username: "ada", gogymIdcliente: "999" });
    const app = await buildApp({ db });
    const session = await login(app, "ada", password);
    expect(session.res.statusCode).toBe(200);

    const me = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie: session.cookie },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({ username: "ada", gogymLinked: true });
    await app.close();
  });
});
