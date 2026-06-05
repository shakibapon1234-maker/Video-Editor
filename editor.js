// Global Video Editor State
window.VideoEditor = {
    // Elements
    video: document.getElementById('hidden-video'),
    canvas: document.getElementById('editor-canvas'),
    ctx: null,
    
    // Video metadata
    duration: 0,
    startTime: 0,
    endTime: 0,
    aspectRatio: 'original',
    isPlaying: false,
    
    // Logo state (coordinates normalized between 0 and 1)
    logoImg: null,
    logoX: 0.8, // default position top-right
    logoY: 0.1,
    logoSize: 15, // percent of canvas width
    logoOpacity: 1.0,
    
    // Logo interaction
    isDraggingLogo: false,
    isResizingLogo: false,
    dragOffsetX: 0,
    dragOffsetY: 0,
    resizeStartSize: 15,
    resizeStartX: 0,
    
    // Volume & Audio state
    videoVolume: 1.0,
    voiceoverVolume: 1.0,
    voiceoverBlob: null,
    voiceoverUrl: null,
    voiceoverRecorded: false,
    isNoiseCancelActive: false,
    noiseGateThreshold: -50,
    
    // Navigation Step
    currentStep: 1
};

// Initialize Canvas
window.VideoEditor.ctx = window.VideoEditor.canvas.getContext('2d');

