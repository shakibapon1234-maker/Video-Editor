/* ==========================================================================
   Studio Flow — Bangla Spellcheck (Phase 12, TODO-7)

   Scans the *data* text in state.subtitles (same scope limitation as
   text-find-replace.js — burned-in video pixels aren't reachable) for
   words the bn_BD Hunspell dictionary doesn't recognize, and shows a
   small "suspicious word + suggestion" list. This is intentionally NOT
   full autocorrect — nothing is changed automatically; the user reads
   the list and edits the subtitle text themselves if they agree.

   WHY THIS IS OPT-IN AND WORKER-BASED: building the spellchecker from
   the full bn_BD dictionary expands to several million word forms via
   Hunspell's affix rules. Measured at ~10s+ to build (and a large heap)
   even on a desktop machine — on a low-spec phone this could be slower
   and heavier still. So:
     - Nothing loads until the user explicitly clicks "চালু করুন".
     - The dictionary build AND every suggest() call happen inside
       bangla-spellcheck-worker.js (a separate thread), so the editor UI
       (canvas preview, playback, every other panel) stays responsive
       even during the initial load or a large check.
     - If the worker fails to load or errors out, the feature disables
       itself with a clear message — it never blocks or crashes the rest
       of the app, matching this project's risk-minimization pattern.

   editor.js is untouched — this only reads state.subtitles and calls the
   already-exposed window.drawEditorFrame / window.VideoEditor, exactly
   like text-find-replace.js and subtitle-import.js before it.
   ========================================================================== */
