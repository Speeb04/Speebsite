// WMO weather codes -> [description, day icon file, night icon file]
const CODES = {
    0:  ["Clear sky",          "clear-day", "clear-night"],
    1:  ["Mostly clear",       "partly-cloudy-day", "partly-cloudy-night"],
    2:  ["Partly cloudy",      "partly-cloudy-day", "partly-cloudy-night"],
    3:  ["Overcast",           "partly-cloudy-day", "partly-cloudy-night"],
    45: ["Fog",                "fog", "fog"],
    48: ["Freezing fog",       "fog", "fog"],
    51: ["Light drizzle",      "drizzle", "drizzle"],
    53: ["Drizzle",            "drizzle", "drizzle"],
    55: ["Heavy drizzle",      "drizzle", "drizzle"],
    56: ["Freezing drizzle",   "sleet", "sleet"],
    57: ["Freezing drizzle",   "sleet", "sleet"],
    61: ["Light rain",         "rain", "rain"],
    63: ["Rain",               "rain", "rain"],
    65: ["Heavy rain",         "rain", "rain"],
    66: ["Freezing rain",      "sleet", "sleet"],
    67: ["Freezing rain",      "sleet", "sleet"],
    71: ["Light snow",         "snow", "snow"],
    73: ["Snow",               "snow", "snow"],
    75: ["Heavy snow",         "snow", "snow"],
    77: ["Snow grains",        "snow", "snow"],
    80: ["Light showers",      "rain", "rain"],
    81: ["Showers",            "rain", "rain"],
    82: ["Heavy showers",      "rain", "rain"],
    85: ["Snow showers",       "snow", "snow"],
    86: ["Heavy snow showers", "snow", "snow"],
    95: ["Thunderstorm",       "thunderstorms", "thunderstorms"],
    96: ["Thunderstorm, hail", "thunderstorms", "thunderstorms"],
    99: ["Thunderstorm, hail", "thunderstorms", "thunderstorms"],
};

async function loadWeather(city) {
    const url =
        "https://api.open-meteo.com/v1/forecast" +
        `?latitude=${city.lat}&longitude=${city.lon}` +
        "&current=weather_code,is_day" +
        "&daily=temperature_2m_max,temperature_2m_min" +
        "&timezone=auto&forecast_days=1";

    try {
        const res = await fetch(url);
        const data = await res.json();

        const code = data.current.weather_code;
        const isDay = data.current.is_day === 1;
        const [desc, dayIcon, nightIcon] = CODES[code] || ["Unknown", "partly-cloudy-day", "partly-cloudy-night"];

        const hi = Math.round(data.daily.temperature_2m_max[0]);
        const lo = Math.round(data.daily.temperature_2m_min[0]);

        const img = document.getElementById("weather-icon");
        img.src = img.dataset.base + (isDay ? dayIcon : nightIcon) + ".svg";
        document.getElementById("weather-desc").textContent = desc;
        document.getElementById("weather-range").textContent = `${lo}°C/${hi}°C`;
    } catch (err) {
        console.error(err, url);
        document.getElementById("weather-desc").textContent = "Weather unavailable";
    }
}

// phones skip the city slides, so they show Toronto's weather; desktop starts on the first city
const TORONTO = CITIES.find((c) => c.short === "Toronto") || CITIES[0];
let currentCity = document.body.classList.contains("mobile") ? TORONTO : CITIES[0];

window.showWeatherFor = (city) => {
    currentCity = city;
    return loadWeather(city);
};

loadWeather(currentCity);
setInterval(() => loadWeather(currentCity), 30 * 60 * 1000);   // refresh every 30 minutes