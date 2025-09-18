#!/usr/bin/env bash
set -euo pipefail

# Usage: ./run.sh
# Starts the FastAPI server with auto-reload on port 8000.

export PYTHONUNBUFFERED=1
export UVICORN_APP=${UVICORN_APP:-backend.main:app}
export HOST=${HOST:-0.0.0.0}
export PORT=${PORT:-8000}

python -m uvicorn "$UVICORN_APP" --reload --host "$HOST" --port "$PORT"