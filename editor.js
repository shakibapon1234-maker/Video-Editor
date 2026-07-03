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
    voiceoverProfile: 'none',
    isNoiseCancelActive: false,
    noiseGateThreshold: -50,

    // Background Music state (Phase 3A)
    bgMusicBlob: null,
    bgMusicUrl: null,
    bgMusicAdded: false,
    bgMusicVolume: 0.4,
    bgMusicDuckingEnabled: true,

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

    // Text Overlays (Phase 2C)
    textOverlays: [],
    selectedTextOverlayId: null,
    isDraggingTextOverlay: false,
    dragTextOffsetX: 0,
    dragTextOffsetY: 0,

    // B-roll / Topic Image Overlays (Phase 5D)
    brollOverlays: [],
    selectedBrollId: null,
    isDraggingBroll: false,
    dragBrollOffsetX: 0,
    dragBrollOffsetY: 0,

    // Blur/Mosaic Regions (Phase 4B)
    blurRegions: [],
    selectedBlurId: null,
    isAddingBlur: false,
    isDrawingNewBlur: false,
    isDraggingBlur: false,
    isResizingBlur: false,
    dragBlurOffsetX: 0,
    dragBlurOffsetY: 0,
    blurDrawStartX: 0,
    blurDrawStartY: 0,

    // Auto Subtitle (Phase 5A)
    subtitles: [],
    isSubtitleRecognitionActive: false,
    subtitlesEnabled: true,

    // Multi-Clip Timeline (Phase 2B)
    clips: [],
    activeClipId: null,

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

            // Register this as the first clip in the Multi-Clip Timeline (Phase 2B)
            const firstClip = {
                id: Date.now(),
                file: file,
                url: fileURL,
                name: file.name,
                duration: state.duration,
                start: 0,
                end: state.duration
            };
            state.clips = [firstClip];
            state.activeClipId = firstClip.id;
            if (window.renderClipTimeline) window.renderClipTimeline();
            
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
    function syncActiveClipTrim() {
        const clip = state.clips.find(c => c.id === state.activeClipId);
        if (clip) {
            clip.start = state.startTime;
            clip.end = state.endTime;
            if (window.renderClipTimeline) window.renderClipTimeline();
        }
    }

    // --- Multi-Clip Timeline (Phase 2B) ---
    const addClipDropzone = document.getElementById('add-clip-dropzone');
    const addClipInput = document.getElementById('add-clip-input');
    const clipTimelineListEl = document.getElementById('clip-timeline-list');
    let draggedClipIndex = null;

    if (addClipDropzone) {
        addClipDropzone.addEventListener('click', () => addClipInput.click());
        addClipInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) addClipToTimeline(file);
            addClipInput.value = '';
        });
        addClipDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            addClipDropzone.classList.add('drag-over');
        });
        addClipDropzone.addEventListener('dragleave', () => {
            addClipDropzone.classList.remove('drag-over');
        });
        addClipDropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            addClipDropzone.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('video/')) addClipToTimeline(file);
        });
    }

    function addClipToTimeline(file) {
        const url = URL.createObjectURL(file);
        const probe = document.createElement('video');
        probe.preload = 'metadata';
        probe.src = url;
        probe.onloadedmetadata = () => {
            const newClip = {
                id: Date.now(),
                file: file,
                url: url,
                name: file.name,
                duration: probe.duration,
                start: 0,
                end: probe.duration
            };
            state.clips.push(newClip);
            renderClipTimeline();
        };
    }

    function switchActiveClip(clipId) {
        const clip = state.clips.find(c => c.id === clipId);
        if (!clip || clip.id === state.activeClipId) return;

        state.video.pause();
        state.isPlaying = false;
        const playPauseBtnEl = document.getElementById('play-pause-btn');
        if (playPauseBtnEl) playPauseBtnEl.innerHTML = '<i class="fa-solid fa-play"></i>';

        state.activeClipId = clip.id;
        state.video.src = clip.url;
        state.video.load();

        state.video.onloadedmetadata = () => {
            state.duration = clip.duration;
            state.startTime = clip.start;
            state.endTime = clip.end;

            trimStart.max = state.duration;
            trimStart.value = state.startTime;
            trimEnd.max = state.duration;
            trimEnd.value = state.endTime;
            startVal.value = formatTime(state.startTime);
            endVal.value = formatTime(state.endTime);

            updateCanvasDimensions();
            state.video.currentTime = state.startTime;
            updatePlayhead();
            drawFrame();
            renderClipTimeline();
        };
    }

    function renderClipTimeline() {
        if (!clipTimelineListEl) return;
        clipTimelineListEl.innerHTML = '';

        state.clips.forEach((clip, idx) => {
            const block = document.createElement('div');
            block.className = 'clip-timeline-block' + (clip.id === state.activeClipId ? ' active' : '');
            block.draggable = true;
            block.style.display = 'flex';
            block.style.alignItems = 'center';
            block.style.justifyContent = 'space-between';
            block.style.gap = '8px';
            block.style.padding = '8px 12px';
            block.style.borderRadius = '6px';
            block.style.marginBottom = '6px';
            block.style.cursor = 'grab';
            block.style.background = clip.id === state.activeClipId ? 'rgba(79, 70, 229, 0.15)' : 'rgba(255,255,255,0.04)';
            block.style.border = clip.id === state.activeClipId ? '1px solid var(--primary)' : '1px solid transparent';

            const label = document.createElement('span');
            const trimmedDuration = (clip.end - clip.start).toFixed(1);
            label.innerText = `${idx + 1}. ${clip.name.length > 22 ? clip.name.slice(0, 22) + '…' : clip.name} (${trimmedDuration}s)`;
            label.style.fontSize = '13px';
            label.style.flex = '1';
            label.style.overflow = 'hidden';
            label.style.whiteSpace = 'nowrap';

            block.addEventListener('click', () => switchActiveClip(clip.id));

            const removeBtn = document.createElement('button');
            removeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            removeBtn.style.background = 'transparent';
            removeBtn.style.border = 'none';
            removeBtn.style.color = '#f87171';
            removeBtn.style.cursor = 'pointer';
            removeBtn.title = 'Remove clip';
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (state.clips.length <= 1) {
                    alert('At least one clip is required.');
                    return;
                }
                const wasActive = clip.id === state.activeClipId;
                state.clips = state.clips.filter(c => c.id !== clip.id);
                if (wasActive) {
                    switchActiveClip(state.clips[0].id);
                } else {
                    renderClipTimeline();
                }
            });

            block.appendChild(label);
            block.appendChild(removeBtn);

            // Drag-to-reorder
            block.addEventListener('dragstart', () => { draggedClipIndex = idx; });
            block.addEventListener('dragover', (e) => e.preventDefault());
            block.addEventListener('drop', (e) => {
                e.preventDefault();
                if (draggedClipIndex === null || draggedClipIndex === idx) return;
                const moved = state.clips.splice(draggedClipIndex, 1)[0];
                state.clips.splice(idx, 0, moved);
                draggedClipIndex = null;
                renderClipTimeline();
            });

            clipTimelineListEl.appendChild(block);
        });
    }

    window.renderClipTimeline = renderClipTimeline;

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
        syncActiveClipTrim();
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
        syncActiveClipTrim();
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
            syncActiveClipTrim();
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
            syncActiveClipTrim();
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
    // Cartoon-style overshoot easing: eases toward 1 but briefly overshoots
    // past it before settling, giving B-roll PiP images a bouncy "pop" feel
    // instead of a flat linear slide.
    function easeOutBackOvershoot(x) {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    }

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

        // --- Step A2: Draw Blur/Mosaic Regions (Phase 4B) ---
        if (state.blurRegions && state.blurRegions.length > 0) {
            state.blurRegions.forEach((region) => {
                const rx = drawX + region.x * drawW;
                const ry = drawY + region.y * drawH;
                const rw = region.w * drawW;
                const rh = region.h * drawH;
                if (rw <= 0 || rh <= 0) return;

                state.ctx.save();
                state.ctx.beginPath();
                state.ctx.rect(rx, ry, rw, rh);
                state.ctx.clip();

                // Re-draw the same video source frame into the clipped region with a blur filter applied,
                // so the blur only affects this rectangle instead of the whole canvas.
                state.ctx.filter = `blur(${region.intensity}px)`;
                if (state.isAdjustingCrop) {
                    state.ctx.drawImage(state.video, drawX, drawY, drawW, drawH);
                } else {
                    const sx = (state.cropX || 0) * videoW;
                    const sy = (state.cropY || 0) * videoH;
                    const sw = (state.cropW || 1) * videoW;
                    const sh = (state.cropH || 1) * videoH;
                    state.ctx.drawImage(state.video, sx, sy, sw, sh, drawX, drawY, drawW, drawH);
                }
                state.ctx.filter = 'none';
                state.ctx.restore();

                // Show selection box only while actively editing in Step 2
                if (state.currentStep === 2 && state.isAddingBlur) {
                    state.ctx.save();
                    state.ctx.strokeStyle = region.id === state.selectedBlurId ? 'rgba(79, 70, 229, 0.9)' : 'rgba(255, 255, 255, 0.6)';
                    state.ctx.lineWidth = 2;
                    state.ctx.setLineDash([6, 4]);
                    state.ctx.strokeRect(rx, ry, rw, rh);
                    state.ctx.setLineDash([]);

                    if (region.id === state.selectedBlurId) {
                        state.ctx.fillStyle = '#ffffff';
                        state.ctx.fillRect(rx + rw - 6, ry + rh - 6, 12, 12);
                        state.ctx.strokeStyle = '#4f46e5';
                        state.ctx.strokeRect(rx + rw - 6, ry + rh - 6, 12, 12);
                    }
                    state.ctx.restore();
                }
            });
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

        // --- Step E: Draw B-roll / Topic Image Overlays (Phase 5D) ---
        if (state.brollOverlays && state.brollOverlays.length > 0) {
            const currentTime = state.video.currentTime;
            state.brollOverlays.forEach((item) => {
                if (!item.imageImg) return;

                const inRange = state.currentStep === 2
                    ? true
                    : (currentTime >= item.startSec && currentTime <= item.endSec);
                if (!inRange) return;

                const tIn = currentTime - item.startSec;
                const tOut = item.endSec - currentTime;

                if (item.mode === 'fullscreen') {
                    // Fade in/out over 0.4s at the edges of the range
                    let alpha = 1;
                    if (state.currentStep !== 2) {
                        const fadeDur = 0.4;
                        if (tIn < fadeDur) alpha = Math.max(0, tIn / fadeDur);
                        if (tOut < fadeDur) alpha = Math.min(alpha, Math.max(0, tOut / fadeDur));
                    }

                    state.ctx.save();
                    state.ctx.globalAlpha = alpha;

                    // Cover the entire video frame area, preserving aspect ratio (fill/crop),
                    // with a slow continuous "Ken Burns" zoom-in so a still photo feels alive
                    // instead of sitting frozen on screen.
                    const imgAspect = item.imageImg.naturalWidth / item.imageImg.naturalHeight;
                    const boxAspect = drawW / drawH;
                    let sx, sy, sw, sh;
                    if (imgAspect > boxAspect) {
                        sh = item.imageImg.naturalHeight;
                        sw = sh * boxAspect;
                        sx = (item.imageImg.naturalWidth - sw) / 2;
                        sy = 0;
                    } else {
                        sw = item.imageImg.naturalWidth;
                        sh = sw / boxAspect;
                        sx = 0;
                        sy = (item.imageImg.naturalHeight - sh) / 2;
                    }
                    if (state.currentStep !== 2) {
                        const totalDur = Math.max(0.01, item.endSec - item.startSec);
                        const zoomProgress = Math.max(0, Math.min(1, tIn / totalDur));
                        const zoom = 1 + 0.08 * zoomProgress; // grows to 8% zoomed-in by the end
                        const newSw = sw / zoom, newSh = sh / zoom;
                        sx += (sw - newSw) / 2;
                        sy += (sh - newSh) / 2;
                        sw = newSw; sh = newSh;
                    }
                    state.ctx.drawImage(item.imageImg, sx, sy, sw, sh, drawX, drawY, drawW, drawH);
                    state.ctx.restore();
                } else {
                    // Picture-in-picture with a cartoon-style slide-in/pop entrance and
                    // slide-out exit. Each clip gets its own entry direction (assigned when
                    // the image was added) so a sequence of B-roll images doesn't always
                    // enter from the same corner.
                    const pipW = canvasW * (item.size / 100);
                    const pipH = pipW * (item.imageImg.naturalHeight / item.imageImg.naturalWidth);
                    const targetX = item.x * canvasW;
                    const targetY = item.y * canvasH;

                    let progress = 1;
                    if (state.currentStep !== 2) {
                        const animDur = 0.45;
                        const enter = tIn < animDur ? Math.max(0, tIn / animDur) : 1;
                        const exit = tOut < animDur ? Math.max(0, tOut / animDur) : 1;
                        progress = Math.max(0, Math.min(1, Math.min(enter, exit)));
                    }
                    const eased = easeOutBackOvershoot(progress);

                    const dir = item.entryDirection || 'bottom';
                    let offX = 0, offY = 0;
                    if (dir === 'left') offX = -(targetX + pipW);
                    else if (dir === 'right') offX = (canvasW - targetX);
                    else if (dir === 'top') offY = -(targetY + pipH);
                    else offY = (canvasH - targetY);

                    const drawXpip = targetX + offX * (1 - eased);
                    const drawYpip = targetY + offY * (1 - eased);
                    const scale = 0.7 + 0.3 * eased; // pops in from 70% to 100% size
                    const wobble = (1 - eased) * (dir === 'left' || dir === 'top' ? -0.10 : 0.10);

                    state.ctx.save();
                    state.ctx.globalAlpha = Math.max(0.15, Math.min(1, eased));

                    const cx = drawXpip + pipW / 2;
                    const cy = drawYpip + pipH / 2;
                    state.ctx.translate(cx, cy);
                    state.ctx.rotate(wobble);
                    state.ctx.scale(scale, scale);
                    state.ctx.translate(-pipW / 2, -pipH / 2);

                    state.ctx.fillStyle = 'rgba(0,0,0,0.25)';
                    state.ctx.fillRect(-4, -4, pipW + 8, pipH + 8);
                    state.ctx.drawImage(item.imageImg, 0, 0, pipW, pipH);

                    if (state.currentStep === 2 && item.id === state.selectedBrollId) {
                        state.ctx.strokeStyle = 'rgba(79, 70, 229, 0.9)';
                        state.ctx.lineWidth = 2;
                        state.ctx.setLineDash([6, 4]);
                        state.ctx.strokeRect(0, 0, pipW, pipH);
                        state.ctx.setLineDash([]);
                    }

                    state.ctx.restore();
                }
            });
        }

        // --- Step F: Draw Text Overlays (Phase 2C) ---
        if (state.textOverlays && state.textOverlays.length > 0) {
            const currentTime = state.video.currentTime;
            state.textOverlays.forEach((item) => {
                const isVisible = state.currentStep === 2
                    ? true
                    : (currentTime >= item.startSec && currentTime <= item.endSec);
                if (!isVisible) return;

                const tx = item.x * canvasW;
                const ty = item.y * canvasH;

                state.ctx.save();
                state.ctx.font = `bold ${item.fontSize}px "${item.font}", "Plus Jakarta Sans", sans-serif`;
                state.ctx.fillStyle = item.color;
                state.ctx.textAlign = 'center';
                state.ctx.textBaseline = 'middle';

                // Subtle outline for readability over any video background
                state.ctx.lineWidth = Math.max(2, item.fontSize * 0.08);
                state.ctx.strokeStyle = 'rgba(0,0,0,0.55)';
                state.ctx.strokeText(item.text, tx, ty);
                state.ctx.fillText(item.text, tx, ty);

                // Selection box in Step 2 for the active overlay being edited
                if (state.currentStep === 2 && item.id === state.selectedTextOverlayId) {
                    const metrics = state.ctx.measureText(item.text);
                    const boxW = metrics.width + 20;
                    const boxH = item.fontSize + 16;
                    state.ctx.strokeStyle = 'rgba(79, 70, 229, 0.9)';
                    state.ctx.lineWidth = 2;
                    state.ctx.setLineDash([6, 4]);
                    state.ctx.strokeRect(tx - boxW / 2, ty - boxH / 2, boxW, boxH);
                    state.ctx.setLineDash([]);
                }

                state.ctx.restore();
            });
        }

        // --- Step G: Draw Auto Subtitle (Phase 5A) ---
        if (state.subtitlesEnabled && state.subtitles && state.subtitles.length > 0) {
            const currentTime = state.video.currentTime;
            const activeSub = state.subtitles.find(s => currentTime >= s.startSec && currentTime <= s.endSec);
            if (activeSub) {
                const fontSize = Math.max(16, Math.round(canvasH * 0.045));
                const subY = canvasH - (canvasH * 0.1);
                const maxWidth = canvasW * 0.85;

                state.ctx.save();
                state.ctx.font = `600 ${fontSize}px "Hind Siliguri", "Plus Jakarta Sans", sans-serif`;
                state.ctx.textAlign = 'center';
                state.ctx.textBaseline = 'middle';

                // Background pill behind subtitle text for readability
                const metrics = state.ctx.measureText(activeSub.text);
                const padX = 18;
                const padY = 10;
                const boxW = Math.min(maxWidth, metrics.width + padX * 2);
                const boxH = fontSize + padY * 2;

                state.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                state.ctx.beginPath();
                const rx = canvasW / 2 - boxW / 2;
                const ry = subY - boxH / 2;
                const radius = 8;
                state.ctx.moveTo(rx + radius, ry);
                state.ctx.arcTo(rx + boxW, ry, rx + boxW, ry + boxH, radius);
                state.ctx.arcTo(rx + boxW, ry + boxH, rx, ry + boxH, radius);
                state.ctx.arcTo(rx, ry + boxH, rx, ry, radius);
                state.ctx.arcTo(rx, ry, rx + boxW, ry, radius);
                state.ctx.closePath();
                state.ctx.fill();

                state.ctx.fillStyle = '#ffffff';
                state.ctx.fillText(activeSub.text, canvasW / 2, subY, maxWidth - padX * 2);
                state.ctx.restore();
            }
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

        // Blur/Mosaic region tool (Phase 4B)
        if (state.isAddingBlur) {
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

            if (coords.x < drawX || coords.x > drawX + drawW || coords.y < drawY || coords.y > drawY + drawH) {
                return;
            }

            const rect = state.canvas.getBoundingClientRect();
            const w_rect = rect.width;
            const h_rect = rect.height;
            const r_canvas = canvasW / canvasH;
            const r_rect = w_rect / h_rect;
            const w_render = (r_canvas > r_rect) ? w_rect : h_rect * r_canvas;
            const handleSize = 20 * (canvasW / w_render);
            const isNear = (x, y) => Math.hypot(coords.x - x, coords.y - y) < handleSize;

            // If a region is already selected, check for resize-handle or drag hit first
            const selected = state.blurRegions.find(r => r.id === state.selectedBlurId);
            if (selected) {
                const rx = drawX + selected.x * drawW;
                const ry = drawY + selected.y * drawH;
                const rw = selected.w * drawW;
                const rh = selected.h * drawH;

                if (isNear(rx + rw, ry + rh)) {
                    state.isResizingBlur = true;
                    e.preventDefault();
                    return;
                }
                if (coords.x >= rx && coords.x <= rx + rw && coords.y >= ry && coords.y <= ry + rh) {
                    state.isDraggingBlur = true;
                    state.dragBlurOffsetX = coords.x - rx;
                    state.dragBlurOffsetY = coords.y - ry;
                    e.preventDefault();
                    return;
                }
            }

            // Check if click lands on a different existing region -> select it
            for (let i = state.blurRegions.length - 1; i >= 0; i--) {
                const region = state.blurRegions[i];
                const rx = drawX + region.x * drawW;
                const ry = drawY + region.y * drawH;
                const rw = region.w * drawW;
                const rh = region.h * drawH;
                if (coords.x >= rx && coords.x <= rx + rw && coords.y >= ry && coords.y <= ry + rh) {
                    state.selectedBlurId = region.id;
                    if (window.onBlurRegionSelected) window.onBlurRegionSelected(region.id);
                    drawFrame();
                    e.preventDefault();
                    return;
                }
            }

            // Otherwise, start drawing a brand-new region
            state.isDrawingNewBlur = true;
            state.blurDrawDrawX = drawX;
            state.blurDrawDrawY = drawY;
            state.blurDrawDrawW = drawW;
            state.blurDrawDrawH = drawH;

            const newRegion = {
                id: Date.now(),
                x: (coords.x - drawX) / drawW,
                y: (coords.y - drawY) / drawH,
                w: 0,
                h: 0,
                intensity: 15
            };
            state.blurRegions.push(newRegion);
            state.selectedBlurId = newRegion.id;
            if (window.onBlurRegionSelected) window.onBlurRegionSelected(newRegion.id);

            e.preventDefault();
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
            return;
        } else if (check.isOver) {
            state.isDraggingLogo = true;
            state.dragOffsetX = coords.x - lx;
            state.dragOffsetY = coords.y - ly;
            e.preventDefault();
            return;
        }

        // B-roll PiP drag/select (Phase 5D) — checked before text overlay
        if (state.brollOverlays && state.brollOverlays.length > 0) {
            const brollHit = findBrollPipAt(coords);
            if (brollHit) {
                state.selectedBrollId = brollHit.id;
                state.isDraggingBroll = true;
                state.dragBrollOffsetX = coords.x - (brollHit.x * canvasW);
                state.dragBrollOffsetY = coords.y - (brollHit.y * canvasH);
                if (window.onBrollSelected) window.onBrollSelected(brollHit.id);
                e.preventDefault();
                return;
            }
        }

        // Text overlay drag/select (Phase 2C) — checked last so logo/crop take priority
        if (state.textOverlays && state.textOverlays.length > 0) {
            const hit = findTextOverlayAt(coords);
            if (hit) {
                state.selectedTextOverlayId = hit.id;
                state.isDraggingTextOverlay = true;
                state.dragTextOffsetX = coords.x - (hit.x * canvasW);
                state.dragTextOffsetY = coords.y - (hit.y * canvasH);
                if (window.onTextOverlaySelected) window.onTextOverlaySelected(hit.id);
                e.preventDefault();
            } else {
                state.selectedTextOverlayId = null;
                if (window.onTextOverlaySelected) window.onTextOverlaySelected(null);
            }
        }
    }

    function findBrollPipAt(coords) {
        const canvasW = state.canvas.width;
        const canvasH = state.canvas.height;
        for (let i = state.brollOverlays.length - 1; i >= 0; i--) {
            const item = state.brollOverlays[i];
            if (item.mode !== 'pip' || !item.imageImg) continue;
            const pipW = canvasW * (item.size / 100);
            const pipH = pipW * (item.imageImg.naturalHeight / item.imageImg.naturalWidth);
            const px = item.x * canvasW;
            const py = item.y * canvasH;
            if (coords.x >= px && coords.x <= px + pipW && coords.y >= py && coords.y <= py + pipH) {
                return item;
            }
        }
        return null;
    }

    function findTextOverlayAt(coords) {
        const canvasW = state.canvas.width;
        const canvasH = state.canvas.height;
        // Search topmost (last drawn) first
        for (let i = state.textOverlays.length - 1; i >= 0; i--) {
            const item = state.textOverlays[i];
            const tx = item.x * canvasW;
            const ty = item.y * canvasH;
            state.ctx.font = `bold ${item.fontSize}px "${item.font}", "Plus Jakarta Sans", sans-serif`;
            const metrics = state.ctx.measureText(item.text);
            const boxW = metrics.width + 20;
            const boxH = item.fontSize + 16;
            if (coords.x >= tx - boxW / 2 && coords.x <= tx + boxW / 2 &&
                coords.y >= ty - boxH / 2 && coords.y <= ty + boxH / 2) {
                return item;
            }
        }
        return null;
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

        // Blur/Mosaic region tool (Phase 4B)
        if (state.isAddingBlur && (state.isDrawingNewBlur || state.isDraggingBlur || state.isResizingBlur)) {
            const coords = getCanvasCoords(e);
            const drawX = state.blurDrawDrawX;
            const drawY = state.blurDrawDrawY;
            const drawW = state.blurDrawDrawW;
            const drawH = state.blurDrawDrawH;
            const region = state.blurRegions.find(r => r.id === state.selectedBlurId);
            if (!region) return;

            const clientX = Math.max(drawX, Math.min(drawX + drawW, coords.x));
            const clientY = Math.max(drawY, Math.min(drawY + drawH, coords.y));

            if (state.isDrawingNewBlur) {
                const startX = drawX + region.x * drawW;
                const startY = drawY + region.y * drawH;
                const x1 = Math.min(startX, clientX);
                const y1 = Math.min(startY, clientY);
                const w = Math.abs(clientX - startX);
                const h = Math.abs(clientY - startY);

                region.x = (x1 - drawX) / drawW;
                region.y = (y1 - drawY) / drawH;
                region.w = w / drawW;
                region.h = h / drawH;
                drawFrame();
            } else if (state.isDraggingBlur) {
                const rw = region.w * drawW;
                const rh = region.h * drawH;
                let newPixelX = coords.x - state.dragBlurOffsetX;
                let newPixelY = coords.y - state.dragBlurOffsetY;

                newPixelX = Math.max(drawX, Math.min(drawX + drawW - rw, newPixelX));
                newPixelY = Math.max(drawY, Math.min(drawY + drawH - rh, newPixelY));

                region.x = (newPixelX - drawX) / drawW;
                region.y = (newPixelY - drawY) / drawH;
                drawFrame();
            } else if (state.isResizingBlur) {
                const rx = drawX + region.x * drawW;
                const ry = drawY + region.y * drawH;
                const newW = Math.max(10, clientX - rx);
                const newH = Math.max(10, clientY - ry);

                region.w = newW / drawW;
                region.h = newH / drawH;
                drawFrame();
            }
            return;
        }

        // Logo behavior
        if (state.logoImg && (state.isDraggingLogo || state.isResizingLogo)) {
            const coords = getCanvasCoords(e);
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
            return;
        }

        // B-roll PiP drag (Phase 5D)
        if (state.isDraggingBroll && state.selectedBrollId !== null) {
            const coords = getCanvasCoords(e);
            const canvasW = state.canvas.width;
            const canvasH = state.canvas.height;
            const item = state.brollOverlays.find(b => b.id === state.selectedBrollId);
            if (item) {
                let newX = (coords.x - state.dragBrollOffsetX) / canvasW;
                let newY = (coords.y - state.dragBrollOffsetY) / canvasH;
                newX = Math.max(0, Math.min(1, newX));
                newY = Math.max(0, Math.min(1, newY));
                item.x = newX;
                item.y = newY;
                drawFrame();
            }
            return;
        }

        // Text overlay drag (Phase 2C)
        if (state.isDraggingTextOverlay && state.selectedTextOverlayId !== null) {
            const coords = getCanvasCoords(e);
            const canvasW = state.canvas.width;
            const canvasH = state.canvas.height;
            const item = state.textOverlays.find(t => t.id === state.selectedTextOverlayId);
            if (item) {
                let newX = (coords.x - state.dragTextOffsetX) / canvasW;
                let newY = (coords.y - state.dragTextOffsetY) / canvasH;
                newX = Math.max(0, Math.min(1, newX));
                newY = Math.max(0, Math.min(1, newY));
                item.x = newX;
                item.y = newY;
                drawFrame();
            }
            return;
        }

        // Idle cursor feedback over logo
        if (state.logoImg) {
            const coords = getCanvasCoords(e);
            const check = isPointerOnLogo(coords);
            if (check.isResize) {
                state.canvas.style.cursor = 'nwse-resize';
            } else if (check.isOver) {
                state.canvas.style.cursor = 'move';
            } else {
                state.canvas.style.cursor = 'default';
            }
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

        if (state.isDrawingNewBlur || state.isDraggingBlur || state.isResizingBlur) {
            const wasDrawing = state.isDrawingNewBlur;
            state.isDrawingNewBlur = false;
            state.isDraggingBlur = false;
            state.isResizingBlur = false;

            const region = state.blurRegions.find(r => r.id === state.selectedBlurId);
            if (wasDrawing && region && (region.w < 0.02 || region.h < 0.02)) {
                // Discard accidental tiny/zero-size box from a simple click
                state.blurRegions = state.blurRegions.filter(r => r.id !== region.id);
                state.selectedBlurId = null;
            }
            if (window.onBlurRegionSelected) window.onBlurRegionSelected(state.selectedBlurId);
            drawFrame();
            return;
        }

        state.isDraggingLogo = false;
        state.isResizingLogo = false;
        state.isDraggingTextOverlay = false;
        state.isDraggingBroll = false;
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

    // --- Blur/Mosaic Tool Bindings (Phase 4B) ---
    const blurToolToggle = document.getElementById('blur-tool-toggle');
    const blurActionsContainer = document.getElementById('blur-actions-container');
    const blurIntensitySlider = document.getElementById('blur-intensity-slider');
    const blurIntensityVal = document.getElementById('blur-intensity-val');
    const blurRegionListEl = document.getElementById('blur-region-list');
    const deleteBlurRegionBtn = document.getElementById('delete-blur-region-btn');

    blurToolToggle.addEventListener('change', (e) => {
        state.isAddingBlur = e.target.checked;
        if (state.isAddingBlur) {
            blurActionsContainer.style.display = 'block';
            renderBlurRegionList();
        } else {
            blurActionsContainer.style.display = 'none';
        }
        drawFrame();
    });

    blurIntensitySlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        blurIntensityVal.innerText = value + 'px';
        const region = state.blurRegions.find(r => r.id === state.selectedBlurId);
        if (region) {
            region.intensity = value;
            drawFrame();
        }
    });

    function renderBlurRegionList() {
        if (!blurRegionListEl) return;
        blurRegionListEl.innerHTML = '';
        state.blurRegions.forEach((region, idx) => {
            const row = document.createElement('div');
            row.className = 'blur-region-list-item' + (region.id === state.selectedBlurId ? ' active' : '');
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.justifyContent = 'space-between';
            row.style.padding = '8px 12px';
            row.style.borderRadius = '6px';
            row.style.marginBottom = '6px';
            row.style.cursor = 'pointer';
            row.style.background = region.id === state.selectedBlurId ? 'rgba(79, 70, 229, 0.12)' : 'rgba(255,255,255,0.04)';
            row.style.border = region.id === state.selectedBlurId ? '1px solid var(--primary)' : '1px solid transparent';

            const label = document.createElement('span');
            label.innerText = `Blur Region ${idx + 1}`;
            label.style.fontSize = '13px';

            row.appendChild(label);
            row.addEventListener('click', () => {
                state.selectedBlurId = region.id;
                renderBlurRegionList();
                blurIntensitySlider.value = region.intensity;
                blurIntensityVal.innerText = region.intensity + 'px';
                deleteBlurRegionBtn.style.display = 'inline-block';
                drawFrame();
            });

            blurRegionListEl.appendChild(row);
        });

        if (state.blurRegions.length === 0) {
            deleteBlurRegionBtn.style.display = 'none';
        }
    }

    if (deleteBlurRegionBtn) {
        deleteBlurRegionBtn.addEventListener('click', () => {
            state.blurRegions = state.blurRegions.filter(r => r.id !== state.selectedBlurId);
            state.selectedBlurId = null;
            renderBlurRegionList();
            deleteBlurRegionBtn.style.display = 'none';
            drawFrame();
        });
    }

    window.onBlurRegionSelected = function(id) {
        state.selectedBlurId = id;
        renderBlurRegionList();
        const region = state.blurRegions.find(r => r.id === id);
        if (region && blurIntensitySlider) {
            blurIntensitySlider.value = region.intensity;
            blurIntensityVal.innerText = region.intensity + 'px';
            if (deleteBlurRegionBtn) deleteBlurRegionBtn.style.display = 'inline-block';
        } else if (deleteBlurRegionBtn) {
            deleteBlurRegionBtn.style.display = 'none';
        }
    };
    
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

    // --- Text Overlay Bindings (Phase 2C) ---
    const textOverlayInput = document.getElementById('text-overlay-input');
    const textOverlayFontsizeSlider = document.getElementById('text-overlay-fontsize');
    const textOverlayFontsizeVal = document.getElementById('text-overlay-fontsize-val');
    const textOverlayColorInput = document.getElementById('text-overlay-color');
    const textOverlayColorVal = document.getElementById('text-overlay-color-val');
    const addTextOverlayBtn = document.getElementById('add-text-overlay-btn');
    const textOverlayListEl = document.getElementById('text-overlay-list');
    const textOverlayTimingContainer = document.getElementById('text-overlay-timing-container');
    const textOverlayStartInput = document.getElementById('text-overlay-start');
    const textOverlayEndInput = document.getElementById('text-overlay-end');
    const deleteTextOverlayBtn = document.getElementById('delete-text-overlay-btn');

    let textOverlayIdCounter = 1;

    textOverlayFontsizeSlider.addEventListener('input', (e) => {
        textOverlayFontsizeVal.innerText = e.target.value + 'px';
    });

    textOverlayColorInput.addEventListener('input', (e) => {
        textOverlayColorVal.innerText = e.target.value;
    });

    addTextOverlayBtn.addEventListener('click', () => {
        const text = textOverlayInput.value.trim();
        if (!text) return;

        const newItem = {
            id: textOverlayIdCounter++,
            text: text,
            x: 0.5,
            y: 0.5,
            fontSize: parseInt(textOverlayFontsizeSlider.value),
            color: textOverlayColorInput.value,
            font: 'Hind Siliguri',
            startSec: 0,
            endSec: Math.max(1, state.duration || 5)
        };

        state.textOverlays.push(newItem);
        state.selectedTextOverlayId = newItem.id;

        textOverlayInput.value = '';
        renderTextOverlayList();
        showTextOverlayTimingFor(newItem.id);
        drawFrame();
    });

    function renderTextOverlayList() {
        textOverlayListEl.innerHTML = '';
        state.textOverlays.forEach((item) => {
            const row = document.createElement('div');
            row.className = 'text-overlay-list-item' + (item.id === state.selectedTextOverlayId ? ' active' : '');
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.justifyContent = 'space-between';
            row.style.padding = '8px 12px';
            row.style.borderRadius = '6px';
            row.style.marginBottom = '6px';
            row.style.cursor = 'pointer';
            row.style.background = item.id === state.selectedTextOverlayId ? 'rgba(79, 70, 229, 0.12)' : 'rgba(255,255,255,0.04)';
            row.style.border = item.id === state.selectedTextOverlayId ? '1px solid var(--primary)' : '1px solid transparent';

            const label = document.createElement('span');
            label.innerText = item.text.length > 28 ? item.text.slice(0, 28) + '…' : item.text;
            label.style.fontSize = '13px';

            const timeLabel = document.createElement('span');
            timeLabel.innerText = `${item.startSec.toFixed(1)}s–${item.endSec.toFixed(1)}s`;
            timeLabel.style.fontSize = '11px';
            timeLabel.style.opacity = '0.6';

            row.appendChild(label);
            row.appendChild(timeLabel);

            row.addEventListener('click', () => {
                state.selectedTextOverlayId = item.id;
                renderTextOverlayList();
                showTextOverlayTimingFor(item.id);
                drawFrame();
            });

            textOverlayListEl.appendChild(row);
        });
    }

    function showTextOverlayTimingFor(id) {
        const item = state.textOverlays.find(t => t.id === id);
        if (!item) {
            textOverlayTimingContainer.style.display = 'none';
            return;
        }
        textOverlayTimingContainer.style.display = 'block';
        textOverlayStartInput.value = item.startSec;
        textOverlayEndInput.value = item.endSec;
    }

    textOverlayStartInput.addEventListener('input', (e) => {
        const item = state.textOverlays.find(t => t.id === state.selectedTextOverlayId);
        if (item) {
            item.startSec = Math.max(0, parseFloat(e.target.value) || 0);
            renderTextOverlayList();
        }
    });

    textOverlayEndInput.addEventListener('input', (e) => {
        const item = state.textOverlays.find(t => t.id === state.selectedTextOverlayId);
        if (item) {
            item.endSec = Math.max(item.startSec + 0.1, parseFloat(e.target.value) || (item.startSec + 1));
            renderTextOverlayList();
        }
    });

    deleteTextOverlayBtn.addEventListener('click', () => {
        state.textOverlays = state.textOverlays.filter(t => t.id !== state.selectedTextOverlayId);
        state.selectedTextOverlayId = null;
        renderTextOverlayList();
        textOverlayTimingContainer.style.display = 'none';
        drawFrame();
    });

    // Allows canvas-click selection (from handlePointerDown) to sync the side-panel list & timing fields
    window.onTextOverlaySelected = function(id) {
        renderTextOverlayList();
        showTextOverlayTimingFor(id);
    };

    // --- B-roll / Topic Image Overlay Bindings (Phase 5D) ---
    const brollDropzone = document.getElementById('broll-dropzone');
    const brollInput = document.getElementById('broll-input');
    const brollModeSelect = document.getElementById('broll-mode-select');
    const brollSizeSlider = document.getElementById('broll-size-slider');
    const brollSizeVal = document.getElementById('broll-size-val');
    const brollSizeContainer = document.getElementById('broll-size-container');
    const brollListEl = document.getElementById('broll-list');
    const brollTimingContainer = document.getElementById('broll-timing-container');
    const brollStartInput = document.getElementById('broll-start');
    const brollEndInput = document.getElementById('broll-end');
    const deleteBrollBtn = document.getElementById('delete-broll-btn');

    let brollIdCounter = 1;

    if (brollDropzone) {
        brollDropzone.addEventListener('click', () => brollInput.click());

        brollInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) loadBrollImage(file);
        });

        brollDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            brollDropzone.classList.add('drag-over');
        });
        brollDropzone.addEventListener('dragleave', () => {
            brollDropzone.classList.remove('drag-over');
        });
        brollDropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            brollDropzone.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) loadBrollImage(file);
        });
    }

    function loadBrollImage(file) {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            const newItem = {
                id: brollIdCounter++,
                imageImg: img,
                imageUrl: url,
                mode: brollModeSelect ? brollModeSelect.value : 'fullscreen',
                size: brollSizeSlider ? parseInt(brollSizeSlider.value) : 35,
                x: 0.05,
                y: 0.6,
                startSec: state.video.currentTime || 0,
                endSec: Math.min(state.duration || 5, (state.video.currentTime || 0) + 3),
                // Each B-roll clip enters from a different side so a sequence
                // of images doesn't always pop in from the same corner
                entryDirection: ['left', 'right', 'top', 'bottom'][Math.floor(Math.random() * 4)]
            };
            state.brollOverlays.push(newItem);
            state.selectedBrollId = newItem.id;
            renderBrollList();
            showBrollTimingFor(newItem.id);
            drawFrame();
        };
        img.src = url;
        if (brollInput) brollInput.value = '';
    }

    function renderBrollList() {
        if (!brollListEl) return;
        brollListEl.innerHTML = '';
        state.brollOverlays.forEach((item) => {
            const row = document.createElement('div');
            row.className = 'broll-list-item' + (item.id === state.selectedBrollId ? ' active' : '');
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.justifyContent = 'space-between';
            row.style.padding = '8px 12px';
            row.style.borderRadius = '6px';
            row.style.marginBottom = '6px';
            row.style.cursor = 'pointer';
            row.style.background = item.id === state.selectedBrollId ? 'rgba(79, 70, 229, 0.12)' : 'rgba(255,255,255,0.04)';
            row.style.border = item.id === state.selectedBrollId ? '1px solid var(--primary)' : '1px solid transparent';

            const label = document.createElement('span');
            label.innerText = item.mode === 'fullscreen' ? '🖼 Fullscreen B-roll' : '🖼 PiP B-roll';
            label.style.fontSize = '13px';

            const timeLabel = document.createElement('span');
            timeLabel.innerText = `${item.startSec.toFixed(1)}s–${item.endSec.toFixed(1)}s`;
            timeLabel.style.fontSize = '11px';
            timeLabel.style.opacity = '0.6';

            row.appendChild(label);
            row.appendChild(timeLabel);

            row.addEventListener('click', () => {
                state.selectedBrollId = item.id;
                renderBrollList();
                showBrollTimingFor(item.id);
                drawFrame();
            });

            brollListEl.appendChild(row);
        });
    }

    function showBrollTimingFor(id) {
        const item = state.brollOverlays.find(b => b.id === id);
        if (!item) {
            if (brollTimingContainer) brollTimingContainer.style.display = 'none';
            return;
        }
        if (brollTimingContainer) brollTimingContainer.style.display = 'block';
        if (brollStartInput) brollStartInput.value = item.startSec;
        if (brollEndInput) brollEndInput.value = item.endSec;
        if (brollModeSelect) brollModeSelect.value = item.mode;
        if (brollSizeSlider) brollSizeSlider.value = item.size;
        if (brollSizeVal) brollSizeVal.innerText = item.size + '%';
        if (brollSizeContainer) brollSizeContainer.style.display = item.mode === 'pip' ? 'block' : 'none';
    }

    if (brollStartInput) {
        brollStartInput.addEventListener('input', (e) => {
            const item = state.brollOverlays.find(b => b.id === state.selectedBrollId);
            if (item) {
                item.startSec = Math.max(0, parseFloat(e.target.value) || 0);
                renderBrollList();
            }
        });
    }

    if (brollEndInput) {
        brollEndInput.addEventListener('input', (e) => {
            const item = state.brollOverlays.find(b => b.id === state.selectedBrollId);
            if (item) {
                item.endSec = Math.max(item.startSec + 0.1, parseFloat(e.target.value) || (item.startSec + 1));
                renderBrollList();
            }
        });
    }

    if (brollModeSelect) {
        brollModeSelect.addEventListener('change', (e) => {
            const item = state.brollOverlays.find(b => b.id === state.selectedBrollId);
            if (item) {
                item.mode = e.target.value;
                if (brollSizeContainer) brollSizeContainer.style.display = item.mode === 'pip' ? 'block' : 'none';
                drawFrame();
            }
        });
    }

    if (brollSizeSlider) {
        brollSizeSlider.addEventListener('input', (e) => {
            const item = state.brollOverlays.find(b => b.id === state.selectedBrollId);
            if (item) {
                item.size = parseInt(e.target.value);
                if (brollSizeVal) brollSizeVal.innerText = item.size + '%';
                drawFrame();
            }
        });
    }

    if (deleteBrollBtn) {
        deleteBrollBtn.addEventListener('click', () => {
            const removed = state.brollOverlays.find(b => b.id === state.selectedBrollId);
            if (removed && removed.imageUrl) URL.revokeObjectURL(removed.imageUrl);
            state.brollOverlays = state.brollOverlays.filter(b => b.id !== state.selectedBrollId);
            state.selectedBrollId = null;
            renderBrollList();
            if (brollTimingContainer) brollTimingContainer.style.display = 'none';
            drawFrame();
        });
    }

    window.onBrollSelected = function(id) {
        renderBrollList();
        showBrollTimingFor(id);
    };

    // --- Thumbnail Generator (Phase 5B) ---
    const generateThumbnailBtn = document.getElementById('generate-thumbnail-btn');
    const thumbnailPreviewBox = document.getElementById('thumbnail-preview-box');
    const thumbnailPreviewImg = document.getElementById('thumbnail-preview-img');
    const thumbnailDownloadLink = document.getElementById('thumbnail-download-link');

    if (generateThumbnailBtn) {
        generateThumbnailBtn.addEventListener('click', () => {
            drawFrame(); // ensure canvas reflects the exact current frame + overlays
            state.canvas.toBlob((blob) => {
                if (!blob) return;
                const url = URL.createObjectURL(blob);
                thumbnailPreviewImg.src = url;
                thumbnailDownloadLink.href = url;
                thumbnailDownloadLink.download = `thumbnail-${Date.now()}.png`;
                thumbnailPreviewBox.style.display = 'block';
            }, 'image/png');
        });
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
