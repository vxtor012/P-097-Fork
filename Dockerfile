# ---- Stage 1: Build ----
FROM node:24-bookworm-slim AS zalo-builder
WORKDIR /zalo-bridge
COPY zalo-bridge/package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY zalo-bridge/src ./src

FROM python:3.11-slim-bookworm AS builder

WORKDIR /app

# Create virtual environment for clean dependency isolation
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ---- Stage 2: Production ----
FROM python:3.11-slim-bookworm

WORKDIR /app

# Unicode Vietnamese fonts used by ReportLab on Linux.
RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core libstdc++6 libatomic1 ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Security: Create and run as non-root user
RUN groupadd -r appuser && useradd -r -g appuser -d /home/appuser -m appuser

# Copy isolated virtual environment
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Deploy application code only. Private data is managed outside the image.
COPY --chown=appuser:appuser src/ ./src/
COPY --chown=appuser:appuser scripts/start_services.py ./scripts/start_services.py
COPY --from=zalo-builder /usr/local/bin/node /usr/local/bin/node
COPY --from=zalo-builder --chown=appuser:appuser /zalo-bridge ./zalo-bridge
RUN node --input-type=module -e "import {DatabaseSync} from 'node:sqlite'; new DatabaseSync(':memory:').close()"

RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:' + str(os.getenv('PORT') or os.getenv('APP_PORT') or 8000) + '/health')" || exit 1

CMD ["python", "scripts/start_services.py"]
