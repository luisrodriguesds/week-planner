# GoGym Class Booking Bot — Investigation Handoff

## Goal

Build a Node.js/TypeScript bot for the GoGym app that can automatically reserve a **Go Cross 45** class as soon as its booking window opens.

The GoGym app opens reservations **12 hours before the class**. Popular Go Cross classes can fill very quickly, so the desired bot flow is:

1. Fetch the class schedule ahead of time.
2. Find the desired Go Cross class.
3. Read the booking opening time supplied by the GoGym backend.
4. Prepare the reservation request in advance.
5. At the exact booking opening time, send the reservation request.
6. Verify that the reservation was created.
7. Avoid duplicate reservations and log the result.

Do not assume the reservation payload yet. Most of the API has been reverse-engineered, but the exact request body for `insert_marcacao.php` is still unresolved.

---

## App / reverse-engineering context

Android package:

```text
com.proinf.gogym
```

The production APK is **not debuggable**:

```text
run-as: package not debuggable: com.proinf.gogym
```

The installed app is Flutter. Relevant Flutter/Dart source paths embedded in the AOT binary include:

```text
package:gogym/api/carregar_aulas.dart
package:gogym/api/marcar_aula.dart
package:gogym/api/desmarcar_aula.dart
package:gogym/api/carregar_reservas.dart
package:gogym/api/ler_cliente.dart
package:gogym/api/aula_model.dart
package:gogym/screens/confirmar_reserva_screen.dart
```

Relevant symbols/strings:

```text
marcarAula
_tentarMarcarAula@649482462
desmarcarAula
carregarReservasDoCliente
_carregarPermissaoMarcacao@649482462
_atualizarDadosAula@649482462
```

The Flutter AOT binary is:

```text
/tmp/gogym-arm64/lib/arm64-v8a/libapp.so
```

It came from:

```text
split_config.arm64_v8a.apk
```

The `strings` approach has reached its limit because string order in `libapp.so` does not reliably correspond to Dart function structure. If the reservation payload cannot be inferred safely, the next useful reverse-engineering step is a Flutter AOT tool such as **Blutter**, potentially followed by Ghidra.

---

## Why Proxyman did not work

An Android emulator was configured to use Proxyman at:

```text
10.0.2.2:9090
```

Chrome traffic appeared correctly in Proxyman and HTTPS could be decrypted.

However, **no GoGym traffic appeared at all**, even while the app was clearly making successful backend requests.

Conclusion: the Flutter/Dart HTTP implementation used by the production GoGym app is bypassing/ignoring the Android HTTP proxy configuration.

The Android Studio Network Inspector is also not useful because the production app is not debuggable.

The current Android AVD uses a production image:

```text
adb root
→ adbd cannot run as root in production builds
```

So `/data/data/com.proinf.gogym/...` cannot be read from this emulator.

---

## Backend discovered

The GoGym unit/subdomain is:

```text
gogym
```

Backend base URL:

```text
https://gogym.gomygym.com
```

The app appears to construct URLs approximately as:

```text
https://{spSubdominio}.gomygym.com/app/php/...
```

Relevant SharedPreferences-style names embedded in the app:

```text
spSubdominio
spIdCliente
spNumCliente
spDeviceId
spCentroLocal
spNaoMarcaAulas
spTokenNotificacoes
```

---

# Confirmed API endpoints

## 1. Get gym centers

```http
GET /app/php/obter_centros.php
```

Confirmed response:

```json
{
  "status": "ok",
  "centros": [
    { "centro": "7", "designacao": "Chaves" },
    { "centro": "4", "designacao": "Coimbra" },
    { "centro": "6", "designacao": "Lamego" },
    { "centro": "5", "designacao": "Maia" },
    { "centro": "1", "designacao": "Porto" },
    { "centro": "2", "designacao": "Valongo" },
    { "centro": "3", "designacao": "Vila Real" }
  ]
}
```

The target GoGym / Hospital São João classes are under:

```text
centro = 1
```

---

## 2. Fetch class schedule

Endpoint:

```http
POST /app/php/mapa_aulas.php
Content-Type: application/x-www-form-urlencoded
```

Confirmed payload:

```text
centrolocal=1
```

Example curl:

```bash
curl -s -X POST \
  'https://gogym.gomygym.com/app/php/mapa_aulas.php' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data 'centrolocal=1'
```

This returns a JSON array containing the schedule.

Important fields include:

