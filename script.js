const searchBtn = document.getElementById('search-btn');
const locationBtn = document.getElementById('location-btn');
const cityInput = document.getElementById('city-input');
const suggestionsList = document.getElementById('suggestions-list');
const weatherContent = document.getElementById('weather-content');
const skeletonLoader = document.getElementById('skeleton-loader');
const errorMessage = document.getElementById('error-message');
const errorText = document.getElementById('error-text');
const retryBtn = document.getElementById('retry-btn');
const forecastList = document.getElementById('forecast-list');
const hourlyForecastList = document.getElementById('hourly-forecast');
const unitSwitch = document.getElementById('unit-switch');
const favBtn = document.getElementById('fav-btn');
const favoritesList = document.getElementById('favorites-list');
const chartButtons = document.querySelectorAll('.chart-btn');
const bgLayers = [document.getElementById('bg-layer-1'), document.getElementById('bg-layer-2')];
const glassCard = document.querySelector('.glass-card');

// State
let currentUnit = 'metric'; // 'metric' or 'imperial'
let currentCity = localStorage.getItem('lastCity') || 'Delhi';
let currentForecastData = null;
let weatherChart = null;
let favorites = JSON.parse(localStorage.getItem('favorites')) || [];
let debounceTimer;
let activeBgIndex = 0;

// Initialize
init();

function init() {
    if (typeof CONFIG === 'undefined') {
        console.error("CONFIG is not defined.");
        showError("Configuration missing.");
        return;
    }

    loadFavorites();
    fetchWeather(currentCity);
    
    // Event Listeners
    searchBtn.addEventListener('click', () => {
        const city = cityInput.value.trim();
        if (city) {
            fetchWeather(city);
        } else {
            showToast("Please enter a city name");
        }
        suggestionsList.classList.remove('show');
    });

    locationBtn.addEventListener('click', handleLocationSearch);
    
    cityInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const city = cityInput.value.trim();
            if (city) {
                fetchWeather(city);
            } else {
                showToast("Please enter a city name");
            }
            suggestionsList.classList.remove('show');
        }
    });

    cityInput.addEventListener('input', handleSearchInput);
    
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-box')) {
            suggestionsList.classList.remove('show');
        }
    });

    unitSwitch.addEventListener('change', () => {
        currentUnit = unitSwitch.checked ? 'imperial' : 'metric';
        
        // Toggle class for visual effects (Color Psychology)
        if (currentUnit === 'imperial') {
            glassCard.classList.add('is-imperial');
        } else {
            glassCard.classList.remove('is-imperial');
        }

        fetchWeather(currentCity);
    });

    favBtn.addEventListener('click', toggleFavorite);

    retryBtn.addEventListener('click', () => {
        fetchWeather(currentCity);
    });

    chartButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            chartButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            const type = e.target.dataset.type;
            if (currentForecastData) updateChart(currentForecastData, type);
        });
    });
}

// --- Fetching Logic ---

async function fetchWeather(city) {
    if (!navigator.onLine) {
        showError("No Internet Connection");
        return;
    }

    showSkeleton();
    try {
        const weatherRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${CONFIG.apiKey}&units=${currentUnit}`);
        
        if (weatherRes.status === 404) throw new Error('City not found');
        if (weatherRes.status === 429) throw new Error('API Limit Reached');
        if (!weatherRes.ok) throw new Error('Something went wrong');

        const weatherData = await weatherRes.json();
        currentCity = weatherData.name;
        localStorage.setItem('lastCity', currentCity);
        
        await fetchAdditionalData(weatherData);
    } catch (error) {
        console.error(error);
        showError(error.message);
    }
}

async function fetchWeatherByCoords(lat, lon) {
    showSkeleton();
    try {
        const weatherRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${CONFIG.apiKey}&units=${currentUnit}`);
        if (!weatherRes.ok) throw new Error('Location not found');
        const weatherData = await weatherRes.json();
        currentCity = weatherData.name;
        localStorage.setItem('lastCity', currentCity);
        
        await fetchAdditionalData(weatherData);
    } catch (error) {
        console.error(error);
        showError(error.message);
    }
}

