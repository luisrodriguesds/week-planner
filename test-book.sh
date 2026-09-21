#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${GOGYM_BASE_URL:-https://gogym.gomygym.com}"
CENTER_ID="${GOGYM_CENTER_ID:-1}"
TIMEZONE="${GOGYM_TIMEZONE:-Europe/Lisbon}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a
  source "$ENV_FILE"
  set +a
fi

BASE_URL="${GOGYM_BASE_URL:-$BASE_URL}"
CENTER_ID="${GOGYM_CENTER_ID:-$CENTER_ID}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

usage() {
  cat <<'EOF'
GoGym controlled booking test

Usage:
  ./test-book.sh classes [--open] [--min-avail N] [--name FILTER]
  ./test-book.sh reservations
  ./test-book.sh book --idgrelha ID [--dry-run]
  ./test-book.sh cancel --id RESERVATION_ID [--dry-run]

Environment (.env):
  GOGYM_CLIENT_ID=...     required for reservations/book
  GOGYM_CENTER_ID=1       optional, default 1 (Porto)
  GOGYM_BASE_URL=...      optional

Examples:
  ./test-book.sh classes --open --min-avail 3
  ./test-book.sh classes --name "Zumba"
  ./test-book.sh reservations
  ./test-book.sh book --idgrelha 11701 --dry-run
  ./test-book.sh cancel --id 179112 --dry-run
EOF
}

require_client_id() {
  if [[ -z "${GOGYM_CLIENT_ID:-}" ]]; then
    echo -e "${RED}GOGYM_CLIENT_ID is not set.${NC}" >&2
    echo "Create .env with GOGYM_CLIENT_ID=... (internal client id, not membership number)" >&2
    exit 1
  fi
}

api_post() {
  local endpoint="$1"
  shift
  curl -sS -X POST "${BASE_URL}${endpoint}" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    "$@"
}

cmd_classes() {
  local only_open=0
  local min_avail=1
  local name_filter=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --open) only_open=1; shift ;;
      --min-avail) min_avail="$2"; shift 2 ;;
      --name) name_filter="$2"; shift 2 ;;
      *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
    esac
  done

  local response
  response="$(api_post "/app/php/mapa_aulas.php" --data "centrolocal=${CENTER_ID}")"

  GOGYM_ONLY_OPEN="$only_open" \
  GOGYM_MIN_AVAIL="$min_avail" \
  GOGYM_NAME_FILTER="$name_filter" \
  python3 - "$response" <<'PY'
import json, sys, os
from datetime import datetime

raw = sys.argv[1]
data = json.loads(raw)
if not data:
    print("Empty schedule response")
    sys.exit(1)

now_str = data[0].get("HoraAtualServidor", "")
now = datetime.strptime(now_str, "%Y-%m-%d %H:%M:%S")
only_open = os.environ.get("GOGYM_ONLY_OPEN") == "1"
min_avail = int(os.environ.get("GOGYM_MIN_AVAIL", "1"))
name_filter = os.environ.get("GOGYM_NAME_FILTER", "").lower()

rows = []
for c in data:
    name = c.get("NomeAula", "")
    if name_filter and name_filter not in name.lower():
        continue

    lot = int(c.get("LotacaoReservaWeb") or 0)
    total = int(c.get("TotalMarcacoes") or 0)
    avail = lot - total

    inicio = c.get("DataHoraInicioMarcacao", "")
    fim = c.get("DataHoraFimMarcacao", "")
    try:
        t_inicio = datetime.strptime(inicio, "%Y-%m-%d %H:%M:%S")
        t_fim = datetime.strptime(fim, "%Y-%m-%d %H:%M:%S")
    except ValueError:
        continue

    if now < t_inicio:
        status = "FUTURE"
    elif now > t_fim:
        status = "CLOSED"
    else:
        status = "OPEN"

    if avail < min_avail:
        continue
    if only_open and status != "OPEN":
        continue

    rows.append({
        "status": status,
        "avail": avail,
        "lot": lot,
        "name": name,
        "datetime": c.get("DataHoraAula", ""),
        "idgrelha": c.get("IDgrelha"),
        "idaula": c.get("IDaula"),
        "prof": c.get("NomeProfessor", ""),
        "local": c.get("NomeLocal", ""),
        "inicio": inicio,
        "fim": fim,
    })

