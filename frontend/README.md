# Frontend PXG Files

Frontend em Next.js com App Router.

## Responsabilidades

- autenticacao e fluxo de sessao do usuario
- selecao e troca de personagem
- telas de tasks, quests, hunts, configuracoes e admin
- pagina OCR isolada em `/ocr`

## Estrutura Principal

- `app/`: rotas do App Router
- `components/`: componentes reutilizaveis
- `context/`: estado global de auth, personagem e UI
- `services/`: integracao com API principal e OCR separado
- `styles/`: folhas CSS por pagina/componente

## Variaveis de Ambiente

O frontend usa:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_OCR_API_URL`

Exemplo local comum:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_OCR_API_URL=http://localhost:8001
```

## Comandos

```powershell
npm install
npm run dev
npm run build
npm run lint
```

## Endpoints Consumidos

### API principal
- auth, characters, tasks, quests, hunts, admin e UI
- normalmente em `http://localhost:8000`

### OCR separado
- usado pela pagina `/ocr`
- normalmente em `http://localhost:8001`

## Observacoes

- este frontend nao usa Vite
- o script de lint atual usa ESLint CLI
- warnings de lint existentes no codigo foram mantidos; eles nao impedem build
