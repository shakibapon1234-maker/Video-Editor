/* ==========================================================================
   Studio Flow — Text/Subtitle Find & Replace (Phase 12, TODO-2)

   Searches state.textOverlays and state.subtitles (both already just plain
   { text, ... } objects) for a query string and can replace all matches at
   once. Purely data-level: reads/mutates the two existing arrays and then
   calls the render helpers those arrays already had before this file
   existed (renderTextOverlayList / renderSubtitleList / drawEditorFrame),
   so no rendering logic is duplicated and editor.js's draw code is never
   touched.

   SCOPE: only text stored as data (overlay/subtitle objects). Text that's
   already burned into the video pixels isn't "text" to the editor at all —
   just image content — so it's out of reach here, same as everywhere else
   in the app.
   ========================================================================== */
(function () {
    'use strict';

    function escapeRegExp(s) {
        return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function buildMatcher(query, caseSensitive) {
        var flags = caseSensitive ? 'g' : 'gi';
        return new RegExp(escapeRegExp(query), flags);
    }

    function collectMatches(query, caseSensitive) {
        var state = window.VideoEditor;
        var re = buildMatcher(query, caseSensitive);
        var results = [];

        (state.textOverlays || []).forEach(function (item) {
            re.lastIndex = 0;
            if (item.text && re.test(item.text)) {
                results.push({ source: 'overlay', item: item });
            }
        });
        (state.subtitles || []).forEach(function (item) {
            re.lastIndex = 0;
            if (item.text && re.test(item.text)) {
                results.push({ source: 'subtitle', item: item });
            }
        });

        return results;
    }

    function renderMatches(matches, query) {
        var listEl = document.getElementById('text-find-matches');
        var statusEl = document.getElementById('text-find-status');
        if (!listEl || !statusEl) return;

        statusEl.style.display = 'block';
        statusEl.style.color = '';
        if (!query) {
            statusEl.innerText = 'কী খুঁজবেন তা লিখুন।';
            listEl.style.display = 'none';
            listEl.innerHTML = '';
            return;
        }

        if (matches.length === 0) {
            statusEl.innerText = 'কোনো ম্যাচ পাওয়া যায়নি।';
            listEl.style.display = 'none';
            listEl.innerHTML = '';
            return;
        }

        var overlayCount = matches.filter(function (m) { return m.source === 'overlay'; }).length;
        var subtitleCount = matches.filter(function (m) { return m.source === 'subtitle'; }).length;
        statusEl.innerText = matches.length + 'টি ম্যাচ পাওয়া গেছে (' + overlayCount + 'টি Text Overlay-তে, ' + subtitleCount + 'টি Subtitle-এ)।';

        listEl.style.display = 'block';
        listEl.innerHTML = '';
        matches.forEach(function (m) {
            var row = document.createElement('div');
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.justifyContent = 'space-between';
            row.style.gap = '8px';
            row.style.padding = '6px 10px';
            row.style.borderRadius = '6px';
            row.style.marginBottom = '4px';
            row.style.cursor = 'pointer';
            row.style.background = 'rgba(255,255,255,0.04)';

            var label = document.createElement('span');
            var text = m.item.text || '';
            label.innerText = (text.length > 36 ? text.slice(0, 36) + '…' : text);
            label.style.fontSize = '12px';
            label.style.flex = '1';

            var tag = document.createElement('span');
            tag.innerText = m.source === 'overlay' ? 'Overlay' : 'Subtitle';
            tag.style.fontSize = '10px';
            tag.style.opacity = '0.6';

            row.appendChild(label);
            row.appendChild(tag);

            // Clicking a match jumps the playhead to it so the user can see
            // it in context before deciding to replace.
            row.addEventListener('click', function () {
                var state = window.VideoEditor;
                if (typeof m.item.startSec === 'number' && state.video) {
                    state.video.currentTime = m.item.startSec;
                    state.currentTime = m.item.startSec;
                }
                if (m.source === 'overlay') {
                    state.selectedTextOverlayId = m.item.id;
                    if (typeof window.renderTextOverlayList === 'function') window.renderTextOverlayList();
                }
                if (typeof window.drawEditorFrame === 'function') window.drawEditorFrame();
            });

            listEl.appendChild(row);
        });
    }

    function doFind() {
        var findInput = document.getElementById('text-find-input');
        var caseToggle = document.getElementById('text-find-case-toggle');
        var query = findInput ? findInput.value.trim() : '';
        var caseSensitive = !!(caseToggle && caseToggle.checked);

        if (!query) {
            renderMatches([], '');
            return;
        }
        var matches = collectMatches(query, caseSensitive);
        renderMatches(matches, query);
    }

    function doReplaceAll() {
        var state = window.VideoEditor;
        var findInput = document.getElementById('text-find-input');
        var replaceInput = document.getElementById('text-replace-input');
        var caseToggle = document.getElementById('text-find-case-toggle');
        var statusEl = document.getElementById('text-find-status');

        var query = findInput ? findInput.value.trim() : '';
        var replacement = replaceInput ? replaceInput.value : '';
        var caseSensitive = !!(caseToggle && caseToggle.checked);

        if (!query) {
            if (statusEl) {
                statusEl.style.display = 'block';
                statusEl.style.color = '#f87171';
                statusEl.innerText = 'আগে "Find" ফিল্ডে কিছু লিখুন।';
            }
            return;
        }

        var re = buildMatcher(query, caseSensitive);
        var itemsChanged = 0;
        var occurrences = 0;

        function replaceInList(list) {
            (list || []).forEach(function (item) {
                if (!item.text) return;
                re.lastIndex = 0;
                var matchCount = (item.text.match(re) || []).length;
                if (matchCount > 0) {
                    item.text = item.text.replace(re, replacement);
                    itemsChanged++;
                    occurrences += matchCount;
                }
            });
        }

        replaceInList(state.textOverlays);
        replaceInList(state.subtitles);

        if (typeof window.renderTextOverlayList === 'function') window.renderTextOverlayList();
        if (typeof window.renderSubtitleList === 'function') window.renderSubtitleList();
        if (typeof window.drawEditorFrame === 'function') window.drawEditorFrame();
        if (window.triggerAutoSave) window.triggerAutoSave();

        if (statusEl) {
            statusEl.style.display = 'block';
            statusEl.style.color = '';
            statusEl.innerText = itemsChanged === 0
                ? 'কোনো ম্যাচ পাওয়া যায়নি — কিছু বদলানো হয়নি।'
                : occurrences + 'টি জায়গায় (' + itemsChanged + 'টি আইটেমে) বদলানো হয়েছে।';
        }

        // Refresh the match list too, since the just-replaced text may no
        // longer match the same query.
        var listEl = document.getElementById('text-find-matches');
        if (listEl) { listEl.style.display = 'none'; listEl.innerHTML = ''; }
    }

    function init() {
        var searchBtn = document.getElementById('text-find-search-btn');
        var replaceBtn = document.getElementById('text-find-replace-all-btn');
        var findInput = document.getElementById('text-find-input');

        if (searchBtn) searchBtn.addEventListener('click', doFind);
        if (replaceBtn) replaceBtn.addEventListener('click', doReplaceAll);
        if (findInput) {
            findInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') doFind();
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
