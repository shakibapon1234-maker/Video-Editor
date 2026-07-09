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
    noiseGateThreshold: -38,

    // Background Music state (Phase 3A, upgraded to multi-track timeline in v2.3)
    // Each track: { id, blob, url, name, duration, volume, startSec, endSec, loopMode }
    // endSec === null means "play until the end of the video".
    // loopMode: 'loop' (repeat for the whole startSec..endSec window) or 'once' (play through one time, then stay silent for the rest of the window).
    bgMusicTracks: [],
    selectedBgMusicTrackId: null,
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

    // News Ticker / Breaking-News scrolling text strip state
    tickerEnabled: false,
    tickerText: '',
    tickerPosition: 'bottom', // 'top' or 'bottom'
    tickerSpeed: 90, // pixels per second, right-to-left
    tickerFontSize: 24,
    tickerTextColor: '#ffffff',
    tickerBgColor: '#dc2626',
    tickerHeightPercent: 8,
    tickerLabel: '', // optional fixed "BREAKING" style tag drawn at the leading edge
    
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
    isDraggingSeek: false,
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

    // Image/photo playhead emulation
    imagePlayheadTime: 0,
    lastImageTickTime: 0,
    get currentTime() {
        const activeClip = this.clips.find(c => c.id === this.activeClipId);
        if (activeClip && activeClip.type === 'image') {
            return this.imagePlayheadTime || 0;
        }
        return this.video.currentTime || 0;
    },
    set currentTime(val) {
        const activeClip = this.clips.find(c => c.id === this.activeClipId);
        if (activeClip && activeClip.type === 'image') {
            this.imagePlayheadTime = val;
            if (!this.isPlaying) {
                // We'll define a redraw call or trigger it manually
                if (window.redrawPausedFrameGlobal) {
                    window.redrawPausedFrameGlobal();
                }
            }
        } else {
            this.video.currentTime = val;
        }
    },

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
    const splitClipBtn = document.getElementById('split-clip-btn');
    const cutOutTrimBtn = document.getElementById('cut-out-trim-btn');
    const trimStart = document.getElementById('trim-start');
    const trimEnd = document.getElementById('trim-end');
    const startVal = document.getElementById('start-time-val');
    const endVal = document.getElementById('end-time-val');
    const playhead = document.getElementById('playhead-indicator');
    const trimFill = document.getElementById('trim-fill');
    const seekSlider = document.getElementById('seek-slider');
    const seekFill = document.getElementById('seek-fill');
    const seekCurrentTimeEl = document.getElementById('seek-current-time');
    const seekTotalTimeEl = document.getElementById('seek-total-time');
    
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

    // Step 2 "Quick Volume" mirror control, kept in sync with the Step 3 slider above.
    // (The old Background Music quick-volume mirror here was removed in v2.3 — with
    // multiple music tracks now possible, a single "quick" slider no longer maps to
    // one clear value. Each track's volume is set in its own row in Step 3 instead.)
    const videoVolumeSliderStep2 = document.getElementById('video-volume-slider-step2');
    const videoVolumeValStep2 = document.getElementById('video-volume-val-step2');
    
    // --- Step Navigation System ---
    function updateNavigation() {
        // Toggle step buttons in sidebar
        for (let i = 1; i <= 5; i++) {
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
            1: ["Media Import", "Start by uploading your video/photo clips and branding logo"],
            2: ["Trim & Layout", "Cut video duration and adjust the canvas format"],
            3: ["Overlays & B-roll", "Add news tickers, text overlays, and B-roll animations"],
            4: ["Audio & Voice", "Enhance audio quality and record background voiceover"],
            5: ["Export Studio", "Render and download your final video for Facebook"]
        };
        
        document.getElementById('current-step-title').innerText = titles[state.currentStep][0];
        document.getElementById('current-step-subtitle').innerText = titles[state.currentStep][1];
        
        // Button states
        prevBtn.disabled = (state.currentStep === 1);
        
        // Disable next unless video is loaded
        if (state.currentStep === 1 && !state.duration) {
            nextBtn.disabled = true;
        } else {
            nextBtn.disabled = (state.currentStep === 5);
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
        if (state.currentStep < 5) {
            state.currentStep++;
            updateNavigation();
        }
    });
    
    for (let i = 1; i <= 5; i++) {
        document.getElementById(`step-btn-${i}`).addEventListener('click', () => {
            if (state.duration || i === 1) {
                state.currentStep = i;
                updateNavigation();
            }
        });
    }
    
    // --- Video Source Loading ---
    // --- Video/Image Source Loading ---
    function handleVideoFile(file) {
        if (!file) return;
        
        // Show loading state
        const originalText = videoDropzone.querySelector('h3').innerText;
        videoDropzone.querySelector('h3').innerText = "Loading File...";
        
        const fileURL = URL.createObjectURL(file);
        
        if (file.type.startsWith('image/')) {
            const img = new Image();
            img.onload = () => {
                state.duration = 5.0;
                state.startTime = 0;
                state.endTime = 5.0;

                const firstClip = {
                    id: Date.now(),
                    file: file,
                    url: fileURL,
                    name: file.name,
                    duration: 5.0,
                    start: 0,
                    end: 5.0,
                    cropX: 0,
                    cropY: 0,
                    cropW: 1,
                    cropH: 1,
                    type: 'image',
                    imageImg: img
                };
                state.clips = [firstClip];
                state.activeClipId = firstClip.id;
                if (window.renderClipTimeline) window.renderClipTimeline();
                
                state.cropX = 0;
                state.cropY = 0;
                state.cropW = 1;
                state.cropH = 1;
                state.isAdjustingCrop = false;
                if (cropToolToggle) cropToolToggle.checked = false;
                if (cropActionsContainer) cropActionsContainer.style.display = 'none';
                
                trimStart.max = 5.0;
                trimStart.value = 0;
                trimEnd.max = 5.0;
                trimEnd.value = 5.0;
                
                startVal.value = formatTime(0);
                endVal.value = formatTime(5.0);
                
                updateCanvasDimensions();
                
                document.getElementById('timeline-controls').style.display = 'flex';
                document.querySelector('.canvas-overlay-controls').style.display = 'block';
                videoDropzone.style.display = 'none';
                
                document.getElementById('selected-video-name').innerText = file.name;
                nextBtn.disabled = false;
                updateNavigation();
                
                if (window.initializeAudioSource) {
                    window.initializeAudioSource();
                }
                
                state.currentTime = 0;
                updatePlayhead();
                drawFrame();
            };
            img.src = fileURL;
        } else {
            state.video.src = fileURL;
            state.video.load();
            
            state.video.onloadedmetadata = () => {
                state.duration = state.video.duration;
                state.startTime = 0;
                state.endTime = state.duration;

                const firstClip = {
                    id: Date.now(),
                    file: file,
                    url: fileURL,
                    name: file.name,
                    duration: state.duration,
                    start: 0,
                    end: state.duration,
                    cropX: 0,
                    cropY: 0,
                    cropW: 1,
                    cropH: 1
                };
                state.clips = [firstClip];
                state.activeClipId = firstClip.id;
                if (window.renderClipTimeline) window.renderClipTimeline();
                
                state.cropX = 0;
                state.cropY = 0;
                state.cropW = 1;
                state.cropH = 1;
                state.isAdjustingCrop = false;
                if (cropToolToggle) cropToolToggle.checked = false;
                if (cropActionsContainer) cropActionsContainer.style.display = 'none';
                
                trimStart.max = state.duration;
                trimStart.value = 0;
                trimEnd.max = state.duration;
                trimEnd.value = state.duration;
                
                startVal.value = formatTime(0);
                endVal.value = formatTime(state.duration);
                
                updateCanvasDimensions();
                
                document.getElementById('timeline-controls').style.display = 'flex';
                document.querySelector('.canvas-overlay-controls').style.display = 'block';
                videoDropzone.style.display = 'none';
                
                document.getElementById('selected-video-name').innerText = file.name;
                nextBtn.disabled = false;
                updateNavigation();
                
                if (window.initializeAudioSource) {
                    window.initializeAudioSource();
                }
                
                state.currentTime = 0;
                updatePlayhead();
                drawFrame();
            };
        }
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

    // --- News Ticker Bindings ---
    const tickerEnableToggle = document.getElementById('ticker-enable-toggle');
    const tickerInputsContainer = document.getElementById('ticker-inputs-container');
    const tickerTextInput = document.getElementById('ticker-text-input');
    const tickerLabelInput = document.getElementById('ticker-label-input');
    const tickerPositionSelect = document.getElementById('ticker-position-select');
    const tickerSpeedSlider = document.getElementById('ticker-speed-slider');
    const tickerSpeedVal = document.getElementById('ticker-speed-val');
    const tickerFontSizeSlider = document.getElementById('ticker-font-size-slider');
    const tickerFontSizeVal = document.getElementById('ticker-font-size-val');
    const tickerTextColor = document.getElementById('ticker-text-color');
    const tickerTextColorVal = document.getElementById('ticker-text-color-val');
    const tickerBgColor = document.getElementById('ticker-bg-color');
    const tickerBgColorVal = document.getElementById('ticker-bg-color-val');
    const tickerHeightSlider = document.getElementById('ticker-height-slider');
    const tickerHeightVal = document.getElementById('ticker-height-val');

    if (tickerEnableToggle) {
        tickerEnableToggle.addEventListener('change', (e) => {
            state.tickerEnabled = e.target.checked;
            tickerInputsContainer.style.display = state.tickerEnabled ? 'block' : 'none';
            drawFrame();
        });
    }

    if (tickerTextInput) {
        tickerTextInput.addEventListener('input', (e) => {
            state.tickerText = e.target.value;
            drawFrame();
        });
    }

    if (tickerLabelInput) {
        tickerLabelInput.addEventListener('input', (e) => {
            state.tickerLabel = e.target.value;
            drawFrame();
        });
    }

    if (tickerPositionSelect) {
        tickerPositionSelect.addEventListener('change', (e) => {
            state.tickerPosition = e.target.value;
            drawFrame();
        });
    }

    if (tickerSpeedSlider) {
        tickerSpeedSlider.addEventListener('input', (e) => {
            state.tickerSpeed = parseInt(e.target.value);
            tickerSpeedVal.innerText = state.tickerSpeed;
            drawFrame();
        });
    }

    if (tickerFontSizeSlider) {
        tickerFontSizeSlider.addEventListener('input', (e) => {
            state.tickerFontSize = parseInt(e.target.value);
            tickerFontSizeVal.innerText = state.tickerFontSize + 'px';
            drawFrame();
        });
    }

    if (tickerTextColor) {
        tickerTextColor.addEventListener('input', (e) => {
            state.tickerTextColor = e.target.value;
            tickerTextColorVal.innerText = e.target.value.toUpperCase();
            drawFrame();
        });
    }

    if (tickerBgColor) {
        tickerBgColor.addEventListener('input', (e) => {
            state.tickerBgColor = e.target.value;
            tickerBgColorVal.innerText = e.target.value.toUpperCase();
            drawFrame();
        });
    }

    if (tickerHeightSlider) {
        tickerHeightSlider.addEventListener('input', (e) => {
            state.tickerHeightPercent = parseInt(e.target.value);
            tickerHeightVal.innerText = state.tickerHeightPercent + '%';
            drawFrame();
        });
    }

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

    if (splitClipBtn) {
        splitClipBtn.addEventListener('click', () => {
            const activeClip = state.clips.find(c => c.id === state.activeClipId);
            if (!activeClip) return;

            const currentTime = state.currentTime || 0;
            if (currentTime <= activeClip.start + 0.15 || currentTime >= activeClip.end - 0.15) {
                alert("ক্লিপটি প্লেহেড পজিশনে বিভক্ত করা সম্ভব নয় (একেবারে শুরুতে বা শেষে বিভক্ত করা যায় না)।");
                return;
            }

            const clipIndex = state.clips.indexOf(activeClip);
            const endOfFirstHalf = currentTime;
            const startOfSecondHalf = currentTime;

            const newClip = {
                id: Date.now(),
                file: activeClip.file,
                url: activeClip.url,
                name: activeClip.name,
                duration: activeClip.duration,
                start: startOfSecondHalf,
                end: activeClip.end,
                cropX: activeClip.cropX,
                cropY: activeClip.cropY,
                cropW: activeClip.cropW,
                cropH: activeClip.cropH
            };

            // Pause if playing
            if (state.isPlaying) {
                pauseVideo();
            }

            // Update active clip end
            activeClip.end = endOfFirstHalf;

            // Insert newClip after activeClip
            state.clips.splice(clipIndex + 1, 0, newClip);

            // Re-render
            renderClipTimeline();

            // Set playhead to the split point
            state.currentTime = currentTime;

            // Switch focus to the first half
            switchActiveClip(activeClip.id);
            
            console.log("Split clip at:", currentTime);
        });
    }

    if (cutOutTrimBtn) {
        cutOutTrimBtn.addEventListener('click', () => {
            const activeClip = state.clips.find(c => c.id === state.activeClipId);
            if (!activeClip) return;

            const startCut = parseFloat(trimStart.value) || 0;
            const endCut = parseFloat(trimEnd.value) || 0;

            if (endCut <= startCut + 0.1) {
                alert("বাদ দেওয়ার জন্য সঠিক সময়সীমা সিলেক্ট করুন।");
                return;
            }

            const confirmMsg = `আপনি কি নিশ্চিত যে ক্লিপটির ${startCut.toFixed(1)}s থেকে ${endCut.toFixed(1)}s অংশটি কেটে বাদ দিতে চান?`;
            if (!confirm(confirmMsg)) return;

            const clipIndex = state.clips.indexOf(activeClip);

            let startBound = activeClip.start;
            let endBound = activeClip.end;

            // If the user has trimmed the active clip to exactly the cut range,
            // we assume they did this to select the disturbance and want to keep the rest
            // of the original video file.
            if (Math.abs(startCut - activeClip.start) < 0.2 && Math.abs(endCut - activeClip.end) < 0.2) {
                startBound = 0;
                endBound = activeClip.duration;
            }

            const keepFirst = startCut > startBound + 0.15;
            const keepSecond = endCut < endBound - 0.15;

            if (!keepFirst && !keepSecond) {
                alert("পুরো ক্লিপটি একসাথে বাদ দেওয়া যাবে না। ক্লিপ ডিলিট করতে ক্লিপ তালিকার X বাটনে ক্লিক করুন।");
                return;
            }

            // Pause playback
            if (state.isPlaying) {
                pauseVideo();
            }

            const newClips = [];

            if (keepFirst) {
                newClips.push({
                    id: Date.now(),
                    file: activeClip.file,
                    url: activeClip.url,
                    name: activeClip.name,
                    duration: activeClip.duration,
                    start: startBound,
                    end: startCut,
                    cropX: activeClip.cropX,
                    cropY: activeClip.cropY,
                    cropW: activeClip.cropW,
                    cropH: activeClip.cropH
                });
            }

            if (keepSecond) {
                newClips.push({
                    id: Date.now() + 1,
                    file: activeClip.file,
                    url: activeClip.url,
                    name: activeClip.name,
                    duration: activeClip.duration,
                    start: endCut,
                    end: endBound,
                    cropX: activeClip.cropX,
                    cropY: activeClip.cropY,
                    cropW: activeClip.cropW,
                    cropH: activeClip.cropH
                });
            }

            // Replace activeClip with newClips
            state.clips.splice(clipIndex, 1, ...newClips);

            // Re-render
            renderClipTimeline();

            // Switch to the first of the new clips
            switchActiveClip(newClips[0].id);
        });
    }
    
    function playVideo() {
        if (!state.duration) return;
        
        // If playhead is outside the trimmed region, loop it
        if (state.currentTime >= state.endTime || state.currentTime < state.startTime) {
            state.currentTime = state.startTime;
        }
        
        const activeClip = state.clips.find(c => c.id === state.activeClipId);
        if (activeClip && activeClip.type === 'image') {
            state.isPlaying = true;
            state.lastImageTickTime = performance.now();
        } else {
            state.video.play();
            state.isPlaying = true;
        }
        playPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
        
        // Start playback event listeners for voiceover sync
        if (window.onPlaybackStart) {
            window.onPlaybackStart();
        }
        
        requestAnimationFrame(updateLoop);
    }
    
    function pauseVideo() {
        const activeClip = state.clips.find(c => c.id === state.activeClipId);
        if (activeClip && activeClip.type === 'image') {
            state.isPlaying = false;
        } else {
            state.video.pause();
            state.isPlaying = false;
        }
        playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        
        if (window.onPlaybackStop) {
            window.onPlaybackStop();
        }
    }
    
    function updateLoop() {
        if (!state.isPlaying) return;
        
        const activeClip = state.clips.find(c => c.id === state.activeClipId);
        if (activeClip && activeClip.type === 'image') {
            // Emulate playhead movement
            const now = performance.now();
            const elapsed = (now - state.lastImageTickTime) / 1000;
            state.lastImageTickTime = now;
            state.currentTime += elapsed;
        }
        
        // Loop back or transition to the next clip if reached trim end
        if (state.currentTime >= state.endTime) {
            if (window.isRecordingVoiceover) {
                // If recording voiceover, stop both recording and playback when reaching trim end
                pauseVideo();
            } else {
                const clipIndex = state.clips.indexOf(activeClip);
                if (activeClip && clipIndex >= 0 && clipIndex < state.clips.length - 1) {
                    // Transition to next clip and play!
                    const nextClip = state.clips[clipIndex + 1];
                    switchActiveClip(nextClip.id, true);
                    return; // exit loop, playVideo in switchActiveClip will start a new loop
                } else {
                    // Loop back to the first clip!
                    const firstClip = state.clips[0];
                    if (firstClip && firstClip.id !== state.activeClipId) {
                        switchActiveClip(firstClip.id, true);
                        return;
                    } else {
                        state.currentTime = state.startTime;
                    }
                }
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
    window.redrawPausedFrameGlobal = redrawPausedFrame;
    
    // Redraw canvas whenever the video's current frame changes while paused (e.g. after seek)
    state.video.addEventListener('seeked', () => {
        if (!state.isPlaying) {
            updatePlayhead();
            drawFrame();
        }
    });
    
    // Update playhead UI position
    function updatePlayhead() {
        const current = state.currentTime;
        const total = state.duration;
        
        document.getElementById('canvas-time-display').innerText = `${formatTime(current)} / ${formatTime(total)}`;
        
        const percent = (current / total) * 100;
        playhead.style.left = percent + '%';
        
        // Highlight active trim region
        const startPercent = (state.startTime / total) * 100;
        const endPercent = (state.endTime / total) * 100;
        trimFill.style.left = startPercent + '%';
        trimFill.style.width = (endPercent - startPercent) + '%';

        // Dedicated seek/scrub bar
        if (seekSlider && !state.isDraggingSeek) {
            seekSlider.max = total || 0;
            seekSlider.value = current;
        }
        if (seekFill) seekFill.style.width = Math.max(0, Math.min(100, percent)) + '%';
        if (seekCurrentTimeEl) seekCurrentTimeEl.innerText = formatTime(current);
        if (seekTotalTimeEl) seekTotalTimeEl.innerText = formatTime(total);
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

    // Save the current global crop values onto whichever clip is active,
    // so each clip in the multi-clip timeline can keep its own crop area.
    function syncCropToActiveClip() {
        const clip = state.clips.find(c => c.id === state.activeClipId);
        if (clip) {
            clip.cropX = state.cropX;
            clip.cropY = state.cropY;
            clip.cropW = state.cropW;
            clip.cropH = state.cropH;
        }
    }
    window.syncCropToActiveClip = syncCropToActiveClip;

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
            if (file && (file.type.startsWith('video/') || file.type.startsWith('image/'))) addClipToTimeline(file);
        });
    }

    function addClipToTimeline(file) {
        const url = URL.createObjectURL(file);
        if (file.type.startsWith('image/')) {
            const img = new Image();
            img.onload = () => {
                const newClip = {
                    id: Date.now(),
                    file: file,
                    url: url,
                    name: file.name,
                    duration: 5.0,
                    start: 0,
                    end: 5.0,
                    cropX: 0,
                    cropY: 0,
                    cropW: 1,
                    cropH: 1,
                    type: 'image',
                    imageImg: img
                };
                state.clips.push(newClip);
                renderClipTimeline();
            };
            img.src = url;
        } else {
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
                    end: probe.duration,
                    cropX: 0,
                    cropY: 0,
                    cropW: 1,
                    cropH: 1
                };
                state.clips.push(newClip);
                renderClipTimeline();
            };
        }
    }

    function switchActiveClip(clipId, autoPlay = false) {
        const clip = state.clips.find(c => c.id === clipId);
        if (!clip || clip.id === state.activeClipId) return;

        // Persist the outgoing clip's crop area before switching away from it.
        syncCropToActiveClip();

        state.video.pause();
        state.isPlaying = false;
        const playPauseBtnEl = document.getElementById('play-pause-btn');
        if (playPauseBtnEl) playPauseBtnEl.innerHTML = '<i class="fa-solid fa-play"></i>';

        state.activeClipId = clip.id;

        // Load this clip's own crop area (falls back to full-frame if it was created before this feature existed).
        state.cropX = clip.cropX || 0;
        state.cropY = clip.cropY || 0;
        state.cropW = (clip.cropW !== undefined) ? clip.cropW : 1;
        state.cropH = (clip.cropH !== undefined) ? clip.cropH : 1;

        if (clip.type === 'image') {
            state.video.src = '';
            setTimeout(() => {
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
                state.currentTime = state.startTime;
                updatePlayhead();
                updateCropDimensionsDisplay();
                drawFrame();
                renderClipTimeline();

                if (autoPlay) {
                    playVideo();
                }
            }, 0);
        } else {
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
                state.currentTime = state.startTime;
                updatePlayhead();
                updateCropDimensionsDisplay();
                drawFrame();
                renderClipTimeline();

                if (autoPlay) {
                    playVideo();
                }
            };
        }
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
        state.currentTime = state.startTime; // triggers 'seeked' event → redraws canvas
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
        state.currentTime = state.endTime; // triggers 'seeked' event → redraws canvas
        updatePlayhead();
        syncActiveClipTrim();
    });

    // Dedicated seek/scrub bar — freely move the playhead without touching the trim range.
    // Pauses playback while actively dragging (so scrubbing feels responsive), and does NOT
    // resume automatically on release — matches how most video players' scrub bars behave.
    let wasPlayingBeforeSeek = false;
    if (seekSlider) {
        seekSlider.addEventListener('mousedown', () => {
            state.isDraggingSeek = true;
            wasPlayingBeforeSeek = state.isPlaying;
            if (state.isPlaying) pauseVideo();
        });
        seekSlider.addEventListener('touchstart', () => {
            state.isDraggingSeek = true;
            wasPlayingBeforeSeek = state.isPlaying;
            if (state.isPlaying) pauseVideo();
        });

        seekSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value) || 0;
            state.currentTime = val; // triggers 'seeked' event → redraws canvas
            if (seekFill && state.duration) {
                seekFill.style.width = Math.max(0, Math.min(100, (val / state.duration) * 100)) + '%';
            }
            if (seekCurrentTimeEl) seekCurrentTimeEl.innerText = formatTime(val);
        });

        function finishSeekDrag() {
            state.isDraggingSeek = false;
            updatePlayhead();
        }
        seekSlider.addEventListener('mouseup', finishSeekDrag);
        seekSlider.addEventListener('touchend', finishSeekDrag);
    }
    
    // Video volume mix slider (Step 3 original + Step 2 quick-access copy stay in sync)
    function applyVideoVolume(newVolumePercent) {
        state.videoVolume = newVolumePercent / 100;
        const label = newVolumePercent + '%';
        videoVolumeVal.innerText = label;
        videoVolumeSlider.value = newVolumePercent;
        if (videoVolumeValStep2) videoVolumeValStep2.innerText = label;
        if (videoVolumeSliderStep2) videoVolumeSliderStep2.value = newVolumePercent;

        // Apply to video element directly
        if (window.videoGainNode) {
            window.videoGainNode.gain.setValueAtTime(state.videoVolume, 0);
        } else {
            state.video.volume = Math.min(1.0, state.videoVolume);
        }
    }

    videoVolumeSlider.addEventListener('input', (e) => {
        applyVideoVolume(parseInt(e.target.value));
    });

    if (videoVolumeSliderStep2) {
        videoVolumeSliderStep2.addEventListener('input', (e) => {
            applyVideoVolume(parseInt(e.target.value));
        });
    }

    // Handle Manual Typing of Trim fields
    startVal.addEventListener('change', () => {
        const sec = parseTimeString(startVal.value);
        if (!isNaN(sec) && sec >= 0 && sec < state.endTime) {
            state.startTime = sec;
            trimStart.value = sec;
            state.currentTime = sec;
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
            state.currentTime = sec;
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

        const activeClip = state.clips.find(c => c.id === state.activeClipId);
        const isImageClip = activeClip && activeClip.type === 'image';

        const videoW = isImageClip ? (activeClip.imageImg?.naturalWidth || 640) : state.video.videoWidth;
        const videoH = isImageClip ? (activeClip.imageImg?.naturalHeight || 360) : state.video.videoHeight;

        const mediaSource = isImageClip ? activeClip.imageImg : state.video;
        
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
            state.ctx.drawImage(mediaSource, drawX, drawY, drawW, drawH);
        } else {
            const sx = (state.cropX || 0) * videoW;
            const sy = (state.cropY || 0) * videoH;
            const sw = (state.cropW || 1) * videoW;
            const sh = (state.cropH || 1) * videoH;
            state.ctx.drawImage(mediaSource, sx, sy, sw, sh, drawX, drawY, drawW, drawH);
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
                    state.ctx.drawImage(mediaSource, drawX, drawY, drawW, drawH);
                } else {
                    const sx = (state.cropX || 0) * videoW;
                    const sy = (state.cropY || 0) * videoH;
                    const sw = (state.cropW || 1) * videoW;
                    const sh = (state.cropH || 1) * videoH;
                    state.ctx.drawImage(mediaSource, sx, sy, sw, sh, drawX, drawY, drawW, drawH);
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

        // --- Step E: Draw B-roll / Topic Image Overlays (Phase 5D, unified in v2.5) ---
        // NOTE: Steps B/B2/C/D (banners, ticker, logo, progress bar) have been moved
        // to render AFTER this step so they always appear on top of fullscreen B-roll images.
        // Fullscreen and PiP used to run two separate animation engines with two
        // separate dropdown option lists (e.g. "Wipe Reveal" only existed for
        // Fullscreen, "Spin Pop" only for PiP). They're unified here: every style
        // in the Animation Style dropdown now works the same way regardless of
        // Display Mode — the only thing that changes between modes is the size/
        // position of the box being animated (full video frame vs. a small
        // floating corner box), not which effects are available.
        if (state.brollOverlays && state.brollOverlays.length > 0) {
            const currentTime = state.currentTime;
            const brollEaseOut = (p) => 1 - Math.pow(1 - Math.max(0, Math.min(1, p)), 3);
            // Distance (in px) to slide a box fully off-canvas in a given direction —
            // used by both 'slide' and 'slide-pop'. Works for any box size/position:
            // for a Fullscreen box (~ the whole frame) it slides the whole picture off
            // the edge; for a small PiP box it slides just that corner box off.
            const brollSlideOffset = (dir, bx, by, bw, bh) => {
                if (dir === 'left') return { x: -(bx + bw), y: 0 };
                if (dir === 'right') return { x: (canvasW - bx), y: 0 };
                if (dir === 'top') return { x: 0, y: -(by + bh) };
                return { x: 0, y: (canvasH - by) }; // 'bottom' (also the fallback default)
            };

            state.brollOverlays.forEach((item) => {
                if (item.type !== 'text' && !item.imageImg) return;

                // Reset one-shot sound-effect flags whenever playback is well before
                // this item's start, so re-playing/looping over it triggers the
                // whoosh/pop/click again instead of only ever firing once.
                if (state.isPlaying && currentTime < item.startSec - 0.05) {
                    item._sfxEnterPlayed = false;
                    item._sfxExitPlayed = false;
                }

                // While paused in Step 3 we always show the overlay so it can be positioned/sized.
                // Once playing (in any step), respect the real start/end timing so preview matches export.
                const inRange = (state.currentStep === 3 && !state.isPlaying)
                    ? true
                    : (currentTime >= item.startSec && currentTime <= item.endSec);
                if (!inRange) return;

                const tIn = currentTime - item.startSec;
                const tOut = item.endSec - currentTime;
                const animDur = item.animationSpeedSec || 0.4;
                const resolvedExitDir = (!item.exitDirection || item.exitDirection === 'same')
                    ? (item.entryDirection || 'bottom')
                    : item.exitDirection;

                // Whether animations/sounds should actively play right now. They're only
                // suppressed when the user is parked in Step 3 WITHOUT playback (so the
                // overlay sits still and full-opacity for easy positioning/sizing). The
                // moment playback starts — even while still on Step 3 previewing the
                // B-roll they just added — animations and sound must run for real,
                // otherwise "testing" the effect right where you configure it looks broken.
                const brollAnimActive = !(state.currentStep === 3 && !state.isPlaying);

                // Fire entry/exit sound effects (Web Audio, synthesized — see audio.js)
                // in real time during actual playback/export, timed to line up with
                // the visual animation (exit sound starts right as the exit anim begins).
                if (state.isPlaying && item.soundEffect && item.soundEffect !== 'none') {
                    if (!item._sfxEnterPlayed && currentTime >= item.startSec) {
                        item._sfxEnterPlayed = true;
                        if (window.playBrollSfx) window.playBrollSfx(item.soundEffect);
                    }
                    if (!item._sfxExitPlayed && tOut <= animDur && currentTime < item.endSec) {
                        item._sfxExitPlayed = true;
                        if (window.playBrollSfx) window.playBrollSfx(item.soundEffect);
                    }
                }

                // ---- 1. Box rect: where/how big is the thing we're animating? ----
                // Fullscreen = the video frame's own draw rect. PiP = a small box
                // sized by its content and positioned by item.x/item.y (drag-anywhere).
                let boxX, boxY, boxW, boxH;
                if (item.mode === 'fullscreen') {
                    boxX = drawX; boxY = drawY; boxW = drawW; boxH = drawH;
                } else {
                    if (item.type === 'text') {
                        state.ctx.font = `bold ${item.fontSize}px "Hind Siliguri", "Plus Jakarta Sans", sans-serif`;
                        const metrics = state.ctx.measureText(item.text);
                        boxW = metrics.width + 32;
                        boxH = item.fontSize + 24;
                    } else {
                        boxW = canvasW * (item.size / 100);
                        boxH = boxW * (item.imageImg.naturalHeight / item.imageImg.naturalWidth);
                    }
                    boxX = item.x * canvasW;
                    boxY = item.y * canvasH;
                }

                // ---- 2. Resolve the animation transform (same style set, any box) ----
                const style = item.animationStyle || (item.mode === 'pip' ? 'slide-pop' : 'zoom');
                let alpha = 1, scaleAmt = 1, rotateAmt = 0, blurPx = 0, wipeFrac = 1;
                let offX = 0, offY = 0; // absolute px offset applied to the box during entry/exit

                if (brollAnimActive && style !== 'none') {
                    if (style === 'slide' || style === 'slide-pop') {
                        // Whole box slides in from the entry edge, holds, then slides out
                        // toward the exit edge. 'slide-pop' additionally scales up from
                        // 70% with a bouncy overshoot settle; 'slide' just glides in flat.
                        let eased = 1;
                        let dir = null;
                        if (tIn < animDur) {
                            eased = (style === 'slide-pop') ? easeOutBackOvershoot(Math.max(0, tIn / animDur)) : brollEaseOut(tIn / animDur);
                            dir = item.entryDirection || 'bottom';
                        } else if (tOut < animDur) {
                            eased = (style === 'slide-pop') ? easeOutBackOvershoot(Math.max(0, tOut / animDur)) : brollEaseOut(tOut / animDur);
                            dir = resolvedExitDir;
                        }
                        if (dir) {
                            const d = brollSlideOffset(dir, boxX, boxY, boxW, boxH);
                            offX = d.x * (1 - eased);
                            offY = d.y * (1 - eased);
                        }
                        if (style === 'slide-pop') {
                            scaleAmt = (tIn < animDur || tOut < animDur) ? (0.7 + 0.3 * eased) : 1;
                            alpha = Math.max(0.15, tIn < animDur ? eased : (tOut < animDur ? eased : 1));
                        }
                    } else if (style === 'wipe' || style === 'highlight-sweep' || style === 'comparison-slide') {
                        // Directional reveal: a growing clip rectangle wipes the box's
                        // content into view from the entry edge, then wipes it away on exit.
                        // 'highlight-sweep' reuses this exact reveal mechanic and additionally
                        // paints a translucent marker-color bar in step with it (see the
                        // drawing section below), so the content looks "highlighted on".
                        if (tIn < animDur) {
                            wipeFrac = brollEaseOut(tIn / animDur);
                        } else if (tOut < animDur) {
                            wipeFrac = brollEaseOut(tOut / animDur);
                        }
                    } else if (style === 'rotate-in') {
                        // Gentle spin-and-scale settle on the way in, mirrored on the way out.
                        if (tIn < animDur) {
                            const eased = brollEaseOut(tIn / animDur);
                            rotateAmt = (1 - eased) * (Math.PI / 10);
                            scaleAmt = 0.82 + 0.18 * eased;
                            alpha = Math.max(0, eased);
                        } else if (tOut < animDur) {
                            const eased = brollEaseOut(tOut / animDur);
                            rotateAmt = -(1 - eased) * (Math.PI / 10);
                            scaleAmt = 0.82 + 0.18 * eased;
                            alpha = Math.max(0, eased);
                        }
                    } else if (style === 'bounce-in' || style === 'bounce-drop') {
                        // Drops in from off the top edge with a bouncy overshoot landing,
                        // then bounces back out the same way at the end. ('bounce-drop' is
                        // kept as an alias of 'bounce-in' — same effect, old PiP name.)
                        if (tIn < animDur) {
                            const eased = easeOutBackOvershoot(Math.max(0, Math.min(1, tIn / animDur)));
                            offY = -(boxY + boxH) * (1 - eased);
                            alpha = Math.max(0.15, eased);
                        } else if (tOut < animDur) {
                            const eased = easeOutBackOvershoot(Math.max(0, Math.min(1, tOut / animDur)));
                            offY = -(boxY + boxH) * (1 - eased);
                            alpha = Math.max(0.15, eased);
                        }
                    } else if (style === 'spin-pop') {
                        // Spins in from a 60° offset while scaling up from 75%, settles flat.
                        if (tIn < animDur) {
                            const eased = easeOutBackOvershoot(Math.max(0, tIn / animDur));
                            rotateAmt = (1 - eased) * (Math.PI / 3);
                            scaleAmt = 0.75 + 0.25 * eased;
                            alpha = Math.max(0.15, eased);
                        } else if (tOut < animDur) {
                            const eased = easeOutBackOvershoot(Math.max(0, tOut / animDur));
                            rotateAmt = -(1 - eased) * (Math.PI / 3);
                            scaleAmt = 0.75 + 0.25 * eased;
                            alpha = Math.max(0.15, eased);
                        }
                    } else if (style === 'zoom-pop' || style === 'confetti-pop') {
                        // Quick pop-in scale from 70% with a bouncy overshoot — distinct
                        // from the slow continuous Ken Burns 'zoom' below. 'confetti-pop'
                        // reuses this exact box pop and additionally bursts colorful
                        // particles outward (drawn in the annotation section below).
                        if (tIn < animDur) {
                            const eased = easeOutBackOvershoot(Math.max(0, tIn / animDur));
                            scaleAmt = 0.7 + 0.3 * eased;
                            alpha = Math.max(0.15, eased);
                        } else if (tOut < animDur) {
                            const eased = easeOutBackOvershoot(Math.max(0, tOut / animDur));
                            scaleAmt = 0.7 + 0.3 * eased;
                            alpha = Math.max(0.15, eased);
                        }
                    } else if (style === 'blur-pop') {
                        // Starts heavily blurred and small, sharpens and scales up to settle.
                        if (tIn < animDur) {
                            const eased = brollEaseOut(tIn / animDur);
                            blurPx = Math.max(0, 1 - eased) * 10;
                            scaleAmt = 0.85 + 0.15 * eased;
                            alpha = Math.max(0, eased);
                        } else if (tOut < animDur) {
                            const eased = brollEaseOut(tOut / animDur);
                            blurPx = Math.max(0, 1 - eased) * 10;
                            scaleAmt = 0.85 + 0.15 * eased;
                            alpha = Math.max(0, eased);
                        }
                    } else if (style === 'typewriter') {
                        // No box-level fade-in — the character-by-character reveal drawn
                        // in the text block below sells the "typing in" effect on its own.
                        // Exit still fades out normally like everything else.
                        if (tOut < animDur) alpha = Math.max(0, tOut / animDur);
                    } else {
                        // 'fade', 'zoom', 'zoom-out', 'pan' and 'blur-focus' all fade
                        // in/out at the edges of the range; 'blur-focus' layers a
                        // sharpen-in/blur-out on top of that same fade envelope. The
                        // actual zoom/pan *motion* for images is applied separately
                        // below (it animates the source crop window, not the box).
                        if (tIn < animDur) alpha = Math.max(0, tIn / animDur);
                        if (tOut < animDur) alpha = Math.min(alpha, Math.max(0, tOut / animDur));
                        if (style === 'blur-focus') {
                            let blurP = 0;
                            if (tIn < animDur) blurP = Math.max(blurP, 1 - tIn / animDur);
                            if (tOut < animDur) blurP = Math.max(blurP, 1 - tOut / animDur);
                            blurPx = Math.max(0, Math.min(1, blurP)) * 14;
                        }
                        if ((style === 'zoom' || style === 'zoom-out') && item.type === 'text') {
                            // Images get a true Ken Burns source-crop zoom (below). For text
                            // there's no source image to crop, so 'zoom'/'zoom-out' instead
                            // continuously scale the text box itself over the item's full
                            // duration, growing (zoom) or shrinking-from-large (zoom-out).
                            const totalDur = Math.max(0.01, item.endSec - item.startSec);
                            const p = Math.max(0, Math.min(1, tIn / totalDur));
                            scaleAmt = (style === 'zoom-out') ? (1.18 - 0.18 * p) : (1 + 0.18 * p);
                        }
                    }
                }

                // ---- 3. Draw: box transform (position/scale/rotate/blur/alpha) is the
                // same regardless of mode; only the content differs (text vs image, and
                // for images, whether we additionally animate the source crop window). ----
                const drawBoxX = boxX + offX;
                const drawBoxY = boxY + offY;

                state.ctx.save();
                state.ctx.globalAlpha = alpha;
                if (blurPx > 0.1) state.ctx.filter = `blur(${blurPx.toFixed(1)}px)`;

                const cx = drawBoxX + boxW / 2;
                const cy = drawBoxY + boxH / 2;
                if (rotateAmt !== 0 || scaleAmt !== 1) {
                    state.ctx.translate(cx, cy);
                    if (rotateAmt !== 0) state.ctx.rotate(rotateAmt);
                    state.ctx.scale(scaleAmt, scaleAmt);
                    state.ctx.translate(-cx, -cy);
                }
                if (wipeFrac < 0.999) {
                    state.ctx.beginPath();
                    state.ctx.rect(drawBoxX, drawBoxY, boxW * Math.max(0, wipeFrac), boxH);
                    state.ctx.clip();
                }

                if (style === 'highlight-sweep') {
                    // Translucent marker-color bar painted behind the content. It's
                    // drawn at full box size but the clip rect above (driven by the
                    // same wipeFrac as 'wipe') restricts it to exactly the revealed
                    // sliver, so it grows in lockstep with the content reveal.
                    state.ctx.fillStyle = (item.type === 'text') ? 'rgba(250, 204, 21, 0.55)' : 'rgba(250, 204, 21, 0.35)';
                    state.ctx.fillRect(drawBoxX - 6, drawBoxY - 6, boxW + 12, boxH + 12);
                }

                if (item.type === 'text') {
                    if (item.mode === 'fullscreen') {
                        // Dark scrim behind the text so it reads over any video content
                        state.ctx.fillStyle = 'rgba(0,0,0,0.45)';
                        state.ctx.fillRect(drawBoxX, drawBoxY, boxW, boxH);
                    } else {
                        state.ctx.fillStyle = 'rgba(0,0,0,0.55)';
                        if (state.ctx.roundRect) {
                            state.ctx.beginPath();
                            state.ctx.roundRect(drawBoxX, drawBoxY, boxW, boxH, 10);
                            state.ctx.fill();
                        } else {
                            state.ctx.fillRect(drawBoxX, drawBoxY, boxW, boxH);
                        }
                    }
                    state.ctx.font = `bold ${item.fontSize}px "Hind Siliguri", "Plus Jakarta Sans", sans-serif`;
                    state.ctx.fillStyle = item.color;
                    state.ctx.textBaseline = 'middle';

                    // Typewriter Reveal (v2.6): only ever reveals characters left-to-right
                    // during entry, so it needs a fixed left anchor rather than the usual
                    // center alignment (centering a growing substring would jitter/re-center
                    // every frame instead of visually "typing" in place).
                    let renderText = item.text;
                    let typewriterActive = false;
                    let cursorX = cx, cursorTop = cy, cursorBottom = cy;
                    if (style === 'typewriter' && brollAnimActive && tIn < animDur) {
                        typewriterActive = true;
                        const fullWidth = state.ctx.measureText(item.text).width;
                        const leftX = cx - fullWidth / 2;
                        const revealCount = Math.max(0, Math.min(item.text.length, Math.round(item.text.length * Math.max(0, Math.min(1, tIn / animDur)))));
                        renderText = item.text.slice(0, revealCount);
                        state.ctx.textAlign = 'left';
                        if (item.mode === 'fullscreen') {
                            state.ctx.lineWidth = Math.max(2, item.fontSize * 0.08);
                            state.ctx.strokeStyle = 'rgba(0,0,0,0.55)';
                            state.ctx.strokeText(renderText, leftX, cy);
                        }
                        state.ctx.fillText(renderText, leftX, cy);
                        cursorX = leftX + state.ctx.measureText(renderText).width + Math.max(2, item.fontSize * 0.04);
                        cursorTop = cy - item.fontSize * 0.42;
                        cursorBottom = cy + item.fontSize * 0.42;
                    } else {
                        state.ctx.textAlign = 'center';
                        if (item.mode === 'fullscreen') {
                            state.ctx.lineWidth = Math.max(2, item.fontSize * 0.08);
                            state.ctx.strokeStyle = 'rgba(0,0,0,0.55)';
                            state.ctx.strokeText(renderText, cx, cy);
                        }
                        state.ctx.fillText(renderText, cx, cy);
                    }

                    // Blinking cursor while the text is still being "typed". Blink phase
                    // is driven by the deterministic timeline clock (currentTime), not
                    // wall-clock time, so exported video frames stay consistent.
                    if (typewriterActive && renderText.length < item.text.length && Math.floor(currentTime * 2.5) % 2 === 0) {
                        state.ctx.save();
                        state.ctx.strokeStyle = item.color;
                        state.ctx.lineWidth = Math.max(2, item.fontSize * 0.07);
                        state.ctx.lineCap = 'round';
                        state.ctx.beginPath();
                        state.ctx.moveTo(cursorX, cursorTop);
                        state.ctx.lineTo(cursorX, cursorBottom);
                        state.ctx.stroke();
                        state.ctx.restore();
                    }
                } else {
                    // Cover the box, preserving aspect ratio (fill/crop).
                    const imgAspect = item.imageImg.naturalWidth / item.imageImg.naturalHeight;
                    const boxAspect = boxW / boxH;
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
                    if (brollAnimActive && (style === 'zoom' || style === 'zoom-out')) {
                        // 'zoom' grows to 18% zoomed-in by the end; 'zoom-out' starts
                        // 18% zoomed-in and eases back down to normal. Works identically
                        // for a Fullscreen frame or a small PiP box — it just crops a
                        // little tighter into whichever source region is being shown.
                        const totalDur = Math.max(0.01, item.endSec - item.startSec);
                        const zoomProgress = Math.max(0, Math.min(1, tIn / totalDur));
                        const zoom = style === 'zoom-out'
                            ? (1.18 - 0.18 * zoomProgress)
                            : (1 + 0.18 * zoomProgress);
                        const newSw = sw / zoom, newSh = sh / zoom;
                        sx += (sw - newSw) / 2;
                        sy += (sh - newSh) / 2;
                        sw = newSw; sh = newSh;
                    } else if (brollAnimActive && style === 'pan') {
                        // Ken Burns pan: slides the crop window across whatever slack
                        // space is left after the aspect-fit crop above, using the
                        // entry direction to pick which way it pans.
                        const totalDur = Math.max(0.01, item.endSec - item.startSec);
                        const panProgress = Math.max(0, Math.min(1, tIn / totalDur));
                        const dirSign = (item.entryDirection === 'right' || item.entryDirection === 'bottom') ? -1 : 1;
                        const slackW = item.imageImg.naturalWidth - sw;
                        const slackH = item.imageImg.naturalHeight - sh;
                        if (slackW > 1) {
                            sx = Math.max(0, Math.min(slackW, (slackW / 2) + dirSign * (slackW / 2) * (panProgress * 2 - 1)));
                        } else if (slackH > 1) {
                            sy = Math.max(0, Math.min(slackH, (slackH / 2) + dirSign * (slackH / 2) * (panProgress * 2 - 1)));
                        }
                    }
                    if (item.mode === 'pip') {
                        state.ctx.fillStyle = 'rgba(0,0,0,0.25)';
                        state.ctx.fillRect(drawBoxX - 4, drawBoxY - 4, boxW + 8, boxH + 8);
                    }
                    if (style === 'comparison-slide' && item.imageImgAfter) {
                        // Comparison Slide - Split rendering of Before & After images
                        const divFrac = wipeFrac; // progress from 0.0 to 1.0
                        
                        // 1. Draw Before Image (Left portion)
                        state.ctx.save();
                        state.ctx.beginPath();
                        state.ctx.rect(drawBoxX, drawBoxY, boxW * divFrac, boxH);
                        state.ctx.clip();
                        state.ctx.drawImage(item.imageImg, sx, sy, sw, sh, drawBoxX, drawBoxY, boxW, boxH);
                        state.ctx.restore();
                        
                        // 2. Draw After Image (Right portion)
                        state.ctx.save();
                        state.ctx.beginPath();
                        state.ctx.rect(drawBoxX + boxW * divFrac, drawBoxY, boxW * (1 - divFrac), boxH);
                        state.ctx.clip();
                        
                        const imgAspectAfter = item.imageImgAfter.naturalWidth / item.imageImgAfter.naturalHeight;
                        let sxA, syA, swA, shA;
                        if (imgAspectAfter > boxAspect) {
                            shA = item.imageImgAfter.naturalHeight;
                            swA = shA * boxAspect;
                            sxA = (item.imageImgAfter.naturalWidth - swA) / 2;
                            syA = 0;
                        } else {
                            swA = item.imageImgAfter.naturalWidth;
                            shA = swA / boxAspect;
                            sxA = 0;
                            syA = (item.imageImgAfter.naturalHeight - shA) / 2;
                        }
                        
                        // Apply zoom/pan if active to keep them synced
                        if (brollAnimActive && (style === 'zoom' || style === 'zoom-out')) {
                            const totalDur = Math.max(0.01, item.endSec - item.startSec);
                            const zoomProgress = Math.max(0, Math.min(1, tIn / totalDur));
                            const zoom = style === 'zoom-out' ? (1.18 - 0.18 * zoomProgress) : (1 + 0.18 * zoomProgress);
                            const newSwA = swA / zoom, newShA = shA / zoom;
                            sxA += (swA - newSwA) / 2;
                            syA += (shA - newShA) / 2;
                            swA = newSwA; shA = newShA;
                        }
                        
                        state.ctx.drawImage(item.imageImgAfter, sxA, syA, swA, shA, drawBoxX, drawBoxY, boxW, boxH);
                        state.ctx.restore();
                    } else {
                        // Normal drawing of one image
                        state.ctx.drawImage(item.imageImg, sx, sy, sw, sh, drawBoxX, drawBoxY, boxW, boxH);
                    }
                }

                // Hand-drawn-style annotation markers (v2.5) — layered on top of the
                // content after it's painted, growing in sync with the entry (and
                // shrinking back out on exit) so they feel "drawn on" rather than
                // just appearing instantly.
                if (brollAnimActive && (style === 'circle-highlight' || style === 'underline-draw' || style === 'checkmark-pop' || style === 'thinking-character' || style === 'arrow-point' || style === 'magnifier-zoom' || style === 'question-bounce' || style === 'confetti-pop')) {
                    let annoP = 1;
                    if (tIn < animDur) annoP = brollEaseOut(tIn / animDur);
                    else if (tOut < animDur) annoP = brollEaseOut(tOut / animDur);

                    if (annoP > 0.01) {
                        const markColor = (item.type === 'text') ? item.color : '#fbbf24';
                        if (style === 'circle-highlight') {
                            // A slightly-imperfect ellipse "circled" around the box, drawn as a
                            // growing arc so it looks hand-drawn rather than a static ring.
                            const rx = boxW / 2 * 1.18, ry = boxH / 2 * 1.45;
                            const ecx = drawBoxX + boxW / 2, ecy = drawBoxY + boxH / 2;
                            state.ctx.strokeStyle = markColor;
                            state.ctx.lineWidth = Math.max(3, Math.min(boxW, boxH) * 0.05);
                            state.ctx.lineCap = 'round';
                            state.ctx.beginPath();
                            const startAngle = -Math.PI / 2 - 0.25;
                            // Goes slightly past a full loop (2π + a bit) at full progress so the
                            // stroke visibly overlaps its own start, like a real marker circle.
                            state.ctx.ellipse(ecx, ecy, Math.max(1, rx), Math.max(1, ry), 0, startAngle, startAngle + annoP * (Math.PI * 2 + 0.5));
                            state.ctx.stroke();
                        } else if (style === 'underline-draw') {
                            const uy = drawBoxY + boxH + Math.max(4, boxH * 0.12);
                            const ux1 = drawBoxX + boxW * 0.04;
                            const ux2 = ux1 + (boxW * 0.92) * annoP;
                            state.ctx.strokeStyle = markColor;
                            state.ctx.lineWidth = Math.max(3, boxH * 0.07);
                            state.ctx.lineCap = 'round';
                            state.ctx.beginPath();
                            state.ctx.moveTo(ux1, uy);
                            state.ctx.lineTo(ux2, uy);
                            state.ctx.stroke();
                        } else if (style === 'checkmark-pop') {
                            const csize = Math.max(10, Math.min(boxW, boxH) * 0.55) * easeOutBackOvershoot(annoP);
                            const ccx = drawBoxX + boxW - csize * 0.25;
                            const ccy = drawBoxY - csize * 0.05;
                            state.ctx.fillStyle = '#22c55e';
                            state.ctx.beginPath();
                            state.ctx.arc(ccx, ccy, csize / 2, 0, Math.PI * 2);
                            state.ctx.fill();
                            state.ctx.strokeStyle = '#ffffff';
                            state.ctx.lineWidth = Math.max(2, csize * 0.13);
                            state.ctx.lineCap = 'round';
                            state.ctx.lineJoin = 'round';
                            state.ctx.beginPath();
                            state.ctx.moveTo(ccx - csize * 0.22, ccy);
                            state.ctx.lineTo(ccx - csize * 0.04, ccy + csize * 0.20);
                            state.ctx.lineTo(ccx + csize * 0.26, ccy - csize * 0.22);
                            state.ctx.stroke();
                        } else if (style === 'thinking-character') {
                            // A small "thinking" bubble that pops into the top-right corner
                            // with a 🤔 face and two trailing dots, like a thought bubble,
                            // then pops back out — a lightweight "hmm, let's see..." beat.
                            const bubbleR = Math.max(16, Math.min(boxW, boxH) * 0.16) * easeOutBackOvershoot(annoP);
                            const bcx = drawBoxX + boxW - bubbleR * 0.4;
                            const bcy = drawBoxY - bubbleR * 0.4;
                            state.ctx.fillStyle = 'rgba(255,255,255,0.95)';
                            state.ctx.strokeStyle = 'rgba(0,0,0,0.18)';
                            state.ctx.lineWidth = 1.5;
                            [0.85, 1.55].forEach((offMul, i) => {
                                const tr = bubbleR * (0.22 - i * 0.08);
                                if (tr <= 0) return;
                                state.ctx.beginPath();
                                state.ctx.arc(bcx - bubbleR * offMul, bcy + bubbleR * offMul, tr, 0, Math.PI * 2);
                                state.ctx.fill();
                                state.ctx.stroke();
                            });
                            state.ctx.beginPath();
                            state.ctx.arc(bcx, bcy, bubbleR, 0, Math.PI * 2);
                            state.ctx.fill();
                            state.ctx.stroke();
                            state.ctx.font = `${Math.max(10, Math.round(bubbleR * 1.15))}px sans-serif`;
                            state.ctx.textAlign = 'center';
                            state.ctx.textBaseline = 'middle';
                            state.ctx.fillText('🤔', bcx, bcy - bubbleR * 0.04);
                        } else if (style === 'arrow-point') {
                            // A hand-drawn-style arrow that flies in from the chosen entry
                            // direction and points at the box, then retracts the same way
                            // on exit — good for calling attention to a specific B-roll.
                            const dir = item.entryDirection || 'bottom';
                            const ecx2 = drawBoxX + boxW / 2, ecy2 = drawBoxY + boxH / 2;
                            const reach = Math.max(boxW, boxH) * 0.55;
                            const gap = Math.max(10, Math.min(boxW, boxH) * 0.06);
                            let tipX, tipY, tailX, tailY;
                            if (dir === 'left') {
                                tipX = drawBoxX - gap; tipY = ecy2;
                                tailX = tipX - reach * annoP; tailY = tipY;
                            } else if (dir === 'right') {
                                tipX = drawBoxX + boxW + gap; tipY = ecy2;
                                tailX = tipX + reach * annoP; tailY = tipY;
                            } else if (dir === 'top') {
                                tipX = ecx2; tipY = drawBoxY - gap;
                                tailX = tipX; tailY = tipY - reach * annoP;
                            } else {
                                tipX = ecx2; tipY = drawBoxY + boxH + gap;
                                tailX = tipX; tailY = tipY + reach * annoP;
                            }
                            state.ctx.strokeStyle = markColor;
                            state.ctx.fillStyle = markColor;
                            state.ctx.lineWidth = Math.max(3, Math.min(boxW, boxH) * 0.045);
                            state.ctx.lineCap = 'round';
                            state.ctx.beginPath();
                            state.ctx.moveTo(tailX, tailY);
                            state.ctx.lineTo(tipX, tipY);
                            state.ctx.stroke();
                            const ang = Math.atan2(tipY - tailY, tipX - tailX);
                            const headLen = Math.max(8, Math.min(boxW, boxH) * 0.14);
                            state.ctx.beginPath();
                            state.ctx.moveTo(tipX, tipY);
                            state.ctx.lineTo(tipX - headLen * Math.cos(ang - Math.PI / 7), tipY - headLen * Math.sin(ang - Math.PI / 7));
                            state.ctx.lineTo(tipX - headLen * Math.cos(ang + Math.PI / 7), tipY - headLen * Math.sin(ang + Math.PI / 7));
                            state.ctx.closePath();
                            state.ctx.fill();
                        } else if (style === 'magnifier-zoom') {
                            // A 🔍 badge pops into the bottom-right corner with a bouncy
                            // overshoot, like someone circled the B-roll and said "look here".
                            const msize = Math.max(16, Math.min(boxW, boxH) * 0.45) * easeOutBackOvershoot(annoP);
                            const mcx = drawBoxX + boxW - msize * 0.4;
                            const mcy = drawBoxY + boxH - msize * 0.4;
                            state.ctx.font = `${Math.max(10, Math.round(msize))}px sans-serif`;
                            state.ctx.textAlign = 'center';
                            state.ctx.textBaseline = 'middle';
                            state.ctx.fillText('🔍', mcx, mcy);
                        } else if (style === 'question-bounce') {
                            // A ❓ badge bounces into the top-left corner — pairs well with
                            // "wait, what?" or confusion beats in a script.
                            const qsize = Math.max(16, Math.min(boxW, boxH) * 0.45) * easeOutBackOvershoot(annoP);
                            const qcx = drawBoxX + qsize * 0.4;
                            const qcy = drawBoxY - qsize * 0.15;
                            state.ctx.font = `${Math.max(10, Math.round(qsize))}px sans-serif`;
                            state.ctx.textAlign = 'center';
                            state.ctx.textBaseline = 'middle';
                            state.ctx.fillText('❓', qcx, qcy);
                        } else if (style === 'confetti-pop') {
                            // One-shot celebratory particle burst timed to the entry pop
                            // handled in the transform section above. Entry-only by design —
                            // exit just uses the normal pop-out, no second burst.
                            if (tIn < animDur) {
                                const burstP = Math.max(0, Math.min(1, tIn / animDur));
                                const particleAlpha = 1 - Math.pow(burstP, 2.2);
                                if (particleAlpha > 0.02) {
                                    const pcx = drawBoxX + boxW / 2, pcy = drawBoxY + boxH / 2;
                                    const maxDist = Math.max(boxW, boxH) * 0.75;
                                    const palette = ['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#c084fc', '#f472b6'];
                                    const N = 14;
                                    state.ctx.save();
                                    state.ctx.globalAlpha = particleAlpha;
                                    for (let i = 0; i < N; i++) {
                                        // Deterministic pseudo-random spread per particle index
                                        // (not Math.random) so exported video frames stay
                                        // identical across repeated renders of the same timeline.
                                        const seedAngle = (i / N) * Math.PI * 2 + (i % 3) * 0.35;
                                        const seedDist = (0.5 + ((i * 37) % 50) / 100) * maxDist * burstP;
                                        const px = pcx + Math.cos(seedAngle) * seedDist;
                                        const py = pcy + Math.sin(seedAngle) * seedDist - (burstP * burstP) * 14;
                                        const psize = Math.max(2, Math.min(boxW, boxH) * 0.035);
                                        const rot = seedAngle * 3 + burstP * 6;
                                        state.ctx.save();
                                        state.ctx.translate(px, py);
                                        state.ctx.rotate(rot);
                                        state.ctx.fillStyle = palette[i % palette.length];
                                        state.ctx.fillRect(-psize / 2, -psize / 3, psize, psize * 0.66);
                                        state.ctx.restore();
                                    }
                                    state.ctx.restore();
                                }
                            }
                        }
                    }
                }

                // Selection box in Step 3 for the active B-roll item being edited (PiP only —
                // Fullscreen items cover the whole frame so an outline wouldn't be useful).
                if (state.currentStep === 3 && item.mode === 'pip' && item.id === state.selectedBrollId) {
                    state.ctx.strokeStyle = 'rgba(79, 70, 229, 0.9)';
                    state.ctx.lineWidth = 2;
                    state.ctx.setLineDash([6, 4]);
                    state.ctx.strokeRect(drawBoxX, drawBoxY, boxW, boxH);
                    state.ctx.setLineDash([]);
                }

                state.ctx.restore();

                // Comparison Slide (Before/After) divider handle — drawn unclipped
                // (after the box's own restore above) so the handle circle isn't cut
                // off by the wipe-reveal clip. Reuses the same wipeFrac reveal as
                // 'wipe'/'highlight-sweep': since a B-roll item is a single image,
                // this reads as a before/after slider revealing that one image
                // left-to-right rather than a true two-image comparison.
                if (style === 'comparison-slide' && wipeFrac > 0.01 && wipeFrac < 0.999) {
                    const divX = boxX + offX + boxW * wipeFrac;
                    const dTop = boxY + offY, dBottom = dTop + boxH;
                    state.ctx.save();
                    state.ctx.strokeStyle = 'rgba(255,255,255,0.95)';
                    state.ctx.lineWidth = Math.max(2, boxW * 0.006);
                    state.ctx.beginPath();
                    state.ctx.moveTo(divX, dTop);
                    state.ctx.lineTo(divX, dBottom);
                    state.ctx.stroke();
                    const hr = Math.max(9, Math.min(boxW, boxH) * 0.06);
                    const hcy = (dTop + dBottom) / 2;
                    state.ctx.fillStyle = 'rgba(255,255,255,0.95)';
                    state.ctx.beginPath();
                    state.ctx.arc(divX, hcy, hr, 0, Math.PI * 2);
                    state.ctx.fill();
                    state.ctx.strokeStyle = 'rgba(0,0,0,0.25)';
                    state.ctx.lineWidth = 1.5;
                    state.ctx.stroke();
                    // Little left/right chevrons on the handle, like a real slider control
                    state.ctx.strokeStyle = 'rgba(60,60,60,0.85)';
                    state.ctx.lineWidth = Math.max(1.5, hr * 0.16);
                    state.ctx.lineCap = 'round';
                    state.ctx.beginPath();
                    state.ctx.moveTo(divX - hr * 0.35, hcy - hr * 0.35);
                    state.ctx.lineTo(divX - hr * 0.75, hcy);
                    state.ctx.lineTo(divX - hr * 0.35, hcy + hr * 0.35);
                    state.ctx.moveTo(divX + hr * 0.35, hcy - hr * 0.35);
                    state.ctx.lineTo(divX + hr * 0.75, hcy);
                    state.ctx.lineTo(divX + hr * 0.35, hcy + hr * 0.35);
                    state.ctx.stroke();
                    state.ctx.restore();
                }
            });
        }

        // --- Step B: Draw Facebook Top & Bottom Banners ---
        // (Rendered after B-roll so banners always appear on top of fullscreen images)
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

        // --- Step B2: Draw News Ticker (right-to-left scrolling headline strip) ---
        // (Rendered after B-roll so ticker always appears on top of fullscreen images)
        if (state.tickerEnabled && (state.tickerText || state.tickerLabel)) {
            const tickerH = Math.max(24, canvasH * (state.tickerHeightPercent / 100));
            const tickerY = state.tickerPosition === 'top' ? 0 : canvasH - tickerH;

            state.ctx.save();

            // Background strip
            state.ctx.fillStyle = state.tickerBgColor;
            state.ctx.fillRect(0, tickerY, canvasW, tickerH);

            // Optional fixed "BREAKING" style tag on the left edge
            let labelW = 0;
            if (state.tickerLabel) {
                state.ctx.font = `bold ${Math.round(state.tickerFontSize * 0.95)}px "Hind Siliguri", "Plus Jakarta Sans", sans-serif`;
                const metrics = state.ctx.measureText(state.tickerLabel);
                labelW = metrics.width + tickerH * 0.7;
                state.ctx.fillStyle = 'rgba(0,0,0,0.35)';
                state.ctx.fillRect(0, tickerY, labelW, tickerH);
                state.ctx.fillStyle = state.tickerTextColor;
                state.ctx.textAlign = 'left';
                state.ctx.textBaseline = 'middle';
                state.ctx.fillText(state.tickerLabel, tickerH * 0.35, tickerY + tickerH / 2);
            }

            if (state.tickerText) {
                state.ctx.beginPath();
                state.ctx.rect(labelW, tickerY, canvasW - labelW, tickerH);
                state.ctx.clip();

                state.ctx.font = `600 ${state.tickerFontSize}px "Hind Siliguri", "Plus Jakarta Sans", sans-serif`;
                state.ctx.fillStyle = state.tickerTextColor;
                state.ctx.textAlign = 'left';
                state.ctx.textBaseline = 'middle';

                const textW = state.ctx.measureText(state.tickerText).width;
                const gap = Math.max(60, canvasW * 0.15);
                const cycleW = textW + gap;
                const speed = Math.max(10, state.tickerSpeed || 90);
                const elapsed = state.currentTime || 0;
                const offset = (elapsed * speed) % cycleW;
                let x = canvasW - offset;
                while (x + textW > labelW) {
                    if (x < canvasW) {
                        state.ctx.fillText(state.tickerText, x, tickerY + tickerH / 2);
                    }
                    x -= cycleW;
                }
            }

            state.ctx.restore();
        }

        // --- Step C: Draw Watermark Logo ---
        // (Rendered after B-roll so logo always appears on top of fullscreen images)
        if (state.logoImg) {
            const logoW = canvasW * (state.logoSize / 100);
            const logoH = logoW * (state.logoImg.naturalHeight / state.logoImg.naturalWidth);
            
            const x = state.logoX * canvasW;
            const y = state.logoY * canvasH;
            
            state.ctx.save();
            state.ctx.globalAlpha = state.logoOpacity;
            state.ctx.drawImage(state.logoImg, x, y, logoW, logoH);
            
            if (state.currentStep === 2) {
                state.ctx.strokeStyle = 'rgba(79, 70, 229, 0.8)';
                state.ctx.lineWidth = 2;
                state.ctx.strokeRect(x, y, logoW, logoH);
                state.ctx.fillStyle = '#ffffff';
                state.ctx.fillRect(x + logoW - 6, y + logoH - 6, 12, 12);
                state.ctx.strokeStyle = '#4f46e5';
                state.ctx.strokeRect(x + logoW - 6, y + logoH - 6, 12, 12);
            }
            state.ctx.restore();
        }
        
        // --- Step D: Draw Visual Progress Bar ---
        // (Rendered after B-roll so progress bar always appears on top of fullscreen images)
        if (state.enableProgressBar) {
            const progress = state.currentTime / state.duration;
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

        // --- Step F: Draw Text Overlays (Phase 2C) ---
        if (state.textOverlays && state.textOverlays.length > 0) {
            const currentTime = state.currentTime;
            state.textOverlays.forEach((item) => {
                const isVisible = (state.currentStep === 3 && !state.isPlaying)
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

                // Selection box in Step 3 for the active overlay being edited
                if (state.currentStep === 3 && item.id === state.selectedTextOverlayId) {
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
            const currentTime = state.currentTime;
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
        if (state.currentStep !== 2 && state.currentStep !== 3) return;

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

        const coords = getCanvasCoords(e);
        const canvasW = state.canvas.width;
        const canvasH = state.canvas.height;

        // Logo behavior
        if (state.logoImg) {
            const check = isPointerOnLogo(coords);
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
        }

        // B-roll PiP drag/select (Phase 5D) — checked before text overlay
        if (state.brollOverlays && state.brollOverlays.length > 0) {
            const brollHit = findBrollPipAt(coords);
            if (brollHit) {
                state.selectedBrollId = brollHit.id;
                state.isDraggingBroll = true;

                if (brollHit.mode === 'fullscreen') {
                    brollHit.mode = 'pip';
                    brollHit.size = 35; // Default PiP size
                    
                    // Center the PiP box on click coordinate
                    let pw = canvasW * 0.35;
                    let ph = pw;
                    if (brollHit.type === 'text') {
                        state.ctx.font = `bold ${brollHit.fontSize}px "Hind Siliguri", "Plus Jakarta Sans", sans-serif`;
                        const metrics = state.ctx.measureText(brollHit.text);
                        pw = metrics.width + 32;
                        ph = brollHit.fontSize + 24;
                    } else if (brollHit.imageImg) {
                        ph = pw * (brollHit.imageImg.naturalHeight / brollHit.imageImg.naturalWidth);
                    }
                    brollHit.x = (coords.x - pw / 2) / canvasW;
                    brollHit.y = (coords.y - ph / 2) / canvasH;
                    
                    // Sync the sidebar controls to reflect these new values
                    if (brollModeSelect) brollModeSelect.value = 'pip';
                    if (brollSizeSlider) brollSizeSlider.value = 35;
                    if (brollSizeVal) brollSizeVal.innerText = '35%';
                    if (brollSizeContainer) brollSizeContainer.style.display = 'block';
                    renderBrollList();
                }

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
            if (item.type !== 'text' && !item.imageImg) continue;

            let px, py, pipW, pipH;

            if (item.mode === 'fullscreen') {
                if (item.type === 'text') {
                    // Fullscreen text is centered
                    state.ctx.font = `bold ${item.fontSize}px "Hind Siliguri", "Plus Jakarta Sans", sans-serif`;
                    const metrics = state.ctx.measureText(item.text);
                    pipW = metrics.width + 32;
                    pipH = item.fontSize + 24;
                    px = (canvasW - pipW) / 2;
                    py = (canvasH - pipH) / 2;
                } else {
                    // Fullscreen image covers the whole canvas
                    px = 0;
                    py = 0;
                    pipW = canvasW;
                    pipH = canvasH;
                }
            } else {
                // PiP mode
                if (item.type === 'text') {
                    state.ctx.font = `bold ${item.fontSize}px "Hind Siliguri", "Plus Jakarta Sans", sans-serif`;
                    const metrics = state.ctx.measureText(item.text);
                    pipW = metrics.width + 32;
                    pipH = item.fontSize + 24;
                } else {
                    pipW = canvasW * (item.size / 100);
                    pipH = pipW * (item.imageImg.naturalHeight / item.imageImg.naturalWidth);
                }
                px = item.x * canvasW;
                py = item.y * canvasH;
            }

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
        if (state.currentStep !== 2 && state.currentStep !== 3) return;

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

        // Idle cursor feedback over logo / B-roll PiP box / text overlay — shows a
        // "move" hand the instant the pointer is over something draggable, so the
        // drag-anywhere behavior is obvious without needing to read any help text.
        const idleCoords = getCanvasCoords(e);
        if (state.logoImg) {
            const check = isPointerOnLogo(idleCoords);
            if (check.isResize) {
                state.canvas.style.cursor = 'nwse-resize';
                return;
            } else if (check.isOver) {
                state.canvas.style.cursor = 'move';
                return;
            }
        }
        if (state.brollOverlays && state.brollOverlays.length > 0 && findBrollPipAt(idleCoords)) {
            state.canvas.style.cursor = 'move';
            return;
        }
        if (state.textOverlays && state.textOverlays.length > 0 && findTextOverlayAt(idleCoords)) {
            state.canvas.style.cursor = 'move';
            return;
        }
        state.canvas.style.cursor = 'default';
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
            syncCropToActiveClip();
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
        syncCropToActiveClip();
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

    // --- Shared position-preset helpers (Text Overlay + B-roll) ---
    // A small margin from the canvas edge so items don't sit flush against the border.
    const POSITION_MARGIN = 0.06;

    // For center-anchored items (Text Overlay draws with textAlign 'center' / textBaseline 'middle')
    function presetCenterFrac(presetKey) {
        const [vPart, hPart] = presetKey.split('-');
        const xMap = { left: POSITION_MARGIN, center: 0.5, right: 1 - POSITION_MARGIN };
        const yMap = { top: POSITION_MARGIN, middle: 0.5, bottom: 1 - POSITION_MARGIN };
        return { x: xMap[hPart], y: yMap[vPart] };
    }

    // For top-left-anchored items (B-roll PiP boxes), accounting for the box's own size
    // so "bottom-right" etc. actually tucks the whole box into that corner.
    function presetTopLeftFrac(presetKey, wFrac, hFrac) {
        const [vPart, hPart] = presetKey.split('-');
        const xMap = { left: POSITION_MARGIN, center: 0.5 - wFrac / 2, right: 1 - POSITION_MARGIN - wFrac };
        const yMap = { top: POSITION_MARGIN, middle: 0.5 - hFrac / 2, bottom: 1 - POSITION_MARGIN - hFrac };
        return { x: xMap[hPart], y: yMap[vPart] };
    }

    const textOverlayPositionGrid = document.getElementById('text-overlay-position-grid');
    if (textOverlayPositionGrid) {
        textOverlayPositionGrid.addEventListener('click', (e) => {
            const btn = e.target.closest('.pos-btn');
            if (!btn) return;
            const item = state.textOverlays.find(t => t.id === state.selectedTextOverlayId);
            if (!item) return;
            const { x, y } = presetCenterFrac(btn.dataset.pos);
            item.x = x;
            item.y = y;
            drawFrame();
        });
    }

    // --- B-roll / Topic Image Overlay Bindings (Phase 5D) ---
    const brollTypeToggle = document.getElementById('broll-type-toggle');
    const brollImageInputSection = document.getElementById('broll-image-input-section');
    const brollTextInputSection = document.getElementById('broll-text-input-section');
    const brollTextInput = document.getElementById('broll-text-input');
    const brollTextFontsizeSlider = document.getElementById('broll-text-fontsize');
    const brollTextFontsizeVal = document.getElementById('broll-text-fontsize-val');
    const brollTextColorInput = document.getElementById('broll-text-color');
    const brollTextColorVal = document.getElementById('broll-text-color-val');
    const addBrollTextBtn = document.getElementById('add-broll-text-btn');


    let brollAddType = 'image';
    if (brollTypeToggle) {
        brollTypeToggle.addEventListener('click', (e) => {
            const btn = e.target.closest('.segmented-btn');
            if (!btn) return;
            brollAddType = btn.dataset.type;
            brollTypeToggle.querySelectorAll('.segmented-btn').forEach(b => b.classList.toggle('active', b === btn));
            if (brollImageInputSection) brollImageInputSection.style.display = brollAddType === 'image' ? 'block' : 'none';
            if (brollTextInputSection) brollTextInputSection.style.display = brollAddType === 'text' ? 'block' : 'none';
        });
    }

    if (brollTextFontsizeSlider) {
        brollTextFontsizeSlider.addEventListener('input', (e) => {
            brollTextFontsizeVal.innerText = e.target.value + 'px';
        });
    }
    if (brollTextColorInput) {
        brollTextColorInput.addEventListener('input', (e) => {
            brollTextColorVal.innerText = e.target.value;
        });
    }

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
    const brollAnimStyleSelect = document.getElementById('broll-anim-style');
    const brollDirectionRow = document.getElementById('broll-direction-row');
    const brollExitDirectionRow = document.getElementById('broll-exit-direction-row');
    const brollEntryDirSelect = document.getElementById('broll-entry-dir');
    const brollExitDirSelect = document.getElementById('broll-exit-dir');
    const brollAnimSpeedSlider = document.getElementById('broll-anim-speed');
    const brollAnimSpeedVal = document.getElementById('broll-anim-speed-val');
    const brollSoundEffectSelect = document.getElementById('broll-sound-effect');

    // Continuous speed slider (1 = slowest, 100 = fastest) <-> animation duration in
    // seconds. Replaces the old 3-option Fast/Normal/Slow dropdown with a YouTube-volume
    // style drag bar so the person can dial in exactly how snappy the entry/exit feels.
    // Slow end raised from 1.2s to 2.6s (v2.6) — at the old cap, even the slowest setting
    // still read as "fast" for entry/exit animations; 2.6s gives a real slow-motion feel.
    function brollSpeedValueToSec(value) {
        const v = Math.max(1, Math.min(100, value));
        return 2.6 - ((v - 1) / 99) * (2.6 - 0.15);
    }
    function brollSpeedSecToValue(sec) {
        const s = Math.max(0.15, Math.min(2.6, sec || 0.4));
        return Math.round(1 + ((2.6 - s) / (2.6 - 0.15)) * 99);
    }
    function brollSpeedLabel(sec) {
        if (sec <= 0.3) return 'দ্রুত (Fast)';
        if (sec >= 1.5) return 'ধীর (Slow)';
        return 'স্বাভাবিক (Normal)';
    }

    // Unified animation style list (v2.5) — every style works the same way in
    // both Fullscreen and PiP mode now, so there's just one shared list instead
    // of two different ones. A couple of PiP-only Bengali labels ("Zoom Pop",
    // "Bounce Drop") are worded to make it obvious what they'll look like on a
    // small corner box, even though the same style value also works full-screen.
    const BROLL_ANIM_STYLES = [
        { value: 'none', label: 'কোনো অ্যানিমেশন নেই (সরাসরি দেখাবে)' },
        { value: 'fade', label: 'Fade (আস্তে আস্তে ভেসে উঠবে)' },
        { value: 'zoom', label: 'Zoom In (ধীরে ধীরে জুম হবে)' },
        { value: 'zoom-out', label: 'Zoom Out (জুম আউট হবে)' },
        { value: 'zoom-pop', label: 'Zoom Pop (হঠাৎ বড় হয়ে পপ করে আসবে)' },
        { value: 'pan', label: 'Pan (Ken Burns - আস্তে আস্তে সরে যাবে)' },
        { value: 'slide', label: 'Slide (এক পাশ থেকে সোজা স্লাইড করে আসবে)' },
        { value: 'slide-pop', label: 'Slide + Pop (কোণা থেকে বাউন্স করে আসবে)' },
        { value: 'wipe', label: 'Wipe Reveal (মুছে মুছে দেখা যাবে)' },
        { value: 'rotate-in', label: 'Rotate In (ঘুরে ঘুরে আসবে)' },
        { value: 'spin-pop', label: 'Spin Pop (ঘুরতে ঘুরতে আসবে)' },
        { value: 'bounce-in', label: 'Bounce Drop (উপর থেকে লাফিয়ে পড়বে)' },
        { value: 'blur-pop', label: 'Blur Pop (ঝাপসা থেকে স্পষ্ট হয়ে আসবে)' },
        { value: 'blur-focus', label: 'Blur Focus (ঝাপসা থেকে স্পষ্ট হবে)' },
        { value: 'circle-highlight', label: 'Circle Highlight (চারপাশে হাতে-আঁকা গোল দাগ)' },
        { value: 'underline-draw', label: 'Underline Draw-on (নিচে দাগ আঁка হবে)' },
        { value: 'checkmark-pop', label: 'Checkmark Pop (✓ চিহ্ন পপ করে আসবে)' },
        { value: 'thinking-character', label: 'Thinking Character (🤔 চিন্তা করার বাবল)' },
        { value: 'arrow-point', label: 'Arrow Point-in (তীর চিহ্ন দেখাবে)' },
        { value: 'highlight-sweep', label: 'Highlight Marker Sweep (মার্কার দিয়ে হাইলাইট)' },
        { value: 'typewriter', label: 'Typewriter Reveal (টাইপরাইটারের মতো লেখা হবে)' },
        { value: 'magnifier-zoom', label: 'Magnifying Glass Zoom (🔍 ম্যাগনিফায়ার আইকন)' },
        { value: 'comparison-slide', label: 'Comparison Slide (Before/After স্লাইডার)' },
        { value: 'question-bounce', label: 'Question Mark Bounce (❓ লাফিয়ে আসবে)' },
        { value: 'confetti-pop', label: 'Confetti Pop (রঙিন কনফেত্তি ছড়িয়ে পড়বে)' },
        
        // Wings Fly Custom Presets (Style + Direction + Sound Combinations)
        { value: 'preset-wings-intro', label: 'Wings Intro Banner (বাম দিক থেকে স্লাইড ও সুইশ শব্দ)' },
        { value: 'preset-question-pop', label: 'Question Bounce + Pop (❓ নিচ দিক থেকে লাফিয়ে আসা ও পপ শব্দ)' },
        { value: 'preset-checkmark-chime', label: 'Checkmark Pop + Chime (✓ চিহ্ন পপ ও চমক শব্দ)' },
        { value: 'preset-typewriter-click', label: 'Typewriter + Click (টাইপরাইটার ও ক্লিক শব্দ)' },
        { value: 'preset-zoom-chime', label: 'Zoom Pop + Chime (জুম পপ ও চমক শব্দ)' },
        { value: 'preset-rotate-whoosh', label: 'Rotate In + Whoosh (ঘুরে আসা ও সুইশ শব্দ)' },
        { value: 'preset-highlight-chime', label: 'Highlight Sweep + Chime (মার্কার হাইলাইট ও চমক শব্দ)' },
        { value: 'preset-arrow-whoosh', label: 'Arrow Point + Whoosh (তীর চিহ্ন ও সুইশ শব্দ)' }
    ];

    function populateBrollAnimStyleOptions() {
        if (!brollAnimStyleSelect) return;
        brollAnimStyleSelect.innerHTML = BROLL_ANIM_STYLES.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
    }

    // Shows/hides the entry/exit direction pickers depending on whether the
    // currently selected animation style actually uses a direction.
    function updateBrollDirectionRowsVisibility(style) {
        // 'pan' only cares about a single pan direction (reuses the entry-direction
        // picker) and has no separate exit phase, so its exit-direction row stays hidden.
        const usesEntryDirection = (style === 'slide' || style === 'slide-pop' || style === 'pan' || style === 'arrow-point');
        const usesExitDirection = (style === 'slide' || style === 'slide-pop');
        if (brollDirectionRow) brollDirectionRow.style.display = usesEntryDirection ? 'block' : 'none';
        if (brollExitDirectionRow) brollExitDirectionRow.style.display = usesExitDirection ? 'block' : 'none';
    }

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
        console.log("Loading B-roll image file:", file.name, "type:", file.type, "size:", file.size);
        const img = new Image();
        const url = URL.createObjectURL(file);
        
        img.onload = () => {
            console.log("B-roll image loaded successfully. Dimensions:", img.naturalWidth, "x", img.naturalHeight);
            if (img.naturalWidth === 0 || img.naturalHeight === 0) {
                console.error("Loaded image has zero dimensions.");
                alert("ত্রুটি: ছবিটির ডাইমেনশন শূন্য (0)। অনুগ্রহ করে অন্য ছবি ব্যবহার করুন।");
                return;
            }
            const newItem = {
                id: brollIdCounter++,
                type: 'image',
                imageImg: img,
                imageUrl: url,
                mode: brollModeSelect ? brollModeSelect.value : 'fullscreen',
                size: brollSizeSlider ? parseInt(brollSizeSlider.value) : 35,
                x: 0.05,
                y: 0.6,
                startSec: Math.min(state.endTime || state.duration || 5, state.currentTime || 0),
                endSec: Math.min(state.endTime || state.duration || 5, (state.currentTime || 0) + 3),
                // Each B-roll clip enters from a different side so a sequence
                // of images doesn't always pop in from the same corner. This is
                // just the starting default — fully editable from the panel.
                entryDirection: ['left', 'right', 'top', 'bottom'][Math.floor(Math.random() * 4)],
                exitDirection: 'same',
                animationStyle: brollModeSelect && brollModeSelect.value === 'pip' ? 'slide-pop' : 'zoom',
                animationSpeedSec: 0.4, // continuous drag-slider speed (seconds); 0.4 ~= old 'Normal' preset
                soundEffect: 'none'
            };
            state.brollOverlays.push(newItem);
            state.selectedBrollId = newItem.id;
            renderBrollList();
            showBrollTimingFor(newItem.id);
            drawFrame();
            console.log("Added B-roll overlay:", newItem);
        };
        
        img.onerror = (err) => {
            console.error("Failed to load B-roll image:", err);
            alert("ত্রুটি: ছবিটি লোড করা যায়নি। অনুগ্রহ করে নিশ্চিত করুন যে এটি একটি সঠিক ইমেজ ফাইল (যেমন PNG, JPG, বা WEBP)।");
            if (brollInput) brollInput.value = '';
        };
        
        img.src = url;
        if (brollInput) brollInput.value = '';
    }

    if (addBrollTextBtn) {
        addBrollTextBtn.addEventListener('click', () => {
            const text = brollTextInput.value.trim();
            if (!text) return;

            const newItem = {
                id: brollIdCounter++,
                type: 'text',
                text: text,
                fontSize: brollTextFontsizeSlider ? parseInt(brollTextFontsizeSlider.value) : 48,
                color: brollTextColorInput ? brollTextColorInput.value : '#ffffff',
                mode: brollModeSelect ? brollModeSelect.value : 'fullscreen',
                size: brollSizeSlider ? parseInt(brollSizeSlider.value) : 35,
                x: 0.5,
                y: 0.5,
                startSec: Math.min(state.endTime || state.duration || 5, state.currentTime || 0),
                endSec: Math.min(state.endTime || state.duration || 5, (state.currentTime || 0) + 3),
                entryDirection: ['left', 'right', 'top', 'bottom'][Math.floor(Math.random() * 4)],
                exitDirection: 'same',
                animationStyle: brollModeSelect && brollModeSelect.value === 'pip' ? 'slide-pop' : 'zoom',
                animationSpeedSec: 0.4, // continuous drag-slider speed (seconds); 0.4 ~= old 'Normal' preset
                soundEffect: 'none'
            };
            state.brollOverlays.push(newItem);
            state.selectedBrollId = newItem.id;
            brollTextInput.value = '';
            renderBrollList();
            showBrollTimingFor(newItem.id);
            drawFrame();
        });
    }

    // --- Wings Fly B-roll Presets Helpers ---
    function getBrollPresetValue(item) {
        if (item.animationStyle === 'slide-pop' && item.entryDirection === 'left' && item.soundEffect === 'whoosh') return 'preset-wings-intro';
        if (item.animationStyle === 'question-bounce' && item.entryDirection === 'bottom' && item.soundEffect === 'pop') return 'preset-question-pop';
        if (item.animationStyle === 'checkmark-pop' && item.entryDirection === 'top' && item.soundEffect === 'chime') return 'preset-checkmark-chime';
        if (item.animationStyle === 'typewriter' && item.entryDirection === 'left' && item.soundEffect === 'click') return 'preset-typewriter-click';
        if (item.animationStyle === 'zoom-pop' && item.entryDirection === 'bottom' && item.soundEffect === 'chime') return 'preset-zoom-chime';
        if (item.animationStyle === 'rotate-in' && item.entryDirection === 'top' && item.soundEffect === 'whoosh') return 'preset-rotate-whoosh';
        if (item.animationStyle === 'highlight-sweep' && item.entryDirection === 'bottom' && item.soundEffect === 'chime') return 'preset-highlight-chime';
        if (item.animationStyle === 'arrow-point' && item.entryDirection === 'left' && item.soundEffect === 'whoosh') return 'preset-arrow-whoosh';
        return item.animationStyle;
    }

    function applyBrollPresetStyle(item, val) {
        switch(val) {
            case 'preset-wings-intro':
                item.animationStyle = 'slide-pop';
                item.entryDirection = 'left';
                item.soundEffect = 'whoosh';
                break;
            case 'preset-question-pop':
                item.animationStyle = 'question-bounce';
                item.entryDirection = 'bottom';
                item.soundEffect = 'pop';
                break;
            case 'preset-checkmark-chime':
                item.animationStyle = 'checkmark-pop';
                item.entryDirection = 'top';
                item.soundEffect = 'chime';
                break;
            case 'preset-typewriter-click':
                item.animationStyle = 'typewriter';
                item.entryDirection = 'left';
                item.soundEffect = 'click';
                break;
            case 'preset-zoom-chime':
                item.animationStyle = 'zoom-pop';
                item.entryDirection = 'bottom';
                item.soundEffect = 'chime';
                break;
            case 'preset-rotate-whoosh':
                item.animationStyle = 'rotate-in';
                item.entryDirection = 'top';
                item.soundEffect = 'whoosh';
                break;
            case 'preset-highlight-chime':
                item.animationStyle = 'highlight-sweep';
                item.entryDirection = 'bottom';
                item.soundEffect = 'chime';
                break;
            case 'preset-arrow-whoosh':
                item.animationStyle = 'arrow-point';
                item.entryDirection = 'left';
                item.soundEffect = 'whoosh';
                break;
        }
        
        // Sync the form controls to these loaded values
        if (brollEntryDirSelect) brollEntryDirSelect.value = item.entryDirection;
        if (brollExitDirSelect) brollExitDirSelect.value = item.exitDirection || 'same';
        if (brollSoundEffectSelect) brollSoundEffectSelect.value = item.soundEffect;
    }

    // Computes this item's on-screen box size as a fraction of the canvas, used both for
    // hit-testing drag/click and for placing it correctly via the position-preset grid.
    function computeBrollBoxFrac(item) {
        const canvasW = state.canvas.width;
        const canvasH = state.canvas.height;
        if (item.type === 'text') {
            state.ctx.font = `bold ${item.fontSize}px "Hind Siliguri", "Plus Jakarta Sans", sans-serif`;
            const metrics = state.ctx.measureText(item.text);
            const boxW = metrics.width + 32;
            const boxH = item.fontSize + 24;
            return { wFrac: boxW / canvasW, hFrac: boxH / canvasH };
        } else if (item.imageImg) {
            const pipW = canvasW * (item.size / 100);
            const pipH = pipW * (item.imageImg.naturalHeight / item.imageImg.naturalWidth);
            return { wFrac: pipW / canvasW, hFrac: pipH / canvasH };
        }
        return { wFrac: 0.3, hFrac: 0.15 };
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
            const modeLabel = item.mode === 'fullscreen' ? 'Fullscreen' : 'PiP';
            if (item.type === 'text') {
                const preview = item.text.length > 18 ? item.text.slice(0, 18) + '…' : item.text;
                label.innerText = `🔤 ${modeLabel}: "${preview}"`;
            } else {
                label.innerText = `🖼 ${modeLabel} B-roll`;
            }
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
        const maxVal = state.endTime || state.duration || 1000;
        if (brollTimingContainer) brollTimingContainer.style.display = 'block';
        if (brollStartInput) {
            brollStartInput.max = maxVal;
            brollStartInput.value = item.startSec;
        }
        if (brollEndInput) {
            brollEndInput.max = maxVal;
            brollEndInput.value = item.endSec;
        }
        if (brollModeSelect) brollModeSelect.value = item.mode;
        if (brollSizeSlider) brollSizeSlider.value = item.size;
        if (brollSizeVal) brollSizeVal.innerText = item.size + '%';
        if (brollSizeContainer) brollSizeContainer.style.display = item.mode === 'pip' ? 'block' : 'none';

        // Sync the animation/direction/speed/sound controls to this item
        populateBrollAnimStyleOptions(item.mode);
        const defaultStyle = item.mode === 'pip' ? 'slide-pop' : 'zoom';
        if (brollAnimStyleSelect) brollAnimStyleSelect.value = getBrollPresetValue(item) || defaultStyle;
        if (brollEntryDirSelect) brollEntryDirSelect.value = item.entryDirection || 'bottom';
        if (brollExitDirSelect) brollExitDirSelect.value = item.exitDirection || 'same';
        if (brollAnimSpeedSlider) {
            const sec = item.animationSpeedSec || 0.4;
            brollAnimSpeedSlider.value = brollSpeedSecToValue(sec);
            if (brollAnimSpeedVal) brollAnimSpeedVal.innerText = brollSpeedLabel(sec);
        }
        if (brollSoundEffectSelect) brollSoundEffectSelect.value = item.soundEffect || 'none';
        updateBrollDirectionRowsVisibility(item.animationStyle || defaultStyle);

        // Sync After Image Uploader visibility
        const brollAfterImageContainer = document.getElementById('broll-after-image-container');
        const brollAfterFilename = document.getElementById('broll-after-filename');
        if (brollAfterImageContainer) {
            if (item.type === 'image' && (item.animationStyle === 'comparison-slide')) {
                brollAfterImageContainer.style.display = 'block';
                if (item.imageUrlAfter) {
                    brollAfterFilename.innerText = "তুলনার পরের ছবি লোড করা আছে";
                    brollAfterFilename.style.color = "#10b981";
                } else {
                    brollAfterFilename.innerText = "Upload After Image (তুলনার পরের ছবি)...";
                    brollAfterFilename.style.color = "#cbd5e1";
                }
            } else {
                brollAfterImageContainer.style.display = 'none';
            }
        }
    }

    if (brollAnimStyleSelect) {
        brollAnimStyleSelect.addEventListener('change', (e) => {
            const item = state.brollOverlays.find(b => b.id === state.selectedBrollId);
            if (item) {
                const val = e.target.value;
                if (val.startsWith('preset-')) {
                    applyBrollPresetStyle(item, val);
                } else {
                    item.animationStyle = val;
                }
                updateBrollDirectionRowsVisibility(item.animationStyle);
                
                const brollAfterImageContainer = document.getElementById('broll-after-image-container');
                const brollAfterFilename = document.getElementById('broll-after-filename');
                if (brollAfterImageContainer) {
                    if (item.type === 'image' && item.animationStyle === 'comparison-slide') {
                        brollAfterImageContainer.style.display = 'block';
                        if (item.imageUrlAfter) {
                            brollAfterFilename.innerText = "তুলনার পরের ছবি লোড করা আছে";
                            brollAfterFilename.style.color = "#10b981";
                        } else {
                            brollAfterFilename.innerText = "Upload After Image (তুলনার পরের ছবি)...";
                            brollAfterFilename.style.color = "#cbd5e1";
                        }
                    } else {
                        brollAfterImageContainer.style.display = 'none';
                    }
                }
                
                drawFrame();
            }
        });
    }

    // --- Wings Fly B-roll After-Image Uploader for Comparison Slide ---
    const brollAfterDropzone = document.getElementById('broll-after-dropzone');
    const brollAfterInput = document.getElementById('broll-after-input');
    const brollAfterFilename = document.getElementById('broll-after-filename');

    if (brollAfterDropzone && brollAfterInput) {
        brollAfterDropzone.addEventListener('click', () => brollAfterInput.click());

        brollAfterInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) loadBrollAfterImage(file);
        });

        brollAfterDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            brollAfterDropzone.classList.add('drag-over');
        });
        brollAfterDropzone.addEventListener('dragleave', () => {
            brollAfterDropzone.classList.remove('drag-over');
        });
        brollAfterDropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            brollAfterDropzone.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) loadBrollAfterImage(file);
        });
    }

    function loadBrollAfterImage(file) {
        const item = state.brollOverlays.find(b => b.id === state.selectedBrollId);
        if (!item || item.type !== 'image') return;

        console.log("Loading B-roll AFTER image file:", file.name);
        const img = new Image();
        const url = URL.createObjectURL(file);
        
        img.onload = () => {
            item.imageImgAfter = img;
            item.imageUrlAfter = url;
            if (brollAfterFilename) {
                brollAfterFilename.innerText = "তুলনার পরের ছবি লোড করা আছে";
                brollAfterFilename.style.color = "#10b981";
            }
            drawFrame();
        };
        img.onerror = () => {
            alert("ত্রুটি: ছবিটি লোড করা যায়নি।");
        };
        img.src = url;
    }

    if (brollEntryDirSelect) {
        brollEntryDirSelect.addEventListener('change', (e) => {
            const item = state.brollOverlays.find(b => b.id === state.selectedBrollId);
            if (item) {
                item.entryDirection = e.target.value;
                drawFrame();
            }
        });
    }

    if (brollExitDirSelect) {
        brollExitDirSelect.addEventListener('change', (e) => {
            const item = state.brollOverlays.find(b => b.id === state.selectedBrollId);
            if (item) {
                item.exitDirection = e.target.value;
                drawFrame();
            }
        });
    }

    if (brollAnimSpeedSlider) {
        brollAnimSpeedSlider.addEventListener('input', (e) => {
            const item = state.brollOverlays.find(b => b.id === state.selectedBrollId);
            if (item) {
                const sec = brollSpeedValueToSec(parseInt(e.target.value));
                item.animationSpeedSec = sec;
                if (brollAnimSpeedVal) brollAnimSpeedVal.innerText = brollSpeedLabel(sec);
                drawFrame();
            }
        });
    }

    if (brollSoundEffectSelect) {
        brollSoundEffectSelect.addEventListener('change', (e) => {
            const item = state.brollOverlays.find(b => b.id === state.selectedBrollId);
            if (item) {
                item.soundEffect = e.target.value;
                // Let the person hear a quick preview of the chosen sound immediately
                if (item.soundEffect !== 'none' && window.playBrollSfx) window.playBrollSfx(item.soundEffect);
            }
        });
    }

    if (brollStartInput) {
        brollStartInput.addEventListener('input', (e) => {
            const item = state.brollOverlays.find(b => b.id === state.selectedBrollId);
            if (item) {
                const maxVal = state.endTime || state.duration || 1000;
                let val = parseFloat(e.target.value) || 0;
                if (val > maxVal) {
                    val = maxVal;
                    brollStartInput.value = val;
                }
                item.startSec = Math.max(0, val);
                renderBrollList();
            }
        });
    }

    if (brollEndInput) {
        brollEndInput.addEventListener('input', (e) => {
            const item = state.brollOverlays.find(b => b.id === state.selectedBrollId);
            if (item) {
                const maxVal = state.endTime || state.duration || 1000;
                let val = parseFloat(e.target.value) || 0;
                if (val > maxVal) {
                    val = maxVal;
                    brollEndInput.value = val;
                }
                item.endSec = Math.max(item.startSec + 0.1, val);
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
                // All animation styles now work in either mode, but we still switch to
                // that mode's more natural-feeling default when toggling, so it doesn't
                // suddenly look like nothing changed.
                item.animationStyle = item.mode === 'pip' ? 'slide-pop' : 'zoom';
                populateBrollAnimStyleOptions();
                if (brollAnimStyleSelect) brollAnimStyleSelect.value = item.animationStyle;
                updateBrollDirectionRowsVisibility(item.animationStyle);
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
