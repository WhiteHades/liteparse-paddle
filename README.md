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

## Table of Contents

- [What Is This?](#what-is-this)
- [The Problem It Solves](#the-problem-it-solves)
- [What You Need](#what-you-need)
- [Quick Start](#quick-start)
- [How It Works](#how-it-works)
  - [The Two Containers](#the-two-containers)
  - [What OCR Means (And When It Runs)](#what-ocr-means-and-when-it-runs)
  - [What Happens To Your File](#what-happens-to-your-file)
  - [What You Get Back](#what-you-get-back)
- [API Reference](#api-reference)
  - [POST /parse](#post-parse)
  - [POST /screenshots](#post-screenshots)
  - [GET /health](#get-health)
  - [Supported File Types](#supported-file-types)
- [Config Options](#config-options)
  - [Common Recipes](#common-recipes)
- [Three Ways To Use It](#three-ways-to-use-it)
  - [curl (The API)](#curl-the-api)
  - [lp (The Shell Wrapper)](#lp-the-shell-wrapper)
  - [lit (The Rust CLI)](#lit-the-rust-cli)
- [Speed: Server vs CLI](#speed-server-vs-cli)
- [Making It Auto-Start On Boot](#making-it-auto-start-on-boot)
  - [systemd (Recommended)](#systemd-recommended)
  - [Portless (Nicer URL)](#portless-nicer-url)
- [GPU Acceleration](#gpu-acceleration)
- [How To Update](#how-to-update)
- [Troubleshooting](#troubleshooting)
- [Future: VLM and Markdown](#future-vlm-and-markdown)
- [License](#license)
- [Credits](#credits)

---

## What Is This?

**At a glance:**

| | |
|---|---|
| What it does | Extracts text from documents. PDFs, Word docs, spreadsheets, slides, images. |
| How you use it | You send it a file through HTTP. It sends back the text. |
| Where it runs | On your machine. Not in the cloud. Your files don't leave your computer. |
| OCR engine | PaddleOCR PP-OCRv5. 109 languages. Beats Tesseract on real-world images. |
| Parser engine | LiteParse v2. Rust. Reads native text from PDFs, merges it with OCR output, preserves layout. |
| Server | Rust + axum. Port 5000. About 15MB of RAM idle. |
| Install style | `docker compose up -d`. Two containers. That's the whole setup. |
| Cost | Free. No API keys. No accounts. No usage limits. |

You install it once. It runs quietly in the background. Any program on your machine that can make an HTTP request can ask it to parse a document. Shell scripts, Python notebooks, Obsidian plugins, AI agent toolchains, whatever you're building.

Under the hood: two Docker containers. One runs a Rust HTTP server bolted onto the LiteParse v2 library (the thing that actually reads documents). The other runs a Python OCR service using PaddleOCR's PP-OCRv5 model. When a page has no readable text on it (a scan, a photo, an embedded chart), the parser sends it to PaddleOCR, gets back text with coordinates, and merges it into the output. Pages with native text skip OCR entirely, so a 200-page textbook parses in seconds.

---

## The Problem It Solves

Most document parsers live in the cloud. You upload a file, somebody else's server reads it, and you get text back. That's fine for some things, but it's slow (network roundtrips), it costs money (API fees), and it leaks data (your documents leave your machine).

This project does the same job locally. Your files never leave your computer. There's no usage limit and no monthly bill. Parse a thousand-page PDF once or a hundred times, it costs the same: zero.

It also swaps in PaddleOCR instead of the more common Tesseract. PaddleOCR is more accurate on real-world images, handwriting, and non-English text. The tradeoff is that it's bigger (about 2GB of RAM for the models) and runs in a separate container. For most local machines that's fine. For a 4GB laptop, it's tight.

---

## What You Need

Every setup needs these. We cover variations (no Docker, no Git, low RAM, GPU vs CPU) below.

| Requirement | Minimum | Recommended | Why |
|------------|---------|-------------|-----|
| Docker | 20.10+ | 27+ | Runs the containers |
| Docker Compose | v2 (plugin) | v2 | Orchestrates both containers with one command |
| Git | Any | Latest | To clone the repo. You can skip this by downloading the zip from GitHub |
| Disk space | 4 GB | 6 GB | Container images + PaddleOCR model downloads |
| RAM | 3 GB | 8 GB | PaddleOCR uses about 2GB for models. The parser server uses about 15MB |
| Terminal | Any shell | bash or zsh | For typing the commands |
| OS | Any that runs Docker | Linux, macOS, Windows (WSL2) | Docker runs on all three |

### If you don't have Docker

**Linux (Ubuntu/Debian):**
```bash
sudo apt update && sudo apt install docker.io docker-compose-v2
sudo usermod -aG docker $USER
# Log out and back in for the group change to take effect
```

**Linux (Arch):**
```bash
sudo pacman -S docker docker-compose
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
# Log out and back in
```

**macOS:**
Install [Docker Desktop](https://www.docker.com/products/docker-desktop/). It includes Docker, Docker Compose, and a GUI. Download the `.dmg`, drag to Applications, open it. Wait for the whale icon to stop animating.

**Windows:**
Install [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/). It needs WSL2 (Windows Subsystem for Linux), which the installer sets up for you. After install, open Docker Desktop and wait for it to finish starting.

### If you don't have Git

Download the repo as a zip file:

```bash
curl -L https://github.com/WhiteHades/liteparse-paddle/archive/refs/heads/main.zip -o liteparse-paddle.zip
unzip liteparse-paddle.zip
cd liteparse-paddle-main
docker compose build --no-cache
docker compose up -d
```

Or install Git:
- Linux: `sudo apt install git` (Ubuntu/Debian) or `sudo pacman -S git` (Arch)
- macOS: `brew install git` or comes with Xcode Command Line Tools
- Windows: [git-scm.com](https://git-scm.com/download/win)

### If you have limited RAM (under 5 GB)

PaddleOCR needs about 2GB. If your machine is tight:

**Option 1: Skip OCR entirely and use the Rust CLI.**
You don't need Docker at all. Just the parser, no OCR:

```bash
cargo install liteparse
lit parse document.pdf
```

This uses about 50MB of RAM. Fast. No OCR. Good for native-text PDFs.

**Option 2: Run the server but disable OCR for individual requests.**
Start the full server, but send `"ocrEnabled": false` in your parse requests:

```bash
curl -X POST "http://localhost:5000/parse?text=true" \
  -F "file=@document.pdf" \
  -F 'config={"ocrEnabled":false}'
```

OCR won't run, so RAM stays low. Best when you only occasionally need OCR.

### If you want GPU (CUDA)

The default is CPU. GPU is optional. You need:

1. An NVIDIA GPU with CUDA support
2. [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html) installed
3. A few config changes (documented in the [GPU Acceleration](#gpu-acceleration) section)

CPU-only PaddleOCR handles a page in about 1-3 seconds. GPU brings that down to 200-500ms. For most one-off use, CPU is fine.

### Quick sanity check

After installing Docker, verify it works:

```bash
docker run hello-world
```

If you see "Hello from Docker!", you're ready.

---

## Quick Start

Four commands:

```bash
git clone https://github.com/WhiteHades/liteparse-paddle
cd liteparse-paddle
docker compose build --no-cache
docker compose up -d
```

What each one does:

1. `git clone` downloads the code to your machine.
2. `cd` moves you into the project folder.
3. `docker compose build` builds the Docker image. This takes a few minutes the first time because it installs LibreOffice and ImageMagick inside the container.
4. `docker compose up -d` starts the server in the background. `-d` means "detached": it runs without taking over your terminal.

After those four commands, parse a document:

```bash
curl -X POST "http://localhost:5000/parse?text=true" \
  -F "file=@document.pdf"
```

The first request to PaddleOCR will be slow (about 30 seconds). It's downloading the language models. Subsequent requests are fast.

To stop it: `docker compose down`.

---

## How It Works

### The Two Containers

Docker containers are like lightweight virtual machines. Each one runs a single program in its own isolated environment. This project has two:

**liteparse-server (port 5000)**
This is the front door. A Rust program that listens for HTTP requests. When you send it a file, it hands the file to the LiteParse library (also Rust, also fast) which pulls out the text. If a page needs OCR, this server calls the PaddleOCR container.

**paddle-ocr (port 8829)**
A Python server that runs the PP-OCRv5 model. It only wakes up when a page needs OCR. The parser server sends it an image, it returns the text with coordinates and confidence scores.

Why split them? OCR is the heavy part. Model weights are big. By keeping them in a separate container, the parser stays small and fast when OCR isn't needed. And if you want to swap PaddleOCR for a different OCR engine later, you only touch one container.

### What OCR Means (And When It Runs)

OCR stands for Optical Character Recognition. It's the process of looking at an image and finding text in it. Like when you take a photo of a page and your phone can copy the text.

Not every page needs it. Native PDFs (where you can select and copy text with your mouse) already have the text embedded. The parser reads that directly. OCR only fires on:

- Pages with very little native text (under about 100 characters)
- Images embedded inside documents
- Scans, screenshots, photos of documents

This is why a 200-page textbook (native text) parses in seconds, but a 200-page scanned PDF takes longer: every page needs OCR.

### What Happens To Your File

When you upload a file:

1. The server writes it to a temporary file on disk, keeping the original extension (`.pdf`, `.docx`, `.png`, etc.)
2. It passes the temp file path to the LiteParse engine
3. The engine reads the file. If it's a PDF, it uses a built-in PDF reader. If it's anything else, it calls LibreOffice or ImageMagick (inside the container) to convert it to a PDF first
4. The engine checks each page. Pages with enough native text get read directly. Sparse pages or embedded images get sent to PaddleOCR for OCR
5. The OCR results (when there are any) get merged back into the document text
6. The server sends the result back to you
7. The temp file gets cleaned up

No uploaded file stays on disk.

### What You Get Back

In **text mode** (`?text=true`): a single string containing the whole document. Text is laid out roughly as it appears on the page. Easy to pipe into other commands or save to a file.

In **JSON mode** (default): one JSON object per page. Each page has its text, plus a list of every text element with pixel-level coordinates, font names, font sizes, and OCR confidence scores (when OCR ran on that element). Use this when you need to know where things are on the page, not just what they say.

---

## API Reference

### POST /parse

The main endpoint. Send it a file, get text or JSON back.

**Text output:**

```bash
curl -X POST "http://localhost:5000/parse?text=true" \
  -F "file=@document.pdf"
```

**JSON output (default):**

```bash
curl -X POST http://localhost:5000/parse \
  -F "file=@document.pdf"
```

**With options:**

```bash
curl -X POST http://localhost:5000/parse \
  -F "file=@scanned-chinese.pdf" \
  -F 'config={"ocrLanguage":"zh","dpi":200}'
```

The `config` field takes a JSON object with any of the options from the [Config Options](#config-options) table below.

### POST /screenshots

Renders pages as PNG images.

```bash
curl -X POST "http://localhost:5000/screenshots?pages=1,2,3" \
  -F "file=@document.pdf"
```

Returns NDJSON (newline-delimited JSON). Each line is a JSON object with:

- `page_number`: which page this is
- `width` and `height`: image dimensions in pixels
- `data`: the actual PNG, base64-encoded

To save a page as a PNG file:

```bash
curl -s :5000/screenshots?pages=1 -F "file=@doc.pdf" \
  | head -1 | jq -r '.data' | base64 -d > page1.png
```

The `lp` script (see below) does this for you with `lp --screenshots ./out doc.pdf`.

### GET /health

```bash
curl http://localhost:5000/health
```

Returns `200` with no body. Use it in scripts to check if the server is alive.

### Supported File Types

| Category | Extensions | How it's handled |
|----------|-----------|-----------------|
| PDF | `.pdf` | Direct. Read by the built-in PDF engine |
| Word | `.doc`, `.docx`, `.docm`, `.odt`, `.rtf` | Converted to PDF by LibreOffice |
| PowerPoint | `.ppt`, `.pptx`, `.pptm`, `.odp` | Converted to PDF by LibreOffice |
| Excel | `.xls`, `.xlsx`, `.xlsm`, `.ods`, `.csv`, `.tsv` | Converted to PDF by LibreOffice |
| Images | `.jpg`, `.jpeg`, `.png`, `.gif`, `.bmp`, `.tiff`, `.webp`, `.svg` | Converted to PDF by ImageMagick |

All the conversion tools (LibreOffice, ImageMagick) live inside the Docker container. You don't need them on your host machine.

There's one gotcha with images. Debian's ImageMagick blocks PDF conversion by default (a security policy). The Dockerfile opens that policy so images work. If you run the server outside Docker, you'll need to do the same on your host.

---

## Config Options

All of these go inside the `config` JSON field when calling `/parse` or `/screenshots`.

| Field | Type | Default | What it does |
|-------|------|---------|-------------|
| `ocrLanguage` | string | `en` | Which language PaddleOCR should use. 2-letter codes: `en`, `zh`, `ja`, `ko`, `fr`, etc. |
| `ocrEnabled` | bool | `true` | Set to `false` to skip OCR on all pages. Good for native-text PDFs where you know OCR isn't needed. |
| `ocrServerUrl` | string | from env | Send OCR to a different server. If empty, uses PaddleOCR at `:8829`. |
| `dpi` | float | `150` | How sharp to render pages for OCR. Higher = more accurate = slower. |
| `maxPages` | number | `1000` | Stop after this many pages. |
| `targetPages` | string | `null` | Only process specific pages. Format: `"1-5,10,15-20"`. |
| `password` | string | `null` | Password for encrypted/protected PDFs. |
| `preserveVerySmallText` | bool | `false` | Keep footnote-sized text that would normally get filtered out. |
| `quiet` | bool | `false` | Don't print progress dots to the server log. |
| `numWorkers` | number | CPUs-1 | How many OCR tasks to run in parallel. Default is all your CPU cores minus one. |

The field `preciseBoundingBox` is accepted and silently ignored. Old versions of the `lp` script send it, and the server just nods politely and carries on.

### Common Recipes

**Parse a scanned Chinese document quickly:**

```bash
curl -X POST http://localhost:5000/parse \
  -F "file=@chinese-scan.pdf" \
  -F 'config={"ocrLanguage":"zh","dpi":100}'
```

Lower DPI = faster. Acceptable for most text.

**Parse a native-text PDF with no OCR at all:**

```bash
curl -X POST "http://localhost:5000/parse?text=true" \
  -F "file=@textbook.pdf" \
  -F 'config={"ocrEnabled":false}'
```

Skips the OCR check entirely. Fastest path possible through the server.

**Parse only pages 5 through 20:**

```bash
curl -X POST http://localhost:5000/parse \
  -F "file=@big-report.pdf" \
  -F 'config={"targetPages":"5-20"}'
```

**Parse an image with high-quality OCR:**

```bash
curl -X POST http://localhost:5000/parse \
  -F "file=@scan.jpg" \
  -F 'config={"dpi":300,"preserveVerySmallText":true}'
```

Higher DPI catches small text. The `preserveVerySmallText` flag keeps footnotes and fine print.

---

## Three Ways To Use It

### curl (The API)

Works from any language, any tool, any script. Send an HTTP request, get text back. No installation needed beyond Docker running the server.

```bash
curl -X POST "http://localhost:5000/parse?text=true" \
  -F "file=@document.pdf"
```

This is the most universal way. Python scripts, Node apps, shell scripts, cron jobs, all speak HTTP.

### lp (The Shell Wrapper)

A bash script shipped in this repo at `bin/lp`. It wraps curl with friendlier flags and handles screenshots and batch mode for you.

Install it:

```bash
ln -sf "$(pwd)/bin/lp" ~/.local/bin/lp
```

Now:

```bash
lp doc.pdf                              # plain text
lp -j doc.pdf                           # JSON
lp -l zh scanned.pdf                    # Chinese OCR
lp -s "1-5,10" doc.pdf                  # specific pages
lp -d 200 doc.pdf                       # higher DPI
lp --screenshots ./out doc.pdf          # save page images
lp --batch ./in ./out                   # parse a whole directory
lp --batch ./in ./out --recursive       # include subdirectories
lp --batch ./in ./out --ext .pdf        # only PDFs
lp -h                                   # full help
```

The server must be running for `lp` to work (it calls `localhost:5000`).

### lit (The Rust CLI)

This doesn't go through the server at all. It's the upstream LiteParse binary, installed separately:

```bash
cargo install liteparse
```

The installed binary is called `lit` (the crate name is `liteparse`, but the authors made the binary shorter).

```bash
lit --version    # 2.0.2
lit parse document.pdf
lit parse document.pdf --ocr-server-url http://localhost:8829/ocr
```

The CLI is faster for one-off parsing. No Docker, no HTTP overhead. The tradeoff: you don't get PaddleOCR by default (the CLI uses Tesseract unless you point it at an OCR server).

**Which one should you use?** Use `lit` when you're at a terminal and just want the text from a file. Use `lp` (or curl) when you're writing a script or you want the server's full OCR pipeline. They do the same job, just through different doors.

---

## Speed: Server vs CLI

Tested on a 260KB single-page PDF. Both already warm (no cold start penalty).

| Method | Time | Why |
|--------|------|-----|
| `lit parse file.pdf` | 13ms | Binary reads file, parses, prints, exits |
| `curl :5000/parse` | 20ms | HTTP roundtrip + multipart upload + parse + response |

The 7ms gap is the HTTP plumbing: network call, form data parsing, writing a temp file, serialising JSON. For a small file, that's noticeable. For a 5MB PDF, both methods take hundreds of milliseconds and the overhead disappears into the parsing time.

**Use the CLI** for quick one-off parsing. No Docker needed.

**Use the server** when you want OCR without fiddling with Tesseract config, or when you're building scripts and tools that depend on a stable HTTP endpoint.

---

## Making It Auto-Start On Boot

### systemd (Recommended)

Docker containers die when your machine restarts. A systemd user unit brings them back.

Create a service file:

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
```

`%h` is systemd shorthand for your home directory. Change the path if you cloned the repo somewhere else.

Turn it on:

```bash
loginctl enable-linger $USER
systemctl --user daemon-reload
systemctl --user enable --now liteparse-paddle.service
```

What these do:

- `enable-linger` lets your user services stay alive even when you're not logged in.
- `daemon-reload` tells systemd to read the new service file.
- `enable --now` turns the service on and starts it immediately.

Verify:

```bash
systemctl --user status liteparse-paddle.service
```

Now it starts on every boot. To stop: `systemctl --user stop liteparse-paddle.service`.

### Portless (Nicer URL)

If you have [portless](https://github.com/WhiteHades/portless), give the server a named URL:

```bash
portless alias liteparse-paddle 5000
```

Now reach it at `https://liteparse-paddle.localhost` instead of `http://localhost:5000`. Nicer for tools and browsers.

---

## GPU Acceleration

CPU-only by default. That works fine for most documents. PaddleOCR on CPU handles a page in about 1-3 seconds.

On GPU it's faster (about 200-500ms per page). To switch:

1. Open `python/Dockerfile`. Change the pip install line to pull from the CUDA index instead of CPU.
2. Open `compose.yaml`. Uncomment the `deploy` block under the `paddle-ocr` service. This gives the container access to your GPU.
3. Rebuild: `docker compose build paddle-ocr && docker compose up -d`

You also need the [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html) installed on your host machine. Without it, Docker can't pass the GPU through to containers.

---

## How To Update

### This server

```bash
cd /path/to/liteparse-paddle
git pull
docker compose build --no-cache
docker compose up -d
```

The `--no-cache` flag makes Docker rebuild from scratch. Without it, Docker reuses old build steps and your update might not actually take effect.

### The upstream parser

The LiteParse library this repo depends on is maintained separately. If a new version comes out with improvements:

1. Update `Cargo.toml` to point at the newer version
2. Rebuild: `docker compose build --no-cache`
3. Test: `curl :5000/health && lp document.pdf`

The upstream source is at [github.com/run-llama/liteparse](https://github.com/run-llama/liteparse). This server currently pins against the `crust-v2.0.2` release.

### The PaddleOCR server

The `python/server.py` file is from the upstream LiteParse repo's PaddleOCR example. It rarely changes. If you want to update it:

1. Pull the latest from `github.com/run-llama/liteparse/blob/main/ocr/paddleocr/server.py`
2. Copy it over `python/server.py`
3. Rebuild the OCR container: `docker compose build paddle-ocr && docker compose up -d`

---

## Troubleshooting

### Server won't start

```bash
docker compose logs liteparse-server
```

If you see `glibc` errors, the binary was compiled on a newer system than the Debian base image. Rebuild with `docker compose build --no-cache`. This compiles the Rust binary inside Docker where it matches the runtime environment.

### "Parse error: unsupported file format"

The file extension matters. If you renamed a PDF to `.bin` or used a generic temporary filename, the server doesn't know what kind of file it is. Send files with their actual extension. 

The `lp` script handles this for you. If you're using curl directly, make sure the file path ends in a recognised extension from the [Supported File Types](#supported-file-types) table.

### "No 'file' field provided"

You're missing the `file=@` part of the curl command. The correct syntax:

```bash
curl -F "file=@/absolute/path/to/your.pdf"
```

Note the `@` symbol. It tells curl to read the file from disk and attach it to the request.

### OCR isn't running on a page that seems to need it

LiteParse skips OCR on pages that have more than about 100 characters of native text. This is usually what you want (native text is more accurate than OCR). But if a page has an embedded chart with labels that you need OCR'd, and the page otherwise has lots of native text, that chart won't get OCR'd.

Workaround: convert the page to an image first, then send that image. An image always triggers OCR since it has no native text.

### Image parsing fails with "not allowed by the security policy"

This means ImageMagick's PDF policy is blocking image-to-PDF conversion. The Docker image fixes this in its build. If it's happening to you, check that you're running the container from this repo's Dockerfile (not a custom one that omits the policy fix).

### Server returns empty or garbled text

A few things to check:

- Make sure PaddleOCR is healthy: `docker compose ps | grep paddle-ocr` should show "healthy"
- Check that you're sending a file type the server understands (PDF, DOCX, image, etc.)
- If the document is a scan, set a higher DPI: `'config={"dpi":300}'`
- For non-English text, set the language: `'config={"ocrLanguage":"zh"}'`

---

## Future: VLM and Markdown

The current OCR model (PP-OCRv5) outputs text with bounding boxes. That's what LiteParse expects. It works well for extracting raw text.

PaddleOCR also ships a newer model, PaddleOCR-VL, that outputs structured markdown: tables as actual tables, formulas as LaTeX, headings with hierarchies. It's slower (it's a 0.9 billion parameter visual language model) and needs more RAM, but the output is richer.

If you want that one day:

- Keep the current `paddle-ocr` container running for fast text extraction
- Add a second OCR container running PaddleOCR-VL
- Expose a new route (something like `/parse-md`) that returns markdown
- Leave `/parse` alone so nothing breaks

The architecture supports this. The parser server just calls whatever OCR endpoint you point it at. Adding a second OCR backend doesn't touch the existing one.

---

## License

Apache-2.0

---

## Credits

- [LiteParse](https://github.com/run-llama/liteparse) by LlamaIndex: the Rust document parser
- [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) by Baidu: the OCR engine
