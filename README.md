<p align="center">
  <img src="media/logo.svg" width="400" alt="liteparse-paddle"/>
</p>

<p align="center">
  <em>Document parsing server powered by LiteParse with PaddleOCR as the default GPU-accelerated OCR backend.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/liteparse-core-2563eb?style=flat-square&logo=readthedocs&logoColor=white"/>
  <img src="https://img.shields.io/badge/paddleocr-v3.5-f97316?style=flat-square&logo=python&logoColor=white"/>
  <img src="https://img.shields.io/badge/document--parsing-structured-22c55e?style=flat-square"/>
  <img src="https://img.shields.io/badge/OCR-109%20languages-8b5cf6?style=flat-square"/>
  <img src="https://img.shields.io/badge/gpu-CUDA%20ready-06b6d4?style=flat-square"/>
  <br/>
  <img src="https://img.shields.io/badge/express-v5-000000?style=flat-square&logo=express"/>
  <img src="https://img.shields.io/badge/typescript-5-3178C6?style=flat-square&logo=typescript&logoColor=white"/>
  <img src="https://img.shields.io/badge/docker-compose-2496ED?style=flat-square&logo=docker&logoColor=white"/>
  <img src="https://img.shields.io/badge/redis-caching-DC382D?style=flat-square&logo=redis&logoColor=white"/>
  <img src="https://img.shields.io/badge/grafana-dashboards-F46800?style=flat-square&logo=grafana&logoColor=white"/>
  <img src="https://img.shields.io/badge/license-Apache--2.0-3b82f6?style=flat-square"/>
</p>

<p align="center">
  <a href="#quick-start"><b>Quick Start</b></a> •
  <a href="#api"><b>API</b></a> •
  <a href="#observability"><b>Observability</b></a> •
  <a href="#after-reboot"><b>After Reboot</b></a> •
  <a href="#updating-from-upstream"><b>Updating</b></a>
</p>

<pre align="center">
    _ _ _                                                __    ____
   | (_) |____  ____  ____ ______________        ____  ____ _____/ /___/ / /__
  | | | __/ _ \/ __ \/ __ `/ ___/ ___/ _ \______/ __ \/ __ `/ __  / __  / / _ \
 | | | /_/  __/ /_/ / /_/ / /  (__  )  __/_____/ /_/ / /_/ / /_/ / /_/ / /  __/
/_/_/\__/\___/ .___/\__,_/_/  /____/\___/     / .___/\__,_/\__,_/\__,_/_/\___/
            /_/                              /_/
</pre>

<p align="center">
  <b>PDF</b> &nbsp;•&nbsp; <b>DOCX</b> &nbsp;•&nbsp; <b>XLSX</b> &nbsp;•&nbsp; <b>PPTX</b> &nbsp;•&nbsp; <b>Images</b>
</p>

---

## Quick Start

```bash
git clone https://github.com/WhiteHades/liteparse-paddle
cd liteparse-paddle

# Configure (edit REDIS_PASSWORD in .env)
cp .env.example .env

# Start all services
docker compose up -d

# Parse a document
curl -X POST http://localhost:5000/parse -F "file=@document.pdf"
```

**First startup is slow** (2-3 minutes) — PaddleOCR downloads language models on the first request. Subsequent startups are instant.

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)
- [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html) — optional, for GPU acceleration

---

## After Reboot

When your computer restarts, the stack **does not auto-start** by default. Docker containers don't survive reboots on their own. You have two options:

### Option A: One command (fastest)

```bash
cd ~/Codes/liteparse-paddle && docker compose up -d
```

### Option B: Systemd (auto-starts on every boot)

I've already wired this for you:

```bash
# Verify it's enabled
systemctl --user is-enabled liteparse-paddle.service

# Start now
systemctl --user start liteparse-paddle.service

# Check status
systemctl --user status liteparse-paddle.service
```

To set this up on a new machine:

```bash
# 1. Create the service file
mkdir -p ~/.config/systemd/user
cat > ~/.config/systemd/user/liteparse-paddle.service << 'SERVICE'
[Unit]
Description=LiteParse PaddleOCR document parsing server

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=%h/Codes/liteparse-paddle
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
StandardOutput=journal

[Install]
WantedBy=default.target
SERVICE

# 2. Enable lingering (keeps user services alive after logout)
loginctl enable-linger $USER

# 3. Enable and start
systemctl --user daemon-reload
systemctl --user enable --now liteparse-paddle.service
```

The systemd service is a `Type=oneshot` unit — it runs `docker compose up -d` on boot, exits immediately, and Docker keeps the containers alive. On shutdown, `ExecStop` runs `docker compose down`.

---

## API

### POST /parse — extract text

