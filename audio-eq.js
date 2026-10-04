/* audio-eq.js — Studio Flow "Audio EQ" card (standalone tool)
 * Needs: eq-core.js (window.EQCore). Markup lives in index.html (#eq-card).
 *  - Live preview: <video id="eq-player"> -> MediaElementSource -> EQCore chain -> speakers
 *    (streams from disk, so even 30-min files cost almost no memory)
 *  - Final render: server ffmpeg via /api/audio-eq/*  (video stream is copied)
 *  - Fallback (no server, e.g. static hosting / Android): browser OfflineAudioContext -> WAV
 */
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id);
    const card = $('eq-card');
    if (!card || !window.EQCore) return;
    const EQ = window.EQCore;

    // ---------- elements ----------
    const el = {
        drop: $('eq-dropzone'), dropLabel: $('eq-dropzone-label'), fileInput: $('eq-file-input'), removeBtn: $('eq-remove-btn'),
        editor: $('eq-editor-box'), player: $('eq-player'), hint: $('eq-load-hint'),
        preset: $('eq-preset-select'), abBtn: $('eq-ab-btn'), abLabel: $('eq-ab-label'), resetBtn: $('eq-reset-btn'),
        canvas: $('eq-canvas'), bands: $('eq-bands'),
        lcOn: $('eq-lowcut-on'), lcFreq: $('eq-lowcut-freq'), lcVal: $('eq-lowcut-val'),
        pre: $('eq-pregain'), preVal: $('eq-pregain-val'),
        compOn: $('eq-comp-on'), compRatio: $('eq-comp-ratio'), compVal: $('eq-comp-val'),
        deOn: $('eq-deess-on'), deAmt: $('eq-deess-amt'), deVal: $('eq-deess-val'),
        normOn: $('eq-norm-on'), normLufs: $('eq-norm-lufs'), normVal: $('eq-norm-val'),
        output: $('eq-output-select'), renderBtn: $('eq-render-btn'),
        progBox: $('eq-progress-box'), progFill: $('eq-progress-fill'), progText: $('eq-status-text'), progPct: $('eq-percentage'),
        cancelBtn: $('eq-cancel-btn'), errBox: $('eq-error-box'), errDesc: $('eq-error-desc'),
        okBox: $('eq-success-box'), okDesc: $('eq-success-desc'), dl: $('eq-download-link'),
        hcOn: $('eq-highcut-on'), hcFreq: $('eq-highcut-freq'), hcVal: $('eq-highcut-val'),
        limOn: $('eq-lim-on'), limCeil: $('eq-lim-ceil'), limVal: $('eq-lim-val'),
        presetName: $('eq-preset-name'), savePreset: $('eq-save-preset-btn'), delPreset: $('eq-del-preset-btn'),
        exportBtn: $('eq-export-btn'), importBtn: $('eq-import-btn'), importInput: $('eq-import-input'),
        vcSel: $('eq-vc-select'), vcHint: $('eq-vc-hint'), projSel: $('eq-project-select'),
        loopOn: $('eq-loop-on'), loopStart: $('eq-loop-start'), loopEnd: $('eq-loop-end'),
        loopSetStart: $('eq-loop-setstart'), loopSetEnd: $('eq-loop-setend')
    };

    // ---------- styles (self-contained) ----------
    const style = document.createElement('style');
    style.textContent = `
    #eq-card .eq-toolbar{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap}
    #eq-card .eq-canvas{width:100%;height:auto;aspect-ratio:900/240;margin-top:12px;background:var(--bg-surface,#0f1624);border:1px solid var(--border-color,rgba(255,255,255,.08));border-radius:10px;touch-action:none;cursor:ns-resize}
    #eq-card .eq-bands{display:flex;justify-content:space-between;gap:6px}
    #eq-card .eq-band{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;min-width:0}
    #eq-card .eq-band input[type=range]{-webkit-appearance:slider-vertical;writing-mode:vertical-lr;direction:rtl;width:28px;height:130px;margin:0}
    #eq-card .eq-band .eq-gain{font-size:12px;color:var(--text-primary,#f8fafc);font-variant-numeric:tabular-nums}
    #eq-card .eq-band .eq-freq{font-size:11px;color:var(--text-secondary,#94a3b8)}
    #eq-card .eq-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
    #eq-card .eq-row input[type=range]{flex:1;min-width:120px}
    #eq-card .eq-check{display:flex;align-items:center;gap:8px;cursor:pointer;min-width:240px}
    #eq-card .eq-val{min-width:64px;text-align:right;font-variant-numeric:tabular-nums;color:var(--text-secondary,#94a3b8)}
    #eq-card .eq-polish summary{cursor:pointer;color:var(--text-secondary,#94a3b8)}
    #eq-card .eq-ab-on{border-color:#f59e0b !important;color:#f59e0b !important}
    `;
    document.head.appendChild(style);

    // ---------- state ----------
    let settings = EQ.presetSettings('flat');
    let ctx = null, sourceNode = null, chain = null;
    let currentFile = null, objectUrl = null;
    let bypass = false;
    let sessionId = null, uploadedFile = null;   // server session for the current file
    let polling = null, renderToken = 0;
    const FREQ_MIN = 20, FREQ_MAX = 20000, DB_RANGE = 15;

    // ---------- preset select (built-in + my presets) ----------
    const LS_KEY = 'studioflow_eq_user_presets_v1';
    function loadUserPresets() { try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; } catch (_) { return {}; } }
    function saveUserPresets(o) { try { localStorage.setItem(LS_KEY, JSON.stringify(o)); return true; } catch (_) { return false; } }
    function rebuildPresetSelect(selected) {
        el.preset.innerHTML = '';
        EQ.presetList().forEach(p => { const o = document.createElement('option'); o.value = p.id; o.textContent = p.label; el.preset.appendChild(o); });
        const mine = loadUserPresets(), names = Object.keys(mine);
        if (names.length) {
            const g = document.createElement('optgroup'); g.label = 'আমার প্রিসেট (My presets)';
            names.forEach(n => { const o = document.createElement('option'); o.value = 'user:' + n; o.textContent = n; g.appendChild(o); });
            el.preset.appendChild(g);
        }
        const c = document.createElement('option'); c.value = 'custom'; c.textContent = 'Custom (নিজের সেটিং)'; c.disabled = true; el.preset.appendChild(c);
        el.preset.value = selected || 'flat';
        if (el.preset.value !== (selected || 'flat')) el.preset.value = 'flat';
        el.delPreset.disabled = !String(el.preset.value).startsWith('user:');
    }

    // ---------- band sliders (built from settings, so imported profiles may have any band count) ----------
    const bandUI = [];
    function fmtFreq(f) { return f >= 1000 ? (Math.round(f / 100) / 10) + 'k' : String(Math.round(f)); }
    function bandLabel(b) { return (b.type === 'lowshelf' ? 'LS ' : (b.type === 'highshelf' ? 'HS ' : '')) + fmtFreq(b.freq) + 'Hz'; }
    function renderBands() {
        el.bands.innerHTML = ''; bandUI.length = 0;
        settings.bands.forEach((b, i) => {
            const wrap = document.createElement('div'); wrap.className = 'eq-band';
            const g = document.createElement('div'); g.className = 'eq-gain'; g.textContent = (b.gain > 0 ? '+' : '') + b.gain;
            const r = document.createElement('input'); r.type = 'range'; r.min = EQ.GAIN_MIN; r.max = EQ.GAIN_MAX; r.step = 0.5; r.value = b.gain;
            r.setAttribute('orient', 'vertical');
            const fl = document.createElement('div'); fl.className = 'eq-freq'; fl.textContent = bandLabel(b);
            r.addEventListener('input', () => { settings.bands[i].gain = parseFloat(r.value); markCustom(); applySettings(); });
            r.addEventListener('dblclick', () => { r.value = 0; settings.bands[i].gain = 0; markCustom(); applySettings(); });
            wrap.append(g, r, fl); el.bands.appendChild(wrap);
            bandUI.push({ r, g });
        });
    }

    function markCustom() { el.preset.value = 'custom'; el.delPreset.disabled = true; }

    function syncUI() {
        renderBands();
        el.lcOn.checked = settings.lowCut.enabled; el.lcFreq.value = settings.lowCut.freq; el.lcVal.textContent = settings.lowCut.freq + ' Hz';
        el.hcOn.checked = settings.highCut.enabled; el.hcFreq.value = settings.highCut.freq; el.hcVal.textContent = settings.highCut.freq + ' Hz';
        el.pre.value = settings.preGain; el.preVal.textContent = settings.preGain + ' dB';
        el.compOn.checked = settings.compressor.enabled; el.compRatio.value = settings.compressor.ratio; el.compVal.textContent = settings.compressor.ratio + ':1';
        el.deOn.checked = settings.deesser.enabled; el.deAmt.value = settings.deesser.amount; el.deVal.textContent = settings.deesser.amount;
        el.normOn.checked = settings.normalize.enabled; el.normLufs.value = settings.normalize.targetLUFS; el.normVal.textContent = settings.normalize.targetLUFS + ' LUFS';
        el.limOn.checked = settings.limiter.enabled; el.limCeil.value = settings.limiter.ceiling; el.limVal.textContent = settings.limiter.ceiling + ' dB';
    }

    function applySettings() {
        settings = EQ.sanitize(settings);
        if (chain) chain.update(settings);
        bandUI.forEach((u, i) => { const g = settings.bands[i].gain; u.g.textContent = (g > 0 ? '+' : '') + g; });
        drawCurve();
    }

    el.preset.addEventListener('change', () => {
        const v = el.preset.value;
        if (v === 'custom') return;
        if (v.startsWith('user:')) {
            const saved = loadUserPresets()[v.slice(5)];
            settings = EQ.sanitize(saved || EQ.presetSettings('flat'));
            el.presetName.value = v.slice(5);
        } else { settings = EQ.presetSettings(v); }
        el.delPreset.disabled = !v.startsWith('user:');
        syncUI(); applySettings();
    });
    el.resetBtn.addEventListener('click', () => { rebuildPresetSelect('flat'); settings = EQ.presetSettings('flat'); syncUI(); applySettings(); });

    // save / delete my presets, export / import JSON
    el.savePreset.addEventListener('click', () => {
        const name = (el.presetName.value || '').trim().slice(0, 40);
        if (!name) { el.presetName.focus(); el.presetName.placeholder = 'আগে একটা নাম লিখুন!'; return; }
        const all = loadUserPresets(); all[name] = EQ.sanitize(settings);
        if (!saveUserPresets(all)) { el.vcHint.style.display = ''; el.vcHint.textContent = 'প্রিসেট সেভ করা গেল না (ব্রাউজার স্টোরেজ বন্ধ)। Export বাটনে JSON ফাইলে রাখুন।'; return; }
        rebuildPresetSelect('user:' + name);
    });
    el.delPreset.addEventListener('click', () => {
        const v = el.preset.value; if (!v.startsWith('user:')) return;
        const all = loadUserPresets(); delete all[v.slice(5)]; saveUserPresets(all);
        rebuildPresetSelect('custom');
    });
    el.exportBtn.addEventListener('click', () => {
        const blob = new Blob([JSON.stringify({ app: 'studioflow-audio-eq', settings: EQ.sanitize(settings) }, null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = (el.presetName.value.trim() || 'eq-preset') + '.json';
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
    el.importBtn.addEventListener('click', () => el.importInput.click());
    el.importInput.addEventListener('change', async (e) => {
        const f = e.target.files[0]; el.importInput.value = ''; if (!f) return;
        try {
            const j = JSON.parse(await f.text());
            settings = EQ.sanitize(j.settings || j);
            el.presetName.value = f.name.replace(/\.json$/i, '').slice(0, 40);
            rebuildPresetSelect('custom'); syncUI(); applySettings();
        } catch (_) { el.vcHint.style.display = ''; el.vcHint.textContent = 'এই JSON ফাইলটি পড়া গেল না।'; }
    });

    // import the TONE part of a Voice Changer preset (pitch/reverb stay in the Voice Changer tool)
    (function fillVoiceChangerSelect() {
        let profiles = null;
        try { profiles = (typeof VOICE_PROFILES !== 'undefined') ? VOICE_PROFILES : (window.VOICE_PROFILES || null); } catch (_) {}
        if (!profiles) { el.vcSel.parentElement.style.display = 'none'; return; }
        Object.keys(profiles).forEach(k => {
            if (k === 'none') return;
            const o = document.createElement('option'); o.value = k; o.textContent = profiles[k].name || k; el.vcSel.appendChild(o);
        });
        el.vcSel.addEventListener('change', () => {
            const k = el.vcSel.value; if (!k) return;
            settings = EQ.importVoiceProfile(profiles[k]);
            rebuildPresetSelect('custom'); syncUI(); applySettings();
            el.vcHint.style.display = '';
            el.vcHint.textContent = 'শুধু টোনের (EQ) অংশ আনা হয়েছে। পিচ ও রিভার্ব এখানে আসে না — সেগুলো Voice Changer টুলেই থাকে।';
            el.vcSel.value = '';
        });
    })();

    function bindRange(inp, fn, valEl, fmt) {
        inp.addEventListener('input', () => { fn(parseFloat(inp.value)); valEl.textContent = fmt(parseFloat(inp.value)); markCustom(); applySettings(); });
    }
    function bindCheck(inp, fn) { inp.addEventListener('change', () => { fn(inp.checked); markCustom(); applySettings(); }); }
    bindCheck(el.lcOn, v => settings.lowCut.enabled = v);
    bindCheck(el.hcOn, v => settings.highCut.enabled = v);
    bindRange(el.hcFreq, v => settings.highCut.freq = v, el.hcVal, v => v + ' Hz');
    bindCheck(el.limOn, v => settings.limiter.enabled = v);
    bindRange(el.limCeil, v => settings.limiter.ceiling = v, el.limVal, v => v + ' dB');
    bindRange(el.lcFreq, v => settings.lowCut.freq = v, el.lcVal, v => v + ' Hz');
    bindRange(el.pre, v => settings.preGain = v, el.preVal, v => v + ' dB');
    bindCheck(el.compOn, v => settings.compressor.enabled = v);
    bindRange(el.compRatio, v => settings.compressor.ratio = v, el.compVal, v => v + ':1');
    bindCheck(el.deOn, v => settings.deesser.enabled = v);
    bindRange(el.deAmt, v => settings.deesser.amount = v, el.deVal, v => String(v));
    bindCheck(el.normOn, v => settings.normalize.enabled = v);
    bindRange(el.normLufs, v => settings.normalize.targetLUFS = v, el.normVal, v => v + ' LUFS');

    // ---------- A/B ----------
    el.abBtn.addEventListener('click', () => {
        bypass = !bypass;
        if (chain) chain.setBypass(bypass);
        el.abLabel.textContent = bypass ? 'Original শুনছেন' : 'Edited শুনছেন';
        el.abBtn.classList.toggle('eq-ab-on', bypass);
    });

    // ---------- audio graph (created lazily on first user action) ----------
    function ensureAudioGraph() {
        if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        ctx = new AC();
        sourceNode = ctx.createMediaElementSource(el.player);
        chain = EQ.buildWebAudioChain(ctx, settings);
        chain.setBypass(bypass);
        sourceNode.connect(chain.input);
        chain.output.connect(ctx.destination);
        spectrumBuf = new Uint8Array(chain.analyser.frequencyBinCount);
    }
    el.player.addEventListener('play', () => { ensureAudioGraph(); startLoop(); });
    el.player.addEventListener('pause', () => { drawCurve(); });

    // ---------- curve + spectrum canvas ----------
    const cv = el.canvas, g2 = cv.getContext('2d');
    let spectrumBuf = null, raf = 0;
    const xOfFreq = (f) => (Math.log(f / FREQ_MIN) / Math.log(FREQ_MAX / FREQ_MIN)) * cv.width;
    const freqOfX = (x) => FREQ_MIN * Math.pow(FREQ_MAX / FREQ_MIN, x / cv.width);
    const yOfDb = (db) => cv.height / 2 - (Math.max(-DB_RANGE, Math.min(DB_RANGE, db)) / DB_RANGE) * (cv.height / 2 - 14);
    const dbOfY = (y) => ((cv.height / 2 - y) / (cv.height / 2 - 14)) * DB_RANGE;

    function drawCurve() {
        const W = cv.width, H = cv.height;
        g2.clearRect(0, 0, W, H);
        // grid
        g2.lineWidth = 1; g2.font = '11px sans-serif'; g2.fillStyle = 'rgba(148,163,184,.8)';
        [-12, -6, 0, 6, 12].forEach(db => {
            g2.strokeStyle = db === 0 ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.07)';
            g2.beginPath(); g2.moveTo(0, yOfDb(db)); g2.lineTo(W, yOfDb(db)); g2.stroke();
            g2.fillText((db > 0 ? '+' : '') + db, 4, yOfDb(db) - 3);
        });
        [50, 100, 200, 500, 1000, 2000, 5000, 10000].forEach(f => {
            g2.strokeStyle = 'rgba(255,255,255,.07)';
            g2.beginPath(); g2.moveTo(xOfFreq(f), 0); g2.lineTo(xOfFreq(f), H); g2.stroke();
            g2.fillText(f >= 1000 ? (f / 1000) + 'k' : String(f), xOfFreq(f) + 3, H - 5);
        });
        // live spectrum
        if (chain && spectrumBuf && !el.player.paused) {
            chain.analyser.getByteFrequencyData(spectrumBuf);
            const nyq = ctx.sampleRate / 2, n = spectrumBuf.length;
            g2.beginPath(); g2.moveTo(0, H);
            for (let x = 0; x < W; x += 2) {
                const f = freqOfX(x), idx = Math.min(n - 1, Math.round((f / nyq) * n));
                g2.lineTo(x, H - (spectrumBuf[idx] / 255) * (H - 20));
            }
            g2.lineTo(W, H); g2.closePath();
            g2.fillStyle = 'rgba(99,102,241,.28)'; g2.fill();
        }
        // EQ response curve
        const freqs = [];
        for (let x = 0; x <= W; x += 4) freqs.push(freqOfX(x));
        const resp = EQ.responseDb(settings, freqs, ctx ? ctx.sampleRate : 48000);
        g2.beginPath();
        resp.forEach((db, i) => { const x = i * 4, y = yOfDb(db); i ? g2.lineTo(x, y) : g2.moveTo(x, y); });
        g2.strokeStyle = bypass ? 'rgba(245,158,11,.5)' : '#a5b4fc'; g2.lineWidth = 2.5; g2.stroke();
        // band handles
        settings.bands.forEach(b => {
            g2.beginPath(); g2.arc(xOfFreq(b.freq), yOfDb(b.gain), 5, 0, Math.PI * 2);
            g2.fillStyle = '#fff'; g2.fill(); g2.strokeStyle = '#6366f1'; g2.lineWidth = 2; g2.stroke();
        });
    }
    function startLoop() {
        cancelAnimationFrame(raf);
        const tick = () => { drawCurve(); if (!el.player.paused && !el.player.ended) raf = requestAnimationFrame(tick); };
        tick();
    }

    // drag a band's gain directly on the curve (nearest band by frequency)
    let dragBand = -1;
    function canvasPos(e) {
        const r = cv.getBoundingClientRect();
        return { x: (e.clientX - r.left) * (cv.width / r.width), y: (e.clientY - r.top) * (cv.height / r.height) };
    }
    function nearestBand(x) {
        let best = 0, bd = Infinity;
        settings.bands.forEach((b, i) => { const d = Math.abs(xOfFreq(b.freq) - x); if (d < bd) { bd = d; best = i; } });
        return best;
    }
    function dragTo(e) {
        if (dragBand < 0) return;
        const { y } = canvasPos(e);
        const gain = Math.round(Math.max(EQ.GAIN_MIN, Math.min(EQ.GAIN_MAX, dbOfY(y))) * 2) / 2;
        settings.bands[dragBand].gain = gain; bandUI[dragBand].r.value = gain; markCustom(); applySettings();
    }
    cv.addEventListener('pointerdown', (e) => { dragBand = nearestBand(canvasPos(e).x); cv.setPointerCapture(e.pointerId); dragTo(e); });
    cv.addEventListener('pointermove', dragTo);
    cv.addEventListener('pointerup', () => { dragBand = -1; });
    cv.addEventListener('pointercancel', () => { dragBand = -1; });

    // ---------- file load / remove ----------
    function setFile(file) {
        if (!file) return;
        resetServerSession();
        hideResults();
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        currentFile = file;
        objectUrl = URL.createObjectURL(file);
        el.player.src = objectUrl;
        el.dropLabel.textContent = file.name;
        el.removeBtn.style.display = '';
        el.editor.style.display = '';
        el.hint.textContent = 'লোড হচ্ছে...';
        const videoOpt = el.output.querySelector('option[value="video"]');
        el.player.onloadedmetadata = () => {
            const isVideo = el.player.videoWidth > 0;
            videoOpt.disabled = !isVideo;
            if (!isVideo && el.output.value === 'video') el.output.value = 'wav';
            if (isVideo && el.output.value !== 'video') el.output.value = 'video';
            const d = el.player.duration;
            const mm = Math.floor(d / 60), ss = Math.floor(d % 60);
            el.hint.textContent = `${isVideo ? 'ভিডিও' : 'অডিও'} · ${mm} মিনিট ${ss} সেকেন্ড · ${(file.size / 1048576).toFixed(1)} MB। প্লে করে শুনতে শুনতে স্লাইডার নাড়ান।`;
        };
        el.player.onerror = () => { el.hint.textContent = 'এই ফাইল ব্রাউজারে প্লে করা যাচ্ছে না — তবে রেন্ডার সার্ভারে কাজ করতে পারে।'; };
        drawCurve();
    }
    function removeFile() {
        try { el.player.pause(); } catch (_) {}
        el.player.removeAttribute('src'); el.player.load();
        if (objectUrl) URL.revokeObjectURL(objectUrl); objectUrl = null; currentFile = null;
        resetServerSession(); hideResults();
        el.editor.style.display = 'none'; el.removeBtn.style.display = 'none';
        el.dropLabel.textContent = 'Drag & Drop Audio/Video here or Click to Select';
    }
    el.drop.addEventListener('click', (e) => { if (e.target.closest('#eq-remove-btn')) return; el.fileInput.click(); });
    el.fileInput.addEventListener('change', (e) => { if (e.target.files[0]) setFile(e.target.files[0]); el.fileInput.value = ''; });
    el.removeBtn.addEventListener('click', (e) => { e.stopPropagation(); removeFile(); });
    ['dragover', 'dragenter'].forEach(ev => el.drop.addEventListener(ev, (e) => { e.preventDefault(); el.drop.classList.add('drag-over'); }));
    ['dragleave', 'drop'].forEach(ev => el.drop.addEventListener(ev, (e) => { e.preventDefault(); el.drop.classList.remove('drag-over'); }));
    el.drop.addEventListener('drop', (e) => { if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]); });

    // ---------- render ----------
    function hideResults() { el.errBox.style.display = 'none'; el.okBox.style.display = 'none'; el.progBox.style.display = 'none'; }
    function showProgress(text, pct) {
        el.progBox.style.display = 'block'; el.progText.textContent = text;
        el.progPct.textContent = Math.round(pct) + '%'; el.progFill.style.width = pct + '%';
    }
    function showError(msg) {
        el.progBox.style.display = 'none'; el.okBox.style.display = 'none';
        el.errBox.style.display = 'block'; el.errDesc.textContent = msg;
    }
    function showDone(url, filename, label) {
        el.progBox.style.display = 'none'; el.errBox.style.display = 'none';
        el.dl.href = url; el.dl.download = filename;
        el.okDesc.textContent = `${label} প্রস্তুত — "${filename}" ডাউনলোড করুন।`;
        el.okBox.style.display = 'block';
    }
    function setBusy(b) { el.renderBtn.disabled = b; el.output.disabled = b; }

    function resetServerSession() {
        clearInterval(polling); polling = null; renderToken++;
        if (sessionId) { fetch(`/api/audio-eq/cancel?session=${encodeURIComponent(sessionId)}`, { method: 'POST' }).catch(() => {}); }
        sessionId = null; uploadedFile = null; setBusy(false);
    }
    window.addEventListener('beforeunload', () => {
        if (sessionId && navigator.sendBeacon) navigator.sendBeacon(`/api/audio-eq/cancel?session=${encodeURIComponent(sessionId)}`);
    });

    async function jsonFetch(url, opts) {
        const res = await fetch(url, opts);
        let data = null; try { data = await res.json(); } catch (_) {}
        if (!res.ok) throw new Error((data && data.error) || `HTTP ${res.status}`);
        return data;
    }
    function uploadFile(sid, file, onProgress) {
        return new Promise((resolve, reject) => {
            const x = new XMLHttpRequest();
            x.open('POST', `/api/audio-eq/upload?session=${encodeURIComponent(sid)}&filename=${encodeURIComponent(file.name)}`);
            x.setRequestHeader('Content-Type', 'application/octet-stream');
            x.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
            x.onload = () => {
                if (x.status === 200) return resolve();
                let msg = `HTTP ${x.status}`; try { msg = JSON.parse(x.responseText).error || msg; } catch (_) {}
                reject(new Error(msg));
            };
            x.onerror = () => reject(new Error('NETWORK'));
            x.send(file);
        });
    }

    async function renderOnServer(token) {
        if (!sessionId || uploadedFile !== currentFile) {
            if (sessionId) fetch(`/api/audio-eq/cancel?session=${encodeURIComponent(sessionId)}`, { method: 'POST' }).catch(() => {});
            const init = await jsonFetch('/api/audio-eq/init', { method: 'POST' });
            sessionId = init.sessionId; uploadedFile = null;
            showProgress('ফাইল সার্ভারে পাঠানো হচ্ছে... (Uploading)', 0);
            await uploadFile(sessionId, currentFile, (p) => { if (token === renderToken) showProgress('ফাইল সার্ভারে পাঠানো হচ্ছে... (Uploading)', p * 30); });
            if (token !== renderToken) return;
            uploadedFile = currentFile;
        }
        showProgress('EQ প্রয়োগ হচ্ছে... (Rendering)', 30);
        await jsonFetch(`/api/audio-eq/render?session=${encodeURIComponent(sessionId)}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ settings: EQ.sanitize(settings), output: el.output.value, durationSec: el.player.duration || 0 })
        });
        const sid = sessionId;
        await new Promise((resolve, reject) => {
            polling = setInterval(async () => {
                if (token !== renderToken) { clearInterval(polling); return resolve(); }
                try {
                    const st = await jsonFetch(`/api/audio-eq/status?session=${encodeURIComponent(sid)}`);
                    if (st.status === 'rendering') showProgress('EQ প্রয়োগ হচ্ছে... (Rendering)', 30 + st.percent * 0.7);
                    else if (st.status === 'done') {
                        clearInterval(polling);
                        const label = el.output.value === 'video' ? 'ভিডিও' : (el.output.value === 'mp3' ? 'MP3' : 'WAV');
                        showDone(st.downloadUrl, st.filename, label); resolve();
                    } else if (st.status === 'error') { clearInterval(polling); reject(new Error(st.error || 'Render failed')); }
                } catch (err) { clearInterval(polling); reject(err); }
            }, 1000);
        });
    }

    // Fallback when there is no Node server (static hosting / Android): browser render -> WAV.
    async function renderInBrowser(token) {
        if (currentFile.size > 200 * 1048576) throw new Error('এই ফাইলটি ব্রাউজারে রেন্ডারের জন্য অনেক বড়। Studio Flow সার্ভার (npm start) চালু করে আবার চেষ্টা করুন।');
        showProgress('ফাইল ডিকোড হচ্ছে... (Decoding)', 10);
        const AC = window.AudioContext || window.webkitAudioContext;
        const tmp = new AC();
        let buf;
        try { buf = await tmp.decodeAudioData(await currentFile.arrayBuffer()); }
        finally { try { tmp.close(); } catch (_) {} }
        if (token !== renderToken) return;
        showProgress('EQ প্রয়োগ হচ্ছে... (Rendering)', 45);
        const off = new OfflineAudioContext(buf.numberOfChannels, buf.length, buf.sampleRate);
        const src = off.createBufferSource(); src.buffer = buf;
        const ch = EQ.buildWebAudioChain(off, settings);
        src.connect(ch.input); ch.output.connect(off.destination); src.start(0);
        const rendered = await off.startRendering();
        if (token !== renderToken) return;
        showProgress('WAV তৈরি হচ্ছে...', 90);
        if (typeof window.bufferToWavBlob !== 'function') throw new Error('WAV এনকোডার পাওয়া যায়নি।');
        const blob = window.bufferToWavBlob(rendered);
        const base = currentFile.name.replace(/\.[^.]+$/, '') || 'audio';
        showDone(URL.createObjectURL(blob), `${base}_eq.wav`, 'WAV (ব্রাউজার মোড)');
    }

    el.renderBtn.addEventListener('click', async () => {
        if (!currentFile) return;
        hideResults(); setBusy(true);
        const token = ++renderToken;
        try {
            try {
                await renderOnServer(token);
            } catch (err) {
                const noServer = err && (err.message === 'NETWORK' || err.message === 'Failed to fetch' || /HTTP 404|HTTP 405/.test(err.message));
                if (!noServer) throw err;
                await renderInBrowser(token);
            }
        } catch (err) {
            console.error('Audio EQ render failed:', err);
            if (token === renderToken) showError(err && err.message ? err.message : 'রেন্ডার করতে সমস্যা হয়েছে।');
        } finally {
            if (token === renderToken) setBusy(false);
        }
    });
    el.cancelBtn.addEventListener('click', () => { resetServerSession(); hideResults(); });

    // ---------- preview loop (listen to one section again and again) ----------
    function parseTime(txt) {
        txt = String(txt || '').trim(); if (!txt) return NaN;
        if (txt.indexOf(':') < 0) return parseFloat(txt);
        const parts = txt.split(':').map(parseFloat); if (parts.some(isNaN)) return NaN;
        return parts.reduce((acc, v) => acc * 60 + v, 0);
    }
    function fmtTime(sec) { sec = Math.max(0, sec || 0); const m = Math.floor(sec / 60), r = sec - m * 60; return m + ':' + (r < 10 ? '0' : '') + r.toFixed(1); }
    el.loopSetStart.addEventListener('click', () => { el.loopStart.value = fmtTime(el.player.currentTime); });
    el.loopSetEnd.addEventListener('click', () => { el.loopEnd.value = fmtTime(el.player.currentTime); });
    el.player.addEventListener('timeupdate', () => {
        if (!el.loopOn.checked) return;
        const a = parseTime(el.loopStart.value), b = parseTime(el.loopEnd.value);
        if (!(b > a)) return;
        if (el.player.currentTime >= b || el.player.currentTime < a - 0.3) el.player.currentTime = a;
    });
    el.loopOn.addEventListener('change', () => {
        if (!el.loopOn.checked) return;
        const a = parseTime(el.loopStart.value), d = el.player.duration;
        if (isFinite(d) && !(parseTime(el.loopEnd.value) > a)) el.loopEnd.value = fmtTime(Math.min(d, a + 30));
        if (a >= 0) el.player.currentTime = a;
    });

    // ---------- take a clip that is already open in the video editor ----------
    function projectClips() {
        const ve = window.VideoEditor; if (!ve || !Array.isArray(ve.clips)) return [];
        return ve.clips.filter(c => c && c.file && c.type !== 'image');
    }
    function fillProjectSelect() {
        const clips = projectClips(), keep = el.projSel.value;
        el.projSel.innerHTML = '<option value="">⬇ অথবা এডিটরের প্রজেক্ট ক্লিপ থেকে নিন (Use project clip)…</option>';
        clips.forEach((c, i) => {
            const o = document.createElement('option'); o.value = String(i);
            o.textContent = `${i + 1}. ${c.name || c.file.name || 'clip'}` + (c.duration ? ` (${fmtTime(c.duration).replace(/\.\d$/, '')})` : '');
            el.projSel.appendChild(o);
        });
        if (!clips.length) { const o = document.createElement('option'); o.value = ''; o.disabled = true; o.textContent = '(এডিটরে এখনো কোনো ভিডিও ক্লিপ নেই)'; el.projSel.appendChild(o); }
        el.projSel.value = keep;
    }
    ['mousedown', 'focus', 'touchstart'].forEach(ev => el.projSel.addEventListener(ev, fillProjectSelect));
    el.projSel.addEventListener('change', () => {
        const c = projectClips()[parseInt(el.projSel.value, 10)];
        el.projSel.value = '';
        if (c && c.file) setFile(c.file);
    });

    // ---------- download on Android (Capacitor): save to Documents + share sheet ----------
    function isNativeApp() { return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); }
    el.dl.addEventListener('click', async (e) => {
        if (!isNativeApp()) return;           // desktop/browser: normal download link
        e.preventDefault();
        try {
            const cap = window.Capacitor, FS = cap.Plugins && cap.Plugins.Filesystem;
            if (!FS) throw new Error('Filesystem plugin not available');
            const blob = await (await fetch(el.dl.href)).blob();
            const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onloadend = () => res(String(r.result || '').split(',')[1] || ''); r.onerror = rej; r.readAsDataURL(blob); });
            const name = el.dl.download || 'audio_eq.wav';
            await FS.writeFile({ path: name, data: b64, directory: 'DOCUMENTS', recursive: true });
            try {
                const Share = cap.Plugins.Share;
                if (Share) { const u = await FS.getUri({ path: name, directory: 'DOCUMENTS' }); await Share.share({ title: name, url: u.uri, dialogTitle: 'Save or share' }); }
            } catch (shareErr) { console.warn('Share skipped:', shareErr); }
            el.okDesc.textContent = `"${name}" Documents ফোল্ডারে সেভ হয়েছে।`;
        } catch (err) { console.error('Native save failed:', err); showError('ফাইল সেভ করা যায়নি: ' + (err && err.message ? err.message : err)); }
    });

    // ---------- init ----------
    rebuildPresetSelect('flat');
    syncUI();
    drawCurve();
    window.StudioAudioEQ = { loadFile: setFile, getSettings: () => EQ.sanitize(settings), setSettings: (s) => { settings = EQ.sanitize(s); markCustom(); syncUI(); applySettings(); } };
})();
