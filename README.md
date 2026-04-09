# PXG Files

Aplicação com frontend Next.js em [frontend](./frontend) e API principal FastAPI em [backend](./backend).

## Arquitetura atual

- Frontend: `http://localhost:3000`
- API principal: `http://localhost:8000`
- OCR de hunts: executado no backend principal pelo endpoint `POST /hunts/ocr/drops`

Fluxo principal:

```text
frontend /hunts -> backend /hunts/ocr/drops -> app/services/hunts_ocr.py
```

Não existe mais um serviço OCR separado em runtime.

## Estrutura

```text
pxg-files-next/
|-- frontend/
|-- backend/
|-- docker-compose.yml
|-- start.ps1
|-- start.sh
```

## Setup local

### Requisitos

- Node.js 18+
- Python 3.10+
- PowerShell no Windows

### Opção 1: subir com script

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

Serviços esperados:

- frontend: `http://localhost:3000`
- API principal: `http://localhost:8000`

### Opção 2: subir manualmente

Backend principal:

```powershell
cd backend
..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

## Docker Compose

O arquivo [docker-compose.yml](./docker-compose.yml) sobe:

- `backend-main` em `8000`
- `frontend` em `3000`

```bash
docker compose up --build
```

## Variáveis de ambiente

### Frontend

- `NEXT_PUBLIC_API_URL`

### Backend principal

Use [backend/.env.example](./backend/.env.example) como base.

## Comandos úteis

Frontend:

```powershell
cd frontend
npm run dev
npm run build
npm run lint
```

Backend principal:

```powershell
cd backend
..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Observações

- O arquivo [test_e2e.py](./test_e2e.py) foi aposentado porque testava a arquitetura antiga.
- O frontend usa Next.js App Router.
- O OCR principal do produto está concentrado no backend principal.
