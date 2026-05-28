<p align="center">
  <img src="media/logo.svg" width="400" alt="liteparse-paddle" style="padding-left: 40px"/>
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
git clone https://github.com/WhiteHades/liteparse-paddle
cd liteparse-paddle
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

- Upstream LiteParse v2 is Rust-first and fast, but has no built-in HTTP server.
- PaddleOCR provides more accurate OCR than the default Tesseract engine.
- This repo bundles both into a single `docker compose up` stack that Just Works.

## Who Is This For?

**You want this if:**

- You need to extract text from PDFs, Office files, or images **on your own machine** (not a cloud API).
- You want a local HTTP API so your scripts, editors, or other tools can parse documents with a simple `curl` call.
- You build local automation — shell scripts, cron jobs, AI agent pipelines — that ingest documents.
- You want better OCR accuracy than Tesseract, without paying for a cloud OCR service.
- You understand Docker and are comfortable with a `docker compose up` setup.

**You probably don't need this if:**

- You just need to parse a PDF once in a while — install `cargo install liteparse` and use the `lit` CLI directly. It's faster for one-off use.
- You're building a SaaS that parses millions of documents — this is a single-machine local server, not a multi-tenant production API.
- You're on a machine without Docker or with very limited RAM (<4GB) — the PaddleOCR sidecar needs ~2GB for its models.

In short: this is a **local developer/automation tool**, not a cloud service. If you find yourself typing `curl :5000/parse` a lot, this is for you.

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

There are two ways to use LiteParse without writing HTTP requests.

### Direct Rust CLI

Install the Rust CLI once:

```bash
cargo install liteparse
```

The installed binary is called `lit` (not `liteparse` — that's the crate name).

```bash
lit --version
lit parse document.pdf
```

This is the fastest possible path — the binary calls the LiteParse crate directly with no HTTP overhead. Best for one-off local use.

### `lp` wrapper

This repo ships a convenience bash script called `lp` in `bin/lp`. It's an HTTP client that talks to the local server so you get the full parse + OCR pipeline in a single command.

To install:

```bash
ln -sf "$(pwd)/bin/lp" ~/.local/bin/lp
```

Examples:

```bash
lp doc.pdf
lp -j doc.pdf
lp --screenshots ./shots doc.pdf
lp --batch ./in ./out
```

For detailed CLI flags, run `lp --help`.

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

Docker containers don't survive reboots on their own. To auto-start the stack, create a systemd user unit:

```bash
mkdir -p ~/.config/systemd/user
cat > ~/.config/systemd/user/liteparse-paddle.service << 'SERVICE'
[Unit]
Description=LiteParse PaddleOCR document parsing server

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=%h/liteparse-paddle
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
StandardOutput=journal

[Install]
WantedBy=default.target
SERVICE

loginctl enable-linger $USER
systemctl --user daemon-reload
systemctl --user enable --now liteparse-paddle.service
```

Verify:

```bash
systemctl --user start liteparse-paddle.service
systemctl --user status liteparse-paddle.service
```

The `WorkingDirectory` path above assumes you cloned the repo to `~/liteparse-paddle`. Adjust the path if you cloned elsewhere.

## Portless

```bash
portless alias liteparse-paddle 5000
```

Then use:

```text
https://liteparse-paddle.localhost
```

## Updating

### Upstream references

- The upstream `liteparse` source: `https://github.com/run-llama/liteparse`. Clone it if you want to stay in sync with upstream releases.
- `crust-v2.0.2` is the tag that was current at the time of this rewrite.

### Update the server

```bash
cd /path/to/liteparse-paddle
git pull
docker compose build --no-cache
docker compose up -d
```

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
