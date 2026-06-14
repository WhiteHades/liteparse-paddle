# Changelog

All notable changes to `liteparse-paddle` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.3.0] - 2026-06-14

### Changed
- **OCR engine upgraded to PaddleOCR 3.7.0 (PP-OCRv6).** The new PaddleOCR
  V6 model is a unified 50-language model with three tiers (tiny / small /
  medium). Default tier is `medium` (~132 MB, +5.1% recognition accuracy
  and +4.6% detection accuracy over PP-OCRv5 server). 5.2× CPU inference
  speedup on Xeon-class hardware.
- The V6 model is selected via the new `PADDLE_OCR_TIER` env var
  (`tiny` / `small` / `medium`). Default: `medium`.
- `paddlepaddle` pinned to `3.2.2`. The latest 3.3.x line has a oneDNN
  bug in `onednn_instruction.cc:116` that fails at inference time on
  AMD Zen2 CPUs (incl. Ryzen 7 4800H). 3.2.2 is the last release without
  the regression.
- The PaddleOCR Python constructor now uses V6-native kwargs
  (`text_detection_model_name`, `text_recognition_model_name`).
- The OCR response now includes a `polygon` field with 8 values
  (4-point rotated bounding box) for non-axis-aligned text.
- `/health` endpoint now reports `paddleocr_version` and `tier`.
- The CLI is renamed from `lp` to `lp-paddle`. This avoids a conflict
  with the CUPS `/usr/bin/lp` line-printer command when the AUR package
  is installed system-wide. `~/dotfiles/bin/lp-paddle` is the source of
  truth; the zsh `lp` function alias was removed because the bash
  script is the single source of truth.
- The AUR package (`liteparse-paddle-bin`) installs the wrapper to
  `/usr/bin/lp-paddle` (no conflict with CUPS).
- `install.sh` clones the repo to `~/Codes/liteparse-paddle` (was
  `~/liteparse-paddle`) to match the systemd unit's `WorkingDirectory`.
- `compose.yaml` adds:
  - A `paddle-ocr-models` named volume mounted at `/root/.paddlex/`
    so V6 model files survive `docker compose build --no-cache`
    rebuilds.
  - A `healthcheck` on the `liteparse-server` service.
  - A `paddle-ocr-gpu` service behind the `gpu` profile that uses
    the CUDA PaddlePaddle build and the NVIDIA runtime.
- The `paddle-ocr` container's `start_period` is bumped from 120s to
  300s to accommodate V6's larger first-call init.

### Removed
- The zsh `lp()` function in `~/.config/zsh/aliases.sh`. The bash
  script is the single source of truth for the `lp-paddle` command.

### Migration notes
- The model cache directory changed from `~/.paddleocr/` (V5) to
  `~/.paddlex/official_models/` (V6). If you have a v0.2.x install
  with cached V5 models, no manual cleanup is needed — V6 downloads
  its own models and they live in a different directory.
- The V5 to V6 upgrade is a clean cutover. There is no
  V5-compatible fallback. Pin to `liteparse-paddle-bin@0.2.0` in your
  AUR setup if you need to roll back.
- The CLI command is now `lp-paddle`. Update any shell aliases or
  scripts that called `lp`.

## [0.2.0] - 2026-05-29

- Initial public release. Rust axum server + PaddleOCR PP-OCRv5 sidecar
  on Docker Compose. CLI wrapper shipped as `bin/lp` and packaged via
  pnpm / Bun / mise / AUR / `install.sh`.
