// Video Exporter Engine — Renders Canvas + Mixed Audio into downloadable file
document.addEventListener('DOMContentLoaded', () => {
    const state = window.VideoEditor;

    // requestAnimationFrame is throttled/paused by the browser when the tab is
    // backgrounded (minimized, switched away from) to save power. That silently
    // breaks export in two ways at once: the canvas stops getting redrawn (so
    // MediaRecorder just repeats the last/blank frame) AND the "has this clip
    // finished playing?" check stops running (so the recorder doesn't stop on
    // time) — the wall-clock time spent away from the tab gets baked into the
    // exported file as extra, blank duration. A tiny Web Worker timer is exempt
    // from this throttling, so we drive the render loop from worker "ticks"
    // instead of requestAnimationFrame. This keeps export correct even if the
    // person switches to another window (e.g. to check the file in a player)
    // while it's running.
    let tickerWorker = null;
    function getTickerWorker() {
        if (tickerWorker) return tickerWorker;
        const workerCode = 'setInterval(() => postMessage(1), 33);'; // ~30fps, matches capture rate
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        tickerWorker = new Worker(URL.createObjectURL(blob));
        return tickerWorker;
    }
    function stopTickerWorker() {
        if (tickerWorker) {
            tickerWorker.terminate();
            tickerWorker = null;
        }
    }

    // Robustly wait for video.currentTime to actually reach targetTime after a seek.
    // A single fixed timeout (the old approach) is a race condition: on a slow seek
    // (large jump, heavy concurrent canvas work, CPU contention) the 'seeked' event
    // can simply not have fired yet when the timeout expires, so the caller would
    // start recording from the wrong position. This polls in a loop -- re-checking,
    // and re-issuing the seek if needed -- until the position actually matches
    // (within 150ms of playback), only giving up after maxWaitMs so a genuinely
    // broken seek can't hang the export forever.
    async function waitForSeek(video, targetTime, maxWaitMs = 4000) {
        const seekStart = performance.now();
        video.currentTime = targetTime;
        while (Math.abs(video.currentTime - targetTime) > 0.15) {
            if (performance.now() - seekStart > maxWaitMs) {
                console.warn(`Seek to ${targetTime}s did not complete within ${maxWaitMs}ms (stuck at ${video.currentTime}s). Forcing and continuing.`);
                video.currentTime = targetTime;
                break;
            }
            await new Promise((resolveSeek) => {
                const onSeeked = () => {
                    video.removeEventListener('seeked', onSeeked);
                    resolveSeek();
                };
                video.addEventListener('seeked', onSeeked);
                // Re-check periodically even if 'seeked' never fires for this attempt
                setTimeout(resolveSeek, 150);
            });
            if (Math.abs(video.currentTime - targetTime) > 0.15) {
                video.currentTime = targetTime; // re-issue the seek and try again
            }
        }
    }

    const renderBtn = document.getElementById('render-btn');
    const renderProgressBox = document.getElementById('render-progress-box');
    const renderProgressFill = document.getElementById('render-progress-fill');
    const renderPercentage = document.getElementById('render-percentage');
    const renderStatusText = document.getElementById('render-status-text');
    const renderEtaText = document.getElementById('render-eta-text');
    const cancelRenderBtn = document.getElementById('cancel-render-btn');
    const renderSuccessBox = document.getElementById('render-success-box');
    const downloadLink = document.getElementById('download-link');
    const qualitySelect = document.getElementById('quality-select');

    // Export Progress UX (Phase 6B): cancellation flag checked inside every
    // render tick loop (intro / clips / outro), plus wall-clock timestamps
    // used to estimate remaining time.
    let exportCancelled = false;
    let exportStartTimestamp = 0;

    if (cancelRenderBtn) {
        cancelRenderBtn.addEventListener('click', () => {
            exportCancelled = true;
            cancelRenderBtn.disabled = true;
            renderStatusText.innerText = 'বাতিল করা হচ্ছে... (Cancelling...)';
        });
    }

    // Estimates remaining time from wall-clock elapsed time vs. overall UI
    // progress (0-100), and renders it as "~Xm Ys বাকি". Hidden for the first
    // few percent since the estimate is unreliable that early.
    function updateEta(uiProgress) {
        if (!renderEtaText) return;
        if (!exportStartTimestamp || uiProgress < 4 || uiProgress >= 100) {
            renderEtaText.innerText = '';
            return;
        }
        const elapsedSec = (performance.now() - exportStartTimestamp) / 1000;
        const estimatedTotalSec = elapsedSec / (uiProgress / 100);
        const remainingSec = Math.max(0, Math.round(estimatedTotalSec - elapsedSec));
        const mins = Math.floor(remainingSec / 60);
        const secs = remainingSec % 60;
        renderEtaText.innerText = mins > 0
            ? `~${mins}মি ${secs}সে বাকি (~${mins}m ${secs}s remaining)`
            : `~${secs}সে বাকি (~${secs}s remaining)`;
    }

    const QUALITY_PRESETS = {
        '480p': { maxDim: 480, bitrate: 2_000_000 },
        '720p': { maxDim: 720, bitrate: 5_000_000 },
        '1080p': { maxDim: 1080, bitrate: 8_000_000 }
    };

    renderBtn.addEventListener('click', startExport);

    async function startExport() {
        if (!state.duration || !state.clips || state.clips.length === 0) {
            alert('Please load a video first before exporting.');
            return;
        }

        // Ensure the currently active clip's in-progress trim edits are saved before reading totals
        if (window.renderClipTimeline) {
            const activeClip = state.clips.find(c => c.id === state.activeClipId);
            if (activeClip) {
                activeClip.start = state.startTime;
                activeClip.end = state.endTime;
            }
        }

        const totalDuration = state.clips.reduce((sum, c) => sum + Math.max(0, c.end - c.start), 0);

        if (totalDuration <= 0) {
            alert('Trim duration is invalid. Please set the trim range in Step 2.');
            return;
        }

        // Show progress box
        exportCancelled = false;
        exportStartTimestamp = performance.now();
        if (cancelRenderBtn) cancelRenderBtn.disabled = false;
        renderBtn.disabled = true;
        if (qualitySelect) qualitySelect.disabled = true;
        renderBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Rendering...';
        renderProgressBox.style.display = 'block';
        renderSuccessBox.style.display = 'none';
        renderStatusText.innerText = 'Setting up render pipeline...';
        setProgress(0);

        // Reassure the user if they switch tabs/windows mid-export — the Worker-driven
        // render loop keeps working correctly now, but the browser can still visibly
        // pause video playback rendering, so a short note avoids confusion.
        let originalStatusPrefix = '';
        function handleVisibilityChange() {
            if (document.hidden) {
                originalStatusPrefix = renderStatusText.innerText;
                renderStatusText.innerText = '⚠️ ট্যাব থেকে সরে গেছেন — এক্সপোর্ট চলছে, ফিরে আসার পর প্রোগ্রেস দেখতে পাবেন...';
            } else if (originalStatusPrefix) {
                originalStatusPrefix = '';
            }
        }
        document.addEventListener('visibilitychange', handleVisibilityChange);

        try {
            await runExportPipeline(totalDuration);
        } catch (err) {
            console.error('Export failed:', err);
            if (!exportCancelled) {
                alert('Export failed. Please try again with a shorter or simpler video.');
            }
            renderProgressBox.style.display = 'none';
            renderBtn.disabled = false;
            if (qualitySelect) qualitySelect.disabled = false;
            renderBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Render & Export Video';
        } finally {
            stopTickerWorker();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (cancelRenderBtn) cancelRenderBtn.disabled = false;
        }
    }

    async function runExportPipeline(totalDuration) {
        const canvas = state.canvas;
        const video = state.video;

        // Remember which clip was active in the editor so we can restore it after export finishes
        const originalActiveClipId = state.activeClipId;
        const originalSrc = video.src;
        const originalStartTime = state.startTime;
        const originalEndTime = state.endTime;
        const originalDuration = state.duration;
        const originalCropX = state.cropX;
        const originalCropY = state.cropY;
        const originalCropW = state.cropW;
        const originalCropH = state.cropH;

        // --- Step A: Set up canvas capture stream ---
        renderStatusText.innerText = 'Capturing canvas stream...';
        setProgress(5);

        // Capture canvas at 30fps
        const canvasStream = canvas.captureStream(30);

        // Apply quality preset: scale down captured resolution if canvas exceeds the target max dimension
        const qualityKey = qualitySelect ? qualitySelect.value : '720p';
        const preset = QUALITY_PRESETS[qualityKey] || QUALITY_PRESETS['720p'];

        const videoTrack = canvasStream.getVideoTracks()[0];
        if (videoTrack) {
            const canvasMaxDim = Math.max(canvas.width, canvas.height);
            if (canvasMaxDim > preset.maxDim) {
                const scale = preset.maxDim / canvasMaxDim;
                try {
                    await videoTrack.applyConstraints({
                        width: Math.round(canvas.width * scale),
                        height: Math.round(canvas.height * scale)
                    });
                } catch (err) {
                    console.warn('Resolution constraint not supported, exporting at native canvas size:', err);
                }
            }
        }

        // --- Step B: Set up mixed audio ---
        renderStatusText.innerText = 'Mixing audio tracks...';
        setProgress(10);

        let audioMixResult = null;
        let audioTrack = null;

        if (window.getMixedAudioDestinationStream) {
            audioMixResult = window.getMixedAudioDestinationStream();

            if (audioMixResult && audioMixResult.stream.getAudioTracks().length > 0) {
                audioTrack = audioMixResult.stream.getAudioTracks()[0];
                canvasStream.addTrack(audioTrack);
            }
        }

        // --- Step C: Start MediaRecorder ---
        renderStatusText.innerText = 'Starting recorder...';
        setProgress(15);

        // Choose best supported format
        let mimeType = 'video/webm;codecs=vp9,opus';
        const candidateTypes = [
            'video/mp4;codecs=h264,aac',
            'video/mp4;codecs=h264',
            'video/mp4',
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm;codecs=h264,opus',
            'video/webm'
        ];
        for (const candidate of candidateTypes) {
            if (MediaRecorder.isTypeSupported(candidate)) {
                mimeType = candidate;
                break;
            }
        }

        const recorder = new MediaRecorder(canvasStream, {
            mimeType,
            videoBitsPerSecond: preset.bitrate
        });

        const chunks = [];
        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                chunks.push(e.data);
            }
        };

        recorder.start(100); // Collect data every 100ms
        // Mute speaker output during export without muting the Web Audio graph
        // (video.volume = 0 would silence the MediaRecorder's audio tap too in Chrome)
        if (!window.setSpeakerMuted || !window.setSpeakerMuted(true)) {
            video.volume = 0;
        }

        // Cancellation (Phase 6B): tears down the recorder/audio graph and restores
        // the editor to its pre-export state without producing a download, then
        // resets the render UI. Shared by every phase below (intro / clips / outro).
        async function finishCancelled() {
            renderStatusText.innerText = 'বাতিল করা হয়েছে (Cancelled)';
            try {
                if (recorder.state !== 'inactive') {
                    await new Promise((resolve) => { recorder.onstop = resolve; recorder.stop(); });
                }
            } catch (e) { /* ignore */ }

            if (audioMixResult && audioMixResult.cleanup) {
                audioMixResult.cleanup();
            }
            if (audioTrack) {
                try { canvasStream.removeTrack(audioTrack); } catch (e) {}
            }

            if (video.src !== originalSrc) {
                await new Promise((resolve) => {
                    video.onloadedmetadata = () => resolve();
                    video.src = originalSrc;
                    video.load();
                });
            }
            state.activeClipId = originalActiveClipId;
            state.duration = originalDuration;
            state.startTime = originalStartTime;
            state.endTime = originalEndTime;
            state.cropX = originalCropX;
            state.cropY = originalCropY;
            state.cropW = originalCropW;
            state.cropH = originalCropH;
            video.currentTime = state.startTime;
            if (!window.setSpeakerMuted || !window.setSpeakerMuted(false)) {
                video.volume = Math.min(1.0, state.videoVolume);
            }
            if (window.drawEditorFrame) window.drawEditorFrame();

            renderProgressBox.style.display = 'none';
            renderBtn.disabled = false;
            if (qualitySelect) qualitySelect.disabled = false;
            renderBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Render & Export Video';
            if (renderEtaText) renderEtaText.innerText = '';
        }

        // --- Step D0: Intro / Outro Templates (Phase 5C) ---
        // Fully canvas-drawn title cards rendered straight onto the same canvas
        // MediaRecorder is capturing, before the first clip and after the last one.
        const introDur = state.introEnabled ? Math.max(0.3, parseFloat(state.introDuration) || 3) : 0;
        const outroDur = state.outroEnabled ? Math.max(0.3, parseFloat(state.outroDuration) || 3) : 0;
        const grandTotal = introDur + totalDuration + outroDur;

        async function renderIntroOutroPhase(role, phaseStartElapsed) {
            const durSec = role === 'intro' ? introDur : outroDur;
            if (durSec <= 0) return;
            const config = role === 'intro'
                ? { template: state.introTemplate, title: state.introTitle, subtitle: state.introSubtitle }
                : { template: state.outroTemplate, title: state.outroTitle, subtitle: state.outroSubtitle };

            const worker = getTickerWorker();
            await new Promise((resolve) => {
                const segStart = performance.now();
                function tick() {
                    if (exportCancelled) {
                        worker.removeEventListener('message', tick);
                        resolve();
                        return;
                    }
                    const elapsedSec = (performance.now() - segStart) / 1000;
                    const t = Math.min(1, elapsedSec / durSec);

                    if (window.drawIntroOutroSegment) {
                        window.drawIntroOutroSegment(state.ctx, canvas.width, canvas.height, config, t);
                    }

                    const totalElapsed = phaseStartElapsed + Math.min(elapsedSec, durSec);
                    const progressPercent = grandTotal > 0 ? Math.min(100, (totalElapsed / grandTotal) * 100) : 100;
                    const uiProgress = 20 + (progressPercent * 0.75);
                    setProgress(Math.round(uiProgress));
                    renderStatusText.innerText = role === 'intro' ? 'Rendering intro...' : 'Rendering outro...';

                    if (t >= 1) {
                        worker.removeEventListener('message', tick);
                        resolve();
                    }
                }
                worker.addEventListener('message', tick);
            });
        }

        renderStatusText.innerText = 'Rendering intro...';
        await renderIntroOutroPhase('intro', 0);
        if (exportCancelled) { await finishCancelled(); return; }

        // --- Step D: Play through every clip sequentially while recording ---
        renderStatusText.innerText = 'Rendering video frames...';
        setProgress(20);

        let elapsedBeforeCurrentClip = 0;
        let voiceoverStarted = false;

        for (let clipIndex = 0; clipIndex < state.clips.length; clipIndex++) {
            if (exportCancelled) break;
            const clip = state.clips[clipIndex];
            const clipTrimStart = clip.start;
            const clipTrimEnd = clip.end;
            const clipTrimDuration = Math.max(0, clipTrimEnd - clipTrimStart);
            if (clipTrimDuration <= 0) continue;

            // Load this clip into the shared video element if it isn't already active (video clips only)
            if (clip.type === 'image') {
                video.src = '';
                state.duration = clip.duration;
                state.startTime = clipTrimStart;
                state.endTime = clipTrimEnd;
                state.activeClipId = clip.id;
            } else {
                if (video.src !== clip.url) {
                    await new Promise((resolve) => {
                        video.onloadedmetadata = () => resolve();
                        video.src = clip.url;
                        video.load();
                    });
                }
                state.duration = clip.duration;
                state.startTime = clipTrimStart;
                state.endTime = clipTrimEnd;
                state.activeClipId = clip.id;
            }

            // Apply this clip's own crop area (each clip can have a different crop).
            state.cropX = clip.cropX || 0;
            state.cropY = clip.cropY || 0;
            state.cropW = (clip.cropW !== undefined) ? clip.cropW : 1;
            state.cropH = (clip.cropH !== undefined) ? clip.cropH : 1;

            if (clip.type === 'image') {
                state.currentTime = clipTrimStart;
            } else {
                video.currentTime = clipTrimStart;

                // Wait for the video to ACTUALLY reach the target position before recording it.
                // Previously this just waited up to 500ms for a single 'seeked' event and then
                // moved on regardless -- on a slow/large seek (common under CPU load, e.g. while
                // Advanced Color Grading is running its own per-frame getImageData/putImageData
                // pass) the 500ms timeout could fire before the seek actually landed. Recording
                // would then start from whatever stale position the video was still sitting at
                // (often much earlier in the file), silently baking extra/wrong footage into the
                // export -- e.g. a 7 min edit coming out as 10 min, or a B-roll overlay's time
                // window sliding out of sync with what actually got recorded. This is why it was
                // intermittent: it only showed up when the seek happened to be slow that run.
                // Fix: keep polling/re-seeking until currentTime is actually close to the target,
                // with a generous (but bounded) overall timeout so we never hang forever.
                await waitForSeek(video, clipTrimStart);

                if (!window.setSpeakerMuted || !window.setSpeakerMuted(true)) {
                    video.volume = 0;
                }
                await video.play();
            }

            // Start voiceover & background music once, right after the very first clip begins playing,
            // so they stay in sync with the start of the full stitched timeline.
            if (!voiceoverStarted) {
                voiceoverStarted = true;
                if (audioMixResult && audioMixResult.startVoiceover) {
                    await audioMixResult.startVoiceover();
                }
                if (audioMixResult && audioMixResult.startBgMusic) {
                    await audioMixResult.startBgMusic();
                }
            }

            const clipElapsedBase = elapsedBeforeCurrentClip;
            const worker = getTickerWorker();

            await new Promise((resolve) => {
                let lastTickTime = performance.now();
                function renderTick() {
                    if (exportCancelled) {
                        if (clip.type !== 'image' && !video.paused) video.pause();
                        worker.removeEventListener('message', renderTick);
                        clearTimeout(safetyTimer);
                        resolve();
                        return;
                    }

                    let currentTime;
                    if (clip.type === 'image') {
                        const now = performance.now();
                        const elapsed = (now - lastTickTime) / 1000;
                        lastTickTime = now;
                        state.currentTime += elapsed;
                        currentTime = state.currentTime;
                    } else {
                        currentTime = video.currentTime;
                    }

                    const elapsedInClip = currentTime - clipTrimStart;
                    const totalElapsed = introDur + clipElapsedBase + elapsedInClip;
                    const progressPercent = grandTotal > 0 ? Math.min(100, (totalElapsed / grandTotal) * 100) : 100;

                    if (window.drawEditorFrame) {
                        window.drawEditorFrame();
                    }

                    const uiProgress = 20 + (progressPercent * 0.75);
                    setProgress(Math.round(uiProgress));
                    renderStatusText.innerText = `Rendering clip ${clipIndex + 1}/${state.clips.length}... ${Math.round(progressPercent)}%`;

                    if (currentTime >= clipTrimEnd || (clip.type !== 'image' && video.ended)) {
                        if (clip.type !== 'image') {
                            video.pause();
                        }
                        worker.removeEventListener('message', renderTick);
                        clearTimeout(safetyTimer);
                        resolve();
                        return;
                    }
                }

                worker.addEventListener('message', renderTick);

                // Safety timeout per-clip (max 10 minutes per clip)
                const safetyTimer = setTimeout(() => {
                    if (clip.type !== 'image' && !video.paused) {
                        video.pause();
                    }
                    worker.removeEventListener('message', renderTick);
                    resolve();
                }, 600_000);
            });

            elapsedBeforeCurrentClip += clipTrimDuration;
        }

        if (exportCancelled) { await finishCancelled(); return; }

        // --- Step D2: Outro (Phase 5C) ---
        renderStatusText.innerText = 'Rendering outro...';
        await renderIntroOutroPhase('outro', introDur + totalDuration);
        if (exportCancelled) { await finishCancelled(); return; }

        // --- Step E: Stop recorder and finalize ---
        renderStatusText.innerText = 'Finalizing video file...';
        setProgress(95);

        await new Promise((resolve) => {
            recorder.onstop = resolve;
            recorder.stop();
        });

        // Cleanup audio routing
        if (audioMixResult && audioMixResult.cleanup) {
            audioMixResult.cleanup();
        }
        // Remove the injected audio track from canvas stream
        if (audioTrack) {
            try { canvasStream.removeTrack(audioTrack); } catch(e) {}
        }

        // Restore the editor back to whichever clip/trim was active before export started
        if (video.src !== originalSrc) {
            await new Promise((resolve) => {
                video.onloadedmetadata = () => resolve();
                video.src = originalSrc;
                video.load();
            });
        }
        state.activeClipId = originalActiveClipId;
        state.duration = originalDuration;
        state.startTime = originalStartTime;
        state.endTime = originalEndTime;
        state.cropX = originalCropX;
        state.cropY = originalCropY;
        state.cropW = originalCropW;
        state.cropH = originalCropH;
        video.currentTime = state.startTime;
        if (!window.setSpeakerMuted || !window.setSpeakerMuted(false)) {
            video.volume = Math.min(1.0, state.videoVolume);
        }
        if (window.drawEditorFrame) window.drawEditorFrame();

        // --- Step F: Create download blob ---
        renderStatusText.innerText = 'Preparing download...';
        setProgress(98);

        const finalBlob = new Blob(chunks, { type: mimeType });
        const downloadURL = URL.createObjectURL(finalBlob);

        // Suggest a human-readable filename
        const timestamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
        const ext = mimeType.toLowerCase().includes('mp4') ? 'mp4' : 'webm';
        const filename = `facebook-video-${timestamp}.${ext}`;

        downloadLink.href = downloadURL;
        downloadLink.download = filename;

        // --- Done! ---
        setProgress(100);
        renderStatusText.innerText = 'Complete!';

        // Show success box
        setTimeout(() => {
            renderProgressBox.style.display = 'none';
            renderSuccessBox.style.display = 'block';
            renderBtn.disabled = false;
            if (qualitySelect) qualitySelect.disabled = false;
            renderBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Render Again';
        }, 500);
    }

    function setProgress(percent) {
        renderProgressFill.style.width = percent + '%';
        renderPercentage.innerText = percent + '%';
        updateEta(percent);
    }
});
