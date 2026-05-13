FROM oven/bun:latest AS base
WORKDIR /app

FROM base AS deps
COPY package*.json ./
COPY slim-bunfig.toml ./bunfig.toml
RUN bun install

FROM base AS runtime
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN apt-get update && apt-get install -y --no-install-recommends \
    libvips42 \
    ca-certificates \
    libreoffice \
    imagemagick \
    && rm -rf /var/lib/apt/lists/*

EXPOSE 5000

ENV PADDLE_OCR_URL=http://paddle-ocr:8829/ocr

CMD ["bun", "run", "start-slim:bun"]
