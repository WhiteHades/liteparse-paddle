FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0t64 \
    && rm -rf /var/lib/apt/lists/*

RUN pip install uv

COPY pyproject.toml ./

RUN UV_SYSTEM_PYTHON=1 uv sync --no-dev

COPY server.py .
COPY test_server.py .

EXPOSE 8829

CMD ["python", "server.py"]
