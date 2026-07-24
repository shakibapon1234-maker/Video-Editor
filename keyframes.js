/* ==========================================================================
   Studio Flow — Generic Keyframe Animation (Phase 11)

   Lets any overlay (text, sticker, symbol, shape+text, B-roll) animate its
   position (x, y), scale, rotation, and opacity over time using keyframes,
   instead of only having fixed static values.

   v1 SCOPE was position (x, y) only — several overlay types didn't read a
   scale/rotation/opacity value from their render code at the time, so
   keyframing those properties would have silently done nothing for some
   overlay types. v2 (this version) closes that gap: editor.js's render
   code for all five overlay types now reads item.scale / item.rotation /
   item.opacity (defaults 1 / 0 / 100 — visually identical to before if
   unset), so all four properties can be keyframed uniformly for every
   overlay type. See PHASE11_ADVANCED_EDITING_PLAN.txt for the audit that
   confirmed each type's render support before this was extended.

   HOW IT WORKS (and why it's a separate file, not a patch to editor.js):
   Each overlay item gets an optional `item.keyframes` array:
     [{ t: <seconds>, x: <0-1>, y: <0-1>, scale: <number>,
        rotation: <degrees>, opacity: <0-100> }, ...]
   Every animation frame, this module walks the five overlay arrays on
   window.VideoEditor and — for any item that has 2+ keyframes — computes
   the interpolated values for the current playhead time and writes them
   directly onto item.x / item.y / item.scale / item.rotation / item.opacity.
   Because every overlay's render code already reads these directly, this
   is enough to animate it with zero further changes to editor.js.
   Old (v1) keyframes that only have {t, x, y} still work fine — missing
   scale/rotation/opacity on a keyframe fall back to 1 / 0 / 100.

   TIMING: runs on its own persistent requestAnimationFrame loop so it
   applies during normal playback, and also hooks the already-exposed
   window.redrawPausedFrameGlobal() and the #seek-slider input event so
   scrubbing while paused updates immediately too.
   ========================================================================== */
