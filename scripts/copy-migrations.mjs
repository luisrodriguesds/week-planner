// tsc only emits .js — drizzle needs the .sql migrations and meta/_journal.json
// next to dist/db/index.js at runtime.
import { cpSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(projectRoot, "src", "db", "migrations");
const destination = path.join(projectRoot, "dist", "db", "migrations");

cpSync(source, destination, { recursive: true });
