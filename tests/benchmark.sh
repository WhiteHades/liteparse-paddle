#!/usr/bin/env bash
# Small V6 latency/accuracy benchmark. No V5 baseline — we just upgraded.
# Times warm /ocr calls against the paddle-ocr container and reports p50/p95/max.
# Exits 0 on success, non-zero on failure.

set -uo pipefail

PADDLE_PORT="${PADDLE_PADDLE_PORT:-8829}"
ITERATIONS="${ITERATIONS:-10}"
TEST_IMAGE="${TEST_IMAGE:-/tmp/v6-test.png}"

# Ground-truth text we expect V6 to recover (per the test image generated in
# /tmp/v6-test.png). Loose check: at least these substrings must appear.
EXPECTED_HITS=("Hello World" "PADDLE_OCR_TIER" "GPU" "CPU")

# 1. Sanity-check the service is up
if ! curl -fsS "http://localhost:${PADDLE_PORT}/health" >/dev/null 2>&1; then
  echo "FAIL: paddle-ocr is not responding on :${PADDLE_PORT}" >&2
  exit 1
fi

# 2. Generate the test image if missing
if [[ ! -f "${TEST_IMAGE}" ]]; then
  python3 -c "
from PIL import Image, ImageDraw
img = Image.new('RGB', (600, 200), color=(255, 255, 255))
d = ImageDraw.Draw(img)
d.text((20, 30),  'Hello World from PaddleOCR V6', fill=(0, 0, 0))
d.text((20, 70),  'PADDLE_OCR_TIER=medium',         fill=(0, 0, 0))
d.text((20, 110), 'GPU off, CPU inference',         fill=(0, 0, 0))
img.save('${TEST_IMAGE}')
" || { echo "FAIL: could not generate ${TEST_IMAGE}" >&2; exit 1; }
fi

# 3. Warm-up call (not timed)
curl -fsS -X POST "http://localhost:${PADDLE_PORT}/ocr" \
  -F "file=@${TEST_IMAGE}" -F "language=en" >/dev/null 2>&1 || true

# 4. Timed loop
times=()
for i in $(seq 1 "${ITERATIONS}"); do
  start=$(date +%s%N)
  body=$(curl -fsS -X POST "http://localhost:${PADDLE_PORT}/ocr" \
    -F "file=@${TEST_IMAGE}" -F "language=en" 2>/dev/null) || {
    echo "FAIL: /ocr call ${i} failed" >&2; exit 1
  }
  end=$(date +%s%N)
  ms=$(( (end - start) / 1000000 ))
  times+=("${ms}")
done

# 5. Statistics
sorted=$(printf "%s\n" "${times[@]}" | sort -n)
p50=$(echo "${sorted}" | awk -v n="${ITERATIONS}" 'NR==int((n+1)/2)')
p95_idx=$(( (ITERATIONS * 95 + 99) / 100 ))
[[ ${p95_idx} -gt ${ITERATIONS} ]] && p95_idx=${ITERATIONS}
p95=$(echo "${sorted}" | sed -n "${p95_idx}p")
max=$(echo "${sorted}" | tail -n 1)
avg=$(printf "%s\n" "${times[@]}" | awk '{s+=$1} END {printf "%.0f", s/NR}')

# 6. Accuracy check
body=$(curl -fsS -X POST "http://localhost:${PADDLE_PORT}/ocr" \
  -F "file=@${TEST_IMAGE}" -F "language=en")
hits=0
for needle in "${EXPECTED_HITS[@]}"; do
  if echo "${body}" | grep -q "\"text\":\"[^\"]*${needle}"; then
    hits=$((hits + 1))
  fi
done

echo "liteparse-paddle V6 benchmark"
echo "=============================="
printf "  image:       %s\n" "${TEST_IMAGE}"
printf "  iterations:  %d\n" "${ITERATIONS}"
printf "  warm latency: avg=%dms  p50=%dms  p95=%dms  max=%dms\n" "${avg}" "${p50}" "${p95}" "${max}"
printf "  accuracy:    %d/%d expected substrings recovered\n" "${hits}" "${#EXPECTED_HITS[@]}"

# 7. Pass/fail gates
if [[ ${p95} -gt 5000 ]]; then
  echo "FAIL: p95 latency ${p95}ms exceeds 5000ms ceiling" >&2
  exit 1
fi

if [[ ${hits} -lt $(( ${#EXPECTED_HITS[@]} - 1 )) ]]; then
  echo "FAIL: accuracy ${hits}/${#EXPECTED_HITS[@]} below acceptable floor" >&2
  exit 1
fi

echo "OK"
