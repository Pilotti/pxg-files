#!/usr/bin/env python
"""
Script para importar tasks de nightmare_world do arquivo JSON corrigido
Uso: python import_nightmare_tasks.py
"""

import json
import requests
import time
from typing import Optional

# Configuração
API_BASE_URL = "http://127.0.0.1:8000"
ADMIN_TOKEN = None  # Será necessário usar um token de admin válido
JSON_FILE = r"C:\Users\leona\Downloads\nightmare_tasks_corrected.json"

def get_admin_token() -> Optional[str]:
    """Obtém token de admin (você precisará fazer login manualmente)"""
    print("\n⚠️  Você precisa de um token de admin válido para importar tasks.")
    print("Opções:")
    print("1. Fazer login em http://127.0.0.1:5173/admin-login")
    print("2. Extrair o token do localStorage do navegador")
    print("3. Usar token obtido via POST /auth/login\n")
    
    token = input("Cole aqui o token de admin (jwt): ").strip()
    return token if token else None

def import_tasks(token: str) -> dict:
    """Importa tasks do JSON corrigido"""
    
    # Carregar JSON
    with open(JSON_FILE, 'r', encoding='utf-8') as f:
        tasks = json.load(f)
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    results = {
        "success": 0,
        "failed": 0,
        "errors": []
    }
    
    print(f"\nImportando {len(tasks)} tasks...\n")
    
    for idx, task in enumerate(tasks, 1):
        try:
            response = requests.post(
                f"{API_BASE_URL}/admin/tasks",
                json=task,
                headers=headers,
                timeout=10
            )
            
            if response.status_code in [200, 201]:
                results["success"] += 1
                print(f"[{idx:3d}/{len(tasks)}] OK: {task['name']}")
            else:
                results["failed"] += 1
                error_msg = f"{response.status_code}: {response.text[:100]}"
                results["errors"].append({
                    "task": task['name'],
                    "error": error_msg
                })
                print(f"[{idx:3d}/{len(tasks)}] ERRO: {task['name']} - {error_msg}")
            
            # Pequeno delay para não sobrecarregar a API
            time.sleep(0.1)
            
        except Exception as e:
            results["failed"] += 1
            results["errors"].append({
                "task": task['name'],
                "error": str(e)
            })
            print(f"[{idx:3d}/{len(tasks)}] ERRO: {task['name']} - {str(e)[:100]}")
    
    return results

def main():
    print("=" * 60)
    print("IMPORTADOR DE TASKS - NIGHTMARE WORLD")
    print("=" * 60)
    
    # Verificar se backend está rodando
    try:
        response = requests.get(f"{API_BASE_URL}/health", timeout=5)
        if response.status_code != 200:
            print("\nERRO: Backend não está respondendo corretamente!")
            print(f"Status: {response.status_code}")
            return
    except Exception as e:
        print(f"\nERRO: Não consegui conectar ao backend em {API_BASE_URL}")
        print(f"Certifique-se de que o backend está rodando: python -m uvicorn app.main:app")
        print(f"Erro: {e}")
        return
    
    # Obter token
    token = get_admin_token()
    if not token:
        print("Abortado: Token de admin não fornecido.")
        return
    
    # Importar tasks
    results = import_tasks(token)
    
    # Resumo
    print("\n" + "=" * 60)
    print("RESUMO DA IMPORTACAO")
    print("=" * 60)
    print(f"Sucesso:  {results['success']}")
    print(f"Falhadas: {results['failed']}")
    print(f"Total:    {results['success'] + results['failed']}")
    
    if results['errors']:
        print("\n--- ERROS ---")
        for error in results['errors'][:5]:  # Mostrar primeiros 5 erros
            print(f"\n{error['task']}:")
            print(f"  {error['error']}")
        
        if len(results['errors']) > 5:
            print(f"\n... e mais {len(results['errors']) - 5} erros")
    
    print("\n" + "=" * 60)

if __name__ == "__main__":
    main()
