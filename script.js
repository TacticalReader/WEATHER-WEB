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
const windList = document.getElementById('wind-list');
const unitSwitch = document.getElementById('unit-switch');
const favBtn = document.getElementById('fav-btn');
const countryFlag = document.getElementById('country-flag');
const favoritesList = document.getElementById('favorites-list');
const chartButtons = document.querySelectorAll('.chart-btn');
const bgLayers = [document.getElementById('bg-layer-1'), document.getElementById('bg-layer-2')];
const glassCard = document.querySelector('.glass-card');
const searchBox = document.querySelector('.search-box');
const searchIconPath = document.getElementById('search-path');
// SVG Paths
const PATH_SEARCH = "M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z";
const PATH_CLOSE = "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z";
// State
let currentUnit = 'metric'; // 'metric' or 'imperial'
let currentCity = localStorage.getItem('lastCity') || 'Delhi';
let currentForecastData = null;
let lastFetchedCurrentWeather = null;
let weatherChart = null;
let favorites = JSON.parse(localStorage.getItem('favorites')) || [];
let debounceTimer;
let activeBgIndex = 0;
let weatherIconsCache = {}; // Cache for resized chart icons
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
        if (searchBox.classList.contains('focus-mode') && cityInput.value.length > 0) {
            cityInput.value = '';
            cityInput.focus();
            handleSearchInput({ target: cityInput });
        } else {
            const city = cityInput.value.trim();
            if (city) {
                fetchWeather(city);
                cityInput.blur();
            } else {
                cityInput.focus();
            }
        }
    });
    locationBtn.addEventListener('click', handleLocationSearch);
   
    cityInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const city = cityInput.value.trim();
            if (city) {
                fetchWeather(city);
                cityInput.blur();
            } else {
                showToast("Please enter a city name");
            }
            suggestionsList.classList.remove('show');
        }
    });
    // Search Focus/Blur & Morphing Logic
    cityInput.addEventListener('focus', () => {
        searchBox.classList.add('focus-mode');
        document.body.classList.add('search-focus');
        searchIconPath.setAttribute('d', PATH_CLOSE);
    });
    cityInput.addEventListener('blur', () => {
        setTimeout(() => {
            if (document.activeElement !== cityInput) {
                searchBox.classList.remove('focus-mode');
                document.body.classList.remove('search-focus');
                searchIconPath.setAttribute('d', PATH_SEARCH);
                suggestionsList.classList.remove('show');
            }
        }, 200);
    });
    cityInput.addEventListener('input', handleSearchInput);
   
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-box')) {
            suggestionsList.classList.remove('show');
        }
    });
    unitSwitch.addEventListener('change', () => {
        currentUnit = unitSwitch.checked ? 'imperial' : 'metric';
       
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
        lastFetchedCurrentWeather = weatherData;
       
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
        lastFetchedCurrentWeather = weatherData;
       
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
        await preloadChartIcons(forecastData.list.slice(0, 8));
        const airRes = await fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${CONFIG.apiKey}`);
        const airData = await airRes.json();
        updateUI(weatherData);
        updateAirQuality(airData);
       
        chartButtons.forEach(b => b.classList.remove('active'));
        document.querySelector('[data-type="temp"]').classList.add('active');
        updateChart(forecastData, 'temp');
       
        updateForecast(forecastData);
        updateHourlyForecast(forecastData);
        updateWindForecast(forecastData);
        updateBackground(weatherData.weather[0].main, weatherData);
        checkFavoriteStatus(weatherData.name);
       
        hideSkeleton();
    } catch (error) {
        console.error(error);
        showToast("Failed to load some details");
        updateUI(weatherData);
        hideSkeleton();
    }
}
// --- Icon Preloading ---
function preloadChartIcons(list) {
    const uniqueCodes = [...new Set(list.map(item => item.weather[0].icon))];
   
    const promises = uniqueCodes.map(code => {
        if (weatherIconsCache[code]) return Promise.resolve();
        return new Promise((resolve) => {
            const img = new Image();
            img.src = getIconUrl(code);
            img.onload = () => {
                const size = 40;
                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, size, size);
                weatherIconsCache[code] = canvas;
                resolve();
            };
            img.onerror = () => {
                console.warn(`Failed to load icon: ${code}`);
                resolve();
            };
        });
    });
    return Promise.all(promises);
}
// --- UI Updates ---
function updateUI(data) {
    const unitSymbol = currentUnit === 'metric' ? '°C' : '°F';
    const speedUnit = currentUnit === 'metric' ? 'm/s' : 'mph';
    document.getElementById('city-name').textContent = `${data.name}, ${data.sys.country}`;
   
    if (data.sys.country) {
        countryFlag.src = `https://flagcdn.com/h40/${data.sys.country.toLowerCase()}.png`;
        countryFlag.style.display = 'block';
    } else {
        countryFlag.style.display = 'none';
    }
    document.getElementById('temperature').textContent = `${Math.round(data.main.temp)}${unitSymbol}`;
    document.getElementById('description').textContent = data.weather[0].description;
   
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
function updateBackground(weatherMain, data, isNightOverride = null) {
    let isNight;
    if (isNightOverride !== null) {
        isNight = isNightOverride;
    } else if (data && data.sys) {
        const now = Math.floor(Date.now() / 1000);
        isNight = now > data.sys.sunset || now < data.sys.sunrise;
    } else {
        isNight = false;
    }
   
    let bgUrl;
    if (isNight && CONFIG.nightBackgrounds) {
        bgUrl = CONFIG.nightBackgrounds[weatherMain] || CONFIG.nightBackgrounds['Default'];
    } else {
        bgUrl = CONFIG.backgrounds[weatherMain] || CONFIG.backgrounds['Clear'];
    }
    const nextIndex = (activeBgIndex + 1) % 2;
    const nextLayer = bgLayers[nextIndex];
    const currentLayer = bgLayers[activeBgIndex];
    nextLayer.style.backgroundImage = `url('${bgUrl}')`;
   
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
function updateWindForecast(data) {
    if (!windList) return;
    windList.innerHTML = '';
    const speedUnit = currentUnit === 'metric' ? 'm/s' : 'mph';
    data.list.slice(0, 8).forEach(item => {
        const windSpeed = item.wind.speed;
        const windDeg = item.wind.deg;
        const date = new Date(item.dt * 1000);
        const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        const li = document.createElement('li');
        li.classList.add('wind-item');
        li.innerHTML = `
            <p class="h-time">${time}</p>
            <img
                src="images/weather_icons/direction.png"
                class="direction-icon"
                alt="Wind Direction"
                style="transform: rotate(${windDeg - 180}deg)"
            >
            <p class="h-temp">${Math.round(windSpeed)} ${speedUnit}</p>
        `;
        windList.appendChild(li);
    });
}
function updateForecast(data) {
    forecastList.innerHTML = '';
    const unitSymbol = currentUnit === 'metric' ? '°C' : '°F';
   
    const dailyMap = new Map();
   
    data.list.forEach(item => {
        const dateStr = item.dt_txt.split(' ')[0];
        if (!dailyMap.has(dateStr)) {
            dailyMap.set(dateStr, []);
        }
        dailyMap.get(dateStr).push(item);
    });
    const days = Array.from(dailyMap.keys()).slice(0, 5);
    days.forEach(dateStr => {
        const items = dailyMap.get(dateStr);
       
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
    const city = data.city;
    const startDt = slice[0].dt;
    const endDt = slice[slice.length - 1].dt;
    const daySeconds = 86400;
    const baseSunrise = city.sunrise;
    const baseSunset = city.sunset;
    const sunEvents = [];
    [-1, 0, 1].forEach(dayOffset => {
        const sr = baseSunrise + (dayOffset * daySeconds);
        const ss = baseSunset + (dayOffset * daySeconds);
       
        if (sr >= startDt && sr <= endDt) sunEvents.push({ type: 'sunrise', time: sr });
        if (ss >= startDt && ss <= endDt) sunEvents.push({ type: 'sunset', time: ss });
    });
    const dayNightPlugin = {
        id: 'dayNightPlugin',
        beforeDraw: (chart) => {
            const { ctx, chartArea, scales } = chart;
            const xAxis = scales.x;
           
            const getPixelForTime = (timestamp) => {
                for (let i = 0; i < slice.length - 1; i++) {
                    const t1 = slice[i].dt;
                    const t2 = slice[i+1].dt;
                    if (timestamp >= t1 && timestamp <= t2) {
                        const pct = (timestamp - t1) / (t2 - t1);
                        const x1 = xAxis.getPixelForValue(i);
                        const x2 = xAxis.getPixelForValue(i+1);
                        return x1 + (x2 - x1) * pct;
                    }
                }
                return null;
            };
            sunEvents.sort((a, b) => a.time - b.time);
            const eventPixels = sunEvents.map(e => ({ ...e, x: getPixelForTime(e.time) })).filter(e => e.x !== null);
            const boundaries = [
                { x: chartArea.left, time: startDt },
                ...eventPixels,
                { x: chartArea.right, time: endDt }
            ];
            ctx.save();
           
            for (let i = 0; i < boundaries.length - 1; i++) {
                const start = boundaries[i];
                const end = boundaries[i+1];
               
                let isNight = false;
               
                if (i === 0) {
                    const daysPassed = Math.round((startDt - baseSunrise) / 86400);
                    const localSR = baseSunrise + daysPassed * 86400;
                    const localSS = baseSunset + daysPassed * 86400;
                   
                    if (startDt >= localSR && startDt < localSS) {
                        isNight = false;
                    } else {
                        isNight = true;
                    }
                } else {
                    const boundaryType = boundaries[i].type;
                    if (boundaryType === 'sunset') isNight = true;
                    else if (boundaryType === 'sunrise') isNight = false;
                }
                const width = end.x - start.x;
                if (width <= 0) continue;
                if (isNight) {
                    ctx.fillStyle = 'rgba(0, 0, 20, 0.2)';
                    ctx.fillRect(start.x, chartArea.top, width, chartArea.height);
                }
               
                if (i > 0) {
                    const gradientWidth = 40;
                    const grd = ctx.createLinearGradient(start.x - gradientWidth/2, 0, start.x + gradientWidth/2, 0);
                    if (boundaries[i].type === 'sunset') {
                        grd.addColorStop(0, 'rgba(0, 0, 20, 0)');
                        grd.addColorStop(1, 'rgba(0, 0, 20, 0.2)');
                    } else {
                        grd.addColorStop(0, 'rgba(0, 0, 20, 0.2)');
                        grd.addColorStop(1, 'rgba(0, 0, 20, 0)');
                    }
                    ctx.fillStyle = grd;
                    ctx.fillRect(start.x - gradientWidth/2, chartArea.top, gradientWidth, chartArea.height);
                }
            }
            ctx.restore();
            ctx.save();
            eventPixels.forEach(e => {
                const x = e.x;
                const yBottom = chartArea.bottom;
                const yTop = chartArea.top;
                ctx.beginPath();
                ctx.setLineDash([5, 5]);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.lineWidth = 1;
                ctx.moveTo(x, yTop);
                ctx.lineTo(x, yBottom);
                ctx.stroke();
                const iconSize = 14;
                const iconY = yBottom - 10;
               
                ctx.beginPath();
                ctx.arc(x, iconY, iconSize/2, Math.PI, 0);
                ctx.fillStyle = '#fbbf24';
                ctx.fill();
               
                ctx.beginPath();
                ctx.setLineDash([]);
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.moveTo(x - iconSize, iconY);
                ctx.lineTo(x + iconSize, iconY);
                ctx.stroke();
            });
            ctx.restore();
        }
    };
    const datasetData = [];
    const pointStyles = [];
    const pointRadii = [];
    const pointHoverRadii = [];
    let lastCondition = null;
    slice.forEach((item, index) => {
        if (type === 'humidity') datasetData.push(item.main.humidity);
        else if (type === 'wind') datasetData.push(item.wind.speed);
        else datasetData.push(item.main.temp);
        const condition = item.weather[0].main;
        const iconCode = item.weather[0].icon;
       
        const showIcon = (index % 3 === 0) || (lastCondition && condition !== lastCondition);
       
        if (showIcon && weatherIconsCache[iconCode]) {
            pointStyles.push(weatherIconsCache[iconCode]);
            pointRadii.push(15);
            pointHoverRadii.push(25);
        } else {
            pointStyles.push('circle');
            pointRadii.push(3);
            pointHoverRadii.push(5);
        }
       
        lastCondition = condition;
    });
    let label, color, gradient;
    gradient = ctx.createLinearGradient(0, 0, 0, 300);
    if (type === 'humidity') {
        label = 'Humidity (%)';
        color = '#3b82f6';
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.6)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
    } else if (type === 'wind') {
        label = currentUnit === 'metric' ? 'Wind Speed (m/s)' : 'Wind Speed (mph)';
        color = '#f59e0b';
        gradient.addColorStop(0, 'rgba(245, 158, 11, 0.6)');
        gradient.addColorStop(1, 'rgba(245, 158, 11, 0)');
    } else {
        label = currentUnit === 'metric' ? 'Temperature (°C)' : 'Temperature (°F)';
        color = '#f97316';
        gradient.addColorStop(0, 'rgba(249, 115, 22, 0.6)');
        gradient.addColorStop(1, 'rgba(249, 115, 22, 0)');
    }
    if (weatherChart) {
        weatherChart.destroy();
    }
    const glowPlugin = {
        id: 'glowPlugin',
        beforeDraw: (chart) => {
            const activeElements = chart.getActiveElements();
            if (activeElements.length > 0) {
                const ctx = chart.ctx;
                activeElements.forEach(active => {
                    const meta = chart.getDatasetMeta(active.datasetIndex);
                    const point = meta.data[active.index];
                    if (point.options.radius > 10) {
                        ctx.save();
                        ctx.shadowColor = color;
                        ctx.shadowBlur = 15;
                        ctx.beginPath();
                        ctx.arc(point.x, point.y, point.options.radius, 0, Math.PI * 2);
                        ctx.fillStyle = 'rgba(255,255,255,0.1)';
                        ctx.fill();
                        ctx.restore();
                    }
                });
            }
        }
    };
    const crosshairPlugin = {
        id: 'crosshair',
        afterDraw: (chart) => {
            if (chart.tooltip?._active?.length) {
                const x = chart.tooltip._active[0].element.x;
                const yAxis = chart.scales.y;
                const ctx = chart.ctx;
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(x, yAxis.top);
                ctx.lineTo(x, yAxis.bottom);
                ctx.lineWidth = 2;
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.setLineDash([5, 5]);
                ctx.stroke();
                ctx.restore();
            }
        }
    };
    weatherChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: label,
                data: datasetData,
                borderColor: color,
                backgroundColor: gradient,
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointStyle: pointStyles,
                pointRadius: pointRadii,
                pointHoverRadius: pointHoverRadii,
                pointBackgroundColor: color,
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            // REMOVED BACKGROUND CHANGE ON HOVER
            // The "time travel" background update has been completely removed
            // to preserve the glassmorphism effect and visual consistency.
            onHover: (event, elements) => {
                // No background changes anymore — glassmorphism stays intact
                // All other hover behaviors (tooltip, crosshair, glow) remain active
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return context.parsed.y + (type === 'humidity' ? '%' : (type === 'temp' ? '°' : ''));
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#fff' },
                    grid: { display: false }
                },
                y: {
                    display: false,
                    grid: { display: false }
                }
            }
        },
        plugins: [glowPlugin, dayNightPlugin, crosshairPlugin]
    });
}
// --- Autocomplete ---
function handleSearchInput(e) {
    const query = e.target.value.trim();
    clearTimeout(debounceTimer);
   
    if (query.length > 0) {
        searchBox.classList.add('focus-mode');
        searchIconPath.setAttribute('d', PATH_CLOSE);
    }
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
        li.innerHTML = `
            <img src="https://flagcdn.com/w40/${loc.country.toLowerCase()}.png" class="suggestion-flag" alt="${loc.country}">
            <span>${loc.name}, ${loc.state ? loc.state + ', ' : ''}${loc.country}</span>
        `;
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
        favBtn.classList.add('animating');
        favBtn.textContent = 'favorite';
       
        const rect = favBtn.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        if (typeof createSparks === 'function') {
            createSparks(centerX, centerY + window.scrollY);
        }
        setTimeout(() => {
            favBtn.classList.remove('animating');
        }, 600);
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
    errorText.textContent = msg || "City not found or location unavailable. Please try again.";
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




function getIconUrl(code) {
    // Use higher resolution icons (@4x) for better quality
    return `https://openweathermap.org/img/wn/${code}@4x.png`;
}

// In updateUI(data), after setting the main icon:
document.getElementById('weather-icon').src = getIconUrl(iconCode);
const mainWeather = data.weather[0].main.toLowerCase();
const iconImg = document.getElementById('weather-icon');
iconImg.className = ''; // Reset
iconImg.classList.add(`icon-tint-${mainWeather}`);
if (iconCode.endsWith('n')) iconImg.classList.add('icon-tint-night');

// Also apply similar tinting in updateHourlyForecast and updateForecast loops:
 // Inside the loops where you create <img src="${getIconUrl(iconCode)}">
 const hourlyIcon = div.querySelector('img'); // or forecast img
 const hourlyMain = item.weather[0].main.toLowerCase();
 hourlyIcon.classList.add(`icon-tint-${hourlyMain}`);
 if (iconCode.endsWith('n')) hourlyIcon.classList.add('icon-tint-night');
