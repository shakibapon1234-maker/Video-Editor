/* ==========================================================================
   Studio Flow — Glassmorphism Card Stack Module (Phase Reels Pro)
   
   Features:
   - Authentic Reels Glassmorphism: Multi-layered frosted glass with specular shine
   - Intense Neon Border Glow & Left Accent Glow Bar
   - Background Color & Opacity customization (Dark Glass, Light Glass, Custom)
   - Razor-sharp Vector Icon rendering (No blurry emojis!) with icon presets
   - Larger, high-contrast typography with Bengali & English font support
   - Modern Animations: Spring pop, Light Sweep Shimmer, Slide-in, Floating wave
   ========================================================================== */

(function () {
    'use strict';

    function ve() {
        return window.VideoEditor || null;
    }

    // Default configuration for a card stack
    const DEFAULT_CONFIG = {
        enabled: false,
        position: 'bottom-right', // 'bottom-right', 'bottom-left', 'bottom-center', 'top-right', 'top-left', 'top-center', 'center'
        animation: 'spring-shimmer', // 'spring-shimmer', 'slide-in', 'floating', 'fade-pop'
        scale: 100, // 50% to 220%
        textScale: 115, // 80% to 160%
        bgColor: '#0f172a',
        bgOpacity: 85, // 20% to 100%
        glowIntensity: 80, // 0% to 100%
        width: 390,
        cardHeight: 74,
        spacing: 12,
        staggerDelay: 0.25, // seconds between cards
        startSec: 0,
        durationSec: 5,
        themeColor: '#38bdf8', // Cyan/Sky glow
        cards: [
            {
                id: 'gc_1',
                icon: '⚡',
                iconType: 'bolt',
                title: 'স্পেশাল অফার (৫০% ছাড়)',
                subtitle: '১০০% প্রিমিয়াম ও অরিজিনাল কোয়ালিটি',
                badge: 'SPECIAL',
                color: '#38bdf8'
            },
            {
                id: 'gc_2',
                icon: '🚚',
                iconType: 'truck',
                title: 'ক্যাশ অন ডেলিভারি',
                subtitle: 'সারা দেশে ফ্রি হোম ডেলিভারি সুবিধা',
                badge: 'FREE COD',
                color: '#22c55e'
            },
            {
                id: 'gc_3',
                icon: '⭐',
                iconType: 'star',
                title: '৪.৯ স্টার কাস্টমার রেটিং',
                subtitle: '৫,০০০+ হ্যাপি কাস্টমারের বিশ্বস্ত পছন্দ',
                badge: 'TOP RATED',
                color: '#f59e0b'
            }
        ]
    };

    // Vector Icon Glyphs for razor-sharp canvas drawing
    const ICON_GLYPH_MAP = {
        'truck': '\uf48b',       // truck-fast
        'bag': '\uf290',         // bag-shopping
        'bolt': '\uf0e7',        // bolt
        'star': '\uf005',        // star
        'fire': '\uf06d',        // fire
        'gift': '\uf06b',        // gift
        'cash': '\uf0d6',        // money-bill-wave
        'shield': '\uf3ed',      // shield-halved
        'tag': '\uf02c',         // tags
        'diamond': '\uf219',     // diamond
        'rocket': '\uf135',      // rocket
        'heart': '\uf004',       // heart
        'check': '\uf058',       // circle-check
        'clock': '\uf017',       // clock
        'phone': '\uf095'        // phone
    };

    // Easing helpers
    function easeOutBack(x) {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    }

    function easeOutCubic(x) {
        return 1 - Math.pow(1 - x, 3);
    }

    // Helper: Hex color to RGBA
    function hexToRgba(hex, alpha) {
        if (!hex) return `rgba(15, 23, 42, ${alpha})`;
        let c = hex.replace('#', '');
        if (c.length === 3) c = c.split('').map(x => x + x).join('');
        const num = parseInt(c, 16);
        const r = (num >> 16) & 255;
        const g = (num >> 8) & 255;
        const b = num & 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    // Draw high-resolution vector icon on Canvas
    function drawVectorIcon(ctx, iconKey, iconText, x, y, size, accentColor) {
        ctx.save();
        
        // Find matching vector glyph
        let glyph = null;
        if (iconKey && ICON_GLYPH_MAP[iconKey]) {
            glyph = ICON_GLYPH_MAP[iconKey];
        } else if (iconText) {
            // Auto match common emojis/strings
            if (iconText.includes('🚚') || iconText.includes('car') || iconText.includes('truck')) glyph = ICON_GLYPH_MAP['truck'];
            else if (iconText.includes('🛍️') || iconText.includes('bag') || iconText.includes('shop')) glyph = ICON_GLYPH_MAP['bag'];
            else if (iconText.includes('⚡') || iconText.includes('bolt') || iconText.includes('flash')) glyph = ICON_GLYPH_MAP['bolt'];
            else if (iconText.includes('⭐') || iconText.includes('star')) glyph = ICON_GLYPH_MAP['star'];
            else if (iconText.includes('🔥') || iconText.includes('fire') || iconText.includes('hot')) glyph = ICON_GLYPH_MAP['fire'];
            else if (iconText.includes('🎁') || iconText.includes('gift')) glyph = ICON_GLYPH_MAP['gift'];
            else if (iconText.includes('💰') || iconText.includes('cash') || iconText.includes('money')) glyph = ICON_GLYPH_MAP['cash'];
            else if (iconText.includes('🛡️') || iconText.includes('shield') || iconText.includes('quality')) glyph = ICON_GLYPH_MAP['shield'];
            else if (iconText.includes('🏷️') || iconText.includes('tag') || iconText.includes('discount')) glyph = ICON_GLYPH_MAP['tag'];
            else if (iconText.includes('💎') || iconText.includes('diamond')) glyph = ICON_GLYPH_MAP['diamond'];
            else if (iconText.includes('🚀') || iconText.includes('rocket')) glyph = ICON_GLYPH_MAP['rocket'];
        }

        if (glyph) {
            // Draw crisp FontAwesome solid vector icon
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = accentColor;
            ctx.shadowBlur = 8;
            ctx.font = `900 ${Math.round(size * 0.56)}px "Font Awesome 6 Free", "FontAwesome", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(glyph, x, y + 1);
        } else {
            // Fallback to emoji with crisp rendering
            ctx.font = `${Math.round(size * 0.56)}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(iconText || '✨', x, y + 1);
        }

        ctx.restore();
    }

    // Main Draw Function called inside canvas frame loop
    function drawGlassCardStack(ctx, cfg, currentTime, canvasW, canvasH) {
        if (!cfg || !cfg.enabled || !cfg.cards || cfg.cards.length === 0) return;

        const startT = cfg.startSec || 0;
        const dur = cfg.durationSec || 5;
        const elapsed = currentTime - startT;

        // Visibility check
        if (elapsed < 0 || elapsed > dur) return;

        // Exit fade in the last 0.4s
        let exitAlpha = 1;
        if (elapsed > dur - 0.4) {
            exitAlpha = Math.max(0, (dur - elapsed) / 0.4);
        }

        // Smart responsive dimension calculation:
        const isPortrait = canvasH > canvasW;
        const baseRef = isPortrait ? (canvasW / 500) : (canvasW / 1050);
        const userScale = Math.max(0.4, (cfg.scale != null ? cfg.scale : 100) / 100);
        const scaleFactor = Math.max(0.35, baseRef) * userScale;

        const textScaleFactor = ((cfg.textScale != null ? cfg.textScale : 115) / 100);

        const cardW = Math.min(canvasW * 0.94, (cfg.width || 390) * scaleFactor);
        const cardH = (cfg.cardHeight || 74) * scaleFactor;
        const spacing = (cfg.spacing || 12) * scaleFactor;
        const totalStackH = (cardH + spacing) * cfg.cards.length - spacing;

        const marginX = 24 * scaleFactor;
        const marginY = 32 * scaleFactor;

        let originX = marginX;
        let originY = canvasH - totalStackH - marginY;

        switch (cfg.position) {
            case 'bottom-left':
                originX = marginX;
                originY = canvasH - totalStackH - marginY;
                break;
            case 'bottom-center':
                originX = (canvasW - cardW) / 2;
                originY = canvasH - totalStackH - marginY;
                break;
            case 'top-right':
                originX = canvasW - cardW - marginX;
                originY = marginY;
                break;
            case 'top-left':
                originX = marginX;
                originY = marginY;
                break;
            case 'top-center':
                originX = (canvasW - cardW) / 2;
                originY = marginY;
                break;
            case 'center':
                originX = (canvasW - cardW) / 2;
                originY = (canvasH - totalStackH) / 2;
                break;
            case 'bottom-right':
            default:
                originX = canvasW - cardW - marginX;
                originY = canvasH - totalStackH - marginY;
                break;
        }

        // Background styling properties
        const bgOpacityVal = ((cfg.bgOpacity != null ? cfg.bgOpacity : 85) / 100);
        const baseBgRgba = hexToRgba(cfg.bgColor || '#0f172a', bgOpacityVal);
        const glowFactor = ((cfg.glowIntensity != null ? cfg.glowIntensity : 80) / 100);
        const animType = cfg.animation || 'spring-shimmer';

        ctx.save();
        ctx.globalAlpha = exitAlpha;

        cfg.cards.forEach((card, idx) => {
            const cardStart = idx * (cfg.staggerDelay || 0.25);
            const cardElapsed = elapsed - cardStart;
            if (cardElapsed < 0) return; // Not yet appeared

            // Animation timing calculation
            let cardAlpha = 1;
            let cardScale = 1;
            let offsetX = 0;
            let offsetY = 0;
            let shimmerProgress = -1; // -0.5 to 1.5 sweep

            if (animType === 'slide-in') {
                const enterProg = Math.min(1, Math.max(0, cardElapsed / 0.45));
                const eased = easeOutCubic(enterProg);
                cardAlpha = Math.min(1, cardElapsed / 0.25);
                offsetX = (1 - eased) * (cfg.position.includes('left') ? -80 : 80) * scaleFactor;
                cardScale = 0.95 + 0.05 * eased;
            } else if (animType === 'floating') {
                const enterProg = Math.min(1, Math.max(0, cardElapsed / 0.45));
                const eased = easeOutBack(enterProg);
                cardAlpha = Math.min(1, cardElapsed / 0.25);
                cardScale = 0.9 + 0.1 * eased;
                // Subtle organic floating wave motion
                offsetY = (1 - eased) * 35 * scaleFactor + Math.sin(currentTime * 2.5 + idx * 0.8) * 4 * scaleFactor;
            } else if (animType === 'fade-pop') {
                const enterProg = Math.min(1, Math.max(0, cardElapsed / 0.4));
                const eased = easeOutCubic(enterProg);
                cardAlpha = Math.min(1, cardElapsed / 0.3);
                cardScale = 0.85 + 0.15 * eased;
            } else {
                // Default: 'spring-shimmer' (Smooth pop + light sweep shimmer)
                const enterProg = Math.min(1, Math.max(0, cardElapsed / 0.5));
                const eased = easeOutBack(enterProg);
                cardAlpha = Math.min(1, cardElapsed / 0.25);
                offsetY = (1 - eased) * 45 * scaleFactor;
                cardScale = 0.85 + 0.15 * eased;

                // Trigger shimmer light sweep after card lands
                if (cardElapsed > 0.3 && cardElapsed < 1.4) {
                    shimmerProgress = (cardElapsed - 0.3) / 0.9; // 0 to 1
                }
            }

            const currentX = originX + offsetX;
            const currentY = originY + idx * (cardH + spacing) + offsetY;

            ctx.save();
            ctx.globalAlpha = exitAlpha * cardAlpha;

            // Center transform for pop scale
            ctx.translate(currentX + cardW / 2, currentY + cardH / 2);
            ctx.scale(cardScale, cardScale);
            ctx.translate(-cardW / 2, -cardH / 2);

            const r = Math.min(16 * scaleFactor, cardH * 0.24);
            const accentColor = card.color || cfg.themeColor || '#38bdf8';

            // 1. Multi-layered Ambient Shadow & Neon Glow
            if (glowFactor > 0.05) {
                ctx.save();
                ctx.shadowColor = accentColor;
                ctx.shadowBlur = 24 * scaleFactor * glowFactor;
                ctx.shadowOffsetY = 4 * scaleFactor;
                ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
                ctx.beginPath();
                if (ctx.roundRect) ctx.roundRect(0, 0, cardW, cardH, r);
                else ctx.rect(0, 0, cardW, cardH);
                ctx.fill();
                ctx.restore();
            }

            // 2. Base Frosted Glass Body with User Tint
            ctx.fillStyle = baseBgRgba;
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(0, 0, cardW, cardH, r);
            else ctx.rect(0, 0, cardW, cardH);
            ctx.fill();

            // 3. Diagonal Frosted Glass Sheen
            const sheenGrad = ctx.createLinearGradient(0, 0, cardW, cardH);
            sheenGrad.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
            sheenGrad.addColorStop(0.35, 'rgba(255, 255, 255, 0.08)');
            sheenGrad.addColorStop(0.7, 'rgba(255, 255, 255, 0.02)');
            sheenGrad.addColorStop(1, 'rgba(0, 0, 0, 0.25)');
            ctx.fillStyle = sheenGrad;
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(0, 0, cardW, cardH, r);
            else ctx.rect(0, 0, cardW, cardH);
            ctx.fill();

            // 4. Glowing Gradient Border
            const borderGrad = ctx.createLinearGradient(0, 0, cardW, cardH);
            borderGrad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
            borderGrad.addColorStop(0.3, accentColor);
            borderGrad.addColorStop(0.8, hexToRgba(accentColor, 0.4));
            borderGrad.addColorStop(1, 'rgba(255, 255, 255, 0.15)');

            ctx.strokeStyle = borderGrad;
            ctx.lineWidth = Math.max(1.5, 2.2 * scaleFactor);
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(0, 0, cardW, cardH, r);
            else ctx.rect(0, 0, cardW, cardH);
            ctx.stroke();

            // 5. Specular Top Highlight Hairline
            ctx.save();
            const topGrad = ctx.createLinearGradient(0, 0, cardW, 0);
            topGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
            topGrad.addColorStop(0.2, 'rgba(255, 255, 255, 0.7)');
            topGrad.addColorStop(0.6, 'rgba(255, 255, 255, 0.3)');
            topGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.strokeStyle = topGrad;
            ctx.lineWidth = 1.2 * scaleFactor;
            ctx.beginPath();
            ctx.moveTo(r, 1);
            ctx.lineTo(cardW - r, 1);
            ctx.stroke();
            ctx.restore();

            // 6. Accent vertical neon bar on the left
            ctx.save();
            ctx.strokeStyle = accentColor;
            ctx.shadowColor = accentColor;
            ctx.shadowBlur = 12 * scaleFactor * glowFactor;
            ctx.lineWidth = Math.max(3.5, 5 * scaleFactor);
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(r * 0.85, cardH * 0.18);
            ctx.lineTo(r * 0.85, cardH * 0.82);
            ctx.stroke();
            ctx.restore();

            // 7. Icon Squircle Plate & Vector Icon Drawing
            const iconBoxSize = cardH * 0.64;
            const iconX = r * 1.4;
            const iconY = (cardH - iconBoxSize) / 2;

            // Icon Background Squircle Plate
            ctx.save();
            const iconPlateGrad = ctx.createLinearGradient(iconX, iconY, iconX + iconBoxSize, iconY + iconBoxSize);
            iconPlateGrad.addColorStop(0, hexToRgba(accentColor, 0.35));
            iconPlateGrad.addColorStop(1, 'rgba(255, 255, 255, 0.08)');
            ctx.fillStyle = iconPlateGrad;
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(iconX, iconY, iconBoxSize, iconBoxSize, 10 * scaleFactor);
            else ctx.rect(iconX, iconY, iconBoxSize, iconBoxSize);
            ctx.fill();

            // Icon Plate Border
            ctx.strokeStyle = hexToRgba(accentColor, 0.6);
            ctx.lineWidth = Math.max(1, 1.2 * scaleFactor);
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(iconX, iconY, iconBoxSize, iconBoxSize, 10 * scaleFactor);
            else ctx.rect(iconX, iconY, iconBoxSize, iconBoxSize);
            ctx.stroke();

            // Vector Icon Rendering
            drawVectorIcon(
                ctx,
                card.iconType || '',
                card.icon || '',
                iconX + iconBoxSize / 2,
                iconY + iconBoxSize / 2,
                iconBoxSize,
                accentColor
            );
            ctx.restore();

            // 8. Badge Pill Calculation
            let badgeWidth = 0;
            const hasBadge = !!(card.badge && card.badge.trim());
            const badgeFontSize = Math.round(11 * scaleFactor * textScaleFactor);
            const badgeFont = `700 ${badgeFontSize}px 'Outfit', 'Hind Siliguri', sans-serif`;

            if (hasBadge) {
                ctx.font = badgeFont;
                badgeWidth = ctx.measureText(card.badge).width + 16 * scaleFactor;
            }

            // 9. Typography (Title & Subtitle with Crisp Contrast & Shadow)
            const fontStack = `'Hind Siliguri', 'Outfit', 'Kalpurush', 'Noto Sans Bengali', -apple-system, sans-serif`;
            const textLeft = iconX + iconBoxSize + 14 * scaleFactor;
            const maxTextWidth = cardW - textLeft - (hasBadge ? badgeWidth + 16 * scaleFactor : 14 * scaleFactor);

            // Title
            ctx.save();
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = 4 * scaleFactor;
            ctx.shadowOffsetY = 1.5 * scaleFactor;
            ctx.fillStyle = '#ffffff';
            const titleFontSize = Math.round(16.5 * scaleFactor * textScaleFactor);
            ctx.font = `700 ${titleFontSize}px ${fontStack}`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';

            let titleText = card.title || '';
            if (ctx.measureText(titleText).width > maxTextWidth && maxTextWidth > 30) {
                while (titleText.length > 3 && ctx.measureText(titleText + '…').width > maxTextWidth) {
                    titleText = titleText.slice(0, -1);
                }
                titleText += '…';
            }
            ctx.fillText(titleText, textLeft, cardH * 0.35);
            ctx.restore();

            // Subtitle
            ctx.save();
            ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
            ctx.shadowBlur = 3 * scaleFactor;
            ctx.shadowOffsetY = 1 * scaleFactor;
            ctx.fillStyle = '#cbd5e1';
            const subFontSize = Math.round(13 * scaleFactor * textScaleFactor);
            ctx.font = `500 ${subFontSize}px ${fontStack}`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';

            let subText = card.subtitle || '';
            if (ctx.measureText(subText).width > maxTextWidth && maxTextWidth > 30) {
                while (subText.length > 3 && ctx.measureText(subText + '…').width > maxTextWidth) {
                    subText = subText.slice(0, -1);
                }
                subText += '…';
            }
            ctx.fillText(subText, textLeft, cardH * 0.69);
            ctx.restore();

            // 10. Badge pill on the right
            if (hasBadge) {
                const bH = 22 * scaleFactor * textScaleFactor;
                const bW = badgeWidth;
                const bX = cardW - bW - 12 * scaleFactor;
                const bY = (cardH - bH) / 2;

                ctx.save();
                ctx.fillStyle = accentColor;
                ctx.globalAlpha = 0.28;
                ctx.beginPath();
                if (ctx.roundRect) ctx.roundRect(bX, bY, bW, bH, bH / 2);
                else ctx.rect(bX, bY, bW, bH);
                ctx.fill();

                ctx.strokeStyle = accentColor;
                ctx.globalAlpha = 0.9;
                ctx.lineWidth = Math.max(1, 1.4 * scaleFactor);
                ctx.stroke();

                ctx.globalAlpha = 1;
                ctx.fillStyle = '#ffffff';
                ctx.font = badgeFont;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(card.badge, bX + bW / 2, bY + bH / 2 + 0.5);
                ctx.restore();
            }

            // 11. Light Sweep Shimmer Effect
            if (shimmerProgress >= 0 && shimmerProgress <= 1) {
                ctx.save();
                // Clip inside rounded card
                ctx.beginPath();
                if (ctx.roundRect) ctx.roundRect(0, 0, cardW, cardH, r);
                else ctx.rect(0, 0, cardW, cardH);
                ctx.clip();

                const shimmerX = shimmerProgress * (cardW + 120 * scaleFactor) - 60 * scaleFactor;
                const shimmerGrad = ctx.createLinearGradient(shimmerX - 40 * scaleFactor, 0, shimmerX + 40 * scaleFactor, cardH);
                shimmerGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
                shimmerGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.35)');
                shimmerGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

                ctx.fillStyle = shimmerGrad;
                ctx.fillRect(0, 0, cardW, cardH);
                ctx.restore();
            }

            ctx.restore();
        });

        ctx.restore();
    }

    // UI and state initialization
    function initGlassCardStackUI() {
        const state = ve();
        if (!state) return;

        // Initialize state config if not present
        if (!state.glassCardStack) {
            state.glassCardStack = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        }

        const enableToggle = document.getElementById('glass-cards-enable');
        const posSelect = document.getElementById('glass-cards-pos');
        const animSelect = document.getElementById('glass-cards-anim');
        const scaleInput = document.getElementById('glass-cards-scale');
        const scaleVal = document.getElementById('glass-cards-scale-val');
        const textScaleInput = document.getElementById('glass-cards-text-scale');
        const textScaleVal = document.getElementById('glass-cards-text-scale-val');
        const bgColorInput = document.getElementById('glass-cards-bg-color');
        const bgOpacityInput = document.getElementById('glass-cards-bg-opacity');
        const bgOpacityVal = document.getElementById('glass-cards-bg-opacity-val');
        const glowInput = document.getElementById('glass-cards-glow');
        const glowVal = document.getElementById('glass-cards-glow-val');
        const themeColorInput = document.getElementById('glass-cards-color');
        const startInput = document.getElementById('glass-cards-start');
        const durInput = document.getElementById('glass-cards-dur');
        const cardsListEl = document.getElementById('glass-cards-items-list');
        const addCardBtn = document.getElementById('add-glass-card-item-btn');

        function syncUIFromState() {
            const cfg = state.glassCardStack || DEFAULT_CONFIG;
            if (enableToggle) enableToggle.checked = !!cfg.enabled;
            if (posSelect) posSelect.value = cfg.position || 'bottom-right';
            if (animSelect) animSelect.value = cfg.animation || 'spring-shimmer';
            
            if (scaleInput) {
                scaleInput.value = cfg.scale != null ? cfg.scale : 100;
                if (scaleVal) scaleVal.textContent = (cfg.scale != null ? cfg.scale : 100) + '%';
            }
            if (textScaleInput) {
                textScaleInput.value = cfg.textScale != null ? cfg.textScale : 115;
                if (textScaleVal) textScaleVal.textContent = (cfg.textScale != null ? cfg.textScale : 115) + '%';
            }
            if (bgColorInput) bgColorInput.value = cfg.bgColor || '#0f172a';
            if (bgOpacityInput) {
                bgOpacityInput.value = cfg.bgOpacity != null ? cfg.bgOpacity : 85;
                if (bgOpacityVal) bgOpacityVal.textContent = (cfg.bgOpacity != null ? cfg.bgOpacity : 85) + '%';
            }
            if (glowInput) {
                glowInput.value = cfg.glowIntensity != null ? cfg.glowIntensity : 80;
                if (glowVal) glowVal.textContent = (cfg.glowIntensity != null ? cfg.glowIntensity : 80) + '%';
            }
            if (themeColorInput) themeColorInput.value = cfg.themeColor || '#38bdf8';
            if (startInput) startInput.value = cfg.startSec != null ? cfg.startSec : 0;
            if (durInput) durInput.value = cfg.durationSec != null ? cfg.durationSec : 5;

            renderCardsListUI();
        }

        // Icon Preset Options for quick selection
        const ICON_PRESETS = [
            { label: '⚡ অফার', type: 'bolt', emoji: '⚡' },
            { label: '🚚 ডেলিভারি', type: 'truck', emoji: '🚚' },
            { label: '🛍️ শপিং', type: 'bag', emoji: '🛍️' },
            { label: '⭐ রেটিং', type: 'star', emoji: '⭐' },
            { label: '🔥 ট্রেন্ড', type: 'fire', emoji: '🔥' },
            { label: '🎁 গিফট', type: 'gift', emoji: '🎁' },
            { label: '💰 ক্যাশ', type: 'cash', emoji: '💰' },
            { label: '🛡️ কোয়ালিটি', type: 'shield', emoji: '🛡️' },
            { label: '🏷️ ডিসকাউন্ট', type: 'tag', emoji: '🏷️' },
            { label: '💎 লাক্সারি', type: 'diamond', emoji: '💎' }
        ];

        function renderCardsListUI() {
            if (!cardsListEl) return;
            cardsListEl.innerHTML = '';
            const cfg = state.glassCardStack;
            if (!cfg || !cfg.cards) return;

            cfg.cards.forEach((c, idx) => {
                const itemEl = document.createElement('div');
                itemEl.className = 'glass-card-editor-row';
                itemEl.style.cssText = 'background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 12px; margin-bottom: 10px; display: flex; flex-direction: column; gap: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.2);';
                
                const presetOptionsHtml = ICON_PRESETS.map(p => `
                    <option value="${p.type}" ${c.iconType === p.type ? 'selected' : ''}>${p.label}</option>
                `).join('');

                itemEl.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.07); padding-bottom: 6px;">
                        <span style="font-weight: 600; font-size: 13px; color: ${c.color || '#38bdf8'}; display: flex; align-items: center; gap: 6px;">
                            <i class="fa-solid fa-layer-group"></i> Card #${idx + 1}
                        </span>
                        <div style="display:flex; align-items:center; gap:6px;">
                            <label style="font-size:11px; margin:0; color:#94a3b8;">কালার:</label>
                            <input type="color" class="gc-color-inp" value="${c.color || cfg.themeColor || '#38bdf8'}" title="Card Accent Color" style="width:24px; height:24px; border-radius:4px; border:none; cursor:pointer; padding:0; background:transparent;">
                            <button type="button" class="btn btn-outline gc-del-btn" title="Delete Card" style="padding: 2px 8px; font-size: 11px; color: #ef4444; border-color: rgba(239,68,68,0.3);"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>

                    <!-- Icon Preset & Title Text Boxes -->
                    <div>
                        <div style="display: grid; grid-template-columns: 110px 1fr; gap: 8px;">
                            <div>
                                <label style="font-size: 11px; color: #94a3b8; display: block; margin-bottom: 3px;">আইকন (Icon):</label>
                                <select class="form-select gc-icon-type-sel" style="font-size:12px; padding: 6px 8px;">
                                    ${presetOptionsHtml}
                                    <option value="custom" ${c.iconType === 'custom' ? 'selected' : ''}>✍️ Custom</option>
                                </select>
                            </div>
                            <div>
                                <label style="font-size: 11px; color: #94a3b8; display: block; margin-bottom: 3px;">Title (শিরোনাম / মূল লেখা):</label>
                                <input type="text" class="form-input gc-title-inp" value="${c.title || ''}" placeholder="যেমন: স্পেশাল ৫০% অফার">
                            </div>
                        </div>
                    </div>

                    <!-- Subtitle & Badge Text Boxes -->
                    <div style="display: grid; grid-template-columns: 1fr 100px; gap: 8px;">
                        <div>
                            <label style="font-size: 11px; color: #94a3b8; display: block; margin-bottom: 3px;">Subtitle (ছোট বিবরণ):</label>
                            <input type="text" class="form-input gc-sub-inp" value="${c.subtitle || ''}" placeholder="যেমন: সারা দেশে ক্যাশ অন ডেলিভারি">
                        </div>
                        <div>
                            <label style="font-size: 11px; color: #94a3b8; display: block; margin-bottom: 3px;">Badge (ট্যাগ):</label>
                            <input type="text" class="form-input gc-badge-inp" value="${c.badge || ''}" placeholder="FREE COD">
                        </div>
                    </div>
                `;

                // Bind events
                const iconTypeSel = itemEl.querySelector('.gc-icon-type-sel');
                const titleInp = itemEl.querySelector('.gc-title-inp');
                const subInp = itemEl.querySelector('.gc-sub-inp');
                const badgeInp = itemEl.querySelector('.gc-badge-inp');
                const colorInp = itemEl.querySelector('.gc-color-inp');
                const delBtn = itemEl.querySelector('.gc-del-btn');

                const updateCard = () => {
                    c.iconType = iconTypeSel.value;
                    const preset = ICON_PRESETS.find(p => p.type === c.iconType);
                    if (preset) c.icon = preset.emoji;
                    c.title = titleInp.value;
                    c.subtitle = subInp.value;
                    c.badge = badgeInp.value;
                    c.color = colorInp.value;
                    if (window.triggerCanvasRedraw) window.triggerCanvasRedraw();
                    if (window.triggerAutoSave) window.triggerAutoSave();
                };

                iconTypeSel.addEventListener('change', updateCard);
                titleInp.addEventListener('input', updateCard);
                subInp.addEventListener('input', updateCard);
                badgeInp.addEventListener('input', updateCard);
                colorInp.addEventListener('input', updateCard);

                delBtn.addEventListener('click', () => {
                    cfg.cards.splice(idx, 1);
                    renderCardsListUI();
                    if (window.triggerCanvasRedraw) window.triggerCanvasRedraw();
                    if (window.triggerAutoSave) window.triggerAutoSave();
                });

                cardsListEl.appendChild(itemEl);
            });
        }

        // Toggle
        if (enableToggle) {
            enableToggle.addEventListener('change', (e) => {
                if (!state.glassCardStack) state.glassCardStack = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
                state.glassCardStack.enabled = e.target.checked;
                if (window.triggerCanvasRedraw) window.triggerCanvasRedraw();
                if (window.triggerAutoSave) window.triggerAutoSave();
            });
        }

        // Position & Animation
        if (posSelect) {
            posSelect.addEventListener('change', (e) => {
                if (state.glassCardStack) state.glassCardStack.position = e.target.value;
                if (window.triggerCanvasRedraw) window.triggerCanvasRedraw();
                if (window.triggerAutoSave) window.triggerAutoSave();
            });
        }

        if (animSelect) {
            animSelect.addEventListener('change', (e) => {
                if (state.glassCardStack) state.glassCardStack.animation = e.target.value;
                if (window.triggerCanvasRedraw) window.triggerCanvasRedraw();
                if (window.triggerAutoSave) window.triggerAutoSave();
            });
        }

        // Card Size / Scale Slider
        if (scaleInput) {
            scaleInput.addEventListener('input', (e) => {
                const val = parseInt(e.target.value, 10) || 100;
                if (scaleVal) scaleVal.textContent = val + '%';
                if (!state.glassCardStack) state.glassCardStack = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
                state.glassCardStack.scale = val;
                if (window.triggerCanvasRedraw) window.triggerCanvasRedraw();
                if (window.triggerAutoSave) window.triggerAutoSave();
            });
        }

        // Text Size Slider
        if (textScaleInput) {
            textScaleInput.addEventListener('input', (e) => {
                const val = parseInt(e.target.value, 10) || 115;
                if (textScaleVal) textScaleVal.textContent = val + '%';
                if (!state.glassCardStack) state.glassCardStack = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
                state.glassCardStack.textScale = val;
                if (window.triggerCanvasRedraw) window.triggerCanvasRedraw();
                if (window.triggerAutoSave) window.triggerAutoSave();
            });
        }

        // Background Color & Opacity
        if (bgColorInput) {
            bgColorInput.addEventListener('input', (e) => {
                if (state.glassCardStack) state.glassCardStack.bgColor = e.target.value;
                if (window.triggerCanvasRedraw) window.triggerCanvasRedraw();
                if (window.triggerAutoSave) window.triggerAutoSave();
            });
        }

        if (bgOpacityInput) {
            bgOpacityInput.addEventListener('input', (e) => {
                const val = parseInt(e.target.value, 10) || 85;
                if (bgOpacityVal) bgOpacityVal.textContent = val + '%';
                if (!state.glassCardStack) state.glassCardStack = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
                state.glassCardStack.bgOpacity = val;
                if (window.triggerCanvasRedraw) window.triggerCanvasRedraw();
                if (window.triggerAutoSave) window.triggerAutoSave();
            });
        }

        // Glow Intensity
        if (glowInput) {
            glowInput.addEventListener('input', (e) => {
                const val = parseInt(e.target.value, 10) || 80;
                if (glowVal) glowVal.textContent = val + '%';
                if (!state.glassCardStack) state.glassCardStack = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
                state.glassCardStack.glowIntensity = val;
                if (window.triggerCanvasRedraw) window.triggerCanvasRedraw();
                if (window.triggerAutoSave) window.triggerAutoSave();
            });
        }

        // Theme color
        if (themeColorInput) {
            themeColorInput.addEventListener('input', (e) => {
                if (state.glassCardStack) state.glassCardStack.themeColor = e.target.value;
                if (window.triggerCanvasRedraw) window.triggerCanvasRedraw();
                if (window.triggerAutoSave) window.triggerAutoSave();
            });
        }

        // Timing
        if (startInput) {
            startInput.addEventListener('input', (e) => {
                if (state.glassCardStack) state.glassCardStack.startSec = parseFloat(e.target.value) || 0;
                if (window.triggerCanvasRedraw) window.triggerCanvasRedraw();
                if (window.triggerAutoSave) window.triggerAutoSave();
            });
        }

        if (durInput) {
            durInput.addEventListener('input', (e) => {
                if (state.glassCardStack) state.glassCardStack.durationSec = parseFloat(e.target.value) || 5;
                if (window.triggerCanvasRedraw) window.triggerCanvasRedraw();
                if (window.triggerAutoSave) window.triggerAutoSave();
            });
        }

        // Add Card Button
        if (addCardBtn) {
            addCardBtn.addEventListener('click', () => {
                if (!state.glassCardStack) state.glassCardStack = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
                state.glassCardStack.cards.push({
                    id: 'gc_' + Date.now(),
                    icon: '🛍️',
                    iconType: 'bag',
                    title: 'নতুন অফার বা প্রোডাক্ট',
                    subtitle: 'বিস্তারিত তথ্য এখানে লিখুন',
                    badge: 'NEW',
                    color: state.glassCardStack.themeColor || '#38bdf8'
                });
                renderCardsListUI();
                if (window.triggerCanvasRedraw) window.triggerCanvasRedraw();
                if (window.triggerAutoSave) window.triggerAutoSave();
            });
        }

        window.syncGlassCardsUI = syncUIFromState;
        syncUIFromState();
    }

    // Expose drawing function globally
    window.renderGlassCardsOverlay = function (ctx, currentTime, canvasW, canvasH) {
        const state = ve();
        if (!state || !state.glassCardStack) return;
        drawGlassCardStack(ctx, state.glassCardStack, currentTime, canvasW, canvasH);
    };

    // Auto-hook into editor render cycle
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initGlassCardStackUI, 600);
    });

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(initGlassCardStackUI, 300);
    }
})();
