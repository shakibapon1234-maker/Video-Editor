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
    
    // Crop state (coordinates normalized between 0 and 1)
    cropX: 0,
    cropY: 0,
    cropW: 1,
    cropH: 1,
    isAdjustingCrop: false,

    // Crop interaction
    isResizingCrop: false,
    isDraggingCrop: false,
    isDrawingNewCrop: false,
    cropResizeHandle: null,
    cropStartCanvasX: 0,
    cropStartCanvasY: 0,
    dragCropOffsetX: 0,
    dragCropOffsetY: 0,

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
    
    // Facebook Banner Headline state
    bannerStyle: 'none',
    headerText: '',
    footerText: '',
    bannerFontFamily: 'Hind Siliguri',
    bannerFontSize: 28,
    bannerTextColor: '#ffffff',
    bannerBgColor: '#4f46e5',
    bannerHeightPercent: 12,
    
    // Facebook Visual Progress Bar state
    enableProgressBar: false,
    progressBarColor: '#10b981',
    progressBarHeight: 4,
    progressBarPosition: 'bottom-canvas',
    
    // Visual filter & image adjustments
    filterPreset: 'normal',
    brightness: 100,
    contrast: 100,
    saturation: 100,
    
    // Video layout mode
    layoutMode: 'fit',

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
            
            // Reset crop state on new video load
            state.cropX = 0;
            state.cropY = 0;
            state.cropW = 1;
            state.cropH = 1;
            state.isAdjustingCrop = false;
            if (cropToolToggle) cropToolToggle.checked = false;
            if (cropActionsContainer) cropActionsContainer.style.display = 'none';
            
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

    // --- Facebook Banners & Headlines Bindings ---
    const bannerStyleSelect = document.getElementById('banner-style-select');
    const bannerInputsContainer = document.getElementById('banner-inputs-container');
    const headerTextGroup = document.getElementById('header-text-group');
    const footerTextGroup = document.getElementById('footer-text-group');
    const headerTextInput = document.getElementById('header-text-input');
    const footerTextInput = document.getElementById('footer-text-input');
    const bannerFontSelect = document.getElementById('banner-font-select');
    const bannerFontSizeSlider = document.getElementById('banner-font-size-slider');
    const bannerFontSizeVal = document.getElementById('banner-font-size-val');
    const bannerTextColor = document.getElementById('banner-text-color');
    const bannerTextColorVal = document.getElementById('banner-text-color-val');
    const bannerBgColor = document.getElementById('banner-bg-color');
    const bannerBgColorVal = document.getElementById('banner-bg-color-val');
    const bannerHeightSlider = document.getElementById('banner-height-slider');
    const bannerHeightVal = document.getElementById('banner-height-val');

    bannerStyleSelect.addEventListener('change', (e) => {
        state.bannerStyle = e.target.value;
        if (state.bannerStyle === 'none') {
            bannerInputsContainer.style.display = 'none';
        } else {
            bannerInputsContainer.style.display = 'block';
            headerTextGroup.style.display = (state.bannerStyle === 'bottom') ? 'none' : 'block';
            footerTextGroup.style.display = (state.bannerStyle === 'top') ? 'none' : 'block';
        }
        drawFrame();
    });

    headerTextInput.addEventListener('input', (e) => {
        state.headerText = e.target.value;
        drawFrame();
    });

    footerTextInput.addEventListener('input', (e) => {
        state.footerText = e.target.value;
        drawFrame();
    });

    bannerFontSelect.addEventListener('change', (e) => {
        state.bannerFontFamily = e.target.value;
        drawFrame();
    });

    bannerFontSizeSlider.addEventListener('input', (e) => {
        state.bannerFontSize = parseInt(e.target.value);
        bannerFontSizeVal.innerText = state.bannerFontSize + 'px';
        drawFrame();
    });

    bannerTextColor.addEventListener('input', (e) => {
        state.bannerTextColor = e.target.value;
        bannerTextColorVal.innerText = e.target.value.toUpperCase();
        drawFrame();
    });

    bannerBgColor.addEventListener('input', (e) => {
        state.bannerBgColor = e.target.value;
        bannerBgColorVal.innerText = e.target.value.toUpperCase();
        drawFrame();
    });

    bannerHeightSlider.addEventListener('input', (e) => {
        state.bannerHeightPercent = parseInt(e.target.value);
        bannerHeightVal.innerText = state.bannerHeightPercent + '%';
        drawFrame();
    });

    // --- Facebook Video Progress Bar Bindings ---
    const progressBarToggle = document.getElementById('progress-bar-toggle');
    const progressBarOptionsContainer = document.getElementById('progress-bar-options-container');
    const progressBarPos = document.getElementById('progress-bar-pos');
    const progressBarColor = document.getElementById('progress-bar-color');
    const progressBarColorVal = document.getElementById('progress-bar-color-val');
    const progressBarHeight = document.getElementById('progress-bar-height');
    const progressBarHeightVal = document.getElementById('progress-bar-height-val');

    progressBarToggle.addEventListener('change', (e) => {
        state.enableProgressBar = e.target.checked;
        progressBarOptionsContainer.style.display = state.enableProgressBar ? 'block' : 'none';
        drawFrame();
    });

    progressBarPos.addEventListener('change', (e) => {
        state.progressBarPosition = e.target.value;
        drawFrame();
    });

    progressBarColor.addEventListener('input', (e) => {
        state.progressBarColor = e.target.value;
        progressBarColorVal.innerText = e.target.value.toUpperCase();
        drawFrame();
    });

    progressBarHeight.addEventListener('input', (e) => {
        state.progressBarHeight = parseInt(e.target.value);
        progressBarHeightVal.innerText = state.progressBarHeight + 'px';
        drawFrame();
    });

    // --- Cinematic Filters & Adjustments Bindings ---
    const brightnessSlider = document.getElementById('brightness-slider');
    const brightnessVal = document.getElementById('brightness-val');
    const contrastSlider = document.getElementById('contrast-slider');
    const contrastVal = document.getElementById('contrast-val');
    const saturationSlider = document.getElementById('saturation-slider');
    const saturationVal = document.getElementById('saturation-val');
    const filterPresetBtns = document.querySelectorAll('.filter-preset-btn');

    brightnessSlider.addEventListener('input', (e) => {
        state.brightness = parseInt(e.target.value);
        brightnessVal.innerText = state.brightness + '%';
        drawFrame();
    });

    contrastSlider.addEventListener('input', (e) => {
        state.contrast = parseInt(e.target.value);
        contrastVal.innerText = state.contrast + '%';
        drawFrame();
    });

    saturationSlider.addEventListener('input', (e) => {
        state.saturation = parseInt(e.target.value);
        saturationVal.innerText = state.saturation + '%';
        drawFrame();
    });

    filterPresetBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterPresetBtns.forEach(b => b.classList.remove('active'));
            const target = e.currentTarget;
            target.classList.add('active');
            state.filterPreset = target.dataset.filter;
            drawFrame();
        });
    });

    // Layout Mode (Fit vs Fill) selector
    const layoutModeBtns = document.querySelectorAll('.layout-mode-btn');
    layoutModeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            layoutModeBtns.forEach(b => b.classList.remove('active'));
            const targetBtn = e.currentTarget;
            targetBtn.classList.add('active');
            state.layoutMode = targetBtn.dataset.mode;
            drawFrame();
        });
    });
    
    function updateCanvasDimensions() {
        if (!state.duration) return;
        
        const videoWidth = state.video.videoWidth;
        const videoHeight = state.video.videoHeight;
        
        // Use cropped dimensions if not currently adjusting crop
        const currentVideoW = (state.isAdjustingCrop) ? videoWidth : ((state.cropW || 1) * videoWidth);
        const currentVideoH = (state.isAdjustingCrop) ? videoHeight : ((state.cropH || 1) * videoHeight);
        
        let targetWidth = 640;
        let targetHeight = 480;
        
        switch (state.aspectRatio) {
            case 'original':
                targetWidth = currentVideoW;
                targetHeight = currentVideoH;
                break;
            case '1-1':
                // Square
                targetWidth = Math.max(currentVideoW, currentVideoH);
                targetHeight = targetWidth;
                break;
            case '4-5':
                // Portrait 4:5 (FB Feed)
                targetHeight = Math.max(currentVideoW, currentVideoH);
                targetWidth = (targetHeight * 4) / 5;
                break;
            case '9-16':
                // Reels Vertical
                targetHeight = Math.max(currentVideoW, currentVideoH);
                targetWidth = (targetHeight * 9) / 16;
                break;
            case '16-9':
                // Landscape
                targetWidth = Math.max(currentVideoW, currentVideoH);
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
        
        state.canvas.width = Math.round(targetWidth);
        state.canvas.height = Math.round(targetHeight);
        
        // Update container height dynamically to respect aspect ratio in CSS
        const container = document.getElementById('canvas-container');
        const containerWidth = container.offsetWidth || container.clientWidth || 640;
        if (containerWidth > 0) {
            container.style.height = Math.round(containerWidth * (targetHeight / targetWidth)) + 'px';
        }
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
    
    // Standalone single-frame redraw for when video is paused (seeking, slider changes, etc.)
    function redrawPausedFrame() {
        if (!state.isPlaying && state.duration) {
            updatePlayhead();
            drawFrame();
        }
    }
    window.redrawPausedFrame = redrawPausedFrame;
    
    // Redraw canvas whenever the video's current frame changes while paused (e.g. after seek)
    state.video.addEventListener('seeked', () => {
        if (!state.isPlaying) {
            updatePlayhead();
            drawFrame();
        }
    });
    
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
        state.video.currentTime = state.startTime; // triggers 'seeked' event → redraws canvas
        updatePlayhead();
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
        state.video.currentTime = state.endTime; // triggers 'seeked' event → redraws canvas
        updatePlayhead();
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

    // Wrap text utility to render multi-line text inside banners
    function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
        const words = text.split(' ');
        let line = '';
        const lines = [];
        
        for (let n = 0; n < words.length; n++) {
            let testLine = line + words[n] + ' ';
            let metrics = ctx.measureText(testLine);
            let testWidth = metrics.width;
            if (testWidth > maxWidth && n > 0) {
                lines.push(line);
                line = words[n] + ' ';
            } else {
                line = testLine;
            }
        }
        lines.push(line.trim());
        
        // Draw lines centered vertically around y
        const startY = y - ((lines.length - 1) * lineHeight) / 2;
        for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], x, startY + i * lineHeight);
        }
    }

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
        
        // Draw video frame according to Fit or Fill/Crop layout mode
        const videoAspect = videoW / videoH;
        const canvasAspect = canvasW / canvasH;
        const currentAspect = (state.isAdjustingCrop) ? videoAspect : (((state.cropW || 1) * videoW) / ((state.cropH || 1) * videoH));
        
        let drawW = canvasW;
        let drawH = canvasH;
        let drawX = 0;
        let drawY = 0;
        
        if (state.layoutMode === 'fill') {
            if (currentAspect > canvasAspect) {
                // Video is wider than canvas container -> fill height, crop sides
                drawH = canvasH;
                drawW = canvasH * currentAspect;
                drawX = (canvasW - drawW) / 2;
                drawY = 0;
            } else {
                // Video is taller than canvas container -> fill width, crop top/bottom
                drawW = canvasW;
                drawH = canvasW / currentAspect;
                drawX = 0;
                drawY = (canvasH - drawH) / 2;
            }
        } else {
            // Fit mode (default contain with black bars)
            if (currentAspect > canvasAspect) {
                drawH = canvasW / currentAspect;
                drawY = (canvasH - drawH) / 2;
            } else if (currentAspect < canvasAspect) {
                drawW = canvasH * currentAspect;
                drawX = (canvasW - drawW) / 2;
            }
        }
        
        // --- Step A: Apply Cinematic Filters & Color Adjustments ---
        state.ctx.save();
        
        let filterVal = '';
        let bVal = state.brightness;
        let cVal = state.contrast;
        let sVal = state.saturation;
        let sepiaVal = 0;
        let grayscaleVal = 0;
        let hueVal = 0;
        
        switch (state.filterPreset) {
            case 'cinematic':
                bVal = bVal * 1.05;
                cVal = cVal * 1.25;
                sVal = sVal * 1.35;
                break;
            case 'warm':
                sepiaVal = 30;
                sVal = sVal * 1.15;
                break;
            case 'cool':
                hueVal = 200;
                sVal = sVal * 0.9;
                break;
            case 'vintage':
                sepiaVal = 80;
                cVal = cVal * 0.9;
                bVal = bVal * 0.95;
                break;
            case 'bw':
                grayscaleVal = 100;
                cVal = cVal * 1.25;
                break;
        }
        
        filterVal += `brightness(${bVal}%) `;
        filterVal += `contrast(${cVal}%) `;
        filterVal += `saturate(${sVal}%) `;
        if (sepiaVal > 0) filterVal += `sepia(${sepiaVal}%) `;
        if (grayscaleVal > 0) filterVal += `grayscale(${grayscaleVal}%) `;
        if (hueVal > 0) filterVal += `hue-rotate(${hueVal}deg) `;
        
        state.ctx.filter = filterVal;
        
        // Draw current video frame with filters applied
        if (state.isAdjustingCrop) {
            state.ctx.drawImage(state.video, drawX, drawY, drawW, drawH);
        } else {
            const sx = (state.cropX || 0) * videoW;
            const sy = (state.cropY || 0) * videoH;
            const sw = (state.cropW || 1) * videoW;
            const sh = (state.cropH || 1) * videoH;
            state.ctx.drawImage(state.video, sx, sy, sw, sh, drawX, drawY, drawW, drawH);
        }
        state.ctx.restore();

        // Draw Crop Overlay if crop adjustment mode is active
        if (state.isAdjustingCrop) {
            const cropPixelX = drawX + state.cropX * drawW;
            const cropPixelY = drawY + state.cropY * drawH;
            const cropPixelW = state.cropW * drawW;
            const cropPixelH = state.cropH * drawH;

            state.ctx.save();
            
            // Draw dark semi-transparent overlay outside the crop box
            state.ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
            state.ctx.beginPath();
            state.ctx.rect(0, 0, canvasW, canvasH);
            state.ctx.rect(cropPixelX, cropPixelY, cropPixelW, cropPixelH);
            state.ctx.fill('evenodd');

            // Draw crop box border (dashed line for premium look)
            state.ctx.strokeStyle = '#4f46e5';
            state.ctx.lineWidth = 2.5;
            state.ctx.setLineDash([8, 5]);
            state.ctx.strokeRect(cropPixelX, cropPixelY, cropPixelW, cropPixelH);
            state.ctx.setLineDash([]); // Reset line dash

            // Draw corner handles (Circular with purple core, white border, and drop shadow)
            state.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            state.ctx.shadowBlur = 6;
            state.ctx.shadowOffsetY = 2;
            
            state.ctx.fillStyle = '#4f46e5';
            state.ctx.strokeStyle = '#ffffff';
            state.ctx.lineWidth = 2;
            const radius = 8; // 16px diameter
            
            const corners = [
                [cropPixelX, cropPixelY],
                [cropPixelX + cropPixelW, cropPixelY],
                [cropPixelX, cropPixelY + cropPixelH],
                [cropPixelX + cropPixelW, cropPixelY + cropPixelH]
            ];
            
            corners.forEach(([cx, cy]) => {
                state.ctx.beginPath();
                state.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                state.ctx.fill();
                state.ctx.stroke();
            });

            state.ctx.restore();
        }
        
        // --- Step B: Draw Facebook Top & Bottom Banners ---
        if (state.bannerStyle !== 'none') {
            const bannerH = canvasH * (state.bannerHeightPercent / 100);
            state.ctx.save();
            state.ctx.fillStyle = state.bannerBgColor;
            
            // Draw Banner shapes
            if (state.bannerStyle === 'top' || state.bannerStyle === 'both') {
                state.ctx.fillRect(0, 0, canvasW, bannerH);
            }
            if (state.bannerStyle === 'bottom' || state.bannerStyle === 'both') {
                state.ctx.fillRect(0, canvasH - bannerH, canvasW, bannerH);
            }
            
            // Render Text on Banners
            state.ctx.fillStyle = state.bannerTextColor;
            state.ctx.textAlign = 'center';
            state.ctx.textBaseline = 'middle';
            state.ctx.font = `bold ${state.bannerFontSize}px "${state.bannerFontFamily}", "Plus Jakarta Sans", sans-serif`;
            
            const textPadding = 40;
            const maxWidth = canvasW - textPadding;
            const lineHeight = state.bannerFontSize * 1.3;
            
            if ((state.bannerStyle === 'top' || state.bannerStyle === 'both') && state.headerText) {
                drawWrappedText(state.ctx, state.headerText, canvasW / 2, bannerH / 2, maxWidth, lineHeight);
            }
            
            if ((state.bannerStyle === 'bottom' || state.bannerStyle === 'both') && state.footerText) {
                drawWrappedText(state.ctx, state.footerText, canvasW / 2, canvasH - (bannerH / 2), maxWidth, lineHeight);
            }
            
            state.ctx.restore();
        }
        
        // --- Step C: Draw Watermark Logo ---
        if (state.logoImg) {
            const logoW = canvasW * (state.logoSize / 100);
            const logoH = logoW * (state.logoImg.naturalHeight / state.logoImg.naturalWidth);
            
            // Convert normalized top-left coordinates to absolute canvas pixels (keeps anchor steady on resize)
            const x = state.logoX * canvasW;
            const y = state.logoY * canvasH;
            
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
        
        // --- Step D: Draw Visual Progress Bar ---
        if (state.enableProgressBar) {
            const progress = state.video.currentTime / state.duration;
            const barThickness = state.progressBarHeight;
            
            state.ctx.save();
            state.ctx.fillStyle = state.progressBarColor;
            
            switch (state.progressBarPosition) {
                case 'top-canvas':
                    state.ctx.fillRect(0, 0, canvasW * progress, barThickness);
                    break;
                case 'bottom-canvas':
                    state.ctx.fillRect(0, canvasH - barThickness, canvasW * progress, barThickness);
                    break;
                case 'top-video':
                    state.ctx.fillRect(drawX, drawY, drawW * progress, barThickness);
                    break;
                case 'bottom-video':
                    state.ctx.fillRect(drawX, drawY + drawH - barThickness, drawW * progress, barThickness);
                    break;
            }
            state.ctx.restore();
        }
    }
    
    // --- Mouse Drag and Resize Interactive System on Canvas ---
    function getCanvasCoords(e) {
        const rect = state.canvas.getBoundingClientRect();
        
        // Handle touch events
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        const w_canvas = state.canvas.width;
        const h_canvas = state.canvas.height;
        const w_rect = rect.width;
        const h_rect = rect.height;
        
        if (w_rect === 0 || h_rect === 0) {
            return { x: 0, y: 0 };
        }
        
        const r_canvas = w_canvas / h_canvas;
        const r_rect = w_rect / h_rect;
        
        let w_render = w_rect;
        let h_render = h_rect;
        let x_offset = 0;
        let y_offset = 0;
        
        // Adjust for object-fit: contain letterboxing/pillarboxing inside DOM element
        if (r_canvas > r_rect) {
            h_render = w_rect / r_canvas;
            y_offset = (h_rect - h_render) / 2;
        } else {
            w_render = h_rect * r_canvas;
            x_offset = (w_rect - w_render) / 2;
        }
        
        const x_relative = clientX - rect.left - x_offset;
        const y_relative = clientY - rect.top - y_offset;
        
        return {
            x: x_relative * (w_canvas / w_render),
            y: y_relative * (h_canvas / h_render)
        };
    }
    
    function isPointerOnLogo(coords) {
        if (!state.logoImg) return { isOver: false, isResize: false };
        
        const rect = state.canvas.getBoundingClientRect();
        const canvasW = state.canvas.width;
        const canvasH = state.canvas.height;
        const logoW = canvasW * (state.logoSize / 100);
        const logoH = logoW * (state.logoImg.naturalHeight / state.logoImg.naturalWidth);
        const lx = state.logoX * canvasW;
        const ly = state.logoY * canvasH;
        
        const w_rect = rect.width;
        const h_rect = rect.height;
        if (w_rect === 0 || h_rect === 0) return { isOver: false, isResize: false };
        
        const r_canvas = canvasW / canvasH;
        const r_rect = w_rect / h_rect;
        
        let w_render = w_rect;
        let h_render = h_rect;
        if (r_canvas > r_rect) {
            h_render = w_rect / r_canvas;
        } else {
            w_render = h_rect * r_canvas;
        }
        
        // Target a consistent 20px hit-area on screen for easy click/drag/touch
        const padX = 20 * (canvasW / w_render);
        const padY = 20 * (canvasH / h_render);
        
        // Check resize anchor box (bottom-right: 20px pad)
        const inResizeAnchor = (
            coords.x >= lx + logoW - padX && coords.x <= lx + logoW + padX &&
            coords.y >= ly + logoH - padY && coords.y <= ly + logoH + padY
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
        if (state.currentStep !== 2) return;

        if (state.isAdjustingCrop) {
            const coords = getCanvasCoords(e);
            
            const canvasW = state.canvas.width;
            const canvasH = state.canvas.height;
            const videoW = state.video.videoWidth;
            const videoH = state.video.videoHeight;
            const videoAspect = videoW / videoH;
            const canvasAspect = canvasW / canvasH;
            
            let drawW = canvasW;
            let drawH = canvasH;
            let drawX = 0;
            let drawY = 0;
            
            if (videoAspect > canvasAspect) {
                drawH = canvasW / videoAspect;
                drawY = (canvasH - drawH) / 2;
            } else if (videoAspect < canvasAspect) {
                drawW = canvasH * videoAspect;
                drawX = (canvasW - drawW) / 2;
            }
            
            // Check if pointer is within the video bounds
            if (coords.x >= drawX && coords.x <= drawX + drawW && coords.y >= drawY && coords.y <= drawY + drawH) {
                const cropPixelX = drawX + state.cropX * drawW;
                const cropPixelY = drawY + state.cropY * drawH;
                const cropPixelW = state.cropW * drawW;
                const cropPixelH = state.cropH * drawH;
                
                // Target a consistent 20px hit-area on screen for handles
                const rect = state.canvas.getBoundingClientRect();
                const w_rect = rect.width;
                const h_rect = rect.height;
                const r_canvas = canvasW / canvasH;
                const r_rect = w_rect / h_rect;
                const w_render = (r_canvas > r_rect) ? w_rect : h_rect * r_canvas;
                const handleSize = 20 * (canvasW / w_render);
                
                const isNear = (x, y) => Math.hypot(coords.x - x, coords.y - y) < handleSize;
                
                if (isNear(cropPixelX, cropPixelY)) {
                    state.isResizingCrop = true;
                    state.cropResizeHandle = 'top-left';
                } else if (isNear(cropPixelX + cropPixelW, cropPixelY)) {
                    state.isResizingCrop = true;
                    state.cropResizeHandle = 'top-right';
                } else if (isNear(cropPixelX, cropPixelY + cropPixelH)) {
                    state.isResizingCrop = true;
                    state.cropResizeHandle = 'bottom-left';
                } else if (isNear(cropPixelX + cropPixelW, cropPixelY + cropPixelH)) {
                    state.isResizingCrop = true;
                    state.cropResizeHandle = 'bottom-right';
                } else if (coords.x >= cropPixelX && coords.x <= cropPixelX + cropPixelW && coords.y >= cropPixelY && coords.y <= cropPixelY + cropPixelH) {
                    state.isDraggingCrop = true;
                    state.dragCropOffsetX = coords.x - cropPixelX;
                    state.dragCropOffsetY = coords.y - cropPixelY;
                } else {
                    // Click outside -> draw new crop box
                    state.isDrawingNewCrop = true;
                    state.cropStartCanvasX = coords.x;
                    state.cropStartCanvasY = coords.y;
                }
                e.preventDefault();
            }
            return;
        }

        // Logo behavior
        if (!state.logoImg) return;
        
        const coords = getCanvasCoords(e);
        const check = isPointerOnLogo(coords);
        
        const canvasW = state.canvas.width;
        const canvasH = state.canvas.height;
        const logoW = canvasW * (state.logoSize / 100);
        const logoH = logoW * (state.logoImg.naturalHeight / state.logoImg.naturalWidth);
        const lx = state.logoX * canvasW;
        const ly = state.logoY * canvasH;
        
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
        if (state.currentStep !== 2) return;

        if (state.isAdjustingCrop) {
            const coords = getCanvasCoords(e);
            const canvasW = state.canvas.width;
            const canvasH = state.canvas.height;
            const videoW = state.video.videoWidth;
            const videoH = state.video.videoHeight;
            const videoAspect = videoW / videoH;
            const canvasAspect = canvasW / canvasH;
            
            let drawW = canvasW;
            let drawH = canvasH;
            let drawX = 0;
            let drawY = 0;
            
            if (videoAspect > canvasAspect) {
                drawH = canvasW / videoAspect;
                drawY = (canvasH - drawH) / 2;
            } else if (videoAspect < canvasAspect) {
                drawW = canvasH * videoAspect;
                drawX = (canvasW - drawW) / 2;
            }
            
            const cropPixelX = drawX + state.cropX * drawW;
            const cropPixelY = drawY + state.cropY * drawH;
            const cropPixelW = state.cropW * drawW;
            const cropPixelH = state.cropH * drawH;
            
            // Update cursor style
            if (!state.isResizingCrop && !state.isDraggingCrop && !state.isDrawingNewCrop) {
                // Target a consistent 20px hit-area on screen for handles
                const rect = state.canvas.getBoundingClientRect();
                const w_rect = rect.width;
                const h_rect = rect.height;
                const r_canvas = canvasW / canvasH;
                const r_rect = w_rect / h_rect;
                const w_render = (r_canvas > r_rect) ? w_rect : h_rect * r_canvas;
                const handleSize = 20 * (canvasW / w_render);
                
                const isNear = (x, y) => Math.hypot(coords.x - x, coords.y - y) < handleSize;
                
                if (isNear(cropPixelX, cropPixelY) || isNear(cropPixelX + cropPixelW, cropPixelY + cropPixelH)) {
                    state.canvas.style.cursor = 'nwse-resize';
                } else if (isNear(cropPixelX + cropPixelW, cropPixelY) || isNear(cropPixelX, cropPixelY + cropPixelH)) {
                    state.canvas.style.cursor = 'nesw-resize';
                } else if (coords.x >= cropPixelX && coords.x <= cropPixelX + cropPixelW && coords.y >= cropPixelY && coords.y <= cropPixelY + cropPixelH) {
                    state.canvas.style.cursor = 'move';
                } else if (coords.x >= drawX && coords.x <= drawX + drawW && coords.y >= drawY && coords.y <= drawY + drawH) {
                    state.canvas.style.cursor = 'crosshair';
                } else {
                    state.canvas.style.cursor = 'default';
                }
                return;
            }
            
            // Perform actions
            if (state.isResizingCrop) {
                let x1 = cropPixelX;
                let y1 = cropPixelY;
                let x2 = cropPixelX + cropPixelW;
                let y2 = cropPixelY + cropPixelH;
                
                const clientX = Math.max(drawX, Math.min(drawX + drawW, coords.x));
                const clientY = Math.max(drawY, Math.min(drawY + drawH, coords.y));
                
                if (state.cropResizeHandle === 'top-left') {
                    x1 = clientX;
                    y1 = clientY;
                } else if (state.cropResizeHandle === 'top-right') {
                    x2 = clientX;
                    y1 = clientY;
                } else if (state.cropResizeHandle === 'bottom-left') {
                    x1 = clientX;
                    y2 = clientY;
                } else if (state.cropResizeHandle === 'bottom-right') {
                    x2 = clientX;
                    y2 = clientY;
                }
                
                const newPixelX = Math.min(x1, x2);
                const newPixelY = Math.min(y1, y2);
                const newPixelW = Math.abs(x2 - x1);
                const newPixelH = Math.abs(y2 - y1);
                
                state.cropX = (newPixelX - drawX) / drawW;
                state.cropY = (newPixelY - drawY) / drawH;
                state.cropW = newPixelW / drawW;
                state.cropH = newPixelH / drawH;
                
                updateCropDimensionsDisplay();
                drawFrame();
            } else if (state.isDraggingCrop) {
                let newPixelX = coords.x - state.dragCropOffsetX;
                let newPixelY = coords.y - state.dragCropOffsetY;
                
                newPixelX = Math.max(drawX, Math.min(drawX + drawW - cropPixelW, newPixelX));
                newPixelY = Math.max(drawY, Math.min(drawY + drawH - cropPixelH, newPixelY));
                
                state.cropX = (newPixelX - drawX) / drawW;
                state.cropY = (newPixelY - drawY) / drawH;
                
                updateCropDimensionsDisplay();
                drawFrame();
            } else if (state.isDrawingNewCrop) {
                const clientX = Math.max(drawX, Math.min(drawX + drawW, coords.x));
                const clientY = Math.max(drawY, Math.min(drawY + drawH, coords.y));
                
                const x1 = Math.min(state.cropStartCanvasX, clientX);
                const y1 = Math.min(state.cropStartCanvasY, clientY);
                const w = Math.abs(clientX - state.cropStartCanvasX);
                const h = Math.abs(clientY - state.cropStartCanvasY);
                
                state.cropX = (x1 - drawX) / drawW;
                state.cropY = (y1 - drawY) / drawH;
                state.cropW = w / drawW;
                state.cropH = h / drawH;
                
                updateCropDimensionsDisplay();
                drawFrame();
            }
            return;
        }

        // Logo behavior
        if (!state.logoImg) return;
        
        const coords = getCanvasCoords(e);
        
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
            
            let newLx = coords.x - state.dragOffsetX;
            let newLy = coords.y - state.dragOffsetY;
            
            newLx = Math.max(0, Math.min(canvasW - logoW, newLx));
            newLy = Math.max(0, Math.min(canvasH - logoH, newLy));
            
            state.logoX = newLx / canvasW;
            state.logoY = newLy / canvasH;
            
            drawFrame();
        } else if (state.isResizingLogo) {
            const deltaX = coords.x - state.resizeStartX;
            const scaleFactor = (deltaX / canvasW) * 100;
            let newSize = state.resizeStartSize + scaleFactor;
            
            newSize = Math.max(5, Math.min(50, newSize));
            state.logoSize = newSize;
            
            logoSizeSlider.value = Math.round(newSize);
            logoSizeVal.innerText = Math.round(newSize) + '%';
            
            drawFrame();
        }
    }
    
    function handlePointerUp() {
        if (state.isResizingCrop || state.isDraggingCrop || state.isDrawingNewCrop) {
            state.isResizingCrop = false;
            state.isDraggingCrop = false;
            state.isDrawingNewCrop = false;
            
            if (state.cropW < 0.01 || state.cropH < 0.01) {
                state.cropX = 0;
                state.cropY = 0;
                state.cropW = 1;
                state.cropH = 1;
            }
            updateCropDimensionsDisplay();
            updateCanvasDimensions();
            drawFrame();
            return;
        }

        state.isDraggingLogo = false;
        state.isResizingLogo = false;
    }

    // --- Video Crop Tool Bindings ---
    const cropToolToggle = document.getElementById('crop-tool-toggle');
    const cropActionsContainer = document.getElementById('crop-actions-container');
    const resetCropBtn = document.getElementById('reset-crop-btn');
    
    cropToolToggle.addEventListener('change', (e) => {
        state.isAdjustingCrop = e.target.checked;
        if (state.isAdjustingCrop) {
            cropActionsContainer.style.display = 'block';
            updateCropDimensionsDisplay();
        } else {
            cropActionsContainer.style.display = 'none';
        }
        updateCanvasDimensions();
        drawFrame();
    });
    
    resetCropBtn.addEventListener('click', () => {
        state.cropX = 0;
        state.cropY = 0;
        state.cropW = 1;
        state.cropH = 1;
        updateCropDimensionsDisplay();
        updateCanvasDimensions();
        drawFrame();
    });

    function updateCropDimensionsDisplay() {
        const cropDimensionsVal = document.getElementById('crop-dimensions-val');
        if (!cropDimensionsVal) return;
        if (!state.duration) return;
        
        const videoW = state.video.videoWidth;
        const videoH = state.video.videoHeight;
        const w = Math.round(state.cropW * videoW);
        const h = Math.round(state.cropH * videoH);
        cropDimensionsVal.innerText = `${w}px x ${h}px (${Math.round(state.cropW * 100)}% x ${Math.round(state.cropH * 100)}%)`;
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
    
    // --- Premium Tooltip Engine ---
    const tooltipEl = document.createElement('div');
    tooltipEl.className = 'premium-tooltip';
    document.body.appendChild(tooltipEl);

    document.addEventListener('mouseover', (e) => {
        const target = e.target.closest('[data-tooltip]');
        if (!target) return;
        
        const text = target.getAttribute('data-tooltip');
        if (!text) return;
        
        tooltipEl.innerText = text;
        tooltipEl.classList.add('show');
        
        const rect = target.getBoundingClientRect();
        const tooltipRect = tooltipEl.getBoundingClientRect();
        
        let left = rect.left + (rect.width - tooltipRect.width) / 2;
        let top = rect.top - tooltipRect.height - 8;
        
        if (left < 8) left = 8;
        if (left + tooltipRect.width > window.innerWidth - 8) {
            left = window.innerWidth - tooltipRect.width - 8;
        }
        if (top < 8) {
            top = rect.bottom + 8;
        }
        
        tooltipEl.style.left = `${left + window.scrollX}px`;
        tooltipEl.style.top = `${top + window.scrollY}px`;
    });
    
    document.addEventListener('mouseout', (e) => {
        const target = e.target.closest('[data-tooltip]');
        if (target) {
            tooltipEl.classList.remove('show');
        }
    });
    
    document.addEventListener('click', () => {
        tooltipEl.classList.remove('show');
    });
    
    // Bind global trigger to allow re-render on demands
    window.triggerCanvasRedraw = drawFrame;
});
