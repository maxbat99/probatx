import React, { useState } from "react";

export default function TeamSearch() {
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const base = (import.meta as any).env?.VITE_API_BASE_URL || "";
      const apiBase = (base || "").replace(/\/$/, "");
      const url = `${apiBase}/api/v1/odds/predict?home=${encodeURIComponent(homeTeam)}&away=${encodeURIComponent(awayTeam)}`;

      const r = await fetch(url);
      if (!r.ok) throw new Error("Errore nella richiesta al backend");
      const data = await r.json();
      setResult(data);
    } catch (err: any) {
      setError(err?.message || "Errore sconosciuto");
    } finally {
      setLoading(false);
    }
  };

  const disabled = loading || !homeTeam.trim() || !awayTeam.trim();

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">🔍 Ricerca Squadre</h2>

      <div className="flex flex-col md:flex-row gap-3">
        <input
          type="text"
          placeholder="Squadra Casa"
          value={homeTeam}
          onChange={(e) => setHomeTeam(e.target.value)}
          className="flex-1 p-2 border rounded"
        />
        <input
          type="text"
          placeholder="Squadra Ospite"
          value={awayTeam}
          onChange={(e) => setAwayTeam(e.target.value)}
          className="flex-1 p-2 border rounded"
        />
        <button
          onClick={handleSearch}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60"
          disabled={disabled}
          type="button"
        >
          {loading ? "Caricamento..." : "Cerca"}
        </button>
      </div>

      {error && <p className="text-red-600">❌ {error}</p>}

      {result && (
        <div className="mt-2 p-3 border rounded bg-gray-100">
          <h3 className="font-semibold mb-2">Risultati pronostico</h3>
          <pre className="text-sm whitespace-pre-wrap">
{JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
