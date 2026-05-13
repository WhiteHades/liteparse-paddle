FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0t64 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./

RUN pip install --no-cache-dir \
    --extra-index-url https://www.paddlepaddle.org.cn/packages/stable/cpu/ \
    paddlepaddle==3.2.2 \
    paddleocr>=3.4.0 \
    fastapi>=0.131.0 \
    uvicorn>=0.41.0 \
    python-multipart>=0.0.22 \
    numpy>=2.4.2 \
    pillow>=12.1.1

RUN pip install --no-cache-dir pytest httpx

COPY server.py .
COPY test_server.py .

EXPOSE 8829

CMD ["python", "server.py"]
