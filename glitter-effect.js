/* ==========================================================================
   Studio Flow — Golden Glitter & Confetti Rain Engine (Phase 13)

   Birthday-party style golden sparkles and confetti falling from the top.
   Deterministic frame-by-frame rendering for live preview and export.
   ========================================================================== */
(function () {
    'use strict';

    function pseudoRandom(seed) {
        var x = Math.sin(seed * 8888 + 456.789) * 10000;
        return x - Math.floor(x);
    }

    var PRESETS = {
        golden_rain: {
            density: 55,
            speed: 1.0,
            size: 1.0,
            opacity: 75,
            style: 'mixed'
        },
        sparkle_stars: {
            density: 40,
            speed: 0.7,
            size: 1.2,
            opacity: 80,
            style: 'stars'
        },
        confetti: {
            density: 65,
            speed: 1.3,
            size: 0.9,
            opacity: 70,
            style: 'confetti'
        },
        soft_dust: {
            density: 80,
            speed: 0.5,
            size: 0.6,
            opacity: 55,
            style: 'dust'
        }
    };

    var GOLD_PALETTE = ['#fde047', '#fbbf24', '#fef08a', '#ffffff', '#f59e0b', '#fcd34d'];

    function drawStar(ctx, size) {
        ctx.beginPath();
        for (var s = 0; s < 4; s++) {
            var ang = (s * Math.PI) / 2;
            var rx1 = Math.cos(ang) * size;
            var ry1 = Math.sin(ang) * size;
            var angMid = ang + Math.PI / 4;
            var rx2 = Math.cos(angMid) * (size * 0.28);
            var ry2 = Math.sin(angMid) * (size * 0.28);
            if (s === 0) ctx.moveTo(rx1, ry1);
            else ctx.lineTo(rx1, ry1);
            ctx.lineTo(rx2, ry2);
        }
        ctx.closePath();
        ctx.fill();
    }

    function drawConfetti(ctx, w, h, rot) {
        ctx.rotate(rot);
        ctx.fillRect(-w / 2, -h / 2, w, h);
    }

    function drawDust(ctx, r) {
        var grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        grad.addColorStop(0, 'rgba(254, 240, 138, 0.9)');
        grad.addColorStop(0.5, 'rgba(251, 191, 36, 0.5)');
        grad.addColorStop(1, 'rgba(251, 191, 36, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
    }

    var GlitterEffectEngine = {
        presets: PRESETS,

        getOptions: function (custom) {
            return Object.assign({
                enabled: false,
                preset: 'golden_rain',
                density: 55,
                speed: 1.0,
                size: 1.0,
                opacity: 75,
                style: 'mixed'
            }, custom || {});
        },

        renderFrame: function (ctx, width, height, time, options) {
            if (!ctx || !options || !options.enabled) return;

            var opts = this.getOptions(options);
            var density = Math.max(10, Math.min(120, Number(opts.density) || 55));
            var speedMult = Math.max(0.2, Math.min(3.0, Number(opts.speed) || 1.0));
            var sizeMult = Math.max(0.3, Math.min(2.5, Number(opts.size) || 1.0));
            var globalOpacity = Math.max(0, Math.min(100, Number(opts.opacity) || 75)) / 100;
            var style = opts.style || 'mixed';

            var baseFallSpeed = Math.max(width, height) * 0.12;

            ctx.save();
            ctx.globalCompositeOperation = 'lighter';

            for (var i = 0; i < density; i++) {
                var seed = i * 17.31 + 3.14;
                var lifeSpan = 4.0 + pseudoRandom(seed + 1) * 5.0;
                var phaseOffset = pseudoRandom(seed + 2) * lifeSpan;
                var totalTime = (time || 0) * speedMult + phaseOffset;

                var lifeProgress = (totalTime % lifeSpan) / lifeSpan;
                var cycleCount = Math.floor(totalTime / lifeSpan);

                // Spawn across top of screen
                var startX = pseudoRandom(seed + cycleCount * 5 + 3) * width;
                var startY = -20 - pseudoRandom(seed + cycleCount * 5 + 4) * 40;

                var fallDist = baseFallSpeed * lifeProgress * speedMult;
                var swayX = Math.sin(totalTime * 1.5 + seed) * 25
                    + Math.sin(totalTime * 3.2 + seed * 0.6) * 12;
                var swayY = Math.cos(totalTime * 0.8 + seed * 1.3) * 8;

                var px = startX + swayX;
                var py = startY + fallDist + swayY;

                if (py < -30 || py > height + 30 || px < -30 || px > width + 30) continue;

                // Fade in at top, fade out at bottom
                var alpha = 1.0;
                if (lifeProgress < 0.08) {
                    alpha = lifeProgress / 0.08;
                } else if (lifeProgress > 0.85) {
                    alpha = (1.0 - lifeProgress) / 0.15;
                }

                // Twinkle sparkle
                var twinkle = 0.4 + 0.6 * Math.max(0, Math.sin(totalTime * 4.5 + seed * 2.1));
                alpha *= globalOpacity * twinkle * (0.5 + pseudoRandom(seed + 9) * 0.5);

                if (alpha <= 0.01) continue;

                var particleStyle = style;
                if (style === 'mixed') {
                    var stylePick = pseudoRandom(seed + 10);
                    if (stylePick < 0.35) particleStyle = 'stars';
                    else if (stylePick < 0.65) particleStyle = 'confetti';
                    else particleStyle = 'dust';
                }

                var colorIdx = Math.floor(pseudoRandom(seed + 11) * GOLD_PALETTE.length);
                var color = GOLD_PALETTE[colorIdx];
                var particleSize = Math.max(width, height) * 0.012 * sizeMult
                    * (0.6 + pseudoRandom(seed + 12) * 0.8);

                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.translate(px, py);
                ctx.fillStyle = color;
                ctx.shadowColor = '#eab308';
                ctx.shadowBlur = particleSize * 1.5;

                if (particleStyle === 'stars') {
                    var starSize = particleSize * (1.2 + pseudoRandom(seed + 13) * 0.6);
                    var starRot = (pseudoRandom(seed + 14) * 360 + totalTime * 40) * (Math.PI / 180);
                    ctx.rotate(starRot);
                    drawStar(ctx, starSize);
                } else if (particleStyle === 'confetti') {
                    var cw = particleSize * (0.8 + pseudoRandom(seed + 15) * 0.6);
                    var ch = cw * (0.4 + pseudoRandom(seed + 16) * 0.3);
                    var confRot = (pseudoRandom(seed + 17) * 360 + totalTime * 120) * (Math.PI / 180);
                    drawConfetti(ctx, cw, ch, confRot);
                } else {
                    var dustR = particleSize * (0.8 + pseudoRandom(seed + 18) * 0.5);
                    drawDust(ctx, dustR);
                }

                ctx.restore();
            }

            ctx.restore();
        }
    };

    window.GlitterEffectEngine = GlitterEffectEngine;
})();
