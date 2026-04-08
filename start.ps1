# Script para iniciar frontend + backend principal no Windows

Write-Host "Iniciando PXG Files" -ForegroundColor Green
Write-Host ""

$root = Get-Location
$mainApiPython = Join-Path $root ".venv\\Scripts\\python.exe"

if (-not (Test-Path $mainApiPython)) {
    Write-Host "Python do backend principal nao encontrado em .venv\\Scripts\\python.exe" -ForegroundColor Red
    exit 1
}

Write-Host "Iniciando Backend Principal em http://localhost:8000" -ForegroundColor Cyan
Start-Process -FilePath $mainApiPython -ArgumentList "-m uvicorn app.main:app --host 0.0.0.0 --port 8000" -WorkingDirectory (Join-Path $root "backend")

Write-Host "Iniciando Frontend em http://localhost:3000" -ForegroundColor Cyan
Set-Location frontend

if (-not (Test-Path "node_modules")) {
    npm install -q
}

Start-Process npm -ArgumentList "run dev"
Set-Location $root

Write-Host ""
Write-Host "Sistema pronto!" -ForegroundColor Green
Write-Host "Frontend:            http://localhost:3000"
Write-Host "API Principal:       http://localhost:8000"
Write-Host "API Principal Docs:  http://localhost:8000/docs"
