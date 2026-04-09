# Frontend PXG Files

Frontend em Next.js com App Router.

## Responsabilidades

- autenticação e fluxo de sessão do usuário
- seleção e troca de personagem
- telas de tasks, quests, hunts, configurações e admin
- envio das imagens de hunts para a API principal

## Estrutura principal

- `app/`: rotas do App Router
- `components/`: componentes reutilizáveis
- `context/`: estado global de auth, personagem e UI
- `services/`: integração com a API principal
- `styles/`: folhas CSS por página/componente

## Variáveis de ambiente

O frontend usa:

- `NEXT_PUBLIC_API_URL`

Exemplo local comum:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Comandos

```powershell
npm install
npm run dev
npm run build
npm run lint
```

## Endpoints consumidos

- auth, characters, tasks, quests, hunts, admin e UI
- normalmente em `http://localhost:8000`

## Observações

- este frontend não usa Vite
- o script de lint atual usa ESLint CLI
- warnings de lint existentes no código foram mantidos; eles não impedem build
