const apiKey = "511c0d53e786d6e701870951d85c605d";
const searchBtn = document.getElementById('search-btn');
const cityInput = document.getElementById('city-input');
const weatherContent = document.getElementById('weather-content');
const errorMessage = document.getElementById('error-message');

// Chart instance
let weatherChart = null;

// Event Listeners
searchBtn.addEventListener('click', () => {
    const city = cityInput.value.trim();
    if (city) fetchWeather(city);
});

cityInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const city = cityInput.value.trim();
        if (city) fetchWeather(city);
    }
});

// Initial load
fetchWeather('London');

async function fetchWeather(city) {
    try {
        // Fetch Current Weather
        const weatherRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`);
        if (!weatherRes.ok) throw new Error('City not found');
        const weatherData = await weatherRes.json();

        // Fetch Forecast
        const forecastRes = await fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${apiKey}&units=metric`);
        const forecastData = await forecastRes.json();

        updateUI(weatherData);
        updateChart(forecastData);
        
        weatherContent.style.display = 'block';
        errorMessage.style.display = 'none';
    } catch (error) {
        console.error(error);
        weatherContent.style.display = 'none';
        errorMessage.style.display = 'flex';
    }
}

function updateUI(data) {
    document.getElementById('city-name').textContent = `${data.name}, ${data.sys.country}`;
    document.getElementById('temperature').textContent = `${Math.round(data.main.temp)}°C`;
    document.getElementById('description').textContent = data.weather[0].description;
    document.getElementById('weather-icon').src = `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`;
    
    document.getElementById('wind-speed').textContent = `${data.wind.speed} m/s`;
    document.getElementById('wind-dir').textContent = getCardinalDirection(data.wind.deg);
    
    document.getElementById('humidity').textContent = `${data.main.humidity}%`;
    
    document.getElementById('sunrise').textContent = formatTime(data.sys.sunrise, data.timezone);
    document.getElementById('sunset').textContent = formatTime(data.sys.sunset, data.timezone);
}

function getCardinalDirection(angle) {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return directions[Math.round(angle / 45) % 8];
}

function formatTime(unixTimestamp, timezoneOffset) {
    // Create date object shifted to the target timezone
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
    
    // Extract next 8 data points (approx 24 hours)
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
                borderColor: 'rgba(255, 255, 255, 0.8)',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                borderWidth: 2,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: 'white' }
                }
            },
            scales: {
                x: {
                    ticks: { color: 'rgba(255,255,255,0.7)' },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                },
                y: {
                    ticks: { color: 'rgba(255,255,255,0.7)' },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                }
            }
        }
    });
}
