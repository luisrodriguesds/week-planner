# GoGym Week Planner — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a LAN-only web app on Windows that lets admin-managed users plan GoGym classes for the week, auto-book at window open, and receive individual emails.

**Architecture:** Single Node.js process (Fastify API + in-process scheduler + static React SPA) with SQLite/Drizzle. GoGym HTTP client reuses validated payload from `test-book.sh`. Each user stores `gogym_idcliente` in DB; bot executes plans via timers synced to `HoraAtualServidor`.

**Tech Stack:** Node 22, TypeScript strict, Fastify 5, React 19 + Vite 6, Drizzle + better-sqlite3, Vitest, Nodemailer, node-cron, bcrypt, @fastify/cookie

**Spec:** [`tech-spec.md`](tech-spec.md) · [`gogym-api.md`](gogym-api.md) · [`product-brief.md`](product-brief.md)

**Progress (2026-09-21):** Phases 1–4 complete. Phase 5 (email) pending. Phase 6 (docs/config) in progress — see [`README.md`](README.md).

## Global Constraints

- Terminology in UI/copy: **Plano** (not "Set")
- GoGym booking payload: lowercase `idgrelha`, `fusoHorario` = `NomeFuso` string (e.g. `Europe/Lisbon`), null `ValorC` → `"0"`
- `mapa_aulas.php` returns full week Mon–Sun in one call
- `gogym_idcliente` per user in DB — never commit secrets; migrate existing `.env` `GOGYM_CLIENT_ID` to admin user on seed
- LAN only: `HOST=0.0.0.0`, default `PORT=3847`, no WAN exposure
- Windows target for production service (NSSM/pm2)
- Do not commit `.env`, `data/`, `node_modules/`
- User must explicitly request git commits; do not commit unless asked

---

## Phase 1 — Project scaffold + GoGym client

### Task 1: Monorepo scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore` (merge with existing)
- Create: `src/gogym/types.ts`

**Interfaces:**
- Produces: `GoGymClass`, `BookPayload`, `BookResult` types in `src/gogym/types.ts`

- [ ] **Step 1: Init package.json**

```json
{
  "name": "gogym-planner",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server/index.ts",
    "build": "tsc && vite build --config src/web/vite.config.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "engines": { "node": ">=22" }
}
```

- [ ] **Step 2: Install dependencies**

```bash
npm install fastify @fastify/static @fastify/secure-session bcrypt drizzle-orm better-sqlite3 zod node-cron nodemailer pino pino-pretty
npm install -D typescript @types/node @types/bcrypt @types/better-sqlite3 vitest tsx vite @vitejs/plugin-react react react-dom react-router-dom @types/react @types/react-dom drizzle-kit
```

- [ ] **Step 3: tsconfig.json strict**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "src/web"]
}
```

- [ ] **Step 4: Define GoGym types**

`src/gogym/types.ts`:

```typescript
export interface GoGymClass {
  IDgrelha: number;
  IDaula: number;
  NomeAula: string;
  NomeProfessor: string;
  NomeLocal: string;
  DataHoraAula: string;
  DataHoraInicioMarcacao: string;
  DataHoraFimMarcacao: string;
  LotacaoReservaWeb: number;
  TotalMarcacoes: number;
  CentroLocal: number;
  NomeFuso: string;
  ValorA: string | null;
  ValorB: string | null;
  ValorC: string | null;
  ValorBNumAlunos: number | null;
  ValorCNumAlunos: number | null;
  HoraAtualServidor: string;
}

export interface BookPayload {
  idcliente: string;
  idgrelha: string;
  dataHoraAula: string;
  centroLocal: string;
  inicioMarcacao: string;
  fimMarcacao: string;
  lotacaoReservaWeb: string;
  fusoHorario: string;
  valorA: string;
  valorB: string;
  valorC: string;
  valorBNumAlunos: string;
  valorCNumAlunos: string;
}

