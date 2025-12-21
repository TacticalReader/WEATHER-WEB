const WEATHER_ICONS = {
    "01d": "clear-day",
    "01n": "clear-night",
    "02d": "partly-cloudy-day",
    "02n": "partly-cloudy-night",
    "03d": "cloudy",
    "03n": "cloudy",
    "04d": "overcast-day",
    "04n": "overcast-night",
    "09d": "rain",
    "09n": "rain",
    "10d": "partly-cloudy-day-rain",
    "10n": "partly-cloudy-night-rain",
    "11d": "thunderstorms-day",
    "11n": "thunderstorms-night",
    "13d": "snow",
    "13n": "snow",
    "50d": "mist",
    "50n": "mist"
};

function getIconUrl(code) {
    const iconName = WEATHER_ICONS[code] || "not-available";
    return `https://cdn.jsdelivr.net/npm/basmilius-weather-icons@latest/production/fill/all/${iconName}.svg`;
}
