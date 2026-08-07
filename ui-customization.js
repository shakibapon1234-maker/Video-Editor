// ============================================================
// UI Customization: Collapsible Sidebar, Collapsible Top Bar,
// and a Floating/Draggable Playhead (transport) control.
//
// This file is fully additive/standalone — it does not modify
// editor.js. It only reads/forwards events to the existing
// #seek-slider / #play-pause-btn elements so all real playback
// logic (already implemented in editor.js) keeps working exactly
// as before; this just gives the user a second, movable "remote
// control" for it, plus the ability to collapse chrome to get
// more working space (like Premiere/CapCut/etc do).
// ============================================================

(function () {
    'use strict';

    const LS_SIDEBAR = 'studioflow-sidebar-collapsed';
    const LS_HEADER = 'studioflow-header-collapsed';
    const LS_FT_VISIBLE = 'studioflow-floating-transport-visible';
    const LS_FT_POS = 'studioflow-floating-transport-pos';

    function ready(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn);
        } else {
            fn();
        }
    }

    ready(function () {
        setupSidebarToggle();
        setupHeaderToggle();
        setupFloatingTransport();
        setupAlwaysOnTopPin();
    });

    // ---------------------------------------------------------
    // 1) Collapsible Sidebar
    // ---------------------------------------------------------
    function setupSidebarToggle() {
        const sidebar = document.getElementById('app-sidebar');
        const btn = document.getElementById('sidebar-toggle-btn');
        if (!sidebar || !btn) return;

        try {
            if (localStorage.getItem(LS_SIDEBAR) === '1') {
                sidebar.classList.add('collapsed');
            }
        } catch (e) {}

        btn.addEventListener('click', function () {
            sidebar.classList.toggle('collapsed');
            try {
                localStorage.setItem(LS_SIDEBAR, sidebar.classList.contains('collapsed') ? '1' : '0');
            } catch (e) {}
        });
    }

    // ---------------------------------------------------------
    // 2) Collapsible Top Bar (workspace-header)
    // ---------------------------------------------------------
    function setupHeaderToggle() {
        const header = document.getElementById('app-workspace-header');
        const tab = document.getElementById('header-collapse-toggle');
        if (!header || !tab) return;

        function applyIcon() {
            const icon = tab.querySelector('i');
            if (!icon) return;
            icon.className = header.classList.contains('collapsed')
                ? 'fa-solid fa-chevron-down'
                : 'fa-solid fa-chevron-up';
        }

        try {
            if (localStorage.getItem(LS_HEADER) === '1') {
                header.classList.add('collapsed');
            }
        } catch (e) {}
        applyIcon();

        tab.addEventListener('click', function () {
            header.classList.toggle('collapsed');
            try {
                localStorage.setItem(LS_HEADER, header.classList.contains('collapsed') ? '1' : '0');
            } catch (e) {}
            applyIcon();
        });
    }

    // ---------------------------------------------------------
    // 3) Floating / Draggable Playhead (Transport) Widget
    //    Mirrors the real #seek-slider / #play-pause-btn so the
    //    user has a small movable remote control that stays on
    //    screen no matter how far they scroll the clip list.
    // ---------------------------------------------------------
    function setupFloatingTransport() {
        const panel = document.getElementById('floating-transport');
        const toggleBtn = document.getElementById('floating-transport-toggle-btn');
        const closeBtn = document.getElementById('floating-transport-close');
        const handle = document.getElementById('floating-transport-handle');
        if (!panel || !toggleBtn) return;

        const ftPlayBtn = document.getElementById('ft-play-btn');
        const ftPlayIcon = document.getElementById('ft-play-icon');
        const ftSlider = document.getElementById('ft-seek-slider');
        const ftFill = document.getElementById('ft-seek-fill');
        const ftCurrent = document.getElementById('ft-current-time');
        const ftTotal = document.getElementById('ft-total-time');

        // Floating canvas window integrated controls
        const cfPlayBtn = document.getElementById('cf-play-btn');
        const cfPlayIcon = document.getElementById('cf-play-icon');
        const cfHeaderPlayBtn = document.getElementById('cf-header-play-btn');
        const cfHeaderPlayIcon = document.getElementById('cf-header-play-icon');
        const cfRewindBtn = document.getElementById('cf-rewind-btn');
        const cfForwardBtn = document.getElementById('cf-forward-btn');
        const cfSlider = document.getElementById('cf-seek-slider');
        const cfFill = document.getElementById('cf-seek-fill');
        const cfCurrent = document.getElementById('cf-current-time');
        const cfTotal = document.getElementById('cf-total-time');

        // The real, already-working controls in the main preview panel.
        const realPlayBtn = document.getElementById('play-pause-btn');
        const realSlider = document.getElementById('seek-slider');
        const realCurrent = document.getElementById('seek-current-time');
        const realTotal = document.getElementById('seek-total-time');

        // Clamp to viewport — call only while panel is visible (hidden elements
        // report 0x0 and corrupt saved position).
        function clampToViewport() {
            if (!panel.classList.contains('visible')) return;
            const panelW = panel.offsetWidth || 310;
            const panelH = panel.offsetHeight || 80;
            const maxLeft = Math.max(8, window.innerWidth  - panelW - 8);
            const maxTop  = Math.max(8, window.innerHeight - panelH - 8);
            let left = parseFloat(panel.style.left);
            let top  = parseFloat(panel.style.top);
            if (!isFinite(left) || left < 0 || left > window.innerWidth)  left = Math.max(8, window.innerWidth  - 332);
            if (!isFinite(top)  || top  < 0 || top  > window.innerHeight) top  = 110;
            left = Math.min(Math.max(8, left), maxLeft);
            top  = Math.min(Math.max(8, top),  maxTop);
            panel.style.left  = left + 'px';
            panel.style.top   = top  + 'px';
            panel.style.right = 'auto';
        }

        const canvasContainer = document.getElementById('canvas-container');
        const canvasHeader = document.getElementById('canvas-floating-header');
        const dockPlaceholder = document.getElementById('preview-panel-dock-placeholder');
        const cfCloseBtn = document.getElementById('cf-close-btn');

        // Remember original parent so we can restore when undocked
        let originalTransportParent = panel.parentNode;
        let originalTransportNextSibling = panel.nextSibling;

        function setVisible(visible) {
            panel.style.display = visible ? 'flex' : 'none';
            panel.classList.toggle('visible', visible);
            toggleBtn.classList.toggle('active', visible);
            try { localStorage.setItem(LS_FT_VISIBLE, visible ? '1' : '0'); } catch (e) {}

            if (canvasContainer) {
                canvasContainer.classList.toggle('is-floating-preview', visible);
                if (!visible) {
                    // Completely clear all inline positioning styles applied during dragging
                    canvasContainer.style.left = '';
                    canvasContainer.style.top = '';
                    canvasContainer.style.right = '';
                    canvasContainer.style.bottom = '';
                    canvasContainer.style.position = '';
                    canvasContainer.style.width = '';
                    canvasContainer.style.height = '';
                    if (typeof window.drawFrame === 'function') window.drawFrame();
                    if (typeof window.drawEditorFrame === 'function') window.drawEditorFrame();

                    // If we previously moved the transport into the canvas, restore it
                    if (originalTransportParent && panel.parentNode !== originalTransportParent) {
                        originalTransportParent.insertBefore(panel, originalTransportNextSibling);
                        delete panel.dataset.dockedIntoCanvas;
                        panel.style.position = '';
                        panel.style.left = '';
                        panel.style.top = '';
                        panel.style.right = '';
                        panel.style.bottom = '';
                        panel.style.width = '';
                        panel.style.minWidth = '';
                        panel.style.maxWidth = '';
                        panel.style.zIndex = '';
                    }
                } else {
                    if (!canvasContainer.style.top || canvasContainer.style.top === '') {
                        canvasContainer.style.top = '90px';
                        canvasContainer.style.left = Math.max(8, window.innerWidth - 500) + 'px';
                    }
                    canvasContainer.style.right = 'auto';
                    canvasContainer.style.bottom = 'auto';
                    // Ensure the floating preview is positioned as fixed so its
                    // header, canvas and footer stay together and are removed
                    // from normal document flow while floating.
                    canvasContainer.style.position = 'fixed';

                    // Move the floating transport into the floating canvas so the
                    // small transport controls stay visually attached to the preview.
                    try {
                        if (panel.parentNode !== canvasContainer) {
                            originalTransportParent = panel.parentNode || originalTransportParent;
                            originalTransportNextSibling = panel.nextSibling || originalTransportNextSibling;
                            canvasContainer.appendChild(panel);
                            panel.dataset.dockedIntoCanvas = '1';
                            panel.style.position = 'relative';
                            panel.style.left = '0';
                            panel.style.right = '0';
                            panel.style.top = 'auto';
                            panel.style.bottom = '0';
                            panel.style.width = '100%';
                            panel.style.minWidth = 'auto';
                            panel.style.maxWidth = 'none';
                            panel.style.zIndex = '10';
                        }
                    } catch (e) {}
                }
            }
            if (canvasHeader) {
                canvasHeader.style.display = visible ? 'flex' : 'none';
            }
            if (dockPlaceholder) {
                dockPlaceholder.style.display = visible ? 'flex' : 'none';
            }

            if (visible) {
                const left = parseFloat(panel.style.left);
                const top  = parseFloat(panel.style.top);
                const isDockedToCanvas = panel.dataset.dockedIntoCanvas === '1';
                const badPos = (!isDockedToCanvas && (!isFinite(left) || !isFinite(top)))
                            || left < 0 || left > window.innerWidth
                            || (!isDockedToCanvas && (top  < 0 || top  > window.innerHeight));
                if (badPos) {
                    panel.style.left  = Math.max(8, window.innerWidth - 340) + 'px';
                    panel.style.top   = '110px';
                    panel.style.right = 'auto';
                    try { localStorage.removeItem(LS_FT_POS); } catch (e) {}
                }
                requestAnimationFrame(function () {
                    requestAnimationFrame(clampToViewport);
                });
                panel.classList.add('just-opened');
                setTimeout(function () { panel.classList.remove('just-opened'); }, 900);
            }
        }

        toggleBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            e.preventDefault();
            setVisible(!panel.classList.contains('visible'));
        });
        if (closeBtn) {
            closeBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                setVisible(false);
            });
        }
        if (cfCloseBtn) {
            cfCloseBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                setVisible(false);
            });
        }

        try {
            const savedPos = JSON.parse(localStorage.getItem(LS_FT_POS) || 'null');
            if (savedPos && typeof savedPos.left === 'number' && typeof savedPos.top === 'number') {
                panel.style.left = savedPos.left + 'px';
                panel.style.top = savedPos.top + 'px';
                panel.style.right = 'auto';
            }
        } catch (e) {}

        try {
            if (localStorage.getItem(LS_FT_VISIBLE) === '1') {
                setVisible(true);
            }
        } catch (e) {}

        window.addEventListener('resize', clampToViewport);

        // --- Dragging for Floating Transport Bar ---
        let dragging = false;
        let dragOffsetX = 0;
        let dragOffsetY = 0;

        function startDrag(clientX, clientY) {
            dragging = true;
            const rect = panel.getBoundingClientRect();
            dragOffsetX = clientX - rect.left;
            dragOffsetY = clientY - rect.top;
            panel.classList.add('dragging');
        }

        function moveDrag(clientX, clientY) {
            if (!dragging) return;
            const rect = panel.getBoundingClientRect();
            let left = clientX - dragOffsetX;
            let top = clientY - dragOffsetY;
            const maxLeft = Math.max(8, window.innerWidth - rect.width - 8);
            const maxTop = Math.max(8, window.innerHeight - rect.height - 8);
            left = Math.min(Math.max(8, left), maxLeft);
            top = Math.min(Math.max(8, top), maxTop);
            panel.style.left = left + 'px';
            panel.style.top = top + 'px';
            panel.style.right = 'auto';
        }

        function endDrag() {
            if (!dragging) return;
            dragging = false;
            panel.classList.remove('dragging');
            try {
                localStorage.setItem(LS_FT_POS, JSON.stringify({
                    left: parseFloat(panel.style.left) || 0,
                    top: parseFloat(panel.style.top) || 0
                }));
            } catch (e) {}
        }

        // --- Dragging for Canvas Preview Header ---
        let canvasDragging = false;
        let canvasDragOffsetX = 0;
        let canvasDragOffsetY = 0;

        function startCanvasDrag(clientX, clientY) {
            canvasDragging = true;
            const rect = canvasContainer.getBoundingClientRect();
            // Make sure the floating preview is fixed so moves are relative to viewport
            if (canvasContainer && !canvasContainer.classList.contains('is-floating-preview')) {
                canvasContainer.classList.add('is-floating-preview');
            }
            canvasContainer.style.position = 'fixed';
            canvasDragOffsetX = clientX - rect.left;
            canvasDragOffsetY = clientY - rect.top;
        }

        function moveCanvasDrag(clientX, clientY) {
            if (!canvasDragging || !canvasContainer.classList.contains('is-floating-preview')) return;
            let left = clientX - canvasDragOffsetX;
            let top = clientY - canvasDragOffsetY;
            const maxLeft = Math.max(8, window.innerWidth - canvasContainer.offsetWidth - 8);
            const maxTop = Math.max(8, window.innerHeight - canvasContainer.offsetHeight - 8);
            left = Math.min(Math.max(8, left), maxLeft);
            top = Math.min(Math.max(8, top), maxTop);
            canvasContainer.style.left = left + 'px';
            canvasContainer.style.top = top + 'px';
            canvasContainer.style.right = 'auto';
            canvasContainer.style.bottom = 'auto';
        }

        function endCanvasDrag() {
            canvasDragging = false;
        }

        if (canvasHeader && canvasContainer) {
            canvasHeader.addEventListener('mousedown', function (e) {
                if (e.target.closest('#cf-close-btn')) return;
                startCanvasDrag(e.clientX, e.clientY);
                e.preventDefault();
            });
            canvasHeader.addEventListener('touchstart', function (e) {
                if (e.target.closest('#cf-close-btn')) return;
                const t = e.touches[0];
                startCanvasDrag(t.clientX, t.clientY);
            }, { passive: true });

            document.addEventListener('mousemove', function (e) {
                moveCanvasDrag(e.clientX, e.clientY);
            });
            document.addEventListener('touchmove', function (e) {
                if (!canvasDragging) return;
                const t = e.touches[0];
                moveCanvasDrag(t.clientX, t.clientY);
            }, { passive: true });

            document.addEventListener('mouseup', endCanvasDrag);
            document.addEventListener('touchend', endCanvasDrag);
        }

        if (handle) {
            handle.addEventListener('mousedown', function (e) {
                startDrag(e.clientX, e.clientY);
                e.preventDefault();
            });
            handle.addEventListener('touchstart', function (e) {
                const t = e.touches[0];
                startDrag(t.clientX, t.clientY);
            }, { passive: true });
        }
        document.addEventListener('mousemove', function (e) { moveDrag(e.clientX, e.clientY); });
        document.addEventListener('touchmove', function (e) {
            if (!dragging) return;
            const t = e.touches[0];
            moveDrag(t.clientX, t.clientY);
        }, { passive: true });
        document.addEventListener('mouseup', endDrag);
        document.addEventListener('touchend', endDrag);

        // --- Forward floating controls to the real (working) controls ---
        if (ftPlayBtn && realPlayBtn) {
            ftPlayBtn.addEventListener('click', function () {
                realPlayBtn.click();
            });
        }

        if (ftSlider && realSlider) {
            ftSlider.addEventListener('mousedown', function () {
                realSlider.dispatchEvent(new Event('mousedown'));
            });
            ftSlider.addEventListener('touchstart', function () {
                realSlider.dispatchEvent(new Event('touchstart'));
            }, { passive: true });

            ftSlider.addEventListener('input', function (e) {
                realSlider.value = e.target.value;
                realSlider.dispatchEvent(new Event('input'));
            });

            function finishFtSeek() {
                realSlider.dispatchEvent(new Event('mouseup'));
                realSlider.dispatchEvent(new Event('touchend'));
            }
            ftSlider.addEventListener('mouseup', finishFtSeek);
            ftSlider.addEventListener('touchend', finishFtSeek);
        }

        // --- Forward Canvas Floating Window controls ---
        if (cfPlayBtn && realPlayBtn) {
            cfPlayBtn.addEventListener('click', function () {
                realPlayBtn.click();
            });
        }
        if (cfHeaderPlayBtn && realPlayBtn) {
            cfHeaderPlayBtn.addEventListener('click', function () {
                realPlayBtn.click();
            });
        }
        if (cfRewindBtn && realSlider) {
            cfRewindBtn.addEventListener('click', function () {
                const maxVal = parseFloat(realSlider.max) || 100;
                const curVal = parseFloat(realSlider.value) || 0;
                realSlider.value = Math.max(0, curVal - 5);
                realSlider.dispatchEvent(new Event('input'));
                realSlider.dispatchEvent(new Event('mouseup'));
            });
        }
        if (cfForwardBtn && realSlider) {
            cfForwardBtn.addEventListener('click', function () {
                const maxVal = parseFloat(realSlider.max) || 100;
                const curVal = parseFloat(realSlider.value) || 0;
                realSlider.value = Math.min(maxVal, curVal + 5);
                realSlider.dispatchEvent(new Event('input'));
                realSlider.dispatchEvent(new Event('mouseup'));
            });
        }
        if (cfSlider && realSlider) {
            cfSlider.addEventListener('mousedown', function () {
                realSlider.dispatchEvent(new Event('mousedown'));
            });
            cfSlider.addEventListener('touchstart', function () {
                realSlider.dispatchEvent(new Event('touchstart'));
            }, { passive: true });

            cfSlider.addEventListener('input', function (e) {
                realSlider.value = e.target.value;
                realSlider.dispatchEvent(new Event('input'));
            });

            function finishCfSeek() {
                realSlider.dispatchEvent(new Event('mouseup'));
                realSlider.dispatchEvent(new Event('touchend'));
            }
            cfSlider.addEventListener('mouseup', finishCfSeek);
            cfSlider.addEventListener('touchend', finishCfSeek);
        }

        // --- Mirror real controls' state back into the floating panel ---
        let isFtSliderBeingDragged = false;
        if (ftSlider) {
            ftSlider.addEventListener('mousedown', () => { isFtSliderBeingDragged = true; });
            ftSlider.addEventListener('touchstart', () => { isFtSliderBeingDragged = true; }, { passive: true });
            document.addEventListener('mouseup', () => { isFtSliderBeingDragged = false; });
            document.addEventListener('touchend', () => { isFtSliderBeingDragged = false; });
        }

        let isCfSliderBeingDragged = false;
        if (cfSlider) {
            cfSlider.addEventListener('mousedown', () => { isCfSliderBeingDragged = true; });
            cfSlider.addEventListener('touchstart', () => { isCfSliderBeingDragged = true; }, { passive: true });
            document.addEventListener('mouseup', () => { isCfSliderBeingDragged = false; });
            document.addEventListener('touchend', () => { isCfSliderBeingDragged = false; });
        }

        function syncLoop() {
            const isFloatingPreviewActive = canvasContainer && canvasContainer.classList.contains('is-floating-preview');

            if (panel.classList.contains('visible') || isFloatingPreviewActive) {
                if (realSlider) {
                    const max = parseFloat(realSlider.max) || 0;
                    const val = parseFloat(realSlider.value) || 0;
                    const percent = max > 0 ? Math.max(0, Math.min(100, (val / max) * 100)) : 0;

                    // Sync Floating Transport Panel
                    if (ftSlider && !isFtSliderBeingDragged) {
                        if (ftSlider.max !== realSlider.max) ftSlider.max = realSlider.max;
                        if (document.activeElement !== ftSlider) ftSlider.value = realSlider.value;
                        if (ftFill) ftFill.style.width = percent + '%';
                    }

                    // Sync Floating Canvas Window Controls
                    if (cfSlider && !isCfSliderBeingDragged) {
                        if (cfSlider.max !== realSlider.max) cfSlider.max = realSlider.max;
                        if (document.activeElement !== cfSlider) cfSlider.value = realSlider.value;
                        if (cfFill) cfFill.style.width = percent + '%';
                    }
                }

                if (realCurrent) {
                    if (ftCurrent && realCurrent.innerHTML !== ftCurrent.innerHTML) ftCurrent.innerHTML = realCurrent.innerHTML;
                    if (cfCurrent && realCurrent.innerHTML !== cfCurrent.innerHTML) cfCurrent.innerHTML = realCurrent.innerHTML;
                }
                if (realTotal) {
                    if (ftTotal && realTotal.innerHTML !== ftTotal.innerHTML) ftTotal.innerHTML = realTotal.innerHTML;
                    if (cfTotal && realTotal.innerHTML !== cfTotal.innerHTML) cfTotal.innerHTML = realTotal.innerHTML;
                }
                if (realPlayBtn) {
                    const isPlaying = !!realPlayBtn.querySelector('.fa-pause');
                    const wantClass = isPlaying ? 'fa-solid fa-pause' : 'fa-solid fa-play';
                    if (ftPlayIcon && ftPlayIcon.className !== wantClass) ftPlayIcon.className = wantClass;
                    if (cfPlayIcon && cfPlayIcon.className !== wantClass) cfPlayIcon.className = wantClass;
                    if (cfHeaderPlayIcon && cfHeaderPlayIcon.className !== wantClass) cfHeaderPlayIcon.className = wantClass;
                }
            }
            requestAnimationFrame(syncLoop);
        }
        requestAnimationFrame(syncLoop);
    }

    // ---------------------------------------------------------
    // 4) Always On Top (Pin Window) Feature - PotPlayer Style
    // ---------------------------------------------------------
    function setupAlwaysOnTopPin() {
        const pinBtn = document.getElementById('always-on-top-btn');
        const pinText = document.getElementById('always-on-top-text');
        if (!pinBtn) return;

        function updatePinState(isPinned) {
            if (isPinned) {
                pinBtn.classList.add('active');
                pinBtn.style.background = '#2563eb';
                pinBtn.style.color = '#ffffff';
                pinBtn.style.borderColor = '#3b82f6';
                pinBtn.title = 'উইন্ডো সবসময় সবার উপরে পিন করা আছে (Always On Top: ON)';
                if (pinText) pinText.textContent = 'Pinned 📌';
            } else {
                pinBtn.classList.remove('active');
                pinBtn.style.background = '';
                pinBtn.style.color = '';
                pinBtn.style.borderColor = '';
                pinBtn.title = 'উইন্ডো সবসময় সবার উপরে পিন করে রাখুন (Always On Top - PotPlayer Style)';
                if (pinText) pinText.textContent = 'Pin';
            }
        }

        if (window.electronAPI && typeof window.electronAPI.getAlwaysOnTop === 'function') {
            window.electronAPI.getAlwaysOnTop().then((state) => {
                updatePinState(!!state);
            }).catch(() => {});

            pinBtn.addEventListener('click', async () => {
                try {
                    const newState = await window.electronAPI.toggleAlwaysOnTop();
                    updatePinState(newState);
                } catch (e) {
                    console.error('Failed to toggle Always On Top:', e);
                }
            });
        } else {
            pinBtn.addEventListener('click', () => {
                alert('📌 পিন অপশনটি ইলেকট্রন ডেক্সটপ অ্যাপে (Desktop App) উইন্ডোকে সবার উপরে পিন রাখার জন্য কাজ করে।');
            });
        }
    }

    // ============================================================
    // Fullscreen Preview  (স্ক্রিন রেকর্ডিংয়ের জন্য ফুলস্ক্রিন)
    // Uses canvas.captureStream() → <video> → requestFullscreen()
    // so the editor canvas is mirrored live at full-screen size.
    // ============================================================
    (function initFullscreenPreview() {
        const editorCanvas   = document.getElementById('editor-canvas');
        const fsWrapper      = document.getElementById('sf-fullscreen-wrapper');
        const fsVideo        = document.getElementById('sf-fullscreen-video');
        const fsBtnOverlay   = document.getElementById('canvas-fullscreen-btn');
        const fsBtnFloat     = document.getElementById('canvas-fullscreen-btn-float');
        const fsPlayPause    = document.getElementById('sf-fs-playpause');
        const fsTimeDisplay  = document.getElementById('sf-fs-time');
        const fsExitBtn      = document.getElementById('sf-fs-exit');

        if (!editorCanvas || !fsWrapper || !fsVideo) return;

        let fsStream = null;
        let fsTimerInterval = null;

        // Helper — format seconds as MM:SS.s
        function formatTime(sec) {
            if (!isFinite(sec) || sec < 0) sec = 0;
            const m = Math.floor(sec / 60);
            const s = (sec % 60).toFixed(1).padStart(4, '0');
            return `${String(m).padStart(2, '0')}:${s}`;
        }

        // Sync the time display by reading the main seek slider
        function syncTimeDisplay() {
            const currentEl = document.getElementById('seek-current-time');
            const totalEl   = document.getElementById('seek-total-time');
            if (fsTimeDisplay && currentEl && totalEl) {
                fsTimeDisplay.textContent = `${currentEl.textContent} / ${totalEl.textContent}`;
            }
        }

        function enterFullscreen() {
            if (!editorCanvas) return;

            // Capture a live 30fps stream from the editor canvas
            try {
                fsStream = editorCanvas.captureStream(30);
                fsVideo.srcObject = fsStream;
                fsVideo.play().catch(() => {});
            } catch (err) {
                console.warn('captureStream not supported:', err);
                return;
            }

            // Show wrapper and request fullscreen
            fsWrapper.style.display = 'flex';
            const fsReq = fsWrapper.requestFullscreen
                || fsWrapper.webkitRequestFullscreen
                || fsWrapper.mozRequestFullScreen
                || fsWrapper.msRequestFullscreen;
            if (fsReq) {
                fsReq.call(fsWrapper).catch((err) => {
                    console.warn('Fullscreen request failed:', err);
                    // Fallback: stay as fixed overlay even without true fullscreen API
                });
            }

            // Start time-sync interval
            fsTimerInterval = setInterval(syncTimeDisplay, 200);
            syncTimeDisplay();

            // Sync play/pause button icon with main editor state
            updateFsPlayPauseIcon();
        }

        function exitFullscreen() {
            if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
            else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
            else if (document.msExitFullscreen) document.msExitFullscreen();

            cleanupFs();
        }

        function cleanupFs() {
            if (fsTimerInterval) { clearInterval(fsTimerInterval); fsTimerInterval = null; }
            if (fsVideo) { fsVideo.srcObject = null; fsVideo.pause(); }
            if (fsStream) {
                fsStream.getTracks().forEach((t) => t.stop());
                fsStream = null;
            }
            if (fsWrapper) fsWrapper.style.display = 'none';
        }

        function updateFsPlayPauseIcon() {
            if (!fsPlayPause) return;
            const mainBtn = document.getElementById('play-pause-btn');
            const isPlaying = mainBtn && mainBtn.querySelector('.fa-pause');
            fsPlayPause.innerHTML = isPlaying
                ? '<i class="fa-solid fa-pause"></i>'
                : '<i class="fa-solid fa-play"></i>';
        }

        // Fullscreen button — canvas overlay (docked mode)
        if (fsBtnOverlay) {
            fsBtnOverlay.addEventListener('click', enterFullscreen);
        }

        // Fullscreen button — floating header
        if (fsBtnFloat) {
            fsBtnFloat.addEventListener('click', enterFullscreen);
        }

        // Exit button inside fullscreen overlay
        if (fsExitBtn) {
            fsExitBtn.addEventListener('click', exitFullscreen);
        }

        // Play/Pause inside fullscreen overlay — delegates to main editor button
        if (fsPlayPause) {
            fsPlayPause.addEventListener('click', () => {
                const mainBtn = document.getElementById('play-pause-btn');
                if (mainBtn) mainBtn.click();
                setTimeout(updateFsPlayPauseIcon, 80);
            });
        }

        // Listen for the main play-pause button state to sync the FS icon
        document.addEventListener('click', (e) => {
            if (e.target.closest('#play-pause-btn')) {
                setTimeout(updateFsPlayPauseIcon, 80);
            }
        }, true);

        // Clean up when fullscreen exits (ESC key or API)
        document.addEventListener('fullscreenchange', () => {
            if (!document.fullscreenElement) cleanupFs();
        });
        document.addEventListener('webkitfullscreenchange', () => {
            if (!document.webkitFullscreenElement) cleanupFs();
        });

        // Show the canvas overlay button once a video is loaded
        // (watch for the timeline-controls becoming visible, which signals a clip is loaded)
        const timelineControls = document.getElementById('timeline-controls');
        if (timelineControls && fsBtnOverlay) {
            const obs = new MutationObserver(() => {
                const isLoaded = timelineControls.style.display !== 'none';
                fsBtnOverlay.style.display = isLoaded ? 'flex' : 'none';
            });
            obs.observe(timelineControls, { attributes: true, attributeFilter: ['style'] });
            // Initial check
            fsBtnOverlay.style.display =
                timelineControls.style.display !== 'none' ? 'flex' : 'none';
        }
    })();

})();

