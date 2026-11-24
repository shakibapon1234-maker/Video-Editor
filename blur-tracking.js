/* ==========================================================================
   Studio Flow — Blur Region Tracking System  (v2 — Template Match)
   -------------------------------------------------------------------------
   Provides two tracking modes for blur regions:

   1. KEYFRAME MODE  (manual)
      - Add position keyframes by pausing + "কীফ্রেম যোগ করুন"
      - Smooth interpolation between keyframe positions

   2. TEMPLATE TRACK MODE  (automatic, YouTube-style)
      - Press "🔍 ট্র্যাক করুন" once per blur box
      - Python cv2.matchTemplate scans the whole video and returns
        keyframe positions; these are stored and used for export.
      - Preview: same keyframe interpolation plays back live.

   LOAD ORDER: after editor.js, keyframes.js, phase9.js
   ========================================================================== */
(function () {
    'use strict';

    /* -----------------------------------------------------------------------
       INTERPOLATION ENGINE  (shared by both modes)
    ----------------------------------------------------------------------- */
    function ease(p) {
        return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    }

    function getTrackedPosition(region, t) {
        var kfs = region.trackKeyframes;
        if (!kfs || kfs.length === 0) return null;
        if (kfs.length === 1 || t <= kfs[0].t) return { x: kfs[0].x, y: kfs[0].y };
        var last = kfs[kfs.length - 1];
        if (t >= last.t) return { x: last.x, y: last.y };
        for (var i = 0; i < kfs.length - 1; i++) {
            var a = kfs[i], b = kfs[i + 1];
            if (t >= a.t && t <= b.t) {
                var span = b.t - a.t;
                var p = span <= 0 ? 1 : (t - a.t) / span;
                var e = ease(p);
                return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e };
            }
        }
        return null;
    }

    function applyBlurTracking(currentTime) {
        var ve = window.VideoEditor;
        if (!ve || !ve.blurRegions) return;
        ve.blurRegions.forEach(function (region) {
            var pos = getTrackedPosition(region, currentTime);
            if (pos !== null) {
                region.x = pos.x;
                region.y = pos.y;
            }
        });
    }

    /* -----------------------------------------------------------------------
       ANIMATION LOOP
    ----------------------------------------------------------------------- */
    (function loop() {
        requestAnimationFrame(loop);
        var ve = window.VideoEditor;
        if (!ve || !ve.blurRegions || ve.blurRegions.length === 0) return;
        var t = 0;
        if (typeof getEditorTimelineClock === 'function') t = getEditorTimelineClock().current || 0;
        else if (ve.currentTime !== undefined) t = ve.currentTime;
        applyBlurTracking(t);
    })();

    document.addEventListener('DOMContentLoaded', function () {
        var sl = document.getElementById('seek-slider');
        if (sl) sl.addEventListener('input', function () {
            var t = 0;
            if (typeof getEditorTimelineClock === 'function') t = getEditorTimelineClock().current || 0;
            applyBlurTracking(t);
        });
    });

    /* -----------------------------------------------------------------------
       CANVAS CROP UTILITY — capture exact pixel region from the canvas
       Returns a base64 PNG of the blur region at the current frame.
    ----------------------------------------------------------------------- */
    function captureBlurRegionTemplate(region) {
        var ve = window.VideoEditor;
        if (!ve) return null;

        // Prefer the raw video element — gives us the unblurred frame at native resolution,
        // which is exactly what Python's cv2.matchTemplate will search against.
        var videoEl = ve.video;
        if (videoEl && videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
            var vW = videoEl.videoWidth;
            var vH = videoEl.videoHeight;

            // region.x/y/w/h are 0-1 fractions of the VIDEO frame (not the canvas)
            var rx = Math.round(region.x * vW);
            var ry = Math.round(region.y * vH);
            var rw = Math.round(region.w * vW);
            var rh = Math.round(region.h * vH);
            rw = Math.max(1, Math.min(vW - rx, rw));
            rh = Math.max(1, Math.min(vH - ry, rh));
            if (rw <= 0 || rh <= 0) return null;

            var tmp = document.createElement('canvas');
            tmp.width = rw;
            tmp.height = rh;
            var ctx2 = tmp.getContext('2d');
            // Draw just the blur-box region from the raw video (no blur overlay)
            ctx2.drawImage(videoEl, rx, ry, rw, rh, 0, 0, rw, rh);
            return tmp.toDataURL('image/png');
        }

        // Fallback: capture from editor canvas (may include blur overlay, but better than nothing)
        if (!ve.canvas) return null;
        var canvas = ve.canvas;
        var canvasW = canvas.width;
        var canvasH = canvas.height;
        var vidW2 = ve.video ? (ve.video.videoWidth || canvasW) : canvasW;
        var vidH2 = ve.video ? (ve.video.videoHeight || canvasH) : canvasH;
        var vidRatio = vidW2 / vidH2;
        var ratio = canvasW / canvasH;
        var drawW, drawH, drawX, drawY;
        if (vidRatio > ratio) { drawW = canvasW; drawH = Math.round(canvasW / vidRatio); }
        else { drawH = canvasH; drawW = Math.round(canvasH * vidRatio); }
        drawX = Math.round((canvasW - drawW) / 2);
        drawY = Math.round((canvasH - drawH) / 2);
        var rx2 = Math.round(drawX + region.x * drawW);
        var ry2 = Math.round(drawY + region.y * drawH);
        var rw2 = Math.max(1, Math.min(canvasW - rx2, Math.round(region.w * drawW)));
        var rh2 = Math.max(1, Math.min(canvasH - ry2, Math.round(region.h * drawH)));
        if (rw2 <= 0 || rh2 <= 0) return null;
        var tmp2 = document.createElement('canvas');
        tmp2.width = rw2; tmp2.height = rh2;
        tmp2.getContext('2d').drawImage(canvas, rx2, ry2, rw2, rh2, 0, 0, rw2, rh2);
        return tmp2.toDataURL('image/png');
    }

    /* -----------------------------------------------------------------------
       TEMPLATE TRACKING API CALL
    ----------------------------------------------------------------------- */
    function getVideoPath() {
        var ve = window.VideoEditor;
        if (!ve) return '';
        if (ve.clips && ve.clips.length > 0) {
            var c = ve.clips.find(function (x) { return x && x.filePath; });
            if (c) return c.filePath;
        }
        if (window.getSafeFilePath && ve.files && ve.files[0]) {
            return window.getSafeFilePath(ve.files[0]);
        }
        return '';
    }

    /**
     * Start template tracking job for a blur region.
     * Updates region.trackKeyframes when done.
     * Returns a promise that resolves with the keyframes array.
     */
    function runTemplateTrack(region, onProgress) {
        return new Promise(function (resolve, reject) {
            var videoPath = getVideoPath();
            if (!videoPath) {
                reject(new Error('ভিডিও ফাইল পাওয়া যায়নি। প্রথমে ক্লিপ যোগ করুন।'));
                return;
            }

            var templateB64 = captureBlurRegionTemplate(region);
            if (!templateB64) {
                reject(new Error('Template image capture করা যায়নি।'));
                return;
            }

            // Convert normalized region to pixel coords for the Python script
            // region.x/y/w/h are 0-1 fractions of the video frame
            var ve = window.VideoEditor;
            var vidW = ve && ve.video ? (ve.video.videoWidth || 1920) : 1920;
            var vidH = ve && ve.video ? (ve.video.videoHeight || 1080) : 1080;

            // Simple: normalized → video pixel (Python searches in native video resolution)
            var pixX = Math.round(region.x * vidW);
            var pixY = Math.round(region.y * vidH);
            var pixW = Math.round(region.w * vidW);
            var pixH = Math.round(region.h * vidH);

            var payload = {
                videoPath: videoPath,
                templateBase64: templateB64,
                regionX: pixX,
                regionY: pixY,
                regionW: pixW,
                regionH: pixH,
                startSec: region.startSec || 0,
                endSec: region.endSec || 999999,
                searchMargin: 500,
                sampleRate: 0.2   // scan every 0.2 seconds for smooth tracking
            };

            fetch('/api/blur-track/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (!data.ok || !data.jobId) {
                    reject(new Error(data.error || 'Server error'));
                    return;
                }
                var jobId = data.jobId;
                // Poll for completion
                var pollInterval = setInterval(function () {
                    fetch('/api/blur-track/status/' + jobId)
                    .then(function (r) { return r.json(); })
                    .then(function (s) {
                        if (onProgress) onProgress(s.percent || 0, s.message || '');
                        if (s.status === 'done') {
                            clearInterval(pollInterval);
                            resolve(s.keyframes || []);
                        } else if (s.status === 'error' || s.status === 'cancelled') {
                            clearInterval(pollInterval);
                            reject(new Error(s.error || 'ট্র্যাকিং বাতিল হয়েছে'));
                        }
                    })
                    .catch(function (e) {
                        clearInterval(pollInterval);
                        reject(e);
                    });
                }, 500);
            })
            .catch(reject);
        });
    }

    /* -----------------------------------------------------------------------
       UI HELPER
    ----------------------------------------------------------------------- */
    function fmtSec(s) {
        s = Math.max(0, s || 0);
        var m = Math.floor(s / 60);
        var sec = (s % 60).toFixed(1);
        return m > 0 ? m + 'm ' + sec + 's' : sec + 's';
    }

    /* -----------------------------------------------------------------------
       BUILD TRACKING PANEL (injected into every blur region card)
    ----------------------------------------------------------------------- */
    function buildTrackingPanel(region, wrapper, refreshUI) {
        if (!region.trackKeyframes) region.trackKeyframes = [];
        var kfs = region.trackKeyframes;

        var panel = document.createElement('div');
        panel.style.cssText = [
            'background:rgba(16,185,129,0.06)',
            'border-top:1px solid rgba(16,185,129,0.18)',
            'padding:9px 10px',
            'font-family:inherit'
        ].join(';');

        /* ── Title row ── */
        var titleRow = document.createElement('div');
        titleRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:7px;';

        var title = document.createElement('span');
        title.style.cssText = 'font-size:11.5px;font-weight:700;color:#34d399;letter-spacing:0.3px;';
        title.textContent = '🎯 ট্র্যাকিং';

        /* Button group */
        var btnGroup = document.createElement('div');
        btnGroup.style.cssText = 'display:flex;gap:5px;align-items:center;';

        /* ── 🔍 Template Track button ── */
        var trackBtn = document.createElement('button');
        trackBtn.type = 'button';
        trackBtn.style.cssText = [
            'background:rgba(99,102,241,0.2)',
            'border:1px solid rgba(99,102,241,0.5)',
            'color:#a5b4fc',
            'font-size:11px',
            'font-weight:700',
            'padding:3px 9px',
            'border-radius:5px',
            'cursor:pointer',
            'display:flex',
            'align-items:center',
            'gap:4px'
        ].join(';');
        trackBtn.innerHTML = '🔍 অটো ট্র্যাক';
        trackBtn.title = 'AI দিয়ে স্বয়ংক্রিয়ভাবে ভিডিওতে ব্লার ট্র্যাক করুন — একবার করলেই সারা ভিডিওতে কাজ করবে';

        /* ── ➕ Manual Keyframe button ── */
        var addKfBtn = document.createElement('button');
        addKfBtn.type = 'button';
        addKfBtn.style.cssText = [
            'background:rgba(16,185,129,0.15)',
            'border:1px solid rgba(16,185,129,0.4)',
            'color:#6ee7b7',
            'font-size:11px',
            'padding:3px 8px',
            'border-radius:5px',
            'cursor:pointer',
            'display:flex',
            'align-items:center',
            'gap:3px'
        ].join(';');
        addKfBtn.innerHTML = '+ কীফ্রেম';
        addKfBtn.title = 'বর্তমান সময়ে ব্লারের অবস্থান ম্যানুয়ালি যোগ করুন';

        btnGroup.appendChild(trackBtn);
        btnGroup.appendChild(addKfBtn);
        titleRow.appendChild(title);
        titleRow.appendChild(btnGroup);
        panel.appendChild(titleRow);

        /* ── Status / Hint area ── */
        var statusEl = document.createElement('div');
        statusEl.style.cssText = 'font-size:10.5px;color:#6b7280;margin-bottom:6px;line-height:1.5;';

        function updateStatus() {
            if (kfs.length === 0) {
                statusEl.innerHTML = '<span style="color:#6b7280;">ব্লার ফিক্সড। ট্র্যাকিং চালু করতে <b style="color:#a5b4fc;">🔍 অটো ট্র্যাক</b> বা ম্যানুয়াল <b style="color:#6ee7b7;">+ কীফ্রেম</b> ব্যবহার করুন।</span>';
            } else {
                statusEl.innerHTML = '<span style="color:#34d399;">✅ ' + kfs.length + 'টি পয়েন্ট — ব্লার স্বয়ংক্রিয়ভাবে ট্র্যাক করবে।</span>';
            }
        }
        updateStatus();
        panel.appendChild(statusEl);

        /* ── Progress bar (hidden initially) ── */
        var progressWrap = document.createElement('div');
        progressWrap.style.cssText = 'display:none;margin-bottom:7px;';
        var progressBar = document.createElement('div');
        progressBar.style.cssText = 'height:4px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden;margin-bottom:3px;';
        var progressFill = document.createElement('div');
        progressFill.style.cssText = 'height:100%;background:#6366f1;border-radius:2px;width:0%;transition:width 0.3s ease;';
        progressBar.appendChild(progressFill);
        var progressLabel = document.createElement('div');
        progressLabel.style.cssText = 'font-size:10px;color:#818cf8;';
        progressLabel.textContent = 'ট্র্যাকিং চলছে...';
        progressWrap.appendChild(progressBar);
        progressWrap.appendChild(progressLabel);
        panel.appendChild(progressWrap);

        /* ── TRACK BUTTON handler ── */
        var trackJobActive = false;
        trackBtn.addEventListener('click', function (ev) {
            ev.stopPropagation();
            if (trackJobActive) return;

            // Warn if region too small
            if ((region.w || 0) < 0.01 || (region.h || 0) < 0.01) {
                if (window.showToast) window.showToast('ব্লার এরিয়া খুব ছোট — একটু বড় করুন', 'warning');
                return;
            }

            trackJobActive = true;
            trackBtn.disabled = true;
            trackBtn.innerHTML = '⏳ ট্র্যাকিং...';
            progressWrap.style.display = 'block';
            progressFill.style.width = '0%';
            progressLabel.textContent = 'শুরু হচ্ছে...';

            runTemplateTrack(region, function (pct, msg) {
                progressFill.style.width = pct + '%';
                progressLabel.textContent = msg || 'চলছে...';
            })
            .then(function (keyframes) {
                trackJobActive = false;
                trackBtn.disabled = false;
                trackBtn.innerHTML = '🔍 অটো ট্র্যাক';
                progressWrap.style.display = 'none';

                if (keyframes && keyframes.length > 0) {
                    // Convert pixel coords back to normalized (0-1)
                    var ve = window.VideoEditor;
                    var vidW = ve && ve.video ? (ve.video.videoWidth || 1920) : 1920;
                    var vidH = ve && ve.video ? (ve.video.videoHeight || 1080) : 1080;

                    var canvas = ve && ve.canvas;
                    var canvasW = canvas ? canvas.width : vidW;
                    var canvasH = canvas ? canvas.height : vidH;
                    var vidRatio = vidW / vidH;
                    var ratio = canvasW / canvasH;
                    var drawW, drawH, drawX, drawY;
                    if (vidRatio > ratio) {
                        drawW = canvasW; drawH = Math.round(canvasW / vidRatio);
                    } else {
                        drawH = canvasH; drawW = Math.round(canvasH * vidRatio);
                    }

                    // scaleX = vidW / drawW  →  normalized = pixVal / scaleX / drawW = pixVal / vidW
                    region.trackKeyframes = keyframes.map(function (kf) {
                        return {
                            t: kf.t,
                            x: kf.x / vidW,
                            y: kf.y / vidH
                        };
                    });

                    if (typeof triggerAutoSave === 'function') triggerAutoSave();
                    if (window.showToast) window.showToast('✅ ট্র্যাকিং সম্পন্ন! ' + region.trackKeyframes.length + 'টি পয়েন্ট যোগ হয়েছে।', 'success');
                    refreshUI();
                } else {
                    if (window.showToast) window.showToast('⚠️ ট্র্যাক করা যায়নি — ভিডিওতে কন্টেন্ট পাওয়া যায়নি।', 'warning');
                    refreshUI();
                }
            })
            .catch(function (err) {
                trackJobActive = false;
                trackBtn.disabled = false;
                trackBtn.innerHTML = '🔍 অটো ট্র্যাক';
                progressWrap.style.display = 'none';
                if (window.showToast) window.showToast('❌ ট্র্যাকিং ব্যর্থ: ' + (err.message || err), 'error');
                console.error('[BlurTrack]', err);
                refreshUI();
            });
        });

        /* ── MANUAL KEYFRAME button handler ── */
        addKfBtn.addEventListener('click', function (ev) {
            ev.stopPropagation();
            var t = 0;
            if (typeof getEditorTimelineClock === 'function') t = parseFloat((getEditorTimelineClock().current || 0).toFixed(2));
            else if (window.VideoEditor && window.VideoEditor.currentTime !== undefined) t = parseFloat((window.VideoEditor.currentTime || 0).toFixed(2));

            var existing = kfs.find(function (k) { return Math.abs(k.t - t) < 0.1; });
            if (existing) {
                existing.t = t; existing.x = region.x; existing.y = region.y;
            } else {
                kfs.push({ t: t, x: region.x, y: region.y });
                kfs.sort(function (a, b) { return a.t - b.t; });
            }
            if (typeof triggerAutoSave === 'function') triggerAutoSave();
            if (window.showToast) window.showToast('⏱️ ' + fmtSec(t) + '-এ কীফ্রেম যোগ হয়েছে', 'success');
            refreshUI();
        });

        /* ── Keyframe list ── */
        if (kfs.length > 0) {
            var listEl = document.createElement('div');
            listEl.style.cssText = 'display:flex;flex-direction:column;gap:3px;max-height:120px;overflow-y:auto;margin-top:4px;';

            kfs.forEach(function (kf, kfIdx) {
                var row = document.createElement('div');
                row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;background:rgba(0,0,0,0.25);border:1px solid rgba(52,211,153,0.15);border-radius:4px;padding:3px 7px;font-size:10.5px;';

                var left = document.createElement('div');
                left.style.cssText = 'display:flex;align-items:center;gap:5px;color:#a7f3d0;';
                left.innerHTML = '<span style="color:#34d399;font-size:8px;">◆</span> <b>' + fmtSec(kf.t) + '</b> <span style="color:#4b5563;font-size:9px;">x:' + (kf.x * 100).toFixed(0) + '% y:' + (kf.y * 100).toFixed(0) + '%</span>';

                var right = document.createElement('div');
                right.style.cssText = 'display:flex;gap:3px;';

                var seekBtn = document.createElement('button');
                seekBtn.type = 'button'; seekBtn.title = 'এই সময়ে যান';
                seekBtn.style.cssText = 'background:none;border:none;color:#34d399;cursor:pointer;padding:1px 3px;font-size:10px;';
                seekBtn.innerHTML = '▶';
                seekBtn.addEventListener('click', function (ev) {
                    ev.stopPropagation();
                    if (typeof seekEditorTimelineTo === 'function') seekEditorTimelineTo(kf.t);
                    else { var ve2 = window.VideoEditor; if (ve2 && ve2.video) ve2.video.currentTime = kf.t; if (typeof drawFrame === 'function') drawFrame(); }
                });

                var delKfBtn = document.createElement('button');
                delKfBtn.type = 'button'; delKfBtn.title = 'এই পয়েন্ট মুছুন';
                delKfBtn.style.cssText = 'background:none;border:none;color:#f87171;cursor:pointer;padding:1px 3px;font-size:10px;';
                delKfBtn.innerHTML = '✕';
                delKfBtn.addEventListener('click', function (ev) {
                    ev.stopPropagation();
                    region.trackKeyframes = region.trackKeyframes.filter(function (_, i) { return i !== kfIdx; });
                    if (typeof triggerAutoSave === 'function') triggerAutoSave();
                    refreshUI();
                });

                right.appendChild(seekBtn);
                right.appendChild(delKfBtn);
                row.appendChild(left);
                row.appendChild(right);
                listEl.appendChild(row);
            });

            panel.appendChild(listEl);

            /* Clear all */
            if (kfs.length > 1) {
                var clearRow = document.createElement('div');
                clearRow.style.cssText = 'margin-top:5px;text-align:right;';
                var clearBtn = document.createElement('button');
                clearBtn.type = 'button';
                clearBtn.style.cssText = 'background:none;border:1px solid rgba(239,68,68,0.3);color:#fca5a5;font-size:10px;padding:2px 7px;border-radius:4px;cursor:pointer;';
                clearBtn.textContent = '🗑 সব পয়েন্ট মুছুন';
                clearBtn.addEventListener('click', function (ev) {
                    ev.stopPropagation();
                    region.trackKeyframes = [];
                    if (typeof triggerAutoSave === 'function') triggerAutoSave();
                    if (window.showToast) window.showToast('ট্র্যাকিং পয়েন্ট মুছে ফেলা হয়েছে', 'info');
                    refreshUI();
                });
                clearRow.appendChild(clearBtn);
                panel.appendChild(clearRow);
            }
        }

        wrapper.appendChild(panel);
    }

    /* -----------------------------------------------------------------------
       MONKEY-PATCH renderBlurRegionList
    ----------------------------------------------------------------------- */
    function installPatch() {
        if (typeof renderBlurRegionList !== 'function') {
            setTimeout(installPatch, 150);
            return;
        }
        var original = renderBlurRegionList;
        window.renderBlurRegionList = function () {
            original.apply(this, arguments);
            var listEl = document.getElementById('blur-region-list');
            if (!listEl) return;
            var ve = window.VideoEditor;
            if (!ve || !ve.blurRegions) return;
            var wrappers = listEl.querySelectorAll('div[style*="margin-bottom"]');
            ve.blurRegions.forEach(function (region, idx) {
                var wrapper = wrappers[idx];
                if (!wrapper) return;
                if (wrapper.querySelector('[data-blur-track-panel]')) return;
                var panelEl = document.createElement('div');
                panelEl.setAttribute('data-blur-track-panel', '1');
                buildTrackingPanel(region, panelEl, function () {
                    if (typeof renderBlurRegionList === 'function') renderBlurRegionList();
                    if (typeof drawFrame === 'function') drawFrame();
                });
                wrapper.appendChild(panelEl);
            });
        };

        window.applyBlurTracking = applyBlurTracking;
        window.getBlurTrackedPosition = getTrackedPosition;
        console.log('[blur-tracking.js v2] ✅ Template Track system ready.');
    }
    setTimeout(installPatch, 300);

})();
