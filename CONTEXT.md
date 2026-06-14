# Context: liteparse-paddle

## What this is

A local document parser: PDFs, Office files, images. Two Docker containers
on the user's machine, no cloud, no API keys. Pulls text out of any
document. Routes pages that need OCR to a PaddleOCR sidecar.

## Architecture

```
[ lp-paddle CLI ]
      |
      v  HTTP multipart POST
[ liteparse-server :5000  (Rust axum) ]
      |
      |  HTTP POST to PADDLE_OCR_URL when a page needs OCR
      v
[ paddle-ocr :8829  (Python FastAPI + PaddleOCR) ]
      |
      v  HTTP /ocr multipart
[ PaddleOCR 3.7.0 / PP-OCRv6 medium (default) ]
```

The `liteparse` Rust crate (v2, from crates.io) handles file type
detection, PDF rendering, LibreOffice conversion for Office formats,
and ImageMagick for image inputs. It also implements the OCR engine
trait with an `HttpOcrEngine` that POSTs rasterized page images to
the Python sidecar and reads the JSON response.

The Python sidecar wraps `PaddleOCR(lang=..., text_detection_model_name=...,
text_recognition_model_name=...)` and returns a flat JSON shape
`{results: [{text, bbox, confidence, polygon}]}` per page. The polygon
is the 4-point rotation box from V6's `rec_polys` and enables
rotation recovery for non-axis-aligned text.

## API contract

The `/ocr` endpoint accepts `multipart/form-data` with two fields:
- `file`: image bytes (any format Pillow can read; converted to RGB
  server-side).
- `language`: ISO code or one of the aliases in
  `python/server.py:normalize_language()` (e.g. `zh` → `ch`,
  `ja` → `japan`).

Response body is JSON:
```json
{
  "results": [
    {
      "text": "<string>",
      "bbox": [x_min, y_min, x_max, y_max],
      "confidence": <float 0..1>,
      "polygon": [x1, y1, x2, y2, x3, y3, x4, y4]
    }
  ]
}
```

The `polygon` field is null when PaddleOCR doesn't return rotation
boxes (e.g. for purely axis-aligned text).

## Deployment topology

Two containers, defined in `compose.yaml`:

- `liteparse-server` (Rust axum). Port `${LP_PORT:-5000}` on the host.
  Reads `PADDLE_OCR_URL` from the environment. Healthchecks `GET /health`.
- `paddle-ocr` (Python FastAPI). Port 8829. Models pre-baked into the
  image; persisted on the host via the `paddle-ocr-models` named
  volume. Healthchecks `GET /health`.
- `paddle-ocr-gpu` (profile `gpu`). Identical to `paddle-ocr` but
  uses the CUDA PaddlePaddle build and the NVIDIA runtime. Brought
  up with `LP_GPU=1 docker compose --profile gpu up -d --build`.

The system can be auto-started on boot via the dotfiles
`systemd --user` unit at `~/dotfiles/systemd/user/liteparse-paddle.service`.

## Release surfaces

The same script (`bin/lp-paddle`) ships to:
- pnpm / Bun / mise / npm global install — see `package.json`.
- AUR package `liteparse-paddle-bin` — installs `/usr/bin/lp-paddle`.
- A one-command curl install (`install.sh`) that builds the Docker
  stack and symlinks `~/.local/bin/lp-paddle`.

All three are versioned together. Cutting a v0.3.x release means:
1. Bump the version in `install.sh`, `package.json`, both `PKGBUILD`
   files, regenerate `.SRCINFO`, and update the README badge.
2. Tag `v0.3.x` and push to GitHub.
3. `pnpm publish` to npm.
4. `makepkg --printsrcinfo > .SRCINFO && git push` from
   `liteparse-paddle-bin/` to the AUR.
5. Verify in a clean container (AUR or pnpm global install).

## Knobs

- `LP_PORT` — host port for the Rust server. Default 5000.
- `PADDLE_OCR_TIER` — `tiny` / `small` / `medium`. Default `medium`.
- `PADDLE_INDEX` (compose build arg) — `packages/stable/cpu/` or
  `packages/stable/cuda12/`. Default CPU.
- `LP_GPU=1` — selects the `paddle-ocr-gpu` profile.

## Known-bad decisions to revisit

- **paddlepaddle 3.2.2 is pinned, not 3.3.x.** PaddlePaddle 3.3.0 and
  3.3.1 have a oneDNN bug in `onednn_instruction.cc:116` that fails
  at inference time on AMD Zen2 CPUs (incl. Ryzen 7 4800H). The fix
  has to come from upstream. Track for a 3.3.x or 3.4.x release that
  resolves the issue.
- The PaddleOCR container is currently CPU-only by default. GPU is a
  one-toggle change (`LP_GPU=1`) but requires the NVIDIA Container
  Toolkit on the host (not currently installed).
- The `compose.yaml` healthcheck on `liteparse-server` was added in
  v0.3.0. The pre-v0.3.0 release did not have a healthcheck on
  this service; the systemd unit's `Type=oneshot + RemainAfterExit`
  pattern meant a crashed container did not trigger a unit restart.
- The `lp-paddle` script and the zsh function were duplicated for
  months; the zsh function was removed in v0.3.0. Bash script is
  the single source of truth.
