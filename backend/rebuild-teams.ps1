$ErrorActionPreference = "Stop"
.\venv\Scripts\Activate.ps1
$env:PYTHONPATH = (Get-Location).Path

$py = @"
import asyncio
from app.services import teams_source
async def main():
    res = await teams_source.rebuild_team_index()
    print("Indice creato:", res)
asyncio.run(main())
"@
$tempPy = Join-Path $env:TEMP "rebuild_teams_probatx.py"
Set-Content -Path $tempPy -Value $py -Encoding UTF8
python "$tempPy"
Remove-Item "$tempPy" -ErrorAction SilentlyContinue
