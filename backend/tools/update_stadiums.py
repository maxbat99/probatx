import csv, time
from SPARQLWrapper import SPARQLWrapper, JSON
from pathlib import Path

INPUT = Path("data/external/world_stadiums.csv")
OUTPUT = Path("data/external/world_stadiums_updated.csv")

sparql = SPARQLWrapper("https://query.wikidata.org/sparql")
sparql.setHTTPHeader("User-Agent", "ProbaX updater/1.0 (you@example.com)")

def query_stadium(name, country):
    q = f'''
    SELECT ?stadium ?stadiumLabel ?coord ?abolished WHERE {{
      ?stadium rdfs:label "{name}"@en;
               wdt:P31/wdt:P279* wd:Q641226;
               wdt:P625 ?coord.
      OPTIONAL {{ ?stadium wdt:P576 ?abolished. }}
      OPTIONAL {{ ?stadium wdt:P17 ?ccc. VALUES ?ccc {{ wd:{country} }} }}
      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
    }} LIMIT 1
    '''
    sparql.setQuery(q)
    sparql.setReturnFormat(JSON)
    res = sparql.query().convert()
    bindings = res.get("results", {}).get("bindings", [])
    if not bindings:
        return None
    b = bindings[0]
    coord = b["coord"]["value"]  # "Point(lon lat)"
    import re; m = re.match(r"Point\(([-\d.]+) ([-\d.]+)\)", coord)
    if not m:
        return None
    lon, lat = m.group(1), m.group(2)
    name_current = b["stadiumLabel"]["value"]
    abolished = b.get("abolished", {}).get("value", "")
    return {"name": name_current, "lat": lat, "lon": lat, "abolished": abolished}

with INPUT.open(encoding="utf-8", newline="") as inf, OUTPUT.open("w", encoding="utf-8", newline="") as outf:
    reader = csv.DictReader(inf)
    fieldnames = reader.fieldnames + ["name_current","lat_wd","lon_wd","active"]
    writer = csv.DictWriter(outf, fieldnames=fieldnames)
    writer.writeheader()
    for row in reader:
        print("Processing:", row["name"])
        res = query_stadium(row["name"], row.get("country",""))
        active = "unknown"
        if res:
            row["name_current"] = res["name"]
            row["lat_wd"] = res["lat"]
            row["lon_wd"] = res["lon"]
            active = "" if res["abolished"] else "true"
            if res["abolished"]:
                active = "false"
        else:
            row["name_current"] = ""
            row["lat_wd"] = ""
            row["lon_wd"] = ""
        row["active"] = active
        writer.writerow(row)
        time.sleep(0.5)

print("Aggiornamento completato in", OUTPUT)
