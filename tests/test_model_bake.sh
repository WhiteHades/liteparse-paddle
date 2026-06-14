#!/usr/bin/env bash
# Verifies the python/Dockerfile pre-bakes PaddleOCR V6 models into the image,
# so the first /ocr call after a fresh `docker compose build` has zero cold-start
# penalty and offline installs work.
set -euo pipefail

fail() { echo "FAIL: $1" >&2; exit 1; }

[[ -f python/Dockerfile ]] || fail "python/Dockerfile not found"

# 1. The Dockerfile accepts PADDLE_INDEX as a build arg
grep -qE '^ARG[[:space:]]+PADDLE_INDEX' python/Dockerfile \
  || fail "python/Dockerfile is missing 'ARG PADDLE_INDEX' build arg"

# 2. The pip install uses ${PADDLE_INDEX} (or $PADDLE_INDEX) so the build can
#    switch between CPU and CUDA indexes
grep -qE '\$\{?PADDLE_INDEX\}?' python/Dockerfile \
  || fail "python/Dockerfile pip install does not reference PADDLE_INDEX"

# 3. paddlepaddle and paddleocr are pinned (V6 baseline: 3.7.x for paddleocr,
#    3.x for paddlepaddle)
grep -qE 'paddlepaddle[=<>]+[0-9.]+' python/Dockerfile \
  || fail "paddlepaddle is not pinned in python/Dockerfile"
grep -qE 'paddleocr[=<>]+[0-9.]+' python/Dockerfile \
  || fail "paddleocr is not pinned in python/Dockerfile"

# 4. There is a RUN step that imports paddleocr / constructs PaddleOCR
#    to trigger model pre-bake. We accept any of: PaddleOCR(, from paddleocr import, paddleocr.
if ! grep -qE 'RUN.*PaddleOCR\(|RUN.*paddleocr' python/Dockerfile; then
  fail "python/Dockerfile is missing a pre-bake RUN step that constructs PaddleOCR (so model files are baked into the image)"
fi

# 5. The pre-bake references V6 model names. Note: the tier comes from
#    ${PADDLE_OCR_TIER} which expands at build time, so we just check for
#    the PP-OCRv6_ prefix.
if ! grep -qE 'PP-OCRv6_' python/Dockerfile; then
  fail "python/Dockerfile pre-bake does not reference V6 model names (PP-OCRv6_)"
fi

# 6. EXPOSE 8829 + CMD python server.py
grep -q 'EXPOSE 8829' python/Dockerfile || fail "python/Dockerfile does not EXPOSE 8829"
grep -qE 'CMD.*server\.py' python/Dockerfile || fail "python/Dockerfile CMD is not server.py"

# 7. The compose.yaml mounts a volume at /root/.paddleocr so the pre-baked
#    models survive across `docker compose build --no-cache` rebuilds
if ! grep -q '/root/.paddleocr' compose.yaml; then
  fail "compose.yaml is not mounting a volume at /root/.paddleocr (model cache won't persist)"
fi

echo "OK: python/Dockerfile pre-bakes V6 models and compose.yaml persists them"