(function () {
    'use strict';

    var worker = null;
    var workerReady = false;
    var pendingRequestId = 0;
    var pendingResolvers = {};

    // Mirrors render-engine.js's _resolveBase(): works both from a dev
    // server (http://localhost:5000/...) and inside the Capacitor Android
    // WebView, where `public/` is copied to the web root alongside
    // index.html.
    function resolveBaseDir() {
        var docBase = (typeof document !== 'undefined' && document.baseURI)
            ? document.baseURI
            : (typeof location !== 'undefined' ? location.href : '');
        return docBase.replace(/[^/]*$/, '');
    }

    function setStatus(text, isError) {
        var el = document.getElementById('bangla-spellcheck-status');
        if (!el) return;
        el.style.display = 'block';
        el.style.color = isError ? '#f87171' : '';
        el.innerText = text;
    }

    function startWorker() {
        return new Promise(function (resolve, reject) {
            var base = resolveBaseDir();
            try {
                worker = new Worker(base + 'bangla-spellcheck-worker.js');
            } catch (err) {
                reject(err);
                return;
            }

            worker.onmessage = function (event) {
                var msg = event.data || {};
                if (msg.type === 'ready') {
                    workerReady = true;
                    resolve();
                } else if (msg.type === 'error') {
                    if (!workerReady) reject(new Error(msg.message));
                    else setStatus('ত্রুটি: ' + msg.message, true);
                } else if (msg.type === 'result') {
                    var resolver = pendingResolvers[msg.requestId];
                    if (resolver) {
                        delete pendingResolvers[msg.requestId];
                        resolver(msg.results || []);
                    }
                }
            };

            worker.onerror = function (err) {
                if (!workerReady) reject(err);
            };

            worker.postMessage({
                type: 'init',
                affURL: base + 'public/dictionaries/bn_BD/bn_BD.aff',
                dicURL: base + 'public/dictionaries/bn_BD/bn_BD.dic'
            });
        });
    }

    function checkWords(words) {
        return new Promise(function (resolve) {
            var requestId = ++pendingRequestId;
            pendingResolvers[requestId] = resolve;
            worker.postMessage({ type: 'check', requestId: requestId, words: words });
        });
    }

    // Only extract Bengali-script word tokens — Latin text, numbers,
    // punctuation, and dynamic tokens like {{date}} are left alone, since
    // the bn_BD dictionary has nothing meaningful to say about them and
    // flagging them would just be noise.
    var BANGLA_WORD_RE = /[\u0980-\u09FF]+/g;

    function collectBanglaWords() {
        var state = window.VideoEditor;
        var wordToItems = Object.create(null);
        (state.subtitles || []).forEach(function (item) {
            if (!item.text) return;
            var matches = item.text.match(BANGLA_WORD_RE);
            if (!matches) return;
            matches.forEach(function (w) {
                if (!wordToItems[w]) wordToItems[w] = [];
                wordToItems[w].push(item);
            });
        });
        return wordToItems;
    }

    function renderResults(results, wordToItems) {
        var listEl = document.getElementById('bangla-spellcheck-list');
        if (!listEl) return;

        if (results.length === 0) {
            setStatus('কোনো সন্দেহজনক বানান পাওয়া যায়নি।', false);
            listEl.style.display = 'none';
            listEl.innerHTML = '';
            return;
        }

        setStatus(results.length + 'টি শব্দ ডিকশনারিতে পাওয়া যায়নি (নিচে সাজেশন দেখুন) — এগুলো ভুল বানান নাও হতে পারে (নাম, আঞ্চলিক শব্দ ইত্যাদি), নিজে বিবেচনা করে ঠিক করুন।', false);

        listEl.style.display = 'block';
        listEl.innerHTML = '';

        results.forEach(function (r) {
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
            label.innerText = r.word;
            label.style.fontSize = '13px';
            label.style.fontWeight = '600';

            var suggestion = document.createElement('span');
            suggestion.innerText = r.suggestions.length
                ? '→ ' + r.suggestions.join(', ')
                : '(কোনো সাজেশন নেই)';
            suggestion.style.fontSize = '12px';
            suggestion.style.opacity = '0.75';
            suggestion.style.flex = '1';
            suggestion.style.textAlign = 'right';

            row.appendChild(label);
            row.appendChild(suggestion);

            // Clicking jumps the playhead to the first subtitle containing
            // this word, so the user can see it in context — same pattern
            // as text-find-replace.js's match list.
            row.addEventListener('click', function () {
                var items = wordToItems[r.word];
                var first = items && items[0];
                var state = window.VideoEditor;
                if (first && typeof first.startSec === 'number' && state.video) {
                    state.video.currentTime = first.startSec;
                    state.currentTime = first.startSec;
                }
                if (typeof window.drawEditorFrame === 'function') window.drawEditorFrame();
            });

            listEl.appendChild(row);
        });
    }

    function runCheck() {
        if (!workerReady) return;
        var runBtn = document.getElementById('bangla-spellcheck-run-btn');
        var wordToItems = collectBanglaWords();
        var uniqueWords = Object.keys(wordToItems);

        if (uniqueWords.length === 0) {
            setStatus('চেক করার মতো কোনো বাংলা সাবটাইটেল টেক্সট নেই।', false);
            return;
        }

        if (runBtn) runBtn.disabled = true;
        setStatus('চেক করা হচ্ছে... (' + uniqueWords.length + 'টি শব্দ)', false);

        checkWords(uniqueWords).then(function (results) {
            if (runBtn) runBtn.disabled = false;
            renderResults(results, wordToItems);
        });
    }

    function enableFeature() {
        var enableBtn = document.getElementById('bangla-spellcheck-enable-btn');
        var runBtn = document.getElementById('bangla-spellcheck-run-btn');

        if (enableBtn) enableBtn.disabled = true;
        setStatus('ডিকশনারি লোড হচ্ছে... (প্রথমবার ~১০-২০ সেকেন্ড লাগতে পারে, এডিটর ব্যবহার করা যাবে)', false);

        startWorker().then(function () {
            setStatus('ডিকশনারি প্রস্তুত ✓ — এখন \"চেক করুন\" চাপুন।', false);
            if (enableBtn) enableBtn.style.display = 'none';
            if (runBtn) runBtn.style.display = 'block';
        }).catch(function (err) {
            setStatus('ডিকশনারি লোড করা যায়নি: ' + (err && err.message ? err.message : err), true);
            if (enableBtn) enableBtn.disabled = false;
        });
    }

    function init() {
        var enableBtn = document.getElementById('bangla-spellcheck-enable-btn');
        var runBtn = document.getElementById('bangla-spellcheck-run-btn');
        if (enableBtn) enableBtn.addEventListener('click', enableFeature);
        if (runBtn) runBtn.addEventListener('click', runCheck);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
