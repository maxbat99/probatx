from fastapi import APIRouter, HTTPException, Query
from typing import Optional, Dict, Any
import httpx
from httpx import HTTPError
from datetime import datetime, timezone, timedelta

from ..services.geo import resolve_coords
from ..services.weather_model import summarize_for_kickoff

router = APIRouter(prefix="/weather", tags=["weather"])

OPEN_METEO = "https://api.open-meteo.com/v1/forecast"

async def _fetch_weather(lat: float, lon: float, tz: str) -> Dict[str, Any]:
    """
    tz: "UTC" oppure "auto" (fuso locale in base a lat/lon)
    """
    params = {
        "latitude": lat,
        "longitude": lon,
        "timezone": tz,
        "hourly": ",".join([
            "temperature_2m",
            "apparent_temperature",
            "relative_humidity_2m",
            "precipitation",
            "precipitation_probability",
            "cloud_cover",
            "wind_speed_10m",
            "wind_gusts_10m",
            "is_day"
        ]),
        "forecast_days": 7
    }
    headers = {"User-Agent":"ProbaX/1.0 (https://github.com/maxbat99/probayx)"}
    async with httpx.AsyncClient(timeout=20, headers=headers) as cx:
        try:
            r = await cx.get(OPEN_METEO, params=params)
            r.raise_for_status()
            return r.json()
        except HTTPError as e:
            raise HTTPException(502, f"Open-Meteo unreachable: {e}")

def _parse_utc(iso_z: str) -> datetime:
    # Accetta "YYYY-MM-DDTHH:MM:SSZ" (UTC)
    s = iso_z.strip()
    if not s.endswith("Z"):
        # Se non c'è Z, assumiamo comunque UTC
        return datetime.fromisoformat(s.replace("Z","")).replace(tzinfo=timezone.utc)
    return datetime.fromisoformat(s[:-1]).replace(tzinfo=timezone.utc)

def _fmt_naive_local(dt: datetime) -> str:
    # restituisce ISO senza suffisso Z (naive, in orario locale)
    # esempio: "2025-08-18T20:45:00"
    return dt.replace(tzinfo=None).isoformat(timespec="seconds")

@router.get("/global")
async def weather_global(
    stadium: Optional[str] = None,
    team: Optional[str] = None,
    city: Optional[str] = None,
    country: Optional[str] = None,
    kickoff_iso: str = Query(..., description="Kickoff in UTC, es. 2025-08-18T18:45:00Z"),
    tz_mode: str = Query("both", pattern="^(utc|local|both)$", description="Quale fuso usare: utc | local | both")
):
    """
    Restituisce meteo orario e sintesi attorno al kickoff in:
    - UTC
    - Fuso locale dello stadio (timezone=auto da Open-Meteo)
    - Oppure entrambi (default)
    """
    # 1) risolvi coordinate
    coords = await resolve_coords(stadium=stadium, team=team, city=city, country=country)
    if not coords:
        raise HTTPException(400, "Impossibile risolvere coordinate (stadium/team/city/country)")
    lat, lon, meta = coords

    # kickoff utc (datetime aware)
    try:
        k_utc = _parse_utc(kickoff_iso)
    except Exception:
        raise HTTPException(400, "kickoff_iso non valido: usa formato ISO UTC es. 2025-08-18T18:45:00Z")

    out: Dict[str, Any] = {
        "query": {"stadium": stadium, "team": team, "city": city, "country": country, "kickoff_iso_utc": kickoff_iso, "tz_mode": tz_mode},
        "coords": {"lat": lat, "lon": lon, "source": meta},
        "results": {}
    }

    # 2a) UTC
    if tz_mode in ("utc","both"):
        wx_utc = await _fetch_weather(lat, lon, tz="UTC")
        summary_utc = summarize_for_kickoff(wx_utc, kickoff_iso=kickoff_iso)  # times = UTC
        out["results"]["utc"] = {
            "timezone": wx_utc.get("timezone","UTC"),
            "utc_offset_seconds": wx_utc.get("utc_offset_seconds", 0),
            "summary": summary_utc
        }

    # 2b) LOCALE (timezone=auto). Serve convertire kickoff_utc in ora locale usando utc_offset_seconds.
    if tz_mode in ("local","both"):
        wx_loc = await _fetch_weather(lat, lon, tz="auto")
        # offset (es. +7200 per CET in estate)
        offset_sec = int(wx_loc.get("utc_offset_seconds", 0) or 0)
        k_local = k_utc + timedelta(seconds=offset_sec)
        kickoff_iso_local = _fmt_naive_local(k_local)  # stringa senza Z, in ora locale dello stadio
        summary_local = summarize_for_kickoff(wx_loc, kickoff_iso=kickoff_iso_local)  # times = local
        out["results"]["local"] = {
            "timezone": wx_loc.get("timezone","local"),
            "utc_offset_seconds": offset_sec,
            "kickoff_local": kickoff_iso_local,
            "summary": summary_local
        }

    return out
