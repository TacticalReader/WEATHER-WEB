function createSparks(x, y) {
    const count = 8;
    for (let i = 0; i < count; i++) {
        const spark = document.createElement('div');
        spark.classList.add('spark');
        document.body.appendChild(spark);
        
        const angle = (i / count) * 360;
        const velocity = 20 + Math.random() * 20;
        
        spark.style.left = `${x}px`;
        spark.style.top = `${y}px`;
        spark.style.transform = `rotate(${angle}deg) translate(0px)`;
        
        // Animate
        spark.animate([
            { transform: `rotate(${angle}deg) translate(0px) scale(1)`, opacity: 1 },
            { transform: `rotate(${angle}deg) translate(${velocity}px) scale(0)`, opacity: 0 }
        ], {
            duration: 500,
            easing: 'cubic-bezier(0, .9, .57, 1)',
        }).onfinish = () => spark.remove();
    }
}
const HazardSystem = {
    thresholds: {
        wind: { caution: 10, danger: 17, severe: 24 }, // m/s
        visibility: { caution: 5000, danger: 1000, severe: 200 }, // meters
        aqi: { caution: 3, danger: 4, severe: 5 }
    },

    analyze: function(current, forecast, airQuality, unit) {
        const alerts = [];
        
        // Normalize inputs to Metric for calculation
        let t = current.main.temp;
        let w = current.wind.speed;
        let vis = current.visibility;
        const h = current.main.humidity;
        const weatherId = current.weather[0].id;

        if (unit === 'imperial') {
            t = (t - 32) * 5 / 9; // F to C
            w = w * 0.44704; // mph to m/s
            // Visibility usually comes in meters from API even if unit is imperial, 
            // but if it was miles, we'd convert. OpenWeatherMap standard is meters.
        }
        
        // Helper to add alert
        const add = (type, level, title, msg, icon) => {
            alerts.push({ type, level, title, msg, icon });
        };

        // 1. Thermal Comfort (Heat/Cold)
        if (t >= 27) {
            if (t >= 40) add('heat', 'severe', 'Extreme Heat', 'Life-threatening heat. Stay cool.', 'thermostat');
            else if (t >= 32 && h > 60) add('heat', 'danger', 'High Heat Index', 'Feels much hotter due to humidity.', 'water_drop');
            else if (t >= 32) add('heat', 'caution', 'High Temperature', 'Prolonged exposure may cause fatigue.', 'wb_sunny');
            else if (t >= 27 && h > 75) add('heat', 'caution', 'Muggy Conditions', 'High humidity increasing discomfort.', 'water_drop');
        } else if (t <= 5) {
            if (t <= -10 && w > 5) add('cold', 'severe', 'Extreme Wind Chill', 'Frostbite risk in minutes.', 'ac_unit');
            else if (t <= 0 && w > 5) add('cold', 'danger', 'Bitter Cold', 'Wind making it feel freezing.', 'air');
            else if (t <= 5) add('cold', 'caution', 'Chilly', 'Dress warmly.', 'ac_unit');
        }

        // 2. Wind & Storms
        if (w >= this.thresholds.wind.severe) add('wind', 'severe', 'Hurricane Force', 'Destructive winds. Seek shelter.', 'cyclone');
        else if (w >= this.thresholds.wind.danger) add('wind', 'danger', 'Gale Warning', 'Walking and driving difficult.', 'air');
        else if (w >= this.thresholds.wind.caution) {
            if (weatherId >= 500 && weatherId < 600) add('wind', 'danger', 'Stormy Weather', 'Wind and rain reducing control.', 'rainy');
            else add('wind', 'caution', 'Windy', 'Secure loose outdoor objects.', 'air');
        }

        // 3. Visibility & Air Quality
        if (vis <= this.thresholds.visibility.severe) add('vis', 'severe', 'Zero Visibility', 'Do not drive unless necessary.', 'visibility_off');
        else if (vis <= this.thresholds.visibility.danger) add('vis', 'danger', 'Dense Fog', 'Hazardous driving conditions.', 'foggy');
        
        if (airQuality && airQuality.list && airQuality.list[0]) {
            const aqi = airQuality.list[0].main.aqi;
            if (aqi >= 5) add('aqi', 'severe', 'Hazardous Air', 'Keep windows closed. Wear a mask.', 'masks');
            else if (aqi >= 4) add('aqi', 'danger', 'Poor Air Quality', 'Reduce outdoor exertion.', 'masks');
            else if (aqi === 3) add('aqi', 'caution', 'Moderate Air', 'Sensitive groups should take care.', 'masks');
        }

        // 4. Forecast (Upcoming Risk)
        // Check next 3-6 hours
        if (forecast && forecast.list) {
            const nextPoints = forecast.list.slice(0, 2); // Next 6 hours
            let rainIncoming = false;
            let stormIncoming = false;
            
            nextPoints.forEach(pt => {
                const id = pt.weather[0].id;
                if (id >= 200 && id < 300) stormIncoming = true;
                if (id >= 500 && id < 600) rainIncoming = true;
            });

            // Only show upcoming if not currently happening
            const currentIsRain = (weatherId >= 500 && weatherId < 600);
            const currentIsStorm = (weatherId >= 200 && weatherId < 300);

            if (stormIncoming && !currentIsStorm) add('future', 'danger', 'Storm Approaching', 'Thunderstorms expected soon.', 'thunderstorm');
            else if (rainIncoming && !currentIsRain) add('future', 'caution', 'Rain Starting Soon', 'Prepare for precipitation.', 'umbrella');
        }

        return alerts;
    }
};
