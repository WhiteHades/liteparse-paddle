#!/usr/bin/env bash
# Verifies the lp -> lp-paddle rename is consistent across the repo.
set -euo pipefail

fail() { echo "FAIL: $1" >&2; exit 1; }

# 1. The script file is named lp-paddle
[[ -f bin/lp-paddle ]] || fail "bin/lp-paddle not found"
[[ ! -f bin/lp ]]       || fail "bin/lp still exists (rename incomplete)"

# 2. The script's shebang is bash
head -n1 bin/lp-paddle | grep -q '#!/usr/bin/env bash' || fail "bin/lp-paddle shebang is not bash"

# 3. The help text says lp-paddle, not lp
grep -q 'Usage: lp-paddle' bin/lp-paddle              || fail "Usage line not updated"
grep -q 'lp-paddle doc.pdf' bin/lp-paddle             || fail "Example not updated"
if grep -qE '^[[:space:]]*lp [a-z]' bin/lp-paddle; then
  fail "Found stale 'lp <cmd>' example in bin/lp-paddle"
fi

# 4. npm bin field is lp-paddle
grep -q '"lp-paddle": "bin/lp-paddle"' package.json  || fail "package.json bin field not updated"
grep -q '"bin/lp-paddle"' package.json                || fail "package.json files field not updated"

# 5. PKGBUILD installs to /usr/bin/lp-paddle
grep -q '/usr/bin/lp-paddle' PKGBUILD                          || fail "PKGBUILD install path not updated"
grep -q 'bin/lp-paddle' PKGBUILD                              || fail "PKGBUILD source path not updated"
grep -q '/usr/bin/lp-paddle' liteparse-paddle-bin/PKGBUILD    || fail "AUR PKGBUILD install path not updated"
grep -q 'bin/lp-paddle' liteparse-paddle-bin/PKGBUILD        || fail "AUR PKGBUILD source path not updated"

# 6. install.sh symlinks to lp-paddle
grep -q 'bin/lp-paddle' install.sh                    || fail "install.sh source path not updated"
grep -q '.local/bin/lp-paddle' install.sh             || fail "install.sh symlink target not updated"
if grep -qE '"lp[[:space:]]|=\\slp[[:space:]]|=\\slp$|="lp"|lp file' install.sh; then
  fail "install.sh still references the old 'lp' name"
fi

# 7. README references are updated
if grep -qE '\blp [a-z]+-|\blp -[a-z]|\blp --[a-z]' README.md; then
  fail "README.md still has bare 'lp' command examples"
fi
grep -q 'pp--ocrv6' README.md || fail "README.md PaddleOCR badge not updated to v6"

# 8. .SRCINFO is in sync with PKGBUILD (regenerate and compare)
if command -v makepkg >/dev/null 2>&1; then
  generated=$(cd liteparse-paddle-bin && makepkg --printsrcinfo 2>/dev/null) || fail "makepkg --printsrcinfo failed"
  if ! diff -q <(echo "${generated}") liteparse-paddle-bin/.SRCINFO >/dev/null 2>&1; then
    fail ".SRCINFO is out of sync with PKGBUILD. Run: cd liteparse-paddle-bin && makepkg --printsrcinfo > .SRCINFO"
  fi
fi

echo "OK: rename to lp-paddle is consistent"
