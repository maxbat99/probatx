"""
Ingest “world-stadiums” CSV e merge con data/stadiums.csv esistente
Output finale: data/stadiums.csv (unione deduplicata)
"""

from pathlib import Path
import csv, math

ROOT = Path(__file__).resolve().parents[1]
SRC_WORLD = ROOT / "data" / "external" / "world_stadiums.csv"
SRC_LOCAL = ROOT / "data" / "stadiums.csv"       # quello generato da Wikidata (se c’è)
OUT       = ROOT / "data" / "stadiums.csv"       # sovrascriviamo con il merge

FIELDS = ["stadium","team","league","country","lat","lon"]

def as_float(x):
    try:
        return float(str(x).strip())
    except Exception:
        return None

def norm_row_from_world(row):
    """
    Il file world-stadiums tipicamente ha: name, city, country, lat, lng (a volte team/capacity)
    Normalizziamo ai nostri campi.
    """
    name = (row.get("name") or row.get("stadium") or "").strip()
    country = (row.get("country") or "").strip()
    team = (row.get("team") or "").strip()
    league = (row.get("league") or "").strip()  # spesso assente
    # colonne coordinate possono chiamarsi lat/lng oppure latitude/longitude
    lat = as_float(row.get("lat") or row.get("latitude"))
    lon = as_float(row.get("lng") or row.get("lon") or row.get("longitude"))

    if not name or lat is None or lon is None:
        return None

    return {
        "stadium": name,
        "team": team,
        "league": league,
        "country": country,
        "lat": f"{lat:.6f}",
        "lon": f"{lon:.6f}",
    }

def read_csv_safe(p: Path):
    rows = []
    if not p.exists():
        return rows
    with p.open("r", encoding="utf-8", newline="") as f:
        r = csv.DictReader(f)
        for b in r:
            rows.append(b)
    return rows

def key_of(r):
    # dedup su (nome normalizzato, lat, lon)
    name = (r.get("stadium") or "").strip().lower()
    lat = r.get("lat") or ""
    lon = r.get("lon") or ""
    try:
        latf = round(float(lat), 6)
        lonf = round(float(lon), 6)
    except Exception:
        return None
    return (name, latf, lonf)

def main():
    # 1) carica world-stadiums e normalizza
    world = []
    raw = read_csv_safe(SRC_WORLD)
    for b in raw:
        n = norm_row_from_world(b)
        if n:
            world.append(n)

    # 2) carica csv locale (Wikidata) se esiste
    local = []
    raw2 = read_csv_safe(SRC_LOCAL)
    for b in raw2:
        # assicuriamo i campi
        row = {k: (b.get(k,"") or "").strip() for k in FIELDS}
        # scarta se mancano coord
        if not row["stadium"] or not row["lat"] or not row["lon"]:
            continue
        local.append(row)

    # 3) merge + dedup
    merged = []
    seen = set()
    for s in (world + local):
        k = key_of(s)
        if not k or k in seen:
            continue
        seen.add(k)
        merged.append(s)

    # 4) scrivi OUT (sovrascrive)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(merged)

    print(f"Merged stadiums: {len(merged)} -> {OUT}")

if __name__ == "__main__":
    main()
