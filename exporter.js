// Video Exporter Engine — Renders Canvas + Mixed Audio into downloadable file
document.addEventListener('DOMContentLoaded', () => {
    const state = window.VideoEditor;

    async function serverLog(message) {
        console.log(message);
        try {
            await fetch('/api/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message })
            });
        } catch (e) {
            console.error('Failed to send log to server:', e);
        }
    }

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
    // Seek the video to targetTime and wait until the browser has fully decoded
    // that frame (i.e. until the 'seeked' event fires). This is critical for
    // seek-per-frame export: if we capture the canvas BEFORE 'seeked' fires,
    // drawImage(video) returns the OLD frame, creating freeze/repeat frames in
    // the exported file. The old approach used a 50 ms timeout which was far
    // too short for a slow/low-config PC — the seek was still in progress when
    // the timeout fired, so every frame was grabbed too early.
    //
    // We now wait unconditionally for the 'seeked' event. The maxWaitMs safety
    // timeout (5 s) is only there to prevent a truly broken seek from hanging
    // the export forever; in practice it should never fire for valid clips.
    async function waitForSeek(video, targetTime, maxWaitMs = 2000) {
        if (!video || !video.src) return;

        // Ensure video element has loaded frame data
        if (video.readyState < 2) {
            await new Promise((resolve) => {
                let settled = false;
                const onReady = () => {
                    if (settled) return;
                    settled = true;
                    video.removeEventListener('loadeddata', onReady);
                    video.removeEventListener('canplay', onReady);
                    resolve();
                };
                video.addEventListener('loadeddata', onReady);
                video.addEventListener('canplay', onReady);
                setTimeout(onReady, 1000);
            });
        }

        const clampedTarget = (video.duration && targetTime >= video.duration)
            ? Math.max(0, video.duration - 0.01)
            : Math.max(0, targetTime);

        if (Math.abs(video.currentTime - clampedTarget) < 0.002) {
            return;
        }

        video.currentTime = clampedTarget;
        await new Promise((resolve) => {
            let settled = false;
            let safetyTimer = null;

            const onSeeked = () => {
                if (settled) return;
                settled = true;
                video.removeEventListener('seeked', onSeeked);
                if (safetyTimer) clearTimeout(safetyTimer);
                resolve();
            };

            video.addEventListener('seeked', onSeeked, { once: true });
            safetyTimer = setTimeout(onSeeked, maxWaitMs);
        });
    }

    // Seeks every active "Video B-roll" overlay (background/PiP video-over-video)
    // to the exact frame it should show at `targetTime` on the master timeline,
    // BEFORE the canvas gets captured for this frame. Live preview just lets
    // these overlay videos free-run via play()/pause() (see editor.js), which is
    // fine for the eye but not frame-accurate enough for export — a captured
    // frame must reflect a fully-settled, exact position every single time, the
    // same way the main clip video is handled via waitForSeek above.
    async function syncBrollVideoOverlays(targetTime) {
        const overlays = state.brollOverlays;
        if (!overlays || overlays.length === 0) return;
        for (const item of overlays) {
            if (item.type !== 'video' || !item.videoEl) continue;
            const active = targetTime >= item.startSec && targetTime <= item.endSec;
            if (!active) continue;
            const dur = item.videoEl.duration || 0;
            if (!dur) continue;
            let rel = Math.max(0, targetTime - item.startSec);
            rel = item.loopVideo ? (rel % dur) : Math.min(rel, dur - 0.03);
            // Skip the (relatively slow) seek+wait round-trip when we're already
            // close enough — e.g. sequential frames within the same loop cycle.
            if (Math.abs(item.videoEl.currentTime - rel) <= (1 / 90)) continue;
            await waitForSeek(item.videoEl, rel, 1200);
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

        // Exposed for Phase 9 Multi-Aspect Batch Export (phase9.js)
        window.runExportPipeline = runExportPipeline;

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

        const totalDuration = state.clips.reduce((sum, c) => sum + (window.getClipOutputDuration ? window.getClipOutputDuration(c) : (Math.max(0, c.end - c.start) / Math.max(0.5, Math.min(2, Number(c.speed) || 1)))), 0);

        if (totalDuration <= 0) {
            alert('Trim duration is invalid. Please set the trim range in Step 2.');
            return;
        }

        // Safe Zone Export Safety Validation for Meta / FB Reels Boost
        if (window.checkSafeZoneCollisions && state.canvas && state.canvas.width) {
            const preset = state.safeZonePreset || 'fb-reels-boost';
            let topPct = 0.12, bottomPct = 0.22, rightPct = 0.16, leftPct = 0.05;
            if (preset === 'ig-reels-boost') { topPct = 0.14; bottomPct = 0.20; rightPct = 0.15; }
            else if (preset === 'fb-feed-boost') { topPct = 0.06; bottomPct = 0.14; rightPct = 0.05; }
            
            const collisions = window.checkSafeZoneCollisions(
                state.canvas.width * leftPct,
                state.canvas.width * (1 - rightPct),
                state.canvas.height * topPct,
                state.canvas.height * (1 - bottomPct)
            );

            if (collisions && collisions.length > 0) {
                const autoFix = confirm(`⚠️ আপনার ভিডিওর ${collisions.length}টি লেখা/লোগো ফেসবুক রিলস বুস্ট বাটন বা সাইড আইকন এলাকায় অবস্থিত, যা বুস্ট করলে ঢেকে যাবে।\n\nআপনি কি এক্সপোর্টের আগে এগুলো স্বয়ংক্রিয়ভাবে সেফ জোনে সরিয়ে নিয়ে এক্সপোর্ট করতে চান?`);
                if (autoFix) {
                    if (window.autoFitElementsToSafeZone) window.autoFitElementsToSafeZone();
                }
            }
        }

        // Stop the live preview loop before export begins. Export drives its
        // own frame-by-frame mutation of state.activeClipId/state.clips/video.src,
        // and at each await boundary the browser can still run a queued
        // requestAnimationFrame callback. If updateLoop() (the preview playback
        // loop) is still ticking because the video was mid-playback when Render
        // was clicked, it reads/writes that same shared state concurrently with
        // the export loop, which can leave state.activeClipId pointing at a clip
        // that momentarily isn't in state.clips -- producing an undefined
        // activeClip in drawFrame() and crashing deeper in the transform code.
        if (window.pauseVideoForExport) {
            window.pauseVideoForExport();
        } else if (state.isPlaying) {
            state.isPlaying = false;
            state.video.pause();
            if (window.playPauseBtn) window.playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        }

        // Persistent export flag (separate from the per-frame state.customExportTime
        // toggle). customExportTime is only set WHILE a frame is actively being
        // drawn inside the capture loop, and is briefly undefined again between
        // frames/clips/awaits. Any other code that reacts to a stray redraw during
        // one of those gaps (e.g. multitrack.js's extra-audio-track sync) needs a
        // flag that stays true for the whole export, not just mid-frame — this is it.
        state.isExportingVideo = true;
        // Stop the background animation rAF loop — it must not race with the
        // export pipeline's own drawFrame() calls or rendering will be extremely slow.
        if (window.stopBgAnimLoop) window.stopBgAnimLoop();

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

        // Custom Font Upload (Phase 12, TODO-4): font.load() resolving in the
        // browser doesn't guarantee the font is fully ready for canvas paints
        // that happen immediately after — document.fonts.ready is the correct
        // signal for that. Guarded with a timeout so a font that never
        // settles (rare browser edge case) can't hang the export forever;
        // worst case then is the old behavior (a font-fallback frame or two).
        if (document.fonts && document.fonts.ready) {
            renderStatusText.innerText = 'ফন্ট লোড হচ্ছে...';
            try {
                await Promise.race([
                    document.fonts.ready,
                    new Promise((resolve) => setTimeout(resolve, 5000))
                ]);
            } catch (fontErr) {
                // Non-fatal — proceed with export even if font readiness
                // checking itself errors out for some reason.
            }
            renderStatusText.innerText = 'Setting up render pipeline...';
        }

        try {
            await runExportPipeline(totalDuration);
        } catch (err) {
            console.error('Export failed:', err);
            if (!exportCancelled) {
                alert('Export failed: ' + err.message + '\n\nPlease try again with a shorter or simpler video.');
            }
            renderProgressBox.style.display = 'none';
            renderBtn.disabled = false;
            if (qualitySelect) qualitySelect.disabled = false;
            renderBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Render & Export Video';
        } finally {
            stopTickerWorker();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            // Ensure the overlay clock override never leaks back into the editor.
            state.customExportTime = undefined;
            state.exportTickerTime = undefined;
            state.isExportingVideo = false;
            if (window.cleanupExtraTracksExportMedia) window.cleanupExtraTracksExportMedia();
            if (cancelRenderBtn) cancelRenderBtn.disabled = false;
        }
    }

    async function runExportPipeline(totalDuration, isBatch = false, batchFilename = '', batchIndex = 0, batchCount = 0) {
        const canvas = state.canvas;
        const video = state.video;

        await serverLog(`=== Export Pipeline Started ===`);
        await serverLog(`totalDuration: ${totalDuration}, isBatch: ${isBatch}, clips: ${JSON.stringify((state.clips || []).map(c => ({ id: c.id, type: c.type, url: c.url, start: c.start, end: c.end, speed: c.speed })))}`);

        if (!canvas.width || !canvas.height) {
            await serverLog(`Canvas dimensions are invalid (${canvas.width}x${canvas.height}). Resetting via updateCanvasDimensions.`);
            if (window.updateCanvasDimensions) {
                window.updateCanvasDimensions();
            }
            if (!canvas.width || !canvas.height) {
                // Hard fallback to standard HD
                canvas.width = 1280;
                canvas.height = 720;
            }
            await serverLog(`Reset canvas dimensions to: ${canvas.width}x${canvas.height}`);
        }

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
    function isCapacitorApp() {
        return typeof window !== 'undefined' &&
            window.Capacitor &&
            window.Capacitor.isNativePlatform &&
            window.Capacitor.isNativePlatform();
    }

    function blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result || '';
                resolve(result.split(',')[1] || '');
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    async function saveVideo(compileOutput, filename) {
        if (isCapacitorApp()) {
            try {
                const cap = window.Capacitor;
                const Filesystem = cap.Plugins && cap.Plugins.Filesystem;
                if (!Filesystem) throw new Error('Filesystem plugin not available');
                
                let videoBlob;
                if (compileOutput instanceof Blob) {
                    videoBlob = compileOutput;
                } else {
                    const response = await fetch(compileOutput.downloadUrl);
                    videoBlob = await response.blob();
                }

                const base64 = await blobToBase64(videoBlob);
                await Filesystem.writeFile({
                    path: filename,
                    data: base64,
                    directory: 'DOCUMENTS',
                    recursive: true,
                });
                
                try {
                    const Share = cap.Plugins && cap.Plugins.Share;
                    if (Share) {
                        const uriResult = await Filesystem.getUri({
                            path: filename,
                            directory: 'DOCUMENTS',
                        });
                        await Share.share({
                            title: 'Your exported video',
                            text: 'Video exported from Video Editor',
                            url: uriResult.uri,
                            dialogTitle: 'Share or save your video',
                        });
                    }
                } catch (shareErr) {
                    console.warn('Share skipped:', shareErr);
                }
                return true;
            } catch (err) {
                console.error('Capacitor save failed, falling back to download:', err);
            }
        }

        if (compileOutput instanceof Blob) {
            const url = URL.createObjectURL(compileOutput);
            downloadLink.href = url;
        } else {
            downloadLink.href = compileOutput.downloadUrl;
        }
        downloadLink.download = filename;
        downloadLink.click();
        return false;
    }



        const renderTarget = {
            type: 'ws',
            ws: null,
            wasmEngine: null,
            async waitForSocketBuffer(maxBufferedBytes = 4 * 1024 * 1024) {
                const startedAt = performance.now();
                while (this.ws && this.ws.readyState === WebSocket.OPEN && this.ws.bufferedAmount > maxBufferedBytes) {
                    if (performance.now() - startedAt > 30000) {
                        throw new Error('Render server is not receiving frames. Please cancel and restart the render server.');
                    }
                    await new Promise(resolve => setTimeout(resolve, 20));
                }
            },
            async init(totalFrames, filename, customThumbnailData, onStatus) {
                if (this.type === 'wasm') {
                    this.wasmEngine = new window.MobileRenderEngine();
                    await this.wasmEngine.init(totalFrames, filename, onStatus);
                } else {
                    await serverLog(`Sending init control message, totalFrames: ${totalFrames}, filename: ${filename}`);
                    this.ws.send(JSON.stringify({
                        type: 'init',
                        totalFrames: totalFrames,
                        filename: filename,
                        customThumbnailData
                    }));
                    await new Promise((resolve) => {
                        const onMsg = async (event) => {
                            const data = JSON.parse(event.data);
                            if (data.type === 'init_ok') {
                                await serverLog(`Received init_ok: renderId=${data.renderId}`);
                                this.ws.removeEventListener('message', onMsg);
                                resolve();
                            }
                        };
                        this.ws.addEventListener('message', onMsg);
                    });
                }
            },
            async sendFrame(blob) {
                if (this.type === 'wasm') {
                    await this.wasmEngine.sendFrame(blob);
                } else {
                    await this.waitForSocketBuffer();
                    this.ws.send(blob);
                }
            },
            async sendAudio(blob) {
                if (this.type === 'wasm') {
                    await this.wasmEngine.sendAudio(blob);
                } else {
                    await serverLog(`Sending audio_start, blob size: ${blob.size}`);
                    this.ws.send(JSON.stringify({ type: 'audio_start' }));
                    await new Promise((resolve) => {
                        const onMsg = async (event) => {
                            const data = JSON.parse(event.data);
                            if (data.type === 'audio_ready') {
                                await serverLog('Received audio_ready. Streaming audioBlob chunks.');
                                this.ws.removeEventListener('message', onMsg);
                                resolve();
                            }
                        };
                        this.ws.addEventListener('message', onMsg);
                    });

                    // Send blob in 5MB chunks to avoid memory spikes and payload size limits
                    const chunkSize = 5 * 1024 * 1024;
                    let offset = 0;
                    while (offset < blob.size) {
                        const chunk = blob.slice(offset, offset + chunkSize);
                        this.ws.send(chunk);
                        offset += chunkSize;
                    }

                    this.ws.send(JSON.stringify({ type: 'audio_end' }));
                    await new Promise((resolve) => {
                        const onMsg = async (event) => {
                            const data = JSON.parse(event.data);
                            if (data.type === 'audio_ok') {
                                await serverLog('Received audio_ok.');
                                this.ws.removeEventListener('message', onMsg);
                                resolve();
                            }
                        };
                        this.ws.addEventListener('message', onMsg);
                    });
                }
            },
            async compile(onProgress) {
                if (this.type === 'wasm') {
                    const videoBlob = await this.wasmEngine.compile(onProgress);
                    return { type: 'wasm', blob: videoBlob };
                } else {
                    // Flush all remaining frame blobs over the network before compiling
                    await this.waitForSocketBuffer(0);
                    await serverLog('Sending compile control message...');
                    this.ws.send(JSON.stringify({ type: 'compile' }));
                    const compileResult = await new Promise((resolve, reject) => {
                        const onMsg = async (event) => {
                            const data = JSON.parse(event.data);
                            if (data.type === 'progress' && data.step === 'compiling') {
                                onProgress(data.current / 100);
                            }
                            else if (data.type === 'complete') {
                                await serverLog(`Compilation successful! downloadUrl=${data.downloadUrl}`);
                                this.ws.removeEventListener('message', onMsg);
                                resolve(data);
                            }
                            else if (data.type === 'error') {
                                await serverLog(`Compilation failed: ${data.message}`);
                                this.ws.removeEventListener('message', onMsg);
                                reject(new Error(data.message));
                            }
                        };
                        this.ws.addEventListener('message', onMsg);
                    });
                    return { type: 'ws', result: compileResult };
                }
            },
            async cleanup() {
                if (this.type === 'wasm' && this.wasmEngine) {
                    await this.wasmEngine.cleanup();
                } else if (this.ws) {
                    try { this.ws.close(); } catch (e) {}
                }
            }
        };

        // Determine whether to use local WASM renderer or server-based WebSocket renderer
        let mode = 'ws';
        if (isCapacitorApp()) {
            mode = 'wasm';
        } else {
            renderStatusText.innerText = 'সার্ভারের সাথে কানেক্ট করা হচ্ছে... (Connecting to render server...)';
            setProgress(2);
            const wsUrl = `ws://${window.location.hostname || 'localhost'}:4000`;
            const wsTemp = new WebSocket(wsUrl);
            try {
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        wsTemp.close();
                        reject(new Error('Timeout'));
                    }, 2000);
                    wsTemp.onopen = () => {
                        clearTimeout(timeout);
                        resolve();
                    };
                    wsTemp.onerror = () => {
                        clearTimeout(timeout);
                        reject(new Error('Connection refused'));
                    };
                });
                renderTarget.ws = wsTemp;
                mode = 'ws';
            } catch (err) {
                if (window.MobileRenderEngine) {
                    console.log('Local server connection failed, falling back to In-Browser WASM Render Engine.');
                    mode = 'wasm';
                } else {
                    throw new Error('Render server connection failed. Please run start-video-editor.bat.');
                }
            }
        }
        renderTarget.type = mode;

        // Cancellation handler
        async function finishCancelled() {
            renderStatusText.innerText = 'বাতিল করা হয়েছে (Cancelled)';
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
            state.customExportTime = undefined;
            state.exportTickerTime = undefined;
            if (window.cleanupExtraTracksExportMedia) window.cleanupExtraTracksExportMedia();
            // Resume animated backgrounds now that export is done
            if (window.startBgAnimLoop) window.startBgAnimLoop();
        }

        // --- Step A: Offline Audio Rendering ---
        renderStatusText.innerText = 'অডিও মিক্স করা হচ্ছে... (Mixing audio offline...)';
        setProgress(5);

        const introDur = state.introEnabled ? Math.max(0.3, parseFloat(state.introDuration) || 3) : 0;
        const outroDur = state.outroEnabled ? Math.max(0.3, parseFloat(state.outroDuration) || 3) : 0;
        const grandTotalDuration = parseFloat((introDur + totalDuration + outroDur).toFixed(1));
        const grandTotalFrames = Math.ceil(grandTotalDuration * 30);

        let audioBlob = null;
        if (window.renderAudioOffline) {
            try {
                const audioBuffer = await window.renderAudioOffline(grandTotalFrames / 30);
                if (audioBuffer) {
                    audioBlob = v2aAudioBufferToWavBlob(audioBuffer);
                }
            } catch (err) {
                console.error('Offline audio rendering failed:', err);
            }
        }

        if (exportCancelled) { await renderTarget.cleanup(); await finishCancelled(); return; }

        // --- Step B: Initialize Render Session ---
        let filename;
        if (isBatch && batchFilename) {
            const baseName = batchFilename.substring(0, batchFilename.lastIndexOf('.')) || batchFilename;
            filename = `${baseName}_edited.mp4`;
        } else {
            const timestamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
            filename = `facebook-video-${timestamp}.mp4`;
        }

        let customThumbnailData = null;
        if (state.customThumbnailFile) {
            customThumbnailData = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(state.customThumbnailFile);
            });
        }
        
        await renderTarget.init(grandTotalFrames, filename, customThumbnailData, (msg) => {
            renderStatusText.innerText = msg;
        });

        // Send audio file if we rendered one
        if (audioBlob && !exportCancelled) {
            await renderTarget.sendAudio(audioBlob);
        }

        if (exportCancelled) { await renderTarget.cleanup(); await finishCancelled(); return; }

        // --- Step C: Frame-by-Frame Canvas Drawing & Streaming ---
        renderStatusText.innerText = 'ফ্রেম প্রসেস করা হচ্ছে... (Processing frames...)';
        setProgress(10);

        let frameIndex = 0;

        // C1. Render Intro if enabled
        if (state.introEnabled && introDur > 0) {
            const introFrames = Math.ceil(introDur * 30);
            for (let f = 0; f < introFrames; f++) {
                if (exportCancelled) break;

                const t = f / (introFrames - 1 || 1);
                if (window.drawIntroOutroSegment) {
                    window.drawIntroOutroSegment(state.ctx, canvas.width, canvas.height, {
                        template: state.introTemplate,
                        title: state.introTitle,
                        subtitle: state.introSubtitle
                    }, t);
                }

                const frameBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
                await renderTarget.sendFrame(frameBlob);

                frameIndex++;
                const uiProgress = 10 + Math.round((frameIndex / grandTotalFrames) * 80);
                setProgress(uiProgress);
                renderStatusText.innerText = `ইন্ট্রো ফ্রেম প্রসেস হচ্ছে... (Intro: ${f + 1}/${introFrames})`;
            }
        }

        // C2. Deterministic frame-accurate sequential capture.
        // Seeks to each precise frame timestamp, waits for decoding to settle,
        // and captures canvas. Eliminates frame skipping, duplication, and progress jumping.
        async function captureVideoClipSequential(clip, clipTrimStart, clipTrimEnd, clipFrames, clipIndex) {
            await serverLog(`captureVideoClipSequential start: clipTrimStart=${clipTrimStart}, clipTrimEnd=${clipTrimEnd}, clipFrames=${clipFrames}, clipIndex=${clipIndex}`);
            const clipSpeed = Math.max(0.5, Math.min(2, Number(clip.speed) || 1));
            const sourceTimeForFrame = window.getClipSourceTimeForOutputElapsed
                ? (frame) => window.getClipSourceTimeForOutputElapsed(clip, frame / 30)
                : (frame) => clipTrimStart + ((frame / 30) * clipSpeed);

            video.pause();
            delete state._exportBrollPlaybackRate;

            for (let f = 0; f < clipFrames; f++) {
                if (exportCancelled) break;

                const currentTarget = sourceTimeForFrame(f);
                state.currentTime = currentTarget;
                state.customExportTime = currentTarget;
                state.exportTickerTime = elapsedBeforeCurrentClip + (f / 30);

                // Ensure the video element is seeked and decoded to the exact frame
                await waitForSeek(video, currentTarget, 2000);

                // Sync any B-roll video overlays for this exact timestamp
                await syncBrollVideoOverlays(currentTarget);

                if (window.phase9PrepareTransitionFrame) {
                    await window.phase9PrepareTransitionFrame(clip, currentTarget);
                }

                // Seek extra multi-track tracks BEFORE drawing
                if (window.prepareExtraTracksForExportFrame) {
                    await window.prepareExtraTracksForExportFrame(state.exportTickerTime);
                }

                if (window.drawEditorFrame) {
                    window.drawEditorFrame();
                }

                const frameBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
                if (frameBlob && !exportCancelled) {
                    await renderTarget.sendFrame(frameBlob);
                }

                frameIndex++;

                // Smooth frame-by-frame progress update
                const totalElapsed = elapsedBeforeCurrentClip + ((f + 1) / 30);
                const progressPercent = grandTotalDuration > 0 ? Math.min(100, (totalElapsed / grandTotalDuration) * 100) : 100;
                setProgress(10 + Math.round(progressPercent * 0.8));

                if (isBatch) {
                    renderStatusText.innerText = `[Batch ${batchIndex}/${batchCount}] rendering ${batchFilename}... ${Math.round((frameIndex / grandTotalFrames) * 100)}%`;
                } else {
                    renderStatusText.innerText = `ক্লিপ ${clipIndex + 1}/${state.clips.length} প্রসেস হচ্ছে... (ফ্রেম: ${f + 1}/${clipFrames})`;
                }
            }
        }

        let elapsedBeforeCurrentClip = 0;
        // Running count of frames actually emitted for the clips timeline so far.
        // Used to derive each clip's frame count from the *cumulative* elapsed
        // time rather than rounding each clip's duration independently. Rounding
        // per-clip (e.g. with Math.ceil) always rounds up, so the rounding error
        // is one-directional and keeps adding up across clips — after several
        // clips/tasks the video track ends up a full frame or more ahead of the
        // audio track, which is exactly the "growing gap" symptom. Deriving the
        // frame count from the running total keeps the video length locked to
        // the audio length: each clip's error is at most half a frame and never
        // compounds with the next one.
        let clipsFramesEmitted = 0;
        for (let clipIndex = 0; clipIndex < state.clips.length; clipIndex++) {
            if (exportCancelled) break;
            const clip = state.clips[clipIndex];
            const clipTrimStart = clip.start;
            const clipTrimEnd = clip.end;
            const clipTrimDuration = Math.max(0, clipTrimEnd - clipTrimStart);
            const clipSpeed = Math.max(0.5, Math.min(2, Number(clip.speed) || 1));
            const clipOutputDuration = window.getClipOutputDuration ? window.getClipOutputDuration(clip) : (clipTrimDuration / clipSpeed);
            if (clipTrimDuration <= 0) continue;

            // Load clip
            if (clip.type === 'image') {
                await serverLog(`Clip ${clipIndex + 1}/${state.clips.length} [image]: id=${clip.id}`);
                video.src = '';
                state.duration = clip.duration;
                state.startTime = clipTrimStart;
                state.endTime = clipTrimEnd;
                state.activeClipId = clip.id;
            } else {
                await serverLog(`Clip ${clipIndex + 1}/${state.clips.length} [video]: id=${clip.id}, url=${clip.url}`);
                if (video.src !== clip.url) {
                    await serverLog(`Changing video src to ${clip.url} and calling load()`);
                    await new Promise((resolve) => {
                        video.onloadedmetadata = () => resolve();
                        video.src = clip.url;
                        video.load();
                    });
                    await serverLog(`Video onloadedmetadata fired.`);
                } else {
                    await serverLog(`Video src already matches ${clip.url}. Skipping reload.`);
                }
                state.duration = clip.duration;
                state.startTime = clipTrimStart;
                state.endTime = clipTrimEnd;
                state.activeClipId = clip.id;
            }

            state.cropX = clip.cropX || 0;
            state.cropY = clip.cropY || 0;
            state.cropW = (clip.cropW !== undefined) ? clip.cropW : 1;
            state.cropH = (clip.cropH !== undefined) ? clip.cropH : 1;

            // Ideal cumulative frame count if the clips timeline up to and
            // including this clip were rendered with zero rounding error, then
            // subtract what's already been emitted. This is the frame-budget
            // (Bresenham-style) technique: any leftover fraction of a frame is
            // carried forward and absorbed by the next clip instead of being
            // silently dropped or duplicated every single time.
            const targetCumulativeFrames = Math.round((elapsedBeforeCurrentClip + clipOutputDuration) * 30);
            const clipFrames = Math.max(1, targetCumulativeFrames - clipsFramesEmitted);
            clipsFramesEmitted += clipFrames;
            
            if (clip.type === 'image') {
                for (let f = 0; f < clipFrames; f++) {
                    if (exportCancelled) break;

                    const elapsedSecInClip = f / 30;
                    const targetTime = window.getClipSourceTimeForOutputElapsed
                        ? window.getClipSourceTimeForOutputElapsed(clip, elapsedSecInClip)
                        : (clipTrimStart + (elapsedSecInClip * clipSpeed));
                    state.currentTime = targetTime;

                    // Same explicit-clock fix as the video path above so the
                    // ticker/B-roll clock is exact and independent of any lag.
                    state.customExportTime = targetTime;
                    state.exportTickerTime = elapsedBeforeCurrentClip + elapsedSecInClip;

                    await syncBrollVideoOverlays(targetTime);

                    if (window.phase9PrepareTransitionFrame) {
                        await window.phase9PrepareTransitionFrame(clip, targetTime);
                    }

                    // Multi-Track Timeline (render-order fix): seek extra video
                    // tracks BEFORE drawing — editor.js's drawFrame() draws them
                    // itself, synchronously, at the correct point in its own
                    // render order (above the main video, below captions/overlays).
                    if (window.prepareExtraTracksForExportFrame) {
                        await window.prepareExtraTracksForExportFrame(state.exportTickerTime);
                    }

                    if (window.drawEditorFrame) {
                        window.drawEditorFrame();
                    }

                    const frameBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
                    await renderTarget.sendFrame(frameBlob);

                    frameIndex++;
                    const uiProgress = 10 + Math.round((frameIndex / grandTotalFrames) * 80);
                    setProgress(uiProgress);
                    
                    if (isBatch) {
                        renderStatusText.innerText = `[Batch ${batchIndex}/${batchCount}] rendering ${batchFilename}... ${Math.round((frameIndex / grandTotalFrames) * 100)}%`;
                    } else {
                        renderStatusText.innerText = `ক্লিপ ${clipIndex + 1}/${state.clips.length} প্রসেস হচ্ছে... (ফ্রেম: ${f + 1}/${clipFrames})`;
                    }
                }
            } else {
                await captureVideoClipSequential(clip, clipTrimStart, clipTrimEnd, clipFrames, clipIndex);
            }
            
            elapsedBeforeCurrentClip += clipOutputDuration;
        }

        // Done drawing clips — stop overriding the clock so live preview (and the
        // post-export restore draw) reads the real video.currentTime again.
        state.customExportTime = undefined;
        state.exportTickerTime = undefined;
        // STEP 3 — Multi-Track Timeline: release the dedicated export-only
        // <video> elements created for extra track clips (prepareExtraTracksForExportFrame).
        if (window.cleanupExtraTracksExportMedia) window.cleanupExtraTracksExportMedia();

        // C3. Render Outro if enabled
        if (state.outroEnabled && outroDur > 0 && !exportCancelled) {
            const outroFrames = Math.ceil(outroDur * 30);
            for (let f = 0; f < outroFrames; f++) {
                if (exportCancelled) break;

                const t = f / (outroFrames - 1 || 1);
                if (window.drawIntroOutroSegment) {
                    window.drawIntroOutroSegment(state.ctx, canvas.width, canvas.height, {
                        template: state.outroTemplate,
                        title: state.outroTitle,
                        subtitle: state.outroSubtitle
                    }, t);
                }

                const frameBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
                await renderTarget.sendFrame(frameBlob);

                frameIndex++;
                const uiProgress = 10 + Math.round((frameIndex / grandTotalFrames) * 80);
                setProgress(uiProgress);
                renderStatusText.innerText = `আউটরো ফ্রেম প্রসেস হচ্ছে... (Outro: ${f + 1}/${outroFrames})`;
            }
        }

        if (exportCancelled) { await renderTarget.cleanup(); await finishCancelled(); return; }

        // --- Step D: Compilation ---
        let compileOutput;
        if (renderTarget.type === 'wasm') {
            renderStatusText.innerText = 'ভিডিও তৈরি হচ্ছে... (Compiling video...)';
            setProgress(90);
            const videoBlob = await renderTarget.compile((percent) => {
                setProgress(90 + Math.round(percent * 0.08)); // 90% to 98%
            });
            compileOutput = videoBlob.blob;
        } else {
            renderStatusText.innerText = 'সার্ভারে ভিডিও তৈরি হচ্ছে... (Compiling video on server...)';
            setProgress(90);
            const wsCompile = await renderTarget.compile((percent) => {
                setProgress(90 + Math.round(percent * 0.08)); // 90% to 98%
            });
            compileOutput = wsCompile.result;
        }

        // Restore editor settings.
        // Always force-reload the video — after thousands of frame-level seeks
        // the decoder can get stuck in 'seeking' state even when src is unchanged.
        // Resetting src to '' first flushes any pending internal decoder state.
        video.pause();
        video.src = '';
        await new Promise(r => setTimeout(r, 50)); // brief flush
        await new Promise((resolve) => {
            const onMeta = () => { video.removeEventListener('loadedmetadata', onMeta); resolve(); };
            video.addEventListener('loadedmetadata', onMeta);
            video.src = originalSrc;
            video.load();
            setTimeout(resolve, 3000); // safety timeout
        });
        state.activeClipId = originalActiveClipId;
        state.duration = originalDuration;
        state.startTime = originalStartTime;
        state.endTime = originalEndTime;
        state.cropX = originalCropX;
        state.cropY = originalCropY;
        state.cropW = (originalCropW !== undefined) ? originalCropW : 1;
        state.cropH = (originalCropH !== undefined) ? originalCropH : 1;
        video.currentTime = state.startTime;
        video.playbackRate = 1.0; // Restore standard playback speed
        if (!window.setSpeakerMuted || !window.setSpeakerMuted(false)) {
            video.volume = Math.min(1.0, state.videoVolume);
        }
        if (window.drawEditorFrame) window.drawEditorFrame();
        // Resume animated backgrounds now that export is fully completed
        if (window.startBgAnimLoop) window.startBgAnimLoop();

        // Finalize Download / Save
        setProgress(98);
        renderStatusText.innerText = 'ভিডিও সংরক্ষণ করা হচ্ছে... (Saving video...)';

        const finalFilename = filename;

        // Free the ffmpeg.wasm virtual filesystem/close websocket
        await renderTarget.cleanup();

        const savedNatively = await saveVideo(compileOutput, finalFilename);

        if (isBatch) {
            setProgress(100);
            renderStatusText.innerText = savedNatively
                ? `সংরক্ষিত ${finalFilename}! (পরবর্তী...)`
                : `Saved ${finalFilename}! Proceeding...`;
            await new Promise(resolve => setTimeout(resolve, 1000));
            return;
        }

        setProgress(100);
        renderStatusText.innerText = savedNatively
            ? 'সম্পন্ন! (ফোনে সংরক্ষিত — শেয়ার করুন)'
            : 'সম্পন্ন! (Complete!)';

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

    // --- Batch Processing (Phase 7E) ---
    const batchDropzone = document.getElementById('batch-dropzone');
    const batchFilesInput = document.getElementById('batch-files-input');
    const batchQueueContainer = document.getElementById('batch-queue-container');
    const batchQueueList = document.getElementById('batch-queue-list');
    const batchRenderBtn = document.getElementById('batch-render-btn');
    const batchCountBadge = document.getElementById('batch-count-badge');

    let batchQueue = [];
    let isBatchRenderRunning = false;

    if (batchDropzone && batchFilesInput) {
        batchDropzone.addEventListener('click', () => batchFilesInput.click());

        batchFilesInput.addEventListener('change', (e) => {
            addFilesToBatch(e.target.files);
            batchFilesInput.value = '';
        });

        batchDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            batchDropzone.classList.add('hover');
        });

        batchDropzone.addEventListener('dragleave', () => {
            batchDropzone.classList.remove('hover');
        });

        batchDropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            batchDropzone.classList.remove('hover');
            addFilesToBatch(e.dataTransfer.files);
        });
    }

    function addFilesToBatch(fileList) {
        if (isBatchRenderRunning) return;
        for (const file of fileList) {
            if (file.type.startsWith('video/')) {
                const isDuplicate = batchQueue.some(f => f.name === file.name && f.size === file.size);
                if (!isDuplicate) {
                    batchQueue.push(file);
                }
            }
        }
        renderBatchQueue();
    }

    function renderBatchQueue() {
        if (!batchQueueList) return;
        batchQueueList.innerHTML = '';

        if (batchQueue.length > 0) {
            batchQueueContainer.style.display = 'block';
            batchCountBadge.innerText = batchQueue.length;
            batchRenderBtn.disabled = isBatchRenderRunning;

            batchQueue.forEach((file, index) => {
                const li = document.createElement('li');
                li.className = 'batch-queue-item';

                const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
                li.innerHTML = `
                    <div class="batch-item-info">
                        <span class="batch-item-name" title="${file.name}">${file.name}</span>
                        <span class="batch-item-size">${sizeMB} MB</span>
                    </div>
                    <button class="btn-remove-batch-item" data-index="${index}" title="তালিকা থেকে বাদ দিন">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                `;

                const removeBtn = li.querySelector('.btn-remove-batch-item');
                if (removeBtn) {
                    removeBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (isBatchRenderRunning) return;
                        const idx = parseInt(removeBtn.getAttribute('data-index'));
                        batchQueue.splice(idx, 1);
                        renderBatchQueue();
                    });
                }

                batchQueueList.appendChild(li);
            });
        } else {
            batchQueueContainer.style.display = 'none';
            batchRenderBtn.disabled = true;
        }
    }

    async function startBatchExport() {
        if (isBatchRenderRunning || batchQueue.length === 0) return;

        // Batch export also restores the editor's active media after finishing.
        // Keep a local reference just like the single-export pipeline does.
        const video = state.video;

        isBatchRenderRunning = true;
        exportCancelled = false;
        exportStartTimestamp = performance.now();
        
        if (cancelRenderBtn) cancelRenderBtn.disabled = false;
        renderBtn.disabled = true;
        batchRenderBtn.disabled = true;
        if (qualitySelect) qualitySelect.disabled = true;
        
        renderProgressBox.style.display = 'block';
        renderSuccessBox.style.display = 'none';

        // Custom Font Upload (Phase 12, TODO-4): same font-readiness guard as
        // the single-file export path, so a recently-uploaded custom font is
        // fully usable before the very first batch item starts capturing.
        if (document.fonts && document.fonts.ready) {
            try {
                await Promise.race([
                    document.fonts.ready,
                    new Promise((resolve) => setTimeout(resolve, 5000))
                ]);
            } catch (fontErr) {
                // Non-fatal — proceed with batch export regardless.
            }
        }

        // Save original editor project configurations
        const originalClips = [...state.clips];
        const originalActiveClipId = state.activeClipId;
        const originalStartTime = state.startTime;
        const originalEndTime = state.endTime;
        const originalDuration = state.duration;
        const originalCropX = state.cropX;
        const originalCropY = state.cropY;
        const originalCropW = state.cropW;
        const originalCropH = state.cropH;
        const originalSrc = video.src;

        try {
            for (let i = 0; i < batchQueue.length; i++) {
                if (exportCancelled) {
                    break;
                }

                const file = batchQueue[i];
                renderStatusText.innerText = `[Batch ${i + 1}/${batchQueue.length}] Loading ${file.name}...`;
                setProgress(0);

                const fileURL = URL.createObjectURL(file);

                // Dynamically fetch file's duration by loading it in a temporary video element
                const tempVideo = document.createElement('video');
                tempVideo.src = fileURL;
                const duration = await new Promise((resolve) => {
                    tempVideo.onloadedmetadata = () => resolve(tempVideo.duration);
                    tempVideo.onerror = () => resolve(0);
                });

                if (duration <= 0) {
                    console.error(`Could not decode metadata for ${file.name}`);
                    URL.revokeObjectURL(fileURL);
                    continue;
                }

                // Construct a single clip configuration for this batch file
                const tempClip = {
                    id: Date.now(),
                    file: file,
                    url: fileURL,
                    name: file.name,
                    duration: duration,
                    start: 0,
                    end: duration,
                    cropX: originalCropX,
                    cropY: originalCropY,
                    cropW: originalCropW,
                    cropH: originalCropH
                };

                state.clips = [tempClip];
                state.activeClipId = tempClip.id;
                state.duration = duration;
                state.startTime = 0;
                state.endTime = duration;
                state.cropX = originalCropX;
                state.cropY = originalCropY;
                state.cropW = originalCropW;
                state.cropH = originalCropH;

                video.src = fileURL;
                video.load();
                await new Promise((resolve) => {
                    video.onloadedmetadata = () => resolve();
                });

                await waitForSeek(video, 0);

                // Run rendering pipeline for this batch index
                await runExportPipeline(duration, true, file.name, i + 1, batchQueue.length);

                URL.revokeObjectURL(fileURL);
            }
        } catch (err) {
            console.error('Batch render error:', err);
        } finally {
            // Restore true original user project clips
            state.clips = originalClips;
            state.activeClipId = originalActiveClipId;
            state.duration = originalDuration;
            state.startTime = originalStartTime;
            state.endTime = originalEndTime;
            state.cropX = originalCropX;
            state.cropY = originalCropY;
            state.cropW = originalCropW;
            state.cropH = originalCropH;

            video.src = originalSrc;
            video.load();
            await new Promise((resolve) => {
                video.onloadedmetadata = () => resolve();
            });
            await waitForSeek(video, state.startTime);

            if (!window.setSpeakerMuted || !window.setSpeakerMuted(false)) {
                video.volume = Math.min(1.0, state.videoVolume);
            }
            if (window.drawEditorFrame) window.drawEditorFrame();

            isBatchRenderRunning = false;
            renderBtn.disabled = false;
            batchRenderBtn.disabled = false;
            if (qualitySelect) qualitySelect.disabled = false;
            renderBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Render & Export Video';
            
            if (exportCancelled) {
                renderStatusText.innerText = 'Batch Export Cancelled';
                renderProgressBox.style.display = 'none';
            } else {
                renderStatusText.innerText = 'Batch Export Complete!';
                setProgress(100);
            }
        }
    }

    if (batchRenderBtn) {
        batchRenderBtn.addEventListener('click', startBatchExport);
    }

    // --- Video → Audio Converter (Phase 8A) ---
    // Fully independent of the main editor project/timeline: the user drops in
    // ANY video file here and gets back just its audio track, as WAV (lossless,
    // via decodeAudioData — instant, no real-time playback wait) or MP3 (smaller,
    // encoded client-side with lamejs loaded on demand from a CDN).
    const v2aDropzone = document.getElementById('v2a-dropzone');
    const v2aFileInput = document.getElementById('v2a-file-input');
    const v2aDropzoneLabel = document.getElementById('v2a-dropzone-label');
    const v2aFormatBox = document.getElementById('v2a-format-box');
    const v2aFormatSelect = document.getElementById('v2a-format-select');
    const v2aConvertBtn = document.getElementById('v2a-convert-btn');
    const v2aProgressBox = document.getElementById('v2a-progress-box');
    const v2aStatusText = document.getElementById('v2a-status-text');
    const v2aPercentage = document.getElementById('v2a-percentage');
    const v2aProgressFill = document.getElementById('v2a-progress-fill');
    const v2aSuccessBox = document.getElementById('v2a-success-box');
    const v2aSuccessDesc = document.getElementById('v2a-success-desc');
    const v2aDownloadLink = document.getElementById('v2a-download-link');
    const v2aMp3Option = document.getElementById('v2a-mp3-option');

    let v2aSelectedFile = null;
    let v2aLastDownloadURL = null;

    // lamejs (pure-JS MP3 encoder) is only fetched from CDN if/when the person
    // actually picks MP3 — WAV never needs it and works fully offline.
    let lamejsLoadPromise = null;
    function ensureLamejsLoaded() {
        if (window.lamejs) return Promise.resolve(true);
        if (lamejsLoadPromise) return lamejsLoadPromise;
        lamejsLoadPromise = new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js';
            script.onload = () => resolve(!!window.lamejs);
            script.onerror = () => resolve(false);
            document.head.appendChild(script);
        });
        return lamejsLoadPromise;
    }

    if (v2aDropzone && v2aFileInput) {
        v2aDropzone.addEventListener('click', () => v2aFileInput.click());

        v2aFileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) handleV2AFile(e.target.files[0]);
            v2aFileInput.value = '';
        });

        v2aDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            v2aDropzone.classList.add('drag-over');
        });
        v2aDropzone.addEventListener('dragleave', () => {
            v2aDropzone.classList.remove('drag-over');
        });
        v2aDropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            v2aDropzone.classList.remove('drag-over');
            if (e.dataTransfer.files && e.dataTransfer.files[0]) handleV2AFile(e.dataTransfer.files[0]);
        });
    }

    function handleV2AFile(file) {
        if (!file.type.startsWith('video/')) {
            alert('দয়া করে একটি ভিডিও ফাইল নির্বাচন করুন। (Please select a video file.)');
            return;
        }
        v2aSelectedFile = file;
        if (v2aDropzoneLabel) v2aDropzoneLabel.innerText = file.name;
        if (v2aFormatBox) v2aFormatBox.style.display = 'block';
        if (v2aProgressBox) v2aProgressBox.style.display = 'none';
        if (v2aSuccessBox) v2aSuccessBox.style.display = 'none';
        if (v2aLastDownloadURL) {
            URL.revokeObjectURL(v2aLastDownloadURL);
            v2aLastDownloadURL = null;
        }
    }

    function setV2AProgress(percent, statusText) {
        if (v2aProgressFill) v2aProgressFill.style.width = percent + '%';
        if (v2aPercentage) v2aPercentage.innerText = percent + '%';
        if (statusText && v2aStatusText) v2aStatusText.innerText = statusText;
    }

    // Converts Float32 PCM (-1..1) into signed 16-bit PCM, the format both the
    // WAV container and the MP3 encoder expect.
    function v2aFloatTo16BitPCM(floatArray) {
        const out = new Int16Array(floatArray.length);
        for (let i = 0; i < floatArray.length; i++) {
            let s = Math.max(-1, Math.min(1, floatArray[i]));
            out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        return out;
    }

    // Standard 44-byte-header PCM WAV writer. Lossless, plays everywhere, and
    // needs no external library — the safe default for this tool.
    function v2aAudioBufferToWavBlob(audioBuffer) {
        const numChannels = audioBuffer.numberOfChannels;
        const sampleRate = audioBuffer.sampleRate;
        const bitDepth = 16;
        const bytesPerSample = bitDepth / 8;
        const blockAlign = numChannels * bytesPerSample;
        const numFrames = audioBuffer.length;
        const dataSize = numFrames * blockAlign;
        const buffer = new ArrayBuffer(44 + dataSize);
        const view = new DataView(buffer);

        function writeString(offset, str) {
            for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
        }

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true); // PCM format
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * blockAlign, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitDepth, true);
        writeString(36, 'data');
        view.setUint32(40, dataSize, true);

        const channelData = [];
        for (let ch = 0; ch < numChannels; ch++) {
            channelData.push(audioBuffer.getChannelData(ch));
        }

        let offset = 44;
        for (let i = 0; i < numFrames; i++) {
            for (let ch = 0; ch < numChannels; ch++) {
                let sample = Math.max(-1, Math.min(1, channelData[ch][i]));
                sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
                view.setInt16(offset, sample, true);
                offset += 2;
            }
        }

        return new Blob([view], { type: 'audio/wav' });
    }

    // Encodes via lamejs in small blocks, yielding back to the browser every
    // ~200 blocks so a long video's audio doesn't freeze the tab mid-encode.
    async function v2aEncodeMp3(audioBuffer, kbps, onProgress) {
        const channels = Math.min(2, audioBuffer.numberOfChannels);
        const sampleRate = audioBuffer.sampleRate;
        const mp3encoder = new window.lamejs.Mp3Encoder(channels, sampleRate, kbps);
        const blockSize = 1152; // standard MP3 frame size

        const left = v2aFloatTo16BitPCM(audioBuffer.getChannelData(0));
        const right = channels > 1 ? v2aFloatTo16BitPCM(audioBuffer.getChannelData(1)) : null;

        const mp3Chunks = [];
        const totalBlocks = Math.ceil(left.length / blockSize) || 1;

        let blockIndex = 0;
        for (let i = 0; i < left.length; i += blockSize, blockIndex++) {
            const leftChunk = left.subarray(i, i + blockSize);
            const mp3buf = right
                ? mp3encoder.encodeBuffer(leftChunk, right.subarray(i, i + blockSize))
                : mp3encoder.encodeBuffer(leftChunk);
            if (mp3buf.length > 0) mp3Chunks.push(new Int8Array(mp3buf));

            if (blockIndex % 200 === 0) {
                if (onProgress) onProgress(blockIndex / totalBlocks);
                await new Promise((resolve) => setTimeout(resolve, 0));
            }
        }

        const finalBuf = mp3encoder.flush();
        if (finalBuf.length > 0) mp3Chunks.push(new Int8Array(finalBuf));

        return new Blob(mp3Chunks, { type: 'audio/mpeg' });
    }

    if (v2aConvertBtn) {
        v2aConvertBtn.addEventListener('click', runV2AConversion);
    }

    async function runV2AConversion() {
        if (!v2aSelectedFile) return;
        const format = v2aFormatSelect ? v2aFormatSelect.value : 'wav';

        v2aConvertBtn.disabled = true;
        if (v2aFormatSelect) v2aFormatSelect.disabled = true;
        v2aProgressBox.style.display = 'block';
        v2aSuccessBox.style.display = 'none';
        setV2AProgress(0, 'ফাইল পড়া হচ্ছে... (Reading file...)');

        // Dedicated AudioContext for this conversion only — kept separate from
        // the main editor's audio graph (voiceover/noise-cancel/music mixing)
        // so this tool can never interfere with the project being edited.
        let decodeCtx = null;

        try {
            const arrayBuffer = await v2aSelectedFile.arrayBuffer();
            setV2AProgress(20, 'অডিও ডিকোড হচ্ছে... (Decoding audio...)');

            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            decodeCtx = new AudioCtx();

            let audioBuffer;
            try {
                audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer);
            } catch (decodeErr) {
                throw new Error('NO_AUDIO_TRACK');
            }

            setV2AProgress(50, format === 'mp3'
                ? 'MP3 এনকোড হচ্ছে... (Encoding MP3...)'
                : 'WAV তৈরি হচ্ছে... (Building WAV...)');

            let blob, ext, mimeLabel;
            if (format === 'mp3') {
                const lamejsReady = await ensureLamejsLoaded();
                if (!lamejsReady) throw new Error('MP3_UNAVAILABLE');
                blob = await v2aEncodeMp3(audioBuffer, 128, (p) => {
                    setV2AProgress(50 + Math.round(p * 45), 'MP3 এনকোড হচ্ছে... (Encoding MP3...)');
                });
                ext = 'mp3';
                mimeLabel = 'MP3';
            } else {
                blob = v2aAudioBufferToWavBlob(audioBuffer);
                ext = 'wav';
                mimeLabel = 'WAV';
            }

            setV2AProgress(100, 'সম্পন্ন! (Complete!)');

            const baseName = v2aSelectedFile.name.substring(0, v2aSelectedFile.name.lastIndexOf('.')) || v2aSelectedFile.name;
            if (v2aLastDownloadURL) URL.revokeObjectURL(v2aLastDownloadURL);
            v2aLastDownloadURL = URL.createObjectURL(blob);
            v2aDownloadLink.href = v2aLastDownloadURL;
            v2aDownloadLink.download = `${baseName}.${ext}`;
            if (v2aSuccessDesc) {
                v2aSuccessDesc.innerText = `${mimeLabel} ফাইল প্রস্তুত — "${baseName}.${ext}" ডাউনলোড করুন।`;
            }

            setTimeout(() => {
                v2aProgressBox.style.display = 'none';
                v2aSuccessBox.style.display = 'block';
            }, 300);
        } catch (err) {
            console.error('Video-to-audio conversion failed:', err);
            v2aProgressBox.style.display = 'none';
            if (err && err.message === 'NO_AUDIO_TRACK') {
                alert('এই ভিডিওর অডিও ডিকোড করা যায়নি। সম্ভবত ভিডিওতে কোনো অডিও ট্র্যাক নেই, অথবা এই ফরম্যাট/কোডেক ব্রাউজার সাপোর্ট করে না।');
            } else if (err && err.message === 'MP3_UNAVAILABLE') {
                alert('MP3 এনকোডার লোড করা যায়নি (ইন্টারনেট সংযোগ প্রয়োজন)। দয়া করে WAV ফরম্যাট বেছে আবার চেষ্টা করুন, অথবা ইন্টারনেট সংযোগ চেক করুন।');
                if (v2aMp3Option) {
                    v2aMp3Option.disabled = true;
                    v2aMp3Option.innerText = 'MP3 (লোড করা যায়নি — ইন্টারনেট সংযোগ প্রয়োজন)';
                }
                if (v2aFormatSelect) v2aFormatSelect.value = 'wav';
            } else {
                alert('অডিও কনভার্ট করতে সমস্যা হয়েছে। ভিডিও ফাইলটি অন্য একটি দিয়ে আবার চেষ্টা করুন।');
            }
        } finally {
            if (decodeCtx) {
                try { decodeCtx.close(); } catch (e) { /* ignore */ }
            }
            v2aConvertBtn.disabled = false;
            if (v2aFormatSelect) v2aFormatSelect.disabled = false;
        }
    }

    // --- Remove Audio (Mute Video) ---
    // Unlike the Video → Audio tool above (pure client-side Web Audio decode),
    // this needs to hand back a full VIDEO file with its audio stream dropped,
    // which the browser can't remux on its own. So the raw file is uploaded to
    // the local Node server (server.js's /api/remove-audio route), which runs
    // a fast ffmpeg stream-copy (-c:v copy -an) — no video re-encode, just the
    // audio track discarded — and hands back a download link, same as the
    // main exporter's WebSocket render pipeline does for full exports.
    // --- Helper for Time Stepper Buttons (-0.1s / +0.1s) ---
    function attachTimeStepper(minusBtnId, plusBtnId, stepChangeFn) {
        const minusBtn = document.getElementById(minusBtnId);
        const plusBtn = document.getElementById(plusBtnId);
        if (!minusBtn || !plusBtn) return;

        let timer = null;

        const startAction = (delta) => {
            stepChangeFn(delta);
            timer = setInterval(() => stepChangeFn(delta), 120);
        };

        const stopAction = () => {
            if (timer) { clearInterval(timer); timer = null; }
        };

        const bindStepperButton = (button, delta) => {
            const start = (event) => {
                event.preventDefault();
                stopAction();
                startAction(delta);
                if (button.setPointerCapture && event.pointerId !== undefined) {
                    button.setPointerCapture(event.pointerId);
                }
            };

            // Pointer events cover mouse, touch, and pen in current browsers.
            // Keep the mouse fallback for older WebViews that lack PointerEvent.
            if (window.PointerEvent) {
                button.addEventListener('pointerdown', start);
                button.addEventListener('pointerup', stopAction);
                button.addEventListener('pointercancel', stopAction);
                button.addEventListener('lostpointercapture', stopAction);
            } else {
                button.addEventListener('mousedown', start);
                button.addEventListener('mouseup', stopAction);
                button.addEventListener('mouseleave', stopAction);
            }
        };

        bindStepperButton(minusBtn, -0.1);
        bindStepperButton(plusBtn, 0.1);
    }

    // --- Remove Audio (Mute Video) ---
    const muteDropzone = document.getElementById('mute-dropzone');
    const muteFileInput = document.getElementById('mute-file-input');
    const muteDropzoneLabel = document.getElementById('mute-dropzone-label');
    const muteEditorBox = document.getElementById('mute-editor-box');
    const mutePreviewPlayer = document.getElementById('mute-preview-player');
    const muteModeSelect = document.getElementById('mute-mode-select');
    const muteModeHint = document.getElementById('mute-mode-hint');
    const muteRangeControls = document.getElementById('mute-range-controls');
    const muteStartSlider = document.getElementById('mute-start');
    const muteEndSlider = document.getElementById('mute-end');
    const muteFill = document.getElementById('mute-fill');
    const muteStartVal = document.getElementById('mute-start-val');
    const muteEndVal = document.getElementById('mute-end-val');
    const muteConvertBtn = document.getElementById('mute-convert-btn');
    const muteProgressBox = document.getElementById('mute-progress-box');
    const muteSuccessBox = document.getElementById('mute-success-box');
    const muteSuccessDesc = document.getElementById('mute-success-desc');
    const muteDownloadLink = document.getElementById('mute-download-link');
    const muteErrorBox = document.getElementById('mute-error-box');
    const muteErrorDesc = document.getElementById('mute-error-desc');

    let muteSelectedFile = null;
    let muteObjectURL = null;
    let muteDuration = 0;

    if (muteDropzone && muteFileInput) {
        muteDropzone.addEventListener('click', () => muteFileInput.click());

        muteFileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) handleMuteFile(e.target.files[0]);
            muteFileInput.value = '';
        });

        muteDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            muteDropzone.classList.add('drag-over');
        });
        muteDropzone.addEventListener('dragleave', () => {
            muteDropzone.classList.remove('drag-over');
        });
        muteDropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            muteDropzone.classList.remove('drag-over');
            if (e.dataTransfer.files && e.dataTransfer.files[0]) handleMuteFile(e.dataTransfer.files[0]);
        });
    }

    function handleMuteFile(file) {
        if (!file.type.startsWith('video/')) {
            alert('দয়া করে একটি ভিডিও ফাইল নির্বাচন করুন। (Please select a video file.)');
            return;
        }
        muteSelectedFile = file;
        if (muteDropzoneLabel) muteDropzoneLabel.innerText = file.name;
        if (muteObjectURL) URL.revokeObjectURL(muteObjectURL);
        muteObjectURL = URL.createObjectURL(file);
        if (mutePreviewPlayer) mutePreviewPlayer.src = muteObjectURL;

        if (muteEditorBox) muteEditorBox.style.display = 'block';
        if (muteProgressBox) muteProgressBox.style.display = 'none';
        if (muteSuccessBox) muteSuccessBox.style.display = 'none';
        if (muteErrorBox) muteErrorBox.style.display = 'none';

        if (mutePreviewPlayer) {
            mutePreviewPlayer.onloadedmetadata = () => {
                muteDuration = mutePreviewPlayer.duration;
                if (!isFinite(muteDuration) || muteDuration <= 0) {
                    mutePreviewPlayer.currentTime = 1e9;
                    mutePreviewPlayer.ontimeupdate = () => {
                        mutePreviewPlayer.ontimeupdate = null;
                        muteDuration = mutePreviewPlayer.duration;
                        mutePreviewPlayer.currentTime = 0;
                        muteSetupSliders();
                    };
                    return;
                }
                muteSetupSliders();
            };
        }
    }

    function muteSetupSliders() {
        if (!muteStartSlider || !muteEndSlider) return;
        muteStartSlider.min = 0;
        muteStartSlider.max = muteDuration;
        muteStartSlider.step = 0.01;
        muteStartSlider.value = 0;

        muteEndSlider.min = 0;
        muteEndSlider.max = muteDuration;
        muteEndSlider.step = 0.01;
        muteEndSlider.value = muteDuration;

        if (muteStartVal) muteStartVal.value = acropFormatTime(0);
        if (muteEndVal) muteEndVal.value = acropFormatTime(muteDuration);
        if (muteModeSelect) muteModeSelect.value = 'full';
        muteUpdateFill();
        muteUpdateModeUI();
    }

    function muteUpdateFill() {
        const total = muteDuration || 1;
        const startPercent = (parseFloat(muteStartSlider.value) / total) * 100;
        const endPercent = (parseFloat(muteEndSlider.value) / total) * 100;
        if (muteFill) {
            muteFill.style.left = startPercent + '%';
            muteFill.style.width = Math.max(0, endPercent - startPercent) + '%';
        }
    }

    function muteUpdateModeUI() {
        const mode = muteModeSelect ? muteModeSelect.value : 'full';
        const isRange = mode === 'range';
        if (muteRangeControls) muteRangeControls.style.display = isRange ? 'block' : 'none';
        if (muteModeHint) {
            muteModeHint.innerHTML = isRange
                ? 'নিচের স্লাইডার টেনে যে অংশটুকুর <strong>অডিও নিঃশব্দ (Mute) করতে</strong> চান সেটুকু বেছে নিন — বাকি অংশ স্বাভাবিক থাকবে।'
                : 'সম্পূর্ণ ভিডিওর অডিও ট্র্যাক স্থায়ীভাবে কেটে ফেলে দেওয়া হবে — কোনো সাউন্ড থাকবে না।';
        }
    }

    if (muteModeSelect) {
        muteModeSelect.addEventListener('change', muteUpdateModeUI);
    }

    if (muteStartSlider) {
        muteStartSlider.addEventListener('input', () => {
            let startV = parseFloat(muteStartSlider.value);
            const endV = parseFloat(muteEndSlider.value);
            if (startV >= endV) {
                startV = Math.max(0, endV - 0.05);
                muteStartSlider.value = startV;
            }
            if (muteStartVal) muteStartVal.value = acropFormatTime(startV);
            if (mutePreviewPlayer) mutePreviewPlayer.currentTime = startV;
            muteUpdateFill();
        });
    }

    if (muteEndSlider) {
        muteEndSlider.addEventListener('input', () => {
            const startV = parseFloat(muteStartSlider.value);
            let endV = parseFloat(muteEndSlider.value);
            if (endV <= startV) {
                endV = Math.min(muteDuration, startV + 0.05);
                muteEndSlider.value = endV;
            }
            if (muteEndVal) muteEndVal.value = acropFormatTime(endV);
            if (mutePreviewPlayer) mutePreviewPlayer.currentTime = endV;
            muteUpdateFill();
        });
    }

    attachTimeStepper('mute-start-minus', 'mute-start-plus', (delta) => {
        if (!muteDuration || !muteStartSlider || !muteEndSlider) return;
        let val = parseFloat(muteStartSlider.value) + delta;
        const endV = parseFloat(muteEndSlider.value);
        val = Math.max(0, Math.min(val, endV - 0.05));
        muteStartSlider.value = val;
        if (muteStartVal) muteStartVal.value = acropFormatTime(val);
        if (mutePreviewPlayer) mutePreviewPlayer.currentTime = val;
        muteUpdateFill();
    });

    attachTimeStepper('mute-end-minus', 'mute-end-plus', (delta) => {
        if (!muteDuration || !muteStartSlider || !muteEndSlider) return;
        let val = parseFloat(muteEndSlider.value) + delta;
        const startV = parseFloat(muteStartSlider.value);
        val = Math.min(muteDuration, Math.max(val, startV + 0.05));
        muteEndSlider.value = val;
        if (muteEndVal) muteEndVal.value = acropFormatTime(val);
        if (mutePreviewPlayer) mutePreviewPlayer.currentTime = val;
        muteUpdateFill();
    });

    if (muteConvertBtn) {
        muteConvertBtn.addEventListener('click', runRemoveAudio);
    }

    async function runRemoveAudio() {
        if (!muteSelectedFile) return;

        const mode = muteModeSelect ? muteModeSelect.value : 'full';
        let queryUrl = `/api/remove-audio?filename=${encodeURIComponent(muteSelectedFile.name)}&mode=${mode}`;
        if (mode === 'range' && muteStartSlider && muteEndSlider) {
            const startSec = parseFloat(muteStartSlider.value) || 0;
            const endSec = parseFloat(muteEndSlider.value) || muteDuration;
            if (endSec - startSec < 0.05) {
                alert('দয়া করে কমপক্ষে কিছু সময়ের একটি অংশ সিলেক্ট করুন।');
                return;
            }
            queryUrl += `&start=${startSec}&end=${endSec}`;
        }

        muteConvertBtn.disabled = true;
        if (muteProgressBox) muteProgressBox.style.display = 'block';
        if (muteSuccessBox) muteSuccessBox.style.display = 'none';
        if (muteErrorBox) muteErrorBox.style.display = 'none';

        try {
            const response = await fetch(queryUrl, {
                method: 'POST',
                headers: { 'Content-Type': muteSelectedFile.type || 'application/octet-stream' },
                body: muteSelectedFile
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || `Server error (${response.status})`);
            }

            if (muteDownloadLink) {
                muteDownloadLink.href = result.downloadUrl;
                muteDownloadLink.download = result.filename;
            }
            if (muteSuccessDesc) {
                muteSuccessDesc.innerText = `"${result.filename}" প্রস্তুত (${mode === 'range' ? 'নির্দিষ্ট সময় নিঃশব্দ' : 'সম্পূর্ণ নিঃশব্দ'})।`;
            }
            if (muteProgressBox) muteProgressBox.style.display = 'none';
            if (muteSuccessBox) muteSuccessBox.style.display = 'block';
        } catch (err) {
            console.error('Remove-audio failed:', err);
            if (muteProgressBox) muteProgressBox.style.display = 'none';
            if (muteErrorBox) muteErrorBox.style.display = 'block';
            if (muteErrorDesc) {
                muteErrorDesc.innerText = `সাউন্ড রিমুভ করা যায়নি: ${err.message}। সার্ভার (node server.js) চালু আছে কিনা দেখুন।`;
            }
        } finally {
            muteConvertBtn.disabled = false;
        }
    }

    // --- Audio Crop / Trim Tool (Phase 8B) ---
    // Independent of the main editor project: upload ANY audio file, preview
    // it with a native <audio> player, pick a Start/End range with a
    // dual-handle slider (same visual language as the main Trim & Layout
    // slider), then download just that range as WAV or MP3. Reuses the
    // WAV/MP3 encoding helpers defined above for the Video → Audio tool
    // (v2aAudioBufferToWavBlob, v2aEncodeMp3, ensureLamejsLoaded).
    const acropDropzone = document.getElementById('acrop-dropzone');
    const acropFileInput = document.getElementById('acrop-file-input');
    const acropDropzoneLabel = document.getElementById('acrop-dropzone-label');
    const acropRemoveBtn = document.getElementById('acrop-remove-btn');
    const acropRemoveHint = document.getElementById('acrop-remove-hint');
    const acropRemoveResultBtn = document.getElementById('acrop-remove-result-btn');
    const acropEditorBox = document.getElementById('acrop-editor-box');
    const acropPreviewPlayer = document.getElementById('acrop-preview-player');
    const acropModeSelect = document.getElementById('acrop-mode-select');
    const acropModeHint = document.getElementById('acrop-mode-hint');
    const acropStartSlider = document.getElementById('acrop-start');
    const acropEndSlider = document.getElementById('acrop-end');
    const acropFill = document.getElementById('acrop-fill');
    const acropStartVal = document.getElementById('acrop-start-val');
    const acropEndVal = document.getElementById('acrop-end-val');
    const acropFormatSelect = document.getElementById('acrop-format-select');
    const acropMp3Option = document.getElementById('acrop-mp3-option');
    const acropCropBtn = document.getElementById('acrop-crop-btn');
    const acropProgressBox = document.getElementById('acrop-progress-box');
    const acropStatusText = document.getElementById('acrop-status-text');
    const acropPercentage = document.getElementById('acrop-percentage');
    const acropProgressFill = document.getElementById('acrop-progress-fill');
    const acropSuccessBox = document.getElementById('acrop-success-box');
    const acropSuccessDesc = document.getElementById('acrop-success-desc');
    const acropDownloadLink = document.getElementById('acrop-download-link');

    let acropSelectedFile = null;
    let acropObjectURL = null;
    let acropLastDownloadURL = null;
    let acropDuration = 0;

    function acropFormatTime(seconds) {
        if (!isFinite(seconds) || seconds < 0) seconds = 0;
        const mins = Math.floor(seconds / 60);
        const secs = (seconds % 60).toFixed(1);
        return `${String(mins).padStart(2, '0')}:${secs.padStart(4, '0')}`;
    }

    function acropParseTimeInput(str) {
        if (!str) return null;
        str = str.trim();
        if (str.includes(':')) {
            const parts = str.split(':');
            const mins = parseFloat(parts[0]) || 0;
            const secs = parseFloat(parts[1]) || 0;
            return mins * 60 + secs;
        }
        const val = parseFloat(str);
        return isNaN(val) ? null : val;
    }

    if (acropDropzone && acropFileInput) {
        acropDropzone.addEventListener('click', () => acropFileInput.click());

        acropFileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) handleAcropFile(e.target.files[0]);
            acropFileInput.value = '';
        });

        acropDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            acropDropzone.classList.add('drag-over');
        });
        acropDropzone.addEventListener('dragleave', () => {
            acropDropzone.classList.remove('drag-over');
        });
        acropDropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            acropDropzone.classList.remove('drag-over');
            if (e.dataTransfer.files && e.dataTransfer.files[0]) handleAcropFile(e.dataTransfer.files[0]);
        });
    }

    function handleAcropFile(file) {
        if (!file.type.startsWith('audio/')) {
            alert('দয়া করে একটি অডিও ফাইল নির্বাচন করুন। (Please select an audio file.)');
            return;
        }
        acropSelectedFile = file;
        if (acropDropzoneLabel) acropDropzoneLabel.innerText = file.name;
        if (acropRemoveBtn) acropRemoveBtn.style.display = 'inline-flex';
        if (acropRemoveHint) acropRemoveHint.style.display = 'block';
        if (acropObjectURL) URL.revokeObjectURL(acropObjectURL);
        acropObjectURL = URL.createObjectURL(file);
        acropPreviewPlayer.src = acropObjectURL;

        acropEditorBox.style.display = 'none';
        acropProgressBox.style.display = 'none';
        acropSuccessBox.style.display = 'none';
        if (acropLastDownloadURL) {
            URL.revokeObjectURL(acropLastDownloadURL);
            acropLastDownloadURL = null;
        }

        acropPreviewPlayer.onloadedmetadata = () => {
            acropDuration = acropPreviewPlayer.duration;
            if (!isFinite(acropDuration) || acropDuration <= 0) {
                // Some containers (e.g. certain WebM/OGG files) report Infinity
                // duration until the browser has seeked at least once.
                acropPreviewPlayer.currentTime = 1e9;
                acropPreviewPlayer.ontimeupdate = () => {
                    acropPreviewPlayer.ontimeupdate = null;
                    acropDuration = acropPreviewPlayer.duration;
                    acropPreviewPlayer.currentTime = 0;
                    acropSetupSliders();
                };
                return;
            }
            acropSetupSliders();
        };
    }

    // Fully clears the primary audio (and, since Add Audio depends on it,
    // whatever second file/result was staged there too) back to the empty
    // dropzone state — for when the person wants to discard everything and
    // start over without reloading the page.
    function resetAcropAll() {
        acropSelectedFile = null;
        acropDuration = 0;
        if (acropObjectURL) { URL.revokeObjectURL(acropObjectURL); acropObjectURL = null; }
        if (acropLastDownloadURL) { URL.revokeObjectURL(acropLastDownloadURL); acropLastDownloadURL = null; }
        if (acropPreviewPlayer) { acropPreviewPlayer.pause(); acropPreviewPlayer.src = ''; }
        if (acropDropzoneLabel) acropDropzoneLabel.innerText = 'Drag & Drop Audio here or Click to Select';
        if (acropRemoveBtn) acropRemoveBtn.style.display = 'none';
        if (acropRemoveHint) acropRemoveHint.style.display = 'none';
        if (acropEditorBox) acropEditorBox.style.display = 'none';
        if (acropProgressBox) acropProgressBox.style.display = 'none';
        if (acropSuccessBox) acropSuccessBox.style.display = 'none';
        // The 2nd-audio (Add Audio) section only makes sense with a primary
        // file loaded, so clear it too.
        if (typeof resetAcropaddAll === 'function') resetAcropaddAll();
    }

    if (acropRemoveBtn) {
        acropRemoveBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // don't let the click bubble to the dropzone and reopen the file picker
            resetAcropAll();
        });
    }

    if (acropRemoveResultBtn) {
        acropRemoveResultBtn.addEventListener('click', () => {
            if (acropLastDownloadURL) { URL.revokeObjectURL(acropLastDownloadURL); acropLastDownloadURL = null; }
            if (acropSuccessBox) acropSuccessBox.style.display = 'none';
        });
    }

    function acropSetupSliders() {
        acropStartSlider.min = 0;
        acropStartSlider.max = acropDuration;
        acropStartSlider.step = 0.01;
        acropStartSlider.value = 0;

        acropEndSlider.min = 0;
        acropEndSlider.max = acropDuration;
        acropEndSlider.step = 0.01;
        acropEndSlider.value = acropDuration;

        acropStartVal.value = acropFormatTime(0);
        acropEndVal.value = acropFormatTime(acropDuration);
        if (acropModeSelect) acropModeSelect.value = 'keep';
        acropUpdateFill();
        acropUpdateModeUI();
        acropEditorBox.style.display = 'block';
    }

    function acropUpdateFill() {
        const total = acropDuration || 1;
        const startPercent = (parseFloat(acropStartSlider.value) / total) * 100;
        const endPercent = (parseFloat(acropEndSlider.value) / total) * 100;
        if (acropFill) {
            acropFill.style.left = startPercent + '%';
            acropFill.style.width = Math.max(0, endPercent - startPercent) + '%';
        }
    }

    // Keeps the hint text, the highlighted slider color, and the crop
    // button's label in sync with whether the person wants to KEEP the
    // selected range (old default behaviour) or REMOVE it and keep
    // everything before + after instead (what was missing before).
    function acropUpdateModeUI() {
        const mode = acropModeSelect ? acropModeSelect.value : 'keep';
        const isRemove = mode === 'remove';
        if (acropFill) acropFill.classList.toggle('acrop-fill-remove', isRemove);
        if (acropModeHint) {
            acropModeHint.innerHTML = isRemove
                ? 'নিচের স্লাইডার টেনে যে অংশটুকু <strong>বাদ দিতে (মুছে ফেলতে)</strong> চান সেটুকু বেছে নিন — বাকি অংশ জোড়া লেগে থাকবে।'
                : 'নিচের স্লাইডার টেনে যে অংশটুকু <strong>রাখতে</strong> চান সেটুকু বেছে নিন — বাকি অংশ বাদ চলে যাবে।';
        }
        if (acropCropBtn) {
            acropCropBtn.innerHTML = isRemove
                ? '<i class="fa-solid fa-scissors"></i> নির্বাচিত অংশ বাদ দিন (Remove Selected Part)'
                : '<i class="fa-solid fa-scissors"></i> নির্বাচিত অংশ রাখুন (Crop Audio)';
        }
    }

    if (acropModeSelect) {
        acropModeSelect.addEventListener('change', acropUpdateModeUI);
    }

    if (acropStartSlider) {
        acropStartSlider.addEventListener('input', () => {
            let startV = parseFloat(acropStartSlider.value);
            const endV = parseFloat(acropEndSlider.value);
            if (startV >= endV) {
                startV = Math.max(0, endV - 0.05);
                acropStartSlider.value = startV;
            }
            acropStartVal.value = acropFormatTime(startV);
            acropPreviewPlayer.currentTime = startV;
            acropUpdateFill();
        });
    }

    if (acropEndSlider) {
        acropEndSlider.addEventListener('input', () => {
            const startV = parseFloat(acropStartSlider.value);
            let endV = parseFloat(acropEndSlider.value);
            if (endV <= startV) {
                endV = Math.min(acropDuration, startV + 0.05);
                acropEndSlider.value = endV;
            }
            acropEndVal.value = acropFormatTime(endV);
            acropPreviewPlayer.currentTime = endV;
            acropUpdateFill();
        });
    }

    if (acropStartVal) {
        acropStartVal.addEventListener('change', () => {
            const parsed = acropParseTimeInput(acropStartVal.value);
            if (parsed === null) return;
            const clamped = Math.max(0, Math.min(parsed, parseFloat(acropEndSlider.value) - 0.05));
            acropStartSlider.value = clamped;
            acropStartVal.value = acropFormatTime(clamped);
            acropPreviewPlayer.currentTime = clamped;
            acropUpdateFill();
        });
    }

    if (acropEndVal) {
        acropEndVal.addEventListener('change', () => {
            const parsed = acropParseTimeInput(acropEndVal.value);
            if (parsed === null) return;
            const clamped = Math.min(acropDuration, Math.max(parsed, parseFloat(acropStartSlider.value) + 0.05));
            acropEndSlider.value = clamped;
            acropEndVal.value = acropFormatTime(clamped);
            acropPreviewPlayer.currentTime = clamped;
            acropUpdateFill();
        });
    }

    attachTimeStepper('acrop-start-minus', 'acrop-start-plus', (delta) => {
        if (!acropDuration || !acropStartSlider || !acropEndSlider) return;
        let val = parseFloat(acropStartSlider.value) + delta;
        const endV = parseFloat(acropEndSlider.value);
        val = Math.max(0, Math.min(val, endV - 0.05));
        acropStartSlider.value = val;
        if (acropStartVal) acropStartVal.value = acropFormatTime(val);
        if (acropPreviewPlayer) acropPreviewPlayer.currentTime = val;
        acropUpdateFill();
    });

    attachTimeStepper('acrop-end-minus', 'acrop-end-plus', (delta) => {
        if (!acropDuration || !acropStartSlider || !acropEndSlider) return;
        let val = parseFloat(acropEndSlider.value) + delta;
        const startV = parseFloat(acropStartSlider.value);
        val = Math.min(acropDuration, Math.max(val, startV + 0.05));
        acropEndSlider.value = val;
        if (acropEndVal) acropEndVal.value = acropFormatTime(val);
        if (acropPreviewPlayer) acropPreviewPlayer.currentTime = val;
        acropUpdateFill();
    });

    attachTimeStepper('trim-start-minus', 'trim-start-plus', (delta) => {
        const trimStart = document.getElementById('trim-start');
        const trimEnd = document.getElementById('trim-end');
        if (!trimStart || !trimEnd) return;
        let val = parseFloat(trimStart.value) + delta;
        const endV = parseFloat(trimEnd.value);
        val = Math.max(0, Math.min(val, endV - 0.05));
        trimStart.value = val;
        trimStart.dispatchEvent(new Event('input', { bubbles: true }));
    });

    attachTimeStepper('trim-end-minus', 'trim-end-plus', (delta) => {
        const trimStart = document.getElementById('trim-start');
        const trimEnd = document.getElementById('trim-end');
        if (!trimStart || !trimEnd) return;
        let val = parseFloat(trimEnd.value) + delta;
        const maxV = parseFloat(trimEnd.max) || 100;
        const startV = parseFloat(trimStart.value);
        val = Math.min(maxV, Math.max(val, startV + 0.05));
        trimEnd.value = val;
        trimEnd.dispatchEvent(new Event('input', { bubbles: true }));
    });

    function setAcropProgress(percent, statusText) {
        if (acropProgressFill) acropProgressFill.style.width = percent + '%';
        if (acropPercentage) acropPercentage.innerText = percent + '%';
        if (statusText && acropStatusText) acropStatusText.innerText = statusText;
    }

    if (acropCropBtn) {
        acropCropBtn.addEventListener('click', runAcropCrop);
    }

    async function runAcropCrop() {
        if (!acropSelectedFile) return;
        const startSec = parseFloat(acropStartSlider.value) || 0;
        const endSec = parseFloat(acropEndSlider.value) || acropDuration;
        if (endSec - startSec < 0.05) {
            alert('দয়া করে কমপক্ষে কিছু সময়ের একটি অংশ সিলেক্ট করুন।');
            return;
        }
        const mode = acropModeSelect ? acropModeSelect.value : 'keep';
        if (mode === 'remove' && startSec <= 0.001 && endSec >= acropDuration - 0.001) {
            alert('পুরো ফাইলটাই সিলেক্ট করা আছে — এটা বাদ দিলে কিছুই বাকি থাকবে না। দয়া করে অংশটুকু ছোট করে সিলেক্ট করুন।');
            return;
        }
        const format = acropFormatSelect ? acropFormatSelect.value : 'wav';

        acropCropBtn.disabled = true;
        if (acropFormatSelect) acropFormatSelect.disabled = true;
        acropProgressBox.style.display = 'block';
        acropSuccessBox.style.display = 'none';
        setAcropProgress(0, 'ফাইল পড়া হচ্ছে... (Reading file...)');

        // Dedicated AudioContext for this crop only — kept separate from the
        // main editor's audio graph, same isolation approach as the Video →
        // Audio converter above.
        let decodeCtx = null;

        try {
            const arrayBuffer = await acropSelectedFile.arrayBuffer();
            setAcropProgress(20, 'অডিও ডিকোড হচ্ছে... (Decoding audio...)');

            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            decodeCtx = new AudioCtx();

            let audioBuffer;
            try {
                audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer);
            } catch (decodeErr) {
                throw new Error('DECODE_FAILED');
            }

            setAcropProgress(40, 'নির্বাচিত অংশ কাটা হচ্ছে... (Cropping selection...)');

            const sampleRate = audioBuffer.sampleRate;
            const startFrame = Math.max(0, Math.floor(startSec * sampleRate));
            const endFrame = Math.min(audioBuffer.length, Math.ceil(endSec * sampleRate));
            const numChannels = audioBuffer.numberOfChannels;

            let croppedBuffer;
            if (mode === 'remove') {
                // Keep everything OUTSIDE the selected range: the part
                // before "start" and the part after "end", spliced back
                // together with the selected middle removed.
                const beforeLen = startFrame;
                const afterLen = audioBuffer.length - endFrame;
                const frameCount = Math.max(1, beforeLen + afterLen);
                croppedBuffer = decodeCtx.createBuffer(numChannels, frameCount, sampleRate);
                for (let ch = 0; ch < numChannels; ch++) {
                    const sourceData = audioBuffer.getChannelData(ch);
                    const dest = croppedBuffer.getChannelData(ch);
                    if (beforeLen > 0) dest.set(sourceData.subarray(0, beforeLen), 0);
                    if (afterLen > 0) dest.set(sourceData.subarray(endFrame, audioBuffer.length), beforeLen);
                }
            } else {
                // Keep ONLY the selected range (original behaviour).
                const frameCount = Math.max(1, endFrame - startFrame);
                croppedBuffer = decodeCtx.createBuffer(numChannels, frameCount, sampleRate);
                for (let ch = 0; ch < numChannels; ch++) {
                    const sourceData = audioBuffer.getChannelData(ch);
                    const slice = sourceData.subarray(startFrame, startFrame + frameCount);
                    croppedBuffer.copyToChannel(slice, ch);
                }
            }

            setAcropProgress(55, format === 'mp3'
                ? 'MP3 এনকোড হচ্ছে... (Encoding MP3...)'
                : 'WAV তৈরি হচ্ছে... (Building WAV...)');

            let blob, ext, mimeLabel;
            if (format === 'mp3') {
                const lamejsReady = await ensureLamejsLoaded();
                if (!lamejsReady) throw new Error('MP3_UNAVAILABLE');
                blob = await v2aEncodeMp3(croppedBuffer, 128, (p) => {
                    setAcropProgress(55 + Math.round(p * 40), 'MP3 এনকোড হচ্ছে... (Encoding MP3...)');
                });
                ext = 'mp3';
                mimeLabel = 'MP3';
            } else {
                blob = v2aAudioBufferToWavBlob(croppedBuffer);
                ext = 'wav';
                mimeLabel = 'WAV';
            }

            setAcropProgress(100, 'সম্পন্ন! (Complete!)');

            const baseName = acropSelectedFile.name.substring(0, acropSelectedFile.name.lastIndexOf('.')) || acropSelectedFile.name;
            if (acropLastDownloadURL) URL.revokeObjectURL(acropLastDownloadURL);
            acropLastDownloadURL = URL.createObjectURL(blob);
            acropDownloadLink.href = acropLastDownloadURL;
            const suffix = mode === 'remove' ? '_trimmed' : '_cropped';
            acropDownloadLink.download = `${baseName}${suffix}.${ext}`;
            if (acropSuccessDesc) {
                acropSuccessDesc.innerText = mode === 'remove'
                    ? `${mimeLabel} ফাইল প্রস্তুত — (${acropFormatTime(startSec)} - ${acropFormatTime(endSec)}) অংশটুকু বাদ দিয়ে বাকিটা জোড়া লাগানো হয়েছে — "${baseName}${suffix}.${ext}" ডাউনলোড করুন।`
                    : `${mimeLabel} ফাইল প্রস্তুত (${acropFormatTime(startSec)} - ${acropFormatTime(endSec)}) — "${baseName}${suffix}.${ext}" ডাউনলোড করুন।`;
            }

            setTimeout(() => {
                acropProgressBox.style.display = 'none';
                acropSuccessBox.style.display = 'block';
            }, 300);
        } catch (err) {
            console.error('Audio crop failed:', err);
            acropProgressBox.style.display = 'none';
            if (err && err.message === 'DECODE_FAILED') {
                alert('এই ফাইলের অডিও ডিকোড করা যায়নি। ফরম্যাট/কোডেকটি সম্ভবত এই ব্রাউজার সাপোর্ট করে না।');
            } else if (err && err.message === 'MP3_UNAVAILABLE') {
                alert('MP3 এনকোডার লোড করা যায়নি (ইন্টারনেট সংযোগ প্রয়োজন)। দয়া করে WAV ফরম্যাট বেছে আবার চেষ্টা করুন।');
                if (acropMp3Option) {
                    acropMp3Option.disabled = true;
                    acropMp3Option.innerText = 'MP3 (লোড করা যায়নি — ইন্টারনেট সংযোগ প্রয়োজন)';
                }
                if (acropFormatSelect) acropFormatSelect.value = 'wav';
            } else {
                alert('অডিও ক্রপ করতে সমস্যা হয়েছে। ফাইলটি অন্য একটি দিয়ে আবার চেষ্টা করুন।');
            }
        } finally {
            if (decodeCtx) {
                try { decodeCtx.close(); } catch (e) { /* ignore */ }
            }
            acropCropBtn.disabled = false;
            if (acropFormatSelect) acropFormatSelect.disabled = false;
        }
    }

    // --- Add Audio (combine two audio files) ---
    // Lives inside the Audio Crop/Trim card. Once the primary audio file is
    // loaded above, the user can pick a second audio file here and combine
    // it with the first entirely client-side (Web Audio API decode + manual
    // buffer join/mix), then encode the result with the same WAV/MP3
    // helpers used by the crop tool. Two modes:
    //   - concat: lay the two buffers end-to-end (pick which plays first)
    //   - mix:    overlay both buffers from time 0, each with its own
    //             volume gain, summed and soft-clamped to avoid clipping
    const acropaddDropzone = document.getElementById('acropadd-dropzone');
    const acropaddFileInput = document.getElementById('acropadd-file-input');
    const acropaddDropzoneLabel = document.getElementById('acropadd-dropzone-label');
    const acropaddRemoveBtn = document.getElementById('acropadd-remove-btn');
    const acropaddRemoveResultBtn = document.getElementById('acropadd-remove-result-btn');
    const acropaddOptionsBox = document.getElementById('acropadd-options-box');
    const acropaddModeSelect = document.getElementById('acropadd-mode-select');
    const acropaddOrderBox = document.getElementById('acropadd-order-box');
    const acropaddOrderSelect = document.getElementById('acropadd-order-select');
    const acropaddMixVolumes = document.getElementById('acropadd-mix-volumes');
    const acropaddVol1Slider = document.getElementById('acropadd-vol1-slider');
    const acropaddVol1Val = document.getElementById('acropadd-vol1-val');
    const acropaddVol2Slider = document.getElementById('acropadd-vol2-slider');
    const acropaddVol2Val = document.getElementById('acropadd-vol2-val');
    const acropaddCombineBtn = document.getElementById('acropadd-combine-btn');
    const acropaddProgressBox = document.getElementById('acropadd-progress-box');
    const acropaddStatusText = document.getElementById('acropadd-status-text');
    const acropaddPercentage = document.getElementById('acropadd-percentage');
    const acropaddProgressFill = document.getElementById('acropadd-progress-fill');
    const acropaddSuccessBox = document.getElementById('acropadd-success-box');
    const acropaddSuccessDesc = document.getElementById('acropadd-success-desc');
    const acropaddDownloadLink = document.getElementById('acropadd-download-link');
    const acropaddErrorBox = document.getElementById('acropadd-error-box');
    const acropaddErrorDesc = document.getElementById('acropadd-error-desc');

    let acropaddSelectedFile = null;
    let acropaddLastDownloadURL = null;

    if (acropaddDropzone && acropaddFileInput) {
        acropaddDropzone.addEventListener('click', () => acropaddFileInput.click());
        acropaddFileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) handleAcropaddFile(e.target.files[0]);
            acropaddFileInput.value = '';
        });
        acropaddDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            acropaddDropzone.classList.add('drag-over');
        });
        acropaddDropzone.addEventListener('dragleave', () => {
            acropaddDropzone.classList.remove('drag-over');
        });
        acropaddDropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            acropaddDropzone.classList.remove('drag-over');
            if (e.dataTransfer.files && e.dataTransfer.files[0]) handleAcropaddFile(e.dataTransfer.files[0]);
        });
    }

    function handleAcropaddFile(file) {
        if (!acropSelectedFile) {
            alert('প্রথমে উপরে প্রাইমারি অডিও ফাইলটি আপলোড করুন। (Please upload the primary audio file above first.)');
            return;
        }
        if (!file.type.startsWith('audio/')) {
            alert('দয়া করে একটি অডিও ফাইল নির্বাচন করুন। (Please select an audio file.)');
            return;
        }
        acropaddSelectedFile = file;
        if (acropaddDropzoneLabel) acropaddDropzoneLabel.innerText = file.name;
        if (acropaddRemoveBtn) acropaddRemoveBtn.style.display = 'inline-flex';
        if (acropaddSuccessBox) acropaddSuccessBox.style.display = 'none';
        if (acropaddErrorBox) acropaddErrorBox.style.display = 'none';
        if (acropaddOptionsBox) acropaddOptionsBox.style.display = 'block';
    }

    // Clears just the 2nd-audio side of the Add Audio section (the primary
    // file loaded above stays untouched). Also called by resetAcropAll()
    // above when the primary file itself is removed.
    function resetAcropaddAll() {
        acropaddSelectedFile = null;
        if (acropaddLastDownloadURL) { URL.revokeObjectURL(acropaddLastDownloadURL); acropaddLastDownloadURL = null; }
        if (acropaddDropzoneLabel) acropaddDropzoneLabel.innerText = 'Drag & Drop 2nd Audio here or Click to Select';
        if (acropaddRemoveBtn) acropaddRemoveBtn.style.display = 'none';
        if (acropaddOptionsBox) acropaddOptionsBox.style.display = 'none';
        if (acropaddProgressBox) acropaddProgressBox.style.display = 'none';
        if (acropaddSuccessBox) acropaddSuccessBox.style.display = 'none';
        if (acropaddErrorBox) acropaddErrorBox.style.display = 'none';
    }

    if (acropaddRemoveBtn) {
        acropaddRemoveBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            resetAcropaddAll();
        });
    }

    if (acropaddRemoveResultBtn) {
        acropaddRemoveResultBtn.addEventListener('click', () => {
            if (acropaddLastDownloadURL) { URL.revokeObjectURL(acropaddLastDownloadURL); acropaddLastDownloadURL = null; }
            if (acropaddSuccessBox) acropaddSuccessBox.style.display = 'none';
        });
    }

    if (acropaddModeSelect) {
        acropaddModeSelect.addEventListener('change', () => {
            const isMix = acropaddModeSelect.value === 'mix';
            if (acropaddMixVolumes) acropaddMixVolumes.style.display = isMix ? 'block' : 'none';
            if (acropaddOrderBox) acropaddOrderBox.style.display = isMix ? 'none' : 'block';
        });
    }

    if (acropaddVol1Slider && acropaddVol1Val) {
        acropaddVol1Slider.addEventListener('input', () => {
            acropaddVol1Val.innerText = acropaddVol1Slider.value + '%';
        });
    }
    if (acropaddVol2Slider && acropaddVol2Val) {
        acropaddVol2Slider.addEventListener('input', () => {
            acropaddVol2Val.innerText = acropaddVol2Slider.value + '%';
        });
    }

    function setAcropaddProgress(percent, statusText) {
        if (acropaddProgressFill) acropaddProgressFill.style.width = percent + '%';
        if (acropaddPercentage) acropaddPercentage.innerText = percent + '%';
        if (statusText && acropaddStatusText) acropaddStatusText.innerText = statusText;
    }

    if (acropaddCombineBtn) {
        acropaddCombineBtn.addEventListener('click', runAcropaddCombine);
    }

    async function runAcropaddCombine() {
        if (!acropSelectedFile || !acropaddSelectedFile) return;

        const mode = acropaddModeSelect ? acropaddModeSelect.value : 'concat';
        const order = acropaddOrderSelect ? acropaddOrderSelect.value : 'first-second';
        const vol1 = acropaddVol1Slider ? (parseInt(acropaddVol1Slider.value, 10) / 100) : 1;
        const vol2 = acropaddVol2Slider ? (parseInt(acropaddVol2Slider.value, 10) / 100) : 1;
        const format = acropFormatSelect ? acropFormatSelect.value : 'wav';

        acropaddCombineBtn.disabled = true;
        acropaddProgressBox.style.display = 'block';
        acropaddSuccessBox.style.display = 'none';
        acropaddErrorBox.style.display = 'none';
        setAcropaddProgress(0, 'ফাইল পড়া হচ্ছে... (Reading files...)');

        // Dedicated AudioContext, kept separate from the main editor's audio
        // graph — both files are decoded through the SAME context so the
        // browser resamples them to a common sample rate automatically.
        let decodeCtx = null;

        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            decodeCtx = new AudioCtx();

            const [buf1ArrayBuf, buf2ArrayBuf] = await Promise.all([
                acropSelectedFile.arrayBuffer(),
                acropaddSelectedFile.arrayBuffer()
            ]);

            setAcropaddProgress(20, 'অডিও ডিকোড হচ্ছে... (Decoding audio...)');

            let bufferA, bufferB;
            try {
                bufferA = await decodeCtx.decodeAudioData(buf1ArrayBuf);
            } catch (e) {
                throw new Error('DECODE_FAILED_1');
            }
            try {
                bufferB = await decodeCtx.decodeAudioData(buf2ArrayBuf);
            } catch (e) {
                throw new Error('DECODE_FAILED_2');
            }

            setAcropaddProgress(45, mode === 'mix'
                ? 'অডিও মিশ্রণ করা হচ্ছে... (Mixing audio...)'
                : 'অডিও জোড়া লাগানো হচ্ছে... (Joining audio...)');

            const sampleRate = decodeCtx.sampleRate;
            const numChannels = Math.max(bufferA.numberOfChannels, bufferB.numberOfChannels);

            // channelData(buf, ch) reuses channel 0 for any buffer with fewer
            // channels than the combined output (e.g. mono source, stereo output).
            function channelData(buf, ch) {
                return buf.getChannelData(Math.min(ch, buf.numberOfChannels - 1));
            }

            let combinedBuffer;
            if (mode === 'mix') {
                const length = Math.max(bufferA.length, bufferB.length);
                combinedBuffer = decodeCtx.createBuffer(numChannels, length, sampleRate);
                for (let ch = 0; ch < numChannels; ch++) {
                    const out = combinedBuffer.getChannelData(ch);
                    const dataA = channelData(bufferA, ch);
                    const dataB = channelData(bufferB, ch);
                    for (let i = 0; i < length; i++) {
                        let sample = (i < dataA.length ? dataA[i] * vol1 : 0) + (i < dataB.length ? dataB[i] * vol2 : 0);
                        // Soft-clamp to avoid harsh digital clipping when both
                        // tracks peak at the same time.
                        if (sample > 1) sample = 1;
                        if (sample < -1) sample = -1;
                        out[i] = sample;
                    }
                }
            } else {
                const first = order === 'second-first' ? bufferB : bufferA;
                const second = order === 'second-first' ? bufferA : bufferB;
                const length = first.length + second.length;
                combinedBuffer = decodeCtx.createBuffer(numChannels, length, sampleRate);
                for (let ch = 0; ch < numChannels; ch++) {
                    const out = combinedBuffer.getChannelData(ch);
                    out.set(channelData(first, ch), 0);
                    out.set(channelData(second, ch), first.length);
                }
            }

            setAcropaddProgress(60, format === 'mp3'
                ? 'MP3 এনকোড হচ্ছে... (Encoding MP3...)'
                : 'WAV তৈরি হচ্ছে... (Building WAV...)');

            let blob, ext, mimeLabel;
            if (format === 'mp3') {
                const lamejsReady = await ensureLamejsLoaded();
                if (!lamejsReady) throw new Error('MP3_UNAVAILABLE');
                blob = await v2aEncodeMp3(combinedBuffer, 128, (p) => {
                    setAcropaddProgress(60 + Math.round(p * 35), 'MP3 এনকোড হচ্ছে... (Encoding MP3...)');
                });
                ext = 'mp3';
                mimeLabel = 'MP3';
            } else {
                blob = v2aAudioBufferToWavBlob(combinedBuffer);
                ext = 'wav';
                mimeLabel = 'WAV';
            }

            setAcropaddProgress(100, 'সম্পন্ন! (Complete!)');

            if (acropaddLastDownloadURL) URL.revokeObjectURL(acropaddLastDownloadURL);
            acropaddLastDownloadURL = URL.createObjectURL(blob);
            acropaddDownloadLink.href = acropaddLastDownloadURL;
            acropaddDownloadLink.download = `combined_audio.${ext}`;
            if (acropaddSuccessDesc) {
                acropaddSuccessDesc.innerText = mode === 'mix'
                    ? `${mimeLabel} ফাইল প্রস্তুত — দুটি অডিও একসাথে মিশিয়ে "combined_audio.${ext}" তৈরি হয়েছে।`
                    : `${mimeLabel} ফাইল প্রস্তুত — দুটি অডিও জোড়া লাগিয়ে "combined_audio.${ext}" তৈরি হয়েছে।`;
            }

            setTimeout(() => {
                acropaddProgressBox.style.display = 'none';
                acropaddSuccessBox.style.display = 'block';
            }, 300);
        } catch (err) {
            console.error('Add-audio combine failed:', err);
            acropaddProgressBox.style.display = 'none';
            if (err && (err.message === 'DECODE_FAILED_1' || err.message === 'DECODE_FAILED_2')) {
                const which = err.message === 'DECODE_FAILED_1' ? 'প্রথম' : 'দ্বিতীয়';
                acropaddErrorBox.style.display = 'block';
                if (acropaddErrorDesc) acropaddErrorDesc.innerText = `${which} অডিও ফাইলটি ডিকোড করা যায়নি। ফরম্যাট/কোডেকটি সম্ভবত এই ব্রাউজার সাপোর্ট করে না।`;
            } else if (err && err.message === 'MP3_UNAVAILABLE') {
                acropaddErrorBox.style.display = 'block';
                if (acropaddErrorDesc) acropaddErrorDesc.innerText = 'MP3 এনকোডার লোড করা যায়নি (ইন্টারনেট সংযোগ প্রয়োজন)। দয়া করে WAV ফরম্যাট বেছে আবার চেষ্টা করুন।';
                if (acropFormatSelect) acropFormatSelect.value = 'wav';
            } else {
                acropaddErrorBox.style.display = 'block';
                if (acropaddErrorDesc) acropaddErrorDesc.innerText = 'অডিও একত্রিত করতে সমস্যা হয়েছে। ফাইলগুলো অন্য কিছু দিয়ে আবার চেষ্টা করুন।';
            }
        } finally {
            if (decodeCtx) {
                try { decodeCtx.close(); } catch (e) { /* ignore */ }
            }
            acropaddCombineBtn.disabled = false;
        }
    }
    // Same reasoning as Remove Audio above: the browser can't remux/mix a full
    // audio track into an existing video container on its own, so the two raw
    // files are streamed to the local Node server (server.js's /api/add-audio
    // routes), which uses ffmpeg to either replace the video's audio track
    // entirely or mix it with the original, then hands back a download link.
    // Independent of the main editor project — any video/audio pair works.
    const addaudioVideoDropzone = document.getElementById('addaudio-video-dropzone');
    const addaudioVideoFileInput = document.getElementById('addaudio-video-file-input');
    const addaudioVideoDropzoneLabel = document.getElementById('addaudio-video-dropzone-label');
    const addaudioAudioDropzone = document.getElementById('addaudio-audio-dropzone');
    const addaudioAudioFileInput = document.getElementById('addaudio-audio-file-input');
    const addaudioAudioDropzoneLabel = document.getElementById('addaudio-audio-dropzone-label');
    const addaudioOptionsBox = document.getElementById('addaudio-options-box');
    const addaudioModeSelect = document.getElementById('addaudio-mode-select');
    const addaudioMixVolumes = document.getElementById('addaudio-mix-volumes');
    const addaudioVideoVolumeSlider = document.getElementById('addaudio-video-volume-slider');
    const addaudioVideoVolumeVal = document.getElementById('addaudio-video-volume-val');
    const addaudioAudioVolumeSlider = document.getElementById('addaudio-audio-volume-slider');
    const addaudioAudioVolumeVal = document.getElementById('addaudio-audio-volume-val');
    const addaudioOffsetVal = document.getElementById('addaudio-offset-val');
    const addaudioShortestToggle = document.getElementById('addaudio-shortest-toggle');
    const addaudioRunBtn = document.getElementById('addaudio-run-btn');
    const addaudioProgressBox = document.getElementById('addaudio-progress-box');
    const addaudioStatusText = document.getElementById('addaudio-status-text');
    const addaudioSuccessBox = document.getElementById('addaudio-success-box');
    const addaudioSuccessDesc = document.getElementById('addaudio-success-desc');
    const addaudioDownloadLink = document.getElementById('addaudio-download-link');
    const addaudioErrorBox = document.getElementById('addaudio-error-box');
    const addaudioErrorDesc = document.getElementById('addaudio-error-desc');

    let addaudioVideoFile = null;
    let addaudioAudioFile = null;

    function addaudioMaybeShowOptions() {
        if (addaudioOptionsBox) {
            addaudioOptionsBox.style.display = (addaudioVideoFile && addaudioAudioFile) ? 'block' : 'none';
        }
    }

    if (addaudioVideoDropzone && addaudioVideoFileInput) {
        addaudioVideoDropzone.addEventListener('click', () => addaudioVideoFileInput.click());
        addaudioVideoFileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) handleAddaudioVideoFile(e.target.files[0]);
            addaudioVideoFileInput.value = '';
        });
        addaudioVideoDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            addaudioVideoDropzone.classList.add('drag-over');
        });
        addaudioVideoDropzone.addEventListener('dragleave', () => {
            addaudioVideoDropzone.classList.remove('drag-over');
        });
        addaudioVideoDropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            addaudioVideoDropzone.classList.remove('drag-over');
            if (e.dataTransfer.files && e.dataTransfer.files[0]) handleAddaudioVideoFile(e.dataTransfer.files[0]);
        });
    }

    if (addaudioAudioDropzone && addaudioAudioFileInput) {
        addaudioAudioDropzone.addEventListener('click', () => addaudioAudioFileInput.click());
        addaudioAudioFileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) handleAddaudioAudioFile(e.target.files[0]);
            addaudioAudioFileInput.value = '';
        });
        addaudioAudioDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            addaudioAudioDropzone.classList.add('drag-over');
        });
        addaudioAudioDropzone.addEventListener('dragleave', () => {
            addaudioAudioDropzone.classList.remove('drag-over');
        });
        addaudioAudioDropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            addaudioAudioDropzone.classList.remove('drag-over');
            if (e.dataTransfer.files && e.dataTransfer.files[0]) handleAddaudioAudioFile(e.dataTransfer.files[0]);
        });
    }

    function handleAddaudioVideoFile(file) {
        if (!file.type.startsWith('video/')) {
            alert('দয়া করে একটি ভিডিও ফাইল নির্বাচন করুন। (Please select a video file.)');
            return;
        }
        addaudioVideoFile = file;
        if (addaudioVideoDropzoneLabel) addaudioVideoDropzoneLabel.innerText = file.name;
        if (addaudioSuccessBox) addaudioSuccessBox.style.display = 'none';
        if (addaudioErrorBox) addaudioErrorBox.style.display = 'none';
        addaudioMaybeShowOptions();
    }

    function handleAddaudioAudioFile(file) {
        if (!file.type.startsWith('audio/')) {
            alert('দয়া করে একটি অডিও ফাইল নির্বাচন করুন। (Please select an audio file.)');
            return;
        }
        addaudioAudioFile = file;
        if (addaudioAudioDropzoneLabel) addaudioAudioDropzoneLabel.innerText = file.name;
        if (addaudioSuccessBox) addaudioSuccessBox.style.display = 'none';
        if (addaudioErrorBox) addaudioErrorBox.style.display = 'none';
        addaudioMaybeShowOptions();
    }

    if (addaudioModeSelect) {
        addaudioModeSelect.addEventListener('change', () => {
            if (addaudioMixVolumes) {
                addaudioMixVolumes.style.display = (addaudioModeSelect.value === 'mix') ? 'block' : 'none';
            }
        });
    }

    if (addaudioVideoVolumeSlider && addaudioVideoVolumeVal) {
        addaudioVideoVolumeSlider.addEventListener('input', () => {
            addaudioVideoVolumeVal.innerText = addaudioVideoVolumeSlider.value + '%';
        });
    }
    if (addaudioAudioVolumeSlider && addaudioAudioVolumeVal) {
        addaudioAudioVolumeSlider.addEventListener('input', () => {
            addaudioAudioVolumeVal.innerText = addaudioAudioVolumeSlider.value + '%';
        });
    }

    // Parses "mm:ss.s" (or plain seconds) into a float seconds value.
    function addaudioParseOffset(str) {
        if (!str) return 0;
        str = str.trim();
        if (str.includes(':')) {
            const parts = str.split(':');
            const mins = parseFloat(parts[0]) || 0;
            const secs = parseFloat(parts[1]) || 0;
            return Math.max(0, mins * 60 + secs);
        }
        const val = parseFloat(str);
        return isNaN(val) ? 0 : Math.max(0, val);
    }

    if (addaudioRunBtn) {
        addaudioRunBtn.addEventListener('click', runAddAudioToVideo);
    }

    async function runAddAudioToVideo() {
        if (!addaudioVideoFile || !addaudioAudioFile) return;

        const mode = addaudioModeSelect ? addaudioModeSelect.value : 'replace';
        const videoVolume = addaudioVideoVolumeSlider ? (parseInt(addaudioVideoVolumeSlider.value, 10) / 100) : 1;
        const audioVolume = addaudioAudioVolumeSlider ? (parseInt(addaudioAudioVolumeSlider.value, 10) / 100) : 1;
        const offsetSec = addaudioParseOffset(addaudioOffsetVal ? addaudioOffsetVal.value : '0');
        const shortest = addaudioShortestToggle ? addaudioShortestToggle.checked : true;

        addaudioRunBtn.disabled = true;
        if (addaudioProgressBox) addaudioProgressBox.style.display = 'block';
        if (addaudioSuccessBox) addaudioSuccessBox.style.display = 'none';
        if (addaudioErrorBox) addaudioErrorBox.style.display = 'none';
        if (addaudioStatusText) addaudioStatusText.innerText = 'সেশন শুরু হচ্ছে... (Starting session...)';

        try {
            // Step 1: init a temp session on the server.
            const initRes = await fetch('/api/add-audio/init', { method: 'POST' });
            const initResult = await initRes.json();
            if (!initRes.ok) throw new Error(initResult.error || `Server error (${initRes.status})`);
            const sessionId = initResult.sessionId;

            // Step 2: upload the video file.
            if (addaudioStatusText) addaudioStatusText.innerText = 'ভিডিও আপলোড হচ্ছে... (Uploading video...)';
            const videoUploadRes = await fetch(`/api/add-audio/upload-video?session=${encodeURIComponent(sessionId)}&filename=${encodeURIComponent(addaudioVideoFile.name)}`, {
                method: 'POST',
                headers: { 'Content-Type': addaudioVideoFile.type || 'application/octet-stream' },
                body: addaudioVideoFile
            });
            const videoUploadResult = await videoUploadRes.json();
            if (!videoUploadRes.ok) throw new Error(videoUploadResult.error || `Server error (${videoUploadRes.status})`);

            // Step 3: upload the audio file.
            if (addaudioStatusText) addaudioStatusText.innerText = 'অডিও আপলোড হচ্ছে... (Uploading audio...)';
            const audioUploadRes = await fetch(`/api/add-audio/upload-audio?session=${encodeURIComponent(sessionId)}&filename=${encodeURIComponent(addaudioAudioFile.name)}`, {
                method: 'POST',
                headers: { 'Content-Type': addaudioAudioFile.type || 'application/octet-stream' },
                body: addaudioAudioFile
            });
            const audioUploadResult = await audioUploadRes.json();
            if (!audioUploadRes.ok) throw new Error(audioUploadResult.error || `Server error (${audioUploadRes.status})`);

            // Step 4: compile with ffmpeg on the server.
            if (addaudioStatusText) addaudioStatusText.innerText = 'ভিডিওতে অডিও যোগ করা হচ্ছে... (Adding audio to video...)';
            const compileRes = await fetch(`/api/add-audio/compile?session=${encodeURIComponent(sessionId)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode,
                    videoVolume,
                    audioVolume,
                    offsetSec,
                    shortest,
                    filename: addaudioVideoFile.name
                })
            });
            const compileResult = await compileRes.json();
            if (!compileRes.ok) throw new Error(compileResult.error || `Server error (${compileRes.status})`);

            if (addaudioDownloadLink) {
                addaudioDownloadLink.href = compileResult.downloadUrl;
                addaudioDownloadLink.download = compileResult.filename;
            }
            if (addaudioSuccessDesc) {
                addaudioSuccessDesc.innerText = `"${compileResult.filename}" প্রস্তুত।`;
            }
            if (addaudioProgressBox) addaudioProgressBox.style.display = 'none';
            if (addaudioSuccessBox) addaudioSuccessBox.style.display = 'block';
        } catch (err) {
            console.error('Add-audio failed:', err);
            if (addaudioProgressBox) addaudioProgressBox.style.display = 'none';
            if (addaudioErrorBox) addaudioErrorBox.style.display = 'block';
            if (addaudioErrorDesc) {
                addaudioErrorDesc.innerText = `অডিও যোগ করা যায়নি: ${err.message}। সার্ভার (node server.js) চালু আছে কিনা দেখুন।`;
            }
        } finally {
            addaudioRunBtn.disabled = false;
        }
    }
});
