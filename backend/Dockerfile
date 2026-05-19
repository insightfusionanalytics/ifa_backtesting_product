# ── Stage 1: build deps ────────────────────────────────────────
FROM python:3.12-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY backend/pyproject.toml ./
RUN pip install --upgrade pip && pip install \
    "fastapi>=0.115" "uvicorn[standard]>=0.30" "sqlalchemy>=2.0" "alembic>=1.13" \
    "psycopg2-binary>=2.9" "pydantic>=2.7" "pydantic-settings>=2.4" "python-dotenv>=1.0" \
    "firebase-admin>=6.5" "supabase>=2.7" "loguru>=0.7" "python-multipart>=0.0.9" \
    "httpx>=0.27" "jsonschema>=4.23" "pydantic[email]"

# ── Stage 2: runtime ──────────────────────────────────────────
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_HOME=/app

WORKDIR $APP_HOME

RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --shell /bin/bash app

COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# App code + Alembic migrations + locked schemas
COPY backend/app ./app
COPY backend/alembic ./alembic
COPY backend/alembic.ini ./
COPY schemas ./schemas

RUN chown -R app:app $APP_HOME
USER app

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
    CMD curl -fsS http://localhost:8000/healthz || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
