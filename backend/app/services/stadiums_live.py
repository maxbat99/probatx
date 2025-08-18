import os
import json
import unicodedata
from typing import List, Dict, Any
from pathlib import Path

import httpx
import aiosqlite

# Endpoint SPARQL di Wikidata
SPARQL = "https://query.wikidata.org/sparql"
USER_AGENT = "ProbaX/1.0 (https://github.com/maxbat99/probayx)"

# >>> Path corretti: backend/data/stadiums.db <<<
# Questo file si trova in: backend/app/services/stadiums_live.py
# parents[0] = .../services
# parents[1] = .../app
# parents[2] = .../backend  <-- QUI c'è la cartella "data"
DB_PATH = str((Path(__file__).resolve().parents[2] / "data" / "stadiums.db"))

def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return " ".join(s.lower().split())

SQL_INIT = """
CREATE TABLE IF NOT EXISTS stadiums (
  qid TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT,
  lat REAL,
  lon REAL,
  aliases TEXT,   -- JSON list
  updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_stadiums_name ON stadiums(name);
"""

SQL_UPSERT = """
INSERT INTO stadiums(qid,name,country,lat,lon,aliases,updated_at)
VALUES(?,?,?,?,?,?,strftime('%s','now'))
ON CONFLICT(qid) DO UPDATE SET
  name=excluded.name,
  country=excluded.country,
  lat=excluded.lat,
  lon=excluded.lon,
  aliases=excluded.aliases,
  updated_at=strftime('%s','now');
"""

async def _db():
    # Assicura che la cartella backend/data esista
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    db = await aiosqlite.connect(DB_PATH)
    await db.executescript(SQL_INIT)
    await db.commit()
    return db

async def live_search_wikidata(q: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    Ricerca LIVE su Wikidata: stadi (Q641226) con coordinate.
    Prima tenta match su label/alias; se 0 risultati, fallback con REGEX su label.
    """
    base_q = q.replace("'", " ")
    query = f"""
SELECT ?s ?sLabel ?alias ?lat ?lon ?countryLabel WHERE {{
  ?s wdt:P31/wdt:P279* wd:Q641226; wdt:P625 ?coord.
  OPTIONAL {{ ?s skos:altLabel ?alias FILTER(LANG(?alias) in ('en','it','es','fr','de')) }}
  OPTIONAL {{ ?s wdt:P17 ?country }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language 'en,it,es,fr,de'. }}
  BIND(geof:latitude(?coord) AS ?lat)
  BIND(geof:longitude(?coord) AS ?lon)
  FILTER(CONTAINS(LCASE(STR(?sLabel)), LCASE('{base_q}')) ||
         CONTAINS(LCASE(STR(?alias)),   LCASE('{base_q}')))
}}
LIMIT {limit}
"""
    headers = {"Accept": "application/sparql-results+json", "User-Agent": USER_AGENT}
    async with httpx.AsyncClient(timeout=20, headers=headers) as cx:
        r = await cx.post(SPARQL, data={"query": query})
        r.raise_for_status()
        data = r.json()

    rows: Dict[str, Dict[str, Any]] = {}
    for b in data.get("results", {}).get("bindings", []):
        uri = b.get("s", {}).get("value", "")
        qid = uri.rsplit("/", 1)[-1]
        name = b.get("sLabel", {}).get("value", "")
        alias = b.get("alias", {}).get("value", "")
        lat = float(b.get("lat", {}).get("value", "0") or 0)
        lon = float(b.get("lon", {}).get("value", "0") or 0)
        country = b.get("countryLabel", {}).get("value", "")
        if not name or not lat or not lon:
            continue
        rec = rows.setdefault(qid, {"qid": qid, "name": name, "country": country, "lat": lat, "lon": lon, "aliases": set()})
        if alias:
            rec["aliases"].add(alias)

    # FALLBACK: se 0 risultati, prova regex solo su label
    if not rows:
        fb_query = f"""
SELECT ?s ?sLabel ?lat ?lon ?countryLabel WHERE {{
  ?s wdt:P31/wdt:P279* wd:Q641226; wdt:P625 ?coord.
  OPTIONAL {{ ?s wdt:P17 ?country }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language 'en,it,es,fr,de'. }}
  BIND(geof:latitude(?coord) AS ?lat)
  BIND(geof:longitude(?coord) AS ?lon)
  FILTER(REGEX(LCASE(STR(?sLabel)), LCASE('{base_q}')))
}}
LIMIT {limit}
"""
        async with httpx.AsyncClient(timeout=20, headers=headers) as cx:
            r2 = await cx.post(SPARQL, data={"query": fb_query})
            r2.raise_for_status()
            data2 = r2.json()
        for b in data2.get("results", {}).get("bindings", []):
            uri = b.get("s", {}).get("value", "")
            qid = uri.rsplit("/", 1)[-1]
            name = b.get("sLabel", {}).get("value", "")
            lat = float(b.get("lat", {}).get("value", "0") or 0)
            lon = float(b.get("lon", {}).get("value", "0") or 0)
            country = b.get("countryLabel", {}).get("value", "")
            if not name or not lat or not lon:
                continue
            rows.setdefault(qid, {"qid": qid, "name": name, "country": country, "lat": lat, "lon": lon, "aliases": set()})

    out: List[Dict[str, Any]] = []
    for rec in rows.values():
        rec["aliases"] = sorted(rec["aliases"])
        out.append(rec)
    return out

async def cache_upsert_many(items: List[Dict[str, Any]]):
    db = await _db()
    for rec in items:
        aliases = json.dumps(rec.get("aliases", []), ensure_ascii=False)
        await db.execute(
            SQL_UPSERT,
            (rec["qid"], rec["name"], rec.get("country"), rec["lat"], rec["lon"], aliases),
        )
    await db.commit()
    await db.close()

async def cached_lookup(q: str, limit: int = 10) -> List[Dict[str, Any]]:
    db = await _db()
    qn = f"%{_norm(q)}%"
    sql = "SELECT qid,name,country,lat,lon,aliases FROM stadiums WHERE lower(name) LIKE lower(?) LIMIT ?"
    cur = await db.execute(sql, (qn, limit))
    rows = await cur.fetchall()
    await db.close()
    return [
        {
            "qid": r[0],
            "name": r[1],
            "country": r[2],
            "lat": r[3],
            "lon": r[4],
            "aliases": json.loads(r[5] or "[]"),
        }
        for r in rows
    ]
