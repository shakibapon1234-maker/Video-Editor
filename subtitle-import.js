/* ==========================================================================
   Studio Flow — SRT/VTT Subtitle Import (Phase 12, TODO-1)

   Lets the user upload an externally-made .srt or .vtt subtitle file and
   loads its cues straight into state.subtitles using the exact same
   { id, text, startSec, endSec } shape that Auto Subtitle / manual typing
   already produce. Because every existing subtitle consumer (render in
   drawFrame, style panel, translate, SRT/VTT export) already reads that
   shape and nothing else, no other file needs to change — this module only
   parses text and pushes into the existing array.

   WHY A SEPARATE FILE: same reasoning as keyframes.js / color-scopes.js —
   keeps this feature's risk isolated from editor.js's render code. The only
   touch point outside this file is the upload button + hidden <input
   type="file"> added to index.html, and one line in audio.js exposing the
   existing renderSubtitleList() on window so this module can refresh the
   list UI after importing (it was previously a local function inside
   audio.js's closure).

   SCOPE NOTE: this only imports into the *data* subtitle track
   (state.subtitles). It has nothing to do with text that's already
   burned into the video pixels — there's no "subtitle data" to extract
   from that, only image content.
   ========================================================================== */
(function () {
    'use strict';

    function pad(n, len) {
        len = len || 2;
        var s = String(Math.floor(n));
        while (s.length < len) s = '0' + s;
        return s;
    }

    // Parses "HH:MM:SS,mmm" (SRT) or "HH:MM:SS.mmm" / "MM:SS.mmm" (VTT) into seconds.
    function parseTimestamp(raw) {
        if (!raw) return null;
        var t = raw.trim().replace(',', '.');
        var parts = t.split(':');
        if (parts.length === 3) {
            var h = parseFloat(parts[0]) || 0;
            var m = parseFloat(parts[1]) || 0;
            var s = parseFloat(parts[2]) || 0;
            return h * 3600 + m * 60 + s;
        } else if (parts.length === 2) {
            // VTT permits an hours-less "MM:SS.mmm" form.
            var m2 = parseFloat(parts[0]) || 0;
            var s2 = parseFloat(parts[1]) || 0;
            return m2 * 60 + s2;
        }
        return null;
    }

    // Shared cue-block parser: both SRT and VTT are "blank-line separated
    // blocks, one of the lines is a `start --> end` timecode, everything
    // after that line until the next blank line is the cue text."
    function parseCueBlocks(rawText) {
        var text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        var blocks = text.split(/\n\s*\n/);
        var cues = [];
        var arrowRe = /([0-9:.,]+)\s*-->\s*([0-9:.,]+)/;

        blocks.forEach(function (block) {
            var lines = block.split('\n').map(function (l) { return l.trim(); }).filter(function (l) { return l.length > 0; });
            if (lines.length === 0) return;

            var arrowLineIdx = -1;
            var match = null;
            for (var i = 0; i < lines.length; i++) {
                var m = arrowRe.exec(lines[i]);
                if (m) { arrowLineIdx = i; match = m; break; }
            }
            if (arrowLineIdx === -1) return; // WEBVTT header, NOTE/STYLE blocks, stray index lines, etc.

            var startSec = parseTimestamp(match[1]);
            var endSec = parseTimestamp(match[2]);
            if (startSec == null || endSec == null) return;

            var textLines = lines.slice(arrowLineIdx + 1);
            // Strip VTT inline tags like <b>, <i>, <c.yellow>, <00:00:01.000> etc.
            // so the imported text matches plain-string rendering elsewhere.
            var cueText = textLines.join(' ').replace(/<[^>]*>/g, '').trim();
            if (!cueText) return;

            if (endSec <= startSec) endSec = startSec + 0.5;
            cues.push({ text: cueText, startSec: startSec, endSec: endSec });
        });

        return cues;
    }

    function parseSrtOrVtt(rawText, filename) {
        var isVtt = /\.vtt$/i.test(filename || '') || /^\s*WEBVTT/.test(rawText);
        // Both formats share the same cue-block shape once the WEBVTT header
        // (and any NOTE/STYLE blocks, which never contain an arrow line) are
        // skipped by parseCueBlocks's "must contain -->" check.
        return parseCueBlocks(rawText);
    }

    function importSubtitleFile(file) {
        var state = window.VideoEditor;
        var statusEl = document.getElementById('subtitle-import-status');

        var reader = new FileReader();
        reader.onload = function () {
            var cues;
            try {
                cues = parseSrtOrVtt(String(reader.result || ''), file.name);
            } catch (e) {
                cues = [];
            }

            if (!cues.length) {
                if (statusEl) {
                    statusEl.style.display = 'block';
                    statusEl.style.color = '#f87171';
                    statusEl.innerText = 'ফাইলটি থেকে কোনো সাবটাইটেল লাইন পড়া যায়নি — ফরম্যাট ঠিক আছে কিনা দেখুন।';
                }
                return;
            }

            if (!state.subtitles) state.subtitles = [];
            var baseId = Date.now();
            cues.forEach(function (cue, idx) {
                state.subtitles.push({
                    id: baseId + idx + Math.random(),
                    text: cue.text,
                    startSec: cue.startSec,
                    endSec: cue.endSec
                });
            });
            // Keep the track in chronological order regardless of import order
            // relative to any subtitles that were already there.
            state.subtitles.sort(function (a, b) { return a.startSec - b.startSec; });

            if (typeof window.renderSubtitleList === 'function') window.renderSubtitleList();
            if (typeof window.drawEditorFrame === 'function') window.drawEditorFrame();

            if (statusEl) {
                statusEl.style.display = 'block';
                statusEl.style.color = '';
                statusEl.innerText = cues.length + 'টি সাবটাইটেল লাইন যোগ হয়েছে।';
            }
        };
        reader.onerror = function () {
            if (statusEl) {
                statusEl.style.display = 'block';
                statusEl.style.color = '#f87171';
                statusEl.innerText = 'ফাইল পড়তে সমস্যা হয়েছে।';
            }
        };
        reader.readAsText(file);
    }

    function init() {
        var btn = document.getElementById('subtitle-import-btn');
        var input = document.getElementById('subtitle-import-input');
        if (!btn || !input) return;

        btn.addEventListener('click', function () {
            input.value = '';
            input.click();
        });

        input.addEventListener('change', function () {
            var file = input.files && input.files[0];
            if (file) importSubtitleFile(file);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
