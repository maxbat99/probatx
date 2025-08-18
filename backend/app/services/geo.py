import csv
from pathlib import Path
from typing import Optional, Tuple, List, Dict

import httpx

# Path CSV stadi (backend/data/stadiums.csv)
DATA_DIR = Path(__file__).resolve().parents[2] / "data"
CSV_PATH = DATA_DIR / "stadiums.csv"

def _load_csv() -> List[Dict[str, str]]:
    if not CSV_PATH.exists():
        return []
    rows: List[Dict[str, str]] = []
    with open(CSV_PATH, "r", encoding="utf-8", newline="") as f:
        r = csv.DictReader(f)
        for row in r:
            rows.append(row)
    return rows

def _norm(s: str) -> str:
    return " ".join((s or "").strip().lower().split())

def _search_csv(stadium: Optional[str], team: Optional[str], city: Optional[str], country: Optional[str]) -> Optional[Tuple[float, float, Dict[str,str]]]:
    rows = _load_csv()
    if not rows:
        return None
    cand: List[Dict[str,str]] = []
    sN, tN, cN, coN = map(_norm, [stadium or "", team or "", city or "", country or ""])
    for r in rows:
        rn = {k:_norm(r.get(k,"")) for k in ["stadium","team","league","country"]}
        # priorità: match stadio + country o city
        score = 0
        if sN and sN in rn["stadium"]:
            score += 3
        if tN and tN in rn["team"]:
            score += 2
        if cN and cN in rn["league"]:
            score += 1  # spesso il CSV non ha city, usiamo league come fallback
        if coN and coN in rn["country"]:
            score += 1
        if score>0:
            cand.append({"_score":str(score), **r})
    if not cand:
        return None
    # prendi il migliore
    cand.sort(key=lambda x:int(x["_score"]), reverse=True)
    top = cand[0]
    try:
        lat = float(top.get("lat",""))
        lon = float(top.get("lon",""))
        return lat, lon, top
    except:
        return None

async def _geocode_openmeteo(q: str, country: Optional[str]=None) -> Optional[Tuple[float,float,Dict[str,str]]]:
    """
    Fallback di geocoding globale (Open-Meteo Geocoding API)
    Docs: https://open-meteo.com/en/docs/geocoding-api
    """
    if not q.strip():
        return None
    params = {"name": q, "count": 10, "format": "json", "language": "en"}
    # NOTA: l'API supporta 'country' come codice ISO2 in alcuni casi; qui filtriamo lato client per solidità
    headers = {"User-Agent":"ProbaX/1.0 (https://github.com/maxbat99/probayx)"}
    async with httpx.AsyncClient(timeout=15, headers=headers) as cx:
        r = await cx.get("https://geocoding-api.open-meteo.com/v1/search", params=params)
        r.raise_for_status()
        js = r.json()
    results = js.get("results") or []
    if not results:
        return None

    def _pick(rs: List[Dict], country_name: Optional[str]) -> Dict:
        if not country_name:
            return rs[0]
        cn = _norm(country_name)
        # prova match per country o admin1/admin2
        for it in rs:
            ctry = _norm(it.get("country",""))
            admin1 = _norm(it.get("admin1",""))
            admin2 = _norm(it.get("admin2",""))
            if cn and (cn in ctry or cn in admin1 or cn in admin2):
                return it
        return rs[0]

    chosen = _pick(results, country)
    lat = chosen.get("latitude")
    lon = chosen.get("longitude")
    if lat is None or lon is None:
        return None
    meta = {
        "name": chosen.get("name",""),
        "country": chosen.get("country",""),
        "admin1": chosen.get("admin1",""),
        "admin2": chosen.get("admin2",""),
    }
    return float(lat), float(lon), meta

async def resolve_coords(stadium: Optional[str], team: Optional[str], city: Optional[str], country: Optional[str]) -> Optional[Tuple[float, float, Dict[str,str]]]:
    """
    Ritorna (lat, lon, source_meta) oppure None se impossibile.
    Strategia:
    1) CSV locale (backend/data/stadiums.csv) se presente
    2) Fallback geocoding Open-Meteo con query combinata "stadium team city country"
    """
    # 1) CSV locale
    hit = _search_csv(stadium, team, city, country)
    if hit:
        lat, lon, meta = hit
        meta["_source"] = "csv"
        return lat, lon, meta

    # 2) Geocoding globale
    query = " ".join([x for x in [stadium, team, city, country] if x])
    geo = await _geocode_openmeteo(query, country=country)
    if geo:
        lat, lon, meta = geo
        meta["_source"] = "geocoding"
        return lat, lon, meta

    return None
def load_stadiums():
    """Legge backend/data/stadiums.csv e restituisce una lista di stadi con lat/lon."""
    import csv, pathlib
    path = pathlib.Path(__file__).resolve().parents[2] / "data" / "stadiums.csv"
    rows = []
    if path.exists():
        with open(path, newline="", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                try:
                    rows.append({
                        "stadium": r.get("stadium",""),
                        "team": r.get("team",""),
                        "league": r.get("league",""),
                        "country": r.get("country",""),
                        "lat": float(r.get("lat") or 0),
                        "lon": float(r.get("lon") or 0),
                    })
                except Exception:
                    continue
    return rows
