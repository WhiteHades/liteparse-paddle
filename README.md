<p align="center">
  <img src="media/logo.svg" width="400" alt="liteparse-paddle" style="padding-left: 40px"/>
</p>

<p align="center">
  <em>A local document parsing server. PaddleOCR does the OCR. LiteParse v2 does the parsing. One `docker compose up`.</em>
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
  <a href="#who-is-this-for"><b>Who For</b></a> •
  <a href="#api"><b>API</b></a> •
  <a href="#host-cli"><b>CLI</b></a> •
  <a href="#speed-server-vs-cli"><b>Speed</b></a> •
  <a href="#after-reboot"><b>Auto-start</b></a> •
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

Now parse something:

```bash
curl -X POST "http://localhost:5000/parse?text=true" \
  -F "file=@document.pdf"
```

Two services. That's the whole stack:

- `liteparse-server` (port 5000): a Rust HTTP server wrapped around the LiteParse crate
- `paddle-ocr` (port 8829): a Python FastAPI server running PP-OCRv5

The first build takes a few minutes. It pulls down LibreOffice and ImageMagick inside the server container so non-PDF formats work. The first OCR request is slow too. PaddleOCR downloads its language models when it first sees a request. After that, everything is fast.

No `.env` file needed. No API keys. Nothing to configure.

## Architecture

```text
you (curl / lp / script)
  -> POST :5000/parse or :5000/screenshots
  -> Rust axum server (liteparse-server)
  -> LiteParse Rust crate (v2.0.2)
  -> when OCR is needed: POST :8829/ocr
  -> PaddleOCR (PP-OCRv5, 109 languages)
  -> text + bounding boxes come back
  -> server merges OCR results into the parsed document
  -> response goes back to you
```

Why two containers instead of one? OCR is the heavy lift. PaddleOCR model weights are about 150MB per language. By keeping them in a separate container, the parser server stays small and fast. The OCR container only wakes up when a page actually needs it. And if you want to swap in a different OCR engine later, you only touch one container.

Why this repo instead of upstream? LiteParse v2 is now Rust (fast), but the crate doesn't ship with an HTTP server. It also defaults to Tesseract for OCR, which is fine but less accurate than PaddleOCR on real-world images. This repo bolts an HTTP layer onto the Rust parser and swaps in PaddleOCR as the default OCR backend.

## Who Is This For?

**You likely want this if:**

- You need a local document parser with an HTTP API. Nothing cloud-dependent. Everything runs on your machine.
- Your scripts, editors, or AI agent pipelines need to read PDFs, DOCX files, PPTX decks, spreadsheets, or images.
- You want better OCR than Tesseract without paying for a cloud OCR service. PaddleOCR's PP-OCRv5 model consistently beats Tesseract on noisy images, handwriting, and non-English text.
- You understand Docker and don't mind a one-time `docker compose up` setup.

**You can probably skip this if:**

- You just want to parse a PDF once. Install `cargo install liteparse` and run `lit parse file.pdf`. That's faster for one-offs and needs no Docker at all.
- You're building a SaaS that processes millions of documents. This is a single-machine local server. It doesn't scale horizontally, doesn't queue requests, doesn't distribute work.
- Your machine is tight on RAM. PaddleOCR pulls about 2GB for its models at runtime. If you're on a 4GB laptop, this might not fit alongside your browser.

This is a developer tool for local automation. If you find yourself typing `curl :5000/parse` a lot, or writing shell scripts that call it, you're the target audience.

## How To Use It (In Plain English)

You upload a file, the server hands it to the LiteParse engine, the engine figures out if any pages need OCR, calls PaddleOCR only for those pages, merges the OCR text with the rest of the document, and sends you back structured text or JSON.

### What "needs OCR" means

Not every page triggers OCR. Native-text PDFs (where you can select and copy text) already have the text embedded. LiteParse reads that directly. OCR only fires on:

- Pages with very little native text (less than about 100 characters)
- Embedded images inside documents
- Screenshots, scans, photos of documents

This saves a lot of time. A 200-page textbook that is mostly native text will parse in seconds. A 200-page scanned PDF will take longer because every page needs OCR.

### What you get back

In text mode (`?text=true`): one string, the full document text, laid out close to how it appears on the page.

In JSON mode (default): structured data per page. Coordinates for every text element, font info, OCR confidence scores. Useful if you're building something that needs to know where on the page each word sits.

### What happens to your file

The server writes uploads to a temp file (with the original extension, so LibreOffice knows how to handle DOCX vs PDF vs PNG), then passes the temp path to the LiteParse engine. When the request finishes, the temp file gets cleaned up. No file stays on disk.

