const apiKey = "511c0d53e786d6e701870951d85c605d";
const searchBtn = document.getElementById('search-btn');
const locationBtn = document.getElementById('location-btn');
const cityInput = document.getElementById('city-input');
const weatherContent = document.getElementById('weather-content');
const errorMessage = document.getElementById('error-message');
const forecastList = document.getElementById('forecast-list');

// Chart instance
let weatherChart = null;

// Event Listeners
searchBtn.addEventListener('click', () => {
    const city = cityInput.value.trim();
    if (city) fetchWeather(city);
});

locationBtn.addEventListener('click', () => {
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
});

cityInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const city = cityInput.value.trim();
        if (city) fetchWeather(city);
    }
});

// Initial load - Changed to Delhi
fetchWeather('Delhi');

async function fetchWeather(city) {
    try {
        const weatherRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`);
        if (!weatherRes.ok) throw new Error('City not found');
        const weatherData = await weatherRes.json();
        
        await fetchAdditionalData(weatherData);
    } catch (error) {
        console.error(error);
        showError();
    }
}

async function fetchWeatherByCoords(lat, lon) {
    try {
        const weatherRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`);
        if (!weatherRes.ok) throw new Error('Location not found');
        const weatherData = await weatherRes.json();
        
        await fetchAdditionalData(weatherData);
    } catch (error) {
        console.error(error);
        showError();
    }
}

async function fetchAdditionalData(weatherData) {
    try {
        const { lat, lon } = weatherData.coord;

        // Fetch Forecast
        const forecastRes = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`);
        const forecastData = await forecastRes.json();

        // Fetch Air Pollution
        const airRes = await fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`);
        const airData = await airRes.json();

        updateUI(weatherData);
        updateAirQuality(airData);
        updateChart(forecastData);
        updateForecast(forecastData);
        
        weatherContent.style.display = 'block';
        errorMessage.style.display = 'none';
    } catch (error) {
        console.error(error);
        showError();
    }
}

function showError() {
    weatherContent.style.display = 'none';
    errorMessage.style.display = 'flex';
}

function updateUI(data) {
    document.getElementById('city-name').textContent = `${data.name}, ${data.sys.country}`;
    document.getElementById('temperature').textContent = `${Math.round(data.main.temp)}°C`;
    document.getElementById('description').textContent = data.weather[0].description;
    document.getElementById('weather-icon').src = `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`;
    
    document.getElementById('wind-speed').textContent = `${data.wind.speed} m/s`;
    document.getElementById('wind-dir').textContent = getCardinalDirection(data.wind.deg);
    
    document.getElementById('humidity').textContent = `${data.main.humidity}%`;
    document.getElementById('pressure').textContent = `${data.main.pressure} hPa`;
    document.getElementById('visibility').textContent = `${(data.visibility / 1000).toFixed(1)} km`;
    
    document.getElementById('sunrise').textContent = formatTime(data.sys.sunrise, data.timezone);
    document.getElementById('sunset').textContent = formatTime(data.sys.sunset, data.timezone);
}

function updateAirQuality(data) {
    if (!data.list || data.list.length === 0) return;
    
    const record = data.list[0];
    const aqi = record.main.aqi;
    const { pm2_5, so2, no2, o3 } = record.components;
    
    const aqiLabels = {
        1: 'Good',
        2: 'Fair',
        3: 'Moderate',
        4: 'Poor',
        5: 'Very Poor'
    };

    document.getElementById('aqi-status').textContent = aqiLabels[aqi] || aqi;
    document.getElementById('pm25').textContent = pm2_5;
    document.getElementById('so2').textContent = so2;
    document.getElementById('no2').textContent = no2;
    document.getElementById('o3').textContent = o3;
}

function updateForecast(data) {
    forecastList.innerHTML = '';
    
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
            <p class="f-temp">${temp}°C</p>
            <p class="f-desc">${desc}</p>
        `;
        forecastList.appendChild(forecastItem);
    });
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

function updateChart(data) {
    const ctx = document.getElementById('forecastChart').getContext('2d');
    
    const slice = data.list.slice(0, 8);
    const labels = slice.map(item => {
        const d = new Date(item.dt * 1000);
        return `${d.getHours()}:00`;
    });
    const temps = slice.map(item => item.main.temp);

    if (weatherChart) {
        weatherChart.destroy();
    }

    weatherChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Temperature (°C)',
                data: temps,
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.2)',
                borderWidth: 2,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#2563eb'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#333' }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#4b5563' },
                    grid: { color: 'rgba(0,0,0,0.1)' }
                },
                y: {
                    ticks: { color: '#4b5563' },
                    grid: { color: 'rgba(0,0,0,0.1)' }
                }
            }
        }
    });
}
