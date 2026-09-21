import { eq } from "drizzle-orm";
import { executePlan } from "../src/bot/execute-plan.js";
import { createGoGymClient } from "../src/gogym/client.js";
import { createServerClock } from "../src/gogym/clock.js";
import { getDb, migrateDb } from "../src/db/index.js";
import { plans } from "../src/db/schema.js";
import { loadDotEnv } from "../src/server/load-dotenv.js";

loadDotEnv();

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1 || process.argv[index + 1] === undefined) return undefined;
  return process.argv[index + 1];
}

const planIdRaw = flag("plan-id");
if (!planIdRaw) {
  console.error("Usage: npm run bot:execute -- --plan-id N");
  process.exit(1);
}

const planId = Number(planIdRaw);
if (!Number.isInteger(planId) || planId <= 0) {
  console.error("plan-id must be a positive integer");
  process.exit(1);
}

const db = getDb();
migrateDb(db);

const baseUrl = process.env.GOGYM_BASE_URL ?? "https://gogym.gomygym.com";
const centerId = Number(process.env.GOGYM_CENTER_ID ?? 1);
const gogym = createGoGymClient({ baseUrl, centerId });
const clock = createServerClock(gogym, db);

const before = db.select().from(plans).where(eq(plans.id, planId)).get();
if (!before) {
  console.error(`Plano ${planId} not found`);
  process.exit(1);
}

console.log(`Executing plan ${planId} (${before.nomeAula} @ ${before.dataHoraAula}, status=${before.status})`);
await executePlan(db, gogym, clock, planId);

const after = db.select().from(plans).where(eq(plans.id, planId)).get();
console.log(JSON.stringify({
  id: after?.id,
  status: after?.status,
  idMarcacao: after?.idMarcacao,
  failureReason: after?.failureReason,
}, null, 2));