export interface BookResult {
  sucesso: boolean;
  mensagem: string;
  tipo: string;
  idMarcacao?: number;
}
```

- [ ] **Step 5: Verify build**

Run: `npx tsc --noEmit`  
Expected: no errors (empty src ok after types file)

---

### Task 2: GoGym HTTP client

**Files:**
- Create: `src/gogym/config.ts`
- Create: `src/gogym/client.ts`
- Create: `src/gogym/client.test.ts`

**Interfaces:**
- Consumes: `GoGymClass`, `BookResult` from `src/gogym/types.ts`
- Produces: `createGoGymClient(config)`, methods `fetchWeekSchedule()`, `getServerTime()`

- [ ] **Step 1: Write failing test**

`src/gogym/client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createGoGymClient } from "./client.js";

describe("createGoGymClient", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("should fetch week schedule from mapa_aulas.php", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ IDgrelha: 1, HoraAtualServidor: "2026-09-21 15:00:00" }],
    }));

    const client = createGoGymClient({
      baseUrl: "https://gogym.gomygym.com",
      centerId: 1,
    });
    const schedule = await client.fetchWeekSchedule();
    expect(schedule).toHaveLength(1);
    expect(schedule[0].IDgrelha).toBe(1);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm test -- src/gogym/client.test.ts`  
Expected: FAIL — `createGoGymClient` not found

- [ ] **Step 3: Implement client**

`src/gogym/config.ts`:

```typescript
import { z } from "zod";

export const gogymEnvSchema = z.object({
  GOGYM_BASE_URL: z.string().url().default("https://gogym.gomygym.com"),
  GOGYM_CENTER_ID: z.coerce.number().default(1),
});

export type GoGymConfig = z.infer<typeof gogymEnvSchema>;
```

`src/gogym/client.ts`:

```typescript
import type { GoGymClass } from "./types.js";

export interface GoGymClientConfig {
  baseUrl: string;
  centerId: number;
}

