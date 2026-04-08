#!/usr/bin/env python3
"""
LEGADO / APOSENTADO

Este arquivo foi mantido apenas para sinalizar que o antigo teste "end-to-end"
nao representa mais a arquitetura atual do projeto.

Motivo:
- o projeto passou a ter API principal em :8000
- o OCR generico ficou separado em :8001
- o script antigo testava endpoints e fluxos da arquitetura anterior

Se voce precisar validar localmente o estado atual, use checks manuais:

1. Frontend:
   http://localhost:3000

2. API principal:
   http://localhost:8000/docs

3. OCR separado:
   http://localhost:8001/docs

4. Comandos uteis:
   - powershell -ExecutionPolicy Bypass -File .\\start.ps1
   - cd frontend && npm run lint
   - cd frontend && npm run build

Pendencia:
- se o projeto voltar a precisar de smoke tests automatizados, o ideal e criar um
  novo script alinhado com a arquitetura atual, em vez de reutilizar este arquivo.
"""

import sys


def main() -> int:
    print(__doc__.strip())
    return 1


if __name__ == "__main__":
    sys.exit(main())
