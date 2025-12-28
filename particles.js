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
    burstParticles: [],
    animationFrame: null,
    width: 0,
    height: 0,
    speed: 0,
    targetDirection: 0,
    currentDirection: null,
    time: 0,
    weatherId: 800,
    isNight: false,
    mouse: { x: -1000, y: -1000, active: false },
    boundResize: null,
    boundMouse: null,
    boundLeave: null,

    init: function(canvasId, windSpeed, windDeg, weatherId, isNight) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.speed = windSpeed;
        this.weatherId = weatherId || 800;
        this.isNight = isNight;

        // Convert wind deg (from) to flow angle (to)
        // 0 deg (N) -> flows to S (90 deg in canvas)
        const targetDir = (windDeg - 90 + 180) * (Math.PI / 180);
        
        if (this.currentDirection === null) {
            this.currentDirection = targetDir;
        }
        this.targetDirection = targetDir;

        this.resize();
        
        if (this.width === 0) {
            setTimeout(() => this.init(canvasId, windSpeed, windDeg, weatherId, isNight), 200);
            return;
        }

        // Setup interaction
        if (!this.boundMouse) {
            this.boundMouse = (e) => {
                const rect = this.canvas.getBoundingClientRect();
                const scaleX = this.canvas.width / rect.width;
                const scaleY = this.canvas.height / rect.height;
                this.mouse.x = (e.clientX - rect.left) * scaleX;
                this.mouse.y = (e.clientY - rect.top) * scaleY;
                this.mouse.active = true;
            };
            this.boundLeave = () => { this.mouse.active = false; };
            
            this.canvas.addEventListener('mousemove', this.boundMouse);
            this.canvas.addEventListener('mouseleave', this.boundLeave);
            this.canvas.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.boundMouse(e.touches[0]);
            }, {passive: false});
            this.canvas.addEventListener('touchmove', (e) => {
                e.preventDefault();
                this.boundMouse(e.touches[0]);
            }, {passive: false});
        }

        this.createParticles();
        this.start();
        
        if (this.boundResize) window.removeEventListener('resize', this.boundResize);
        this.boundResize = this.resize.bind(this);
        window.addEventListener('resize', this.boundResize);
    },

    resize: function() {
        if (!this.canvas) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        if (rect.width === 0) return;
        
        this.width = rect.width;
        this.height = rect.height;
        
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.ctx.scale(dpr, dpr);
    },

    createParticles: function() {
        const baseCount = this.speed > 10 ? 200 : 120;
        const count = Math.min(baseCount, window.innerWidth < 768 ? 100 : 300);
        
        this.particles = [];
        for (let i = 0; i < count; i++) {
            this.particles.push(this.resetParticle({}));
        }
    },

    resetParticle: function(p, isBurst = false) {
        p.x = Math.random() * this.width;
        p.y = Math.random() * this.height;
        
        // If burst, spawn upstream relative to current direction
        if (isBurst) {
            const dist = Math.random() * 100;
            const angle = this.currentDirection + Math.PI;
            p.x = (this.width/2) + Math.cos(angle) * (this.width/2 + dist);
            p.y = (this.height/2) + Math.sin(angle) * (this.height/2 + dist);
        }

        p.age = 0;
        p.life = Math.random() * 60 + 40;
        if (isBurst) p.life = 30 + Math.random() * 20;

        p.trail = [];
        p.trailLength = 10 + Math.random() * 20;
        p.thickness = 0.5 + Math.random() * 1.5;
        p.speedMult = 0.8 + Math.random() * 0.4;
        if (isBurst) p.speedMult *= 1.5;

        // Color variation
        if (this.isNight) {
            const v = Math.floor(Math.random() * 55) + 200;
            p.color = `rgba(${v}, ${v}, 255,`;
        } else {
            const g = Math.floor(Math.random() * 100) + 50;
            p.color = `rgba(37, ${g}, 235,`;
        }
        
        return p;
    },

    drawBackground: function() {
        // Gradient
        const grad = this.ctx.createLinearGradient(0, 0, 0, this.height);
        if (this.isNight) {
            grad.addColorStop(0, 'rgba(15, 23, 42, 0.3)');
            grad.addColorStop(1, 'rgba(30, 27, 75, 0.3)');
        } else {
            grad.addColorStop(0, 'rgba(239, 246, 255, 0.3)');
            grad.addColorStop(1, 'rgba(219, 234, 254, 0.3)');
        }
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Weather Overlay (Clouds/Mist)
        const isCloudy = (this.weatherId >= 801 && this.weatherId <= 804) || (this.weatherId >= 200 && this.weatherId < 600);
        if (isCloudy) {
            this.ctx.fillStyle = this.isNight ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.1)';
            this.ctx.beginPath();
            this.ctx.arc(this.width * 0.2, this.height * 0.3, 60, 0, Math.PI*2);
            this.ctx.arc(this.width * 0.8, this.height * 0.7, 80, 0, Math.PI*2);
            this.ctx.fill();
        }
    },

    drawCompass: function() {
        const r = 20;
        const cx = this.width - r - 15;
        const cy = this.height - r - 15;

        this.ctx.save();
        this.ctx.translate(cx, cy);
        
        this.ctx.strokeStyle = this.isNight ? 'rgba(255,255,255,0.4)' : 'rgba(30, 58, 138, 0.4)';
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, r, 0, Math.PI*2);
        this.ctx.stroke();

        this.ctx.fillStyle = this.isNight ? '#fff' : '#1e3a8a';
        this.ctx.font = "bold 10px sans-serif";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";

        this.ctx.fillText("N", 0, -r + 6);
        this.ctx.fillText("S", 0, r - 6);
        this.ctx.fillText("E", r - 6, 0);
        this.ctx.fillText("W", -r + 6, 0);

        // North Arrow
        this.ctx.beginPath();
        this.ctx.moveTo(0, -r - 5);
        this.ctx.lineTo(-3, -r);
        this.ctx.lineTo(3, -r);
        this.ctx.fill();

        this.ctx.restore();
    },

    update: function() {
        if (!this.width) {
             this.resize();
             if (!this.width) {
                 this.animationFrame = requestAnimationFrame(() => this.update());
                 return;
             }
        }

        this.ctx.clearRect(0, 0, this.width, this.height);
        this.drawBackground();
        this.drawCompass();

        // Interpolate Direction
        const diff = this.targetDirection - this.currentDirection;
        if (Math.abs(diff) > 0.001) {
            this.currentDirection += diff * 0.05;
        }

        this.time += 0.01;
        const noiseTime = this.time * 0.2;

        // Bursts
        if (Math.random() < 0.005) {
            for(let k=0; k<10; k++) this.burstParticles.push(this.resetParticle({}, true));
        }

        const all = [...this.particles, ...this.burstParticles];
        this.ctx.lineCap = 'round';

        for (let i = all.length - 1; i >= 0; i--) {
            let p = all[i];
            
            // Flow Vector with Noise
            const scale = 0.01;
            const noise = Math.sin(p.x * scale + noiseTime) * Math.cos(p.y * scale + noiseTime);
            const angle = this.currentDirection + (noise * 0.3);
            
            const speedFactor = Math.min(Math.max(this.speed, 2), 20) * p.speedMult;
            const vx = Math.cos(angle) * speedFactor;
            const vy = Math.sin(angle) * speedFactor;

            p.x += vx;
            p.y += vy;
            p.age++;

            p.trail.push({x: p.x, y: p.y});
            if (p.trail.length > p.trailLength) p.trail.shift();

            // Interaction & Appearance
            let alpha = Math.sin((p.age / p.life) * Math.PI);
            let thickness = p.thickness;
            
            if (this.mouse.active) {
                const dx = p.x - this.mouse.x;
                const dy = p.y - this.mouse.y;
                if (dx*dx + dy*dy < 2500) {
                    alpha = Math.min(1, alpha + 0.3);
                    thickness += 1;
                }
            }

            this.ctx.strokeStyle = `${p.color} ${alpha})`;
            this.ctx.lineWidth = thickness;
            
            if (this.speed < 5) {
                this.ctx.shadowBlur = 4;
                this.ctx.shadowColor = p.color + "0.5)";
            }

            if (p.trail.length > 1) {
                this.ctx.beginPath();
                this.ctx.moveTo(p.trail[0].x, p.trail[0].y);
                for (let j = 1; j < p.trail.length; j++) {
                    this.ctx.lineTo(p.trail[j].x, p.trail[j].y);
                }
                this.ctx.stroke();
            }
            this.ctx.shadowBlur = 0;

            // Cleanup
            const isBurst = this.burstParticles.includes(p);
            if (p.age >= p.life || p.x < -50 || p.x > this.width + 50 || p.y < -50 || p.y > this.height + 50) {
                if (isBurst) {
                    this.burstParticles.splice(this.burstParticles.indexOf(p), 1);
                } else {
                    this.resetParticle(p);
                    p.trail = [];
                }
            }
        }

        this.animationFrame = requestAnimationFrame(() => this.update());
    },

    start: function() {
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
        this.update();
    }
};
