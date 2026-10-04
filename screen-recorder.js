/**
 * screen-recorder.js
 * Built-in Screen Recorder for Studio Flow Video Editor.
 *
 * Uses Electron's desktopCapturer + setDisplayMediaRequestHandler
 * and standard Web MediaRecorder API to guarantee 100% crash-free
 * screen & window recording.
 */

(function initScreenRecorderModule() {
    'use strict';

    // ── State ────────────────────────────────────────────────────────────────
    let srSources        = [];        // available capturable sources
    let srSelectedId     = null;      // chosen source ID
    let srSelectedThumb  = null;      // thumbnail data URL of chosen source
    let srStream         = null;      // MediaStream from getDisplayMedia
    let srMicStream      = null;      // Optional microphone stream
    let srRecorder       = null;      // MediaRecorder instance
    let srChunks         = [];        // recorded Blob chunks
    let srRecording      = false;
    let srPaused         = false;
    let srTimerInterval  = null;
    let srElapsedSec     = 0;
    let srCountdownTimer = null;
    let eventsAttached   = false;

    // ── DOM helpers ──────────────────────────────────────────────────────────
    const $    = (id) => document.getElementById(id);
    const show = (el, disp) => { if (el) el.style.display = disp || ''; };
    const hide = (el) => { if (el) el.style.display = 'none'; };

    // ── Format seconds → MM:SS ───────────────────────────────────────────────
    function fmtTime(s) {
        const m = Math.floor(s / 60);
        return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    }

    // ── Load sources from main process ───────────────────────────────────────
    async function loadSources() {
        const grid    = $('sr-source-grid');
        const spinner = $('sr-source-spinner');
        if (!grid) return;
        show(spinner, 'block');
        grid.innerHTML = '';

        try {
            if (window.electronAPI && typeof window.electronAPI.getScreenSources === 'function') {
                srSources = await window.electronAPI.getScreenSources();
            } else {
                srSources = [];
            }
        } catch (e) {
            srSources = [];
            console.error('getScreenSources failed:', e);
        }
        hide(spinner);

        if (srSources.length === 0) {
            grid.innerHTML = '<p style="color:#94a3b8;text-align:center;padding:16px;grid-column:1/-1;">কোনো capturable source পাওয়া যায়নি। সিস্টেমের ফুল স্ক্রিন রেকর্ড করা যাবে।</p>';
            return;
        }

        srSources.forEach((src, idx) => {
            const card = document.createElement('div');
            card.className = 'sr-source-card' + (idx === 0 ? ' selected' : '');
            card.dataset.id = src.id;
            card.innerHTML = `
                <img src="${src.thumbnailDataUrl}" alt="${src.name}">
                <span>${src.name.length > 28 ? src.name.slice(0, 28) + '\u2026' : src.name}</span>
            `;
            card.addEventListener('click', () => selectSource(src.id, src.thumbnailDataUrl, card));
            grid.appendChild(card);
        });

        // Automatically set first source without triggering live video stream
        if (srSources.length > 0) {
            selectSource(srSources[0].id, srSources[0].thumbnailDataUrl, grid.firstElementChild, false);
        }
    }

    // ── Select a source ──────────────────────────────────────────────────────
    function selectSource(id, thumbUrl, cardEl, notifyMain = true) {
        srSelectedId    = id;
        srSelectedThumb = thumbUrl || null;

        document.querySelectorAll('.sr-source-card').forEach(c => c.classList.remove('selected'));
        if (cardEl) cardEl.classList.add('selected');

        if (notifyMain && window.electronAPI && typeof window.electronAPI.setSelectedScreenSource === 'function') {
            window.electronAPI.setSelectedScreenSource(id).catch(() => {});
        }

        // Show crisp static thumbnail in preview box (zero lag, zero crash risk)
        const thumbImg    = $('sr-preview-thumb');
        const placeholder = $('sr-preview-placeholder');
        const videoEl     = $('sr-preview-video');

        if (thumbImg && thumbUrl) {
            thumbImg.src = thumbUrl;
            show(thumbImg, 'block');
            hide(placeholder);
            hide(videoEl);
        }
    }

    // ── Optional Live Preview ────────────────────────────────────────────────
    async function toggleLivePreview() {
        const previewBtn = $('sr-preview-btn');
        const videoEl    = $('sr-preview-video');
        const thumbImg   = $('sr-preview-thumb');

        // If preview already running, stop it
        if (srStream && !srRecording) {
            stopStream();
            if (previewBtn) previewBtn.innerHTML = '&#9654; লাইভ প্রিভিউ দেখুন';
            if (thumbImg && srSelectedThumb) show(thumbImg, 'block');
            hide(videoEl);
            setStatus('প্রিভিউ বন্ধ করা হয়েছে।', 'idle');
            return;
        }

        try {
            if (window.electronAPI && typeof window.electronAPI.setSelectedScreenSource === 'function' && srSelectedId) {
                await window.electronAPI.setSelectedScreenSource(srSelectedId);
            }

            setStatus('প্রিভিউ শুরু হচ্ছে...', 'idle');
            srStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: false
            });

            if (videoEl) {
                videoEl.srcObject = srStream;
                show(videoEl, 'block');
                hide(thumbImg);
                hide($('sr-preview-placeholder'));
                videoEl.play().catch(() => {});
            }

            if (previewBtn) previewBtn.innerHTML = '&#9632; প্রিভিউ বন্ধ';
            setStatus('লাইভ প্রিভিউ চলছে।', 'idle');

            // Handle user stopping sharing via OS bar
            srStream.getVideoTracks()[0].onended = () => {
                if (!srRecording) {
                    stopStream();
                    if (previewBtn) previewBtn.innerHTML = '&#9654; লাইভ প্রিভিউ দেখুন';
                    if (thumbImg && srSelectedThumb) show(thumbImg, 'block');
                    hide(videoEl);
                }
            };

        } catch (err) {
            console.error('Live preview error:', err);
            setStatus('প্রিভিউ চালু করা যায়নি: ' + err.message, 'error');
            if (previewBtn) previewBtn.innerHTML = '&#9654; লাইভ প্রিভিউ দেখুন';
        }
    }

    // ── Stop active media stream ─────────────────────────────────────────────
    function stopStream() {
        if (srStream) {
            srStream.getTracks().forEach(t => t.stop());
            srStream = null;
        }
        if (srMicStream) {
            srMicStream.getTracks().forEach(t => t.stop());
            srMicStream = null;
        }
        const previewVideo = $('sr-preview-video');
        if (previewVideo) previewVideo.srcObject = null;
    }

    // ── Countdown then start recording ───────────────────────────────────────
    function startCountdown() {
        const overlay   = $('sr-countdown-overlay');
        const countText = $('sr-countdown-text');
        const startBtn  = $('sr-start-btn');

        if (startBtn) startBtn.disabled = true;
        show(overlay, 'flex');

        let count = 3;
        if (countText) countText.textContent = count;

        if (srCountdownTimer) clearInterval(srCountdownTimer);

        srCountdownTimer = setInterval(() => {
            count--;
            if (count > 0) {
                if (countText) countText.textContent = count;
            } else {
                clearInterval(srCountdownTimer);
                hide(overlay);
                beginRecording();
            }
        }, 1000);
    }

    // ── Begin actual MediaRecorder capture ───────────────────────────────────
    async function beginRecording() {
        const audioOn    = $('sr-audio-toggle') ? $('sr-audio-toggle').checked : true;
        const micOn      = $('sr-mic-toggle')   ? $('sr-mic-toggle').checked   : false;
        const startBtn   = $('sr-start-btn');
        const stopBtn    = $('sr-stop-btn');
        const pauseBtn   = $('sr-pause-btn');
        const recBadge   = $('sr-rec-badge');
        const previewBtn = $('sr-preview-btn');

        try {
            // Set source selection in main process first
            if (window.electronAPI && typeof window.electronAPI.setSelectedScreenSource === 'function' && srSelectedId) {
                await window.electronAPI.setSelectedScreenSource(srSelectedId);
            }

            // Stop existing idle preview if running
            stopStream();

            // 1. Capture screen/window display stream
            const displayStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: audioOn
            });

            // 2. Optional microphone stream
            if (micOn) {
                try {
                    srMicStream = await navigator.mediaDevices.getUserMedia({
                        audio: true,
                        video: false
                    });
                } catch (micErr) {
                    console.warn('Microphone access denied or unavailable:', micErr);
                }
            }

            // Combine tracks safely
            const combinedTracks = [
                ...displayStream.getVideoTracks(),
                ...displayStream.getAudioTracks()
            ];
            if (srMicStream) {
                srMicStream.getAudioTracks().forEach(t => combinedTracks.push(t));
            }

            srStream = new MediaStream(combinedTracks);

            // Show stream in preview box
            const videoEl = $('sr-preview-video');
            const thumbEl = $('sr-preview-thumb');
            if (videoEl) {
                videoEl.srcObject = srStream;
                show(videoEl, 'block');
                hide(thumbEl);
                hide($('sr-preview-placeholder'));
                videoEl.play().catch(() => {});
            }

            // Pick supported codec
            const mimeCandidates = [
                'video/webm;codecs=vp9,opus',
                'video/webm;codecs=vp8,opus',
                'video/webm;codecs=h264,opus',
                'video/webm'
            ];
            const mimeType = mimeCandidates.find(m => {
                try { return MediaRecorder.isTypeSupported(m); } catch (_) { return false; }
            }) || 'video/webm';

            srChunks   = [];
            srRecorder = new MediaRecorder(srStream, { mimeType });

            srRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) srChunks.push(e.data);
            };

            srRecorder.onstop = onRecorderStop;

            srRecorder.start(1000); // 1-second chunks
            srRecording  = true;
            srPaused     = false;
            srElapsedSec = 0;

            // Stop if user stops sharing from OS banner
            displayStream.getVideoTracks()[0].onended = () => {
                if (srRecording) stopRecording();
            };

            startTimer();
            setStatus('\u25CF রেকর্ডিং চলছে...', 'recording');
            show(recBadge, 'block');

            if (startBtn)   hide(startBtn);
            if (stopBtn)    { stopBtn.disabled = false; show(stopBtn, 'inline-flex'); }
            if (pauseBtn)   { pauseBtn.disabled = false; show(pauseBtn, 'inline-flex'); updatePauseBtn(); }
            if (previewBtn) previewBtn.disabled = true;

        } catch (err) {
            console.error('beginRecording error:', err);
            setStatus('রেকর্ডিং শুরু করা যায়নি: ' + err.message, 'error');
            resetUI();
        }
    }

    // ── Stop recording ───────────────────────────────────────────────────────
    function stopRecording() {
        if (srRecorder && srRecording) {
            srRecorder.stop();
        }
        stopTimer();
        srRecording = false;
        srPaused    = false;
        hide($('sr-rec-badge'));
    }

    // ── Pause / Resume ───────────────────────────────────────────────────────
    function togglePause() {
        if (!srRecorder || !srRecording) return;
        if (srPaused) {
            srRecorder.resume();
            srPaused = false;
            startTimer();
            setStatus('\u25CF রেকর্ডিং চলছে...', 'recording');
        } else {
            srRecorder.pause();
            srPaused = true;
            stopTimer();
            setStatus('\u23F8 রেকর্ডিং বিরতিতে আছে', 'paused');
        }
        updatePauseBtn();
    }

    // ── After MediaRecorder stops — save file ────────────────────────────────
    async function onRecorderStop() {
        stopStream();

        const blob = new Blob(srChunks, { type: 'video/webm' });
        srChunks   = [];

        const timestamp   = new Date().toISOString().slice(0, 19).replace('T', '_').replace(/[:]/g, '-');
        const suggestName = 'screen_recording_' + timestamp + '.webm';

        setStatus('\uD83D\uDCBE ফাইল সংরক্ষণ করা হচ্ছে...', 'saving');
        const progressBox = $('sr-progress-box');
        show(progressBox, 'block');

        try {
            if (window.electronAPI && typeof window.electronAPI.saveScreenRecording === 'function') {
                const buf    = await blob.arrayBuffer();
                const result = await window.electronAPI.saveScreenRecording(buf, suggestName);
                hide(progressBox);

                if (result.canceled) {
                    setStatus('সেভ বাতিল করা হয়েছে।', 'idle');
                } else {
                    setStatus('\u2705 সংরক্ষিত: ' + result.filePath, 'done');
                    showSaveSuccess(result.filePath, blob);
                }
            } else {
                // Browser fallback — standard download
                hide(progressBox);
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = suggestName;
                a.click();
                setStatus('\u2705 ডাউনলোড শুরু হয়েছে!', 'done');
                showSaveSuccess(suggestName, blob);
            }
        } catch (err) {
            hide(progressBox);
            setStatus('\u274C সেভ ব্যর্থ: ' + err.message, 'error');
        } finally {
            resetUI();
        }
    }

    // ── Show success box with import option ──────────────────────────────────
    function showSaveSuccess(filePath, blob) {
        const box     = $('sr-success-box');
        const desc    = $('sr-success-path');
        const preview = $('sr-result-video');
        if (desc)    desc.textContent = filePath;
        if (preview && blob) preview.src = URL.createObjectURL(blob);
        show(box, 'block');
    }

    // ── Timer helpers ────────────────────────────────────────────────────────
    function startTimer() {
        stopTimer();
        srTimerInterval = setInterval(() => {
            srElapsedSec++;
            const el = $('sr-timer');
            if (el) el.textContent = fmtTime(srElapsedSec);
        }, 1000);
    }

    function stopTimer() {
        if (srTimerInterval) clearInterval(srTimerInterval);
        srTimerInterval = null;
    }

    // ── Status display ───────────────────────────────────────────────────────
    function setStatus(msg, type) {
        const el = $('sr-status-text');
        if (!el) return;
        el.textContent = msg;
        el.className   = 'sr-status sr-status--' + (type || 'idle');
    }

    // ── Update pause button label ────────────────────────────────────────────
    function updatePauseBtn() {
        const btn = $('sr-pause-btn');
        if (!btn) return;
        btn.innerHTML = srPaused ? '&#9654; রেজিউম' : '&#9208; পজ';
    }

    // ── Reset UI to idle state ───────────────────────────────────────────────
    function resetUI() {
        const startBtn   = $('sr-start-btn');
        const stopBtn    = $('sr-stop-btn');
        const pauseBtn   = $('sr-pause-btn');
        const previewBtn = $('sr-preview-btn');
        const recBadge   = $('sr-rec-badge');

        if (startBtn)   { startBtn.disabled = false; show(startBtn, 'inline-flex'); }
        if (stopBtn)    { stopBtn.disabled  = true;  hide(stopBtn);  }
        if (pauseBtn)   { pauseBtn.disabled = true;  hide(pauseBtn); }
        if (previewBtn) { previewBtn.disabled = false; previewBtn.innerHTML = '&#9654; লাইভ প্রিভিউ দেখুন'; }
        hide(recBadge);

        const timerEl = $('sr-timer');
        if (timerEl) timerEl.textContent = '00:00';

        // Re-display thumbnail
        const thumbImg = $('sr-preview-thumb');
        const videoEl  = $('sr-preview-video');
        if (thumbImg && srSelectedThumb) {
            show(thumbImg, 'block');
            hide(videoEl);
        }
    }

    // ── Wire up UI events ────────────────────────────────────────────────────
    function attachEvents() {
        if (eventsAttached) return;
        eventsAttached = true;

        const startBtn   = $('sr-start-btn');
        const stopBtn    = $('sr-stop-btn');
        const pauseBtn   = $('sr-pause-btn');
        const refreshBtn = $('sr-refresh-sources');
        const previewBtn = $('sr-preview-btn');

        if (startBtn)   startBtn.addEventListener('click',   startCountdown);
        if (stopBtn)    stopBtn.addEventListener('click',    stopRecording);
        if (pauseBtn)   pauseBtn.addEventListener('click',   togglePause);
        if (refreshBtn) refreshBtn.addEventListener('click', loadSources);
        if (previewBtn) previewBtn.addEventListener('click', toggleLivePreview);

        // "Import into Editor" button
        const importBtn = $('sr-import-btn');
        if (importBtn) {
            importBtn.addEventListener('click', () => {
                const pathEl = $('sr-success-path');
                if (!pathEl || !pathEl.textContent) return;
                const filePath = pathEl.textContent;
                window.dispatchEvent(new CustomEvent('screen-recorder-import', { detail: { filePath } }));
                const step1 = document.querySelector('[data-step="1"]');
                if (step1) step1.click();
            });
        }
    }

    // ── Public init ──────────────────────────────────────────────────────────
    window.initScreenRecorder = function () {
        attachEvents();
        resetUI();
        loadSources();
        setStatus('একটি স্ক্রিন বা উইন্ডো বেছে নিয়ে "রেকর্ড শুরু করুন" বোতাম চাপুন।', 'idle');
    };

    // Auto-init when document is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            attachEvents();
        });
    } else {
        attachEvents();
    }

    // Refresh sources whenever the screen recorder panel is opened
    document.addEventListener('step-changed', (e) => {
        if (e && e.detail && e.detail.step === 6) {
            loadSources();
        }
    });

})();