export function createGoGymClient(config: GoGymClientConfig) {
  const postForm = async (path: string, body: Record<string, string>) => {
    const params = new URLSearchParams(body);
    const res = await fetch(`${config.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
    if (!res.ok) throw new Error(`GoGym ${path} HTTP ${res.status}`);
    return res.json();
  };

  return {
    async fetchWeekSchedule(): Promise<GoGymClass[]> {
      return postForm("/app/php/mapa_aulas.php", {
        centrolocal: String(config.centerId),
      });
    },
    async getServerTime(): Promise<Date> {
      const data = await this.fetchWeekSchedule();
      const raw = data[0]?.HoraAtualServidor ?? new Date().toISOString().slice(0, 19).replace("T", " ");
      return new Date(raw.replace(" ", "T"));
    },
  };
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npm test -- src/gogym/client.test.ts`  
Expected: PASS

---

### Task 3: Booking payload builder

**Files:**
- Create: `src/gogym/book.ts`
- Create: `src/gogym/book.test.ts`

**Interfaces:**
- Consumes: `GoGymClass`, `BookPayload` from `types.ts`
- Produces: `buildBookPayload(idcliente: string, slot: GoGymClass): BookPayload`, `formatGoGymDateTime(raw: string): string`

- [ ] **Step 1: Write failing tests**

`src/gogym/book.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildBookPayload, formatGoGymDateTime } from "./book.js";
import type { GoGymClass } from "./types.js";

const baseSlot: GoGymClass = {
  IDgrelha: 11701,
  IDaula: 401,
  NomeAula: "Zumba 45",
  NomeProfessor: "Marta",
  NomeLocal: "Estudio 1",
  DataHoraAula: "2026-09-21 21:15:00",
  DataHoraInicioMarcacao: "2026-09-21 09:15:00.000000",
  DataHoraFimMarcacao: "2026-09-21 21:00:00.000000",
  LotacaoReservaWeb: 25,
  TotalMarcacoes: 10,
  CentroLocal: 1,
  NomeFuso: "Europe/Lisbon",
  ValorA: "13.65",
  ValorB: "16.00",
  ValorC: null,
  ValorBNumAlunos: 16,
  ValorCNumAlunos: null,
  HoraAtualServidor: "2026-09-21 15:00:00",
};

describe("formatGoGymDateTime", () => {
  it("should strip microseconds", () => {
    expect(formatGoGymDateTime("2026-09-21 09:15:00.000000")).toBe("2026-09-21 09:15:00");
  });
});

describe("buildBookPayload", () => {
  it("should use NomeFuso and zero for null ValorC", () => {
    const payload = buildBookPayload("12345", baseSlot);
    expect(payload.fusoHorario).toBe("Europe/Lisbon");
    expect(payload.valorC).toBe("0");
    expect(payload.valorCNumAlunos).toBe("0");
    expect(payload.idgrelha).toBe("11701");
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm test -- src/gogym/book.test.ts`

- [ ] **Step 3: Implement**

`src/gogym/book.ts`:

```typescript
import type { BookPayload, GoGymClass } from "./types.js";

export function formatGoGymDateTime(raw: string): string {
  return raw.split(".")[0] ?? raw;
}

function num(value: string | number | null | undefined, fallback = "0"): string {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

export function buildBookPayload(idcliente: string, slot: GoGymClass): BookPayload {
  return {
    idcliente,
    idgrelha: String(slot.IDgrelha),
    dataHoraAula: formatGoGymDateTime(slot.DataHoraAula),
    centroLocal: String(slot.CentroLocal),
    inicioMarcacao: formatGoGymDateTime(slot.DataHoraInicioMarcacao),
    fimMarcacao: formatGoGymDateTime(slot.DataHoraFimMarcacao),
    lotacaoReservaWeb: String(slot.LotacaoReservaWeb),
    fusoHorario: slot.NomeFuso,
    valorA: num(slot.ValorA),
    valorB: num(slot.ValorB),
    valorC: num(slot.ValorC),
    valorBNumAlunos: num(slot.ValorBNumAlunos),
    valorCNumAlunos: num(slot.ValorCNumAlunos),
  };
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npm test -- src/gogym/book.test.ts`

---

### Task 4: bookClass + cancelReservation on client

**Files:**
- Modify: `src/gogym/client.ts`
- Modify: `src/gogym/client.test.ts`

**Interfaces:**
- Consumes: `buildBookPayload` from `book.ts`
- Produces: `client.bookClass(idcliente, slot)`, `client.cancelReservation(idMarcacao)`, `client.listReservations(idcliente)`, `client.validateClient(idcliente)`

- [ ] **Step 1: Add bookClass test with mocked fetch**

```typescript
it("should POST insert_marcacao.php with urlencoded body", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ sucesso: true, idMarcacao: 179112, mensagem: "ok", tipo: "sucesso" }),
  });
  vi.stubGlobal("fetch", fetchMock);

  const client = createGoGymClient({ baseUrl: "https://gogym.gomygym.com", centerId: 1 });
  const result = await client.bookClass("999", baseSlot);
  expect(result.sucesso).toBe(true);
  expect(result.idMarcacao).toBe(179112);
  expect(fetchMock.mock.calls[0][0]).toContain("insert_marcacao.php");
});
```

- [ ] **Step 2: Implement bookClass, listReservations, cancelReservation, validateClient**

Extend `client.ts` using `buildBookPayload` and POST/GET paths from `gogym-api.md`.

- [ ] **Step 3: Manual live test (cancel)**

Run against real API (user confirms):

```bash
./test-book.sh cancel --id 179112 --dry-run
# then without dry-run if user wants to verify desmarcar_aula.php
```

Document result in commit message or PR notes.

---

## Phase 2 — Database + auth + plans API

### Task 5: Drizzle schema + migrations

**Files:**
- Create: `drizzle.config.ts`
- Create: `src/db/schema.ts`
- Create: `src/db/index.ts`
- Create: `src/db/migrations/0001_init.sql`

**Interfaces:**
- Produces: `users`, `userSettings`, `plans`, `planExecutionLogs`, `appMeta` tables; `getDb()` singleton

- [ ] **Step 1: Define schema** per `tech-spec.md` §5.2 (all columns, UNIQUE on plans)

- [ ] **Step 2: Generate/run migration**

```bash
npx drizzle-kit generate
npm run db:migrate   # add script: tsx scripts/migrate.ts
```

- [ ] **Step 3: Smoke test**

```typescript
// scripts/smoke-db.ts — insert user, read back
```

Run: `tsx scripts/smoke-db.ts`  
Expected: prints user id

---

### Task 6: Seed admin script

**Files:**
- Create: `scripts/seed-admin.ts`
- Modify: `package.json` — `"seed:admin": "tsx scripts/seed-admin.ts"`

**Interfaces:**
- Produces: admin user; reads `GOGYM_CLIENT_ID` from env if present → `users.gogym_idcliente`

- [ ] **Step 1: Implement seed with bcrypt cost 12**

```bash
npm run seed:admin -- --username admin --email luis@example.com --password changeme
```

- [ ] **Step 2: Verify admin exists**

```bash
sqlite3 data/planner.db "SELECT username, role FROM users;"
```

Expected: `admin|admin`

---

### Task 7: Fastify app + session auth

**Files:**
- Create: `src/server/index.ts`
- Create: `src/server/app.ts`
- Create: `src/server/plugins/auth.ts`
- Create: `src/server/routes/auth.routes.ts`
- Create: `src/server/routes/auth.routes.test.ts`

**Interfaces:**
- Produces: `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`
- Produces: `requireAuth`, `requireAdmin` preHandlers

- [ ] **Step 1: Failing integration test** (inject Fastify)

```typescript
it("should reject unauthenticated /api/v1/auth/me", async () => {
  const app = await buildApp({ db: testDb });
  const res = await app.inject({ method: "GET", url: "/api/v1/auth/me" });
  expect(res.statusCode).toBe(401);
});
```

- [ ] **Step 2: Implement login/logout/me with secure-session**

- [ ] **Step 3: Run tests**

Run: `npm test -- src/server/routes/auth.routes.test.ts`

---

### Task 8: Profile GoGym routes

**Files:**
- Create: `src/server/routes/profile.routes.ts`
- Create: `src/server/routes/profile.routes.test.ts`

**Interfaces:**
- Consumes: `client.validateClient(idcliente)`
- Produces: `GET/PUT /api/v1/profile/gogym`, `POST /api/v1/profile/gogym/validate`

- [ ] **Step 1: Test PUT requires auth and saves idcliente**

- [ ] **Step 2: Implement validate → ler_cliente.php, cache gogym_display_name**

- [ ] **Step 3: Test user without idcliente gets 403 on plan create (Task 9)**

---

### Task 9: Plans CRUD routes

**Files:**
- Create: `src/server/routes/plans.routes.ts`
- Create: `src/server/routes/plans.routes.test.ts`
- Create: `src/server/services/plan.service.ts`

**Interfaces:**
- Consumes: `fetchWeekSchedule`, `buildBookPayload`, `getDb`, scheduler hook
- Produces: `GET/POST/DELETE /api/v1/plans`, `PlanRecord` with status enum

- [ ] **Step 1: Test POST /plans creates PLANNED row from idgrelha**

- [ ] **Step 2: Test duplicate plan returns 409**

- [ ] **Step 3: Test DELETE PLANNED → CANCELLED**

- [ ] **Step 4: Test DELETE BOOKED calls cancelReservation**

- [ ] **Step 5: Implement plan.service snapshot from live schedule**

---

### Task 10: Schedule week route

**Files:**
- Create: `src/server/routes/schedule.routes.ts`

**Interfaces:**
- Produces: `GET /api/v1/schedule/week?center=1&filter=Go Cross`
- Enriches slots with `windowStatus`, `availableSpots`, `userPlanId`

- [ ] **Step 1: Implement windowStatus from server time offset**

- [ ] **Step 2: Manual curl test**

```bash
curl -s -b cookies.txt http://localhost:3847/api/v1/schedule/week | head
```

---

## Phase 3 — Bot scheduler

### Task 11: Server clock sync

**Files:**
- Create: `src/gogym/clock.ts`
- Create: `src/gogym/clock.test.ts`

**Interfaces:**
- Produces: `createServerClock(client)`, methods `now()`, `refresh()`, `getOffsetMs()`

- [ ] **Step 1: Test offset calculation**

- [ ] **Step 2: Implement refresh every 15 min (wired in Task 12)**

---

### Task 12: executePlan + scheduler

**Files:**
- Create: `src/bot/execute-plan.ts`
- Create: `src/bot/execute-plan.test.ts`
- Create: `src/bot/scheduler.ts`

**Interfaces:**
- Consumes: `plan.service`, `client.bookClass`, `serverClock`, `getDb`
- Produces: `executePlan(planId: number): Promise<void>`, `registerPlanTimer(planId)`, `reconcileAllTimers()`, `startScheduler(appContext)`

- [ ] **Step 1: Test state PLANNED → EXECUTING → BOOKED on mock client**

- [ ] **Step 2: Test slot missing → FAILED**

- [ ] **Step 3: Implement executePlan with plan_execution_logs insert**

- [ ] **Step 4: scheduler registers setTimeout per PLANNED plan on boot**

- [ ] **Step 5: Hourly reconcile cron**

- [ ] **Step 6: Wire scheduler in `src/server/index.ts` after listen**

---

### Task 13: CLI execute plan (debug)

**Files:**
- Create: `scripts/execute-plan.ts`
- Modify: `package.json` — `"bot:execute": "tsx scripts/execute-plan.ts"`

- [ ] **Step 1: CLI `--plan-id N` calls executePlan**

Run: `npm run bot:execute -- --plan-id 1`  
Expected: logs result (manual test with real plan)

---

## Phase 4 — Web UI

### Task 14: Vite + React scaffold

**Files:**
- Create: `src/web/vite.config.ts`
- Create: `src/web/index.html`
- Create: `src/web/main.tsx`
- Create: `src/web/App.tsx`

- [ ] **Step 1: Vite root `src/web`, proxy `/api` → `localhost:3847` in dev**

- [ ] **Step 2: Fastify serves `dist/client` in production**

- [ ] **Step 3: `npm run dev` serves API + Vite concurrently** (use `concurrently` devDep or single Fastify vite plugin)

---

### Task 15: Login page

**Files:**
- Create: `src/web/pages/LoginPage.tsx`
- Create: `src/web/api/client.ts`

- [ ] **Step 1: Login form → POST /api/v1/auth/login → redirect /**

- [ ] **Step 2: Auth guard redirects to /login**

---

### Task 16: Week view + create Plano

**Files:**
- Create: `src/web/pages/WeekPage.tsx`
- Create: `src/web/components/ClassCard.tsx`

- [ ] **Step 1: Fetch GET /schedule/week, 7-column grid**

- [ ] **Step 2: Filter input (debounced)**

- [ ] **Step 3: + Plano button → POST /plans → toast on success**

- [ ] **Step 4: Banner if no gogym_idcliente → link /conta**

---

### Task 17: Planos list + cancel

**Files:**
- Create: `src/web/pages/PlanosPage.tsx`

- [ ] **Step 1: GET /plans with status badges**

- [ ] **Step 2: Cancel button → DELETE /plans/:id**

---

### Task 18: Conta GoGym + settings

**Files:**
- Create: `src/web/pages/ContaPage.tsx`

- [ ] **Step 1: Form numcliente + idcliente**

- [ ] **Step 2: Validate button**

- [ ] **Step 3: Digest settings (day/hour/enabled)**

---

### Task 19: Admin users

**Files:**
- Create: `src/web/pages/admin/UsersPage.tsx`
- Uses: `/api/v1/admin/users` routes (implement in Task 20)

- [ ] **Step 1: List users table**

- [ ] **Step 2: Create user modal**

- [ ] **Step 3: Deactivate user**

---

### Task 20: Admin API routes

**Files:**
- Create: `src/server/routes/admin.routes.ts`

- [ ] **Step 1: requireAdmin on all routes**

- [ ] **Step 2: POST creates user with default user_settings**

- [ ] **Step 3: PATCH reset password**

---

## Phase 5 — Email + digest

### Task 21: Email transport + booking confirmed

**Files:**
- Create: `src/email/transport.ts`
- Create: `src/email/booking-confirmed.ts`
- Modify: `src/bot/execute-plan.ts` — send email on BOOKED

- [ ] **Step 1: Nodemailer from env SMTP_*`

- [ ] **Step 2: HTML + text template**

- [ ] **Step 3: Wire after successful book**

---

### Task 22: Weekly digest cron

**Files:**
- Create: `src/email/weekly-digest.ts`
- Modify: `src/bot/scheduler.ts`

- [ ] **Step 1: buildDigestHtml(user, plans, reservations)**

- [ ] **Step 2: Per-user cron from user_settings (default Sun 20:00 Europe/Lisbon)**

- [ ] **Step 3: Dev-only `POST /api/v1/debug/send-digest` when NODE_ENV=development**

---

### Task 23: Failure email (v1.1 optional)

**Files:**
- Create: `src/email/booking-failed.ts`

- [ ] **Step 1: Send on FAILED status** (can ship after v1 core stable)

---

## Phase 6 — Deploy + docs

### Task 24: .env.example + config loader

**Files:**
- Modify: `.env.example` — all vars from tech-spec §13
- Create: `src/server/config.ts` — Zod parse env on boot

---

### Task 25: Windows setup doc

**Files:**
- Create: `docs/windows-setup.md`

Contents:
- Install Node 22
- Clone, `npm ci`, `npm run build`
- `npm run db:migrate && npm run seed:admin`
- Firewall rule for port 3847 (private subnet only)
- NSSM install commands from tech-spec §14.3
- Find LAN IP, open `http://IP:3847`
- Create wife user via admin UI

---

### Task 26: End-to-end manual checklist

- [ ] Admin login, create second user
- [ ] Second user sets GoGym credentials
- [ ] Create plan for class later this week (window FUTURE)
- [ ] Wait for window OR create plan for OPEN class → immediate book
- [ ] Verify reservation in GoGym app
- [ ] Receive confirmation email
- [ ] Cancel from UI → gone from GoGym app
- [ ] Trigger digest → email received
- [ ] Confirm app unreachable from mobile data (not on Wi‑Fi)

---

## Spec coverage checklist

| Spec section | Task(s) |
|--------------|---------|
| GoGym client + payload | 2, 3, 4 |
| DB schema | 5 |
| Admin seed | 6 |
| Auth sessions | 7 |
| Profile gogym | 8 |
| Plans CRUD | 9 |
| Schedule week | 10 |
| Clock sync | 11 |
| Bot scheduler | 12, 13 |
| React UI | 14–19 |
| Admin API | 20 |
| Email | 21, 22 |
| Windows deploy | 24, 25 |
| Manual E2E | 26 |

---

## Suggested commit boundaries (when user asks to commit)

1. `feat: add gogym client and booking payload`
2. `feat: add database schema and seed admin`
3. `feat: add auth and plans API`
4. `feat: add bot scheduler and execute plan`
5. `feat: add react web ui`
6. `feat: add email notifications and digest`
7. `docs: add windows setup guide`

---

*Plan implements [`tech-spec.md`](tech-spec.md). Execute phase-by-phase; run `npm test` after each task.*
