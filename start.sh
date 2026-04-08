#!/bin/bash

# Script para iniciar frontend + backend principal + backend OCR

set -e

echo "🚀 Iniciando PXG Files (fluxos separados)"
echo ""

ROOT_DIR="$(pwd)"

if [ ! -f "$ROOT_DIR/.venv/bin/python" ]; then
    echo "❌ Python do backend principal não encontrado em .venv/bin/python"
    exit 1
fi

if [ ! -d "$ROOT_DIR/backend-ocr/venv" ]; then
    echo "Criando venv do backend OCR..."
    cd "$ROOT_DIR/backend-ocr"
    python -m venv venv
    source venv/bin/activate
    pip install -q -r requirements.txt
    deactivate
fi

echo "📦 Iniciando Backend Principal em http://localhost:8000"
cd "$ROOT_DIR/backend"
"$ROOT_DIR/.venv/bin/python" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &
MAIN_BACKEND_PID=$!

echo "🔍 Iniciando Backend OCR em http://localhost:8001"
cd "$ROOT_DIR/backend-ocr"
PORT=8001 "$ROOT_DIR/backend-ocr/venv/bin/python" main.py &
OCR_BACKEND_PID=$!

echo "⚛️  Iniciando Frontend em http://localhost:3000"
cd "$ROOT_DIR/frontend"
if [ ! -d "node_modules" ]; then
    npm install -q
fi
npm run dev &
FRONTEND_PID=$!

cd "$ROOT_DIR"

echo ""
echo "🎉 Sistema pronto (fluxos separados)!"
echo "Frontend:            http://localhost:3000"
echo "API Principal:       http://localhost:8000"
echo "API Principal Docs:  http://localhost:8000/docs"
echo "API OCR:             http://localhost:8001"
echo "API OCR Docs:        http://localhost:8001/docs"
echo ""
echo "Pressione CTRL+C para parar"

wait $MAIN_BACKEND_PID $OCR_BACKEND_PID $FRONTEND_PID