## API

### `POST /parse`

**Plain text:**

```bash
curl -X POST "http://localhost:5000/parse?text=true" \
  -F "file=@document.pdf"
```

**JSON (default):**

```bash
curl -X POST http://localhost:5000/parse \
  -F "file=@document.pdf"
```

**With OCR options:**

```bash
curl -X POST http://localhost:5000/parse \
  -F "file=@scanned-chinese.pdf" \
  -F 'config={"ocrLanguage":"zh","dpi":200}'
```

**Config fields you can set:**

| Field | Type | Default | What it does |
|-------|------|---------|-------------|
| `ocrLanguage` | string | `en` | OCR language code (2-letter PaddleOCR format) |
| `ocrEnabled` | bool | `true` | Set to `false` to skip OCR entirely |
| `ocrServerUrl` | string | from env | Override OCR endpoint (defaults to PaddleOCR) |
| `dpi` | float | `150` | Rendering DPI for OCR and screenshots |
| `maxPages` | number | `1000` | Max pages to process |
| `targetPages` | string | `null` | Specific pages, e.g. `"1-5,10,15-20"` |
| `password` | string | `null` | Password for encrypted PDFs |
| `preserveVerySmallText` | bool | `false` | Keep tiny text that would normally get filtered out |
| `quiet` | bool | `false` | Suppress progress output |
| `numWorkers` | number | CPUs-1 | Concurrent OCR workers |

The field `preciseBoundingBox` is accepted and ignored. It exists so older `lp` scripts don't break.

### `POST /screenshots`

```bash
curl -X POST "http://localhost:5000/screenshots?pages=1,2,3" \
  -F "file=@document.pdf"
```

Returns NDJSON. One JSON object per line. Each line has `page_number`, `width`, `height`, and `data` (base64-encoded PNG).

Pull the PNG out of a response line:

```bash
curl -s :5000/screenshots?pages=1 -F "file=@doc.pdf" \
  | head -1 | jq -r '.data' | base64 -d > page1.png
```

### `GET /health`

```bash
curl http://localhost:5000/health
```

Returns `200` with an empty body.

## Supported Formats

You can throw these at the server:

| Category | Extensions |
|----------|-----------|
| PDF | `.pdf` |
| Word | `.doc`, `.docx`, `.docm`, `.odt`, `.rtf` |
| PowerPoint | `.ppt`, `.pptx`, `.pptm`, `.odp` |
| Excel | `.xls`, `.xlsx`, `.xlsm`, `.ods`, `.csv`, `.tsv` |
| Images | `.jpg`, `.jpeg`, `.png`, `.gif`, `.bmp`, `.tiff`, `.webp`, `.svg` |

Office formats go through LibreOffice inside the container. Images go through ImageMagick. Both are installed in the server image, so you don't need either on your host machine.

For images, there is one gotcha. ImageMagick on Debian blocks PDF conversion by default (a security policy). The Dockerfile opens that policy so image-to-PDF roundtrips work. If you're running the server outside Docker, you'll need the same policy change on your host ImageMagick.

## Speed: Server vs Direct CLI

Both use the same Rust engine. The only difference is how you reach it.

Tested on a 260KB one-page PDF, both already warm:

| Method | Time | What happens |
|--------|------|-------------|
| `lit parse file.pdf` (CLI) | 13ms | Binary reads file, parses, prints text, exits |
| `curl :5000/parse` (server) | 20ms | HTTP request + multipart parsing + temp file write + parse + response |

The 7ms gap is the HTTP plumbing. For a file this small, the network roundtrip is a noticeable fraction of the total. For a 5MB PDF, both take hundreds of milliseconds, and the HTTP overhead becomes a rounding error.

**When to use the CLI.** You're at a terminal, you have a file on disk, you want its text. `lit parse file.pdf`. Done. No Docker, no ports, no warmup.

**When to use the server.** You want your scripts, your editor, or your AI agent to call parse without installing a Rust binary. You want OCR without configuring Tesseract. You want a stable HTTP endpoint that other tools can depend on.

They complement each other. Use the CLI for quick one-off work. Keep the server running for automation.

## Host CLI

### `lit` (Rust binary)

Install once:

```bash
cargo install liteparse
```

