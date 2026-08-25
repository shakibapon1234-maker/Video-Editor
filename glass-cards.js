/* ==========================================================================
   Studio Flow — Glassmorphism Card Stack Module (Phase Reels)
   
   Renders staggered floating glassmorphic information cards on top of video,
   inspired by top-tier motion graphics and Reels ad templates (e.g. Advantage+
   Campaign, AI Audience, Budget ROAS cards).
   
   Features:
   - Frosted glass canvas rendering with subtle reflection, blur illusion, and border glow
   - Staggered entrance timing (each card slides and pops in with smooth easing)
   - Interactive item management: Add, edit, remove, and reorder cards
   - Position & scale controls (Left, Right, Bottom-Center, Custom)
   - Full export compatibility: Renders directly onto Canvas2D context
   ========================================================================== */

(function () {
    'use strict';

    function ve() {
        return window.VideoEditor || null;
    }

    // Default configuration for a card stack
    const DEFAULT_CONFIG = {
        enabled: false,
        position: 'bottom-right', // 'bottom-right', 'bottom-left', 'center', 'custom'
        x: 0.62,
        y: 0.55,
        width: 320,
        cardHeight: 64,
        spacing: 12,
        staggerDelay: 0.25, // seconds between each card appearing
        startSec: 0,
        durationSec: 5,
        themeColor: '#38bdf8', // Cyan/Sky glow
        cards: [
            {
                id: 'gc_1',
                icon: '⚡',
                title: 'Advantage+ Campaign',
                subtitle: 'AI Auto-Targeting · 4.8x ROAS',
                badge: 'ACTIVE',
                color: '#38bdf8'
            },
            {
                id: 'gc_2',
                icon: '📈',
                title: 'High Intent Audience',
                subtitle: 'Lookalike 1% · 92% Match',
                badge: 'OPTIMIZED',
                color: '#22c55e'
            },
            {
                id: 'gc_3',
                icon: '💰',
                title: 'Cost per Acquisition',
                subtitle: 'Reduced by -38.4%',
                badge: 'WINNING',
                color: '#f59e0b'
            }
        ]
    };

    // Easing helper
    function easeOutBack(x) {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
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

        // Compute responsive dimensions based on canvas
        const scaleFactor = Math.min(canvasW / 1280, canvasH / 720);
        const cardW = (cfg.width || 320) * scaleFactor;
        const cardH = (cfg.cardHeight || 64) * scaleFactor;
        const spacing = (cfg.spacing || 12) * scaleFactor;

        let originX = (cfg.x != null ? cfg.x : 0.62) * canvasW;
        let originY = (cfg.y != null ? cfg.y : 0.55) * canvasH;

        if (cfg.position === 'bottom-right') {
            originX = canvasW - cardW - 32 * scaleFactor;
            originY = canvasH - (cardH + spacing) * cfg.cards.length - 40 * scaleFactor;
        } else if (cfg.position === 'bottom-left') {
            originX = 32 * scaleFactor;
            originY = canvasH - (cardH + spacing) * cfg.cards.length - 40 * scaleFactor;
        } else if (cfg.position === 'center') {
            originX = (canvasW - cardW) / 2;
            originY = (canvasH - (cardH + spacing) * cfg.cards.length) / 2;
        }

        ctx.save();
        ctx.globalAlpha = exitAlpha;

        cfg.cards.forEach((card, idx) => {
            const cardStart = idx * (cfg.staggerDelay || 0.25);
            const cardElapsed = elapsed - cardStart;
            if (cardElapsed < 0) return; // Not yet appeared

            const enterProgress = Math.min(1, Math.max(0, cardElapsed / 0.55));
            const easedProgress = easeOutBack(enterProgress);
            const easedAlpha = Math.min(1, cardElapsed / 0.3);

            // Stagger animation: Slide up + scale in + 3D tilt
            const offsetY = (1 - easedProgress) * 45 * scaleFactor;
            const currentY = originY + idx * (cardH + spacing) + offsetY;
            const currentX = originX;

            const cardScale = 0.85 + 0.15 * easedProgress;

            ctx.save();
            ctx.globalAlpha = exitAlpha * easedAlpha;

            // Center transform for scale pop
            ctx.translate(currentX + cardW / 2, currentY + cardH / 2);
            ctx.scale(cardScale, cardScale);
            ctx.translate(-cardW / 2, -cardH / 2);

            const r = Math.min(14 * scaleFactor, cardH * 0.22);

            // 1. Drop Shadow
            ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
            ctx.shadowBlur = 18 * scaleFactor;
            ctx.shadowOffsetY = 8 * scaleFactor;

            // 2. Glass Background (Frosted translucent plate)
            const bgGrad = ctx.createLinearGradient(0, 0, cardW, cardH);
            bgGrad.addColorStop(0, 'rgba(255, 255, 255, 0.16)');
            bgGrad.addColorStop(1, 'rgba(255, 255, 255, 0.05)');
            ctx.fillStyle = bgGrad;

            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(0, 0, cardW, cardH, r);
            else ctx.rect(0, 0, cardW, cardH);
            ctx.fill();

            // Darker base for high contrast readability
            ctx.shadowColor = 'transparent';
            ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(0, 0, cardW, cardH, r);
            else ctx.rect(0, 0, cardW, cardH);
            ctx.fill();

            // 3. Glowing Border
            const accentColor = card.color || cfg.themeColor || '#38bdf8';
            const borderGrad = ctx.createLinearGradient(0, 0, cardW, cardH);
            borderGrad.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
            borderGrad.addColorStop(0.5, accentColor);
            borderGrad.addColorStop(1, 'rgba(255, 255, 255, 0.15)');

            ctx.strokeStyle = borderGrad;
            ctx.lineWidth = Math.max(1.5, 1.8 * scaleFactor);
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(0, 0, cardW, cardH, r);
            else ctx.rect(0, 0, cardW, cardH);
            ctx.stroke();

            // 4. Accent vertical bar on the left
            ctx.save();
            ctx.strokeStyle = accentColor;
            ctx.shadowColor = accentColor;
            ctx.shadowBlur = 8 * scaleFactor;
            ctx.lineWidth = Math.max(3, 4 * scaleFactor);
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(r * 0.8, cardH * 0.22);
            ctx.lineTo(r * 0.8, cardH * 0.78);
            ctx.stroke();
            ctx.restore();

            // 5. Icon / Emoji Box
            const iconSize = cardH * 0.58;
            const iconX = r * 1.6;
            const iconY = (cardH - iconSize) / 2;

            ctx.save();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(iconX, iconY, iconSize, iconSize, 8 * scaleFactor);
            else ctx.rect(iconX, iconY, iconSize, iconSize);
            ctx.fill();

            ctx.font = `${Math.round(iconSize * 0.62)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(card.icon || '✨', iconX + iconSize / 2, iconY + iconSize / 2 + 1);
            ctx.restore();

            // 6. Title Text
            const textLeft = iconX + iconSize + 12 * scaleFactor;
            ctx.fillStyle = '#ffffff';
            ctx.font = `600 ${Math.round(15 * scaleFactor)}px Outfit, -apple-system, sans-serif`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(card.title || 'Card Title', textLeft, cardH * 0.36);

            // 7. Subtitle Text
            ctx.fillStyle = '#94a3b8';
            ctx.font = `400 ${Math.round(12 * scaleFactor)}px Outfit, -apple-system, sans-serif`;
            ctx.fillText(card.subtitle || 'Card Subtitle', textLeft, cardH * 0.68);

            // 8. Badge pill on right
            if (card.badge) {
                const badgeText = card.badge;
                ctx.font = `bold ${Math.round(9 * scaleFactor)}px Outfit, sans-serif`;
                const bW = ctx.measureText(badgeText).width + 12 * scaleFactor;
                const bH = 18 * scaleFactor;
                const bX = cardW - bW - 12 * scaleFactor;
                const bY = (cardH - bH) / 2;

                ctx.save();
                ctx.fillStyle = accentColor;
                ctx.globalAlpha = 0.22;
                ctx.beginPath();
                if (ctx.roundRect) ctx.roundRect(bX, bY, bW, bH, bH / 2);
                else ctx.rect(bX, bY, bW, bH);
                ctx.fill();

                ctx.strokeStyle = accentColor;
                ctx.globalAlpha = 0.8;
                ctx.lineWidth = 1;
                ctx.stroke();

                ctx.globalAlpha = 1;
                ctx.fillStyle = '#ffffff';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(badgeText, bX + bW / 2, bY + bH / 2 + 0.5);
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
        const startInput = document.getElementById('glass-cards-start');
        const durInput = document.getElementById('glass-cards-dur');
        const themeColorInput = document.getElementById('glass-cards-color');
        const cardsListEl = document.getElementById('glass-cards-items-list');
        const addCardBtn = document.getElementById('add-glass-card-item-btn');

        function syncUIFromState() {
            const cfg = state.glassCardStack || DEFAULT_CONFIG;
            if (enableToggle) enableToggle.checked = !!cfg.enabled;
            if (posSelect) posSelect.value = cfg.position || 'bottom-right';
            if (startInput) startInput.value = cfg.startSec != null ? cfg.startSec : 0;
            if (durInput) durInput.value = cfg.durationSec != null ? cfg.durationSec : 5;
            if (themeColorInput) themeColorInput.value = cfg.themeColor || '#38bdf8';

            renderCardsListUI();
        }

        function renderCardsListUI() {
            if (!cardsListEl) return;
            cardsListEl.innerHTML = '';
            const cfg = state.glassCardStack;
            if (!cfg || !cfg.cards) return;

            cfg.cards.forEach((c, idx) => {
                const itemEl = document.createElement('div');
                itemEl.className = 'glass-card-editor-row';
                itemEl.style.cssText = 'background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 10px; margin-bottom: 8px; display: flex; flex-direction: column; gap: 6px;';
                itemEl.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <span style="font-weight: 600; font-size: 13px; color: ${c.color || '#38bdf8'};"><i class="fa-solid fa-layer-group"></i> Card #${idx + 1}</span>
                        <button type="button" class="btn btn-outline gc-del-btn" style="padding: 2px 8px; font-size: 11px; color: #ef4444;"><i class="fa-solid fa-trash"></i></button>
                    </div>
                    <div style="display: grid; grid-template-columns: 48px 1fr; gap: 6px;">
                        <input type="text" class="form-input gc-icon-inp" value="${c.icon || '⚡'}" title="Icon / Emoji" style="text-align: center; font-size: 16px;">
                        <input type="text" class="form-input gc-title-inp" value="${c.title || ''}" placeholder="Card Title">
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 80px; gap: 6px;">
                        <input type="text" class="form-input gc-sub-inp" value="${c.subtitle || ''}" placeholder="Subtitle / Stats">
                        <input type="text" class="form-input gc-badge-inp" value="${c.badge || ''}" placeholder="Badge">
                    </div>
                `;

                // Bind events
                const iconInp = itemEl.querySelector('.gc-icon-inp');
                const titleInp = itemEl.querySelector('.gc-title-inp');
                const subInp = itemEl.querySelector('.gc-sub-inp');
                const badgeInp = itemEl.querySelector('.gc-badge-inp');
                const delBtn = itemEl.querySelector('.gc-del-btn');

                const updateCard = () => {
                    c.icon = iconInp.value;
                    c.title = titleInp.value;
                    c.subtitle = subInp.value;
                    c.badge = badgeInp.value;
                    if (window.triggerCanvasRedraw) window.triggerCanvasRedraw();
                    if (window.triggerAutoSave) window.triggerAutoSave();
                };

                iconInp.addEventListener('input', updateCard);
                titleInp.addEventListener('input', updateCard);
                subInp.addEventListener('input', updateCard);
                badgeInp.addEventListener('input', updateCard);

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

        // Position
        if (posSelect) {
            posSelect.addEventListener('change', (e) => {
                if (state.glassCardStack) state.glassCardStack.position = e.target.value;
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

        // Theme color
        if (themeColorInput) {
            themeColorInput.addEventListener('input', (e) => {
                if (state.glassCardStack) state.glassCardStack.themeColor = e.target.value;
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
                    icon: '🚀',
                    title: 'New Metric Card',
                    subtitle: 'AI Optimized · Active',
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
