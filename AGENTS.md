# Repository Guidelines

## Project Structure & Module Organization
PaperChampion combines a FastAPI backend with a Vite React frontend.

- `apps/api/`: API app, dependencies, and routers.
- `apps/worker/`, `apps/desktop/`: worker and desktop server entry points.
- `packages/`: shared backend code. `ai/` holds AI workflows, `domain/` schemas/enums, `integrations/` API clients, and `storage/` models/repositories.
- `frontend/src/`: React code split into `pages/`, `components/`, `contexts/`, `hooks/`, `services/`, `types/`, and `lib/`.
- `infra/migrations/`: Alembic migration environment and versions.
- `scripts/`: bootstrap, deployment, GLIBC, and Playwright E2E utilities.
- `data/`, `logs/`, `.env`, screenshots, and local databases are runtime-only.

## Build, Test, and Development Commands

- `python -m venv .venv && source .venv/bin/activate`: create a backend environment.
- `pip install -e ".[dev,llm,pdf]"`: install backend and optional dev/AI/PDF dependencies.
- `cp .env.example .env && python scripts/local_bootstrap.py`: initialize local configuration and data.
- `uvicorn apps.api.main:app --reload --port 8000`: run the backend API locally.
- `cd frontend && npm install && npm run dev`: start the Vite frontend.
- `cd frontend && npm run build`: build frontend assets.
- `python -m ruff check .`: lint Python code.
- `cd frontend && npx tsc --noEmit`: type-check TypeScript.
- `docker compose up -d --build`: run the Docker stack.

## Coding Style & Naming Conventions
Write code, comments, log text, and developer-facing output in English. Follow Google-style clarity: small functions, explicit names, and comments only where behavior is not obvious. Use tab indentation configured to display as 4 spaces. Python modules/functions use `snake_case`; classes use `PascalCase`. React components/pages use `PascalCase.tsx`; hooks use `useX.ts`; utilities should match nearby naming.

## Testing Guidelines
Backend tests should use `pytest`; add tests under `tests/` with names like `test_paper_repository.py`. Frontend checks live in Playwright scripts under `scripts/`; run them after starting the frontend, for example `node scripts/e2e-test.mjs` or `npx playwright test scripts/test-phase5-e2e.ts`. For routes, storage, or AI workflows, include unit tests or an E2E note.

## Commit & Pull Request Guidelines
This checkout does not include Git history, so use concise imperative commits such as `Add paper search filters` or `Fix graph topic loading`. Keep commits scoped to one behavior. Pull requests should include a summary, affected areas, required environment variables or migrations, test commands run, linked issues, and screenshots for UI changes.

## Security & Configuration Tips
Never commit `.env`, API keys, local SQLite files, generated screenshots, or private paper data. Add new settings to `.env.example` with safe placeholders. Keep authentication changes aligned with `packages/auth.py` and `apps/api/routers/auth.py`.
