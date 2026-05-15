# ============================================================
# PaperChampion Docker - single-container deployment.
# ============================================================

FROM node:20-slim AS frontend
WORKDIR /build
COPY frontend/package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx supervisor curl sqlite3 && \
    rm -rf /var/lib/apt/lists/* && \
    rm -f /etc/nginx/sites-enabled/default

WORKDIR /app

COPY pyproject.toml ./
COPY packages/ packages/
COPY apps/ apps/
RUN pip install --no-cache-dir ".[llm,pdf]" && \
    pip install --no-cache-dir umap-learn

# Alembic 数据库迁移
COPY alembic.ini ./
COPY infra/migrations/ infra/migrations/

COPY --from=frontend /build/dist /app/frontend/dist

COPY infra/nginx.conf /etc/nginx/conf.d/paperchampion.conf
COPY infra/supervisord.conf /etc/supervisor/conf.d/paperchampion.conf

RUN mkdir -p /app/data/papers /app/data/briefs

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
	CMD curl -sf http://localhost:8000/health || exit 1

CMD ["supervisord", "-n", "-c", "/etc/supervisor/conf.d/paperchampion.conf"]
