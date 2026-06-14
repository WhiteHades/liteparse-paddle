#!/usr/bin/env bash
# Cold-start test: bring the stack down, bring it back up, time until
# the first /ocr call returns a real result. The pre-baked V6 medium
# model should make the first /ocr call near-instant after the
# paddle-ocr container is healthy.
set -uo pipefail

ITERATIONS="${ITERATIONS:-3}"
PADDLE_PORT="${PADDLE_PADDLE_PORT:-8829}"
TEST_IMAGE="${TEST_IMAGE:-/tmp/v6-test.png}"

# Make sure the test image exists (benchmark.sh can create it)
if [[ ! -f "${TEST_IMAGE}" ]]; then
  cd "$(dirname "${BASH_SOURCE[0]}")/.."
  rtk bash tests/benchmark.sh >/dev/null || true
  cd - >/dev/null
fi

times=()
for i in $(seq 1 "${ITERATIONS}"); do
  echo "--- iteration ${i}/${ITERATIONS} ---"

  # Bring the stack down (force-recreate removes the cached init)
  rtk docker compose down paddle-ocr >/dev/null 2>&1 || true

  start=$(date +%s%N)
  rtk docker compose up -d paddle-ocr >/dev/null 2>&1

  # Wait for /health to come up
  while ! curl -fsS "http://localhost:${PADDLE_PORT}/health" >/dev/null 2>&1; do
    sleep 0.5
    elapsed_ms=$(( ($(date +%s%N) - start) / 1000000 ))
    if [[ ${elapsed_ms} -gt 300000 ]]; then
      echo "FAIL: paddle-ocr did not become healthy within 300s" >&2
      exit 1
    fi
  done
  health_ms=$(( ($(date +%s%N) - start) / 1000000 ))
  echo "  /health up:       ${health_ms}ms"

  # Time the first /ocr call (cold first-call)
  ocr_start=$(date +%s%N)
  if ! curl -fsS -X POST "http://localhost:${PADDLE_PORT}/ocr" \
       -F "file=@${TEST_IMAGE}" -F "language=en" >/dev/null 2>&1; then
    echo "FAIL: first /ocr call failed" >&2
    exit 1
  fi
  ocr_ms=$(( ($(date +%s%N) - ocr_start) / 1000000 ))
  total_ms=$(( ($(date +%s%N) - start) / 1000000 ))
  echo "  first /ocr:       ${ocr_ms}ms"
  echo "  total cold start: ${total_ms}ms"
  times+=("${total_ms}")
done

avg=$(printf "%s\n" "${times[@]}" | awk '{s+=$1} END {printf "%.0f", s/NR}')
max=$(printf "%s\n" "${times[@]}" | sort -n | tail -n 1)

echo
echo "Cold-start summary (${ITERATIONS} iterations)"
echo "  avg: ${avg}ms"
echo "  max: ${max}ms"

# Acceptance gate
if [[ ${max} -gt 60000 ]]; then
  echo "FAIL: cold start max ${max}ms exceeds 60000ms ceiling" >&2
  exit 1
fi

echo "OK"