```ts
interface GoGymClass {
  ID: number;
  IDgrelha: number;
  IDmodelo: number;
  IDaula: number;
  IDlocal: number;
  IDprofessor: number;

  DiaSemana: number;
  NomeAula: string;
  NomeProfessor: string;
  NomeLocal: string;

  Duracao: number;

  Lotacao: number;
  LotacaoReservaWeb: number;
  TotalMarcacoes: number;
  MarcacoesApp: number;
  MarcacoesSemFixas: number;

  TempoReservaInicioWeb: number;
  TempoReservaFimWeb: number;

  DataProximaAula: string;
  HoraLimpa: string;
  DataHoraAula: string;
  DataHoraInicioMarcacao: string;
  DataHoraFimMarcacao: string;

  HoraAtualServidor: string;

  CentroLocal: number;
  IDfuso: number;
  NomeFuso: string;
}
```

The server currently reports:

```text
NomeFuso = Europe/Lisbon
```

### Important discovery

`TempoReservaInicioWeb` is:

```text
720
```

which is 720 minutes = **12 hours**.

More importantly, the backend already calculates:

```text
DataHoraInicioMarcacao
DataHoraFimMarcacao
HoraAtualServidor
```

Therefore the bot should **not calculate "12 hours before" itself** if avoidable. Use `DataHoraInicioMarcacao` returned by the server.

The bot can also use `HoraAtualServidor` to calculate clock drift between the machine and GoGym's backend.

---

# Go Cross identifiers

The class type consistently appears as:

```text
NomeAula = "Go Cross 45"
IDaula = 3701
```

However, **IDgrelha varies by schedule slot** and identifies the specific scheduled class.

Examples observed:

```text
2026-09-21 20:20
IDgrelha = 91901
IDaula   = 3701

2026-09-22 19:30
IDgrelha = 92001
IDaula   = 3701

2026-09-23 19:35
IDgrelha = 23601
IDaula   = 3701

2026-09-23 20:30
IDgrelha = 92501
IDaula   = 3701

2026-09-24 19:25
IDgrelha = 8201
IDaula   = 3701

2026-09-25 07:15
IDgrelha = 9001
IDaula   = 3701
```

Do not hardcode `IDgrelha`. Always obtain it from `mapa_aulas.php`.

---

# Example Go Cross object

One observed Go Cross class:

```json
{
  "IDgrelha": 92001,
  "IDaula": 3701,
  "NomeAula": "Go Cross 45",
  "NomeProfessor": "António Guimarães",
  "NomeLocal": "Estudio 4",

  "Lotacao": 16,
  "LotacaoReservaWeb": 16,
  "TotalMarcacoes": 0,

  "TempoReservaInicioWeb": 720,
  "TempoReservaFimWeb": 15,

  "DataHoraAula": "2026-09-22 19:30:00",
  "DataHoraInicioMarcacao": "2026-09-22 07:30:00",
  "DataHoraFimMarcacao": "2026-09-22 19:15:00",

  "HoraAtualServidor": "2026-09-21 13:39:27",

  "CentroLocal": 1,
  "NomeFuso": "Europe/Lisbon"
}
```

---

## 3. Get current occupancy/details for a scheduled class

Endpoint:

```http
GET /app/php/obter_detalhes_aula.php?idgrelha={IDgrelha}
```

Example:

```bash
curl -s \
  'https://gogym.gomygym.com/app/php/obter_detalhes_aula.php?idgrelha=91901'
```

Confirmed response:

```json
{
  "IDgrelha": 91901,
  "Lotacao": 16,
  "LotacaoReservaWeb": 16,
  "TotalMarcacoes": 13
}
```

This endpoint can be useful immediately before reservation to inspect occupancy, but for a highly competitive class **do not add a blocking network round trip at the exact opening second** unless there is a strong reason.

---

# Client identification

There are two distinct concepts:

```text
numcliente  = customer-facing membership/client number
idcliente   = internal database client ID
```

The app stores them separately:

```text
spNumCliente
spIdCliente
```

The internal ID is what the API endpoints tested so far require.

For privacy/security, keep the actual client ID in environment variables. Do not hardcode it into source control.

Suggested:

```env
GOGYM_CLIENT_ID=...
GOGYM_CENTER_ID=1
GOGYM_SUBDOMAIN=gogym
```

---

## 4. Read client

Endpoint:

```http
POST /app/php/ler_cliente.php
Content-Type: application/x-www-form-urlencoded
```

Confirmed payload:

```text
idcliente={internal client ID}
```

Example:

