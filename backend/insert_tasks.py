import json
import sys
import os

# Ensure we can import from current directory
sys.path.insert(0, os.getcwd())

from app.models.tasks import TaskTemplate
from app.db.session import SessionLocal

def main():
    session = SessionLocal()
    
    try:
        # Load tasks
        with open('app/data/tasks_to_add.json', 'r', encoding='utf-8') as f:
            tasks_data = json.load(f)
        
        added = 0
        skipped = 0
        
        for task_data in tasks_data:
            # Check if exists
            existing = session.query(TaskTemplate).filter(
                TaskTemplate.name == task_data['name']
            ).first()
            
            if existing:
                print(f"⏭️  {task_data['name']} (already exists)")
                skipped += 1
                continue
            
            # Add new
            new_task = TaskTemplate(
                name=task_data['name'],
                description=task_data['description'],
                task_type=task_data['task_type'],
                continent=task_data['continent'],
                min_level=task_data['min_level'],
                reward_text=task_data['reward_text'],
                coordinate=task_data['coordinate'],
                city=task_data['city'],
                is_active=True
            )
            session.add(new_task)
            print(f"✅ {task_data['name']}")
            added += 1
        
        session.commit()
        print(f"\n📊 Total: {added} added, {skipped} skipped")
    
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        session.rollback()
        raise
    
    finally:
        session.close()

if __name__ == "__main__":
    main()
