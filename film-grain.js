/* ==========================================================================
   Studio Flow — Film Grain Overlay (Phase 13)

   Adds a subtle film-grain texture overlay, controlled by
   state.filmGrainIntensity (0-100), independent of filterPreset — combines
   with any preset, vignette, or duotone since it's drawn as its own
   composite pass rather than being part of the CSS filter string.

   PERF NOTE (this app targets low-spec hardware, e.g. i5-8350U / 8GB RAM):
   Generating random per-pixel noise every single animation frame would be
   costly. Instead, a small (128x128) noise tile is generated ONCE (a single
   createImageData/putImageData call at module load), then reused every
   frame via ctx.createPattern(..., 'repeat') — a cheap, GPU-accelerated
   canvas operation. A "flicker" feel (real film grain changes every frame)
   is faked cheaply by shifting the pattern's tile origin each call via
   DOMMatrix, not by regenerating any noise data.
   ========================================================================== */
(function () {
    'use strict';

    var TILE_SIZE = 128;
    var grainCanvas = null;
    var frameCounter = 0;

    function generateGrainTile() {
        var canvas = document.createElement('canvas');
        canvas.width = TILE_SIZE;
        canvas.height = TILE_SIZE;
        var ctx = canvas.getContext('2d');
        var imageData = ctx.createImageData(TILE_SIZE, TILE_SIZE);
        var data = imageData.data;
        for (var i = 0; i < data.length; i += 4) {
            var v = (Math.random() * 255) | 0;
            data[i] = v;
            data[i + 1] = v;
            data[i + 2] = v;
            data[i + 3] = 255;
        }
        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }

    // One-time generation — NOT repeated per frame.
    try {
        grainCanvas = generateGrainTile();
    } catch (err) {
        // Canvas unavailable for some reason — grain overlay silently no-ops.
        grainCanvas = null;
    }

    // Draws the grain overlay onto the given 2D context, covering (0,0,w,h)
    // in the context's current coordinate space. Call this AFTER the main
    // frame (and any vignette/duotone passes) have been drawn, and before
    // ctx state that shouldn't be affected by globalCompositeOperation.
    function drawFilmGrainOverlay(ctx, w, h, intensity) {
        if (!grainCanvas || !ctx) return;
        var amount = Math.max(0, Math.min(100, intensity || 0));
        if (amount <= 0) return;

        // Cap the max opacity so even at 100% the effect stays a subtle
        // texture rather than an overpowering noise wash.
        var alpha = (amount / 100) * 0.35;

        frameCounter++;
        var shiftX = (frameCounter * 7) % TILE_SIZE;
        var shiftY = (frameCounter * 13) % TILE_SIZE;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.globalCompositeOperation = 'overlay';

        var pattern = ctx.createPattern(grainCanvas, 'repeat');
        if (pattern && typeof pattern.setTransform === 'function' && typeof DOMMatrix !== 'undefined') {
            pattern.setTransform(new DOMMatrix().translate(shiftX, shiftY));
        }
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, w, h);

        ctx.restore();
    }

    window.drawFilmGrainOverlay = drawFilmGrainOverlay;
})();
