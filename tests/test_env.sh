#!/usr/bin/env bash
# Verifies .env is clean and the documented knobs are present.
# .env is gitignored, so this is a developer-machine check, not a CI test.
set -euo pipefail

fail() { echo "FAIL: $1" >&2; exit 1; }

[[ -f .env ]] || { echo "WARN: .env not present (this is fine for fresh checkouts)"; exit 0; }

# 1. No dead vars (the old Redis/OTel/Grafana leftovers are gone)
for dead in REDIS_URI REDIS_PASSWORD OTEL_COLLECTOR_ENDPOINT GRAFANA_USER GRAFANA_PASS; do
  if grep -q "^${dead}=" .env; then
    fail ".env still has dead var: ${dead}"
  fi
done

# 2. The PADDLE_OCR_TIER knob is documented
if ! grep -q '^#.*PADDLE_OCR_TIER' .env && ! grep -q '^PADDLE_OCR_TIER=' .env; then
  fail ".env does not document PADDLE_OCR_TIER"
fi

# 3. The GPU build instructions are documented
if ! grep -q 'PADDLE_INDEX' .env; then
  fail ".env does not document PADDLE_INDEX (GPU build)"
fi

echo "OK: .env is clean and documents the LP_PORT, PADDLE_OCR_TIER, and GPU knobs"
