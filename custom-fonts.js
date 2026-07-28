/* ==========================================================================
   Studio Flow — Custom Font Upload (Phase 12, TODO-4)
   Lets the user upload their own .ttf/.otf file (especially useful for
   Bangla fonts not in the built-in list), loads it in the browser via the
   FontFace API, and adds it as a new option in the existing Text Overlay
   font dropdown (#text-overlay-font-select) — no new render logic needed,
   since drawFrame() already does `ctx.font = ... "${item.font}" ...` for
   whatever family name is stored on the Text Overlay item.

   Scope / known limitation (kept simple on purpose): the uploaded font is
   only registered for the current browser session via document.fonts.add().
   It is NOT embedded into the saved project (localStorage project save/load
   is untouched) — font binaries can be several hundred KB to a few MB, and
   this app targets low-spec hardware / storage quotas, so persisting font
   bytes into every saved project was judged not worth the added risk for
   this pass. Re-uploading the same font file after reloading a project
   works fine; Text Overlay items that reference a custom font family that
   hasn't been (re-)uploaded yet in the current session will just fall back
   to the default font, exactly like an unrecognized font-family always does
   in CSS/canvas.
   ========================================================================== */
(function () {
    'use strict';

    // Tracks custom fonts added this session, purely for an optional status
    // list — not persisted anywhere.
    var customFonts = [];

    function sanitizeForFontFamily(name) {
        return name.replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    function setStatus(el, msg, isError) {
        if (!el) return;
        el.style.display = msg ? 'block' : 'none';
        el.textContent = msg || '';
        el.style.color = isError ? '#f87171' : '';
    }

    function renderCustomFontsList(listEl) {
        if (!listEl) return;
        listEl.innerHTML = '';
        customFonts.forEach(function (f) {
            var row = document.createElement('div');
            row.style.fontSize = '12px';
            row.style.opacity = '0.75';
            row.style.padding = '2px 0';
            row.textContent = '✓ ' + f.name;
            listEl.appendChild(row);
        });
    }

    function init() {
        var uploadInput = document.getElementById('custom-font-upload-input');
        var uploadBtn = document.getElementById('custom-font-upload-btn');
        var statusEl = document.getElementById('custom-font-status');
        var listEl = document.getElementById('custom-font-list');
        var fontSelect = document.getElementById('text-overlay-font-select');

        if (!uploadInput || !fontSelect) return; // markup not present in this build

        if (uploadBtn) {
            uploadBtn.addEventListener('click', function () {
                uploadInput.click();
            });
        }

        uploadInput.addEventListener('change', function (e) {
            var file = e.target.files && e.target.files[0];
            if (!file) return;

            var ext = (file.name.split('.').pop() || '').toLowerCase();
            if (ext !== 'ttf' && ext !== 'otf') {
                setStatus(statusEl, 'শুধু .ttf বা .otf ফন্ট ফাইল সাপোর্টেড।', true);
                uploadInput.value = '';
                return;
            }

            var baseName = file.name.replace(/\.(ttf|otf)$/i, '');
            // Unique family name per upload so re-uploading (or uploading two
            // fonts with the same display name) never collides with a
            // previously-registered FontFace or a built-in family.
            var familyName = 'Custom-' + sanitizeForFontFamily(baseName) + '-' + Date.now();

            setStatus(statusEl, 'ফন্ট লোড হচ্ছে...', false);

            var reader = new FileReader();
            reader.onload = function () {
                var fontFace;
                try {
                    fontFace = new FontFace(familyName, reader.result);
                } catch (err) {
                    setStatus(statusEl, 'ফন্ট লোড ব্যর্থ হয়েছে: ' + (err && err.message ? err.message : 'invalid font file'), true);
                    uploadInput.value = '';
                    return;
                }
                fontFace.load().then(function (loadedFace) {
                    document.fonts.add(loadedFace);

                    var opt = document.createElement('option');
                    opt.value = familyName;
                    opt.textContent = baseName + ' (Custom)';
                    fontSelect.appendChild(opt);
                    fontSelect.value = familyName;
                    // Fire the same change event the dropdown normally fires on a
                    // manual selection, so existing Text Overlay font-change
                    // handling (updating the selected item + redraw) runs as-is.
                    fontSelect.dispatchEvent(new Event('change', { bubbles: true }));

                    customFonts.push({ name: baseName, family: familyName });
                    renderCustomFontsList(listEl);

                    setStatus(statusEl, '✅ "' + baseName + '" ফন্ট যোগ হয়েছে — Font Family ড্রপডাউনে বেছে নেওয়া আছে।', false);
                    uploadInput.value = '';
                }).catch(function (err) {
                    setStatus(statusEl, 'ফন্ট লোড ব্যর্থ হয়েছে: ' + (err && err.message ? err.message : 'unknown error'), true);
                    uploadInput.value = '';
                });
            };
            reader.onerror = function () {
                setStatus(statusEl, 'ফাইল পড়তে ব্যর্থ হয়েছে।', true);
                uploadInput.value = '';
            };
            reader.readAsArrayBuffer(file);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
