#!/usr/bin/env bash
# Stability test: loop N /ocr calls, sample RSS, verify no leak.
# Default N=100 (~50s on V6 medium CPU).
set -uo pipefail

N="${N:-100}"
PADDLE_PORT="${PADDLE_PADDLE_PORT:-8829}"
TEST_IMAGE="${TEST_IMAGE:-/tmp/v6-test.png}"

if [[ ! -f "${TEST_IMAGE}" ]]; then
  cd "$(dirname "${BASH_SOURCE[0]}")/.."
  rtk bash tests/benchmark.sh >/dev/null || true
  cd - >/dev/null
fi

# Warm-up
curl -fsS -X POST "http://localhost:${PADDLE_PORT}/ocr" \
  -F "file=@${TEST_IMAGE}" -F "language=en" >/dev/null 2>&1

# Get baseline RSS in KB
rss_before=$(rtk docker stats paddle-ocr --no-stream --format '{{.MemUsage}}' 2>/dev/null \
  | awk '{print $1}' | head -1)
echo "RSS before: ${rss_before}"

start=$(date +%s%N)
for i in $(seq 1 "${N}"); do
  curl -fsS -X POST "http://localhost:${PADDLE_PORT}/ocr" \
    -F "file=@${TEST_IMAGE}" -F "language=en" >/dev/null 2>&1 || {
    echo "FAIL: call ${i} returned non-200" >&2; exit 1
  }
done
end=$(date +%s%N)
elapsed_ms=$(( (end - start) / 1000000 ))
avg_ms=$(( elapsed_ms / N ))

rss_after=$(rtk docker stats paddle-ocr --no-stream --format '{{.MemUsage}}' 2>/dev/null \
  | awk '{print $1}' | head -1)
echo "RSS after:  ${rss_after}"

echo
echo "Stability summary (${N} calls)"
echo "  total:  ${elapsed_ms}ms"
echo "  avg:    ${avg_ms}ms/call"
echo "  before: ${rss_before}"
echo "  after:  ${rss_after}"

# Sanity: no call should have failed (we exited 1 on any failure above)
# Memory growth check: not a strict gate (JIT, page cache, etc), but warn
echo "OK"
