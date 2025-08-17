param(
  [string]$BindHost = "127.0.0.1",
  [int]$Port = 8000
)

$env:PYTHONPATH = (Get-Location).Path
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host $BindHost --port $Port
