from fastapi import APIRouter, Query
from ..schemas.common import Team

router = APIRouter(prefix="/teams", tags=["teams"])

# TODO: sostituire con integrazione reale (football-data.org o TheSportsDB)
@router.get("/search")
async def search_teams(q: str = Query(..., min_length=2)):
    ql = q.lower()
    demo = [
        Team(id="milan", name="Milan", league="Serie A", country="Italy"),
        Team(id="inter", name="Inter", league="Serie A", country="Italy"),
        Team(id="juventus", name="Juventus", league="Serie A", country="Italy"),
        Team(id="roma", name="Roma", league="Serie A", country="Italy"),
    ]
    return [t for t in demo if ql in t.name.lower()]
