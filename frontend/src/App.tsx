import React, { useEffect, useMemo, useRef, useState } from "react";

/** CONFIG: cambia qui l’endpoint del backend (per Netlify deve essere pubblico) */
const API_BASE =
  import.meta.env.VITE_API_BASE?.toString() || "http://127.0.0.1:8000";

/** ===== Tipi (best-effort, i campi extra sono opzionali) ===== */
type TeamSuggest = { name: string; country?: string; id?: string };
type PredictResp = {
  ok?: boolean;
  home: string;
  away: string;
  // probabilità 1X2 (0-1)
  p_home: number;
  p_draw: number;
  p_away: number;
  // meta opzionali (se presenti attiviamo meteo “nascosto”)
  meta?: {
    stadium?: string;
    country?: string;
    kickoff_iso_utc?: string; // ISO8601 UTC
  };
  // riepilogo/edge opzionale
  edge_note?: string;
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
type WeatherResp = {
  results?: {
    utc?: { summary: WeatherSummary };
    local?: { summary: WeatherSummary; kickoff_local: string };
  };
};

const fmtPct = (x: number | undefined) =>
  x == null ? "—" : `${Math.round(x * 100)}%`;

/** badge discreti per i rischi meteo (non apriamo pannelli) */
function RiskBadge({
  show,
  label,
  tone,
  title,
}: {
  show?: boolean;
  label: string;
  tone: "rose" | "amber" | "sky";
  title?: string;
}) {
  if (!show) return null;
  const palette =
    tone === "rose"
      ? "bg-rose-100 text-rose-700 border-rose-300"
      : tone === "amber"
      ? "bg-amber-100 text-amber-700 border-amber-300"
      : "bg-sky-100 text-sky-700 border-sky-300";
  return (
    <span
      title={title || label}
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${palette}`}
      style={{ userSelect: "none" }}
    >
      {label}
    </span>
  );
}

export default function App() {
  /** form */
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [homeSugg, setHomeSugg] = useState<TeamSuggest[]>([]);
  const [awaySugg, setAwaySugg] = useState<TeamSuggest[]>([]);
  const [loadingSugg, setLoadingSugg] = useState({ home: false, away: false });

  /** risultato */
  const [loading, setLoading] = useState(false);
  const [pred, setPred] = useState<PredictResp | null>(null);
  const [err, setErr] = useState<string | null>(null);

  /** meteo “nascosto” */
  const [wx, setWx] = useState<WeatherSummary | null>(null);
  const [wxLocalKick, setWxLocalKick] = useState<string | null>(null);

  const debHome = useRef<number | null>(null);
  const debAway = useRef<number | null>(null);

  /** ---- autocomplete squadre (best-effort sugli endpoint comuni) ---- */
  useEffect(() => {
    if (home.trim().length < 2) {
      setHomeSugg([]);
      return;
    }
    if (debHome.current) window.clearTimeout(debHome.current);
    debHome.current = window.setTimeout(async () => {
      try {
        setLoadingSugg((s) => ({ ...s, home: true }));
        // Prova 1: /api/v1/teams/suggest?q=
        let r = await fetch(
          `${API_BASE}/api/v1/teams/suggest?q=${encodeURIComponent(home)}`
        );
        if (!r.ok) throw new Error("s1");
        const j = (await r.json()) as TeamSuggest[];
        setHomeSugg(j || []);
      } catch {
        // Prova 2 di fallback: /api/v1/teams/autocomplete?q=
        try {
          const r2 = await fetch(
            `${API_BASE}/api/v1/teams/autocomplete?q=${encodeURIComponent(
              home
            )}`
          );
          const j2 = (await r2.json()) as TeamSuggest[];
          setHomeSugg(j2 || []);
        } catch {
          setHomeSugg([]);
        }
      } finally {
        setLoadingSugg((s) => ({ ...s, home: false }));
      }
    }, 200);
  }, [home]);

  useEffect(() => {
    if (away.trim().length < 2) {
      setAwaySugg([]);
      return;
    }
    if (debAway.current) window.clearTimeout(debAway.current);
    debAway.current = window.setTimeout(async () => {
      try {
        setLoadingSugg((s) => ({ ...s, away: true }));
        let r = await fetch(
          `${API_BASE}/api/v1/teams/suggest?q=${encodeURIComponent(away)}`
        );
        if (!r.ok) throw new Error("s1");
        const j = (await r.json()) as TeamSuggest[];
        setAwaySugg(j || []);
      } catch {
        try {
          const r2 = await fetch(
            `${API_BASE}/api/v1/teams/autocomplete?q=${encodeURIComponent(
              away
            )}`
          );
          const j2 = (await r2.json()) as TeamSuggest[];
          setAwaySugg(j2 || []);
        } catch {
          setAwaySugg([]);
        }
      } finally {
        setLoadingSugg((s) => ({ ...s, away: false }));
      }
    }, 200);
  }, [away]);

  /** ---- pronostico ---- */
  async function onPredict(e?: React.FormEvent) {
    e?.preventDefault();
    setErr(null);
    setPred(null);
    setWx(null);
    setWxLocalKick(null);
    try {
      if (!home || !away) throw new Error("Inserisci entrambe le squadre.");
      setLoading(true);

      // Prova POST JSON, poi fallback GET
      let pr: PredictResp | null = null;
      try {
        const r = await fetch(`${API_BASE}/api/v1/odds/predict`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ home, away }),
        });
        if (!r.ok) throw new Error("POST fail");
        pr = (await r.json()) as PredictResp;
      } catch {
        const r2 = await fetch(
          `${API_BASE}/api/v1/odds/predict?home=${encodeURIComponent(
            home
          )}&away=${encodeURIComponent(away)}`
        );
        if (!r2.ok) throw new Error("Impossibile calcolare il pronostico.");
        pr = (await r2.json()) as PredictResp;
      }

      setPred(pr);

      // Meteo “nascosto” se il backend ci ha dato metadati sufficienti
      const st = pr?.meta?.stadium;
      const ctry = pr?.meta?.country;
      const kISO = pr?.meta?.kickoff_iso_utc;
      if (st && ctry && kISO) {
        try {
          const url = new URL(`${API_BASE}/api/v1/weather/global`);
          url.searchParams.set("stadium", st);
          url.searchParams.set("country", ctry);
          url.searchParams.set("kickoff_iso", kISO);
          url.searchParams.set("tz_mode", "both");
          const wr = await fetch(url.toString());
          if (wr.ok) {
            const wj = (await wr.json()) as WeatherResp;
            // Preferiamo il locale, altrimenti UTC
            const sLoc = wj.results?.local?.summary;
            const sUtc = wj.results?.utc?.summary;
            const chosen = sLoc ?? sUtc ?? null;
            setWx(chosen);
            setWxLocalKick(wj.results?.local?.kickoff_local ?? null);
          }
        } catch {
          // Silenzio: se non disponibile non mostriamo nulla
        }
      }
    } catch (e: any) {
      setErr(e?.message || "Errore sconosciuto.");
    } finally {
      setLoading(false);
    }
  }

  /** suggerimenti cliccabili */
  const HomeList = useMemo(
    () =>
      homeSugg.slice(0, 6).map((t) => (
        <button
          key={`${t.id || t.name}-${t.country || ""}`}
          type="button"
          onClick={() => setHome(t.name)}
          className="px-2 py-1 text-sm rounded hover:bg-white/20 transition"
        >
          {t.name} {t.country ? `(${t.country})` : ""}
        </button>
      )),
    [homeSugg]
  );
  const AwayList = useMemo(
    () =>
      awaySugg.slice(0, 6).map((t) => (
        <button
          key={`${t.id || t.name}-${t.country || ""}`}
          type="button"
          onClick={() => setAway(t.name)}
          className="px-2 py-1 text-sm rounded hover:bg-white/20 transition"
        >
          {t.name} {t.country ? `(${t.country})` : ""}
        </button>
      )),
    [awaySugg]
  );

  const rain = (wx?.flags?.rain_risk ?? 0) > 0.2;
  const wind = !!wx?.flags?.wind_risk;
  const heat = !!wx?.flags?.heat_risk;

  return (
    <div
      className="min-h-screen text-white"
      style={{
        backgroundImage:
          "linear-gradient(to bottom, rgba(0,0,0,.65), rgba(0,0,0,.65)), url(/stadium-fans-background.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <header className="flex items-center justify-between px-6 py-4">
        <div className="font-semibold">ProbaX — Betting Intelligence</div>
        <button
          className="text-sm border border-white/30 rounded px-3 py-1 hover:bg-white/10"
          onClick={() => {
            setHome("");
            setAway("");
            setPred(null);
            setWx(null);
            setErr(null);
          }}
        >
          Reset
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-4 pb-14">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mt-6">
          Trova il valore. Gioca le percentuali.
        </h1>
        <p className="text-white/80 mt-3 max-w-3xl">
          Seleziona due squadre, vedi le probabilità 1X2 e le giocate con il
          miglior edge. L’algoritmo considera in modo discreto anche fattori
          situazionali (campo, forma, e meteo al kickoff quando disponibile).
        </p>

        <form
          onSubmit={onPredict}
          className="mt-8 rounded-2xl bg-white/10 backdrop-blur-md p-4 border border-white/15"
        >
          <div className="grid md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
            {/* Home */}
            <label className="flex flex-col">
              <span className="text-sm text-white/80">Squadra Casa</span>
              <input
                className="h-12 rounded-md px-3 text-black"
                value={home}
                onChange={(e) => setHome(e.target.value)}
                placeholder="Es. Milan"
              />
              <div className="mt-1 text-xs text-white/70">
                Digita almeno 2 lettere per l’autocomplete. Copertura globale.
              </div>
              {loadingSugg.home ? (
                <div className="text-xs mt-1 text-white/70">caricamento…</div>
              ) : homeSugg.length > 0 ? (
                <div className="mt-1 flex flex-wrap gap-1">{HomeList}</div>
              ) : null}
            </label>

            {/* Away */}
            <label className="flex flex-col">
              <span className="text-sm text-white/80">Squadra Trasferta</span>
              <input
                className="h-12 rounded-md px-3 text-black"
                value={away}
                onChange={(e) => setAway(e.target.value)}
                placeholder="Es. Inter"
              />
              {loadingSugg.away ? (
                <div className="text-xs mt-1 text-white/70">caricamento…</div>
              ) : awaySugg.length > 0 ? (
                <div className="mt-1 flex flex-wrap gap-1">{AwayList}</div>
              ) : null}
            </label>

            <button
              type="submit"
              disabled={loading}
              className="h-12 rounded-md px-6 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60"
            >
              {loading ? "Calcolo…" : "➡ Pronostica"}
            </button>
          </div>
        </form>

        {err && (
          <div className="mt-4 text-sm text-rose-200 bg-rose-900/40 border border-rose-700 rounded px-3 py-2">
            Errore: {err}
          </div>
        )}

        {pred && (
          <section className="mt-8 space-y-4">
            <div className="text-lg font-semibold">
              {pred.home} vs {pred.away}
            </div>

            {/* Probabilità 1X2 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl bg-white/10 border border-white/15 p-4">
                <div className="text-sm text-white/70">1 — Casa</div>
                <div className="text-3xl font-bold">{fmtPct(pred.p_home)}</div>
              </div>
              <div className="rounded-xl bg-white/10 border border-white/15 p-4">
                <div className="text-sm text-white/70">X — Pareggio</div>
                <div className="text-3xl font-bold">{fmtPct(pred.p_draw)}</div>
              </div>
              <div className="rounded-xl bg-white/10 border border-white/15 p-4">
                <div className="text-sm text-white/70">2 — Trasferta</div>
                <div className="text-3xl font-bold">{fmtPct(pred.p_away)}</div>
              </div>
            </div>

            {/* micro-influenze meteo: badge discreti */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-white/70">Fattori situazione:</span>
              {/* Mostriamo badge solo se li abbiamo calcolati */}
              <RiskBadge
                show={rain}
                label="Pioggia"
                tone="sky"
                title="Pioggia prevista al kickoff (può abbassare ritmo/gol attesi)."
              />
              <RiskBadge
                show={wind}
                label="Vento"
                tone="amber"
                title="Vento forte: traiettorie e xG da distanza possono calare."
              />
              <RiskBadge
                show={heat}
                label="Caldo"
                tone="rose"
                title="Caldo anomalo: rischio calo intensità nella ripresa."
              />
              {!rain && !wind && !heat && (
                <span className="text-white/60">nessuno rilevante</span>
              )}
              {wxLocalKick && (
                <span className="ml-2 text-white/60">
                  kickoff locale: {wxLocalKick}
                </span>
              )}
            </div>

            {/* Nota edge (se fornita dal backend) */}
            {pred.edge_note && (
              <div className="text-sm text-emerald-200 bg-emerald-900/40 border border-emerald-700 rounded px-3 py-2">
                {pred.edge_note}
              </div>
            )}

            {/* mini-disclaimer */}
            <p className="text-xs text-white/60">
              Le percentuali sono stime probabilistiche. Non costituiscono
              consulenza finanziaria: gioca responsabilmente.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