The binary is called `lit` (not `liteparse`; that's the crate name, the upstream authors picked a shorter binary). Verify:

```bash
lit --version   # 2.0.2
lit parse document.pdf
```

This skips the server entirely. The binary calls the LiteParse crate directly. No Docker, no HTTP, no ports. Fastest path for one-off parsing.

### `lp` (shell wrapper)

This repo ships a bash script at `bin/lp` that wraps curl calls to the server. It mirrors the upstream `lit` CLI flag names so it feels familiar:

```bash
# Make it available on PATH
ln -sf "$(pwd)/bin/lp" ~/.local/bin/lp

# Now use it anywhere
lp doc.pdf                       # text
lp -j doc.pdf                    # JSON
lp -l zh scanned.pdf             # Chinese OCR
lp -s "1-5,10" doc.pdf           # specific pages
lp --screenshots ./shots doc.pdf # save page images
lp --batch ./in ./out            # parse a directory
lp --batch ./in ./out --ext .pdf # PDFs only
```

Run `lp --help` for the full flag reference. The script sends everything to `localhost:5000`, so the Docker server needs to be running.

## PaddleOCR Sidecar

The OCR server sits on port 8829 and you can talk to it directly:

```bash
curl -X POST http://localhost:8829/ocr \
  -F "file=@image.png" \
  -F "language=en"
```

Returns text with bounding boxes and confidence scores. Any tool on your machine can use this endpoint. It's the upstream `liteparse/ocr/paddleocr/server.py` FastAPI server, unchanged.

Separating OCR from the parser means you can swap OCR backends later. Want to try EasyOCR? Spin up a different container on the same port shape. Want to add a VLM for markdown output? Add a second sidecar and a new route. The parser doesn't care what answers the OCR calls.

## GPU

CPU-only by default. PaddleOCR runs fine on CPU for most documents, just slower on image-heavy or scanned files.

To turn on GPU:

1. Change `python/Dockerfile` to pull the CUDA pip index: `--extra-index-url https://www.paddlepaddle.org.cn/packages/stable/cuda12/`
2. Uncomment the `deploy` block under `paddle-ocr` in `compose.yaml`
3. Rebuild: `docker compose build paddle-ocr && docker compose up -d`

You need the NVIDIA Container Toolkit installed on the host.

## Making It Survive Reboots

Docker containers die when the machine restarts. To bring everything back on boot, wire a systemd user unit:

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

Check it took:

```bash
systemctl --user status liteparse-paddle.service
```

Change `%h/liteparse-paddle` in the unit to wherever you cloned the repo. After that, it'll start on every boot.

## Portless (named local URL)

If you have [portless](https://github.com/WhiteHades/portless) installed:

```bash
portless alias liteparse-paddle 5000
```

Now use `https://liteparse-paddle.localhost` instead of `localhost:5000`. Nicer for browser-based tools and API explorers.

## Updating

### Server code

```bash
cd /path/to/liteparse-paddle
git pull
docker compose build --no-cache
docker compose up -d
```

### Looking at upstream

The upstream `liteparse` crate lives at `https://github.com/run-llama/liteparse`. Clone it if you want to track their releases. The tag `crust-v2.0.2` is what this server pins against right now.

## Future: VLM / Markdown

Right now the OCR contract is text plus bounding boxes, which is what LiteParse expects. PaddleOCR also ships a newer model, PaddleOCR-VL, that outputs structured markdown (tables, formulas, heading hierarchy) instead of flat text.

If you want that later:

- Keep the current `paddle-ocr` container as-is for normal parsing
- Add a second sidecar for PaddleOCR-VL or PP-Structure
- Expose it on its own route (e.g. `/parse-md`)
- Leave `/parse` alone so the fast text path stays stable

That way you get both: fast extraction for automation, rich structure when you need it.

## Troubleshooting

**"Parse error: unsupported file format"**

The file extension matters. Make sure curl sends the right filename. If you renamed a PDF to `.bin`, the server won't know what to do with it.

**"No 'file' field provided"**

You forgot the `file=@` part of the curl command. Double-check the `-F "file=@path/to/doc.pdf"` syntax.

**Server won't start**

Run `docker compose logs liteparse-server`. If you see glibc errors, the binary was compiled on a newer system than the container's Debian base. Rebuild with `docker compose build --no-cache`.

**OCR isn't running on a page that needs it**

The server only fires OCR when native text is sparse (under about 100 characters). If a page has mostly text but a small embedded image, OCR won't run on the image portion. This is a LiteParse engine behaviour, not a server bug. For full OCR on every page regardless, set `"ocrEnabled": true` (already the default) and lower the threshold by not relying on native text detection: convert the input to an image first and send that.

## License

Apache-2.0

## Credits

- [LiteParse](https://github.com/run-llama/liteparse) by LlamaIndex
- [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) by Baidu
