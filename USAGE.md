# PaperChampion Usage

This guide records the current local development workflow for a fresh checkout.

## Environment

- Work from the repository root after cloning `https://github.com/ChampionZhong/PaperChampion`.
- Use a Python 3.11+ virtual environment for backend commands.
- Keep secrets in `.env`; never commit `.env`, local databases, logs, PDFs, screenshots, or private research data.
- If arXiv or external APIs need a proxy, export proxy variables before starting backend or worker processes.
- On older Linux hosts with an incompatible system GLIBC, use `scripts/run_with_glibc.sh` for frontend `node` and `npm` commands.
  Set `PAPERCHAMPION_GLIBC_BUILD`, and optionally `PAPERCHAMPION_GCC_LIB` or `PAPERCHAMPION_NODE_BIN`, before using the wrapper.

## Backend

```bash
git clone https://github.com/ChampionZhong/PaperChampion.git
cd PaperChampion
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev,llm,pdf]"
cp .env.example .env
python scripts/local_bootstrap.py
uvicorn apps.api.main:app --reload --host 0.0.0.0 --port 8000
```

Backend health:

```bash
curl http://127.0.0.1:8000/health
```

API docs:

```text
http://127.0.0.1:8000/docs
```

## Frontend

Start the frontend on the default Vite port:

```bash
cd PaperChampion
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5174
```

Open:

```text
http://localhost:5174
```

If the browser runs on a different machine than the backend, set an explicit API base:

```bash
cd PaperChampion/frontend
VITE_API_BASE=http://<server-host>:8000 npm run dev -- --host 0.0.0.0 --port 5174
```

## Authentication

Authentication is disabled when `AUTH_PASSWORD` is empty.

When `AUTH_PASSWORD` is set, login with:

```bash
curl -s -X POST http://127.0.0.1:8000/auth/login \
	-H 'Content-Type: application/json' \
	-d '{"password":"<AUTH_PASSWORD>"}'
```

Use the returned bearer token for protected endpoints.

## Checks

Backend:

```bash
cd PaperChampion
source .venv/bin/activate
python -m ruff check .
python -m pytest tests -q
```

Frontend:

```bash
cd PaperChampion/frontend
npx tsc --noEmit
npm run build
```

Older Linux hosts that need the GLIBC wrapper can run:

```bash
export PAPERCHAMPION_GLIBC_BUILD=/opt/glibc-2.35/build
export PAPERCHAMPION_GCC_LIB=/opt/gcc/lib64
cd PaperChampion
./scripts/run_with_glibc.sh bash -c "cd frontend && npm run build"
```

Docker configuration:

```bash
docker compose config
```

## Stop Services

Stop local dev servers with `Ctrl-c`.

Check listening ports:

```bash
lsof -iTCP:8000 -sTCP:LISTEN -P -n
lsof -iTCP:5174 -sTCP:LISTEN -P -n
```

## Runtime Data

Runtime files are intentionally ignored by Git:

- `data/paperchampion.db`
- `data/papers/`
- `data/figures/`
- `data/briefs/`
- `logs/`
- `scripts/screenshots/`

Keep backups outside the repository or under ignored runtime directories.

## ArXiv Rate Limits

PaperChampion reads proxy environment variables through `httpx`. A backend log message such as `ArXiv rate limit; retrying in 30s` means arXiv returned HTTP `429`. Avoid launching many manual fetches back-to-back.
