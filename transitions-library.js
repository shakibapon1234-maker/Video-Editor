/* ==========================================================================
   Studio Flow — Timeline Transitions Library (Phase 11)

   Extends the existing "Clip Transition" feature (phase9.js), which already
   applies a transitionType/transitionDuration stored on each clip, with:

     1. A small categorized transition palette (Fade, Slide, Wipe, Zoom,
        Glitch) that can be DRAGGED and dropped directly onto the gap
        between two clips in the clip timeline — instead of having to
        select the outgoing clip first and then use the dropdown.
     2. A new "Digital Glitch" transition type. Its actual rendering (canvas
        crossfade + chromatic-aberration ghosting + slice tearing) lives in
        phase9.js next to the other transition render branches, since that's
        where every other transition type's drawing code already is.

   This file does NOT touch editor.js. It only:
     - reads/writes `clip.transitionType` / `clip.transitionDuration`, which
       phase9.js already reads every frame (computeTransitionBlend) and
       already persists (clip objects are saved as-is via {...c} in the
       project save code) — so no save/load changes are needed.
     - wraps the already-exposed window.renderClipTimeline() so a small
       drop-zone strip appears between every pair of clip blocks, in the
       same style as keyframes.js wrapping window.drawEditorFrame.

   SCOPE: UI (drag-and-drop transition picker) + one new render effect
   (Glitch). The existing crossfade/wipe/zoom/push rendering is untouched.
   See PHASE11_ADVANCED_EDITING_PLAN.txt.
   ========================================================================== */
