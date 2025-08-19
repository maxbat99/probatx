import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Loader2, RefreshCw } from "lucide-react";
import "./index.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

type Team = { id: string; name: string; country?: string; league?: string };
type MarketPrediction = { market: string; probabilities: Record<string, number> };
type AggregateResponse = { match?: { home:string; away:string; league?:string; kickoff_iso?:string }; predictions: MarketPrediction[] };

async function suggestTeams(limit=40): Promise<Team[]> {
  const r = await fetch(`${API_BASE}/api/v1/teams/suggest?limit=${limit}`);
  if(!r.ok) return [];
  return await r.json();
}
async function searchTeams(q:string, limit=20): Promise<Team[]> {
  const r = await fetch(`${API_BASE}/api/v1/teams/search?q=${encodeURIComponent(q)}&limit=${limit}`);
  if(!r.ok) return [];
  return await r.json();
}

export default function App() {
  // inputs + state
  const [homeIn, setHomeIn] = useState("");
  const [awayIn, setAwayIn] = useState("");
  const [homeSel, setHomeSel] = useState<Team|null>(null);
  const [awaySel, setAwaySel] = useState<Team|null>(null);
  const [sugHome, setSugHome] = useState<Team[]>([]);
  const [sugAway, setSugAway] = useState<Team[]>([]);
  const [loadingSug, setLoadingSug] = useState({home:false, away:false});

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AggregateResponse|null>(null);
  const [err, setErr] = useState<string|null>(null);

  useEffect(()=>{ (async()=>{ try{ const s = await suggestTeams(60); setSugHome(s); setSugAway(s);}catch{} })(); },[]);
  useEffect(()=>{ if(homeIn.trim().length<2) return; const id=setTimeout(async()=>{ try{ setLoadingSug(v=>({...v,home:true})); setSugHome(await searchTeams(homeIn)); } finally{ setLoadingSug(v=>({...v,home:false})) } },150); return ()=>clearTimeout(id); },[homeIn]);
  useEffect(()=>{ if(awayIn.trim().length<2) return; const id=setTimeout(async()=>{ try{ setLoadingSug(v=>({...v,away:true})); setSugAway(await searchTeams(awayIn)); } finally{ setLoadingSug(v=>({...v,away:false})) } },150); return ()=>clearTimeout(id); },[awayIn]);

  const canSubmit = useMemo(()=> !!homeSel && !!awaySel && homeSel!.id !== awaySel!.id, [homeSel,awaySel]);

  async function onPredict(){
    if(!canSubmit) return;
    setLoading(true); setErr(null); setData(null);
    try{
      // endpoint avanzato, poi fallback /predict
      let r = await fetch(`${API_BASE}/api/v1/match/aggregate`, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ homeId: homeSel!.id, awayId: awaySel!.id }) });
      if(!r.ok){
        r = await fetch(`${API_BASE}/predict`, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ home: homeSel!.name, away: awaySel!.name }) });
      }
      if(!r.ok) throw new Error("Backend non disponibile");
      setData(await r.json());
    } catch(e:any){ setErr(e?.message || "Errore"); }
    finally{ setLoading(false); }
  }

  function reset(){ setHomeIn(""); setAwayIn(""); setHomeSel(null); setAwaySel(null); setData(null); setErr(null); }

  return (
    <div className="relative min-h-screen text-white">
      {/* Background stadio + overlay */}
      <div className="fixed inset-0 -z-10 bg-center bg-cover" style={{ backgroundImage: "url('/stadium.jpg')" }} />
      <div className="fixed inset-0 -z-10 bg-black/65" />

      {/* Header */}
      <header className="sticky top-0 backdrop-blur bg-black/30 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="text-lg font-semibold tracking-tight">ProbaX — Betting Intelligence</div>
          <button onClick={reset} className="text-sm inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/15 hover:border-white/30">
            <RefreshCw size={16}/> Reset
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl md:text-4xl font-extrabold">Trova il valore. Gioca le percentuali.</h1>
        <p className="text-white/80 mt-2 max-w-2xl">Seleziona due squadre, vedi le probabilità 1X2 e le giocate con il miglior edge.</p>
      </section>

      {/* Ricerca */}
      <section className="max-w-7xl mx-auto px-4">
        <div className="rounded-2xl border border-white/15 bg-white/10 backdrop-blur p-4">
          <div className="grid md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-5">
              <Label>Squadra Casa</Label>
              <Typeahead placeholder="Es. Milan" value={homeSel?.name ?? homeIn} onInput={(v)=>{setHomeSel(null); setHomeIn(v)}} onPick={setHomeSel} options={sugHome} loading={loadingSug.home}/>
            </div>
            <div className="md:col-span-5">
              <Label>Squadra Trasferta</Label>
              <Typeahead placeholder="Es. Inter" value={awaySel?.name ?? awayIn} onInput={(v)=>{setAwaySel(null); setAwayIn(v)}} onPick={setAwaySel} options={sugAway} loading={loadingSug.away}/>
            </div>
            <div className="md:col-span-2">
              <button onClick={onPredict} disabled={!canSubmit || loading} className="w-full h-[44px] rounded-xl bg-gradient-to-r from-blue-500 to-emerald-500 hover:brightness-110 font-medium disabled:opacity-50">
                {loading ? <span className="inline-flex items-center gap-2"><Loader2 className="animate-spin" size={18}/> Calcolo…</span> : <span className="inline-flex items-center gap-2"><ArrowRight size={18}/> Pronostica</span>}
              </button>
            </div>
          </div>
          <div className="mt-2 text-xs text-white/70">Digita almeno 2 lettere per l’autocomplete. Copertura globale.</div>
          {err && <div className="mt-3 text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2 inline-flex items-center gap-2">{err}</div>}
        </div>
      </section>

      {/* Risultati */}
      {data && (
        <section className="max-w-7xl mx-auto px-4 my-6">
          <div className="rounded-2xl border border-white/15 bg-white/10 backdrop-blur p-4">
            <div className="text-xl font-semibold">{data.match?.home ?? homeSel?.name} <span className="text-white/60">vs</span> {data.match?.away ?? awaySel?.name}</div>
            <div className="text-sm text-white/70">{data.match?.league ?? "—"}</div>

            {(() => {
              const base = data.predictions.find(p=> (p.market || "").toLowerCase() === "1x2");
              if(!base) return null;
              const H = base.probabilities["Home"] ?? base.probabilities["1"] ?? 0;
              const D = base.probabilities["Draw"] ?? base.probabilities["X"] ?? 0;
              const A = base.probabilities["Away"] ?? base.probabilities["2"] ?? 0;
              return (
                <div className="grid md:grid-cols-3 gap-3 mt-4">
                  <ProbRow label={`${data.match?.home ?? homeSel?.name} (1)`} value={H}/>
                  <ProbRow label="Pareggio (X)" value={D}/>
                  <ProbRow label={`${data.match?.away ?? awaySel?.name} (2)`} value={A}/>
                </div>
              );
            })()}
          </div>
        </section>
      )}

      <div className="h-10" />
    </div>
  );
}

