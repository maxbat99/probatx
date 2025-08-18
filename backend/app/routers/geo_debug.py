from fastapi import APIRouter
from ..services.geo import resolve_coords, load_stadiums

router = APIRouter(prefix="/geo", tags=["geo"])

@router.get("/_status")
def status():
    rows = load_stadiums()
    return {"stadiums_loaded": len(rows)}

@router.get("/resolve")
async def resolve(stadium: str | None = None, team: str | None = None, city: str | None = None, country: str | None = None):
    lat, lon = await resolve_coords(stadium=stadium, team=team, city=city, country=country)
    return {"lat": lat, "lon": lon}
