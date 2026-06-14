#!/usr/bin/env bash
# Verifies the project version is bumped consistently across all release surfaces:
#   - install.sh banner
#   - package.json
#   - root PKGBUILD + AUR PKGBUILD + .SRCINFO
#   - README badges
set -euo pipefail

fail() { echo "FAIL: $1" >&2; exit 1; }

EXPECTED="${LPP_EXPECTED_VERSION:-0.3.0}"
echo "Expected version: ${EXPECTED}"

# 1. install.sh banner
[[ -f install.sh ]] || fail "install.sh not found"
grep -q "installer (v${EXPECTED})" install.sh \
  || fail "install.sh banner does not mention v${EXPECTED} (got: $(grep -m1 'installer' install.sh))"

# 2. package.json
[[ -f package.json ]] || fail "package.json not found"
grep -q "\"version\": \"${EXPECTED}\"" package.json \
  || fail "package.json version is not ${EXPECTED}"

# 3. PKGBUILD files
for f in PKGBUILD liteparse-paddle-bin/PKGBUILD; do
  [[ -f "${f}" ]] || fail "${f} not found"
  grep -q "pkgver=${EXPECTED}" "${f}" \
    || fail "${f} pkgver is not ${EXPECTED}"
done

# 4. .SRCINFO matches PKGBUILD (regenerate and check pkgver)
if command -v makepkg >/dev/null 2>&1; then
  [[ -f liteparse-paddle-bin/.SRCINFO ]] || fail "liteparse-paddle-bin/.SRCINFO not found"
  grep -q "pkgver = ${EXPECTED}" liteparse-paddle-bin/.SRCINFO \
    || fail ".SRCINFO pkgver is not ${EXPECTED}"
fi

# 5. README badge for PaddleOCR reflects V6 (v5 was the previous release)
grep -q "pp--ocrv6" README.md || fail "README PaddleOCR badge is not v6"

# 6. PaddleOCR package pin reflects the V6 release (3.7.0+ for V6)
docker_pin=$(grep -oE 'paddleocr[=<>]+[0-9.]+' python/Dockerfile | head -1 || true)
[[ -n "${docker_pin}" ]] || fail "No paddleocr pin in python/Dockerfile"
# Extract the major.minor and check >= 3.7
ocr_ver=$(echo "${docker_pin}" | grep -oE '[0-9]+\.[0-9]+')
ocr_major=$(echo "${ocr_ver}" | cut -d. -f1)
ocr_minor=$(echo "${ocr_ver}" | cut -d. -f2)
if [[ "${ocr_major}" -lt 4 ]] && [[ "${ocr_minor}" -lt 7 ]]; then
  fail "paddleocr pin (${docker_pin}) is older than the V6 baseline (3.7.0)"
fi

echo "OK: all version strings and badges reflect v${EXPECTED} + PaddleOCR V6"
