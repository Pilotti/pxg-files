# Deploy no Railway

## Arquitetura atual

O projeto usa dois serviços em produção:

- `backend`: API principal FastAPI
- `frontend`: aplicação Next.js

O OCR de hunts roda dentro da API principal. Não existe mais um serviço `backend-ocr`.

## Pré-requisitos

- conta no Railway
- repositório no GitHub

## Backend

1. Crie um serviço para o diretório `backend`.
2. Start command:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

3. Configure as variáveis mínimas:

```env
PORT=8000
DATABASE_URL=...
JWT_SECRET_KEY=...
JWT_REFRESH_SECRET_KEY=...
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_MINUTES=10080
ADMIN_USERNAME=...
ADMIN_PASSWORD=...
ADMIN_SECRET_KEY=...
CORS_ALLOWED_ORIGINS=https://seu-frontend.railway.app
CATALOG_STORAGE=database
```

## Frontend

1. Crie um segundo serviço para o diretório `frontend`.
2. Build command:

```bash
npm run build
```

3. Start command:

```bash
npm start
```

4. Configure as variáveis mínimas:

```env
NEXT_PUBLIC_API_URL=https://seu-backend.railway.app
NODE_ENV=production
```

## Validação

- frontend: `https://seu-frontend.railway.app`
- backend: `https://seu-backend.railway.app`
- docs da API: `https://seu-backend.railway.app/docs`
- fluxo principal para validar OCR: `/hunts`

## Observações

- o OCR de hunts depende de Tesseract no ambiente do backend
- se o backend subir sem Tesseract configurado corretamente, o endpoint `/hunts/ocr/drops` vai registrar erro em log ao processar imagens
