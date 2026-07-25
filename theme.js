/* ==========================================================================
   Studio Flow — Theme Switcher
   Adds Light / Dark (default) / Midnight / Ocean themes.
   Applies data-theme on <html>, persists to localStorage, builds the
   dropdown UI inside the header (#theme-switcher-mount).
   ========================================================================== */
(function () {
    'use strict';

    var STORAGE_KEY = 'studioflow-theme';

    var THEMES = [
        { id: 'dark', label: 'Dark (Default)', swatch: 'swatch-dark' },
        { id: 'light', label: 'Light', swatch: 'swatch-light' },
        { id: 'midnight', label: 'Midnight', swatch: 'swatch-midnight' },
        { id: 'ocean', label: 'Ocean', swatch: 'swatch-ocean' }
    ];

    function getSavedTheme() {
        try {
            return localStorage.getItem(STORAGE_KEY) || 'dark';
        } catch (e) {
            return 'dark';
        }
    }

    function saveTheme(id) {
        try {
            localStorage.setItem(STORAGE_KEY, id);
        } catch (e) { /* ignore */ }
    }

    function applyTheme(id) {
        if (id === 'dark') {
            document.documentElement.removeAttribute('data-theme');
        } else {
            document.documentElement.setAttribute('data-theme', id);
        }
    }

    // Apply immediately (before full DOM build) to avoid a flash of the
    // wrong theme. This runs as soon as this script executes.
    applyTheme(getSavedTheme());

    function buildSwitcherUI() {
        var mount = document.getElementById('theme-switcher-mount');
        if (!mount) return;

        var current = getSavedTheme();

        var wrap = document.createElement('div');
        wrap.className = 'theme-switcher';
        wrap.innerHTML =
            '<button id="theme-switcher-toggle" class="btn btn-outline btn-sm" type="button" title="Change theme (থিম পরিবর্তন করুন)">' +
                '<i class="fa-solid fa-palette"></i>' +
            '</button>';
        mount.appendChild(wrap);

        var panel = document.createElement('div');
        panel.id = 'theme-switcher-panel';
        panel.className = 'theme-switcher-panel';
        document.body.appendChild(panel);
        var toggleBtn = wrap.querySelector('#theme-switcher-toggle');

        function renderOptions() {
            panel.innerHTML = '';
            THEMES.forEach(function (theme) {
                var opt = document.createElement('div');
                opt.className = 'theme-option' + (theme.id === current ? ' active' : '');
                opt.innerHTML =
                    '<span class="theme-swatch ' + theme.swatch + '"></span>' +
                    '<span>' + theme.label + '</span>' +
                    '<i class="fa-solid fa-check theme-check"></i>';
                opt.addEventListener('click', function (e) {
                    e.stopPropagation();
                    current = theme.id;
                    applyTheme(theme.id);
                    saveTheme(theme.id);
                    renderOptions();
                    panel.classList.remove('open');
                });
                panel.appendChild(opt);
            });
        }
        renderOptions();

        function positionPanel() {
            var rect = toggleBtn.getBoundingClientRect();
            var top = rect.bottom + 8;
            var right = window.innerWidth - rect.right;

            if (top + 300 > window.innerHeight) {
                top = Math.max(8, rect.top - 300 - 8);
            }
            top = Math.max(8, top);

            panel.style.top = top + 'px';
            panel.style.right = Math.max(8, right) + 'px';
            panel.style.bottom = 'auto';
            panel.style.left = 'auto';
        }

        toggleBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            var willOpen = !panel.classList.contains('open');
            if (willOpen) positionPanel();
            panel.classList.toggle('open', willOpen);
        });

        document.addEventListener('click', function (e) {
            if (!wrap.contains(e.target) && e.target !== panel && !panel.contains(e.target)) {
                panel.classList.remove('open');
            }
        });

        window.addEventListener('resize', function () {
            if (panel.classList.contains('open')) positionPanel();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', buildSwitcherUI);
    } else {
        buildSwitcherUI();
    }
})();
