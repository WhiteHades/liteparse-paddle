FROM python:3.12-slim

ARG PADDLE_INDEX=https://www.paddlepaddle.org.cn/packages/stable/cpu/
ENV PADDLE_OCR_TIER=medium

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0t64 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./

RUN pip install --no-cache-dir \
    --extra-index-url ${PADDLE_INDEX} \
    paddlepaddle==3.2.2 \
    paddleocr==3.7.0 \
    fastapi>=0.131.0 \
    uvicorn>=0.41.0 \
    python-multipart>=0.0.22 \
    numpy>=2.4.2 \
    pillow>=12.1.1

RUN pip install --no-cache-dir pytest httpx

# Pre-bake the PaddleOCR V6 medium English model into the image so the first
# /ocr call has zero cold-start penalty and the container works offline.
# Model files land in /root/.paddleocr and are persisted on the host via the
# paddle-ocr-models named volume in compose.yaml.
RUN python -c "from paddleocr import PaddleOCR; PaddleOCR(lang='en', text_detection_model_name='PP-OCRv6_${PADDLE_OCR_TIER}_det', text_recognition_model_name='PP-OCRv6_${PADDLE_OCR_TIER}_rec', use_textline_orientation=True)"

COPY server.py .
COPY test_server.py .

EXPOSE 8829

CMD ["python", "server.py"]
