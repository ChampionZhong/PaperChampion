# PaperChampion Docker Deployment

This document describes the current Docker workflow for the PaperChampion maintenance repository.

## Ports

| Service | Container Port | Host Port | Purpose |
|---|---:|---:|---|
| frontend | 80 | 3003 | Nginx static frontend |
| backend | 8000 | 8003 | FastAPI API |
| worker | none | none | scheduled background jobs |

## Prepare Configuration

Create `.env` from the committed template:

```bash
cp .env.example .env
```

Set at least one LLM API key:

```env
LLM_PROVIDER=zhipu
ZHIPU_API_KEY=your_api_key_here
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
```

Optional email settings:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_email@example.com
SMTP_PASSWORD=your_smtp_password
SMTP_FROM=your_email@example.com
NOTIFY_DEFAULT_TO=receiver@example.com
```

Optional site authentication:

```env
AUTH_PASSWORD=your_site_password
AUTH_SECRET_KEY=replace_with_a_strong_random_value
```

## Start

```bash
docker compose up -d --build
```

Or use the helper script:

```bash
chmod +x scripts/docker_deploy.sh
./scripts/docker_deploy.sh
```

Open:

- Frontend: `http://localhost:3003`
- Backend API: `http://localhost:8003`
- API docs: `http://localhost:8003/docs`

## Operate

View service status:

```bash
docker compose ps
```

Follow logs:

```bash
docker compose logs -f
```

Restart one service:

```bash
docker compose restart backend
docker compose restart worker
docker compose restart frontend
```

Stop the stack:

```bash
docker compose down
```

Remove containers and named volumes:

```bash
docker compose down -v
```

Only run the volume-removal command when the persisted PaperChampion database and files are no longer needed.

## Health Checks

Backend:

```bash
curl http://localhost:8003/health
```

Frontend:

```bash
curl -I http://localhost:3003
```

Docker configuration:

```bash
docker compose config
```

## Persistent Data

The Docker stack uses named volumes:

- `paperchampion_data`: SQLite database, PDFs, generated figures, and briefs.
- `paperchampion_logs`: backend and worker logs.
- `paperchampion_pip_cache`: pip cache for faster rebuilds.

These volumes are not part of the Git repository.

## Port Changes

If `3003` or `8003` is already in use, edit the host-side port in `docker-compose.yml`:

```yaml
ports:
  - "3004:80"
```

```yaml
ports:
  - "8004:8000"
```

If the frontend origin changes, update `CORS_ALLOW_ORIGINS` in `docker-compose.yml` or `.env`.

## Security Notes

- Never commit `.env`.
- Rotate API keys if `.env` or runtime logs were exposed.
- Set `AUTH_PASSWORD` and a strong `AUTH_SECRET_KEY` for shared deployments.
- Keep Docker volumes and external backups protected because they may contain private paper data and generated analysis.
