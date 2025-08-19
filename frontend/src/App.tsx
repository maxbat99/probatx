import React from "react";
import TeamSearch from "./components/TeamSearch";
import WeatherAtKickoff from "./components/WeatherAtKickoff";
import WeatherLiveAtStadium from "./components/WeatherLiveAtStadium";

/**
 * Nota sfondo:
 * L'immagine deve essere presente in `frontend/public/stadium-fans-background.jpg`.
 * Se manca, la pagina resta leggibile grazie al gradiente di fallback.
 */

export default function App() {
  return (
    <div
      className="min-h-screen bg-cover bg-center bg-fixed"
      style={{ backgroundImage: "url('/stadium-fans-background.jpg')" }}
    >
      {/* Overlay scuro per contrasto + fallback gradiente se l'immagine non c'è */}
      <div className="min-h-screen bg-black/50" style={{ background: "linear-gradient(180deg, rgba(0,0,0,.55), rgba(0,0,0,.55))" }}>
        <div className="max-w-5xl mx-auto px-4 py-8 space-y-10 text-white">

          {/* Ricerca Squadre + pronostico/percentuali (API odds) */}
          <section className="space-y-4">
            <h1 className="text-2xl font-bold">ProbaX – Ricerca e Pronostici</h1>
            <div className="bg-white/90 text-black rounded-xl p-4">
              <TeamSearch />
            </div>
          </section>

          {/* Calcolo meteo per la finestra del kickoff (UTC + Locale) */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Meteo al calcio d’inizio</h2>
            <div className="bg-white/90 text-black rounded-xl p-4">
              <WeatherAtKickoff />
            </div>
          </section>

          {/* Meteo live/serie orarie (tutte le variabili) */}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Meteo LIVE – tutte le variabili</h2>
            <p className="text-sm text-gray-200">
              Tabella dinamica: mostra tutte le serie orarie restituite dall’API per le coordinate.
            </p>
            <div className="bg-white/90 text-black rounded-xl p-4">
              <WeatherLiveAtStadium
                lat={45.4781}
                lon={9.124}
                kickoffIso="2025-08-25T18:45:00Z"
                hoursWindow={6} // opzionale: togli per tutto l’intervallo
              />
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