async function fetchAdditionalData(weatherData) {
    try {
        const { lat, lon } = weatherData.coord;

        const forecastRes = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${CONFIG.apiKey}&units=${currentUnit}`);
        const forecastData = await forecastRes.json();
        currentForecastData = forecastData;

        const airRes = await fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${CONFIG.apiKey}`);
        const airData = await airRes.json();

        updateUI(weatherData);
        updateAirQuality(airData);
        
        chartButtons.forEach(b => b.classList.remove('active'));
        document.querySelector('[data-type="temp"]').classList.add('active');
        updateChart(forecastData, 'temp');
        
        updateForecast(forecastData);
        updateHourlyForecast(forecastData);
        updateBackground(weatherData.weather[0].main, weatherData);
        checkFavoriteStatus(weatherData.name);
        
        hideSkeleton();
    } catch (error) {
        console.error(error);
        showToast("Failed to load some details");
        // Still show what we have
        updateUI(weatherData);
        hideSkeleton();
    }
}

// --- UI Updates ---

function updateUI(data) {
    const unitSymbol = currentUnit === 'metric' ? '°C' : '°F';
    const speedUnit = currentUnit === 'metric' ? 'm/s' : 'mph';

    document.getElementById('city-name').textContent = `${data.name}, ${data.sys.country}`;
    document.getElementById('temperature').textContent = `${Math.round(data.main.temp)}${unitSymbol}`;
    document.getElementById('description').textContent = data.weather[0].description;
    
    // Use Animated SVG Icon
    const iconCode = data.weather[0].icon;
    document.getElementById('weather-icon').src = getIconUrl(iconCode);
    
    document.getElementById('wind-speed').textContent = `${data.wind.speed} ${speedUnit}`;
    document.getElementById('wind-dir').textContent = getCardinalDirection(data.wind.deg);
    
    document.getElementById('humidity').textContent = `${data.main.humidity}%`;
    document.getElementById('pressure').textContent = `${data.main.pressure} hPa`;
    
    const visibility = currentUnit === 'metric' ? 
        `${(data.visibility / 1000).toFixed(1)} km` : 
        `${(data.visibility / 1609).toFixed(1)} mi`;
    document.getElementById('visibility').textContent = visibility;
    
    document.getElementById('sunrise').textContent = formatTime(data.sys.sunrise, data.timezone);
    document.getElementById('sunset').textContent = formatTime(data.sys.sunset, data.timezone);

    updateCountdown(data.sys.sunrise, data.sys.sunset, data.timezone);
}

function updateBackground(weatherMain, data) {
    const now = Math.floor(Date.now() / 1000);
    const isNight = now > data.sys.sunset || now < data.sys.sunrise;
    
    let bgUrl;
    if (isNight && CONFIG.nightBackgrounds) {
        bgUrl = CONFIG.nightBackgrounds[weatherMain] || CONFIG.nightBackgrounds['Default'];
    } else {
        bgUrl = CONFIG.backgrounds[weatherMain] || CONFIG.backgrounds['Clear'];
    }

    // Smooth Transition
    const nextIndex = (activeBgIndex + 1) % 2;
    const nextLayer = bgLayers[nextIndex];
    const currentLayer = bgLayers[activeBgIndex];

    nextLayer.style.backgroundImage = `url('${bgUrl}')`;
    
    // Wait a moment for image to load (simplified)
    setTimeout(() => {
        nextLayer.classList.add('active');
        currentLayer.classList.remove('active');
        activeBgIndex = nextIndex;
    }, 100);
}

function updateCountdown(sunrise, sunset, timezone) {
    const el = document.getElementById('daylight-countdown');
    
    if (window.countdownInterval) clearInterval(window.countdownInterval);

    function update() {
        const now = Math.floor(Date.now() / 1000);
        let targetTime, label;
        
        if (now < sunrise) {
            targetTime = sunrise;
            label = "Sunrise";
        } else if (now < sunset) {
            targetTime = sunset;
            label = "Sunset";
        } else {
            targetTime = sunrise + 86400; 
            label = "Sunrise";
        }

        const diff = targetTime - now;

        if (diff <= 0) {
            el.textContent = "Now";
            return;
        }

        const hrs = Math.floor(diff / 3600);
        const mins = Math.floor((diff % 3600) / 60);
        el.textContent = `${label} in ${hrs}h ${mins}m`;
    }

    update();
    window.countdownInterval = setInterval(update, 60000);
}

