/* ==========================================================================
   Studio Flow — Ultra-Realistic Smoke & Fog Particle Engine (Phase 13)

   Produces organic, wispy, filament-textured smoke and mystic fog.
   Features 7-blob tendril clusters and multi-scale organic noise dots.
   100% leak-free & bounded static caching ensures silky 60fps performance.
   ========================================================================== */
(function () {
    'use strict';

    function hexToRgb(color) {
        if (!color) return { r: 184, g: 196, b: 208 };
        if (typeof color === 'object' && color.r !== undefined) return color;
        if (typeof color === 'string' && color.indexOf('rgb') !== -1) {
            var m = color.match(/(\d+),\s*(\d+),\s*(\d+)/);
            if (m) return { r: parseInt(m[1]), g: parseInt(m[2]), b: parseInt(m[3]) };
        }
        var hex = String(color).replace('#', '').trim();
        if (hex.length === 3) {
            hex = hex.split('').map(function (c) { return c + c; }).join('');
        }
        if (hex.length !== 6) return { r: 184, g: 196, b: 208 };
        var num = parseInt(hex, 16);
        if (isNaN(num)) return { r: 184, g: 196, b: 208 };
        return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
    }

    function pseudoRandom(seed) {
        var x = Math.sin(seed * 9999 + 123.456) * 10000;
        return x - Math.floor(x);
    }

    var puffCache = {};

    function generateWispyPuffSprite(rgb, variant) {
        var size = 256;
        var cv = document.createElement('canvas');
        cv.width = size;
        cv.height = size;
        var ctx = cv.getContext('2d');
        var cx = size / 2;
        var cy = size / 2;
        var v = variant || 0;

        // Wispy tendril cluster (7 soft organic blobs with realistic falloff)
        var blobs = [
            { x: cx, cy: cy, r: size * 0.38, a: 0.50 },
            { x: cx - size * (0.13 + (v === 1 ? 0.04 : -0.02)), cy: cy - size * (0.09 + v * 0.02), r: size * 0.28, a: 0.38 },
            { x: cx + size * (0.15 - (v === 2 ? 0.04 : 0.01)), cy: cy - size * (0.07 + v * 0.03), r: size * 0.26, a: 0.35 },
            { x: cx - size * 0.11, cy: cy + size * (0.12 + (v === 3 ? 0.04 : 0)), r: size * 0.25, a: 0.33 },
            { x: cx + size * 0.11, cy: cy + size * (0.14 - (v === 0 ? 0.03 : 0)), r: size * 0.26, a: 0.34 },
            { x: cx + size * (0.06 + (v === 1 ? 0.08 : -0.05)), cy: cy - size * 0.19, r: size * 0.23, a: 0.29 },
            { x: cx - size * 0.17, cy: cy + size * 0.03, r: size * 0.22, a: 0.28 }
        ];

        blobs.forEach(function (b) {
            var grad = ctx.createRadialGradient(b.x, b.cy, 0, b.x, b.cy, b.r);
            grad.addColorStop(0, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + b.a + ')');
            grad.addColorStop(0.32, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + (b.a * 0.70) + ')');
            grad.addColorStop(0.62, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + (b.a * 0.32) + ')');
            grad.addColorStop(0.88, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + (b.a * 0.06) + ')');
            grad.addColorStop(1.0, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ', 0)');

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(b.x, b.cy, b.r, 0, Math.PI * 2);
            ctx.fill();
        });

        // 42 fine wispy noise filaments for realistic broken smoke texture
        for (var n = 0; n < 42; n++) {
            var nx = cx + (pseudoRandom(n * 3.7 + v * 13.1) - 0.5) * size * 0.65;
            var ny = cy + (pseudoRandom(n * 5.1 + v * 7.9) - 0.5) * size * 0.65;
            var nr = size * (0.04 + pseudoRandom(n * 2.3) * 0.09);
            var na = 0.08 + pseudoRandom(n * 4.1) * 0.14;
            var grad2 = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
            grad2.addColorStop(0, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + na + ')');
            grad2.addColorStop(0.65, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + (na * 0.35) + ')');
            grad2.addColorStop(1.0, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ', 0)');
            ctx.fillStyle = grad2;
            ctx.beginPath();
            ctx.arc(nx, ny, nr, 0, Math.PI * 2);
            ctx.fill();
        }

        return cv;
    }

    function getPuffSprite(colorHex, variant) {
        var rgb = hexToRgb(colorHex) || { r: 184, g: 196, b: 208 };
        var v = (variant || 0) % 4;
        var normColor = '#' + ((1 << 24) + (rgb.r << 16) + (rgb.g << 8) + rgb.b).toString(16).slice(1);
        var key = normColor + '_v' + v;

        if (puffCache[key]) return puffCache[key];

        // Keep cache strictly bounded
        var keys = Object.keys(puffCache);
        if (keys.length > 28) {
            for (var k = 0; k < 8; k++) delete puffCache[keys[k]];
        }

        var sprite = generateWispyPuffSprite(rgb, v);
        puffCache[key] = sprite;
        return sprite;
    }

    var PRESETS = {
        smoke: {
            color: '#b8c4d0',
            density: 26,
            speed: 0.7,
            direction: -90,
            opacity: 55,
            blendMode: 'screen',
            puffScale: 1.1
        },
        fog: {
            color: '#a8b4c4',
            density: 30,
            speed: 0.35,
            direction: 0,
            opacity: 45,
            blendMode: 'screen',
            puffScale: 1.55
        },
        mystic: {
            color: '#c084fc',
            density: 24,
            speed: 0.8,
            direction: -45,
            opacity: 60,
            blendMode: 'lighter',
            puffScale: 1.2
        },
        dark_smoke: {
            color: '#2d3748',
            density: 28,
            speed: 0.7,
            direction: -90,
            opacity: 75,
            blendMode: 'source-over',
            puffScale: 1.2
        },
        golden_mist: {
            color: '#fbbf24',
            density: 22,
            speed: 0.5,
            direction: -60,
            opacity: 50,
            blendMode: 'lighter',
            puffScale: 1.3
        }
    };

    var SmokeEffectEngine = {
        presets: PRESETS,

        getOptions: function (custom) {
            return Object.assign({
                enabled: false,
                preset: 'smoke',
                color: '#b8c4d0',
                density: 26,
                speed: 0.7,
                direction: -90,
                opacity: 55,
                blendMode: 'screen'
            }, custom || {});
        },

        renderFrame: function (ctx, width, height, time, options) {
            if (!ctx || !options || !options.enabled) return;

            var opts = this.getOptions(options);
            var density = Math.max(6, Math.min(65, Number(opts.density) || 26));
            var speedMult = Math.max(0.1, Math.min(3.5, Number(opts.speed) || 0.7));
            var globalOpacity = Math.max(0, Math.min(100, Number(opts.opacity) || 55)) / 100;
            var dirRad = ((Number(opts.direction) || -90) * Math.PI) / 180;
            var color = opts.color || '#b8c4d0';
            var blendMode = opts.blendMode || 'screen';

            var dirX = Math.cos(dirRad);
            var dirY = Math.sin(dirRad);
            var baseSize = Math.max(width, height) * 0.36 * (opts.puffScale || 1.0);

            // Pre-fetch 4 wispy variants (cached on demand)
            var spr0 = getPuffSprite(color, 0);
            var spr1 = getPuffSprite(color, 1);
            var spr2 = getPuffSprite(color, 2);
            var spr3 = getPuffSprite(color, 3);
            var sprites = [spr0, spr1, spr2, spr3];

            ctx.save();
            ctx.globalCompositeOperation = blendMode;

            for (var i = 0; i < density; i++) {
                var randSeed = i * 23.17 + 7.41;
                var lifeSpan = 5.2 + pseudoRandom(randSeed + 1) * 3.8;
                var phaseOffset = pseudoRandom(randSeed + 2) * lifeSpan;
                var totalTime = (time || 0) * speedMult + phaseOffset;

                var lifeProgress = (totalTime % lifeSpan) / lifeSpan;
                var cycleCount = Math.floor(totalTime / lifeSpan);

                // Organic spawn area (wide bottom with slight side bleed)
                var origX = (pseudoRandom(randSeed + cycleCount * 7 + 3) * 1.35 - 0.18) * width;
                var origY = height * (0.62 + pseudoRandom(randSeed + cycleCount * 7 + 5) * 0.48);

                var travelDist = height * (0.65 + pseudoRandom(randSeed + 4) * 0.60) * lifeProgress * speedMult;

                // Multi-frequency organic turbulence (wispy swirl)
                var turbScale = Math.max(width, height) * 0.05;
                var turbX = Math.sin(totalTime * 0.85 + randSeed) * turbScale * lifeProgress
                    + Math.sin(totalTime * 2.2 + randSeed * 0.7) * (turbScale * 0.40) * lifeProgress;
                var turbY = Math.cos(totalTime * 0.65 + randSeed * 1.5) * (turbScale * 0.55) * lifeProgress
                    + Math.cos(totalTime * 1.8 + randSeed * 1.2) * (turbScale * 0.25) * lifeProgress;

                var px = origX + dirX * travelDist + turbX;
                var py = origY + dirY * travelDist + turbY;

                var rotAngle = (pseudoRandom(randSeed + 8) * 360 + totalTime * 14) * (Math.PI / 180);

                // Particles expand as they rise and diffuse
                var sizeGrowth = 0.48 + lifeProgress * 1.55 + pseudoRandom(randSeed + 6) * 0.28;
                var pSize = baseSize * sizeGrowth;

                // Realistic smooth fade in and soft dissipate
                var alpha = 1.0;
                if (lifeProgress < 0.20) {
                    alpha = lifeProgress / 0.20;
                } else if (lifeProgress > 0.58) {
                    alpha = Math.pow((1.0 - lifeProgress) / 0.42, 1.3);
                }
                alpha *= globalOpacity * (0.65 + pseudoRandom(randSeed + 9) * 0.35);

                if (alpha <= 0.01) continue;

                var sprite = sprites[i % 4];

                ctx.save();
                ctx.globalAlpha = Math.min(1.0, alpha);
                ctx.translate(px, py);
                ctx.rotate(rotAngle);
                ctx.drawImage(sprite, -pSize / 2, -pSize / 2, pSize, pSize);
                ctx.restore();
            }

            ctx.restore();
        }
    };

    window.SmokeEffectEngine = SmokeEffectEngine;
})();
