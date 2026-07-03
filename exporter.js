// Video Exporter Engine — Renders Canvas + Mixed Audio into downloadable file
document.addEventListener('DOMContentLoaded', () => {
    const state = window.VideoEditor;

    const renderBtn = document.getElementById('render-btn');
    const renderProgressBox = document.getElementById('render-progress-box');
    const renderProgressFill = document.getElementById('render-progress-fill');
    const renderPercentage = document.getElementById('render-percentage');
    const renderStatusText = document.getElementById('render-status-text');
    const renderSuccessBox = document.getElementById('render-success-box');
    const downloadLink = document.getElementById('download-link');
    const qualitySelect = document.getElementById('quality-select');

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
        renderBtn.disabled = true;
        if (qualitySelect) qualitySelect.disabled = true;
        renderBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Rendering...';
        renderProgressBox.style.display = 'block';
        renderSuccessBox.style.display = 'none';
        renderStatusText.innerText = 'Setting up render pipeline...';
        setProgress(0);

        try {
            await runExportPipeline(totalDuration);
        } catch (err) {
            console.error('Export failed:', err);
            alert('Export failed. Please try again with a shorter or simpler video.');
            renderBtn.disabled = false;
            if (qualitySelect) qualitySelect.disabled = false;
            renderBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Render & Export Video';
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

        // --- Step D: Play through every clip sequentially while recording ---
        renderStatusText.innerText = 'Rendering video frames...';
        setProgress(20);

        let elapsedBeforeCurrentClip = 0;
        let voiceoverStarted = false;

        for (let clipIndex = 0; clipIndex < state.clips.length; clipIndex++) {
            const clip = state.clips[clipIndex];
            const clipTrimStart = clip.start;
            const clipTrimEnd = clip.end;
            const clipTrimDuration = Math.max(0, clipTrimEnd - clipTrimStart);
            if (clipTrimDuration <= 0) continue;

            // Load this clip into the shared video element if it isn't already active
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

            video.currentTime = clipTrimStart;
            if (!window.setSpeakerMuted || !window.setSpeakerMuted(true)) {
                video.volume = 0;
            }
            await video.play();

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

            await new Promise((resolve) => {
                function renderLoop() {
                    const currentTime = video.currentTime;
                    const elapsedInClip = currentTime - clipTrimStart;
                    const totalElapsed = clipElapsedBase + elapsedInClip;
                    const progressPercent = Math.min(100, (totalElapsed / totalDuration) * 100);

                    if (window.drawEditorFrame) {
                        window.drawEditorFrame();
                    }

                    const uiProgress = 20 + (progressPercent * 0.75);
                    setProgress(Math.round(uiProgress));
                    renderStatusText.innerText = `Rendering clip ${clipIndex + 1}/${state.clips.length}... ${Math.round(progressPercent)}%`;

                    if (currentTime >= clipTrimEnd || video.ended) {
                        video.pause();
                        resolve();
                        return;
                    }

                    requestAnimationFrame(renderLoop);
                }

                requestAnimationFrame(renderLoop);

                // Safety timeout per-clip (max 10 minutes per clip)
                setTimeout(() => {
                    if (!video.paused) {
                        video.pause();
                        resolve();
                    }
                }, 600_000);
            });

            elapsedBeforeCurrentClip += clipTrimDuration;
        }

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
    }
});
