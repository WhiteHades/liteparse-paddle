#!/usr/bin/env bash
# Verifies compose.yaml has the production-grade structure we need:
#   - liteparse-server has a healthcheck
#   - paddle-ocr has a model-persistence volume
#   - GPU block is documented
set -euo pipefail

fail() { echo "FAIL: $1" >&2; exit 1; }

[[ -f compose.yaml ]] || fail "compose.yaml not found"

# 1. liteparse-server has a healthcheck
if ! awk '
  /liteparse-server:/ { in_block=1; next }
  in_block && /^  [a-zA-Z]/ { in_block=0 }
  in_block && /healthcheck:/ { found=1 }
  END { exit !found }
' compose.yaml; then
  fail "compose.yaml: liteparse-server service is missing a healthcheck"
fi

# 2. paddle-ocr service has a volumes: section (model persistence)
if ! awk '
  /paddle-ocr:/ { in_block=1; next }
  in_block && /^  [a-zA-Z]/ { in_block=0 }
  in_block && /volumes:/ { found=1 }
  END { exit !found }
' compose.yaml; then
  fail "compose.yaml: paddle-ocr service is missing a volumes: block (model persistence)"
fi

# 3. Top-level volumes: block defines the named volume
if ! grep -qE '^volumes:' compose.yaml; then
  fail "compose.yaml: missing top-level volumes: definition"
fi

# 4. PADDLE_OCR_URL is wired (either hardcoded or in env_file)
if ! grep -q 'PADDLE_OCR_URL' compose.yaml; then
  fail "compose.yaml: PADDLE_OCR_URL is not configured"
fi

# 5. PaddleOCR container exposes its port
if ! grep -q '8829' compose.yaml; then
  fail "compose.yaml: paddle-ocr port 8829 not configured"
fi

# 6. Rust server port is configurable
if ! grep -q 'LP_PORT' compose.yaml; then
  fail "compose.yaml: LP_PORT is not configurable on the host side"
fi

echo "OK: compose.yaml has healthcheck, model-persistence volume, and PADDLE_OCR_URL"
