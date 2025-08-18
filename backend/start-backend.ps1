# start-backend.ps1 - avvia FastAPI con venv
& "$PSScriptRoot\venv\Scripts\Activate.ps1"
$env:PYTHONPATH = (Get-Location).Path
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
