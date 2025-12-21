const searchBtn = document.getElementById('search-btn');
const locationBtn = document.getElementById('location-btn');
const cityInput = document.getElementById('city-input');
const suggestionsList = document.getElementById('suggestions-list');
const weatherContent = document.getElementById('weather-content');
const skeletonLoader = document.getElementById('skeleton-loader');
const errorMessage = document.getElementById('error-message');
const errorText = document.getElementById('error-text');
const forecastList = document.getElementById('forecast-list');
const unitSwitch = document.getElementById('unit-switch');
const favBtn = document.getElementById('fav-btn');
const favoritesList = document.getElementById('favorites-list');
const chartButtons = document.querySelectorAll('.chart-btn');

// State
let currentUnit = 'metric'; // 'metric' or 'imperial'
let currentCity = 'Delhi';
let currentForecastData = null;
let weatherChart = null;
let favorites = JSON.parse(localStorage.getItem('favorites')) || [];
let debounceTimer;

// Initialize
init();

function init() {
    loadFavorites();
    fetchWeather(currentCity);
    
    // Event Listeners
    searchBtn.addEventListener('click', () => {
        const city = cityInput.value.trim();
        if (city) fetchWeather(city);
        suggestionsList.classList.remove('show');
    });

    locationBtn.addEventListener('click', handleLocationSearch);
    
    cityInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const city = cityInput.value.trim();
            if (city) fetchWeather(city);
            suggestionsList.classList.remove('show');
        }
    });

    cityInput.addEventListener('input', handleSearchInput);
    
    // Close suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-box')) {
            suggestionsList.classList.remove('show');
        }
    });

    unitSwitch.addEventListener('change', () => {
        currentUnit = unitSwitch.checked ? 'imperial' : 'metric';
        fetchWeather(currentCity);
    });

    favBtn.addEventListener('click', toggleFavorite);

    chartButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Update active state
            chartButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            // Update chart
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
        currentCity = weatherData.name; // Update current city name for consistency
        
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
        
        await fetchAdditionalData(weatherData);
    } catch (error) {
        console.error(error);
        showError(error.message);
    }
}

async function fetchAdditionalData(weatherData) {
    try {
        const { lat, lon } = weatherData.coord;

        // Fetch Forecast
        const forecastRes = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${CONFIG.apiKey}&units=${currentUnit}`);
        const forecastData = await forecastRes.json();
        currentForecastData = forecastData; // Store for chart toggling

        // Fetch Air Pollution
        const airRes = await fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${CONFIG.apiKey}`);
        const airData = await airRes.json();

        updateUI(weatherData);
        updateAirQuality(airData);
        
        // Reset chart to Temp by default
        chartButtons.forEach(b => b.classList.remove('active'));
        document.querySelector('[data-type="temp"]').classList.add('active');
        updateChart(forecastData, 'temp');
        
        updateForecast(forecastData);
        updateBackground(weatherData.weather[0].main);
        checkFavoriteStatus(weatherData.name);
        
        hideSkeleton();
    } catch (error) {
        console.error(error);
        showError("Failed to load details");
    }
}

// --- UI Updates ---

function updateUI(data) {
    const unitSymbol = currentUnit === 'metric' ? '°C' : '°F';
    const speedUnit = currentUnit === 'metric' ? 'm/s' : 'mph';

    document.getElementById('city-name').textContent = `${data.name}, ${data.sys.country}`;
    document.getElementById('temperature').textContent = `${Math.round(data.main.temp)}${unitSymbol}`;
    document.getElementById('description').textContent = data.weather[0].description;
    document.getElementById('weather-icon').src = `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`;
    
    document.getElementById('wind-speed').textContent = `${data.wind.speed} ${speedUnit}`;
    document.getElementById('wind-dir').textContent = getCardinalDirection(data.wind.deg);
    
    document.getElementById('humidity').textContent = `${data.main.humidity}%`;
    document.getElementById('pressure').textContent = `${data.main.pressure} hPa`;
    
    // Visibility conversion if needed (API returns meters)
    const visibility = currentUnit === 'metric' ? 
        `${(data.visibility / 1000).toFixed(1)} km` : 
        `${(data.visibility / 1609).toFixed(1)} mi`;
    document.getElementById('visibility').textContent = visibility;
    
    document.getElementById('sunrise').textContent = formatTime(data.sys.sunrise, data.timezone);
    document.getElementById('sunset').textContent = formatTime(data.sys.sunset, data.timezone);

    updateCountdown(data.sys.sunrise, data.sys.sunset, data.timezone);
}

function updateBackground(weatherMain) {
    const bgUrl = CONFIG.backgrounds[weatherMain] || CONFIG.backgrounds['Clear'];
    document.querySelector('.parallax-bg').style.backgroundImage = `url('${bgUrl}')`;
}

function updateCountdown(sunrise, sunset, timezone) {
    const now = Math.floor(Date.now() / 1000);
    const localNow = now + timezone;
    // Note: sunrise/sunset from API are UTC timestamps. We compare directly with UTC now.
    
    let targetTime, label;
    
    if (now < sunset) {
        targetTime = sunset;
        label = "Sunset";
    } else {
        // If after sunset, count to next sunrise (approximate by adding 24h to previous sunrise if needed, 
        // but simpler to just show 'Sunrise tomorrow' logic or just wait for next API fetch)
        // For simplicity, if passed sunset, we just show "Sunset passed"
        // A robust solution requires checking if now > sunset, then target is tomorrow's sunrise.
        // Since we only have today's data, we'll just show "Night time" or similar if passed.
        targetTime = null;
    }

    const el = document.getElementById('daylight-countdown');
    if (targetTime) {
        const diff = targetTime - now;
        const hrs = Math.floor(diff / 3600);
        const mins = Math.floor((diff % 3600) / 60);
        el.textContent = `${label} in ${hrs}h ${mins}m`;
    } else {
        el.textContent = "";
    }
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

function updateForecast(data) {
    forecastList.innerHTML = '';
    const unitSymbol = currentUnit === 'metric' ? '°C' : '°F';
    
    // Filter for approx noon forecasts
    const dailyData = data.list.filter(item => item.dt_txt.includes("12:00:00"));

    dailyData.forEach(day => {
        const date = new Date(day.dt * 1000);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const temp = Math.round(day.main.temp);
        const icon = day.weather[0].icon;
        const desc = day.weather[0].main;

        const forecastItem = document.createElement('div');
        forecastItem.className = 'forecast-item';
        forecastItem.innerHTML = `
            <p class="f-day">${dayName}</p>
            <img src="https://openweathermap.org/img/wn/${icon}.png" alt="${desc}">
            <p class="f-temp">${temp}${unitSymbol}</p>
            <p class="f-desc">${desc}</p>
        `;
        forecastList.appendChild(forecastItem);
    });
}

function updateChart(data, type) {
    const ctx = document.getElementById('forecastChart').getContext('2d');
    
    const slice = data.list.slice(0, 8); // Next 24 hours (3h intervals)
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
        // Temp
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
    
    // Remove handler
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
    } else {
        removeFavorite(currentCity);
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
                alert("Unable to retrieve your location.");
            }
        );
    } else {
        alert("Geolocation is not supported by this browser.");
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
