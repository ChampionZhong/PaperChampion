#!/bin/bash
# PaperChampion Docker deployment helper.
#
# Usage:
#   ./scripts/docker_deploy.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_ROOT/.env"
ENV_EXAMPLE="$PROJECT_ROOT/.env.example"

echo "========================================"
echo "PaperChampion Docker deployment"
echo "========================================"
echo

echo "Checking configuration..."
if [ ! -f "$ENV_FILE" ]; then
    echo "Configuration file is missing. Creating it from .env.example..."
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    echo "Created $ENV_FILE"
    echo
    echo "Edit $ENV_FILE and set at least one LLM API key."
    echo "Optional email settings:"
    echo "   - SMTP_USER"
    echo "   - SMTP_PASSWORD"
    echo "   - NOTIFY_DEFAULT_TO"
    echo
    read -p "Press Enter after editing .env..."
fi

echo "Checking Docker..."
if ! command -v docker &> /dev/null; then
    echo "Docker is not installed."
    exit 1
fi

if ! command -v docker compose &> /dev/null; then
    echo "Docker Compose is not installed."
    exit 1
fi

echo "Docker is available."
echo

echo "Stopping existing containers..."
cd "$PROJECT_ROOT"
docker compose down 2>/dev/null || true
echo

echo "Building Docker images..."
docker compose build
echo

echo "Starting services..."
docker compose up -d
echo

echo "Service status:"
docker compose ps
echo

echo "Next steps:"
echo "   - Frontend: http://localhost:3003"
echo "   - Backend API: http://localhost:8003"
echo "   - Logs: docker compose logs -f"
echo "   - Stop: docker compose down"
echo "   - Restart: docker compose restart"
echo

echo "========================================"
echo "Deployment command finished."
echo "========================================"
