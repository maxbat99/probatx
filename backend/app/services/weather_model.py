from typing import Dict, Any
from datetime import datetime, timedelta

def summarize_for_kickoff(wx: Dict[str, Any], kickoff_iso: str) -> Dict[str, Any]:
    """
    Sintetizza meteo ±2h attorno al kickoff.
    wx: risposta di Open-Meteo
    kickoff_iso: stringa ISO (in UTC o local, coerente col parametro timezone usato)
    """
    if "hourly" not in wx:
        return {"error": "no_hourly_data"}
    hourly = wx["hourly"]

    times = hourly.get("time", [])
    temps = hourly.get("temperature_2m", [])
    prec = hourly.get("precipitation", [])
    hums = hourly.get("relative_humidity_2m", [])
    winds = hourly.get("wind_speed_10m", [])

    if not times or not temps:
        return {"error": "no_time_or_temp"}

    try:
        k = datetime.fromisoformat(kickoff_iso.replace("Z",""))
    except Exception:
        return {"error": "invalid_kickoff"}

    window = timedelta(hours=2)
    values = {"temp": [], "prec": [], "hum": [], "wind": []}

    for i, t in enumerate(times):
        try:
            dt = datetime.fromisoformat(t)
        except Exception:
            continue
        if abs((dt - k).total_seconds()) <= window.total_seconds():
            if i < len(temps): values["temp"].append(temps[i])
            if i < len(prec): values["prec"].append(prec[i])
            if i < len(hums): values["hum"].append(hums[i])
            if i < len(winds): values["wind"].append(winds[i])

    def _avg(lst): return sum(lst)/len(lst) if lst else None

    return {
        "kickoff_iso": kickoff_iso,
        "avg_temp": _avg(values["temp"]),
        "avg_humidity": _avg(values["hum"]),
        "total_precip": sum(values["prec"]) if values["prec"] else 0,
        "avg_wind": _avg(values["wind"]),
        "flags": {
            "rain_risk": _avg(values["prec"]) and _avg(values["prec"]) > 0.5,
            "wind_risk": _avg(values["wind"]) and _avg(values["wind"]) > 25,
            "heat_risk": _avg(values["temp"]) and _avg(values["temp"]) > 30,
        },
        "pitch_notes": [
            note for flag, note in [
                ("rain_risk","Campo bagnato/scivoloso"),
                ("wind_risk","Vento forte: traiettorie alterate"),
                ("heat_risk","Caldo afoso: rischio cali fisici")
            ] if values and _avg(values.get(flag.split('_')[0], [])) and flag
        ]
    }
