/* ============================================================
   WIND VISUALIZATION — ENHANCED
   WindMap features (non-destructive additions):
   1. Wind Sock Indicator    — aeronautical sock, droops/extends by speed
   2. Beaufort Scale Label   — BF number + plain-English label
   3. Streamlines            — pre-computed flow field particles follow
   4. Heat Shimmer Effect    — canvas displacement shimmer for hot conditions
   5. Dynamic Cloud Movement — clouds that actually drift with the wind

   ProbabilitySystem — fully rebuilt:
   6.  Confidence Score              — weighted multi-signal 0–1 score
   7.  Precipitation Type Detection  — rain / snow / sleet / mix
   8.  Onset Time Precision          — exact 3-hour window, not just "soon"
   9.  Hourly Intensity Profile      — per-segment sparkline-ready data array
   10. Smart Contextual Framing      — audience-specific advice strings
   11. Dynamic Explanation           — data-quality-aware multi-sentence block
   12. Tiered Disclaimer             — conditional severity levels, not boilerplate
   13. Rich analyze() return shape   — everything a UI consumer needs in one pass

   All original features are fully preserved.
   ============================================================ */


// ─── SPARKS (unchanged) ──────────────────────────────────────────────────────
function createSparks(x, y) {
    const count = 8;
    for (let i = 0; i < count; i++) {
        const spark = document.createElement('div');
        spark.classList.add('spark');
        document.body.appendChild(spark);
        const angle    = (i / count) * 360;
        const velocity = 20 + Math.random() * 20;
        spark.style.left      = `${x}px`;
        spark.style.top       = `${y}px`;
        spark.style.transform = `rotate(${angle}deg) translate(0px)`;
        spark.animate([
            { transform: `rotate(${angle}deg) translate(0px) scale(1)`,           opacity: 1 },
            { transform: `rotate(${angle}deg) translate(${velocity}px) scale(0)`, opacity: 0 }
        ], { duration: 500, easing: 'cubic-bezier(0, .9, .57, 1)' })
        .onfinish = () => spark.remove();
    }
}


// ─── HAZARD SYSTEM (unchanged) ───────────────────────────────────────────────
const HazardSystem = {
    thresholds: {
        wind:       { caution: 10,   danger: 17,   severe: 24  },
        visibility: { caution: 5000, danger: 1000, severe: 200 },
        aqi:        { caution: 3,    danger: 4,    severe: 5   }
    },

    analyze: function (current, forecast, airQuality, unit) {
        const alerts    = [];
        let t           = current.main.temp;
        let w           = current.wind.speed;
        let vis         = current.visibility;
        const h         = current.main.humidity;
        const weatherId = current.weather[0].id;

        if (unit === 'imperial') { t = (t - 32) * 5 / 9; w = w * 0.44704; }

        const add = (type, level, title, msg, icon) =>
            alerts.push({ type, level, title, msg, icon });

        // Thermal
        if (t >= 27) {
            if      (t >= 40)           add('heat','severe', 'Extreme Heat',    'Life-threatening heat. Stay cool.',     'thermostat');
            else if (t >= 32 && h > 60) add('heat','danger', 'High Heat Index', 'Feels much hotter due to humidity.',   'water_drop');
            else if (t >= 32)           add('heat','caution','High Temperature','Prolonged exposure may cause fatigue.','wb_sunny');
            else if (t >= 27 && h > 75) add('heat','caution','Muggy Conditions','High humidity increasing discomfort.', 'water_drop');
        } else if (t <= 5) {
            if      (t <= -10 && w > 5) add('cold','severe', 'Extreme Wind Chill','Frostbite risk in minutes.',         'ac_unit');
            else if (t <= 0   && w > 5) add('cold','danger', 'Bitter Cold',       'Wind making it feel freezing.',      'air');
            else                        add('cold','caution','Chilly',            'Dress warmly.',                      'ac_unit');
        }

        // Wind
        if      (w >= this.thresholds.wind.severe)  add('wind','severe', 'Hurricane Force','Destructive winds. Seek shelter.',   'cyclone');
        else if (w >= this.thresholds.wind.danger)  add('wind','danger', 'Gale Warning',   'Walking and driving difficult.',     'air');
        else if (w >= this.thresholds.wind.caution) {
            if (weatherId >= 500 && weatherId < 600)
                add('wind','danger', 'Stormy Weather','Wind and rain reducing control.','rainy');
            else
                add('wind','caution','Windy',         'Secure loose outdoor objects.', 'air');
        }

        // Visibility
        if      (vis <= this.thresholds.visibility.severe) add('vis','severe','Zero Visibility','Do not drive unless necessary.','visibility_off');
        else if (vis <= this.thresholds.visibility.danger) add('vis','danger','Dense Fog',      'Hazardous driving conditions.', 'foggy');

        // Air quality
        if (airQuality && airQuality.list && airQuality.list[0]) {
            const aqi = airQuality.list[0].main.aqi;
            if      (aqi >= 5)  add('aqi','severe', 'Hazardous Air',   'Keep windows closed. Wear a mask.', 'masks');
            else if (aqi >= 4)  add('aqi','danger', 'Poor Air Quality','Reduce outdoor exertion.',          'masks');
            else if (aqi === 3) add('aqi','caution','Moderate Air',    'Sensitive groups should take care.','masks');
        }

        // Forecast
        if (forecast && forecast.list) {
            const nextPoints = forecast.list.slice(0, 2);
            let rainIncoming = false, stormIncoming = false;
            nextPoints.forEach(pt => {
                const id = pt.weather[0].id;
                if (id >= 200 && id < 300) stormIncoming = true;
                if (id >= 500 && id < 600) rainIncoming  = true;
            });
            const currentIsRain  = (weatherId >= 500 && weatherId < 600);
            const currentIsStorm = (weatherId >= 200 && weatherId < 300);
            if      (stormIncoming && !currentIsStorm) add('future','danger', 'Storm Approaching', 'Thunderstorms expected soon.','thunderstorm');
            else if (rainIncoming  && !currentIsRain)  add('future','caution','Rain Starting Soon','Prepare for precipitation.', 'umbrella');
        }

        return alerts;
    }
};