document.addEventListener('DOMContentLoaded', () => {
    const state = window.VideoEditor;
    
    // UI Selectors
    const videoInput = document.getElementById('video-input');
    const logoInput = document.getElementById('logo-input');
    const videoDropzone = document.getElementById('video-dropzone');
    const logoDropzone = document.getElementById('logo-dropzone');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const trimStart = document.getElementById('trim-start');
    const trimEnd = document.getElementById('trim-end');
    const startVal = document.getElementById('start-time-val');
    const endVal = document.getElementById('end-time-val');
    const playhead = document.getElementById('playhead-indicator');
    const trimFill = document.getElementById('trim-fill');
    
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    
    const logoPreviewBox = document.getElementById('logo-preview-box');
    const logoImgPreview = document.getElementById('logo-img-preview');
    const logoFilename = document.getElementById('logo-filename');
    const removeLogoBtn = document.getElementById('remove-logo-btn');
    const logoControlCard = document.getElementById('logo-control-card');
    
    const logoSizeSlider = document.getElementById('logo-size-slider');
    const logoSizeVal = document.getElementById('logo-size-val');
    const logoOpacitySlider = document.getElementById('logo-opacity-slider');
    const logoOpacityVal = document.getElementById('logo-opacity-val');
    
    const videoVolumeSlider = document.getElementById('video-volume-slider');
    const videoVolumeVal = document.getElementById('video-volume-val');
    
    // --- Step Navigation System ---
    function updateNavigation() {
        // Toggle step buttons in sidebar
        for (let i = 1; i <= 4; i++) {
            const btn = document.getElementById(`step-btn-${i}`);
            const panel = document.getElementById(`panel-${i}`);
            if (i === state.currentStep) {
                btn.classList.add('active');
                panel.classList.add('active');
            } else {
                btn.classList.remove('active');
                panel.classList.remove('active');
            }
        }
        
        // Update Title & Subtitle
        const titles = {
            1: ["Media Import", "Start by uploading your video clip and branding logo"],
            2: ["Trim & Layout", "Cut video duration and adjust the canvas format"],
            3: ["Audio & Voice", "Enhance audio quality and record background voiceover"],
            4: ["Export Studio", "Render and download your final video for Facebook"]
        };
        
        document.getElementById('current-step-title').innerText = titles[state.currentStep][0];
        document.getElementById('current-step-subtitle').innerText = titles[state.currentStep][1];
        
        // Button states
        prevBtn.disabled = (state.currentStep === 1);
        
        // Disable next unless video is loaded
        if (state.currentStep === 1 && !state.duration) {
            nextBtn.disabled = true;
        } else {
            nextBtn.disabled = (state.currentStep === 4);
        }
    }
    
    // Wire Step events
    prevBtn.addEventListener('click', () => {
        if (state.currentStep > 1) {
            state.currentStep--;
            updateNavigation();
        }
    });
    
    nextBtn.addEventListener('click', () => {
        if (state.currentStep < 4) {
            state.currentStep++;
            updateNavigation();
        }
    });
    
    for (let i = 1; i <= 4; i++) {
        document.getElementById(`step-btn-${i}`).addEventListener('click', () => {
            if (state.duration || i === 1) {
                state.currentStep = i;
                updateNavigation();
            }
        });
    }
    
    // --- Video Source Loading ---
    function handleVideoFile(file) {
        if (!file) return;
        
        // Show loading state
        const originalText = videoDropzone.querySelector('h3').innerText;
        videoDropzone.querySelector('h3').innerText = "Loading Video File...";
        
        const fileURL = URL.createObjectURL(file);
        state.video.src = fileURL;
        state.video.load();
        
        state.video.onloadedmetadata = () => {
            state.duration = state.video.duration;
            state.startTime = 0;
            state.endTime = state.duration;
            
            // Configure Sliders
            trimStart.max = state.duration;
            trimStart.value = 0;
            trimEnd.max = state.duration;
            trimEnd.value = state.duration;
            
            // Format slider text values
            startVal.value = formatTime(0);
            endVal.value = formatTime(state.duration);
            
            // Setup canvas size based on video
            updateCanvasDimensions();
            
            // Show timeline controls
            document.getElementById('timeline-controls').style.display = 'flex';
            document.querySelector('.canvas-overlay-controls').style.display = 'block';
            videoDropzone.style.display = 'none';
            
            // Update UI
            document.getElementById('selected-video-name').innerText = file.name;
            nextBtn.disabled = false;
            updateNavigation();
            
            // Initialize Web Audio source node (inside audio.js)
            if (window.initializeAudioSource) {
                window.initializeAudioSource();
            }
            
            // Render first frame
            state.video.currentTime = 0;
            updatePlayhead();
            drawFrame();
        };
    }
    
    // Dropzone logic
    videoDropzone.addEventListener('click', () => videoInput.click());
    document.getElementById('select-video-trigger').addEventListener('click', () => videoInput.click());
    
    videoInput.addEventListener('change', (e) => {
        handleVideoFile(e.target.files[0]);
    });
    
    videoDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        videoDropzone.classList.add('hover');
    });
    
    videoDropzone.addEventListener('dragleave', () => {
        videoDropzone.classList.remove('hover');
    });
    
    videoDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        videoDropzone.classList.remove('hover');
        handleVideoFile(e.dataTransfer.files[0]);
    });
    
    // --- Logo Watermark Loading ---
    function handleLogoFile(file) {
        if (!file) return;
        
        const fileURL = URL.createObjectURL(file);
        const img = new Image();
        img.src = fileURL;
        img.onload = () => {
            state.logoImg = img;
            
            // Show settings & preview
            logoPreviewBox.style.display = 'flex';
            logoFilename.innerText = file.name;
            logoDropzone.style.display = 'none';
            logoControlCard.style.display = 'block';
            
            // Set initial logo sizing based on aspect ratio
            state.logoX = 0.8; // top right
            state.logoY = 0.1;
            
            drawFrame();
        };
    }
    
    logoDropzone.addEventListener('click', () => logoInput.click());
    logoInput.addEventListener('change', (e) => {
        handleLogoFile(e.target.files[0]);
    });
    
    removeLogoBtn.addEventListener('click', () => {
        state.logoImg = null;
        logoPreviewBox.style.display = 'none';
        logoDropzone.style.display = 'flex';
        logoControlCard.style.display = 'none';
        logoInput.value = '';
        drawFrame();
    });
    
    // Logo styling controls
    logoSizeSlider.addEventListener('input', (e) => {
        state.logoSize = parseInt(e.target.value);
        logoSizeVal.innerText = state.logoSize + '%';
        drawFrame();
    });
    
    logoOpacitySlider.addEventListener('input', (e) => {
        state.logoOpacity = parseInt(e.target.value) / 100;
        logoOpacityVal.innerText = e.target.value + '%';
        drawFrame();
    });
    
    // --- Canvas Dimensions & Aspect Ratios ---
    const aspectButtons = document.querySelectorAll('.aspect-btn');
    aspectButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            aspectButtons.forEach(b => b.classList.remove('active'));
            const targetBtn = e.currentTarget;
            targetBtn.classList.add('active');
            state.aspectRatio = targetBtn.dataset.ratio;
            updateCanvasDimensions();
            drawFrame();
        });
    });
    
    function updateCanvasDimensions() {
        if (!state.duration) return;
        
        const videoWidth = state.video.videoWidth;
        const videoHeight = state.video.videoHeight;
        
        let targetWidth = 640;
        let targetHeight = 480;
        
        switch (state.aspectRatio) {
            case 'original':
                targetWidth = videoWidth;
                targetHeight = videoHeight;
                break;
            case '1-1':
                // Square
                targetWidth = Math.max(videoWidth, videoHeight);
                targetHeight = targetWidth;
                break;
            case '9-16':
                // Reels Vertical
                targetHeight = Math.max(videoWidth, videoHeight);
                targetWidth = (targetHeight * 9) / 16;
                break;
            case '16-9':
                // Landscape
                targetWidth = Math.max(videoWidth, videoHeight);
                targetHeight = (targetWidth * 9) / 16;
                break;
        }
        
        // Cap canvas render resolution inside standard boundaries for performance
        const maxBoundary = 1080;
        if (targetWidth > maxBoundary || targetHeight > maxBoundary) {
            const ratio = targetWidth / targetHeight;
            if (targetWidth > targetHeight) {
                targetWidth = maxBoundary;
                targetHeight = maxBoundary / ratio;
            } else {
                targetHeight = maxBoundary;
                targetWidth = maxBoundary * ratio;
            }
        }
        
        state.canvas.width = targetWidth;
        state.canvas.height = targetHeight;
        
        // Update container height dynamically to respect aspect ratio in CSS
        const container = document.getElementById('canvas-container');
        const containerWidth = container.clientWidth;
        container.style.height = (containerWidth * (targetHeight / targetWidth)) + 'px';
    }
    
    // --- Timeline Playing & Trimming ---
    playPauseBtn.addEventListener('click', () => {
        if (state.isPlaying) {
            pauseVideo();
        } else {
            playVideo();
        }
    });
    
    function playVideo() {
        if (!state.duration) return;
        
        // If playhead is outside the trimmed region, loop it
        if (state.video.currentTime >= state.endTime || state.video.currentTime < state.startTime) {
            state.video.currentTime = state.startTime;
        }
        
        state.video.play();
        state.isPlaying = true;
        playPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
        
        // Start playback event listeners for voiceover sync
        if (window.onPlaybackStart) {
            window.onPlaybackStart();
        }
        
        requestAnimationFrame(updateLoop);
    }
    
    function pauseVideo() {
        state.video.pause();
        state.isPlaying = false;
        playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        
        if (window.onPlaybackStop) {
            window.onPlaybackStop();
        }
    }
    
    function updateLoop() {
        if (!state.isPlaying) return;
        
        // Loop back if reached trim end
        if (state.video.currentTime >= state.endTime) {
            if (window.isRecordingVoiceover) {
                // If recording voiceover, stop both recording and playback when reaching trim end
                pauseVideo();
            } else {
                state.video.currentTime = state.startTime;
            }
        }
        
        updatePlayhead();
        drawFrame();
        
        requestAnimationFrame(updateLoop);
    }
    
    // Update playhead UI position
    function updatePlayhead() {
        const current = state.video.currentTime;
        const total = state.duration;
        
        document.getElementById('canvas-time-display').innerText = `${formatTime(current)} / ${formatTime(total)}`;
        
        const percent = (current / total) * 100;
        playhead.style.left = percent + '%';
        
        // Highlight active trim region
        const startPercent = (state.startTime / total) * 100;
        const endPercent = (state.endTime / total) * 100;
        trimFill.style.left = startPercent + '%';
        trimFill.style.width = (endPercent - startPercent) + '%';
    }
    
    // Trim Slider Interaction
    trimStart.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (val >= state.endTime) {
            trimStart.value = state.endTime - 0.1;
            state.startTime = state.endTime - 0.1;
        } else {
            state.startTime = val;
        }
        startVal.value = formatTime(state.startTime);
        state.video.currentTime = state.startTime;
        updatePlayhead();
        drawFrame();
    });
    
    trimEnd.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (val <= state.startTime) {
            trimEnd.value = state.startTime + 0.1;
            state.endTime = state.startTime + 0.1;
        } else {
            state.endTime = val;
        }
        endVal.value = formatTime(state.endTime);
        state.video.currentTime = state.endTime;
        updatePlayhead();
        drawFrame();
    });
    
    // Video volume mix slider
    videoVolumeSlider.addEventListener('input', (e) => {
        state.videoVolume = parseInt(e.target.value) / 100;
        videoVolumeVal.innerText = e.target.value + '%';
        
        // Apply to video element directly
        if (window.videoGainNode) {
            window.videoGainNode.gain.setValueAtTime(state.videoVolume, 0);
        } else {
            state.video.volume = Math.min(1.0, state.videoVolume);
        }
    });

    // Handle Manual Typing of Trim fields
    startVal.addEventListener('change', () => {
        const sec = parseTimeString(startVal.value);
        if (!isNaN(sec) && sec >= 0 && sec < state.endTime) {
            state.startTime = sec;
            trimStart.value = sec;
            state.video.currentTime = sec;
            updatePlayhead();
            drawFrame();
        } else {
            startVal.value = formatTime(state.startTime);
        }
    });

    endVal.addEventListener('change', () => {
        const sec = parseTimeString(endVal.value);
        if (!isNaN(sec) && sec > state.startTime && sec <= state.duration) {
            state.endTime = sec;
            trimEnd.value = sec;
            state.video.currentTime = sec;
            updatePlayhead();
            drawFrame();
        } else {
            endVal.value = formatTime(state.endTime);
        }
    });
    
    // Resize Listener to keep canvas container aspect ratio aligned
    window.addEventListener('resize', () => {
        if (state.duration) {
            updateCanvasDimensions();
            drawFrame();
        }
    });

    // --- Drawing the Canvas frame ---
    function drawFrame() {
        if (!state.duration) return;
        
        const canvasW = state.canvas.width;
        const canvasH = state.canvas.height;
        const videoW = state.video.videoWidth;
        const videoH = state.video.videoHeight;
        
        // Clear Canvas with black
        state.ctx.fillStyle = '#000000';
        state.ctx.fillRect(0, 0, canvasW, canvasH);
        
        // Draw Centered contained video frame
        const videoAspect = videoW / videoH;
        const canvasAspect = canvasW / canvasH;
        
        let drawW = canvasW;
        let drawH = canvasH;
        let drawX = 0;
        let drawY = 0;
        
        if (videoAspect > canvasAspect) {
            // Video wider than canvas container (bars top and bottom)
            drawH = canvasW / videoAspect;
            drawY = (canvasH - drawH) / 2;
        } else if (videoAspect < canvasAspect) {
            // Video taller than canvas container (bars left and right)
            drawW = canvasH * videoAspect;
            drawX = (canvasW - drawW) / 2;
        }
        
        // Draw current video frame
        state.ctx.drawImage(state.video, drawX, drawY, drawW, drawH);
        
        // Draw Watermark Logo
        if (state.logoImg) {
            const logoW = canvasW * (state.logoSize / 100);
            const logoH = logoW * (state.logoImg.naturalHeight / state.logoImg.naturalWidth);
            
            // Convert normalized coordinates to absolute canvas pixels
            const x = state.logoX * (canvasW - logoW);
            const y = state.logoY * (canvasH - logoH);
            
            state.ctx.save();
            state.ctx.globalAlpha = state.logoOpacity;
            state.ctx.drawImage(state.logoImg, x, y, logoW, logoH);
            
            // Draw visual resizing handle / bounding outline in setup step 2
            if (state.currentStep === 2) {
                state.ctx.strokeStyle = 'rgba(79, 70, 229, 0.8)';
                state.ctx.lineWidth = 2;
                state.ctx.strokeRect(x, y, logoW, logoH);
                
                // Draw bottom right resize anchor handle
                state.ctx.fillStyle = '#ffffff';
                state.ctx.fillRect(x + logoW - 6, y + logoH - 6, 12, 12);
                state.ctx.strokeStyle = '#4f46e5';
                state.ctx.strokeRect(x + logoW - 6, y + logoH - 6, 12, 12);
            }
            state.ctx.restore();
        }
    }
    
    // --- Mouse Drag and Resize Interactive System on Canvas ---
    function getCanvasCoords(e) {
        const rect = state.canvas.getBoundingClientRect();
        const scaleX = state.canvas.width / rect.width;
        const scaleY = state.canvas.height / rect.height;
        
        // Handle touch events
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }
    
    function isPointerOnLogo(coords) {
        if (!state.logoImg) return { isOver: false, isResize: false };
        
        const canvasW = state.canvas.width;
        const canvasH = state.canvas.height;
        const logoW = canvasW * (state.logoSize / 100);
        const logoH = logoW * (state.logoImg.naturalHeight / state.logoImg.naturalWidth);
        const lx = state.logoX * (canvasW - logoW);
        const ly = state.logoY * (canvasH - logoH);
        
        // Check resize anchor box (bottom-right: 15px pad)
        const inResizeAnchor = (
            coords.x >= lx + logoW - 12 && coords.x <= lx + logoW + 12 &&
            coords.y >= ly + logoH - 12 && coords.y <= ly + logoH + 12
        );
        
        // Check core image box
        const inLogo = (
            coords.x >= lx && coords.x <= lx + logoW &&
            coords.y >= ly && coords.y <= ly + logoH
        );
        
        return {
            isOver: inLogo,
            isResize: inResizeAnchor
        };
    }
    
    function handlePointerDown(e) {
        if (!state.logoImg || state.currentStep !== 2) return;
        
        const coords = getCanvasCoords(e);
        const check = isPointerOnLogo(coords);
        
        const canvasW = state.canvas.width;
        const canvasH = state.canvas.height;
        const logoW = canvasW * (state.logoSize / 100);
        const logoH = logoW * (state.logoImg.naturalHeight / state.logoImg.naturalWidth);
        const lx = state.logoX * (canvasW - logoW);
        const ly = state.logoY * (canvasH - logoH);
        
        if (check.isResize) {
            state.isResizingLogo = true;
            state.resizeStartSize = state.logoSize;
            state.resizeStartX = coords.x;
            e.preventDefault();
        } else if (check.isOver) {
            state.isDraggingLogo = true;
            state.dragOffsetX = coords.x - lx;
            state.dragOffsetY = coords.y - ly;
            e.preventDefault();
        }
    }
    
    function handlePointerMove(e) {
        if (!state.logoImg || state.currentStep !== 2) return;
        
        const coords = getCanvasCoords(e);
        
        // Update mouse cursor style in edit step
        if (!state.isDraggingLogo && !state.isResizingLogo) {
            const check = isPointerOnLogo(coords);
            if (check.isResize) {
                state.canvas.style.cursor = 'nwse-resize';
            } else if (check.isOver) {
                state.canvas.style.cursor = 'move';
            } else {
                state.canvas.style.cursor = 'default';
            }
            return;
        }
        
        const canvasW = state.canvas.width;
        const canvasH = state.canvas.height;
        
        if (state.isDraggingLogo) {
            const logoW = canvasW * (state.logoSize / 100);
            const logoH = logoW * (state.logoImg.naturalHeight / state.logoImg.naturalWidth);
            
            // Calculate raw absolute pixel target positions
            let newLx = coords.x - state.dragOffsetX;
            let newLy = coords.y - state.dragOffsetY;
            
            // Clamp inside canvas bounds
            newLx = Math.max(0, Math.min(canvasW - logoW, newLx));
            newLy = Math.max(0, Math.min(canvasH - logoH, newLy));
            
            // Convert back to normalized coordinates (0 to 1)
            state.logoX = newLx / (canvasW - logoW);
            state.logoY = newLy / (canvasH - logoH);
            
            drawFrame();
        } else if (state.isResizingLogo) {
            const deltaX = coords.x - state.resizeStartX;
            
            // Map pixel delta to scale percentage change
            const scaleFactor = (deltaX / canvasW) * 100;
            let newSize = state.resizeStartSize + scaleFactor;
            
            // Clamp sizing scale between 5% and 50%
            newSize = Math.max(5, Math.min(50, newSize));
            state.logoSize = newSize;
            
            // Update slider UI
            logoSizeSlider.value = Math.round(newSize);
            logoSizeVal.innerText = Math.round(newSize) + '%';
            
            drawFrame();
        }
    }
    
    function handlePointerUp() {
        state.isDraggingLogo = false;
        state.isResizingLogo = false;
    }
    
    // Attach Canvas interaction listeners (Desktop Mouse)
    state.canvas.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    
    // Attach Canvas interaction listeners (Mobile Touch screen support)
    state.canvas.addEventListener('touchstart', handlePointerDown);
    window.addEventListener('touchmove', handlePointerMove);
    window.addEventListener('touchend', handlePointerUp);
    
    // Export standard frame drawing
    window.drawEditorFrame = drawFrame;
    
    // --- Helper Utilities ---
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = (seconds % 60).toFixed(1);
        const paddedMins = mins < 10 ? '0' + mins : mins;
        const paddedSecs = parseFloat(secs) < 10 ? '0' + secs : secs;
        return `${paddedMins}:${paddedSecs}`;
    }
    
    function parseTimeString(timeStr) {
        const parts = timeStr.split(':');
        if (parts.length === 2) {
            const m = parseInt(parts[0]);
            const s = parseFloat(parts[1]);
            return (m * 60) + s;
        }
        return parseFloat(timeStr);
    }
    
    // Bind global trigger to allow re-render on demands
    window.triggerCanvasRedraw = drawFrame;
});
