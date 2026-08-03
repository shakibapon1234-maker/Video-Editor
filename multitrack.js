/* ==========================================================================
   Studio Flow — Multi-Track Timeline (Phase 11, STEP 3 of 4)

   PLAN (see PHASE11_ADVANCED_EDITING_PLAN.txt, "[TODO-MEDIUM] সত্যিকারের
   Multi-Track Timeline"):
     ধাপ ১ [DONE]: data model + UI — arrange extra video/image/audio
             tracks on their own timeline, drag to reposition, trim, delete.
     ধাপ ২ [DONE]: composite these tracks into the LIVE PREVIEW canvas +
             play their audio in sync while scrubbing/playing. Export was
             NOT touched (customExportTime set => no-op), so exported
             videos stayed byte-for-byte identical up through that step.
     ধাপ ৩ [DONE, revised]: exporter.js multi-layer compositing — extra
             video/image tracks get drawn into the exported frames, and
             extra video/audio tracks get mixed into the offline audio
             render (audio.js, "Multi-Track Timeline Extra Audio" section).
             REVISED after initial Step 3 pass: extra tracks are now drawn
             from INSIDE editor.js's drawFrame() (via a small hook,
             `window.drawExtraTracksMidFrame`, called between the main
             video draw and B-roll/caption/text-overlay rendering) instead
             of via a post-hook wrapped around the outer drawEditorFrame
             function. This fixes a real layering bug the first pass had:
             extra video/image tracks used to paint over captions and every
             overlay type, in both preview and export, because the old
             post-hook ran strictly after the whole frame (everything) had
             already been drawn. Now extra tracks sit above the main video
             but below captions/overlays, matching normal editor conventions.
             See the "RENDER-ORDER FIX" comment further down for the full
             technical explanation (the sync-vs-async split this required
             for export specifically).
     ধাপ ৪ (পরে): confirm this file's save/load format is final before
             wider migration.

   STEP 2 DESIGN NOTES (why it works the way it does):
     - Rendering order: editor.js's drawFrame() clears the canvas as its
       very first action (drawCanvasBackground). That means anything we
       draw BEFORE the original frame render gets wiped out immediately —
       so extra tracks can only be composited AFTER the original
       drawEditorFrame() call returns, i.e. on TOP of the main video and
       all its overlays/captions. Track order in state.extraTracks decides
       stacking: tracks added later paint over tracks added earlier — the
       same up-is-forward convention as Premiere/CapCut's V1/V2/V3 tracks.
     - Honest limitation (visible in the panel help text too): because
       extra tracks paint on top of everything, an active video/image
       track clip will visually cover captions/text overlays underneath
       it while it's active. Per-track z-ordering relative to captions
       isn't solvable without editing editor.js's drawFrame() internals,
       which is out of scope for this module.
     - Timeline position: state.currentTime is LOCAL to whichever main
       clip is currently active (it resets each time playback crosses a
       clip boundary), not a single global counter. `computeGlobalTime()`
       below reconstructs the true "seconds since the start of the whole
       project" figure the same way mainTimelineDuration() already does,
       so extra-track clips line up correctly regardless of how many main
       clips came before the one currently playing.
     - Video/audio playback: each extra-track clip lazily gets its own
       <video>/<audio> element (never attached to the DOM — canvas
       drawImage works from a detached, playing video element). It plays
       only while its window is on-screen and the main timeline is
       playing; otherwise it's paused and hard-seeked so scrubbing while
       paused still shows/produces the right frame.

   WHY A SEPARATE MODULE: editor.js already has one single main "clips"
   timeline (Phase 2B) that Split/Freeze/PIP/Transitions/etc. all assume.
   Rather than touch that 13000+ line file and risk breaking the existing
   architecture, extra tracks live in their own `state.extraTracks` array
   (added to window.VideoEditor in editor.js) and this file owns 100% of
   their UI AND their preview compositing. Persistence (save/restore +
   IndexedDB file storage) is already wired up in editor.js's
   saveProjectToBrowserStorage / restoreProjectFromBrowserStorage, the
   same way brollOverlays are.

   DATA MODEL:
     state.extraTracks = [
       { id, name, type: 'video'|'image'|'audio', muted, volume,
         clips: [
           { id, type, url, file, name,
             duration,       // full length of the source media
             sourceStart,    // trim-in point within the source (seconds)
             sourceEnd,      // trim-out point within the source (seconds)
             timelineOffset  // where this clip sits on the shared timeline (seconds)
           }, ...
         ]
       }, ...
     ]
   ========================================================================== */
