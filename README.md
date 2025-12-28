# ☁️ SkyCast Weather

A modern, feature-rich weather application with stunning visual effects and comprehensive weather data powered by OpenWeather API.

![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow.svg)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)

## ✨ Features

### 🌡️ Weather Information
- **Real-time Weather Data** - Current temperature, conditions, and weather description
- **Live Digital Clock** - Real-time local date and time display
- **Dual Unit Support** - Toggle between Celsius and Fahrenheit with animated switch
- **5-Day Forecast** - Extended weather predictions with daily summaries
- **Hourly Forecast** - Next 24 hours detailed weather breakdown
- **Wind Forecast** - Comprehensive wind speed and direction data

### 🎨 Visual Excellence
- **Dynamic Backgrounds** - Weather-responsive parallax backgrounds with smooth transitions
- **Glassmorphism UI** - Modern frosted glass design aesthetic
- **Animated Weather Icons** - Custom weather condition icons with vibrant filters
- **Particle Effects** - Dynamic particle system matching weather conditions
- **Skeleton Loading** - Smooth loading states for better UX

### 📊 Advanced Metrics
- **Air Quality Index (AQI)** - Real-time air pollution data
- **Pollutant Levels** - PM2.5, SO2, NO2, and O3 measurements
- **Interactive Charts** - Temperature, humidity, and wind speed visualizations with day/night cycle shading
- **Sunrise/Sunset Times** - Precise daylight information with countdown
- **Visibility & Pressure** - Additional atmospheric data
- **Wind Direction** - Cardinal direction indicators

### 🛡️ Intelligent Insights
- **Hazard Alerts** - Real-time safety warnings for extreme heat, cold, wind, visibility, and air quality
- **Precipitation Analysis** - Contextual rain probability with trend indicators (rising/falling), intensity forecasts, and duration estimates
- **Health Recommendations** - Actionable advice based on current air quality and weather conditions

### 🎯 Smart Features
- **Social Sharing** - Generate and share downloadable snapshots of current weather
- **City Search** - Autocomplete suggestions for quick city lookup
- **Geolocation** - Automatic weather detection for current location
- **Favorites System** - Save and quickly access favorite locations
- **Country Flags** - Visual country identification
- **Toast Notifications** - User-friendly status messages
- **Responsive Design** - Optimized for all device sizes

## 🚀 Live Demo