```bash
curl -s -X POST \
  'https://gogym.gomygym.com/app/php/ler_cliente.php' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'idcliente=...'
```

When a membership number was sent instead:

```json
{
  "status": "erro",
  "mensagem": "Id cliente em falta"
}
```

With the internal ID it returns:

```json
{
  "status": "ok",
  "numcliente": "...",
  "nome": "...",
  "email": "...",
  "datanascimento": "...",
  "centrolocal": 1,
  "inativo": 0,
  "settingsJSON": "{\"AppAtiva\":1,\"Modulos\":\"1;2;3\",\"Multicentro\":7,\"NaoMarcaAulas\":0,\"Modulo4\":1}",
  "coresJSON": "..."
}
```

Important:

```text
NaoMarcaAulas = 0
```

for the account tested, meaning class booking is enabled.

Do not log PII returned by this endpoint.

---

## 5. List existing reservations

Endpoint:

```http
POST /app/php/listar_reservas.php
Content-Type: application/x-www-form-urlencoded
```

Confirmed payload:

```text
idcliente={internal client ID}
```

Example:

```bash
curl -s -X POST \
  'https://gogym.gomygym.com/app/php/listar_reservas.php' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'idcliente=...'
```

Confirmed response shape:

```json
[
  {
    "ID": 178391,
    "NomeAula": "Go Cross 45",
    "DataHoraAula": "2026-09-21 20:20:00.000"
  }
]
```

The `ID` returned here is very likely the **reservation / marking ID (`idMarcacao`)**, not `IDgrelha`.

The APK contains:

```text
idMarcacao
desmarcarAula
desmarcar_aula.php
```

This interpretation has not yet been independently confirmed by calling the cancellation endpoint.

---

# Reservation endpoint — partially reverse-engineered

Endpoint:

```http
POST /app/php/insert_marcacao.php
Content-Type: application/x-www-form-urlencoded
```

The Flutter app contains:

```text
package:gogym/api/marcar_aula.dart
marcarAula
_tentarMarcarAula@649482462
```

Potentially relevant fields found in the AOT binary:

```text
idcliente
idCliente
IDgrelha
idgrelha
IDaula
dataHoraAula
centro
centroLocal
deviceId
deviceid
idMarcacao
```

The exact request body is **NOT yet known**.

### Tests already performed

Test without client ID:

```text
idgrelha=91901
IDaula=3701
```

Response:

```json
{
  "sucesso": false,
  "mensagem": "Parâmetros em falta.",
  "tipo": "erro"
}
```

Test with:

```text
idcliente={internal ID}
IDgrelha=91901
IDaula=3701
```

Response was still:

```json
{
  "sucesso": false,
  "mensagem": "Parâmetros em falta.",
  "tipo": "erro"
}
```

Therefore `insert_marcacao.php` requires **at least one additional field**.

Do not blindly brute-force combinations against this endpoint because it has side effects.

---

# Existing-reservation behavior in the iOS app

For an already-booked Go Cross class, tapping **Reservar** in the iPhone app shows:

```text
Informação

Já fizeste uma marcação para esta aula.
O teu lugar já está reservado.

Se não podes comparecer, desmarca em 'As Minhas Reservas'.
```

It is not yet known whether:

1. this duplicate check is performed locally before `insert_marcacao.php`, or
2. `insert_marcacao.php` returns a duplicate response that the app maps to this message.

A useful next investigation is searching the AOT binary for the exact text:

```bash
strings -n 3 /tmp/gogym-arm64/lib/arm64-v8a/libapp.so \
  | grep -n -B 100 -A 150 \
  -E 'Já fizeste uma marcação|lugar já está reservado|As Minhas Reservas|marcação para esta aula'
```

Also search reservation-related validation strings:

```bash
strings -n 3 /tmp/gogym-arm64/lib/arm64-v8a/libapp.so \
  | grep -n -E \
  'Parâmetros em falta|Reserva efetuada|lotação|Lotação|esgotad|marcação|Marcação|reservad|Reservad|período|Período|vaga|Vaga'
```

---

# HTTP implementation clues

The binary confirms use of Dart's `package:http` and form bodies:

```text
package:http/src/request.dart
package:http/src/base_client.dart
set:bodyFields
application/x-www-form-urlencoded
application/x-www-form-urlencoded; charset=UTF-8
POST
```

No Bearer token or session cookie has been observed as necessary for the tested endpoints.

So far these endpoints work directly with only the documented parameters:

