from fastapi import APIRouter, HTTPException, Query
import httpx
from httpx import HTTPError
from ..services import stadiums_live as svc

router = APIRouter(prefix="/stadiums", tags=["stadiums"])
OPEN_METEO = "https://api.open-meteo.com/v1/forecast"

@router.get("/search_live")
async def search_live(q: str = Query(..., min_length=2), limit: int = 10):
    try:
        items = await svc.live_search_wikidata(q, limit=limit)
        try:
            await svc.cache_upsert_many(items)
        except Exception:
            pass
        return {"items": items}
    except Exception as e:
        raise HTTPException(502, f"Wikidata error: {e}")

@router.get("/search_cached")
async def search_cached(q: str = Query(..., min_length=2), limit: int = 10):
    items = await svc.cached_lookup(q, limit=limit)
    return {"items": items}

async def _fetch_weather(lat: float, lon: float):
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": "temperature_2m,precipitation,wind_speed_10m",
        "timezone": "UTC"
    }
    try:
        async with httpx.AsyncClient(timeout=15, headers={"User-Agent":"ProbaX/1.0"}) as cx:
            r = await cx.get(OPEN_METEO, params=params)
            r.raise_for_status()
            return r.json()
    except HTTPError as e:
        raise HTTPException(502, f"Open-Meteo unreachable: {e}")

@router.get("/weather_by_coords")
async def weather_by_coords(lat: float, lon: float):
    data = await _fetch_weather(lat, lon)
    return {"coords": {"lat": lat, "lon": lon}, "weather": data.get("hourly", {})}