// ─── PROBABILITY SYSTEM (fully rebuilt) ──────────────────────────────────────
const ProbabilitySystem = {

    // ── 1. CONFIDENCE SCORE ───────────────────────────────────────────────────
    // Weighs four independent signals to produce a 0–1 score and a human label.
    // Higher score = multiple data channels agree with each other.
    computeConfidence: function (segments) {
        const pops = segments.map(s => s.pop || 0);

        // Signal A: POP consensus — fraction of segments where POP > 40%
        const popConsensus = segments.filter(s => (s.pop || 0) > 0.4).length / segments.length;

        // Signal B: Volume corroboration — does rain/snow volume back the POP?
        const totalVol   = segments.reduce((sum, s) =>
            sum + (s.rain?.['3h'] || 0) + (s.snow?.['3h'] || 0), 0);
        const volumeScore = Math.min(totalVol / 10, 1);

        // Signal C: Weather-ID alignment — do condition codes also indicate precip?
        const idScore = segments.filter(s => {
            const id = s.weather[0].id;
            return (id >= 500 && id < 700);
        }).length / segments.length;

        // Signal D: Temporal consistency — penalise erratic POP swings
        const mean     = pops.reduce((a, b) => a + b, 0) / pops.length;
        const variance = pops.reduce((v, p) => v + Math.pow(p - mean, 2), 0) / pops.length;
        const consistencyScore = 1 - Math.min(variance * 4, 1);

        const score = (popConsensus    * 0.35)
                    + (volumeScore     * 0.25)
                    + (idScore         * 0.25)
                    + (consistencyScore * 0.15);

        let label;
        if      (score >= 0.75) label = 'High';
        else if (score >= 0.50) label = 'Moderate';
        else if (score >= 0.30) label = 'Low';
        else                    label = 'Very Low';

        return { score: Math.round(score * 100) / 100, label };
    },


    // ── 2. PRECIPITATION TYPE DETECTION ──────────────────────────────────────
    // Resolves the dominant type across all segments.
    // Returns: { type: 'rain'|'snow'|'sleet'|'mix'|'none', icon, label }
    resolvePrecipType: function (segments, currentTemp) {
        let hasRain = false, hasSnow = false, hasSleet = false;

        segments.forEach(s => {
            const id = s.weather[0].id;
            const t  = s.main?.temp ?? currentTemp ?? 10;
            if (id === 511)                              hasSleet = true;
            if (s.snow?.['3h'] > 0 || (id >= 600 && id < 700)) hasSnow = true;
            if (s.rain?.['3h'] > 0 || (id >= 500 && id < 511)) hasRain = true;
            // Borderline temp: rain forecast near-freezing → flag sleet risk
            if (hasRain && t <= 2) hasSleet = true;
        });

        const hasMix = hasRain && hasSnow;

        if (hasSleet) return { type: 'sleet', icon: '\uD83C\uDF28',  label: 'Freezing Rain / Sleet' };
        if (hasMix)   return { type: 'mix',   icon: '\uD83C\uDF27\u2744', label: 'Rain / Snow Mix'  };
        if (hasSnow)  return { type: 'snow',  icon: '\u2744\uFE0F',  label: 'Snow'                  };
        if (hasRain)  return { type: 'rain',  icon: '\uD83C\uDF27',  label: 'Rain'                  };
        return        { type: 'none',  icon: '',                      label: 'None'                  };
    },


    // ── 3. ONSET TIME PRECISION ───────────────────────────────────────────────
    // Returns the first 3-hour window in which measurable precipitation is likely.
    // Returns null when no onset is found in the analysis window.
    computeOnset: function (segments) {
        for (let i = 0; i < segments.length; i++) {
            const s       = segments[i];
            const hasPop  = (s.pop || 0) > 0.4;
            const hasVol  = (s.rain?.['3h'] || 0) + (s.snow?.['3h'] || 0) > 0.1;
            const hasCode = (() => { const id = s.weather[0].id; return id >= 500 && id < 700; })();

            if (hasPop || hasVol || hasCode) {
                const hrs = i * 3;
                if (hrs === 0) return { label: 'Already underway',        hours: 0  };
                if (hrs <= 3)  return { label: 'Within the next 3 hours', hours: 3  };
                if (hrs <= 6)  return { label: 'Within the next 6 hours', hours: 6  };
                return         { label: `Around ${hrs} hours from now`,   hours: hrs };
            }
        }
        return null;
    },


    // ── 4. HOURLY INTENSITY PROFILE ───────────────────────────────────────────
    // Produces a sparkline-ready array: one object per 3-hour segment.
    // intensityLevel 0–3 maps directly to bar height in a chart renderer.
    buildIntensityProfile: function (segments) {
        return segments.map((s, i) => {
            const rainVol = s.rain?.['3h'] || 0;
            const snowVol = s.snow?.['3h'] || 0;
            const vol     = rainVol + snowVol;
            const popPct  = Math.round((s.pop || 0) * 100);

            let intensityLabel = 'Dry', intensityLevel = 0;
            if      (vol > 10)  { intensityLabel = 'Heavy';    intensityLevel = 3; }
            else if (vol > 4)   { intensityLabel = 'Moderate'; intensityLevel = 2; }
            else if (vol > 0.3) { intensityLabel = 'Light';    intensityLevel = 1; }

            const id = s.weather[0].id;
            let segType = 'dry';
            if      (id === 511)            segType = 'sleet';
            else if (id >= 600 && id < 700) segType = 'snow';
            else if (id >= 500 && id < 600) segType = 'rain';
            else if (id >= 200 && id < 300) segType = 'storm';

            return {
                hourOffset:     i * 3,
                label:          `+${i * 3}h`,
                pop:            popPct,
                volumeMm:       Math.round(vol     * 10) / 10,
                rainMm:         Math.round(rainVol * 10) / 10,
                snowMm:         Math.round(snowVol * 10) / 10,
                intensityLabel,
                intensityLevel,
                segmentType:    segType,
                weatherId:      id
            };
        });
    },


    // ── 5. SMART CONTEXTUAL FRAMING ENGINE ────────────────────────────────────
    // Returns an array of audience-specific advice frames.
    // The UI can render all of them or filter by 'audience'.
    buildContextFrames: function (popPct, intensity, duration, precipType, onset, confidence) {
        const frames    = [];
        const likely    = popPct >= 60 && confidence.score >= 0.5;
        const possible  = popPct >= 40;
        const typeLabel = precipType.label.toLowerCase();

        // Commute / travel frame
        if (onset && onset.hours <= 6) {
            if (likely)
                frames.push({ audience: 'commute', icon: '\uD83D\uDE97',
                    msg: `Carry an umbrella — ${typeLabel} likely during the travel window.` });
            else if (possible)
                frames.push({ audience: 'commute', icon: '\uD83D\uDE97',
                    msg: `${precipType.label} possible during travel. A light jacket or umbrella is advisable.` });
        }

        // Outdoor activity frame
        if (intensity === 'Heavy' && likely)
            frames.push({ audience: 'outdoor', icon: '\u26FA',
                msg: `Outdoor plans in the next ${duration || 3} hours carry significant risk. Heavy ${typeLabel} expected.` });
        else if (intensity === 'Moderate' && likely)
            frames.push({ audience: 'outdoor', icon: '\u26FA',
                msg: `Consider rescheduling prolonged outdoor activity — moderate ${typeLabel} is likely.` });

        // Gardening / agriculture frame
        if (intensity !== 'Heavy' && popPct >= 50 && duration >= 3 && precipType.type === 'rain')
            frames.push({ audience: 'garden', icon: '\uD83C\uDF31',
                msg: `Natural irrigation window of approximately ${duration} hours — consider skipping scheduled watering.` });

        // Brief / patchy shower frame
        if (duration > 0 && duration <= 3 && popPct < 65)
            frames.push({ audience: 'general', icon: '\uD83C\uDF26',
                msg: `Showers are likely to be brief — expect clearance within ${duration} hour${duration > 1 ? 's' : ''}.` });

        // Snow / sleet safety frame
        if (precipType.type === 'snow' || precipType.type === 'sleet' || precipType.type === 'mix')
            frames.push({ audience: 'safety', icon: '\u26A0\uFE0F',
                msg: `${precipType.label} increases road and surface hazard. Allow extra travel time and check local road conditions.` });

        // Low-probability reassurance
        if (popPct < 40)
            frames.push({ audience: 'general', icon: '\u2600\uFE0F',
                msg: `Precipitation is unlikely over the next 12 hours. Outdoor plans should be largely unaffected.` });

        return frames;
    },


    // ── 6. DYNAMIC EXPLANATION ────────────────────────────────────────────────
    // Builds a multi-sentence paragraph that reflects actual data quality,
    // confidence alignment, volume availability, and precipitation type.
    // Never the same boilerplate string twice.
    buildExplanation: function (confidence, segments, precipType) {
        const dataPoints    = segments.filter(s => s.pop !== undefined && s.pop !== null).length;
        const hasVolumeData = segments.some(s => (s.rain?.['3h'] || 0) + (s.snow?.['3h'] || 0) > 0);
        const missingCount  = segments.length - dataPoints;

        // Data quality note
        const qualityNote = missingCount > 0
            ? `\u26A0 ${missingCount} of ${segments.length} forecast intervals are missing probability data — overall confidence is reduced.`
            : `All ${dataPoints} forecast intervals returned complete probability data.`;

        // Confidence alignment note
        let confidenceNote;
        if      (confidence.score >= 0.75)
            confidenceNote = `Probability, precipitation volume, and condition codes are in strong agreement — this forecast carries ${confidence.label.toLowerCase()} internal consistency.`;
        else if (confidence.score >= 0.50)
            confidenceNote = `Signals are partially aligned. The probability is plausible but is only moderately corroborated by expected volume data.`;
        else if (confidence.score >= 0.30)
            confidenceNote = `Signals are weakly aligned. The stated probability is not well-supported by volume or condition-code data — treat with caution.`;
        else
            confidenceNote = `Signals are conflicting. Multiple data channels disagree; this probability figure should be considered highly uncertain.`;

        // Volume context note
        const volumeNote = hasVolumeData
            ? `Precipitation volume data is present and has been used to calibrate intensity and duration estimates.`
            : `No precipitation volume data was returned for this window. Intensity and duration are estimated from probability figures alone.`;

        // Type-specific note
        let typeNote = '';
        if (precipType.type === 'snow')
            typeNote = `Forecast type is snow. Volume estimates are in liquid-equivalent mm; actual snow depth depends on temperature and crystal density.`;
        else if (precipType.type === 'sleet' || precipType.type === 'mix')
            typeNote = `Mixed-phase precipitation is forecast. Phase transitions (rain \u2194 snow \u2194 sleet) are among the hardest atmospheric processes to model — treat type predictions with extra caution.`;

        // Permanent source transparency note
        const sourceNote = `In OpenWeatherMap forecasts, Probability of Precipitation (POP) represents the likelihood of \u22650.1 mm of measurable precipitation at the exact forecast point during a 3-hour interval. It is not an areal coverage figure, and it does not describe duration or intensity directly.`;

        return [qualityNote, confidenceNote, volumeNote, typeNote, sourceNote]
            .filter(Boolean)
            .join(' ');
    },


    // ── 7. TIERED DISCLAIMER ──────────────────────────────────────────────────
    // Returns an array of { level, msg } objects.
    // Levels: 'critical' | 'warn' | 'note' | 'info'
    // The UI should colour-code by level: red / amber / blue / grey.
    buildDisclaimer: function (confidence, popPct, intensity, precipType, duration) {
        const tiers = [];

        // Tier 1 — Confidence hard warning
        if (confidence.score < 0.30) {
            tiers.push({ level: 'critical',
                msg: `Very low confidence: probability, volume, and condition codes are in significant disagreement. This forecast may substantially over- or under-estimate actual precipitation.` });
        } else if (confidence.score < 0.50) {
            tiers.push({ level: 'warn',
                msg: `Low confidence: probability and supporting data channels are not well-aligned. Treat intensity and timing estimates as approximate.` });
        }

        // Tier 2 — High POP but no volume support
        if (popPct >= 70 && intensity === 'Light') {
            tiers.push({ level: 'note',
                msg: `High probability but low expected volume — showers are likely to be brief or patchy rather than sustained. Do not assume prolonged rainfall.` });
        }

        // Tier 3 — Mixed phase / sleet-specific critical warning
        if (precipType.type === 'sleet' || precipType.type === 'mix') {
            tiers.push({ level: 'critical',
                msg: `Mixed precipitation types are among the most difficult to forecast accurately. Actual precipitation phase (rain, snow, or sleet) may differ significantly from the model output.` });
        }

        // Tier 4 — Short-duration timing caveat
        if (duration > 0 && duration <= 3) {
            tiers.push({ level: 'note',
                msg: `Forecast precipitation window is short (\u22643 hours). Actual timing may shift 1\u20132 hours earlier or later than indicated.` });
        }

        // Tier 5 — Always-present forecast horizon caveat
        tiers.push({ level: 'info',
            msg: `Forecast accuracy decreases with time. A lower percentage does not guarantee dry conditions; a higher percentage does not guarantee continuous or heavy precipitation.` });

        // Tier 6 — Always-present hyperlocal caveat
        tiers.push({ level: 'info',
            msg: `This forecast represents a single geographic point. Actual conditions may vary within a few kilometres due to terrain, urban heat effects, and storm-cell movement.` });

        return tiers;
    },


    // ── MAIN ENTRY POINT ──────────────────────────────────────────────────────
    // Drop-in replacement for the original analyze().
    // Signature extended: analyze(forecast, currentTemp)
    // currentTemp is optional; used only for precipitation type resolution.
    analyze: function (forecast, currentTemp) {
        if (!forecast || !forecast.list) return null;

        // ── Raw segments (next 12 hours = 4 × 3h intervals) ──────────────────
        const segments = forecast.list.slice(0, 4);
        const pops     = segments.map(s => s.pop || 0);
        const maxPop   = Math.max(...pops);

        // Original early-exit threshold preserved
        if (maxPop < 0.25) return null;

        // ── Original trend analysis (preserved exactly) ───────────────────────
        let trend = 'Steady', trendClass = 'trend-steady';
        const firstHalf  = (pops[0] + pops[1]) / 2;
        const secondHalf = (pops[2] + pops[3]) / 2;
        if      (secondHalf > firstHalf + 0.15) { trend = 'Rising Chance'; trendClass = 'trend-increasing'; }
        else if (secondHalf < firstHalf - 0.15) { trend = 'Clearing Up';   trendClass = 'trend-decreasing'; }

        // ── Original volume / duration / breaks (preserved exactly) ──────────
        let rainVolume = 0, rainySegments = 0, breaks = 0, wasRaining = false;
        segments.forEach(s => {
            const precip = (s.rain?.['3h'] || 0) + (s.snow?.['3h'] || 0);
            rainVolume += precip;
            if (precip > 0.1) {
                rainySegments++;
                if (!wasRaining && rainySegments > 1) breaks++;
                wasRaining = true;
            } else { wasRaining = false; }
        });

        let intensity = 'Light';
        if      (rainVolume > 15) intensity = 'Heavy';
        else if (rainVolume > 5)  intensity = 'Moderate';
        const duration = rainySegments * 3;

        // ── New sub-systems ───────────────────────────────────────────────────
        const confidence       = this.computeConfidence(segments);
        const precipType       = this.resolvePrecipType(segments, currentTemp);
        const onset            = this.computeOnset(segments);
        const intensityProfile = this.buildIntensityProfile(segments);

        // ── Enhanced phrase (confidence-modulated, type-aware) ────────────────
        const popPct = Math.round(maxPop * 100);
        let phrase;

        if (popPct >= 80) {
            if (intensity === 'Heavy' && duration >= 6)
                phrase = confidence.score >= 0.7
                    ? `High Chance of Sustained ${precipType.type === 'snow' ? 'Snowfall' : 'Rainfall'}`
                    : `Likely Sustained Precipitation (Moderate Confidence)`;
            else
                phrase = `${precipType.label} Definite`;
        } else if (popPct >= 60) {
            phrase = confidence.score >= 0.6
                ? `${precipType.label} Likely`
                : `${precipType.label} Likely (Low Confidence)`;
        } else if (popPct >= 40) {
            phrase = (breaks > 0 || duration <= 3)
                ? `Scattered ${precipType.label} Possible`
                : `${precipType.label} Possible`;
        } else {
            phrase = `Low Chance of ${precipType.label}`;
        }

        // ── Original context string (preserved and extended) ──────────────────
        let context = `${intensity} intensity expected. `;
        if (duration > 0) {
            if      (breaks > 0)    context += `Intermittent precipitation spread over the next 12 hours.`;
            else if (duration <= 3) context += `Brief precipitation expected.`;
            else                    context += `Likely to last around ${duration} hours in the upcoming window.`;
        } else { context += `Brief or intermittent precipitation expected.`; }

        // ── New context frames, explanation, disclaimers ──────────────────────
        const contextFrames = this.buildContextFrames(
            popPct, intensity, duration, precipType, onset, confidence
        );
        const explanation = this.buildExplanation(confidence, segments, precipType);
        const disclaimers = this.buildDisclaimer(confidence, popPct, intensity, precipType, duration);

        // ── Final rich return object ──────────────────────────────────────────
        return {
            // Core (original fields preserved)
            pop:              popPct,
            phrase,

            // Confidence
            confidence:       confidence.score,
            confidenceLabel:  confidence.label,

            // Trend (original fields preserved)
            trend,
            trendClass,
            trendVector:      [firstHalf, secondHalf],

            // Precipitation
            precipType,               // { type, icon, label }
            intensity,                // 'Light' | 'Moderate' | 'Heavy'
            duration,                 // hours of measurable precip
            breaks,                   // number of dry gaps
            onset,                    // { label, hours } | null

            // Context
            context,                  // original single-string (preserved)
            contextFrames,            // array of { audience, icon, msg }

            // Explanation & disclaimers
            explanation,              // dynamic multi-sentence paragraph string
            disclaimers,              // array of { level, msg }

            // Renderable sparkline data
            intensityProfile,         // array of per-segment objects

            // Metadata
            generatedAt:      new Date().toISOString(),
            segmentsAnalyzed: segments.length
        };
    }
};


