/* ==========================================================================
   Studio Flow — Realistic Smoke & Fog Particle Engine (Phase 13)

   Real-time organic smoke, fog, and mist particle generator.
   Provides deterministic frame-by-frame rendering for both live preview
   and frame-accurate MP4 video export via ffmpeg.wasm.
   ========================================================================== */
(function () {
    'use strict';

    var puffTextureCache = {};

    // Generates a multi-lobed organic wispy smoke puff texture
    function getSmokePuffTexture(colorHex) {
        var key = colorHex || '#e2e8f0';
        if (puffTextureCache[key]) return puffTextureCache[key];

        var size = 256;
        var cv = document.createElement('canvas');
        cv.width = size;
        cv.height = size;
        var ctx = cv.getContext('2d');

        var rgb = hexToRgb(colorHex) || { r: 226, g: 232, b: 240 };
        var cx = size / 2;
        var cy = size / 2;

        // Draw multiple overlapping soft cloud blobs to form an organic puff
        var blobs = [
            { x: cx, cy: cy, r: size * 0.35, a: 0.35 },
            { x: cx - size * 0.12, cy: cy - size * 0.08, r: size * 0.28, a: 0.25 },
            { x: cx + size * 0.14, cy: cy - size * 0.10, r: size * 0.26, a: 0.22 },
            { x: cx - size * 0.10, cy: cy + size * 0.12, r: size * 0.24, a: 0.20 },
            { x: cx + size * 0.10, cy: cy + size * 0.14, r: size * 0.25, a: 0.22 }
        ];

        blobs.forEach(function (b) {
            var grad = ctx.createRadialGradient(b.x, b.cy, 0, b.x, b.cy, b.r);
            grad.addColorStop(0, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + b.a + ')');
            grad.addColorStop(0.4, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + (b.a * 0.5) + ')');
            grad.addColorStop(0.8, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + (b.a * 0.12) + ')');
            grad.addColorStop(1, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ', 0)');

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(b.x, b.cy, b.r, 0, Math.PI * 2);
            ctx.fill();
        });

        puffTextureCache[key] = cv;
        return cv;
    }

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

    var PRESETS = {
        smoke: {
            color: '#e2e8f0',
            density: 28,
            speed: 0.8,
            direction: -90, // Upward flow
            opacity: 50,
            blendMode: 'screen',
            puffScale: 1.1
        },
        fog: {
            color: '#cbd5e1',
            density: 35,
            speed: 0.3,
            direction: 0, // Horizontal flow
            opacity: 45,
            blendMode: 'screen',
            puffScale: 1.8
        },
        mystic: {
            color: '#c084fc',
            density: 30,
            speed: 1.0,
            direction: -45,
            opacity: 55,
            blendMode: 'lighter',
            puffScale: 1.3
        },
        dark_smoke: {
            color: '#334155',
            density: 32,
            speed: 0.9,
            direction: -90,
            opacity: 60,
            blendMode: 'source-over',
            puffScale: 1.2
        },
        golden_mist: {
            color: '#fde047',
            density: 25,
            speed: 0.6,
            direction: -60,
            opacity: 45,
            blendMode: 'lighter',
            puffScale: 1.5
        }
    };

    var SmokeEffectEngine = {
        presets: PRESETS,

        getOptions: function (custom) {
            var opts = Object.assign({
                enabled: false,
                preset: 'smoke',
                color: '#e2e8f0',
                density: 28,
                speed: 0.8,
                direction: -90,
                opacity: 50,
                blendMode: 'screen'
            }, custom || {});

            return opts;
        },

        renderFrame: function (ctx, width, height, time, options) {
            if (!ctx || !options || !options.enabled) return;

            var opts = this.getOptions(options);
            var density = Math.max(8, Math.min(80, Number(opts.density) || 28));
            var speedMult = Math.max(0.1, Math.min(4.0, Number(opts.speed) || 0.8));
            var globalOpacity = Math.max(0, Math.min(100, Number(opts.opacity) || 50)) / 100;
            var dirRad = ((Number(opts.direction) || -90) * Math.PI) / 180;
            var color = opts.color || '#e2e8f0';
            var blendMode = opts.blendMode || 'screen';

            var dirX = Math.cos(dirRad);
            var dirY = Math.sin(dirRad);

            ctx.save();
            ctx.globalCompositeOperation = blendMode;

            var puffTex = getSmokePuffTexture(color);
            var baseSize = Math.max(width, height) * 0.28 * (opts.puffScale || 1.2);

            for (var i = 0; i < density; i++) {
                var randSeed = i * 23.17 + 7.41;
                var lifeSpan = 5.0 + pseudoRandom(randSeed + 1) * 4.0; // 5 to 9 sec lifetime
                var phaseOffset = pseudoRandom(randSeed + 2) * lifeSpan;
                var totalTime = (time || 0) * speedMult + phaseOffset;

                var lifeProgress = (totalTime % lifeSpan) / lifeSpan; // 0 to 1
                var cycleCount = Math.floor(totalTime / lifeSpan);

                // Disperse origin across bottom/sides
                var origX = (pseudoRandom(randSeed + cycleCount * 7 + 3) * 1.2 - 0.1) * width;
                var origY = height * 0.75 + (pseudoRandom(randSeed + cycleCount * 7 + 5) * height * 0.35);

                var travelDist = (120 + pseudoRandom(randSeed + 4) * 220) * lifeProgress * speedMult;
                var turbulenceX = Math.sin(totalTime * 1.2 + randSeed) * 50 * lifeProgress;
                var turbulenceY = Math.cos(totalTime * 0.9 + randSeed * 1.5) * 30 * lifeProgress;

                var px = origX + dirX * travelDist + turbulenceX;
                var py = origY + dirY * travelDist + turbulenceY;

                // Slow rotation of smoke puff for realistic swirl
                var rotAngle = (pseudoRandom(randSeed + 8) * 360 + totalTime * 15) * (Math.PI / 180);
                var pSize = baseSize * (0.5 + lifeProgress * 1.4 + pseudoRandom(randSeed + 6) * 0.4);

                // Smooth fade in and out curve
                var alpha = 1.0;
                if (lifeProgress < 0.2) {
                    alpha = lifeProgress / 0.2;
                } else if (lifeProgress > 0.65) {
                    alpha = (1.0 - lifeProgress) / 0.35;
                }
                alpha *= globalOpacity * (0.35 + pseudoRandom(randSeed + 9) * 0.45);

                if (alpha <= 0.005) continue;

                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.translate(px, py);
                ctx.rotate(rotAngle);
                ctx.drawImage(
                    puffTex,
                    -pSize / 2,
                    -pSize / 2,
                    pSize,
                    pSize
                );
                ctx.restore();
            }

            ctx.restore();
        }
    };

    window.SmokeEffectEngine = SmokeEffectEngine;
})();
