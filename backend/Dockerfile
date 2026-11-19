# syntax=docker/dockerfile:1
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
# libcairo2: cairosvg renders the QR SVG to PNG/PDF (LGPL, dynamically linked).
RUN apt-get update && apt-get install -y --no-install-recommends libcairo2 \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.lock .
# Optional build secret `proxy_ca` (same pattern as Vorya Sign) for builds behind a TLS proxy.
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export PIP_CERT=/run/secrets/proxy_ca; fi; \
    pip install --no-cache-dir -r requirements.lock
RUN useradd --create-home --uid 10001 app \
    && mkdir -p /data/uploads /data/geoip && chown -R app:app /data
COPY --chown=app:app alembic.ini ./alembic.ini
COPY --chown=app:app migrations ./migrations
COPY --chown=app:app app ./app
USER app
EXPOSE 8000
# /data/uploads (files) and /data/geoip (DB-IP mmdb) are Docker volumes in production.
# Migrations are NOT run here: the compose `migrate` service runs `python -m app.migrate` once.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-server-header"]
