// Punch Zoom UI — momentary "zoom into a point for a few seconds" effect.
// Works on top of the transform math added in phase9.js
// (window.phase9ApplyPunchZoomTransform / clip.punchZooms). This file only
// wires up the sidebar panel: add / edit / delete zoom points for whichever
// clip is currently active, and keeps the list + sliders in sync with it.
(function () {
    'use strict';

    function ve() { return window.VideoEditor || null; }

    function getActiveClip() {
        var state = ve();
        if (!state || !state.clips) return null;
        return state.clips.find(function (c) { return c.id === state.activeClipId; });
    }

    function fmtTime(sec) {
        sec = Math.max(0, sec || 0);
        var m = Math.floor(sec / 60);
        var s = (sec % 60).toFixed(1);
        return m + ':' + (s < 10 ? '0' : '') + s;
    }

    var scaleSlider, scaleVal, durationSlider, durationVal, focusXSlider, focusXVal,
        focusYSlider, focusYVal, addBtn, updateBtn, listEl, pickBtn;

    function setPickBtnActive(isActive) {
        if (!pickBtn) return;
        pickBtn.style.background = isActive ? 'rgba(99,102,241,0.35)' : '';
        pickBtn.innerHTML = isActive ?
            '<i class="fa-solid fa-crosshairs"></i> ভিডিওতে ক্লিক/ড্র্যাগ করুন — শেষ হলে আবার চাপুন / Click video — tap again to stop' :
            '<i class="fa-solid fa-crosshairs"></i> ভিডিওতে ক্লিক করে ফোকাস বসান / Pick focus on video';
    }

    function stopPunchZoomPicking() {
        var state = ve();
        if (state) {
            state.isPunchZoomPicking = false;
            if (state.canvas) state.canvas.style.cursor = 'default';
        }
        setPickBtnActive(false);
    }

    var selectedId = null; // id of the punch zoom point currently loaded into the sliders for editing

    function currentFormValues() {
        return {
            scale: (parseInt(scaleSlider.value, 10) || 140) / 100,
            duration: parseFloat(durationSlider.value) || 2,
            focusX: (parseInt(focusXSlider.value, 10) || 50) / 100,
            focusY: (parseInt(focusYSlider.value, 10) || 50) / 100
        };
    }

    function uid() {
        return 'pz_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    }

    function renderList() {
        if (!listEl) return;
        var state = ve();
        var clip = getActiveClip();
        if (!state || !clip || !Array.isArray(clip.punchZooms) || !clip.punchZooms.length) {
            listEl.innerHTML = '<div class="help-text">এখনো কোনো Punch Zoom পয়েন্ট নেই। প্লেহেড একটা জায়গায় নিয়ে "Add at current time" চাপুন।</div>';
            if (updateBtn) updateBtn.style.display = 'none';
            return;
        }
        var sorted = clip.punchZooms.slice().sort(function (a, b) { return (a.time || 0) - (b.time || 0); });
        listEl.innerHTML = sorted.map(function (pz) {
            var active = pz.id === selectedId;
            return '' +
                '<div class="pz-row" data-pz-id="' + pz.id + '" style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;margin-bottom:4px;border-radius:6px;cursor:pointer;background:' + (active ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.04)') + ';">' +
                '<span style="font-size:13px;">' + fmtTime(pz.time) + ' + ' + (pz.duration || 2).toFixed(1) + 's &middot; ' + Math.round((pz.scale || 1.4) * 100) + '%</span>' +
                '<button class="btn-icon pz-remove" data-pz-remove="' + pz.id + '" title="Remove" style="border:none;background:transparent;color:var(--text-secondary);cursor:pointer;"><i class="fa-solid fa-trash"></i></button>' +
                '</div>';
        }).join('');

        listEl.querySelectorAll('.pz-row').forEach(function (row) {
            row.addEventListener('click', function (e) {
                if (e.target.closest('[data-pz-remove]')) return;
                var id = row.getAttribute('data-pz-id');
                var pz = clip.punchZooms.find(function (p) { return p.id === id; });
                if (!pz) return;
                selectedId = id;
                scaleSlider.value = Math.round((pz.scale || 1.4) * 100);
                durationSlider.value = pz.duration || 2;
                focusXSlider.value = Math.round((pz.focusX != null ? pz.focusX : 0.5) * 100);
                focusYSlider.value = Math.round((pz.focusY != null ? pz.focusY : 0.5) * 100);
                syncLabels();
                if (updateBtn) updateBtn.style.display = 'block';
                renderList();
                // Jump the playhead to the PEAK of this zoom point (its midpoint)
                // rather than its start — the bell-curve effect is at 0% strength
                // right at the start/end of the window, so seeking to the start
                // showed no zoom at all and made the sliders look broken.
                var peakTime = (pz.time || 0) + Math.max(0.1, pz.duration || 1.5) / 2;
                if (state.video && clip.type !== 'image') {
                    state.currentTime = (state.startTime || 0) + peakTime;
                    if (window.updatePlayhead) window.updatePlayhead();
                    state.video.currentTime = state.currentTime;
                } else {
                    state.currentTime = (state.startTime || 0) + peakTime;
                    if (window.updatePlayhead) window.updatePlayhead();
                }
                updateLivePreview();
            });
        });
        listEl.querySelectorAll('[data-pz-remove]').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                var id = btn.getAttribute('data-pz-remove');
                clip.punchZooms = clip.punchZooms.filter(function (p) { return p.id !== id; });
                if (selectedId === id) {
                    selectedId = null;
                    if (updateBtn) updateBtn.style.display = 'none';
                }
                if (window.recordEditorHistory) window.recordEditorHistory('Punch zoom removed');
                if (window.drawEditorFrame) window.drawEditorFrame();
                renderList();
            });
        });
    }

    function syncLabels() {
        if (scaleVal) scaleVal.textContent = scaleSlider.value + '%';
        if (durationVal) durationVal.textContent = parseFloat(durationSlider.value).toFixed(1) + 's';
        if (focusXVal) focusXVal.textContent = focusXSlider.value + '%';
        if (focusYVal) focusYVal.textContent = focusYSlider.value + '%';
    }

    // While the user is actively dragging any Punch Zoom slider, show the
    // effect on the canvas at full strength (see phase9.js's punchZoomLivePreview
    // check) regardless of where the playhead sits, so Focus X/Y changes are
    // visible immediately instead of only inside the effect's time window.
    function updateLivePreview() {
        var state = ve();
        if (!state) return;
        // The preview override in phase9.js is intentionally skipped while
        // state.isPlaying is true (so it never fights with normal playback
        // timing). But that means if the user drags a slider while the video
        // happens to be playing, nothing visibly changes — the old committed
        // values just keep looping on their normal timed schedule, which is
        // exactly what looked like "the video snaps back no matter where I
        // drag." Auto-pause so the drag is always reflected immediately.
        if (state.isPlaying && window.pauseVideoForExport) {
            window.pauseVideoForExport();
        }
        var v = currentFormValues();
        var clip = getActiveClip();

        // Write the dragged values straight onto the point being edited,
        // right now — not just as a temporary overlay that gets thrown away
        // once the drag ends. That "throw away on release" behavior was
        // exactly the bug: while paused and adjusting a point, there is
        // nothing to revert to once we do this, because the real data
        // already matches what's on screen. A point that hasn't been added
        // yet has no object to write into, so it stays preview-only until
        // "Add at current time" is pressed.
        if (clip && selectedId) {
            var pz = (clip.punchZooms || []).find(function (p) { return p.id === selectedId; });
            if (pz) {
                pz.scale = v.scale;
                pz.duration = v.duration;
                pz.focusX = v.focusX;
                pz.focusY = v.focusY;
            }
        }

        state.punchZoomLivePreview = { scale: v.scale, focusX: v.focusX, focusY: v.focusY, clipId: clip ? clip.id : null };
        if (window.drawEditorFrame) window.drawEditorFrame();
    }

    function clearLivePreview() {
        var state = ve();
        if (!state || !state.punchZoomLivePreview) return;
        state.punchZoomLivePreview = null;
        if (window.drawEditorFrame) window.drawEditorFrame();
    }

    function syncPunchZoomUI() {
        var clip = getActiveClip();
        clearLivePreview();
        stopPunchZoomPicking();
        if (!clip) return;
        if (!Array.isArray(clip.punchZooms)) clip.punchZooms = [];
        selectedId = null;
        if (updateBtn) updateBtn.style.display = 'none';
        renderList();
    }
    window.syncPunchZoomUI = syncPunchZoomUI;

    function wireEvents() {
        if (addBtn) {
            addBtn.addEventListener('click', function () {
                var state = ve();
                var clip = getActiveClip();
                if (!state || !clip) return;
                if (!Array.isArray(clip.punchZooms)) clip.punchZooms = [];
                var v = currentFormValues();
                var timeInClip = Math.max(0, (state.currentTime || 0) - (state.startTime || 0));
                var newPz = {
                    id: uid(),
                    time: timeInClip,
                    duration: v.duration,
                    scale: v.scale,
                    focusX: v.focusX,
                    focusY: v.focusY
                };
                clip.punchZooms.push(newPz);
                selectedId = newPz.id;
                if (updateBtn) updateBtn.style.display = 'block';
                // Move the playhead to the peak of the new window so the
                // effect is visible right away instead of sitting at the
                // start, where it's still at 0% strength.
                var addPeakTime = timeInClip + Math.max(0.1, v.duration) / 2;
                state.currentTime = (state.startTime || 0) + addPeakTime;
                if (window.updatePlayhead) window.updatePlayhead();
                if (state.video && clip.type !== 'image') state.video.currentTime = state.currentTime;
                if (window.recordEditorHistory) window.recordEditorHistory('Punch zoom added');
                updateLivePreview();
                renderList();
            });
        }

        if (updateBtn) {
            updateBtn.addEventListener('click', function () {
                var state = ve();
                var clip = getActiveClip();
                if (!state || !clip || !selectedId) return;
                var pz = (clip.punchZooms || []).find(function (p) { return p.id === selectedId; });
                if (!pz) return;
                var v = currentFormValues();
                pz.duration = v.duration;
                pz.scale = v.scale;
                pz.focusX = v.focusX;
                pz.focusY = v.focusY;
                var updatedPeakTime = (pz.time || 0) + Math.max(0.1, v.duration) / 2;
                state.currentTime = (state.startTime || 0) + updatedPeakTime;
                if (window.updatePlayhead) window.updatePlayhead();
                if (state.video && clip.type !== 'image') state.video.currentTime = state.currentTime;
                if (window.recordEditorHistory) window.recordEditorHistory('Punch zoom updated');
                clearLivePreview();
                if (window.drawEditorFrame) window.drawEditorFrame();
                renderList();
            });
        }

        [scaleSlider, durationSlider, focusXSlider, focusYSlider].forEach(function (el) {
            if (!el) return;
            el.addEventListener('input', function () {
                syncLabels();
                updateLivePreview();
            });
            // Previously 'change'/'blur' called clearLivePreview() here, which
            // snapped the canvas back to whatever was committed *before* this
            // drag — since the drag itself hadn't been saved anywhere yet.
            // That was the "zooms then immediately jumps back" bug. Now that
            // updateLivePreview() commits the value onto the point directly
            // (above), there's nothing stale to revert to, so we just leave
            // it as edited. The only thing that should hand control back to
            // the timed bell-curve animation is actual playback starting —
            // see the onPlaybackStart hook in init() below.
            el.addEventListener('change', function () { renderList(); });
        });

        if (pickBtn) {
            pickBtn.addEventListener('click', function () {
                var state = ve();
                if (!state) return;
                state.isPunchZoomPicking = !state.isPunchZoomPicking;
                if (state.isPunchZoomPicking) {
                    setPickBtnActive(true);
                    if (state.canvas) state.canvas.style.cursor = 'crosshair';
                    updateLivePreview();
                } else {
                    stopPunchZoomPicking();
                }
            });
        }
    }

    // Called from editor.js's canvas pointerdown/pointermove handlers while
    // state.isPunchZoomPicking is on: fx/fy are 0-1 fractions of the video
    // frame where the user clicked or dragged to. Moves the Focus X/Y
    // sliders to match and commits it live, same as dragging them by hand.
    window.__setPunchZoomFocusFromClick = function (fx, fy) {
        if (!focusXSlider || !focusYSlider) return;
        focusXSlider.value = Math.round(Math.max(0, Math.min(1, fx)) * 100);
        focusYSlider.value = Math.round(Math.max(0, Math.min(1, fy)) * 100);
        syncLabels();
        updateLivePreview();
    };

    // Called from editor.js's canvas pointerup handler when a click/drag
    // pick finishes. The point is already committed live by
    // __setPunchZoomFocusFromClick, so this just refreshes the list labels.
    window.__finishPunchZoomFocusPick = function () {
        renderList();
    };

    function init() {
        scaleSlider = document.getElementById('punch-zoom-scale-slider');
        scaleVal = document.getElementById('punch-zoom-scale-val');
        durationSlider = document.getElementById('punch-zoom-duration-slider');
        durationVal = document.getElementById('punch-zoom-duration-val');
        focusXSlider = document.getElementById('punch-zoom-focus-x-slider');
        focusXVal = document.getElementById('punch-zoom-focus-x-val');
        focusYSlider = document.getElementById('punch-zoom-focus-y-slider');
        focusYVal = document.getElementById('punch-zoom-focus-y-val');
        addBtn = document.getElementById('punch-zoom-add-btn');
        updateBtn = document.getElementById('punch-zoom-update-btn');
        listEl = document.getElementById('punch-zoom-list');
        pickBtn = document.getElementById('punch-zoom-pick-btn');

        if (!scaleSlider || !listEl) return false; // panel not in DOM yet
        wireEvents();
        syncLabels();
        renderList();

        // The only moment an in-progress punch-zoom edit should let go and
        // hand control back to the timed bell-curve animation is when the
        // user actually presses Play — not when they release a slider or
        // click away, which was the earlier bug. audio.js defines
        // onPlaybackStart before this script runs (loaded earlier in
        // index.html), so it's safe to wrap here.
        if (window.onPlaybackStart && !window.onPlaybackStart.__pzWrapped) {
            var originalOnPlaybackStart = window.onPlaybackStart;
            var wrappedOnPlaybackStart = function () {
                clearLivePreview();
                stopPunchZoomPicking();
                return originalOnPlaybackStart.apply(this, arguments);
            };
            wrappedOnPlaybackStart.__pzWrapped = true;
            window.onPlaybackStart = wrappedOnPlaybackStart;
        }

        // Piggyback on the existing clip-panel refresh cycle (phase9.js calls
        // window.syncPhase9ClipUI whenever the active clip / its properties
        // change) so our list/sliders stay in sync without duplicating all
        // those call sites.
        if (window.syncPhase9ClipUI && !window.syncPhase9ClipUI.__pzWrapped) {
            var original = window.syncPhase9ClipUI;
            var wrapped = function () {
                var r = original.apply(this, arguments);
                syncPunchZoomUI();
                return r;
            };
            wrapped.__pzWrapped = true;
            window.syncPhase9ClipUI = wrapped;
        }
        return true;
    }

    document.addEventListener('DOMContentLoaded', function () {
        if (init()) return;
        // Panel markup may render slightly after DOMContentLoaded depending on
        // load order — retry briefly, same pattern used elsewhere in this app.
        var attempts = 0;
        var timer = setInterval(function () {
            attempts++;
            if (init() || attempts > 50) clearInterval(timer);
        }, 100);
    });
})();
