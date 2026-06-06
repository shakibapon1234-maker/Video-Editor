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

    renderBtn.addEventListener('click', startExport);

    async function startExport() {
        if (!state.duration) {
            alert('Please load a video first before exporting.');
            return;
        }

        const trimDuration = state.endTime - state.startTime;

        if (trimDuration <= 0) {
            alert('Trim duration is invalid. Please set the trim range in Step 2.');
            return;
        }

        // Show progress box
        renderBtn.disabled = true;
        renderBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Rendering...';
        renderProgressBox.style.display = 'block';
        renderSuccessBox.style.display = 'none';
        renderStatusText.innerText = 'Setting up render pipeline...';
        setProgress(0);

        try {
            await runExportPipeline(trimDuration);
        } catch (err) {
            console.error('Export failed:', err);
            alert('Export failed. Please try again with a shorter or simpler video.');
            renderBtn.disabled = false;
            renderBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Render & Export Video';
        }
    }

    async function runExportPipeline(trimDuration) {
        const canvas = state.canvas;
        const video = state.video;

        // --- Step A: Set up canvas capture stream ---
        renderStatusText.innerText = 'Capturing canvas stream...';
        setProgress(5);

        // Capture canvas at 30fps
        const canvasStream = canvas.captureStream(30);

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
            videoBitsPerSecond: 8_000_000 // 8 Mbps for good quality
        });

        const chunks = [];
        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                chunks.push(e.data);
            }
        };

        recorder.start(100); // Collect data every 100ms

        // --- Step D: Play video through the trim range while recording ---
        renderStatusText.innerText = 'Rendering video frames...';
        setProgress(20);

        video.currentTime = state.startTime;
        video.volume = 0; // Mute speaker output during export (audio goes to MediaRecorder only)

        // Start voiceover buffer source in the audio context (synchronized with video)
        if (audioMixResult && audioMixResult.startVoiceover) {
            await audioMixResult.startVoiceover();
        }

        await video.play();

        // Render loop — drives the canvas frame drawing and tracks progress
        await new Promise((resolve, reject) => {
            let lastRenderTime = performance.now();

            function renderLoop() {
                const currentTime = video.currentTime;
                const elapsed = currentTime - state.startTime;
                const progressPercent = Math.min(100, (elapsed / trimDuration) * 100);

                // Draw current frame with logo overlay
                if (window.drawEditorFrame) {
                    window.drawEditorFrame();
                }

                // Update progress bar (maps video progress from 20% to 95%)
                const uiProgress = 20 + (progressPercent * 0.75);
                setProgress(Math.round(uiProgress));
                renderStatusText.innerText = `Rendering ${Math.round(progressPercent)}% of video...`;

                // Check if we've reached the trim end
                if (currentTime >= state.endTime || video.ended) {
                    video.pause();
                    resolve();
                    return;
                }

                requestAnimationFrame(renderLoop);
            }

            requestAnimationFrame(renderLoop);

            // Safety timeout (max 10 minutes)
            setTimeout(() => {
                if (!video.paused) {
                    video.pause();
                    resolve();
                }
            }, 600_000);
        });

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

        // Restore video volume for normal playback
        video.volume = Math.min(1.0, state.videoVolume);

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
            renderBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Render Again';
        }, 500);
    }

    function setProgress(percent) {
        renderProgressFill.style.width = percent + '%';
        renderPercentage.innerText = percent + '%';
    }
});
