<p align="center">
  <img src="media/logo.svg" width="400" alt="liteparse-paddle"/>
</p>

<p align="center">
  <em>Rust-first LiteParse server with PaddleOCR as the default OCR sidecar.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/rust-liteparse%20v2-000000?style=flat-square&logo=rust&logoColor=white"/>
  <img src="https://img.shields.io/badge/http-axum-7c3aed?style=flat-square"/>
  <img src="https://img.shields.io/badge/ocr-paddleocr-orange?style=flat-square&logo=python&logoColor=white"/>
  <img src="https://img.shields.io/badge/docker-compose-2496ED?style=flat-square&logo=docker&logoColor=white"/>
  <img src="https://img.shields.io/badge/license-Apache--2.0-3b82f6?style=flat-square"/>
</p>

<p align="center">
  <a href="#quick-start"><b>Quick Start</b></a> •
  <a href="#api"><b>API</b></a> •
  <a href="#host-cli"><b>Host CLI</b></a> •
  <a href="#after-reboot"><b>After Reboot</b></a> •
  <a href="#updating"><b>Updating</b></a>
</p>

<p align="center">
  <b>PDF</b> • <b>DOCX</b> • <b>XLSX</b> • <b>PPTX</b> • <b>Images</b>
</p>

---

## Quick Start

```bash
git clone https://github.com/WhiteHades/liteparse-paddle ~/Codes/liteparse-paddle
cd ~/Codes/liteparse-paddle
docker compose build --no-cache
docker compose up -d
```

Parse a document:

```bash
curl -X POST "http://localhost:5000/parse?text=true" \
  -F "file=@document.pdf"
```

The stack is only two services now:

- `liteparse-server` - Rust HTTP wrapper around the LiteParse crate
- `paddle-ocr` - Python PaddleOCR server at `:8829`

Notes:

- First build is slow because the server image installs LibreOffice and ImageMagick.
- First OCR request is slow because PaddleOCR downloads its models.
- No `.env` file is required for the default local setup.

## Architecture

```text
lp / curl / direct client
  -> POST :5000/parse or :5000/screenshots
  -> Rust axum server
  -> LiteParse Rust crate
  -> HTTP OCR calls to paddle-ocr:8829/ocr when OCR is needed
```

Why this repo exists:

- Upstream LiteParse v2 is Rust-first and fast.
- Upstream `liteparse-server` is no longer this repo's runtime base.
- This repo keeps the local HTTP service and the PaddleOCR sidecar you already use, but removes Bun/TypeScript from the parsing path.

## API

### `POST /parse`

JSON output:

```bash
curl -X POST http://localhost:5000/parse \
  -F "file=@document.pdf"
```

Plain text output:

```bash
curl -X POST "http://localhost:5000/parse?text=true" \
  -F "file=@document.pdf"
```

With config:

```bash
curl -X POST http://localhost:5000/parse \
  -F "file=@scanned.pdf" \
  -F 'config={"ocrLanguage":"zh","dpi":200}'
```

Supported client config keys:

- `ocrLanguage`
- `ocrEnabled`
- `ocrServerUrl`
- `dpi`
- `maxPages`
- `targetPages`
- `password`
- `preserveVerySmallText`
- `quiet`
- `numWorkers`

Compatibility note:

- `preciseBoundingBox` is accepted and ignored so older `lp` clients keep working.

### `POST /screenshots`

```bash
curl -X POST "http://localhost:5000/screenshots?pages=1,2,3" \
  -F "file=@document.pdf"
```

Returns NDJSON. Each line contains:

- `index`
- `mimetype`
- `data` - base64 encoded PNG
- `page_number`
- `height`
- `width`

### `GET /health`

```bash
curl http://localhost:5000/health
```

Returns HTTP `200` with an empty body.

## Supported Inputs

The server now writes uploads to temp files with the original extension before calling LiteParse. That preserves the path-based conversion flow needed for non-PDF inputs.

Supported in practice:

- PDF
- Word docs (`.doc`, `.docx`, `.docm`, `.odt`, `.rtf`)
- PowerPoint (`.ppt`, `.pptx`, `.pptm`, `.odp`)
- Spreadsheets (`.xls`, `.xlsx`, `.xlsm`, `.ods`, `.csv`, `.tsv`)
- Images (`.jpg`, `.jpeg`, `.png`, `.gif`, `.bmp`, `.tiff`, `.webp`, `.svg`)

Container packages that make this work:

- LibreOffice - office document conversion
- ImageMagick - image/PDF conversion helpers

The ImageMagick PDF policy is explicitly opened in the container so image conversion paths that round-trip through PDF do not fail.

## Host CLI

There are two ways to use LiteParse locally on this machine.

### Direct Rust CLI

```bash
~/.cargo/bin/lit --version
~/.cargo/bin/lit parse document.pdf
```

This is the fastest direct path and does not go through the HTTP server.

### `lp` wrapper

Your dotfiles expose `lp` at `~/.local/bin/lp`.

Examples:

```bash
lp doc.pdf
lp -j doc.pdf
lp --screenshots ./shots doc.pdf
lp --batch ./in ./out
```

`lp` now works again for:

- text mode
- JSON mode
- screenshots
- batch parsing
- larger Office files

## PaddleOCR Sidecar

The OCR server is still separately useful:

```bash
curl -X POST http://localhost:8829/ocr \
  -F "file=@image.png" \
  -F "language=en"
```

This keeps the OCR layer isolated from the parser runtime. That makes it easier to swap OCR backends later without rewriting the Rust server.

## GPU

The default compose file keeps PaddleOCR CPU-only for portability.

To enable GPU later:

1. Change `python/Dockerfile` to install CUDA PaddlePaddle.
2. Add the NVIDIA device reservation block back into `compose.yaml`.
3. Rebuild only `paddle-ocr`.

## After Reboot

You already have this wired with a systemd user unit from dotfiles:

```bash
systemctl --user start liteparse-paddle.service
systemctl --user status liteparse-paddle.service
systemctl --user is-enabled liteparse-paddle.service
```

The unit runs:

```bash
cd ~/Codes/liteparse-paddle && docker compose up -d
```

## Portless

```bash
portless alias liteparse-paddle 5000
```

Then use:

```text
https://liteparse-paddle.localhost
```

## Updating

This repo now has one real runtime codepath.

### Upstream references

- `~/Codes/liteparse` - keep this updated for the Rust crate and CLI reference
- `~/Codes/liteparse-server` - keep this only as API/reference material if you want

### Actual runtime repo

- `~/Codes/liteparse-paddle` - this repo is the maintained product

### Typical update flow

```bash
cd ~/Codes/liteparse
git fetch --tags
git checkout crates-v2.0.2

cd ~/Codes/liteparse-paddle
cargo build --release --no-default-features
docker compose build --no-cache
docker compose up -d
```

If you change the server code, the files that matter are:

- `src/main.rs`
- `Cargo.toml`
- `Dockerfile`
- `compose.yaml`

## Future Extension: VLM / Markdown Output

The current OCR contract is still text + bounding boxes, which is the right fit for LiteParse.

If you want structure-aware markdown later:

- keep `paddle-ocr` as the default OCR sidecar for normal parsing
- add a second sidecar or endpoint for PaddleOCR-VL / PP-Structure-style output
- expose that as a separate route rather than mixing it into `/parse`

That keeps the fast text extractor stable while leaving room for a richer markdown/VLM path later.

## License

Apache-2.0

## Credits

- [LiteParse](https://github.com/run-llama/liteparse)
- [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR)
