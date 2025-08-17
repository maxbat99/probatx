import { useEffect, useMemo, useState } from "react";
import { Search, Loader2, TrendingUp, AlertTriangle, Cloud, Newspaper, Trophy, Shield, Users, Target, RefreshCw, Info } from "lucide-react";

type OddsPrice = { bookmaker: string; market: string; selection: string; odds: number; url?: string };
type Factor = { key: string; label: string; score: number; weight: number; rationale?: string; sources?: string[] };
type MarketPrediction = { market: string; probabilities: Record<string, number>; pick: { selection: string; confidence: number; edge?: number; rationale?: string } };
type WeatherBlock = { stadium: string; lat: number; lon: number; kickoff_iso: string; summary: string; temperature_c: number; wind_kmh: number; precipitation_mm: number; condition_code?: string };
type Injury = { player: string; status: "out" | "doubtful" | "fit"; note?: string };
type NewsItem = { title: string; summary: string; url: string; published_at: string };
type AggregateResponse = {
  match: { id: string; home: string; away: string; league?: string; kickoff_iso?: string };
  predictions: MarketPrediction[];
  top_pick: { market: string; selection: string; confidence: number; edge?: number };
  odds_best: OddsPrice[];
  factors: Factor[];
  injuries: { home: Injury[]; away: Injury[] };
  weather?: WeatherBlock;
  news?: NewsItem[];
  sources?: string[];
  warnings?: string[];
};

const pct = (n:number)=> `${Math.round(n*100)}%`;

async function searchTeams(q: string) {
  const base = import.meta.env.VITE_API_BASE_URL || "";
  const r = await fetch(`${base}/api/v1/teams/search?q=${encodeURIComponent(q)}`);
  if (!r.ok) throw new Error("searchTeams failed");
  return (await r.json()) as { id: string; name: string; country?: string; league?: string }[];
}
async function fetchAggregate(homeId: string, awayId: string) {
  const base = import.meta.env.VITE_API_BASE_URL || "";
  const r = await fetch(`${base}/api/v1/match/aggregate`, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ homeId, awayId }) });
  if (!r.ok) throw new Error("aggregate failed");
  return (await r.json()) as AggregateResponse;
}

