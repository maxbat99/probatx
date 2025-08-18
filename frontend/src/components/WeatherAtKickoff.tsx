import React, { useMemo, useState } from "react";

/** -----------------------------
 *  Tipi di dato (risposta backend)
 *  -----------------------------
 *  Endpoint chiamato:
 *  /api/v1/weather/global?stadium=...&country=...&kickoff_iso=...
 */
type BackendResp = {
  query: {
    stadium?: string | null;
    team?: string | null;
    city?: string | null;
    country?: string | null;
    kickoff_iso_utc: string;
    tz_mode?: "both" | "utc" | "local";
  };
  coords?: {
    lat: number;
    lon: number;
    source?: Record<string, any>;
  } | null;
  results?: {
    utc?: {
      timezone: string;
      utc_offset_seconds: number;
      summary: WeatherSummary;
    };
    local?: {
      timezone: string;
      utc_offset_seconds: number;
      kickoff_local: string;
      summary: WeatherSummary;
    };
  } | null;
  // in caso l'API restituisca un errore formattato:
  detail?: string;
};

type WeatherSummary = {
  kickoff_iso: string;
  avg_temp?: number;
  avg_humidity?: number;
  total_precip?: number;
  avg_wind?: number;
  flags?: { rain_risk?: number; wind_risk?: boolean; heat_risk?: boolean };
  pitch_notes?: string[];
};

/* Helpers */
const fmt = {
  temp: (x?: number) => (x == null ? "—" : `${x.toFixed(1)}°C`),
  hum: (x?: number) => (x == null ? "—" : `${Math.round(x)}%`),
  rain: (x?: number) => (x == null ? "—" : `${x.toFixed(1)} mm`),
  wind: (x?: number) => (x == null ? "—" : `${x.toFixed(1)} m/s`),
};

