FROM rust:1-slim-bookworm AS builder

ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    cmake \
    libclang-dev \
    libssl-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY Cargo.toml Cargo.lock ./
COPY src ./src

RUN cargo build --release --no-default-features
RUN find /root/.cache/pdfium-rs -name "libpdfium.so" -exec cp {} /app/libpdfium.so \;

FROM debian:bookworm-slim

ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    ca-certificates \
    imagemagick \
    libgcc-s1 \
    libreoffice \
    libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

RUN sed -i 's/<policy domain="coder" rights="none" pattern="PDF"\s*\/>/<policy domain="coder" rights="read|write" pattern="PDF"\/>/' /etc/ImageMagick-6/policy.xml

COPY --from=builder /app/target/release/liteparse-server /usr/local/bin/
COPY --from=builder /app/libpdfium.so /usr/lib/libpdfium.so

RUN ldconfig

EXPOSE 5000

CMD ["liteparse-server"]
