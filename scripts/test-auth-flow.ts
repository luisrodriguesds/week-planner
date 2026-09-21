import { buildApp } from "../src/server/app.js";
import { createTestDb, insertUser, login } from "../src/server/test-helpers.js";

const { db, close } = createTestDb();
const { password } = insertUser(db, { username: "ada", gogymIdcliente: "999" });
const app = await buildApp({ db });
const session = await login(app, "ada", password);
console.log("login", session.res.statusCode, session.cookie.slice(0, 40));
const me = await app.inject({
  method: "GET",
  url: "/api/v1/auth/me",
  headers: { cookie: session.cookie },
});
console.log("me", me.statusCode, me.body);
await app.close();
close();
