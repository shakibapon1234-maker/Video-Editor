/**
 * Studio Flow — Phase 9 feature module
 * Split/Freeze/PIP were implemented earlier in editor.js.
 * This module adds the remaining Phase 9 plan items.
 */
document.addEventListener('DOMContentLoaded', () => {
    const state = window.VideoEditor;
    if (!state) return;

    // --- Shared clip defaults (backward compatible) ---
    function ensureClipDefaults(clip) {
        if (!clip) return clip;
        if (clip.speed == null || isNaN(clip.speed)) clip.speed = 1;
        if (!clip.transitionType) clip.transitionType = 'none';
        if (clip.transitionDuration == null || isNaN(clip.transitionDuration)) clip.transitionDuration = 0.5;
        if (clip.kenBurnsEnabled == null) clip.kenBurnsEnabled = false;
        if (clip.kenBurnsStartZoom == null) clip.kenBurnsStartZoom = 100;
        if (clip.kenBurnsEndZoom == null) clip.kenBurnsEndZoom = 115;
        if (!clip.kenBurnsPan) clip.kenBurnsPan = 'right';
        if (clip.zoom == null || isNaN(clip.zoom)) clip.zoom = 100;
        if (clip.offsetX == null || isNaN(clip.offsetX)) clip.offsetX = 0;
        if (clip.offsetY == null || isNaN(clip.offsetY)) clip.offsetY = 0;
        return clip;
    }

    function ensureAllClips() {
        if (state.clips) state.clips.forEach(ensureClipDefaults);
    }

    function getClipPlayDuration(clip) {
        ensureClipDefaults(clip);
        const trim = Math.max(0, (clip.end || 0) - (clip.start || 0));
        return trim / (clip.speed || 1);
    }

    function getActiveClipIndex() {
        return state.clips.findIndex(c => c.id === state.activeClipId);
    }

    function getNextClip(index) {
        if (index < 0 || index >= state.clips.length - 1) return null;
        return state.clips[index + 1];
    }

    // Hidden video element for clip-to-clip transition preview
    const transitionVideoEl = document.createElement('video');
    transitionVideoEl.crossOrigin = 'anonymous';
    transitionVideoEl.preload = 'auto';
    transitionVideoEl.style.display = 'none';
    document.body.appendChild(transitionVideoEl);
    const transitionCanvas = document.createElement('canvas');
    const transitionCtx = transitionCanvas.getContext('2d');

    if (state.previewTransitionsEnabled == null) state.previewTransitionsEnabled = true;
    if (state.chromaKeyEnabled == null) state.chromaKeyEnabled = false;
    if (!state.chromaKeyColor) state.chromaKeyColor = '#00ff00';
    if (state.chromaKeyThreshold == null) state.chromaKeyThreshold = 45;
    if (state.chromaKeyPreviewQuality == null) state.chromaKeyPreviewQuality = true;

    // --- Undo / Redo history ---
    state.undoStack = state.undoStack || [];
    state.redoStack = state.redoStack || [];
    state.historyLabels = state.historyLabels || [];
    state.redoLabels = state.redoLabels || [];
    const MAX_HISTORY = 40;
    let historySuspended = false;
    let cachedLogoImg = null;
    let cachedLogoFile = null;

    function serializeForHistory() {
        return JSON.stringify({
            settings: {
                startTime: state.startTime,
                endTime: state.endTime,
                aspectRatio: state.aspectRatio,
                cropX: state.cropX, cropY: state.cropY, cropW: state.cropW, cropH: state.cropH,
                filterPreset: state.filterPreset,
                brightness: state.brightness, contrast: state.contrast, saturation: state.saturation,
                introTransitionType: state.introTransitionType,
                introTransitionDuration: state.introTransitionDuration,
                chromaKeyEnabled: state.chromaKeyEnabled,
                chromaKeyColor: state.chromaKeyColor,
                chromaKeyThreshold: state.chromaKeyThreshold,
                logoX: state.logoX,
                logoY: state.logoY,
                logoSize: state.logoSize,
                logoOpacity: state.logoOpacity,
                logoRemoved: !state.logoImg
            },
            clips: state.clips.map(c => {
                const copy = { ...c };
                delete copy.imageImg;
                delete copy.file;
                return copy;
            }),
            activeClipId: state.activeClipId,
            
            // Added support for all overlays and annotations
            textOverlays: state.textOverlays || [],
            highlights: state.highlights || [],
            fillRegions: state.fillRegions || [],
            stickers: state.stickers || [],
            symbolOverlays: state.symbolOverlays || [],
            shapeOverlays: state.shapeOverlays || [],
            brollOverlays: (state.brollOverlays || []).map(b => {
                const copy = { ...b };
                delete copy.imageImg;
                delete copy.file;
                delete copy.videoEl;
                return copy;
            }),
            blurRegions: state.blurRegions || [],
            subtitles: state.subtitles || []
        });
    }

    function applyHistorySnapshot(jsonStr) {
        historySuspended = true;
        try {
            const data = JSON.parse(jsonStr);
            const oldClips = state.clips || []; // keep reference to current clips in memory
            Object.assign(state, data.settings);
            state.clips = (data.clips || []).map(c => {
                const existing = oldClips.find(oc => oc.id === c.id);
                const restored = ensureClipDefaults({ ...c });
                if (existing) {
                    restored.file = existing.file;
                    restored.imageImg = existing.imageImg;
                }
                return restored;
            });
            state.activeClipId = data.activeClipId;

            // Restore all overlays and annotations
            state.textOverlays = data.textOverlays || [];
            state.highlights = data.highlights || [];
            state.fillRegions = data.fillRegions || [];
            state.stickers = data.stickers || [];
            state.symbolOverlays = data.symbolOverlays || [];
            state.shapeOverlays = data.shapeOverlays || [];
            state.blurRegions = data.blurRegions || [];
            state.subtitles = data.subtitles || [];

            const oldBrolls = state.brollOverlays || [];
            state.brollOverlays = (data.brollOverlays || []).map(b => {
                const existing = oldBrolls.find(ob => ob.id === b.id);
                const restored = { ...b };
                if (existing) {
                    restored.file = existing.file;
                    restored.imageImg = existing.imageImg;
                    if (existing.type === 'video') {
                        restored.videoEl = existing.videoEl;
                    }
                } else if ((b.type === 'image' || b.type === 'gif') && b.imageUrl) {
                    const img = new Image();
                    img.onload = () => { restored.imageImg = img; if (window.drawEditorFrame) window.drawEditorFrame(); };
                    img.src = b.imageUrl;
                    // Animated GIFs must stay in the DOM to keep decoding.
                    if (b.type === 'gif') {
                        const host = document.getElementById('gif-host');
                        if (host) host.appendChild(img);
                        if (window.ensureAnimatedGifPreview) window.ensureAnimatedGifPreview();
                    }
                    restored.imageImg = img;
                } else if (b.type === 'video' && b.videoUrl) {
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
                    Object.defineProperty(vid, 'naturalWidth', { get: () => vid.videoWidth });
                    Object.defineProperty(vid, 'naturalHeight', { get: () => vid.videoHeight });
                    vid.src = b.videoUrl;
                    vid.load();
                    restored.videoEl = vid;
                    restored.imageImg = vid;
                }
                return restored;
            });

            // Restore logo image elements and file objects if not removed
            const logoPreviewBox = document.getElementById('logo-preview-box');
            const logoDropzone = document.getElementById('logo-dropzone');
            const logoControlCard = document.getElementById('logo-control-card');
            const logoInput = document.getElementById('logo-input');
            const logoImgPreview = document.getElementById('logo-img-preview');
            
            if (data.settings.logoRemoved) {
                state.logoImg = null;
                state.logoFile = null;
                if (logoPreviewBox) logoPreviewBox.style.display = 'none';
                if (logoDropzone) logoDropzone.style.display = 'flex';
                if (logoControlCard) logoControlCard.style.display = 'none';
                if (logoInput) logoInput.value = '';
            } else if (cachedLogoImg) {
                state.logoImg = cachedLogoImg;
                state.logoFile = cachedLogoFile;
                if (logoPreviewBox) logoPreviewBox.style.display = 'block';
                if (logoDropzone) logoDropzone.style.display = 'none';
                if (logoControlCard) logoControlCard.style.display = 'block';
                if (logoImgPreview) logoImgPreview.src = state.logoImg.src;
            }

            // Sync logo UI controls
            const logoSizeSlider = document.getElementById('logo-size-slider');
            const logoSizeVal = document.getElementById('logo-size-val');
            const logoOpacitySlider = document.getElementById('logo-opacity-slider');
            const logoOpacityVal = document.getElementById('logo-opacity-val');
            if (logoSizeSlider && state.logoSize !== undefined) {
                logoSizeSlider.value = state.logoSize;
                if (logoSizeVal) logoSizeVal.innerText = state.logoSize + '%';
            }
            if (logoOpacitySlider && state.logoOpacity !== undefined) {
                logoOpacitySlider.value = Math.round(state.logoOpacity * 100);
                if (logoOpacityVal) logoOpacityVal.innerText = Math.round(state.logoOpacity * 100) + '%';
            }

            const active = state.clips.find(c => c.id === state.activeClipId);
            if (active) {
                state.duration = active.duration;
                state.startTime = active.start;
                state.endTime = active.end;
                state.cropX = active.cropX || 0;
                state.cropY = active.cropY || 0;
                state.cropW = active.cropW != null ? active.cropW : 1;
                state.cropH = active.cropH != null ? active.cropH : 1;
                if (active.type === 'image' && active.url) {
                    const img = new Image();
                    img.onload = () => { active.imageImg = img; if (window.drawEditorFrame) window.drawEditorFrame(); };
                    img.src = active.url;
                } else if (active.url && state.video) {
                    // Clear any stale onloadedmetadata handler from switchActiveClip
                    // to prevent it from firing after undo/redo and corrupting state.
                    state.video.onloadedmetadata = null;
                    let isSameSrc = false;
                    try {
                        const absVideoSrc = new URL(state.video.src, window.location.href).href;
                        const absClipUrl = new URL(active.url, window.location.href).href;
                        isSameSrc = (absVideoSrc === absClipUrl);
                    } catch (e) {
                        isSameSrc = (state.video.src === active.url);
                    }
                    if (!isSameSrc) {
                        state.video.src = active.url;
                        state.video.load();
                    }
                    // Seek to the clip's start position
                    state.video.currentTime = active.start || 0;
                }
            }
            if (window.renderClipTimeline) window.renderClipTimeline();
            if (window.syncPhase9ClipUI) window.syncPhase9ClipUI();
            
            // Re-render all annotation/overlay UI lists
            if (window.renderBlurRegionList) window.renderBlurRegionList();
            if (window.renderHighlightList) window.renderHighlightList();
            if (window.renderFillList) window.renderFillList();
            if (window.renderTextOverlayList) window.renderTextOverlayList();
            if (window.renderBrollList) window.renderBrollList();
            if (window.renderStickerList) window.renderStickerList();
            if (window.renderSymbolList) window.renderSymbolList();
            if (window.renderShapeOverlayList) window.renderShapeOverlayList();

            if (window.drawEditorFrame) window.drawEditorFrame();
        } finally {
            historySuspended = false;
        }
    }

    let pendingUndoSnapshot = null; // pre-action snapshot captured before the action is applied

    // Call this BEFORE applying an action to save the pre-action state.
    function captureUndoCheckpoint() {
        if (historySuspended || !state.clips || state.clips.length === 0) return;
        if (state.logoImg) {
            cachedLogoImg = state.logoImg;
            cachedLogoFile = state.logoFile;
        }
        pendingUndoSnapshot = serializeForHistory();
    }
    window.captureUndoCheckpoint = captureUndoCheckpoint;

    function recordEditorHistory(label) {
        if (historySuspended || !state.clips || state.clips.length === 0) return;
        if (state.logoImg) {
            cachedLogoImg = state.logoImg;
            cachedLogoFile = state.logoFile;
        }
        // Use the pre-action snapshot if one was captured, otherwise fall back to
        // post-action snapshot (old behavior kept for safety).
        const snap = pendingUndoSnapshot || serializeForHistory();
        pendingUndoSnapshot = null;
        state.undoStack.push(snap);
        state.historyLabels.push(label || 'Change');
        if (state.undoStack.length > MAX_HISTORY) {
            state.undoStack.shift();
            state.historyLabels.shift();
        }
        state.redoStack = [];
        state.redoLabels = [];
        updateHistoryUI();
    }
    window.recordEditorHistory = recordEditorHistory;

    function undoEditor() {
        if (state.undoStack.length === 0) return;
        state.redoStack.push(serializeForHistory());
        const snap = state.undoStack.pop();
        const label = state.historyLabels.pop();
        state.redoLabels.push(label || 'Change');
        applyHistorySnapshot(snap);
        updateHistoryUI();
        console.log('Undo:', label);
    }

    function redoEditor() {
        if (state.redoStack.length === 0) return;
        state.undoStack.push(serializeForHistory());
        state.historyLabels.push(state.redoLabels.pop() || 'Redo');
        const snap = state.redoStack.pop();
        applyHistorySnapshot(snap);
        updateHistoryUI();
    }

    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    const historyPanelToggle = document.getElementById('history-panel-toggle');
    const historyPanelList = document.getElementById('history-panel-list');

    if (undoBtn) undoBtn.addEventListener('click', undoEditor);
    if (redoBtn) redoBtn.addEventListener('click', redoEditor);

    function updateHistoryUI() {
        if (undoBtn) undoBtn.disabled = state.undoStack.length === 0;
        if (redoBtn) redoBtn.disabled = state.redoStack.length === 0;
        if (!historyPanelList) return;
        historyPanelList.style.display = historyPanelToggle && historyPanelToggle.classList.contains('open') ? 'block' : 'none';
        historyPanelList.innerHTML = '';
        const labels = [...state.historyLabels].reverse();
        const heading = document.createElement('li');
        heading.textContent = 'History — সর্বশেষ কাজ আগে';
        heading.style.padding = '5px 10px 10px';
        heading.style.fontWeight = '700';
        heading.style.color = 'var(--text-primary, #fff)';
        heading.style.borderBottom = '1px solid var(--border-color, #334155)';
        heading.style.marginBottom = '6px';
        historyPanelList.appendChild(heading);
        labels.forEach((lbl, i) => {
            const li = document.createElement('li');
            li.textContent = lbl;
            li.style.padding = '9px 10px';
            li.style.marginBottom = '4px';
            li.style.borderRadius = '6px';
            li.style.cursor = 'pointer';
            li.style.background = 'var(--bg-surface-elevated, #273449)';
            li.style.position = 'relative';
            li.title = 'Jump back to this point (undo ' + (i + 1) + ' step(s))';
            li.addEventListener('click', () => {
                for (let j = 0; j <= i; j++) undoEditor();
                if (historyPanelToggle) historyPanelToggle.classList.remove('open');
            });
            historyPanelList.appendChild(li);
        });
        if (labels.length === 0) {
            const empty = document.createElement('li');
            empty.className = 'history-empty';
            empty.textContent = 'কোনো হিস্ট্রি নেই';
            historyPanelList.appendChild(empty);
        }
    }

    if (historyPanelToggle) {
        historyPanelToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            historyPanelToggle.classList.toggle('open');
            updateHistoryUI();
        });
        document.addEventListener('click', () => {
            historyPanelToggle.classList.remove('open');
            updateHistoryUI();
        });
    }

    // --- UI: clip speed, transition, ken burns, chroma ---
    const clipSpeedSlider = document.getElementById('clip-speed-slider');
    const clipSpeedVal = document.getElementById('clip-speed-val');
    const clipTransitionType = document.getElementById('clip-transition-type');
    const clipTransitionDuration = document.getElementById('clip-transition-duration');
    const clipTransitionDurationVal = document.getElementById('clip-transition-duration-val');
    const previewTransitionsToggle = document.getElementById('preview-transitions-toggle');
    const kenBurnsToggle = document.getElementById('ken-burns-toggle');
    const kenBurnsStartZoom = document.getElementById('ken-burns-start-zoom');
    const kenBurnsEndZoom = document.getElementById('ken-burns-end-zoom');
    const kenBurnsPan = document.getElementById('ken-burns-pan');
    const kenBurnsControls = document.getElementById('ken-burns-controls');
    const chromaKeyToggle = document.getElementById('chroma-key-toggle');
    const chromaKeyColor = document.getElementById('chroma-key-color');
    const chromaKeyThreshold = document.getElementById('chroma-key-threshold');
    const chromaKeyThresholdVal = document.getElementById('chroma-key-threshold-val');

    function getActiveClip() {
        return state.clips.find(c => c.id === state.activeClipId);
    }

    function syncPhase9ClipUI() {
        ensureAllClips();
        const clip = getActiveClip();
        const idx = getActiveClipIndex();
        const next = getNextClip(idx);
        const showTransition = idx >= 0 && idx < state.clips.length - 1;

        if (showTransition && next && next.transitionType !== 'none') {
            preloadTransitionVideo(next);
        }

        if (clipTransitionType) {
            clipTransitionType.disabled = !showTransition;
            clipTransitionType.value = showTransition && next ? (next.transitionType || 'none') : 'none';
        }
        if (clipTransitionDuration) {
            clipTransitionDuration.disabled = !showTransition || !next || next.transitionType === 'none';
            clipTransitionDuration.value = showTransition && next ? (next.transitionDuration || 0.5) : 0.5;
            if (clipTransitionDurationVal) {
                clipTransitionDurationVal.textContent = (parseFloat(clipTransitionDuration.value) || 0.5).toFixed(1) + 's';
            }
        }

        if (clipSpeedSlider && clip) {
            clipSpeedSlider.value = clip.speed || 1;
            if (clipSpeedVal) clipSpeedVal.textContent = (clip.speed || 1).toFixed(2) + 'x';
        }

        // Static Zoom & Position Sync
        const clipZoomSlider = document.getElementById('clip-zoom-slider');
        const clipZoomVal = document.getElementById('clip-zoom-val');
        const clipOffsetXSlider = document.getElementById('clip-offset-x-slider');
        const clipOffsetXVal = document.getElementById('clip-offset-x-val');
        const clipOffsetYSlider = document.getElementById('clip-offset-y-slider');
        const clipOffsetYVal = document.getElementById('clip-offset-y-val');

        if (clip && clipZoomSlider) {
            clipZoomSlider.value = clip.zoom || 100;
            if (clipZoomVal) clipZoomVal.textContent = (clip.zoom || 100) + '%';
        }
        if (clip && clipOffsetXSlider) {
            clipOffsetXSlider.value = clip.offsetX || 0;
            if (clipOffsetXVal) clipOffsetXVal.textContent = (clip.offsetX || 0) + '%';
        }
        if (clip && clipOffsetYSlider) {
            clipOffsetYSlider.value = clip.offsetY || 0;
            if (clipOffsetYVal) clipOffsetYVal.textContent = (clip.offsetY || 0) + '%';
        }

        const isImage = clip && clip.type === 'image';
        if (kenBurnsControls) kenBurnsControls.style.display = isImage ? 'block' : 'none';
        if (kenBurnsToggle && clip) kenBurnsToggle.checked = !!clip.kenBurnsEnabled;
        if (kenBurnsStartZoom && clip) kenBurnsStartZoom.value = clip.kenBurnsStartZoom || 100;
        if (kenBurnsEndZoom && clip) kenBurnsEndZoom.value = clip.kenBurnsEndZoom || 115;
        if (kenBurnsPan && clip) kenBurnsPan.value = clip.kenBurnsPan || 'right';

        if (chromaKeyToggle) chromaKeyToggle.checked = !!state.chromaKeyEnabled;
        if (chromaKeyColor) chromaKeyColor.value = state.chromaKeyColor || '#00ff00';
        if (chromaKeyThreshold) chromaKeyThreshold.value = state.chromaKeyThreshold || 45;
        if (chromaKeyThresholdVal) chromaKeyThresholdVal.textContent = String(state.chromaKeyThreshold || 45);
    }
    window.syncPhase9ClipUI = syncPhase9ClipUI;

    // Static Zoom & Position Bindings
    const clipZoomSlider = document.getElementById('clip-zoom-slider');
    const clipZoomVal = document.getElementById('clip-zoom-val');
    const clipOffsetXSlider = document.getElementById('clip-offset-x-slider');
    const clipOffsetXVal = document.getElementById('clip-offset-x-val');
    const clipOffsetYSlider = document.getElementById('clip-offset-y-slider');
    const clipOffsetYVal = document.getElementById('clip-offset-y-val');

    if (clipZoomSlider) {
        clipZoomSlider.addEventListener('input', (e) => {
            const clip = getActiveClip();
            if (!clip) return;
            clip.zoom = parseInt(e.target.value) || 100;
            if (clipZoomVal) clipZoomVal.textContent = clip.zoom + '%';
            if (window.drawEditorFrame) window.drawEditorFrame();
        });
        clipZoomSlider.addEventListener('change', () => recordEditorHistory('Clip zoom changed'));
    }

    if (clipOffsetXSlider) {
        clipOffsetXSlider.addEventListener('input', (e) => {
            const clip = getActiveClip();
            if (!clip) return;
            clip.offsetX = parseInt(e.target.value) || 0;
            if (clipOffsetXVal) clipOffsetXVal.textContent = clip.offsetX + '%';
            if (window.drawEditorFrame) window.drawEditorFrame();
        });
        clipOffsetXSlider.addEventListener('change', () => recordEditorHistory('Clip horizontal offset changed'));
    }

    if (clipOffsetYSlider) {
        clipOffsetYSlider.addEventListener('input', (e) => {
            const clip = getActiveClip();
            if (!clip) return;
            clip.offsetY = parseInt(e.target.value) || 0;
            if (clipOffsetYVal) clipOffsetYVal.textContent = clip.offsetY + '%';
            if (window.drawEditorFrame) window.drawEditorFrame();
        });
        clipOffsetYSlider.addEventListener('change', () => recordEditorHistory('Clip vertical offset changed'));
    }

    if (clipSpeedSlider) {
        clipSpeedSlider.addEventListener('input', (e) => {
            const clip = getActiveClip();
            if (!clip) return;
            clip.speed = parseFloat(e.target.value) || 1;
            if (clipSpeedVal) clipSpeedVal.textContent = clip.speed.toFixed(2) + 'x';
            if (clip.type !== 'image' && state.video) state.video.playbackRate = clip.speed;
            if (window.drawEditorFrame) window.drawEditorFrame();
        });
        clipSpeedSlider.addEventListener('change', () => recordEditorHistory('Clip speed changed'));
    }

    if (clipTransitionType) {
        clipTransitionType.addEventListener('focus', captureUndoCheckpoint);
        clipTransitionType.addEventListener('change', () => {
            const idx = getActiveClipIndex();
            const next = getNextClip(idx);
            if (!next) return;
            next.transitionType = clipTransitionType.value;
            if (clipTransitionDuration) clipTransitionDuration.disabled = next.transitionType === 'none';
            if (next.transitionType !== 'none') preloadTransitionVideo(next);
            recordEditorHistory('Clip transition changed');
            if (window.drawEditorFrame) window.drawEditorFrame();
        });
    }

    if (clipTransitionDuration) {
        clipTransitionDuration.addEventListener('focus', captureUndoCheckpoint);
        clipTransitionDuration.addEventListener('input', (e) => {
            const idx = getActiveClipIndex();
            const next = getNextClip(idx);
            if (!next) return;
            next.transitionDuration = parseFloat(e.target.value) || 0.5;
            if (clipTransitionDurationVal) clipTransitionDurationVal.textContent = next.transitionDuration.toFixed(1) + 's';
        });
        clipTransitionDuration.addEventListener('change', () => recordEditorHistory('Transition duration changed'));
    }

    if (previewTransitionsToggle) {
        previewTransitionsToggle.addEventListener('change', (e) => {
            state.previewTransitionsEnabled = e.target.checked;
        });
    }

    function bindKenBurnsControl(el, prop, label) {
        if (!el) return;
        el.addEventListener('input', () => {
            const clip = getActiveClip();
            if (!clip || clip.type !== 'image') return;
            if (prop === 'enabled') clip.kenBurnsEnabled = el.checked;
            else if (prop === 'start') clip.kenBurnsStartZoom = parseFloat(el.value) || 100;
            else if (prop === 'end') clip.kenBurnsEndZoom = parseFloat(el.value) || 115;
            else if (prop === 'pan') clip.kenBurnsPan = el.value;
            if (window.drawEditorFrame) window.drawEditorFrame();
        });
        el.addEventListener('change', () => recordEditorHistory(label));
    }
    bindKenBurnsControl(kenBurnsToggle, 'enabled', 'Ken Burns toggled');
    bindKenBurnsControl(kenBurnsStartZoom, 'start', 'Ken Burns start zoom');
    bindKenBurnsControl(kenBurnsEndZoom, 'end', 'Ken Burns end zoom');
    bindKenBurnsControl(kenBurnsPan, 'pan', 'Ken Burns pan');

    if (chromaKeyToggle) {
        chromaKeyToggle.addEventListener('change', (e) => {
            state.chromaKeyEnabled = e.target.checked;
            recordEditorHistory('Chroma key toggled');
            if (window.drawEditorFrame) window.drawEditorFrame();
        });
    }
    if (chromaKeyColor) {
        chromaKeyColor.addEventListener('input', (e) => {
            state.chromaKeyColor = e.target.value;
            if (window.drawEditorFrame) window.drawEditorFrame();
        });
        chromaKeyColor.addEventListener('change', () => recordEditorHistory('Chroma key color'));
    }
    if (chromaKeyThreshold) {
        chromaKeyThreshold.addEventListener('input', (e) => {
            state.chromaKeyThreshold = parseInt(e.target.value, 10) || 45;
            if (chromaKeyThresholdVal) chromaKeyThresholdVal.textContent = String(state.chromaKeyThreshold);
            if (window.drawEditorFrame) window.drawEditorFrame();
        });
        chromaKeyThreshold.addEventListener('change', () => recordEditorHistory('Chroma key threshold'));
    }

    // --- Ken Burns transform ---
    function applyKenBurnsTransform(drawX, drawY, drawW, drawH, clip, effectiveTime) {
        if (!clip || clip.type !== 'image' || !clip.kenBurnsEnabled) {
            return { drawX, drawY, drawW, drawH };
        }
        const span = Math.max(0.01, (state.endTime || clip.end) - (state.startTime || clip.start));
        const t = Math.max(0, Math.min(1, (effectiveTime - state.startTime) / span));
        const startZ = (clip.kenBurnsStartZoom || 100) / 100;
        const endZ = (clip.kenBurnsEndZoom || 115) / 100;
        const z = startZ + (endZ - startZ) * t;
        const panPx = (z - 1) * Math.min(drawW, drawH) * 0.35;
        let ox = 0, oy = 0;
        const pan = clip.kenBurnsPan || 'right';
        if (pan === 'left') ox = -panPx * t;
        else if (pan === 'right') ox = panPx * t;
        else if (pan === 'up') oy = -panPx * t;
        else if (pan === 'down') oy = panPx * t;
        const nw = drawW * z;
        const nh = drawH * z;
        const nx = drawX - (nw - drawW) / 2 + ox;
        const ny = drawY - (nh - drawH) / 2 + oy;
        return { drawX: nx, drawY: ny, drawW: nw, drawH: nh };
    }

    // --- Static Zoom/Position and Ken Burns combined helper ---
    function applyStaticAndDynamicTransform(baseDrawX, baseDrawY, baseDrawW, baseDrawH, clip, effectiveTime) {
        // clip can be undefined for a stray frame if state.activeClipId momentarily
        // doesn't match anything in state.clips (e.g. a race with the preview loop
        // during export). Fall back to the un-transformed rect instead of crashing.
        if (!clip) return { drawX: baseDrawX, drawY: baseDrawY, drawW: baseDrawW, drawH: baseDrawH };
        ensureClipDefaults(clip);
        let drawX = baseDrawX, drawY = baseDrawY, drawW = baseDrawW, drawH = baseDrawH;

        // 1. Static clip zoom and positions (both video and image)
        const zoom = (clip.zoom || 100) / 100;
        const offsetX = clip.offsetX || 0;
        const offsetY = clip.offsetY || 0;

        if (zoom !== 1 || offsetX !== 0 || offsetY !== 0) {
            drawW = baseDrawW * zoom;
            drawH = baseDrawH * zoom;
            drawX = baseDrawX - (drawW - baseDrawW) / 2 + (offsetX * baseDrawW / 100);
            drawY = baseDrawY - (drawH - baseDrawH) / 2 + (offsetY * baseDrawH / 100);
        }

        // 2. Ken Burns zoom/pan (only image clips)
        const kb = applyKenBurnsTransform(drawX, drawY, drawW, drawH, clip, effectiveTime);
        return kb;
    }
    window.phase9ApplyStaticAndDynamicTransform = applyStaticAndDynamicTransform;

    // --- Chroma key (preview quality: half resolution) ---
    function parseChromaRGB(hex) {
        const safe = String(hex || '#00ff00').replace('#', '');
        const v = parseInt(safe.length === 3 ? safe.split('').map(c => c + c).join('') : safe, 16);
        return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
    }

    function applyChromaKeyToImageData(imageData, keyColor, threshold) {
        const key = parseChromaRGB(keyColor);
        const data = imageData.data;
        const thresh = threshold * threshold;
        for (let i = 0; i < data.length; i += 4) {
            const dr = data[i] - key.r;
            const dg = data[i + 1] - key.g;
            const db = data[i + 2] - key.b;
            if (dr * dr + dg * dg + db * db < thresh) {
                data[i + 3] = 0;
            }
        }
        return imageData;
    }

    function drawMediaWithChroma(ctx, mediaSource, sx, sy, sw, sh, drawX, drawY, drawW, drawH, isFullCanvas) {
        if (!state.chromaKeyEnabled) {
            ctx.drawImage(mediaSource, sx, sy, sw, sh, drawX, drawY, drawW, drawH);
            return;
        }
        const scale = state.chromaKeyPreviewQuality ? 0.5 : 1;
        const tw = Math.max(2, Math.round(drawW * scale));
        const th = Math.max(2, Math.round(drawH * scale));
        transitionCanvas.width = tw;
        transitionCanvas.height = th;
        transitionCtx.clearRect(0, 0, tw, th);
        transitionCtx.drawImage(mediaSource, sx, sy, sw, sh, 0, 0, tw, th);
        try {
            const id = transitionCtx.getImageData(0, 0, tw, th);
            applyChromaKeyToImageData(id, state.chromaKeyColor, state.chromaKeyThreshold);
            transitionCtx.putImageData(id, 0, 0);
            ctx.drawImage(transitionCanvas, 0, 0, tw, th, drawX, drawY, drawW, drawH);
        } catch (err) {
            ctx.drawImage(mediaSource, sx, sy, sw, sh, drawX, drawY, drawW, drawH);
        }
    }

    // --- Clip-to-clip transition state for drawFrame hook ---
    let transitionBlend = null;

    function computeTransitionBlend(effectiveTime, activeClip, clipIndex) {
        transitionBlend = null;
        if (!state.previewTransitionsEnabled && state.customExportTime === undefined) return;
        const next = getNextClip(clipIndex);
        if (!activeClip || !next || !next.transitionType || next.transitionType === 'none') return;

        const transDur = Math.min(next.transitionDuration || 0.5, Math.max(0.2, (activeClip.end - activeClip.start) * 0.4));
        const zoneStart = activeClip.end - transDur;
        if (effectiveTime < zoneStart || effectiveTime > activeClip.end + 0.001) return;

        const p = Math.max(0, Math.min(1, (effectiveTime - zoneStart) / transDur));
        transitionBlend = {
            type: next.transitionType,
            progress: p,
            outgoing: activeClip,
            incoming: next,
            incomingTime: next.start + (effectiveTime - zoneStart)
        };
    }

    let transitionSeekInFlight = false;
    let pendingTransitionSeek = null;
    let liveTransitionKey = null;

    async function seekTransitionVideo(url, time) {
        if (transitionVideoEl.src !== url) {
            transitionVideoEl.src = url;
            transitionVideoEl.load();
            await new Promise(r => { transitionVideoEl.onloadeddata = r; setTimeout(r, 2000); });
        }
        transitionVideoEl.currentTime = Math.max(0, time);
        await new Promise(r => {
            const done = () => { transitionVideoEl.removeEventListener('seeked', done); r(); };
            transitionVideoEl.addEventListener('seeked', done);
            setTimeout(done, 500);
        });
    }

    function requestTransitionFrame(url, time, shouldPlay = false, playbackRate = 1) {
        pendingTransitionSeek = { url, time, shouldPlay, playbackRate };
        if (transitionSeekInFlight) return;
        transitionSeekInFlight = true;
        const run = async () => {
            try {
                while (pendingTransitionSeek) {
                    const request = pendingTransitionSeek;
                    pendingTransitionSeek = null;
                    await seekTransitionVideo(request.url, request.time);
                    if (request.shouldPlay && state.isPlaying) {
                        transitionVideoEl.playbackRate = playbackRate || 1;
                        transitionVideoEl.play().catch(() => {});
                    }
                    if (state.isPlaying && window.drawEditorFrame) window.drawEditorFrame();
                }
            } finally {
                transitionSeekInFlight = false;
                if (pendingTransitionSeek) {
                    const nextRequest = pendingTransitionSeek;
                    pendingTransitionSeek = null;
                    requestTransitionFrame(nextRequest.url, nextRequest.time, nextRequest.shouldPlay, nextRequest.playbackRate);
                }
            }
        };
        run();
    }

    function preloadTransitionVideo(clip) {
        if (!clip || clip.type === 'image' || !clip.url) return;
        if (transitionVideoEl.src !== clip.url) {
            transitionVideoEl.src = clip.url;
            transitionVideoEl.load();
            requestTransitionFrame(clip.url, clip.start || 0);
        }
    }

    function startLiveTransition(incoming, incomingTime) {
        if (!incoming || incoming.type === 'image' || !incoming.url) return;
        const key = `${incoming.id}:${incomingTime.toFixed(3)}`;
        if (liveTransitionKey) return;
        liveTransitionKey = key;
        requestTransitionFrame(incoming.url, incomingTime, true, incoming.speed || 1);
    }

    window.phase9PrepareTransitionFrame = async function (activeClip, effectiveTime) {
        if (!activeClip || !state.clips || !state.clips.length) return;
        const clipIndex = state.clips.findIndex(c => c.id === activeClip.id);
        const next = getNextClip(clipIndex);
        if (!next || next.type === 'image' || !next.url || !next.transitionType || next.transitionType === 'none') return;

        const duration = Math.min(next.transitionDuration || 0.5, Math.max(0.2, (activeClip.end - activeClip.start) * 0.4));
        const zoneStart = activeClip.end - duration;
        if (effectiveTime < zoneStart || effectiveTime > activeClip.end + 0.001) return;
        await seekTransitionVideo(next.url, next.start + (effectiveTime - zoneStart));
    };

    /**
     * Called from editor.js drawFrame instead of plain drawImage when phase9 is active.
     */
    window.phase9DrawMainMedia = function (ctx, mediaSource, sx, sy, sw, sh, baseDrawX, baseDrawY, baseDrawW, baseDrawH, activeClip, effectiveTime, videoW, videoH) {
        ensureClipDefaults(activeClip);
        const clipIndex = getActiveClipIndex();
        computeTransitionBlend(effectiveTime, activeClip, clipIndex);

        const outKb = applyStaticAndDynamicTransform(baseDrawX, baseDrawY, baseDrawW, baseDrawH, activeClip, effectiveTime);
        const drawOutgoing = () => drawMediaWithChroma(ctx, mediaSource, sx, sy, sw, sh, outKb.drawX, outKb.drawY, outKb.drawW, outKb.drawH);

        if (!transitionBlend || transitionBlend.type === 'none') {
            liveTransitionKey = null;
            if (!transitionVideoEl.paused) transitionVideoEl.pause();
            drawOutgoing();
            return;
        }

        const p = transitionBlend.progress;
        const type = transitionBlend.type;
        const incoming = transitionBlend.incoming;
        const incKb = applyStaticAndDynamicTransform(baseDrawX, baseDrawY, baseDrawW, baseDrawH, incoming, transitionBlend.incomingTime);
        const drawIncoming = () => {
            if (incoming.type === 'image' && incoming.imageImg) {
                drawMediaWithChroma(ctx, incoming.imageImg, 0, 0, incoming.imageImg.naturalWidth, incoming.imageImg.naturalHeight, incKb.drawX, incKb.drawY, incKb.drawW, incKb.drawH);
            } else if (transitionVideoEl.readyState >= 2) {
                const inSx = (incoming.cropX || 0) * (transitionVideoEl.videoWidth || videoW);
                const inSy = (incoming.cropY || 0) * (transitionVideoEl.videoHeight || videoH);
                const inSw = (incoming.cropW != null ? incoming.cropW : 1) * (transitionVideoEl.videoWidth || videoW);
                const inSh = (incoming.cropH != null ? incoming.cropH : 1) * (transitionVideoEl.videoHeight || videoH);
                drawMediaWithChroma(ctx, transitionVideoEl, inSx, inSy, inSw, inSh, incKb.drawX, incKb.drawY, incKb.drawW, incKb.drawH);
            }
        };
        if (state.isPlaying && state.customExportTime === undefined) {
            startLiveTransition(incoming, transitionBlend.incomingTime);
        }

        if (type === 'dip_black') {
            ctx.save();
            ctx.globalAlpha = 1 - p;
            drawOutgoing();
            ctx.restore();
            ctx.save();
            ctx.fillStyle = '#000';
            ctx.globalAlpha = p < 0.5 ? p * 2 : (1 - p) * 2;
            ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);
            ctx.restore();
            if (p > 0.5) {
                ctx.save();
                ctx.globalAlpha = (p - 0.5) * 2;
                drawIncoming();
                ctx.restore();
            }
            return;
        }

        if (['zoom_in', 'zoom_out', 'spin_in', 'spin_out', 'zoom_rotate'].includes(type)) {
            let scale = 1;
            let rotation = 0;
            if (type === 'zoom_in') scale = 0.2 + (0.8 * p);
            else if (type === 'zoom_out') scale = 1.65 - (0.65 * p);
            else if (type === 'spin_in') {
                scale = 0.35 + (0.65 * p);
                rotation = (1 - p) * Math.PI * 2;
            } else if (type === 'spin_out') {
                scale = 1.55 - (0.55 * p);
                rotation = -(1 - p) * Math.PI * 2;
            } else {
                scale = 0.2 + (0.8 * p);
                rotation = -(1 - p) * Math.PI * 2;
            }
            ctx.save();
            drawOutgoing();
            ctx.restore();
            ctx.save();
            ctx.globalAlpha = p;
            ctx.translate(state.canvas.width / 2, state.canvas.height / 2);
            ctx.scale(scale, scale);
            ctx.rotate(rotation);
            ctx.translate(-state.canvas.width / 2, -state.canvas.height / 2);
            drawIncoming();
            ctx.restore();
            return;
        }

        // Crossfade / push / wipe — draw outgoing then incoming with composite
        ctx.save();
        if (type === 'crossfade') ctx.globalAlpha = 1 - p;
        else if (type === 'push_right') ctx.translate(-baseDrawW * p, 0);
        else if (type === 'push_left') ctx.translate(baseDrawW * p, 0);
        drawOutgoing();
        ctx.restore();

        ctx.save();
        if (type === 'crossfade') ctx.globalAlpha = p;
        else if (type === 'push_right') ctx.translate(baseDrawW * (1 - p), 0);
        else if (type === 'push_left') ctx.translate(-baseDrawW * (1 - p), 0);
        else if (type === 'wipe_right') {
            ctx.beginPath();
            ctx.rect(0, 0, state.canvas.width * p, state.canvas.height);
            ctx.clip();
        } else if (type === 'wipe_left') {
            ctx.beginPath();
            ctx.rect(state.canvas.width * (1 - p), 0, state.canvas.width * p, state.canvas.height);
            ctx.clip();
        }

        drawIncoming();
        ctx.restore();
    };

    // Apply playback rate when switching clips
    const origSwitch = window.switchActiveClipGlobal;
    if (typeof origSwitch === 'function') {
        window.switchActiveClipGlobal = function (...args) {
            origSwitch.apply(this, args);
            liveTransitionKey = null;
            const clip = getActiveClip();
            if (clip && clip.type !== 'image' && state.video) {
                state.video.playbackRate = clip.speed || 1;
            }
            syncPhase9ClipUI();
        };
    }

    // Keyboard undo/redo
    window.addEventListener('keydown', (e) => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return;
        if (e.ctrlKey || e.metaKey) {
            if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
                e.preventDefault();
                undoEditor();
            } else if (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey)) {
                e.preventDefault();
                redoEditor();
            }
        }
    });

    // --- SRT / VTT export ---
    function formatSrtTime(sec) {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = Math.floor(sec % 60);
        const ms = Math.round((sec % 1) * 1000);
        return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + ',' + String(ms).padStart(3, '0');
    }

    function formatVttTime(sec) {
        return formatSrtTime(sec).replace(',', '.');
    }

    function getTimelineOffsetBeforeClip(clipIndex) {
        let t = 0;
        for (let i = 0; i < clipIndex; i++) {
            t += getClipPlayDuration(state.clips[i]);
            const next = state.clips[i + 1];
            if (next && next.transitionType && next.transitionType !== 'none') {
                t -= Math.min(next.transitionDuration || 0.5, getClipPlayDuration(state.clips[i]) * 0.4);
            }
        }
        return t;
    }

    function exportSubtitles(format) {
        if (!state.subtitles || state.subtitles.length === 0) {
            alert('কোনো সাবটাইটেল নেই — আগে Auto Subtitle দিয়ে তৈরি করুন।');
            return;
        }
        const clipIndex = getActiveClipIndex();
        const offset = clipIndex >= 0 ? getTimelineOffsetBeforeClip(clipIndex) : 0;
        let body = '';
        if (format === 'vtt') body += 'WEBVTT\n\n';
        state.subtitles.forEach((sub, i) => {
            const start = offset + (sub.startSec || 0);
            const end = offset + (sub.endSec || start + 2);
            const text = (sub.text || '').trim();
            if (!text) return;
            if (format === 'srt') {
                body += (i + 1) + '\n';
                body += formatSrtTime(start) + ' --> ' + formatSrtTime(end) + '\n';
                body += text + '\n\n';
            } else {
                body += formatVttTime(start) + ' --> ' + formatVttTime(end) + '\n';
                body += text + '\n\n';
            }
        });
        const blob = new Blob([body], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = format === 'srt' ? 'subtitles.srt' : 'subtitles.vtt';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }

    const exportSrtBtn = document.getElementById('export-srt-btn');
    const exportVttBtn = document.getElementById('export-vtt-btn');
    if (exportSrtBtn) exportSrtBtn.addEventListener('click', () => exportSubtitles('srt'));
    if (exportVttBtn) exportVttBtn.addEventListener('click', () => exportSubtitles('vtt'));

    // --- History capture for the rest of the editor (plan 9-2) ---
    // The editor's own controls don't call recordEditorHistory, so we capture
    // committed ("change") events on known editor inputs via delegation. This
    // keeps Undo/Redo consistent across filters, trims, overlays, banners, etc.
    // We deliberately ignore "input" (live drag) events to avoid flooding the
    // stack, and we skip the phase9 controls which already record on change.
    const PHASE9_CONTROL_IDS = new Set([
        'clip-speed-slider', 'clip-transition-type', 'clip-transition-duration',
        'ken-burns-toggle', 'ken-burns-start-zoom', 'ken-burns-end-zoom', 'ken-burns-pan',
        'chroma-key-toggle', 'chroma-key-color', 'chroma-key-threshold',
        'clip-zoom-slider', 'clip-offset-x-slider', 'clip-offset-y-slider'
    ]);

    function historyLabelFor(el) {
        const id = el.id || '';
        const labelMap = {
            'filter-preset': 'Filter changed',
            'intro-transition-type': 'Intro transition changed',
            'banner-style': 'Banner changed',
            'ticker-text': 'News ticker changed',
            'progress-bar-toggle': 'Progress bar toggled',
            'logo-input': 'Logo changed',
            'color-grade-toggle': 'Color grading toggled',
            'start-time': 'Trim changed',
            'end-time': 'Trim changed',
            'add-clip-input': 'Clip added',
            'split-clip-btn': 'Clip split',
            'freeze-frame-btn': 'Freeze frame added',
            'bgmusic-volume-slider': 'Music volume changed',
            'broll-input': 'B-roll image added',
            'broll-anim-style': 'B-roll animation changed',
            'subtitle-enabled-toggle': 'Subtitle toggled',
            'intro-enabled-toggle': 'Intro toggled',
            'outro-enabled-toggle': 'Outro toggled',

            // Sliders
            'video-volume-slider': 'Video volume changed',
            'video-volume-slider-step2': 'Video volume changed',
            'logo-size-slider': 'Logo size changed',
            'logo-opacity-slider': 'Logo opacity changed',
            'brightness-slider': 'Brightness changed',
            'contrast-slider': 'Contrast changed',
            'saturation-slider': 'Saturation changed',

            // Toggle switches (previously fell through to the generic
            // 'Change' label because their <label> wrapper has no text,
            // just the visual slider — that's why the history list showed
            // duplicate unlabeled "Change" rows).
            'crop-tool-toggle': 'Crop tool toggled',
            'preview-transitions-toggle': 'Preview transitions toggled',
            'blur-tool-toggle': 'Blur tool toggled',
            'ticker-enable-toggle': 'News ticker toggled',
            'highlight-tool-toggle': 'Highlight tool toggled',
            'fill-tool-toggle': 'Background fill tool toggled',
            'broll-text-bg-enabled': 'B-roll text background toggled',
            'broll-text-highlight-enabled': 'B-roll text highlight toggled',
            'broll-transparent-bg': 'B-roll transparent background toggled',
            'broll-edit-text-bg-enabled': 'B-roll text background toggled',
            'broll-edit-text-highlight-enabled': 'B-roll text highlight toggled',
            'noise-cancel-toggle': 'Noise cancellation toggled',
            'ai-denoise-toggle': 'AI denoise toggled',
            'bgmusic-ducking-toggle': 'Music ducking toggled',
            'voice-changer-apply-video-toggle': 'Voice changer apply-to-video toggled',
            'subtitle-highlight-toggle': 'Subtitle word highlight toggled',
            'subtitle-bgpill-toggle': 'Subtitle background pill toggled',
            'addaudio-shortest-toggle': 'Match shortest track toggled'
        };
        if (labelMap[id]) return labelMap[id];
        const lbl = el.closest('label');
        if (lbl && lbl.textContent && lbl.textContent.trim()) return lbl.textContent.trim().slice(0, 40);
        // Last-resort fallback: never show a bare, indistinguishable "Change".
        // Include the element's id (or type) so different unmapped controls
        // are still told apart in the history list.
        return id ? ('Setting changed (' + id + ')') : ((el.type || el.tagName || 'Setting') + ' changed');
    }

    document.addEventListener('change', (e) => {
        const el = e.target;
        if (!el || !el.id) return;
        if (PHASE9_CONTROL_IDS.has(el.id)) return; // recorded by phase9 itself
        // Only record meaningful committed changes on inputs/selects/checkboxes
        const tag = el.tagName;
        if (tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA') return;
        if (el.type === 'range' && (el.id === 'seek-slider' || el.id === 'preview-volume-slider')) return;
        
        setTimeout(() => {
            recordEditorHistory(historyLabelFor(el));
        }, 50);
    }, true);

    // Trim sliders (range) fire "change" on release — capture those commits.
    ['start-time', 'end-time'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => recordEditorHistory('Trim changed'));
    });
    const trimRangeStart = document.getElementById('trim-start');
    const trimRangeEnd = document.getElementById('trim-end');
    if (trimRangeStart) trimRangeStart.addEventListener('change', () => recordEditorHistory('Trim changed'));
    if (trimRangeEnd) trimRangeEnd.addEventListener('change', () => recordEditorHistory('Trim changed'));

    // --- Multi-Aspect Batch Export (plan 9-6) ---
    function computeCanvasDimsForRatio(ratio) {
        const videoWidth = state.video ? state.video.videoWidth : 640;
        const videoHeight = state.video ? state.video.videoHeight : 360;
        const cw = (state.cropW || 1) * videoWidth;
        const ch = (state.cropH || 1) * videoHeight;
        let targetWidth = 640, targetHeight = 480;
        switch (ratio) {
            case 'original': targetWidth = cw; targetHeight = ch; break;
            case '1-1': targetWidth = Math.max(cw, ch); targetHeight = targetWidth; break;
            case '4-5': targetHeight = Math.max(cw, ch); targetWidth = (targetHeight * 4) / 5; break;
            case '9-16': targetHeight = Math.max(cw, ch); targetWidth = (targetHeight * 9) / 16; break;
            case '16-9': targetWidth = Math.max(cw, ch); targetHeight = (targetWidth * 9) / 16; break;
        }
        const maxBoundary = 1080;
        if (targetWidth > maxBoundary || targetHeight > maxBoundary) {
            const r = targetWidth / targetHeight;
            if (targetWidth > targetHeight) { targetWidth = maxBoundary; targetHeight = maxBoundary / r; }
            else { targetHeight = maxBoundary; targetWidth = maxBoundary * r; }
        }
        return { w: Math.round(targetWidth), h: Math.round(targetHeight) };
    }

    async function runMultiAspectExport(ratios) {
        if (typeof window.runExportPipeline !== 'function') {
            alert('রেন্ডার পাইপলাইন লোড হয়নি। পেজ রিফ্রেশ করুন।');
            return;
        }
        if (!state.duration || !state.clips || state.clips.length === 0) {
            alert('এক্সপোর্ট করার আগে একটি ভিডিও লোড করুন।');
            return;
        }
        // Save editor layout so we can restore afterward
        const savedAspect = state.aspectRatio;
        const savedCanvasW = state.canvas.width;
        const savedCanvasH = state.canvas.height;
        const savedActiveClipId = state.activeClipId;
        const savedClipCount = state.clips.length;

        for (let i = 0; i < ratios.length; i++) {
            const ratio = ratios[i];
            state.aspectRatio = ratio;
            const dims = computeCanvasDimsForRatio(ratio);
            state.canvas.width = dims.w;
            state.canvas.height = dims.h;
            if (window.syncPhase9ClipUI) window.syncPhase9ClipUI();
            if (window.drawEditorFrame) window.drawEditorFrame();

            const statusEl = document.getElementById('multi-aspect-current');
            if (statusEl) {
                statusEl.style.display = 'block';
                statusEl.innerText = `রেন্ডার হচ্ছে (${i + 1}/${ratios.length}): ${ratio} — ${dims.w}x${dims.h}`;
            }
            setProgressSafe(10 + Math.round((i / ratios.length) * 80));

            const totalDuration = state.clips.reduce((sum, c) => {
                const speed = Math.max(0.5, Math.min(2, Number(c.speed) || 1));
                return sum + (Math.max(0, c.end - c.start) / speed);
            }, 0);
            await window.runExportPipeline(totalDuration, true, `video_${ratio}`, i + 1, ratios.length);
        }

        // Restore editor layout
        state.aspectRatio = savedAspect;
        state.canvas.width = savedCanvasW;
        state.canvas.height = savedCanvasH;
        state.activeClipId = savedActiveClipId;
        if (window.syncPhase9ClipUI) window.syncPhase9ClipUI();
        if (window.drawEditorFrame) window.drawEditorFrame();
        const statusEl = document.getElementById('multi-aspect-current');
        if (statusEl) statusEl.style.display = 'none';
    }

    function setProgressSafe(pct) {
        const fill = document.getElementById('render-progress-fill');
        const txt = document.getElementById('render-percentage');
        if (fill) fill.style.width = pct + '%';
        if (txt) txt.innerText = pct + '%';
    }

    const multiAspectCheckboxes = document.querySelectorAll('.multi-aspect-checkbox');
    const multiAspectBtn = document.getElementById('multi-aspect-export-btn');
    const multiAspectCount = document.getElementById('multi-aspect-count');
    function updateMultiAspectCount() {
        if (!multiAspectCount || !multiAspectBtn) return;
        const n = [...multiAspectCheckboxes].filter(c => c.checked).length;
        multiAspectCount.textContent = String(n);
        multiAspectBtn.disabled = n === 0;
    }
    multiAspectCheckboxes.forEach(c => c.addEventListener('change', updateMultiAspectCount));
    if (multiAspectBtn) {
        multiAspectBtn.addEventListener('click', () => {
            const ratios = [...multiAspectCheckboxes].filter(c => c.checked).map(c => c.value);
            if (ratios.length === 0) return;
            multiAspectBtn.disabled = true;
            runMultiAspectExport(ratios).finally(() => {
                updateMultiAspectCount();
            });
        });
    }

    // --- Multi-aspect batch export (exposed for exporter.js) ---
    window.phase9GetClipPlayDuration = getClipPlayDuration;
    window.phase9EnsureClipDefaults = ensureClipDefaults;
    window.phase9TransitionVideoEl = transitionVideoEl;
    window.phase9DrawMediaWithChroma = drawMediaWithChroma;
    window.phase9ApplyKenBurns = applyKenBurnsTransform;
    window.phase9GetTimelineOffsetBeforeClip = getTimelineOffsetBeforeClip;

    ensureAllClips();
    syncPhase9ClipUI();

    // Initial history snapshot after first clip load
    setTimeout(() => {
        if (state.clips.length > 0 && state.undoStack.length === 0) {
            recordEditorHistory('Initial state');
            state.undoStack.pop();
            state.historyLabels.pop();
        }
    }, 2500);
});
