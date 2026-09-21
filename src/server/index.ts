import { createScheduler } from "../bot/scheduler.js";
import { createGoGymClient } from "../gogym/client.js";
import { createServerClock } from "../gogym/clock.js";
import { migrateDb, getDb } from "../db/index.js";
import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { loadSessionSecret } from "./session-key.js";

const config = loadConfig();

const db = getDb(config.databasePath);
migrateDb(db);

const gogym = createGoGymClient({ baseUrl: config.gogymBaseUrl, centerId: config.gogymCenterId });
const clock = createServerClock(gogym, db);
await clock.refresh();

const scheduler = createScheduler({ db, gogym, clock });

const app = await buildApp({
  db,
  gogym,
  sessionSecret: config.sessionSecret ?? loadSessionSecret(),
  logger: true,
  hooks: {
    registerPlanTimer: scheduler.registerPlanTimer,
    cancelPlanTimer: scheduler.cancelPlanTimer,
  },
});

await app.listen({ host: config.host, port: config.port });
scheduler.startScheduler();

app.log.info(`GoGym Planner listening on http://${config.host}:${config.port}`);
