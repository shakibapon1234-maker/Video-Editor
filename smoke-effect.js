/* ==========================================================================
   Studio Flow — Realistic Smoke & Fog Particle Engine (Phase 13)

   Real-time organic smoke, fog, and mist particle generator.
   Provides deterministic frame-by-frame rendering for both live preview
   and frame-accurate MP4 video export via ffmpeg.wasm.
   ========================================================================== */
(function () {
    'use strict';

    var puffTextureCache = {};

    function hexToRgb(hex) {
        if (!hex) return null;
        hex = hex.replace('#', '');
        if (hex.length === 3) {
            hex = hex.split('').map(function (c) { return c + c; }).join('');
        }
        if (hex.length !== 6) return null;
        var num = parseInt(hex, 16);
        return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
    }

    function pseudoRandom(seed) {
        var x = Math.sin(seed * 9999 + 123.456) * 10000;
        return x - Math.floor(x);
    }

    // Generates a wispy, multi-layered organic smoke puff with soft noise edges
    function getSmokePuffTexture(colorHex, variant) {
        var key = (colorHex || '#e2e8f0') + '_v' + (variant || 0);
        if (puffTextureCache[key]) return puffTextureCache[key];

        var size = 256;
        var cv = document.createElement('canvas');
        cv.width = size;
        cv.height = size;
        var ctx = cv.getContext('2d');

        var rgb = hexToRgb(colorHex) || { r: 180, g: 190, b: 210 };
        var cx = size / 2;
        var cy = size / 2;
        var v = variant || 0;

        // Wispy tendril blobs — lower alpha for realistic translucency
        var blobs = [
            { x: cx, cy: cy, r: size * 0.32, a: 0.14 },
            { x: cx - size * 0.14, cy: cy - size * 0.10, r: size * 0.22, a: 0.10 },
            { x: cx + size * 0.16, cy: cy - size * 0.08, r: size * 0.20, a: 0.09 },
            { x: cx - size * 0.12, cy: cy + size * 0.14, r: size * 0.18, a: 0.08 },
            { x: cx + size * 0.10, cy: cy + size * 0.16, r: size * 0.19, a: 0.09 },
            { x: cx + size * (0.05 + v * 0.04), cy: cy - size * 0.20, r: size * 0.15, a: 0.07 },
            { x: cx - size * 0.18, cy: cy + size * 0.04, r: size * 0.16, a: 0.07 }
        ];

        blobs.forEach(function (b) {
            var grad = ctx.createRadialGradient(b.x, b.cy, 0, b.x, b.cy, b.r);
            grad.addColorStop(0, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + b.a + ')');
            grad.addColorStop(0.25, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + (b.a * 0.65) + ')');
            grad.addColorStop(0.55, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + (b.a * 0.25) + ')');
            grad.addColorStop(0.85, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + (b.a * 0.06) + ')');
            grad.addColorStop(1, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ', 0)');

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(b.x, b.cy, b.r, 0, Math.PI * 2);
            ctx.fill();
        });

        // Add fine wispy noise dots for texture
        for (var n = 0; n < 40; n++) {
            var nx = cx + (pseudoRandom(n * 3.7 + v * 11) - 0.5) * size * 0.55;
            var ny = cy + (pseudoRandom(n * 5.1 + v * 7) - 0.5) * size * 0.55;
            var nr = size * (0.02 + pseudoRandom(n * 2.3) * 0.06);
            var na = 0.03 + pseudoRandom(n * 4.1) * 0.06;
            var grad2 = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
            grad2.addColorStop(0, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + na + ')');
            grad2.addColorStop(1, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ', 0)');
            ctx.fillStyle = grad2;
            ctx.beginPath();
            ctx.arc(nx, ny, nr, 0, Math.PI * 2);
            ctx.fill();
        }

        puffTextureCache[key] = cv;
        return cv;
    }

    var PRESETS = {
        smoke: {
            color: '#b8c4d0',
            density: 22,
            speed: 0.7,
            direction: -90,
            opacity: 38,
            blendMode: 'screen',
            puffScale: 1.0
        },
        fog: {
            color: '#a8b4c4',
            density: 28,
            speed: 0.25,
            direction: 0,
            opacity: 32,
            blendMode: 'screen',
            puffScale: 1.5
        },
        mystic: {
            color: '#a855f7',
            density: 20,
            speed: 0.8,
            direction: -45,
            opacity: 40,
            blendMode: 'lighter',
            puffScale: 1.1
        },
        dark_smoke: {
            color: '#475569',
            density: 24,
            speed: 0.7,
            direction: -90,
            opacity: 45,
            blendMode: 'source-over',
            puffScale: 1.0
        },
        golden_mist: {
            color: '#eab308',
            density: 18,
            speed: 0.5,
            direction: -60,
            opacity: 35,
            blendMode: 'lighter',
            puffScale: 1.2
        }
    };

    var SmokeEffectEngine = {
        presets: PRESETS,

        getOptions: function (custom) {
            return Object.assign({
                enabled: false,
                preset: 'smoke',
                color: '#b8c4d0',
                density: 22,
                speed: 0.7,
                direction: -90,
                opacity: 38,
                blendMode: 'screen'
            }, custom || {});
        },

        renderFrame: function (ctx, width, height, time, options) {
            if (!ctx || !options || !options.enabled) return;

            var opts = this.getOptions(options);
            var density = Math.max(6, Math.min(60, Number(opts.density) || 22));
            var speedMult = Math.max(0.1, Math.min(4.0, Number(opts.speed) || 0.7));
            var globalOpacity = Math.max(0, Math.min(100, Number(opts.opacity) || 38)) / 100;
            var dirRad = ((Number(opts.direction) || -90) * Math.PI) / 180;
            var color = opts.color || '#b8c4d0';
            var blendMode = opts.blendMode || 'screen';

            var dirX = Math.cos(dirRad);
            var dirY = Math.sin(dirRad);
            var baseSize = Math.max(width, height) * 0.22 * (opts.puffScale || 1.0);

            ctx.save();
            ctx.globalCompositeOperation = blendMode;

            for (var i = 0; i < density; i++) {
                var randSeed = i * 23.17 + 7.41;
                var lifeSpan = 6.0 + pseudoRandom(randSeed + 1) * 5.0;
                var phaseOffset = pseudoRandom(randSeed + 2) * lifeSpan;
                var totalTime = (time || 0) * speedMult + phaseOffset;

                var lifeProgress = (totalTime % lifeSpan) / lifeSpan;
                var cycleCount = Math.floor(totalTime / lifeSpan);

                // Spawn from bottom/sides with slight randomness
                var origX = (pseudoRandom(randSeed + cycleCount * 7 + 3) * 1.3 - 0.15) * width;
                var origY = height * 0.78 + (pseudoRandom(randSeed + cycleCount * 7 + 5) * height * 0.28);

                var travelDist = (80 + pseudoRandom(randSeed + 4) * 180) * lifeProgress * speedMult;

                // Multi-frequency turbulence for organic swirl
                var turbX = Math.sin(totalTime * 0.8 + randSeed) * 40 * lifeProgress
                    + Math.sin(totalTime * 2.1 + randSeed * 0.7) * 18 * lifeProgress;
                var turbY = Math.cos(totalTime * 0.6 + randSeed * 1.5) * 25 * lifeProgress
                    + Math.cos(totalTime * 1.7 + randSeed * 1.2) * 12 * lifeProgress;

                var px = origX + dirX * travelDist + turbX;
                var py = origY + dirY * travelDist + turbY;

                var rotAngle = (pseudoRandom(randSeed + 8) * 360 + totalTime * 12) * (Math.PI / 180);

                // Particles grow as they rise, then dissipate
                var sizeGrowth = 0.35 + lifeProgress * 1.6 + pseudoRandom(randSeed + 6) * 0.3;
                var pSize = baseSize * sizeGrowth;

                // Smooth fade in/out — longer fade-out for wispy dissipation
                var alpha = 1.0;
                if (lifeProgress < 0.15) {
                    alpha = lifeProgress / 0.15;
                } else if (lifeProgress > 0.55) {
                    alpha = Math.pow((1.0 - lifeProgress) / 0.45, 1.4);
                }
                alpha *= globalOpacity * (0.25 + pseudoRandom(randSeed + 9) * 0.35);

                if (alpha <= 0.003) continue;

                // Slight per-particle color tint variation
                var tintShift = (pseudoRandom(randSeed + 10) - 0.5) * 20;
                var rgb = hexToRgb(color) || { r: 184, g: 196, b: 208 };
                var tintColor = 'rgb(' +
                    Math.max(0, Math.min(255, rgb.r + tintShift)) + ',' +
                    Math.max(0, Math.min(255, rgb.g + tintShift)) + ',' +
                    Math.max(0, Math.min(255, rgb.b + tintShift)) + ')';

                var texVariant = Math.floor(pseudoRandom(randSeed + 11) * 3);
                var puffTex = getSmokePuffTexture(tintColor, texVariant);

                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.translate(px, py);
                ctx.rotate(rotAngle);
                ctx.drawImage(puffTex, -pSize / 2, -pSize / 2, pSize, pSize);
                ctx.restore();
            }

            ctx.restore();
        }
    };

    window.SmokeEffectEngine = SmokeEffectEngine;
})();
