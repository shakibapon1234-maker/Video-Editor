/* ==========================================================================
   Studio Flow — Lower-Third / Title-Card Presets (Phase 12, TODO-5)

   One-click "Name + Designation" style banners. This is purely a
   preconfigured combination of two ordinary state.textOverlays items
   (a bigger name line + a smaller title line, positioned one above the
   other, sharing a boxStyle/animStyle/color scheme) — no new rendering
   logic is needed because editor.js's existing text-overlay draw code
   already supports every field used here (boxStyle, boxColor, animStyle,
   font, colorMode, etc. all already exist and are read the same way for
   any textOverlays item, hand-typed or preset-generated).

   WHY A SEPARATE FILE (deviates slightly from the original plan note,
   which suggested a LOWER_THIRD_PRESETS list living inside editor.js):
   the same risk-minimization goal is better served by keeping this out
   of editor.js entirely, matching the subtitle-import.js / text-find-
   replace.js pattern from earlier in this phase — this module only
   *pushes* fully-formed items into state.textOverlays and then calls
   the already-exposed window.renderTextOverlayList / window.drawEditorFrame
   to refresh, so editor.js's render code needs zero changes.
   ========================================================================== */
(function () {
    'use strict';

    // Each preset is a full field-set for both lines, built to match the
    // shape editor.js's manual "Add Text" creation already produces (same
    // keys, see editor.js's text-overlay-add-btn handler) so nothing is
    // missing that the render code expects.
    var LOWER_THIRD_PRESETS = {
        'preset-lt-classic': {
            label: 'Classic Broadcast',
            font: 'Hind Siliguri',
            name: {
                fontSize: 40, color: '#ffffff', colorMode: 'solid',
                boxStyle: 'solid', boxColor: '#111827',
                animStyle: 'slide-left', x: 0.34, y: 0.82
            },
            title: {
                fontSize: 24, color: '#e5e7eb', colorMode: 'solid',
                boxStyle: 'solid', boxColor: '#4f46e5',
                animStyle: 'slide-left', x: 0.34, y: 0.90
            }
        },
        'preset-lt-minimal': {
            label: 'Minimal Outline',
            font: 'Outfit',
            name: {
                fontSize: 38, color: '#ffffff', colorMode: 'solid',
                boxStyle: 'outline', boxColor: '#ffffff',
                animStyle: 'fade', x: 0.5, y: 0.83
            },
            title: {
                fontSize: 22, color: '#ffffff', colorMode: 'solid',
                boxStyle: 'none', boxColor: '#ffffff',
                animStyle: 'fade', x: 0.5, y: 0.905
            }
        },
        'preset-lt-bold': {
            label: 'Bold Gradient',
            font: 'Poppins',
            name: {
                fontSize: 42, color: '#ffffff', colorMode: 'gradient',
                gradientColor1: '#22d3ee', gradientColor2: '#a855f7', gradientDirection: 'horizontal',
                boxStyle: 'gradient', boxColor: '#4f46e5',
                animStyle: 'bounce', x: 0.5, y: 0.82
            },
            title: {
                fontSize: 24, color: '#ffffff', colorMode: 'solid',
                boxStyle: 'pill', boxColor: '#a855f7',
                animStyle: 'bounce', x: 0.5, y: 0.905
            }
        }
    };

    // Builds one full textOverlays-shaped item, filling every field
    // editor.js's render path reads, so a preset item behaves identically
    // to a hand-created one (same defaults as the manual "Add Text" flow).
    function buildOverlayItem(text, line, font, idOffset, startSec, endSec) {
        var state = window.VideoEditor;
        return {
            id: Date.now() + idOffset + Math.random(),
            clipId: state.activeClipId,
            text: text,
            x: line.x,
            y: line.y,
            fontSize: line.fontSize,
            color: line.color,
            colorMode: line.colorMode || 'solid',
            gradientColor1: line.gradientColor1 || '#22d3ee',
            gradientColor2: line.gradientColor2 || '#a855f7',
            gradientDirection: line.gradientDirection || 'horizontal',
            font: font,
            boxStyle: line.boxStyle || 'none',
            boxColor: line.boxColor || '#4f46e5',
            animStyle: line.animStyle || 'none',
            animSpeedSec: 0.5,
            curve: 0,
            curvePoints: [],
            shadowEnabled: false,
            shadowColor: '#000000',
            shadowOpacity: 60,
            shadowBlur: 8,
            shadowOffsetX: 3,
            shadowOffsetY: 3,
            shadowDoubleLayer: false,
            shadowHighlightColor: '#ffffff',
            shadowHighlightOpacity: 40,
            startSec: startSec,
            endSec: endSec
        };
    }

    function addLowerThird(presetKey, nameText, titleText) {
        var state = window.VideoEditor;
        var preset = LOWER_THIRD_PRESETS[presetKey];
        var statusEl = document.getElementById('lower-third-status');

        if (!preset) return;
        if (!nameText && !titleText) {
            if (statusEl) {
                statusEl.style.display = 'block';
                statusEl.style.color = '#f87171';
                statusEl.innerText = 'অন্তত নাম বা পদবি একটা লিখুন।';
            }
            return;
        }

        var startSec = Math.max(0, state.currentTime || 0);
        var endSec = Math.min(state.endTime || state.duration || 5, startSec + 4);
        if (endSec <= startSec) endSec = startSec + 4;

        if (!state.textOverlays) state.textOverlays = [];
        var createdIds = [];

        if (nameText) {
            var nameItem = buildOverlayItem(nameText, preset.name, preset.font, 1, startSec, endSec);
            state.textOverlays.push(nameItem);
            createdIds.push(nameItem.id);
        }
        if (titleText) {
            var titleItem = buildOverlayItem(titleText, preset.title, preset.font, 2, startSec, endSec);
            state.textOverlays.push(titleItem);
            createdIds.push(titleItem.id);
        }

        // Select the last-created item so the existing Text Overlay panel's
        // timing/style controls immediately reflect it, same as manual "Add Text".
        if (createdIds.length) state.selectedTextOverlayId = createdIds[createdIds.length - 1];

        if (typeof window.renderTextOverlayList === 'function') window.renderTextOverlayList();
        if (typeof window.showTextOverlayTimingFor === 'function' && createdIds.length) {
            window.showTextOverlayTimingFor(createdIds[createdIds.length - 1]);
        }
        if (typeof window.drawEditorFrame === 'function') window.drawEditorFrame();
        if (window.triggerAutoSave) window.triggerAutoSave();
        if (window.recordEditorHistory) window.recordEditorHistory('Lower-third added');

        if (statusEl) {
            statusEl.style.display = 'block';
            statusEl.style.color = '';
            statusEl.innerText = preset.label + ' ব্যানার যোগ হয়েছে — Text Overlay লিস্টে গিয়ে পজিশন/টাইমিং এডিট করতে পারবেন।';
        }
    }

    function init() {
        var addBtn = document.getElementById('lower-third-add-btn');
        var nameInput = document.getElementById('lower-third-name-input');
        var titleInput = document.getElementById('lower-third-title-input');
        var presetSelect = document.getElementById('lower-third-preset-select');
        if (!addBtn) return;

        addBtn.addEventListener('click', function () {
            var presetKey = presetSelect ? presetSelect.value : 'preset-lt-classic';
            var nameText = nameInput ? nameInput.value.trim() : '';
            var titleText = titleInput ? titleInput.value.trim() : '';
            addLowerThird(presetKey, nameText, titleText);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
