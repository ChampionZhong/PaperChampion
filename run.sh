#!/bin/bash
# PaperChampion dev launcher - run backend and frontend in separate terminals.
#
# Terminal 1 (backend):
#   source .venv/bin/activate
#   uvicorn apps.api.main:app --reload --port 8000
#
# Terminal 2 (frontend, use glibc wrapper on CentOS 7):
#   ./scripts/run_with_glibc.sh bash -c "cd frontend && npm run dev"

uvicorn apps.api.main:app --reload --port 8000
