from fastapi import APIRouter, Query, HTTPException
from ..services.teams_source import search_index, top_suggestions, rebuild_team_index, load_team_index

router = APIRouter(prefix="/teams", tags=["teams"])

@router.get("/search")
async def search_teams(q: str = Query(..., min_length=2), limit: int = 20):
    return search_index(q, limit=limit)

@router.get("/suggest")
async def suggest(limit: int = 30):
    return top_suggestions(limit=limit)

@router.post("/admin/rebuild")
async def admin_rebuild():
    try:
        res = await rebuild_team_index()
        return {"ok": True, **res}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/_status")
async def status():
    return {"indexed": len(load_team_index())}
