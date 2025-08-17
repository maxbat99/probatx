from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List, Dict
from ..schemas.common import OddsPrice, Factor, MarketPrediction, WeatherBlock, Injury

router = APIRouter(prefix="/match", tags=["aggregate"])

class AggregateRequest(BaseModel):
    homeId: str
    awayId: str
    kickoffIso: Optional[str] = None

@router.post("/aggregate")
async def aggregate(body: AggregateRequest):
    # ---- DEMO: restituisce un payload compatibile con il frontend ----
    home, away = body.homeId.title(), body.awayId.title()
    return {
        "match": { "id": f"{home}-{away}", "home": home, "away": away, "league": "Demo League", "kickoff_iso": body.kickoffIso },
        "predictions": [
            { "market":"1X2", "probabilities": {"Home":0.48,"Draw":0.26,"Away":0.26}, "pick":{"selection":"Home","confidence":0.48,"edge":0.15,"rationale":"Forma + Elo (demo)"} },
            { "market":"Doppia Chance","probabilities": {"1X":0.74,"12":0.74,"X2":0.52}, "pick":{"selection":"1X","confidence":0.74} },
            { "market":"Over/Under 2.5","probabilities": {"Over 2.5":0.54,"Under 2.5":0.46}, "pick":{"selection":"Over 2.5","confidence":0.54} },
            { "market":"BTTS","probabilities": {"Sì":0.56,"No":0.44}, "pick":{"selection":"Sì","confidence":0.56} },
        ],
        "top_pick": { "market":"1X2","selection":"Home","confidence":0.48,"edge":0.15 },
        "odds_best": [
            { "bookmaker":"DemoBooks","market":"1X2","selection":"Home","odds":2.05,"url":"https://example.com" }
        ],
        "factors": [
            { "key":"form","label":"Forma recente","score":0.78,"weight":0.25,"rationale":"4V-1P" },
            { "key":"inj","label":"Infortuni","score":0.62,"weight":0.20,"rationale":"1 titolare out" },
            { "key":"weather","label":"Meteo/Pitch","score":0.70,"weight":0.10,"rationale":"pioggia leggera" },
            { "key":"coach","label":"Rapporto squadra-allenatore","score":0.58,"weight":0.15 },
            { "key":"board","label":"Clima societario","score":0.55,"weight":0.10 }
        ],
        "injuries": {
            "home":[ {"player":"Mario Rossi","status":"out","note":"flessore"} ],
            "away":[ {"player":"John Smith","status":"doubtful"} ]
        },
        "weather": { "stadium": f"{home} Arena", "lat":45.46, "lon":9.19, "kickoff_iso": body.kickoffIso or "", "summary":"pioggerella, terreno morbido","temperature_c":18,"wind_kmh":14,"precipitation_mm":1.2 },
        "news": [ {"title":f"{home}, rinnovo allenatore in stallo","summary":"clima interno teso (demo)","url":"https://example.com","published_at":"2025-08-17T09:10:00Z"} ],
        "sources": ["demo"],
        "warnings": ["Dati fittizi in modalità demo"]
    }
