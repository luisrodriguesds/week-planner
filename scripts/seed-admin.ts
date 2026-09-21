import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { getDb, migrateDb } from "../src/db/index.js";
import { userSettings, users } from "../src/db/schema.js";
import { loadDotEnv } from "../src/server/load-dotenv.js";

loadDotEnv();

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1 || process.argv[index + 1] === undefined) return undefined;
  return process.argv[index + 1];
}

const username = flag("username");
const email = flag("email");
const password = flag("password");

if (!username || !email || !password) {
  console.error("Usage: npm run seed:admin -- --username admin --email you@example.com --password ...");
  process.exit(1);
}

const db = getDb();
migrateDb(db);

const existing = db.select().from(users).where(eq(users.username, username)).get();
if (existing) {
  console.log(`user ${username} already exists (id=${existing.id})`);
  process.exit(0);
}

const now = new Date().toISOString();
const gogymIdcliente = process.env.GOGYM_CLIENT_ID?.trim() || null;
const created = db.insert(users).values({
  username,
  email,
  passwordHash: bcrypt.hashSync(password, 12),
  role: "admin",
  displayName: username,
  active: 1,
  gogymIdcliente,
  createdAt: now,
  updatedAt: now,
}).returning().get();

db.insert(userSettings).values({ userId: created.id }).run();
console.log(`created admin id=${created.id} gogym_idcliente=${gogymIdcliente ? "set" : "unset"}`);
