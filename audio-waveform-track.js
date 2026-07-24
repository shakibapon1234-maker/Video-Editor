/* ==========================================================================
   Studio Flow — Audio Waveform Track (Phase 12)

   Draws a small waveform strip directly under the main seek bar/playhead so
   the audio can be seen (and clicked to seek) while trimming/cutting video —
   no more lining up cuts with the sound purely by ear.

   Design notes:
   - Self-contained: reads window.VideoEditor (the shared editor state) and
     a couple of already-global helpers (redrawPausedFrameGlobal), but does
     not assume anything else about editor.js's internals.
   - Decoding an audio track is somewhat expensive, so each clip's peak data
     is decoded once and cached on the clip object (`clip._waveformPeaks`),
     the same way editor.js already caches other per-clip derived data.
   - Clips with no audio track (or that fail to decode) are remembered via
     `clip._waveformNoAudio` so we don't retry decoding them every time the
     user switches back to them.
   - A "decode token" guards against a slow decode finishing after the user
     has already switched to a different clip.
   ========================================================================== */
(function () {
    'use strict';

    var MAX_BUCKETS = 800; // resolution cap; the strip is a fixed-height canvas so this is plenty

    var wrapperEl, canvas, ctx, playheadEl, trimFillEl, emptyLabelEl, seekSliderEl;
    var sharedAudioCtx = null;
    var decodeToken = 0;
    var resizeTimer = null;

    function init() {
        wrapperEl = document.getElementById('audio-waveform-wrapper');
        canvas = document.getElementById('audio-waveform-canvas');
        playheadEl = document.getElementById('waveform-playhead-indicator');
        trimFillEl = document.getElementById('waveform-trim-fill');
        emptyLabelEl = document.getElementById('waveform-empty-label');
        seekSliderEl = document.getElementById('seek-slider');

        if (!wrapperEl || !canvas) return; // markup not present in this build — nothing to do

        ctx = canvas.getContext('2d');

        wrapperEl.addEventListener('click', onWaveformClick);
        window.addEventListener('resize', function () {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(redrawCached, 200);
        });

        // Exposed for editor.js to call at the right moments.
        window.refreshAudioWaveform = refreshAudioWaveform;
        window.updateWaveformPlayhead = updateWaveformPlayhead;
    }

    function getState() {
        return window.VideoEditor;
    }

    function getActiveClip(state) {
        if (!state || !state.clips) return null;
        return state.clips.find(function (c) { return c.id === state.activeClipId; }) || null;
    }

    // Clicking/tapping anywhere on the strip seeks there — mirrors how the
    // seek slider above it behaves, so the two feel like one control.
    function onWaveformClick(e) {
        var state = getState();
        if (!state || !state.duration) return;

        var rect = wrapperEl.getBoundingClientRect();
        var clientX = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
        var ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        var val = ratio * state.duration;

        if (seekSliderEl) {
            seekSliderEl.value = val;
            seekSliderEl.dispatchEvent(new Event('input'));
        }

        var activeClip = getActiveClip(state);
        if (activeClip && activeClip.type === 'image') {
            state.currentTime = val;
            if (window.redrawPausedFrameGlobal) window.redrawPausedFrameGlobal();
        } else if (state.video) {
            state.video.currentTime = val;
        }
    }

    // Cheap per-frame sync of the playhead line + trim shading (no decoding/redraw of bars).
    function updateWaveformPlayhead() {
        if (!wrapperEl || wrapperEl.offsetParent === null) return;
        var state = getState();
        if (!state || !state.duration) return;

        var percent = Math.max(0, Math.min(100, (state.currentTime / state.duration) * 100));
        if (playheadEl) playheadEl.style.left = percent + '%';

        if (trimFillEl) {
            var startPercent = (state.startTime / state.duration) * 100;
            var endPercent = (state.endTime / state.duration) * 100;
            trimFillEl.style.left = Math.max(0, startPercent) + '%';
            trimFillEl.style.width = Math.max(0, endPercent - startPercent) + '%';
        }
    }

    function showEmpty(message) {
        if (canvas) canvas.style.visibility = 'hidden';
        if (emptyLabelEl) {
            emptyLabelEl.innerText = message;
            emptyLabelEl.style.display = 'flex';
        }
    }

    function showCanvas() {
        if (canvas) canvas.style.visibility = 'visible';
        if (emptyLabelEl) emptyLabelEl.style.display = 'none';
    }

    function getAudioCtx() {
        if (!sharedAudioCtx) {
            var Ctor = window.AudioContext || window.webkitAudioContext;
            sharedAudioCtx = new Ctor();
        }
        return sharedAudioCtx;
    }

    // Decode a clip's audio into per-bucket min/max peaks (downsampled once, cached on the clip).
    function computePeaks(arrayBuffer) {
        return getAudioCtx().decodeAudioData(arrayBuffer.slice(0)).then(function (audioBuffer) {
            var channelData = audioBuffer.getChannelData(0);
            var totalSamples = channelData.length;
            var buckets = Math.min(MAX_BUCKETS, Math.max(50, Math.floor(totalSamples / 200) || 50));
            var bucketSize = Math.max(1, Math.floor(totalSamples / buckets));
            var peaks = new Array(buckets);

            for (var b = 0; b < buckets; b++) {
                var start = b * bucketSize;
                var end = Math.min(start + bucketSize, totalSamples);
                var min = 1, max = -1;
                for (var i = start; i < end; i++) {
                    var v = channelData[i];
                    if (v < min) min = v;
                    if (v > max) max = v;
                }
                if (end <= start) { min = 0; max = 0; }
                peaks[b] = [min, max];
            }

            return { peaks: peaks, duration: audioBuffer.duration };
        });
    }

    function drawPeaks(peaks) {
        if (!ctx || !canvas) return;

        var dpr = window.devicePixelRatio || 1;
        var cssWidth = wrapperEl.clientWidth || canvas.clientWidth || 300;
        var cssHeight = wrapperEl.clientHeight || 34;
        canvas.width = Math.max(1, Math.round(cssWidth * dpr));
        canvas.height = Math.max(1, Math.round(cssHeight * dpr));
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, cssWidth, cssHeight);

        if (!peaks || !peaks.length) return;

        var mid = cssHeight / 2;
        var barWidth = cssWidth / peaks.length;

        var rootStyle = getComputedStyle(document.documentElement);
        var primaryColor = (rootStyle.getPropertyValue('--primary') || '').trim() || '#10b981';
        ctx.fillStyle = primaryColor;

        for (var i = 0; i < peaks.length; i++) {
            var min = peaks[i][0], max = peaks[i][1];
            var x = i * barWidth;
            var yTop = mid - max * (mid - 2);
            var yBottom = mid - min * (mid - 2);
            var h = Math.max(1, yBottom - yTop);
            ctx.fillRect(x, yTop, Math.max(1, barWidth), h);
        }
    }

    function redrawCached() {
        var state = getState();
        var activeClip = getActiveClip(state);
        if (activeClip && activeClip._waveformPeaks) {
            showCanvas();
            drawPeaks(activeClip._waveformPeaks);
            updateWaveformPlayhead();
        }
    }

    // Main entry point — call whenever the active clip (or its underlying file) changes.
    function refreshAudioWaveform() {
        if (!wrapperEl || !canvas) return;
        var state = getState();
        var activeClip = getActiveClip(state);
        var myToken = ++decodeToken;

        if (!activeClip) {
            showEmpty('');
            return;
        }

        if (activeClip.type === 'image') {
            showEmpty('এই ক্লিপে অডিও নেই (ছবি)');
            updateWaveformPlayhead();
            return;
        }

        if (activeClip._waveformPeaks) {
            showCanvas();
            drawPeaks(activeClip._waveformPeaks);
            updateWaveformPlayhead();
            return;
        }

        if (activeClip._waveformNoAudio) {
            showEmpty('এই ক্লিপে কোনো অডিও ট্র্যাক পাওয়া যায়নি');
            return;
        }

        // Show an empty strip immediately; it fills in once decoding finishes.
        showCanvas();
        drawPeaks(null);

        if (!activeClip.file || typeof activeClip.file.arrayBuffer !== 'function') {
            activeClip._waveformNoAudio = true;
            showEmpty('এই ক্লিপে কোনো অডিও ট্র্যাক পাওয়া যায়নি');
            return;
        }

        activeClip.file.arrayBuffer().then(function (arrayBuffer) {
            return computePeaks(arrayBuffer);
        }).then(function (result) {
            if (myToken !== decodeToken) return; // a newer clip switch already happened — discard
            activeClip._waveformPeaks = result.peaks;
            showCanvas();
            drawPeaks(result.peaks);
            updateWaveformPlayhead();
        }).catch(function (err) {
            console.warn('Waveform decode failed (clip may have no audio track):', err);
            if (myToken !== decodeToken) return;
            activeClip._waveformNoAudio = true;
            showEmpty('এই ক্লিপে কোনো অডিও ট্র্যাক পাওয়া যায়নি');
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
