/* ==========================================================================
   Studio Flow — Color Scopes (Phase 11)
   Adds a lightweight Waveform (luma) + RGB Histogram monitor inside the
   Advanced Color Grading panel, so color decisions can be made by looking
   at real pixel data instead of guessing from the preview alone.

   Perf notes (this app targets low-spec hardware, e.g. i5-8350U / 8GB RAM):
   - We never read the full-resolution canvas. The main preview canvas is
     first downscaled onto a tiny offscreen canvas (128x72), and all
     analysis runs on that tiny frame. That keeps getImageData() cheap
     regardless of the source video's resolution.
   - The scope only updates while the color-grade panel is open, on a
     ~300ms throttle (not every animation frame) — good enough for a
     monitoring tool, and it costs ~0 CPU when the panel is closed.
   ========================================================================== */
(function () {
    'use strict';

    var UPDATE_INTERVAL_MS = 300;
    var SAMPLE_W = 128;
    var SAMPLE_H = 72;

    var sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = SAMPLE_W;
    sampleCanvas.height = SAMPLE_H;
    var sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });

    var waveformCanvas, waveformCtx, histogramCanvas, histogramCtx;
    var toggleCheckbox, panelEl;
    var timerId = null;

    function init() {
        waveformCanvas = document.getElementById('scope-waveform-canvas');
        histogramCanvas = document.getElementById('scope-histogram-canvas');
        toggleCheckbox = document.getElementById('color-grade-toggle');
        panelEl = document.getElementById('color-grade-container');

        if (!waveformCanvas || !histogramCanvas || !toggleCheckbox || !panelEl) {
            // Markup not present in this build — nothing to do.
            return;
        }

        waveformCtx = waveformCanvas.getContext('2d');
        histogramCtx = histogramCanvas.getContext('2d');

        toggleCheckbox.addEventListener('change', function () {
            // The existing app logic shows/hides #color-grade-container on
            // this same toggle; we just react to the same event a tick later
            // so panelEl.style.display is already updated.
            setTimeout(syncLoopState, 0);
        });

        // In case the panel is already open on load (e.g. restored project).
        syncLoopState();
    }

    function syncLoopState() {
        var isOpen = panelEl && panelEl.style.display !== 'none';
        if (isOpen && !timerId) {
            timerId = setInterval(updateScopes, UPDATE_INTERVAL_MS);
            updateScopes();
        } else if (!isOpen && timerId) {
            clearInterval(timerId);
            timerId = null;
        }
    }

    function getSourceCanvas() {
        return (window.VideoEditor && window.VideoEditor.canvas) || null;
    }

    function updateScopes() {
        var source = getSourceCanvas();
        if (!source || !source.width || !source.height) return;

        try {
            sampleCtx.clearRect(0, 0, SAMPLE_W, SAMPLE_H);
            sampleCtx.drawImage(source, 0, 0, SAMPLE_W, SAMPLE_H);
            var frame = sampleCtx.getImageData(0, 0, SAMPLE_W, SAMPLE_H);
        } catch (e) {
            // Cross-origin or not-yet-ready canvas — skip this tick silently.
            return;
        }

        drawWaveform(frame);
        drawHistogram(frame);
    }

    function drawWaveform(frame) {
        var w = waveformCanvas.width, h = waveformCanvas.height;
        waveformCtx.fillStyle = '#000';
        waveformCtx.fillRect(0, 0, w, h);

        var data = frame.data;
        var colW = w / SAMPLE_W;

        waveformCtx.fillStyle = 'rgba(180, 255, 180, 0.55)';
        for (var x = 0; x < SAMPLE_W; x++) {
            for (var y = 0; y < SAMPLE_H; y++) {
                var i = (y * SAMPLE_W + x) * 4;
                var luma = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
                var plotY = h - (luma / 255) * h;
                waveformCtx.fillRect(x * colW, plotY, Math.max(1, colW), 1.5);
            }
        }
    }

    function drawHistogram(frame) {
        var w = histogramCanvas.width, h = histogramCanvas.height;
        histogramCtx.fillStyle = '#000';
        histogramCtx.fillRect(0, 0, w, h);

        var BINS = 64;
        var r = new Array(BINS).fill(0);
        var g = new Array(BINS).fill(0);
        var b = new Array(BINS).fill(0);
        var data = frame.data;
        var total = SAMPLE_W * SAMPLE_H;

        for (var p = 0; p < total; p++) {
            var i = p * 4;
            r[Math.min(BINS - 1, data[i] >> 2)]++;
            g[Math.min(BINS - 1, data[i + 1] >> 2)]++;
            b[Math.min(BINS - 1, data[i + 2] >> 2)]++;
        }

        var maxVal = 1;
        for (var k = 0; k < BINS; k++) {
            maxVal = Math.max(maxVal, r[k], g[k], b[k]);
        }

        histogramCtx.globalCompositeOperation = 'lighter';
        plotChannel(r, '#ef4444');
        plotChannel(g, '#22c55e');
        plotChannel(b, '#3b82f6');
        histogramCtx.globalCompositeOperation = 'source-over';

        function plotChannel(bins, color) {
            var barW = w / BINS;
            histogramCtx.fillStyle = color;
            histogramCtx.globalAlpha = 0.75;
            for (var idx = 0; idx < BINS; idx++) {
                var barH = (bins[idx] / maxVal) * h;
                histogramCtx.fillRect(idx * barW, h - barH, Math.max(1, barW - 0.5), barH);
            }
            histogramCtx.globalAlpha = 1;
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
