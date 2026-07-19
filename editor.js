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
    applyVoiceChangerToVideo: false, // when true, voiceoverProfile is also applied to the original video's own audio track
    isNoiseCancelActive: false,
    noiseGateThreshold: -38,
    isAiDenoiseActive: false,

    // Background Music state (Phase 3A, upgraded to multi-track timeline in v2.3)
    // Each track: { id, blob, url, name, duration, volume, startSec, endSec, loopMode }
    // endSec === null means "play until the end of the video".
    // loopMode: 'loop' (repeat for the whole startSec..endSec window) or 'once' (play through one time, then stay silent for the rest of the window).
    bgMusicTracks: [],
    selectedBgMusicTrackId: null,
    bgMusicDuckingEnabled: true,

    // Intro Transition states
    introTransitionType: 'none', // 'none', 'fade', 'zoom_spin', 'slide_right', 'slide_left', 'slide_top', 'slide_bottom'
    introTransitionDuration: 1.0, // seconds

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

    // Advanced Color Grading — custom per-channel RGB curves (Phase 4C)
    colorGradeEnabled: false,
    gradeRShadow: 0, gradeRMid: 0, gradeRHigh: 0,
    gradeGShadow: 0, gradeGMid: 0, gradeGHigh: 0,
    gradeBShadow: 0, gradeBMid: 0, gradeBHigh: 0,
    
    // Video layout mode
    layoutMode: 'fit',

    // Text Overlays (Phase 2C)
    textOverlays: [],
    selectedTextOverlayId: null,
    isDraggingTextOverlay: false,
    dragTextOffsetX: 0,
    dragTextOffsetY: 0,

    // Sticker / Emoji Overlays (Phase 4A)
    stickers: [],
    selectedStickerId: null,
    isDraggingSticker: false,
    isResizingSticker: false,
    dragStickerOffsetX: 0,
    dragStickerOffsetY: 0,
    stickerResizeStartX: 0,
    stickerResizeStartSize: 12,

    // Symbol / Shape Overlays (arrow, cross, tick, question mark, etc.)
    symbolOverlays: [],
    selectedSymbolId: null,
    isDraggingSymbol: false,
    isResizingSymbol: false,
    isRotatingSymbol: false,
    dragSymbolOffsetX: 0,
    dragSymbolOffsetY: 0,
    symbolResizeStartX: 0,
    symbolResizeStartSize: 12,
    symbolRotateStartAngle: 0,
    symbolRotateStartRotation: 0,

    // Shape + Text Overlays (Word-style shapes: ribbon banner, wavy banner,
    // thought cloud, 6-point star, oval callout) — user types text on top.
    shapeOverlays: [],
    selectedShapeOverlayId: null,
    isDraggingShapeOverlay: false,
    isResizingShapeOverlay: false,
    isRotatingShapeOverlay: false,
    dragShapeOverlayOffsetX: 0,
    dragShapeOverlayOffsetY: 0,
    shapeOverlayResizeStartX: 0,
    shapeOverlayResizeStartSize: 30,
    shapeOverlayRotateStartAngle: 0,
    shapeOverlayRotateStartRotation: 0,

    // B-roll / Topic Image Overlays (Phase 5D)
    brollOverlays: [],
    selectedBrollId: null,
    isDraggingBroll: false,
    isResizingBroll: false,
    brollResizeHandle: null,
    brollResizeStartX: 0,
    brollResizeStartY: 0,
    brollResizeStartW: 0,
    brollResizeStartH: 0,
    brollResizeStartBoxX: 0,
    brollResizeStartBoxY: 0,
    isDraggingSeek: false,
    dragBrollOffsetX: 0,
    dragBrollOffsetY: 0,
    isRotatingBroll: false,
    brollRotateStartAngle: 0,
    brollRotateStartRotation: 0,

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

    // Video highlights / callouts — normalized to the rendered video rectangle
    highlights: [],
    selectedHighlightId: null,
    isAddingHighlight: false,
    isDrawingNewHighlight: false,
    highlightDrawDrawX: 0,
    highlightDrawDrawY: 0,
    highlightDrawDrawW: 0,
    highlightDrawDrawH: 0,
    highlightStraightAnchor: null,
    highlightStraightPointIndex: null,
    highlightFreehandSegmentStart: null,
    highlightPreviewPoint: null,

    // Background Fill Regions — solid colour rectangles drawn on top of everything
    fillRegions: [],
    selectedFillId: null,
    isAddingFill: false,
    isDrawingNewFill: false,
    fillDragStartX: 0,
    fillDragStartY: 0,
    isDraggingFill: false,
    isResizingFill: false,
    dragFillOffsetX: 0,
    dragFillOffsetY: 0,

    // Auto Subtitle (Phase 5A)
    subtitles: [],
    isSubtitleRecognitionActive: false,
    // True only while switchActiveClip is mid-transition to the next clip during
    // continuous playback. The video's native 'pause' event fires every time we
    // swap clip.url between clips, even though playback is about to auto-resume --
    // without this flag that internal pause was indistinguishable from the user
    // actually stopping playback, so Listen & Generate silently died at every
    // clip boundary (see the 'pause' listener near the bottom of audio.js).
    isClipTransitionInProgress: false,
    subtitlesEnabled: true,
    // Subtitle caption styling (driven by the "Bangla Caption Style" preset)
    subtitleStyle: {
        fontFamily: '"Hind Siliguri", "Plus Jakarta Sans", sans-serif',
        fontSizePct: 0.045,   // caption height as a fraction of canvas height
        fontWeight: 600,
        color: '#ffffff',
        outlineColor: '#000000',
        outlineWidth: 3,      // px (at 1080p-ish canvas)
        bgPillEnabled: true,
        bgPillColor: 'rgba(0, 0, 0, 0.6)',
        bgPillRadius: 8,     // px; large value => pill shape
        position: 'bottom',   // 'bottom' | 'top'
        positionPct: 0.1,     // distance from the chosen edge, fraction of canvas height
        highlightEnabled: false, // word-by-word TikTok-style highlight
        highlightColor: '#ffe600',
        lineHighlightColor: '#ffe600' // marker-style solid background for a whole highlighted subtitle cue
    },

    // Intro / Outro Templates (Phase 5C)
    introEnabled: false,
    introTemplate: 'classic',
    introTitle: '',
    introSubtitle: '',
    introDuration: 3,

    outroEnabled: false,
    outroTemplate: 'classic',
    outroTitle: '',
    outroSubtitle: '',
    outroDuration: 3,

    // Multi-Clip Timeline (Phase 2B)
    clips: [],
    activeClipId: null,

    // Image/photo playhead emulation
    imagePlayheadTime: 0,
    lastImageTickTime: 0,
    // Export-only clocks. The ticker has its own timeline so a delayed video seek
    // or B-roll draw cannot repeat its scroll position in the rendered output.
    customExportTime: undefined,
    exportTickerTime: undefined,
    get currentTime() {
        if (this.customExportTime !== undefined) {
            return this.customExportTime;
        }
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
// willReadFrequently: true because Advanced Color Grading (Phase 4C) calls
// getImageData/putImageData on this context every frame when enabled; the
// hint avoids a repeated GPU->CPU readback penalty.
window.VideoEditor.ctx = window.VideoEditor.canvas.getContext('2d', { willReadFrequently: true });

document.addEventListener('DOMContentLoaded', () => {
    const state = window.VideoEditor;
    
    // UI Selectors
    const videoInput = document.getElementById('video-input');
    const logoInput = document.getElementById('logo-input');
    const videoDropzone = document.getElementById('video-dropzone');
    const logoDropzone = document.getElementById('logo-dropzone');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const previewMuteBtn = document.getElementById('preview-mute-btn');
    const previewVolumeSlider = document.getElementById('preview-volume-slider');
    const splitClipBtn = document.getElementById('split-clip-btn');
    const freezeFrameBtn = document.getElementById('freeze-frame-btn');
    const freezeFrameDurationInput = document.getElementById('freeze-frame-duration');
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
                if (window.recordEditorHistory) {
                    window.recordEditorHistory('Video added');
                }
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
                if (window.recordEditorHistory) {
                    window.recordEditorHistory('Video added');
                }
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
        
        state.logoFile = file;
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
            if (window.captureUndoCheckpoint) window.captureUndoCheckpoint();
            if (window.recordEditorHistory) {
                window.recordEditorHistory('Logo added');
            }
        };
    }
    
    logoDropzone.addEventListener('click', () => logoInput.click());
    logoInput.addEventListener('change', (e) => {
        handleLogoFile(e.target.files[0]);
    });
    
    removeLogoBtn.addEventListener('click', () => {
        state.logoImg = null;
        state.logoFile = null;
        logoPreviewBox.style.display = 'none';
        logoDropzone.style.display = 'flex';
        logoControlCard.style.display = 'none';
        logoInput.value = '';
        drawFrame();
        if (window.captureUndoCheckpoint) window.captureUndoCheckpoint();
        if (window.recordEditorHistory) {
            window.recordEditorHistory('Logo removed');
        }
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
            if (window.captureUndoCheckpoint) window.captureUndoCheckpoint();
            if (window.recordEditorHistory) {
                window.recordEditorHistory('Format changed');
            }
        });
    });

    // --- Platform Presets (7C) ---
    const PLATFORM_PRESETS = {
        'fb-feed': {
            name: 'Facebook Feed',
            ratio: '4-5',
            layoutMode: 'fill',
            maxDuration: 240,
            warning: 'Facebook Feed ভিডিওর সর্বোচ্চ দৈর্ঘ্য ২৪০ সেকেন্ড (৪ মিনিট)। ক্যাপশনের জন্য নিচে ও উপরে ব্যানার ব্যবহার করুন।'
        },
        'fb-reels': {
            name: 'Facebook Reels',
            ratio: '9-16',
            layoutMode: 'fill',
            maxDuration: 90,
            warning: 'Facebook Reels-এর সর্বোচ্চ সময়সীমা ৯০ সেকেন্ড। ভিডিওটি সে অনুযায়ী Trim করুন।'
        },
        'ig-reels': {
            name: 'Instagram Reels',
            ratio: '9-16',
            layoutMode: 'fill',
            maxDuration: 90,
            warning: 'Instagram Reels সর্বোচ্চ ৯০ সেকেন্ড পর্যন্ত সাপোর্ট করে। নিশ্চিত করুন ভিডিওটির দৈর্ঘ্য সীমার মধ্যে আছে।'
        },
        'ig-story': {
            name: 'Instagram Story',
            ratio: '9-16',
            layoutMode: 'fill',
            maxDuration: 60,
            warning: 'Instagram Story সর্বোচ্চ ৬০ সেকেন্ড। দীর্ঘ ভিডিও স্বয়ংক্রিয়ভাবে কেটে যায়।'
        },
        'yt-shorts': {
            name: 'YouTube Shorts',
            ratio: '9-16',
            layoutMode: 'fill',
            maxDuration: 60,
            warning: 'YouTube Shorts সর্বোচ্চ ৬০ সেকেন্ড। ভিডিও ট্রিম করে সীমার মধ্যে রাখুন।'
        },
        'yt-long': {
            name: 'YouTube Landscape',
            ratio: '16-9',
            layoutMode: 'fit',
            maxDuration: null,
            warning: null
        }
    };

    const platformPresetBtns = document.querySelectorAll('.platform-preset-btn');
    const platformPresetWarning = document.getElementById('platform-preset-warning');
    const platformPresetWarningText = document.getElementById('platform-preset-warning-text');
    const platformPresetActiveLabel = document.getElementById('platform-preset-active-label');
    const platformPresetActiveName = document.getElementById('platform-preset-active-name');

    function applyPlatformPreset(presetKey) {
        const preset = PLATFORM_PRESETS[presetKey];
        if (!preset) return;

        // 1. Set Aspect Ratio
        state.aspectRatio = preset.ratio;
        aspectButtons.forEach(b => {
            b.classList.toggle('active', b.dataset.ratio === preset.ratio);
        });

        // 2. Set Layout Mode
        state.layoutMode = preset.layoutMode;
        const layoutBtns = document.querySelectorAll('.layout-mode-btn');
        layoutBtns.forEach(b => {
            b.classList.toggle('active', b.dataset.mode === preset.layoutMode);
        });

        // 3. Update canvas
        updateCanvasDimensions();
        drawFrame();

        // 4. Show duration warning if clip exceeds max
        if (platformPresetWarning && platformPresetWarningText) {
            const totalDuration = state.clips.reduce((sum, c) => sum + (c.duration || 0), 0);
            const exceedsDuration = preset.maxDuration && totalDuration > preset.maxDuration;

            if (preset.warning || exceedsDuration) {
                let warningMsg = preset.warning || '';
                if (exceedsDuration) {
                    warningMsg += ` ⚠️ বর্তমান ভিডিওর দৈর্ঘ্য ${totalDuration.toFixed(0)}s, যা সীমার (${preset.maxDuration}s) বেশি।`;
                }
                platformPresetWarningText.textContent = warningMsg;
                platformPresetWarning.style.display = 'flex';
            } else {
                platformPresetWarning.style.display = 'none';
            }
        }

        // 5. Show active label
        if (platformPresetActiveLabel && platformPresetActiveName) {
            platformPresetActiveName.textContent = preset.name;
            platformPresetActiveLabel.style.display = 'block';
        }

        // 6. Mark active button
        platformPresetBtns.forEach(b => {
            b.classList.toggle('active', b.dataset.preset === presetKey);
        });

        triggerAutoSave();
        if (window.captureUndoCheckpoint) window.captureUndoCheckpoint();
        if (window.recordEditorHistory) {
            window.recordEditorHistory('Platform preset changed');
        }
    }

    platformPresetBtns.forEach(btn => {
        btn.addEventListener('click', () => applyPlatformPreset(btn.dataset.preset));
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

    // --- Video Intro Transition Bindings ---
    const introTransitionTypeSelect = document.getElementById('intro-transition-type');
    const introTransitionDurationSlider = document.getElementById('intro-transition-duration');
    const introTransitionDurationVal = document.getElementById('intro-transition-duration-val');

    if (introTransitionTypeSelect) {
        introTransitionTypeSelect.addEventListener('change', () => {
            state.introTransitionType = introTransitionTypeSelect.value;
            drawFrame();
        });
    }

    if (introTransitionDurationSlider) {
        introTransitionDurationSlider.addEventListener('input', (e) => {
            state.introTransitionDuration = parseFloat(e.target.value);
            if (introTransitionDurationVal) {
                introTransitionDurationVal.innerText = state.introTransitionDuration.toFixed(1) + 's';
            }
            drawFrame();
        });
    }

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

    // --- Advanced Color Grading / Custom RGB Curves Bindings (Phase 4C) ---
    const colorGradeToggle = document.getElementById('color-grade-toggle');
    const colorGradeContainer = document.getElementById('color-grade-container');
    const resetColorGradeBtn = document.getElementById('reset-color-grade-btn');

    // Maps each slider's DOM id -> { stateKey, valEl } so all 9 sliders can share
    // one small binding loop instead of nine near-identical blocks.
    const colorGradeSliderMap = [
        ['grade-r-shadow', 'gradeRShadow'], ['grade-r-mid', 'gradeRMid'], ['grade-r-high', 'gradeRHigh'],
        ['grade-g-shadow', 'gradeGShadow'], ['grade-g-mid', 'gradeGMid'], ['grade-g-high', 'gradeGHigh'],
        ['grade-b-shadow', 'gradeBShadow'], ['grade-b-mid', 'gradeBMid'], ['grade-b-high', 'gradeBHigh'],
    ];

    colorGradeSliderMap.forEach(([elId, stateKey]) => {
        const sliderEl = document.getElementById(elId);
        const valEl = document.getElementById(elId + '-val');
        if (!sliderEl) return;
        sliderEl.addEventListener('input', (e) => {
            state[stateKey] = parseInt(e.target.value);
            if (valEl) valEl.innerText = state[stateKey];
            drawFrame();
        });
    });

    if (colorGradeToggle) {
        colorGradeToggle.addEventListener('change', (e) => {
            state.colorGradeEnabled = e.target.checked;
            if (colorGradeContainer) colorGradeContainer.style.display = state.colorGradeEnabled ? 'block' : 'none';
            drawFrame();
        });
    }

    if (resetColorGradeBtn) {
        resetColorGradeBtn.addEventListener('click', () => {
            colorGradeSliderMap.forEach(([elId, stateKey]) => {
                state[stateKey] = 0;
                const sliderEl = document.getElementById(elId);
                const valEl = document.getElementById(elId + '-val');
                if (sliderEl) sliderEl.value = 0;
                if (valEl) valEl.innerText = '0';
            });
            drawFrame();
        });
    }

    // Layout Mode (Fit vs Fill) selector
    const layoutModeBtns = document.querySelectorAll('.layout-mode-btn');
    layoutModeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            layoutModeBtns.forEach(b => b.classList.remove('active'));
            const targetBtn = e.currentTarget;
            targetBtn.classList.add('active');
            state.layoutMode = targetBtn.dataset.mode;
            drawFrame();
            if (window.captureUndoCheckpoint) window.captureUndoCheckpoint();
            if (window.recordEditorHistory) {
                window.recordEditorHistory('Layout mode changed');
            }
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

    // Preview-only mute toggle: lets the user test-play the video with sound
    // off, without touching anything that affects the exported file's audio.
    // window.setSpeakerMuted (defined in audio.js) mutes a gain node that sits
    // AFTER the point the exporter taps for recording, so this can never
    // silence the final export. Before the Web Audio graph exists (e.g. no
    // video loaded yet / audio context not initialized), we fall back to
    // muting the <video> element directly.
    let previewSoundMuted = false;
    if (previewMuteBtn) {
        previewMuteBtn.addEventListener('click', () => {
            previewSoundMuted = !previewSoundMuted;
            const appliedViaGraph = window.setSpeakerMuted ? window.setSpeakerMuted(previewSoundMuted) : false;
            if (!appliedViaGraph && state.video) {
                state.video.muted = previewSoundMuted;
            }
            if (previewSoundMuted) {
                previewMuteBtn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
                previewMuteBtn.style.background = 'rgba(248, 113, 113, 0.15)';
                previewMuteBtn.style.borderColor = '#f87171';
                previewMuteBtn.style.color = '#f87171';
                previewMuteBtn.title = 'প্রিভিউ সাউন্ড অন করুন (Unmute preview)';
            } else {
                previewMuteBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
                previewMuteBtn.style.background = 'rgba(148, 163, 184, 0.15)';
                previewMuteBtn.style.borderColor = '#94a3b8';
                previewMuteBtn.style.color = '#94a3b8';
                previewMuteBtn.title = 'প্রিভিউ সাউন্ড অফ করুন — শুধু আপনার স্পিকারের জন্য, এক্সপোর্ট করা ভিডিওর অডিওতে কোনো প্রভাব পড়বে না (Mute preview only)';
            }
        });
    }

    if (previewVolumeSlider) {
        previewVolumeSlider.addEventListener('input', (e) => {
            const vol = parseFloat(e.target.value);
            if (window.setSpeakerVolume) {
                window.setSpeakerVolume(vol);
            } else if (state.video) {
                state.video.volume = vol;
            }
            
            // Auto unmute when volume is increased
            if (vol > 0.01 && previewSoundMuted) {
                if (previewMuteBtn) previewMuteBtn.click();
            }
        });
    }

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

    // Freeze Frame insert (v2.7): grabs the currently visible frame at the
    // playhead and holds it as a still image for a chosen duration, splitting
    // the active clip around it. The video pauses on that frame while the
    // audio track keeps playing underneath — a simple, reliable way to fix a
    // video that's running a second or two ahead of its audio without needing
    // full time-stretching/speed-ramping support.
    if (freezeFrameBtn) {
        freezeFrameBtn.addEventListener('click', () => {
            const activeClip = state.clips.find(c => c.id === state.activeClipId);
            if (!activeClip) return;

            const currentTime = state.currentTime || 0;
            if (currentTime <= activeClip.start + 0.15 || currentTime >= activeClip.end - 0.15) {
                alert("এই পজিশনে ফ্রিজ ফ্রেম যোগ করা সম্ভব নয় (ক্লিপের একেবারে শুরুতে বা শেষে যোগ করা যায় না)। প্লেহেড একটু সরিয়ে আবার চেষ্টা করুন।");
                return;
            }

            let freezeDur = parseFloat(freezeFrameDurationInput ? freezeFrameDurationInput.value : 1.5);
            if (!freezeDur || isNaN(freezeDur)) freezeDur = 1.5;
            freezeDur = Math.max(0.2, Math.min(5, freezeDur));

            if (state.isPlaying) {
                pauseVideo();
            }

            // Grab the frame exactly as it's currently drawn on the canvas (already
            // includes crop/broll/overlays), so the freeze frame matches what the
            // viewer was just seeing.
            state.canvas.toBlob((blob) => {
                if (!blob) {
                    alert("ফ্রেম ক্যাপচার করা যায়নি, আবার চেষ্টা করুন।");
                    return;
                }
                const freezeFile = new File([blob], `freeze_frame_${Date.now()}.jpg`, { type: 'image/jpeg' });
                const freezeUrl = URL.createObjectURL(blob);
                const freezeImg = new Image();
                freezeImg.onload = () => {
                    const clipIndex = state.clips.indexOf(activeClip);
                    const splitPoint = currentTime;

                    const secondHalf = {
                        id: Date.now() + 1,
                        file: activeClip.file,
                        url: activeClip.url,
                        name: activeClip.name,
                        duration: activeClip.duration,
                        start: splitPoint,
                        end: activeClip.end,
                        cropX: activeClip.cropX,
                        cropY: activeClip.cropY,
                        cropW: activeClip.cropW,
                        cropH: activeClip.cropH
                    };

                    const freezeClip = {
                        id: Date.now(),
                        file: freezeFile,
                        url: freezeUrl,
                        name: 'Freeze Frame',
                        duration: freezeDur,
                        start: 0,
                        end: freezeDur,
                        cropX: 0,
                        cropY: 0,
                        cropW: 1,
                        cropH: 1,
                        type: 'image',
                        imageImg: freezeImg
                    };

                    // Shrink the original clip to end at the split point, then insert
                    // the freeze frame and the remaining second half right after it.
                    activeClip.end = splitPoint;
                    state.clips.splice(clipIndex + 1, 0, freezeClip, secondHalf);

                    renderClipTimeline();
                    state.currentTime = splitPoint;
                    switchActiveClip(activeClip.id);

                    console.log(`Inserted ${freezeDur}s freeze frame at:`, splitPoint);
                };
                freezeImg.src = freezeUrl;
            }, 'image/jpeg', 0.92);
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
        if (seekCurrentTimeEl) seekCurrentTimeEl.innerHTML = formatTimeDual(current);
        if (seekTotalTimeEl) seekTotalTimeEl.innerHTML = formatTimeDual(total);
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
                if (window.recordEditorHistory) {
                    window.recordEditorHistory('Clip added');
                }
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
                if (window.recordEditorHistory) {
                    window.recordEditorHistory('Clip added');
                }
            };
        }
    }

    function switchActiveClip(clipId, autoPlay = false) {
        const clip = state.clips.find(c => c.id === clipId);
        if (!clip || clip.id === state.activeClipId) return;

        // Persist the outgoing clip's crop area before switching away from it.
        syncCropToActiveClip();

        // Only mark this as an "in-progress" transition (as opposed to a real
        // stop) when we're about to auto-resume on the next clip -- that's the
        // case the subtitle 'pause' listener needs to ignore.
        if (autoPlay) state.isClipTransitionInProgress = true;

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
                if (window.syncPhase9ClipUI) window.syncPhase9ClipUI();

                if (autoPlay) {
                    playVideo();
                }
                state.isClipTransitionInProgress = false;
            }, 0);
        } else {
            let isSameSrc = false;
            try {
                const absVideoSrc = new URL(state.video.src, window.location.href).href;
                const absClipUrl = new URL(clip.url, window.location.href).href;
                isSameSrc = (absVideoSrc === absClipUrl);
            } catch (e) {
                isSameSrc = (state.video.src === clip.url);
            }

            const onMetadataLoaded = () => {
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
                state.video.playbackRate = Math.max(0.5, Math.min(2, Number(clip.speed) || 1));
                drawFrame();
                renderClipTimeline();
                if (window.syncPhase9ClipUI) window.syncPhase9ClipUI();

                if (autoPlay) {
                    playVideo();
                }
                state.isClipTransitionInProgress = false;
            };

            if (isSameSrc) {
                // Same source - execute immediately without reloading to avoid playback freeze
                setTimeout(onMetadataLoaded, 0);
            } else {
                state.video.src = clip.url;
                state.video.load();
                state.video.onloadedmetadata = onMetadataLoaded;
            }

            // Safety net: if this clip's video never fires 'loadedmetadata'
            // (corrupt file, load stalls, etc.) don't leave the flag stuck on,
            // or a genuine later pause would never stop subtitle recognition.
            if (autoPlay) {
                setTimeout(() => { state.isClipTransitionInProgress = false; }, 4000);
            }
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
                if (window.recordEditorHistory) {
                    window.recordEditorHistory('Clip removed');
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
                if (window.recordEditorHistory) {
                    window.recordEditorHistory('Clips reordered');
                }
            });

            clipTimelineListEl.appendChild(block);
        });
        if (window.updateSilenceTrimmerVisibility) {
            window.updateSilenceTrimmerVisibility();
        }
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

        let isSeekingThrottled = false;
        let pendingSeekTime = null;

        seekSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value) || 0;
            if (seekFill && state.duration) {
                seekFill.style.width = Math.max(0, Math.min(100, (val / state.duration) * 100)) + '%';
            }
            if (seekCurrentTimeEl) seekCurrentTimeEl.innerHTML = formatTimeDual(val);

            const activeClip = state.clips.find(c => c.id === state.activeClipId);
            if (activeClip && activeClip.type === 'image') {
                state.currentTime = val;
            } else {
                state.imagePlayheadTime = val;
                pendingSeekTime = val;
                if (!isSeekingThrottled) {
                    isSeekingThrottled = true;
                    requestAnimationFrame(() => {
                        if (pendingSeekTime !== null) {
                            state.video.currentTime = pendingSeekTime;
                            pendingSeekTime = null;
                        }
                        isSeekingThrottled = false;
                    });
                }
            }
        });

        function finishSeekDrag() {
            state.isDraggingSeek = false;
            if (pendingSeekTime !== null) {
                state.video.currentTime = pendingSeekTime;
                pendingSeekTime = null;
            }
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

    // --- Intro / Outro Templates (Phase 5C) ---
    // Draws one animated title-card frame for the given normalized progress
    // t (0..1 across the segment's total duration). Fully canvas-drawn (no
    // external image/video asset needed), so it works the same in the live
    // preview and during export (exporter.js calls this directly onto the
    // same canvas context that MediaRecorder is capturing).
    function drawIntroOutroSegment(ctx, canvasW, canvasH, opts, t) {
        const template = (opts && opts.template) || 'classic';
        const title = ((opts && opts.title) || '').trim();
        const subtitle = ((opts && opts.subtitle) || '').trim();
        t = Math.max(0, Math.min(1, t));

        // Overall fade envelope so the segment doesn't pop in/out abruptly
        const fadeInDur = 0.12, fadeOutDur = 0.18;
        let envelope = 1;
        if (t < fadeInDur) envelope = t / fadeInDur;
        else if (t > 1 - fadeOutDur) envelope = (1 - t) / fadeOutDur;

        ctx.save();

        // Background per template
        if (template === 'slideUp') {
            const grad = ctx.createLinearGradient(0, 0, canvasW, canvasH);
            grad.addColorStop(0, '#4f46e5');
            grad.addColorStop(1, '#7c3aed');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, canvasW, canvasH);
        } else if (template === 'zoomPop') {
            const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 2.4);
            const grad = ctx.createRadialGradient(
                canvasW / 2, canvasH / 2, 0,
                canvasW / 2, canvasH / 2, canvasW * (0.55 + pulse * 0.1)
            );
            grad.addColorStop(0, '#1e293b');
            grad.addColorStop(1, '#0f172a');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, canvasW, canvasH);
        } else { // classic
            const grad = ctx.createLinearGradient(0, 0, 0, canvasH);
            grad.addColorStop(0, '#111827');
            grad.addColorStop(1, '#1f2937');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, canvasW, canvasH);
        }

        const centerX = canvasW / 2;
        const centerY = canvasH / 2;
        const titleFontSize = Math.round(canvasW * 0.07);
        const subFontSize = Math.round(canvasW * 0.032);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (template === 'classic') {
            const titleProg = Math.min(1, t / 0.5);
            const eased = 1 - Math.pow(1 - titleProg, 3); // easeOutCubic
            const offsetY = (1 - eased) * 24;
            ctx.globalAlpha = envelope * eased;
            ctx.fillStyle = '#ffffff';
            ctx.font = `700 ${titleFontSize}px "Hind Siliguri", sans-serif`;
            if (title) drawWrappedText(ctx, title, centerX, centerY - offsetY, canvasW * 0.85, titleFontSize * 1.2);

            // Expanding accent line under the title
            const lineProg = Math.max(0, Math.min(1, (t - 0.15) / 0.4));
            const lineW = canvasW * 0.18 * lineProg;
            ctx.globalAlpha = envelope * lineProg;
            ctx.fillStyle = '#6366f1';
            ctx.fillRect(centerX - lineW / 2, centerY + titleFontSize * 0.75, lineW, Math.max(2, canvasW * 0.0025));

            if (subtitle) {
                const subProg = Math.max(0, Math.min(1, (t - 0.3) / 0.5));
                const subEased = 1 - Math.pow(1 - subProg, 3);
                ctx.globalAlpha = envelope * subEased;
                ctx.fillStyle = '#cbd5e1';
                ctx.font = `400 ${subFontSize}px "Hind Siliguri", sans-serif`;
                drawWrappedText(ctx, subtitle, centerX, centerY + titleFontSize * 1.3, canvasW * 0.8, subFontSize * 1.3);
            }
        } else if (template === 'slideUp') {
            const titleProg = Math.max(0, Math.min(1, t / 0.55));
            const eased = easeOutBackOvershoot(titleProg);
            const startOffset = canvasH * 0.35;
            const offsetY = (1 - eased) * startOffset;
            ctx.globalAlpha = envelope * Math.min(1, titleProg * 2);
            ctx.fillStyle = '#ffffff';
            ctx.font = `800 ${titleFontSize}px "Hind Siliguri", sans-serif`;
            if (title) drawWrappedText(ctx, title, centerX, centerY + offsetY - 10, canvasW * 0.85, titleFontSize * 1.2);

            if (subtitle) {
                const subProg = Math.max(0, Math.min(1, (t - 0.2) / 0.55));
                const subEased = easeOutBackOvershoot(subProg);
                const subOffsetY = (1 - subEased) * startOffset;
                ctx.globalAlpha = envelope * Math.min(1, subProg * 2);
                ctx.fillStyle = '#e0e7ff';
                ctx.font = `500 ${subFontSize}px "Hind Siliguri", sans-serif`;
                drawWrappedText(ctx, subtitle, centerX, centerY + titleFontSize * 1.2 + subOffsetY, canvasW * 0.8, subFontSize * 1.3);
            }
        } else if (template === 'zoomPop') {
            const titleProg = Math.max(0, Math.min(1, t / 0.5));
            const scale = Math.max(0.001, easeOutBackOvershoot(titleProg));
            const wobble = Math.sin(t * Math.PI * 2) * (1 - titleProg) * 0.04;
            ctx.save();
            ctx.translate(centerX, centerY - titleFontSize * 0.3);
            ctx.rotate(wobble);
            ctx.scale(scale, scale);
            ctx.globalAlpha = envelope * Math.min(1, titleProg * 2);
            ctx.fillStyle = '#fbbf24';
            ctx.font = `800 ${titleFontSize}px "Hind Siliguri", sans-serif`;
            if (title) drawWrappedText(ctx, title, 0, 0, canvasW * 0.85, titleFontSize * 1.2);
            ctx.restore();

            if (subtitle) {
                const subProg = Math.max(0, Math.min(1, (t - 0.35) / 0.5));
                ctx.globalAlpha = envelope * subProg;
                ctx.fillStyle = '#f1f5f9';
                ctx.font = `400 ${subFontSize}px "Hind Siliguri", sans-serif`;
                drawWrappedText(ctx, subtitle, centerX, centerY + titleFontSize * 0.9, canvasW * 0.8, subFontSize * 1.3);
            }
        }

        ctx.restore();
    }

    // Runs a standalone rAF preview of an intro/outro segment directly on the
    // main editor canvas (pauses video if needed, restores the normal frame
    // via drawFrame() once the preview finishes).
    function runIntroOutroPreview(config) {
        if (!state.duration) {
            alert('প্রিভিউ দেখতে আগে একটি ভিডিও/ছবি লোড করুন।');
            return;
        }
        const canvas = state.canvas;
        const ctx = state.ctx;
        if (!state.video.paused) state.video.pause();

        const durationMs = Math.max(500, (config.duration || 3) * 1000);
        const startTs = performance.now();

        function tick(now) {
            const elapsed = now - startTs;
            const t = Math.min(1, elapsed / durationMs);
            drawIntroOutroSegment(ctx, canvas.width, canvas.height, config, t);
            if (t < 1) {
                requestAnimationFrame(tick);
            } else {
                drawFrame(); // restore the normal live-preview frame
            }
        }
        requestAnimationFrame(tick);
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

    // Builds a 256-entry per-channel lookup table from Shadows/Midtones/Highlights
    // control points (Phase 4C - Advanced Color Grading). Piecewise-linear between
    // (0, shadowAdj), (128, midAdj), (255, highAdj) — simple and predictable, no
    // overshoot/ringing like a spline could introduce.
    function buildChannelLUT(shadowAdj, midAdj, highAdj) {
        const lut = new Uint8ClampedArray(256);
        const y0 = 0 + shadowAdj;
        const y1 = 128 + midAdj;
        const y2 = 255 + highAdj;
        for (let x = 0; x <= 255; x++) {
            let y;
            if (x <= 128) {
                const t = x / 128;
                y = y0 + (y1 - y0) * t;
            } else {
                const t = (x - 128) / 127;
                y = y1 + (y2 - y1) * t;
            }
            lut[x] = Math.max(0, Math.min(255, Math.round(y)));
        }
        return lut;
    }

    function hexToRgba(hex, alpha) {
        const safe = String(hex || '#00e5ff').replace('#', '');
        const expanded = safe.length === 3 ? safe.split('').map(c => c + c).join('') : safe;
        const value = parseInt(expanded, 16);
        if (Number.isNaN(value)) return `rgba(0, 229, 255, ${alpha})`;
        return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
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

        // Calculate intro transition values
        // During export, customExportTime holds the clip-absolute time; during
        // live playback state.currentTime is used. Both are subtracted from
        // state.startTime (clip trim-start) to get elapsed seconds within the clip.
        const isExporting = (state.customExportTime !== undefined);
        const effectiveTime = isExporting ? state.customExportTime : state.currentTime;
        const elapsed = effectiveTime - state.startTime;
        const shouldAnimate = state.isPlaying || isExporting;
        const transitionActive = shouldAnimate && 
                                 state.introTransitionType && 
                                 state.introTransitionType !== 'none' && 
                                 elapsed >= 0 &&
                                 elapsed < state.introTransitionDuration;

        let transScale = 1;
        let transRotation = 0;
        let transX = 0;
        let transY = 0;
        let transAlpha = 1;
        let transBlur = 0;

        if (transitionActive) {
            const p = elapsed / state.introTransitionDuration; // 0 to 1
            const eased = 1 - Math.pow(1 - p, 3); // cubic ease-out
            
            if (state.introTransitionType === 'fade') {
                transAlpha = eased;
            } else if (state.introTransitionType === 'zoom_spin') {
                transScale = 0.1 + 0.9 * eased;
                transRotation = (1 - eased) * (-Math.PI);
                transAlpha = eased;
                transBlur = (1 - eased) * 20;
            } else if (state.introTransitionType === 'slide_right') {
                transX = canvasW * (1 - eased);
            } else if (state.introTransitionType === 'slide_left') {
                transX = -canvasW * (1 - eased);
            } else if (state.introTransitionType === 'slide_top') {
                transY = -canvasH * (1 - eased);
            } else if (state.introTransitionType === 'slide_bottom') {
                transY = canvasH * (1 - eased);
            }
        }

        if (transX !== 0 || transY !== 0) {
            state.ctx.translate(transX, transY);
        }
        if (transScale !== 1 || transRotation !== 0) {
            state.ctx.translate(canvasW / 2, canvasH / 2);
            state.ctx.scale(transScale, transScale);
            state.ctx.rotate(transRotation);
            state.ctx.translate(-canvasW / 2, -canvasH / 2);
        }
        if (transAlpha !== 1) {
            state.ctx.globalAlpha = transAlpha;
        }

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
        if (transBlur > 0.1) filterVal += `blur(${transBlur.toFixed(1)}px) `;
        
        state.ctx.filter = filterVal;
        
        // Draw current video frame with filters applied
        if (state.isAdjustingCrop) {
            state.ctx.drawImage(mediaSource, drawX, drawY, drawW, drawH);
        } else {
            const sx = (state.cropX || 0) * videoW;
            const sy = (state.cropY || 0) * videoH;
            const sw = (state.cropW || 1) * videoW;
            const sh = (state.cropH || 1) * videoH;
            if (window.phase9DrawMainMedia) {
                window.phase9DrawMainMedia(
                    state.ctx, mediaSource, sx, sy, sw, sh,
                    drawX, drawY, drawW, drawH,
                    activeClip, effectiveTime, videoW, videoH
                );
            } else {
                state.ctx.drawImage(mediaSource, sx, sy, sw, sh, drawX, drawY, drawW, drawH);
            }
        }
        state.ctx.restore();

        // --- Step A3: Advanced Color Grading (Custom RGB Curves, Phase 4C) ---
        // Applied pixel-level (getImageData/putImageData) only over the drawn video
        // rect, not the full canvas, so black letterbox bars aren't tinted by a
        // shadow adjustment. This runs on top of the CSS filter preset above, so
        // it works as a fine-tuning layer even when preset is "Normal".
        if (state.colorGradeEnabled) {
            const gradeX = Math.max(0, Math.round(drawX));
            const gradeY = Math.max(0, Math.round(drawY));
            const gradeW = Math.max(0, Math.min(canvasW - gradeX, Math.round(drawW)));
            const gradeH = Math.max(0, Math.min(canvasH - gradeY, Math.round(drawH)));

            if (gradeW > 0 && gradeH > 0) {
                const lutR = buildChannelLUT(state.gradeRShadow, state.gradeRMid, state.gradeRHigh);
                const lutG = buildChannelLUT(state.gradeGShadow, state.gradeGMid, state.gradeGHigh);
                const lutB = buildChannelLUT(state.gradeBShadow, state.gradeBMid, state.gradeBHigh);

                const imageData = state.ctx.getImageData(gradeX, gradeY, gradeW, gradeH);
                const data = imageData.data;
                for (let i = 0; i < data.length; i += 4) {
                    data[i] = lutR[data[i]];
                    data[i + 1] = lutG[data[i + 1]];
                    data[i + 2] = lutB[data[i + 2]];
                }
                state.ctx.putImageData(imageData, gradeX, gradeY);
            }
        }

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

            // Splits text into visual "grapheme clusters" rather than raw UTF-16
            // code units. This matters a lot for Bengali (and other complex-script)
            // captions: a naive character split can sever a base consonant from its
            // matra/combining mark, so animating "characters" independently would
            // visibly break conjuncts apart. Intl.Segmenter (widely supported in
            // Chromium-based browsers, which is what this app targets) clusters
            // combining marks with their base correctly; we fall back to a plain
            // code-point split only if it's unavailable.
            const splitGraphemes = (text) => {
                try {
                    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
                        const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
                        return Array.from(seg.segment(text), (s) => s.segment);
                    }
                } catch (e) { /* fall through to the simple split below */ }
                return Array.from(text);
            };

            // Kinetic Typography (v2.8) — per-letter / per-word text entrance & exit
            // styles, layered in addition to the existing whole-box styles (zoom,
            // slide, rotate-in, etc. still work on text too, they just move the
            // whole text box as one rigid unit). These instead animate the
            // individual characters or words that make up the caption. Only called
            // while tIn < animDur (entry) or tOut < animDur (exit); once settled,
            // the caller falls back to a normal single centered fillText draw, same
            // as every other style.
            //
            //   letter-rotate-settle — each letter spins in (alternating left/right)
            //     and scales up, staggered left-to-right, landing flat.
            //   letter-converge      — splits the caption into a left/right half at
            //     the nearest word boundary (or, for a single word, at the middle
            //     grapheme so a conjunct is never cut) and slides both halves in
            //     from off-canvas on opposite sides so they arrive together.
            //   letter-cascade-fade  — each letter fades in and settles down from
            //     slightly above, staggered — a soft "rising captions" look.
            //   word-pop-stagger     — each whole word pops in from 0 scale with a
            //     bouncy overshoot, one word after another.
            //
            // Exit plays the same stagger in reverse order (last unit in is first
            // unit out) so the text visually "unwinds" the way it wound in.
            const drawKineticText = (ctx, item, style, text, cx, cy, tIn, tOut, animDur, strokeOnFill) => {
                const isEntry = tIn < animDur;
                const localT = isEntry ? tIn : Math.max(0, tOut);
                const isExit = !isEntry;

                ctx.textBaseline = 'middle';

                if (style === 'letter-converge') {
                    let splitIdx = text.indexOf(' ', Math.floor(text.length / 2));
                    if (splitIdx === -1) splitIdx = text.lastIndexOf(' ', Math.floor(text.length / 2));
                    let leftText, rightText;
                    if (splitIdx === -1) {
                        const graph = splitGraphemes(text);
                        const mid = Math.ceil(graph.length / 2);
                        leftText = graph.slice(0, mid).join('');
                        rightText = graph.slice(mid).join('');
                    } else {
                        leftText = text.slice(0, splitIdx);
                        rightText = text.slice(splitIdx); // keeps the boundary space with the right half
                    }
                    ctx.textAlign = 'left';
                    const leftW = ctx.measureText(leftText).width;
                    const rightW = ctx.measureText(rightText).width;
                    const startX = cx - (leftW + rightW) / 2;

                    const p = easeOutBackOvershoot(Math.max(0, Math.min(1, localT / animDur)));
                    const clearDist = Math.max(canvasW, canvasH) * 0.7;
                    const leftOffset = -(1 - p) * clearDist;
                    const rightOffset = (1 - p) * clearDist;
                    const fadeP = Math.max(0.1, Math.min(1, localT / (animDur * 0.6)));

                    ctx.save();
                    ctx.globalAlpha *= fadeP;
                    if (strokeOnFill) {
                        ctx.strokeText(leftText, startX + leftOffset, cy);
                        ctx.strokeText(rightText, startX + leftW + rightOffset, cy);
                    }
                    ctx.fillText(leftText, startX + leftOffset, cy);
                    ctx.fillText(rightText, startX + leftW + rightOffset, cy);
                    ctx.restore();
                    return;
                }

                const byWord = (style === 'word-pop-stagger');
                const units = byWord ? text.split(/(\s+)/).filter((u) => u.length) : splitGraphemes(text);
                const n = units.length;
                if (n === 0) return;
                const widths = units.map((u) => ctx.measureText(u).width);
                const totalW = widths.reduce((a, b) => a + b, 0);

                const perUnitDur = Math.max(0.12, animDur * (byWord ? 0.6 : 0.5));
                const staggerSpan = Math.max(0, animDur - perUnitDur);

                ctx.textAlign = 'left';
                let x = cx - totalW / 2;
                for (let i = 0; i < n; i++) {
                    const w = widths[i];
                    const order = isExit ? (n - 1 - i) : i; // exit unwinds in reverse order
                    const delay = n > 1 ? (order / (n - 1)) * staggerSpan : 0;
                    const p = Math.max(0, Math.min(1, (localT - delay) / perUnitDur));
                    const eased = (style === 'word-pop-stagger') ? easeOutBackOvershoot(p) : brollEaseOut(p);
                    const bouncy = (style === 'letter-rotate-settle') ? easeOutBackOvershoot(p) : eased;

                    ctx.save();
                    const ux = x + w / 2, uy = cy;
                    ctx.globalAlpha *= Math.max(0.001, eased);
                    ctx.translate(ux, uy);
                    if (style === 'letter-rotate-settle') {
                        ctx.rotate((1 - bouncy) * (Math.PI / 2) * (i % 2 === 0 ? 1 : -1));
                        const sc = 0.3 + 0.7 * bouncy;
                        ctx.scale(sc, sc);
                    } else if (style === 'letter-cascade-fade') {
                        ctx.translate(0, (1 - eased) * (item.fontSize * 0.5));
                    } else if (style === 'word-pop-stagger') {
                        const sc = 0.3 + 0.7 * bouncy;
                        ctx.scale(sc, sc);
                    }
                    ctx.translate(-ux, -uy);
                    if (strokeOnFill) ctx.strokeText(units[i], x, uy);
                    ctx.fillText(units[i], x, uy);
                    ctx.restore();

                    x += w;
                }
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

                // While paused in Step 3 we always show the overlay being EDITED (the
                // currently selected one) so it can be positioned/sized regardless of
                // where the playhead sits. Other, non-selected overlays still respect
                // their real start/end timing — otherwise every B-roll item you've ever
                // added stacks up on screen at once while you're editing a new one,
                // which is both visually confusing and breaks click-to-select (an old,
                // already-exported item's box can sit on top of the one you're trying
                // to place). Once playing (in any step), everything respects real timing.
                const isBeingEdited = state.currentStep === 3 && !state.isPlaying && item.id === state.selectedBrollId;
                const inRange = isBeingEdited
                    ? true
                    : (currentTime >= item.startSec && currentTime <= item.endSec);
                if (!inRange) {
                    // Pause an overlay video the moment it's no longer on screen so it
                    // doesn't keep decoding/playing in the background. Skipped during
                    // export — the exporter takes full manual control of seeking there.
                    if (item.type === 'video' && item.videoEl && state.customExportTime === undefined && !item.videoEl.paused) {
                        item.videoEl.pause();
                    }
                    return;
                }

                const tIn = currentTime - item.startSec;
                const tOut = item.endSec - currentTime;
                const animDur = item.animationSpeedSec || 0.4;
                const resolvedExitDir = (!item.exitDirection || item.exitDirection === 'same')
                    ? (item.entryDirection || 'bottom')
                    : item.exitDirection;

                // Keep an overlay video's own playback in sync with the main timeline
                // during LIVE preview. During export (customExportTime is set) this is
                // skipped entirely — the exporter seeks each active video overlay to the
                // exact frame itself, synchronously, before capturing the canvas, since
                // free-running playback can't guarantee the right frame lands on the
                // right captured tick.
                if (item.type === 'video' && item.videoEl && state.customExportTime === undefined) {
                    item.videoEl.loop = !!item.loopVideo;
                    if (state.isPlaying) {
                        if (item.videoEl.paused) item.videoEl.play().catch(() => {});
                    } else {
                        if (!item.videoEl.paused) item.videoEl.pause();
                        const dur = item.videoEl.duration || 0;
                        let rel = Math.max(0, tIn);
                        if (dur > 0) rel = item.loopVideo ? (rel % dur) : Math.min(rel, dur - 0.03);
                        if (dur > 0 && Math.abs(item.videoEl.currentTime - rel) > 0.08) {
                            item.videoEl.currentTime = rel;
                        }
                    }
                }


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
                    if (item.soundEffect === 'custom') {
                        // A real uploaded clip plays once at entry only — replaying a
                        // longer voice clip again on exit would usually overlap badly.
                        if (!item._sfxEnterPlayed && currentTime >= item.startSec) {
                            item._sfxEnterPlayed = true;
                            if (item.customSoundBuffer && window.playBrollCustomSound) window.playBrollCustomSound(item.customSoundBuffer);
                        }
                    } else {
                        if (!item._sfxEnterPlayed && currentTime >= item.startSec) {
                            item._sfxEnterPlayed = true;
                            if (window.playBrollSfx) window.playBrollSfx(item.soundEffect);
                        }
                        if (!item._sfxExitPlayed && tOut <= animDur && currentTime < item.endSec) {
                            item._sfxExitPlayed = true;
                            if (window.playBrollSfx) window.playBrollSfx(item.soundEffect);
                        }
                    }
                }

                // ---- 1. Box rect: where/how big is the thing we're animating? ----
                // Fullscreen = the video frame's own draw rect. PiP = a small box
                // sized by its content and positioned by item.x/item.y (drag-anywhere).
                let boxX, boxY, boxW, boxH;
                if (item.mode === 'fullscreen') {
                    const scale = ((item.size !== undefined ? item.size : 100)) / 100;
                    if (scale >= 0.999) {
                        // Full coverage (default) — identical to the old behaviour
                        boxX = drawX; boxY = drawY; boxW = drawW; boxH = drawH;
                    } else {
                        // Custom size: scale from the center of the video draw rect.
                        // item.x/y are set when the user drags the box, otherwise centered.
                        boxW = drawW * scale;
                        boxH = drawH * scale;
                        if (item._fsPosSet) {
                            boxX = item.x * canvasW;
                            boxY = item.y * canvasH;
                        } else {
                            boxX = drawX + (drawW - boxW) / 2;
                            boxY = drawY + (drawH - boxH) / 2;
                        }
                    }
                } else {
                    if (item.type === 'text') {
                        state.ctx.font = `bold ${item.fontSize}px "Hind Siliguri", "Plus Jakarta Sans", sans-serif`;
                        const metrics = state.ctx.measureText(item.text);
                        boxW = metrics.width + 32;
                        boxH = item.fontSize + 24;
                    } else {
                        if (item.pipW !== undefined && item.pipH !== undefined) {
                            // Free-form resize set by dragging corner/edge handles
                            boxW = item.pipW * canvasW;
                            boxH = item.pipH * canvasH;
                        } else {
                            boxW = canvasW * (item.size / 100);
                            boxH = boxW * (item.imageImg.naturalHeight / item.imageImg.naturalWidth);
                        }
                    }
                    boxX = item.x * canvasW;
                    boxY = item.y * canvasH;
                }

                // ---- 2. Resolve the animation transform (same style set, any box) ----
                const style = item.animationStyle || (item.mode === 'pip' ? 'slide-pop' : 'zoom');
                let alpha = 1, scaleAmt = 1, rotateAmt = 0, blurPx = 0, wipeFrac = 1;
                let offX = 0, offY = 0; // absolute px offset applied to the box during entry/exit
                let hangAngle = 0; // pendulum-swing rotation for 'hanging-sign-swing', pivoted at the string, not the box center

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
                    } else if (style === 'wipe' || style === 'highlight-sweep' || style === 'comparison-slide' || style === 'plane-banner-trail') {
                        // Directional reveal: a growing clip rectangle wipes the box's
                        // content into view from the entry edge, then wipes it away on exit.
                        // 'highlight-sweep' reuses this exact reveal mechanic and additionally
                        // paints a translucent marker-color bar in step with it (see the
                        // drawing section below), so the content looks "highlighted on".
                        // 'plane-banner-trail' also reuses it: the content (text/image)
                        // reveals left-to-right exactly like sky-writing letters trailing
                        // behind a plane; the plane + dashed trail itself is drawn on top
                        // in the annotation section below, flying in lockstep with wipeFrac.
                        if (tIn < animDur) {
                            wipeFrac = brollEaseOut(tIn / animDur);
                        } else if (tOut < animDur) {
                            wipeFrac = brollEaseOut(tOut / animDur);
                        }
                    } else if (style === 'hanging-sign-swing') {
                        // A sign hung on a string from a fixed pin above the box: it
                        // lowers into place while swinging like a damped pendulum, then
                        // gently keeps swaying while on screen, and swings back up on exit.
                        // The rotation pivot is the pin point (above the box), not the box
                        // center, so this is handled with its own transform below rather
                        // than the generic rotateAmt/scaleAmt path.
                        if (tIn < animDur) {
                            const p = Math.max(0, Math.min(1, tIn / animDur));
                            const dropEase = brollEaseOut(Math.min(1, p / 0.6));
                            offY = -(boxH * 0.7) * (1 - dropEase);
                            alpha = Math.max(0.25, dropEase);
                            const decay = Math.pow(1 - p, 1.5);
                            hangAngle = decay * Math.sin(p * Math.PI * 3.4) * (Math.PI / 8);
                        } else if (tOut < animDur) {
                            const p = Math.max(0, Math.min(1, tOut / animDur));
                            const dropEase = brollEaseOut(Math.min(1, p / 0.6));
                            offY = -(boxH * 0.7) * (1 - dropEase);
                            alpha = Math.max(0.25, dropEase);
                            const decay = Math.pow(1 - p, 1.5);
                            hangAngle = decay * Math.sin(p * Math.PI * 3.4) * (Math.PI / 8);
                        } else {
                            // Idle hold: a slow, small continuous sway so the sign feels
                            // alive on a string rather than freezing dead-still mid-air.
                            hangAngle = Math.sin(tIn * 1.4) * (Math.PI / 60);
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
                    } else if (style === 'zoom-pop' || style === 'confetti-pop' || style === 'heart-burst') {
                        // Quick pop-in scale from 70% with a bouncy overshoot — distinct
                        // from the slow continuous Ken Burns 'zoom' below. 'confetti-pop'
                        // and 'heart-burst' reuse this exact box pop and additionally burst
                        // colorful particles / hearts outward (drawn in the annotation section below).
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

                // User-set static rotation (Phase 5D+, manual rotate handle) — composites
                // on top of any animation-driven rotateAmt set above, so a manually
                // rotated B-roll box still plays its entry/exit rotation animations
                // (e.g. 'rotate-in') around its own tilted angle.
                if (item.rotation) rotateAmt += item.rotation * Math.PI / 180;

                // ---- 3. Draw: box transform (position/scale/rotate/blur/alpha) is the
                // same regardless of mode; only the content differs (text vs image, and
                // for images, whether we additionally animate the source crop window). ----
                const drawBoxX = boxX + offX;
                const drawBoxY = boxY + offY;

                state.ctx.save();
                state.ctx.globalAlpha = alpha;

                // "Blank page" background (v2.7): when enabled on a fullscreen Text
                // B-roll, paint a full-canvas solid fill BEFORE the text/box itself so
                // the underlying video is completely hidden — good for point-by-point
                // explanations where the person wants a clean slide instead of text
                // floating over their footage. Fades in/out with the same alpha as the
                // text so it never pops on/off abruptly. PiP text ignores this (a small
                // corner box painting the whole screen would look broken).
                if (item.type === 'text' && item.mode === 'fullscreen' && item.bgEnabled) {
                    state.ctx.fillStyle = item.bgColor || '#0f172a';
                    state.ctx.fillRect(0, 0, canvasW, canvasH);
                }

                if (blurPx > 0.1) state.ctx.filter = `blur(${blurPx.toFixed(1)}px)`;

                const cx = drawBoxX + boxW / 2;
                const cy = drawBoxY + boxH / 2;
                let hangPinX = 0, hangPinY = 0, hangStringLen = 0;
                if (style === 'hanging-sign-swing') {
                    // Pivot at a pin fixed a little above the box's resting position
                    // (not affected by the entry/exit drop offset, so the string
                    // visibly pays out/reels in as the sign lowers/raises).
                    hangStringLen = Math.max(18, boxH * 0.22);
                    hangPinX = boxX + boxW / 2;
                    hangPinY = boxY - hangStringLen;
                    state.ctx.translate(hangPinX, hangPinY);
                    state.ctx.rotate(hangAngle);
                    state.ctx.translate(-hangPinX, -hangPinY);
                } else if (rotateAmt !== 0 || scaleAmt !== 1) {
                    state.ctx.translate(cx, cy);
                    if (rotateAmt !== 0) state.ctx.rotate(rotateAmt);
                    state.ctx.scale(scaleAmt, scaleAmt);
                    state.ctx.translate(-cx, -cy);
                }
                if (style === 'hanging-sign-swing') {
                    // String + pin, drawn inside the same rotated space so they swing
                    // together with the sign, like it's genuinely hanging from the pin.
                    const signTopMidX = drawBoxX + boxW / 2;
                    state.ctx.strokeStyle = 'rgba(255,255,255,0.85)';
                    state.ctx.lineWidth = 2;
                    state.ctx.beginPath();
                    state.ctx.moveTo(hangPinX, hangPinY);
                    state.ctx.lineTo(signTopMidX, drawBoxY);
                    state.ctx.stroke();
                    state.ctx.fillStyle = '#ef4444';
                    state.ctx.beginPath();
                    state.ctx.arc(hangPinX, hangPinY, Math.max(5, boxH * 0.05), 0, Math.PI * 2);
                    state.ctx.fill();
                    state.ctx.strokeStyle = 'rgba(0,0,0,0.25)';
                    state.ctx.lineWidth = 1.5;
                    state.ctx.stroke();
                }
                if (wipeFrac < 0.999) {
                    state.ctx.save();
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
                    // "Normal" mode (transparentBg explicitly off) paints a solid dark
                    // scrim/pill behind the text so it reads clearly over busy video.
                    // Default is transparent — text sits directly on the footage with
                    // no backdrop at all.
                    if (item.transparentBg === false) {
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
                    }
                    // Marker-style solid highlight — a tight-fit color band behind the
                    // text, independent of the dark scrim above (both can combine, though
                    // in practice you'd normally use one or the other).
                    if (item.solidHighlight) {
                        state.ctx.fillStyle = item.highlightColor || '#ffe600';
                        if (state.ctx.roundRect) {
                            state.ctx.beginPath();
                            state.ctx.roundRect(drawBoxX, drawBoxY, boxW, boxH, Math.min(10, boxH * 0.15));
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
                    const kineticTextStyles = ['letter-rotate-settle', 'letter-converge', 'letter-cascade-fade', 'word-pop-stagger'];
                    if (style === 'typewriter' && brollAnimActive && tIn < animDur) {
                        typewriterActive = true;
                        const fullWidth = state.ctx.measureText(item.text).width;
                        const leftX = cx - fullWidth / 2;
                        const revealCount = Math.max(0, Math.min(item.text.length, Math.round(item.text.length * Math.max(0, Math.min(1, tIn / animDur)))));
                        renderText = item.text.slice(0, revealCount);
                        state.ctx.textAlign = 'left';
                        if (item.mode === 'fullscreen' && item.transparentBg === false) {
                            state.ctx.lineWidth = Math.max(2, item.fontSize * 0.08);
                            state.ctx.strokeStyle = 'rgba(0,0,0,0.55)';
                            state.ctx.strokeText(renderText, leftX, cy);
                        }
                        state.ctx.fillText(renderText, leftX, cy);
                        cursorX = leftX + state.ctx.measureText(renderText).width + Math.max(2, item.fontSize * 0.04);
                        cursorTop = cy - item.fontSize * 0.42;
                        cursorBottom = cy + item.fontSize * 0.42;
                    } else if (kineticTextStyles.includes(style) && brollAnimActive && (tIn < animDur || tOut < animDur)) {
                        // Kinetic Typography: per-letter/word entrance & exit. Only takes
                        // over while actually entering/exiting; once settled this falls
                        // through to the plain centered draw below, same as every other style.
                        if (item.mode === 'fullscreen' && item.transparentBg === false) {
                            state.ctx.lineWidth = Math.max(2, item.fontSize * 0.08);
                            state.ctx.strokeStyle = 'rgba(0,0,0,0.55)';
                        }
                        drawKineticText(state.ctx, item, style, item.text, cx, cy, tIn, tOut, animDur, item.mode === 'fullscreen' && item.transparentBg === false);
                    } else {
                        state.ctx.textAlign = 'center';
                        if (item.mode === 'fullscreen' && item.transparentBg === false) {
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
                    // Source rect: cover-crop to fill the box (PiP and fullscreen@100%).
                    // Exception 1: fullscreen at < 100% size shows the FULL image (contain)
                    // so the user can actually see the whole image in the smaller frame.
                    // Exception 2: the user explicitly picked "Contain" fit mode for a
                    // fullscreen image whose aspect ratio doesn't match the canvas, so
                    // nothing gets cropped off — letterbox bars fill the rest instead.
                    const fsSmall = item.mode === 'fullscreen' && (((item.size !== undefined ? item.size : 100) < 99.9) || item.fitMode === 'contain');
                    const imgAspect = item.imageImg.naturalWidth / item.imageImg.naturalHeight;
                    const boxAspect = boxW / boxH;
                    let sx, sy, sw, sh;
                    if (fsSmall) {
                        // Contain mode — show the whole image, adjust destination rect
                        sx = 0; sy = 0; sw = item.imageImg.naturalWidth; sh = item.imageImg.naturalHeight;
                    } else if (imgAspect > boxAspect) {
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
                    // "Normal" mode (transparentBg explicitly turned off) keeps the old
                    // translucent black backdrop behind PiP images so they stand out
                    // against busy footage. Default is transparent — no backdrop — so
                    // background-removed PNGs stay fully see-through.
                    if (item.mode === 'pip' && item.transparentBg === false) {
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
                        if (fsSmall) {
                            // Contain mode: compute letterboxed destination rect
                            let dX = drawBoxX, dY = drawBoxY, dW = boxW, dH = boxH;
                            if (imgAspect > boxAspect) {
                                dH = boxW / imgAspect;
                                dY = drawBoxY + (boxH - dH) / 2;
                            } else {
                                dW = boxH * imgAspect;
                                dX = drawBoxX + (boxW - dW) / 2;
                            }
                            // Paint the leftover space black first (only meaningful when
                            // the box is the full fullscreen frame, i.e. item.fitMode ===
                            // 'contain' at 100% size) so the gap reads as an intentional
                            // letterbox bar instead of showing whatever was drawn behind it.
                            if (item.mode === 'fullscreen' && item.fitMode === 'contain') {
                                state.ctx.fillStyle = '#000000';
                                if (imgAspect > boxAspect) {
                                    if (dY > drawBoxY) {
                                        state.ctx.fillRect(drawBoxX, drawBoxY, boxW, dY - drawBoxY);
                                    }
                                    if ((drawBoxY + boxH) > (dY + dH)) {
                                        state.ctx.fillRect(drawBoxX, dY + dH, boxW, (drawBoxY + boxH) - (dY + dH));
                                    }
                                } else {
                                    if (dX > drawBoxX) {
                                        state.ctx.fillRect(drawBoxX, drawBoxY, dX - drawBoxX, boxH);
                                    }
                                    if ((drawBoxX + boxW) > (dX + dW)) {
                                        state.ctx.fillRect(dX + dW, drawBoxY, (drawBoxX + boxW) - (dX + dW), boxH);
                                    }
                                }
                            }
                            state.ctx.drawImage(item.imageImg, 0, 0, item.imageImg.naturalWidth, item.imageImg.naturalHeight, dX, dY, dW, dH);
                        } else {
                            state.ctx.drawImage(item.imageImg, sx, sy, sw, sh, drawBoxX, drawBoxY, boxW, boxH);
                        }
                    }
                }

                // Pop the wipe-reveal clip (pushed above with its own save()) before any
                // annotation drawing — annotations like the flying plane are positioned
                // above/outside the box rect and must not be clipped away by it.
                if (wipeFrac < 0.999) state.ctx.restore();

                // Hand-drawn-style annotation markers (v2.5) — layered on top of the
                // content after it's painted, growing in sync with the entry (and
                // shrinking back out on exit) so they feel "drawn on" rather than
                // just appearing instantly.
                if (brollAnimActive && (style === 'circle-highlight' || style === 'underline-draw' || style === 'checkmark-pop' || style === 'thinking-character' || style === 'arrow-point' || style === 'magnifier-zoom' || style === 'question-bounce' || style === 'confetti-pop' || style === 'heart-burst' || style === 'plane-banner-trail')) {
                    let annoP = 1;
                    let annoInEntry = false, annoInExit = false;
                    if (tIn < animDur) { annoP = brollEaseOut(tIn / animDur); annoInEntry = true; }
                    else if (tOut < animDur) { annoP = brollEaseOut(tOut / animDur); annoInExit = true; }

                    if (annoP > 0.01) {
                        const markColor = (item.type === 'text') ? item.color : '#fbbf24';
                        if (style === 'plane-banner-trail') {
                            // A little paper plane flies across the top of the box, towing a
                            // dashed trail behind it — the box content underneath reveals via
                            // the shared wipeFrac clip (set above), so it looks like the text/
                            // image is being "written"/towed into view by the plane, sky-writing
                            // style. Only drawn during entry/exit (annoInEntry/annoInExit); it
                            // parks off-frame during the hold, same as the wipe/reveal it drives.
                            if (annoInEntry || annoInExit) {
                                const dir = annoInEntry ? (item.entryDirection || 'left') : resolvedExitDir;
                                const flyingRightward = (dir !== 'right');
                                // annoP already runs 0->1 in the direction of travel for entry;
                                // for exit we want the plane to continue exiting the way it came,
                                // so it keeps moving forward (not reversing) as annoP grows.
                                const travelP = annoInEntry ? annoP : (1 - annoP);
                                const startX = drawBoxX - boxW * 0.15;
                                const endX = drawBoxX + boxW * 1.15;
                                const laneY = drawBoxY - Math.max(14, boxH * 0.18);
                                const planeX = flyingRightward
                                    ? startX + (endX - startX) * travelP
                                    : endX - (endX - startX) * travelP;
                                const trailFromX = flyingRightward ? startX : planeX;
                                const trailToX = flyingRightward ? planeX : endX;

                                state.ctx.save();
                                state.ctx.strokeStyle = 'rgba(255,255,255,0.75)';
                                state.ctx.lineWidth = Math.max(1.5, boxH * 0.02);
                                state.ctx.setLineDash([6, 6]);
                                state.ctx.beginPath();
                                state.ctx.moveTo(trailFromX, laneY);
                                state.ctx.lineTo(trailToX, laneY);
                                state.ctx.stroke();
                                state.ctx.setLineDash([]);

                                const planeSize = Math.max(16, Math.min(boxW, boxH) * 0.22);
                                state.ctx.translate(planeX, laneY);
                                if (!flyingRightward) state.ctx.scale(-1, 1);
                                state.ctx.font = `${planeSize}px "Segoe UI Emoji", sans-serif`;
                                state.ctx.textAlign = 'center';
                                state.ctx.textBaseline = 'middle';
                                state.ctx.fillText('✈️', 0, 0);
                                state.ctx.restore();
                            }
                        } else if (style === 'circle-highlight') {
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
                        } else if (style === 'heart-burst') {
                            // Same one-shot entry burst as confetti-pop, but floating ❤️ hearts
                            // drifting upward instead of falling confetti squares — for
                            // "ভালোবাসা" / affection beats in the script.
                            if (tIn < animDur) {
                                const burstP = Math.max(0, Math.min(1, tIn / animDur));
                                const particleAlpha = 1 - Math.pow(burstP, 2.2);
                                if (particleAlpha > 0.02) {
                                    const pcx = drawBoxX + boxW / 2, pcy = drawBoxY + boxH / 2;
                                    const maxDist = Math.max(boxW, boxH) * 0.7;
                                    const N = 10;
                                    state.ctx.save();
                                    state.ctx.globalAlpha = particleAlpha;
                                    state.ctx.textAlign = 'center';
                                    state.ctx.textBaseline = 'middle';
                                    for (let i = 0; i < N; i++) {
                                        // Deterministic pseudo-random spread (not Math.random) so
                                        // exported frames stay identical across repeated renders.
                                        const seedAngle = -Math.PI / 2 + ((i / N) - 0.5) * Math.PI * 1.3 + (i % 3) * 0.12;
                                        const seedDist = (0.4 + ((i * 41) % 60) / 100) * maxDist * burstP;
                                        const px = pcx + Math.cos(seedAngle) * seedDist * 0.6;
                                        const py = pcy + Math.sin(seedAngle) * seedDist - (burstP * 20);
                                        const hsize = Math.max(10, Math.min(boxW, boxH) * (0.12 + (i % 3) * 0.03));
                                        state.ctx.font = `${Math.round(hsize)}px sans-serif`;
                                        state.ctx.fillText('❤️', px, py);
                                    }
                                    state.ctx.restore();
                                }
                            }
                        }
                    }
                }

                // Selection outline + resize handles in Step 3.
                // Shown for PiP always, and for Fullscreen when size < 100%.
                const isFsCustom = item.mode === 'fullscreen' && (item.size !== undefined && item.size < 100);
                if (state.currentStep === 3 && (item.mode === 'pip' || isFsCustom) && item.id === state.selectedBrollId) {
                    // Dashed outline
                    state.ctx.strokeStyle = 'rgba(79, 70, 229, 0.9)';
                    state.ctx.lineWidth = 2;
                    state.ctx.setLineDash([6, 4]);
                    state.ctx.strokeRect(drawBoxX, drawBoxY, boxW, boxH);
                    state.ctx.setLineDash([]);
                    // Resize handles for PiP (8-point: 4 corners + 4 edges)
                    if (item.mode === 'pip') {
                        const hs = Math.max(7, Math.min(canvasW, canvasH) * 0.018);
                        const hpts = [
                            [drawBoxX,          drawBoxY],
                            [drawBoxX + boxW/2,  drawBoxY],
                            [drawBoxX + boxW,    drawBoxY],
                            [drawBoxX + boxW,    drawBoxY + boxH/2],
                            [drawBoxX + boxW,    drawBoxY + boxH],
                            [drawBoxX + boxW/2,  drawBoxY + boxH],
                            [drawBoxX,           drawBoxY + boxH],
                            [drawBoxX,           drawBoxY + boxH/2],
                        ];
                        state.ctx.fillStyle = '#ffffff';
                        state.ctx.strokeStyle = 'rgba(79, 70, 229, 0.95)';
                        state.ctx.lineWidth = 1.5;
                        hpts.forEach(([hx, hy]) => {
                            state.ctx.beginPath();
                            state.ctx.rect(hx - hs/2, hy - hs/2, hs, hs);
                            state.ctx.fill();
                            state.ctx.stroke();
                        });
                    }
                    // Rotate handle: a small circle above the box's top-center, joined by
                    // a stem line. Drawn here (still inside the box's own rotate/scale
                    // ctx transform above) so it visually spins together with the box —
                    // dragging it sets item.rotation (see findBrollRotateHandle / handlePointerMove).
                    {
                        const rCx = drawBoxX + boxW / 2;
                        const handleDist = Math.max(28, Math.min(canvasW, canvasH) * 0.05);
                        const rHy = drawBoxY - handleDist;
                        state.ctx.strokeStyle = 'rgba(79, 70, 229, 0.9)';
                        state.ctx.lineWidth = 2;
                        state.ctx.beginPath();
                        state.ctx.moveTo(rCx, drawBoxY);
                        state.ctx.lineTo(rCx, rHy);
                        state.ctx.stroke();
                        const rHandleR = Math.max(8, Math.min(canvasW, canvasH) * 0.02);
                        state.ctx.fillStyle = '#ffffff';
                        state.ctx.beginPath();
                        state.ctx.arc(rCx, rHy, rHandleR, 0, Math.PI * 2);
                        state.ctx.fill();
                        state.ctx.stroke();
                    }
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
                // During export, use the deterministic frame timeline rather than
                // video.currentTime. Seeking can briefly report the previous frame
                // while a B-roll overlay is being drawn, which would repeat the
                // ticker position even though output frames continue advancing.
                const elapsed = state.exportTickerTime ?? state.currentTime ?? 0;
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
            state.ctx.restore();
            
            if (state.currentStep === 2) {
                state.ctx.save();
                state.ctx.strokeStyle = 'rgba(79, 70, 229, 0.8)';
                state.ctx.lineWidth = 2;
                state.ctx.strokeRect(x, y, logoW, logoH);
                state.ctx.fillStyle = '#ffffff';
                state.ctx.fillRect(x + logoW - 6, y + logoH - 6, 12, 12);
                state.ctx.strokeStyle = '#4f46e5';
                state.ctx.strokeRect(x + logoW - 6, y + logoH - 6, 12, 12);
                state.ctx.restore();
            }
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

        // --- Step F2: Draw Sticker/Emoji Overlays (Phase 4A) ---
        if (state.stickers && state.stickers.length > 0) {
            state.stickers.forEach((item) => {
                const fontSize = canvasW * (item.size / 100);
                const sx = item.x * canvasW;
                const sy = item.y * canvasH;

                state.ctx.save();
                state.ctx.font = `${fontSize}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
                state.ctx.textAlign = 'center';
                state.ctx.textBaseline = 'middle';
                state.ctx.fillText(item.emoji, sx, sy);
                state.ctx.restore();

                // Selection box + resize handle in Step 3 for the active sticker being edited
                if (state.currentStep === 3 && item.id === state.selectedStickerId) {
                    const boxW = fontSize * 1.15;
                    const boxH = fontSize * 1.15;

                    state.ctx.save();
                    state.ctx.strokeStyle = 'rgba(79, 70, 229, 0.9)';
                    state.ctx.lineWidth = 2;
                    state.ctx.setLineDash([6, 4]);
                    state.ctx.strokeRect(sx - boxW / 2, sy - boxH / 2, boxW, boxH);
                    state.ctx.setLineDash([]);

                    state.ctx.fillStyle = '#ffffff';
                    state.ctx.fillRect(sx + boxW / 2 - 6, sy + boxH / 2 - 6, 12, 12);
                    state.ctx.strokeStyle = '#4f46e5';
                    state.ctx.strokeRect(sx + boxW / 2 - 6, sy + boxH / 2 - 6, 12, 12);
                    state.ctx.restore();
                }
            });
        }

        // --- Step F2b: Draw Symbol/Shape Overlays (arrow, cross, tick, question mark, etc.) ---
        // Modeled on the Sticker overlay (drag + corner resize) plus the B-roll
        // rotate handle (drag the circle above the shape to spin it). Each symbol
        // has its own start/end time window, like Text Overlays and B-roll.
        if (state.symbolOverlays && state.symbolOverlays.length > 0) {
            const symCurrentTime = state.currentTime;
            state.symbolOverlays.forEach((item) => {
                const isVisible = (state.currentStep === 3 && !state.isPlaying)
                    ? true
                    : (symCurrentTime >= item.startSec && symCurrentTime <= item.endSec);
                if (!isVisible) return;

                const box = getSymbolBox(item, canvasW, canvasH);
                const rotation = item.rotation || 0;

                state.ctx.save();
                state.ctx.translate(box.cx, box.cy);
                state.ctx.rotate(rotation * Math.PI / 180);
                drawSymbolShape(state.ctx, item.symbolType, box.s, item.color || '#ffffff');
                state.ctx.restore();

                // Selection outline + resize/rotate handles in Step 3 for the active symbol
                if (state.currentStep === 3 && item.id === state.selectedSymbolId) {
                    state.ctx.save();
                    state.ctx.translate(box.cx, box.cy);
                    state.ctx.rotate(rotation * Math.PI / 180);

                    const half = box.s / 2;
                    state.ctx.strokeStyle = 'rgba(79, 70, 229, 0.9)';
                    state.ctx.lineWidth = 2;
                    state.ctx.setLineDash([6, 4]);
                    state.ctx.strokeRect(-half - 6, -half - 6, box.s + 12, box.s + 12);
                    state.ctx.setLineDash([]);

                    // Resize handle (bottom-right corner)
                    state.ctx.fillStyle = '#ffffff';
                    state.ctx.fillRect(half + 6 - 6, half + 6 - 6, 12, 12);
                    state.ctx.strokeStyle = '#4f46e5';
                    state.ctx.strokeRect(half + 6 - 6, half + 6 - 6, 12, 12);

                    // Rotate handle (small circle above the shape, connected by a line)
                    const handleDist = Math.max(28, Math.min(canvasW, canvasH) * 0.05);
                    state.ctx.beginPath();
                    state.ctx.moveTo(0, -half - 6);
                    state.ctx.lineTo(0, -half - 6 - handleDist);
                    state.ctx.strokeStyle = 'rgba(79, 70, 229, 0.9)';
                    state.ctx.lineWidth = 1.5;
                    state.ctx.stroke();

                    state.ctx.beginPath();
                    state.ctx.arc(0, -half - 6 - handleDist, 8, 0, Math.PI * 2);
                    state.ctx.fillStyle = '#ffffff';
                    state.ctx.fill();
                    state.ctx.strokeStyle = '#4f46e5';
                    state.ctx.lineWidth = 2;
                    state.ctx.stroke();

                    state.ctx.restore();
                }
            });
        }

        // --- Step F2c: Draw Shape + Text Overlays (Word-style shapes: ribbon
        // banner, wavy banner, thought cloud, 6-point star, oval callout) ---
        // Modeled on the Symbol overlay (drag + corner resize + rotate handle),
        // but the box is rectangular (not square) since these shapes are wide/
        // tall, and each carries its own multi-line text drawn on top of the fill.
        if (state.shapeOverlays && state.shapeOverlays.length > 0) {
            const shpCurrentTime = state.currentTime;
            state.shapeOverlays.forEach((item) => {
                const isVisible = (state.currentStep === 3 && !state.isPlaying)
                    ? true
                    : (shpCurrentTime >= item.startSec && shpCurrentTime <= item.endSec);
                if (!isVisible) return;

                const box = getShapeOverlayBox(item, canvasW, canvasH);
                const rotation = item.rotation || 0;

                state.ctx.save();
                state.ctx.translate(box.cx, box.cy);
                state.ctx.rotate(rotation * Math.PI / 180);
                drawShapeOverlayPath(state.ctx, item.shapeType, box.w, box.h, item.fillColor || '#4f46e5');
                if (item.text) {
                    drawShapeOverlayText(state.ctx, item, box.w, box.h);
                }
                state.ctx.restore();

                // Selection outline + resize/rotate handles in Step 3 for the active shape
                if (state.currentStep === 3 && item.id === state.selectedShapeOverlayId) {
                    state.ctx.save();
                    state.ctx.translate(box.cx, box.cy);
                    state.ctx.rotate(rotation * Math.PI / 180);

                    const halfW = box.w / 2;
                    const halfH = box.h / 2;
                    state.ctx.strokeStyle = 'rgba(79, 70, 229, 0.9)';
                    state.ctx.lineWidth = 2;
                    state.ctx.setLineDash([6, 4]);
                    state.ctx.strokeRect(-halfW - 6, -halfH - 6, box.w + 12, box.h + 12);
                    state.ctx.setLineDash([]);

                    // Resize handle (bottom-right corner)
                    state.ctx.fillStyle = '#ffffff';
                    state.ctx.fillRect(halfW + 6 - 6, halfH + 6 - 6, 12, 12);
                    state.ctx.strokeStyle = '#4f46e5';
                    state.ctx.strokeRect(halfW + 6 - 6, halfH + 6 - 6, 12, 12);

                    // Rotate handle (small circle above the shape, connected by a line)
                    const handleDist = Math.max(28, Math.min(canvasW, canvasH) * 0.05);
                    state.ctx.beginPath();
                    state.ctx.moveTo(0, -halfH - 6);
                    state.ctx.lineTo(0, -halfH - 6 - handleDist);
                    state.ctx.strokeStyle = 'rgba(79, 70, 229, 0.9)';
                    state.ctx.lineWidth = 1.5;
                    state.ctx.stroke();

                    state.ctx.beginPath();
                    state.ctx.arc(0, -halfH - 6 - handleDist, 8, 0, Math.PI * 2);
                    state.ctx.fillStyle = '#ffffff';
                    state.ctx.fill();
                    state.ctx.strokeStyle = '#4f46e5';
                    state.ctx.lineWidth = 2;
                    state.ctx.stroke();

                    state.ctx.restore();
                }
            });
        }

        // --- Step E1.5: Background Fill Regions ---
        // Rendered on top of B-roll and text overlays but below the highlight callout guides.
        if (state.fillRegions && state.fillRegions.length > 0) {
            const currentTime = state.currentTime || 0;
            const canvasW = state.canvas.width;
            const canvasH = state.canvas.height;
            state.fillRegions.forEach(item => {
                if (currentTime < item.startSec || currentTime > item.endSec) return;
                if (item.w <= 0 || item.h <= 0) return;
                const rx = item.x * canvasW;
                const ry = item.y * canvasH;
                const rw = item.w * canvasW;
                const rh = item.h * canvasH;
                state.ctx.save();
                state.ctx.globalAlpha = Math.max(0, Math.min(1, (item.opacity ?? 80) / 100));
                state.ctx.fillStyle = item.color || '#000000';
                state.ctx.fillRect(rx, ry, rw, rh);
                state.ctx.globalAlpha = 1;
                // Selection outline in edit mode
                if (state.currentStep === 3 && state.isAddingFill && item.id === state.selectedFillId) {
                    state.ctx.strokeStyle = '#ffffff';
                    state.ctx.lineWidth = 2;
                    state.ctx.setLineDash([6, 4]);
                    state.ctx.strokeRect(rx - 2, ry - 2, rw + 4, rh + 4);
                    state.ctx.setLineDash([]);
                    // Resize handle (bottom-right corner)
                    state.ctx.fillStyle = '#ffffff';
                    state.ctx.strokeStyle = '#4f46e5';
                    state.ctx.lineWidth = 1.5;
                    state.ctx.fillRect(rx + rw - 6, ry + rh - 6, 12, 12);
                    state.ctx.strokeRect(rx + rw - 6, ry + rh - 6, 12, 12);
                }
                state.ctx.restore();
            });
        }

        // --- Step E2: Video Highlights / Callouts (rendered AFTER B-roll so highlights
        // appear on top of B-roll images, text overlays and any other canvas content) ---
        if (state.highlights && state.highlights.length > 0) {
            const currentTime = state.currentTime || 0;
            // Re-read drawX/drawW from the current bounds so coordinates still map
            // correctly even when the layout changes between the two render steps.
            const hBounds = getRenderedVideoBounds();
            const hDrawX = hBounds.x, hDrawY = hBounds.y;
            const hDrawW = hBounds.w, hDrawH = hBounds.h;
            state.highlights.forEach((item) => {
                if (currentTime < item.startSec || currentTime > item.endSec) return;
                const x = hDrawX + item.x * hDrawW;
                const y = hDrawY + item.y * hDrawH;
                const w = item.w * hDrawW;
                const h = item.h * hDrawH;
                const isFreehand = item.shape === 'freehand';
                const previewPoint = isFreehand && state.isDrawingNewHighlight && item.id === state.selectedHighlightId
                    ? state.highlightPreviewPoint : null;
                const pathPoints = previewPoint ? [...item.points, previewPoint] : item.points;
                if (isFreehand && (!pathPoints || pathPoints.length < 2)) return;
                if (!isFreehand && (w <= 0 || h <= 0)) return;

                const color = item.color || '#00e5ff';
                const alpha = Math.max(0, Math.min(0.85, (item.fillOpacity ?? 16) / 100));
                const width = Math.max(1, item.lineWidth || 6);
                const glowBlur = Math.min(width * 0.6, 6);
                state.ctx.save();
                state.ctx.strokeStyle = color;
                state.ctx.lineWidth = width;
                state.ctx.lineJoin = 'round';
                state.ctx.lineCap = 'round';

                const isBeingSizedNow = state.isDrawingNewHighlight && item.id === state.selectedHighlightId;
                const drawDuration = Math.max(0.15, Math.min((item.endSec - item.startSec) - 0.05, item.drawDuration || 0.6));
                const elapsed = Math.max(0, currentTime - item.startSec);
                const traceProgress = isBeingSizedNow ? 1 : Math.min(1, elapsed / drawDuration);

                const traceOutline = (points, progress) => {
                    if (!points || points.length < 2) return;
                    state.ctx.moveTo(points[0].x, points[0].y);
                    if (progress >= 1) {
                        for (let i = 1; i < points.length; i++) state.ctx.lineTo(points[i].x, points[i].y);
                        return;
                    }
                    let total = 0;
                    const segLens = [];
                    for (let i = 1; i < points.length; i++) {
                        const len = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
                        segLens.push(len);
                        total += len;
                    }
                    const target = total * Math.max(0, progress);
                    let covered = 0;
                    for (let i = 0; i < segLens.length; i++) {
                        const segLen = segLens[i];
                        if (covered + segLen <= target) {
                            state.ctx.lineTo(points[i + 1].x, points[i + 1].y);
                            covered += segLen;
                        } else {
                            const ratio = segLen > 0 ? (target - covered) / segLen : 0;
                            state.ctx.lineTo(
                                points[i].x + (points[i + 1].x - points[i].x) * ratio,
                                points[i].y + (points[i + 1].y - points[i].y) * ratio
                            );
                            break;
                        }
                    }
                };

                if (isFreehand) {
                    if (isBeingSizedNow) {
                        state.ctx.beginPath();
                        state.ctx.moveTo(hDrawX + pathPoints[0].x * hDrawW, hDrawY + pathPoints[0].y * hDrawH);
                        pathPoints.slice(1).forEach(point => state.ctx.lineTo(hDrawX + point.x * hDrawW, hDrawY + point.y * hDrawH));
                        if (item.isClosed) {
                            state.ctx.closePath();
                            state.ctx.shadowBlur = 0;
                            state.ctx.fillStyle = hexToRgba(color, alpha);
                            state.ctx.fill();
                        }
                        state.ctx.shadowColor = color;
                        state.ctx.shadowBlur = glowBlur;
                        state.ctx.stroke();
                    } else {
                        const px = pathPoints.map(p => ({ x: hDrawX + p.x * hDrawW, y: hDrawY + p.y * hDrawH }));
                        const loopPoints = item.isClosed ? [...px, px[0]] : px;
                        state.ctx.beginPath();
                        traceOutline(loopPoints, traceProgress);
                        if (item.isClosed && traceProgress >= 1) {
                            state.ctx.closePath();
                            state.ctx.shadowBlur = 0;
                            state.ctx.fillStyle = hexToRgba(color, alpha * traceProgress);
                            state.ctx.fill();
                        }
                        state.ctx.shadowColor = color;
                        state.ctx.shadowBlur = glowBlur;
                        state.ctx.stroke();
                    }
                } else if (item.shape === 'underline') {
                    state.ctx.beginPath();
                    traceOutline([{ x, y: y + h }, { x: x + w, y: y + h }], traceProgress);
                    state.ctx.shadowColor = color;
                    state.ctx.shadowBlur = glowBlur;
                    state.ctx.stroke();
                } else {
                    let outline;
                    if (item.shape === 'circle') {
                        const cx = x + w / 2, cy = y + h / 2, rx = w / 2, ry = h / 2;
                        const segments = 48;
                        outline = [];
                        for (let i = 0; i <= segments; i++) {
                            const theta = -Math.PI / 2 + (i / segments) * Math.PI * 2;
                            outline.push({ x: cx + rx * Math.cos(theta), y: cy + ry * Math.sin(theta) });
                        }
                    } else if (item.shape === 'hexagon') {
                        const inset = Math.min(w * 0.25, h * 0.35);
                        const verts = [
                            { x: x + inset, y },
                            { x: x + w - inset, y },
                            { x: x + w, y: y + h / 2 },
                            { x: x + w - inset, y: y + h },
                            { x: x + inset, y: y + h },
                            { x, y: y + h / 2 }
                        ];
                        outline = [...verts, verts[0]];
                    } else {
                        outline = [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }, { x, y }];
                    }
                    state.ctx.beginPath();
                    traceOutline(outline, traceProgress);
                    if (traceProgress >= 1) state.ctx.closePath();
                    state.ctx.shadowBlur = 0;
                    state.ctx.fillStyle = hexToRgba(color, alpha * traceProgress);
                    state.ctx.fill();
                    state.ctx.shadowColor = color;
                    state.ctx.shadowBlur = glowBlur;
                    state.ctx.stroke();
                }

                // Editing guides — preview-only, not exported.
                if (state.currentStep === 3 && state.isAddingHighlight && item.id === state.selectedHighlightId) {
                    state.ctx.shadowBlur = 0;
                    state.ctx.setLineDash([6, 4]);
                    state.ctx.strokeStyle = '#ffffff';
                    state.ctx.lineWidth = 1.5;
                    state.ctx.strokeRect(x - 4, y - 4, w + 8, h + 8);
                }
                state.ctx.restore();
            });
        }


        if (state.subtitlesEnabled && state.subtitles && state.subtitles.length > 0) {
            const currentTime = state.currentTime;
            const activeSub = state.subtitles.find(s => currentTime >= s.startSec && currentTime <= s.endSec);
            if (activeSub && activeSub.text) {
                const st = state.subtitleStyle || {};
                const canvasW = state.canvas.width;
                const canvasH = state.canvas.height;
                const fontSize = Math.max(14, Math.round(canvasH * (st.fontSizePct || 0.045)));
                const fontFamily = st.fontFamily || '"Hind Siliguri", "Plus Jakarta Sans", sans-serif';
                const fontWeight = st.fontWeight || 600;
                const maxWidth = canvasW * 0.86;
                const lineHeight = fontSize * 1.35;

                const ctx = state.ctx;
                ctx.save();
                ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.lineJoin = 'round';

                // Word-by-word progress for TikTok-style caption highlight.
                const words = activeSub.text.split(/\s+/).filter(Boolean);
                const span = Math.max(0.001, activeSub.endSec - activeSub.startSec);
                const progress = Math.min(1, Math.max(0, (currentTime - activeSub.startSec) / span));
                const highlightEnabled = !!st.highlightEnabled && words.length > 1;
                const activeWordIndex = Math.min(words.length - 1, Math.floor(progress * words.length));

                // Greedy word-wrap into lines bounded by maxWidth.
                const lines = [];
                let curLine = [];
                let curWidth = 0;
                for (let i = 0; i < words.length; i++) {
                    const w = words[i];
                    const ww = ctx.measureText(w + ' ').width;
                    if (curLine.length > 0 && curWidth + ww > maxWidth) {
                        lines.push(curLine);
                        curLine = [w];
                        curWidth = ww;
                    } else {
                        curLine.push(w);
                        curWidth += ww;
                    }
                }
                if (curLine.length) lines.push(curLine);

                // Block metrics (for the background pill).
                let blockW = 0;
                lines.forEach(line => {
                    const w = ctx.measureText(line.join(' ')).width;
                    if (w > blockW) blockW = w;
                });
                const blockH = lines.length * lineHeight;
                const padX = Math.max(14, fontSize * 0.4);
                const padY = Math.max(8, fontSize * 0.25);

                const posFrac = (st.positionPct != null) ? st.positionPct : 0.1;
                const blockCenterY = (st.position === 'top')
                    ? canvasH * posFrac + blockH / 2
                    : canvasH - canvasH * posFrac - blockH / 2;
                const centerX = canvasW / 2;

                // Background pill behind caption text for readability.
                if (st.bgPillEnabled !== false) {
                    const boxW = Math.min(maxWidth + padX * 2, blockW + padX * 2);
                    const boxH = blockH + padY * 2;
                    const rx = centerX - boxW / 2;
                    const ry = blockCenterY - boxH / 2;
                    ctx.fillStyle = st.bgPillColor || 'rgba(0, 0, 0, 0.6)';
                    ctx.beginPath();
                    ctx.roundRect(rx, ry, boxW, boxH, st.bgPillRadius != null ? st.bgPillRadius : 8);
                    ctx.fill();
                }

                // Draw caption line by line, word by word (so highlight can be
                // applied per word). Outline stroke first, then fill on top.
                const outlineWidth = (st.outlineWidth != null) ? st.outlineWidth : 3;
                const outlineColor = st.outlineColor || '#000000';
                const baseColor = st.color || '#ffffff';
                const highlightColor = st.highlightColor || '#ffe600';
                const lineHighlightColor = st.lineHighlightColor || '#ffe600';
                let wordCursor = 0;

                for (let li = 0; li < lines.length; li++) {
                    const line = lines[li];
                    const lineText = line.join(' ');
                    const lineW = ctx.measureText(lineText).width;
                    const startX = centerX - lineW / 2;
                    const lineY = blockCenterY - blockH / 2 + lineHeight * (li + 0.5);

                    // Marker-style highlight: a solid, tight-fit color band behind this
                    // whole line (not the padded bgPill, not a word-by-word text-color
                    // swap) — like a highlighter pen drawn across just this line.
                    if (activeSub.lineHighlight) {
                        const markerPadX = fontSize * 0.18;
                        const markerH = fontSize * 1.08;
                        ctx.fillStyle = lineHighlightColor;
                        ctx.beginPath();
                        ctx.roundRect(startX - markerPadX, lineY - markerH / 2, lineW + markerPadX * 2, markerH, markerH * 0.2);
                        ctx.fill();
                    }

                    let cx = startX;
                    for (let wi = 0; wi < line.length; wi++) {
                        const w = line[wi];
                        const isLast = (wi === line.length - 1);
                        const wordW = ctx.measureText(w + (isLast ? '' : ' ')).width;
                        const wordIdx = wordCursor;
                        const isHighlight = highlightEnabled && wordIdx <= activeWordIndex;

                        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
                        ctx.lineWidth = outlineWidth;
                        ctx.strokeStyle = outlineColor;
                        ctx.strokeText(w, cx + wordW / 2, lineY);
                        ctx.fillStyle = isHighlight ? highlightColor : baseColor;
                        ctx.fillText(w, cx + wordW / 2, lineY);

                        cx += wordW;
                        wordCursor++;
                    }
                }
                ctx.restore();
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
    
    function getRenderedVideoBounds() {
        const canvasW = state.canvas.width, canvasH = state.canvas.height;
        const activeClip = state.clips.find(c => c.id === state.activeClipId);
        const isImage = activeClip && activeClip.type === 'image';
        const sourceW = isImage ? (activeClip.imageImg?.naturalWidth || canvasW) : state.video.videoWidth;
        const sourceH = isImage ? (activeClip.imageImg?.naturalHeight || canvasH) : state.video.videoHeight;
        const videoAspect = sourceW / sourceH;
        const canvasAspect = canvasW / canvasH;
        const currentAspect = state.isAdjustingCrop ? videoAspect : (((state.cropW || 1) * sourceW) / ((state.cropH || 1) * sourceH));
        let w = canvasW, h = canvasH, x = 0, y = 0;
        if (state.layoutMode === 'fill') {
            if (currentAspect > canvasAspect) { w = canvasH * currentAspect; x = (canvasW - w) / 2; }
            else { h = canvasW / currentAspect; y = (canvasH - h) / 2; }
        } else if (currentAspect > canvasAspect) { h = canvasW / currentAspect; y = (canvasH - h) / 2; }
        else if (currentAspect < canvasAspect) { w = canvasH * currentAspect; x = (canvasW - w) / 2; }
        return { x, y, w, h };
    }

    function handlePointerDown(e) {
        if (state.currentStep !== 2 && state.currentStep !== 3) return;

        if (state.isColorPickingBroll) {
            const coords = getCanvasCoords(e);
            try {
                // Sample pixel color from the exact click point on the canvas
                const imgData = state.ctx.getImageData(coords.x, coords.y, 1, 1);
                const r = imgData.data[0];
                const g = imgData.data[1];
                const b = imgData.data[2];
                
                // Convert sampled RGB to Hex string
                const hex = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
                const brollRemoveCustomColor = document.getElementById('broll-remove-custom-color');
                if (brollRemoveCustomColor) brollRemoveCustomColor.value = hex;
                
                // Reset color picking state
                state.isColorPickingBroll = false;
                state.canvas.style.cursor = 'default';
                
                // Perform color erasure on the selected B-roll overlay
                const item = state.brollOverlays.find(b => b.id === state.selectedBrollId);
                if (item && item.type === 'image') {
                    const tol = document.getElementById('broll-remove-tolerance') ? parseInt(document.getElementById('broll-remove-tolerance').value) : 30;
                    eraseBrollImageColor(item, r, g, b, tol);
                }
            } catch(err) {
                console.error("Screen color pick error:", err);
            }
            e.preventDefault();
            return;
        }

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
                // Capture pre-action state before crop changes begin
                if (window.captureUndoCheckpoint) window.captureUndoCheckpoint();
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

        // Background Fill tool — drag a rectangle anywhere on the canvas to paint a solid colour block.
        if (state.isAddingFill) {
            const coords = getCanvasCoords(e);
            const now = Math.max(0, state.currentTime || 0);
            const canvasW = state.canvas.width;
            const canvasH = state.canvas.height;
            const nx = coords.x / canvasW;
            const ny = coords.y / canvasH;

            // Check if clicking on an existing fill region for drag/resize
            const hitRegion = [...(state.fillRegions || [])].reverse().find(r => {
                if (now < r.startSec || now > r.endSec) return false;
                const rx = r.x * canvasW, ry = r.y * canvasH;
                const rw = r.w * canvasW, rh = r.h * canvasH;
                return coords.x >= rx && coords.x <= rx + rw && coords.y >= ry && coords.y <= ry + rh;
            });

            if (hitRegion) {
                state.selectedFillId = hitRegion.id;
                const rx = hitRegion.x * canvasW, ry = hitRegion.y * canvasH;
                const rw = hitRegion.w * canvasW, rh = hitRegion.h * canvasH;
                // Bottom-right corner resize handle (20px)
                if (Math.hypot(coords.x - (rx + rw), coords.y - (ry + rh)) < 20) {
                    state.isResizingFill = true;
                } else {
                    state.isDraggingFill = true;
                    state.dragFillOffsetX = coords.x - rx;
                    state.dragFillOffsetY = coords.y - ry;
                }
                if (window.onFillSelected) window.onFillSelected(hitRegion.id);
                drawFrame();
                e.preventDefault();
                return;
            }

            // Start drawing a new fill region
            const fillColor = document.getElementById('fill-region-color')?.value || '#000000';
            const fillOpacity = parseInt(document.getElementById('fill-region-opacity')?.value || '80');
            const item = {
                id: Date.now(),
                color: fillColor,
                opacity: fillOpacity,
                x: nx, y: ny, w: 0, h: 0,
                startSec: now,
                endSec: Math.max(now + 1, state.endTime || state.duration || 5)
            };
            state.fillRegions = state.fillRegions || [];
            state.fillRegions.push(item);
            state.selectedFillId = item.id;
            state.isDrawingNewFill = true;
            state.fillDragStartX = nx;
            state.fillDragStartY = ny;
            if (window.onFillSelected) window.onFillSelected(item.id);
            drawFrame();
            e.preventDefault();
            return;
        }

        // Video Highlight tool — drag across the live preview to make a callout.
        if (state.isAddingHighlight) {

            const coords = getCanvasCoords(e);
            const bounds = getRenderedVideoBounds();
            if (bounds.w <= 0 || bounds.h <= 0) return;
            // Clamp into bounds instead of rejecting the click outright. A B-roll
            // overlay (fullscreen at a custom size/offset, or a PiP dragged to
            // cover most of the frame) can visually fill more of the canvas than
            // getRenderedVideoBounds() reports for the underlying clip — without
            // this clamp, a drag that starts anywhere in that "extra" visible area
            // silently did nothing. Clamping matches the behaviour the drag-move
            // handler already uses for freehand points (see below).
            const clampedX = Math.max(bounds.x, Math.min(bounds.x + bounds.w, coords.x));
            const clampedY = Math.max(bounds.y, Math.min(bounds.y + bounds.h, coords.y));
            const shape = document.getElementById('highlight-shape-select')?.value || 'rect';
            const color = document.getElementById('highlight-color')?.value || '#00e5ff';
            const lineWidth = parseInt(document.getElementById('highlight-line-width')?.value || '6');
            const fillOpacity = parseInt(document.getElementById('highlight-fill-opacity')?.value || '16');
            const drawDuration = parseFloat(document.getElementById('highlight-draw-speed')?.value || '0.6');
            const now = Math.max(0, state.currentTime || 0);
            const startPoint = { x: (clampedX - bounds.x) / bounds.w, y: (clampedY - bounds.y) / bounds.h };
            const selected = state.highlights.find(h => h.id === state.selectedHighlightId);
            if (shape === 'freehand') {
                // Every drag is exactly one side. Start the next drag at the last
                // endpoint to extend an open custom shape, or elsewhere to begin a new one.
                let item = null;
                if (selected?.shape === 'freehand' && !selected.isClosed && selected.points?.length >= 2) {
                    const endpoint = selected.points[selected.points.length - 1];
                    if (Math.hypot(startPoint.x - endpoint.x, startPoint.y - endpoint.y) < 0.035) item = selected;
                }
                if (!item) {
                    item = { id: Date.now(), shape, color, lineWidth, fillOpacity, drawDuration, x: startPoint.x, y: startPoint.y, w: 0, h: 0, points: [startPoint], isClosed: false, startSec: now, endSec: Math.max(now + 1, state.endTime || state.duration || 5) };
                    state.highlights.push(item);
                    state.selectedHighlightId = item.id;
                }
                state.isDrawingNewHighlight = true;
                state.highlightFreehandSegmentStart = item.points[item.points.length - 1];
                state.highlightPreviewPoint = null;
                state.highlightDrawDrawX = bounds.x; state.highlightDrawDrawY = bounds.y;
                state.highlightDrawDrawW = bounds.w; state.highlightDrawDrawH = bounds.h;
                if (window.onHighlightSelected) window.onHighlightSelected(item.id);
                drawFrame();
                e.preventDefault();
                return;
            }
            const item = { id: Date.now(), shape, color, lineWidth, fillOpacity, drawDuration, x: startPoint.x, y: startPoint.y, w: 0, h: 0, points: shape === 'freehand' ? [startPoint] : undefined, isClosed: false, startSec: now, endSec: Math.max(now + 1, state.endTime || state.duration || 5) };
            state.highlights.push(item);
            state.selectedHighlightId = item.id;
            state.isDrawingNewHighlight = true;
            state.highlightDrawDrawX = bounds.x; state.highlightDrawDrawY = bounds.y;
            state.highlightDrawDrawW = bounds.w; state.highlightDrawDrawH = bounds.h;
            if (window.onHighlightSelected) window.onHighlightSelected(item.id);
            drawFrame();
            e.preventDefault();
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
            if (check.isResize || check.isOver) {
                if (window.captureUndoCheckpoint) window.captureUndoCheckpoint();
            }
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

        // B-roll rotate handle check (must come BEFORE resize/drag checks)
        if (state.currentStep === 3 && state.selectedBrollId !== null) {
            if (findBrollRotateHandle(coords)) {
                const item = state.brollOverlays.find(b => b.id === state.selectedBrollId);
                if (item) {
                    if (window.captureUndoCheckpoint) window.captureUndoCheckpoint();
                    const box = getBrollBoxRect(item, canvasW, canvasH);
                    state.isRotatingBroll = true;
                    state.brollRotateStartAngle = Math.atan2(coords.y - box.cy, coords.x - box.cx) * 180 / Math.PI;
                    state.brollRotateStartRotation = item.rotation || 0;
                    e.preventDefault();
                    return;
                }
            }
        }

        // B-roll resize handle check (must come BEFORE drag check)
        if (state.currentStep === 3 && state.selectedBrollId !== null) {
            const resizeHandle = findBrollResizeHandle(coords);
            if (resizeHandle) {
                const item = state.brollOverlays.find(b => b.id === state.selectedBrollId);
                if (item) {
                    state.isResizingBroll = true;
                    state.brollResizeHandle = resizeHandle;
                    state.brollResizeStartX = coords.x;
                    state.brollResizeStartY = coords.y;
                    state.brollResizeStartBoxX = item.x;
                    state.brollResizeStartBoxY = item.y;
                    state.brollResizeStartFontSize = item.fontSize || 48;
                    const box = getBrollBoxRect(item, canvasW, canvasH);
                    state.brollResizeStartW = box.w / canvasW;
                    state.brollResizeStartH = box.h / canvasH;
                    e.preventDefault();
                    return;
                }
            }
        }

        // B-roll drag/select (Phase 5D) — checked before text overlay
        if (state.brollOverlays && state.brollOverlays.length > 0) {
            const brollHit = findBrollPipAt(coords);
            if (brollHit) {
                if (window.captureUndoCheckpoint) window.captureUndoCheckpoint();
                state.selectedBrollId = brollHit.id;
                state.isDraggingBroll = true;

                if (brollHit.mode === 'fullscreen' && (brollHit.size === undefined || brollHit.size >= 100)) {
                    // Fullscreen at 100% — clicking starts a drag but keeps fullscreen mode.
                    // Mark that the user has set a custom position so scaling uses item.x/y.
                    brollHit._fsPosSet = true;
                    brollHit.x = coords.x / canvasW;
                    brollHit.y = coords.y / canvasH;
                }

                if (brollHit.mode === 'fullscreen' && brollHit._fsPosSet) {
                    // Dragging a fullscreen item with custom position — keep in fullscreen
                    state.dragBrollOffsetX = coords.x - (brollHit.x * canvasW);
                    state.dragBrollOffsetY = coords.y - (brollHit.y * canvasH);
                } else if (brollHit.mode === 'fullscreen') {
                    // Legacy: first drag converts to pip (old behavior for 100% items)
                    brollHit.mode = 'pip';
                    brollHit.size = 35;
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
                    if (brollModeSelect) brollModeSelect.value = 'pip';
                    if (brollSizeSlider) { brollSizeSlider.max = 60; brollSizeSlider.value = 35; }
                    if (brollSizeVal) brollSizeVal.innerText = '35%';
                    if (brollSizeContainer) brollSizeContainer.style.display = 'block';
                    renderBrollList();
                    state.dragBrollOffsetX = coords.x - (brollHit.x * canvasW);
                    state.dragBrollOffsetY = coords.y - (brollHit.y * canvasH);
                } else {
                    state.dragBrollOffsetX = coords.x - (brollHit.x * canvasW);
                    state.dragBrollOffsetY = coords.y - (brollHit.y * canvasH);
                }

                if (window.onBrollSelected) window.onBrollSelected(brollHit.id);
                e.preventDefault();
                return;
            }
        }

        // Symbol/Shape rotate handle check (must come BEFORE resize/drag checks)
        if (state.currentStep === 3 && state.selectedSymbolId !== null) {
            if (findSymbolRotateHandle(coords)) {
                const item = state.symbolOverlays.find(s => s.id === state.selectedSymbolId);
                if (item) {
                    const box = getSymbolBox(item, canvasW, canvasH);
                    state.isRotatingSymbol = true;
                    state.symbolRotateStartAngle = Math.atan2(coords.y - box.cy, coords.x - box.cx) * 180 / Math.PI;
                    state.symbolRotateStartRotation = item.rotation || 0;
                    e.preventDefault();
                    return;
                }
            }
        }

        // Symbol/Shape resize handle check (must come BEFORE drag check)
        if (state.currentStep === 3 && state.selectedSymbolId !== null) {
            if (findSymbolResizeHandle(coords)) {
                const item = state.symbolOverlays.find(s => s.id === state.selectedSymbolId);
                if (item) {
                    state.isResizingSymbol = true;
                    state.symbolResizeStartX = coords.x;
                    state.symbolResizeStartSize = item.size;
                    e.preventDefault();
                    return;
                }
            }
        }

        // Symbol/Shape drag/select — symbols render on top of everything else,
        // so they're checked before stickers/text overlays.
        if (state.symbolOverlays && state.symbolOverlays.length > 0) {
            const symbolHit = findSymbolAt(coords);
            if (symbolHit) {
                state.selectedSymbolId = symbolHit.id;
                state.isDraggingSymbol = true;
                state.dragSymbolOffsetX = coords.x - (symbolHit.x * canvasW);
                state.dragSymbolOffsetY = coords.y - (symbolHit.y * canvasH);
                if (window.onSymbolSelected) window.onSymbolSelected(symbolHit.id);
                e.preventDefault();
                return;
            }
        }

        // Shape+Text rotate handle check (must come BEFORE resize/drag checks)
        if (state.currentStep === 3 && state.selectedShapeOverlayId !== null) {
            if (findShapeOverlayRotateHandle(coords)) {
                const item = state.shapeOverlays.find(s => s.id === state.selectedShapeOverlayId);
                if (item) {
                    const box = getShapeOverlayBox(item, canvasW, canvasH);
                    state.isRotatingShapeOverlay = true;
                    state.shapeOverlayRotateStartAngle = Math.atan2(coords.y - box.cy, coords.x - box.cx) * 180 / Math.PI;
                    state.shapeOverlayRotateStartRotation = item.rotation || 0;
                    e.preventDefault();
                    return;
                }
            }
        }

        // Shape+Text resize handle check (must come BEFORE drag check)
        if (state.currentStep === 3 && state.selectedShapeOverlayId !== null) {
            if (findShapeOverlayResizeHandle(coords)) {
                const item = state.shapeOverlays.find(s => s.id === state.selectedShapeOverlayId);
                if (item) {
                    state.isResizingShapeOverlay = true;
                    state.shapeOverlayResizeStartX = coords.x;
                    state.shapeOverlayResizeStartSize = item.size;
                    e.preventDefault();
                    return;
                }
            }
        }

        // Shape+Text drag/select
        if (state.shapeOverlays && state.shapeOverlays.length > 0) {
            const shapeHit = findShapeOverlayAt(coords);
            if (shapeHit) {
                state.selectedShapeOverlayId = shapeHit.id;
                state.isDraggingShapeOverlay = true;
                state.dragShapeOverlayOffsetX = coords.x - (shapeHit.x * canvasW);
                state.dragShapeOverlayOffsetY = coords.y - (shapeHit.y * canvasH);
                if (window.onShapeOverlaySelected) window.onShapeOverlaySelected(shapeHit.id);
                e.preventDefault();
                return;
            }
        }

        // Sticker/Emoji resize handle check (Phase 4A) — must come before drag check
        if (state.currentStep === 3 && state.selectedStickerId !== null) {
            if (findStickerResizeHandle(coords)) {
                const item = state.stickers.find(s => s.id === state.selectedStickerId);
                if (item) {
                    state.isResizingSticker = true;
                    state.stickerResizeStartX = coords.x;
                    state.stickerResizeStartSize = item.size;
                    e.preventDefault();
                    return;
                }
            }
        }

        // Sticker/Emoji drag/select (Phase 4A) — stickers render on top of B-roll/banners,
        // so they're checked before text overlays but after logo/B-roll.
        if (state.stickers && state.stickers.length > 0) {
            const stickerHit = findStickerAt(coords);
            if (stickerHit) {
                state.selectedStickerId = stickerHit.id;
                state.isDraggingSticker = true;
                state.dragStickerOffsetX = coords.x - (stickerHit.x * canvasW);
                state.dragStickerOffsetY = coords.y - (stickerHit.y * canvasH);
                if (window.onStickerSelected) window.onStickerSelected(stickerHit.id);
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
        const currentTime = state.currentTime || 0;
        for (let i = state.brollOverlays.length - 1; i >= 0; i--) {
            const item = state.brollOverlays[i];
            if (item.type !== 'text' && !item.imageImg) continue;

            // Only let the user click-select an overlay that's actually visible on
            // screen right now — same rule the render loop uses. Without this, an
            // older overlay whose time window has passed could still "catch" clicks
            // meant for a different item positioned in the same spot.
            const isBeingEdited = state.currentStep === 3 && !state.isPlaying && item.id === state.selectedBrollId;
            const visible = isBeingEdited || (currentTime >= item.startSec && currentTime <= item.endSec);
            if (!visible) continue;

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
                    // Fullscreen image — hit-test uses actual scaled box when size < 100%
                    const scale = (item.size !== undefined ? item.size : 100) / 100;
                    if (scale >= 0.999) {
                        px = 0; py = 0; pipW = canvasW; pipH = canvasH;
                    } else {
                        const videoAspect = (state.video && state.video.videoWidth && state.video.videoHeight)
                            ? state.video.videoWidth / state.video.videoHeight : 16 / 9;
                        const canvasAspect = canvasW / canvasH;
                        let dvW = canvasW, dvH = canvasH, dvX = 0, dvY = 0;
                        if (videoAspect > canvasAspect) { dvH = canvasW / videoAspect; dvY = (canvasH - dvH) / 2; }
                        else if (videoAspect < canvasAspect) { dvW = canvasH * videoAspect; dvX = (canvasW - dvW) / 2; }
                        pipW = dvW * scale;
                        pipH = dvH * scale;
                        if (item._fsPosSet) {
                            px = item.x * canvasW;
                            py = item.y * canvasH;
                        } else {
                            px = dvX + (dvW - pipW) / 2;
                            py = dvY + (dvH - pipH) / 2;
                        }
                    }
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

            // Rotated box: test in the box's own unrotated frame by rotating the
            // pointer coords backwards around the box center first.
            let testX = coords.x, testY = coords.y;
            if (item.rotation) {
                const local = rotatePointAround(coords.x, coords.y, px + pipW / 2, py + pipH / 2, -(item.rotation * Math.PI / 180));
                testX = local.x; testY = local.y;
            }
            if (testX >= px && testX <= px + pipW && testY >= py && testY <= py + pipH) {
                return item;
            }
        }
        return null;
    }

    // Rotates point (px,py) around center (cx,cy) by angleRad (radians). Used to
    // translate between screen space and a rotated B-roll box's own local frame.
    function rotatePointAround(px, py, cx, cy, angleRad) {
        const dx = px - cx, dy = py - cy;
        const cosA = Math.cos(angleRad), sinA = Math.sin(angleRad);
        return { x: cx + dx * cosA - dy * sinA, y: cy + dx * sinA + dy * cosA };
    }

    // Computes the current (un-animated, un-rotated) box rect for a B-roll item —
    // matches the box math in the main draw loop and in findBrollPipAt, just
    // pulled out so hit-testing helpers (resize handle, rotate handle) can share it.
    function getBrollBoxRect(item, canvasW, canvasH) {
        let px, py, pipW, pipH;
        if (item.mode === 'fullscreen') {
            const scale = (item.size !== undefined ? item.size : 100) / 100;
            const videoAspect = (state.video && state.video.videoWidth && state.video.videoHeight)
                ? state.video.videoWidth / state.video.videoHeight : 16 / 9;
            const canvasAspect = canvasW / canvasH;
            let dvW = canvasW, dvH = canvasH, dvX = 0, dvY = 0;
            if (videoAspect > canvasAspect) { dvH = canvasW / videoAspect; dvY = (canvasH - dvH) / 2; }
            else if (videoAspect < canvasAspect) { dvW = canvasH * videoAspect; dvX = (canvasW - dvW) / 2; }
            pipW = dvW * scale;
            pipH = dvH * scale;
            if (item._fsPosSet) {
                px = item.x * canvasW;
                py = item.y * canvasH;
            } else {
                px = dvX + (dvW - pipW) / 2;
                py = dvY + (dvH - pipH) / 2;
            }
        } else {
            if (item.type === 'text') {
                state.ctx.font = `bold ${item.fontSize}px "Hind Siliguri", "Plus Jakarta Sans", sans-serif`;
                const metrics = state.ctx.measureText(item.text);
                pipW = metrics.width + 32;
                pipH = item.fontSize + 24;
            } else {
                if (item.pipW !== undefined && item.pipH !== undefined) {
                    pipW = item.pipW * canvasW;
                    pipH = item.pipH * canvasH;
                } else {
                    pipW = canvasW * (item.size / 100);
                    pipH = item.imageImg ? pipW * (item.imageImg.naturalHeight / item.imageImg.naturalWidth) : pipW;
                }
            }
            px = item.x * canvasW;
            py = item.y * canvasH;
        }
        return { x: px, y: py, w: pipW, h: pipH, cx: px + pipW / 2, cy: py + pipH / 2 };
    }

    // Returns true if 'coords' is on the rotate handle (the small circle above the
    // top-center of the currently selected B-roll box). Shown for the same items
    // that get the selection outline: PiP items, and Fullscreen items sized < 100%.
    function findBrollRotateHandle(coords) {
        const item = state.brollOverlays.find(b => b.id === state.selectedBrollId);
        if (!item) return false;
        const isFsCustom = item.mode === 'fullscreen' && (item.size !== undefined && item.size < 100);
        if (item.mode !== 'pip' && !isFsCustom) return false;
        const canvasW = state.canvas.width;
        const canvasH = state.canvas.height;
        const box = getBrollBoxRect(item, canvasW, canvasH);
        const handleDist = Math.max(28, Math.min(canvasW, canvasH) * 0.05);
        const angleRad = (item.rotation || 0) * Math.PI / 180;
        const world = rotatePointAround(box.cx, box.y - handleDist, box.cx, box.cy, angleRad);
        const rect = state.canvas.getBoundingClientRect();
        const physScale = canvasW / rect.width;
        const hr = 16 * physScale;
        return Math.hypot(coords.x - world.x, coords.y - world.y) < hr;
    }

    // Returns the handle id ('top-left', 'top', 'top-right', 'right', 'bottom-right',
    // 'bottom', 'bottom-left', 'left') under 'coords' for the currently selected PiP
    // B-roll item, or null if the pointer isn't near any handle.
    function findBrollResizeHandle(coords) {
        const item = state.brollOverlays.find(b => b.id === state.selectedBrollId);
        if (!item || item.mode !== 'pip') return null;
        const canvasW = state.canvas.width;
        const canvasH = state.canvas.height;
        const box = getBrollBoxRect(item, canvasW, canvasH);
        const bW = box.w;
        const bH = box.h;
        const bx = box.x;
        const by = box.y;
        // Rotated box: test in the box's own unrotated frame by rotating the
        // pointer coords backwards around the box center first.
        let testX = coords.x, testY = coords.y;
        if (item.rotation) {
            const local = rotatePointAround(coords.x, coords.y, bx + bW / 2, by + bH / 2, -(item.rotation * Math.PI / 180));
            testX = local.x; testY = local.y;
        }
        // Physical hit radius: 14px on-screen regardless of canvas resolution
        const rect = state.canvas.getBoundingClientRect();
        const physScale = canvasW / rect.width;
        const hr = 14 * physScale;
        const hpts = [
            { id: 'top-left',     x: bx,        y: by },
            { id: 'top',          x: bx + bW/2,  y: by },
            { id: 'top-right',    x: bx + bW,    y: by },
            { id: 'right',        x: bx + bW,    y: by + bH/2 },
            { id: 'bottom-right', x: bx + bW,    y: by + bH },
            { id: 'bottom',       x: bx + bW/2,  y: by + bH },
            { id: 'bottom-left',  x: bx,         y: by + bH },
            { id: 'left',         x: bx,         y: by + bH/2 },
        ];
        for (const h of hpts) {
            if (Math.hypot(testX - h.x, testY - h.y) < hr) return h.id;
        }
        return null;
    }

    // --- Symbol / Shape Overlay geometry + hit-testing ---
    // A symbol lives in a square box of side `s` (percent of canvas width, same
    // convention as stickers), centered at (item.x, item.y), and can be rotated.

    function getSymbolBox(item, canvasW, canvasH) {
        const s = canvasW * (item.size / 100);
        return {
            cx: item.x * canvasW,
            cy: item.y * canvasH,
            s
        };
    }

    function findSymbolAt(coords) {
        const canvasW = state.canvas.width;
        const canvasH = state.canvas.height;
        for (let i = state.symbolOverlays.length - 1; i >= 0; i--) {
            const item = state.symbolOverlays[i];
            const box = getSymbolBox(item, canvasW, canvasH);
            let testX = coords.x, testY = coords.y;
            if (item.rotation) {
                const local = rotatePointAround(coords.x, coords.y, box.cx, box.cy, -(item.rotation * Math.PI / 180));
                testX = local.x; testY = local.y;
            }
            const half = box.s / 2;
            if (testX >= box.cx - half && testX <= box.cx + half &&
                testY >= box.cy - half && testY <= box.cy + half) {
                return item;
            }
        }
        return null;
    }

    function findSymbolResizeHandle(coords) {
        if (state.selectedSymbolId === null) return false;
        const item = state.symbolOverlays.find(s => s.id === state.selectedSymbolId);
        if (!item) return false;

        const canvasW = state.canvas.width;
        const canvasH = state.canvas.height;
        const box = getSymbolBox(item, canvasW, canvasH);
        const half = box.s / 2;

        let testX = coords.x, testY = coords.y;
        if (item.rotation) {
            const local = rotatePointAround(coords.x, coords.y, box.cx, box.cy, -(item.rotation * Math.PI / 180));
            testX = local.x; testY = local.y;
        }

        const rect = state.canvas.getBoundingClientRect();
        const w_rect = rect.width;
        const h_rect = rect.height;
        if (w_rect === 0 || h_rect === 0) return false;
        const r_canvas = canvasW / canvasH;
        const r_rect = w_rect / h_rect;
        const w_render = (r_canvas > r_rect) ? w_rect : h_rect * r_canvas;
        const pad = 20 * (canvasW / w_render);

        const handleX = box.cx + half + 6;
        const handleY = box.cy + half + 6;
        return Math.abs(testX - handleX) <= pad && Math.abs(testY - handleY) <= pad;
    }

    // Returns true if 'coords' is on the rotate handle (small circle above the
    // currently selected symbol). Mirrors findBrollRotateHandle.
    function findSymbolRotateHandle(coords) {
        const item = state.symbolOverlays.find(s => s.id === state.selectedSymbolId);
        if (!item) return false;
        const canvasW = state.canvas.width;
        const canvasH = state.canvas.height;
        const box = getSymbolBox(item, canvasW, canvasH);
        const half = box.s / 2;
        const handleDist = Math.max(28, Math.min(canvasW, canvasH) * 0.05);
        const angleRad = (item.rotation || 0) * Math.PI / 180;
        const world = rotatePointAround(box.cx, box.cy - half - 6 - handleDist, box.cx, box.cy, angleRad);
        const rect = state.canvas.getBoundingClientRect();
        const physScale = canvasW / rect.width;
        const hr = 16 * physScale;
        return Math.hypot(coords.x - world.x, coords.y - world.y) < hr;
    }

    // Draws a star polygon path (not stroked/filled itself — caller fills/strokes).
    function drawStarPath(ctx, cx, cy, outerR, innerR, points) {
        ctx.beginPath();
        for (let i = 0; i < points * 2; i++) {
            const r = (i % 2 === 0) ? outerR : innerR;
            const a = (Math.PI / points) * i - Math.PI / 2;
            const x = cx + r * Math.cos(a);
            const y = cy + r * Math.sin(a);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
    }

    // Draws one symbol/shape type centered at the current canvas origin (caller
    // is expected to have already translated+rotated the context), inside a
    // square bounding box of side `s`, in the given color.
    function drawSymbolShape(ctx, type, s, color) {
        const half = s / 2;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = Math.max(2, s * 0.11);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        switch (type) {
            case 'arrow': {
                ctx.beginPath();
                ctx.moveTo(-half * 0.85, 0);
                ctx.lineTo(half * 0.45, 0);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(half * 0.85, 0);
                ctx.lineTo(half * 0.25, -half * 0.4);
                ctx.lineTo(half * 0.25, half * 0.4);
                ctx.closePath();
                ctx.fill();
                break;
            }
            case 'cross': {
                ctx.beginPath();
                ctx.moveTo(-half * 0.65, -half * 0.65);
                ctx.lineTo(half * 0.65, half * 0.65);
                ctx.moveTo(half * 0.65, -half * 0.65);
                ctx.lineTo(-half * 0.65, half * 0.65);
                ctx.stroke();
                break;
            }
            case 'tick': {
                ctx.beginPath();
                ctx.moveTo(-half * 0.65, half * 0.05);
                ctx.lineTo(-half * 0.1, half * 0.6);
                ctx.lineTo(half * 0.75, -half * 0.55);
                ctx.stroke();
                break;
            }
            case 'question': {
                ctx.font = `bold ${Math.round(s)}px "Plus Jakarta Sans", "Hind Siliguri", sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('?', 0, s * 0.03);
                break;
            }
            case 'exclaim': {
                ctx.font = `bold ${Math.round(s)}px "Plus Jakarta Sans", "Hind Siliguri", sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('!', 0, s * 0.03);
                break;
            }
            case 'star': {
                drawStarPath(ctx, 0, 0, half * 0.9, half * 0.4, 5);
                ctx.fill();
                break;
            }
            case 'circle': {
                ctx.beginPath();
                ctx.arc(0, 0, half * 0.72, 0, Math.PI * 2);
                ctx.stroke();
                break;
            }
            case 'triangle': {
                ctx.beginPath();
                ctx.moveTo(0, -half * 0.78);
                ctx.lineTo(half * 0.72, half * 0.58);
                ctx.lineTo(-half * 0.72, half * 0.58);
                ctx.closePath();
                ctx.stroke();
                break;
            }
            default: {
                ctx.beginPath();
                ctx.arc(0, 0, half * 0.72, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
        ctx.restore();
    }

    // --- Shape + Text Overlay geometry + hit-testing ---
    // Unlike symbols (square), these Word-style shapes are wide/tall, so each
    // box has an independent width and height. item.size is percent of canvas
    // width (same convention as symbols/stickers); height is derived from a
    // fixed aspect ratio per shape type.
    const SHAPE_OVERLAY_ASPECT = {
        ribbon: 0.34,
        wave: 0.4,
        cloud: 0.62,
        star6: 0.92,
        oval: 0.56
    };

    function getShapeOverlayBox(item, canvasW, canvasH) {
        const w = canvasW * (item.size / 100);
        const aspect = SHAPE_OVERLAY_ASPECT[item.shapeType] || 0.5;
        const h = w * aspect;
        return {
            cx: item.x * canvasW,
            cy: item.y * canvasH,
            w,
            h
        };
    }

    function findShapeOverlayAt(coords) {
        const canvasW = state.canvas.width;
        const canvasH = state.canvas.height;
        for (let i = state.shapeOverlays.length - 1; i >= 0; i--) {
            const item = state.shapeOverlays[i];
            const box = getShapeOverlayBox(item, canvasW, canvasH);
            let testX = coords.x, testY = coords.y;
            if (item.rotation) {
                const local = rotatePointAround(coords.x, coords.y, box.cx, box.cy, -(item.rotation * Math.PI / 180));
                testX = local.x; testY = local.y;
            }
            const halfW = box.w / 2, halfH = box.h / 2;
            if (testX >= box.cx - halfW && testX <= box.cx + halfW &&
                testY >= box.cy - halfH && testY <= box.cy + halfH) {
                return item;
            }
        }
        return null;
    }

    function findShapeOverlayResizeHandle(coords) {
        if (state.selectedShapeOverlayId === null) return false;
        const item = state.shapeOverlays.find(s => s.id === state.selectedShapeOverlayId);
        if (!item) return false;

        const canvasW = state.canvas.width;
        const canvasH = state.canvas.height;
        const box = getShapeOverlayBox(item, canvasW, canvasH);
        const halfW = box.w / 2, halfH = box.h / 2;

        let testX = coords.x, testY = coords.y;
        if (item.rotation) {
            const local = rotatePointAround(coords.x, coords.y, box.cx, box.cy, -(item.rotation * Math.PI / 180));
            testX = local.x; testY = local.y;
        }

        const rect = state.canvas.getBoundingClientRect();
        const w_rect = rect.width;
        const h_rect = rect.height;
        if (w_rect === 0 || h_rect === 0) return false;
        const r_canvas = canvasW / canvasH;
        const r_rect = w_rect / h_rect;
        const w_render = (r_canvas > r_rect) ? w_rect : h_rect * r_canvas;
        const pad = 20 * (canvasW / w_render);

        const handleX = box.cx + halfW + 6;
        const handleY = box.cy + halfH + 6;
        return Math.abs(testX - handleX) <= pad && Math.abs(testY - handleY) <= pad;
    }

    function findShapeOverlayRotateHandle(coords) {
        const item = state.shapeOverlays.find(s => s.id === state.selectedShapeOverlayId);
        if (!item) return false;
        const canvasW = state.canvas.width;
        const canvasH = state.canvas.height;
        const box = getShapeOverlayBox(item, canvasW, canvasH);
        const halfH = box.h / 2;
        const handleDist = Math.max(28, Math.min(canvasW, canvasH) * 0.05);
        const angleRad = (item.rotation || 0) * Math.PI / 180;
        const world = rotatePointAround(box.cx, box.cy - halfH - 6 - handleDist, box.cx, box.cy, angleRad);
        const rect = state.canvas.getBoundingClientRect();
        const physScale = canvasW / rect.width;
        const hr = 16 * physScale;
        return Math.hypot(coords.x - world.x, coords.y - world.y) < hr;
    }

    // Draws one Word-style shape (filled path only, no text) centered at the
    // current canvas origin inside a w x h bounding box, in the given color.
    // Caller is expected to have already translated+rotated the context.
    function drawShapeOverlayPath(ctx, type, w, h, color) {
        const halfW = w / 2, halfH = h / 2;
        ctx.save();
        ctx.fillStyle = color;
        ctx.lineJoin = 'round';

        switch (type) {
            case 'ribbon': {
                // Horizontal banner with chevron-notched (arrow-pointed) ends,
                // like a classic headline/news ribbon.
                const notch = w * 0.09;
                ctx.beginPath();
                ctx.moveTo(-halfW + notch, -halfH);
                ctx.lineTo(halfW - notch, -halfH);
                ctx.lineTo(halfW, 0);
                ctx.lineTo(halfW - notch, halfH);
                ctx.lineTo(-halfW + notch, halfH);
                ctx.lineTo(-halfW, 0);
                ctx.closePath();
                ctx.fill();
                break;
            }
            case 'wave': {
                // Rectangle with a wavy top and bottom edge.
                const humps = 3;
                const amp = h * 0.09;
                const segW = w / humps;
                ctx.beginPath();
                ctx.moveTo(-halfW, -halfH);
                for (let i = 0; i < humps; i++) {
                    const xStart = -halfW + i * segW;
                    const xMid = xStart + segW / 2;
                    const xEnd = xStart + segW;
                    const cy = -halfH + ((i % 2 === 0) ? -amp : amp);
                    ctx.quadraticCurveTo(xMid, cy, xEnd, -halfH);
                }
                ctx.lineTo(halfW, halfH);
                for (let i = humps - 1; i >= 0; i--) {
                    const xEnd = -halfW + i * segW;
                    const xMid = xEnd + segW / 2;
                    const xStart = xEnd + segW;
                    const cy = halfH + ((i % 2 === 0) ? amp : -amp);
                    ctx.quadraticCurveTo(xMid, cy, xEnd, halfH);
                }
                ctx.closePath();
                ctx.fill();
                break;
            }
            case 'cloud': {
                // Thought/speech cloud: overlapping circles forming the body,
                // plus two small trailing bubbles as the speech tail.
                ctx.beginPath();
                const bumps = [
                    { cx: -halfW * 0.52, cy: -halfH * 0.02, r: halfH * 0.58 },
                    { cx: -halfW * 0.12, cy: -halfH * 0.42, r: halfH * 0.7 },
                    { cx: halfW * 0.28, cy: -halfH * 0.3, r: halfH * 0.64 },
                    { cx: halfW * 0.55, cy: halfH * 0.05, r: halfH * 0.54 },
                    { cx: halfW * 0.1, cy: halfH * 0.32, r: halfH * 0.6 },
                    { cx: -halfW * 0.32, cy: halfH * 0.28, r: halfH * 0.52 }
                ];
                bumps.forEach((b) => {
                    ctx.moveTo(b.cx + b.r, b.cy);
                    ctx.arc(b.cx, b.cy, b.r, 0, Math.PI * 2);
                });
                ctx.moveTo(-halfW * 0.36 + halfH * 0.16, halfH * 0.78);
                ctx.arc(-halfW * 0.36, halfH * 0.78, halfH * 0.16, 0, Math.PI * 2);
                ctx.moveTo(-halfW * 0.5 + halfH * 0.08, halfH * 0.98);
                ctx.arc(-halfW * 0.5, halfH * 0.98, halfH * 0.08, 0, Math.PI * 2);
                ctx.fill();
                break;
            }
            case 'star6': {
                // Hexagram (6-point star): two overlapping equilateral triangles.
                const R = Math.min(w, h) / 2 * 0.98;
                ctx.beginPath();
                for (let i = 0; i < 3; i++) {
                    const a = -Math.PI / 2 + i * (2 * Math.PI / 3);
                    const x = R * Math.cos(a), y = R * Math.sin(a);
                    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                }
                ctx.closePath();
                for (let i = 0; i < 3; i++) {
                    const a = Math.PI / 2 + i * (2 * Math.PI / 3);
                    const x = R * Math.cos(a), y = R * Math.sin(a);
                    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                }
                ctx.closePath();
                ctx.fill();
                break;
            }
            case 'oval': {
                // Oval callout with a small pointed tail (speech-bubble style).
                ctx.beginPath();
                ctx.ellipse(0, -halfH * 0.08, halfW * 0.94, halfH * 0.82, 0, 0, Math.PI * 2);
                ctx.closePath();
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(-halfW * 0.22, halfH * 0.5);
                ctx.lineTo(-halfW * 0.4, halfH * 1.02);
                ctx.lineTo(halfW * 0.02, halfH * 0.62);
                ctx.closePath();
                ctx.fill();
                break;
            }
            default: {
                ctx.beginPath();
                ctx.rect(-halfW, -halfH, w, h);
                ctx.fill();
            }
        }
        ctx.restore();
    }

    // Draws the user's text, word-wrapped and centered, on top of a shape
    // overlay's fill. Caller has already translated+rotated the context.
    function drawShapeOverlayText(ctx, item, w, h) {
        const fontSize = item.fontSize || 28;
        ctx.save();
        ctx.font = `bold ${fontSize}px "${item.font || 'Hind Siliguri'}", "Plus Jakarta Sans", sans-serif`;
        ctx.fillStyle = item.textColor || '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const maxWidth = w * 0.7;
        const lineHeight = fontSize * 1.22;
        drawWrappedText(ctx, item.text, 0, (item.shapeType === 'oval' ? -h * 0.06 : 0), maxWidth, lineHeight);
        ctx.restore();
    }

    function getStickerBox(item, canvasW, canvasH) {
        const fontSize = canvasW * (item.size / 100);
        const boxW = fontSize * 1.15;
        const boxH = fontSize * 1.15;
        return {
            cx: item.x * canvasW,
            cy: item.y * canvasH,
            boxW,
            boxH,
            fontSize
        };
    }

    function findStickerAt(coords) {
        const canvasW = state.canvas.width;
        const canvasH = state.canvas.height;
        // Search topmost (last drawn / last added) first
        for (let i = state.stickers.length - 1; i >= 0; i--) {
            const item = state.stickers[i];
            const box = getStickerBox(item, canvasW, canvasH);
            if (coords.x >= box.cx - box.boxW / 2 && coords.x <= box.cx + box.boxW / 2 &&
                coords.y >= box.cy - box.boxH / 2 && coords.y <= box.cy + box.boxH / 2) {
                return item;
            }
        }
        return null;
    }

    function findStickerResizeHandle(coords) {
        if (state.selectedStickerId === null) return false;
        const item = state.stickers.find(s => s.id === state.selectedStickerId);
        if (!item) return false;

        const canvasW = state.canvas.width;
        const canvasH = state.canvas.height;
        const box = getStickerBox(item, canvasW, canvasH);

        const rect = state.canvas.getBoundingClientRect();
        const w_rect = rect.width;
        const h_rect = rect.height;
        if (w_rect === 0 || h_rect === 0) return false;

        const r_canvas = canvasW / canvasH;
        const r_rect = w_rect / h_rect;
        const w_render = (r_canvas > r_rect) ? w_rect : h_rect * r_canvas;
        const pad = 20 * (canvasW / w_render);

        const handleX = box.cx + box.boxW / 2;
        const handleY = box.cy + box.boxH / 2;
        return Math.abs(coords.x - handleX) <= pad && Math.abs(coords.y - handleY) <= pad;
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

        if (state.isAddingHighlight && state.isDrawingNewHighlight) {
            const coords = getCanvasCoords(e);
            const item = state.highlights.find(h => h.id === state.selectedHighlightId);
            if (!item) return;
            if (item.shape === 'freehand') {
                let point = {
                    x: Math.max(0, Math.min(1, (coords.x - state.highlightDrawDrawX) / state.highlightDrawDrawW)),
                    y: Math.max(0, Math.min(1, (coords.y - state.highlightDrawDrawY) / state.highlightDrawDrawH))
                };
                const anchor = state.highlightFreehandSegmentStart || item.points[item.points.length - 1];
                if (e.shiftKey) {
                    // Shift locks this complete side to horizontal or vertical.
                    const dx = point.x - anchor.x;
                    const dy = point.y - anchor.y;
                    point = Math.abs(dx) >= Math.abs(dy)
                        ? { x: point.x, y: anchor.y }
                        : { x: anchor.x, y: point.y };
                }
                state.highlightPreviewPoint = point;
                drawFrame();
                return;
            }
            const x0 = state.highlightDrawDrawX + item.x * state.highlightDrawDrawW;
            const y0 = state.highlightDrawDrawY + item.y * state.highlightDrawDrawH;
            const x1 = Math.max(state.highlightDrawDrawX, Math.min(state.highlightDrawDrawX + state.highlightDrawDrawW, coords.x));
            const y1 = Math.max(state.highlightDrawDrawY, Math.min(state.highlightDrawDrawY + state.highlightDrawDrawH, coords.y));
            item.x = (Math.min(x0, x1) - state.highlightDrawDrawX) / state.highlightDrawDrawW;
            item.y = (Math.min(y0, y1) - state.highlightDrawDrawY) / state.highlightDrawDrawH;
            item.w = Math.abs(x1 - x0) / state.highlightDrawDrawW;
            item.h = Math.abs(y1 - y0) / state.highlightDrawDrawH;
            drawFrame();
            return;
        }

        // Background Fill tool — handle draw / drag / resize during mousemove
        if (state.isAddingFill && (state.isDrawingNewFill || state.isDraggingFill || state.isResizingFill)) {
            const coords = getCanvasCoords(e);
            const canvasW = state.canvas.width;
            const canvasH = state.canvas.height;
            const item = (state.fillRegions || []).find(r => r.id === state.selectedFillId);
            if (!item) return;

            if (state.isDrawingNewFill) {
                const x0 = state.fillDragStartX * canvasW;
                const y0 = state.fillDragStartY * canvasH;
                const x1 = Math.max(0, Math.min(canvasW, coords.x));
                const y1 = Math.max(0, Math.min(canvasH, coords.y));
                item.x = Math.min(x0, x1) / canvasW;
                item.y = Math.min(y0, y1) / canvasH;
                item.w = Math.abs(x1 - x0) / canvasW;
                item.h = Math.abs(y1 - y0) / canvasH;
            } else if (state.isDraggingFill) {
                let nx = (coords.x - state.dragFillOffsetX) / canvasW;
                let ny = (coords.y - state.dragFillOffsetY) / canvasH;
                nx = Math.max(0, Math.min(1 - item.w, nx));
                ny = Math.max(0, Math.min(1 - item.h, ny));
                item.x = nx;
                item.y = ny;
            } else if (state.isResizingFill) {
                const rx = item.x * canvasW, ry = item.y * canvasH;
                const newW = Math.max(0.01, (coords.x - rx) / canvasW);
                const newH = Math.max(0.01, (coords.y - ry) / canvasH);
                item.w = Math.min(1 - item.x, newW);
                item.h = Math.min(1 - item.y, newH);
            }
            drawFrame();
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

        // B-roll rotate drag: pointer angle around box center sets item.rotation.
        // Snaps to 15° increments when close (hold Shift to rotate freely).
        if (state.isRotatingBroll && state.selectedBrollId !== null) {
            const coords = getCanvasCoords(e);
            const canvasW = state.canvas.width;
            const canvasH = state.canvas.height;
            const item = state.brollOverlays.find(b => b.id === state.selectedBrollId);
            if (item) {
                const box = getBrollBoxRect(item, canvasW, canvasH);
                const currentAngle = Math.atan2(coords.y - box.cy, coords.x - box.cx) * 180 / Math.PI;
                const delta = currentAngle - state.brollRotateStartAngle;
                let newRotation = state.brollRotateStartRotation + delta;
                if (!e.shiftKey) {
                    const snapped = Math.round(newRotation / 15) * 15;
                    if (Math.abs(newRotation - snapped) < 4) newRotation = snapped;
                }
                item.rotation = ((newRotation % 360) + 360) % 360;
                drawFrame();
            }
            e.preventDefault();
            return;
        }

        // B-roll PiP drag (Phase 5D)
        if (state.isResizingBroll && state.selectedBrollId !== null) {
            const coords = getCanvasCoords(e);
            const canvasW = state.canvas.width;
            const canvasH = state.canvas.height;
            const item = state.brollOverlays.find(b => b.id === state.selectedBrollId);
            if (item) {
                // Resizing a rotated box: rotate the on-screen drag vector back into the
                // box's own local (unrotated) axes first, so dragging the handle along
                // the box's visual edge still grows/shrinks width/height correctly.
                let rawDx = coords.x - state.brollResizeStartX;
                let rawDy = coords.y - state.brollResizeStartY;
                if (item.rotation) {
                    const ang = -(item.rotation * Math.PI / 180);
                    const cosA = Math.cos(ang), sinA = Math.sin(ang);
                    const rDx = rawDx * cosA - rawDy * sinA;
                    const rDy = rawDx * sinA + rawDy * cosA;
                    rawDx = rDx; rawDy = rDy;
                }
                const dx = rawDx / canvasW;
                const dy = rawDy / canvasH;
                const handle = state.brollResizeHandle;
                const sw0 = state.brollResizeStartW;
                const sh0 = state.brollResizeStartH;
                const sx0 = state.brollResizeStartBoxX;
                const sy0 = state.brollResizeStartBoxY;
                const minSz = 0.04;

                let nW = sw0, nH = sh0, nX = sx0, nY = sy0;
                // Right edge grows rightward
                if (handle.includes('right'))  nW = Math.max(minSz, sw0 + dx);
                // Left edge moves left: x shrinks, width grows
                if (handle.includes('left'))   { nW = Math.max(minSz, sw0 - dx); nX = sx0 + dx; }
                // Bottom edge grows downward
                if (handle.includes('bottom')) nH = Math.max(minSz, sh0 + dy);
                // Top edge moves up: y shrinks, height grows
                if (handle.includes('top'))    { nH = Math.max(minSz, sh0 - dy); nY = sy0 + dy; }

                // Clamp to keep box on canvas
                nW = Math.min(1, nW);
                nH = Math.min(1, nH);
                nX = Math.max(0, Math.min(1 - nW, nX));
                nY = Math.max(0, Math.min(1 - nH, nY));

                if (item.type === 'text') {
                    let scaleFactor = 1;
                    if (handle === 'left' || handle === 'right') {
                        scaleFactor = nW / sw0;
                    } else if (handle === 'top' || handle === 'bottom') {
                        scaleFactor = nH / sh0;
                    } else {
                        scaleFactor = (nW / sw0 + nH / sh0) / 2;
                    }
                    const newFontSize = Math.max(14, Math.min(120, Math.round(state.brollResizeStartFontSize * scaleFactor)));
                    item.fontSize = newFontSize;
                    
                    const box = getBrollBoxRect(item, canvasW, canvasH);
                    const finalW = box.w / canvasW;
                    const finalH = box.h / canvasH;
                    
                    let targetX = sx0;
                    let targetY = sy0;
                    if (handle.includes('left')) {
                        targetX = sx0 + sw0 - finalW;
                    }
                    if (handle.includes('top')) {
                        targetY = sy0 + sh0 - finalH;
                    }
                    item.x = Math.max(0, Math.min(1 - finalW, targetX));
                    item.y = Math.max(0, Math.min(1 - finalH, targetY));
                    
                    const brollEditTextFontsize = document.getElementById('broll-edit-text-fontsize');
                    const brollEditTextFontsizeVal = document.getElementById('broll-edit-text-fontsize-val');
                    if (brollEditTextFontsize) {
                        brollEditTextFontsize.value = newFontSize;
                        if (brollEditTextFontsizeVal) brollEditTextFontsizeVal.innerText = newFontSize + 'px';
                    }
                } else {
                    item.pipW = nW;
                    item.pipH = nH;
                    item.x = nX;
                    item.y = nY;
                    item.size = Math.round(nW * 100); // keep slider in sync
                    if (brollSizeSlider) brollSizeSlider.value = Math.min(60, item.size);
                    if (brollSizeVal) brollSizeVal.innerText = item.size + '%';
                }

                drawFrame();
            }
            e.preventDefault();
            return;
        }

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

        // Symbol/Shape rotate drag: pointer angle around box center sets item.rotation.
        // Snaps to 15° increments when close (hold Shift to rotate freely).
        if (state.isRotatingSymbol && state.selectedSymbolId !== null) {
            const coords = getCanvasCoords(e);
            const canvasW = state.canvas.width;
            const canvasH = state.canvas.height;
            const item = state.symbolOverlays.find(s => s.id === state.selectedSymbolId);
            if (item) {
                const box = getSymbolBox(item, canvasW, canvasH);
                const currentAngle = Math.atan2(coords.y - box.cy, coords.x - box.cx) * 180 / Math.PI;
                const delta = currentAngle - state.symbolRotateStartAngle;
                let newRotation = state.symbolRotateStartRotation + delta;
                if (!e.shiftKey) {
                    const snapped = Math.round(newRotation / 15) * 15;
                    if (Math.abs(newRotation - snapped) < 4) newRotation = snapped;
                }
                item.rotation = ((newRotation % 360) + 360) % 360;
                drawFrame();
            }
            e.preventDefault();
            return;
        }

        // Symbol/Shape resize (drag the corner handle to scale uniformly)
        if (state.isResizingSymbol && state.selectedSymbolId !== null) {
            const coords = getCanvasCoords(e);
            const canvasW = state.canvas.width;
            const item = state.symbolOverlays.find(s => s.id === state.selectedSymbolId);
            if (item) {
                const deltaX = coords.x - state.symbolResizeStartX;
                const scaleFactor = (deltaX / canvasW) * 100;
                let newSize = state.symbolResizeStartSize + scaleFactor;
                newSize = Math.max(4, Math.min(60, newSize));
                item.size = newSize;

                if (symbolSizeSlider) symbolSizeSlider.value = Math.round(newSize);
                if (symbolSizeVal) symbolSizeVal.innerText = Math.round(newSize) + '%';

                drawFrame();
            }
            e.preventDefault();
            return;
        }

        // Symbol/Shape drag (move anywhere on the canvas)
        if (state.isDraggingSymbol && state.selectedSymbolId !== null) {
            const coords = getCanvasCoords(e);
            const canvasW = state.canvas.width;
            const canvasH = state.canvas.height;
            const item = state.symbolOverlays.find(s => s.id === state.selectedSymbolId);
            if (item) {
                let newX = (coords.x - state.dragSymbolOffsetX) / canvasW;
                let newY = (coords.y - state.dragSymbolOffsetY) / canvasH;
                newX = Math.max(0, Math.min(1, newX));
                newY = Math.max(0, Math.min(1, newY));
                item.x = newX;
                item.y = newY;
                drawFrame();
            }
            e.preventDefault();
            return;
        }

        // Shape+Text rotate drag
        if (state.isRotatingShapeOverlay && state.selectedShapeOverlayId !== null) {
            const coords = getCanvasCoords(e);
            const canvasW = state.canvas.width;
            const canvasH = state.canvas.height;
            const item = state.shapeOverlays.find(s => s.id === state.selectedShapeOverlayId);
            if (item) {
                const box = getShapeOverlayBox(item, canvasW, canvasH);
                const currentAngle = Math.atan2(coords.y - box.cy, coords.x - box.cx) * 180 / Math.PI;
                const delta = currentAngle - state.shapeOverlayRotateStartAngle;
                let newRotation = state.shapeOverlayRotateStartRotation + delta;
                if (!e.shiftKey) {
                    const snapped = Math.round(newRotation / 15) * 15;
                    if (Math.abs(newRotation - snapped) < 4) newRotation = snapped;
                }
                item.rotation = ((newRotation % 360) + 360) % 360;
                drawFrame();
            }
            e.preventDefault();
            return;
        }

        // Shape+Text resize (drag the corner handle to scale uniformly)
        if (state.isResizingShapeOverlay && state.selectedShapeOverlayId !== null) {
            const coords = getCanvasCoords(e);
            const canvasW = state.canvas.width;
            const item = state.shapeOverlays.find(s => s.id === state.selectedShapeOverlayId);
            if (item) {
                const deltaX = coords.x - state.shapeOverlayResizeStartX;
                const scaleFactor = (deltaX / canvasW) * 100;
                let newSize = state.shapeOverlayResizeStartSize + scaleFactor;
                newSize = Math.max(8, Math.min(90, newSize));
                item.size = newSize;

                if (shapeOverlaySizeSlider) shapeOverlaySizeSlider.value = Math.round(newSize);
                if (shapeOverlaySizeVal) shapeOverlaySizeVal.innerText = Math.round(newSize) + '%';

                drawFrame();
            }
            e.preventDefault();
            return;
        }

        // Shape+Text drag (move anywhere on the canvas)
        if (state.isDraggingShapeOverlay && state.selectedShapeOverlayId !== null) {
            const coords = getCanvasCoords(e);
            const canvasW = state.canvas.width;
            const canvasH = state.canvas.height;
            const item = state.shapeOverlays.find(s => s.id === state.selectedShapeOverlayId);
            if (item) {
                let newX = (coords.x - state.dragShapeOverlayOffsetX) / canvasW;
                let newY = (coords.y - state.dragShapeOverlayOffsetY) / canvasH;
                newX = Math.max(0, Math.min(1, newX));
                newY = Math.max(0, Math.min(1, newY));
                item.x = newX;
                item.y = newY;
                drawFrame();
            }
            e.preventDefault();
            return;
        }

        // Sticker/Emoji resize (Phase 4A)
        if (state.isResizingSticker && state.selectedStickerId !== null) {
            const coords = getCanvasCoords(e);
            const canvasW = state.canvas.width;
            const item = state.stickers.find(s => s.id === state.selectedStickerId);
            if (item) {
                const deltaX = coords.x - state.stickerResizeStartX;
                const scaleFactor = (deltaX / canvasW) * 100;
                let newSize = state.stickerResizeStartSize + scaleFactor;
                newSize = Math.max(4, Math.min(60, newSize));
                item.size = newSize;

                if (stickerSizeSlider) stickerSizeSlider.value = Math.round(newSize);
                if (stickerSizeVal) stickerSizeVal.innerText = Math.round(newSize) + '%';

                drawFrame();
            }
            e.preventDefault();
            return;
        }

        // Sticker/Emoji drag (Phase 4A)
        if (state.isDraggingSticker && state.selectedStickerId !== null) {
            const coords = getCanvasCoords(e);
            const canvasW = state.canvas.width;
            const canvasH = state.canvas.height;
            const item = state.stickers.find(s => s.id === state.selectedStickerId);
            if (item) {
                let newX = (coords.x - state.dragStickerOffsetX) / canvasW;
                let newY = (coords.y - state.dragStickerOffsetY) / canvasH;
                newX = Math.max(0, Math.min(1, newX));
                newY = Math.max(0, Math.min(1, newY));
                item.x = newX;
                item.y = newY;
                drawFrame();
            }
            e.preventDefault();
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

        if (state.isColorPickingBroll) {
            state.canvas.style.cursor = 'crosshair';
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
        if (state.symbolOverlays && state.symbolOverlays.length > 0 && findSymbolAt(idleCoords)) {
            state.canvas.style.cursor = 'move';
            return;
        }
        if (state.stickers && state.stickers.length > 0 && findStickerAt(idleCoords)) {
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
            if (window.recordEditorHistory) {
                window.recordEditorHistory('Crop changed');
            }
            return;
        }

        if (state.isDrawingNewHighlight) {
            const item = state.highlights.find(h => h.id === state.selectedHighlightId);
            if (item?.shape === 'freehand' && state.highlightPreviewPoint) {
                const anchor = state.highlightFreehandSegmentStart || item.points[item.points.length - 1];
                const endpoint = state.highlightPreviewPoint;
                if (Math.hypot(endpoint.x - anchor.x, endpoint.y - anchor.y) > 0.003) item.points.push(endpoint);
            }
            state.isDrawingNewHighlight = false;
            state.highlightStraightAnchor = null;
            state.highlightStraightPointIndex = null;
            state.highlightFreehandSegmentStart = null;
            state.highlightPreviewPoint = null;
            if (item?.shape === 'freehand' && item.points.length >= 3) {
                const first = item.points[0];
                const last = item.points[item.points.length - 1];
                // Only close when the cursor returns almost exactly to the first
                // point. A generous tolerance prematurely closed a third side.
                if (Math.hypot(last.x - first.x, last.y - first.y) < 0.012) {
                    // Snap the last point exactly to the start, so the final side is clean.
                    item.points[item.points.length - 1] = { ...first };
                    item.isClosed = true;
                }
            }
            // Keep a two-point freehand line too; it can be given a time range and
            // extended into a box/polygon with another drag from its endpoint.
            let isRemoved = false;
            if (item && ((item.shape === 'freehand' && item.points.length < 2) || (item.shape !== 'freehand' && (item.w < 0.01 || item.h < 0.01)))) {
                state.highlights = state.highlights.filter(h => h.id !== item.id);
                state.selectedHighlightId = null;
                isRemoved = true;
            }
            if (window.onHighlightSelected) window.onHighlightSelected(state.selectedHighlightId);
            drawFrame();
            if (!isRemoved && window.recordEditorHistory) {
                window.recordEditorHistory('Highlight added');
            }
            return;
        }

        if (state.isDrawingNewBlur || state.isDraggingBlur || state.isResizingBlur) {
            const wasDrawing = state.isDrawingNewBlur;
            state.isDrawingNewBlur = false;
            state.isDraggingBlur = false;
            state.isResizingBlur = false;

            const region = state.blurRegions.find(r => r.id === state.selectedBlurId);
            let isRemoved = false;
            if (wasDrawing && region && (region.w < 0.02 || region.h < 0.02)) {
                // Discard accidental tiny/zero-size box from a simple click
                state.blurRegions = state.blurRegions.filter(r => r.id !== region.id);
                state.selectedBlurId = null;
                isRemoved = true;
            }
            if (window.onBlurRegionSelected) window.onBlurRegionSelected(state.selectedBlurId);
            drawFrame();
            if (!isRemoved && window.recordEditorHistory) {
                window.recordEditorHistory(wasDrawing ? 'Blur region added' : 'Blur region modified');
            }
            return;
        }

        // Background Fill tool — finalise draw / drag / resize
        if (state.isDrawingNewFill || state.isDraggingFill || state.isResizingFill) {
            const wasDrawing = state.isDrawingNewFill;
            state.isDrawingNewFill = false;
            state.isDraggingFill = false;
            state.isResizingFill = false;
            // Discard tiny accidental clicks
            const item = (state.fillRegions || []).find(r => r.id === state.selectedFillId);
            let isRemoved = false;
            if (wasDrawing && item && (item.w < 0.01 || item.h < 0.01)) {
                state.fillRegions = state.fillRegions.filter(r => r.id !== item.id);
                state.selectedFillId = null;
                isRemoved = true;
            }
            if (window.onFillSelected) window.onFillSelected(state.selectedFillId);
            if (typeof triggerAutoSave === 'function') triggerAutoSave();
            drawFrame();
            if (!isRemoved && window.recordEditorHistory) {
                window.recordEditorHistory(wasDrawing ? 'Background fill added' : 'Background fill modified');
            }
            return;
        }

        let recordedAction = null;
        if (state.isDraggingLogo || state.isResizingLogo) recordedAction = 'Logo modified';
        else if (state.isDraggingTextOverlay) recordedAction = 'Text overlay modified';
        else if (state.isDraggingBroll || state.isResizingBroll || state.isRotatingBroll) recordedAction = 'B-roll modified';
        else if (state.isDraggingSticker || state.isResizingSticker) recordedAction = 'Sticker modified';
        else if (state.isDraggingSymbol || state.isResizingSymbol || state.isRotatingSymbol) recordedAction = 'Symbol modified';
        else if (state.isDraggingShapeOverlay || state.isResizingShapeOverlay || state.isRotatingShapeOverlay) recordedAction = 'Shape modified';

        state.isDraggingLogo = false;
        state.isResizingLogo = false;
        state.isDraggingTextOverlay = false;
        state.isDraggingBroll = false;
        state.isResizingBroll = false;
        state.isRotatingBroll = false;
        state.isDraggingSticker = false;
        state.isResizingSticker = false;
        state.isDraggingSymbol = false;
        state.isResizingSymbol = false;
        state.isRotatingSymbol = false;
        state.isDraggingShapeOverlay = false;
        state.isResizingShapeOverlay = false;
        state.isRotatingShapeOverlay = false;

        if (recordedAction && window.recordEditorHistory) {
            window.recordEditorHistory(recordedAction);
        }
    }

    // --- Video Crop Tool Bindings ---
    const cropToolToggle = document.getElementById('crop-tool-toggle');
    const cropActionsContainer = document.getElementById('crop-actions-container');
    const resetCropBtn = document.getElementById('reset-crop-btn');
    const autoReframeBtn = document.getElementById('auto-reframe-btn');
    
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
        if (window.captureUndoCheckpoint) window.captureUndoCheckpoint();
        state.cropX = 0;
        state.cropY = 0;
        state.cropW = 1;
        state.cropH = 1;
        syncCropToActiveClip();
        updateCropDimensionsDisplay();
        updateCanvasDimensions();
        drawFrame();
        if (window.recordEditorHistory) {
            window.recordEditorHistory('Crop reset');
        }
    });

    if (autoReframeBtn) {
        autoReframeBtn.addEventListener('click', () => {
            const activeClip = state.clips.find(c => c.id === state.activeClipId);
            if (!activeClip) {
                alert("দয়া করে প্রথমে একটি ভিডিও ক্লিপ সিলেক্ট করুন।");
                return;
            }
            if (activeClip.type === 'image') {
                alert("অটো-রিফ্রেম শুধু ভিডিও ক্লিপের জন্য প্রযোজ্য।");
                return;
            }
            if (state.aspectRatio === 'original') {
                alert("অটো-রিফ্রেম করার জন্য প্রথমে একটি ক্যানভাস ফরম্যাট (যেমন ১:১, ৪:৫ বা ৯:১৬) সিলেক্ট করুন।");
                return;
            }

            try {
                const originalText = autoReframeBtn.innerHTML;
                autoReframeBtn.disabled = true;
                autoReframeBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Analyzing...';

                setTimeout(() => {
                    performAutoReframe(activeClip);
                    autoReframeBtn.disabled = false;
                    autoReframeBtn.innerHTML = originalText;
                }, 100);
            } catch (err) {
                console.error("Auto Reframe error:", err);
                alert("অটো-রিফ্রেম ব্যর্থ হয়েছে।");
                autoReframeBtn.disabled = false;
                autoReframeBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Auto Reframe (Smart Crop)';
            }
        });
    }

    function performAutoReframe(activeClip) {
        const video = state.video;
        if (!video.videoWidth || !video.videoHeight) {
            alert("ভিডিও ফাইলটি পুরোপুরি লোড হয়নি। দয়া করে একটু অপেক্ষা করুন।");
            return;
        }

        const videoW = video.videoWidth;
        const videoH = video.videoHeight;
        const videoRatio = videoW / videoH;

        let targetRatio = 1.0;
        switch (state.aspectRatio) {
            case '1-1':
                targetRatio = 1.0;
                break;
            case '4-5':
                targetRatio = 0.8;
                break;
            case '9-16':
                targetRatio = 9 / 16;
                break;
            case '16-9':
                targetRatio = 16 / 9;
                break;
            default:
                targetRatio = videoRatio;
        }

        const ow = 320;
        const oh = Math.round(320 / videoRatio);
        const offscreen = document.createElement('canvas');
        offscreen.width = ow;
        offscreen.height = oh;
        const octx = offscreen.getContext('2d');

        octx.drawImage(video, 0, 0, ow, oh);
        const imgData = octx.getImageData(0, 0, ow, oh);
        const pixels = imgData.data;

        if (targetRatio < videoRatio) {
            const targetWNorm = targetRatio / videoRatio;
            const targetWPixels = Math.round(targetWNorm * ow);

            const columnScores = new Float32Array(ow);
            for (let x = 0; x < ow - 1; x++) {
                for (let y = 0; y < oh; y++) {
                    const idx = (y * ow + x) * 4;
                    const rDiff = Math.abs(pixels[idx] - pixels[idx + 4]);
                    const gDiff = Math.abs(pixels[idx + 1] - pixels[idx + 5]);
                    const bDiff = Math.abs(pixels[idx + 2] - pixels[idx + 6]);
                    columnScores[x] += rDiff + gDiff + bDiff;
                }
            }

            const smoothScores = new Float32Array(ow);
            const kSize = Math.max(3, Math.floor(ow / 24));
            for (let x = 0; x < ow; x++) {
                let sum = 0;
                let count = 0;
                for (let k = -kSize; k <= kSize; k++) {
                    const col = x + k;
                    if (col >= 0 && col < ow) {
                        sum += columnScores[col];
                        count++;
                    }
                }
                smoothScores[x] = sum / count;
            }

            let bestX = 0;
            let maxScore = -1;
            const limit = ow - targetWPixels;

            for (let x = 0; x <= limit; x++) {
                let score = 0;
                for (let k = 0; k < targetWPixels; k++) {
                    score += smoothScores[x + k];
                }
                const distFromCenter = Math.abs(x + targetWPixels / 2 - ow / 2) / (ow / 2);
                const bias = 1.0 - 0.1 * distFromCenter;
                const biasedScore = score * bias;

                if (biasedScore > maxScore) {
                    maxScore = biasedScore;
                    bestX = x;
                }
            }

            state.cropX = bestX / ow;
            state.cropY = 0;
            state.cropW = targetWNorm;
            state.cropH = 1.0;

        } else if (targetRatio > videoRatio) {
            const targetHNorm = videoRatio / targetRatio;
            const targetHPixels = Math.round(targetHNorm * oh);

            const rowScores = new Float32Array(oh);
            for (let y = 0; y < oh - 1; y++) {
                for (let x = 0; x < ow; x++) {
                    const idx = (y * ow + x) * 4;
                    const nextIdx = ((y + 1) * ow + x) * 4;
                    const rDiff = Math.abs(pixels[idx] - pixels[nextIdx]);
                    const gDiff = Math.abs(pixels[idx + 1] - pixels[nextIdx + 1]);
                    const bDiff = Math.abs(pixels[idx + 2] - pixels[nextIdx + 2]);
                    rowScores[y] += rDiff + gDiff + bDiff;
                }
            }

            const smoothScores = new Float32Array(oh);
            const kSize = Math.max(3, Math.floor(oh / 24));
            for (let y = 0; y < oh; y++) {
                let sum = 0;
                let count = 0;
                for (let k = -kSize; k <= kSize; k++) {
                    const row = y + k;
                    if (row >= 0 && row < oh) {
                        sum += rowScores[row];
                        count++;
                    }
                }
                smoothScores[y] = sum / count;
            }

            let bestY = 0;
            let maxScore = -1;
            const limit = oh - targetHPixels;

            for (let y = 0; y <= limit; y++) {
                let score = 0;
                for (let k = 0; k < targetHPixels; k++) {
                    score += smoothScores[y + k];
                }
                const distFromCenter = Math.abs(y + targetHPixels / 2 - oh / 2) / (oh / 2);
                const bias = 1.0 - 0.1 * distFromCenter;
                const biasedScore = score * bias;

                if (biasedScore > maxScore) {
                    maxScore = biasedScore;
                    bestY = y;
                }
            }

            state.cropX = 0;
            state.cropY = bestY / oh;
            state.cropW = 1.0;
            state.cropH = targetHNorm;

        } else {
            state.cropX = 0;
            state.cropY = 0;
            state.cropW = 1.0;
            state.cropH = 1.0;
        }

        syncCropToActiveClip();
        updateCropDimensionsDisplay();
        updateCanvasDimensions();
        drawFrame();

        if (typeof triggerAutoSave === 'function') triggerAutoSave();
        if (window.recordEditorHistory) {
            window.recordEditorHistory('Auto-reframe applied');
        }
    }

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

    // --- Video Highlight / Callout Bindings ---
    const highlightToolToggle = document.getElementById('highlight-tool-toggle');
    const highlightActionsContainer = document.getElementById('highlight-actions-container');
    const highlightShapeSelect = document.getElementById('highlight-shape-select');
    const highlightColorInput = document.getElementById('highlight-color');
    const highlightColorVal = document.getElementById('highlight-color-val');
    const highlightLineWidth = document.getElementById('highlight-line-width');
    const highlightLineWidthVal = document.getElementById('highlight-line-width-val');
    const highlightFillOpacity = document.getElementById('highlight-fill-opacity');
    const highlightFillOpacityVal = document.getElementById('highlight-fill-opacity-val');
    const highlightDrawSpeed = document.getElementById('highlight-draw-speed');
    const highlightDrawSpeedVal = document.getElementById('highlight-draw-speed-val');
    const highlightListEl = document.getElementById('highlight-list');
    const highlightTimingContainer = document.getElementById('highlight-timing-container');
    const highlightStartInput = document.getElementById('highlight-start');
    const highlightEndInput = document.getElementById('highlight-end');
    const deleteHighlightBtn = document.getElementById('delete-highlight-btn');

    function selectedHighlight() { return state.highlights.find(h => h.id === state.selectedHighlightId); }
    function syncSelectedHighlightStyle() {
        const item = selectedHighlight(); if (!item) return;
        item.shape = highlightShapeSelect.value; item.color = highlightColorInput.value;
        item.lineWidth = parseInt(highlightLineWidth.value); item.fillOpacity = parseInt(highlightFillOpacity.value);
        item.drawDuration = parseFloat(highlightDrawSpeed.value);
        drawFrame();
    }
    function renderHighlightList() {
        if (!highlightListEl) return;
        highlightListEl.innerHTML = '';
        state.highlights.forEach((item, index) => {
            const row = document.createElement('div');
            row.className = 'text-overlay-list-item' + (item.id === state.selectedHighlightId ? ' active' : '');
            row.style.cssText = `display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-radius:6px;margin-bottom:6px;cursor:pointer;background:${item.id === state.selectedHighlightId ? 'rgba(0,229,255,.12)' : 'rgba(255,255,255,.04)'};border:1px solid ${item.id === state.selectedHighlightId ? '#00e5ff' : 'transparent'};`;
            row.innerHTML = `<span style="font-size:13px"><i class="fa-solid fa-highlighter" style="color:${item.color}"></i> Highlight ${index + 1} · ${item.shape}</span><span style="font-size:11px;opacity:.6">${item.startSec.toFixed(1)}s–${item.endSec.toFixed(1)}s</span>`;
            row.addEventListener('click', () => { state.selectedHighlightId = item.id; showHighlightControls(item.id); renderHighlightList(); drawFrame(); });
            highlightListEl.appendChild(row);
        });
    }
    function showHighlightControls(id) {
        const item = state.highlights.find(h => h.id === id);
        if (!item) { highlightTimingContainer.style.display = 'none'; return; }
        highlightTimingContainer.style.display = 'block';
        highlightShapeSelect.value = item.shape; highlightColorInput.value = item.color;
        highlightColorVal.innerText = item.color.toUpperCase();
        highlightLineWidth.value = item.lineWidth; highlightLineWidthVal.innerText = item.lineWidth + 'px';
        highlightFillOpacity.value = item.fillOpacity; highlightFillOpacityVal.innerText = item.fillOpacity + '%';
        highlightDrawSpeed.value = item.drawDuration ?? 0.6; highlightDrawSpeedVal.innerText = (item.drawDuration ?? 0.6).toFixed(1) + 's';
        highlightStartInput.value = item.startSec; highlightEndInput.value = item.endSec;
    }
    if (highlightToolToggle) highlightToolToggle.addEventListener('change', () => {
        state.isAddingHighlight = highlightToolToggle.checked;
        highlightActionsContainer.style.display = state.isAddingHighlight ? 'block' : 'none';
        if (state.isAddingHighlight) {
            renderHighlightList();
            if (fillToolToggle && fillToolToggle.checked) {
                fillToolToggle.checked = false;
                state.isAddingFill = false;
                if (fillActionsContainer) fillActionsContainer.style.display = 'none';
            }
        }
        drawFrame();
    });
    [highlightShapeSelect, highlightColorInput, highlightLineWidth, highlightFillOpacity, highlightDrawSpeed].forEach(el => el && el.addEventListener('input', () => {
        highlightColorVal.innerText = highlightColorInput.value.toUpperCase();
        highlightLineWidthVal.innerText = highlightLineWidth.value + 'px'; highlightFillOpacityVal.innerText = highlightFillOpacity.value + '%';
        if (highlightDrawSpeedVal) highlightDrawSpeedVal.innerText = parseFloat(highlightDrawSpeed.value).toFixed(1) + 's';
        syncSelectedHighlightStyle();
    }));
    if (highlightStartInput) highlightStartInput.addEventListener('input', () => { const item = selectedHighlight(); if (item) { item.startSec = Math.max(0, parseFloat(highlightStartInput.value) || 0); item.endSec = Math.max(item.startSec + .1, item.endSec); highlightEndInput.value = item.endSec; renderHighlightList(); drawFrame(); } });
    if (highlightEndInput) highlightEndInput.addEventListener('input', () => { const item = selectedHighlight(); if (item) { item.endSec = Math.max(item.startSec + .1, parseFloat(highlightEndInput.value) || item.startSec + 1); renderHighlightList(); drawFrame(); } });
    if (deleteHighlightBtn) deleteHighlightBtn.addEventListener('click', () => { state.highlights = state.highlights.filter(h => h.id !== state.selectedHighlightId); state.selectedHighlightId = null; highlightTimingContainer.style.display = 'none'; renderHighlightList(); drawFrame(); });
    window.onHighlightSelected = function(id) { state.selectedHighlightId = id; renderHighlightList(); showHighlightControls(id); };

    // --- Background Fill Tool Bindings ---
    const fillToolToggle = document.getElementById('fill-tool-toggle');
    const fillActionsContainer = document.getElementById('fill-actions-container');
    const fillColorInput = document.getElementById('fill-region-color');
    const fillColorVal = document.getElementById('fill-region-color-val');
    const fillOpacitySlider = document.getElementById('fill-region-opacity');
    const fillOpacityVal = document.getElementById('fill-region-opacity-val');
    const fillListEl = document.getElementById('fill-list');
    const fillTimingContainer = document.getElementById('fill-timing-container');
    const fillStartInput = document.getElementById('fill-start');
    const fillEndInput = document.getElementById('fill-end');
    const deleteFillBtn = document.getElementById('delete-fill-btn');

    function selectedFill() { return (state.fillRegions || []).find(r => r.id === state.selectedFillId); }

    function renderFillList() {
        if (!fillListEl) return;
        fillListEl.innerHTML = '';
        (state.fillRegions || []).forEach((item, index) => {
            const row = document.createElement('div');
            row.className = 'text-overlay-list-item' + (item.id === state.selectedFillId ? ' active' : '');
            row.style.cssText = `display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-radius:6px;margin-bottom:6px;cursor:pointer;background:${item.id === state.selectedFillId ? 'rgba(255,200,0,.12)' : 'rgba(255,255,255,.04)'};border:1px solid ${item.id === state.selectedFillId ? '#ffc800' : 'transparent'};`;
            row.innerHTML = `<span style="font-size:13px"><i class="fa-solid fa-fill-drip" style="color:${item.color}"></i> Fill ${index + 1}</span><span style="font-size:11px;opacity:.6">${item.startSec.toFixed(1)}s–${item.endSec.toFixed(1)}s</span>`;
            row.addEventListener('click', () => { state.selectedFillId = item.id; showFillControls(item.id); renderFillList(); drawFrame(); });
            fillListEl.appendChild(row);
        });
    }

    function showFillControls(id) {
        const item = (state.fillRegions || []).find(r => r.id === id);
        if (!item) { if (fillTimingContainer) fillTimingContainer.style.display = 'none'; return; }
        if (fillTimingContainer) fillTimingContainer.style.display = 'block';
        if (fillColorInput) { fillColorInput.value = item.color; }
        if (fillColorVal) fillColorVal.innerText = item.color.toUpperCase();
        if (fillOpacitySlider) fillOpacitySlider.value = item.opacity ?? 80;
        if (fillOpacityVal) fillOpacityVal.innerText = (item.opacity ?? 80) + '%';
        if (fillStartInput) fillStartInput.value = item.startSec;
        if (fillEndInput) fillEndInput.value = item.endSec;
    }

    if (fillToolToggle) fillToolToggle.addEventListener('change', () => {
        state.isAddingFill = fillToolToggle.checked;
        if (fillActionsContainer) fillActionsContainer.style.display = state.isAddingFill ? 'block' : 'none';
        if (state.isAddingFill) {
            renderFillList();
            if (highlightToolToggle && highlightToolToggle.checked) {
                highlightToolToggle.checked = false;
                state.isAddingHighlight = false;
                highlightActionsContainer.style.display = 'none';
            }
        }
        drawFrame();
    });

    if (fillColorInput) fillColorInput.addEventListener('input', () => {
        if (fillColorVal) fillColorVal.innerText = fillColorInput.value.toUpperCase();
        const item = selectedFill(); if (item) { item.color = fillColorInput.value; drawFrame(); }
    });

    if (fillOpacitySlider) fillOpacitySlider.addEventListener('input', () => {
        if (fillOpacityVal) fillOpacityVal.innerText = fillOpacitySlider.value + '%';
        const item = selectedFill(); if (item) { item.opacity = parseInt(fillOpacitySlider.value); drawFrame(); }
    });

    if (fillStartInput) fillStartInput.addEventListener('input', () => {
        const item = selectedFill();
        if (item) {
            item.startSec = Math.max(0, parseFloat(fillStartInput.value) || 0);
            item.endSec = Math.max(item.startSec + 0.1, item.endSec);
            if (fillEndInput) fillEndInput.value = item.endSec;
            renderFillList(); drawFrame();
        }
    });

    if (fillEndInput) fillEndInput.addEventListener('input', () => {
        const item = selectedFill();
        if (item) {
            item.endSec = Math.max(item.startSec + 0.1, parseFloat(fillEndInput.value) || item.startSec + 1);
            renderFillList(); drawFrame();
        }
    });

    if (deleteFillBtn) deleteFillBtn.addEventListener('click', () => {
        state.fillRegions = (state.fillRegions || []).filter(r => r.id !== state.selectedFillId);
        state.selectedFillId = null;
        if (fillTimingContainer) fillTimingContainer.style.display = 'none';
        renderFillList(); drawFrame();
    });

    window.onFillSelected = function(id) {
        state.selectedFillId = id;
        renderFillList();
        showFillControls(id);
    };

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
    const brollVideoInputSection = document.getElementById('broll-video-input-section');
    const brollVideoDropzone = document.getElementById('broll-video-dropzone');
    const brollVideoInput = document.getElementById('broll-video-input');
    const brollTextInputSection = document.getElementById('broll-text-input-section');
    const brollTextInput = document.getElementById('broll-text-input');
    const brollBulletSelect = document.getElementById('broll-bullet-select');
    const brollTextFontsizeSlider = document.getElementById('broll-text-fontsize');
    const brollTextFontsizeVal = document.getElementById('broll-text-fontsize-val');
    const brollTextColorInput = document.getElementById('broll-text-color');
    const brollTextColorVal = document.getElementById('broll-text-color-val');
    const addBrollTextBtn = document.getElementById('add-broll-text-btn');
    const brollTextBgEnabled = document.getElementById('broll-text-bg-enabled');
    const brollTextBgColor = document.getElementById('broll-text-bg-color');
    const brollTextBgColorVal = document.getElementById('broll-text-bg-color-val');
    const brollTextBgColorRow = document.getElementById('broll-text-bg-color-row');
    if (brollTextBgEnabled && brollTextBgColorRow) {
        brollTextBgEnabled.addEventListener('change', () => {
            brollTextBgColorRow.style.display = brollTextBgEnabled.checked ? 'flex' : 'none';
        });
    }
    if (brollTextBgColor && brollTextBgColorVal) {
        brollTextBgColor.addEventListener('input', (e) => {
            brollTextBgColorVal.innerText = e.target.value;
        });
    }

    const brollTextHighlightEnabled = document.getElementById('broll-text-highlight-enabled');
    const brollTextHighlightColor = document.getElementById('broll-text-highlight-color');
    const brollTextHighlightColorVal = document.getElementById('broll-text-highlight-color-val');
    const brollTextHighlightColorRow = document.getElementById('broll-text-highlight-color-row');
    if (brollTextHighlightEnabled && brollTextHighlightColorRow) {
        brollTextHighlightEnabled.addEventListener('change', () => {
            brollTextHighlightColorRow.style.display = brollTextHighlightEnabled.checked ? 'flex' : 'none';
        });
    }
    if (brollTextHighlightColor && brollTextHighlightColorVal) {
        brollTextHighlightColor.addEventListener('input', (e) => {
            brollTextHighlightColorVal.innerText = e.target.value;
        });
    }

    const brollEditTextBgEnabled = document.getElementById('broll-edit-text-bg-enabled');
    const brollEditTextBgColor = document.getElementById('broll-edit-text-bg-color');
    const brollEditTextBgColorVal = document.getElementById('broll-edit-text-bg-color-val');
    const brollEditTextBgColorRow = document.getElementById('broll-edit-text-bg-color-row');
    if (brollEditTextBgEnabled && brollEditTextBgColorRow) {
        brollEditTextBgEnabled.addEventListener('change', () => {
            brollEditTextBgColorRow.style.display = brollEditTextBgEnabled.checked ? 'flex' : 'none';
            const item = state.brollOverlays.find(b => b.id === state.selectedBrollId);
            if (item && item.type === 'text') {
                item.bgEnabled = brollEditTextBgEnabled.checked;
                drawFrame();
            }
        });
    }
    if (brollEditTextBgColor && brollEditTextBgColorVal) {
        brollEditTextBgColor.addEventListener('input', (e) => {
            brollEditTextBgColorVal.innerText = e.target.value;
            const item = state.brollOverlays.find(b => b.id === state.selectedBrollId);
            if (item && item.type === 'text') {
                item.bgColor = e.target.value;
                drawFrame();
            }
        });
    }

    const brollEditTextHighlightEnabled = document.getElementById('broll-edit-text-highlight-enabled');
    const brollEditTextHighlightColor = document.getElementById('broll-edit-text-highlight-color');
    const brollEditTextHighlightColorVal = document.getElementById('broll-edit-text-highlight-color-val');
    const brollEditTextHighlightColorRow = document.getElementById('broll-edit-text-highlight-color-row');
    if (brollEditTextHighlightEnabled && brollEditTextHighlightColorRow) {
        brollEditTextHighlightEnabled.addEventListener('change', () => {
            brollEditTextHighlightColorRow.style.display = brollEditTextHighlightEnabled.checked ? 'flex' : 'none';
            const item = state.brollOverlays.find(b => b.id === state.selectedBrollId);
            if (item && item.type === 'text') {
                item.solidHighlight = brollEditTextHighlightEnabled.checked;
                drawFrame();
            }
        });
    }
    if (brollEditTextHighlightColor && brollEditTextHighlightColorVal) {
        brollEditTextHighlightColor.addEventListener('input', (e) => {
            brollEditTextHighlightColorVal.innerText = e.target.value;
            const item = state.brollOverlays.find(b => b.id === state.selectedBrollId);
            if (item && item.type === 'text') {
                item.highlightColor = e.target.value;
                drawFrame();
            }
        });
    }


    let brollAddType = 'image';
    if (brollTypeToggle) {
        brollTypeToggle.addEventListener('click', (e) => {
            const btn = e.target.closest('.segmented-btn');
            if (!btn) return;
            brollAddType = btn.dataset.type;
            brollTypeToggle.querySelectorAll('.segmented-btn').forEach(b => b.classList.toggle('active', b === btn));
            if (brollImageInputSection) brollImageInputSection.style.display = brollAddType === 'image' ? 'block' : 'none';
            if (brollVideoInputSection) brollVideoInputSection.style.display = brollAddType === 'video' ? 'block' : 'none';
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
    const brollTransparentBg = document.getElementById('broll-transparent-bg');
    const brollSizeSlider = document.getElementById('broll-size-slider');
    const brollSizeVal = document.getElementById('broll-size-val');
    const brollSizeContainer = document.getElementById('broll-size-container');
    const brollListEl = document.getElementById('broll-list');
    const brollTimingContainer = document.getElementById('broll-timing-container');
    const brollStartInput = document.getElementById('broll-start');
    const brollEndInput = document.getElementById('broll-end');
    const deleteBrollBtn = document.getElementById('delete-broll-btn');
    const brollAnimStyleSelect = document.getElementById('broll-anim-style');

    const brollEditTextSection = document.getElementById('broll-edit-text-section');
    const brollEditTextInput = document.getElementById('broll-edit-text-input');
    const brollEditTextFontsize = document.getElementById('broll-edit-text-fontsize');
    const brollEditTextFontsizeVal = document.getElementById('broll-edit-text-fontsize-val');
    const brollEditTextColor = document.getElementById('broll-edit-text-color');
    const brollEditTextColorVal = document.getElementById('broll-edit-text-color-val');
    if (brollEditTextInput) {
        brollEditTextInput.addEventListener('input', (e) => {
            const item = state.brollOverlays.find(b => b.id === state.selectedBrollId);
            if (item && item.type === 'text') {
                item.text = e.target.value;
                renderBrollList();
                drawFrame();
            }
        });
    }
    if (brollEditTextFontsize) {
        brollEditTextFontsize.addEventListener('input', (e) => {
            const item = state.brollOverlays.find(b => b.id === state.selectedBrollId);
            if (brollEditTextFontsizeVal) brollEditTextFontsizeVal.innerText = e.target.value + 'px';
            if (item && item.type === 'text') {
                item.fontSize = parseInt(e.target.value);
                drawFrame();
            }
        });
    }
    if (brollEditTextColor) {
        brollEditTextColor.addEventListener('input', (e) => {
            const item = state.brollOverlays.find(b => b.id === state.selectedBrollId);
            if (brollEditTextColorVal) brollEditTextColorVal.innerText = e.target.value;
            if (item && item.type === 'text') {
                item.color = e.target.value;
                drawFrame();
            }
        });
    }
    const brollDirectionRow = document.getElementById('broll-direction-row');
    const brollExitDirectionRow = document.getElementById('broll-exit-direction-row');
    const brollEntryDirSelect = document.getElementById('broll-entry-dir');
    const brollExitDirSelect = document.getElementById('broll-exit-dir');
    const brollAnimSpeedSlider = document.getElementById('broll-anim-speed');
    const brollAnimSpeedVal = document.getElementById('broll-anim-speed-val');
    const brollSoundEffectSelect = document.getElementById('broll-sound-effect');
    const brollFitContainer = document.getElementById('broll-fit-container');
    const brollFitSelect = document.getElementById('broll-fit-select');
    const brollCustomSoundContainer = document.getElementById('broll-custom-sound-container');
    const brollCustomSoundInput = document.getElementById('broll-custom-sound-input');
    const brollCustomSoundFilename = document.getElementById('broll-custom-sound-filename');

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
        { value: 'typewriter', label: 'Typewriter Reveal (টাইপরাইটারের মতো লেখা হবে)', textOnly: true },
        { value: 'magnifier-zoom', label: 'Magnifying Glass Zoom (🔍 ম্যাগনিফায়ার আইকন)' },
        { value: 'comparison-slide', label: 'Comparison Slide (Before/After স্লাইডার)' },
        { value: 'question-bounce', label: 'Question Mark Bounce (❓ লাফিয়ে আসবে)' },
        { value: 'confetti-pop', label: 'Confetti Pop (রঙিন কনফেত্তি ছড়িয়ে পড়বে)' },
        { value: 'heart-burst', label: 'Heart Burst (❤️ হার্ট ছড়িয়ে পড়বে)' },
        { value: 'hanging-sign-swing', label: 'Hanging Sign Swing (🔴 পিন থেকে ঝুলে দুলতে দুলতে আসবে)' },
        { value: 'plane-banner-trail', label: 'Plane Banner Trail (✈️ প্লেন উড়ে গিয়ে লেখা রেখে যাবে)' },

        // Kinetic Typography (v2.8) — per-letter/per-word text entrances. These
        // only make sense for Text B-roll (each style animates the individual
        // characters/words instead of the whole box as one rigid unit), so
        // they're flagged textOnly and filtered out of the dropdown for image
        // and video B-roll.
        { value: 'letter-rotate-settle', label: '✍️ অক্ষর ঘুরে ঘুরে বসবে (Letter Spin & Settle)', textOnly: true },
        { value: 'letter-converge', label: '🤝 দুই পাশ থেকে এসে মিলবে (Two-Side Converge)', textOnly: true },
        { value: 'letter-cascade-fade', label: '✨ একটার পর একটা অক্ষর ভেসে উঠবে (Letter Cascade Fade)', textOnly: true },
        { value: 'word-pop-stagger', label: '🔤 শব্দ ধরে ধরে পপ করে আসবে (Word-by-Word Pop)', textOnly: true },
        
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

    function populateBrollAnimStyleOptions(itemType) {
        if (!brollAnimStyleSelect) return;
        // 'textOnly' styles (Typewriter + the kinetic per-letter/word entrances)
        // animate actual characters, so they're meaningless for an image/video
        // box — hide them there instead of leaving a confusing option that
        // silently does nothing when picked.
        const list = (itemType === 'text')
            ? BROLL_ANIM_STYLES
            : BROLL_ANIM_STYLES.filter(o => !o.textOnly);
        brollAnimStyleSelect.innerHTML = list.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
    }

    // Shows/hides the entry/exit direction pickers depending on whether the
    // currently selected animation style actually uses a direction.
    function updateBrollDirectionRowsVisibility(style) {
        // 'pan' only cares about a single pan direction (reuses the entry-direction
        // picker) and has no separate exit phase, so its exit-direction row stays hidden.
        const usesEntryDirection = (style === 'slide' || style === 'slide-pop' || style === 'pan' || style === 'arrow-point' || style === 'plane-banner-trail');
        const usesExitDirection = (style === 'slide' || style === 'slide-pop' || style === 'plane-banner-trail');
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

    if (brollVideoDropzone) {
        brollVideoDropzone.addEventListener('click', () => brollVideoInput.click());

        brollVideoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) loadBrollVideo(file);
        });

        brollVideoDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            brollVideoDropzone.classList.add('drag-over');
        });
        brollVideoDropzone.addEventListener('dragleave', () => {
            brollVideoDropzone.classList.remove('drag-over');
        });
        brollVideoDropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            brollVideoDropzone.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('video/')) loadBrollVideo(file);
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
                originalImageUrl: url,
                file: file,
                originalFile: file,
                name: file.name,
                size: file.size,
                mode: brollModeSelect ? brollModeSelect.value : 'fullscreen',
                size: brollModeSelect && brollModeSelect.value === 'pip'
                    ? (brollSizeSlider ? parseInt(brollSizeSlider.value) : 35)
                    : 100,
                x: 0.05,
                y: 0.6,
                rotation: 0, // manual tilt angle in degrees, set via the rotate handle
                startSec: Math.min(state.endTime || state.duration || 5, state.currentTime || 0),
                endSec: Math.min(state.endTime || state.duration || 5, (state.currentTime || 0) + 3),
                // Each B-roll clip enters from a different side so a sequence
                // of images doesn't always pop in from the same corner. This is
                // just the starting default — fully editable from the panel.
                entryDirection: ['left', 'right', 'top', 'bottom'][Math.floor(Math.random() * 4)],
                exitDirection: 'same',
                animationStyle: brollModeSelect && brollModeSelect.value === 'pip' ? 'slide-pop' : 'zoom',
                animationSpeedSec: 0.4, // continuous drag-slider speed (seconds); 0.4 ~= old 'Normal' preset
                soundEffect: 'none',
                // 'cover' fills the whole frame and crops any excess (old default
                // behaviour). 'contain' shows the entire image with letterbox bars
                // when its aspect ratio doesn't match the canvas.
                fitMode: 'cover',
                // true (default) = fully transparent, no PiP backdrop box. false =
                // "Normal" mode keeps the old translucent black backdrop behind PiP
                // images so they stand out against busy footage.
                transparentBg: brollTransparentBg ? brollTransparentBg.checked : true
            };
            state.brollOverlays.push(newItem);
            state.selectedBrollId = newItem.id;
            renderBrollList();
            showBrollTimingFor(newItem.id);
            drawFrame();
            if (window.recordEditorHistory) {
                window.recordEditorHistory('B-roll image added');
            }
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

    function eraseBrollImageColor(item, targetR, targetG, targetB, tolerance) {
        if (!item || !item.originalImageUrl) return;
        
        // Save target colors and tolerance on the B-roll object
        item.bgRemoveColor = { r: targetR, g: targetG, b: targetB };
        item.bgRemoveTolerance = tolerance;
        
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            try {
                const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imgData.data;
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i+1];
                    const b = data[i+2];
                    const rDiff = r - targetR;
                    const gDiff = g - targetG;
                    const bDiff = b - targetB;
                    const dist = Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);
                    if (dist <= tolerance) {
                        data[i+3] = 0; // set alpha to transparent
                    }
                }
                ctx.putImageData(imgData, 0, 0);
                const newUrl = canvas.toDataURL('image/png');
                
                const newImg = new Image();
                newImg.onload = () => {
                    item.imageImg = newImg;
                    item.imageUrl = newUrl;
                    drawFrame();
                    const brollUndoRemoveContainer = document.getElementById('broll-undo-remove-container');
                    if (brollUndoRemoveContainer) brollUndoRemoveContainer.style.display = 'block';
                };
                newImg.src = newUrl;
            } catch (err) {
                console.error("Error removing background color:", err);
            }
        };
        img.src = item.originalImageUrl;
    }

    function loadBrollVideo(file) {
        console.log("Loading B-roll video file:", file.name, "type:", file.type, "size:", file.size);
        const url = URL.createObjectURL(file);
        // A hidden <video> element that we manually play/pause/seek in sync with
        // the main timeline. Muted so autoplay isn't blocked by the browser; the
        // clip's own audio is intentionally NOT included in the export (keeps
        // audio mixing simple/predictable — add music/voiceover separately).
        const vid = document.createElement('video');
        vid.muted = true;
        vid.playsInline = true;
        vid.preload = 'auto';
        vid.style.position = 'absolute';
        vid.style.width = '1px';
        vid.style.height = '1px';
        vid.style.opacity = '0';
        vid.style.pointerEvents = 'none';
        document.body.appendChild(vid);

        vid.onloadedmetadata = () => {
            console.log("B-roll video loaded. Dimensions:", vid.videoWidth, "x", vid.videoHeight, "duration:", vid.duration);
            if (vid.videoWidth === 0 || vid.videoHeight === 0) {
                console.error("Loaded video has zero dimensions.");
                alert("ত্রুটি: ভিডিওটির ডাইমেনশন শূন্য (0)। অনুগ্রহ করে অন্য ভিডিও ফাইল ব্যবহার করুন।");
                vid.remove();
                return;
            }
            // See comment on `imageImg` below: alias naturalWidth/naturalHeight so
            // this <video> is a drop-in replacement everywhere an <img>'s natural
            // dimensions are read.
            Object.defineProperty(vid, 'naturalWidth', { get: () => vid.videoWidth });
            Object.defineProperty(vid, 'naturalHeight', { get: () => vid.videoHeight });
            const newItem = {
                id: brollIdCounter++,
                type: 'video',
                videoEl: vid,
                // Every existing draw / hit-test / animation code path for B-roll
                // reads `item.imageImg` and its `.naturalWidth`/`.naturalHeight`. Rather
                // than touching dozens of call sites, alias a video element to look
                // like an image here — ctx.drawImage() accepts a <video> exactly like
                // an <img>, so this lets a video overlay reuse 100% of the existing
                // cover/contain, PiP sizing, animation, and click/resize hit-testing
                // logic unchanged.
                imageImg: vid,
                videoUrl: url,
                videoDuration: vid.duration || 0,
                file: file,
                name: file.name,
                size: file.size,
                mode: brollModeSelect ? brollModeSelect.value : 'fullscreen',
                size: brollModeSelect && brollModeSelect.value === 'pip'
                    ? (brollSizeSlider ? parseInt(brollSizeSlider.value) : 35)
                    : 100,
                x: 0.05,
                y: 0.6,
                rotation: 0,
                startSec: Math.min(state.endTime || state.duration || 5, state.currentTime || 0),
                // Default display window matches the overlay video's own length
                // (capped at 8s so it doesn't swallow the whole timeline by default).
                endSec: Math.min(state.endTime || state.duration || 5, (state.currentTime || 0) + Math.min(vid.duration || 3, 8)),
                entryDirection: ['left', 'right', 'top', 'bottom'][Math.floor(Math.random() * 4)],
                exitDirection: 'same',
                animationStyle: brollModeSelect && brollModeSelect.value === 'pip' ? 'slide-pop' : 'zoom',
                animationSpeedSec: 0.4,
                soundEffect: 'none',
                // Same cover/contain fit logic as image B-roll — useful when the
                // overlay video's aspect ratio doesn't match the canvas.
                fitMode: 'cover',
                // If the display window is longer than the video's own duration,
                // the video loops from the beginning instead of freezing/going black.
                loopVideo: true,
                // See image B-roll: true (default) = no PiP backdrop box.
                transparentBg: brollTransparentBg ? brollTransparentBg.checked : true
            };
            state.brollOverlays.push(newItem);
            state.selectedBrollId = newItem.id;
            renderBrollList();
            showBrollTimingFor(newItem.id);
            drawFrame();
            if (window.recordEditorHistory) {
                window.recordEditorHistory('B-roll video added');
            }
            console.log("Added Video B-roll overlay:", newItem);
        };

        vid.onerror = (err) => {
            console.error("Failed to load B-roll video:", err);
            alert("ত্রুটি: ভিডিওটি লোড করা যায়নি। অনুগ্রহ করে নিশ্চিত করুন যে এটি একটি সঠিক ভিডিও ফাইল (যেমন MP4 বা WEBM)।");
            vid.remove();
            if (brollVideoInput) brollVideoInput.value = '';
        };

        vid.src = url;
        vid.load();
        if (brollVideoInput) brollVideoInput.value = '';
    }

    if (addBrollTextBtn) {
        addBrollTextBtn.addEventListener('click', () => {
            const rawText = brollTextInput.value.trim();
            if (!rawText) return;

            // Prepend the chosen bullet character (e.g. •, ✔, ➤) so this reads as
            // one line in a bulleted list. Handy for the "line by line, stacked
            // list" effect: add several Text B-rolls, each with the same bullet,
            // positioned on separate lines with overlapping Show From/Until times.
            const bulletChar = brollBulletSelect && brollBulletSelect.value !== 'none' ? brollBulletSelect.value : '';
            const text = bulletChar ? `${bulletChar} ${rawText}` : rawText;

            const newItem = {
                id: brollIdCounter++,
                type: 'text',
                text: text,
                fontSize: brollTextFontsizeSlider ? parseInt(brollTextFontsizeSlider.value) : 48,
                color: brollTextColorInput ? brollTextColorInput.value : '#ffffff',
                bgEnabled: brollTextBgEnabled ? brollTextBgEnabled.checked : false,
                bgColor: brollTextBgColor ? brollTextBgColor.value : '#0f172a',
                solidHighlight: brollTextHighlightEnabled ? brollTextHighlightEnabled.checked : false,
                highlightColor: brollTextHighlightColor ? brollTextHighlightColor.value : '#ffe600',
                mode: brollModeSelect ? brollModeSelect.value : 'fullscreen',
                size: brollSizeSlider ? parseInt(brollSizeSlider.value) : 35,
                x: 0.5,
                y: 0.5,
                rotation: 0, // manual tilt angle in degrees, set via the rotate handle
                startSec: Math.min(state.endTime || state.duration || 5, state.currentTime || 0),
                endSec: Math.min(state.endTime || state.duration || 5, (state.currentTime || 0) + 3),
                entryDirection: ['left', 'right', 'top', 'bottom'][Math.floor(Math.random() * 4)],
                exitDirection: 'same',
                animationStyle: brollModeSelect && brollModeSelect.value === 'pip' ? 'slide-pop' : 'zoom',
                animationSpeedSec: 0.4, // continuous drag-slider speed (seconds); 0.4 ~= old 'Normal' preset
                soundEffect: 'none',
                // true (default) = plain text, no legibility outline. false =
                // "Normal" mode keeps the old black stroke outline around
                // fullscreen text so it reads clearly over busy footage.
                transparentBg: brollTransparentBg ? brollTransparentBg.checked : true
            };
            state.brollOverlays.push(newItem);
            state.selectedBrollId = newItem.id;
            brollTextInput.value = '';
            renderBrollList();
            showBrollTimingFor(newItem.id);
            drawFrame();
            if (window.recordEditorHistory) {
                window.recordEditorHistory('B-roll text added');
            }
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
            } else if (item.type === 'video') {
                label.innerText = `🎬 ${modeLabel} Video B-roll`;
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
        // Older items saved before this toggle existed have no transparentBg
        // property at all — treat that as "transparent" (the new default) so
        // existing PNGs/text immediately lose their black backdrop too.
        if (brollTransparentBg) brollTransparentBg.checked = item.transparentBg !== false;
        if (brollSizeContainer) brollSizeContainer.style.display = 'block'; // always visible

        // Fit Mode only makes sense for a fullscreen IMAGE (Text B-roll has no
        // aspect-ratio mismatch problem, and PiP images are always shown "contain"
        // inside their own small box already).
        if (brollFitContainer) {
            brollFitContainer.style.display = (item.mode === 'fullscreen' && (item.type === 'image' || item.type === 'video')) ? 'block' : 'none';
        }
        if (brollFitSelect) brollFitSelect.value = item.fitMode || 'cover';

        // Sync the Text Settings edit panel (content/size/color/blank-background)
        if (brollEditTextSection) {
            if (item.type === 'text') {
                brollEditTextSection.style.display = 'block';
                if (brollEditTextInput) brollEditTextInput.value = item.text || '';
                if (brollEditTextFontsize) {
                    brollEditTextFontsize.value = item.fontSize || 48;
                    if (brollEditTextFontsizeVal) brollEditTextFontsizeVal.innerText = (item.fontSize || 48) + 'px';
                }
                if (brollEditTextColor) {
                    brollEditTextColor.value = item.color || '#ffffff';
                    if (brollEditTextColorVal) brollEditTextColorVal.innerText = item.color || '#ffffff';
                }
                if (brollEditTextBgEnabled) brollEditTextBgEnabled.checked = !!item.bgEnabled;
                if (brollEditTextBgColorRow) brollEditTextBgColorRow.style.display = item.bgEnabled ? 'flex' : 'none';
                if (brollEditTextBgColor) {
                    brollEditTextBgColor.value = item.bgColor || '#0f172a';
                    if (brollEditTextBgColorVal) brollEditTextBgColorVal.innerText = item.bgColor || '#0f172a';
                }
                if (brollEditTextHighlightEnabled) brollEditTextHighlightEnabled.checked = !!item.solidHighlight;
                if (brollEditTextHighlightColorRow) brollEditTextHighlightColorRow.style.display = item.solidHighlight ? 'flex' : 'none';
                if (brollEditTextHighlightColor) {
                    brollEditTextHighlightColor.value = item.highlightColor || '#ffe600';
                    if (brollEditTextHighlightColorVal) brollEditTextHighlightColorVal.innerText = item.highlightColor || '#ffe600';
                }
            } else {
                brollEditTextSection.style.display = 'none';
            }
        }
        
        const brollEditImageSection = document.getElementById('broll-edit-image-section');
        const brollUndoRemoveContainer = document.getElementById('broll-undo-remove-container');
        const brollRemoveTolerance = document.getElementById('broll-remove-tolerance');
        const brollRemoveToleranceVal = document.getElementById('broll-remove-tolerance-val');
        
        if (brollEditImageSection) {
            if (item.type === 'image') {
                brollEditImageSection.style.display = 'block';
                if (brollUndoRemoveContainer) {
                    brollUndoRemoveContainer.style.display = item.bgRemoveColor ? 'block' : 'none';
                }
                if (brollRemoveTolerance) {
                    const tol = item.bgRemoveTolerance !== undefined ? item.bgRemoveTolerance : 30;
                    brollRemoveTolerance.value = tol;
                    if (brollRemoveToleranceVal) brollRemoveToleranceVal.innerText = tol;
                }
            } else {
                brollEditImageSection.style.display = 'none';
            }
        }
        if (brollSizeSlider) {
            brollSizeSlider.max = item.mode === 'pip' ? 60 : 100;
            brollSizeSlider.value = item.size !== undefined ? item.size : (item.mode === 'pip' ? 35 : 100);
            if (brollSizeVal) brollSizeVal.innerText = (item.size !== undefined ? item.size : (item.mode === 'pip' ? 35 : 100)) + '%';
        }

        // Sync the animation/direction/speed/sound controls to this item
        populateBrollAnimStyleOptions(item.type);
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
        if (brollCustomSoundContainer) {
            brollCustomSoundContainer.style.display = (item.soundEffect === 'custom') ? 'block' : 'none';
        }
        if (brollCustomSoundFilename) {
            brollCustomSoundFilename.innerText = item.customSoundName
                ? `আপলোড করা হয়েছে: ${item.customSoundName}`
                : 'কোনো ফাইল আপলোড করা হয়নি।';
        }
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
                if (brollCustomSoundContainer) {
                    brollCustomSoundContainer.style.display = (item.soundEffect === 'custom') ? 'block' : 'none';
                }
                // Let the person hear a quick preview of the chosen sound immediately
                if (item.soundEffect === 'custom') {
                    if (item.customSoundBuffer && window.playBrollCustomSound) window.playBrollCustomSound(item.customSoundBuffer);
                } else if (item.soundEffect !== 'none' && window.playBrollSfx) {
                    window.playBrollSfx(item.soundEffect);
                }
            }
        });
    }

    if (brollCustomSoundInput) {
        brollCustomSoundInput.addEventListener('change', async (e) => {
            const item = state.brollOverlays.find(b => b.id === state.selectedBrollId);
            const file = e.target.files && e.target.files[0];
            if (!item || !file) return;
            if (brollCustomSoundFilename) brollCustomSoundFilename.innerText = `লোড হচ্ছে: ${file.name}...`;
            item.customSoundFile = file;
            item.customSoundName = file.name;
            item.customSoundBuffer = window.decodeBrollCustomSound ? await window.decodeBrollCustomSound(file) : null;
            if (brollCustomSoundFilename) {
                brollCustomSoundFilename.innerText = item.customSoundBuffer
                    ? `আপলোড করা হয়েছে: ${item.customSoundName}`
                    : `ত্রুটি: "${file.name}" ফাইলটি ডিকোড করা যায়নি। অন্য mp3/wav ফাইল ব্যবহার করুন।`;
            }
            if (item.customSoundBuffer && window.playBrollCustomSound) window.playBrollCustomSound(item.customSoundBuffer);
        });
    }

    if (brollFitSelect) {
        brollFitSelect.addEventListener('change', (e) => {
            const item = state.brollOverlays.find(b => b.id === state.selectedBrollId);
            if (item) {
                item.fitMode = e.target.value;
                drawFrame();
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

    // "Use current playhead time" buttons for the Show From / Show Until
    // fields -- reuses the existing input listeners above (clamping,
    // item.startSec/endSec assignment, renderBrollList) by just writing the
    // value and dispatching a real 'input' event, instead of duplicating
    // that logic here.
    const brollStartFromPlayheadBtn = document.getElementById('broll-start-from-playhead');
    const brollEndFromPlayheadBtn = document.getElementById('broll-end-from-playhead');

    function setBrollTimeFromPlayhead(inputEl) {
        if (!inputEl) return;
        const current = (state.currentTime || 0).toFixed(1);
        inputEl.value = current;
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    }

    if (brollStartFromPlayheadBtn) {
        brollStartFromPlayheadBtn.addEventListener('click', () => setBrollTimeFromPlayhead(brollStartInput));
    }
    if (brollEndFromPlayheadBtn) {
        brollEndFromPlayheadBtn.addEventListener('click', () => setBrollTimeFromPlayhead(brollEndInput));
    }

    if (brollModeSelect) {
        brollModeSelect.addEventListener('change', (e) => {
            const item = state.brollOverlays.find(b => b.id === state.selectedBrollId);
            if (item) {
                item.mode = e.target.value;
                if (brollSizeContainer) brollSizeContainer.style.display = 'block'; // always visible
                if (brollFitContainer) {
                    brollFitContainer.style.display = (item.mode === 'fullscreen' && (item.type === 'image' || item.type === 'video')) ? 'block' : 'none';
                }
                if (brollFitSelect) brollFitSelect.value = item.fitMode || 'cover';
                if (brollSizeSlider) {
                    brollSizeSlider.max = item.mode === 'pip' ? 60 : 100;
                    // When switching to fullscreen, reset to 100% so it covers fully by default
                    if (item.mode === 'fullscreen') {
                        item.size = 100;
                        item._fsPosSet = false;
                        brollSizeSlider.value = 100;
                        if (brollSizeVal) brollSizeVal.innerText = '100%';
                    }
                }
                // All animation styles now work in either mode, but we still switch to
                // that mode's more natural-feeling default when toggling, so it doesn't
                // suddenly look like nothing changed.
                item.animationStyle = item.mode === 'pip' ? 'slide-pop' : 'zoom';
                populateBrollAnimStyleOptions(item.type);
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

    if (brollTransparentBg) {
        brollTransparentBg.addEventListener('change', (e) => {
            const item = state.brollOverlays.find(b => b.id === state.selectedBrollId);
            if (item) {
                item.transparentBg = e.target.checked;
                drawFrame();
            }
        });
    }

    if (deleteBrollBtn) {
        deleteBrollBtn.addEventListener('click', () => {
            const removed = state.brollOverlays.find(b => b.id === state.selectedBrollId);
            if (removed && removed.imageUrl) URL.revokeObjectURL(removed.imageUrl);
            if (removed && removed.type === 'video') {
                if (removed.videoUrl) URL.revokeObjectURL(removed.videoUrl);
                if (removed.videoEl) {
                    removed.videoEl.pause();
                    removed.videoEl.src = '';
                    removed.videoEl.remove();
                }
            }
            state.brollOverlays = state.brollOverlays.filter(b => b.id !== state.selectedBrollId);
            state.selectedBrollId = null;
            renderBrollList();
            if (brollTimingContainer) brollTimingContainer.style.display = 'none';
            drawFrame();
            if (window.recordEditorHistory) {
                window.recordEditorHistory('B-roll removed');
            }
        });
    }

    // --- B-roll Image Background Remover Bindings ---
    const brollAutoRemoveBtn = document.getElementById('broll-auto-remove-btn');
    const brollPickCanvasBtn = document.getElementById('broll-pick-canvas-btn');
    const brollRemoveWhiteBtn = document.getElementById('broll-remove-white-btn');
    const brollRemoveBlackBtn = document.getElementById('broll-remove-black-btn');
    const brollRemoveCustomBtn = document.getElementById('broll-remove-custom-btn');
    const brollRemoveCustomColor = document.getElementById('broll-remove-custom-color');
    const brollRemoveTolerance = document.getElementById('broll-remove-tolerance');
    const brollRemoveToleranceVal = document.getElementById('broll-remove-tolerance-val');
    const brollRestoreOriginalBtn = document.getElementById('broll-restore-original-btn');
    const brollUndoRemoveContainer = document.getElementById('broll-undo-remove-container');

    if (brollAutoRemoveBtn) {
        brollAutoRemoveBtn.addEventListener('click', () => {
            const item = state.brollOverlays.find(b => b.id === state.selectedBrollId);
            if (item && item.type === 'image' && item.originalImageUrl) {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    try {
                        const imgData = ctx.getImageData(0, 0, 1, 1);
                        const r = imgData.data[0];
                        const g = imgData.data[1];
                        const b = imgData.data[2];
                        const tol = brollRemoveTolerance ? parseInt(brollRemoveTolerance.value) : 30;
                        item.bgRemoveColor = { r, g, b };
                        if (brollRemoveCustomColor) {
                            const hex = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
                            brollRemoveCustomColor.value = hex;
                        }
                        eraseBrollImageColor(item, r, g, b, tol);
                    } catch (err) {
                        console.error("Auto background removal error:", err);
                    }
                };
                img.src = item.originalImageUrl;
            }
        });
    }

    if (brollPickCanvasBtn) {
        brollPickCanvasBtn.addEventListener('click', () => {
            state.isColorPickingBroll = !state.isColorPickingBroll;
            if (state.isColorPickingBroll) {
                state.canvas.style.cursor = 'crosshair';
                alert("ক্যানভাসে দেখানো বি-রোল ইমেজের উপর ক্লিক করে ব্যাকগ্রাউন্ডের সঠিক রঙটি সিলেক্ট করুন। (Click on the B-roll image on the canvas to pick its background color.)");
            } else {
                state.canvas.style.cursor = 'default';
            }
        });
    }

    if (brollRemoveTolerance) {
        brollRemoveTolerance.addEventListener('input', (e) => {
            if (brollRemoveToleranceVal) brollRemoveToleranceVal.innerText = e.target.value;
            const item = state.brollOverlays.find(b => b.id === state.selectedBrollId);
            if (item && item.type === 'image' && item.bgRemoveColor) {
                eraseBrollImageColor(item, item.bgRemoveColor.r, item.bgRemoveColor.g, item.bgRemoveColor.b, parseInt(e.target.value));
            }
        });
    }

    if (brollRemoveWhiteBtn) {
        brollRemoveWhiteBtn.addEventListener('click', () => {
            const item = state.brollOverlays.find(b => b.id === state.selectedBrollId);
            if (item && item.type === 'image') {
                const tol = brollRemoveTolerance ? parseInt(brollRemoveTolerance.value) : 30;
                eraseBrollImageColor(item, 255, 255, 255, tol);
            }
        });
    }

    if (brollRemoveBlackBtn) {
        brollRemoveBlackBtn.addEventListener('click', () => {
            const item = state.brollOverlays.find(b => b.id === state.selectedBrollId);
            if (item && item.type === 'image') {
                const tol = brollRemoveTolerance ? parseInt(brollRemoveTolerance.value) : 30;
                eraseBrollImageColor(item, 0, 0, 0, tol);
            }
        });
    }

    if (brollRemoveCustomBtn) {
        brollRemoveCustomBtn.addEventListener('click', () => {
            const item = state.brollOverlays.find(b => b.id === state.selectedBrollId);
            if (item && item.type === 'image' && brollRemoveCustomColor) {
                const hex = brollRemoveCustomColor.value;
                const r = parseInt(hex.slice(1, 3), 16);
                const g = parseInt(hex.slice(3, 5), 16);
                const b = parseInt(hex.slice(5, 7), 16);
                const tol = brollRemoveTolerance ? parseInt(brollRemoveTolerance.value) : 30;
                eraseBrollImageColor(item, r, g, b, tol);
            }
        });
    }

    if (brollRestoreOriginalBtn) {
        brollRestoreOriginalBtn.addEventListener('click', () => {
            const item = state.brollOverlays.find(b => b.id === state.selectedBrollId);
            if (item && item.type === 'image' && item.originalImageUrl) {
                item.imageUrl = item.originalImageUrl;
                item.bgRemoveColor = null;
                item.bgRemoveTolerance = undefined;
                const origImg = new Image();
                origImg.onload = () => {
                    item.imageImg = origImg;
                    drawFrame();
                    if (brollUndoRemoveContainer) brollUndoRemoveContainer.style.display = 'none';
                };
                origImg.src = item.originalImageUrl;
            }
        });
    }

    window.onBrollSelected = function(id) {
        renderBrollList();
        showBrollTimingFor(id);
    };

    // --- Sticker / Emoji Overlay Bindings (Phase 4A) ---
    const emojiGrid = document.getElementById('emoji-grid');
    const stickerListEl = document.getElementById('sticker-list');
    const stickerControlsContainer = document.getElementById('sticker-controls-container');
    const stickerSizeSlider = document.getElementById('sticker-size-slider');
    const stickerSizeVal = document.getElementById('sticker-size-val');
    const deleteStickerBtn = document.getElementById('delete-sticker-btn');

    let stickerIdCounter = 1;

    function addSticker(emoji) {
        const newItem = {
            id: stickerIdCounter++,
            emoji: emoji,
            x: 0.5,
            y: 0.5,
            size: 12 // percent of canvas width
        };
        state.stickers.push(newItem);
        state.selectedStickerId = newItem.id;

        renderStickerList();
        showStickerControlsFor(newItem.id);
        drawFrame();
    }

    if (emojiGrid) {
        emojiGrid.querySelectorAll('.emoji-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const emoji = btn.getAttribute('data-emoji');
                if (emoji) addSticker(emoji);
            });
        });
    }

    function renderStickerList() {
        if (!stickerListEl) return;
        stickerListEl.innerHTML = '';
        state.stickers.forEach((item) => {
            const row = document.createElement('div');
            row.className = 'sticker-list-item' + (item.id === state.selectedStickerId ? ' active' : '');
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.justifyContent = 'space-between';
            row.style.padding = '8px 12px';
            row.style.borderRadius = '6px';
            row.style.marginBottom = '6px';
            row.style.cursor = 'pointer';
            row.style.background = item.id === state.selectedStickerId ? 'rgba(79, 70, 229, 0.12)' : 'rgba(255,255,255,0.04)';
            row.style.border = item.id === state.selectedStickerId ? '1px solid var(--primary)' : '1px solid transparent';

            const label = document.createElement('span');
            label.innerText = item.emoji;
            label.style.fontSize = '20px';

            const sizeLabel = document.createElement('span');
            sizeLabel.innerText = Math.round(item.size) + '%';
            sizeLabel.style.fontSize = '11px';
            sizeLabel.style.opacity = '0.6';

            row.appendChild(label);
            row.appendChild(sizeLabel);

            row.addEventListener('click', () => {
                state.selectedStickerId = item.id;
                renderStickerList();
                showStickerControlsFor(item.id);
                drawFrame();
            });

            stickerListEl.appendChild(row);
        });
    }

    function showStickerControlsFor(id) {
        const item = state.stickers.find(s => s.id === id);
        if (!item) {
            if (stickerControlsContainer) stickerControlsContainer.style.display = 'none';
            return;
        }
        if (stickerControlsContainer) stickerControlsContainer.style.display = 'block';
        if (stickerSizeSlider) stickerSizeSlider.value = Math.round(item.size);
        if (stickerSizeVal) stickerSizeVal.innerText = Math.round(item.size) + '%';
    }

    if (stickerSizeSlider) {
        stickerSizeSlider.addEventListener('input', (e) => {
            const item = state.stickers.find(s => s.id === state.selectedStickerId);
            if (item) {
                item.size = parseInt(e.target.value);
                if (stickerSizeVal) stickerSizeVal.innerText = item.size + '%';
                renderStickerList();
                drawFrame();
            }
        });
    }

    if (deleteStickerBtn) {
        deleteStickerBtn.addEventListener('click', () => {
            state.stickers = state.stickers.filter(s => s.id !== state.selectedStickerId);
            state.selectedStickerId = null;
            renderStickerList();
            showStickerControlsFor(null);
            drawFrame();
        });
    }

    // Allows canvas-click selection (from handlePointerDown) to sync the side-panel list & controls
    window.onStickerSelected = function(id) {
        renderStickerList();
        showStickerControlsFor(id);
    };

    // --- Symbol / Shape Overlay Bindings (arrow, cross, tick, question mark, etc.) ---
    const symbolGrid = document.getElementById('symbol-grid');
    const symbolListEl = document.getElementById('symbol-list');
    const symbolControlsContainer = document.getElementById('symbol-controls-container');
    const symbolSizeSlider = document.getElementById('symbol-size-slider');
    const symbolSizeVal = document.getElementById('symbol-size-val');
    const symbolColorInput = document.getElementById('symbol-color');
    const symbolColorVal = document.getElementById('symbol-color-val');
    const symbolStartInput = document.getElementById('symbol-start');
    const symbolEndInput = document.getElementById('symbol-end');
    const deleteSymbolBtn = document.getElementById('delete-symbol-btn');

    // Small glyph shown per symbol type in the palette + the added-items list.
    const SYMBOL_LABELS = {
        arrow: '→',
        cross: '✕',
        tick: '✓',
        question: '?',
        exclaim: '!',
        star: '★',
        circle: '○',
        triangle: '△'
    };
    const SYMBOL_NAMES_BN = {
        arrow: 'তীর চিহ্ন',
        cross: 'ক্রস চিহ্ন',
        tick: 'টিক চিহ্ন',
        question: 'কুয়েশ্চন মার্ক',
        exclaim: 'এক্সক্লামেশন',
        star: 'তারা',
        circle: 'বৃত্ত',
        triangle: 'ত্রিভুজ'
    };

    let symbolIdCounter = 1;

    function addSymbol(type) {
        const start = Math.max(0, state.currentTime || 0);
        const end = Math.min(state.duration || (start + 3), start + 3);
        const newItem = {
            id: symbolIdCounter++,
            symbolType: type,
            x: 0.5,
            y: 0.5,
            size: 15, // percent of canvas width
            rotation: 0,
            color: '#ff3b30',
            startSec: start,
            endSec: end > start ? end : start + 3
        };
        state.symbolOverlays.push(newItem);
        state.selectedSymbolId = newItem.id;

        renderSymbolList();
        showSymbolControlsFor(newItem.id);
        drawFrame();
    }

    if (symbolGrid) {
        symbolGrid.querySelectorAll('.symbol-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const type = btn.getAttribute('data-symbol');
                if (type) addSymbol(type);
            });
        });
    }

    function renderSymbolList() {
        if (!symbolListEl) return;
        symbolListEl.innerHTML = '';
        state.symbolOverlays.forEach((item) => {
            const row = document.createElement('div');
            row.className = 'sticker-list-item' + (item.id === state.selectedSymbolId ? ' active' : '');
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.justifyContent = 'space-between';
            row.style.padding = '8px 12px';
            row.style.borderRadius = '6px';
            row.style.marginBottom = '6px';
            row.style.cursor = 'pointer';
            row.style.background = item.id === state.selectedSymbolId ? 'rgba(79, 70, 229, 0.12)' : 'rgba(255,255,255,0.04)';
            row.style.border = item.id === state.selectedSymbolId ? '1px solid var(--primary)' : '1px solid transparent';

            const label = document.createElement('span');
            label.innerText = (SYMBOL_LABELS[item.symbolType] || '●') + '  ' + (SYMBOL_NAMES_BN[item.symbolType] || item.symbolType);
            label.style.fontSize = '13px';
            label.style.color = item.color;

            const timeLabel = document.createElement('span');
            timeLabel.innerText = `${item.startSec.toFixed(1)}s–${item.endSec.toFixed(1)}s`;
            timeLabel.style.fontSize = '11px';
            timeLabel.style.opacity = '0.6';

            row.appendChild(label);
            row.appendChild(timeLabel);

            row.addEventListener('click', () => {
                state.selectedSymbolId = item.id;
                renderSymbolList();
                showSymbolControlsFor(item.id);
                drawFrame();
            });

            symbolListEl.appendChild(row);
        });
    }

    function showSymbolControlsFor(id) {
        const item = state.symbolOverlays.find(s => s.id === id);
        if (!item) {
            if (symbolControlsContainer) symbolControlsContainer.style.display = 'none';
            return;
        }
        if (symbolControlsContainer) symbolControlsContainer.style.display = 'block';
        if (symbolSizeSlider) symbolSizeSlider.value = Math.round(item.size);
        if (symbolSizeVal) symbolSizeVal.innerText = Math.round(item.size) + '%';
        if (symbolColorInput) symbolColorInput.value = item.color;
        if (symbolColorVal) symbolColorVal.innerText = item.color;
        if (symbolStartInput) symbolStartInput.value = item.startSec.toFixed(1);
        if (symbolEndInput) symbolEndInput.value = item.endSec.toFixed(1);
    }

    if (symbolSizeSlider) {
        symbolSizeSlider.addEventListener('input', (e) => {
            const item = state.symbolOverlays.find(s => s.id === state.selectedSymbolId);
            if (item) {
                item.size = parseFloat(e.target.value);
                if (symbolSizeVal) symbolSizeVal.innerText = Math.round(item.size) + '%';
                drawFrame();
            }
        });
    }

    if (symbolColorInput) {
        symbolColorInput.addEventListener('input', (e) => {
            const item = state.symbolOverlays.find(s => s.id === state.selectedSymbolId);
            if (item) {
                item.color = e.target.value;
                if (symbolColorVal) symbolColorVal.innerText = item.color;
                renderSymbolList();
                drawFrame();
            }
        });
    }

    if (symbolStartInput) {
        symbolStartInput.addEventListener('change', (e) => {
            const item = state.symbolOverlays.find(s => s.id === state.selectedSymbolId);
            if (item) {
                let v = Math.max(0, parseFloat(e.target.value) || 0);
                if (v >= item.endSec) v = Math.max(0, item.endSec - 0.1);
                item.startSec = v;
                e.target.value = v.toFixed(1);
                renderSymbolList();
                drawFrame();
            }
        });
    }

    if (symbolEndInput) {
        symbolEndInput.addEventListener('change', (e) => {
            const item = state.symbolOverlays.find(s => s.id === state.selectedSymbolId);
            if (item) {
                let v = parseFloat(e.target.value) || (item.startSec + 1);
                if (state.duration) v = Math.min(v, state.duration);
                if (v <= item.startSec) v = item.startSec + 0.1;
                item.endSec = v;
                e.target.value = v.toFixed(1);
                renderSymbolList();
                drawFrame();
            }
        });
    }

    if (deleteSymbolBtn) {
        deleteSymbolBtn.addEventListener('click', () => {
            state.symbolOverlays = state.symbolOverlays.filter(s => s.id !== state.selectedSymbolId);
            state.selectedSymbolId = null;
            renderSymbolList();
            showSymbolControlsFor(null);
            drawFrame();
        });
    }

    // Allows canvas-click selection (from handlePointerDown) to sync the side-panel list & controls
    window.onSymbolSelected = function(id) {
        renderSymbolList();
        showSymbolControlsFor(id);
    };

    // --- Shape + Text Overlay Bindings (ribbon banner, wavy banner, thought
    // cloud, 6-point star, oval callout — Word-style shapes with editable text) ---
    const shapeOverlayGrid = document.getElementById('shape-overlay-grid');
    const shapeOverlayListEl = document.getElementById('shape-overlay-list');
    const shapeOverlayControlsContainer = document.getElementById('shape-overlay-controls-container');
    const shapeOverlayTextInput = document.getElementById('shape-overlay-text');
    const shapeOverlayFillColorInput = document.getElementById('shape-overlay-fill-color');
    const shapeOverlayFillColorVal = document.getElementById('shape-overlay-fill-color-val');
    const shapeOverlayTextColorInput = document.getElementById('shape-overlay-text-color');
    const shapeOverlayTextColorVal = document.getElementById('shape-overlay-text-color-val');
    const shapeOverlayFontSizeSlider = document.getElementById('shape-overlay-fontsize-slider');
    const shapeOverlayFontSizeVal = document.getElementById('shape-overlay-fontsize-val');
    const shapeOverlaySizeSlider = document.getElementById('shape-overlay-size-slider');
    const shapeOverlaySizeVal = document.getElementById('shape-overlay-size-val');
    const shapeOverlayStartInput = document.getElementById('shape-overlay-start');
    const shapeOverlayEndInput = document.getElementById('shape-overlay-end');
    const deleteShapeOverlayBtn = document.getElementById('delete-shape-overlay-btn');

    const SHAPE_OVERLAY_LABELS = {
        ribbon: '▤',
        wave: '≈',
        cloud: '☁',
        star6: '✶',
        oval: '⬭'
    };
    const SHAPE_OVERLAY_NAMES_BN = {
        ribbon: 'রিবন ব্যানার',
        wave: 'ওয়েভি ব্যানার',
        cloud: 'থট ক্লাউড',
        star6: '৬-পয়েন্ট তারা',
        oval: 'ওভাল ক্যালাউট'
    };

    let shapeOverlayIdCounter = 1;

    function addShapeOverlay(type) {
        const start = Math.max(0, state.currentTime || 0);
        const end = Math.min(state.duration || (start + 3), start + 3);
        const newItem = {
            id: shapeOverlayIdCounter++,
            shapeType: type,
            text: 'আপনার টেক্সট',
            x: 0.5,
            y: 0.5,
            size: 32, // percent of canvas width
            rotation: 0,
            fillColor: '#4f46e5',
            textColor: '#ffffff',
            fontSize: 28,
            font: 'Hind Siliguri',
            startSec: start,
            endSec: end > start ? end : start + 3
        };
        state.shapeOverlays.push(newItem);
        state.selectedShapeOverlayId = newItem.id;

        renderShapeOverlayList();
        showShapeOverlayControlsFor(newItem.id);
        drawFrame();
    }

    if (shapeOverlayGrid) {
        shapeOverlayGrid.querySelectorAll('.symbol-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const type = btn.getAttribute('data-shape-overlay');
                if (type) addShapeOverlay(type);
            });
        });
    }

    function renderShapeOverlayList() {
        if (!shapeOverlayListEl) return;
        shapeOverlayListEl.innerHTML = '';
        state.shapeOverlays.forEach((item) => {
            const row = document.createElement('div');
            row.className = 'sticker-list-item' + (item.id === state.selectedShapeOverlayId ? ' active' : '');
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.justifyContent = 'space-between';
            row.style.padding = '8px 12px';
            row.style.borderRadius = '6px';
            row.style.marginBottom = '6px';
            row.style.cursor = 'pointer';
            row.style.background = item.id === state.selectedShapeOverlayId ? 'rgba(79, 70, 229, 0.12)' : 'rgba(255,255,255,0.04)';
            row.style.border = item.id === state.selectedShapeOverlayId ? '1px solid var(--primary)' : '1px solid transparent';

            const label = document.createElement('span');
            const shortText = (item.text || '').slice(0, 14) + ((item.text || '').length > 14 ? '…' : '');
            label.innerText = (SHAPE_OVERLAY_LABELS[item.shapeType] || '▭') + '  ' + shortText;
            label.style.fontSize = '13px';

            const timeLabel = document.createElement('span');
            timeLabel.innerText = `${item.startSec.toFixed(1)}s–${item.endSec.toFixed(1)}s`;
            timeLabel.style.fontSize = '11px';
            timeLabel.style.opacity = '0.6';

            row.appendChild(label);
            row.appendChild(timeLabel);

            row.addEventListener('click', () => {
                state.selectedShapeOverlayId = item.id;
                renderShapeOverlayList();
                showShapeOverlayControlsFor(item.id);
                drawFrame();
            });

            shapeOverlayListEl.appendChild(row);
        });
    }

    function showShapeOverlayControlsFor(id) {
        const item = state.shapeOverlays.find(s => s.id === id);
        if (!item) {
            if (shapeOverlayControlsContainer) shapeOverlayControlsContainer.style.display = 'none';
            return;
        }
        if (shapeOverlayControlsContainer) shapeOverlayControlsContainer.style.display = 'block';
        if (shapeOverlayTextInput) shapeOverlayTextInput.value = item.text;
        if (shapeOverlayFillColorInput) shapeOverlayFillColorInput.value = item.fillColor;
        if (shapeOverlayFillColorVal) shapeOverlayFillColorVal.innerText = item.fillColor;
        if (shapeOverlayTextColorInput) shapeOverlayTextColorInput.value = item.textColor;
        if (shapeOverlayTextColorVal) shapeOverlayTextColorVal.innerText = item.textColor;
        if (shapeOverlayFontSizeSlider) shapeOverlayFontSizeSlider.value = item.fontSize;
        if (shapeOverlayFontSizeVal) shapeOverlayFontSizeVal.innerText = item.fontSize + 'px';
        if (shapeOverlaySizeSlider) shapeOverlaySizeSlider.value = Math.round(item.size);
        if (shapeOverlaySizeVal) shapeOverlaySizeVal.innerText = Math.round(item.size) + '%';
        if (shapeOverlayStartInput) shapeOverlayStartInput.value = item.startSec.toFixed(1);
        if (shapeOverlayEndInput) shapeOverlayEndInput.value = item.endSec.toFixed(1);
    }

    if (shapeOverlayTextInput) {
        shapeOverlayTextInput.addEventListener('input', (e) => {
            const item = state.shapeOverlays.find(s => s.id === state.selectedShapeOverlayId);
            if (item) {
                item.text = e.target.value;
                renderShapeOverlayList();
                drawFrame();
            }
        });
    }

    if (shapeOverlayFillColorInput) {
        shapeOverlayFillColorInput.addEventListener('input', (e) => {
            const item = state.shapeOverlays.find(s => s.id === state.selectedShapeOverlayId);
            if (item) {
                item.fillColor = e.target.value;
                if (shapeOverlayFillColorVal) shapeOverlayFillColorVal.innerText = item.fillColor;
                drawFrame();
            }
        });
    }

    if (shapeOverlayTextColorInput) {
        shapeOverlayTextColorInput.addEventListener('input', (e) => {
            const item = state.shapeOverlays.find(s => s.id === state.selectedShapeOverlayId);
            if (item) {
                item.textColor = e.target.value;
                if (shapeOverlayTextColorVal) shapeOverlayTextColorVal.innerText = item.textColor;
                drawFrame();
            }
        });
    }

    if (shapeOverlayFontSizeSlider) {
        shapeOverlayFontSizeSlider.addEventListener('input', (e) => {
            const item = state.shapeOverlays.find(s => s.id === state.selectedShapeOverlayId);
            if (item) {
                item.fontSize = parseInt(e.target.value);
                if (shapeOverlayFontSizeVal) shapeOverlayFontSizeVal.innerText = item.fontSize + 'px';
                drawFrame();
            }
        });
    }

    if (shapeOverlaySizeSlider) {
        shapeOverlaySizeSlider.addEventListener('input', (e) => {
            const item = state.shapeOverlays.find(s => s.id === state.selectedShapeOverlayId);
            if (item) {
                item.size = parseFloat(e.target.value);
                if (shapeOverlaySizeVal) shapeOverlaySizeVal.innerText = Math.round(item.size) + '%';
                drawFrame();
            }
        });
    }

    if (shapeOverlayStartInput) {
        shapeOverlayStartInput.addEventListener('change', (e) => {
            const item = state.shapeOverlays.find(s => s.id === state.selectedShapeOverlayId);
            if (item) {
                let v = Math.max(0, parseFloat(e.target.value) || 0);
                if (v >= item.endSec) v = Math.max(0, item.endSec - 0.1);
                item.startSec = v;
                e.target.value = v.toFixed(1);
                renderShapeOverlayList();
                drawFrame();
            }
        });
    }

    if (shapeOverlayEndInput) {
        shapeOverlayEndInput.addEventListener('change', (e) => {
            const item = state.shapeOverlays.find(s => s.id === state.selectedShapeOverlayId);
            if (item) {
                let v = parseFloat(e.target.value) || (item.startSec + 1);
                if (state.duration) v = Math.min(v, state.duration);
                if (v <= item.startSec) v = item.startSec + 0.1;
                item.endSec = v;
                e.target.value = v.toFixed(1);
                renderShapeOverlayList();
                drawFrame();
            }
        });
    }

    if (deleteShapeOverlayBtn) {
        deleteShapeOverlayBtn.addEventListener('click', () => {
            state.shapeOverlays = state.shapeOverlays.filter(s => s.id !== state.selectedShapeOverlayId);
            state.selectedShapeOverlayId = null;
            renderShapeOverlayList();
            showShapeOverlayControlsFor(null);
            drawFrame();
        });
    }

    // Allows canvas-click selection (from handlePointerDown) to sync the side-panel list & controls
    window.onShapeOverlaySelected = function(id) {
        renderShapeOverlayList();
        showShapeOverlayControlsFor(id);
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

    // --- Intro / Outro Templates (Phase 5C) ---
    const introEnabledToggle = document.getElementById('intro-enabled-toggle');
    const introControlsBox = document.getElementById('intro-controls-box');
    const introTemplateSelect = document.getElementById('intro-template-select');
    const introTitleInput = document.getElementById('intro-title-input');
    const introSubtitleInput = document.getElementById('intro-subtitle-input');
    const introDurationSlider = document.getElementById('intro-duration-slider');
    const introDurationVal = document.getElementById('intro-duration-val');
    const introPreviewBtn = document.getElementById('intro-preview-btn');

    if (introEnabledToggle) {
        introEnabledToggle.addEventListener('change', () => {
            state.introEnabled = introEnabledToggle.checked;
            if (introControlsBox) introControlsBox.style.display = state.introEnabled ? 'block' : 'none';
        });
    }
    if (introTemplateSelect) introTemplateSelect.addEventListener('change', () => { state.introTemplate = introTemplateSelect.value; });
    if (introTitleInput) introTitleInput.addEventListener('input', () => { state.introTitle = introTitleInput.value; });
    if (introSubtitleInput) introSubtitleInput.addEventListener('input', () => { state.introSubtitle = introSubtitleInput.value; });
    if (introDurationSlider) {
        introDurationSlider.addEventListener('input', () => {
            state.introDuration = parseFloat(introDurationSlider.value) || 3;
            if (introDurationVal) introDurationVal.innerText = state.introDuration.toFixed(1) + 's';
        });
    }
    if (introPreviewBtn) {
        introPreviewBtn.addEventListener('click', () => {
            runIntroOutroPreview({
                template: introTemplateSelect ? introTemplateSelect.value : 'classic',
                title: introTitleInput ? introTitleInput.value : '',
                subtitle: introSubtitleInput ? introSubtitleInput.value : '',
                duration: introDurationSlider ? parseFloat(introDurationSlider.value) : 3
            });
        });
    }

    const outroEnabledToggle = document.getElementById('outro-enabled-toggle');
    const outroControlsBox = document.getElementById('outro-controls-box');
    const outroTemplateSelect = document.getElementById('outro-template-select');
    const outroTitleInput = document.getElementById('outro-title-input');
    const outroSubtitleInput = document.getElementById('outro-subtitle-input');
    const outroDurationSlider = document.getElementById('outro-duration-slider');
    const outroDurationVal = document.getElementById('outro-duration-val');
    const outroPreviewBtn = document.getElementById('outro-preview-btn');

    if (outroEnabledToggle) {
        outroEnabledToggle.addEventListener('change', () => {
            state.outroEnabled = outroEnabledToggle.checked;
            if (outroControlsBox) outroControlsBox.style.display = state.outroEnabled ? 'block' : 'none';
        });
    }
    if (outroTemplateSelect) outroTemplateSelect.addEventListener('change', () => { state.outroTemplate = outroTemplateSelect.value; });
    if (outroTitleInput) outroTitleInput.addEventListener('input', () => { state.outroTitle = outroTitleInput.value; });
    if (outroSubtitleInput) outroSubtitleInput.addEventListener('input', () => { state.outroSubtitle = outroSubtitleInput.value; });
    if (outroDurationSlider) {
        outroDurationSlider.addEventListener('input', () => {
            state.outroDuration = parseFloat(outroDurationSlider.value) || 3;
            if (outroDurationVal) outroDurationVal.innerText = state.outroDuration.toFixed(1) + 's';
        });
    }
    if (outroPreviewBtn) {
        outroPreviewBtn.addEventListener('click', () => {
            runIntroOutroPreview({
                template: outroTemplateSelect ? outroTemplateSelect.value : 'classic',
                title: outroTitleInput ? outroTitleInput.value : '',
                subtitle: outroSubtitleInput ? outroSubtitleInput.value : '',
                duration: outroDurationSlider ? parseFloat(outroDurationSlider.value) : 3
            });
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
    // Export intro/outro segment drawing so exporter.js can render it straight
    // onto the same canvas/stream MediaRecorder is capturing (Phase 5C)
    window.drawIntroOutroSegment = drawIntroOutroSegment;
    
    // --- Helper Utilities ---
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = (seconds % 60).toFixed(1);
        const paddedMins = mins < 10 ? '0' + mins : mins;
        const paddedSecs = parseFloat(secs) < 10 ? '0' + secs : secs;
        return `${paddedMins}:${paddedSecs}`;
    }

    // Two-line time readout: mm:ss.s on top (as before), and the same moment
    // as a plain total-seconds number underneath -- e.g. B-roll "Show From /
    // Show Until" fields take raw seconds, so this saves manually converting
    // "01:23.4" into "83.4" by hand every time.
    function formatTimeDual(seconds) {
        const safeSeconds = isFinite(seconds) ? Math.max(0, seconds) : 0;
        return `<span class="time-main">${formatTime(safeSeconds)}</span><span class="time-secs">${safeSeconds.toFixed(1)}s</span>`;
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

    // --- IndexedDB Database Engine ---
    const DB_NAME = 'StudioFlowEditorDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'mediaFiles';

    function getDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async function storeFileInDB(key, blob) {
        try {
            const db = await getDB();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.put(blob, key);
            return new Promise((res, rej) => {
                tx.oncomplete = () => res();
                tx.onerror = () => rej(tx.error);
            });
        } catch (e) {
            console.error("IndexedDB store failed:", e);
        }
    }

    async function getFileFromDB(key) {
        try {
            const db = await getDB();
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get(key);
            return new Promise((res, rej) => {
                request.onsuccess = () => res(request.result);
                request.onerror = () => rej(request.error);
            });
        } catch (e) {
            console.error("IndexedDB get failed:", e);
            return null;
        }
    }

    async function clearFilesFromDB() {
        try {
            const db = await getDB();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.clear();
            return new Promise((res, rej) => {
                tx.oncomplete = () => res();
                tx.onerror = () => rej(tx.error);
            });
        } catch (e) {
            console.error("IndexedDB clear failed:", e);
        }
    }

    // Helper functions for Base64 conversion
    function blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    function dataURLtoBlob(dataurl) {
        if (!dataurl) return null;
        var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
            bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
        while(n--){
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], {type:mime});
    }

    // --- Sync UI Controls from state Object ---
    function syncUIFromState() {
        if (!state) return;
        
        // Navigation & Layout format buttons
        updateNavigation();

        const aspectButtons = document.querySelectorAll('.aspect-btn');
        aspectButtons.forEach(btn => {
            if (btn.dataset.ratio === state.aspectRatio) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        const layoutModeBtns = document.querySelectorAll('.layout-mode-btn');
        layoutModeBtns.forEach(btn => {
            if (btn.dataset.mode === state.layoutMode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Sliders & values
        if (videoVolumeSlider) {
            videoVolumeSlider.value = state.videoVolume * 100;
            if (videoVolumeVal) videoVolumeVal.innerText = Math.round(state.videoVolume * 100) + '%';
        }
        if (videoVolumeSliderStep2) {
            videoVolumeSliderStep2.value = state.videoVolume * 100;
            if (videoVolumeValStep2) videoVolumeValStep2.innerText = Math.round(state.videoVolume * 100) + '%';
        }

        // Voice Changer (dropdown + "also apply to original video" checkbox) —
        // restore both the UI controls and the live Web Audio effect params
        // after a project load/auto-restore, since these aren't driven by
        // 'change' events firing.
        const voiceChangerSelectEl = document.getElementById('voice-changer-select');
        if (voiceChangerSelectEl) {
            voiceChangerSelectEl.value = state.voiceoverProfile || 'none';
        }
        const voiceChangerApplyVideoToggleEl = document.getElementById('voice-changer-apply-video-toggle');
        if (voiceChangerApplyVideoToggleEl) {
            voiceChangerApplyVideoToggleEl.checked = !!state.applyVoiceChangerToVideo;
        }
        if (window.voiceoverVoiceChanger) {
            window.voiceoverVoiceChanger.setProfile(state.voiceoverProfile || 'none');
        }
        if (window.videoVoiceChanger) {
            window.videoVoiceChanger.setProfile(state.applyVoiceChangerToVideo ? (state.voiceoverProfile || 'none') : 'none');
        }

        // Logo configuration
        if (state.logoImg) {
            if (logoPreviewBox) logoPreviewBox.style.display = 'flex';
            if (logoDropzone) logoDropzone.style.display = 'none';
            if (logoControlCard) logoControlCard.style.display = 'block';
            if (logoImgPreview) logoImgPreview.src = state.logoImg.src;
            if (logoFilename) logoFilename.innerText = state.logoFile ? state.logoFile.name : 'watermark.png';
        } else {
            if (logoPreviewBox) logoPreviewBox.style.display = 'none';
            if (logoDropzone) logoDropzone.style.display = 'flex';
            if (logoControlCard) logoControlCard.style.display = 'none';
            if (logoInput) logoInput.value = '';
        }
        if (logoSizeSlider) {
            logoSizeSlider.value = state.logoSize;
            if (logoSizeVal) logoSizeVal.innerText = state.logoSize + '%';
        }
        if (logoOpacitySlider) {
            logoOpacitySlider.value = state.logoOpacity * 100;
            if (logoOpacityVal) logoOpacityVal.innerText = Math.round(state.logoOpacity * 100) + '%';
        }

        // Banners
        if (bannerStyleSelect) bannerStyleSelect.value = state.bannerStyle;
        if (headerTextInput) headerTextInput.value = state.headerText;
        if (footerTextInput) footerTextInput.value = state.footerText;
        if (bannerFontSelect) bannerFontSelect.value = state.bannerFontFamily;
        if (bannerFontSizeSlider) {
            bannerFontSizeSlider.value = state.bannerFontSize;
            if (bannerFontSizeVal) bannerFontSizeVal.innerText = state.bannerFontSize + 'px';
        }
        if (bannerTextColor) bannerTextColor.value = state.bannerTextColor;
        if (bannerBgColor) bannerBgColor.value = state.bannerBgColor;
        if (bannerHeightSlider) {
            bannerHeightSlider.value = state.bannerHeightPercent;
            if (bannerHeightVal) bannerHeightVal.innerText = state.bannerHeightPercent + '%';
        }

        // News Ticker
        if (tickerEnableToggle) {
            tickerEnableToggle.checked = state.tickerEnabled;
            if (tickerInputsContainer) tickerInputsContainer.style.display = state.tickerEnabled ? 'block' : 'none';
        }
        if (tickerTextInput) tickerTextInput.value = state.tickerText;
        if (tickerLabelInput) tickerLabelInput.value = state.tickerLabel;
        if (tickerPositionSelect) tickerPositionSelect.value = state.tickerPosition;
        if (tickerSpeedSlider) {
            tickerSpeedSlider.value = state.tickerSpeed;
            if (tickerSpeedVal) tickerSpeedVal.innerText = state.tickerSpeed + ' px/s';
        }
        if (tickerFontSizeSlider) {
            tickerFontSizeSlider.value = state.tickerFontSize;
            if (tickerFontSizeVal) tickerFontSizeVal.innerText = state.tickerFontSize + 'px';
        }
        if (tickerTextColor) tickerTextColor.value = state.tickerTextColor;
        if (tickerBgColor) tickerBgColor.value = state.tickerBgColor;
        if (tickerHeightSlider) {
            tickerHeightSlider.value = state.tickerHeightPercent;
            if (tickerHeightVal) tickerHeightVal.innerText = state.tickerHeightPercent + '%';
        }

        // Progress Bar
        if (progressBarToggle) {
            progressBarToggle.checked = state.enableProgressBar;
            if (progressBarOptionsContainer) progressBarOptionsContainer.style.display = state.enableProgressBar ? 'block' : 'none';
        }
        if (progressBarPos) progressBarPos.value = state.progressBarPosition;
        if (progressBarColor) {
            progressBarColor.value = state.progressBarColor;
            if (progressBarColorVal) progressBarColorVal.innerText = state.progressBarColor.toUpperCase();
        }
        if (progressBarHeight) {
            progressBarHeight.value = state.progressBarHeight;
            if (progressBarHeightVal) progressBarHeightVal.innerText = state.progressBarHeight + 'px';
        }

        // Filters presets & sliders
        const filterBtns = document.querySelectorAll('.filter-preset-btn');
        filterBtns.forEach(btn => {
            if (btn.dataset.filter === state.filterPreset) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        if (brightnessSlider) {
            brightnessSlider.value = state.brightness;
            if (brightnessVal) brightnessVal.innerText = state.brightness + '%';
        }
        if (contrastSlider) {
            contrastSlider.value = state.contrast;
            if (contrastVal) contrastVal.innerText = state.contrast + '%';
        }
        if (saturationSlider) {
            saturationSlider.value = state.saturation;
            if (saturationVal) saturationVal.innerText = state.saturation + '%';
        }

        // Color grading curves
        if (colorGradeToggle) {
            colorGradeToggle.checked = state.colorGradeEnabled;
            if (colorGradeContainer) colorGradeContainer.style.display = state.colorGradeEnabled ? 'block' : 'none';
        }
        colorGradeSliderMap.forEach(([elId, stateKey]) => {
            const sliderEl = document.getElementById(elId);
            const valEl = document.getElementById(elId + '-val');
            if (sliderEl) sliderEl.value = state[stateKey];
            if (valEl) valEl.innerText = state[stateKey];
        });

        // Trim slider values for active clip
        const activeClip = state.clips.find(c => c.id === state.activeClipId);
        if (activeClip) {
            if (trimStart) {
                trimStart.max = activeClip.duration;
                trimStart.value = activeClip.start;
            }
            if (trimEnd) {
                trimEnd.max = activeClip.duration;
                trimEnd.value = activeClip.end;
            }
            if (startVal) startVal.value = formatTime(activeClip.start);
            if (endVal) endVal.value = formatTime(activeClip.end);
            
            // Show seek controls
            const timelineControls = document.getElementById('timeline-controls');
            if (timelineControls) timelineControls.style.display = 'flex';
            const overlayControls = document.querySelector('.canvas-overlay-controls');
            if (overlayControls) overlayControls.style.display = 'block';
            if (videoDropzone) videoDropzone.style.display = 'none';
            if (document.getElementById('selected-video-name')) {
                document.getElementById('selected-video-name').innerText = activeClip.name;
            }
            nextBtn.disabled = false;
        }

        // Intros and Outros
        if (introEnabledToggle) {
            introEnabledToggle.checked = state.introEnabled;
            if (introControlsBox) introControlsBox.style.display = state.introEnabled ? 'block' : 'none';
        }
        if (introTemplateSelect) introTemplateSelect.value = state.introTemplate;
        if (introTitleInput) introTitleInput.value = state.introTitle;
        if (introSubtitleInput) introSubtitleInput.value = state.introSubtitle;
        if (introDurationSlider) {
            introDurationSlider.value = state.introDuration;
            if (introDurationVal) introDurationVal.innerText = state.introDuration.toFixed(1) + 's';
        }

        if (outroEnabledToggle) {
            outroEnabledToggle.checked = state.outroEnabled;
            if (outroControlsBox) outroControlsBox.style.display = state.outroEnabled ? 'block' : 'none';
        }
        if (outroTemplateSelect) outroTemplateSelect.value = state.outroTemplate;
        if (outroTitleInput) outroTitleInput.value = state.outroTitle;
        if (outroSubtitleInput) outroSubtitleInput.value = state.outroSubtitle;
        if (outroDurationSlider) {
            outroDurationSlider.value = state.outroDuration;
            if (outroDurationVal) outroDurationVal.innerText = state.outroDuration.toFixed(1) + 's';
        }

        // Video Intro Transition settings
        const introTransitionTypeSelect = document.getElementById('intro-transition-type');
        const introTransitionDurationSlider = document.getElementById('intro-transition-duration');
        const introTransitionDurationVal = document.getElementById('intro-transition-duration-val');

        if (introTransitionTypeSelect) introTransitionTypeSelect.value = state.introTransitionType || 'none';
        if (introTransitionDurationSlider) {
            introTransitionDurationSlider.value = state.introTransitionDuration || 1.0;
            if (introTransitionDurationVal) {
                introTransitionDurationVal.innerText = (state.introTransitionDuration || 1.0).toFixed(1) + 's';
            }
        }

        // Subtitles enabled
        const subtitlesEnabledToggle = document.getElementById('subtitles-enabled-toggle');
        if (subtitlesEnabledToggle) subtitlesEnabledToggle.checked = state.subtitlesEnabled;

        // Render dynamic timelines and overlays
        if (typeof renderClipTimeline === 'function') renderClipTimeline();
        if (typeof renderBlurRegionList === 'function') renderBlurRegionList();
        if (typeof renderHighlightList === 'function') renderHighlightList();
        if (typeof renderTextOverlayList === 'function') renderTextOverlayList();
        if (typeof renderBrollList === 'function') renderBrollList();
        if (typeof renderStickerList === 'function') renderStickerList();
        if (typeof renderSymbolList === 'function') renderSymbolList();
        
        // Sync Audio engine UI
        if (window.syncAudioUIFromStateGlobal) {
            window.syncAudioUIFromStateGlobal();
        }
    }

    // --- Save project to download file (Settings vs Full) ---
    async function exportProject(mode) {
        const prevConfirmText = saveModalConfirm.innerHTML;
        try {
            // Show custom loading feedback
            saveModalConfirm.disabled = true;
            saveModalConfirm.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Exporting...';

            const data = {
                version: "1.0",
                appName: "Studio Flow",
                timestamp: Date.now(),
                settings: {
                    startTime: state.startTime,
                    endTime: state.endTime,
                    aspectRatio: state.aspectRatio,
                    cropX: state.cropX,
                    cropY: state.cropY,
                    cropW: state.cropW,
                    cropH: state.cropH,
                    logoX: state.logoX,
                    logoY: state.logoY,
                    logoSize: state.logoSize,
                    logoOpacity: state.logoOpacity,
                    videoVolume: state.videoVolume,
                    voiceoverVolume: state.voiceoverVolume,
                    voiceoverProfile: state.voiceoverProfile,
                    applyVoiceChangerToVideo: state.applyVoiceChangerToVideo,
                    isNoiseCancelActive: state.isNoiseCancelActive,
                    noiseGateThreshold: state.noiseGateThreshold,
                    isAiDenoiseActive: state.isAiDenoiseActive,
                    bgMusicDuckingEnabled: state.bgMusicDuckingEnabled,
                    bannerStyle: state.bannerStyle,
                    headerText: state.headerText,
                    footerText: state.footerText,
                    bannerFontFamily: state.bannerFontFamily,
                    bannerFontSize: state.bannerFontSize,
                    bannerTextColor: state.bannerTextColor,
                    bannerBgColor: state.bannerBgColor,
                    bannerHeightPercent: state.bannerHeightPercent,
                    tickerEnabled: state.tickerEnabled,
                    tickerText: state.tickerText,
                    tickerLabel: state.tickerLabel,
                    tickerPosition: state.tickerPosition,
                    tickerSpeed: state.tickerSpeed,
                    tickerFontSize: state.tickerFontSize,
                    tickerTextColor: state.tickerTextColor,
                    tickerBgColor: state.tickerBgColor,
                    tickerHeightPercent: state.tickerHeightPercent,
                    enableProgressBar: state.enableProgressBar,
                    progressBarColor: state.progressBarColor,
                    progressBarHeight: state.progressBarHeight,
                    progressBarPosition: state.progressBarPosition,
                    filterPreset: state.filterPreset,
                    brightness: state.brightness,
                    contrast: state.contrast,
                    saturation: state.saturation,
                    colorGradeEnabled: state.colorGradeEnabled,
                    gradeRShadow: state.gradeRShadow,
                    gradeRMid: state.gradeRMid,
                    gradeRHigh: state.gradeRHigh,
                    gradeGShadow: state.gradeGShadow,
                    gradeGMid: state.gradeGMid,
                    gradeGHigh: state.gradeGHigh,
                    gradeBShadow: state.gradeBShadow,
                    gradeBMid: state.gradeBMid,
                    gradeBHigh: state.gradeBHigh,
                    layoutMode: state.layoutMode,
                    introTransitionType: state.introTransitionType || 'none',
                    introTransitionDuration: state.introTransitionDuration || 1.0,
                    chromaKeyEnabled: !!state.chromaKeyEnabled,
                    chromaKeyColor: state.chromaKeyColor || '#00ff00',
                    chromaKeyThreshold: state.chromaKeyThreshold || 45,
                    introEnabled: state.introEnabled,
                    introTemplate: state.introTemplate,
                    introTitle: state.introTitle,
                    introSubtitle: state.introSubtitle,
                    introDuration: state.introDuration,
                    outroEnabled: state.outroEnabled,
                    outroTemplate: state.outroTemplate,
                    outroTitle: state.outroTitle,
                    outroSubtitle: state.outroSubtitle,
                    outroDuration: state.outroDuration,
                    subtitlesEnabled: state.subtitlesEnabled,
                    subtitleStyle: state.subtitleStyle,
                    activeClipId: state.activeClipId,
                    voiceoverRecorded: state.voiceoverRecorded
                },
                textOverlays: state.textOverlays,
                highlights: state.highlights,
                fillRegions: state.fillRegions || [],
                stickers: state.stickers,
                symbolOverlays: state.symbolOverlays,
                shapeOverlays: state.shapeOverlays,
                blurRegions: state.blurRegions,
                subtitles: state.subtitles
            };

            // Convert logo to Base64 (always, since it is small)
            if (state.logoFile) {
                data.logoBase64 = await blobToBase64(state.logoFile);
                data.logoName = state.logoFile.name;
            }

            // Convert voiceover to Base64 (always, since it's small)
            if (state.voiceoverBlob) {
                data.voiceoverBase64 = await blobToBase64(state.voiceoverBlob);
            }

            // Convert B-roll images to Base64 (always, since they are static pictures)
            data.brollOverlays = [];
            for (let i = 0; i < state.brollOverlays.length; i++) {
                const broll = state.brollOverlays[i];
                const brollCopy = {...broll};
                delete brollCopy.imageImg;
                delete brollCopy.file;

                if (broll.type === 'image') {
                    if (broll.imageUrl && broll.imageUrl.startsWith('data:image/')) {
                        brollCopy.imageBase64 = broll.imageUrl;
                    } else if (broll.file) {
                        brollCopy.imageBase64 = await blobToBase64(broll.file);
                    }
                }
                data.brollOverlays.push(brollCopy);
            }

            // Convert Clips to Base64 (conditional based on mode)
            data.clips = [];
            for (let i = 0; i < state.clips.length; i++) {
                const clip = state.clips[i];
                const clipCopy = {...clip};
                delete clipCopy.imageImg;
                delete clipCopy.file;

                if (mode === 'full') {
                    if (clip.file) {
                        clipCopy.videoBase64 = await blobToBase64(clip.file);
                        clipCopy.fileType = clip.file.type;
                    }
                }
                data.clips.push(clipCopy);
            }

            // Convert BG Music tracks to Base64 (conditional based on mode)
            data.bgMusicTracks = [];
            for (let i = 0; i < state.bgMusicTracks.length; i++) {
                const track = state.bgMusicTracks[i];
                const trackCopy = {...track};
                delete trackCopy.blob;

                if (mode === 'full') {
                    if (track.blob) {
                        trackCopy.audioBase64 = await blobToBase64(track.blob);
                        trackCopy.fileType = track.blob.type;
                    }
                }
                data.bgMusicTracks.push(trackCopy);
            }

            // Trigger JSON file download
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data));
            const downloadAnchor = document.createElement('a');
            const filename = `studio-flow-project-${mode === 'full' ? 'full' : 'settings'}-${Date.now()}.json`;
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", filename);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
            
            // Reset confirm button
            saveModalConfirm.disabled = false;
            saveModalConfirm.innerHTML = prevConfirmText;
            console.log("Project exported successfully.");
        } catch (e) {
            console.error("Export failed:", e);
            alert("প্রজেক্ট এক্সপোর্ট করতে ব্যর্থ হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।");
            saveModalConfirm.disabled = false;
            saveModalConfirm.innerHTML = prevConfirmText;
        }
    }

    // --- Load project from imported JSON string ---
    let pendingImportData = null;

    async function importProject(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            if (data.appName !== 'Studio Flow' || !data.settings) {
                alert("ত্রুটি: এটি কোনো বৈধ Studio Flow প্রজেক্ট ফাইল নয়।");
                return;
            }

            pendingImportData = data;
            const missingFiles = [];

            // Check clips (only clips that don't have videoBase64 or imageBase64 embedded)
            for (let i = 0; i < data.clips.length; i++) {
                const clip = data.clips[i];
                if (clip.type !== 'image' && !clip.videoBase64) {
                    const cachedFile = await getFileFromDB(`clip_${clip.id}`);
                    if (cachedFile) {
                        clip.file = cachedFile;
                        clip.url = URL.createObjectURL(cachedFile);
                    } else {
                        missingFiles.push({
                            type: 'clip',
                            id: clip.id,
                            name: clip.name,
                            meta: `ভিডিও ক্লিপ · Duration: ${clip.duration.toFixed(1)}s`
                        });
                    }
                }
            }

            // Check BG music tracks
            for (let i = 0; i < data.bgMusicTracks.length; i++) {
                const track = data.bgMusicTracks[i];
                if (!track.audioBase64) {
                    const cachedFile = await getFileFromDB(`bgmusic_${track.id}`);
                    if (cachedFile) {
                        track.blob = cachedFile;
                        track.url = URL.createObjectURL(cachedFile);
                    } else if (track.libraryId && window.getLibraryDefById) {
                        // [9-10] Built-in Free Music Library track — re-render
                        // its synth blob instead of treating it as missing.
                        try {
                            const def = window.getLibraryDefById(track.libraryId);
                            if (def) {
                                const blob = await window.renderLibraryTrackToWavBlob(def);
                                track.blob = blob;
                                track.url = URL.createObjectURL(blob);
                            }
                        } catch (err) {
                            console.error('Failed to re-render library track:', err);
                        }
                        if (!track.blob) {
                            missingFiles.push({
                                type: 'bgmusic',
                                id: track.id,
                                name: track.name,
                                meta: `ব্যাকগ্রাউন্ড মিউজিক ট্র্যাক`
                            });
                        }
                    } else {
                        missingFiles.push({
                            type: 'bgmusic',
                            id: track.id,
                            name: track.name,
                            meta: `ব্যাকগ্রাউন্ড মিউজিক ট্র্যাক`
                        });
                    }
                }
            }

            if (missingFiles.length > 0) {
                showMediaReLinkerModal(missingFiles);
            } else {
                await applyImportedProject(data);
            }
        } catch (e) {
            console.error("Import failed:", e);
            alert("প্রজেক্ট ইম্পোর্ট করতে ব্যর্থ হয়েছে। ফাইলটি সঠিক কিনা যাচাই করুন।");
        }
    }

    // --- Render missing files and selection UI in Re-linker ---
    function showMediaReLinkerModal(missingFiles) {
        const modal = document.getElementById('media-relinker-modal');
        const container = document.getElementById('missing-files-container');
        const confirmBtn = document.getElementById('relink-modal-confirm');
        
        if (!modal || !container) return;
        
        container.innerHTML = '';
        confirmBtn.disabled = true;
        modal.style.display = 'flex';

        missingFiles.forEach((item) => {
            const row = document.createElement('div');
            row.className = 'missing-file-row';
            row.id = `relink-row-${item.type}-${item.id}`;

            const info = document.createElement('div');
            info.className = 'file-info-container';
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'file-info-name';
            nameSpan.innerText = item.name;
            
            const metaSpan = document.createElement('span');
            metaSpan.className = 'file-info-meta';
            metaSpan.innerText = item.meta;

            info.appendChild(nameSpan);
            info.appendChild(metaSpan);

            const uploadWrap = document.createElement('div');
            uploadWrap.className = 'btn-file-select-wrap';
            
            const selectBtn = document.createElement('button');
            selectBtn.className = 'btn btn-sm btn-outline';
            selectBtn.innerHTML = '<i class="fa-solid fa-file-circle-plus"></i> Select File';

            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = item.type === 'bgmusic' ? 'audio/*' : 'video/*, image/*';

            fileInput.addEventListener('change', (e) => {
                const selectedFile = e.target.files[0];
                if (selectedFile) {
                    item.fileObj = selectedFile;
                    row.classList.add('linked');
                    selectBtn.className = 'btn btn-sm btn-success';
                    selectBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Linked';
                    
                    const allLinked = missingFiles.every(x => x.fileObj);
                    confirmBtn.disabled = !allLinked;
                }
            });

            uploadWrap.appendChild(selectBtn);
            uploadWrap.appendChild(fileInput);

            row.appendChild(info);
            row.appendChild(uploadWrap);
            container.appendChild(row);
        });
        
        confirmBtn.onclick = async () => {
            modal.style.display = 'none';

            // Bind the selected files into the pending imported clips/tracks
            missingFiles.forEach(item => {
                if (item.type === 'clip') {
                    const clip = pendingImportData.clips.find(c => c.id === item.id);
                    if (clip) {
                        clip.file = item.fileObj;
                        clip.url = URL.createObjectURL(item.fileObj);
                    }
                } else if (item.type === 'bgmusic') {
                    const track = pendingImportData.bgMusicTracks.find(t => t.id === item.id);
                    if (track) {
                        track.blob = item.fileObj;
                        track.url = URL.createObjectURL(item.fileObj);
                    }
                }
            });

            await applyImportedProject(pendingImportData);
        };
    }

    // --- Write files and settings to state, then refresh workspace ---
    async function applyImportedProject(data) {
        try {
            // Clear DB cache
            await clearFilesFromDB();

            // Restore Logo
            if (data.logoBase64) {
                const logoBlob = dataURLtoBlob(data.logoBase64);
                state.logoFile = new File([logoBlob], data.logoName || 'logo.png', { type: logoBlob.type });
                state.logoImg = new Image();
                state.logoImg.src = URL.createObjectURL(state.logoFile);
                await new Promise(r => state.logoImg.onload = r);
                await storeFileInDB('logo', state.logoFile);
            } else {
                state.logoFile = null;
                state.logoImg = null;
            }

            // Restore Voiceover
            if (data.voiceoverBase64) {
                state.voiceoverBlob = dataURLtoBlob(data.voiceoverBase64);
                state.voiceoverUrl = URL.createObjectURL(state.voiceoverBlob);
                await storeFileInDB('voiceover', state.voiceoverBlob);
            } else {
                state.voiceoverBlob = null;
                state.voiceoverUrl = null;
            }

            // Restore B-roll images
            for (let i = 0; i < data.brollOverlays.length; i++) {
                const broll = data.brollOverlays[i];
                if (broll.type === 'image' && broll.imageBase64) {
                    const bBlob = dataURLtoBlob(broll.imageBase64);
                    broll.file = new File([bBlob], broll.name || 'broll_image.png', { type: bBlob.type });
                    broll.imageUrl = URL.createObjectURL(broll.file);
                    broll.imageImg = new Image();
                    broll.imageImg.src = broll.imageUrl;
                    await new Promise(r => broll.imageImg.onload = r);
                    await storeFileInDB(`broll_${broll.id}`, broll.file);
                }
            }

            // Restore Clips files
            for (let i = 0; i < data.clips.length; i++) {
                const clip = data.clips[i];
                if (clip.type === 'image' && clip.imageBase64) {
                    const cBlob = dataURLtoBlob(clip.imageBase64);
                    clip.file = new File([cBlob], clip.name || 'image_clip.png', { type: cBlob.type });
                    clip.url = URL.createObjectURL(clip.file);
                    clip.imageImg = new Image();
                    clip.imageImg.src = clip.url;
                    await new Promise(r => clip.imageImg.onload = r);
                    await storeFileInDB(`clip_${clip.id}`, clip.file);
                } else if (clip.videoBase64) {
                    const cBlob = dataURLtoBlob(clip.videoBase64);
                    clip.file = new File([cBlob], clip.name || 'video_clip.mp4', { type: clip.fileType || cBlob.type });
                    clip.url = URL.createObjectURL(clip.file);
                    await storeFileInDB(`clip_${clip.id}`, clip.file);
                } else if (clip.file) {
                    await storeFileInDB(`clip_${clip.id}`, clip.file);
                }
            }

            // Restore BG Music tracks
            for (let i = 0; i < data.bgMusicTracks.length; i++) {
                const track = data.bgMusicTracks[i];
                if (track.audioBase64) {
                    const tBlob = dataURLtoBlob(track.audioBase64);
                    track.blob = new File([tBlob], track.name || 'audio_track.mp3', { type: track.fileType || tBlob.type });
                    track.url = URL.createObjectURL(track.blob);
                    await storeFileInDB(`bgmusic_${track.id}`, track.blob);
                } else if (track.blob) {
                    await storeFileInDB(`bgmusic_${track.id}`, track.blob);
                }
            }

            // Assign settings to editor state object
            Object.assign(state, data.settings);
            state.textOverlays = data.textOverlays || [];
            state.highlights = data.highlights || [];
            state.fillRegions = data.fillRegions || [];
            state.stickers = data.stickers || [];
            state.symbolOverlays = data.symbolOverlays || [];
            state.shapeOverlays = data.shapeOverlays || [];
            state.brollOverlays = data.brollOverlays || [];
            state.blurRegions = data.blurRegions || [];
            state.subtitles = data.subtitles || [];
            state.clips = data.clips || [];
            state.bgMusicTracks = data.bgMusicTracks || [];

            sanitizeLoadedProjectIds();

            // Load video src
            if (state.clips.length > 0) {
                const activeClip = state.clips.find(c => c.id === state.activeClipId);
                if (activeClip && activeClip.type !== 'image') {
                    state.video.src = activeClip.url;
                    state.video.load();
                    await new Promise(r => state.video.onloadedmetadata = r);
                }
            }

            // Trigger immediate local storage auto-save
            saveProjectToBrowserStorage();

            // Re-sync and render
            syncUIFromState();
            drawFrame();

            // Set default step view
            state.currentStep = 1;
            updateNavigation();

            alert("প্রজেক্ট সফলভাবে লোড হয়েছে!");
        } catch (e) {
            console.error("Apply import failed:", e);
            alert("প্রজেক্ট ফাইল অ্যাপ্লাই করতে ত্রুটি ঘটেছে।");
        }
    }

    // --- Save project state into IndexedDB and LocalStorage ---
    // Guard flag: while a "New Project" reset is in progress, no autosave
    // (already scheduled, or newly triggered by the reset button's own click
    // events) is allowed to write the old project back to storage. See the
    // reset-editor-btn handler further down for why this is needed.
    let editorIsResetting = false;

    async function saveProjectToBrowserStorage() {
        if (editorIsResetting) return;
        try {
            const db = await getDB();
            
            // Prepare clean JSON metadata
            const settingsToSave = {
                version: "1.0",
                appName: "Studio Flow",
                timestamp: Date.now(),
                settings: {
                    startTime: state.startTime,
                    endTime: state.endTime,
                    aspectRatio: state.aspectRatio,
                    cropX: state.cropX,
                    cropY: state.cropY,
                    cropW: state.cropW,
                    cropH: state.cropH,
                    logoX: state.logoX,
                    logoY: state.logoY,
                    logoSize: state.logoSize,
                    logoOpacity: state.logoOpacity,
                    videoVolume: state.videoVolume,
                    voiceoverVolume: state.voiceoverVolume,
                    voiceoverProfile: state.voiceoverProfile,
                    applyVoiceChangerToVideo: state.applyVoiceChangerToVideo,
                    isNoiseCancelActive: state.isNoiseCancelActive,
                    noiseGateThreshold: state.noiseGateThreshold,
                    isAiDenoiseActive: state.isAiDenoiseActive,
                    bgMusicDuckingEnabled: state.bgMusicDuckingEnabled,
                    bannerStyle: state.bannerStyle,
                    headerText: state.headerText,
                    footerText: state.footerText,
                    bannerFontFamily: state.bannerFontFamily,
                    bannerFontSize: state.bannerFontSize,
                    bannerTextColor: state.bannerTextColor,
                    bannerBgColor: state.bannerBgColor,
                    bannerHeightPercent: state.bannerHeightPercent,
                    tickerEnabled: state.tickerEnabled,
                    tickerText: state.tickerText,
                    tickerLabel: state.tickerLabel,
                    tickerPosition: state.tickerPosition,
                    tickerSpeed: state.tickerSpeed,
                    tickerFontSize: state.tickerFontSize,
                    tickerTextColor: state.tickerTextColor,
                    tickerBgColor: state.tickerBgColor,
                    tickerHeightPercent: state.tickerHeightPercent,
                    enableProgressBar: state.enableProgressBar,
                    progressBarColor: state.progressBarColor,
                    progressBarHeight: state.progressBarHeight,
                    progressBarPosition: state.progressBarPosition,
                    filterPreset: state.filterPreset,
                    brightness: state.brightness,
                    contrast: state.contrast,
                    saturation: state.saturation,
                    colorGradeEnabled: state.colorGradeEnabled,
                    gradeRShadow: state.gradeRShadow,
                    gradeRMid: state.gradeRMid,
                    gradeRHigh: state.gradeRHigh,
                    gradeGShadow: state.gradeGShadow,
                    gradeGMid: state.gradeGMid,
                    gradeGHigh: state.gradeGHigh,
                    gradeBShadow: state.gradeBShadow,
                    gradeBMid: state.gradeBMid,
                    gradeBHigh: state.gradeBHigh,
                    layoutMode: state.layoutMode,
                    introTransitionType: state.introTransitionType || 'none',
                    introTransitionDuration: state.introTransitionDuration || 1.0,
                    chromaKeyEnabled: !!state.chromaKeyEnabled,
                    chromaKeyColor: state.chromaKeyColor || '#00ff00',
                    chromaKeyThreshold: state.chromaKeyThreshold || 45,
                    introEnabled: state.introEnabled,
                    introTemplate: state.introTemplate,
                    introTitle: state.introTitle,
                    introSubtitle: state.introSubtitle,
                    introDuration: state.introDuration,
                    outroEnabled: state.outroEnabled,
                    outroTemplate: state.outroTemplate,
                    outroTitle: state.outroTitle,
                    outroSubtitle: state.outroSubtitle,
                    outroDuration: state.outroDuration,
                    subtitlesEnabled: state.subtitlesEnabled,
                    subtitleStyle: state.subtitleStyle,
                    activeClipId: state.activeClipId,
                    voiceoverRecorded: state.voiceoverRecorded
                },
                textOverlays: state.textOverlays,
                highlights: state.highlights,
                fillRegions: state.fillRegions || [],
                stickers: state.stickers,
                symbolOverlays: state.symbolOverlays,
                shapeOverlays: state.shapeOverlays,
                brollOverlays: state.brollOverlays.map(b => {
                    const copy = {...b};
                    delete copy.imageImg;
                    delete copy.file;
                    return copy;
                }),
                blurRegions: state.blurRegions,
                subtitles: state.subtitles,
                clips: state.clips.map(c => {
                    const copy = {...c};
                    delete copy.imageImg;
                    delete copy.file;
                    return copy;
                }),
                bgMusicTracks: state.bgMusicTracks.map(t => {
                    const copy = {...t};
                    delete copy.blob;
                    return copy;
                })
            };

            localStorage.setItem('studio_flow_project_settings', JSON.stringify(settingsToSave));

            // Write files to IndexedDB
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);

            if (state.logoFile) {
                store.put(state.logoFile, 'logo');
            } else {
                store.delete('logo');
            }

            if (state.voiceoverBlob) {
                store.put(state.voiceoverBlob, 'voiceover');
            } else {
                store.delete('voiceover');
            }

            state.bgMusicTracks.forEach(t => {
                if (t.blob) {
                    store.put(t.blob, `bgmusic_${t.id}`);
                }
            });

            state.clips.forEach(c => {
                if (c.file) {
                    store.put(c.file, `clip_${c.id}`);
                }
            });

            state.brollOverlays.forEach(b => {
                if (b.type === 'image' && b.file) {
                    store.put(b.file, `broll_${b.id}`);
                }
            });
            
            console.log("IndexedDB Auto-save completed.");
        } catch (e) {
            console.error("Auto-save storage failed:", e);
        }
    }

    function sanitizeLoadedProjectIds() {
        // 1. Sanitize textOverlays
        const textIds = new Set();
        let maxTextId = 0;
        state.textOverlays.forEach(item => {
            if (item.id > maxTextId) maxTextId = item.id;
        });
        let nextTextId = maxTextId + 1;
        state.textOverlays.forEach(item => {
            if (textIds.has(item.id)) {
                item.id = nextTextId++;
            } else {
                textIds.add(item.id);
            }
        });
        textOverlayIdCounter = nextTextId;

        // 2. Sanitize stickers
        const stickerIds = new Set();
        let maxStickerId = 0;
        state.stickers.forEach(item => {
            if (item.id > maxStickerId) maxStickerId = item.id;
        });
        let nextStickerId = maxStickerId + 1;
        state.stickers.forEach(item => {
            if (stickerIds.has(item.id)) {
                item.id = nextStickerId++;
            } else {
                stickerIds.add(item.id);
            }
        });
        stickerIdCounter = nextStickerId;

        // 2b. Sanitize symbolOverlays
        if (!state.symbolOverlays) state.symbolOverlays = [];
        const symbolIds = new Set();
        let maxSymbolId = 0;
        state.symbolOverlays.forEach(item => {
            if (item.id > maxSymbolId) maxSymbolId = item.id;
        });
        let nextSymbolId = maxSymbolId + 1;
        state.symbolOverlays.forEach(item => {
            if (symbolIds.has(item.id)) {
                item.id = nextSymbolId++;
            } else {
                symbolIds.add(item.id);
            }
        });
        symbolIdCounter = nextSymbolId;

        // 3. Sanitize brollOverlays
        const brollIds = new Set();
        let maxBrollId = 0;
        state.brollOverlays.forEach(item => {
            if (item.id > maxBrollId) maxBrollId = item.id;
        });
        let nextBrollId = maxBrollId + 1;
        state.brollOverlays.forEach(item => {
            if (brollIds.has(item.id)) {
                const oldId = item.id;
                const newId = nextBrollId++;
                item.id = newId;
                if (item.type === 'image' && item.file) {
                    storeFileInDB(`broll_${newId}`, item.file);
                }
            } else {
                brollIds.add(item.id);
            }
        });
        brollIdCounter = nextBrollId;
        saveProjectToBrowserStorage();
    }

    // --- Restore state on application startup ---
    async function restoreProjectFromBrowserStorage() {
        try {
            const savedSettingsRaw = localStorage.getItem('studio_flow_project_settings');
            if (!savedSettingsRaw) return false;

            const savedData = JSON.parse(savedSettingsRaw);
            console.log("Auto-save project found. Re-establishing settings...", savedData);

            // Restore files from database
            const db = await getDB();

            // Logo
            const logoFile = await getFileFromDB('logo');
            if (logoFile) {
                state.logoFile = logoFile;
                state.logoImg = new Image();
                state.logoImg.src = URL.createObjectURL(logoFile);
                await new Promise(r => state.logoImg.onload = r);
            }

            // Voiceover
            const voiceoverBlob = await getFileFromDB('voiceover');
            if (voiceoverBlob) {
                state.voiceoverBlob = voiceoverBlob;
                state.voiceoverUrl = URL.createObjectURL(voiceoverBlob);
            }

            // Clips
            for (let i = 0; i < savedData.clips.length; i++) {
                const clipMeta = savedData.clips[i];
                const file = await getFileFromDB(`clip_${clipMeta.id}`);
                if (file) {
                    clipMeta.file = file;
                    clipMeta.url = URL.createObjectURL(file);
                    if (clipMeta.type === 'image') {
                        clipMeta.imageImg = new Image();
                        clipMeta.imageImg.src = clipMeta.url;
                        await new Promise(r => clipMeta.imageImg.onload = r);
                    }
                }
            }

            // BG Music tracks
            for (let i = 0; i < savedData.bgMusicTracks.length; i++) {
                const trackMeta = savedData.bgMusicTracks[i];
                const file = await getFileFromDB(`bgmusic_${trackMeta.id}`);
                if (file) {
                    trackMeta.blob = file;
                    trackMeta.url = URL.createObjectURL(file);
                } else if (trackMeta.libraryId && window.getLibraryDefById) {
                    // [9-10] Built-in library track was not persisted as a file —
                    // re-render its synth blob on restore.
                    try {
                        const def = window.getLibraryDefById(trackMeta.libraryId);
                        if (def) {
                            const blob = await window.renderLibraryTrackToWavBlob(def);
                            trackMeta.blob = blob;
                            trackMeta.url = URL.createObjectURL(blob);
                        }
                    } catch (err) {
                        console.error('Failed to re-render library track on restore:', err);
                    }
                }
            }

            // B-roll images
            for (let i = 0; i < savedData.brollOverlays.length; i++) {
                const broll = savedData.brollOverlays[i];
                if (broll.type === 'image') {
                    const file = await getFileFromDB(`broll_${broll.id}`);
                    if (file) {
                        broll.file = file;
                        broll.imageUrl = URL.createObjectURL(file);
                        broll.imageImg = new Image();
                        broll.imageImg.src = broll.imageUrl;
                        await new Promise(r => broll.imageImg.onload = r);
                    }
                }
            }

            // Load settings into current state object
            Object.assign(state, savedData.settings);
            state.textOverlays = savedData.textOverlays || [];
            state.highlights = savedData.highlights || [];
            state.fillRegions = savedData.fillRegions || [];
            state.stickers = savedData.stickers || [];
            state.symbolOverlays = savedData.symbolOverlays || [];
            state.shapeOverlays = savedData.shapeOverlays || [];
            state.brollOverlays = savedData.brollOverlays || [];
            state.blurRegions = savedData.blurRegions || [];
            state.subtitles = savedData.subtitles || [];
            state.clips = savedData.clips || [];
            state.bgMusicTracks = savedData.bgMusicTracks || [];

            sanitizeLoadedProjectIds();

            // Setup video element src
            if (state.clips.length > 0) {
                const activeClip = state.clips.find(c => c.id === state.activeClipId);
                if (activeClip && activeClip.type !== 'image') {
                    state.video.src = activeClip.url;
                    state.video.load();
                    await new Promise(r => state.video.onloadedmetadata = r);
                }
            }

            // Refresh UI
            syncUIFromState();
            drawFrame();
            
            console.log("Project auto-restore completed successfully.");
            return true;
        } catch (e) {
            console.error("Auto-restore process failed:", e);
            return false;
        }
    }

    // --- Debounced Auto-Save trigger ---
    let autoSaveTimeout = null;
    function triggerAutoSave() {
        if (state.isPlaying) return; // skip auto-saving while playing to avoid stutters
        if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
        autoSaveTimeout = setTimeout(() => {
            saveProjectToBrowserStorage();
        }, 1200);
    }

    // Bind triggerAutoSave on input changes
    document.addEventListener('input', (e) => {
        triggerAutoSave();
    });
    document.addEventListener('change', (e) => {
        triggerAutoSave();
    });
    
    // Bind triggerAutoSave on dragging / resizing elements end
    window.addEventListener('mouseup', () => {
        triggerAutoSave();
    });
    window.addEventListener('touchend', () => {
        triggerAutoSave();
    });

    // --- UI Button Event Bindings for Save/Load ---
    let selectedSaveMode = 'settings'; // default mode

    const saveProjectBtn = document.getElementById('save-project-btn');
    const loadProjectBtn = document.getElementById('load-project-btn');
    const projectFileInput = document.getElementById('project-file-input');

    const saveProjectModal = document.getElementById('save-project-modal');
    const saveModalClose = document.getElementById('save-modal-close');
    const saveModalCancel = document.getElementById('save-modal-cancel');
    const saveModalConfirm = document.getElementById('save-modal-confirm');
    
    const saveOptSettings = document.getElementById('save-opt-settings');
    const saveOptFull = document.getElementById('save-opt-full');
    const fullSaveWarning = document.getElementById('full-save-warning');
    const relinkModalCancel = document.getElementById('relink-modal-cancel');
    const relinkerModal = document.getElementById('media-relinker-modal');

    if (saveOptSettings) {
        saveOptSettings.addEventListener('click', () => {
            selectedSaveMode = 'settings';
            saveOptSettings.classList.add('active');
            saveOptFull.classList.remove('active');
            saveOptSettings.querySelector('.save-option-radio').innerHTML = '<i class="fa-solid fa-circle-dot"></i>';
            saveOptFull.querySelector('.save-option-radio').innerHTML = '<i class="fa-regular fa-circle"></i>';
            if (fullSaveWarning) fullSaveWarning.style.display = 'none';
        });
    }

    if (saveOptFull) {
        saveOptFull.addEventListener('click', () => {
            selectedSaveMode = 'full';
            saveOptFull.classList.add('active');
            saveOptSettings.classList.remove('active');
            saveOptFull.querySelector('.save-option-radio').innerHTML = '<i class="fa-solid fa-circle-dot"></i>';
            saveOptSettings.querySelector('.save-option-radio').innerHTML = '<i class="fa-regular fa-circle"></i>';
            if (fullSaveWarning) fullSaveWarning.style.display = 'flex';
        });
    }

    if (saveProjectBtn) {
        saveProjectBtn.addEventListener('click', () => {
            if (saveProjectModal) saveProjectModal.style.display = 'flex';
        });
    }

    const closeSaveModal = () => {
        if (saveProjectModal) saveProjectModal.style.display = 'none';
    };

    if (saveModalClose) saveModalClose.addEventListener('click', closeSaveModal);
    if (saveModalCancel) saveModalCancel.addEventListener('click', closeSaveModal);

    if (saveModalConfirm) {
        saveModalConfirm.addEventListener('click', async () => {
            closeSaveModal();
            await exportProject(selectedSaveMode);
        });
    }

    if (loadProjectBtn && projectFileInput) {
        loadProjectBtn.addEventListener('click', () => {
            projectFileInput.click();
        });

        projectFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = async (evt) => {
                    await importProject(evt.target.result);
                };
                reader.readAsText(file);
                projectFileInput.value = ''; // Reset input to allow reloading same file
            }
        });
    }

    if (relinkModalCancel && relinkerModal) {
        relinkModalCancel.addEventListener('click', () => {
            relinkerModal.style.display = 'none';
            pendingImportData = null;
        });
    }

    // --- New Project / Reset Editor (Bug fix) ---
    // Previously this button had no event listener at all, so clicking it did
    // nothing. That was fixed once already, but a second, subtler bug
    // remained: clicking the button fires a global `mouseup`, which the
    // debounced autosave listener (triggerAutoSave, ~1.2s below) picks up and
    // schedules a save. The confirm() dialog blocks the main thread while the
    // person decides, so by the time they click OK that timer is already
    // overdue. Our own `await clearFilesFromDB()` then yields the thread --
    // and that's exactly the moment the overdue autosave fires, writing the
    // OLD in-memory project (still full of clips/B-roll/etc.) straight back
    // into localStorage/IndexedDB and undoing the clear before the reload
    // even happens. That's why the video looked cleared (its blob lost the
    // race) but the B-roll list (pure metadata, no file needed) came back.
    // Fix: cancel the pending timer and set editorIsResetting=true *before*
    // doing any of the async clearing, so nothing can resurrect the project
    // in between.
    const resetEditorBtn = document.getElementById('reset-editor-btn');
    if (resetEditorBtn) {
        resetEditorBtn.addEventListener('click', async () => {
            const confirmMsg = 'আপনি কি নিশ্চিত যে নতুন প্রজেক্ট শুরু করতে চান?\n\nবর্তমান ভিডিও, ক্লিপ, ওভারলে এবং সব সেটিংস মুছে যাবে এবং এই কাজটি আর ফেরানো যাবে না।';
            if (!confirm(confirmMsg)) return;

            resetEditorBtn.disabled = true;
            editorIsResetting = true;
            if (autoSaveTimeout) {
                clearTimeout(autoSaveTimeout);
                autoSaveTimeout = null;
            }
            try {
                // Clear both persistence layers so the reload below can't
                // auto-restore the project we're trying to throw away.
                localStorage.removeItem('studio_flow_project_settings');
                await clearFilesFromDB();
            } catch (e) {
                console.error('Failed to clear saved project before reset:', e);
            } finally {
                // A full reload (rather than manually resetting the `state`
                // object field-by-field) guarantees every in-memory value --
                // canvas, video element, timeline, undo history, and every
                // property added across all the feature phases -- goes back
                // to its true default, with no risk of missing one and
                // leaving stale data behind.
                window.location.reload();
            }
        });
    }

    // Try to restore from database cache on initial load
    setTimeout(async () => {
        await restoreProjectFromBrowserStorage();
    }, 500);

    // --- Shared Audio Analysis (reused by 7A Silence Trimmer + Subtitle Snap) ---
    // Decodes a clip's audio and runs the exact same RMS/silence-detection loop
    // used by the Auto Silence Trimmer, but returns the *inverse* — the actual
    // speech regions (runs of non-silent audio) — so other features (like the
    // silence-aware subtitle sync) can snap timings to real spoken moments.
    window.computeSpeechRegions = async function(activeClip, thresholdDb, minDurationSec) {
        const arrayBuffer = await activeClip.file.arrayBuffer();
        const tempCtx = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await tempCtx.decodeAudioData(arrayBuffer);

        const sampleRate = audioBuffer.sampleRate;
        const channelData = audioBuffer.getChannelData(0);
        const totalSamples = channelData.length;

        const windowSizeSec = 0.05; // 50ms window (same as 7A)
        const windowSizeSamples = Math.floor(windowSizeSec * sampleRate);
        const amplitudeThreshold = Math.pow(10, thresholdDb / 20);

        let inSilence = false;
        let silenceStart = null;
        let silenceEnd = null;
        const silenceSegments = [];

        for (let i = 0; i < totalSamples; i += windowSizeSamples) {
            const endIdx = Math.min(i + windowSizeSamples, totalSamples);
            const size = endIdx - i;
            if (size <= 0) break;

            let sumSquares = 0;
            for (let j = i; j < endIdx; j++) {
                sumSquares += channelData[j] * channelData[j];
            }
            const rms = Math.sqrt(sumSquares / size);
            const currentTime = i / sampleRate;
            const isSilent = rms < amplitudeThreshold;

            if (isSilent) {
                if (!inSilence) {
                    inSilence = true;
                    silenceStart = currentTime;
                }
                silenceEnd = currentTime + (size / sampleRate);
            } else {
                if (inSilence) {
                    inSilence = false;
                    if (silenceEnd - silenceStart >= minDurationSec) {
                        silenceSegments.push({ start: silenceStart, end: silenceEnd });
                    }
                }
            }
        }
        if (inSilence && silenceEnd - silenceStart >= minDurationSec) {
            silenceSegments.push({ start: silenceStart, end: silenceEnd });
        }
        tempCtx.close();

        // Invert silence segments into speech regions covering [0, duration].
        const duration = audioBuffer.duration || (totalSamples / sampleRate);
        const speechRegions = [];
        let cursor = 0;
        silenceSegments.forEach(seg => {
            if (seg.start > cursor) {
                speechRegions.push({ start: cursor, end: seg.start });
            }
            cursor = Math.max(cursor, seg.end);
        });
        if (cursor < duration) {
            speechRegions.push({ start: cursor, end: duration });
        }
        return { speechRegions, silenceSegments, duration };
    };

    // --- Auto Silence Trimmer (Phase 7A) ---
    let detectedSilences = [];

    const silenceThresholdSlider = document.getElementById('silence-threshold-slider');
    const silenceThresholdVal = document.getElementById('silence-threshold-val');
    const silenceDurationSlider = document.getElementById('silence-duration-slider');
    const silenceDurationVal = document.getElementById('silence-duration-val');
    const silencePaddingSlider = document.getElementById('silence-padding-slider');
    const silencePaddingVal = document.getElementById('silence-padding-val');
    
    const silenceScanBtn = document.getElementById('silence-scan-btn');
    const silenceApplyBtn = document.getElementById('silence-apply-btn');
    const silenceCancelBtn = document.getElementById('silence-cancel-btn');

    if (silenceThresholdSlider && silenceThresholdVal) {
        silenceThresholdSlider.addEventListener('input', (e) => {
            silenceThresholdVal.innerText = `${e.target.value} dB`;
        });
    }
    if (silenceDurationSlider && silenceDurationVal) {
        silenceDurationSlider.addEventListener('input', (e) => {
            silenceDurationVal.innerText = `${parseFloat(e.target.value).toFixed(1)}s`;
        });
    }
    if (silencePaddingSlider && silencePaddingVal) {
        silencePaddingSlider.addEventListener('input', (e) => {
            silencePaddingVal.innerText = `${parseFloat(e.target.value).toFixed(2)}s`;
        });
    }

    if (silenceScanBtn) {
        silenceScanBtn.addEventListener('click', async () => {
            const activeClip = state.clips.find(c => c.id === state.activeClipId);
            if (!activeClip) {
                alert("দয়া করে প্রথমে একটি ভিডিও ক্লিপ সিলেক্ট করুন।");
                return;
            }
            if (activeClip.type === 'image') {
                alert("নীরবতা ছাঁটাই শুধু ভিডিও ক্লিপের জন্য প্রযোজ্য।");
                return;
            }
            
            const threshold = parseFloat(silenceThresholdSlider.value);
            const duration = parseFloat(silenceDurationSlider.value);
            const padding = parseFloat(silencePaddingSlider.value);
            
            await runSilenceAnalysis(activeClip, threshold, duration, padding);
        });
    }

    if (silenceApplyBtn) {
        silenceApplyBtn.addEventListener('click', async () => {
            await applySilenceCuts();
        });
    }

    if (silenceCancelBtn) {
        silenceCancelBtn.addEventListener('click', () => {
            resetSilenceTrimmerUI();
        });
    }

    async function runSilenceAnalysis(activeClip, threshold, minDuration, padding) {
        const statusEl = document.getElementById('silence-status');
        const resultsEl = document.getElementById('silence-results-container');
        const listEl = document.getElementById('silence-segments-list');

        if (!statusEl || !resultsEl || !listEl) return;

        // Show scanning state
        statusEl.style.display = 'flex';
        statusEl.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> অডিও ফাইল প্রসেস করা হচ্ছে...';
        statusEl.style.color = 'var(--text-secondary)';
        resultsEl.style.display = 'none';
        listEl.innerHTML = '';
        detectedSilences = [];

        try {
            // Read arrayBuffer from activeClip file
            const arrayBuffer = await activeClip.file.arrayBuffer();
            statusEl.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> অডিও ডিকোড করা হচ্ছে...';

            const tempCtx = new (window.AudioContext || window.webkitAudioContext)();
            const audioBuffer = await tempCtx.decodeAudioData(arrayBuffer);

            statusEl.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> নীরব অংশ খোঁজা হচ্ছে...';

            const sampleRate = audioBuffer.sampleRate;
            const channelData = audioBuffer.getChannelData(0);
            const totalSamples = channelData.length;

            const windowSizeSec = 0.05; // 50ms window
            const windowSizeSamples = Math.floor(windowSizeSec * sampleRate);
            const amplitudeThreshold = Math.pow(10, threshold / 20);

            let inSilence = false;
            let silenceStart = null;
            let silenceEnd = null;

            const rawSegments = [];

            for (let i = 0; i < totalSamples; i += windowSizeSamples) {
                const endIdx = Math.min(i + windowSizeSamples, totalSamples);
                const size = endIdx - i;
                if (size <= 0) break;

                let sumSquares = 0;
                for (let j = i; j < endIdx; j++) {
                    sumSquares += channelData[j] * channelData[j];
                }
                const rms = Math.sqrt(sumSquares / size);
                const currentTime = i / sampleRate;
                const isSilent = rms < amplitudeThreshold;

                if (isSilent) {
                    if (!inSilence) {
                        inSilence = true;
                        silenceStart = currentTime;
                    }
                    silenceEnd = currentTime + (size / sampleRate);
                } else {
                    if (inSilence) {
                        inSilence = false;
                        if (silenceEnd - silenceStart >= minDuration) {
                            rawSegments.push({ start: silenceStart, end: silenceEnd });
                        }
                    }
                }
            }

            if (inSilence) {
                if (silenceEnd - silenceStart >= minDuration) {
                    rawSegments.push({ start: silenceStart, end: silenceEnd });
                }
            }

            tempCtx.close();

            // Filter segments that fall within active clip's range [activeClip.start, activeClip.end]
            const clipStart = activeClip.start;
            const clipEnd = activeClip.end;

            const finalSegments = [];
            let segmentId = 1;

            rawSegments.forEach(seg => {
                const segStart = Math.max(clipStart, seg.start);
                const segEnd = Math.min(clipEnd, seg.end);

                if (segEnd - segStart >= minDuration) {
                    finalSegments.push({
                        id: segmentId++,
                        start: segStart,
                        end: segEnd,
                        duration: segEnd - segStart
                    });
                }
            });

            if (finalSegments.length === 0) {
                statusEl.innerHTML = '<i class="fa-solid fa-circle-check" style="color: var(--success);"></i> কোনো নীরব অংশ পাওয়া যায়নি।';
                statusEl.style.color = 'var(--success)';
                return;
            }

            detectedSilences = finalSegments;
            statusEl.innerHTML = `<i class="fa-solid fa-circle-check" style="color: var(--success);"></i> স্ক্যান সম্পন্ন: ${finalSegments.length}টি নীরব অংশ পাওয়া গেছে।`;
            statusEl.style.color = 'var(--success)';

            renderSilenceSegmentsList();
            resultsEl.style.display = 'block';
            updateSilenceSelectedCount();

        } catch (err) {
            console.error("Silence analysis error:", err);
            statusEl.innerHTML = '<i class="fa-solid fa-circle-exclamation" style="color: var(--danger);"></i> অডিও বিশ্লেষণ ব্যর্থ হয়েছে। ফাইলে অডিও ট্র্যাক নাও থাকতে পারে।';
            statusEl.style.color = 'var(--danger)';
        }
    }

    function renderSilenceSegmentsList() {
        const listEl = document.getElementById('silence-segments-list');
        if (!listEl) return;
        listEl.innerHTML = '';

        detectedSilences.forEach(seg => {
            const item = document.createElement('div');
            item.className = 'silence-item';
            item.id = `silence-item-${seg.id}`;

            const check = document.createElement('input');
            check.type = 'checkbox';
            check.className = 'silence-check';
            check.checked = true;
            check.dataset.id = seg.id;
            check.addEventListener('change', () => {
                updateSilenceSelectedCount();
            });

            const text = document.createElement('span');
            text.className = 'silence-time';
            text.innerText = `${formatTime(seg.start)} - ${formatTime(seg.end)}`;

            const dur = document.createElement('span');
            dur.className = 'silence-dur';
            dur.innerText = `${seg.duration.toFixed(1)}s`;

            const previewBtn = document.createElement('button');
            previewBtn.className = 'silence-preview-btn';
            previewBtn.type = 'button';
            previewBtn.title = 'Preview Segment';
            previewBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
            
            previewBtn.addEventListener('click', () => {
                // Highlight playing item
                document.querySelectorAll('.silence-item').forEach(el => el.classList.remove('playing'));
                item.classList.add('playing');

                state.currentTime = seg.start;
                playVideo();

                const stopHandler = () => {
                    if (state.currentTime >= seg.end) {
                        pauseVideo();
                        item.classList.remove('playing');
                        state.video.removeEventListener('timeupdate', stopHandler);
                    }
                };

                if (window.activeSilencePreviewHandler) {
                    state.video.removeEventListener('timeupdate', window.activeSilencePreviewHandler);
                }
                window.activeSilencePreviewHandler = stopHandler;
                state.video.addEventListener('timeupdate', stopHandler);
            });

            item.appendChild(check);
            item.appendChild(text);
            item.appendChild(dur);
            item.appendChild(previewBtn);
            listEl.appendChild(item);
        });
    }

    function updateSilenceSelectedCount() {
        const checks = document.querySelectorAll('#silence-segments-list .silence-check');
        let count = 0;
        checks.forEach(c => {
            if (c.checked) count++;
        });
        
        const countEl = document.getElementById('silence-selected-count');
        if (countEl) countEl.innerText = count;

        const toggleBtn = document.getElementById('silence-toggle-all-btn');
        if (toggleBtn) {
            toggleBtn.innerText = count === 0 ? "Select All" : "Deselect All";
        }
    }

    const toggleAllBtn = document.getElementById('silence-toggle-all-btn');
    if (toggleAllBtn) {
        toggleAllBtn.addEventListener('click', () => {
            const checks = document.querySelectorAll('#silence-segments-list .silence-check');
            const anyChecked = Array.from(checks).some(c => c.checked);
            checks.forEach(c => {
                c.checked = !anyChecked;
            });
            updateSilenceSelectedCount();
        });
    }

    async function applySilenceCuts() {
        const activeClip = state.clips.find(c => c.id === state.activeClipId);
        if (!activeClip) return;

        const checks = document.querySelectorAll('#silence-segments-list .silence-check');
        const selectedIds = Array.from(checks)
            .filter(c => c.checked)
            .map(c => parseInt(c.dataset.id));

        if (selectedIds.length === 0) {
            alert("বাদ দেওয়ার জন্য অনুগ্রহ করে কমপক্ষে একটি নীরব অংশ সিলেক্ট করুন।");
            return;
        }

        const padding = parseFloat(silencePaddingSlider.value) || 0;
        const cuts = detectedSilences
            .filter(seg => selectedIds.includes(seg.id))
            .map(seg => {
                return {
                    start: Math.max(activeClip.start, seg.start + padding),
                    end: Math.min(activeClip.end, seg.end - padding)
                };
            })
            .filter(cut => cut.end > cut.start + 0.15);

        if (cuts.length === 0) {
            alert("সেফটি বাফার (Padding) বাদ দেওয়ার পর কোনো উপযুক্ত নীরব অংশ পাওয়া যায়নি। অনুগ্রহ করে প্যাডিং এর মান কমিয়ে দেখুন।");
            return;
        }

        cuts.sort((a, b) => a.start - b.start);

        if (state.isPlaying) {
            pauseVideo();
        }

        const clipIndex = state.clips.indexOf(activeClip);
        const newClips = [];
        let currentStart = activeClip.start;
        const endBound = activeClip.end;

        cuts.forEach((cut, index) => {
            if (cut.start > currentStart + 0.15) {
                newClips.push({
                    id: Date.now() + index * 10,
                    file: activeClip.file,
                    url: activeClip.url,
                    name: activeClip.name,
                    duration: activeClip.duration,
                    start: currentStart,
                    end: cut.start,
                    cropX: activeClip.cropX,
                    cropY: activeClip.cropY,
                    cropW: activeClip.cropW,
                    cropH: activeClip.cropH
                });
            }
            currentStart = cut.end;
        });

        if (endBound > currentStart + 0.15) {
            newClips.push({
                id: Date.now() + cuts.length * 10,
                file: activeClip.file,
                url: activeClip.url,
                name: activeClip.name,
                duration: activeClip.duration,
                start: currentStart,
                end: endBound,
                cropX: activeClip.cropX,
                cropY: activeClip.cropY,
                cropW: activeClip.cropW,
                cropH: activeClip.cropH
            });
        }

        if (newClips.length === 0) {
            alert("সবগুলো নীরবতা বাদ দিলে পুরো ভিডিওটিই বাদ পড়ে যায়! অনুগ্রহ করে কিছু নীরবতা আনচেক করুন বা থ্রেশহোল্ড বাড়ান।");
            return;
        }

        state.clips.splice(clipIndex, 1, ...newClips);
        renderClipTimeline();
        switchActiveClip(newClips[0].id);
        resetSilenceTrimmerUI();

        alert(`সফলভাবে ${cuts.length}টি নীরব অংশ কেটে বাদ দেওয়া হয়েছে। ভিডিওটি এখন ${newClips.length}টি ক্লিপে বিভক্ত করা হয়েছে।`);
        if (typeof triggerAutoSave === 'function') triggerAutoSave();
    }

    function resetSilenceTrimmerUI() {
        const resultsEl = document.getElementById('silence-results-container');
        const statusEl = document.getElementById('silence-status');
        const listEl = document.getElementById('silence-segments-list');
        if (resultsEl) resultsEl.style.display = 'none';
        if (statusEl) statusEl.style.display = 'none';
        if (listEl) listEl.innerHTML = '';
        detectedSilences = [];
        if (window.activeSilencePreviewHandler) {
            state.video.removeEventListener('timeupdate', window.activeSilencePreviewHandler);
            window.activeSilencePreviewHandler = null;
        }
    }
    window.resetSilenceTrimmerUI = resetSilenceTrimmerUI;

    function updateSilenceTrimmerVisibility() {
        const trimmerCard = document.getElementById('silence-trimmer-card');
        if (!trimmerCard) return;

        const activeClip = state.clips.find(c => c.id === state.activeClipId);
        if (!activeClip || activeClip.type === 'image') {
            if (silenceScanBtn) {
                silenceScanBtn.disabled = true;
                silenceScanBtn.innerHTML = '<i class="fa-solid fa-ban"></i> Video Only (শুধু ভিডিওর জন্য)';
            }
            resetSilenceTrimmerUI();
        } else {
            if (silenceScanBtn) {
                silenceScanBtn.disabled = false;
                silenceScanBtn.innerHTML = '<i class="fa-solid fa-magnifying-glass-chart"></i> Scan for Silence (নীরবতা স্ক্যান করুন)';
            }
        }
    }
    window.updateSilenceTrimmerVisibility = updateSilenceTrimmerVisibility;

    // Call visibility update initially
    setTimeout(() => {
        updateSilenceTrimmerVisibility();
    }, 1000);

    // --- Keyboard Shortcuts (Phase 7F) ---
    window.addEventListener('keydown', (e) => {
        // Ignore shortcuts if the user is typing in any input field or textarea
        const activeEl = document.activeElement;
        if (activeEl && (
            activeEl.tagName === 'INPUT' || 
            activeEl.tagName === 'TEXTAREA' || 
            activeEl.isContentEditable
        )) {
            return;
        }

        const activeClip = state.clips.find(c => c.id === state.activeClipId);
        if (!activeClip) return;

        switch (e.key.toLowerCase()) {
            case ' ':
                // Spacebar: Toggle play / pause
                e.preventDefault(); // Prevent page scrolling
                if (playPauseBtn) playPauseBtn.click();
                break;
            case 'i':
                // Set Trim Start
                e.preventDefault();
                let newStart = state.currentTime;
                if (newStart >= state.endTime) {
                    newStart = state.endTime - 0.1;
                }
                state.startTime = newStart;
                if (trimStart) trimStart.value = newStart;
                if (startVal) startVal.value = formatTime(newStart);
                updatePlayhead();
                syncActiveClipTrim();
                if (typeof triggerAutoSave === 'function') triggerAutoSave();
                drawFrame();
                break;
            case 'o':
                // Set Trim End
                e.preventDefault();
                let newEnd = state.currentTime;
                if (newEnd <= state.startTime) {
                    newEnd = state.startTime + 0.1;
                }
                state.endTime = newEnd;
                if (trimEnd) trimEnd.value = newEnd;
                if (endVal) endVal.value = formatTime(newEnd);
                updatePlayhead();
                syncActiveClipTrim();
                if (typeof triggerAutoSave === 'function') triggerAutoSave();
                drawFrame();
                break;
            case 'arrowleft':
                // Step backward by 1s
                e.preventDefault();
                let targetPrevTime = Math.max(0, state.currentTime - 1.0);
                state.currentTime = targetPrevTime;
                updatePlayhead();
                drawFrame();
                break;
            case 'arrowright':
                // Step forward by 1s
                e.preventDefault();
                let maxDuration = activeClip.duration || state.duration || 5;
                let targetNextTime = Math.min(maxDuration, state.currentTime + 1.0);
                state.currentTime = targetNextTime;
                updatePlayhead();
                drawFrame();
                break;
        }
    });

    // --- Voice typing for text fields ---
    // Chrome/Edge provide this Web Speech API; each field receives its own
    // language selector so Bangla and English dictation can both be used.
    const VoiceRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const activeVoiceInput = { recognition: null, button: null };

    function stopVoiceTyping() {
        if (activeVoiceInput.recognition) {
            try { activeVoiceInput.recognition.stop(); } catch (err) { /* already stopped */ }
        }
    }

    function addVoiceTypingControl(input) {
        if (!VoiceRecognition || input.dataset.voiceTypingReady) return;
        input.dataset.voiceTypingReady = 'true';

        const wrapper = document.createElement('div');
        wrapper.className = 'voice-type-field';
        input.parentNode.insertBefore(wrapper, input);
        wrapper.appendChild(input);

        const language = document.createElement('select');
        language.className = 'form-select voice-language-select';
        language.setAttribute('aria-label', 'Voice typing language');
        language.innerHTML = '<option value="bn-BD">বাংলা</option><option value="en-US">English</option>';

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'voice-type-btn';
        button.title = 'মাইক্রোফোন চাপুন, তারপর কথা বলুন';
        button.setAttribute('aria-label', 'Start voice typing');
        button.innerHTML = '<i class="fa-solid fa-microphone"></i>';
        wrapper.append(language, button);

        button.addEventListener('click', () => {
            if (activeVoiceInput.button === button) {
                stopVoiceTyping();
                return;
            }

            stopVoiceTyping();
            const recognition = new VoiceRecognition();
            recognition.lang = language.value;
            recognition.continuous = true;
            recognition.interimResults = false;

            recognition.onresult = (event) => {
                let text = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    if (event.results[i].isFinal) text += event.results[i][0].transcript;
                }
                if (!text) return;

                const start = input.selectionStart == null ? input.value.length : input.selectionStart;
                const end = input.selectionEnd == null ? input.value.length : input.selectionEnd;
                const spacer = start > 0 && input.value[start - 1] && !/\s$/.test(input.value.slice(0, start)) ? ' ' : '';
                input.value = input.value.slice(0, start) + spacer + text.trim() + input.value.slice(end);
                const caret = start + spacer.length + text.trim().length;
                input.setSelectionRange(caret, caret);
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.focus();
            };

            recognition.onerror = (event) => {
                if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                    alert('Voice typing ব্যবহার করতে ব্রাউজার থেকে Microphone permission Allow করুন।');
                }
            };

            recognition.onend = () => {
                if (activeVoiceInput.recognition === recognition) {
                    button.classList.remove('is-listening');
                    button.innerHTML = '<i class="fa-solid fa-microphone"></i>';
                    button.title = 'মাইক্রোফোন চাপুন, তারপর কথা বলুন';
                    button.setAttribute('aria-label', 'Start voice typing');
                    activeVoiceInput.recognition = null;
                    activeVoiceInput.button = null;
                }
            };

            try {
                recognition.start();
                activeVoiceInput.recognition = recognition;
                activeVoiceInput.button = button;
                button.classList.add('is-listening');
                button.innerHTML = '<i class="fa-solid fa-stop"></i>';
                button.title = 'Voice typing বন্ধ করুন';
                button.setAttribute('aria-label', 'Stop voice typing');
            } catch (err) {
                console.warn('Unable to start voice typing:', err);
            }
        });
    }

    document.querySelectorAll('input.form-input[type="text"], textarea.form-input').forEach(addVoiceTypingControl);

    // Bind global trigger to allow re-render on demands
    window.triggerCanvasRedraw = drawFrame;
    window.renderBlurRegionList = renderBlurRegionList;
    window.renderHighlightList = renderHighlightList;
    window.renderFillList = renderFillList;
    window.renderTextOverlayList = renderTextOverlayList;
    window.renderBrollList = renderBrollList;
    window.renderStickerList = renderStickerList;
    window.renderSymbolList = renderSymbolList;
    window.renderShapeOverlayList = renderShapeOverlayList;
});
