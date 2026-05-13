# liteparse-paddle

Document parsing API server powered by [LiteParse](https://github.com/run-llama/liteparse) with [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) as the default GPU-accelerated OCR backend.

Supports PDF, DOCX, XLSX, PPTX, and images. Built with Express, TypeScript, and Docker Compose. Includes Redis caching, rate limiting, OpenTelemetry tracing, Prometheus metrics, and Grafana dashboards.

## Architecture

```
┌──────────────────────┐     ┌──────────────────────┐
│   liteparse-server    │────►│   paddle-ocr          │
│   (Express + Bun)     │     │   (FastAPI + Python)  │
│   Port 5000           │     │   Port 8829           │
│                       │     │   GPU-accelerated     │
│   OCR via             │     └──────────────────────┘
│   ocrServerUrl ───────┘
│
│   redis ─── caching + rate limiting
│   otel-collector ─── traces
│   jaeger ─── trace visualization
│   prometheus ─── metrics
│   grafana ─── dashboards
└──────────────────────┘
```

PaddleOCR is the **default** OCR backend. No configuration needed — the server auto-wires `ocrServerUrl` to the PaddleOCR container. You can override it per-request by sending a `config` field with your own `ocrServerUrl`.

## Quick start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)
- [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html) (for GPU acceleration, optional but recommended)

### Start the server

```bash
cp .env.example .env
docker compose up -d
```

The API is available at `http://localhost:5000`.

> First startup is slow (2-3 minutes) — PaddleOCR downloads model files on the first request. Subsequent startups are fast.

### GPU support

The compose file enables GPU acceleration with NVIDIA by default. If you don't have an NVIDIA GPU or the container toolkit, remove the `deploy.resources` block from the `paddle-ocr` service in `compose.yaml`.

## API

### POST /parse — parse a document

```bash
curl -X POST http://localhost:5000/parse \
  -F "file=@document.pdf"
```

Returns JSON with parsed pages. Add `?text=true` for plain text:

```bash
curl -X POST "http://localhost:5000/parse?text=true" \
  -F "file=@document.pdf"
```

Pass config options:

```bash
curl -X POST http://localhost:5000/parse \
  -F "file=@scanned.pdf" \
  -F 'config={"ocrLanguage":"zh"}'
```

### POST /screenshots — render pages as images

```bash
curl -X POST "http://localhost:5000/screenshots?pages=1,2,3" \
  -F "file=@document.pdf"
```

Returns NDJSON with base64-encoded PNGs.

## Portless local dev

If you have [portless](https://github.com/WhiteHades/portless) installed, run the server through it for a named URL:

```bash
# Start the Docker services
docker compose up -d

# Register the route with portless
portless alias liteparse-paddle 5000
```

The API is then available at `https://liteparse-paddle.localhost`.

## Auto-start on boot (systemd)

To start the server automatically when your machine boots, create a systemd user service:

```bash
# Create the service file
mkdir -p ~/.config/systemd/user
cat > ~/.config/systemd/user/liteparse-paddle.service << 'EOF'
[Unit]
Description=LiteParse PaddleOCR document parsing server
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/YOUR_USER/Codes/liteparse-paddle
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
StandardOutput=journal

[Install]
WantedBy=default.target
EOF

# Enable and start
systemctl --user enable liteparse-paddle.service
systemctl --user start liteparse-paddle.service
systemctl --user status liteparse-paddle.service
```

Replace `YOUR_USER` and the working directory path with your actual values.

To keep the service running after logout, enable lingering:

```bash
loginctl enable-linger YOUR_USER
```

## Observability

| Service | URL | Purpose |
|---------|-----|---------|
| liteparse-server | http://localhost:5000 | API |
| Jaeger | http://localhost:16686 | Trace visualization |
| Prometheus | http://localhost:9090 | Metrics |
| Grafana | http://localhost:3000 | Dashboards (admin/admin) |

## Updating from upstream

This repo vendors source from three upstream projects. Here's how to update each:

### liteparse-server

```bash
# The only patch point is server/src/utils.ts — the ocrServerUrl default
# 1. Copy new upstream files
cp -r ../liteparse-server/src/* server/src/
cp ../liteparse-server/package.json server/
# 2. Re-apply the patch (server/src/utils.ts: inject ocrServerUrl default)
#    See the git diff for the exact change
```

### PaddleOCR server wrapper

```bash
cp ../liteparse/ocr/paddleocr/server.py python/
```

## Supported formats

| Category | Formats |
|----------|---------|
| PDF | `.pdf` |
| Word | `.doc`, `.docx`, `.docm`, `.odt`, `.rtf` |
| PowerPoint | `.ppt`, `.pptx`, `.pptm`, `.odp` |
| Spreadsheets | `.xls`, `.xlsx`, `.xlsm`, `.ods`, `.csv`, `.tsv` |
| Images | `.jpg`, `.jpeg`, `.png`, `.gif`, `.bmp`, `.tiff`, `.webp`, `.svg` |

## License

Apache-2.0

## Credits

- [LiteParse](https://github.com/run-llama/liteparse) by LlamaIndex — document parsing engine
- [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) by Baidu — OCR engine
- [liteparse-server](https://github.com/run-llama/liteparse-server) by LlamaIndex — Express server wrapper
