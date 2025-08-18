"""
Scarica da Wikidata (SPARQL) gli stadi di calcio con coordinate e genera backend/data/stadiums.csv
"""
import csv, httpx, pathlib

OUT = pathlib.Path(__file__).resolve().parents[1] / "data" / "stadiums.csv"
SPARQL = "https://query.wikidata.org/sparql"
QUERY = r"""
SELECT ?stadiumLabel ?lat ?lon ?countryLabel WHERE {
  ?stadium wdt:P31/wdt:P279* wd:Q641226;  # stadio di calcio
           wdt:P625 ?coord.
  OPTIONAL { ?stadium wdt:P17 ?country. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  BIND(geof:latitude(?coord) AS ?lat)
  BIND(geof:longitude(?coord) AS ?lon)
}
LIMIT 20000
"""

def run():
  headers = {
    "Accept": "application/sparql-results+json",
    "User-Agent": "ProbaX/1.0 (https://github.com/maxbat99/probayx)"
  }
  with httpx.Client(timeout=30, headers=headers) as cx:
    r = cx.post(SPARQL, data={"query": QUERY})
    r.raise_for_status()
    data = r.json()

  rows = []
  for b in data["results"]["bindings"]:
    stadium = b.get("stadiumLabel",{}).get("value","").strip()
    lat = b.get("lat",{}).get("value","")
    lon = b.get("lon",{}).get("value","")
    country = b.get("countryLabel",{}).get("value","")
    if stadium and lat and lon:
      rows.append({
        "stadium": stadium, "team": "", "league": "",
        "country": country, "lat": lat, "lon": lon
      })

  OUT.parent.mkdir(parents=True, exist_ok=True)
  with open(OUT, "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=["stadium","team","league","country","lat","lon"])
    w.writeheader()
    w.writerows(rows)

  print(f"Stadi salvati: {len(rows)} in {OUT}")

if __name__ == "__main__":
  run()