export default function App() {
  const [qHome, setQHome] = useState("");
  const [qAway, setQAway] = useState("");
  const [homeSel, setHomeSel] = useState<{id:string;name:string}|null>(null);
  const [awaySel, setAwaySel] = useState<{id:string;name:string}|null>(null);
  const [sugHome, setSugHome] = useState<{id:string;name:string}[]>([]);
  const [sugAway, setSugAway] = useState<{id:string;name:string}[]>([]);
  const [loadingSug, setLoadingSug] = useState({home:false, away:false});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [data, setData] = useState<AggregateResponse | null>(null);

  useEffect(() => {
    const run = async() => {
      if (qHome.trim().length < 2) { setSugHome([]); return; }
      try { setLoadingSug(s=>({...s,home:true})); const res = await searchTeams(qHome.trim()); setSugHome(res.map(r=>({id:r.id,name:r.name}))); } finally { setLoadingSug(s=>({...s,home:false})); }
    }; run();
  }, [qHome]);

  useEffect(() => {
    const run = async() => {
      if (qAway.trim().length < 2) { setSugAway([]); return; }
      try { setLoadingSug(s=>({...s,away:true})); const res = await searchTeams(qAway.trim()); setSugAway(res.map(r=>({id:r.id,name:r.name}))); } finally { setLoadingSug(s=>({...s,away:false})); }
    }; run();
  }, [qAway]);

  const canSubmit = useMemo(() => !!homeSel && !!awaySel && homeSel.id !== awaySel.id, [homeSel, awaySel]);

  async function onSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!canSubmit) return;
    setError(null); setLoading(true);
    try { const agg = await fetchAggregate(homeSel!.id, awaySel!.id); setData(agg); }
    catch (err:any) { setError(err?.message || "Errore"); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto p-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">ProbaX ⚽️</h1>
            <p className="opacity-70">Portale di probabilità e pronostici multi-fattore.</p>
          </div>
          <button onClick={()=>{ setData(null); setQHome(""); setQAway(""); setHomeSel(null); setAwaySel(null); }} className="inline-flex items-center gap-2 border rounded px-3 py-2">
            <RefreshCw size={16}/> Reset
          </button>
        </div>

        <form onSubmit={onSubmit} className="grid md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-5">
            <label className="block mb-1">Squadra 1 (Casa)</label>
            <div className="relative">
              <input className="w-full border rounded px-3 py-2" placeholder="Es. Milan" value={homeSel?.name ?? qHome} onChange={(e)=>{ setHomeSel(null); setQHome(e.target.value); }} />
              {(!homeSel && sugHome.length>0) && (
                <ul className="absolute z-20 w-full bg-white border rounded mt-1">
                  {sugHome.slice(0,8).map(s=>(
                    <li key={s.id} className="px-3 py-2 hover:bg-gray-50 cursor-pointer" onClick={()=>{ setHomeSel(s); setQHome(""); }}>{s.name}</li>
                  ))}
                  {loadingSug.home && <li className="px-3 py-2 text-sm opacity-70 flex items-center gap-2"><Loader2 size={14} className="animate-spin"/> Caricamento…</li>}
                </ul>
              )}
            </div>
          </div>

          <div className="md:col-span-5">
            <label className="block mb-1">Squadra 2 (Trasferta)</label>
            <div className="relative">
              <input className="w-full border rounded px-3 py-2" placeholder="Es. Inter" value={awaySel?.name ?? qAway} onChange={(e)=>{ setAwaySel(null); setQAway(e.target.value); }} />
              {(!awaySel && sugAway.length>0) && (
                <ul className="absolute z-20 w-full bg-white border rounded mt-1">
                  {sugAway.slice(0,8).map(s=>(
                    <li key={s.id} className="px-3 py-2 hover:bg-gray-50 cursor-pointer" onClick={()=>{ setAwaySel(s); setQAway(""); }}>{s.name}</li>
                  ))}
                  {loadingSug.away && <li className="px-3 py-2 text-sm opacity-70 flex items-center gap-2"><Loader2 size={14} className="animate-spin"/> Caricamento…</li>}
                </ul>
              )}
            </div>
          </div>

          <div className="md:col-span-2">
            <button type="submit" disabled={!canSubmit || loading} className="w-full border rounded px-3 py-2 inline-flex items-center justify-center gap-2">
              {loading ? (<><Loader2 size={16} className="animate-spin"/> Calcolo…</>) : (<><Target size={16}/> Pronostica</>)}
            </button>
          </div>
        </form>

        {error && <div className="mt-4 text-sm text-red-600 inline-flex items-center gap-2"><AlertTriangle size={16}/> {error}</div>}

        {data && (
          <div className="mt-8 space-y-6">
            <div className="border rounded p-4">
              <div className="flex items-center justify-between">
                <div className="text-xl font-semibold">{data.match.home} vs {data.match.away}</div>
                <div className="text-sm opacity-70 inline-flex items-center gap-3">
                  <Trophy size={16}/> {data.match.league ?? "-"}
                  <Shield size={16}/> {data.match.kickoff_iso ? new Date(data.match.kickoff_iso).toLocaleString() : "-"}
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4 mt-3">
                <div>
                  {data.predictions.find(p=>p.market==="1X2")?.probabilities && (
                    <>
                      <ProbBar label={`${data.match.home} (1)`} value={data.predictions.find(p=>p.market==="1X2")!.probabilities.Home}/>
                      <ProbBar label="Pareggio (X)" value={data.predictions.find(p=>p.market==="1X2")!.probabilities.Draw}/>
                      <ProbBar label={`${data.match.away} (2)`} value={data.predictions.find(p=>p.market==="1X2")!.probabilities.Away}/>
                    </>
                  )}
                </div>
                <div className="border rounded p-3">
                  <div className="text-sm opacity-70 mb-1">Pronostico migliore</div>
                  <div className="text-lg font-medium inline-flex items-center gap-2">
                    <TrendingUp size={18}/> {data.top_pick.market}: {data.top_pick.selection} · {pct(data.top_pick.confidence)}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {data.predictions.map(mp => <MarketCard key={mp.market} mp={mp} />)}
            </div>

            {data.weather && (
              <div className="border rounded p-4">
                <div className="font-semibold mb-2 inline-flex items-center gap-2"><Cloud size={18}/> Meteo & Campo</div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div><div className="font-medium">{data.weather.stadium}</div><div className="opacity-70">{new Date(data.weather.kickoff_iso).toLocaleString()}</div></div>
                  <div>🌡️ {data.weather.temperature_c}°C</div>
                  <div>💧 {data.weather.precipitation_mm} mm</div>
                  <div>🌬️ {data.weather.wind_kmh} km/h</div>
                  <div className="opacity-70">{data.weather.summary}</div>
                </div>
              </div>
            )}

            <div className="border rounded p-4">
              <div className="font-semibold mb-2 inline-flex items-center gap-2"><Users size={18}/> Fattori che influenzano</div>
              <div className="space-y-2">{data.factors.map(f => <FactorRow key={f.key} f={f} />)}</div>
            </div>

            {data.odds_best?.length>0 && (
              <div className="border rounded p-4 overflow-x-auto">
                <div className="font-semibold mb-2 inline-flex items-center gap-2"><TrendingUp size={18}/> Migliori quote</div>
                <table className="min-w-full text-sm">
                  <thead><tr className="opacity-70 text-left"><th className="py-2 pr-4">Mercato</th><th className="py-2 pr-4">Selezione</th><th className="py-2 pr-4">Book</th><th className="py-2 pr-4">Quota</th><th className="py-2 pr-4">Link</th></tr></thead>
                  <tbody>{data.odds_best.map((o, i) => (<tr key={i} className="border-t"><td className="py-2 pr-4">{o.market}</td><td className="py-2 pr-4">{o.selection}</td><td className="py-2 pr-4">{o.bookmaker}</td><td className="py-2 pr-4 font-medium">{o.odds.toFixed(2)}</td><td className="py-2 pr-4">{o.url ? <a className="underline" href={o.url} target="_blank">vai</a> : "—"}</td></tr>))}</tbody>
                </table>
              </div>
            )}

            {data.news && data.news.length>0 && (
              <div className="border rounded p-4 space-y-3">
                <div className="font-semibold inline-flex items-center gap-2"><Newspaper size={18}/> Notizie</div>
                {data.news.map((n, i) => (
                  <div key={i} className="flex items-start justify-between gap-3">
                    <div><a className="underline font-medium" href={n.url} target="_blank">{n.title}</a><div className="text-sm opacity-70">{n.summary}</div></div>
                    <div className="text-xs opacity-70">{new Date(n.published_at).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="text-xs opacity-70">
              ⚠️ ProbaX fornisce stime probabilistiche a solo scopo informativo. Verifica le leggi locali e gioca responsabilmente.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProbBar({ label, value }: { label:string; value:number }) {
  return (
    <div className="flex items-center gap-3 w-full">
      <div className="w-28 text-sm opacity-70">{label}</div>
      <div className="flex-1 h-2 bg-gray-200 rounded"><div className="h-2 bg-gray-500 rounded" style={{width:`${Math.round(value*100)}%`}}/></div>
      <div className="w-14 text-right font-medium">{pct(value)}</div>
    </div>
  );
}

function FactorRow({ f }: { f: Factor }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <div className="flex items-center gap-2">
        <span className="text-xs border rounded px-2 py-0.5">{f.label}</span>
        {f.rationale && <span className="text-sm opacity-70">{f.rationale}</span>}
      </div>
      <div className="flex items-center gap-3">
        <div className="text-xs opacity-70">peso {Math.round(f.weight*100)}%</div>
        <div className="w-40 h-2 bg-gray-200 rounded"><div className="h-2 bg-gray-500 rounded" style={{width:`${Math.round(f.score*100)}%`}}/></div>
      </div>
    </div>
  );
}
