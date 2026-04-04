#!/usr/bin/env python
"""
Script para importar tasks diretamente no banco de dados
Uso: python seed_nightmare_tasks.py
"""

import json
import sys
from datetime import datetime

sys.path.insert(0, r'C:\Users\leona\Documents\pxg-files\backend')

from app.db.session import SessionLocal
from app.models.tasks import TaskTemplate
from sqlalchemy.exc import IntegrityError

JSON_FILE = r"C:\Users\leona\Downloads\nightmare_tasks_corrected.json"

def seed_tasks():
    """Importa tasks do JSON direto no banco"""
    
    # Carregar JSON
    with open(JSON_FILE, 'r', encoding='utf-8') as f:
        tasks_data = json.load(f)
    
    session = SessionLocal()
    
    results = {
        "success": 0,
        "failed": 0,
        "skipped": 0,
        "errors": []
    }
    
    print(f"Importando {len(tasks_data)} tasks...\n")
    
    for idx, task_data in enumerate(tasks_data, 1):
        try:
            # Verificar se task já existe para evitar duplicatas
            existing = session.query(TaskTemplate).filter_by(
                name=task_data['name'],
                continent=task_data['continent']
            ).first()
            
            if existing:
                results["skipped"] += 1
                print(f"[{idx:3d}/{len(tasks_data)}] SKIP: {task_data['name']} (já existe)")
                continue
            
            # Criar nova task
            task = TaskTemplate(
                name=task_data['name'],
                description=task_data.get('description'),
                task_type=task_data['task_type'],
                continent=task_data['continent'],
                min_level=task_data['min_level'],
                nw_level=task_data.get('nw_level'),
                reward_text=task_data.get('reward_text'),
                npc_name=task_data.get('npc_name'),
                coordinate=task_data.get('coordinate', '0,0,0'),
                city=task_data.get('city'),
                is_active=task_data.get('is_active', True)
            )
            
            session.add(task)
            session.commit()
            
            results["success"] += 1
            print(f"[{idx:3d}/{len(tasks_data)}] OK: {task_data['name']} (NW Level: {task_data.get('nw_level')})")
            
        except IntegrityError as e:
            session.rollback()
            results["failed"] += 1
            results["errors"].append({
                "task": task_data['name'],
                "error": "Duplicata ou erro de integridade"
            })
            print(f"[{idx:3d}/{len(tasks_data)}] ERRO: {task_data['name']} - {str(e)[:80]}")
            
        except Exception as e:
            session.rollback()
            results["failed"] += 1
            results["errors"].append({
                "task": task_data['name'],
                "error": str(e)
            })
            print(f"[{idx:3d}/{len(tasks_data)}] ERRO: {task_data['name']} - {str(e)[:80]}")
    
    session.close()
    return results

def main():
    print("=" * 70)
    print("IMPORTADOR DE TASKS - NIGHTMARE WORLD (Banco Direto)")
    print("=" * 70)
    
    try:
        results = seed_tasks()
        
        # Resumo
        print("\n" + "=" * 70)
        print("RESUMO DA IMPORTACAO")
        print("=" * 70)
        print(f"Importadas: {results['success']}")
        print(f"Falhadas:   {results['failed']}")
        print(f"Puladas:    {results['skipped']}")
        print(f"Total:      {results['success'] + results['failed'] + results['skipped']}")
        
        if results['errors']:
            print("\n--- ERROS (primeiros 5) ---")
            for error in results['errors'][:5]:
                print(f"\n{error['task']}:")
                print(f"  {error['error']}")
            
            if len(results['errors']) > 5:
                print(f"\n... e mais {len(results['errors']) - 5} erros")
        
        print("\n" + "=" * 70)
        return 0 if results['failed'] == 0 else 1
        
    except Exception as e:
        print(f"\nERRO FATAL: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
