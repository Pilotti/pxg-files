# PXG Files

Aplicacao com:

- frontend Next.js em [frontend](./frontend)
- API principal FastAPI em [backend](./backend)
- servico OCR separado em [backend-ocr](./backend-ocr)

## Arquitetura Atual

### Frontend
- roda em `http://localhost:3000`
- usa `NEXT_PUBLIC_API_URL` para a API principal
- usa `NEXT_PUBLIC_OCR_API_URL` para a pagina OCR isolada em `/ocr`

### Backend principal
- roda em `http://localhost:8000`
- expõe autenticacao, personagens, tasks, quests, hunts, admin e UI
- inicializa banco e migracoes basicas no startup
- documentacao em `http://localhost:8000/docs`

### Backend OCR separado
- roda em `http://localhost:8001`
- expõe `/health`, `/ocr` e `/ocr/detailed`
- e usado pela pagina isolada `/ocr` do frontend
- documentacao em `http://localhost:8001/docs`

## Fluxos Principais

- App principal: `frontend -> backend:8000`
- Pagina OCR isolada `/ocr`: `frontend -> backend-ocr:8001`
- OCR de hunts: processado pela API principal em `backend/app/api/hunts.py`

## Estrutura

```text
pxg-files-next/
|-- frontend/
|-- backend/
|-- backend-ocr/
|-- docker-compose.yml
|-- start.ps1
|-- start.sh
```

## Setup Local

### Requisitos
- Node.js 18+
- Python 3.10+
- PowerShell no Windows

### Opcao 1: subir tudo com script no Windows

Na raiz do projeto:

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

Servicos esperados:

- frontend: `http://localhost:3000`
- API principal: `http://localhost:8000`
- OCR separado: `http://localhost:8001`

### Opcao 2: subir manualmente

API principal:

```powershell
cd backend
..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

OCR separado:

```powershell
cd backend-ocr
.\venv\Scripts\python.exe main.py
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
- `backend-ocr` em `8001`
- `frontend` em `3000`

```bash
docker-compose up --build
```

## Variaveis de Ambiente

### Frontend
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_OCR_API_URL`

### Backend principal
Use [backend/.env.example](./backend/.env.example) como base.

### Backend OCR separado
- usa `PORT`
- hoje a configuracao de CORS esta hardcoded no proprio servico

## Comandos Uteis

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

OCR separado:

```powershell
cd backend-ocr
.\venv\Scripts\python.exe main.py
```

## Observacoes

- O arquivo [test_e2e.py](./test_e2e.py) foi aposentado porque testava a arquitetura antiga.
- O frontend atual nao e um projeto Vite; ele usa Next.js App Router.
- O backend OCR separado continua existindo e nao foi unificado com a API principal.
