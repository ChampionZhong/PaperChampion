# PaperChampion Product Overview

PaperChampion is an AI-assisted research workflow system. It helps a researcher move from paper discovery to structured reading, citation context, and reusable research notes.

This document reflects the current maintained version. Historical planning notes are archived under `docs/history/`.

## Users

| User | Need |
|---|---|
| Field explorer | Build a map of important papers, themes, and citation context. |
| Active researcher | Track new papers in known topics and prioritize reading. |
| Paper reader | Ask questions over PDFs, figures, and related papers. |
| Writer | Translate, polish, summarize, and draft research-oriented text. |

## Core Modules

### Data Collection

- Search arXiv and import selected papers.
- Enrich metadata with OpenAlex and Semantic Scholar where available.
- Manage topic subscriptions with scheduled fetches.
- Track import actions for auditability.

### AI Reading

- Skim papers from title and abstract.
- Deep-read PDFs with text and vision workflows.
- Generate embeddings for similarity and RAG.
- Track LLM usage and cost through prompt traces.

### Knowledge And Graph

- Build paper-level and topic-level citation views.
- Identify bridges, frontiers, co-citation clusters, and research gaps.
- Generate topic wiki and paper wiki content.
- Persist generated content for later review.

### Agent And RAG

- Stream agent chat responses over SSE.
- Require user confirmation for write actions.
- Use hybrid retrieval for cross-paper question answering.
- Preserve conversation history.

### Frontend

- React/Vite single-page application.
- Main pages: Agent, Papers, Paper Detail, Collect, Graph Explorer, Wiki, Daily Brief, Writing, Dashboard, Settings, Operations.
- PDF reader with page navigation, zoom, selected-text AI actions, and protected PDF access.

## Architecture

```text
React + Vite frontend
        |
        | REST and SSE
        |
FastAPI backend
        |
        | SQLAlchemy repositories
        |
SQLite database and local file storage
        |
        | scheduled jobs
        |
APScheduler worker
```

External integrations:

- arXiv API
- OpenAlex API
- Semantic Scholar API
- OpenAI-compatible, Anthropic, and ZhipuAI LLM providers
- SMTP email provider for optional notifications

## Runtime Data

Runtime data is not committed:

- SQLite database files under `data/`
- PDFs under `data/papers/`
- extracted figures under `data/figures/`
- generated briefs under `data/briefs/`
- logs under `logs/`
- QA screenshots under `scripts/screenshots/`

## Current Technical Baseline

| Layer | Stack |
|---|---|
| Backend | FastAPI, SQLAlchemy, Pydantic Settings, SQLite |
| Worker | APScheduler |
| AI | provider adapters, prompt tracing, cost guard |
| Frontend | React 18, Vite, TypeScript, Tailwind CSS |
| Deployment | Docker Compose with separate backend, worker, and frontend services |

## Maintenance Notes

- Keep documentation aligned with `.env.example` and `docker-compose.yml`.
- Keep original attribution and modification notes in `NOTICE.md`.
- Keep historical reports in `docs/history/` instead of the repository root.
- Avoid committing local databases, downloaded PDFs, generated screenshots, API keys, or personal research data.
