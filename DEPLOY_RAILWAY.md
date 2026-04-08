# Deploy no Railway

## Pré-requisitos
- Conta no Railway (https://railway.app)
- GitHub com o repositório pushado
- Railway CLI instalada (opcional)

## Step 1: Backend (EasyOCR + FastAPI)

1. Acesse https://railway.app/dashboard
2. Click em "New Project"
3. Selecione "Deploy from GitHub"
4. Autorize e selecione seu repositório
5. Configure:
   - Root Directory: `backend-ocr`
   - Build Command: (deixar vazio)
   - Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

6. Click Deploy
7. Aguarde ~5-10 minutos (primeira vez carrega EasyOCR)
8. Copie a URL gerada (ex: https://seu-backend.railway.app)

## Step 2: Frontend (Next.js)

1. Mantenha no mesmo projeto Railway
2. Click "Add"
3. Selecione "Deploy from GitHub"
4. Configure:
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Start Command: `npm start`

5. Variáveis de Ambiente:
   ```
   NEXT_PUBLIC_API_URL=https://seu-backend.railway.app
   NODE_ENV=production
   ```

6. Click Deploy
7. Aguarde deployar (~2 minutos)

## Step 3: Testar

- Frontend: https://seu-frontend.railway.app
- Backend: https://seu-backend.railway.app
- API Docs: https://seu-backend.railway.app/docs

Acesse `/ocr` no frontend e teste!

## Troubleshooting

**Backend demorando muito?**
- Primeira vez carrega os modelos EasyOCR (~1GB)
- Próximas deployments são mais rápidas

**"Connection refused"?**
- Verificar se `NEXT_PUBLIC_API_URL` está correto
- Confirmar se backend está rodando

**Custo?**
- Plano Hobby $5/mês inclui os créditos
- Custo estimado com uso moderado: $5-15/mês

## Variáveis de Ambiente

### Backend
```env
PORT=8000
```

### Frontend
```env
NEXT_PUBLIC_API_URL=https://seu-backend.railway.app
NODE_ENV=production
```

## Monitoramento

Railway oferece logs em tempo real:
- Acesse seu projeto
- Clique em cada serviço
- Veja logs em "Logs"

## Atualizações

Todo push para GitHub atualiza automaticamente:
```bash
git push origin main
# Railway detecta mudanças e redeploy automaticamente
```
