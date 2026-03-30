/* ============================================================
   WIND VISUALIZATION — ENHANCED
   New features added (non-destructive):
   1. Wind Sock Indicator   — aeronautical sock, droops/extends by speed
   2. Beaufort Scale Label  — BF number + plain-English label
   3. Streamlines           — pre-computed flow field particles follow
   4. Heat Shimmer Effect   — canvas displacement shimmer for hot conditions
   5. Dynamic Cloud Movement— clouds that drift with the wind direction
   All original features are fully preserved.
   ============================================================ */

// ─── SPARKS (unchanged) ──────────────────────────────────────
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
        spark.animate([
            { transform: `rotate(${angle}deg) translate(0px) scale(1)`, opacity: 1 },
            { transform: `rotate(${angle}deg) translate(${velocity}px) scale(0)`, opacity: 0 }
        ], {
            duration: 500,
            easing: 'cubic-bezier(0, .9, .57, 1)',
        }).onfinish = () => spark.remove();
    }
}

// ─── HAZARD SYSTEM (unchanged) ───────────────────────────────
const HazardSystem = {
    thresholds: {
        wind: { caution: 10, danger: 17, severe: 24 },
        visibility: { caution: 5000, danger: 1000, severe: 200 },
        aqi: { caution: 3, danger: 4, severe: 5 }
    },
    analyze: function (current, forecast, airQuality, unit) {
        const alerts = [];
        let t = current.main.temp;
        let w = current.wind.speed;
        let vis = current.visibility;
        const h = current.main.humidity;
        const weatherId = current.weather[0].id;
        if (unit === 'imperial') {
            t = (t - 32) * 5 / 9;
            w = w * 0.44704;
        }
        const add = (type, level, title, msg, icon) => {
            alerts.push({ type, level, title, msg, icon });
        };
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
        if (w >= this.thresholds.wind.severe) add('wind', 'severe', 'Hurricane Force', 'Destructive winds. Seek shelter.', 'cyclone');
        else if (w >= this.thresholds.wind.danger) add('wind', 'danger', 'Gale Warning', 'Walking and driving difficult.', 'air');
        else if (w >= this.thresholds.wind.caution) {
            if (weatherId >= 500 && weatherId < 600) add('wind', 'danger', 'Stormy Weather', 'Wind and rain reducing control.', 'rainy');
            else add('wind', 'caution', 'Windy', 'Secure loose outdoor objects.', 'air');
        }
        if (vis <= this.thresholds.visibility.severe) add('vis', 'severe', 'Zero Visibility', 'Do not drive unless necessary.', 'visibility_off');
        else if (vis <= this.thresholds.visibility.danger) add('vis', 'danger', 'Dense Fog', 'Hazardous driving conditions.', 'foggy');
        if (airQuality && airQuality.list && airQuality.list[0]) {
            const aqi = airQuality.list[0].main.aqi;
            if (aqi >= 5) add('aqi', 'severe', 'Hazardous Air', 'Keep windows closed. Wear a mask.', 'masks');
            else if (aqi >= 4) add('aqi', 'danger', 'Poor Air Quality', 'Reduce outdoor exertion.', 'masks');
            else if (aqi === 3) add('aqi', 'caution', 'Moderate Air', 'Sensitive groups should take care.', 'masks');
        }
        if (forecast && forecast.list) {
            const nextPoints = forecast.list.slice(0, 2);
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

// ─── PROBABILITY SYSTEM (unchanged) ──────────────────────────
const ProbabilitySystem = {
    analyze: function (forecast) {
        if (!forecast || !forecast.list) return null;
        const segments = forecast.list.slice(0, 4);
        const pops = segments.map(s => s.pop || 0);
        const maxPop = Math.max(...pops);
        if (maxPop < 0.25) return null;
        let trend = 'Steady';
        let trendClass = 'trend-steady';
        const firstHalf = (pops[0] + pops[1]) / 2;
        const secondHalf = (pops[2] + pops[3]) / 2;
        if (secondHalf > firstHalf + 0.15) { trend = 'Rising Chance'; trendClass = 'trend-increasing'; }
        else if (secondHalf < firstHalf - 0.15) { trend = 'Clearing Up'; trendClass = 'trend-decreasing'; }
        let rainVolume = 0, rainySegments = 0, breaks = 0, wasRaining = false;
        segments.forEach(s => {
            let precip = 0;
            if (s.rain && s.rain['3h']) precip += s.rain['3h'];
            if (s.snow && s.snow['3h']) precip += s.snow['3h'];
            rainVolume += precip;
            if (precip > 0.1) {
                rainySegments++;
                if (!wasRaining && rainySegments > 1) breaks++;
                wasRaining = true;
            } else { wasRaining = false; }
        });
        let intensity = 'Light';
        if (rainVolume > 15) intensity = 'Heavy';
        else if (rainVolume > 5) intensity = 'Moderate';
        const duration = rainySegments * 3;
        let phrase = '';
        const popPct = Math.round(maxPop * 100);
        if (popPct >= 80) {
            if (intensity === 'Heavy' && duration >= 6) phrase = 'High Chance of Sustained Rainfall';
            else phrase = 'Precipitation Definite';
        } else if (popPct >= 60) { phrase = 'Rain Likely'; }
        else if (popPct >= 40) {
            if (breaks > 0 || duration <= 3) phrase = 'Scattered Showers Possible';
            else phrase = 'Showers Possible';
        } else { phrase = 'Low Chance of Rain'; }
        let context = `${intensity} intensity expected. `;
        if (duration > 0) {
            if (breaks > 0) context += `Intermittent precipitation spread over the next 12 hours.`;
            else if (duration <= 3) context += `Brief precipitation expected.`;
            else context += `Likely to last around ${duration} hours in the upcoming window.`;
        } else { context += `Brief or intermittent precipitation expected.`; }
        return {
            pop: popPct, phrase, trend, trendClass, context,
            explanation: "In OpenWeather forecasts, precipitation probability (POP) typically refers to the likelihood of measurable precipitation at the given location during the forecast interval, not duration or coverage.",
            disclaimer: "Note: A lower percentage does not guarantee dryness, and a higher percentage does not guarantee continuous rain."
        };
    }
};

// ─── WIND MAP (enhanced) ─────────────────────────────────────
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
    temperature: 20,                   // NEW — for heat shimmer
    mouse: { x: -1000, y: -1000, active: false },
    boundResize: null,
    boundMouse: null,
    boundLeave: null,
    extraLayers: true,
    windArrowEnabled: true,
    speedGaugeEnabled: true,
    depthParticles: [],
    lastGustTime: 0,

    // ── NEW: Streamline field ──
    streamlines: [],
    streamlineResolution: 30,          // grid cell size in px
    streamlineField: [],               // pre-computed angle per cell

    // ── NEW: Dynamic clouds ──
    clouds: [],

    // ── NEW: Heat shimmer off-screen canvas ──
    shimmerCanvas: null,
    shimmerCtx: null,
    shimmerEnabled: false,

    // ─────────────────────────────────────────────────────────
    //  INIT
    // ─────────────────────────────────────────────────────────
    init: function (canvasId, windSpeed, windDeg, weatherId, isNight, temperature) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.speed = windSpeed;
        this.weatherId = weatherId || 800;
        this.isNight = isNight;
        this.temperature = (temperature !== undefined) ? temperature : 20;

        // Heat shimmer active when temp >= 32 °C
        this.shimmerEnabled = (this.temperature >= 32);

        const targetDir = (windDeg - 90 + 180) * (Math.PI / 180);
        if (this.currentDirection === null) this.currentDirection = targetDir;
        this.targetDirection = targetDir;

        this.resize();
        if (this.width === 0) {
            setTimeout(() => this.init(canvasId, windSpeed, windDeg, weatherId, isNight, temperature), 200);
            return;
        }

        // Mouse / touch
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
                e.preventDefault(); this.boundMouse(e.touches[0]);
            }, { passive: false });
            this.canvas.addEventListener('touchmove', (e) => {
                e.preventDefault(); this.boundMouse(e.touches[0]);
            }, { passive: false });
        }

        this.createParticles();
        this.buildStreamlineField();        // NEW
        this.initClouds();                  // NEW
        if (this.shimmerEnabled) this.initShimmerCanvas();  // NEW

        this.start();
        if (this.boundResize) window.removeEventListener('resize', this.boundResize);
        this.boundResize = this.resize.bind(this);
        window.addEventListener('resize', this.boundResize);

        if (this.extraLayers) {
            this.createDepthParticles();
            this.canvas.addEventListener('click', (e) => {
                const rect = this.canvas.getBoundingClientRect();
                const scaleX = this.canvas.width / rect.width;
                const scaleY = this.canvas.height / rect.height;
                const clickX = (e.clientX - rect.left) * scaleX;
                const clickY = (e.clientY - rect.top) * scaleY;
                this.triggerCanvasSparks(clickX, clickY, 18);
            });
        }
    },

    // ─────────────────────────────────────────────────────────
    //  RESIZE (unchanged)
    // ─────────────────────────────────────────────────────────
    resize: function () {
        if (!this.canvas) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        if (rect.width === 0) return;
        this.width = rect.width;
        this.height = rect.height;
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.ctx.scale(dpr, dpr);
        // Rebuild layout-dependent systems on resize
        this.buildStreamlineField();
        if (this.shimmerEnabled) this.initShimmerCanvas();
    },

    // ─────────────────────────────────────────────────────────
    //  PARTICLES (unchanged)
    // ─────────────────────────────────────────────────────────
    createParticles: function () {
        const baseCount = this.speed > 10 ? 200 : 120;
        const count = Math.min(baseCount, window.innerWidth < 768 ? 100 : 300);
        this.particles = [];
        for (let i = 0; i < count; i++) this.particles.push(this.resetParticle({}));
    },

    resetParticle: function (p, isBurst = false) {
        p.x = Math.random() * this.width;
        p.y = Math.random() * this.height;
        if (isBurst) {
            const dist = Math.random() * 100;
            const angle = this.currentDirection + Math.PI;
            p.x = (this.width / 2) + Math.cos(angle) * (this.width / 2 + dist);
            p.y = (this.height / 2) + Math.sin(angle) * (this.height / 2 + dist);
        }
        p.age = 0;
        p.life = Math.random() * 60 + 40;
        if (isBurst) p.life = 30 + Math.random() * 20;
        p.trail = [];
        p.trailLength = 10 + Math.random() * 20;
        p.thickness = 0.5 + Math.random() * 1.5;
        p.speedMult = 0.8 + Math.random() * 0.4;
        if (isBurst) p.speedMult *= 1.5;
        if (this.isNight) {
            const v = Math.floor(Math.random() * 55) + 200;
            p.color = `rgba(${v}, ${v}, 255,`;
        } else {
            const g = Math.floor(Math.random() * 100) + 50;
            p.color = `rgba(37, ${g}, 235,`;
        }
        return p;
    },

    // ─────────────────────────────────────────────────────────
    //  BACKGROUND (unchanged core; cloud blobs replaced by
    //  dynamic cloud system — see drawClouds below)
    // ─────────────────────────────────────────────────────────
    drawBackground: function () {
        const grad = this.ctx.createLinearGradient(0, 0, 0, this.height);
        if (this.isNight) {
            grad.addColorStop(0, '#0f172a');
            grad.addColorStop(1, '#1e1b4b');
        } else {
            grad.addColorStop(0, '#dbeafe');
            grad.addColorStop(1, '#bfdbfe');
        }
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Grid
        this.ctx.save();
        this.ctx.strokeStyle = this.isNight ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
        this.ctx.lineWidth = 1;
        const gridSize = 40;
        this.ctx.beginPath();
        for (let x = 0; x <= this.width; x += gridSize) { this.ctx.moveTo(x, 0); this.ctx.lineTo(x, this.height); }
        for (let y = 0; y <= this.height; y += gridSize) { this.ctx.moveTo(0, y); this.ctx.lineTo(this.width, y); }
        this.ctx.stroke();
        this.ctx.restore();

        // Dynamic clouds (replaces static circle blobs)
        this.drawClouds();
    },

    // ─────────────────────────────────────────────────────────
    //  NEW — DYNAMIC CLOUD MOVEMENT
    // ─────────────────────────────────────────────────────────
    initClouds: function () {
        const isCloudy = (this.weatherId >= 801 && this.weatherId <= 804) ||
                         (this.weatherId >= 200 && this.weatherId < 600);
        // Always create some background clouds; more if cloudy
        const count = isCloudy ? 6 : 3;
        this.clouds = [];
        for (let i = 0; i < count; i++) {
            this.clouds.push({
                x: Math.random() * (this.width + 200) - 100,
                y: Math.random() * this.height * 0.65,
                // Each cloud made of 3 overlapping circles
                puffs: Array.from({ length: 3 + Math.floor(Math.random() * 3) }, () => ({
                    ox: (Math.random() - 0.5) * 80,    // offset from cloud centre
                    oy: (Math.random() - 0.5) * 30,
                    r: 30 + Math.random() * 50
                })),
                speedFactor: 0.15 + Math.random() * 0.25,  // individual drift multiplier
                opacity: isCloudy
                    ? (this.isNight ? 0.07 + Math.random() * 0.06 : 0.25 + Math.random() * 0.2)
                    : (this.isNight ? 0.03 + Math.random() * 0.03 : 0.08 + Math.random() * 0.08)
            });
        }
    },

    drawClouds: function () {
        if (!this.clouds || this.clouds.length === 0) return;
        const windVx = Math.cos(this.currentDirection) * 0.4;
        const windVy = Math.sin(this.currentDirection) * 0.4;

        this.clouds.forEach(c => {
            // Drift with wind direction, scaled by cloud's individual speed factor
            c.x += windVx * c.speedFactor * (this.speed / 10 + 0.5);
            c.y += windVy * c.speedFactor * (this.speed / 10 + 0.5);

            // Wrap around canvas with generous margins
            if (c.x > this.width + 200)  c.x = -200;
            if (c.x < -200)              c.x = this.width + 200;
            if (c.y > this.height + 150) c.y = -150;
            if (c.y < -150)              c.y = this.height + 150;

            // Draw cloud as a cluster of soft circles
            this.ctx.save();
            this.ctx.fillStyle = this.isNight
                ? `rgba(200,210,255,${c.opacity})`
                : `rgba(255,255,255,${c.opacity})`;
            this.ctx.beginPath();
            c.puffs.forEach(puff => {
                this.ctx.moveTo(c.x + puff.ox + puff.r, c.y + puff.oy);
                this.ctx.arc(c.x + puff.ox, c.y + puff.oy, puff.r, 0, Math.PI * 2);
            });
            this.ctx.fill();
            this.ctx.restore();
        });
    },

    // ─────────────────────────────────────────────────────────
    //  COMPASS (unchanged)
    // ─────────────────────────────────────────────────────────
    drawCompass: function () {
        const r = 24;
        const padding = 20;
        const cx = this.width - r - padding;
        const cy = this.height - r - padding;
        this.ctx.save();
        this.ctx.translate(cx, cy);
        this.ctx.beginPath();
        this.ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
        this.ctx.fillStyle = this.isNight ? 'rgba(15, 23, 42, 0.6)' : 'rgba(255, 255, 255, 0.6)';
        this.ctx.fill();
        this.ctx.strokeStyle = this.isNight ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)';
        this.ctx.stroke();
        this.ctx.strokeStyle = this.isNight ? 'rgba(255,255,255,0.6)' : 'rgba(30, 58, 138, 0.6)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, r, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
            this.ctx.rotate(Math.PI / 2);
            this.ctx.beginPath();
            this.ctx.moveTo(0, -r);
            this.ctx.lineTo(0, -r + 4);
            this.ctx.stroke();
        }
        this.ctx.fillStyle = this.isNight ? '#fff' : '#1e3a8a';
        this.ctx.font = "bold 10px 'Orbitron', sans-serif";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText("N", 0, -r + 10);
        this.ctx.rotate(-Math.PI);
        this.ctx.beginPath();
        this.ctx.moveTo(0, -r + 6);
        this.ctx.lineTo(-4, 4);
        this.ctx.lineTo(4, 4);
        this.ctx.fillStyle = '#ef4444';
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.moveTo(0, r - 6);
        this.ctx.lineTo(-4, 4);
        this.ctx.lineTo(4, 4);
        this.ctx.fillStyle = this.isNight ? '#94a3b8' : '#64748b';
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 2, 0, Math.PI * 2);
        this.ctx.fillStyle = '#fff';
        this.ctx.fill();
        this.ctx.restore();
    },

    // ─────────────────────────────────────────────────────────
    //  WIND ARROW (unchanged)
    // ─────────────────────────────────────────────────────────
    drawWindArrow: function () {
        if (!this.windArrowEnabled || !this.extraLayers) return;
        const cx = this.width / 2;
        const cy = this.height / 2;
        const len = Math.min(this.width, this.height) * 0.35 * (this.speed / 20 + 0.5);
        this.ctx.save();
        this.ctx.translate(cx, cy);
        this.ctx.rotate(this.currentDirection);
        this.ctx.strokeStyle = this.isNight ? 'rgba(147, 197, 253, 0.25)' : 'rgba(37, 99, 235, 0.25)';
        this.ctx.lineWidth = 8;
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(len, 0);
        this.ctx.stroke();
        const pulse = 1 + Math.sin(this.time * 8) * 0.1;
        this.ctx.fillStyle = '#ef4444';
        this.ctx.beginPath();
        this.ctx.moveTo(len, 0);
        this.ctx.lineTo(len - 20 * pulse, -12);
        this.ctx.lineTo(len - 20 * pulse, 12);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.restore();
    },

    // ─────────────────────────────────────────────────────────
    //  SPEED GAUGE (unchanged)
    // ─────────────────────────────────────────────────────────
    drawSpeedGauge: function () {
        if (!this.speedGaugeEnabled || !this.extraLayers) return;
        const r = 28;
        const cx = this.width - r - 20;
        const cy = this.height - r * 2.8 - 20;
        this.ctx.save();
        this.ctx.translate(cx, cy);
        this.ctx.strokeStyle = this.isNight ? 'rgba(148, 163, 184, 0.3)' : 'rgba(30, 58, 138, 0.3)';
        this.ctx.lineWidth = 6;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, r, 0, Math.PI * 2);
        this.ctx.stroke();
        const normalized = Math.min(this.speed / 40, 1);
        this.ctx.strokeStyle = this.speed >= 17 ? '#ef4444' : (this.speed >= 10 ? '#f59e0b' : '#3b82f6');
        this.ctx.beginPath();
        this.ctx.arc(0, 0, r, -0.5 * Math.PI, -0.5 * Math.PI + normalized * 2 * Math.PI);
        this.ctx.stroke();
        this.ctx.fillStyle = this.isNight ? '#fff' : '#1e3a8a';
        this.ctx.font = 'bold 13px Orbitron, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(Math.round(this.speed), 0, 0);
        this.ctx.restore();
    },

    // ─────────────────────────────────────────────────────────
    //  DEPTH PARTICLES (unchanged)
    // ─────────────────────────────────────────────────────────
    createDepthParticles: function () {
        this.depthParticles = [];
        const count = Math.floor(this.particles.length * 0.6);
        for (let i = 0; i < count; i++) {
            const p = this.resetParticle({});
            p.speedMult = 0.3 + Math.random() * 0.3;
            p.thickness = 0.3;
            p.trailLength = 5;
            this.depthParticles.push(p);
        }
    },

    // ─────────────────────────────────────────────────────────
    //  CANVAS SPARKS (unchanged)
    // ─────────────────────────────────────────────────────────
    triggerCanvasSparks: function (x, y, count = 12) {
        if (!this.extraLayers) return;
        for (let i = 0; i < count; i++) {
            const p = this.resetParticle({}, true);
            p.x = x;
            p.y = y;
            p.life = 25 + Math.random() * 15;
            p.speedMult *= 2.2;
            p.color = this.isNight ? 'rgba(251, 191, 36,' : 'rgba(249, 115, 22,';
            this.burstParticles.push(p);
        }
    },

    // ─────────────────────────────────────────────────────────
    //  NEW — STREAMLINE FIELD
    //  Pre-computes a flow-field grid.  Each grid cell stores an
    //  angle based on the base wind direction + a Perlin-like
    //  noise offset (sine/cosine layering).  Particles sample
    //  their nearest cell instead of re-computing noise per
    //  frame, making motion feel more structured and "natural".
    // ─────────────────────────────────────────────────────────
    buildStreamlineField: function () {
        if (!this.width || !this.height) return;
        const res = this.streamlineResolution;
        const cols = Math.ceil(this.width  / res) + 1;
        const rows = Math.ceil(this.height / res) + 1;
        // Build a 2D array of base angles (noise baked in at creation)
        this.streamlineField = [];
        for (let row = 0; row < rows; row++) {
            const rowArr = [];
            for (let col = 0; col < cols; col++) {
                const nx = col / cols;
                const ny = row / rows;
                // Multi-octave sine noise — cheap but effective
                const noise =
                    Math.sin(nx * 6.28 + ny * 3.14) * 0.25 +
                    Math.sin(nx * 12.56 - ny * 6.28) * 0.12 +
                    Math.cos(nx * 3.14 + ny * 9.42) * 0.08;
                rowArr.push(noise);      // stored as angle offset (radians)
            }
            this.streamlineField.push(rowArr);
        }
        this.streamlineCols = cols;
        this.streamlineRows = rows;
    },

    /** Returns the pre-computed flow-field angle at canvas position (x, y). */
    sampleStreamlineField: function (x, y) {
        const res = this.streamlineResolution;
        const col = Math.min(Math.floor(x / res), this.streamlineCols - 1);
        const row = Math.min(Math.floor(y / res), this.streamlineRows - 1);
        const fieldAngle = (this.streamlineField[row] && this.streamlineField[row][col]) || 0;
        // Add slow animation by shifting field over time
        return this.currentDirection + fieldAngle + Math.sin(this.time * 0.3 + col * 0.1) * 0.05;
    },

    /** Draws subtle streamline guide-lines in the background (optional visual). */
    drawStreamlines: function () {
        if (!this.extraLayers) return;
        const res = this.streamlineResolution * 2;   // draw at half density
        const lineLen = res * 1.6;
        this.ctx.save();
        this.ctx.globalAlpha = this.isNight ? 0.07 : 0.06;
        this.ctx.strokeStyle = this.isNight ? '#93c5fd' : '#1d4ed8';
        this.ctx.lineWidth = 0.8;
        for (let x = res / 2; x < this.width; x += res) {
            for (let y = res / 2; y < this.height; y += res) {
                const angle = this.sampleStreamlineField(x, y);
                const ex = x + Math.cos(angle) * lineLen;
                const ey = y + Math.sin(angle) * lineLen;
                this.ctx.beginPath();
                this.ctx.moveTo(x, y);
                this.ctx.lineTo(ex, ey);
                this.ctx.stroke();
                // Small arrowhead
                const hx = ex - Math.cos(angle - 0.4) * 5;
                const hy = ey - Math.sin(angle - 0.4) * 5;
                this.ctx.beginPath();
                this.ctx.moveTo(ex, ey);
                this.ctx.lineTo(hx, hy);
                this.ctx.stroke();
            }
        }
        this.ctx.globalAlpha = 1;
        this.ctx.restore();
    },

    // ─────────────────────────────────────────────────────────
    //  NEW — BEAUFORT SCALE LABEL
    // ─────────────────────────────────────────────────────────
    drawBeaufortLabel: function () {
        // Beaufort scale breakpoints (m/s lower bounds)
        const bfBreaks = [0, 0.3, 1.6, 3.4, 5.5, 8.0, 10.8, 13.9, 17.2, 20.8, 24.5, 28.5, 32.7];
        const bfNames  = [
            'Calm', 'Light Air', 'Light Breeze', 'Gentle Breeze', 'Moderate Breeze',
            'Fresh Breeze', 'Strong Breeze', 'Near Gale', 'Gale',
            'Severe Gale', 'Storm', 'Violent Storm', 'Hurricane Force'
        ];
        let bf = 0;
        for (let i = bfBreaks.length - 1; i >= 0; i--) {
            if (this.speed >= bfBreaks[i]) { bf = i; break; }
        }
        const label = `BF ${bf}  ·  ${bfNames[bf]}`;

        // Position: top-left corner, clear of the speed sparkline area
        const x = 12;
        const y = this.height - 14;

        this.ctx.save();

        // Pill background
        this.ctx.font = "bold 10px 'Orbitron', sans-serif";
        const textW = this.ctx.measureText(label).width;
        const padX = 8, padY = 4;
        const pillW = textW + padX * 2;
        const pillH = 18;

        // Color-coded by severity
        let pillColor;
        if (bf >= 10)      pillColor = 'rgba(239,68,68,0.75)';       // red
        else if (bf >= 7)  pillColor = 'rgba(245,158,11,0.75)';      // amber
        else if (bf >= 4)  pillColor = 'rgba(59,130,246,0.75)';      // blue
        else               pillColor = this.isNight
                               ? 'rgba(30,41,59,0.6)'
                               : 'rgba(255,255,255,0.6)';

        this.ctx.fillStyle = pillColor;
        this._roundRect(x, y - pillH + padY, pillW, pillH, 5);
        this.ctx.fill();

        // Stroke
        this.ctx.strokeStyle = this.isNight ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)';
        this.ctx.lineWidth = 0.5;
        this._roundRect(x, y - pillH + padY, pillW, pillH, 5);
        this.ctx.stroke();

        // Text
        this.ctx.fillStyle = bf >= 4 ? '#fff' : (this.isNight ? '#e2e8f0' : '#1e3a8a');
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(label, x + padX, y - pillH / 2 + padY + 1);

        this.ctx.restore();
    },

    /** Utility: stroke/fill a rounded rectangle path. */
    _roundRect: function (x, y, w, h, r) {
        this.ctx.beginPath();
        this.ctx.moveTo(x + r, y);
        this.ctx.lineTo(x + w - r, y);
        this.ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        this.ctx.lineTo(x + w, y + h - r);
        this.ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        this.ctx.lineTo(x + r, y + h);
        this.ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        this.ctx.lineTo(x, y + r);
        this.ctx.quadraticCurveTo(x, y, x + r, y);
        this.ctx.closePath();
    },

    // ─────────────────────────────────────────────────────────
    //  NEW — WIND SOCK INDICATOR
    //
    //  Classic aeronautical cone-shaped windsock mounted on a
    //  short pole.  The sock droops vertically at calm speeds,
    //  extends horizontally at high speeds.  The droop angle is
    //  lerped based on normalised wind speed.
    //  Position: top-left area (below any future sparkline).
    // ─────────────────────────────────────────────────────────
    drawWindSock: function () {
        if (!this.extraLayers) return;

        // Position of the pole tip (top-left quadrant)
        const poleX = 22;
        const poleY = 18;
        const poleLen = 36;

        // Droop: 0 = fully horizontal (max wind), 1 = fully vertical (calm)
        const normalised = Math.min(this.speed / 20, 1);          // 0–1
        const droopAngle = (1 - normalised) * (Math.PI / 2);      // 0 → π/2

        // Sock follows current wind direction + droop
        const sockAngle = this.currentDirection + droopAngle;

        // Sock dimensions scale slightly with wind
        const sockLen = 38 + normalised * 18;                      // 38–56 px
        const sockMouth = 8 + normalised * 5;                      // 8–13 px radius
        const sockTail  = 2 + normalised * 3;                      // 2–5 px radius

        // Alternating orange/white band count
        const bands = 3;

        this.ctx.save();

        // ── Pole ──
        this.ctx.strokeStyle = this.isNight ? 'rgba(148,163,184,0.7)' : 'rgba(71,85,105,0.7)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(poleX, poleY + poleLen);
        this.ctx.lineTo(poleX, poleY);
        this.ctx.stroke();

        // Pole tip circle
        this.ctx.fillStyle = this.isNight ? '#94a3b8' : '#475569';
        this.ctx.beginPath();
        this.ctx.arc(poleX, poleY, 3, 0, Math.PI * 2);
        this.ctx.fill();

        // Ground circle
        this.ctx.fillStyle = this.isNight ? 'rgba(148,163,184,0.3)' : 'rgba(71,85,105,0.25)';
        this.ctx.beginPath();
        this.ctx.ellipse(poleX, poleY + poleLen, 8, 3, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // ── Sock ── (drawn as tapered bands along sockAngle from poleX,poleY)
        this.ctx.translate(poleX, poleY);
        this.ctx.rotate(sockAngle);

        for (let b = 0; b < bands; b++) {
            const t0 = b / bands;
            const t1 = (b + 1) / bands;
            const x0 = t0 * sockLen;
            const x1 = t1 * sockLen;
            const r0 = sockMouth * (1 - t0) + sockTail * t0;
            const r1 = sockMouth * (1 - t1) + sockTail * t1;

            // Alternating orange / white
            const isOrange = (b % 2 === 0);
            this.ctx.fillStyle = isOrange
                ? `rgba(251,146,60,${0.85 + normalised * 0.1})`
                : `rgba(255,255,255,${0.75 + normalised * 0.1})`;

            // Draw trapezoid section
            this.ctx.beginPath();
            this.ctx.moveTo(x0,  r0);
            this.ctx.lineTo(x1,  r1);
            this.ctx.lineTo(x1, -r1);
            this.ctx.lineTo(x0, -r0);
            this.ctx.closePath();
            this.ctx.fill();

            // Thin border
            this.ctx.strokeStyle = 'rgba(0,0,0,0.15)';
            this.ctx.lineWidth = 0.5;
            this.ctx.stroke();
        }

        // Mouth ring (dark outline)
        this.ctx.beginPath();
        this.ctx.arc(0, 0, sockMouth, -Math.PI / 2, Math.PI / 2);
        this.ctx.strokeStyle = this.isNight ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)';
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();

        // Speed label under sock
        this.ctx.rotate(-sockAngle);   // reset rotation for text
        this.ctx.font = "9px 'Orbitron', sans-serif";
        this.ctx.fillStyle = this.isNight ? 'rgba(148,163,184,0.8)' : 'rgba(30,58,138,0.7)';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'top';
        this.ctx.fillText(`${Math.round(this.speed)} m/s`, 0, poleLen + 4);

        this.ctx.restore();
    },

    // ─────────────────────────────────────────────────────────
    //  NEW — HEAT SHIMMER EFFECT
    //  Uses a secondary off-screen canvas.  Each frame the main
    //  canvas (already drawn) is copied to the shimmer canvas,
    //  then redrawn with per-column vertical offsets that vary
    //  as sine waves — simulating rising hot air.
    //  Active only when temperature >= 32 °C.
    // ─────────────────────────────────────────────────────────
    initShimmerCanvas: function () {
        if (!this.shimmerEnabled) return;
        if (!this.shimmerCanvas) {
            this.shimmerCanvas = document.createElement('canvas');
            this.shimmerCtx    = this.shimmerCanvas.getContext('2d');
        }
        const dpr = window.devicePixelRatio || 1;
        this.shimmerCanvas.width  = this.canvas.width;
        this.shimmerCanvas.height = this.canvas.height;
        this.shimmerCtx.scale(dpr, dpr);
    },

    applyHeatShimmer: function () {
        if (!this.shimmerEnabled) return;

        // Intensity scales with temperature beyond 32 °C, capped at 45 °C
        const intensity = Math.min((this.temperature - 32) / 13, 1); // 0–1
        const maxDisplace = 3 + intensity * 5;   // 3–8 px max vertical displacement
        const stripeW = 4;                        // horizontal stripe width (px)

        // Copy current canvas state to shimmer buffer
        const dpr = window.devicePixelRatio || 1;
        this.shimmerCtx.clearRect(0, 0, this.width, this.height);
        this.shimmerCtx.drawImage(this.canvas, 0, 0, this.width, this.height);

        // Clear main and redraw with per-stripe vertical offset
        this.ctx.clearRect(0, 0, this.width, this.height);

        for (let x = 0; x < this.width; x += stripeW) {
            // Two-octave shimmer oscillation
            const dy = Math.sin(x * 0.07 + this.time * 4.0) * maxDisplace * 0.6 +
                       Math.sin(x * 0.13 - this.time * 6.5) * maxDisplace * 0.4;

            this.ctx.drawImage(
                this.shimmerCanvas,
                x * dpr, 0,                              // source x, y
                stripeW * dpr, this.canvas.height,       // source w, h
                x, dy,                                   // dest x, y (offset)
                stripeW, this.height                     // dest w, h
            );
        }

        // Amber heat overlay (subtle tint)
        this.ctx.save();
        this.ctx.fillStyle = `rgba(251,191,36,${0.02 + intensity * 0.04})`;
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.ctx.restore();
    },

    // ─────────────────────────────────────────────────────────
    //  UPDATE LOOP (enhanced)
    // ─────────────────────────────────────────────────────────
    update: function () {
        if (!this.width) {
            this.resize();
            if (!this.width) {
                this.animationFrame = requestAnimationFrame(() => this.update());
                return;
            }
        }
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Background (includes dynamic clouds)
        this.drawBackground();

        // NEW — Streamlines drawn just after background, before particles
        this.drawStreamlines();

        this.drawCompass();

        // Interpolate Direction
        const diff = this.targetDirection - this.currentDirection;
        if (Math.abs(diff) > 0.001) this.currentDirection += diff * 0.05;
        this.time += 0.01;
        const noiseTime = this.time * 0.2;

        // Bursts
        if (Math.random() < 0.005) {
            for (let k = 0; k < 10; k++) this.burstParticles.push(this.resetParticle({}, true));
        }

        // ── Depth particles ──
        if (this.extraLayers) {
            this.ctx.globalAlpha = 0.35;
            this.ctx.lineCap = 'round';
            for (let i = this.depthParticles.length - 1; i >= 0; i--) {
                let p = this.depthParticles[i];

                // USE STREAMLINE FIELD for depth particles (smoother paths)
                const angle = this.sampleStreamlineField(p.x, p.y) +
                              Math.sin(p.x * 0.01 + noiseTime) * Math.cos(p.y * 0.01 + noiseTime) * 0.15;
                const speedFactor = Math.min(Math.max(this.speed, 2), 20) * p.speedMult;
                const vx = Math.cos(angle) * speedFactor;
                const vy = Math.sin(angle) * speedFactor;
                p.x += vx;
                p.y += vy;
                p.age++;
                p.trail.push({ x: p.x, y: p.y });
                if (p.trail.length > p.trailLength) p.trail.shift();
                let alpha = Math.sin((p.age / p.life) * Math.PI);
                let thickness = p.thickness;
                if (this.mouse.active) {
                    const dx = p.x - this.mouse.x;
                    const dy = p.y - this.mouse.y;
                    if (dx * dx + dy * dy < 2500) { alpha = Math.min(1, alpha + 0.3); thickness += 1; }
                }
                this.ctx.strokeStyle = `${p.color} ${alpha})`;
                this.ctx.lineWidth = thickness;
                if (this.speed < 5) { this.ctx.shadowBlur = 4; this.ctx.shadowColor = p.color + '0.5)'; }
                if (p.trail.length > 1) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(p.trail[0].x, p.trail[0].y);
                    for (let j = 1; j < p.trail.length; j++) this.ctx.lineTo(p.trail[j].x, p.trail[j].y);
                    this.ctx.stroke();
                }
                this.ctx.shadowBlur = 0;
                if (p.age >= p.life || p.x < -50 || p.x > this.width + 50 || p.y < -50 || p.y > this.height + 50) {
                    this.resetParticle(p); p.trail = [];
                }
            }
            this.ctx.globalAlpha = 1;
        }

        // ── Main + burst particles (streamline-guided) ──
        const all = [...this.particles, ...this.burstParticles];
        this.ctx.lineCap = 'round';
        for (let i = all.length - 1; i >= 0; i--) {
            let p = all[i];

            // USE STREAMLINE FIELD for primary particles
            const angle = this.sampleStreamlineField(p.x, p.y) +
                          Math.sin(p.x * 0.01 + noiseTime) * Math.cos(p.y * 0.01 + noiseTime) * 0.3;
            const speedFactor = Math.min(Math.max(this.speed, 2), 20) * p.speedMult;
            const vx = Math.cos(angle) * speedFactor;
            const vy = Math.sin(angle) * speedFactor;
            p.x += vx;
            p.y += vy;
            p.age++;
            p.trail.push({ x: p.x, y: p.y });
            if (p.trail.length > p.trailLength) p.trail.shift();
            let alpha = Math.sin((p.age / p.life) * Math.PI);
            let thickness = p.thickness;
            if (this.mouse.active) {
                const dx = p.x - this.mouse.x;
                const dy = p.y - this.mouse.y;
                if (dx * dx + dy * dy < 2500) { alpha = Math.min(1, alpha + 0.3); thickness += 1; }
            }
            this.ctx.strokeStyle = `${p.color} ${alpha})`;
            this.ctx.lineWidth = thickness;
            if (this.speed < 5) { this.ctx.shadowBlur = 4; this.ctx.shadowColor = p.color + '0.5)'; }
            if (p.trail.length > 1) {
                this.ctx.beginPath();
                this.ctx.moveTo(p.trail[0].x, p.trail[0].y);
                for (let j = 1; j < p.trail.length; j++) this.ctx.lineTo(p.trail[j].x, p.trail[j].y);
                this.ctx.stroke();
            }
            this.ctx.shadowBlur = 0;
            const isBurst = this.burstParticles.includes(p);
            if (p.age >= p.life || p.x < -50 || p.x > this.width + 50 || p.y < -50 || p.y > this.height + 50) {
                if (isBurst) {
                    this.burstParticles.splice(this.burstParticles.indexOf(p), 1);
                } else {
                    this.resetParticle(p); p.trail = [];
                }
            }
        }

        // ── Extra overlay elements ──
        if (this.extraLayers) {
            this.drawWindArrow();
            this.drawSpeedGauge();
            if (this.speed > 12 && Date.now() - this.lastGustTime > 1800) {
                if (Math.random() < 0.07) {
                    this.triggerCanvasSparks(
                        Math.random() * this.width,
                        Math.random() * this.height * 0.6,
                        8 + Math.floor(this.speed / 3)
                    );
                    this.lastGustTime = Date.now();
                    this.gustIntensity = 1;
                }
            }
        }

        // NEW — Wind sock (top-left, drawn over particles)
        this.drawWindSock();

        // NEW — Beaufort label (bottom-left pill)
        this.drawBeaufortLabel();

        // NEW — Heat shimmer applied last (composites everything above)
        if (this.shimmerEnabled) this.applyHeatShimmer();

        this.animationFrame = requestAnimationFrame(() => this.update());
    },

    // ─────────────────────────────────────────────────────────
    //  START (unchanged)
    // ─────────────────────────────────────────────────────────
    start: function () {
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
        this.update();
    }
};
