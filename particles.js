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
            w = w * 0.44704;     // mph to m/s
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
        if (forecast && forecast.list) {
            const nextPoints = forecast.list.slice(0, 2); // Next 6 hours
            let rainIncoming = false;
            let stormIncoming = false;

            nextPoints.forEach(pt => {
                const id = pt.weather[0].id;
                if (id >= 200 && id < 300) stormIncoming = true;
                if (id >= 500 && id < 600) rainIncoming = true;
            });

            const currentIsRain = (weatherId >= 500 && weatherId < 600);
            const currentIsStorm = (weatherId >= 200 && weatherId < 300);

            if (stormIncoming && !currentIsStorm) add('future', 'danger', 'Storm Approaching', 'Thunderstorms expected soon.', 'thunderstorm');
            else if (rainIncoming && !currentIsRain) add('future', 'caution', 'Rain Starting Soon', 'Prepare for precipitation.', 'umbrella');
        }

        return alerts;
    }
};

const ProbabilitySystem = {
    analyze: function(forecast) {
        if (!forecast || !forecast.list) return null;

        // Analyze next 12 hours (4 segments of 3h)
        const segments = forecast.list.slice(0, 4);

        // Calculate Max POP
        const pops = segments.map(s => s.pop || 0); // safeguard if pop is missing
        const maxPop = Math.max(...pops);

        // If probability is negligible, don't show the panel
        if (maxPop < 0.25) return null;

        // 1. Trend Analysis
        let trend = 'Steady';
        let trendClass = 'trend-steady';

        const firstHalf = (pops[0] + pops[1]) / 2;
        const secondHalf = (pops[2] + pops[3]) / 2;

        if (secondHalf > firstHalf + 0.15) {
            trend = 'Rising Chance';
            trendClass = 'trend-increasing';
        } else if (secondHalf < firstHalf - 0.15) {
            trend = 'Clearing Up';
            trendClass = 'trend-decreasing';
        }

        // 2. Intensity & Duration
        let rainVolume = 0;
        let rainySegments = 0;
        let breaks = 0;
        let wasRaining = false;

        segments.forEach(s => {
            let precip = 0;
            if (s.rain && s.rain['3h']) precip += s.rain['3h'];
            if (s.snow && s.snow['3h']) precip += s.snow['3h'];

            rainVolume += precip;

            if (precip > 0.1) {
                rainySegments++;
                if (!wasRaining && rainySegments > 1) breaks++; // gap detected
                wasRaining = true;
            } else {
                wasRaining = false;
            }
        });

        let intensity = 'Light';
        if (rainVolume > 15) intensity = 'Heavy';
        else if (rainVolume > 5) intensity = 'Moderate';

        const duration = rainySegments * 3;

        // 3. Linguistic Phrasing
        let phrase = '';
        const popPct = Math.round(maxPop * 100);

        if (popPct >= 80) {
            if (intensity === 'Heavy' && duration >= 6) phrase = 'High Chance of Sustained Rainfall';
            else phrase = 'Precipitation Definite';
        } else if (popPct >= 60) {
            phrase = 'Rain Likely';
        } else if (popPct >= 40) {
            if (breaks > 0 || duration <= 3) phrase = 'Scattered Showers Possible';
            else phrase = 'Showers Possible';
        } else {
            phrase = 'Low Chance of Rain';
        }

        // 4. Contextual Framing
        let context = `${intensity} intensity expected. `;
        if (duration > 0) {
            if (breaks > 0) context += `Intermittent precipitation spread over the next 12 hours.`;
            else if (duration <= 3) context += `Brief precipitation expected.`;
            else context += `Likely to last around ${duration} hours in the upcoming window.`;
        } else {
            context += `Brief or intermittent precipitation expected.`;
        }

        return {
            pop: popPct,
            phrase,
            trend,
            trendClass,
            context,
            explanation: "In OpenWeather forecasts, precipitation probability (POP) typically refers to the likelihood of measurable precipitation at the given location during the forecast interval, not duration or coverage.",
            disclaimer: "Note: A lower percentage does not guarantee dryness, and a higher percentage does not guarantee continuous rain."
        };
    }
};

