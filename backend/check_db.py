import sqlite3, json, sys
sys.path.insert(0, r'C:\Users\leona\Documents\pxg-files\backend')

from app.core.config import settings

db_url = settings.DATABASE_URL
# Extract path from sqlite:///./tasks.db
db_path = db_url.replace("sqlite:///", "").replace("sqlite://", "")
if db_path.startswith("./"):
    import os
    db_path = os.path.join(r'C:\Users\leona\Documents\pxg-files\backend', db_path[2:])

print(f"DB path: {db_path}")

conn = sqlite3.connect(db_path)
cur = conn.cursor()

# List tables
cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
print("Tables:", cur.fetchall())

# Check task_type values
cur.execute("SELECT id, name, task_type, typeof(task_type) FROM task_templates LIMIT 10")
rows = cur.fetchall()
for row in rows:
    print(f"id={row[0]} name={str(row[1])[:25]:25} task_type={str(row[2])[:30]:30} typeof={row[3]}")

# Count by type
cur.execute("SELECT typeof(task_type), COUNT(*) FROM task_templates GROUP BY typeof(task_type)")
print("\ntask_type column types in DB:")
for row in cur.fetchall():
    print(f"  typeof={row[0]} count={row[1]}")

conn.close()
