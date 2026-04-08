# PXG Files - Migração Next.js + FastAPI + EasyOCR

Projeto migrado de Vite para Next.js com OCR no backend usando EasyOCR.

## Estrutura do Projeto

```
pxg-files-next/
├─ frontend/          # Next.js + React
│  ├─ app/           # App Router
│  ├─ context/       # React Contexts
│  ├─ components/    # React Components
│  ├─ services/      # API Services
│  ├─ styles/        # CSS
│  └─ package.json
├─ backend-ocr/      # FastAPI + EasyOCR
│  ├─ main.py
│  ├─ requirements.txt
│  └─ Dockerfile
└─ docker-compose.yml
```

## Setup Local

### Pré-requisitos
- Node.js 18+
- Python 3.10+
- Docker (opcional)

### Sem Docker

**1. Backend:**
```bash
cd backend-ocr
python -m venv venv

# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
python main.py
# Roda em http://localhost:8000
```

**2. Frontend (novo terminal):**
```bash
cd frontend
npm install
npm run dev
# Roda em http://localhost:3000
```

### Com Docker

```bash
docker-compose up
# Frontend: http://localhost:3000
# Backend: http://localhost:8000
# Docs: http://localhost:8000/docs
```

## Usando OCR

1. Acesse http://localhost:3000/ocr
2. Selecione uma imagem
3. Clique em "Extrair Texto"
4. O backend processará com EasyOCR e retornará o texto

## Endpoints da API

### POST /ocr
Extrai texto simples de uma imagem
```bash
curl -X POST -F "file=@image.jpg" http://localhost:8000/ocr
```

Resposta:
```json
{
  "success": true,
  "text": "Texto extraído...",
  "detections": 5
}
```

### POST /ocr/detailed
Retorna texto com confidence scores
```bash
curl -X POST -F "file=@image.jpg" http://localhost:8000/ocr/detailed
```

### GET /health
Health check
```bash
curl http://localhost:8000/health
```

### Documentação Interativa
```bash
http://localhost:8000/docs
```

## Próximas Etapas

- [ ] Integrar componentes React antigos
- [ ] Adicionar autenticação
- [ ] Melhorar UI da página OCR
- [ ] Cache de modelos EasyOCR
- [ ] Deploy em Railway

## Deploy no Railway

1. Integrar repositório no Railway
2. Configurar variáveis de ambiente:
   - `NEXT_PUBLIC_API_URL` = URL do backend
3. Railway detectará automaticamente:
   - Frontend: `package.json` com Next.js
   - Backend: `requirements.txt` com Python

## Scripts

```bash
# Frontend
npm run dev      # Dev mode
npm run build    # Build production
npm start        # Start production

# Backend
python main.py   # Run server
```

## Performance

- **Tesseract.js** (clientside): 2-5s por imagem
- **EasyOCR** (backend): 0.5-2s por imagem ⭐

## Troubleshooting

**"Connection refused" ao chamar /ocr?**
- Verificar se backend está rodando em 8000
- Verificar `.env.local` do frontend

**EasyOCR carregando lentamente?**
- Primeira vez leva ~30s para baixar os modelos
- Cache automático na sequência

**Problema com CORS?**
- Backend tem `allow_origins=["*"]` por padrão
- Mudar para domínio específico em produção
