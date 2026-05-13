FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./

RUN pip install --no-cache-dir -e ".[gpu]"

COPY server.py .
COPY test_server.py .

EXPOSE 8829

CMD ["python", "server.py"]
