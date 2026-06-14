# Upgrading liteparse-paddle

## From v0.2.x to v0.3.0 (PaddleOCR V5 → V6)

The v0.3.0 release is a model upgrade. The CLI is renamed from `lp`
to `lp-paddle` to avoid a conflict with the CUPS `/usr/bin/lp` line-
printer command.

### What changed

- OCR engine: PaddleOCR PP-OCRv5 (multilingual, 9 per-script models)
  → PaddleOCR PP-OCRv6 (multilingual, 1 unified 50-language model per
  tier).
- Default tier: medium (~132 MB, +5.1% recognition accuracy over V5
  server, 5.2× CPU inference speedup on Xeon).
- `PADDLE_OCR_TIER` env var selects `tiny` / `small` / `medium`.
- The CLI command is now `lp-paddle`. Update any shell aliases or
  scripts.
- The `compose.yaml` adds a `paddle-ocr-models` named volume so V6
  model files survive `docker compose build --no-cache` rebuilds.

### Upgrade steps (AUR users)

```bash
yay -Syu liteparse-paddle-bin
cd ~/Codes/liteparse-paddle
git pull
docker compose down --volumes          # clear old V5 model cache
LP_PORT=5000 docker compose up -d --build
# Verify
lp-paddle doctor
```

### Upgrade steps (pnpm / Bun / npm / mise users)

```bash
pnpm add -g liteparse-paddle@latest     # or: bun install -g, mise use -g npm:liteparse-paddle@latest
cd ~/Codes/liteparse-paddle
git pull
docker compose down --volumes
LP_PORT=5000 docker compose up -d --build
lp-paddle doctor
```

### Rollback

```bash
yay -S liteparse-paddle-bin=0.2.0      # or pnpm add -g liteparse-paddle@0.2.0
git checkout v0.2.0
docker compose down --volumes
docker compose up -d --build
```

There is no V5/V6 feature flag in v0.3.0. Pin to the old version if
you need the V5 model.

### Known issue: paddlepaddle 3.2.2, not 3.3.x

v0.3.0 pins `paddlepaddle==3.2.2`, not the latest 3.3.x. PaddlePaddle
3.3.0 and 3.3.1 both have a oneDNN bug in `onednn_instruction.cc:116`
that fails at inference time on AMD Zen2 CPUs (incl. Ryzen 7 4800H).
3.2.2 is the last release without this regression. Track upstream for
a fix; revisit when a 3.3.x or 3.4.x release resolves the issue.

## GPU support

v0.3.0 adds a `gpu` compose profile. To enable it:

1. Install the NVIDIA Container Toolkit on the host:
   ```bash
   sudo pacman -S nvidia-container-toolkit
   sudo nvidia-ctk runtime configure --runtime=docker
   sudo systemctl restart docker
   ```

2. Bring up the GPU service:
   ```bash
   cd ~/Codes/liteparse-paddle
   LP_GPU=1 docker compose --profile gpu up -d --build
   ```

3. Verify:
   ```bash
   docker logs paddle-ocr-gpu 2>&1 | grep -i gpu
   ```