(function () {
    'use strict';

    var idCounter = 0;
    function uid() { return Date.now() + '_mt' + (idCounter++); }

    function ve() { return window.VideoEditor || null; }

    // Custom confirm dialog — replaces native confirm() which is unreliable in Electron.
    // Returns a Promise<boolean>.
    function mtConfirm(message) {
        return new Promise(function (resolve) {
            var overlay = document.createElement('div');
            overlay.style.cssText = [
                'position:fixed;inset:0;z-index:999999',
                'background:rgba(0,0,0,0.55)',
                'display:flex;align-items:center;justify-content:center'
            ].join(';');

            var box = document.createElement('div');
            box.style.cssText = [
                'background:#1e293b;border:1px solid #334155',
                'border-radius:10px;padding:24px 28px;min-width:300px;max-width:420px',
                'box-shadow:0 20px 50px rgba(0,0,0,0.6)',
                'font-family:inherit;color:#e2e8f0'
            ].join(';');

            var title = document.createElement('div');
            title.style.cssText = 'font-size:13px;font-weight:600;margin-bottom:12px;color:#f1f5f9;display:flex;align-items:center;gap:8px';
            title.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color:#f59e0b"></i> নিশ্চিত করুন';

            var msg = document.createElement('p');
            msg.style.cssText = 'font-size:13px;margin:0 0 20px;line-height:1.6;color:#cbd5e1';
            msg.innerText = message;

            var btnRow = document.createElement('div');
            btnRow.style.cssText = 'display:flex;justify-content:flex-end;gap:10px';

            var cancelBtn = document.createElement('button');
            cancelBtn.innerText = 'বাতিল করুন';
            cancelBtn.style.cssText = [
                'padding:7px 16px;border-radius:6px;border:1px solid #475569',
                'background:transparent;color:#94a3b8;cursor:pointer;font-size:13px'
            ].join(';');

            var okBtn = document.createElement('button');
            okBtn.innerText = 'ঠিক আছে (OK)';
            okBtn.style.cssText = [
                'padding:7px 16px;border-radius:6px;border:none',
                'background:#ef4444;color:#fff;cursor:pointer;font-size:13px;font-weight:600'
            ].join(';');

            var resolved = false;
            function done(result) {
                if (resolved) return;  // guard against double-call
                resolved = true;
                try { document.body.removeChild(overlay); } catch (e) {}
                resolve(result);
            }

            cancelBtn.addEventListener('click', function () { done(false); });
            okBtn.addEventListener('click', function () { done(true); });
            overlay.addEventListener('click', function (e) {
                if (e.target === overlay) done(false);
            });

            btnRow.appendChild(cancelBtn);
            btnRow.appendChild(okBtn);
            box.appendChild(title);
            box.appendChild(msg);
            box.appendChild(btnRow);
            overlay.appendChild(box);
            document.body.appendChild(overlay);
            okBtn.focus();
        });
    }

    function mainTimelineDuration() {
        var state = ve();
        if (!state || !state.clips || !state.clips.length) return Math.max(5, (state && state.duration) || 5);
        var total = 0;
        state.clips.forEach(function (c) {
            if (window.getClipOutputDuration) {
                total += window.getClipOutputDuration(c);
            } else {
                var speed = Math.max(0.5, Math.min(2, Number(c.speed) || 1));
                total += Math.max(0, ((c.end || 0) - (c.start || 0))) / speed;
            }
        });
        return Math.max(1, total);
    }

    // Reconstruct "seconds since the start of the whole project" from the
    // currently-active main clip + its LOCAL currentTime — mirrors the same
    // per-clip speed-adjusted summing that mainTimelineDuration() does above,
    // but stops at the active clip instead of summing everything.
    function computeGlobalTime() {
        var state = ve();
        if (!state) return 0;
        if (!state.clips || !state.clips.length) return state.currentTime || 0;
        var activeIdx = -1;
        for (var i = 0; i < state.clips.length; i++) {
            if (state.clips[i].id === state.activeClipId) { activeIdx = i; break; }
        }
        if (activeIdx < 0) return state.currentTime || 0;
        var elapsed = 0;
        for (var j = 0; j < activeIdx; j++) {
            var c = state.clips[j];
            if (window.getClipOutputDuration) {
                elapsed += window.getClipOutputDuration(c);
            } else {
                var speed = Math.max(0.5, Math.min(2, Number(c.speed) || 1));
                elapsed += Math.max(0, ((c.end || 0) - (c.start || 0))) / speed;
            }
        }
        var active = state.clips[activeIdx];
        var withinClip;
        if (window.getClipOutputElapsedForSourceTime) {
            withinClip = window.getClipOutputElapsedForSourceTime(active, state.currentTime || 0);
        } else {
            var activeSpeed = Math.max(0.5, Math.min(2, Number(active.speed) || 1));
            withinClip = Math.max(0, ((state.currentTime || 0) - (active.start || 0))) / activeSpeed;
        }
        return elapsed + withinClip;
    }

    function formatT(sec) {
        sec = Math.max(0, sec || 0);
        var m = Math.floor(sec / 60);
        var s = (sec % 60).toFixed(1);
        return (m < 10 ? '0' + m : m) + ':' + (Number(s) < 10 ? '0' + s : s);
    }

    function afterChange(label) {
        if (window.captureUndoCheckpoint) window.captureUndoCheckpoint();
        if (window.recordEditorHistory) window.recordEditorHistory(label);
        if (typeof window.triggerAutoSave === 'function') window.triggerAutoSave();
    }

    // ---------------------------------------------------------------
    // Media probing — figure out a duration for a newly-added file.
    // ---------------------------------------------------------------
    function probeDuration(type, url) {
        return new Promise(function (resolve) {
            if (type === 'image') { resolve(5.0); return; }
            var el = document.createElement(type === 'audio' ? 'audio' : 'video');
            el.preload = 'metadata';
            el.src = url;
            var done = false;
            var finish = function (d) { if (done) return; done = true; resolve(d); };
            el.addEventListener('loadedmetadata', function () {
                finish((el.duration && isFinite(el.duration)) ? el.duration : 5.0);
            });
            el.addEventListener('error', function () { finish(5.0); });
            setTimeout(function () { finish(5.0); }, 4000);
        });
    }

    function trackEndTime(track) {
        var end = 0;
        (track.clips || []).forEach(function (c) {
            var dur = Math.max(0.1, (c.sourceEnd - c.sourceStart));
            end = Math.max(end, c.timelineOffset + dur);
        });
        return end;
    }

    // ---------------------------------------------------------------
    // Compositing — shared helpers (used by both live preview and export)
    // ---------------------------------------------------------------

    function findActiveClipInTrack(track, t) {
        var clips = track.clips || [];
        for (var i = 0; i < clips.length; i++) {
            var c = clips[i];
            var dur = Math.max(0.1, c.sourceEnd - c.sourceStart);
            if (t >= c.timelineOffset && t < c.timelineOffset + dur) return c;
        }
        return null;
    }

    // "Cover" fit — fills the whole canvas, cropping whichever dimension
    // overflows, same idea as CSS object-fit: cover. Kept separate from
    // editor.js's own fit/fill math since these tracks have no crop/position
    // model of their own yet.
    function drawCover(ctx, media, mw, mh, cw, ch) {
        if (!mw || !mh || !cw || !ch) return;
        var mediaAspect = mw / mh, canvasAspect = cw / ch;
        var sx = 0, sy = 0, sw = mw, sh = mh;
        if (mediaAspect > canvasAspect) {
            sw = mh * canvasAspect;
            sx = (mw - sw) / 2;
        } else {
            sh = mw / canvasAspect;
            sy = (mh - sh) / 2;
        }
        try { ctx.drawImage(media, sx, sy, sw, sh, 0, 0, cw, ch); } catch (e) { /* not decodable yet */ }
    }

    function ensureMediaEl(clip, type) {
        if (clip._el) return clip._el;
        var el = document.createElement(type === 'audio' ? 'audio' : 'video');
        el.src = clip.url;
        el.preload = 'auto';
        el.playsInline = true;
        clip._el = el;
        return el;
    }

    // ---------------------------------------------------------------
    // Free positioning/resizing for image & video extra-track clips.
    //
    // clip.transform = { x, y, w } — x/y are the box's CENTER, normalized
    // to the canvas (0.5, 0.5 = dead center); w is the box width as a
    // fraction of canvas width. Height always follows the media's own
    // aspect ratio inside that box (contain-fit — the image/video is
    // never cropped, just placed/scaled), so it can be dragged anywhere
    // and made bigger/smaller without distortion.
    //
    // A clip with NO transform (every clip added before this feature, and
    // every new clip until the user opts in) keeps the exact old
    // behavior — drawCover(), full-screen, cropped to fill — so nothing
    // already-saved changes appearance. Clicking a clip's position button
    // (see buildClipBlock) is what first assigns a transform.
    // ---------------------------------------------------------------
    var selectedClipId = null;

    function calcFitTransform(clip, canvas, mode) {
        var mw = 0, mh = 0;
        if (clip && clip.type === 'image') {
            if (clip.imageImg && clip.imageImg.naturalWidth) {
                mw = clip.imageImg.naturalWidth;
                mh = clip.imageImg.naturalHeight;
            }
        } else if (clip && clip.type === 'video') {
            if (clip._el && clip._el.videoWidth) {
                mw = clip._el.videoWidth;
                mh = clip._el.videoHeight;
            }
        }
        var cw = (canvas && canvas.width) ? canvas.width : 1280;
        var ch = (canvas && canvas.height) ? canvas.height : 720;
        var mediaAspect = (mw && mh) ? (mw / mh) : (cw / ch);
        var canvasAspect = cw / ch;

        var wRatio = 1.0;
        if (mode === 'fill') {
            if (mediaAspect >= canvasAspect) {
                wRatio = mediaAspect / canvasAspect;
            } else {
                wRatio = 1.0;
            }
        } else {
            if (mediaAspect <= canvasAspect) {
                wRatio = mediaAspect / canvasAspect;
            } else {
                wRatio = 1.0;
            }
        }
        return { x: 0.5, y: 0.5, w: Math.max(0.05, Math.min(2.5, wRatio)) };
    }

    function ensureTransform(clip) {
        if (!clip.transform) {
            var canvas = ve() && ve().canvas;
            clip.transform = calcFitTransform(clip, canvas, 'fit');
        }
        return clip.transform;
    }

    function transformBoxPx(transform, mw, mh, canvas) {
        var boxW = transform.w * canvas.width;
        var aspect = (mw && mh) ? (mw / mh) : (canvas.width / canvas.height);
        var boxH = boxW / aspect;
        return {
            x: transform.x * canvas.width - boxW / 2,
            y: transform.y * canvas.height - boxH / 2,
            w: boxW, h: boxH
        };
    }

    function drawSelectionHandles(ctx, box) {
        ctx.save();
        ctx.strokeStyle = '#818cf8';
        ctx.lineWidth = 2;
        ctx.setLineDash([7, 5]);
        ctx.strokeRect(box.x, box.y, box.w, box.h);
        ctx.setLineDash([]);
        var hs = 14;
        ctx.fillStyle = '#4f46e5';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.fillRect(box.x + box.w - hs / 2, box.y + box.h - hs / 2, hs, hs);
        ctx.strokeRect(box.x + box.w - hs / 2, box.y + box.h - hs / 2, hs, hs);
        ctx.restore();
    }

    // Word-style photo treatments, shared by preview and export because this
    // is drawn in the common extra-track compositor.
    function drawImageDesignFrame(ctx, clip, box, media) {
        var design = clip.imageDesign || clip.visualTemplate || 'standard';
        if (design.startsWith('word-')) design = design.replace('word-', '');
        if (design === 'standard') return;
        var minSide = Math.max(1, Math.min(box.w, box.h));
        ctx.save();
        if (design === 'shadow') {
            ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = Math.max(2, minSide * .012);
            ctx.shadowColor = 'rgba(0,0,0,.62)'; ctx.shadowBlur = Math.max(12, minSide * .12); ctx.shadowOffsetY = Math.max(7, minSide * .055);
            ctx.strokeRect(box.x, box.y, box.w, box.h);
        } else if (design === 'white-frame' || design === 'polaroid') {
            var f = Math.max(10, minSide * .075), extra = design === 'polaroid' ? Math.max(22, box.h * .14) : 0;
            ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = f; ctx.shadowOffsetY = f * .35;
            if (extra) {
                ctx.fillStyle = '#fff';
                ctx.fillRect(box.x - f / 2, box.y + box.h - f / 2, box.w + f, extra + f);
            }
            ctx.strokeStyle = '#fff'; ctx.lineWidth = f; ctx.strokeRect(box.x, box.y, box.w, box.h);
        } else if (design === 'double-frame') {
            var g = Math.max(5, minSide * .035);
            ctx.strokeStyle = '#151515'; ctx.lineWidth = Math.max(2, minSide * .016); ctx.strokeRect(box.x - g, box.y - g, box.w + g * 2, box.h + g * 2);
            ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(2, minSide * .012); ctx.strokeRect(box.x - g * 2.2, box.y - g * 2.2, box.w + g * 4.4, box.h + g * 4.4);
        } else if (design === 'rounded') {
            var r = Math.max(14, minSide * .09); ctx.strokeStyle = 'rgba(255,255,255,.92)'; ctx.lineWidth = Math.max(3, minSide * .02);
            ctx.shadowColor = 'rgba(0,0,0,.42)'; ctx.shadowBlur = Math.max(10, minSide * .09); ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(box.x, box.y, box.w, box.h, r); else ctx.rect(box.x, box.y, box.w, box.h); ctx.stroke();
        } else if (design === 'circle') {
            ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(5, minSide * .035); ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = Math.max(10, minSide * .1);
            ctx.beginPath(); ctx.arc(box.x + box.w / 2, box.y + box.h / 2, minSide / 2, 0, Math.PI * 2); ctx.stroke();
        } else if (design === 'reflection') {
            var rh = Math.max(14, box.h * .23), gr = ctx.createLinearGradient(box.x, box.y + box.h, box.x, box.y + box.h + rh);
            if (media) { ctx.save(); ctx.beginPath(); ctx.rect(box.x, box.y + box.h + Math.max(4, minSide * .025), box.w, rh); ctx.clip(); ctx.globalAlpha = .34; ctx.translate(0, box.y * 2 + box.h * 2 + Math.max(4, minSide * .025)); ctx.scale(1, -1); try { ctx.drawImage(media, box.x, box.y, box.w, box.h); } catch (e) {} ctx.restore(); }
            gr.addColorStop(0, 'rgba(0,0,0,.04)'); gr.addColorStop(1, 'rgba(0,0,0,.82)'); ctx.save(); ctx.beginPath(); ctx.rect(box.x, box.y + box.h + Math.max(4, minSide * .025), box.w, rh); ctx.clip(); ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = gr;
            ctx.fillRect(box.x, box.y + box.h + Math.max(4, minSide * .025), box.w, rh); ctx.restore();
        } else if (design === 'bevel-3d' || design === 'depth-3d' || design === '3d-extruded' || design === '3d-isometric' || design === '3d-neon' || design === '3d-popart' || design === '3d-glass') {
            var frameW = Math.max(8, minSide * 0.06);
            var cx = box.x + box.w / 2, cy = box.y + box.h / 2;
            var tiltY = -0.22, tiltX = 0.08;
            if (design === 'depth-3d') { tiltY = -0.30; tiltX = 0.12; }
            else if (design === '3d-extruded') { tiltY = -0.34; tiltX = 0.15; }
            else if (design === '3d-isometric') { tiltY = -0.38; tiltX = 0.18; }
            else if (design === '3d-neon') { tiltY = -0.24; tiltX = 0.10; }
            else if (design === '3d-popart') { tiltY = -0.28; tiltX = 0.12; }
            else if (design === '3d-glass') { tiltY = -0.26; tiltX = 0.11; }

            // Ground shadow
            ctx.save();
            ctx.translate(cx, box.y + box.h + Math.max(12, box.h * 0.06));
            ctx.scale(1, 0.22);
            var sg = ctx.createRadialGradient(0, 0, 10, 0, 0, box.w * 0.65);
            sg.addColorStop(0, 'rgba(0,0,0,0.55)');
            sg.addColorStop(0.6, 'rgba(0,0,0,0.20)');
            sg.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(0, 0, box.w * 0.65, 0, Math.PI * 2); ctx.fill();
            ctx.restore();

            // 3D transform
            ctx.save();
            ctx.translate(cx, cy);
            ctx.transform(Math.cos(tiltY), Math.sin(tiltX), -Math.sin(tiltY) * 0.52, Math.cos(tiltX) * 0.92, 0, 0);
            ctx.translate(-cx, -cy);

            var depthSteps = design === '3d-extruded' ? 22 : (design === '3d-isometric' ? 26 : (design === 'depth-3d' ? 16 : 10));
            ctx.save();
            ctx.shadowBlur = 0;
            for (var i = depthSteps; i >= 1; i--) {
                var offX = i * (design === '3d-isometric' ? 0.9 : 0.7);
                var offY = i * (design === '3d-isometric' ? 1.1 : 0.85);

                if (design === '3d-extruded') {
                    var shade = Math.round(15 + (i / depthSteps) * 35);
                    ctx.fillStyle = 'rgb(' + shade + ',' + (shade + 10) + ',' + (shade + 25) + ')';
                    ctx.fillRect(box.x + offX - frameW / 2, box.y + offY - frameW / 2, box.w + frameW, box.h + frameW);
                } else if (design === '3d-isometric') {
                    var r = Math.round(180 - i * 3);
                    var g = Math.round(120 - i * 3);
                    var b = Math.round(20 - i * 0.5);
                    ctx.fillStyle = 'rgb(' + Math.max(40, r) + ',' + Math.max(25, g) + ',' + Math.max(5, b) + ')';
                    ctx.fillRect(box.x + offX - frameW / 2, box.y + offY - frameW / 2, box.w + frameW, box.h + frameW);
                } else {
                    var darkVal = Math.round(30 + (i / depthSteps) * 60);
                    ctx.fillStyle = 'rgba(' + darkVal + ',' + darkVal + ',' + darkVal + ',0.45)';
                    ctx.fillRect(box.x + offX - frameW / 2, box.y + offY - frameW / 2, box.w + frameW, box.h + frameW);
                }
            }
            ctx.restore();

            ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
            ctx.shadowBlur = Math.max(18, frameW * 2.2);
            ctx.shadowOffsetX = design === 'depth-3d' ? frameW * 1.6 : frameW * 0.8;
            ctx.shadowOffsetY = Math.max(12, frameW * 1.4);
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = frameW; ctx.strokeRect(box.x, box.y, box.w, box.h);

            ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.fillRect(box.x - frameW / 2, box.y - frameW / 2, box.w + frameW, frameW * 0.5);
            ctx.fillRect(box.x - frameW / 2, box.y - frameW / 2, frameW * 0.5, box.h + frameW);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
            ctx.fillRect(box.x - frameW / 2, box.y + box.h, box.w + frameW, frameW * 0.5);
            ctx.fillRect(box.x + box.w, box.y - frameW / 2, frameW * 0.5, box.h + frameW);
            ctx.restore();
        }
        ctx.restore();
    }

    // Draws a clip's media either at its custom position/size (transform
    // set) or with the original full-screen cover behavior (no transform
    // yet). `isExporting` suppresses the selection handles — those are
    // live-preview editing UI only and must never end up in the exported
    // video.
    function drawClipMedia(ctx, media, mw, mh, canvas, clip, isExporting) {
        if (!mw || !mh || !canvas.width || !canvas.height) return;
        if (clip.transform) {
            var box = transformBoxPx(clip.transform, mw, mh, canvas);
            var isVisualDesignClip = (clip.type === 'image' || clip.type === 'video' || clip.type === 'gif');
            if (isVisualDesignClip && (clip.imageDesign === 'circle' || clip.visualTemplate === 'word-circle')) {
                var minS = Math.min(box.w, box.h);
                box.x += (box.w - minS) / 2;
                box.y += (box.h - minS) / 2;
                box.w = minS; box.h = minS;
            }
            var activeDesign = clip.imageDesign || clip.visualTemplate || 'standard';
            var shaped = isVisualDesignClip && (activeDesign === 'circle' || activeDesign === 'word-circle' || activeDesign === 'rounded' || activeDesign === 'word-rounded');
            if (shaped) { ctx.save(); ctx.beginPath(); if (activeDesign === 'circle' || activeDesign === 'word-circle') ctx.arc(box.x + box.w / 2, box.y + box.h / 2, Math.min(box.w, box.h) / 2, 0, Math.PI * 2); else if (ctx.roundRect) ctx.roundRect(box.x, box.y, box.w, box.h, Math.max(14, Math.min(box.w, box.h) * .09)); else ctx.rect(box.x, box.y, box.w, box.h); ctx.clip(); }
            try { ctx.drawImage(media, box.x, box.y, box.w, box.h); } catch (e) { /* not decodable yet */ }
            if (shaped) ctx.restore();
            if (isVisualDesignClip) drawImageDesignFrame(ctx, clip, box, media);
            if (!isExporting && selectedClipId === clip.id) drawSelectionHandles(ctx, box);
        } else {
            drawCover(ctx, media, mw, mh, canvas.width, canvas.height);
            if (clip.type === 'image') drawImageDesignFrame(ctx, clip, { x: 0, y: 0, w: canvas.width, h: canvas.height }, media);
        }
    }

    // Finds the clip currently selected for canvas editing, but only if
    // it's actually the clip on-screen right now (its track's active clip
    // at the current playhead) and its media size is already known —
    // dragging needs both to compute/hit-test its on-screen box.
    function findSelectedActiveClip() {
        var state = ve();
        if (!state || !selectedClipId || !state.extraTracks) return null;
        var globalT = computeGlobalTime();
        for (var i = 0; i < state.extraTracks.length; i++) {
            var track = state.extraTracks[i];
            if (track.type === 'audio') continue;
            var active = findActiveClipInTrack(track, globalT);
            if (!active || active.id !== selectedClipId) continue;
            var natural = track.type === 'image'
                ? ((active.imageImg && active.imageImg.naturalWidth) ? { w: active.imageImg.naturalWidth, h: active.imageImg.naturalHeight } : null)
                : ((active._el && active._el.videoWidth) ? { w: active._el.videoWidth, h: active._el.videoHeight } : null);
            if (!natural) return null;
            return { clip: active, track: track, natural: natural };
        }
        return null;
    }

    // Same canvas-pixel-space conversion as editor.js's own getCanvasCoords
    // (accounts for the canvas being letterboxed/pillarboxed inside its DOM
    // element) — kept as a local copy since this module owns its own
    // pointer handling rather than reaching into editor.js's closure.
    function canvasCoordsFromEvent(e) {
        var state = ve();
        var canvas = state && state.canvas;
        if (!canvas) return null;
        var rect = canvas.getBoundingClientRect();
        var clientX = e.touches ? e.touches[0].clientX : e.clientX;
        var clientY = e.touches ? e.touches[0].clientY : e.clientY;
        var wRect = rect.width, hRect = rect.height;
        if (!wRect || !hRect) return null;
        var rCanvas = canvas.width / canvas.height, rRect = wRect / hRect;
        var wRender = wRect, hRender = hRect, xOff = 0, yOff = 0;
        if (rCanvas > rRect) {
            hRender = wRect / rCanvas;
            yOff = (hRect - hRender) / 2;
        } else {
            wRender = hRect * rCanvas;
            xOff = (wRect - wRender) / 2;
        }
        return {
            x: ((clientX - rect.left - xOff) / wRender) * canvas.width,
            y: ((clientY - rect.top - yOff) / hRender) * canvas.height
        };
    }

    var dragState = null; // { mode: 'move'|'resize', clip, startCoords, startTransform }

    // While the video is PLAYING, editor.js's own animation loop redraws the
    // canvas every frame automatically. While PAUSED, that loop bails out
    // immediately and nothing repaints the canvas on its own — so selecting
    // a clip, dragging its box, or resetting its position would otherwise
    // never actually show up on screen (the click/drag "worked" internally
    // but the old frame just stayed on screen). This forces a single
    // repaint any time the paused canvas needs to reflect a change here.
    function requestPreviewRedraw() {
        var state = ve();
        if (state && !state.isPlaying && window.redrawPausedFrameGlobal) {
            window.redrawPausedFrameGlobal();
        }
    }

    function hitTestBox(coords, box) {
        var hs = 22; // generous grab radius around the corner handle, in canvas px
        if (coords.x >= box.x + box.w - hs && coords.x <= box.x + box.w + hs / 2 &&
            coords.y >= box.y + box.h - hs && coords.y <= box.y + box.h + hs / 2) return 'resize';
        if (coords.x >= box.x && coords.x <= box.x + box.w && coords.y >= box.y && coords.y <= box.y + box.h) return 'move';
        return null;
    }

    // The three hooks below are called from editor.js's own canvas pointer
    // handlers (one line each — see handlePointerDown/Move/Up) so this
    // module's drag-to-reposition can share the same canvas without a
    // second, conflicting listener. Each returns true only when it actually
    // consumed the event (a selected clip's box was hit / a drag was in
    // progress) — false means editor.js should handle the event exactly as
    // it always has.
    function mtCanvasPointerDown(e) {
        var found = findSelectedActiveClip();
        if (!found) return false;
        var coords = canvasCoordsFromEvent(e);
        if (!coords) return false;
        var transform = ensureTransform(found.clip);
        var box = transformBoxPx(transform, found.natural.w, found.natural.h, ve().canvas);
        var hit = hitTestBox(coords, box);
        if (!hit) return false;
        // An overlay (text / symbol / sticker / shape+text) drawn on top of
        // this clip should always win the click — otherwise, whenever a
        // background clip is selected, this box (which usually spans most or
        // all of the frame) intercepts every pointerdown before editor.js
        // ever gets a chance to hit-test its own overlays, making them
        // impossible to drag or select.
        if (window.__topOverlayHitAt && window.__topOverlayHitAt(coords)) return false;
        dragState = {
            mode: hit, clip: found.clip, startCoords: coords,
            startTransform: { x: transform.x, y: transform.y, w: transform.w }
        };
        e.preventDefault();
        requestPreviewRedraw();
        return true;
    }

    function mtCanvasPointerMove(e) {
        if (!dragState) return false;
        var state = ve();
        var canvas = state && state.canvas;
        if (!canvas) return false;
        var coords = canvasCoordsFromEvent(e);
        if (!coords) return false;
        var dx = coords.x - dragState.startCoords.x;
        var dy = coords.y - dragState.startCoords.y;
        var t = dragState.clip.transform;
        if (dragState.mode === 'move') {
            t.x = Math.max(0, Math.min(1, dragState.startTransform.x + dx / canvas.width));
            t.y = Math.max(0, Math.min(1, dragState.startTransform.y + dy / canvas.height));
        } else {
            // Box is anchored at its CENTER, so a corner moving by dx only
            // covers half the width change — double it so the handle
            // tracks the pointer instead of lagging at half-speed.
            var grownW = dragState.startTransform.w + (dx / canvas.width) * 2;
            t.w = Math.max(0.05, Math.min(2.5, grownW));
        }
        e.preventDefault();
        requestPreviewRedraw();
        return true;
    }

    function mtCanvasPointerUp() {
        if (!dragState) return false;
        var clipName = (dragState.clip && dragState.clip.name) ? dragState.clip.name : 'Canvas item';
        dragState = null;
        afterChange('Canvas: Adjusted position/size of "' + clipName + '"');
        requestPreviewRedraw();
        return true;
    }

    window.__mtCanvasPointerDown = mtCanvasPointerDown;
    window.__mtCanvasPointerMove = mtCanvasPointerMove;
    window.__mtCanvasPointerUp = mtCanvasPointerUp;

    function updateBlockSelectionStyles() {
        document.querySelectorAll('.mt-clip-block').forEach(function (el) {
            var isSel = el.getAttribute('data-clip-id') === selectedClipId;
            el.style.boxShadow = isSel ? '0 0 0 2px #818cf8' : '';
        });
    }

    // ---------------------------------------------------------------
    // RENDER-ORDER FIX (this update): extra tracks used to be drawn via a
    // POST-hook wrapped around window.drawEditorFrame/window.redrawPausedFrameGlobal
    // — i.e. strictly AFTER editor.js's entire drawFrame() had already run,
    // so an active video/image track visually covered EVERYTHING, including
    // captions and text/sticker/symbol/shape overlays, in both preview and
    // export.
    //
    // Fix: editor.js's drawFrame() now calls window.drawExtraTracksMidFrame()
    // itself, at one specific point in its own render order — right after the
    // main video + blur regions are drawn, and right BEFORE captions/overlays
    // (B-roll, text, stickers, symbols, shapes, highlights, captions) are
    // drawn. So extra tracks now sit ABOVE the main video but BELOW every
    // caption/overlay, in both live preview and export — the same v-track
    // stacking convention CapCut/Premiere use, where captions/overlays are
    // effectively their own top-most layer rather than part of any one video
    // track.
    //
    // The one wrinkle this creates: drawFrame() is a SYNCHRONOUS function —
    // editor.js draws straight to the canvas, nothing awaited — but exporter.js
    // needs a video extra-track's frame to be exactly seeked before it's
    // drawn, and seeking is inherently async (must await the 'seeked' event).
    // So export now splits into two steps instead of one:
    //   1. exporter.js calls (and AWAITS) `prepareExtraTracksForExportFrame`
    //      BEFORE calling window.drawEditorFrame() — this seeks every active
    //      video-track clip's dedicated export element to the right position
    //      and waits for it to settle. Nothing is drawn in this step.
    //   2. window.drawEditorFrame() runs synchronously as normal; inside it,
    //      editor.js's mid-frame hook calls `drawExtraTracksMidFrame()`
    //      (also synchronous), which just draws whatever is already-seeked/
    //      ready — no waiting needed here since step 1 already handled it.
    // Live preview doesn't need this split: syncing (play/pause/soft-seek)
    // and drawing both still happen together, synchronously, inside
    // `drawExtraTracksMidFrame()` — exactly what this module always did for
    // preview, just called from a different (correctly-ordered) place now.
    // ---------------------------------------------------------------

    function waitForLoadedMeta(el, maxWaitMs) {
        return new Promise(function (resolve) {
            if (el.readyState >= 1) { resolve(); return; }
            var settled = false;
            function done() {
                if (settled) return;
                settled = true;
                el.removeEventListener('loadedmetadata', done);
                el.removeEventListener('error', done);
                resolve();
            }
            el.addEventListener('loadedmetadata', done);
            el.addEventListener('error', done);
            setTimeout(done, maxWaitMs || 3000);
        });
    }

    function waitForExportSeek(el, targetTime, maxWaitMs) {
        return new Promise(function (resolve) {
            var settled = false;
            function done() {
                if (settled) return;
                settled = true;
                el.removeEventListener('seeked', done);
                resolve();
            }
            el.addEventListener('seeked', done);
            try { el.currentTime = targetTime; } catch (e) { done(); return; }
            setTimeout(done, maxWaitMs || 1500);
        });
    }

    function ensureExportMediaEl(clip) {
        if (clip._exportEl) return clip._exportEl;
        var el = document.createElement('video');
        el.src = clip.url;
        el.preload = 'auto';
        el.muted = true; // silent on purpose — this element is ONLY for capturing
        el.playsInline = true;             // visual frames; audio is mixed separately
        clip._exportEl = el;               // and offline in audio.js.
        return el;
    }

    // Called from exporter.js, AWAITED, BEFORE window.drawEditorFrame(). Seeks
    // every active video-track clip's dedicated export element so it's ready
    // for drawExtraTracksMidFrame() to draw synchronously a moment later.
    // Image/audio tracks need no preparation — nothing async to do for them.
    async function prepareExtraTracksForExportFrame(globalT) {
        var state = ve();
        if (!state || !state.extraTracks || !state.extraTracks.length) return;
        var t = globalT || 0;
        for (var i = 0; i < state.extraTracks.length; i++) {
            var track = state.extraTracks[i];
            if (track.type !== 'video') continue;
            var active = findActiveClipInTrack(track, t);
            if (!active) continue;
            var el = ensureExportMediaEl(active);
            await waitForLoadedMeta(el);
            var relative = Math.max(0, (t - active.timelineOffset) + active.sourceStart);
            relative = Math.min(relative, Math.max(0, (active.duration || relative) - 0.03));
            if (Math.abs(el.currentTime - relative) > (1 / 90)) {
                await waitForExportSeek(el, relative);
            }
        }
    }

    // Called SYNCHRONOUSLY from INSIDE editor.js's drawFrame(), at the exact
    // point described above. Handles both live preview (state.customExportTime
    // undefined — syncs play/pause/soft-seek AND draws, same behavior this
    // module always had) and export (state.customExportTime set — assumes
    // prepareExtraTracksForExportFrame() already ran for this frame, so it
    // only draws, using the already-seeked export element). Stacking order:
    // state.extraTracks array order, later tracks paint over earlier ones.
    function drawExtraTracksMidFrame() {
        var state = ve();
        if (!state || !state.extraTracks || !state.extraTracks.length) return;
        var ctx = state.ctx, canvas = state.canvas;
        if (!ctx || !canvas || !canvas.width || !canvas.height) return;
        var isExporting = (state.customExportTime !== undefined) || !!state.isExportingVideo;
        var globalT = isExporting ? (state.exportTickerTime || 0) : computeGlobalTime();

        state.extraTracks.forEach(function (track) {
            if (track.type === 'audio') {
                // No visual layer to draw, but it still needs to actually play
                // during LIVE PREVIEW so the user can hear it while adjusting
                // volume/timing — during export the final mix is done offline
                // instead (audio.js), so nothing to do here in that case.
                if (isExporting) return;
                try {
                    var activeAudio = findActiveClipInTrack(track, globalT);
                    (track.clips || []).forEach(function (c) {
                        if (c !== activeAudio && c._el && typeof c._el.pause === 'function' && !c._el.paused) c._el.pause();
                    });
                    if (!activeAudio) return;
                    var relativeAudio = Math.max(0, (globalT - activeAudio.timelineOffset) + activeAudio.sourceStart);
                    var audioEl = ensureMediaEl(activeAudio, 'audio');
                    if (!audioEl || typeof audioEl.pause !== 'function' || typeof audioEl.play !== 'function') return;
                    audioEl.muted = !!track.muted;
                    audioEl.volume = Math.max(0, Math.min(1, track.volume !== undefined ? track.volume : 1));
                    if (state.isPlaying) {
                        if (Math.abs(audioEl.currentTime - relativeAudio) > 0.35) audioEl.currentTime = relativeAudio;
                        if (audioEl.paused) audioEl.play().catch(function () {});
                    } else {
                        if (!audioEl.paused) audioEl.pause();
                        if (Math.abs(audioEl.currentTime - relativeAudio) > 0.05) audioEl.currentTime = relativeAudio;
                    }
                } catch (e) {
                    // Never let extra-track audio sync crash export or preview.
                }
                return;
            }
            var active = findActiveClipInTrack(track, globalT);

            if (!isExporting) {
                // Live preview also owns pausing any clip in this track that
                // ISN'T active right now, so it stops decoding/making sound.
                (track.clips || []).forEach(function (c) {
                    if (c !== active && c._el && !c._el.paused) c._el.pause();
                });
            }

            if (!active) return;

            if (track.type === 'image') {
                if (active.imageImg && active.imageImg.naturalWidth) {
                    drawClipMedia(ctx, active.imageImg, active.imageImg.naturalWidth, active.imageImg.naturalHeight, canvas, active, isExporting);
                }
                return;
            }

            // Video track.
            if (isExporting) {
                var exportEl = active._exportEl;
                if (exportEl && exportEl.readyState >= 2 && exportEl.videoWidth) {
                    drawClipMedia(ctx, exportEl, exportEl.videoWidth, exportEl.videoHeight, canvas, active, true);
                }
                return;
            }

            var relative = Math.max(0, (globalT - active.timelineOffset) + active.sourceStart);
            var el = ensureMediaEl(active, track.type);
            el.muted = !!track.muted;
            el.volume = Math.max(0, Math.min(1, track.volume !== undefined ? track.volume : 1));

            if (state.isPlaying) {
                // Loosely synced during free-running playback; hard-correct
                // only on real drift so we don't stutter the stream every frame.
                if (Math.abs(el.currentTime - relative) > 0.35) el.currentTime = relative;
                if (el.paused) el.play().catch(function () {});
            } else {
                if (!el.paused) el.pause();
                if (Math.abs(el.currentTime - relative) > 0.05) el.currentTime = relative;
            }

            if (el.readyState >= 2) {
                drawClipMedia(ctx, el, el.videoWidth, el.videoHeight, canvas, active, false);
            }
        });
    }

    // Releases the dedicated export-only <video> elements created above.
    // Called by exporter.js once rendering finishes (success or cancel) so
    // these don't linger decoding/holding memory after export is done.
    function cleanupExtraTracksExportMedia() {
        var state = ve();
        if (!state || !state.extraTracks) return;
        state.extraTracks.forEach(function (track) {
            (track.clips || []).forEach(function (c) {
                if (c._exportEl) {
                    try { c._exportEl.pause(); c._exportEl.src = ''; } catch (e) { /* ignore */ }
                    c._exportEl = null;
                }
            });
        });
    }

    window.drawExtraTracksMidFrame = drawExtraTracksMidFrame;
    window.prepareExtraTracksForExportFrame = prepareExtraTracksForExportFrame;
    window.cleanupExtraTracksExportMedia = cleanupExtraTracksExportMedia;
    // ---------------------------------------------------------------
    // Track / clip mutations
    // ---------------------------------------------------------------
    function addTrack(type) {
        var state = ve();
        if (!state) return;
        if (!state.extraTracks) state.extraTracks = [];
        var count = state.extraTracks.filter(function (t) { return t.type === type; }).length + 1;
        var label = type === 'video' ? 'Video' : (type === 'audio' ? 'Audio' : 'Image');
        var trackName = label + ' Track ' + count;
        state.extraTracks.push({
            id: uid(), name: trackName, type: type,
            muted: false, volume: 1, clips: []
        });
        render();
        afterChange('Added ' + trackName);
    }

    function removeTrack(trackId) {
        var state = ve();
        if (!state || !state.extraTracks) return;
        mtConfirm('এই ট্র্যাক এবং এর সব ক্লিপ মুছে ফেলতে চান?').then(function (ok) {
            if (!ok) return;
            try {
                var s = ve();
                if (!s || !s.extraTracks) return;

                // Look up by id string match — guard against type mismatch
                var tidStr = String(trackId);
                var target = s.extraTracks.find(function (t) {
                    return String(t.id) === tidStr;
                });

                var trackName = target ? target.name : 'Track';

                // Clean up audio elements — each step individually guarded so a
                // stale element from a previous project session cannot abort the deletion.
                if (target) {
                    (target.clips || []).forEach(function (c) {
                        try {
                            if (c._el) {
                                c._el.pause();
                                c._el.src = '';
                                c._el.load(); // reset pending decode
                            }
                        } catch (elErr) {
                            console.warn('[multitrack] clip element cleanup error (ignored):', elErr);
                        }
                        if (c.id === selectedClipId) selectedClipId = null;
                        // Revoke blob URLs created for this clip so memory is freed
                        try { if (c.url && c.url.startsWith('blob:')) URL.revokeObjectURL(c.url); } catch (e) {}
                    });
                }

                // Remove the track — use String comparison to survive id type drift
                s.extraTracks = s.extraTracks.filter(function (t) {
                    return String(t.id) !== tidStr;
                });

                render();
                afterChange('Deleted ' + trackName);
            } catch (err) {
                console.error('[multitrack] removeTrack failed:', err);
                // Force a re-render anyway so UI stays consistent with actual state
                try { render(); } catch (e) {}
            }
        });
    }

    // Pauses every extra-track audio/video element that's currently playing,
    // without touching state.extraTracks itself. drawExtraTracksMidFrame()
    // normally does this pausing on every animation frame, but that loop only
    // runs while state.isPlaying is true — the very frame that flips it to
    // false exits before reaching drawFrame(), so nothing ever tells these
    // elements to stop. Anywhere the main video/timeline is paused or stopped
    // needs to call this explicitly, or an extra audio track just keeps
    // playing in the background with no on-screen way to silence it.
    function pauseAllExtraTracksMedia() {
        var state = ve();
        if (!state || !state.extraTracks) return;
        state.extraTracks.forEach(function (track) {
            (track.clips || []).forEach(function (c) {
                if (c._el && typeof c._el.pause === 'function' && !c._el.paused) {
                    try { c._el.pause(); } catch (e) {}
                }
            });
        });
    }

    // Pauses AND fully releases every extra-track media element (src cleared,
    // reference dropped). Used when the whole workspace/project is being
    // cleared or reset, so a track's audio/video can't keep decoding or
    // playing in the background after it disappears from state.extraTracks.
    function releaseAllExtraTracksMedia() {
        var state = ve();
        if (!state || !state.extraTracks) return;
        state.extraTracks.forEach(function (track) {
            (track.clips || []).forEach(function (c) {
                if (c._el) {
                    try { c._el.pause(); c._el.src = ''; } catch (e) {}
                    c._el = null;
                }
                if (c._exportEl) {
                    try { c._exportEl.pause(); c._exportEl.src = ''; } catch (e) {}
                    c._exportEl = null;
                }
            });
        });
    }

    window.pauseAllExtraTracksMedia = pauseAllExtraTracksMedia;
    window.releaseAllExtraTracksMedia = releaseAllExtraTracksMedia;

    async function addClipToTrack(track, file) {
        var url = URL.createObjectURL(file);
        var duration = await probeDuration(track.type, url);
        var clip = {
            id: uid(), type: track.type, url: url, file: file, name: file.name,
            duration: duration, sourceStart: 0, sourceEnd: duration,
            timelineOffset: trackEndTime(track)
        };
        if (track.type === 'image') {
            clip.imageImg = new Image();
            clip.imageImg.onload = function () {
                var state = ve();
                if (state && state.canvas) {
                    clip.transform = calcFitTransform(clip, state.canvas, 'fit');
                    requestPreviewRedraw();
                }
            };
            clip.imageImg.src = url;
        } else if (track.type === 'video') {
            var tempV = document.createElement('video');
            tempV.preload = 'metadata';
            tempV.onloadedmetadata = function () {
                var state = ve();
                if (state && state.canvas) {
                    clip.transform = calcFitTransform(clip, state.canvas, 'fit');
                    requestPreviewRedraw();
                }
            };
            tempV.src = url;
        }
        track.clips.push(clip);
        selectedClipId = clip.id;
        render();
        afterChange(track.name + ': Added clip "' + file.name + '"');
    }

    function removeClip(track, clipId) {
        var target = (track.clips || []).find(function (c) { return c.id === clipId; });
        var clipName = target ? target.name : 'clip';
        if (target && target._el) { target._el.pause(); target._el.src = ''; }
        track.clips = track.clips.filter(function (c) { return c.id !== clipId; });
        if (selectedClipId === clipId) selectedClipId = null;
        render();
        afterChange(track.name + ': Deleted clip "' + clipName + '"');
    }

    // ---------------------------------------------------------------
    // Rendering
    // ---------------------------------------------------------------
    var PX_PER_SEC = 40; // baseline zoom, min 400px wide timeline area

    function styleEl(el, styles) { Object.assign(el.style, styles); }

    function buildRuler(totalDur) {
        var ruler = document.createElement('div');
        styleEl(ruler, {
            position: 'relative', height: '18px', marginLeft: '132px',
            borderBottom: '1px solid var(--border-color)', fontSize: '10px',
            color: 'var(--text-muted)'
        });
        var steps = 6;
        for (var i = 0; i <= steps; i++) {
            var t = (totalDur * i) / steps;
            var mark = document.createElement('span');
            mark.innerText = formatT(t);
            styleEl(mark, { position: 'absolute', left: (i / steps) * 100 + '%', transform: 'translateX(-50%)' });
            ruler.appendChild(mark);
        }
        return ruler;
    }

    function buildTrackRow(track, totalDur) {
        var row = document.createElement('div');
        styleEl(row, { display: 'flex', alignItems: 'stretch', gap: '8px', marginBottom: '8px' });

        // --- Left: track header controls ---
        var header = document.createElement('div');
        styleEl(header, {
            width: '124px', flexShrink: '0', display: 'flex', flexDirection: 'column',
            gap: '4px', padding: '6px 8px', borderRadius: '6px',
            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)'
        });

        var icon = track.type === 'video' ? 'fa-film' : (track.type === 'audio' ? 'fa-music' : 'fa-image');
        var nameRow = document.createElement('div');
        nameRow.style.display = 'flex';
        nameRow.style.alignItems = 'center';
        nameRow.style.gap = '5px';
        nameRow.style.fontSize = '11px';
        nameRow.innerHTML = '<i class="fa-solid ' + icon + '"></i><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + track.name + '</span>';
        header.appendChild(nameRow);

        var ctrlRow = document.createElement('div');
        ctrlRow.style.display = 'flex';
        ctrlRow.style.alignItems = 'center';
        ctrlRow.style.gap = '6px';

        if (track.type !== 'image') {
            var muteBtn = document.createElement('button');
            muteBtn.title = 'Mute this track';
            muteBtn.innerHTML = '<i class="fa-solid ' + (track.muted ? 'fa-volume-xmark' : 'fa-volume-high') + '"></i>';
            styleEl(muteBtn, { background: 'transparent', border: 'none', color: track.muted ? '#f87171' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '11px' });
            muteBtn.addEventListener('click', function () {
                track.muted = !track.muted;
                render();
                afterChange(track.name + ': Mute ' + (track.muted ? 'enabled' : 'disabled'));
            });
            ctrlRow.appendChild(muteBtn);

            var vol = document.createElement('input');
            vol.type = 'range'; vol.min = '0'; vol.max = '1'; vol.step = '0.05';
            vol.value = track.volume;
            vol.style.flex = '1';
            vol.title = 'Track volume';
            vol.addEventListener('input', function () {
                track.volume = parseFloat(vol.value);
                afterChange(track.name + ': Volume set to ' + Math.round(track.volume * 100) + '%');
            });
            ctrlRow.appendChild(vol);
        }
        header.appendChild(ctrlRow);

        var btnRow = document.createElement('div');
        btnRow.style.display = 'flex';
        btnRow.style.gap = '4px';

        var addBtn = document.createElement('button');
        addBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
        addBtn.title = 'Add media to this track';
        styleEl(addBtn, { flex: '1', background: 'rgba(79,70,229,0.15)', border: '1px solid var(--primary)', color: 'var(--text-primary)', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', padding: '3px 0' });
        var fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = track.type === 'video' ? 'video/*' : (track.type === 'audio' ? 'audio/*' : 'image/*');
        fileInput.style.display = 'none';
        addBtn.addEventListener('click', function () { fileInput.click(); });
        fileInput.addEventListener('change', function () {
            if (fileInput.files && fileInput.files[0]) addClipToTrack(track, fileInput.files[0]);
            fileInput.value = '';
        });
        btnRow.appendChild(addBtn);
        btnRow.appendChild(fileInput);

        var delTrackBtn = document.createElement('button');
        delTrackBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
        delTrackBtn.title = 'Delete track';
        styleEl(delTrackBtn, { background: 'transparent', border: '1px solid var(--border-color)', color: '#f87171', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', padding: '3px 6px' });
        delTrackBtn.addEventListener('click', function () { removeTrack(track.id); });
        btnRow.appendChild(delTrackBtn);

        header.appendChild(btnRow);
        row.appendChild(header);

        // --- Right: timeline lane ---
        var lane = document.createElement('div');
        styleEl(lane, {
            position: 'relative', flex: '1', minHeight: '38px', borderRadius: '6px',
            background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border-color)'
        });

        (track.clips || []).forEach(function (clip) {
            lane.appendChild(buildClipBlock(track, clip, totalDur, lane));
        });

        row.appendChild(lane);
        return row;
    }

    function clampOffset(track, clip, offset) {
        var dur = clip.sourceEnd - clip.sourceStart;
        return Math.max(0, offset);
    }

    function buildClipBlock(track, clip, totalDur, lane) {
        var dur = Math.max(0.1, clip.sourceEnd - clip.sourceStart);
        var block = document.createElement('div');
        block.className = 'mt-clip-block';
        block.setAttribute('data-clip-id', clip.id);
        var isSelected = (selectedClipId === clip.id);
        styleEl(block, {
            position: 'absolute', top: '3px', bottom: '3px',
            left: (clip.timelineOffset / totalDur) * 100 + '%',
            width: Math.max(1, (dur / totalDur) * 100) + '%',
            background: track.type === 'video' ? 'rgba(79,70,229,0.35)' : (track.type === 'audio' ? 'rgba(16,185,129,0.35)' : 'rgba(245,158,11,0.35)'),
            border: isSelected ? '2px solid #818cf8' : '1px solid rgba(255,255,255,0.25)',
            boxShadow: isSelected ? '0 0 8px rgba(129, 140, 248, 0.5)' : 'none',
            borderRadius: '4px', display: 'flex', alignItems: 'center', overflow: 'hidden',
            cursor: 'grab', userSelect: 'none', minWidth: '36px', touchAction: 'none'
        });

        block.addEventListener('click', function (e) {
            if (e.target === delBtn || e.target === posBtn || e.target === resetBtn || e.target === resizeHandle) return;
            selectedClipId = (selectedClipId === clip.id) ? null : clip.id;
            updateBlockSelectionStyles();
            render();
            requestPreviewRedraw();
        });

        if (track.type === 'audio') {
            var progressFill = document.createElement('div');
            progressFill.className = 'mt-audio-progress';
            styleEl(progressFill, {
                position: 'absolute', left: '0', top: '0', bottom: '0',
                width: '0%', opacity: '0.35',
                background: 'rgba(16,185,129,0.5)',
                pointerEvents: 'none', transition: 'width 0.1s linear'
            });
            block.appendChild(progressFill);
        }

        var label = document.createElement('span');
        label.innerText = clip.name && clip.name.length > 18 ? clip.name.slice(0, 18) + '…' : (clip.name || '');
        styleEl(label, { fontSize: '10px', padding: '0 6px', whiteSpace: 'nowrap', overflow: 'hidden', pointerEvents: 'none' });
        block.appendChild(label);

        if (track.type !== 'audio') {
            var posBtn = document.createElement('button');
            posBtn.innerHTML = '<i class="fa-solid fa-arrows-up-down-left-right"></i>';
            posBtn.title = 'ক্যানভাসে ড্র্যাগ করে পজিশন/সাইজ ঠিক করুন (Drag to position & resize on canvas)';
            styleEl(posBtn, {
                marginLeft: 'auto', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.75)',
                cursor: 'pointer', fontSize: '10px', padding: '0 5px', flexShrink: '0'
            });
            posBtn.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
            posBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                selectedClipId = (selectedClipId === clip.id) ? null : clip.id;
                if (selectedClipId === clip.id) ensureTransform(clip);
                updateBlockSelectionStyles();
                render();
                requestPreviewRedraw();
            });
            block.appendChild(posBtn);

            var resetBtn = document.createElement('button');
            resetBtn.innerHTML = '<i class="fa-solid fa-rotate-left"></i>';
            resetBtn.title = 'পুরো স্ক্রিন পজিশনে ফিরিয়ে নিন (Reset to full-screen)';
            styleEl(resetBtn, {
                background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.55)',
                cursor: 'pointer', fontSize: '10px', padding: '0 5px', flexShrink: '0'
            });
            resetBtn.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
            resetBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                clip.transform = null;
                afterChange('Canvas: Reset "' + clip.name + '" full screen');
                render();
                requestPreviewRedraw();
            });
            block.appendChild(resetBtn);
        }

        var delBtn = document.createElement('button');
        delBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        styleEl(delBtn, {
            marginLeft: 'auto', background: 'transparent', border: 'none', color: '#fff',
            cursor: 'pointer', fontSize: '10px', padding: '0 5px', flexShrink: '0'
        });
        delBtn.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
        delBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            removeClip(track, clip.id);
        });
        block.appendChild(delBtn);

        var resizeHandle = document.createElement('div');
        styleEl(resizeHandle, {
            position: 'absolute', right: '0', top: '0', bottom: '0', width: '10px',
            cursor: 'ew-resize', touchAction: 'none',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.18))'
        });
        block.appendChild(resizeHandle);

        // --- Drag to reposition ---
        var dragging = false, dragStartX = 0, dragStartOffset = 0;
        block.addEventListener('pointerdown', function (e) {
            if (e.target === resizeHandle) return;
            dragging = true;
            dragStartX = e.clientX;
            dragStartOffset = clip.timelineOffset;
            block.style.cursor = 'grabbing';
            try { block.setPointerCapture(e.pointerId); } catch (err) {}
            e.preventDefault();
        });
        block.addEventListener('pointermove', function (e) {
            if (!dragging) return;
            var laneWidth = lane.getBoundingClientRect().width || 1;
            var deltaSec = ((e.clientX - dragStartX) / laneWidth) * totalDur;
            clip.timelineOffset = clampOffset(track, clip, dragStartOffset + deltaSec);
            block.style.left = (clip.timelineOffset / totalDur) * 100 + '%';
        });
        function endDrag(e) {
            if (!dragging) return;
            dragging = false;
            block.style.cursor = 'grab';
            try { block.releasePointerCapture(e.pointerId); } catch (err) {}
            afterChange(track.name + ': Moved "' + clip.name + '" to ' + formatT(clip.timelineOffset));
            render();
            requestPreviewRedraw();
        }
        block.addEventListener('pointerup', endDrag);
        block.addEventListener('pointercancel', endDrag);

        // --- Right-edge resize (trim) ---
        var resizing = false, resizeStartX = 0, resizeStartEnd = 0;
        resizeHandle.addEventListener('pointerdown', function (e) {
            resizing = true;
            resizeStartX = e.clientX;
            resizeStartEnd = clip.sourceEnd;
            try { resizeHandle.setPointerCapture(e.pointerId); } catch (err) {}
            e.preventDefault();
            e.stopPropagation();
        });
        resizeHandle.addEventListener('pointermove', function (e) {
            if (!resizing) return;
            var laneWidth = lane.getBoundingClientRect().width || 1;
            var deltaSec = ((e.clientX - resizeStartX) / laneWidth) * totalDur;
            var newEnd = Math.max(clip.sourceStart + 0.2, resizeStartEnd + deltaSec);
            if (clip.type === 'image') {
                newEnd = Math.min(newEnd, 600);
                if (newEnd > clip.duration) clip.duration = newEnd;
            } else {
                newEnd = Math.min(clip.duration, newEnd);
            }
            clip.sourceEnd = newEnd;
            var newDur = Math.max(0.1, clip.sourceEnd - clip.sourceStart);
            block.style.width = Math.max(1, (newDur / totalDur) * 100) + '%';
        });
        function endResize(e) {
            if (!resizing) return;
            resizing = false;
            try { resizeHandle.releasePointerCapture(e.pointerId); } catch (err) {}
            var endSec = clip.timelineOffset + (clip.sourceEnd - clip.sourceStart);
            afterChange(track.name + ': Trimmed "' + clip.name + '" (' + formatT(clip.timelineOffset) + ' - ' + formatT(endSec) + ')');
            render();
            requestPreviewRedraw();
        }
        resizeHandle.addEventListener('pointerup', endResize);
        resizeHandle.addEventListener('pointercancel', endResize);

        return block;
    }

    function findSelectedClip() {
        var state = ve();
        if (!state || !selectedClipId || !state.extraTracks) return null;
        for (var i = 0; i < state.extraTracks.length; i++) {
            var track = state.extraTracks[i];
            var clips = track.clips || [];
            for (var j = 0; j < clips.length; j++) {
                if (clips[j].id === selectedClipId) {
                    return { clip: clips[j], track: track };
                }
            }
        }
        return null;
    }

    function buildClipInspector(track, clip) {
        var card = document.createElement('div');
        styleEl(card, {
            background: 'rgba(79, 70, 229, 0.1)',
            border: '1px solid rgba(129, 140, 248, 0.4)',
            borderRadius: '8px', padding: '8px 12px', marginBottom: '10px',
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px',
            fontSize: '12px', color: 'var(--text-primary)'
        });

        var titleEl = document.createElement('div');
        titleEl.style.fontWeight = '600';
        titleEl.style.display = 'flex';
        titleEl.style.alignItems = 'center';
        titleEl.style.gap = '6px';
        var icon = track.type === 'video' ? 'fa-film' : (track.type === 'audio' ? 'fa-music' : 'fa-image');
        titleEl.innerHTML = '<i class="fa-solid ' + icon + '" style="color:#818cf8;"></i> <span>' + (clip.name || 'Clip') + ' (' + track.name + ')</span>';
        card.appendChild(titleEl);

        // Start Time Input
        var startWrap = document.createElement('div');
        styleEl(startWrap, { display: 'flex', alignItems: 'center', gap: '5px' });
        startWrap.innerHTML = '<span style="color:var(--text-secondary);font-weight:500;">Start (শুরু):</span>';
        var startInput = document.createElement('input');
        startInput.type = 'number';
        startInput.step = '0.1';
        startInput.min = '0';
        startInput.value = clip.timelineOffset.toFixed(1);
        styleEl(startInput, {
            width: '65px', padding: '3px 6px', borderRadius: '4px',
            border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.3)',
            color: '#fff', fontSize: '11px', textAlign: 'center'
        });
        startInput.addEventListener('change', function () {
            var val = parseFloat(startInput.value);
            if (!isNaN(val) && val >= 0) {
                clip.timelineOffset = val;
                afterChange(track.name + ': Moved "' + clip.name + '" start to ' + formatT(val));
                render();
                requestPreviewRedraw();
            }
        });
        startWrap.appendChild(startInput);
        startWrap.appendChild(document.createTextNode('s'));
        card.appendChild(startWrap);

        // End Time Input
        var dur = Math.max(0.1, clip.sourceEnd - clip.sourceStart);
        var currentEnd = clip.timelineOffset + dur;
        var endWrap = document.createElement('div');
        styleEl(endWrap, { display: 'flex', alignItems: 'center', gap: '5px' });
        endWrap.innerHTML = '<span style="color:var(--text-secondary);font-weight:500;">End (শেষ):</span>';
        var endInput = document.createElement('input');
        endInput.type = 'number';
        endInput.step = '0.1';
        endInput.min = '0';
        endInput.value = currentEnd.toFixed(1);
        styleEl(endInput, {
            width: '65px', padding: '3px 6px', borderRadius: '4px',
            border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.3)',
            color: '#fff', fontSize: '11px', textAlign: 'center'
        });
        endInput.addEventListener('change', function () {
            var val = parseFloat(endInput.value);
            if (!isNaN(val) && val > clip.timelineOffset) {
                var newDur = val - clip.timelineOffset;
                if (track.type === 'image') {
                    clip.sourceEnd = clip.sourceStart + newDur;
                    if (newDur > clip.duration) clip.duration = newDur;
                } else {
                    clip.sourceEnd = Math.min(clip.duration, clip.sourceStart + newDur);
                }
                afterChange(track.name + ': Trimmed "' + clip.name + '" end to ' + formatT(clip.timelineOffset + (clip.sourceEnd - clip.sourceStart)));
                render();
                requestPreviewRedraw();
            }
        });
        endWrap.appendChild(endInput);
        endWrap.appendChild(document.createTextNode('s'));
        card.appendChild(endWrap);

        // Duration Input
        var durWrap = document.createElement('div');
        styleEl(durWrap, { display: 'flex', alignItems: 'center', gap: '5px' });
        durWrap.innerHTML = '<span style="color:var(--text-secondary);font-weight:500;">Duration:</span>';
        var durInput = document.createElement('input');
        durInput.type = 'number';
        durInput.step = '0.1';
        durInput.min = '0.1';
        durInput.value = dur.toFixed(1);
        styleEl(durInput, {
            width: '60px', padding: '3px 6px', borderRadius: '4px',
            border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.3)',
            color: '#fff', fontSize: '11px', textAlign: 'center'
        });
        durInput.addEventListener('change', function () {
            var newDur = Math.max(0.1, parseFloat(durInput.value) || 0.1);
            if (track.type === 'image') {
                clip.sourceEnd = clip.sourceStart + newDur;
                if (newDur > clip.duration) clip.duration = newDur;
            } else {
                clip.sourceEnd = Math.min(clip.duration, clip.sourceStart + newDur);
            }
            afterChange(track.name + ': Set "' + clip.name + '" duration to ' + newDur.toFixed(1) + 's');
            render();
            requestPreviewRedraw();
        });
        durWrap.appendChild(durInput);
        durWrap.appendChild(document.createTextNode('s'));
        card.appendChild(durWrap);

        // Screen Fit & Transform Actions (for Video & Image tracks)
        if (track.type !== 'audio') {
            var fitGroup = document.createElement('div');
            styleEl(fitGroup, { display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' });

            var fitBtn = document.createElement('button');
            fitBtn.innerHTML = '<i class="fa-solid fa-expand"></i> Fit (ফিট)';
            fitBtn.title = 'ক্যানভাসে ফিট করুন (Contain fit)';
            styleEl(fitBtn, { padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--primary)', background: 'rgba(79,70,229,0.2)', color: '#fff', cursor: 'pointer', fontSize: '11px' });
            fitBtn.addEventListener('click', function () {
                var state = ve();
                clip.transform = calcFitTransform(clip, state && state.canvas, 'fit');
                afterChange('Canvas: Fit "' + clip.name + '" on screen');
                render();
                requestPreviewRedraw();
            });
            fitGroup.appendChild(fitBtn);

            var fillBtn = document.createElement('button');
            fillBtn.innerHTML = '<i class="fa-solid fa-maximize"></i> Fill (কভার)';
            fillBtn.title = 'পুরো ক্যানভাস ফিল করুন (Cover fit)';
            styleEl(fillBtn, { padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.05)', color: '#fff', cursor: 'pointer', fontSize: '11px' });
            fillBtn.addEventListener('click', function () {
                var state = ve();
                clip.transform = calcFitTransform(clip, state && state.canvas, 'fill');
                afterChange('Canvas: Fill "' + clip.name + '" on screen');
                render();
                requestPreviewRedraw();
            });
            fitGroup.appendChild(fillBtn);

            var centerBtn = document.createElement('button');
            centerBtn.innerHTML = '<i class="fa-solid fa-crosshairs"></i> Center';
            centerBtn.title = 'ক্যানভাস সেন্টারে আনুন';
            styleEl(centerBtn, { padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.05)', color: '#fff', cursor: 'pointer', fontSize: '11px' });
            centerBtn.addEventListener('click', function () {
                var t = ensureTransform(clip);
                t.x = 0.5; t.y = 0.5;
                afterChange('Canvas: Centered "' + clip.name + '"');
                render();
                requestPreviewRedraw();
            });
            fitGroup.appendChild(centerBtn);

            var resetCanvasBtn = document.createElement('button');
            resetCanvasBtn.innerHTML = '<i class="fa-solid fa-rotate-left"></i> Reset';
            resetCanvasBtn.title = 'পজিশন রিসেট করুন';
            styleEl(resetCanvasBtn, { padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '11px' });
            resetCanvasBtn.addEventListener('click', function () {
                clip.transform = null;
                afterChange('Canvas: Reset "' + clip.name + '" full screen');
                render();
                requestPreviewRedraw();
            });
            fitGroup.appendChild(resetCanvasBtn);

            card.appendChild(fitGroup);
        }

        if (track.type === 'image' || track.type === 'video' || track.type === 'gif') {
            var designWrap = document.createElement('div');
            styleEl(designWrap, { display: 'flex', alignItems: 'center', gap: '5px' });
            designWrap.innerHTML = '<span style="color:var(--text-secondary);font-weight:500;">Design & 3D Frame:</span>';
            var designSelect = document.createElement('select');
            styleEl(designSelect, { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '2px 6px', fontSize: '11px', flex: '1' });
            designSelect.innerHTML = '<option value="standard">Standard</option><option value="shadow">Soft Shadow</option><option value="white-frame">White Matte Frame</option><option value="double-frame">Double Line Frame</option><option value="rounded">Rounded Glass</option><option value="circle">Circle Frame (গোল)</option><option value="polaroid">Polaroid</option><option value="reflection">Reflection</option><option value="bevel-3d">3D Bevel (থ্রিডি)</option><option value="depth-3d">3D Depth Card</option><option value="3d-extruded">3D Extruded Block</option><option value="3d-isometric">3D Isometric Gold</option><option value="3d-neon">3D Neon Cyber</option><option value="3d-popart">3D Retro Pop-Art</option><option value="3d-glass">3D Crystal Glass</option>';
            designSelect.value = clip.imageDesign || clip.visualTemplate || 'standard';
            designSelect.addEventListener('change', function () { clip.imageDesign = designSelect.value; afterChange(track.name + ': Frame design changed'); render(); requestPreviewRedraw(); });
            designWrap.appendChild(designSelect);
            card.appendChild(designWrap);
        }

        // Close Inspector Button
        var closeBtn = document.createElement('button');
        closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        closeBtn.title = 'ইন্সপেক্টর বন্ধ করুন';
        styleEl(closeBtn, {
            background: 'transparent', border: 'none', color: '#94a3b8',
            cursor: 'pointer', fontSize: '12px', padding: '2px 6px', marginLeft: track.type === 'audio' ? 'auto' : '4px'
        });
        closeBtn.addEventListener('click', function () {
            selectedClipId = null;
            render();
            requestPreviewRedraw();
        });
        card.appendChild(closeBtn);

        return card;
    }

    function render() {
        var mount = document.getElementById('multitrack-mount');
        var state = ve();
        if (!mount || !state) return;

        mount.innerHTML = '';
        var card = document.createElement('div');
        card.className = 'card';

        var headerEl = document.createElement('div');
        headerEl.className = 'card-header';
        headerEl.innerHTML = '<i class="fa-solid fa-layer-group card-icon"></i><h3>Multi-Track Timeline (বিটা — লাইভ প্রিভিউ চালু)</h3>';
        card.appendChild(headerEl);

        var body = document.createElement('div');
        body.className = 'card-body';

        var addRow = document.createElement('div');
        styleEl(addRow, { display: 'flex', gap: '6px', marginBottom: '10px' });
        [['video', 'Video Track'], ['image', 'Image Track'], ['audio', 'Audio Track']].forEach(function (pair) {
            var btn = document.createElement('button');
            btn.className = 'btn';
            btn.innerText = '+ ' + pair[1];
            styleEl(btn, { fontSize: '11px', padding: '5px 10px' });
            btn.addEventListener('click', function () { addTrack(pair[0]); });
            addRow.appendChild(btn);
        });
        body.appendChild(addRow);

        var selInfo = findSelectedClip();
        if (selInfo) {
            body.appendChild(buildClipInspector(selInfo.track, selInfo.clip));
        }

        var totalDur = mainTimelineDuration();
        if (state.extraTracks && state.extraTracks.length > 0) {
            body.appendChild(buildRuler(totalDur));
            var tracksWrap = document.createElement('div');
            tracksWrap.style.marginTop = '4px';
            state.extraTracks.forEach(function (track) {
                tracksWrap.appendChild(buildTrackRow(track, totalDur));
            });
            body.appendChild(tracksWrap);
        } else {
            var empty = document.createElement('p');
            empty.className = 'help-text';
            empty.innerText = 'এখনো কোনো এক্সট্রা ট্র্যাক নেই — উপরের বাটন থেকে একটা যোগ করুন।';
            body.appendChild(empty);
        }

        card.appendChild(body);
        mount.appendChild(card);
    }

    window.renderMultiTrackPanel = render;

    // --- Audio Track Playback Progress (Phase 12) ---
    function updateMultiTrackProgress() {
        var state = ve();
        if (!state || !state.extraTracks) return;
        var globalT = computeGlobalTime();

        state.extraTracks.forEach(function (track) {
            if (track.type !== 'audio') return;
            (track.clips || []).forEach(function (clip) {
                var block = document.querySelector('.mt-clip-block[data-clip-id="' + clip.id + '"]');
                if (!block) return;
                var progressFill = block.querySelector('.mt-audio-progress');
                if (!progressFill) return;

                var clipDur = Math.max(0.1, clip.sourceEnd - clip.sourceStart);
                var clipStart = clip.timelineOffset;
                var clipEnd = clipStart + clipDur;

                if (globalT >= clipStart && globalT <= clipEnd) {
                    var pct = Math.max(0, Math.min(100, ((globalT - clipStart) / clipDur) * 100));
                    progressFill.style.width = pct + '%';
                    progressFill.style.opacity = '0.6';
                } else if (globalT > clipEnd) {
                    progressFill.style.width = '100%';
                    progressFill.style.opacity = '0.35';
                } else {
                    progressFill.style.width = '0%';
                    progressFill.style.opacity = '0.15';
                }
            });
        });
    }

    function startMultiTrackProgressLoop() {
        function tick() {
            updateMultiTrackProgress();
            requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    function init() {
        if (!ve()) {
            setTimeout(init, 200);
            return;
        }
        if (!ve().extraTracks) ve().extraTracks = [];
        render();
        startMultiTrackProgressLoop();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
