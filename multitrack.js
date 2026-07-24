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
        var isExporting = (state.customExportTime !== undefined);
        var globalT = isExporting ? (state.exportTickerTime || 0) : computeGlobalTime();

        state.extraTracks.forEach(function (track) {
            if (track.type === 'audio') {
                // No visual layer to draw, but it still needs to actually play
                // during LIVE PREVIEW so the user can hear it while adjusting
                // volume/timing — during export the final mix is done offline
                // instead (audio.js), so nothing to do here in that case.
                if (isExporting) return;
                var activeAudio = findActiveClipInTrack(track, globalT);
                (track.clips || []).forEach(function (c) {
                    if (c !== activeAudio && c._el && !c._el.paused) c._el.pause();
                });
                if (!activeAudio) return;
                var relativeAudio = Math.max(0, (globalT - activeAudio.timelineOffset) + activeAudio.sourceStart);
                var audioEl = ensureMediaEl(activeAudio, 'audio');
                audioEl.muted = !!track.muted;
                audioEl.volume = Math.max(0, Math.min(1, track.volume !== undefined ? track.volume : 1));
                if (state.isPlaying) {
                    if (audioEl.paused) audioEl.play().catch(function () {});
                    if (Math.abs(audioEl.currentTime - relativeAudio) > 0.35) audioEl.currentTime = relativeAudio;
                } else {
                    if (!audioEl.paused) audioEl.pause();
                    if (Math.abs(audioEl.currentTime - relativeAudio) > 0.05) audioEl.currentTime = relativeAudio;
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
                    drawCover(ctx, active.imageImg, active.imageImg.naturalWidth, active.imageImg.naturalHeight, canvas.width, canvas.height);
                }
                return;
            }

            // Video track.
            if (isExporting) {
                var exportEl = active._exportEl;
                if (exportEl && exportEl.readyState >= 2 && exportEl.videoWidth) {
                    drawCover(ctx, exportEl, exportEl.videoWidth, exportEl.videoHeight, canvas.width, canvas.height);
                }
                return;
            }

            var relative = Math.max(0, (globalT - active.timelineOffset) + active.sourceStart);
            var el = ensureMediaEl(active, track.type);
            el.muted = !!track.muted;
            el.volume = Math.max(0, Math.min(1, track.volume !== undefined ? track.volume : 1));

            if (state.isPlaying) {
                if (el.paused) el.play().catch(function () {});
                // Loosely synced during free-running playback; hard-correct
                // only on real drift so we don't stutter the stream every frame.
                if (Math.abs(el.currentTime - relative) > 0.35) el.currentTime = relative;
            } else {
                if (!el.paused) el.pause();
                if (Math.abs(el.currentTime - relative) > 0.05) el.currentTime = relative;
            }

            if (el.readyState >= 2) {
                drawCover(ctx, el, el.videoWidth, el.videoHeight, canvas.width, canvas.height);
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
        state.extraTracks.push({
            id: uid(), name: label + ' Track ' + count, type: type,
            muted: false, volume: 1, clips: []
        });
        render();
        afterChange('Track added: ' + label);
    }

    function removeTrack(trackId) {
        var state = ve();
        if (!state || !state.extraTracks) return;
        if (!confirm('এই ট্র্যাক এবং এর সব ক্লিপ মুছে ফেলতে চান?')) return;
        var target = state.extraTracks.find(function (t) { return t.id === trackId; });
        if (target) (target.clips || []).forEach(function (c) { if (c._el) { c._el.pause(); c._el.src = ''; } });
        state.extraTracks = state.extraTracks.filter(function (t) { return t.id !== trackId; });
        render();
        afterChange('Track removed');
    }

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
            clip.imageImg.src = url;
        }
        track.clips.push(clip);
        render();
        afterChange('Clip added to ' + track.name);
    }

    function removeClip(track, clipId) {
        var target = (track.clips || []).find(function (c) { return c.id === clipId; });
        if (target && target._el) { target._el.pause(); target._el.src = ''; }
        track.clips = track.clips.filter(function (c) { return c.id !== clipId; });
        render();
        afterChange('Track clip removed');
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
                afterChange('Track mute toggled');
            });
            ctrlRow.appendChild(muteBtn);

            var vol = document.createElement('input');
            vol.type = 'range'; vol.min = '0'; vol.max = '1'; vol.step = '0.05';
            vol.value = track.volume;
            vol.style.flex = '1';
            vol.title = 'Track volume';
            vol.addEventListener('input', function () {
                track.volume = parseFloat(vol.value);
                afterChange('Track volume changed');
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
        styleEl(block, {
            position: 'absolute', top: '3px', bottom: '3px',
            left: (clip.timelineOffset / totalDur) * 100 + '%',
            width: Math.max(1, (dur / totalDur) * 100) + '%',
            background: track.type === 'video' ? 'rgba(79,70,229,0.35)' : (track.type === 'audio' ? 'rgba(16,185,129,0.35)' : 'rgba(245,158,11,0.35)'),
            border: '1px solid rgba(255,255,255,0.25)', borderRadius: '4px',
            display: 'flex', alignItems: 'center', overflow: 'hidden',
            cursor: 'grab', userSelect: 'none', minWidth: '10px'
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

        var delBtn = document.createElement('button');
        delBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        styleEl(delBtn, {
            marginLeft: 'auto', background: 'transparent', border: 'none', color: '#fff',
            cursor: 'pointer', fontSize: '10px', padding: '0 5px'
        });
        delBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            removeClip(track, clip.id);
        });
        block.appendChild(delBtn);

        var resizeHandle = document.createElement('div');
        styleEl(resizeHandle, {
            position: 'absolute', right: '0', top: '0', bottom: '0', width: '8px',
            cursor: 'ew-resize'
        });
        block.appendChild(resizeHandle);

        // --- Drag to reposition ---
        var dragging = false, dragStartX = 0, dragStartOffset = 0;
        block.addEventListener('mousedown', function (e) {
            if (e.target === resizeHandle) return;
            dragging = true;
            dragStartX = e.clientX;
            dragStartOffset = clip.timelineOffset;
            e.preventDefault();
        });
        document.addEventListener('mousemove', function (e) {
            if (!dragging) return;
            var laneWidth = lane.getBoundingClientRect().width || 1;
            var deltaSec = ((e.clientX - dragStartX) / laneWidth) * totalDur;
            clip.timelineOffset = clampOffset(track, clip, dragStartOffset + deltaSec);
            block.style.left = (clip.timelineOffset / totalDur) * 100 + '%';
        });
        document.addEventListener('mouseup', function () {
            if (dragging) { dragging = false; afterChange('Track clip moved'); }
        });

        // --- Right-edge resize (trim) ---
        var resizing = false, resizeStartX = 0, resizeStartEnd = 0;
        resizeHandle.addEventListener('mousedown', function (e) {
            resizing = true;
            resizeStartX = e.clientX;
            resizeStartEnd = clip.sourceEnd;
            e.preventDefault();
            e.stopPropagation();
        });
        document.addEventListener('mousemove', function (e) {
            if (!resizing) return;
            var laneWidth = lane.getBoundingClientRect().width || 1;
            var deltaSec = ((e.clientX - resizeStartX) / laneWidth) * totalDur;
            var newEnd = Math.min(clip.duration, Math.max(clip.sourceStart + 0.2, resizeStartEnd + deltaSec));
            clip.sourceEnd = newEnd;
            var newDur = Math.max(0.1, clip.sourceEnd - clip.sourceStart);
            block.style.width = Math.max(1, (newDur / totalDur) * 100) + '%';
        });
        document.addEventListener('mouseup', function () {
            if (resizing) { resizing = false; afterChange('Track clip trimmed'); }
        });

        return block;
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

        var help = document.createElement('p');
        help.className = 'help-text';
        help.innerText = 'মূল ক্লিপ টাইমলাইনের পাশাপাশি আলাদা ভিডিও/ইমেজ/অডিও ট্র্যাক এখানে সাজানো যায় — ড্র্যাগ করে পজিশন ঠিক করুন, ডান পাশ টেনে ট্রিম করুন। এই ট্র্যাকগুলো লাইভ প্রিভিউ ক্যানভাসে দেখা যায় এবং সাউন্ড ট্র্যাকও প্রিভিউতে বাজে, এক্সপোর্ট করা ভিডিওতেও যুক্ত হয় (ভিডিও/ইমেজ ট্র্যাক ফ্রেমে বসে, ভিডিও/অডিও ট্র্যাকের সাউন্ড এক্সপোর্ট অডিও মিক্সে যোগ হয়) — পরে যোগ করা ট্র্যাক আগেরটার উপরে বসে (Premiere/CapCut-এর V1/V2 কনভেনশন)। স্ট্যাকিং অর্ডার ঠিক করা হয়েছে: এখন থেকে এই ট্র্যাকগুলো মূল ভিডিওর উপরে কিন্তু ক্যাপশন/টেক্সট/স্টিকার/সিম্বল ওভারলের নিচে বসে (প্রিভিউ ও এক্সপোর্ট দুই জায়গাতেই) — তাই এগুলো আর ক্যাপশন ঢেকে দেয় না।';
        body.appendChild(help);

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
