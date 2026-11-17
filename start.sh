#!/usr/bin/env bash
# TruthGuard — hamamı bir əmrlə işlədir (Docker varsa onu, yoxsa yerli mühiti).
set -euo pipefail
cd "$(dirname "$0")"

echo "==> TruthGuard başladılır..."

if command -v docker >/dev/null 2>&1 \
   && docker compose version >/dev/null 2>&1 \
   && docker info >/dev/null 2>&1; then
  echo "==> Docker Compose tapıldı. Backend + Frontend qaldırılır."
  echo "    Frontend: http://localhost:8080"
  echo "    Backend:  http://localhost:8000/docs"
  docker compose up --build
  exit 0
fi

echo "==> Docker yoxdur — yerli mühit qurulur."

# --- Backend ---
if [ ! -d backend/.venv ]; then
  echo "==> Python virtualenv yaradılır..."
  python3 -m venv backend/.venv
fi
echo "==> Backend asılılıqları quraşdırılır..."
backend/.venv/bin/pip install -q --disable-pip-version-check -r backend/requirements.txt
echo "==> Backend başladılır (:8000)..."
backend/.venv/bin/python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

cleanup() { kill "$BACKEND_PID" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

# --- Frontend ---
if ! command -v pnpm >/dev/null 2>&1; then
  echo "==> pnpm aktivləşdirilir..."
  corepack enable 2>/dev/null || true
  corepack prepare pnpm@9.15.4 --activate 2>/dev/null || npm i -g pnpm@9.15.4
fi
if [ ! -d node_modules ]; then
  echo "==> Frontend asılılıqları quraşdırılır..."
  pnpm install
fi

echo "==> Frontend başladılır (:8080)..."
sleep 2
pnpm dev --host 0.0.0.0