rows.sort(key=lambda r: (r["status"] != "OPEN", r["status"] == "CLOSED", r["datetime"]))

print(f"Server time: {now_str}")
print(f"Center: {data[0].get('CentroLocal', '?')} | Matches: {len(rows)}")
print()

if not rows:
    print("No classes matched. Try without --open or lower --min-avail.")
    sys.exit(0)

status_colors = {"OPEN": "OPEN", "FUTURE": "SOON", "CLOSED": "CLOSED"}
for i, r in enumerate(rows, 1):
    tag = status_colors.get(r["status"], r["status"])
    print(f"{i:2}. [{tag:6}] {r['name']} | {r['datetime']}")
    print(f"    avail {r['avail']}/{r['lot']} | IDgrelha={r['idgrelha']} IDaula={r['idaula']}")
    print(f"    {r['prof']} @ {r['local']}")
    print(f"    booking window: {r['inicio']} -> {r['fim']}")
    print()
PY
}

cmd_reservations() {
  require_client_id
  local response
  response="$(api_post "/app/php/listar_reservas.php" --data-urlencode "idcliente=${GOGYM_CLIENT_ID}")"

  python3 - "$response" <<'PY'
import json, sys

raw = sys.argv[1]
try:
    data = json.loads(raw)
except json.JSONDecodeError:
    print(raw)
    sys.exit(1)

if not data:
    print("No reservations.")
    sys.exit(0)

print(f"Reservations: {len(data)}")
for r in data:
    print(f"- ID={r.get('ID')} | {r.get('NomeAula')} | {r.get('DataHoraAula')}")
PY
}

fetch_class_json() {
  local idgrelha="$1"
  local response
  response="$(api_post "/app/php/mapa_aulas.php" --data "centrolocal=${CENTER_ID}")"

  GOGYM_IDGRELHA="$idgrelha" python3 - "$response" <<'PY'
import json, sys

raw = sys.argv[1]
target = int(__import__("os").environ["GOGYM_IDGRELHA"])
data = json.loads(raw)

for c in data:
    if int(c.get("IDgrelha") or 0) == target:
        print(json.dumps(c))
        sys.exit(0)

print(f"No class with IDgrelha={target} in today's schedule.", file=sys.stderr)
sys.exit(1)
PY
}

build_book_args_from_class() {
  local class_json="$1"
  local lines line key value
  require_client_id

  lines=()
  while IFS= read -r line; do
    lines+=("$line")
  done < <(GOGYM_TIMEZONE="${TIMEZONE}" python3 - "$class_json" <<'PY'
import json, sys, os

c = json.loads(sys.argv[1])
tz = c.get("NomeFuso") or os.environ.get("GOGYM_TIMEZONE", "Europe/Lisbon")

def fmt_dt(value):
    if not value:
        return ""
    return value.split(".")[0]

def num(value, default="0"):
    if value is None or value == "":
        return default
    return str(value)

fields = [
    ("idcliente", os.environ.get("GOGYM_CLIENT_ID", "")),
    ("idgrelha", str(c.get("IDgrelha", ""))),
    ("dataHoraAula", fmt_dt(c.get("DataHoraAula", ""))),
    ("centroLocal", str(c.get("CentroLocal", ""))),
    ("inicioMarcacao", fmt_dt(c.get("DataHoraInicioMarcacao", ""))),
    ("fimMarcacao", fmt_dt(c.get("DataHoraFimMarcacao", ""))),
    ("lotacaoReservaWeb", str(c.get("LotacaoReservaWeb", ""))),
    ("fusoHorario", tz),
    ("valorA", num(c.get("ValorA"))),
    ("valorB", num(c.get("ValorB"))),
    ("valorC", num(c.get("ValorC"))),
    ("valorBNumAlunos", num(c.get("ValorBNumAlunos"))),
    ("valorCNumAlunos", num(c.get("ValorCNumAlunos"))),
]

for key, value in fields:
    print(f"{key}={value}")
PY
)

  for line in "${lines[@]:-}"; do
    BOOK_ARGS+=(--data-urlencode "$line")
  done
}