(function () {
    'use strict';

    function ve() { return window.VideoEditor || null; }

    // Library grouped the same way as the dropdown's <optgroup>s.
    var LIBRARY = [
        {
            label: 'Fade', icon: 'fa-circle-half-stroke',
            items: [
                { type: 'crossfade', label: 'Crossfade' },
                { type: 'dip_black', label: 'Dip to Black' }
            ]
        },
        {
            label: 'Slide', icon: 'fa-arrow-right-arrow-left',
            items: [
                { type: 'push_right', label: 'Push Right' },
                { type: 'push_left', label: 'Push Left' }
            ]
        },
        {
            label: 'Wipe', icon: 'fa-droplet',
            items: [
                { type: 'wipe_right', label: 'Wipe Right' },
                { type: 'wipe_left', label: 'Wipe Left' }
            ]
        },
        {
            label: 'Zoom', icon: 'fa-magnifying-glass',
            items: [
                { type: 'zoom_in', label: 'Zoom In' },
                { type: 'zoom_out', label: 'Zoom Out' },
                { type: 'spin_in', label: 'Spin In' },
                { type: 'spin_out', label: 'Spin Out' },
                { type: 'zoom_rotate', label: 'Zoom + Rotate' }
            ]
        },
        {
            label: 'Glitch', icon: 'fa-bolt',
            items: [
                { type: 'glitch', label: 'Digital Glitch' }
            ]
        },
        {
            label: '3D Motion', icon: 'fa-cube',
            items: [
                { type: 'flip_3d_y', label: '3D Flip Left/Right' },
                { type: 'flip_3d_x', label: '3D Flip Up/Down' },
                { type: 'spin_3d', label: '3D Spin Rotate' }
            ]
        },
        {
            label: 'Smoke & Fog', icon: 'fa-smog',
            items: [
                { type: 'smoke_dissolve', label: 'Smoke Dissolve' }
            ]
        }
    ];

    var TYPE_ICON = {
        none: 'fa-slash', crossfade: 'fa-circle-half-stroke', dip_black: 'fa-circle-half-stroke',
        push_right: 'fa-arrow-right-arrow-left', push_left: 'fa-arrow-right-arrow-left',
        wipe_right: 'fa-droplet', wipe_left: 'fa-droplet',
        zoom_in: 'fa-magnifying-glass', zoom_out: 'fa-magnifying-glass',
        spin_in: 'fa-magnifying-glass', spin_out: 'fa-magnifying-glass', zoom_rotate: 'fa-magnifying-glass',
        glitch: 'fa-bolt', flip_3d_y: 'fa-cube', flip_3d_x: 'fa-cube', spin_3d: 'fa-cube', smoke_dissolve: 'fa-smog'
    };

    function afterAssign(label) {
        var state = ve();
        if (window.captureUndoCheckpoint) window.captureUndoCheckpoint();
        if (window.recordEditorHistory) window.recordEditorHistory(label);
        if (window.syncPhase9ClipUI) window.syncPhase9ClipUI();
        if (window.drawEditorFrame) window.drawEditorFrame();
        if (typeof window.triggerAutoSave === 'function') window.triggerAutoSave();
    }

    // ---------------------------------------------------------------
    // Palette (draggable transition badges), mounted once next to the
    // existing Transition Style dropdown.
    // ---------------------------------------------------------------
    function buildPalette() {
        var mount = document.getElementById('transition-library-mount');
        if (!mount || mount.dataset.tlBuilt) return;
        mount.dataset.tlBuilt = '1';

        var wrap = document.createElement('div');
        wrap.className = 'transition-library-palette';
        wrap.style.display = 'flex';
        wrap.style.flexWrap = 'wrap';
        wrap.style.gap = '6px';
        wrap.style.margin = '10px 0';

        var hint = document.createElement('p');
        hint.className = 'help-text';
        hint.innerText = 'অথবা নিচের যেকোনো ট্রানজিশন ধরে টেনে (drag) দুই ক্লিপের মাঝের ফাঁকে ছেড়ে দিন:';
        hint.style.width = '100%';
        hint.style.marginBottom = '2px';
        wrap.appendChild(hint);

        LIBRARY.forEach(function (group) {
            group.items.forEach(function (item) {
                var badge = document.createElement('div');
                badge.className = 'transition-badge';
                badge.draggable = true;
                badge.title = group.label + ' – ' + item.label;
                badge.innerHTML = '<i class="fa-solid ' + group.icon + '"></i><span>' + item.label + '</span>';
                badge.style.display = 'flex';
                badge.style.alignItems = 'center';
                badge.style.gap = '5px';
                badge.style.padding = '5px 9px';
                badge.style.fontSize = '11px';
                badge.style.borderRadius = '999px';
                badge.style.border = '1px solid var(--border-color)';
                badge.style.background = 'rgba(255,255,255,0.04)';
                badge.style.cursor = 'grab';
                badge.style.userSelect = 'none';

                badge.addEventListener('dragstart', function (e) {
                    e.dataTransfer.setData('text/studioflow-transition', item.type);
                    e.dataTransfer.effectAllowed = 'copy';
                    badge.style.opacity = '0.5';
                });
                badge.addEventListener('dragend', function () {
                    badge.style.opacity = '1';
                });

                wrap.appendChild(badge);
            });
        });

        mount.appendChild(wrap);
    }

    // ---------------------------------------------------------------
    // Gap drop-zones injected between clip-timeline-block elements.
    // ---------------------------------------------------------------
    function assignTransition(clipIndex, type) {
        var state = ve();
        if (!state || !state.clips || clipIndex < 0 || clipIndex >= state.clips.length - 1) return;
        var incoming = state.clips[clipIndex + 1];
        incoming.transitionType = type;
        if (incoming.transitionDuration == null || isNaN(incoming.transitionDuration)) {
            incoming.transitionDuration = 0.5;
        }
        rebuildGaps();
        afterAssign(type === 'none' ? 'Transition removed' : 'Transition set (' + type + ')');
    }

    function rebuildGaps() {
        var state = ve();
        var listEl = document.getElementById('clip-timeline-list');
        if (!listEl || !state || !state.clips) return;

        // Remove any gap zones from a previous pass.
        var oldGaps = listEl.querySelectorAll('.transition-gap-zone');
        oldGaps.forEach(function (g) { g.remove(); });

        var blocks = listEl.querySelectorAll('.clip-timeline-block');
        if (blocks.length < 2) return;

        for (var i = 0; i < blocks.length - 1; i++) {
            var incoming = state.clips[i + 1];
            var gap = document.createElement('div');
            gap.className = 'transition-gap-zone';
            gap.style.display = 'flex';
            gap.style.alignItems = 'center';
            gap.style.justifyContent = 'center';
            gap.style.gap = '5px';
            gap.style.margin = '-2px 0 4px 18px';
            gap.style.padding = '3px 8px';
            gap.style.width = 'fit-content';
            gap.style.fontSize = '10px';
            gap.style.borderRadius = '999px';
            gap.style.cursor = 'pointer';
            gap.style.border = '1px dashed var(--border-hover)';
            gap.style.color = 'var(--text-secondary)';

            var hasTransition = incoming && incoming.transitionType && incoming.transitionType !== 'none';
            var icon = TYPE_ICON[(incoming && incoming.transitionType) || 'none'] || 'fa-plus';
            gap.innerHTML = '<i class="fa-solid ' + icon + '"></i>' +
                '<span>' + (hasTransition ? incoming.transitionType : 'কোনো ট্রানজিশন নেই') + '</span>';
            gap.title = hasTransition
                ? 'ক্লিক করে সরান, অথবা এখানে নতুন ট্রানজিশন টেনে ছাড়ুন'
                : 'এখানে একটা ট্রানজিশন টেনে ছাড়ুন';

            if (hasTransition) {
                gap.style.background = 'rgba(79, 70, 229, 0.15)';
                gap.style.borderStyle = 'solid';
                gap.style.borderColor = 'var(--primary)';
                gap.style.color = 'var(--text-primary)';
            }

            (function (idx) {
                gap.addEventListener('dragover', function (e) {
                    e.preventDefault();
                    gap.style.borderColor = 'var(--primary)';
                });
                gap.addEventListener('dragleave', function () {
                    gap.style.borderColor = hasTransition ? 'var(--primary)' : 'var(--border-hover)';
                });
                gap.addEventListener('drop', function (e) {
                    e.preventDefault();
                    var type = e.dataTransfer.getData('text/studioflow-transition');
                    if (!type) return;
                    assignTransition(idx, type);
                });
                gap.addEventListener('click', function () {
                    if (hasTransition) assignTransition(idx, 'none');
                });
            })(i);

            blocks[i].insertAdjacentElement('afterend', gap);
        }
    }

    // Wrap window.renderClipTimeline once it exists, so every re-render of
    // the clip list also refreshes the gap zones (mirrors keyframes.js's
    // approach for window.drawEditorFrame).
    function hookRenderClipTimeline() {
        if (window.renderClipTimeline && !window.renderClipTimeline.__tlWrapped) {
            var original = window.renderClipTimeline;
            var wrapped = function () {
                original.apply(this, arguments);
                rebuildGaps();
            };
            wrapped.__tlWrapped = true;
            window.renderClipTimeline = wrapped;
            return true;
        }
        return !!(window.renderClipTimeline && window.renderClipTimeline.__tlWrapped);
    }

    function init() {
        buildPalette();
        var hookTimer = setInterval(function () {
            if (hookRenderClipTimeline()) {
                clearInterval(hookTimer);
                rebuildGaps();
            }
        }, 200);
        setTimeout(function () { clearInterval(hookTimer); }, 15000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
