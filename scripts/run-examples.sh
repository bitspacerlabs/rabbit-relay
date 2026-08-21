#!/usr/bin/env bash
set -uo pipefail

# Run every Rabbit Relay example one by one and report pass/fail.
#
# Usage:
#   bash scripts/run-examples.sh [--reset] [--timeout 5] [--only "glob"]
#
# Options:
#   --reset        Recreate the RabbitMQ container before running (clean state)
#   --timeout N    Seconds to let each long-running example run (default 5)
#   --only "glob"  Only run files matching this pattern (e.g. "00-basics/*")
#
# A result is:
#   PASS (completed)     — one-shot example exited 0 on its own
#   PASS (long-running)  — still running after the timeout, killed cleanly
#   FAIL                 — exited non-zero (crash, error, or topology conflict)

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

TIMEOUT=5
RESET=false
ONLY=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --reset) RESET=true; shift ;;
    --timeout) TIMEOUT="$2"; shift 2 ;;
    --only) ONLY="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Colors
if [[ -t 1 ]]; then
  GREEN="\033[32m"; RED="\033[31m"; YELLOW="\033[33m"; DIM="\033[2m"; RESET_C="\033[0m"
else
  GREEN=""; RED=""; YELLOW=""; DIM=""; RESET_C=""
fi

log() { echo -e "[$(date '+%H:%M:%S')] $*"; }

# ── Ensure RabbitMQ is up ────────────────────────────────────────────
ensure_rabbitmq() {
  log "Checking RabbitMQ…"

  if ! docker ps --format '{{.Names}}' | rg -q 'rabbitmq'; then
    log "Starting RabbitMQ (docker compose)…"
    docker compose -f examples/docker-compose.yml up -d
    RESET=true
  fi

  if [[ "$RESET" == "true" ]]; then
    log "Resetting RabbitMQ (--reset)…"
    docker compose -f examples/docker-compose.yml down -v >/dev/null 2>&1
    docker compose -f examples/docker-compose.yml up -d
  fi

  log "Waiting for RabbitMQ to be healthy…"
  for i in $(seq 1 30); do
    if docker exec $(docker ps --format '{{.Names}}' | rg 'rabbitmq' | head -1) \
        rabbitmq-diagnostics -q ping >/dev/null 2>&1; then
      log "RabbitMQ is healthy."
      return 0
    fi
    sleep 1
  done

  echo -e "${RED}RabbitMQ did not become healthy in 30s${RESET_C}"
  exit 1
}

ensure_rabbitmq

# ── Collect example files ────────────────────────────────────────────
mapfile -t FILES < <(find examples -name '*.ts' -printf '%p\n' | sort)

if [[ -n "$ONLY" ]]; then
  FILTERED=()
  for f in "${FILES[@]}"; do
    if [[ "$f" == *"$ONLY"* ]]; then FILTERED+=("$f"); fi
  done
  FILES=("${FILTERED[@]}")
fi

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "No example files found."
  exit 0
fi

log "Running ${#FILES[@]} examples (timeout=${TIMEOUT}s per file)"

# ── Run each example ─────────────────────────────────────────────────
PASS=0
FAIL=0
FAILED_FILES=()

printf "%-55s %s\n" "EXAMPLE" "RESULT"
printf "%-55s %s\n" "-------" "------"

for f in "${FILES[@]}"; do
  short="${f#examples/}"

  # Suppress stdout, capture stderr
  ERR=$(timeout "$TIMEOUT" npx tsx "$f" 2>&1 >/dev/null)
  CODE=$?

  case $CODE in
    0)
      printf "%-55s ${GREEN}PASS${RESET_C} (completed)\n" "$short"
      PASS=$((PASS + 1))
      ;;
    124)
      printf "%-55s ${GREEN}PASS${RESET_C} (long-running, ${TIMEOUT}s)\n" "$short"
      PASS=$((PASS + 1))
      ;;
    137)
      printf "%-55s ${YELLOW}SKIP${RESET_C} (killed)\n" "$short"
      PASS=$((PASS + 1))
      ;;
    *)
      printf "%-55s ${RED}FAIL${RESET_C} (exit ${CODE})\n" "$short"
      FAIL=$((FAIL + 1))
      FAILED_FILES+=("$short")
      ;;
  esac
done

# ── Summary ─────────────────────────────────────────────────────────
echo ""
echo "========================================"
printf "  Total: %d  ${GREEN}Pass: %d${RESET_C}  ${RED}Fail: %d${RESET_C}\n" \
  $((PASS + FAIL)) "$PASS" "$FAIL"
echo "========================================"

if [[ $FAIL -gt 0 ]]; then
  echo ""
  echo "Failed examples:"
  for f in "${FAILED_FILES[@]}"; do
    echo "  - $f"
  done
  echo ""
  echo "Note: some examples fail when run alone because they depend on"
  echo "topology created by another example (e.g. passive DLQ consumers)."
  echo "Run the companion publisher/retry-consumer first."
  exit 1
fi

log "All examples passed."