post_booking() {
  local idgrelha="$1"
  BOOK_ARGS=()

  local class_json
  class_json="$(fetch_class_json "$idgrelha")"

  echo -e "${CYAN}Class:${NC} $(echo "$class_json" | python3 -c 'import json,sys; c=json.load(sys.stdin); print(c["NomeAula"]+" @ "+c["DataHoraAula"])')"
  build_book_args_from_class "$class_json"

  local response
  response="$(api_post "/app/php/insert_marcacao.php" "${BOOK_ARGS[@]}")"
  echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
  echo
}

cmd_book() {
  local idgrelha=""
  local dry_run=0

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --idgrelha) idgrelha="$2"; shift 2 ;;
      --dry-run) dry_run=1; shift ;;
      *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
    esac
  done

  if [[ -z "$idgrelha" ]]; then
    echo "book requires --idgrelha" >&2
    exit 1
  fi

  require_client_id

  echo -e "${BOLD}Booking test${NC}"
  echo "IDgrelha=$idgrelha centroLocal=$CENTER_ID"
  echo

  if [[ "$dry_run" -eq 1 ]]; then
    local class_json
    class_json="$(fetch_class_json "$idgrelha")"
    BOOK_ARGS=()
    build_book_args_from_class "$class_json"
    echo -e "${YELLOW}DRY RUN — no POST sent${NC}"
    echo "Would POST insert_marcacao.php with:"
    local i=0 payload name
    while [[ $i -lt ${#BOOK_ARGS[@]} ]]; do
      payload="${BOOK_ARGS[$((i + 1))]}"
      name="${payload%%=*}"
      if [[ "$name" == "idcliente" ]]; then
        echo "  idcliente=***"
      else
        echo "  ${payload}"
      fi
      i=$((i + 2))
    done
    exit 0
  fi

  echo -e "${YELLOW}Sending booking request (Blutter payload)...${NC}"
  post_booking "$idgrelha"

  echo -e "${BOLD}Checking reservations...${NC}"
  cmd_reservations
}

cmd_cancel() {
  local reservation_id=""
  local dry_run=0

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --id) reservation_id="$2"; shift 2 ;;
      --dry-run) dry_run=1; shift ;;
      *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
    esac
  done

  if [[ -z "$reservation_id" ]]; then
    echo "cancel requires --id (reservation ID from listar_reservas.php)" >&2
    exit 1
  fi

  require_client_id

  echo -e "${BOLD}Cancel reservation${NC}"
  echo "id=${reservation_id}"
  echo

  if [[ "$dry_run" -eq 1 ]]; then
    echo -e "${YELLOW}DRY RUN — no POST sent${NC}"
    echo "Would POST desmarcar_aula.php with:"
    echo "  id=${reservation_id}"
    exit 0
  fi

  local response
  response="$(api_post "/app/php/desmarcar_aula.php" --data-urlencode "id=${reservation_id}")"
  echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
  echo

  echo -e "${BOLD}Checking reservations...${NC}"
  cmd_reservations
}

main() {
  local cmd="${1:-}"
  shift || true

  case "$cmd" in
    classes) cmd_classes "$@" ;;
    reservations|reservas) cmd_reservations ;;
    book) cmd_book "$@" ;;
    cancel) cmd_cancel "$@" ;;
    help|-h|--help|"") usage ;;
    *)
      echo "Unknown command: $cmd" >&2
      usage
      exit 1
      ;;
  esac
}

main "$@"
