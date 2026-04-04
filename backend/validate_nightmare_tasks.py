#!/usr/bin/env python
"""
Script para validar se o JSON está conforme as schemas do backend
Uso: python validate_nightmare_tasks.py
"""

import json
import sys
from typing import List, Dict

# Importar schemas do backend
sys.path.insert(0, r'C:\Users\leona\Documents\pxg-files\backend')
from app.schemas.tasks import TaskTemplateBase
from pydantic import ValidationError

JSON_FILE = r"C:\Users\leona\Downloads\nightmare_tasks_corrected.json"

def validate_tasks() -> Dict:
    """Valida cada task do JSON contra TaskTemplateBase schema"""
    
    with open(JSON_FILE, 'r', encoding='utf-8') as f:
        tasks = json.load(f)
    
    results = {
        "valid": 0,
        "invalid": 0,
        "errors": []
    }
    
    print("Validando tasks contra schema...\n")
    
    for idx, task in enumerate(tasks, 1):
        try:
            # Tentar validar contra Pydantic schema
            TaskTemplateBase(**task)
            results["valid"] += 1
            print(f"[{idx:3d}/{len(tasks)}] OK: {task['name']}")
            
        except ValidationError as e:
            results["invalid"] += 1
            errors_list = e.errors()
            error_msg = "; ".join([f"{err['loc'][0]}: {err['msg']}" for err in errors_list])
            
            results["errors"].append({
                "task": task['name'],
                "error": error_msg,
                "details": errors_list
            })
            print(f"[{idx:3d}/{len(tasks)}] ERRO: {task['name']}")
            print(f"        {error_msg}")
    
    return results

def main():
    print("=" * 70)
    print("VALIDADOR DE TASKS - NIGHTMARE WORLD")
    print("=" * 70)
    
    results = validate_tasks()
    
    # Resumo
    print("\n" + "=" * 70)
    print("RESUMO DA VALIDACAO")
    print("=" * 70)
    print(f"Validas:   {results['valid']}")
    print(f"Invalidas: {results['invalid']}")
    print(f"Total:     {results['valid'] + results['invalid']}")
    
    if results['invalid'] > 0:
        print("\n" + "=" * 70)
        print("TAREFAS COM ERRO:")
        print("=" * 70)
        for error in results['errors']:
            print(f"\nTask: {error['task']}")
            print(f"Erro: {error['error']}")
    else:
        print("\nTodas as tasks sao validas! Pronto para importacao.")
    
    print("\n" + "=" * 70)
    
    return 0 if results['invalid'] == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