const WindMap = {
    canvas: null,
    ctx: null,
    particles: [],
    width: 0,
    height: 0,
    speed: 0,
    direction: 0,
    targetDirection: 0,
    time: 0,
    animationFrame: null,
    
    init: function(canvasId, speed, deg, weatherId, isNight) {
        this.canvas = document.getElementById(canvasId);
        if(!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        
        this.speed = speed || 5;
        // Convert meteorological degrees (0=N, 90=E) to canvas radians (0=E, 90=S)
        // Wind comes FROM deg.
        // If wind is 0 (N), it blows TO South (90 deg).
        // Canvas 0 is East. South is PI/2.
        // Angle = (deg - 90 + 180) * PI/180
        this.targetDirection = (deg - 90 + 180) * (Math.PI / 180);
        this.direction = this.targetDirection;
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        this.createParticles();
        this.start();
    },
    
    resize: function() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.width = rect.width;
        this.height = rect.height;
        this.canvas.width = this.width * window.devicePixelRatio;
        this.canvas.height = this.height * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    },
    
    createParticles: function() {
        const count = 200;
        this.particles = [];
        for(let i=0; i<count; i++) {
            this.particles.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                age: Math.random() * 100,
                life: 50 + Math.random() * 100,
                speed: this.speed * (0.5 + Math.random()),
                offset: Math.random() * 1000
            });
        }
    },
    
    update: function() {
        // Dark trail effect
        this.ctx.fillStyle = 'rgba(15, 23, 42, 0.2)'; // Dark blue-ish slate
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Grid
        this.drawGrid();
        
        this.time += 0.005;
        
        this.ctx.lineWidth = 2;
        this.ctx.lineCap = 'round';
        
        this.particles.forEach(p => {
            // Noise for waviness
            const noise = Math.sin(p.x * 0.005 + this.time) * Math.cos(p.y * 0.005 + p.offset);
            const angle = this.direction + noise * 0.5;
            
            const vx = Math.cos(angle) * p.speed * 0.5; // Scale down for pixels
            const vy = Math.sin(angle) * p.speed * 0.5;
            
            const oldX = p.x;
            const oldY = p.y;
            
            p.x += vx;
            p.y += vy;
            p.age++;
            
            // Reset
            if(p.age > p.life || p.x < -20 || p.x > this.width + 20 || p.y < -20 || p.y > this.height + 20) {
                p.x = Math.random() * this.width;
                p.y = Math.random() * this.height;
                p.age = 0;
            }
            
            // Draw
            const lifeRatio = p.age / p.life;
            const alpha = Math.sin(lifeRatio * Math.PI); // Fade in and out
            
            // Color gradient based on speed
            // Fast = Cyan/White, Slow = Blue/Purple
            const speedNorm = Math.min(p.speed / 20, 1);
            const r = 50 + speedNorm * 100;
            const g = 100 + speedNorm * 155;
            const b = 255;
            
            this.ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
            this.ctx.beginPath();
            this.ctx.moveTo(oldX, oldY);
            this.ctx.lineTo(p.x, p.y);
            this.ctx.stroke();
        });
        
        this.drawCompass();
        
        this.animationFrame = requestAnimationFrame(() => this.update());
    },
    
    drawGrid: function() {
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        this.ctx.lineWidth = 1;
        const step = 50;
        this.ctx.beginPath();
        for(let x=0; x<this.width; x+=step) {
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.height);
        }
        for(let y=0; y<this.height; y+=step) {
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.width, y);
        }
        this.ctx.stroke();
    },
    
    drawCompass: function() {
        const cx = this.width - 40;
        const cy = 40;
        const r = 25;
        
        this.ctx.save();
        this.ctx.translate(cx, cy);
        
        // Outer ring
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, r, 0, Math.PI*2);
        this.ctx.stroke();
        
        // N/S/E/W
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.font = '10px Orbitron';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('N', 0, -r + 8);
        
        // Dynamic arrow pointing to wind direction
        this.ctx.rotate(this.direction);
        
        this.ctx.fillStyle = '#38bdf8';
        this.ctx.beginPath();
        this.ctx.moveTo(10, 0);
        this.ctx.lineTo(-5, 5);
        this.ctx.lineTo(-5, -5);
        this.ctx.fill();
        
        this.ctx.restore();
    },
    
    start: function() {
        if(this.animationFrame) cancelAnimationFrame(this.animationFrame);
        this.update();
    }
};