function updateAirQuality(data) {
    if (!data.list || data.list.length === 0) return;
    
    const record = data.list[0];
    const aqi = record.main.aqi;
    const { pm2_5, so2, no2, o3 } = record.components;
    
    const aqiLabels = { 1: 'Good', 2: 'Fair', 3: 'Moderate', 4: 'Poor', 5: 'Very Poor' };

    document.getElementById('aqi-status').textContent = aqiLabels[aqi] || aqi;
    document.getElementById('pm25').textContent = pm2_5;
    document.getElementById('so2').textContent = so2;
    document.getElementById('no2').textContent = no2;
    document.getElementById('o3').textContent = o3;
}

function updateHourlyForecast(data) {
    hourlyForecastList.innerHTML = '';
    const unitSymbol = currentUnit === 'metric' ? '°C' : '°F';
    
    // Next 24 hours (approx 8 items x 3 hours)
    const hourlyData = data.list.slice(0, 8);

    hourlyData.forEach(item => {
        const date = new Date(item.dt * 1000);
        const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const temp = Math.round(item.main.temp);
        const iconCode = item.weather[0].icon;
        
        const div = document.createElement('div');
        div.className = 'hourly-item';
        div.innerHTML = `
            <p class="h-time">${time}</p>
            <img src="${getIconUrl(iconCode)}" alt="${item.weather[0].main}">
            <p class="h-temp">${temp}${unitSymbol}</p>
        `;
        hourlyForecastList.appendChild(div);
    });
}

function updateForecast(data) {
    forecastList.innerHTML = '';
    const unitSymbol = currentUnit === 'metric' ? '°C' : '°F';
    
    // Group forecast data by day
    const dailyMap = new Map();
    
    data.list.forEach(item => {
        const dateStr = item.dt_txt.split(' ')[0];
        if (!dailyMap.has(dateStr)) {
            dailyMap.set(dateStr, []);
        }
        dailyMap.get(dateStr).push(item);
    });

    // Take up to 5 days
    const days = Array.from(dailyMap.keys()).slice(0, 5);

    days.forEach(dateStr => {
        const items = dailyMap.get(dateStr);
        
        // Find item closest to 12:00:00 for representative weather
        let forecastItem = items.find(i => i.dt_txt.includes("12:00:00"));
        if (!forecastItem) {
            forecastItem = items[Math.floor(items.length / 2)];
        }

        const date = new Date(forecastItem.dt * 1000);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const temp = Math.round(forecastItem.main.temp);
        const iconCode = forecastItem.weather[0].icon;
        const desc = forecastItem.weather[0].main;
        const pop = Math.round(forecastItem.pop * 100);

        const div = document.createElement('div');
        div.className = 'forecast-item';
        div.innerHTML = `
            <p class="f-day">${dayName}</p>
            <img src="${getIconUrl(iconCode)}" alt="${desc}">
            <p class="f-temp">${temp}${unitSymbol}</p>
            <p class="f-desc">${desc}</p>
            ${pop > 0 ? `<span class="pop-badge">${pop}% Rain</span>` : ''}
        `;
        forecastList.appendChild(div);
    });
}

function updateChart(data, type) {
    const ctx = document.getElementById('forecastChart').getContext('2d');
    
    const slice = data.list.slice(0, 8);
    const labels = slice.map(item => {
        const d = new Date(item.dt * 1000);
        return `${d.getHours()}:00`;
    });

    let datasetData, label, color, bgColor;

    if (type === 'humidity') {
        datasetData = slice.map(item => item.main.humidity);
        label = 'Humidity (%)';
        color = '#10b981';
        bgColor = 'rgba(16, 185, 129, 0.2)';
    } else if (type === 'wind') {
        datasetData = slice.map(item => item.wind.speed);
        label = currentUnit === 'metric' ? 'Wind Speed (m/s)' : 'Wind Speed (mph)';
        color = '#f59e0b';
        bgColor = 'rgba(245, 158, 11, 0.2)';
    } else {
        datasetData = slice.map(item => item.main.temp);
        label = currentUnit === 'metric' ? 'Temperature (°C)' : 'Temperature (°F)';
        color = '#2563eb';
        bgColor = 'rgba(37, 99, 235, 0.2)';
    }

    if (weatherChart) {
        weatherChart.destroy();
    }

    weatherChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: label,
                data: datasetData,
                borderColor: color,
                backgroundColor: bgColor,
                borderWidth: 2,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: color
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#333' } }
            },
            scales: {
                x: { ticks: { color: '#4b5563' }, grid: { color: 'rgba(0,0,0,0.1)' } },
                y: { ticks: { color: '#4b5563' }, grid: { color: 'rgba(0,0,0,0.1)' } }
            }
        }
    });
}

