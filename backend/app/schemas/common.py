from pydantic import BaseModel
from typing import Optional, Dict, List

class Team(BaseModel):
    id: str
    name: str
    league: Optional[str] = None
    country: Optional[str] = None

class OddsPrice(BaseModel):
    bookmaker: str
    market: str
    selection: str
    odds: float
    url: Optional[str] = None

class Factor(BaseModel):
    key: str
    label: str
    score: float
    weight: float
    rationale: Optional[str] = None
    sources: Optional[List[str]] = None

class MarketPrediction(BaseModel):
    market: str
    probabilities: Dict[str, float]
    pick: Dict[str, float | str]

class WeatherBlock(BaseModel):
    stadium: str
    lat: float
    lon: float
    kickoff_iso: str
    summary: str
    temperature_c: float
    wind_kmh: float
    precipitation_mm: float

class Injury(BaseModel):
    player: str
    status: str
    note: Optional[str] = None
