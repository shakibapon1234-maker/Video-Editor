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
        focusYSlider, focusYVal, addBtn, updateBtn, listEl;

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
                // Jump the playhead to this zoom point so the user can preview it.
                if (state.video && clip.type !== 'image') {
                    state.currentTime = (state.startTime || 0) + (pz.time || 0);
                    if (window.updatePlayhead) window.updatePlayhead();
                    state.video.currentTime = state.currentTime;
                } else {
                    state.currentTime = (state.startTime || 0) + (pz.time || 0);
                    if (window.updatePlayhead) window.updatePlayhead();
                }
                if (window.drawEditorFrame) window.drawEditorFrame();
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

    function syncPunchZoomUI() {
        var clip = getActiveClip();
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
                clip.punchZooms.push({
                    id: uid(),
                    time: timeInClip,
                    duration: v.duration,
                    scale: v.scale,
                    focusX: v.focusX,
                    focusY: v.focusY
                });
                if (window.recordEditorHistory) window.recordEditorHistory('Punch zoom added');
                if (window.drawEditorFrame) window.drawEditorFrame();
                renderList();
            });
        }

        if (updateBtn) {
            updateBtn.addEventListener('click', function () {
                var clip = getActiveClip();
                if (!clip || !selectedId) return;
                var pz = (clip.punchZooms || []).find(function (p) { return p.id === selectedId; });
                if (!pz) return;
                var v = currentFormValues();
                pz.duration = v.duration;
                pz.scale = v.scale;
                pz.focusX = v.focusX;
                pz.focusY = v.focusY;
                if (window.recordEditorHistory) window.recordEditorHistory('Punch zoom updated');
                if (window.drawEditorFrame) window.drawEditorFrame();
                renderList();
            });
        }

        [scaleSlider, durationSlider, focusXSlider, focusYSlider].forEach(function (el) {
            if (!el) return;
            el.addEventListener('input', syncLabels);
        });
    }

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

        if (!scaleSlider || !listEl) return false; // panel not in DOM yet
        wireEvents();
        syncLabels();
        renderList();

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
