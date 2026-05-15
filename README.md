# PaperChampion

PaperChampion is an AI-native research workflow platform for collecting papers, reading them with LLM assistance, building citation context, and generating research notes.

This repository is maintained as a refactoring version by ChampionZhong. Attribution and licensing notes are kept in [NOTICE.md](NOTICE.md) and [LICENSE](LICENSE).

Repository: `https://github.com/ChampionZhong/PaperChampion`

## Current Capabilities

- Paper collection from arXiv, OpenAlex, and Semantic Scholar metadata.
- Topic subscriptions with scheduled fetches and per-topic processing.
- Skim, deep-dive, embedding, RAG, and writing workflows backed by configurable LLM providers.
- Citation graph views, similarity maps, research-gap analysis, and topic or paper wiki generation.
- FastAPI backend, SQLite storage, APScheduler worker, and Vite React frontend.
- Optional site password authentication with JWT-protected APIs and protected PDF access.

## Repository Layout

```text
apps/
  api/          FastAPI app and routers
  worker/       scheduled worker entry point
  desktop/      desktop server entry point
packages/
  ai/           AI workflows and services
  domain/       schemas, enums, exceptions, shared domain helpers
  integrations/ external API and LLM clients
  storage/      SQLAlchemy models and repositories
frontend/src/   Vite React application
infra/          migrations and deployment support
scripts/        local setup, deployment, and QA helpers
tests/          backend test suite
docs/history/   archived historical notes from the earlier checkout
```

Runtime data, local databases, logs, screenshots, secrets, and local IDE files are intentionally ignored.

## Quick Start

Create the backend environment:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev,llm,pdf]"
```

Create local configuration:

```bash
cp .env.example .env
python scripts/local_bootstrap.py
```

Start the backend:

```bash
uvicorn apps.api.main:app --reload --host 0.0.0.0 --port 8000
```

Start the frontend:

```bash
cd frontend
npm install
npm run dev
```

Open the frontend at `http://localhost:5174`. The API documentation is available at `http://localhost:8000/docs`.

## Docker

For local Docker deployment:

```bash
cp .env.example .env
docker compose up -d --build
```

The default Docker ports are:

- Frontend: `http://localhost:3003`
- Backend API: `http://localhost:8003`
- API docs: `http://localhost:8003/docs`

See [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) for details.

## Configuration

Important environment variables are documented in `.env.example`.

At minimum, configure one LLM provider key before using AI workflows:

```env
LLM_PROVIDER=zhipu
ZHIPU_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
```

Optional authentication:

```env
AUTH_PASSWORD=
AUTH_SECRET_KEY=change-me-use-a-strong-random-value
```

Leave `AUTH_PASSWORD` empty for local unauthenticated development. Set it for shared or public deployments.

## Development Checks

Run backend lint and tests:

```bash
python -m ruff check .
python -m pytest tests -q
```

Run frontend checks:

```bash
cd frontend
npx tsc --noEmit
npm run build
```

Run Docker configuration validation:

```bash
docker compose config
```

## Documentation

- [USAGE.md](USAGE.md): local development workflow.
- [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md): Docker deployment workflow.
- [PaperChampion.md](PaperChampion.md): current product and architecture overview.
- [NOTICE.md](NOTICE.md): attribution and modification notice.
- `docs/history/`: archived documents from earlier project stages.

## License

PaperChampion is distributed under the MIT license. See [LICENSE](LICENSE).