(function () {
    'use strict';

    var OVERLAY_ARRAYS = ['textOverlays', 'stickers', 'symbolOverlays', 'shapeOverlays', 'brollOverlays'];
    var SNAP_TOLERANCE_SEC = 0.05;

    function ve() { return window.VideoEditor || null; }

    function easeInOutCubic(p) {
        return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    }

    // Reads a keyframe's property with a fallback default, so old (v1)
    // keyframes that only recorded {t, x, y} still interpolate cleanly for
    // scale/rotation/opacity instead of producing NaN/undefined.
    function kfProp(kf, key, def) {
        var v = kf[key];
        return (v == null || isNaN(v)) ? def : v;
    }

    function applyKeyframesToItem(item, currentTime) {
        var kfs = item.keyframes;
        if (!kfs || kfs.length < 2) return;

        function write(kf) {
            item.x = kf.x; item.y = kf.y;
            item.scale = kfProp(kf, 'scale', 1);
            item.rotation = kfProp(kf, 'rotation', 0);
            item.opacity = kfProp(kf, 'opacity', 100);
        }

        if (currentTime <= kfs[0].t) { write(kfs[0]); return; }
        var last = kfs[kfs.length - 1];
        if (currentTime >= last.t) { write(last); return; }
        for (var i = 0; i < kfs.length - 1; i++) {
            var a = kfs[i], b = kfs[i + 1];
            if (currentTime >= a.t && currentTime <= b.t) {
                var span = b.t - a.t;
                var p = span <= 0 ? 1 : (currentTime - a.t) / span;
                var eased = easeInOutCubic(p);
                item.x = a.x + (b.x - a.x) * eased;
                item.y = a.y + (b.y - a.y) * eased;
                var aScale = kfProp(a, 'scale', 1), bScale = kfProp(b, 'scale', 1);
                var aRot = kfProp(a, 'rotation', 0), bRot = kfProp(b, 'rotation', 0);
                var aOp = kfProp(a, 'opacity', 100), bOp = kfProp(b, 'opacity', 100);
                item.scale = aScale + (bScale - aScale) * eased;
                item.rotation = aRot + (bRot - aRot) * eased;
                item.opacity = aOp + (bOp - aOp) * eased;
                return;
            }
        }
    }

    function applyAllKeyframes() {
        var editor = ve();
        if (!editor) return;
        var t = editor.currentTime || 0;
        OVERLAY_ARRAYS.forEach(function (key) {
            var arr = editor[key];
            if (!arr || !arr.length) return;
            for (var i = 0; i < arr.length; i++) {
                if (arr[i].keyframes && arr[i].keyframes.length >= 2) {
                    applyKeyframesToItem(arr[i], t);
                }
            }
        });
    }

    // --- Persistent render loop (covers normal playback preview) ---
    function loop() {
        applyAllKeyframes();
        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    // --- Wrap the actual render entry points so keyframes are guaranteed
    //     to be applied immediately before every draw, in both preview AND
    //     export. window.drawEditorFrame is what exporter.js calls
    //     frame-by-frame during export (frame-accurate, not tied to rAF),
    //     so wrapping it — rather than relying only on the rAF loop above —
    //     is what makes keyframed animation actually show up in the
    //     exported video, not just live preview.
    function hookRenderEntryPoints() {
        var hookedAny = false;
        if (window.drawEditorFrame && !window.drawEditorFrame.__kfWrapped) {
            var originalDraw = window.drawEditorFrame;
            var wrappedDraw = function () {
                applyAllKeyframes();
                return originalDraw.apply(this, arguments);
            };
            wrappedDraw.__kfWrapped = true;
            window.drawEditorFrame = wrappedDraw;
            hookedAny = true;
        }
        if (window.redrawPausedFrameGlobal && !window.redrawPausedFrameGlobal.__kfWrapped) {
            var originalRedraw = window.redrawPausedFrameGlobal;
            var wrappedRedraw = function () {
                applyAllKeyframes();
                return originalRedraw.apply(this, arguments);
            };
            wrappedRedraw.__kfWrapped = true;
            window.redrawPausedFrameGlobal = wrappedRedraw;
            hookedAny = true;
        }
        return hookedAny;
    }
    // editor.js may not have finished running yet depending on load order,
    // so retry briefly until both hook targets exist.
    var hookAttempts = 0;
    var hookTimer = setInterval(function () {
        hookAttempts++;
        var bothHooked = window.drawEditorFrame && window.drawEditorFrame.__kfWrapped &&
                          window.redrawPausedFrameGlobal && window.redrawPausedFrameGlobal.__kfWrapped;
        hookRenderEntryPoints();
        if (bothHooked || hookAttempts > 50) {
            clearInterval(hookTimer);
        }
    }, 100);

    document.addEventListener('DOMContentLoaded', function () {
        var seekSlider = document.getElementById('seek-slider');
        if (seekSlider) {
            seekSlider.addEventListener('input', function () { applyAllKeyframes(); });
        }
    });

    // ==========================================================================
    // Keyframe Panel UI
    // ==========================================================================

    var OVERLAY_CONFIG = [
        { arrayKey: 'textOverlays', selectedKey: 'selectedTextOverlayId', label: 'Text', icon: 'fa-font', nameOf: function (item) { return item.text || 'Text'; } },
        { arrayKey: 'stickers', selectedKey: 'selectedStickerId', label: 'Sticker', icon: 'fa-icons', nameOf: function (item) { return item.emoji || 'Sticker'; } },
        { arrayKey: 'symbolOverlays', selectedKey: 'selectedSymbolId', label: 'Symbol', icon: 'fa-shapes', nameOf: function (item) { return item.symbolType || 'Symbol'; } },
        { arrayKey: 'shapeOverlays', selectedKey: 'selectedShapeOverlayId', label: 'Shape', icon: 'fa-vector-square', nameOf: function (item) { return item.text || 'Shape'; } },
        { arrayKey: 'brollOverlays', selectedKey: 'selectedBrollId', label: 'B-roll', icon: 'fa-image', nameOf: function (item) { return item.name || 'B-roll'; } }
    ];

    var mountEl, panelRenderTimer;

    function getSelectedOverlay() {
        var editor = ve();
        if (!editor) return null;
        for (var i = 0; i < OVERLAY_CONFIG.length; i++) {
            var cfg = OVERLAY_CONFIG[i];
            var selectedId = editor[cfg.selectedKey];
            if (selectedId === null || selectedId === undefined) continue;
            var arr = editor[cfg.arrayKey];
            if (!arr) continue;
            var item = arr.find(function (it) { return it.id === selectedId; });
            if (item) return { item: item, cfg: cfg };
        }
        return null;
    }

    function fmtTime(sec) {
        sec = Math.max(0, sec || 0);
        var m = Math.floor(sec / 60);
        var s = (sec % 60).toFixed(1);
        return (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
    }

    function renderPanel() {
        if (!mountEl) return;
        // Don't rebuild (and interrupt an in-progress drag) while the user
        // is actively focused on one of this panel's own slider inputs —
        // the periodic timer would otherwise yank the DOM out from under
        // their cursor every 150ms.
        if (mountEl.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') {
            return;
        }

        var selection = getSelectedOverlay();
        var editor = ve();

        if (!selection || !editor || !editor.duration) {
            mountEl.innerHTML = '';
            return;
        }

        var item = selection.item, cfg = selection.cfg;
        if (!item.keyframes) item.keyframes = [];

        var duration0 = editor.duration;
        var currentTime0 = editor.currentTime || 0;
        var playheadPct0 = Math.min(100, Math.max(0, (currentTime0 / duration0) * 100));

        // This function runs both on real state changes (button clicks,
        // keyframe add/remove) AND on a 150ms poll timer whose only job is to
        // keep the playhead marker moving during playback. Unconditionally
        // rebuilding innerHTML on every poll tick destroys and recreates the
        // interactive elements — including the disclosure button below — on
        // every tick, which can silently swallow a click if the tick lands
        // between mousedown and mouseup on it (the element the browser
        // tracked the press on no longer exists when it looks for a click
        // target). So: only fully rebuild when what's being shown actually
        // changed; otherwise just nudge the playhead marker in place.
        var renderKey = item.id + ':' + !!item.keyframeEditorOpen + ':' + item.keyframes.length;
        if (mountEl.__kfRenderKey === renderKey) {
            var existingPlayhead0 = mountEl.querySelector('.keyframe-track-playhead');
            if (existingPlayhead0) existingPlayhead0.style.left = playheadPct0 + '%';
            return;
        }
        mountEl.__kfRenderKey = renderKey;

        // Keyframes are an advanced, optional animation tool. Keeping their
        // full editor open for every selected overlay makes ordinary drag /
        // resize work feel like it has been replaced, even though it has not.
        // Start collapsed until the user explicitly asks to animate an item.
        if (!item.keyframeEditorOpen) {
            mountEl.innerHTML =
                '<button class="keyframe-disclosure" id="kf-open-btn" type="button" title="সময় অনুযায়ী position, size, rotation বা opacity পরিবর্তন করুন">' +
                    '<i class="fa-solid fa-wand-magic-sparkles"></i> Animate this ' + cfg.label + ' (optional)' +
                '</button>';
            var openBtn = document.getElementById('kf-open-btn');
            if (openBtn) openBtn.addEventListener('click', function () {
                item.keyframeEditorOpen = true;
                renderPanel();
            });
            return;
        }

        var duration = editor.duration;
        var currentTime = editor.currentTime || 0;
        var playheadPct = Math.min(100, Math.max(0, (currentTime / duration) * 100));

        var markersHtml = item.keyframes.map(function (kf, idx) {
            var pct = Math.min(100, Math.max(0, (kf.t / duration) * 100));
            return '<div class="keyframe-marker" data-kf-index="' + idx + '" style="left:' + pct + '%;" title="' + fmtTime(kf.t) + '"></div>';
        }).join('');

        var listHtml = item.keyframes.length
            ? item.keyframes.map(function (kf, idx) {
                return '<div class="keyframe-list-item">' +
                    '<span><i class="fa-solid fa-diamond" style="font-size:8px; margin-right:6px;"></i>' + fmtTime(kf.t) + '</span>' +
                    '<button data-remove-index="' + idx + '" title="Remove"><i class="fa-solid fa-xmark"></i></button>' +
                    '</div>';
            }).join('')
            : '<div class="keyframe-hint">এখনো কোনো কীফ্রেম নেই — কমপক্ষে ২টা দিলে position/scale/rotation/opacity animation শুরু হবে (Add at least 2 to animate)</div>';

        var curScale = item.scale ?? 1;
        var curRotation = item.rotation ?? 0;
        var curOpacity = item.opacity ?? 100;

        mountEl.innerHTML =
            '<div class="keyframe-panel">' +
                '<div class="keyframe-panel-header">' +
                    '<span class="keyframe-panel-title"><i class="fa-solid ' + cfg.icon + '"></i> ' + cfg.label + ' Keyframes — "' + escapeHtml(String(cfg.nameOf(item)).slice(0, 24)) + '"</span>' +
                    '<span class="keyframe-panel-actions"><button class="keyframe-close-btn" id="kf-close-btn" type="button" title="Close animation controls"><i class="fa-solid fa-xmark"></i></button><button class="keyframe-add-btn" id="kf-add-btn" type="button"><i class="fa-solid fa-plus"></i> Set Keyframe (' + fmtTime(currentTime) + ')</button></span>' +
                '</div>' +
                '<div class="keyframe-prop-controls">' +
                    '<div class="slider-val-container"><label style="min-width:56px; font-size:12px;">Scale</label>' +
                        '<input type="range" id="kf-scale-slider" min="0.3" max="3" step="0.05" value="' + curScale + '">' +
                        '<span id="kf-scale-val">' + curScale.toFixed(2) + 'x</span></div>' +
                    '<div class="slider-val-container"><label style="min-width:56px; font-size:12px;">Rotation</label>' +
                        '<input type="range" id="kf-rotation-slider" min="-180" max="180" step="1" value="' + curRotation + '">' +
                        '<span id="kf-rotation-val">' + Math.round(curRotation) + '°</span></div>' +
                    '<div class="slider-val-container"><label style="min-width:56px; font-size:12px;">Opacity</label>' +
                        '<input type="range" id="kf-opacity-slider" min="0" max="100" step="1" value="' + curOpacity + '">' +
                        '<span id="kf-opacity-val">' + Math.round(curOpacity) + '%</span></div>' +
                '</div>' +
                '<div class="keyframe-track" id="kf-track">' +
                    '<div class="keyframe-track-playhead" style="left:' + playheadPct + '%;"></div>' +
                    markersHtml +
                '</div>' +
                '<div class="keyframe-list">' + listHtml + '</div>' +
            '</div>';

        var addBtn = document.getElementById('kf-add-btn');
        if (addBtn) {
            addBtn.addEventListener('click', function () {
                addOrUpdateKeyframe(item, currentTime);
            });
        }

        var closeBtn = document.getElementById('kf-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', function () {
                item.keyframeEditorOpen = false;
                renderPanel();
            });
        }

        var scaleSlider = document.getElementById('kf-scale-slider');
        var scaleVal = document.getElementById('kf-scale-val');
        if (scaleSlider) {
            scaleSlider.addEventListener('input', function (e) {
                item.scale = parseFloat(e.target.value) || 1;
                if (scaleVal) scaleVal.textContent = item.scale.toFixed(2) + 'x';
                if (window.redrawPausedFrameGlobal) window.redrawPausedFrameGlobal();
            });
        }
        var rotationSlider = document.getElementById('kf-rotation-slider');
        var rotationVal = document.getElementById('kf-rotation-val');
        if (rotationSlider) {
            rotationSlider.addEventListener('input', function (e) {
                item.rotation = parseFloat(e.target.value) || 0;
                if (rotationVal) rotationVal.textContent = Math.round(item.rotation) + '°';
                if (window.redrawPausedFrameGlobal) window.redrawPausedFrameGlobal();
            });
        }
        var opacitySlider = document.getElementById('kf-opacity-slider');
        var opacityVal = document.getElementById('kf-opacity-val');
        if (opacitySlider) {
            opacitySlider.addEventListener('input', function (e) {
                item.opacity = parseFloat(e.target.value);
                if (isNaN(item.opacity)) item.opacity = 100;
                if (opacityVal) opacityVal.textContent = Math.round(item.opacity) + '%';
                if (window.redrawPausedFrameGlobal) window.redrawPausedFrameGlobal();
            });
        }

        mountEl.querySelectorAll('[data-remove-index]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var idx = parseInt(btn.getAttribute('data-remove-index'), 10);
                item.keyframes.splice(idx, 1);
                renderPanel();
                if (window.redrawPausedFrameGlobal) window.redrawPausedFrameGlobal();
            });
        });
    }

    function addOrUpdateKeyframe(item, t) {
        if (!item.keyframes) item.keyframes = [];
        var existingIdx = item.keyframes.findIndex(function (kf) { return Math.abs(kf.t - t) < SNAP_TOLERANCE_SEC; });
        var newKf = {
            t: t,
            x: item.x,
            y: item.y,
            scale: item.scale ?? 1,
            rotation: item.rotation ?? 0,
            opacity: item.opacity ?? 100
        };
        if (existingIdx >= 0) {
            item.keyframes[existingIdx] = newKf;
        } else {
            item.keyframes.push(newKf);
        }
        item.keyframes.sort(function (a, b) { return a.t - b.t; });
        renderPanel();
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function initPanel() {
        mountEl = document.getElementById('keyframe-panel-mount');
        if (!mountEl) return;
        // Poll-render at a modest rate — this is UI bookkeeping, not the
        // animation loop itself, so it doesn't need to run at 60fps.
        panelRenderTimer = setInterval(renderPanel, 150);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPanel);
    } else {
        initPanel();
    }
})();
