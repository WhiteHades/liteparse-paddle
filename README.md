<p align="center">
  <img src="media/logo.svg" width="400" alt="liteparse-paddle" style="padding-left: 40px"/>
</p>

<p align="center">
  <em><b>Local document parsing, no cloud.</b> PaddleOCR handles the OCR. LiteParse v2 extracts the text. Rust server on port 5000. Docker Compose. That's it.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/engine-liteparse%20v2%20(rust)-000000?style=flat-square&logo=rust&logoColor=white"/>
  <img src="https://img.shields.io/badge/ocr-paddleocr%20pp--ocrv5-orange?style=flat-square&logo=python&logoColor=white"/>
  <img src="https://img.shields.io/badge/109-languages-22c55e?style=flat-square"/>
  <img src="https://img.shields.io/badge/gpu-cuda%20ready-06b6d4?style=flat-square"/>
  <img src="https://img.shields.io/badge/runtime-docker%20compose-2496ED?style=flat-square&logo=docker&logoColor=white"/>
  <img src="https://img.shields.io/badge/license-Apache--2.0-3b82f6?style=flat-square"/>
</p>

<p align="center">
  <b>PDF</b> • <b>DOCX</b> • <b>XLSX</b> • <b>PPTX</b> • <b>ODT</b> • <b>ODS</b> • <b>ODP</b> • <b>CSV</b> • <b>TSV</b> • <b>RTF</b> • <b>PNG</b> • <b>JPG</b> • <b>SVG</b> • <b>TIFF</b>
</p>

---

## Quick Start

```bash
git clone https://github.com/WhiteHades/liteparse-paddle
cd liteparse-paddle
docker compose build --no-cache
docker compose up -d
```

<details>
<summary><b>Don't have Docker?</b> Click to expand install guides.</summary>

**Linux (Ubuntu/Debian):**
```bash
sudo apt update && sudo apt install docker.io docker-compose-v2
sudo usermod -aG docker $USER && newgrp docker
```

**Linux (Arch):**
```bash
sudo pacman -S docker docker-compose
sudo systemctl enable --now docker
sudo usermod -aG docker $USER && newgrp docker
```