Visit the live application: [SkyCast Weather](https://tacticalreader.github.io/WEATHER-WEB/)

## 📸 Screenshots

*(Add screenshots of your application here)*

## 🛠️ Technologies Used

- **HTML5** - Semantic markup structure
- **CSS3** - Modern styling with custom properties, animations, and gradients
- **JavaScript (ES6+)** - Core functionality and API integration
- **Chart.js** - Interactive weather data visualizations
- **html2canvas** - Screenshot generation functionality
- **OpenWeather API** - Weather and air quality data provider
- **Google Fonts** - Custom typography (Orbitron, Nova Round, Geo)
- **Material Icons** - Icon set for UI elements
- **Unsplash** - High-quality background images

## 📋 Installation

### Prerequisites
- A modern web browser (Chrome, Firefox, Safari, Edge)
- OpenWeather API key (free tier available)

### Setup Instructions

1. **Clone the repository**
   ```
   git clone https://github.com/TacticalReader/WEATHER-WEB.git
   cd WEATHER-WEB
   ```

2. **Get your OpenWeather API Key**
   - Visit [OpenWeather API](https://openweathermap.org/api)
   - Sign up for a free account
   - Generate your API key from the dashboard

3. **Configure API Key**
   - Open `config.js`
   - Replace the existing API key with your own:
     ```
     const CONFIG = {
         apiKey: "YOUR_API_KEY_HERE",
         // ... rest of config
     };
     ```

4. **Launch the application**
   - Open `index.html` in your web browser
   - Or use a local server:
     ```
     # Using Python
     python -m http.server 8000
     
     # Using Node.js
     npx http-server
     ```

5. **Access the app**
   - Navigate to `http://localhost:8000` (or relevant port)

## 📁 Project Structure

```
WEATHER-WEB/
├── index.html           # Main HTML structure
├── style.css           # Styles and animations
├── script.js           # Core application logic
├── config.js           # API key and configuration
├── icons.js            # Weather icon mappings
├── particles.js        # Particle effects system
├── analysis.js         # Weather analysis logic
├── LICENSE             # Apache 2.0 License
├── README.md           # Documentation
├── images/             # Image assets
│   ├── weather_icons/  # Weather condition icons
│   └── openweather.png # API attribution logo
└── .github/            # GitHub-specific files
```

## 🎮 Usage

### Search for a City
1. Type city name in the search box
2. Select from autocomplete suggestions
3. Click search button or press Enter

### Use Current Location
- Click the location icon (📍) to get weather for your current position
- Allow browser location permissions when prompted

### Toggle Temperature Units
- Use the toggle switch to convert between °C and °F
- Settings persist across sessions

### Share Snapshot
1. Click the share icon (top right)
2. Use the native share menu (mobile) or download the image automatically
3. Share your weather card with friends

### Add Favorites
1. Search for a city
2. Click the heart icon (❤️) to add to favorites
3. Access favorites from the quick-access list below search

### View Different Data
- Click chart buttons (Temp/Humidity/Wind) to switch visualizations
- Scroll through hourly forecast for detailed hourly data
- Check 5-day forecast for extended predictions

## 🔑 API Features Used

### OpenWeather APIs
- **Current Weather API** - Real-time weather conditions
- **5-Day Forecast API** - Extended weather predictions
- **Geocoding API** - City name to coordinates conversion
- **Air Pollution API** - Air quality index and pollutants
- **Weather Icons** - Official OpenWeather icon set

## 🎨 Customization

### Modify Backgrounds
Edit `config.js` to change weather-condition backgrounds:
```
backgrounds: {
    'Clear': 'YOUR_IMAGE_URL',
    'Clouds': 'YOUR_IMAGE_URL',
    // ... add more conditions
}
```

### Change Color Scheme
Modify CSS custom properties in `style.css`:
```
:root {
    --glass-bg: rgba(255, 255, 255, 0.1);
    --glass-border: rgba(255, 255, 255, 0.2);
    --accent: #64B5F6;
    /* ... customize colors */
}
```

### Adjust Chart Appearance
Configure Chart.js options in `script.js` under the `createChart()` function.

## 🌟 Features in Detail

### Dynamic Background System
- Automatically changes based on weather conditions
- Separate day/night background sets
- Smooth cross-fade transitions between states
- Parallax scrolling effect

### Air Quality Monitoring
- Displays comprehensive AQI status
- Color-coded quality indicators (Good, Moderate, Unhealthy, etc.)
- Individual pollutant measurements
- Health recommendations based on AQI level

### Smart Forecast Display
- Visual temperature trends
- Precipitation probability
- Min/Max temperature ranges
- Weather condition icons for quick recognition

### Hazard Interpretation Engine
- Analyzes multiple weather parameters simultaneously
- Provides color-coded alerts (Caution, Danger, Severe)
- Monitors thermal comfort, wind safety, and visibility risks

### Precipitation Probability Logic
- Goes beyond simple percentages
- Analyzes forecast trends (intensifying vs clearing)
- Provides human-readable context about rain duration and intensity

## 🐛 Troubleshooting

### API Key Issues
- Ensure your API key is active (may take a few hours after generation)
- Check for typos in `config.js`
- Verify API call limits on free tier

### Location Not Working
- Enable location services in browser settings
- Check HTTPS connection (required for geolocation)
- Grant permission when prompted

### Images Not Loading
- Check internet connection
- Verify Unsplash URLs are accessible
- Check browser console for CORS errors

## 📱 Browser Compatibility

- ✅ Chrome/Edge (Chromium) 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Opera 76+

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Contribution Ideas
- Add more weather metrics
- Implement weather alerts
- Add more language support
- Improve mobile responsiveness
- Add weather map integration
- Create theme customization options

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [OpenWeather](https://openweathermap.org/) - Weather data API
- [Unsplash](https://unsplash.com/) - Background imagery
- [Chart.js](https://www.chartjs.org/) - Data visualization library
- [html2canvas](https://html2canvas.hertzen.com/) - Screenshot library
- [Google Fonts](https://fonts.google.com/) - Typography
- [Material Icons](https://fonts.google.com/icons) - UI iconography

## 📧 Contact

**TacticalReader** - [@TacticalReader](https://github.com/TacticalReader)

Project Link: [https://github.com/TacticalReader/WEATHER-WEB](https://github.com/TacticalReader/WEATHER-WEB)

---

⭐ Star this repository if you find it helpful!

Made with ❤️ by TacticalReader
