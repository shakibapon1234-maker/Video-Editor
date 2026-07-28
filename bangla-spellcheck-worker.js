/* ==========================================================================
   Studio Flow — Bangla Spellcheck Worker (Phase 12, TODO-7)

   Runs entirely off the main thread. Building an NSpell instance from the
   full bn_BD Hunspell dictionary expands to several million word forms
   (measured ~10s+ and a large heap on a desktop Node process — expect
   longer, and more memory pressure, on a low-spec phone). Doing that on
   the main thread would freeze the UI for the whole load, and every
   suggest() call afterwards is itself fairly expensive. Isolating all of
   it in a worker means the editor stays fully responsive; the only cost
   the user pays is a one-time "loading" wait after they explicitly opt in
   (see bangla-spellcheck.js — this feature is never started automatically).
   ========================================================================== */
importScripts('nspell.js');

var spell = null;
var ready = false;

self.onmessage = function (event) {
    var msg = event.data || {};

    if (msg.type === 'init') {
        fetch(msg.affURL)
            .then(function (res) { return res.text(); })
            .then(function (affText) {
                return fetch(msg.dicURL).then(function (res) {
                    return res.text();
                }).then(function (dicText) {
                    return { affText: affText, dicText: dicText };
                });
            })
            .then(function (docs) {
                spell = new NSpell(docs.affText, docs.dicText);
                ready = true;
                self.postMessage({ type: 'ready' });
            })
            .catch(function (err) {
                self.postMessage({ type: 'error', message: String(err && err.message || err) });
            });
        return;
    }

    if (msg.type === 'check') {
        if (!ready || !spell) {
            self.postMessage({ type: 'error', message: 'Dictionary not loaded yet' });
            return;
        }

        var words = msg.words || [];
        var results = [];
        var i, word, suggestions;

        for (i = 0; i < words.length; i++) {
            word = words[i];
            if (!word || spell.correct(word)) continue;
            // Cap suggestion work: suggest() is the expensive part, so only
            // compute it for words we're actually about to report, and only
            // keep a handful — this is a lightweight "suspicious word +
            // suggestion" hint, not full autocorrect.
            suggestions = spell.suggest(word).slice(0, 5);
            results.push({ word: word, suggestions: suggestions });
        }

        self.postMessage({ type: 'result', requestId: msg.requestId, results: results });
    }
};
