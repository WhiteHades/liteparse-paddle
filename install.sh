#!/usr/bin/env bash
set -euo pipefail

echo "=== liteparse-paddle installer (v0.2.0) ==="
echo ""

# 1. Check Docker
if ! command -v docker &>/dev/null; then
  echo "Error: Docker is not installed."
  echo "Install: https://docs.docker.com/get-docker/"
  echo ""
  echo "After installing Docker, re-run this script."
  exit 1
fi
echo "Docker found"

# 2. Check for curl and python3
for cmd in curl python3; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "Warning: $cmd is not installed. Some features of lp may not work."
  fi
done

# 3. Detect or assign port
LP_PORT="${LP_PORT:-5000}"
if ss -tlnp 2>/dev/null | grep -q ":${LP_PORT} " || \
   lsof -i ":${LP_PORT}" 2>/dev/null | grep -q LISTEN; then
  ORIGINAL_PORT="${LP_PORT}"
  LP_PORT=5001
  while ss -tlnp 2>/dev/null | grep -q ":${LP_PORT} " || \
        lsof -i ":${LP_PORT}" 2>/dev/null | grep -q LISTEN; do
    LP_PORT=$((LP_PORT + 1))
  done
  echo "Port ${ORIGINAL_PORT} is in use. Using port ${LP_PORT}."
else
  echo "Port ${LP_PORT} is available"
fi

# 4. Clone or update the repo
REPO_DIR="${HOME}/liteparse-paddle"
if [[ -d "${REPO_DIR}" ]]; then
  echo "Repo already exists at ${REPO_DIR}. Pulling latest..."
  cd "${REPO_DIR}"
  git pull
else
  echo "Downloading liteparse-paddle..."
  git clone https://github.com/WhiteHades/liteparse-paddle "${REPO_DIR}"
  cd "${REPO_DIR}"
fi

# 5. Build and start Docker
echo "Building Docker image (this takes a few minutes the first time)..."
LP_PORT="${LP_PORT}" docker compose build --no-cache
echo "Starting server on port ${LP_PORT}..."
LP_PORT="${LP_PORT}" docker compose up -d

# 6. Install lp command
mkdir -p "${HOME}/.local/bin"
ln -sf "${REPO_DIR}/bin/lp" "${HOME}/.local/bin/lp"

# 7. Save LP_PORT if non-default
if [[ "${LP_PORT}" != "5000" ]]; then
  for rc in "${HOME}/.profile" "${HOME}/.zshrc" "${HOME}/.bashrc"; do
    if [[ -f "${rc}" ]] && ! grep -q "export LP_PORT=" "${rc}"; then
      echo "export LP_PORT=${LP_PORT}   # liteparse-paddle" >> "${rc}"
    fi
  done
  echo "Wrote LP_PORT=${LP_PORT} to your shell config"
fi

# 8. Check PATH
if ! echo "${PATH}" | tr ':' '\n' | grep -q "${HOME}/.local/bin"; then
  echo ""
  echo "Warning: ${HOME}/.local/bin is not on your PATH."
  echo "Add this to your shell config:"
  echo "  export PATH=\"${HOME}/.local/bin:\${PATH}\""
fi

# 9. Wait for server and verify
echo ""
echo "Waiting for server to start..."
for i in $(seq 1 30); do
  if curl -sS "http://localhost:${LP_PORT}/health" > /dev/null 2>&1; then
    echo ""
    echo "Done. liteparse-paddle is running."
    echo ""
    echo "  Server: http://localhost:${LP_PORT}"
    echo "  CLI:    lp (try: lp --help)"
    echo ""
    echo "Quick test: lp document.pdf"
    exit 0
  fi
  sleep 2
done

echo ""
echo "Warning: Server did not respond within 60 seconds."
echo "Check logs: cd ${REPO_DIR} && docker compose logs liteparse-server"
echo "The server may still be building or downloading PaddleOCR models."