function RiskBadge({
  show,
  label,
  tone,
}: {
  show?: boolean;
  label: string;
  tone: "rose" | "amber";
}) {
  if (!show) return null;
  const cls =
    tone === "rose"
      ? "bg-rose-100 text-rose-700 border-rose-300"
      : "bg-amber-100 text-amber-700 border-amber-300";
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${cls}`}>
      {label}
    </span>
  );
}

function SummaryCard({
  title,
  summary,
}: {
  title: string;
  summary?: WeatherSummary | null;
}) {
  const s = summary;
  return (
    <div className="rounded-lg border p-4">
      <div className="font-semibold mb-3">{title}</div>

      <div className="space-y-2 text-sm">
        <div>Temp media: {fmt.temp(s?.avg_temp)}</div>
        <div>Umidità media: {fmt.hum(s?.avg_humidity)}</div>
        <div>
          Pioggia totale: <b>{fmt.rain(s?.total_precip)}</b>
        </div>
        <div>Vento medio: {fmt.wind(s?.avg_wind)}</div>

        <div className="flex items-center gap-2 pt-1">
          <span className="text-[13px] text-gray-700">Rischi:</span>
          <RiskBadge
            show={(s?.flags?.rain_risk ?? 0) > 0.2}
            label="Pioggia"
            tone="rose"
          />
          <RiskBadge show={!!s?.flags?.wind_risk} label="Vento" tone="amber" />
          <RiskBadge show={!!s?.flags?.heat_risk} label="Caldo" tone="rose" />
          {!s?.flags?.rain_risk && !s?.flags?.wind_risk && !s?.flags?.heat_risk && (
            <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs bg-gray-100 text-gray-600 border-gray-300">
              nessuno
            </span>
          )}
        </div>

        {s?.pitch_notes && s.pitch_notes.length > 0 && (
          <ul className="list-disc ml-4 text-gray-700">
            {s.pitch_notes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function WeatherAtKickoff() {
  /** -----------------------------
   *  Stato form
   *  ----------------------------- */
  const [stadium, setStadium] = useState("San Siro");
  const [country, setCountry] = useState("Italy");
  const [kickoffIso, setKickoffIso] = useState("2025-08-25T18:45:00Z");

  /** -----------------------------
   *  Stato dati
   *  ----------------------------- */
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<BackendResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);

  const coordsLabel = useMemo(() => {
    if (!resp?.coords) return "—";
    const { lat, lon } = resp.coords;
    return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resp?.coords?.lat, resp?.coords?.lon]);

  async function onSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    try {
      setError(null);
      setLoading(true);
      setResp(null);

      const u = new URL("/api/v1/weather/global", window.location.origin);
      if (stadium) u.searchParams.set("stadium", stadium);
      if (country) u.searchParams.set("country", country);
      if (kickoffIso) u.searchParams.set("kickoff_iso", kickoffIso);
      // tz_mode both per avere UTC + locale
      u.searchParams.set("tz_mode", "both");

      const r = await fetch(u.toString());
      const text = await r.text();
      if (!r.ok) {
        // errori FastAPI spesso hanno {"detail":"..."}
        try {
          const j = JSON.parse(text);
          throw new Error(j.detail || `HTTP ${r.status}`);
        } catch {
          throw new Error(`HTTP ${r.status}`);
        }
      }
      const j: BackendResp = JSON.parse(text);
      if (j.detail) throw new Error(j.detail);
      setResp(j);
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  function onClear() {
    setResp(null);
    setError(null);
  }

  const utcKick = resp?.results?.utc?.summary.kickoff_iso ?? kickoffIso;
  const localKick = resp?.results?.local ? resp.results.local.kickoff_local : "—";

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Meteo al calcio d’inizio</h1>

      {/* FORM */}
      <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm">Stadio</span>
          <input
            className="border rounded-md px-3 py-2"
            value={stadium}
            onChange={(e) => setStadium(e.target.value)}
            placeholder="San Siro"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm">Paese</span>
          <input
            className="border rounded-md px-3 py-2"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Italy"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm">Kickoff (UTC ISO8601)</span>
          <input
            className="border rounded-md px-3 py-2"
            value={kickoffIso}
            onChange={(e) => setKickoffIso(e.target.value)}
            placeholder="2025-08-25T18:45:00Z"
          />
        </label>

        <div className="md:col-span-3 flex items-center gap-2">
          <button
            type="submit"
            className="rounded-md bg-black text-white px-4 py-2"
            disabled={loading}
          >
            {loading ? "Calcolo…" : "Calcola meteo"}
          </button>
          <button
            type="button"
            className="rounded-md border px-4 py-2"
            onClick={onClear}
            disabled={loading}
          >
            Pulisci
          </button>
        </div>
      </form>

      {/* ERROR */}
      {error && (
        <div className="rounded-md border border-rose-300 bg-rose-50 text-rose-700 px-3 py-2">
          Errore: {error}
        </div>
      )}

      {/* RISULTATI */}
      {resp && (
        <div className="rounded-xl border p-4 space-y-4">
          <div className="font-semibold text-lg">Riepilogo</div>
          <div className="text-sm space-y-1">
            <div>
              <b>Kickoff (UTC):</b> {utcKick}
            </div>
            <div>
              <b>Kickoff (locale):</b> {localKick}
            </div>
            <div>
              <b>Coordinate:</b> {coordsLabel}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <SummaryCard title="UTC" summary={resp.results?.utc?.summary} />
            <SummaryCard title="Locale" summary={resp.results?.local?.summary} />
          </div>

          {/* Debug JSON */}
          <details
            className="rounded-md border"
            open={false}
            onToggle={(e) => setDebugOpen((e.target as HTMLDetailsElement).open)}
          >
            <summary className="cursor-pointer px-3 py-2 text-sm">
              JSON grezzo (debug)
            </summary>
            {debugOpen && (
              <pre className="p-3 overflow-auto text-xs">
                {JSON.stringify(resp, null, 2)}
              </pre>
            )}
          </details>
        </div>
      )}
    </div>
  );
}
