#!/usr/bin/env python
"""
Script para corrigir task_type corrompido (task_type=["defeat"] foi salvo como task_type='["defeat"]')
"""

import json
import sys

sys.path.insert(0, r'C:\Users\leona\Documents\pxg-files\backend')

from sqlalchemy.orm.attributes import flag_modified
from app.db.session import SessionLocal
from app.models.tasks import TaskTemplate

def fix_task_types():
    """Corrige task_type que foi salvo como string JSON"""
    session = SessionLocal()
    
    # Buscar todas as tasks
    tasks = session.query(TaskTemplate).all()
    
    fixed_count = 0
    
    for task in tasks:
        # Se task_type é string, precisa ser convertido para array
        if isinstance(task.task_type, str):
            try:
                # Tenta desserializar a string JSON
                parsed = json.loads(task.task_type)
                if isinstance(parsed, list):
                    task.task_type = parsed
                    flag_modified(task, 'task_type')
                    fixed_count += 1
                    print(f"Corrigido: {task.name} -> {task.task_type}")
            except json.JSONDecodeError:
                # task_type é uma string simples como "defeat" → wrapa em array
                task.task_type = [task.task_type]
                flag_modified(task, 'task_type')
                fixed_count += 1
                print(f"Corrigido (bare string): {task.name} -> {task.task_type}")
    
    if fixed_count > 0:
        session.commit()
        print(f"\nTotal corrigido: {fixed_count} tasks")
    else:
        print("Nenhuma task precisava corrigir")
    
    session.close()

if __name__ == "__main__":
    print("Corrigindo task_type...\n")
    fix_task_types()