```text
obter_centros.php
mapa_aulas.php
obter_detalhes_aula.php
ler_cliente.php
listar_reservas.php
```

Do not assume `insert_marcacao.php` has no additional authorization/device validation until its contract is known.

---

# Other discovered endpoints

Useful / related endpoints embedded in the APK:

```text
/app/php/insert_marcacao.php
/app/php/desmarcar_aula.php
/app/php/listar_reservas.php
/app/php/mapa_aulas.php
/app/php/obter_detalhes_aula.php?idgrelha=
/app/php/ler_cliente.php
/app/php/obter_centros.php

/app/php/registo_verificar_condicoes.php
/app/php/registo_inserir.php
/app/php/registo_reinstalacao.php
/app/php/registo_substituir.php

/app/php/verificar_dispositivo_ativo.php
/app/php/atualizar_device_id.php
/app/php/atualizar_device_versao.php
/app/php/atualizar_token.php

/app/php/listar_settings_cliente.php?idcliente=
/app/php/atualizar_setting_cliente.php?idcliente=

/app/php/get_frequencia_dashboard.php?idcliente=
/app/php/get_ocupacao_dashboard.php?centrolocal=
```

Avoid calling endpoints with mutation semantics unless intentionally testing a controlled action.

---

# Suggested next steps

## Priority 1 — determine exact `insert_marcacao.php` payload

Do this before implementing automatic booking.

Preferred approaches, in order:

### A. Search exact duplicate-booking message

Determine whether the duplicate check is local and identify nearby Dart symbols.

### B. Flutter AOT reverse engineering

Use **Blutter** on `libapp.so`.

Targets:

```text
package:gogym/api/marcar_aula.dart
marcarAula
_tentarMarcarAula@649482462
insert_marcacao.php
```

Goal: identify the exact map passed to `bodyFields`.

Expected conceptual structure:

```dart
await http.post(
  Uri.parse(
    'https://$subdominio.gomygym.com/app/php/insert_marcacao.php'
  ),
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  body: {
    // determine exact fields
  }
);
```

Do not assume the field names or casing.

### C. Controlled real reservation test

Only after the likely payload is known.

Use a non-competitive class with open booking and available spaces, intentionally book it, verify via `listar_reservas.php`, then cancel it through the official app or a confirmed cancellation endpoint.

Avoid brute-force requests to the booking endpoint.

---

# Proposed Node/TypeScript architecture

Once the booking payload is known:

```text
src/
  api/
    client.ts
    classes.ts
    reservations.ts

  domain/
    class.ts
    reservation.ts

  scheduler/
    bookingScheduler.ts

  config.ts
  index.ts
```

Suggested responsibilities:

## `classes.ts`

```ts
getClasses(centerId)
getClassDetails(idGrelha)
findClasses(criteria)
```

## `reservations.ts`

```ts
listReservations(clientId)
bookClass(...)
cancelReservation(...)
```

## `bookingScheduler.ts`

Given criteria such as:

```ts
{
  className: "Go Cross 45",
  date: "2026-09-22",
  time: "19:30"
}
```

it should:

1. Fetch the schedule well before booking opens.
2. Resolve the exact `IDgrelha`.
3. Store the class snapshot.
4. Read `DataHoraInicioMarcacao`.
5. Compare `HoraAtualServidor` against local time.
6. Schedule the request.
7. Shortly before opening, optionally refresh the schedule once.
8. At opening time, send the prepared reservation POST immediately.
9. Parse the response.
10. Verify using `listar_reservas.php`.
11. Log success/failure.

---

# Timing strategy

For competitive classes, avoid this at booking time:

```text
07:30:00
→ fetch map
→ search JSON
→ fetch details
→ build payload
→ reserve
```

Instead:

```text
hours earlier
→ fetch map
→ find class
→ capture IDgrelha / IDaula
→ capture booking opening timestamp
→ prepare payload

07:29:xx
→ optionally synchronize against HoraAtualServidor
→ prepare connection/request

07:30:00
→ POST reservation immediately
```

The schedule endpoint exposes:

```text
HoraAtualServidor
```

Use this to estimate:

```ts
serverClockOffset = serverTime - localTime;
```

Be careful that a single HTTP request includes network latency. For better synchronization, take multiple samples and estimate offset around the midpoint of request start/end.

Example conceptual approach:

```ts
const t0 = Date.now();
const response = await fetchSchedule();
const t1 = Date.now();

const server = parseLisbonTime(response[0].HoraAtualServidor);
const midpoint = (t0 + t1) / 2;

const estimatedOffset = server.getTime() - midpoint;
```

