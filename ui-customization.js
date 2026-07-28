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

        function setVisible(visible) {
            panel.style.display = visible ? 'flex' : 'none';
            panel.classList.toggle('visible', visible);
            toggleBtn.classList.toggle('active', visible);
            try { localStorage.setItem(LS_FT_VISIBLE, visible ? '1' : '0'); } catch (e) {}
            if (visible) {
                // Apply a safe default position immediately so the panel is
                // never invisible, then clamp after layout.
                const left = parseFloat(panel.style.left);
                const top  = parseFloat(panel.style.top);
                const badPos = !isFinite(left) || !isFinite(top)
                            || left < 0 || left > window.innerWidth
                            || top  < 0 || top  > window.innerHeight;
                if (badPos) {
                    panel.style.left  = Math.max(8, window.innerWidth - 340) + 'px';
                    panel.style.top   = '110px';
                    panel.style.right = 'auto';
                    // Wipe stale saved position so next open also starts sane.
                    try { localStorage.removeItem(LS_FT_POS); } catch (e) {}
                }
                requestAnimationFrame(function () {
                    requestAnimationFrame(clampToViewport);
                });
                panel.classList.add('just-opened');
                setTimeout(function () { panel.classList.remove('just-opened'); }, 900);
            }
        }

        // Use both click and mousedown so the button responds even if a
        // parent handler calls stopPropagation on one of them.
        let lastPointerToggleAt = 0;
        function onToggle(e) {
            // Some embedded WebView builds do not synthesize a click for this
            // header button reliably.  A pointer-up listener below covers that
            // path; ignore its follow-up click so it cannot toggle twice.
            if (e.type === 'click' && Date.now() - lastPointerToggleAt < 600) return;
            e.stopPropagation();
            e.preventDefault();
            setVisible(!panel.classList.contains('visible'));
        }
        toggleBtn.addEventListener('click',     onToggle);
        toggleBtn.addEventListener('pointerup', function (e) {
            if (e.button !== 0) return;
            lastPointerToggleAt = Date.now();
            onToggle(e);
        });
        toggleBtn.addEventListener('mousedown', function (e) { e.stopPropagation(); });
        if (closeBtn) {
            closeBtn.addEventListener('mousedown', function (e) { e.stopPropagation(); });
            closeBtn.addEventListener('click', function (e) { e.stopPropagation(); setVisible(false); });
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

        // --- Dragging ---
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

        // --- Mirror real controls' state back into the floating panel ---
        // (Poll via rAF rather than hooking editor.js internals, so this
        // stays fully decoupled from the main playback engine.)
        let isFtSliderBeingDragged = false;
        if (ftSlider) {
            ftSlider.addEventListener('mousedown', () => { isFtSliderBeingDragged = true; });
            ftSlider.addEventListener('touchstart', () => { isFtSliderBeingDragged = true; }, { passive: true });
            document.addEventListener('mouseup', () => { isFtSliderBeingDragged = false; });
            document.addEventListener('touchend', () => { isFtSliderBeingDragged = false; });
        }

        function syncLoop() {
            if (panel.classList.contains('visible')) {
                if (realSlider && ftSlider && !isFtSliderBeingDragged) {
                    if (ftSlider.max !== realSlider.max) ftSlider.max = realSlider.max;
                    if (document.activeElement !== ftSlider) ftSlider.value = realSlider.value;
                    const max = parseFloat(realSlider.max) || 0;
                    const val = parseFloat(realSlider.value) || 0;
                    const percent = max > 0 ? Math.max(0, Math.min(100, (val / max) * 100)) : 0;
                    if (ftFill) ftFill.style.width = percent + '%';
                }
                if (realCurrent && ftCurrent && realCurrent.innerHTML !== ftCurrent.innerHTML) {
                    ftCurrent.innerHTML = realCurrent.innerHTML;
                }
                if (realTotal && ftTotal && realTotal.innerHTML !== ftTotal.innerHTML) {
                    ftTotal.innerHTML = realTotal.innerHTML;
                }
                if (realPlayBtn && ftPlayIcon) {
                    const isPlaying = !!realPlayBtn.querySelector('.fa-pause');
                    const wantClass = isPlaying ? 'fa-solid fa-pause' : 'fa-solid fa-play';
                    if (ftPlayIcon.className !== wantClass) ftPlayIcon.className = wantClass;
                }
            }
            requestAnimationFrame(syncLoop);
        }
        requestAnimationFrame(syncLoop);
    }
})();
