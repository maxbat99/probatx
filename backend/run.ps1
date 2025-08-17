param([string]$Host=\"127.0.0.1\", [int]$Port=8000)
$env:PYTHONPATH = (Get-Location).Path
.\venv\Scripts\Activate
uvicorn app.main:app --reload --host $Host --port $Port
