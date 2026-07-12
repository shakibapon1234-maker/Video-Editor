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
    async function waitForSeek(video, targetTime, maxWaitMs = 4000, tolerance = 0.01) {
        const seekStart = performance.now();
        video.currentTime = targetTime;
        while (Math.abs(video.currentTime - targetTime) > tolerance) {
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
                setTimeout(resolveSeek, 50);
            });
            if (Math.abs(video.currentTime - targetTime) > tolerance) {
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

    async function runExportPipeline(totalDuration, isBatch = false, batchFilename = '', batchIndex = 0, batchCount = 0) {
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

        // Establish WebSocket connection to the local render server
        renderStatusText.innerText = 'সার্ভারের সাথে কানেক্ট করা হচ্ছে... (Connecting to render server...)';
        setProgress(2);

        const wsUrl = `ws://${window.location.hostname || 'localhost'}:4000`;
        const ws = new WebSocket(wsUrl);

        try {
            await new Promise((resolve, reject) => {
                ws.onopen = resolve;
                ws.onerror = () => reject(new Error('Render server connection failed. Please run start-video-editor.bat.'));
            });
        } catch (err) {
            throw err;
        }

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
        }

        // --- Step A: Offline Audio Rendering ---
        renderStatusText.innerText = 'অডিও মিক্স করা হচ্ছে... (Mixing audio offline...)';
        setProgress(5);

        const introDur = state.introEnabled ? Math.max(0.3, parseFloat(state.introDuration) || 3) : 0;
        const outroDur = state.outroEnabled ? Math.max(0.3, parseFloat(state.outroDuration) || 3) : 0;
        const grandTotalDuration = introDur + totalDuration + outroDur;
        const grandTotalFrames = Math.ceil(grandTotalDuration * 30);

        let audioBlob = null;
        if (window.renderAudioOffline) {
            try {
                const audioBuffer = await window.renderAudioOffline(grandTotalDuration);
                if (audioBuffer) {
                    audioBlob = v2aAudioBufferToWavBlob(audioBuffer);
                }
            } catch (err) {
                console.error('Offline audio rendering failed:', err);
            }
        }

        if (exportCancelled) { ws.close(); await finishCancelled(); return; }

        // --- Step B: Initialize WebSocket Session ---
        let filename;
        if (isBatch && batchFilename) {
            const baseName = batchFilename.substring(0, batchFilename.lastIndexOf('.')) || batchFilename;
            filename = `${baseName}_edited.mp4`;
        } else {
            const timestamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
            filename = `facebook-video-${timestamp}.mp4`;
        }

        ws.send(JSON.stringify({
            type: 'init',
            totalFrames: grandTotalFrames,
            filename: filename
        }));

        await new Promise((resolve) => {
            const onMsg = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'init_ok') {
                    ws.removeEventListener('message', onMsg);
                    resolve();
                }
            };
            ws.addEventListener('message', onMsg);
        });

        // Send audio file if we rendered one
        if (audioBlob && !exportCancelled) {
            ws.send(JSON.stringify({ type: 'audio_start' }));
            await new Promise((resolve) => {
                const onMsg = (event) => {
                    const data = JSON.parse(event.data);
                    if (data.type === 'audio_ready') {
                        ws.removeEventListener('message', onMsg);
                        resolve();
                    }
                };
                ws.addEventListener('message', onMsg);
            });
            ws.send(audioBlob);
            await new Promise((resolve) => {
                const onMsg = (event) => {
                    const data = JSON.parse(event.data);
                    if (data.type === 'audio_ok') {
                        ws.removeEventListener('message', onMsg);
                        resolve();
                    }
                };
                ws.addEventListener('message', onMsg);
            });
        }

        if (exportCancelled) { ws.close(); await finishCancelled(); return; }

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

                const frameBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
                ws.send(frameBlob);

                frameIndex++;
                const uiProgress = 10 + Math.round((frameIndex / grandTotalFrames) * 80);
                setProgress(uiProgress);
                renderStatusText.innerText = `ইন্ট্রো ফ্রেম প্রসেস হচ্ছে... (Intro: ${f + 1}/${introFrames})`;
            }
        }

        // C2. Render Clips using requestVideoFrameCallback play/pause sequential capture
        async function captureVideoClipSequential(clip, clipTrimStart, clipTrimEnd, clipFrames, clipIndex) {
            await waitForSeek(video, clipTrimStart);
            
            let clipFrameIndex = 0;
            video.playbackRate = 0.25; // Play slower to give plenty of time for capturing/sending

            return new Promise((resolve) => {
                async function onFrame(now, metadata) {
                    if (exportCancelled || clipFrameIndex >= clipFrames) {
                        video.pause();
                        resolve();
                        return;
                    }

                    const targetTime = clipTrimStart + (clipFrameIndex / 30);
                    
                    if (video.currentTime >= targetTime - 0.015) {
                        video.pause(); // Pause immediately to hold the frame

                        if (window.drawEditorFrame) {
                            window.drawEditorFrame();
                        }

                        const frameBlob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.95));
                        ws.send(frameBlob);

                        clipFrameIndex++;
                        frameIndex++;

                        const elapsed = video.currentTime - clipTrimStart;
                        const totalElapsed = elapsedBeforeCurrentClip + elapsed;
                        const progressPercent = grandTotalDuration > 0 ? Math.min(100, (totalElapsed / grandTotalDuration) * 100) : 100;
                        const uiProgress = 10 + Math.round(progressPercent * 0.8);
                        setProgress(uiProgress);
                        
                        if (isBatch) {
                            renderStatusText.innerText = `[Batch ${batchIndex}/${batchCount}] rendering ${batchFilename}... ${Math.round((frameIndex / grandTotalFrames) * 100)}%`;
                        } else {
                            renderStatusText.innerText = `ক্লিপ ${clipIndex + 1}/${state.clips.length} প্রসেস হচ্ছে... (ফ্রেম: ${clipFrameIndex}/${clipFrames})`;
                        }

                        if (clipFrameIndex >= clipFrames || video.currentTime >= clipTrimEnd) {
                            resolve();
                            return;
                        }
                    }

                    // Request next frame and play to advance
                    video.requestVideoFrameCallback(onFrame);
                    video.play().catch(err => { /* ignore */ });
                }

                // Initial play triggers the loop
                video.requestVideoFrameCallback(onFrame);
                video.play().catch(err => { /* ignore */ });
            });
        }

        let elapsedBeforeCurrentClip = 0;
        for (let clipIndex = 0; clipIndex < state.clips.length; clipIndex++) {
            if (exportCancelled) break;
            const clip = state.clips[clipIndex];
            const clipTrimStart = clip.start;
            const clipTrimEnd = clip.end;
            const clipTrimDuration = Math.max(0, clipTrimEnd - clipTrimStart);
            if (clipTrimDuration <= 0) continue;

            // Load clip
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

            state.cropX = clip.cropX || 0;
            state.cropY = clip.cropY || 0;
            state.cropW = (clip.cropW !== undefined) ? clip.cropW : 1;
            state.cropH = (clip.cropH !== undefined) ? clip.cropH : 1;

            const clipFrames = Math.ceil(clipTrimDuration * 30);
            
            if (clip.type === 'image') {
                for (let f = 0; f < clipFrames; f++) {
                    if (exportCancelled) break;

                    const elapsedSecInClip = f / 30;
                    const targetTime = clipTrimStart + elapsedSecInClip;
                    state.currentTime = targetTime;

                    if (window.drawEditorFrame) {
                        window.drawEditorFrame();
                    }

                    const frameBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
                    ws.send(frameBlob);

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
            
            elapsedBeforeCurrentClip += clipTrimDuration;
        }

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

                const frameBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
                ws.send(frameBlob);

                frameIndex++;
                const uiProgress = 10 + Math.round((frameIndex / grandTotalFrames) * 80);
                setProgress(uiProgress);
                renderStatusText.innerText = `আউটরো ফ্রেম প্রসেস হচ্ছে... (Outro: ${f + 1}/${outroFrames})`;
            }
        }

        if (exportCancelled) { ws.close(); await finishCancelled(); return; }

        // --- Step D: Server Compilation ---
        renderStatusText.innerText = 'সার্ভারে ভিডিও তৈরি হচ্ছে... (Compiling video on server...)';
        setProgress(90);

        ws.send(JSON.stringify({ type: 'compile' }));

        const compileResult = await new Promise((resolve, reject) => {
            const onMsg = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'progress' && data.step === 'compiling') {
                    const percent = 90 + Math.round(data.current * 0.08); // 90% to 98%
                    setProgress(percent);
                }
                else if (data.type === 'complete') {
                    ws.removeEventListener('message', onMsg);
                    resolve(data);
                }
                else if (data.type === 'error') {
                    ws.removeEventListener('message', onMsg);
                    reject(new Error(data.message));
                }
            };
            ws.addEventListener('message', onMsg);
        });

        // Restore editor settings
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
        state.cropW = (originalCropW !== undefined) ? originalCropW : 1;
        state.cropH = (originalCropH !== undefined) ? originalCropH : 1;
        video.currentTime = state.startTime;
        video.playbackRate = 1.0; // Restore standard playback speed
        if (!window.setSpeakerMuted || !window.setSpeakerMuted(false)) {
            video.volume = Math.min(1.0, state.videoVolume);
        }
        if (window.drawEditorFrame) window.drawEditorFrame();

        // Finalize Download
        setProgress(98);
        renderStatusText.innerText = 'ডাউনলোড প্রস্তুত করা হচ্ছে... (Preparing download...)';

        const downloadURL = compileResult.downloadUrl;
        const finalFilename = compileResult.filename;

        downloadLink.href = downloadURL;
        downloadLink.download = finalFilename;

        if (isBatch) {
            downloadLink.click();
            setProgress(100);
            renderStatusText.innerText = `Saved ${finalFilename}! Proceeding...`;
            await new Promise(resolve => setTimeout(resolve, 1000));
            ws.close();
            return;
        }

        ws.close();

        setProgress(100);
        renderStatusText.innerText = 'সম্পন্ন! (Complete!)';

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

        isBatchRenderRunning = true;
        exportCancelled = false;
        exportStartTimestamp = performance.now();
        
        if (cancelRenderBtn) cancelRenderBtn.disabled = false;
        renderBtn.disabled = true;
        batchRenderBtn.disabled = true;
        if (qualitySelect) qualitySelect.disabled = true;
        
        renderProgressBox.style.display = 'block';
        renderSuccessBox.style.display = 'none';
        
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
});
