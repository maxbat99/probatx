import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

type Team = {
  id: string;
  name: string;
  country?: string;
  league?: string;
};

type Props = {
  onSelect: (home: Team, away: Team) => void;
};

export default function TeamSearch({ onSelect }: Props) {
  const [homeIn, setHomeIn] = useState("");
  const [awayIn, setAwayIn] = useState("");
  const [homeSel, setHomeSel] = useState<Team | null>(null);
  const [awaySel, setAwaySel] = useState<Team | null>(null);
  const [sugHome, setSugHome] = useState<Team[]>([]);
  const [sugAway, setSugAway] = useState<Team[]>([]);
  const [loadingSug, setLoadingSug] = useState({ home: false, away: false });

  const canSubmit = useMemo(
    () => !!homeSel && !!awaySel && homeSel.id !== awaySel.id,
    [homeSel, awaySel]
  );

  // Suggest squadre iniziali
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/v1/teams/suggest?limit=50`);
        if (!r.ok) return;
        const s: Team[] = await r.json();
        setSugHome(s);
        setSugAway(s);
      } catch {}
    })();
  }, []);

  // Autocomplete squadra casa
  useEffect(() => {
    if (homeIn.trim().length < 2) return;
    const id = setTimeout(async () => {
      try {
        setLoadingSug((v) => ({ ...v, home: true }));
        const r = await fetch(
          `${API_BASE}/api/v1/teams/search?q=${encodeURIComponent(homeIn)}`
        );
        if (!r.ok) return;
        setSugHome(await r.json());
      } finally {
        setLoadingSug((v) => ({ ...v, home: false }));
      }
    }, 200);
    return () => clearTimeout(id);
  }, [homeIn]);

  // Autocomplete squadra trasferta
  useEffect(() => {
    if (awayIn.trim().length < 2) return;
    const id = setTimeout(async () => {
      try {
        setLoadingSug((v) => ({ ...v, away: true }));
        const r = await fetch(
          `${API_BASE}/api/v1/teams/search?q=${encodeURIComponent(awayIn)}`
        );
        if (!r.ok) return;
        setSugAway(await r.json());
      } finally {
        setLoadingSug((v) => ({ ...v, away: false }));
      }
    }, 200);
    return () => clearTimeout(id);
  }, [awayIn]);

  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 backdrop-blur p-4">
      <div className="grid md:grid-cols-12 gap-3 items-end">
        <div className="md:col-span-5">
          <Label>Squadra Casa</Label>
          <Typeahead
            placeholder="Es. Milan"
            value={homeSel?.name ?? homeIn}
            onInput={(v) => {
              setHomeSel(null);
              setHomeIn(v);
            }}
            onPick={setHomeSel}
            options={sugHome}
            loading={loadingSug.home}
          />
        </div>
        <div className="md:col-span-5">
          <Label>Squadra Trasferta</Label>
          <Typeahead
            placeholder="Es. Inter"
            value={awaySel?.name ?? awayIn}
            onInput={(v) => {
              setAwaySel(null);
              setAwayIn(v);
            }}
            onPick={setAwaySel}
            options={sugAway}
            loading={loadingSug.away}
          />
        </div>
        <div className="md:col-span-2">
          <button
            onClick={() => homeSel && awaySel && onSelect(homeSel, awaySel)}
            disabled={!canSubmit}
            className="w-full h-[44px] rounded-xl bg-gradient-to-r from-blue-500 to-emerald-500 hover:brightness-110 font-medium disabled:opacity-50"
          >
            <span className="inline-flex items-center gap-2">
              <ArrowRight size={18} /> Pronostica
            </span>
          </button>
        </div>
      </div>
      <div className="mt-2 text-xs text-white/70">
        Digita almeno 2 lettere per l’autocomplete. Copertura globale.
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block mb-1 text-sm text-white/80">{children}</label>;
}

function Typeahead({
  placeholder,
  value,
  onInput,
  onPick,
  options,
  loading,
}: {
  placeholder?: string;
  value: string;
  onInput: (v: string) => void;
  onPick: (t: Team) => void;
  options: Team[];
  loading?: boolean;
}) {
  const show = options.length > 0;
  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => onInput(e.target.value)}
        placeholder={placeholder}
        className="w-full h-[44px] rounded-xl bg-white text-black px-3 border border-gray-300 focus:border-blue-500 outline-none"
      />
      <div className="absolute right-3 top-2.5 text-gray-500">
        {loading ? <Loader2 className="animate-spin" size={18} /> : null}
      </div>
      {show && (
        <ul className="absolute z-20 w-full mt-1 bg-white text-black border border-gray-300 rounded-xl max-h-72 overflow-auto shadow">
          {options.map((o) => (
            <li
              key={o.id}
              className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
              onClick={() => onPick(o)}
            >
              <div className="text-sm">
                {o.name}
                {o.country ? ` · ${o.country}` : ""}
              </div>
              <div className="text-xs text-gray-600">{o.league ?? ""}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
