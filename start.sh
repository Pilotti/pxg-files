#!/bin/bash

# Script para iniciar frontend + backend principal

set -e

echo "Iniciando PXG Files"
echo ""

ROOT_DIR="$(pwd)"

if [ ! -f "$ROOT_DIR/.venv/bin/python" ]; then
    echo "Python do backend principal nao encontrado em .venv/bin/python"
    exit 1
fi

echo "Iniciando Backend Principal em http://localhost:8000"
cd "$ROOT_DIR/backend"
"$ROOT_DIR/.venv/bin/python" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &
MAIN_BACKEND_PID=$!

echo "Iniciando Frontend em http://localhost:3000"
cd "$ROOT_DIR/frontend"
if [ ! -d "node_modules" ]; then
    npm install -q
fi
npm run dev &
FRONTEND_PID=$!

cd "$ROOT_DIR"

echo ""
echo "Sistema pronto!"
echo "Frontend:            http://localhost:3000"
echo "API Principal:       http://localhost:8000"
echo "API Principal Docs:  http://localhost:8000/docs"
echo ""
echo "Pressione CTRL+C para parar"

wait $MAIN_BACKEND_PID $FRONTEND_PID
