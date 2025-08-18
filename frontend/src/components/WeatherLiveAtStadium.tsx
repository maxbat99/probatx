import React, { useEffect, useState } from "react";

const API_KEY = "61073c234d9260c8bfc61b69842f8602";
const DEFAULT_CITY = "Napoli";

const cities = ["Napoli", "Milano", "Torino", "Roma", "Firenze", "Palermo"];

const WeatherLiveAtStadium: React.FC = () => {
  const [selectedCity, setSelectedCity] = useState(DEFAULT_CITY);
  const [weather, setWeather] = useState<any>(null);
  const [forecastHourly, setForecastHourly] = useState<any[]>([]);
  const [forecastDaily, setForecastDaily] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        setError(null);
        setWeather(null);
        setForecastHourly([]);
        setForecastDaily([]);

        const currentRes = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?q=${selectedCity}&appid=${API_KEY}&units=metric&lang=it`
        );
        if (!currentRes.ok) throw new Error("Errore nel recupero dei dati attuali");
        const currentData = await currentRes.json();
        setWeather(currentData);

        const { lat, lon } = currentData.coord;

        const forecastRes = await fetch(
          `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=it`
        );
        if (!forecastRes.ok) throw new Error("Errore nel recupero della previsione");
        const forecastData = await forecastRes.json();

        setForecastHourly(forecastData.list.slice(0, 5)); // Prossime 5 ore

        // Raggruppa per giorno
        const dailyMap = new Map<string, any>();
        forecastData.list.forEach((entry: any) => {
          const date = new Date(entry.dt * 1000).toLocaleDateString("it-IT");
          if (!dailyMap.has(date)) dailyMap.set(date, entry);
        });
        setForecastDaily(Array.from(dailyMap.values()).slice(0, 5)); // Prossimi 5 giorni
      } catch (err: any) {
        setError(err.message);
      }
    };

    fetchWeather();
  }, [selectedCity]);

  const getMapUrl = (lat: number, lon: number) =>
    `https://static-maps.yandex.ru/1.x/?lang=it_IT&ll=${lon},${lat}&z=12&size=450,250&l=map`;

  return (
    <div style={{ padding: "1rem", border: "1px solid #ccc", borderRadius: "8px" }}>
      <h2>Meteo Live allo Stadio</h2>

      <label htmlFor="city-select">📍 Seleziona città:</label>
      <select
        id="city-select"
        value={selectedCity}
        onChange={(e) => setSelectedCity(e.target.value)}
        style={{ marginLeft: "0.5rem", padding: "0.3rem" }}
      >
        {cities.map((city) => (
          <option key={city} value={city}>
            {city}
          </option>
        ))}
      </select>

      {error && <p style={{ color: "red" }}>❌ Errore: {error}</p>}
      {!weather && !error && <p>⏳ Caricamento meteo...</p>}

      {weather && (
        <div style={{ marginTop: "1rem" }}>
          <p>🌡️ Temperatura: {weather.main.temp}°C</p>
          <p>🌥️ Condizioni: {weather.weather[0].description}</p>
          <img
            src={`https://openweathermap.org/img/wn/${weather.weather[0].icon}@2x.png`}
            alt="Icona meteo"
            style={{ width: "80px", height: "80px" }}
          />
          <p>💨 Vento: {weather.wind.speed} m/s</p>
          <p>💧 Umidità: {weather.main.humidity}%</p>
          <h3>🗺️ Mappa dello stadio</h3>
          <img
            src={getMapUrl(weather.coord.lat, weather.coord.lon)}
            alt={`Mappa di ${selectedCity}`}
            style={{ borderRadius: "8px", marginTop: "0.5rem" }}
          />
        </div>
      )}

      {forecastHourly.length > 0 && (
        <div style={{ marginTop: "2rem" }}>
          <h3>🕒 Previsione oraria</h3>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {forecastHourly.map((entry, index) => (
              <li key={index} style={{ marginBottom: "1rem" }}>
                <strong>{new Date(entry.dt * 1000).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</strong> – 
                {entry.weather[0].description}, 🌡️ {entry.main.temp}°C
                <img
                  src={`https://openweathermap.org/img/wn/${entry.weather[0].icon}.png`}
                  alt="Icona"
                  style={{ verticalAlign: "middle", marginLeft: "0.5rem" }}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {forecastDaily.length > 0 && (
        <div style={{ marginTop: "2rem" }}>
          <h3>📅 Previsione giornaliera</h3>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {forecastDaily.map((entry, index) => (
              <li key={index} style={{ marginBottom: "1rem" }}>
                <strong>{new Date(entry.dt * 1000).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}</strong> – 
                {entry.weather[0].description}, 🌡️ {entry.main.temp}°C
                <img
                  src={`https://openweathermap.org/img/wn/${entry.weather[0].icon}.png`}
                  alt="Icona"
                  style={{ verticalAlign: "middle", marginLeft: "0.5rem" }}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default WeatherLiveAtStadium;
