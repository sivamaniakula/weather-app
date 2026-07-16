// Station — a small weather readout powered by Open-Meteo (no API key needed)

const form = document.getElementById('lookupForm');
const input = document.getElementById('cityInput');
const locateBtn = document.getElementById('locateBtn');
const statusEl = document.getElementById('status');
const readout = document.getElementById('readout');

const placeName = document.getElementById('placeName');
const placeMeta = document.getElementById('placeMeta');
const tempEl = document.getElementById('temp');
const dialArc = document.getElementById('dialArc');
const conditionEl = document.getElementById('condition');
const feelsLike = document.getElementById('feelsLike');
const humidity = document.getElementById('humidity');
const wind = document.getElementById('wind');
const pressure = document.getElementById('pressure');
const forecastEl = document.getElementById('forecast');
const clockEl = document.getElementById('clock');

// WMO weather codes -> label + icon
const WEATHER_CODES = {
  0: ['Clear sky', '☀'],
  1: ['Mainly clear', '🌤'],
  2: ['Partly cloudy', '⛅'],
  3: ['Overcast', '☁'],
  45: ['Fog', '🌫'],
  48: ['Depositing fog', '🌫'],
  51: ['Light drizzle', '🌦'],
  53: ['Drizzle', '🌦'],
  55: ['Dense drizzle', '🌦'],
  61: ['Light rain', '🌧'],
  63: ['Rain', '🌧'],
  65: ['Heavy rain', '🌧'],
  71: ['Light snow', '🌨'],
  73: ['Snow', '🌨'],
  75: ['Heavy snow', '🌨'],
  80: ['Rain showers', '🌦'],
  81: ['Rain showers', '🌦'],
  82: ['Violent showers', '⛈'],
  95: ['Thunderstorm', '⛈'],
  96: ['Thunderstorm + hail', '⛈'],
  99: ['Thunderstorm + hail', '⛈'],
};

const DIAL_CIRCUMFERENCE = 2 * Math.PI * 88; // matches r=88 in the SVG

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.classList.toggle('status--error', isError);
}

function updateClock() {
  const now = new Date();
  clockEl.textContent = now.toLocaleTimeString([], { hour12: false });
}
updateClock();
setInterval(updateClock, 1000);

function setDial(tempC) {
  // Map roughly -10°C to 45°C onto the dial's sweep
  const min = -10, max = 45;
  const pct = Math.min(1, Math.max(0, (tempC - min) / (max - min)));
  const offset = DIAL_CIRCUMFERENCE * (1 - pct);
  dialArc.style.strokeDasharray = DIAL_CIRCUMFERENCE;
  dialArc.style.strokeDashoffset = offset;
}

async function geocode(city) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Geocoding request failed');
  const data = await res.json();
  if (!data.results || data.results.length === 0) {
    throw new Error('City not found');
  }
  return data.results[0];
}

async function fetchWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,surface_pressure` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
    `&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Weather request failed');
  return res.json();
}

function renderForecast(daily) {
  forecastEl.innerHTML = '';
  const days = daily.time.slice(1, 5); // next 4 days
  days.forEach((dateStr, i) => {
    const idx = i + 1;
    const code = daily.weather_code[idx];
    const [, icon] = WEATHER_CODES[code] || ['—', '·'];
    const hi = Math.round(daily.temperature_2m_max[idx]);
    const lo = Math.round(daily.temperature_2m_min[idx]);
    const label = new Date(dateStr).toLocaleDateString([], { weekday: 'short' });

    const el = document.createElement('div');
    el.className = 'fday';
    el.innerHTML = `
      <span>${label}</span>
      <span class="fday__icon">${icon}</span>
      <span><span class="fday__hi">${hi}°</span> / ${lo}°</span>
    `;
    forecastEl.appendChild(el);
  });
}

function renderWeather(place, weather) {
  const cur = weather.current;
  const [label, icon] = WEATHER_CODES[cur.weather_code] || ['Unknown', '·'];

  placeName.textContent = `${place.name}${place.admin1 ? ', ' + place.admin1 : ''}`;
  placeMeta.textContent = `${place.country || ''} · ${place.latitude.toFixed(2)}, ${place.longitude.toFixed(2)}`;

  tempEl.textContent = Math.round(cur.temperature_2m);
  setDial(cur.temperature_2m);

  conditionEl.textContent = `${icon}  ${label}`;
  feelsLike.textContent = `${Math.round(cur.apparent_temperature)}°`;
  humidity.textContent = `${cur.relative_humidity_2m}%`;
  wind.textContent = `${Math.round(cur.wind_speed_10m)} km/h`;
  pressure.textContent = `${Math.round(cur.surface_pressure)} hPa`;

  renderForecast(weather.daily);

  readout.hidden = false;
}

async function lookupCity(city) {
  try {
    setStatus(`Locating "${city}"…`);
    readout.hidden = true;

    const place = await geocode(city);
    setStatus(`Reading conditions at ${place.name}…`);

    const weather = await fetchWeather(place.latitude, place.longitude);
    renderWeather(place, weather);

    setStatus(`Last read · ${new Date().toLocaleTimeString([], { hour12: false })}`);
  } catch (err) {
    setStatus(err.message || 'Something went wrong.', true);
  }
}

async function lookupCoords(lat, lon) {
  try {
    setStatus('Reading local conditions…');
    readout.hidden = true;

    const weather = await fetchWeather(lat, lon);
    const place = { name: 'Your location', admin1: '', country: '', latitude: lat, longitude: lon };
    renderWeather(place, weather);

    setStatus(`Last read · ${new Date().toLocaleTimeString([], { hour12: false })}`);
  } catch (err) {
    setStatus(err.message || 'Something went wrong.', true);
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const city = input.value.trim();
  if (!city) {
    setStatus('Type a city name first.', true);
    return;
  }
  lookupCity(city);
});

locateBtn.addEventListener('click', () => {
  if (!navigator.geolocation) {
    setStatus('Geolocation is not supported in this browser.', true);
    return;
  }
  setStatus('Requesting your location…');
  navigator.geolocation.getCurrentPosition(
    (pos) => lookupCoords(pos.coords.latitude, pos.coords.longitude),
    () => setStatus('Location permission denied.', true)
  );
});

// Load a default city on first visit
lookupCity('Amalapuram');