// --- Autocomplete ---

function handleSearchInput(e) {
    const query = e.target.value.trim();
    clearTimeout(debounceTimer);
    
    if (query.length < 3) {
        suggestionsList.classList.remove('show');
        return;
    }

    debounceTimer = setTimeout(async () => {
        try {
            const res = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${query}&limit=5&appid=${CONFIG.apiKey}`);
            const locations = await res.json();
            renderSuggestions(locations);
        } catch (err) {
            console.error("Autocomplete error", err);
        }
    }, 300);
}

function renderSuggestions(locations) {
    suggestionsList.innerHTML = '';
    if (locations.length === 0) {
        suggestionsList.classList.remove('show');
        return;
    }

    locations.forEach(loc => {
        const li = document.createElement('li');
        li.textContent = `${loc.name}, ${loc.state ? loc.state + ', ' : ''}${loc.country}`;
        li.addEventListener('click', () => {
            cityInput.value = loc.name;
            suggestionsList.classList.remove('show');
            fetchWeatherByCoords(loc.lat, loc.lon);
        });
        suggestionsList.appendChild(li);
    });
    suggestionsList.classList.add('show');
}

// --- Favorites ---

function loadFavorites() {
    favoritesList.innerHTML = '';
    favorites.forEach(city => {
        createFavoriteChip(city);
    });
}

function createFavoriteChip(city) {
    const chip = document.createElement('div');
    chip.className = 'fav-chip';
    chip.innerHTML = `
        <span onclick="fetchWeather('${city}')">${city}</span>
        <span class="material-icons remove-fav">close</span>
    `;
    
    chip.querySelector('.remove-fav').addEventListener('click', (e) => {
        e.stopPropagation();
        removeFavorite(city);
    });
    
    favoritesList.appendChild(chip);
}

function toggleFavorite() {
    const index = favorites.indexOf(currentCity);
    if (index === -1) {
        favorites.push(currentCity);
        createFavoriteChip(currentCity);
        favBtn.classList.add('active');
        favBtn.textContent = 'favorite';
        showToast("Added to favorites");
    } else {
        removeFavorite(currentCity);
        showToast("Removed from favorites");
    }
    localStorage.setItem('favorites', JSON.stringify(favorites));
}

function removeFavorite(city) {
    favorites = favorites.filter(c => c !== city);
    localStorage.setItem('favorites', JSON.stringify(favorites));
    loadFavorites();
    if (currentCity === city) {
        favBtn.classList.remove('active');
        favBtn.textContent = 'favorite_border';
    }
}

function checkFavoriteStatus(city) {
    if (favorites.includes(city)) {
        favBtn.classList.add('active');
        favBtn.textContent = 'favorite';
    } else {
        favBtn.classList.remove('active');
        favBtn.textContent = 'favorite_border';
    }
}

// --- Helpers ---

function handleLocationSearch() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                fetchWeatherByCoords(latitude, longitude);
            },
            (error) => {
                console.error(error);
                showToast("Unable to retrieve location");
            }
        );
    } else {
        showToast("Geolocation not supported");
    }
}

function showSkeleton() {
    weatherContent.style.display = 'none';
    errorMessage.style.display = 'none';
    skeletonLoader.style.display = 'block';
}

function hideSkeleton() {
    skeletonLoader.style.display = 'none';
    weatherContent.style.display = 'block';
}

function showError(msg) {
    skeletonLoader.style.display = 'none';
    weatherContent.style.display = 'none';
    errorMessage.style.display = 'flex';
    errorText.textContent = msg || "City not found or location unavailable.";
}

function showToast(msg) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function getCardinalDirection(angle) {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return directions[Math.round(angle / 45) % 8];
}

function formatTime(unixTimestamp, timezoneOffset) {
    const date = new Date((unixTimestamp + timezoneOffset) * 1000);
    let hours = date.getUTCHours();
    let minutes = date.getUTCMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    minutes = minutes < 10 ? '0'+minutes : minutes;
    return `${hours}:${minutes} ${ampm}`;
}
