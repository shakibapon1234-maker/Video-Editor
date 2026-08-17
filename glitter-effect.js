/* ==========================================================================
   Studio Flow — High Performance Golden Glitter & Confetti Rain Engine (Phase 13)

   Ultra-optimized particle system for birthday party sparkles and confetti.
   Uses lightweight direct 2D rendering without expensive shadowBlur filters.
   ========================================================================== */
(function () {
    'use strict';

    function pseudoRandom(seed) {
        var x = Math.sin(seed * 8888 + 456.789) * 10000;
        return x - Math.floor(x);
    }

    var PRESETS = {
        golden_rain: {
            density: 50,
            speed: 1.0,
            size: 1.1,
            opacity: 85,
            style: 'mixed'
        },
        sparkle_stars: {
            density: 40,
            speed: 0.75,
            size: 1.3,
            opacity: 90,
            style: 'stars'
        },
        confetti: {
            density: 55,
            speed: 1.2,
            size: 1.0,
            opacity: 85,
            style: 'confetti'
        },
        soft_dust: {
            density: 65,
            speed: 0.5,
            size: 0.75,
            opacity: 70,
            style: 'dust'
        }
    };

    var GOLD_PALETTE = ['#fef08a', '#fde047', '#fbbf24', '#f59e0b', '#ffffff', '#fef9c3', '#fcd34d'];

    function drawStar(ctx, size, color) {
        ctx.beginPath();
        for (var s = 0; s < 4; s++) {
            var ang = (s * Math.PI) / 2;
            var rx1 = Math.cos(ang) * size;
            var ry1 = Math.sin(ang) * size;
            var angMid = ang + Math.PI / 4;
            var rx2 = Math.cos(angMid) * (size * 0.30);
            var ry2 = Math.sin(angMid) * (size * 0.30);
            if (s === 0) ctx.moveTo(rx1, ry1);
            else ctx.lineTo(rx1, ry1);
            ctx.lineTo(rx2, ry2);
        }
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();

        // High-speed glowing center
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.28, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawConfetti(ctx, w, h, rot, color) {
        ctx.save();
        ctx.rotate(rot);
        ctx.scale(Math.cos(rot * 1.4), 1); // 3D flutter tumble
        ctx.fillStyle = color;
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.restore();
    }

    function drawDust(ctx, r, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
        ctx.fill();
    }

    var GlitterEffectEngine = {
        presets: PRESETS,

        getOptions: function (custom) {
            return Object.assign({
                enabled: false,
                preset: 'golden_rain',
                density: 50,
                speed: 1.0,
                size: 1.1,
                opacity: 85,
                style: 'mixed'
            }, custom || {});
        },

        renderFrame: function (ctx, width, height, time, options) {
            if (!ctx || !options || !options.enabled) return;

            var opts = this.getOptions(options);
            var density = Math.max(8, Math.min(90, Number(opts.density) || 50));
            var speedMult = Math.max(0.2, Math.min(3.0, Number(opts.speed) || 1.0));
            var sizeMult = Math.max(0.3, Math.min(2.5, Number(opts.size) || 1.1));
            var globalOpacity = Math.max(0, Math.min(100, Number(opts.opacity) || 85)) / 100;
            var style = opts.style || 'mixed';

            ctx.save();
            ctx.globalCompositeOperation = 'lighter';

            for (var i = 0; i < density; i++) {
                var seed = i * 17.31 + 3.14;
                var lifeSpan = 3.5 + pseudoRandom(seed + 1) * 3.5;
                var phaseOffset = pseudoRandom(seed + 2) * lifeSpan;
                var totalTime = (time || 0) * speedMult + phaseOffset;

                var lifeProgress = (totalTime % lifeSpan) / lifeSpan;
                var cycleCount = Math.floor(totalTime / lifeSpan);

                var startX = (pseudoRandom(seed + cycleCount * 5 + 3) * 1.2 - 0.1) * width;
                var startY = -30 - pseudoRandom(seed + cycleCount * 5 + 4) * 60;

                var totalFallDist = height * (1.25 + pseudoRandom(seed + 4) * 0.30);
                var fallDist = totalFallDist * lifeProgress * speedMult;

                var swayX = Math.sin(totalTime * 2.0 + seed) * (width * 0.03);
                var swayY = Math.cos(totalTime * 1.2 + seed * 1.3) * (height * 0.01);

                var px = startX + swayX;
                var py = startY + fallDist + swayY;

                if (py < -40 || py > height + 40 || px < -40 || px > width + 40) continue;

                var alpha = 1.0;
                if (lifeProgress < 0.12) {
                    alpha = lifeProgress / 0.12;
                } else if (lifeProgress > 0.82) {
                    alpha = Math.max(0, (1.0 - lifeProgress) / 0.18);
                }

                var twinkle = 0.60 + 0.40 * Math.sin(totalTime * 6.0 + seed * 3.7);
                alpha *= globalOpacity * twinkle * (0.65 + pseudoRandom(seed + 9) * 0.35);

                if (alpha <= 0.01) continue;

                var particleStyle = style;
                if (style === 'mixed') {
                    var stylePick = pseudoRandom(seed + 10);
                    if (stylePick < 0.40) particleStyle = 'stars';
                    else if (stylePick < 0.75) particleStyle = 'confetti';
                    else particleStyle = 'dust';
                }

                var colorIdx = Math.floor(pseudoRandom(seed + 11) * GOLD_PALETTE.length);
                var color = GOLD_PALETTE[colorIdx];
                var particleSize = Math.max(width, height) * 0.015 * sizeMult * (0.75 + pseudoRandom(seed + 12) * 0.5);

                ctx.save();
                ctx.globalAlpha = Math.min(1.0, alpha);
                ctx.translate(px, py);

                if (particleStyle === 'stars') {
                    var starSize = particleSize * (1.1 + pseudoRandom(seed + 13) * 0.4);
                    var starRot = (pseudoRandom(seed + 14) * 360 + totalTime * 50) * (Math.PI / 180);
                    ctx.rotate(starRot);
                    drawStar(ctx, starSize, color);
                } else if (particleStyle === 'confetti') {
                    var cw = particleSize * (1.0 + pseudoRandom(seed + 15) * 0.5);
                    var ch = cw * (0.45 + pseudoRandom(seed + 16) * 0.3);
                    var confRot = (pseudoRandom(seed + 17) * 360 + totalTime * 120) * (Math.PI / 180);
                    drawConfetti(ctx, cw, ch, confRot, color);
                } else {
                    var dustR = particleSize * (0.85 + pseudoRandom(seed + 18) * 0.5);
                    drawDust(ctx, dustR, color);
                }

                ctx.restore();
            }

            ctx.restore();
        }
    };

    window.GlitterEffectEngine = GlitterEffectEngine;
})();
