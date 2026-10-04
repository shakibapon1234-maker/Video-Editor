/* eq-core.js — Studio Flow Audio EQ: shared core
 * Works in the browser (window.EQCore) AND in Node (require('./eq-core.js')).
 *  - one settings JSON  ->  Web Audio chain (live preview)
 *                       ->  ffmpeg -af string (final render on server)
 *  - sanitize() must be used on anything that arrives at the server.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.EQCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const BAND_TYPES = ['lowshelf', 'peaking', 'highshelf'];
    const BAND_FREQS = [100, 250, 500, 1000, 2000, 4000, 8000];
    const GAIN_MIN = -15, GAIN_MAX = 15, MAX_BANDS = 12;

    function clamp(v, lo, hi, dflt) {
        v = Number(v);
        if (!Number.isFinite(v)) return dflt;
        return Math.min(hi, Math.max(lo, v));
    }
    const round = (v, d) => { const m = Math.pow(10, d == null ? 3 : d); return Math.round(v * m) / m; };

    function defaultSettings() {
        return {
            version: 1,
            lowCut: { enabled: false, freq: 80 },
            highCut: { enabled: false, freq: 12000 },
            preGain: 0,
            bands: BAND_FREQS.map((f, i) => ({
                type: i === 0 ? 'lowshelf' : (i === BAND_FREQS.length - 1 ? 'highshelf' : 'peaking'),
                freq: f, gain: 0, q: (i === 0 || i === BAND_FREQS.length - 1) ? 0.7 : 1.0
            })),
            compressor: { enabled: false, threshold: -18, ratio: 3, attack: 10, release: 200, makeup: 3 },
            deesser: { enabled: false, freq: 6500, amount: 0.5 },
            normalize: { enabled: false, targetLUFS: -16 },
            limiter: { enabled: true, ceiling: -1 }
        };
    }

    // Presets: only list what differs from "flat". gains order = BAND_FREQS.
    const PRESET_DEFS = {
        flat:          { label: 'Flat (কোনো পরিবর্তন নয়)', lowCut: null, gains: [0, 0, 0, 0, 0, 0, 0] },
        tutorial:      { label: 'Tutorial Voice (টিউটোরিয়াল ভয়েস — সুপারিশকৃত)', lowCut: 90, gains: [-1, -2, -2, 0, 2, 2.5, 1],
                         compressor: { enabled: true, threshold: -20, ratio: 3, attack: 10, release: 200, makeup: 3 },
                         normalize: { enabled: true, targetLUFS: -16 } },
        clarity:       { label: 'Voice Clarity (স্পষ্ট ভয়েস)', lowCut: 80, gains: [0, -2, -1.5, 0, 2.5, 3, 1.5] },
        warm:          { label: 'Warm / Deep (গাঢ়, ভারী)', lowCut: 60, gains: [4, 2, 0, 0, -1, -1, -2] },
        bright:        { label: 'Bright (উজ্জ্বল)', lowCut: 80, gains: [-1, -1, 0, 0, 1.5, 2.5, 4] },
        muddy:         { label: 'Remove Muddy / Boxy (ঘোলা ভাব কমান)', lowCut: 80, gains: [0, -4, -3, 0, 1, 0, 0] },
        harsh:         { label: 'Reduce Harshness (কর্কশতা কমান)', lowCut: 80, gains: [0, 0, 0, 0, -1, -3, -3] }
    };

    function presetSettings(name) {
        const def = PRESET_DEFS[name] || PRESET_DEFS.flat;
        const s = defaultSettings();
        if (def.lowCut) s.lowCut = { enabled: true, freq: def.lowCut };
        def.gains.forEach((g, i) => { s.bands[i].gain = g; });
        if (def.compressor) s.compressor = Object.assign({}, def.compressor);
        if (def.normalize) s.normalize = Object.assign({}, def.normalize);
        return s;
    }
    function presetList() {
        return Object.keys(PRESET_DEFS).map(id => ({ id, label: PRESET_DEFS[id].label }));
    }

    // Clamp + whitelist everything. Safe to call on untrusted input.
    function sanitize(input) {
        const d = defaultSettings();
        const s = (input && typeof input === 'object') ? input : {};
        const out = defaultSettings();

        const lc = s.lowCut || {};
        out.lowCut = { enabled: !!lc.enabled, freq: clamp(lc.freq, 20, 400, d.lowCut.freq) };
        const hc = s.highCut || {};
        out.highCut = { enabled: !!hc.enabled, freq: clamp(hc.freq, 2000, 20000, d.highCut.freq) };
        out.preGain = clamp(s.preGain, -20, 20, 0);

        const srcBands = Array.isArray(s.bands) ? s.bands.slice(0, 12) : d.bands;
        out.bands = srcBands.map((b, i) => {
            b = b || {};
            const base = d.bands[Math.min(i, d.bands.length - 1)];
            return {
                type: BAND_TYPES.indexOf(b.type) >= 0 ? b.type : base.type,
                freq: clamp(b.freq, 20, 20000, base.freq),
                gain: clamp(b.gain, GAIN_MIN, GAIN_MAX, 0),
                q: clamp(b.q, 0.1, 10, base.q)
            };
        });

        const c = s.compressor || {};
        out.compressor = {
            enabled: !!c.enabled,
            threshold: clamp(c.threshold, -60, 0, -18),
            ratio: clamp(c.ratio, 1, 20, 3),
            attack: clamp(c.attack, 0.1, 200, 10),
            release: clamp(c.release, 10, 2000, 200),
            makeup: clamp(c.makeup, 0, 24, 3)
        };
        const de = s.deesser || {};
        out.deesser = { enabled: !!de.enabled, freq: clamp(de.freq, 3000, 12000, 6500), amount: clamp(de.amount, 0, 1, 0.5) };
        const n = s.normalize || {};
        out.normalize = { enabled: !!n.enabled, targetLUFS: clamp(n.targetLUFS, -30, -8, -16) };
        const lm = s.limiter || {};
        out.limiter = { enabled: lm.enabled === undefined ? true : !!lm.enabled, ceiling: clamp(lm.ceiling, -6, -0.1, -1) };
        return out;
    }

    // Take the TONE (EQ) part of a Studio Flow Voice Changer profile (audio.js VOICE_PROFILES).
    // Pitch / distortion / reverb are not EQ and are not imported.
    function importVoiceProfile(profile) {
        const s = defaultSettings();
        s.bands = [];
        ((profile && profile.bands) || []).forEach(b => {
            if (!b) return;
            if (b.type === 'highpass' && !s.lowCut.enabled) s.lowCut = { enabled: true, freq: b.freq };
            else if (b.type === 'lowpass' && !s.highCut.enabled) s.highCut = { enabled: true, freq: b.freq };
            else if (BAND_TYPES.indexOf(b.type) >= 0 && s.bands.length < MAX_BANDS)
                s.bands.push({ type: b.type, freq: b.freq, gain: b.gain || 0, q: b.q || (b.type === 'peaking' ? 1.0 : 0.7) });
        });
        if (!s.bands.length) s.bands = defaultSettings().bands;
        return sanitize(s);
    }

    // ---------- ffmpeg -af string ----------
    const dbToLin = (db) => Math.pow(10, db / 20);

    function toFfmpegFilter(settings) {
        const s = sanitize(settings);
        const f = [];
        if (s.preGain !== 0) f.push(`volume=${round(s.preGain, 2)}dB`);
        if (s.lowCut.enabled) f.push(`highpass=f=${round(s.lowCut.freq, 1)}`);
        if (s.highCut.enabled) f.push(`lowpass=f=${round(s.highCut.freq, 1)}`);
        s.bands.forEach(b => {
            if (Math.abs(b.gain) < 0.05) return; // skip neutral bands
            if (b.type === 'peaking')   f.push(`equalizer=f=${round(b.freq, 1)}:t=q:w=${round(b.q, 3)}:g=${round(b.gain, 2)}`);
            if (b.type === 'lowshelf')  f.push(`lowshelf=f=${round(b.freq, 1)}:t=q:w=${round(b.q, 3)}:g=${round(b.gain, 2)}`);
            if (b.type === 'highshelf') f.push(`highshelf=f=${round(b.freq, 1)}:t=q:w=${round(b.q, 3)}:g=${round(b.gain, 2)}`);
        });
        if (s.deesser.enabled) {
            // ffmpeg's deesser takes frequency as 0..1 (fraction of Nyquist, assuming 44.1k-ish → map 3k..12k)
            const fr = round(Math.min(1, Math.max(0, s.deesser.freq / 22050)), 3);
            f.push(`deesser=i=${round(s.deesser.amount, 2)}:m=0.5:f=${fr}`);
        }
        if (s.compressor.enabled) {
            const c = s.compressor;
            f.push(`acompressor=threshold=${round(dbToLin(c.threshold), 5)}:ratio=${round(c.ratio, 2)}:attack=${round(c.attack, 1)}:release=${round(c.release, 1)}:makeup=${round(Math.min(64, Math.max(1, dbToLin(c.makeup))), 3)}`);
        }
        const tp = s.limiter.enabled ? s.limiter.ceiling : -1.5;
        if (s.normalize.enabled) f.push(`loudnorm=I=${round(s.normalize.targetLUFS, 1)}:TP=${round(tp, 1)}:LRA=11`);
        // limiter so EQ boosts never clip when no normalize step is present
        else if (s.limiter.enabled) f.push(`alimiter=limit=${round(dbToLin(s.limiter.ceiling), 4)}:level=disabled`);
        return f.join(',');
    }

    // ---------- analytic frequency response (RBJ cookbook biquads) ----------
    // Used to draw the EQ curve; needs no AudioContext, so it works before playback.
    function biquadCoeffs(type, f0, gainDb, q, fs) {
        const w0 = 2 * Math.PI * Math.min(f0, fs / 2 - 1) / fs, cs = Math.cos(w0), sn = Math.sin(w0);
        const alpha = sn / (2 * q), A = Math.pow(10, gainDb / 40), sA = 2 * Math.sqrt(A) * alpha;
        if (type === 'highpass')
            return [(1 + cs) / 2, -(1 + cs), (1 + cs) / 2, 1 + alpha, -2 * cs, 1 - alpha];
        if (type === 'lowpass')
            return [(1 - cs) / 2, 1 - cs, (1 - cs) / 2, 1 + alpha, -2 * cs, 1 - alpha];
        if (type === 'lowshelf')
            return [A * ((A + 1) - (A - 1) * cs + sA), 2 * A * ((A - 1) - (A + 1) * cs), A * ((A + 1) - (A - 1) * cs - sA),
                    (A + 1) + (A - 1) * cs + sA, -2 * ((A - 1) + (A + 1) * cs), (A + 1) + (A - 1) * cs - sA];
        if (type === 'highshelf')
            return [A * ((A + 1) + (A - 1) * cs + sA), -2 * A * ((A - 1) + (A + 1) * cs), A * ((A + 1) + (A - 1) * cs - sA),
                    (A + 1) - (A - 1) * cs + sA, 2 * ((A - 1) - (A + 1) * cs), (A + 1) - (A - 1) * cs - sA];
        // peaking
        return [1 + alpha * A, -2 * cs, 1 - alpha * A, 1 + alpha / A, -2 * cs, 1 - alpha / A];
    }
    function responseDb(settings, freqs, fs) {
        const s = sanitize(settings); fs = fs || 48000;
        const stages = [];
        if (s.lowCut.enabled) stages.push(biquadCoeffs('highpass', s.lowCut.freq, 0, 0.7071, fs));
        if (s.highCut.enabled) stages.push(biquadCoeffs('lowpass', s.highCut.freq, 0, 0.7071, fs));
        s.bands.forEach(b => { if (Math.abs(b.gain) >= 0.01) stages.push(biquadCoeffs(b.type, b.freq, b.gain, b.q, fs)); });
        return freqs.map(f => {
            const w = 2 * Math.PI * f / fs, c1 = Math.cos(w), s1 = Math.sin(w), c2 = Math.cos(2 * w), s2 = Math.sin(2 * w);
            let db = 0;
            stages.forEach(k => {
                const nr = k[0] + k[1] * c1 + k[2] * c2, ni = -(k[1] * s1 + k[2] * s2);
                const dr = k[3] + k[4] * c1 + k[5] * c2, di = -(k[4] * s1 + k[5] * s2);
                db += 10 * Math.log10((nr * nr + ni * ni) / (dr * dr + di * di));
            });
            return db;
        });
    }

    // ---------- Web Audio chain (browser only) ----------
    // input -> [dry] ----------------------------> out
    //       -> preGain -> lowCut -> bands... -> comp -> [wet] -> out
    function buildWebAudioChain(ctx, settings) {
        const s = sanitize(settings);
        const input = ctx.createGain();
        const output = ctx.createGain();
        const dry = ctx.createGain(); dry.gain.value = 0;
        const wet = ctx.createGain(); wet.gain.value = 1;
        const pre = ctx.createGain();
        const lowCut = ctx.createBiquadFilter(); lowCut.type = 'highpass'; lowCut.Q.value = -3.01; // Web Audio HP/LP Q is in dB: -3.01 dB = 0.707 (Butterworth), same as ffmpeg highpass
        const highCut = ctx.createBiquadFilter(); highCut.type = 'lowpass'; highCut.Q.value = -3.01;
        // fixed pool so the number of bands can change later (voice-changer imports etc.)
        const filters = []; for (let i = 0; i < MAX_BANDS; i++) { const n = ctx.createBiquadFilter(); n.type = 'peaking'; n.frequency.value = 1000; n.gain.value = 0; filters.push(n); }
        const comp = ctx.createDynamicsCompressor();
        const analyser = ctx.createAnalyser(); analyser.fftSize = 4096; analyser.smoothingTimeConstant = 0.8;

        input.connect(dry); dry.connect(output);
        input.connect(pre); pre.connect(lowCut);
        lowCut.connect(highCut);
        let node = highCut;
        filters.forEach(n => { node.connect(n); node = n; });
        node.connect(comp); comp.connect(wet); wet.connect(output);
        output.connect(analyser);

        function update(next) {
            const v = sanitize(next);
            const t = ctx.currentTime, tc = 0.015;
            pre.gain.setTargetAtTime(dbToLin(v.preGain), t, tc);
            lowCut.frequency.setTargetAtTime(v.lowCut.enabled ? v.lowCut.freq : 10, t, tc); // 10 Hz ≈ off
            highCut.frequency.setTargetAtTime(v.highCut.enabled ? Math.min(v.highCut.freq, ctx.sampleRate / 2 - 100) : ctx.sampleRate / 2 - 100, t, tc);
            filters.forEach((n, i) => {
                const b = v.bands[i] || { type: 'peaking', freq: 1000, gain: 0, q: 1 };
                if (n.type !== b.type) n.type = b.type;
                n.frequency.setTargetAtTime(b.freq, t, tc);
                n.gain.setTargetAtTime(b.gain, t, tc);
                n.Q.setTargetAtTime(b.q, t, tc);
            });
            if (v.compressor.enabled) {
                const c = v.compressor;
                comp.threshold.setTargetAtTime(c.threshold, t, tc);
                comp.ratio.setTargetAtTime(c.ratio, t, tc);
                comp.attack.setTargetAtTime(Math.min(1, c.attack / 1000), t, tc);
                comp.release.setTargetAtTime(Math.min(1, c.release / 1000), t, tc);
                comp.knee.setTargetAtTime(6, t, tc);
            } else { // transparent
                comp.threshold.setTargetAtTime(0, t, tc);
                comp.ratio.setTargetAtTime(1, t, tc);
                comp.knee.setTargetAtTime(0, t, tc);
            }
        }
        function setBypass(on) { // A/B: true = original (dry)
            const t = ctx.currentTime;
            dry.gain.setTargetAtTime(on ? 1 : 0, t, 0.01);
            wet.gain.setTargetAtTime(on ? 0 : 1, t, 0.01);
        }
        // Combined magnitude response (dB) of the EQ stage at the given frequencies
        function getResponseDb(freqs) {
            const fArr = Float32Array.from(freqs);
            const mag = new Float32Array(fArr.length), ph = new Float32Array(fArr.length);
            const total = new Float32Array(fArr.length).fill(1);
            [lowCut, highCut].concat(filters).forEach(n => {
                n.getFrequencyResponse(fArr, mag, ph);
                for (let i = 0; i < total.length; i++) total[i] *= mag[i];
            });
            return Array.from(total, m => 20 * Math.log10(Math.max(m, 1e-6)));
        }
        update(s);
        return { input, output, analyser, update, setBypass, getResponseDb, filters, lowCut, highCut };
    }

    return {
        BAND_FREQS, GAIN_MIN, GAIN_MAX,
        defaultSettings, presetSettings, presetList, sanitize, importVoiceProfile, MAX_BANDS,
        toFfmpegFilter, buildWebAudioChain, responseDb
    };
});
