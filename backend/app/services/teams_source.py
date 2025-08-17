import os, asyncio, aiohttp
from typing import Dict, List
from ..utils.filecache import read_json, write_json

THESPORTSDB_KEY = os.getenv("THESPORTSDB_API_KEY")
USER_AGENT = "ProbaX/1.0 (+local)"

API_TSD_BASE = "https://www.thesportsdb.com/api/v1/json"
API_WD_SPARQL = "https://query.wikidata.org/sparql"

async def _fetch_json(session: aiohttp.ClientSession, url: str, params: dict=None, headers: dict=None):
    async with session.get(url, params=params, headers=headers) as r:
        r.raise_for_status()
        return await r.json(content_type=None)

async def fetch_all_soccer_teams_tsd(session: aiohttp.ClientSession) -> List[Dict]:
    leagues_url = f"{API_TSD_BASE}/{THESPORTSDB_KEY or '3'}/all_leagues.php"
    leagues = await _fetch_json(session, leagues_url)
    leagues = [l for l in leagues.get("leagues", []) if l.get("strSport")=="Soccer"]
    teams: List[Dict] = []
    for lg in leagues:
        lid = lg.get("idLeague")
        if not lid: continue
        teams_url = f"{API_TSD_BASE}/{THESPORTSDB_KEY or '3'}/lookup_all_teams.php"
        data = await _fetch_json(session, teams_url, params={"id": lid})
        for t in data.get("teams", []) or []:
            name = t.get("strTeam")
            if not name: continue
            teams.append({
                "id": f"tsd:{t.get('idTeam')}",
                "name": name,
                "league": t.get("strLeague"),
                "country": t.get("strCountry") or t.get("strTeamShort"),
            })
    return teams

async def fetch_soccer_teams_wikidata(session: aiohttp.ClientSession) -> List[Dict]:
    query = """
    SELECT ?team ?teamLabel ?countryLabel WHERE {
      ?team wdt:P31/wdt:P279* wd:Q476028 ;
            wdt:P17 ?country .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en,it,es,fr,de". }
    }
    """
    headers = {"User-Agent": USER_AGENT, "Accept":"application/sparql-results+json"}
    data = await _fetch_json(session, API_WD_SPARQL, params={"query": query, "format":"json"}, headers=headers)
    out = []
    for b in data.get("results", {}).get("bindings", []):
        out.append({
            "id": f"wd:{b['team']['value'].split('/')[-1]}",
            "name": b["teamLabel"]["value"],
            "league": None,
            "country": b.get("countryLabel", {}).get("value")
        })
    return out

def _cache_path() -> str:
    from ..utils.filecache import cache_path
    return cache_path("teams_index.json")

def load_team_index() -> List[Dict]:
    data = read_json("teams_index.json") or {}
    return data.get("teams", [])

def search_index(q: str, limit: int=20) -> List[Dict]:
    teams = load_team_index()
    ql = q.lower()
    res = []
    for t in teams:
        if ql in t["name"].lower():
            res.append({"id": t["id"], "name": t["name"], "league": t.get("league"), "country": t.get("country")})
            if len(res) >= limit: break
    return res

def top_suggestions(limit: int=30) -> List[Dict]:
    teams = load_team_index()
    top_countries = {"England","Spain","Italy","Germany","France","Netherlands","Portugal","Brazil","Argentina","USA","Mexico","Japan","Saudi Arabia"}
    head = [t for t in teams if (t.get("country") in top_countries)]
    tail = [t for t in teams if (t.get("country") not in top_countries)]
    out = head[:limit//2] + tail[:limit//2]
    seen=set(); uniq=[]
    for t in out + teams:
        k=(t["name"], t.get("country"))
        if k in seen: continue
        seen.add(k); uniq.append({"id":t["id"],"name":t["name"],"league":t.get("league"),"country":t.get("country")})
        if len(uniq)>=limit: break
    return uniq

async def rebuild_team_index() -> Dict:
    import os
    os.makedirs(os.path.join(os.path.dirname(__file__), "..", "..", "cache"), exist_ok=True)
    async with aiohttp.ClientSession(headers={"User-Agent": USER_AGENT}) as session:
        teams: List[Dict] = []
        try:
            tsd = await fetch_all_soccer_teams_tsd(session)
            if tsd:
                teams = tsd
        except Exception:
            pass
        if not teams:
            wd = await fetch_soccer_teams_wikidata(session)
            teams = wd
    # dedup
    seen = set(); dedup=[]
    for t in teams:
        key = (t["name"].lower(), (t.get("country") or "").lower())
        if key in seen: continue
        seen.add(key); dedup.append(t)
    dedup.sort(key=lambda x: (x.get("country") or "zzz", x["name"]))
    write_json("teams_index.json", {"count": len(dedup), "teams": dedup})
    return {"count": len(dedup)}
