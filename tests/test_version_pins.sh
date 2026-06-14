#!/usr/bin/env bash
# Verifies the paddlepaddle version pin is consistent across Dockerfile and pyproject.toml.
# Without this, `docker compose build paddle-ocr` and `pip install paddleocr` could
# resolve to different PaddlePaddle versions, leading to subtle runtime errors.
set -euo pipefail

fail() { echo "FAIL: $1" >&2; exit 1; }

[[ -f python/Dockerfile ]]    || fail "python/Dockerfile not found"
[[ -f python/pyproject.toml ]] || fail "python/pyproject.toml not found"

# 1. Extract the paddlepaddle pin from python/Dockerfile
docker_pin=$(grep -oE 'paddlepaddle[=<>]+[0-9.]+' python/Dockerfile | head -1 || true)
[[ -n "${docker_pin}" ]] || fail "No paddlepaddle pin found in python/Dockerfile"
echo "Dockerfile pin: ${docker_pin}"

# 2. Extract the paddlepaddle constraint from python/pyproject.toml
pyproject_pin=$(grep -oE '"paddlepaddle[=<>~]+[^"]*"' python/pyproject.toml | head -1 | tr -d '"' || true)
[[ -n "${pyproject_pin}" ]] || fail "No paddlepaddle pin found in python/pyproject.toml"
echo "pyproject pin:  ${pyproject_pin}"

# 3. Extract just the version numbers
docker_ver=$(echo "${docker_pin}"  | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
pyproject_op=$(echo "${pyproject_pin}" | grep -oE '[=<>~]+')
pyproject_ver=$(echo "${pyproject_pin}" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')

# 4. The Dockerfile pin must satisfy the pyproject constraint
case "${pyproject_op}" in
  "==")
    [[ "${docker_ver}" == "${pyproject_ver}" ]] \
      || fail "Dockerfile pins ${docker_ver} but pyproject requires ==${pyproject_ver}"
    ;;
  "=")
    [[ "${docker_ver}" == "${pyproject_ver}" ]] \
      || fail "Dockerfile pins ${docker_ver} but pyproject requires =${pyproject_ver}"
    ;;
  ">=")
    # Compare using sort -V
    if ! printf "%s\n%s\n" "${pyproject_ver}" "${docker_ver}" | sort -V -C; then
      fail "Dockerfile pins ${docker_ver} but pyproject requires >=${pyproject_ver}"
    fi
    ;;
  ">")
    if ! printf "%s\n%s\n" "${pyproject_ver}" "${docker_ver}" | sort -V -C; then
      fail "Dockerfile pins ${docker_ver} but pyproject requires >${pyproject_ver}"
    fi
    [[ "${docker_ver}" != "${pyproject_ver}" ]] \
      || fail "Dockerfile pins ${docker_ver} but pyproject requires >${pyproject_ver} (not equal)"
    ;;
  *)
    echo "WARN: unknown operator '${pyproject_op}', skipping constraint check"
    ;;
esac

# 5. Both files should pin paddleocr to a specific version too
docker_ocr=$(grep -oE 'paddleocr[=<>]+[0-9.]+' python/Dockerfile | head -1 || true)
pyproject_ocr=$(grep -oE '"paddleocr[=<>~]+[^"]*"' python/pyproject.toml | head -1 | tr -d '"' || true)
[[ -n "${docker_ocr}" && -n "${pyproject_ocr}" ]] \
  || fail "paddleocr not pinned in both files (Dockerfile: '${docker_ocr}', pyproject: '${pyproject_ocr}')"

echo "OK: Dockerfile and pyproject.toml agree on paddlepaddle ${docker_ver} and paddleocr"
