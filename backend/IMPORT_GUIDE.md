# Guia de Importação - Tasks Nightmare World

## Status do JSON
✅ **89 tasks validadas e prontas para importação**

### Correções Realizadas
- `continent`: "nightmare world" → "nightmare_world"
- `coordinate`: Todas ajustadas para "0,0,0" (ajuste manualmente depois no admin)
- `task_type`: Yami corrigida de "other" → "outro"

## Arquivos Criados
- **`nightmare_tasks_corrected.json`** - JSON pronto para importação (C:\Users\leona\Downloads\)
- **`import_nightmare_tasks.py`** - Script de importação via API
- **`validate_nightmare_tasks.py`** - Script de validação (já passou ✓)

## Como Importar

### Opção 1: Via Dashboard Admin (Recomendado para testes)
1. Acesse http://127.0.0.1:5173/admin
2. Navegue até **Tasks**
3. Para cada task, clique em **"+ Nova Task"**
4. Copie campos do JSON corrigido
5. Clique em **Salvar**

**⚠️ Nota**: Isso é lento para 89 tasks. Use Opção 2 para importação em lote.

### Opção 2: Via Script Python (Recomendado)
```bash
# Terminal no backend
cd C:\Users\leona\Documents\pxg-files\backend

# 1. Certifique-se que o backend está rodando
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# 2. Em outro terminal, execute o importador
python import_nightmare_tasks.py
```

**O script vai pedir:**
1. Você fazer login em http://127.0.0.1:5173/admin-login
2. Copiar o token JWT (do localStorage do navegador)
3. Colar o token no terminal

**Como extrair o token do navegador:**
1. Em http://127.0.0.1:5173/admin (logado)
2. Abra Dev Tools (F12)
3. Console → `localStorage.getItem('admin_token')`
4. Copie o valor (a string JWT)

### Opção 3: Via cURL (Manual)
```bash
# Obter token de admin
curl -X POST http://127.0.0.1:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "sua_senha"}'

# Para cada task
curl -X POST http://127.0.0.1:8000/admin/tasks \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d @task_data.json
```

## Próximos Passos Após Importação

1. **Verificar coordenadas**: Todas estão "0,0,0" por enquanto
   - Acesse admin → Tasks
   - Clique em cada task
   - Ajuste `coordinate` manualmente com as coordenadas corretas
   - Salve

2. **Testar na interface pública**:
   - http://127.0.0.1:5173/tarefas
   - Filtro por continent: "nightmare_world"
   - Verificar NW Level exibição

3. **Ajustar status das tasks**:
   - Admin → Tarefas
   - Mude `is_active` se necessário

## Troubleshooting

### "Invalid token"
- Verifique se fez login como admin
- Token pode estar expirado (login novamente)

### "Conflict: Task já existe"
- Significa que a task foi importada duplicada
- Verifique no admin → Tasks antes de importar novamente

### "500 Internal Server Error"
- Verifique se backend está rodando
- Valide o JSON novamente: `python validate_nightmare_tasks.py`

## Estrutura do JSON
Cada task segue este padrão:
```json
{
  "name": "Task Name",
  "description": "Description",
  "task_type": ["defeat"], // ou ["item_delivery"], ["capture"], ["outro"], ou combinações
  "continent": "nightmare_world",
  "min_level": 300,
  "nw_level": 2, // obrigatório para nightmare_world (1-999)
  "reward_text": "Rewards here",
  "coordinate": "0,0,0", // MUDAR MANUALMENTE NO ADMIN!
  "city": "city_name",
  "is_active": true
}
```

## Arquivo Completo
📂 `C:\Users\leona\Downloads\nightmare_tasks_corrected.json`
- 89 tasks
- Tamanho: ~xx KB
- Formato: JSON válido (passado em validação Pydantic)

---
**Status**: ✅ Pronto para importação

