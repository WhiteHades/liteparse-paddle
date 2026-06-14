#!/usr/bin/env bash
# Test runner for liteparse-paddle.
# Each test_*.sh file is run independently; exit 0 = pass, non-zero = fail.
# Run from the repo root: ./tests/runner.sh

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_ROOT}"

pass=0
fail=0
failures=()

shopt -s nullglob
for test_file in tests/test_*.sh; do
  test_name="$(basename "${test_file}" .sh)"
  printf "  %-50s " "${test_name}"
  if bash "${test_file}" >/tmp/lp-test.out 2>&1; then
    echo "PASS"
    pass=$((pass + 1))
  else
    echo "FAIL"
    cat /tmp/lp-test.out | sed 's/^/    /'
    fail=$((fail + 1))
    failures+=("${test_name}")
  fi
done

echo ""
echo "Results: ${pass} passed, ${fail} failed"
if [[ ${fail} -gt 0 ]]; then
  echo "Failed: ${failures[*]}"
  exit 1
fi
exit 0
