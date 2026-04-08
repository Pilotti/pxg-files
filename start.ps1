# Script para iniciar frontend + backend principal + backend OCR no Windows

Write-Host "🚀 Iniciando PXG Files (fluxos separados)" -ForegroundColor Green
Write-Host ""

$root = Get-Location
$mainApiPython = Join-Path $root ".venv\Scripts\python.exe"
$ocrApiPython = Join-Path $root "backend-ocr\venv\Scripts\python.exe"

if (-not (Test-Path $mainApiPython)) {
    Write-Host "❌ Python do backend principal não encontrado em .venv\\Scripts\\python.exe" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $ocrApiPython)) {
    Write-Host "Criando venv do backend OCR..." -ForegroundColor Yellow
    Set-Location backend-ocr
    python -m venv venv
    & .\venv\Scripts\python.exe -m pip install -q -r requirements.txt
    Set-Location $root
}

Write-Host "📦 Iniciando Backend Principal em http://localhost:8000" -ForegroundColor Cyan
Start-Process -FilePath $mainApiPython -ArgumentList "-m uvicorn app.main:app --host 0.0.0.0 --port 8000" -WorkingDirectory (Join-Path $root "backend")

Write-Host "🔍 Iniciando Backend OCR em http://localhost:8001" -ForegroundColor Cyan
Start-Process -FilePath $ocrApiPython -ArgumentList "main.py" -WorkingDirectory (Join-Path $root "backend-ocr") -Environment @{ PORT = "8001" }

Write-Host "⚛️  Iniciando Frontend em http://localhost:3000" -ForegroundColor Cyan
Set-Location frontend

if (-not (Test-Path "node_modules")) {
    npm install -q
}

Start-Process npm -ArgumentList "run dev"
Set-Location $root

Write-Host ""
Write-Host "🎉 Sistema pronto (fluxos separados)!" -ForegroundColor Green
Write-Host "Frontend:            http://localhost:3000"
Write-Host "API Principal:       http://localhost:8000"
Write-Host "API Principal Docs:  http://localhost:8000/docs"
Write-Host "API OCR:             http://localhost:8001"
Write-Host "API OCR Docs:        http://localhost:8001/docs"