function Label({children}:{children:React.ReactNode}) {
  return <label className="block mb-1 text-sm text-white/80">{children}</label>;
}

function Typeahead({ placeholder, value, onInput, onPick, options, loading }:{
  placeholder?: string; value:string; onInput:(v:string)=>void; onPick:(t:Team)=>void; options:Team[]; loading?:boolean;
}) {
  const show = options.length>0;
  return (
    <div className="relative">
      <input value={value} onChange={(e)=>onInput(e.target.value)} placeholder={placeholder} className="w-full h-[44px] rounded-xl bg-white text-black px-3 border border-gray-300 focus:border-blue-500 outline-none"/>
      <div className="absolute right-3 top-2.5 text-gray-500">{loading ? <Loader2 className="animate-spin" size={18}/> : null}</div>
      {show && (
        <ul className="absolute z-20 w-full mt-1 bg-white text-black border border-gray-300 rounded-xl max-h-72 overflow-auto shadow">
          {options.map(o=>(
            <li key={o.id} className="px-3 py-2 hover:bg-gray-100 cursor-pointer" onClick={()=>onPick(o)}>
              <div className="text-sm">{o.name}{o.country?` · ${o.country}`:""}</div>
              <div className="text-xs text-gray-600">{o.league ?? ""}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProbRow({ label, value }:{ label:string; value:number }) {
  const w = Math.max(2, Math.round((value||0)*100));
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 text-sm text-white/80 truncate">{label}</div>
      <div className="flex-1 h-2 bg-white/15 rounded">
        <div className="h-2 rounded bg-gradient-to-r from-blue-500 to-emerald-500" style={{ width: `${w}%` }}/>
      </div>
      <div className="w-12 text-right text-sm font-medium">{Math.round((value||0)*100)}%</div>
    </div>
  );
}