Take several samples and use the lowest-latency sample or median offset.

Do not hammer the server.

---

# Availability calculation

For a class:

```ts
const available =
  classInfo.LotacaoReservaWeb - classInfo.TotalMarcacoes;
```

However, treat the server's reservation response as authoritative because occupancy can change between reads.

Example:

```text
LotacaoReservaWeb = 16
TotalMarcacoes     = 13
available          = 3
```

---

# Duplicate protection

Before sending a reservation:

1. Call `listar_reservas.php`.
2. Compare `NomeAula` + normalized `DataHoraAula`.
3. If already reserved, do not POST again.

Also implement an in-process lock/idempotency guard:

```ts
const bookingKey = `${idGrelha}:${clientId}`;
```

Only one attempt for the same booking should execute concurrently.

If the booking response is ambiguous due to timeout/network failure, **verify reservations before retrying**.

Do not blindly retry a side-effecting POST.

---

# Configuration

Suggested `.env`:

```env
GOGYM_BASE_URL=https://gogym.gomygym.com
GOGYM_CLIENT_ID=...
GOGYM_CENTER_ID=1
GOGYM_TIMEZONE=Europe/Lisbon
```

Do not commit `.env`.

`.gitignore`:

```gitignore
.env
.env.*
node_modules/
dist/
*.log
```

---

# Logging

Useful log format:

```text
[06:00:00.123] Found Go Cross 45 — 19:30
[06:00:00.124] IDgrelha=92001 IDaula=3701
[06:00:00.124] Booking opens at 07:30:00 Europe/Lisbon
[07:29:59.900] Preparing booking
[07:30:00.012] POST reservation
[07:30:00.xxx] Reservation response received
[07:30:00.xxx] Reservation verified
```

Never log:

```text
full client profile
email
date of birth
device ID
FCM token
```

Client ID should preferably be redacted in normal logs.

---

# Error handling

Handle at least:

```text
booking window not open
booking window closed
class full
already reserved
missing parameters
account cannot book classes
network timeout
unexpected response
server 5xx
schedule changed / IDgrelha changed
```

For timeout after sending a reservation request:

```text
DO NOT immediately retry
↓
call listar_reservas.php
↓
if reservation exists → success
if not → decide whether a retry is safe
```

---

# Important unresolved questions

1. What exact fields does `insert_marcacao.php` require?
2. Does booking require `deviceid`?
3. Does it require class date/time or center in addition to IDs?
4. Is duplicate booking prevented server-side?
5. What exact response indicates:
   - success
   - already booked
   - full class
   - too early
   - booking closed
6. What exact payload does `desmarcar_aula.php` require?
7. Is the `ID` from `listar_reservas.php` definitely `idMarcacao`?
8. Does the backend enforce any rate limit?
9. Are there GoGym terms/rules restricting automated booking? Verify before deploying unattended automation.

---

# Safety / operational constraints for implementation

This is intended for the account owner's own gym account.

Keep the bot conservative:

- one reservation attempt at opening;
- no request flooding;
- no parallel burst of dozens of requests;
- no brute-forcing IDs;
- no attempts to bypass capacity or booking-window checks;
- verify ambiguous results before retrying;
- keep credentials/identifiers outside source control;
- provide a dry-run mode;
- provide a manual test mode before enabling scheduling.

Recommended CLI:

```bash
npm run classes
npm run reservations
npm run dry-run
npm run book -- --date 2026-09-22 --time 19:30 --class "Go Cross 45"
npm run scheduler
```

`dry-run` should perform every step except the final mutation.

---

# Current investigation status

Confirmed:

- Backend host.
- Porto center ID.
- Schedule endpoint.
- Class-detail endpoint.
- Internal client-ID concept.
- Client-read endpoint.
- Reservations-list endpoint.
- Go Cross class ID.
- Specific schedule ID (`IDgrelha`) concept.
- 12-hour reservation window.
- Server-provided opening timestamp.
- Server clock timestamp.
- Reservation endpoint location.
- Form-urlencoded request format.
- Reservation endpoint needs more fields than `idcliente + IDgrelha + IDaula`.

Not confirmed:

- Exact reservation POST body.
- Cancellation POST body.
- Whether device ID participates in booking authorization.
- Exact reservation response contract.

**Do not implement the final automatic mutation until the exact `insert_marcacao.php` contract is established.**
