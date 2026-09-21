# GoGym Week Planner — Technical Specification

**Versão:** 1.0  
**Data:** 2026-09-21  
**Estado:** Aprovado para implementação  
**Referências:** [`product-brief.md`](product-brief.md) · [`gogym-api.md`](gogym-api.md)

---

## Sumário

1. [Objectivo técnico](#1-objectivo-técnico)
2. [Stack](#2-stack)
3. [Arquitectura](#3-arquitectura)
4. [Estrutura do repositório](#4-estrutura-do-repositório)
5. [Modelo de dados](#5-modelo-de-dados)
6. [Autenticação e autorização](#6-autenticação-e-autorização)
7. [API interna (REST)](#7-api-interna-rest)
8. [Cliente GoGym](#8-cliente-gogym)
9. [Domínio: Plano](#9-domínio-plano)
10. [Bot e scheduler](#10-bot-e-scheduler)
11. [Email](#11-email)
12. [Frontend](#12-frontend)
13. [Configuração e secrets](#13-configuração-e-secrets)
14. [Deploy Windows (LAN)](#14-deploy-windows-lan)
15. [Segurança](#15-segurança)
16. [Observabilidade e logs](#16-observabilidade-e-logs)
17. [Testes](#17-testes)
18. [Fases de implementação](#18-fases-de-implementação)
19. [Decisões técnicas (ADRs)](#19-decisões-técnicas-adrs)

---

## 1. Objectivo técnico

Construir uma **aplicação monolítica Node.js/TypeScript** que corre num **PC Windows sempre ligado**, acessível **apenas na LAN**, com:

- Web UI para planear aulas (Seg–Dom)
- Bot que executa `insert_marcacao.php` no instante de `DataHoraInicioMarcacao`
- Multi-user com admin + users; cada user associa `numcliente` + `idcliente`
- Emails individuais (confirmação + digest semanal)

**Fora de scope v1:** SaaS, acesso remoto, app mobile nativa, multi-centro.

---

## 2. Stack

| Camada | Escolha | Razão |
|--------|---------|-------|
| Runtime | **Node.js 22 LTS** | Já usado no projecto; bom suporte Windows |
| Linguagem | **TypeScript (strict)** | Type-safety nos payloads GoGym |
| HTTP API | **Fastify 5** | Leve, plugins, serve static |
| Frontend | **React 19 + Vite 6** | SPA simples; responsiva para telemóvel em casa |
| ORM | **Drizzle + better-sqlite3** | SQLite zero-config; migrations SQL |
| Auth | **@fastify/secure-session** + bcrypt | Sessões cookie; LAN only |
| Scheduler | **In-process** (timers + node-cron) | Um processo Windows = menos moving parts |
| Email | **Nodemailer** (SMTP) | Gmail, Outlook, ou SMTP local |
| Validação | **Zod** | Request/response + env |
| Testes | **Vitest** | Unit + integration |
| Process manager | **NSSM** ou **pm2** (Windows) | Serviço que reinicia on boot |

**Não usar:** PostgreSQL, Redis, Docker (opcional futuro), Next.js SSR (complexidade desnecessária em LAN).

---

## 3. Arquitectura

### 3.1 Diagrama

```
┌─────────────────────────────────────────────────────────────────┐
│                     Windows PC (LAN)                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  gogym-planner (single Node process)                    │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐ │  │
│  │  │ Fastify API │  │ Scheduler    │  │ Static (Vite   │ │  │
│  │  │ + sessions  │  │ · plan timers│  │  build /dist)  │ │  │
│  │  │             │  │ · digest cron│  │                 │ │  │
│  │  └──────┬──────┘  └──────┬───────┘  └─────────────────┘ │  │
│  │         │                │                               │  │
│  │         └────────┬───────┘                               │  │
│  │                  ▼                                       │  │
│  │         ┌─────────────────┐                            │  │
│  │         │ Drizzle + SQLite│  data/planner.db           │  │
│  │         └─────────────────┘                            │  │
│  └───────────────────────────────────────────────────────────┘  │
└───────────────┬─────────────────────────────┬───────────────────┘
                │ HTTPS                       │ SMTP
                ▼                             ▼
       gogym.gomygym.com                  Email provider
```

### 3.2 Processo único

Um binário `node dist/server.js` expõe:

- `GET /*` → SPA (excepto `/api/*`)
- `/api/*` → JSON REST

O **scheduler corre no mesmo processo** — ao arrancar, carrega planos `PLANNED`/`EXECUTING` e regista timers. Evita IPC e segundo serviço Windows.

### 3.3 Sync de relógio

GoGym expõe `HoraAtualServidor` em `mapa_aulas.php`. O servidor mantém:

```typescript
serverClockOffsetMs = serverTime - Date.now()
```

- Refresh do offset: a cada **15 min** e antes de cada execução de plano
- `nowServer()` = `Date.now() + serverClockOffsetMs`

---

## 4. Estrutura do repositório

```
gogym-bot/
├── package.json
├── tsconfig.json
├── drizzle.config.ts
├── .env.example
├── data/                    # gitignored — SQLite
├── dist/                    # build output
├── public/                  # vite build → copied to dist/client
├── src/
│   ├── server/
│   │   ├── index.ts         # entrypoint
│   │   ├── app.ts           # Fastify setup
│   │   ├── plugins/
│   │   │   ├── auth.ts
│   │   │   └── session.ts
│   │   └── routes/
│   │       ├── auth.routes.ts
│   │       ├── admin.routes.ts
│   │       ├── schedule.routes.ts
│   │       ├── plans.routes.ts
│   │       ├── profile.routes.ts
│   │       └── reservations.routes.ts
│   ├── gogym/
│   │   ├── client.ts        # HTTP client
│   │   ├── types.ts         # GoGymClass, payloads
│   │   ├── book.ts          # build payload + insert_marcacao
│   │   └── clock.ts         # server offset
│   ├── bot/
│   │   ├── scheduler.ts     # register timers, cron digest
│   │   ├── execute-plan.ts  # single plan execution
│   │   └── sync-reservations.ts
│   ├── email/
│   │   ├── transport.ts
│   │   ├── booking-confirmed.ts
│   │   └── weekly-digest.ts
│   ├── db/
│   │   ├── schema.ts
│   │   ├── index.ts
│   │   └── migrations/
│   └── web/                 # React app (Vite root)
│       ├── index.html
│       ├── main.tsx
│       ├── api/             # fetch wrappers
│       └── pages/
├── scripts/
│   ├── seed-admin.ts
│   └── migrate.ts
├── test-book.sh             # mantido para debug manual
├── docs/
│   ├── spec/
│   │   ├── product-brief.md
│   │   ├── tech-spec.md
│   │   ├── implementation-plan.md
│   │   └── gogym-api.md
│   └── archive/
│       └── gogym-bot-investigation-handoff.md
```

---

## 5. Modelo de dados

### 5.1 Diagrama ER

```
users ─────────────┬──< plans
  │                │
  │                └──< plan_execution_logs
  │
  └── user_settings (1:1)
```

### 5.2 Tabelas

#### `users`

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | INTEGER PK | |
| `username` | TEXT UNIQUE | login |
| `email` | TEXT UNIQUE | destino de emails |
| `password_hash` | TEXT | bcrypt cost 12 |
| `role` | TEXT | `admin` \| `user` |
| `display_name` | TEXT | |
| `active` | INTEGER | 0/1 |
| `gogym_numcliente` | TEXT NULL | nº sócio |
| `gogym_idcliente` | TEXT NULL | **obrigatório para planos** |
| `gogym_display_name` | TEXT NULL | cache de `ler_cliente` |
| `created_at` | TEXT ISO | |
| `updated_at` | TEXT ISO | |

Índices: `username`, `email`, `role`.

#### `user_settings`

| Coluna | Tipo | Default |
|--------|------|---------|
| `user_id` | INTEGER PK FK | |
| `digest_enabled` | INTEGER | 1 |
| `digest_day` | INTEGER | 0 (= domingo) |
| `digest_hour` | INTEGER | 20 |
| `digest_minute` | INTEGER | 0 |
| `default_class_filter` | TEXT NULL | ex: `Go Cross` |
| `center_id` | INTEGER | 1 |

#### `plans`

Snapshot do slot GoGym **no momento da criação** + estado.

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | INTEGER PK | |
| `user_id` | INTEGER FK | dono |
| `status` | TEXT | ver §9 |
| `idgrelha` | INTEGER | |
| `idaula` | INTEGER | referência; não vai no POST |
| `nome_aula` | TEXT | |
| `nome_professor` | TEXT NULL | |
| `nome_local` | TEXT NULL | |
| `data_hora_aula` | TEXT | `YYYY-MM-DD HH:MM:SS` |
| `inicio_marcacao` | TEXT | janela abre |
| `fim_marcacao` | TEXT | janela fecha |
| `centro_local` | INTEGER | |
| `lotacao_reserva_web` | INTEGER | |
| `fuso_horario` | TEXT | `Europe/Lisbon` |
| `valor_a` | TEXT | |
| `valor_b` | TEXT | |
| `valor_c` | TEXT | `0` se null |
| `valor_b_num_alunos` | INTEGER | |
| `valor_c_num_alunos` | INTEGER | 0 se null |
| `id_marcacao` | INTEGER NULL | após BOOKED |
| `failure_reason` | TEXT NULL | mensagem API |
| `scheduled_execute_at` | TEXT | = `inicio_marcacao` (para queries) |
| `executed_at` | TEXT NULL | |
| `created_at` | TEXT | |
| `updated_at` | TEXT | |

Índices: `(user_id, status)`, `(status, scheduled_execute_at)`, `(user_id, idgrelha, data_hora_aula)` UNIQUE para evitar duplicados.

#### `plan_execution_logs`

| Coluna | Tipo |
|--------|------|
| `id` | INTEGER PK |
| `plan_id` | INTEGER FK |
| `attempt_at` | TEXT |
| `success` | INTEGER |
| `http_status` | INTEGER NULL |
| `response_body` | TEXT NULL | truncado 2KB |
| `error_message` | TEXT NULL |

#### `app_meta`

| Coluna | Tipo |
|--------|------|
| `key` | TEXT PK |
| `value` | TEXT |

Chaves: `schema_version`, `server_clock_offset_ms`, `server_clock_updated_at`.

---

## 6. Autenticação e autorização

### 6.1 Sessões

- Cookie `session` (httpOnly, sameSite=lax, **secure=false** em LAN HTTP)
- Sessão contém: `{ userId, role, username }`
- TTL: **7 dias** sliding expiration

### 6.2 Bootstrap admin

Script `scripts/seed-admin.ts` (correr uma vez na instalação):

```bash
npm run seed:admin -- --username admin --email luis@... --password ...
```

Cria user `role=admin`. Admin também é user normal (pode ter planos).

### 6.3 Matriz de permissões

| Acção | admin | user |
|-------|-------|------|
| Login | ✓ | ✓ |
| Ver própria semana / planos | ✓ | ✓ |
| Criar/cancelar plano | ✓* | ✓* |
| Editar Conta GoGym | ✓ | ✓ |
| CRUD users | ✓ | ✗ |
| Ver planos de outros | ✗ | ✗ |

\* Requer `gogym_idcliente` configurado.

### 6.4 Passwords

- bcrypt, cost **12**
- Admin pode **reset password** de qualquer user (gera password temporária ou define nova)

---

## 7. API interna (REST)

Base: `/api/v1`  
Formato: JSON  
Erros: `{ "error": "code", "message": "..." }`

### 7.1 Auth

| Método | Path | Descrição |
|--------|------|-----------|
| POST | `/auth/login` | `{ username, password }` → session |
| POST | `/auth/logout` | destroy session |
| GET | `/auth/me` | user actual + settings + gogym linked? |

### 7.2 Perfil GoGym (user)

| Método | Path | Descrição |
|--------|------|-----------|
| GET | `/profile/gogym` | numcliente, idcliente (masked?), display_name |
| PUT | `/profile/gogym` | `{ numcliente, idcliente }` |
| POST | `/profile/gogym/validate` | chama `ler_cliente.php`; actualiza cache nome |

### 7.3 Settings (user)

| Método | Path | Descrição |
|--------|------|-----------|
| GET | `/profile/settings` | digest_* |
| PUT | `/profile/settings` | actualizar digest schedule |

### 7.4 Horário (schedule)

| Método | Path | Descrição |
|--------|------|-----------|
| GET | `/schedule/week` | proxy `mapa_aulas.php` + enrich |

Query: `?center=1&filter=Go Cross` (filter opcional, client-side também OK)

Response enriquecida por slot:

```typescript
interface ScheduleSlot {
  // campos GoGym (IDgrelha, NomeAula, DataHoraAula, ...)
  windowStatus: "FUTURE" | "OPEN" | "CLOSED";
  availableSpots: number;
  userPlanId: number | null;      // se user já tem plano
  userPlanStatus: string | null;
  userHasReservation: boolean;    // cruzamento listar_reservas
}
```

### 7.5 Planos

| Método | Path | Descrição |
|--------|------|-----------|
| GET | `/plans` | lista planos do user (filtro `?status=PLANNED,BOOKED`) |
| POST | `/plans` | criar plano a partir de `idgrelha` |
| GET | `/plans/:id` | detalhe |
| DELETE | `/plans/:id` | cancelar plano PLANNED ou BOOKED |

**POST `/plans` body:**

```json
{ "idgrelha": 92001 }
```

Servidor:

1. Verifica user tem `gogym_idcliente`
2. Fetch `mapa_aulas.php`, encontra slot
3. Verifica UNIQUE (user + idgrelha + data_hora_aula)
4. Insere `status=PLANNED`
5. Regista timer no scheduler
6. Retorna plano

**DELETE `/plans/:id`:**

- `PLANNED` → `CANCELLED`, remove timer
- `BOOKED` → chama `desmarcar_aula.php`, depois `CANCELLED`
- `EXECUTING` → 409 Conflict

### 7.6 Reservas (read-only sync)

| Método | Path | Descrição |
|--------|------|-----------|
| GET | `/reservations` | proxy `listar_reservas.php` do user |

### 7.7 Admin

| Método | Path | Descrição |
|--------|------|-----------|
| GET | `/admin/users` | lista users |
| POST | `/admin/users` | `{ username, email, displayName, password, role? }` |
| PATCH | `/admin/users/:id` | active, email, reset password |
| DELETE | `/admin/users/:id` | soft-delete (`active=0`) |

---

## 8. Cliente GoGym

Módulo `src/gogym/` — portar lógica validada de [`test-book.sh`](test-book.sh) e [`gogym-api.md`](gogym-api.md).

### 8.1 Config global (env)

```env
GOGYM_BASE_URL=https://gogym.gomygym.com
GOGYM_CENTER_ID=1
GOGYM_TIMEZONE=Europe/Lisbon
```

### 8.2 Funções

```typescript
fetchWeekSchedule(centerId: number): Promise<GoGymClass[]>
fetchClassByIdGrelha(centerId: number, idgrelha: number): Promise<GoGymClass | null>
validateClient(idcliente: string): Promise<ClientInfo>
listReservations(idcliente: string): Promise<Reservation[]>
bookClass(idcliente: string, slot: GoGymClass): Promise<BookResult>
cancelReservation(idMarcacao: number): Promise<CancelResult>
getServerTime(): Promise<Date>  // from mapa_aulas HoraAtualServidor
```

### 8.3 Payload de booking (exacto)

Ver `gogym-api.md` §6. Regras codificadas em `book.ts`:

- `fusoHorario` = `NomeFuso` (string IANA)
- `valorC` / `valorCNumAlunos` null → `"0"` / `0`
- datas truncadas sem microsegundos
- **nunca** enviar `IDaula`

### 8.4 Rate limiting interno

- Máx **1 request/segundo** à API GoGym (fila simples)
- Evita burst acidental em sync

---

## 9. Domínio: Plano

### 9.1 Estados

| Status | Significado |
|--------|-------------|
| `PLANNED` | Aguarda janela; timer activo |
| `EXECUTING` | Bot a marcar (lock optimista) |
| `BOOKED` | Sucesso; `id_marcacao` preenchido |
| `FAILED` | Erro ou esgotado após tentativa |
| `CANCELLED` | User cancelou |

### 9.2 Transições

```
PLANNED → EXECUTING → BOOKED
                    → FAILED
PLANNED → CANCELLED
BOOKED  → CANCELLED (via desmarcar_aula)
FAILED  → CANCELLED (limpar)
```

### 9.3 Regras de negócio

1. Não criar plano duplicado (mesmo user + slot)
2. Não criar se janela `CLOSED` (opcional v1.1 — v1 **permite** planear antes da janela; **bloqueia** se já CLOSED)
3. Ao criar plano com janela já `OPEN`, executar **immediately** (marcar agora)
4. Máx **1 plano activo** por slot por user (PLANNED | EXECUTING | BOOKED)

---

## 10. Bot e scheduler

### 10.1 Registo de timers

Ao **arrancar** e ao **criar/cancelar** plano:

```typescript
for (const plan of plannedPlans) {
  const executeAt = parseServerTime(plan.inicio_marcacao) - LEAD_MS
  setTimeout(() => executePlan(plan.id), delay)
}
```

| Constante | Valor | Razão |
|-----------|-------|-------|
| `LEAD_MS` | 0 | Executar exactamente na abertura; offset de relógio compensa |
| `RETRY_COUNT` | 3 | v1.1 — v1: 1 tentativa + log |
| `RETRY_DELAY_MS` | 500 | entre retries se `FAILED` retryable |

### 10.2 Algoritmo `executePlan(planId)`

```
1. SELECT plan FOR UPDATE (status must be PLANNED)
2. UPDATE status = EXECUTING
3. Refresh server clock offset
4. Fetch fresh slot from mapa_aulas by idgrelha
   - if not found → FAILED "slot desapareceu"
5. POST insert_marcacao with user's idcliente
6. if sucesso:
     UPDATE status=BOOKED, id_marcacao=...
     send booking email
   else:
     UPDATE status=FAILED, failure_reason=...
     (v1.1: send failure email)
7. INSERT plan_execution_log
```

### 10.3 Digest semanal (cron)

`node-cron`: por user, expressão calculada de `user_settings.digest_*`

Default: `0 20 * * 0` (domingo 20:00, timezone `Europe/Lisbon`)

Job:

1. Listar users activos com `digest_enabled=1`
2. Para cada: planos PLANNED + BOOKED da semana + reservas API
3. Enviar email individual

### 10.4 Refresh periódico

| Job | Intervalo | Acção |
|-----|-----------|-------|
| Clock sync | 15 min | update `serverClockOffsetMs` |
| Reservation sync | 30 min | cruzar BOOKED com `listar_reservas` |
| Reconcile timers | 1 h | re-register timers (crash recovery) |

---

## 11. Email

### 11.1 Transport

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...          # app password
SMTP_FROM="GoGym Planner <noreply@...>"
APP_BASE_URL=http://192.168.1.50:3847
```

`APP_BASE_URL` — IP LAN do Windows (manual no `.env`).

### 11.2 Templates

| Template | Trigger | Subject |
|----------|---------|---------|
| `booking-confirmed` | BOOKED | `✅ Reservado — {NomeAula} ({data})` |
| `booking-failed` | FAILED (v1.1) | `❌ Falhou — {NomeAula}` |
| `weekly-digest` | cron | `📅 A tua semana GoGym — {date range}` |

HTML simples + texto plano. Sem imagens externas.

---

## 12. Frontend

### 12.1 Rotas (React Router)

| Path | Página | Auth |
|------|--------|------|
| `/login` | Login | public |
| `/` | Semana | user |
| `/planos` | Os meus planos | user |
| `/conta` | Conta GoGym + settings | user |
| `/admin/users` | CRUD users | admin |

Redirect: sem sessão → `/login`. User sem `idcliente` → banner + link `/conta` (bloqueia criar plano).

### 12.2 Página Semana

- Grid 7 colunas (Seg–Dom)
- Cards por aula: nome, hora, vagas, estado janela
- Badge: plano existente (PLANNED/BOOKED)
- Botão **+ Plano** → POST `/plans`
- Filtro texto (debounced)

### 12.3 Stack UI

- CSS modules ou Tailwind (Tailwind recomendado — velocidade)
- Sem component library pesada v1
- Mobile-first (telemetr móvel em casa)

---

## 13. Configuração e secrets

### 13.1 `.env` (servidor)

```env
# Server
HOST=0.0.0.0
PORT=3847
NODE_ENV=production
SESSION_SECRET=...           # 32+ random bytes
DATABASE_PATH=./data/planner.db

# GoGym (global)
GOGYM_BASE_URL=https://gogym.gomygym.com
GOGYM_CENTER_ID=1

# Email
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=...
APP_BASE_URL=http://192.168.1.50:3847

# Optional
LOG_LEVEL=info
```

**Nota:** `gogym_idcliente` vive na **DB por user**, não no `.env` global. O `.env` actual com `GOGYM_CLIENT_ID` migra para o user admin no seed.

### 13.2 `.env.example`

Commitar sem secrets; documentar cada variável.

---

## 14. Deploy Windows (LAN)

### 14.1 Pré-requisitos

- Node.js 22 LTS instalado
- Porta `3847` aberta **só na rede privada** (Windows Firewall inbound rule para subnet local)
- **Não** fazer port forward no router

### 14.2 Build

```powershell
npm ci
npm run build          # tsc + vite build
npm run db:migrate
npm run seed:admin
```

### 14.3 Serviço Windows (NSSM)

```powershell
nssm install GoGymPlanner "C:\Program Files\nodejs\node.exe"
nssm set GoGymPlanner AppDirectory C:\gogym-bot
nssm set GoGymPlanner AppParameters dist\server\index.js
nssm set GoGymPlanner AppEnvironmentExtra NODE_ENV=production
nssm start GoGymPlanner
```

Alternativa: **pm2-windows-service**.

### 14.4 Acesso em casa

Browser: `http://<IP-DO-PC>:3847`  
Descobrir IP: `ipconfig` → IPv4 da interface Wi‑Fi/Ethernet.

### 14.5 Updates

```powershell
git pull
npm ci
npm run build
npm run db:migrate
nssm restart GoGymPlanner
```

---

## 15. Segurança

| Medida | Implementação |
|--------|---------------|
| LAN only | Bind `0.0.0.0` + firewall; sem exposição WAN |
| Passwords | bcrypt |
| Session | secret forte; httpOnly cookie |
| idcliente at rest | SQLite file permissions; pasta `data/` fora de sync cloud |
| CSRF | sameSite=lax; SPA same-origin |
| Admin surface | `/api/v1/admin/*` middleware `role===admin` |
| Logs | Nunca logar `idcliente`, passwords, SMTP pass |
| HTTPS | Opcional LAN (self-signed); v1 HTTP aceitável em rede privada |

---

## 16. Observabilidade e logs

- **Pino** logger (JSON em prod, pretty em dev)
- Ficheiro rotativo: `data/logs/planner.log` (opcional)
- Admin page futura: últimos `plan_execution_logs`

Níveis:

- `info`: plano criado, booked, digest sent
- `warn`: failed booking, clock drift > 2s
- `error`: API GoGym down, SMTP fail

---

## 17. Testes

### 17.1 Unit (Vitest)

| Módulo | Casos |
|--------|-------|
| `gogym/book.ts` | payload builder, null valorC, date truncate |
| `bot/execute-plan.ts` | state transitions (mock client) |
| `auth` | bcrypt, role guard |

### 17.2 Integration

- SQLite in-memory para routes CRUD planos
- Mock `fetch` para GoGym API

### 17.3 Manual (checklist pré-prod)

- [ ] `desmarcar_aula.php` live
- [ ] Plano PLANNED → BOOKED em slot real (aula com vagas)
- [ ] Email recebido
- [ ] Segundo user isolado
- [ ] Digest manual trigger (`POST /api/v1/debug/send-digest` — só dev)

Manter [`test-book.sh`](test-book.sh) para debug independente.

---

## 18. Fases de implementação

Alinhado com [`product-brief.md`](product-brief.md) §14.

### Fase 1 — Core GoGym + bot CLI

- `src/gogym/*` + testes payload
- CLI: `npm run bot:execute -- --plan-id N` (SQLite manual)
- Validar cancelamento live

### Fase 2 — API + DB + auth

- Drizzle schema + migrations
- Fastify routes auth, profile, plans
- seed admin
- Scheduler in-process

### Fase 3 — Web UI

- Login, semana, planos, conta GoGym
- Admin users

### Fase 4 — Email + digest

- Nodemailer templates
- Cron digest per user settings

### Fase 5 — Windows deploy + dogfood

- NSSM, firewall, documentação `docs/windows-setup.md`
- 2 semanas uso real

---

## 19. Decisões técnicas (ADRs)

### ADR-001: Monolito single-process

**Contexto:** 2 users, 1 máquina, baixo tráfego.  
**Decisão:** API + bot + cron no mesmo processo Node.  
**Alternativa rejeitada:** worker separado (complexidade Windows).

### ADR-002: SQLite

**Contexto:** single instance, backup = copiar ficheiro.  
**Alternativa rejeitada:** Postgres (overkill).

### ADR-003: Timers per-plan vs polling

**Decisão:** `setTimeout` por plano PLANNED + reconcile hourly.  
**Alternativa:** poll every 1s (desperdício CPU).

### ADR-004: idcliente na DB por user

**Contexto:** multi-user com contas GoGym distintas.  
**Decisão:** coluna em `users`; não `.env` global.

### ADR-005: SPA + Fastify static

**Decisão:** Vite build servido por Fastify `@fastify/static`.  
**Alternativa rejeitada:** Next.js (SSR desnecessário).

---

## Apêndice A — Mapeamento product → tech

| Product brief | Tech spec |
|---------------|-----------|
| Plano | `plans` table, `/api/v1/plans` |
| Admin cria users | `/api/v1/admin/users` |
| numcliente + idcliente | `users.gogym_*` |
| Digest domingo 20h | `user_settings` + node-cron |
| LAN only | `HOST=0.0.0.0` + firewall |
| Windows sempre on | NSSM service |
| Email individual | per-user `email` column |

---

## Apêndice B — Próximo documento

Implementation plan: [`implementation-plan.md`](implementation-plan.md)

---

*Spec derivada de [`product-brief.md`](product-brief.md) e [`gogym-api.md`](gogym-api.md).*
