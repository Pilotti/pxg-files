Set-Location "$PSScriptRoot\backend"
& "c:\Users\leona\Documents\pxg-files-next\.venv\Scripts\python.exe" -m uvicorn app.main:app --host 0.0.0.0 --port 8000
