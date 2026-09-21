import { getDb, migrateDb } from "../src/db/index.js";

migrateDb(getDb());
console.log("migrations applied");