**macOS:** Install [Docker Desktop](https://www.docker.com/products/docker-desktop/). Download the `.dmg`, drag to Applications, open it.

**Windows:** Install [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/). It sets up WSL2 for you.
</details>

<details>
<summary><b>Don't have Git?</b> Click to expand.</summary>

Download the zip instead:
```bash
curl -L https://github.com/WhiteHades/liteparse-paddle/archive/refs/heads/main.zip -o liteparse-paddle.zip
unzip liteparse-paddle.zip && cd liteparse-paddle-main
docker compose build --no-cache && docker compose up -d
```

Or install Git: `sudo apt install git` (Ubuntu), `sudo pacman -S git` (Arch), `brew install git` (macOS), [git-scm.com](https://git-scm.com) (Windows).
</details>

After the four commands above, the server is running. Here's how to use it:

### The lp command (recommended)

`lp` is a shell wrapper that ships with this repo. Install it once:

```bash
ln -sf "$(pwd)/bin/lp" ~/.local/bin/lp
```

Now parse documents with short, readable commands:

```bash
lp document.pdf                         # plain text output
lp -j document.pdf                      # JSON output
lp -l zh scanned.pdf                    # Chinese OCR
lp -s "1-5,10" report.pdf              # specific pages only
lp -d 200 image.png                     # higher DPI for better OCR
lp --screenshots ./out document.pdf     # save each page as a PNG
lp --batch ./input ./output             # parse every document in a folder
lp --batch ./in ./out --ext .pdf        # only parse PDFs in the folder
lp -h                                    # full help
```

All `lp` commands talk to the server at `localhost:5000`. The server must be running (step 4 above).

### Direct API (curl)

If you prefer raw HTTP or are calling from code:

```bash
curl -X POST "http://localhost:5000/parse?text=true" -F "file=@document.pdf"
curl -X POST "http://localhost:5000/parse" -F "file=@document.pdf"
curl -X POST "http://localhost:5000/parse" -F "file=@scan.pdf" -F 'config={"ocrLanguage":"zh","dpi":200}'
```

### Rust CLI (no Docker)

For quick one-off parsing with no Docker at all:

```bash
cargo install liteparse
lit parse document.pdf
```

---

## What Is This?

| | |
|---|---|
| What it does | Pulls text out of documents. PDFs, Word, Excel, PowerPoint, images. |
| How | HTTP API on port 5000. You send a file, it sends back text or JSON. |
| Where | Your machine. Not the cloud. Files never leave your computer. |
| OCR | PaddleOCR PP-OCRv5. 109 languages. More accurate than Tesseract. |
| Parser | LiteParse v2 (Rust). Reads native PDF text, merges it with OCR results. |
| Stack | Two Docker containers: a Rust server and a Python OCR sidecar. |
| Cost | Free. No API keys, no accounts, no usage limits. |

It exists because most document parsers live in the cloud: you upload files to someone else's server, pay per page, and your documents leave your machine. This one runs locally. Parse a thousand pages once or a hundred times, it costs the same.

OCR only fires when a page actually needs it. Native PDFs (where you can select and copy text) already have the text embedded; the parser reads that directly. Scans, photos, and embedded images get sent to PaddleOCR. A 200-page textbook parses in seconds. A 200-page scanned PDF takes longer because every page goes through OCR.

---

## API Reference

### POST /parse

```bash
# Plain text
curl -X POST "http://localhost:5000/parse?text=true" -F "file=@doc.pdf"

# JSON (default)
curl -X POST http://localhost:5000/parse -F "file=@doc.pdf"
```

### POST /screenshots

```bash
curl -X POST "http://localhost:5000/screenshots?pages=1,2,3" -F "file=@doc.pdf"
```

Returns NDJSON. Each line: `page_number`, `width`, `height`, `data` (base64 PNG).

### GET /health

```bash
curl http://localhost:5000/health
```

### Supported Formats

| Category | Extensions | Handled by |
|----------|-----------|-----------|
| PDF | `.pdf` | Built-in PDF engine |
| Word | `.doc`, `.docx`, `.docm`, `.odt`, `.rtf` | LibreOffice |
| PowerPoint | `.ppt`, `.pptx`, `.pptm`, `.odp` | LibreOffice |
| Excel | `.xls`, `.xlsx`, `.xlsm`, `.ods`, `.csv`, `.tsv` | LibreOffice |
| Images | `.jpg`, `.jpeg`, `.png`, `.gif`, `.bmp`, `.tiff`, `.webp`, `.svg` | ImageMagick |

---

## Config Options

Pass these as JSON in the `config` field:

| Field | Type | Default | What it does |
|-------|------|---------|-------------|
| `ocrLanguage` | string | `en` | Language code for OCR |
| `ocrEnabled` | bool | `true` | Set `false` to skip OCR entirely |
| `ocrServerUrl` | string | from env | Custom OCR server URL |
| `dpi` | float | `150` | Rendering sharpness (higher = more accurate, slower) |
| `maxPages` | number | `1000` | Stop after this many pages |
| `targetPages` | string | `null` | Specific pages: `"1-5,10,15-20"` |
| `password` | string | `null` | Password for encrypted PDFs |
| `preserveVerySmallText` | bool | `false` | Keep tiny footnote-sized text |
| `quiet` | bool | `false` | Suppress server log output |
| `numWorkers` | number | CPUs-1 | Concurrent OCR tasks |

---

## Speed: Server vs CLI

Tested warm on a 260KB single-page PDF:

| Method | Time | Overhead |
|--------|------|----------|
| `lit parse file.pdf` (Rust CLI) | 13ms | None |
| `curl :5000/parse` (server) | 20ms | +7ms HTTP plumbing |

For small files the CLI is faster (no network roundtrip). For 5MB+ PDFs the parsing dominates and the gap disappears. Use the CLI for one-off parsing. Use the server when you want OCR without config or a stable HTTP endpoint for automation.

---

## Auto-Start On Boot

Create a systemd user unit so the server comes back after reboots:

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

Change `%h/liteparse-paddle` if you cloned elsewhere. Verify: `systemctl --user status liteparse-paddle.service`.

---

## GPU

CPU-only by default. To enable CUDA:

1. Switch `python/Dockerfile` to the CUDA pip index
2. Uncomment the `deploy` block in `compose.yaml`
3. `docker compose build paddle-ocr && docker compose up -d`

Requires [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html) on the host.

---

## Updating

```bash
git pull
docker compose build --no-cache
docker compose up -d
```

---

## Troubleshooting

**Server won't start:** `docker compose logs liteparse-server`

**"Unsupported file format":** The file must have a recognised extension (`.pdf`, `.docx`, `.png`, etc). Don't rename it to `.bin` or use a generic temp name.

**OCR doesn't run on a page that needs it:** LiteParse skips OCR on pages with >100 characters of native text. If you need OCR on a text-heavy page with embedded images, convert the page to an image first and send that instead.

**Images fail with "security policy":** The Docker image fixes Debian's ImageMagick PDF policy. If you're running outside Docker, you'll need to apply the same fix.

---

## License

Apache-2.0

---

## Credits

- [LiteParse](https://github.com/run-llama/liteparse) by LlamaIndex
- [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) by Baidu
