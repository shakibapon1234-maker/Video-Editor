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
        'preset-creator-headline-underline': {
            label: '🔥 Creator Headline + Growing Underline',
            font: 'Hind Siliguri',
            name: {
                defaultText: 'কে বন্ধ করে দিল?',
                fontSize: 44, color: '#ffffff', colorMode: 'solid',
                boxStyle: 'none', boxColor: '#ef4444',
                animStyle: 'spring-pop', x: 0.5, y: 0.82,
                accentBar: true, accentBarEnabled: true,
                accentBarColor: '#ef4444', accentBarHeight: 5, accentBarAnim: 'draw-left'
            },
            title: null
        },
        'preset-creator-pill-badge': {
            label: '💊 Creator Pill Badge (পিল কলআউট ব্যাজ)',
            font: 'Hind Siliguri',
            name: {
                defaultText: '016......',
                fontSize: 32, color: '#ffffff', colorMode: 'solid',
                boxStyle: 'pill', boxColor: '#dc2626',
                animStyle: 'pill-unfold', x: 0.25, y: 0.48
            },
            title: null
        },
        'preset-creator-statement-card': {
            label: '📢 Creator Statement Card (স্টেটমেন্ট কার্ড)',
            font: 'Hind Siliguri',
            isMultiBox: true,
            box1: {
                defaultText: '🔴 বিশেষ ঘোষণা / ব্রেকিং নিউজ',
                fontSize: 22, color: '#fbbf24', colorMode: 'solid',
                boxStyle: 'solid', boxColor: '#881337',
                animStyle: 'badge-slide', x: 0.5, y: 0.74
            },
            box2: {
                defaultText: 'এক কোম্পানি-এর মাল্টিপল ব্র্যান্ড\nঅপারেট করা আইনত সম্পূর্ণ বৈধ।',
                fontSize: 26, color: '#ffffff', colorMode: 'solid',
                boxStyle: 'solid', boxColor: '#4c0519',
                animStyle: 'spring-pop', x: 0.5, y: 0.85,
                accentBar: true, accentBarEnabled: true,
                accentBarColor: '#ef4444', accentBarHeight: 4, accentBarAnim: 'draw-left'
            }
        },
        'preset-creator-tag-bounce': {
            label: '🏷️ Creator Brand Tag (ব্র্যান্ড / লোগো স্প্রিং)',
            font: 'Hind Siliguri',
            name: {
                defaultText: '🔴 Airtel 2026',
                fontSize: 30, color: '#ffffff', colorMode: 'solid',
                boxStyle: 'gradient', boxColor: '#dc2626',
                gradientColor1: '#dc2626', gradientColor2: '#991b1b', gradientDirection: 'horizontal',
                animStyle: 'elastic-bounce', x: 0.20, y: 0.16
            },
            title: null
        },
        'preset-lt-news-split': {
            label: 'News Split Ticker',
            font: 'Hind Siliguri',
            isMultiBox: true,
            box1: {
                defaultText: '📍 রামপুরা বনশ্রী, সি ব্লক,\nমেইন রোড, হাউস নং A7, A8',
                fontSize: 22, color: '#ffffff', colorMode: 'solid',
                boxStyle: 'solid', boxColor: '#0f172a',
                animStyle: 'slide-up', x: 0.22, y: 0.88
            },
            box2: {
                defaultText: '📞 01790-674695\n(WhatsApp)',
                fontSize: 24, color: '#38bdf8', colorMode: 'solid',
                boxStyle: 'solid', boxColor: '#1e293b',
                animStyle: 'slide-up', x: 0.52, y: 0.88
            },
            box3: {
                defaultText: 'এখনই ভর্তি হয়ে আপনার\nক্যারিয়ারের নতুন অধ্যায় শুরু করুন।',
                fontSize: 24, color: '#ffffff', colorMode: 'gradient',
                gradientColor1: '#fbbf24', gradientColor2: '#f59e0b', gradientDirection: 'horizontal',
                boxStyle: 'solid', boxColor: '#1e40af',
                animStyle: 'slide-up', x: 0.82, y: 0.88
            }
        },
        'preset-lt-top-badge': {
            label: 'Top-Left Header Badge',
            font: 'Hind Siliguri',
            name: {
                fontSize: 28, color: '#ffffff', colorMode: 'solid',
                boxStyle: 'gradient', boxColor: '#1d4ed8',
                gradientColor1: '#1e40af', gradientColor2: '#3b82f6', gradientDirection: 'horizontal',
                animStyle: 'slide-right', x: 0.22, y: 0.12
            },
            title: null
        },
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
            textAnimStyle: line.animStyle || 'none',
            boxAnimStyle: line.animStyle || 'none',
            accentBar: !!line.accentBar,
            accentBarEnabled: !!line.accentBarEnabled,
            accentBarColor: line.accentBarColor || '#ef4444',
            accentBarHeight: line.accentBarHeight || 5,
            accentBarAnim: line.accentBarAnim || 'draw-left',
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

        var startSec = Math.max(0, state.currentTime || 0);
        var endSec = Math.min(state.endTime || state.duration || 5, startSec + 4);
        if (endSec <= startSec) endSec = startSec + 4;

        if (!state.textOverlays) state.textOverlays = [];
        var createdIds = [];

        if (preset.isMultiBox) {
            var b1Text = nameText || (preset.box1 && preset.box1.defaultText) || '';
            var b2Text = titleText || (preset.box2 && preset.box2.defaultText) || '';
            var b3Text = (preset.box3 && preset.box3.defaultText) || '';

            if (preset.box1 && b1Text) {
                var item1 = buildOverlayItem(b1Text, preset.box1, preset.font, 1, startSec, endSec);
                state.textOverlays.push(item1);
                createdIds.push(item1.id);
            }
            if (preset.box2 && b2Text) {
                var item2 = buildOverlayItem(b2Text, preset.box2, preset.font, 2, startSec, endSec);
                state.textOverlays.push(item2);
                createdIds.push(item2.id);
            }
            if (preset.box3 && b3Text) {
                var item3 = buildOverlayItem(b3Text, preset.box3, preset.font, 3, startSec, endSec);
                state.textOverlays.push(item3);
                createdIds.push(item3.id);
            }
        } else {
            if (!nameText && preset.name && preset.name.defaultText) {
                nameText = preset.name.defaultText;
            }
            if (!titleText && preset.title && preset.title.defaultText) {
                titleText = preset.title.defaultText;
            }

            if (!nameText && !titleText) {
                if (presetKey === 'preset-lt-top-badge') {
                    nameText = '🎓 আপনার সফল ক্যারিয়ার!';
                } else {
                    if (statusEl) {
                        statusEl.style.display = 'block';
                        statusEl.style.color = '#f87171';
                        statusEl.innerText = 'অন্তত নাম বা পদবি একটা লিখুন।';
                    }
                    return;
                }
            }

            if (nameText && preset.name) {
                var nameItem = buildOverlayItem(nameText, preset.name, preset.font, 1, startSec, endSec);
                state.textOverlays.push(nameItem);
                createdIds.push(nameItem.id);
            }
            if (titleText && preset.title) {
                var titleItem = buildOverlayItem(titleText, preset.title, preset.font, 2, startSec, endSec);
                state.textOverlays.push(titleItem);
                createdIds.push(titleItem.id);
            }
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