// ─── WIND MAP (with all 5 new visual features) ───────────────────────────────
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
    temperature: 20,
    mouse: { x: -1000, y: -1000, active: false },
    boundResize: null,
    boundMouse: null,
    boundLeave: null,
    extraLayers: true,
    windArrowEnabled: true,
    speedGaugeEnabled: true,
    depthParticles: [],
    lastGustTime: 0,

    // Streamline field
    streamlines: [],
    streamlineResolution: 30,
    streamlineField: [],

    // Dynamic clouds
    clouds: [],

    // Heat shimmer
    shimmerCanvas: null,
    shimmerCtx: null,
    shimmerEnabled: false,


    // ── INIT ─────────────────────────────────────────────────────────────────
    init: function (canvasId, windSpeed, windDeg, weatherId, isNight, temperature) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx         = this.canvas.getContext('2d');
        this.speed       = windSpeed;
        this.weatherId   = weatherId || 800;
        this.isNight     = isNight;
        this.temperature = (temperature !== undefined) ? temperature : 20;
        this.shimmerEnabled = (this.temperature >= 32);

        const targetDir = (windDeg - 90 + 180) * (Math.PI / 180);
        if (this.currentDirection === null) this.currentDirection = targetDir;
        this.targetDirection = targetDir;

        this.resize();
        if (this.width === 0) {
            setTimeout(() => this.init(canvasId, windSpeed, windDeg, weatherId, isNight, temperature), 200);
            return;
        }

        if (!this.boundMouse) {
            this.boundMouse = (e) => {
                const rect   = this.canvas.getBoundingClientRect();
                const scaleX = this.canvas.width  / rect.width;
                const scaleY = this.canvas.height / rect.height;
                this.mouse.x = (e.clientX - rect.left) * scaleX;
                this.mouse.y = (e.clientY - rect.top)  * scaleY;
                this.mouse.active = true;
            };
            this.boundLeave = () => { this.mouse.active = false; };
            this.canvas.addEventListener('mousemove',  this.boundMouse);
            this.canvas.addEventListener('mouseleave', this.boundLeave);
            this.canvas.addEventListener('touchstart', (e) => { e.preventDefault(); this.boundMouse(e.touches[0]); }, { passive: false });
            this.canvas.addEventListener('touchmove',  (e) => { e.preventDefault(); this.boundMouse(e.touches[0]); }, { passive: false });
        }

        this.createParticles();
        this.buildStreamlineField();
        this.initClouds();
        if (this.shimmerEnabled) this.initShimmerCanvas();

        this.start();
        if (this.boundResize) window.removeEventListener('resize', this.boundResize);
        this.boundResize = this.resize.bind(this);
        window.addEventListener('resize', this.boundResize);

        if (this.extraLayers) {
            this.createDepthParticles();
            this.canvas.addEventListener('click', (e) => {
                const rect   = this.canvas.getBoundingClientRect();
                const scaleX = this.canvas.width  / rect.width;
                const scaleY = this.canvas.height / rect.height;
                this.triggerCanvasSparks((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY, 18);
            });
        }
    },


    // ── RESIZE ───────────────────────────────────────────────────────────────
    resize: function () {
        if (!this.canvas) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        if (rect.width === 0) return;
        this.width  = rect.width;
        this.height = rect.height;
        const dpr   = window.devicePixelRatio || 1;
        this.canvas.width  = this.width  * dpr;
        this.canvas.height = this.height * dpr;
        this.ctx.scale(dpr, dpr);
        this.buildStreamlineField();
        if (this.shimmerEnabled) this.initShimmerCanvas();
    },


    // ── PARTICLES ────────────────────────────────────────────────────────────
    createParticles: function () {
        const baseCount = this.speed > 10 ? 200 : 120;
        const count     = Math.min(baseCount, window.innerWidth < 768 ? 100 : 300);
        this.particles  = [];
        for (let i = 0; i < count; i++) this.particles.push(this.resetParticle({}));
    },

    resetParticle: function (p, isBurst = false) {
        p.x = Math.random() * this.width;
        p.y = Math.random() * this.height;
        if (isBurst) {
            const dist  = Math.random() * 100;
            const angle = this.currentDirection + Math.PI;
            p.x = (this.width  / 2) + Math.cos(angle) * (this.width  / 2 + dist);
            p.y = (this.height / 2) + Math.sin(angle) * (this.height / 2 + dist);
        }
        p.age         = 0;
        p.life        = isBurst ? 30 + Math.random() * 20 : Math.random() * 60 + 40;
        p.trail       = [];
        p.trailLength = 10 + Math.random() * 20;
        p.thickness   = 0.5 + Math.random() * 1.5;
        p.speedMult   = (0.8 + Math.random() * 0.4) * (isBurst ? 1.5 : 1);
        if (this.isNight) {
            const v  = Math.floor(Math.random() * 55) + 200;
            p.color  = `rgba(${v}, ${v}, 255,`;
        } else {
            const g  = Math.floor(Math.random() * 100) + 50;
            p.color  = `rgba(37, ${g}, 235,`;
        }
        return p;
    },


    // ── BACKGROUND ───────────────────────────────────────────────────────────
    drawBackground: function () {
        const grad = this.ctx.createLinearGradient(0, 0, 0, this.height);
        if (this.isNight) { grad.addColorStop(0, '#0f172a'); grad.addColorStop(1, '#1e1b4b'); }
        else              { grad.addColorStop(0, '#dbeafe'); grad.addColorStop(1, '#bfdbfe'); }
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.save();
        this.ctx.strokeStyle = this.isNight ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
        this.ctx.lineWidth = 1;
        const gs = 40;
        this.ctx.beginPath();
        for (let x = 0; x <= this.width;  x += gs) { this.ctx.moveTo(x, 0);          this.ctx.lineTo(x, this.height); }
        for (let y = 0; y <= this.height; y += gs) { this.ctx.moveTo(0, y);           this.ctx.lineTo(this.width, y);  }
        this.ctx.stroke();
        this.ctx.restore();

        this.drawClouds();
    },


    // ── DYNAMIC CLOUDS ───────────────────────────────────────────────────────
    initClouds: function () {
        const isCloudy = (this.weatherId >= 801 && this.weatherId <= 804) ||
                         (this.weatherId >= 200 && this.weatherId < 600);
        this.clouds = [];
        for (let i = 0; i < (isCloudy ? 6 : 3); i++) {
            this.clouds.push({
                x: Math.random() * (this.width + 200) - 100,
                y: Math.random() * this.height * 0.65,
                puffs: Array.from({ length: 3 + Math.floor(Math.random() * 3) }, () => ({
                    ox: (Math.random() - 0.5) * 80,
                    oy: (Math.random() - 0.5) * 30,
                    r:  30 + Math.random() * 50
                })),
                speedFactor: 0.15 + Math.random() * 0.25,
                opacity: isCloudy
                    ? (this.isNight ? 0.07 + Math.random() * 0.06 : 0.25 + Math.random() * 0.2)
                    : (this.isNight ? 0.03 + Math.random() * 0.03 : 0.08 + Math.random() * 0.08)
            });
        }
    },

    drawClouds: function () {
        if (!this.clouds || !this.clouds.length) return;
        const windVx = Math.cos(this.currentDirection) * 0.4;
        const windVy = Math.sin(this.currentDirection) * 0.4;
        this.clouds.forEach(c => {
            c.x += windVx * c.speedFactor * (this.speed / 10 + 0.5);
            c.y += windVy * c.speedFactor * (this.speed / 10 + 0.5);
            if (c.x >  this.width  + 200) c.x = -200;
            if (c.x < -200)               c.x =  this.width  + 200;
            if (c.y >  this.height + 150) c.y = -150;
            if (c.y < -150)               c.y =  this.height + 150;
            this.ctx.save();
            this.ctx.fillStyle = this.isNight
                ? `rgba(200,210,255,${c.opacity})` : `rgba(255,255,255,${c.opacity})`;
            this.ctx.beginPath();
            c.puffs.forEach(pf => {
                this.ctx.moveTo(c.x + pf.ox + pf.r, c.y + pf.oy);
                this.ctx.arc(c.x + pf.ox, c.y + pf.oy, pf.r, 0, Math.PI * 2);
            });
            this.ctx.fill();
            this.ctx.restore();
        });
    },


    // ── COMPASS ──────────────────────────────────────────────────────────────
    drawCompass: function () {
        const r = 24, padding = 20;
        const cx = this.width - r - padding, cy = this.height - r - padding;
        this.ctx.save(); this.ctx.translate(cx, cy);
        this.ctx.beginPath(); this.ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
        this.ctx.fillStyle = this.isNight ? 'rgba(15,23,42,0.6)' : 'rgba(255,255,255,0.6)'; this.ctx.fill();
        this.ctx.strokeStyle = this.isNight ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)';  this.ctx.stroke();
        this.ctx.strokeStyle = this.isNight ? 'rgba(255,255,255,0.6)' : 'rgba(30,58,138,0.6)';
        this.ctx.lineWidth = 2; this.ctx.beginPath(); this.ctx.arc(0, 0, r, 0, Math.PI * 2); this.ctx.stroke();
        this.ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
            this.ctx.rotate(Math.PI / 2);
            this.ctx.beginPath(); this.ctx.moveTo(0, -r); this.ctx.lineTo(0, -r + 4); this.ctx.stroke();
        }
        this.ctx.fillStyle = this.isNight ? '#fff' : '#1e3a8a';
        this.ctx.font = "bold 10px 'Orbitron', sans-serif"; this.ctx.textAlign = 'center'; this.ctx.textBaseline = 'middle';
        this.ctx.fillText('N', 0, -r + 10);
        this.ctx.rotate(-Math.PI);
        this.ctx.beginPath(); this.ctx.moveTo(0,-r+6); this.ctx.lineTo(-4,4); this.ctx.lineTo(4,4);
        this.ctx.fillStyle = '#ef4444'; this.ctx.fill();
        this.ctx.beginPath(); this.ctx.moveTo(0,r-6); this.ctx.lineTo(-4,4); this.ctx.lineTo(4,4);
        this.ctx.fillStyle = this.isNight ? '#94a3b8' : '#64748b'; this.ctx.fill();
        this.ctx.beginPath(); this.ctx.arc(0,0,2,0,Math.PI*2);
        this.ctx.fillStyle = '#fff'; this.ctx.fill();
        this.ctx.restore();
    },


    // ── WIND ARROW ───────────────────────────────────────────────────────────
    drawWindArrow: function () {
        if (!this.windArrowEnabled || !this.extraLayers) return;
        const cx = this.width / 2, cy = this.height / 2;
        const len = Math.min(this.width, this.height) * 0.35 * (this.speed / 20 + 0.5);
        this.ctx.save(); this.ctx.translate(cx, cy); this.ctx.rotate(this.currentDirection);
        this.ctx.strokeStyle = this.isNight ? 'rgba(147,197,253,0.25)' : 'rgba(37,99,235,0.25)';
        this.ctx.lineWidth = 8; this.ctx.beginPath(); this.ctx.moveTo(0,0); this.ctx.lineTo(len,0); this.ctx.stroke();
        const pulse = 1 + Math.sin(this.time * 8) * 0.1;
        this.ctx.fillStyle = '#ef4444'; this.ctx.beginPath();
        this.ctx.moveTo(len, 0); this.ctx.lineTo(len - 20*pulse, -12); this.ctx.lineTo(len - 20*pulse, 12);
        this.ctx.closePath(); this.ctx.fill(); this.ctx.restore();
    },


    // ── SPEED GAUGE ──────────────────────────────────────────────────────────
    drawSpeedGauge: function () {
        if (!this.speedGaugeEnabled || !this.extraLayers) return;
        const r = 28, cx = this.width - r - 20, cy = this.height - r * 2.8 - 20;
        this.ctx.save(); this.ctx.translate(cx, cy);
        this.ctx.strokeStyle = this.isNight ? 'rgba(148,163,184,0.3)' : 'rgba(30,58,138,0.3)';
        this.ctx.lineWidth = 6; this.ctx.beginPath(); this.ctx.arc(0,0,r,0,Math.PI*2); this.ctx.stroke();
        const n = Math.min(this.speed / 40, 1);
        this.ctx.strokeStyle = this.speed >= 17 ? '#ef4444' : (this.speed >= 10 ? '#f59e0b' : '#3b82f6');
        this.ctx.beginPath(); this.ctx.arc(0,0,r,-0.5*Math.PI,-0.5*Math.PI+n*2*Math.PI); this.ctx.stroke();
        this.ctx.fillStyle = this.isNight ? '#fff' : '#1e3a8a';
        this.ctx.font = 'bold 13px Orbitron, sans-serif'; this.ctx.textAlign = 'center'; this.ctx.textBaseline = 'middle';
        this.ctx.fillText(Math.round(this.speed), 0, 0); this.ctx.restore();
    },


    // ── DEPTH PARTICLES ──────────────────────────────────────────────────────
    createDepthParticles: function () {
        this.depthParticles = [];
        const count = Math.floor(this.particles.length * 0.6);
        for (let i = 0; i < count; i++) {
            const p = this.resetParticle({});
            p.speedMult = 0.3 + Math.random() * 0.3; p.thickness = 0.3; p.trailLength = 5;
            this.depthParticles.push(p);
        }
    },


    // ── CANVAS SPARKS ────────────────────────────────────────────────────────
    triggerCanvasSparks: function (x, y, count = 12) {
        if (!this.extraLayers) return;
        for (let i = 0; i < count; i++) {
            const p = this.resetParticle({}, true);
            p.x = x; p.y = y; p.life = 25 + Math.random() * 15; p.speedMult *= 2.2;
            p.color = this.isNight ? 'rgba(251,191,36,' : 'rgba(249,115,22,';
            this.burstParticles.push(p);
        }
    },


    // ── STREAMLINE FIELD ─────────────────────────────────────────────────────
    buildStreamlineField: function () {
        if (!this.width || !this.height) return;
        const res  = this.streamlineResolution;
        const cols = Math.ceil(this.width  / res) + 1;
        const rows = Math.ceil(this.height / res) + 1;
        this.streamlineField = [];
        for (let row = 0; row < rows; row++) {
            const rowArr = [];
            for (let col = 0; col < cols; col++) {
                const nx = col / cols, ny = row / rows;
                const noise = Math.sin(nx*6.28+ny*3.14)*0.25 + Math.sin(nx*12.56-ny*6.28)*0.12 + Math.cos(nx*3.14+ny*9.42)*0.08;
                rowArr.push(noise);
            }
            this.streamlineField.push(rowArr);
        }
        this.streamlineCols = cols; this.streamlineRows = rows;
    },

    sampleStreamlineField: function (x, y) {
        const res = this.streamlineResolution;
        const col = Math.min(Math.floor(x / res), this.streamlineCols - 1);
        const row = Math.min(Math.floor(y / res), this.streamlineRows - 1);
        const fa  = (this.streamlineField[row]?.[col]) || 0;
        return this.currentDirection + fa + Math.sin(this.time * 0.3 + col * 0.1) * 0.05;
    },

    drawStreamlines: function () {
        if (!this.extraLayers) return;
        const res = this.streamlineResolution * 2, lineLen = res * 1.6;
        this.ctx.save();
        this.ctx.globalAlpha = this.isNight ? 0.07 : 0.06;
        this.ctx.strokeStyle = this.isNight ? '#93c5fd' : '#1d4ed8';
        this.ctx.lineWidth   = 0.8;
        for (let x = res / 2; x < this.width; x += res) {
            for (let y = res / 2; y < this.height; y += res) {
                const angle = this.sampleStreamlineField(x, y);
                const ex = x + Math.cos(angle) * lineLen, ey = y + Math.sin(angle) * lineLen;
                this.ctx.beginPath(); this.ctx.moveTo(x, y); this.ctx.lineTo(ex, ey); this.ctx.stroke();
                const hx = ex - Math.cos(angle - 0.4) * 5, hy = ey - Math.sin(angle - 0.4) * 5;
                this.ctx.beginPath(); this.ctx.moveTo(ex, ey); this.ctx.lineTo(hx, hy); this.ctx.stroke();
            }
        }
        this.ctx.globalAlpha = 1; this.ctx.restore();
    },


    // ── BEAUFORT LABEL ───────────────────────────────────────────────────────
    drawBeaufortLabel: function () {
        const bfBreaks = [0,0.3,1.6,3.4,5.5,8.0,10.8,13.9,17.2,20.8,24.5,28.5,32.7];
        const bfNames  = ['Calm','Light Air','Light Breeze','Gentle Breeze','Moderate Breeze',
                          'Fresh Breeze','Strong Breeze','Near Gale','Gale',
                          'Severe Gale','Storm','Violent Storm','Hurricane Force'];
        let bf = 0;
        for (let i = bfBreaks.length - 1; i >= 0; i--) { if (this.speed >= bfBreaks[i]) { bf = i; break; } }
        const label = `BF ${bf}  \u00b7  ${bfNames[bf]}`;
        const x = 12, y = this.height - 14, padX = 8, padY = 4, pillH = 18;
        this.ctx.save();
        this.ctx.font = "bold 10px 'Orbitron', sans-serif";
        const pillW = this.ctx.measureText(label).width + padX * 2;
        let pillColor;
        if      (bf >= 10) pillColor = 'rgba(239,68,68,0.75)';
        else if (bf >= 7)  pillColor = 'rgba(245,158,11,0.75)';
        else if (bf >= 4)  pillColor = 'rgba(59,130,246,0.75)';
        else               pillColor = this.isNight ? 'rgba(30,41,59,0.6)' : 'rgba(255,255,255,0.6)';
        this.ctx.fillStyle = pillColor;
        this._roundRect(x, y - pillH + padY, pillW, pillH, 5); this.ctx.fill();
        this.ctx.strokeStyle = this.isNight ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)';
        this.ctx.lineWidth = 0.5;
        this._roundRect(x, y - pillH + padY, pillW, pillH, 5); this.ctx.stroke();
        this.ctx.fillStyle = bf >= 4 ? '#fff' : (this.isNight ? '#e2e8f0' : '#1e3a8a');
        this.ctx.textAlign = 'left'; this.ctx.textBaseline = 'middle';
        this.ctx.fillText(label, x + padX, y - pillH / 2 + padY + 1);
        this.ctx.restore();
    },

    _roundRect: function (x, y, w, h, r) {
        this.ctx.beginPath();
        this.ctx.moveTo(x+r, y); this.ctx.lineTo(x+w-r, y); this.ctx.quadraticCurveTo(x+w, y, x+w, y+r);
        this.ctx.lineTo(x+w, y+h-r); this.ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
        this.ctx.lineTo(x+r, y+h);   this.ctx.quadraticCurveTo(x, y+h, x, y+h-r);
        this.ctx.lineTo(x, y+r);     this.ctx.quadraticCurveTo(x, y, x+r, y);
        this.ctx.closePath();
    },


    // ── WIND SOCK ────────────────────────────────────────────────────────────
    drawWindSock: function () {
        if (!this.extraLayers) return;
        const poleX = 22, poleY = 18, poleLen = 36;
        const n = Math.min(this.speed / 20, 1);
        const sockAngle = this.currentDirection + (1 - n) * (Math.PI / 2);
        const sockLen   = 38 + n * 18, sockMouth = 8 + n * 5, sockTail = 2 + n * 3;

        this.ctx.save();
        this.ctx.strokeStyle = this.isNight ? 'rgba(148,163,184,0.7)' : 'rgba(71,85,105,0.7)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath(); this.ctx.moveTo(poleX, poleY + poleLen); this.ctx.lineTo(poleX, poleY); this.ctx.stroke();
        this.ctx.fillStyle = this.isNight ? '#94a3b8' : '#475569';
        this.ctx.beginPath(); this.ctx.arc(poleX, poleY, 3, 0, Math.PI * 2); this.ctx.fill();
        this.ctx.fillStyle = this.isNight ? 'rgba(148,163,184,0.3)' : 'rgba(71,85,105,0.25)';
        this.ctx.beginPath(); this.ctx.ellipse(poleX, poleY + poleLen, 8, 3, 0, 0, Math.PI * 2); this.ctx.fill();

        this.ctx.translate(poleX, poleY); this.ctx.rotate(sockAngle);
        for (let b = 0; b < 3; b++) {
            const t0 = b/3, t1 = (b+1)/3;
            const x0 = t0*sockLen, x1 = t1*sockLen;
            const r0 = sockMouth*(1-t0)+sockTail*t0, r1 = sockMouth*(1-t1)+sockTail*t1;
            this.ctx.fillStyle = (b % 2 === 0)
                ? `rgba(251,146,60,${0.85+n*0.1})` : `rgba(255,255,255,${0.75+n*0.1})`;
            this.ctx.beginPath();
            this.ctx.moveTo(x0,r0); this.ctx.lineTo(x1,r1); this.ctx.lineTo(x1,-r1); this.ctx.lineTo(x0,-r0);
            this.ctx.closePath(); this.ctx.fill();
            this.ctx.strokeStyle = 'rgba(0,0,0,0.15)'; this.ctx.lineWidth = 0.5; this.ctx.stroke();
        }
        this.ctx.beginPath(); this.ctx.arc(0,0,sockMouth,-Math.PI/2,Math.PI/2);
        this.ctx.strokeStyle = this.isNight ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)';
        this.ctx.lineWidth = 1.5; this.ctx.stroke();
        this.ctx.rotate(-sockAngle);
        this.ctx.font = "9px 'Orbitron', sans-serif";
        this.ctx.fillStyle = this.isNight ? 'rgba(148,163,184,0.8)' : 'rgba(30,58,138,0.7)';
        this.ctx.textAlign = 'center'; this.ctx.textBaseline = 'top';
        this.ctx.fillText(`${Math.round(this.speed)} m/s`, 0, poleLen + 4);
        this.ctx.restore();
    },


    // ── HEAT SHIMMER ─────────────────────────────────────────────────────────
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
        const intensity   = Math.min((this.temperature - 32) / 13, 1);
        const maxDisplace = 3 + intensity * 5;
        const stripeW     = 4;
        const dpr         = window.devicePixelRatio || 1;
        this.shimmerCtx.clearRect(0, 0, this.width, this.height);
        this.shimmerCtx.drawImage(this.canvas, 0, 0, this.width, this.height);
        this.ctx.clearRect(0, 0, this.width, this.height);
        for (let x = 0; x < this.width; x += stripeW) {
            const dy = Math.sin(x*0.07+this.time*4.0)*maxDisplace*0.6 +
                       Math.sin(x*0.13-this.time*6.5)*maxDisplace*0.4;
            this.ctx.drawImage(this.shimmerCanvas, x*dpr, 0, stripeW*dpr, this.canvas.height, x, dy, stripeW, this.height);
        }
        this.ctx.save();
        this.ctx.fillStyle = `rgba(251,191,36,${0.02 + intensity * 0.04})`;
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.ctx.restore();
    },


    // ── UPDATE LOOP ──────────────────────────────────────────────────────────
    update: function () {
        if (!this.width) {
            this.resize();
            if (!this.width) { this.animationFrame = requestAnimationFrame(() => this.update()); return; }
        }

        this.ctx.clearRect(0, 0, this.width, this.height);
        this.drawBackground();
        this.drawStreamlines();
        this.drawCompass();

        const diff = this.targetDirection - this.currentDirection;
        if (Math.abs(diff) > 0.001) this.currentDirection += diff * 0.05;
        this.time += 0.01;
        const noiseTime = this.time * 0.2;

        if (Math.random() < 0.005)
            for (let k = 0; k < 10; k++) this.burstParticles.push(this.resetParticle({}, true));

        // Depth particles
        if (this.extraLayers) {
            this.ctx.globalAlpha = 0.35; this.ctx.lineCap = 'round';
            for (let i = this.depthParticles.length - 1; i >= 0; i--) {
                const p     = this.depthParticles[i];
                const angle = this.sampleStreamlineField(p.x, p.y) +
                              Math.sin(p.x*0.01+noiseTime)*Math.cos(p.y*0.01+noiseTime)*0.15;
                const sf    = Math.min(Math.max(this.speed, 2), 20) * p.speedMult;
                p.x += Math.cos(angle)*sf; p.y += Math.sin(angle)*sf; p.age++;
                p.trail.push({ x: p.x, y: p.y });
                if (p.trail.length > p.trailLength) p.trail.shift();
                let alpha = Math.sin((p.age/p.life)*Math.PI), thickness = p.thickness;
                if (this.mouse.active) {
                    const dx = p.x-this.mouse.x, dy = p.y-this.mouse.y;
                    if (dx*dx+dy*dy < 2500) { alpha = Math.min(1,alpha+0.3); thickness++; }
                }
                this.ctx.strokeStyle = `${p.color} ${alpha})`; this.ctx.lineWidth = thickness;
                if (this.speed < 5) { this.ctx.shadowBlur = 4; this.ctx.shadowColor = p.color+'0.5)'; }
                if (p.trail.length > 1) {
                    this.ctx.beginPath(); this.ctx.moveTo(p.trail[0].x, p.trail[0].y);
                    for (let j = 1; j < p.trail.length; j++) this.ctx.lineTo(p.trail[j].x, p.trail[j].y);
                    this.ctx.stroke();
                }
                this.ctx.shadowBlur = 0;
                if (p.age>=p.life||p.x<-50||p.x>this.width+50||p.y<-50||p.y>this.height+50)
                    { this.resetParticle(p); p.trail = []; }
            }
            this.ctx.globalAlpha = 1;
        }

        // Main + burst particles
        const all = [...this.particles, ...this.burstParticles];
        this.ctx.lineCap = 'round';
        for (let i = all.length - 1; i >= 0; i--) {
            const p     = all[i];
            const angle = this.sampleStreamlineField(p.x, p.y) +
                          Math.sin(p.x*0.01+noiseTime)*Math.cos(p.y*0.01+noiseTime)*0.3;
            const sf    = Math.min(Math.max(this.speed, 2), 20) * p.speedMult;
            p.x += Math.cos(angle)*sf; p.y += Math.sin(angle)*sf; p.age++;
            p.trail.push({ x: p.x, y: p.y });
            if (p.trail.length > p.trailLength) p.trail.shift();
            let alpha = Math.sin((p.age/p.life)*Math.PI), thickness = p.thickness;
            if (this.mouse.active) {
                const dx = p.x-this.mouse.x, dy = p.y-this.mouse.y;
                if (dx*dx+dy*dy < 2500) { alpha = Math.min(1,alpha+0.3); thickness++; }
            }
            this.ctx.strokeStyle = `${p.color} ${alpha})`; this.ctx.lineWidth = thickness;
            if (this.speed < 5) { this.ctx.shadowBlur = 4; this.ctx.shadowColor = p.color+'0.5)'; }
            if (p.trail.length > 1) {
                this.ctx.beginPath(); this.ctx.moveTo(p.trail[0].x, p.trail[0].y);
                for (let j = 1; j < p.trail.length; j++) this.ctx.lineTo(p.trail[j].x, p.trail[j].y);
                this.ctx.stroke();
            }
            this.ctx.shadowBlur = 0;
            const isBurst = this.burstParticles.includes(p);
            if (p.age>=p.life||p.x<-50||p.x>this.width+50||p.y<-50||p.y>this.height+50) {
                if (isBurst) this.burstParticles.splice(this.burstParticles.indexOf(p), 1);
                else { this.resetParticle(p); p.trail = []; }
            }
        }

        // Overlays
        if (this.extraLayers) {
            this.drawWindArrow();
            this.drawSpeedGauge();
            if (this.speed > 12 && Date.now() - this.lastGustTime > 1800 && Math.random() < 0.07) {
                this.triggerCanvasSparks(Math.random()*this.width, Math.random()*this.height*0.6, 8+Math.floor(this.speed/3));
                this.lastGustTime = Date.now();
            }
        }

        this.drawWindSock();
        this.drawBeaufortLabel();
        if (this.shimmerEnabled) this.applyHeatShimmer();

        this.animationFrame = requestAnimationFrame(() => this.update());
    },


    // ── START ────────────────────────────────────────────────────────────────
    start: function () {
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
        this.update();
    }
};
