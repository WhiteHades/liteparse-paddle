#!/usr/bin/env bash
# Verifies install.sh and the README's systemd unit agree on the repo path.
# install.sh clones to a specific path; the systemd unit runs docker compose
# from that path. If they disagree, the unit fails silently on boot.
set -euo pipefail

fail() { echo "FAIL: $1" >&2; exit 1; }

[[ -f install.sh ]] || fail "install.sh not found"

# 1. install.sh REPO_DIR
raw=$(grep -oE 'REPO_DIR="\$\{HOME\}/[^"]+"' install.sh | head -1 | sed -E 's|REPO_DIR="||; s|"$||' || true)
[[ -n "${raw}" ]] || fail "Could not extract REPO_DIR from install.sh"
repo_dir=$(echo "${raw}" | sed "s|\${HOME}|${HOME}|")
echo "install.sh clones to: ${repo_dir}"

# 2. The path must be either ~/Codes/liteparse-paddle (canonical) or ~/liteparse-paddle (legacy)
case "${repo_dir}" in
  "${HOME}/Codes/liteparse-paddle") install_path="canonical" ;;
  "${HOME}/liteparse-paddle")      install_path="legacy"   ;;
  *) fail "install.sh REPO_DIR is unexpected: ${repo_dir}" ;;
esac

# 3. README.md's systemd unit should WorkingDirectory the same path
readme_workingdir=$(awk '/WorkingDirectory=/ { print; exit }' README.md || true)
[[ -n "${readme_workingdir}" ]] || fail "No WorkingDirectory in README.md systemd unit"
echo "README systemd unit:  ${readme_workingdir}"

case "${readme_workingdir}" in
  *"Codes/liteparse-paddle"*) readme_path="canonical" ;;
  *"liteparse-paddle"*)       readme_path="legacy"   ;;
  *) fail "README WorkingDirectory is unexpected: ${readme_workingdir}" ;;
esac

# 4. Both must use the same path
if [[ "${install_path}" != "${readme_path}" ]]; then
  fail "install.sh (${repo_dir}) and README (${readme_workingdir}) disagree on canonical vs legacy path"
fi

echo "OK: install.sh and README systemd unit both use the ${install_path} path (${repo_dir})"
