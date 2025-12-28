const WindMap = {
    canvas: null,
    ctx: null,
    particles: [],
    animationFrame: null,
    width: 0,
    height: 0,
    speed: 0,
    direction: 0,
    targetDirection: 0,
    time: 0,
    weatherId: 800,
    isNight: false,
    mouseX: -1000,
    mouseY: -1000,
    boundResize: null,
    boundMouseMove: null,
    boundMouseLeave: null,
    burstTimer: 0,
    noiseOffset: 0,

    init: function(canvasId, windSpeed, windDeg, weatherId = 800, isNight = false) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.speed = windSpeed;
        this.weatherId = weatherId;
        this.isNight = isNight;

        // Target direction for smooth interpolation
        // 0 deg (N) -> 270 deg (Up) in canvas? 
        // Standard math: 0 is Right. 
        // Wind from North (0 deg) blows South (90 deg in canvas).
        // Formula: (windDeg - 90 + 180)
        const target = (windDeg - 90 + 180) * (Math.PI / 180);
        this.targetDirection = target;
        
        // Initialize direction if first run
        if (this.direction === 0 && this.time === 0) {
            this.direction = target;
        }
        
        this.resize();
        
        // Retry if hidden
        if (this.width === 0) {
            setTimeout(() => this.init(canvasId, windSpeed, windDeg, weatherId, isNight), 200);
            return;
        }

        // Re-create particles only if count differs significantly or empty
        const targetCount = this.speed > 10 ? 250 : 120;
        if (this.particles.length === 0 || Math.abs(this.particles.length - targetCount) > 50) {
            this.createParticles();
        }

        this.start();
        
        // Event Listeners
        if (this.boundResize) window.removeEventListener('resize', this.boundResize);
        this.boundResize = this.resize.bind(this);
        window.addEventListener('resize', this.boundResize);

        if (this.boundMouseMove) this.canvas.removeEventListener('mousemove', this.boundMouseMove);
        this.boundMouseMove = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;
        };
        this.canvas.addEventListener('mousemove', this.boundMouseMove);

        if (this.boundMouseLeave) this.canvas.removeEventListener('mouseleave', this.boundMouseLeave);
        this.boundMouseLeave = () => {
            this.mouseX = -1000;
            this.mouseY = -1000;
        };
        this.canvas.addEventListener('mouseleave', this.boundMouseLeave);
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
        this.particles = [];
        const particleCount = this.speed > 10 ? 250 : 120;
        for (let i = 0; i < particleCount; i++) {
            this.particles.push(this.resetParticle({}));
        }
    },

    resetParticle: function(p) {
        p.x = Math.random() * this.width;
        p.y = Math.random() * this.height;
        p.age = 0;
        p.life = Math.random() * 60 + 40;
        p.trail = []; // History for polyline
        
        // Visual variety
        p.thickness = 0.5 + Math.random() * 1.5;
        p.speedMult = 0.8 + Math.random() * 0.4;
        
        // Color variation
        if (this.isNight) {
            // Pale blues, subtle glows
            const hue = 200 + Math.random() * 40;
            p.color = `hsla(${hue}, 70%, 70%,`;
        } else {
            // Vibrant blues/cyans
            const hue = 200 + Math.random() * 30;
            p.color = `hsla(${hue}, 80%, 50%,`;
        }
        return p;
    },

    getFlowVector: function(x, y) {
        // Evolving noise pattern
        const scale = 0.015;
        // Modulate noise over time (every 60s cycle)
        const noiseMod = Math.sin(this.time * 0.05) * 0.2;
        const noise = Math.sin(x * scale + this.noiseOffset) * Math.cos(y * scale + this.noiseOffset);
        return this.direction + (noise * (0.5 + noiseMod));
    },

    drawBackground: function() {
        // 1. Gradient Atmosphere
        const grd = this.ctx.createLinearGradient(0, 0, 0, this.height);
        if (this.isNight) {
            grd.addColorStop(0, '#0f172a'); // Deep Navy
            grd.addColorStop(1, '#000000'); // Black
            // Add stars randomly if not already drawn (simplified as static speckles via noise in loop or just gradient)
            // For performance, we stick to gradient + particles acting as stars/wind
        } else {
            grd.addColorStop(0, '#60a5fa'); // Soft Blue
            grd.addColorStop(1, '#1e3a8a'); // Indigo
        }
        this.ctx.fillStyle = grd;
        this.ctx.fillRect(0, 0, this.width, this.height);

        // 2. Weather Context (Clouds/Mist)
        // IDs: 2xx Thunder, 3xx Drizzle, 5xx Rain, 6xx Snow, 7xx Atmos, 80x Clouds
        const isCloudyOrRainy = (this.weatherId >= 200 && this.weatherId <= 699) || (this.weatherId > 800);
        
        if (isCloudyOrRainy) {
            this.ctx.save();
            this.ctx.fillStyle = this.isNight ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.1)';
            // Draw some static "mist" blobs
            for (let i = 0; i < 5; i++) {
                const x = (this.width * 0.2) + (i * 150);
                const y = (this.height * 0.3) + Math.sin(this.time + i) * 20;
                this.ctx.beginPath();
                this.ctx.arc(x, y, 60, 0, Math.PI * 2);
                this.ctx.fill();
            }
            this.ctx.restore();
        }
    },

    drawCompass: function() {
        const cx = this.width - 40;
        const cy = this.height - 40;
        const r = 25;

        this.ctx.save();
        this.ctx.translate(cx, cy);
        
        // Pulse effect on rotation change or just periodic
        const pulse = 1.0 + Math.sin(this.time * 2) * 0.05;
        this.ctx.scale(pulse, pulse);

        // Compass Circle
        this.ctx.beginPath();
        this.ctx.arc(0, 0, r, 0, Math.PI * 2);
        this.ctx.fillStyle = this.isNight ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        this.ctx.fill();
        this.ctx.strokeStyle = this.isNight ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();

        // Cardinal Directions (North is Up in this projection)
        const directions = [
            { label: 'N', angle: -Math.PI / 2, len: r + 5, bold: true },
            { label: 'E', angle: 0, len: r - 2, bold: false },
            { label: 'S', angle: Math.PI / 2, len: r - 2, bold: false },
            { label: 'W', angle: Math.PI, len: r - 2, bold: false }
        ];

        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.font = 'bold 10px sans-serif';
        this.ctx.fillStyle = this.isNight ? '#e2e8f0' : '#1e293b';

        directions.forEach(d => {
            const x = Math.cos(d.angle) * d.len;
            const y = Math.sin(d.angle) * d.len;
            
            this.ctx.beginPath();
            this.ctx.moveTo(0, 0);
            this.ctx.lineTo(Math.cos(d.angle) * (r - 5), Math.sin(d.angle) * (r - 5));
            this.ctx.strokeStyle = this.isNight ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
            this.ctx.lineWidth = d.bold ? 2 : 1;
            this.ctx.stroke();

            this.ctx.fillText(d.label, x, y);
        });

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

        // Smooth Direction Interpolation
        let diff = this.targetDirection - this.direction;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        this.direction += diff * 0.05;

        this.time += 0.01;
        this.noiseOffset += 0.005;

        // Draw Atmosphere & Compass
        this.drawBackground();
        this.drawCompass();

        this.ctx.lineCap = 'round';

        // Particle Bursts
        this.burstTimer++;
        if (this.burstTimer > (this.speed > 10 ? 300 : 600)) {
            this.burstTimer = 0;
            // Spawn burst
            for(let i=0; i<15; i++) this.particles.push(this.resetParticle({ life: 30 }));
        }

        // Update Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            
            const angle = this.getFlowVector(p.x, p.y);
            
            // Speed visualization
            const speedFactor = Math.min(Math.max(this.speed, 2), 25) * p.speedMult;
            const vx = Math.cos(angle) * speedFactor;
            const vy = Math.sin(angle) * speedFactor;

            p.x += vx;
            p.y += vy;
            p.age++;

            // Update Trail (Polyline)
            p.trail.push({ x: p.x, y: p.y });
            if (p.trail.length > 8) p.trail.shift(); // Keep last 8 points

            // Interaction: Mouse Proximity
            const dx = p.x - this.mouseX;
            const dy = p.y - this.mouseY;
            const dist = Math.sqrt(dx*dx + dy*dy);
            let hoverAlpha = 0;
            if (dist < 80) {
                hoverAlpha = (1 - dist / 80) * 0.5;
            }

            // Draw
            const lifeRatio = p.age / p.life;
            const alpha = Math.sin(lifeRatio * Math.PI) * 0.8 + hoverAlpha;
            
            this.ctx.strokeStyle = `${p.color} ${Math.min(alpha, 1)})`;
            this.ctx.lineWidth = p.thickness;
            
            // Glow for high speed
            if (this.speed > 15) {
                this.ctx.shadowBlur = 4;
                this.ctx.shadowColor = p.color + '1)';
            } else {
                this.ctx.shadowBlur = 0;
            }

            if (p.trail.length > 1) {
                this.ctx.beginPath();
                this.ctx.moveTo(p.trail[0].x, p.trail[0].y);
                // Draw curve through points
                for (let j = 1; j < p.trail.length; j++) {
                    this.ctx.lineTo(p.trail[j].x, p.trail[j].y);
                }
                this.ctx.stroke();
            }

            // Reset if dead or out of bounds
            if (p.age >= p.life || p.x < -50 || p.x > this.width + 50 || p.y < -50 || p.y > this.height + 50) {
                this.resetParticle(p);
            }
        }

        // Trim excess particles if burst made too many
        if (this.particles.length > (this.speed > 10 ? 300 : 150)) {
            this.particles.splice(0, 1);
        }

        this.animationFrame = requestAnimationFrame(() => this.update());
    },

    start: function() {
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
        this.update();
    }
};