```bash
# JSON output (default)
curl -X POST http://localhost:5000/parse \
  -F "file=@document.pdf"

# Plain text output
curl -X POST "http://localhost:5000/parse?text=true" \
  -F "file=@screenshot.png"

# With OCR language override
curl -X POST http://localhost:5000/parse \
  -F "file=@chinese-doc.pdf" \
  -F 'config={"ocrLanguage":"zh"}'

# Disable OCR (for native-text PDFs)
curl -X POST http://localhost:5000/parse \
  -F "file=@text-doc.pdf" \
  -F 'config={"ocrEnabled":false}'
```

PaddleOCR is the **default OCR engine** — you don't need to specify `--ocr-server-url`. If you want to use a different backend, override in the config:

```bash
curl -X POST http://localhost:5000/parse \
  -F "file=@doc.pdf" \
  -F 'config={"ocrServerUrl":"http://localhost:8828/ocr"}'
```

### POST /screenshots — render pages as images

```bash
curl -X POST "http://localhost:5000/screenshots?pages=1,2,3" \
  -F "file=@document.pdf"
```

Returns NDJSON with base64-encoded PNGs.

---

## PaddleOCR as a system-wide OCR service

The PaddleOCR server runs on port `8829`. Any tool on your machine can use it:

```bash
# From a shell script, cron job, or another app
curl -X POST http://localhost:8829/ocr \
  -F "file=@screenshot.png" \
  -F "language=en" | jq '.results[].text'
```

This is useful for:
- **Desktop automation** — OCR a screen region and extract text
- **Batch processing** — cron job that OCRs incoming scanned PDFs
- **Other web apps** — any server on your machine can POST images to `:8829`

---

## CLI Usage (lit)

The standard `lit` CLI (`@llamaindex/liteparse`) defaults to Tesseract.js when run directly on the host. To use it with the Docker PaddleOCR:

```bash
lit parse document.pdf --ocr-server-url http://localhost:8829/ocr
```

Or set it as default for your shell session:

```bash
export LIT_OCR_SERVER_URL=http://localhost:8829/ocr
lit parse document.pdf  # uses PaddleOCR automatically
```

---

## Portless local dev

With [portless](https://github.com/WhiteHades/portless) installed:

```bash
portless alias liteparse-paddle 5000
```

The API is then available at `https://liteparse-paddle.localhost`.

---

## Observability

| Service | URL | Purpose |
|---------|-----|---------|
| liteparse-paddle | `http://localhost:5000` | Document parsing API |
| PaddleOCR | `http://localhost:8829` | Raw OCR endpoint |
| Redis | `localhost:6379` | Cache + rate limiting |
| Jaeger | `http://localhost:16686` | Trace distributed requests |
| Prometheus | `http://localhost:9090` | Metrics |
| Grafana | `http://localhost:3000` | Dashboards (login: `admin` / see `.env`) |

---

## Supported formats

| Category | Formats |
|----------|---------|
| PDF | `.pdf` |
| Word | `.doc`, `.docx`, `.docm`, `.odt`, `.rtf` |
| PowerPoint | `.ppt`, `.pptx`, `.pptm`, `.odp` |
| Spreadsheets | `.xls`, `.xlsx`, `.xlsm`, `.ods`, `.csv`, `.tsv` |
| Images | `.jpg`, `.jpeg`, `.png`, `.gif`, `.bmp`, `.tiff`, `.webp`, `.svg` |

Office documents require LibreOffice, images require ImageMagick — both are installed inside the server container.

---

## GPU acceleration

The compose file defaults to CPU-only PaddleOCR for portability. To enable GPU:

**1.** Edit `python/Dockerfile` — change the pip index to CUDA:
```dockerfile
RUN pip install --no-cache-dir \
    --extra-index-url https://www.paddlepaddle.org.cn/packages/stable/cuda12/ \
    paddlepaddle>=3.3.0 \
    ...
```

**2.** Uncomment the `deploy` block in `compose.yaml` under the `paddle-ocr` service.

**3.** Rebuild and restart:
```bash
docker compose build paddle-ocr
docker compose up -d
```

---

## Updating from upstream

This repo vendors source from three upstream projects. Patch points are minimal:

### liteparse-server

```bash
# The only changed file is server/src/utils.ts (ocrServerUrl default)
# 1. Copy new upstream files
cp -r ../liteparse-server/src/* server/src/
cp ../liteparse-server/package.json server/
# 2. Re-apply the ocrServerUrl injection in server/src/utils.ts
```

### PaddleOCR server wrapper

```bash
cp ../liteparse/ocr/paddleocr/server.py python/
```

---

## License

Apache-2.0

## Credits

- [LiteParse](https://github.com/run-llama/liteparse) by LlamaIndex — document parsing engine
- [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) by Baidu — OCR engine (v3.5.0, PP-OCRv5)
- [liteparse-server](https://github.com/run-llama/liteparse-server) by LlamaIndex — Express wrapper
