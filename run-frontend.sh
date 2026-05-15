#!/bin/bash
# PaperChampion frontend dev (with glibc wrapper for CentOS 7).
# Run backend separately: uvicorn apps.api.main:app --reload --port 8000
#
# First-time setup:
#   ./scripts/run_with_glibc.sh bash -c "cd frontend && npm install --ignore-scripts"
#   ./scripts/fix-esbuild-glibc.sh
#
cd "$(dirname "$0")"
./scripts/run_with_glibc.sh bash -c "cd frontend && npm run dev"
