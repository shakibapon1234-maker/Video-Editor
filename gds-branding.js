/* ==========================================================================
   Studio Flow — GDS Training Hub Branding & Presets Module (Phase Pro)
   
   Independent, modular branding tool for 1-click logo loading, social links,
   WhatsApp helpline banners, and Reels preset cards.
   
   Zero overhead: Does not loop or poll; operates purely on-demand and on
   event triggers to keep the main editor lightning-fast and responsive.
   ========================================================================== */

(function () {
    'use strict';

    var STORAGE_KEY = 'gds_branding_config_v2';

    var GDS_DEFAULTS = {
        website: 'gdstraininghub.com',
        facebook: 'facebook.com/gdstraininghub',
        youtube: 'youtube.com/@gdstraininghubbd',
        whatsapp: '01674091748',
        email: 'gdstraininghub@gmail.com',
        brandTitle: 'GDS TRAINING HUB',
        tagline: 'ঘরে বসেই প্র্যাকটিস করুন এয়ার টিকেটিং GDS সিস্টেম',
        pinnedCta: 'ফুল ভিডিও: পিন করা কমেন্টে 👇',
        logoSrc: 'assets/branding/logo.png',
        logoAltSrc: 'assets/branding/logo.gif',
        autoLogo: false, // Default is strictly false — logo is never added automatically unless user turns it on
        fullDuration: true
    };

    function getConfig() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                // If old v1 config exists, migrate custom fields but reset autoLogo to false
                var oldRaw = localStorage.getItem('gds_branding_config_v1');
                if (oldRaw) {
                    var oldParsed = JSON.parse(oldRaw);
                    delete oldParsed.autoLogo; // Reset old auto-add default
                    var migrated = Object.assign({}, GDS_DEFAULTS, oldParsed, { autoLogo: false });
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
                    return migrated;
                }
            } else {
                var parsed = JSON.parse(raw);
                return Object.assign({}, GDS_DEFAULTS, parsed);
            }
        } catch (e) {
            console.warn('GDS Branding: failed to parse saved config', e);
        }
        return Object.assign({}, GDS_DEFAULTS);
    }

    function saveConfig(cfg) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
        } catch (e) {
            console.warn('GDS Branding: failed to save config', e);
        }
    }

    function ve() {
        return window.VideoEditor || null;
    }

    function showToast(msg, type) {
        var toast = document.createElement('div');
        toast.className = 'gds-toast';
        toast.style.cssText = 'position:fixed; bottom:28px; left:50%; transform:translateX(-50%) translateY(20px); background:' + 
            (type === 'error' ? 'rgba(239,68,68,0.95)' : 'rgba(15,23,42,0.95)') + 
            '; color:#ffffff; padding:12px 22px; border-radius:10px; font-size:13.5px; font-weight:600; z-index:9999999; box-shadow:0 10px 30px rgba(0,0,0,0.5); border:1px solid ' +
            (type === 'error' ? '#f87171' : 'rgba(56,189,248,0.4)') + 
            '; backdrop-filter:blur(10px); display:flex; align-items:center; gap:10px; transition:all 0.25s ease; opacity:0; pointer-events:none;';
        
        var icon = type === 'error' ? '⚠️' : '👑';
        toast.innerHTML = '<span>' + icon + '</span><span>' + msg + '</span>';
        document.body.appendChild(toast);

        requestAnimationFrame(function () {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(0)';
        });

        setTimeout(function () {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(10px)';
            setTimeout(function () {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 300);
        }, 3200);
    }

    // ── Logo Management ──────────────────────────────────────────────────────────
    function loadGdsLogo(logoUrl, silent) {
        var state = ve();
        if (!state) return;
        var cfg = getConfig();
        var src = logoUrl || cfg.logoSrc || 'assets/branding/logo.png';

        var img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function () {
            state.logoImg = img;
            state.logoX = 0.77; // Top-right standard placement
            state.logoY = 0.08;
            state.logoSize = 18; // 18% width of canvas
            state.logoOpacity = 1.0;

            // Fetch as blob for state.logoFile so project exports retain the logo
            fetch(src)
                .then(function (r) { return r.blob(); })
                .then(function (blob) {
                    state.logoFile = new File([blob], 'GDS-Logo.png', { type: blob.type || 'image/png' });
                })
                .catch(function (err) {
                    console.log('Logo blob fetch optional notice:', err);
                });

            // Update DOM UI elements if present
            var previewBox = document.getElementById('logo-preview-box');
            var imgPreview = document.getElementById('logo-img-preview');
            var dropzone = document.getElementById('logo-dropzone');
            var filename = document.getElementById('logo-filename');
            var controlCard = document.getElementById('logo-control-card');
            var sizeSlider = document.getElementById('logo-size-slider');
            var sizeVal = document.getElementById('logo-size-val');
            var opacitySlider = document.getElementById('logo-opacity-slider');
            var opacityVal = document.getElementById('logo-opacity-val');

            if (previewBox) previewBox.style.display = 'flex';
            if (imgPreview) imgPreview.src = src;
            if (dropzone) dropzone.style.display = 'none';
            if (filename) filename.innerText = src.indexOf('.gif') !== -1 ? 'GDS-Logo.gif' : 'GDS-Logo.png';
            if (controlCard) controlCard.style.display = 'block';
            if (sizeSlider) sizeSlider.value = 18;
            if (sizeVal) sizeVal.innerText = '18%';
            if (opacitySlider) opacitySlider.value = 100;
            if (opacityVal) opacityVal.innerText = '100%';

            if (typeof window.drawEditorFrame === 'function') window.drawEditorFrame();
            if (typeof window.triggerAutoSave === 'function') window.triggerAutoSave();
            if (typeof window.recordEditorHistory === 'function') window.recordEditorHistory('GDS Logo Loaded');

            if (!silent) {
                showToast('GDS Training Hub লোগো সফলভাবে লোড হয়েছে (Top-Right)!');
            }
        };

        img.onerror = function () {
            if (!silent) {
                showToast('লোগো ফাইল লোড করা যায়নি: ' + src, 'error');
            }
        };

        img.src = src;
    }

    function removeGdsLogo() {
        var state = ve();
        if (!state) return;
        state.logoImg = null;
        state.logoFile = null;

        var previewBox = document.getElementById('logo-preview-box');
        var dropzone = document.getElementById('logo-dropzone');
        var controlCard = document.getElementById('logo-control-card');
        if (previewBox) previewBox.style.display = 'none';
        if (dropzone) dropzone.style.display = 'flex';
        if (controlCard) controlCard.style.display = 'none';

        if (typeof window.drawEditorFrame === 'function') window.drawEditorFrame();
        if (typeof window.triggerAutoSave === 'function') window.triggerAutoSave();
        showToast('লোগো সরানো হয়েছে');
    }

    function clearGdsOverlays() {
        var state = ve();
        if (!state || !state.textOverlays) return;
        var cfg = getConfig();
        var beforeCount = state.textOverlays.length;
        state.textOverlays = state.textOverlays.filter(function (t) {
            if (t.isGdsBranding) return false;
            var txt = (t.text || '');
            if (txt.indexOf(cfg.website) !== -1 || txt.indexOf(cfg.whatsapp) !== -1 ||
                txt.indexOf('GDS TRAINING HUB') !== -1 || txt.indexOf(cfg.pinnedCta) !== -1 ||
                txt.indexOf('fb/gdstraininghub') !== -1 || txt.indexOf('yt/@gdstraininghubbd') !== -1) {
                return false;
            }
            return true;
        });
        state.selectedTextOverlayId = null;
        if (typeof window.renderTextOverlayList === 'function') window.renderTextOverlayList();
        var timingCont = document.getElementById('text-overlay-timing-container');
        if (timingCont) timingCont.style.display = 'none';
        if (typeof window.drawEditorFrame === 'function') window.drawEditorFrame();
        if (typeof window.triggerAutoSave === 'function') window.triggerAutoSave();
        if (typeof window.recordEditorHistory === 'function') window.recordEditorHistory('GDS Overlays Cleared');
        showToast('🗑️ সমস্ত GDS সোশ্যাল ব্যানার রিমুভ করা হয়েছে!');
    }

    function clearAllGdsBranding() {
        removeGdsLogo();
        clearGdsOverlays();
        showToast('🗑️ সমস্ত লোগো ও সোশ্যাল ব্যানার রিমুভ করা হয়েছে!');
    }

    // ── Presets Builder ──────────────────────────────────────────────────────────
    function applyGdsPreset(presetType, options) {
        var state = ve();
        if (!state) return;
        var cfg = getConfig();
        var opt = options || {};

        var startSec = 0;
        var totalDur = Math.max(5, state.endTime || state.duration || 10);
        var endSec = (opt.fullDuration !== false && cfg.fullDuration) ? totalDur : Math.min(totalDur, (state.currentTime || 0) + 6);
        if (opt.isOutro) {
            startSec = Math.max(0, totalDur - 5);
            endSec = totalDur;
        }

        if (!state.textOverlays) state.textOverlays = [];

        var webText = opt.website || cfg.website;
        var phoneText = opt.whatsapp || cfg.whatsapp;
        var fbText = opt.facebook || cfg.facebook;
        var ytText = opt.youtube || cfg.youtube;
        var ctaText = opt.pinnedCta || cfg.pinnedCta;

        if (presetType === 'all-in-one') {
            loadGdsLogo(null, true);
            applyGdsPreset('social-strip', opt);
            showToast('👑 GDS লোগো + সোশ্যাল ব্যানার একসাথে সেট হয়েছে!');
            return;
        }

        if (presetType === 'glass-stack') {
            if (typeof window.loadGdsSocialStack === 'function') {
                window.loadGdsSocialStack();
                showToast('👑 GDS ৪-কার্ড গ্লাস স্ট্যাক অন হয়েছে!');
            } else {
                showToast('Glass Stack মডিউল লোড হচ্ছে, পুনরায় চেষ্টা করুন।', 'error');
            }
            return;
        }

        var createdIds = [];

        function pushItem(item) {
            var fullItem = Object.assign({
                id: Date.now() + Math.random(),
                clipId: state.activeClipId,
                isGdsBranding: true,
                font: 'Hind Siliguri',
                colorMode: 'solid',
                animSpeedSec: 0.5,
                curve: 0,
                curvePoints: [],
                shadowEnabled: true,
                shadowColor: '#000000',
                shadowOpacity: 50,
                shadowBlur: 6,
                shadowOffsetX: 2,
                shadowOffsetY: 2,
                startSec: startSec,
                endSec: endSec
            }, item);
            state.textOverlays.push(fullItem);
            createdIds.push(fullItem.id);
        }

        if (presetType === 'social-strip') {
            // 3-section horizontal bar
            pushItem({
                text: '🌐 ' + webText,
                fontSize: 22, color: '#38bdf8',
                boxStyle: 'solid', boxColor: '#0a192f',
                animStyle: 'slide-up', textAnimStyle: 'slide-up', boxAnimStyle: 'slide-up',
                x: 0.22, y: 0.89
            });
            pushItem({
                text: '💬 ' + phoneText + '\n(WhatsApp)',
                fontSize: 22, color: '#4ade80',
                boxStyle: 'solid', boxColor: '#064e3b',
                animStyle: 'slide-up', textAnimStyle: 'slide-up', boxAnimStyle: 'slide-up',
                x: 0.52, y: 0.89
            });
            pushItem({
                text: '📘 fb/' + fbText.replace(/^facebook\.com\//, '') + '\n🔴 yt/' + ytText.replace(/^youtube\.com\//, ''),
                fontSize: 20, color: '#ffffff',
                boxStyle: 'solid', boxColor: '#0f172a',
                animStyle: 'slide-up', textAnimStyle: 'slide-up', boxAnimStyle: 'slide-up',
                x: 0.82, y: 0.89
            });
        } else if (presetType === 'reels-card') {
            // 2-row statement card with accent bar
            pushItem({
                text: '✈️ ' + (opt.brandTitle || cfg.brandTitle),
                fontSize: 26, color: '#fbbf24',
                boxStyle: 'solid', boxColor: '#071827',
                animStyle: 'spring-pop', textAnimStyle: 'spring-pop', boxAnimStyle: 'spring-pop',
                x: 0.5, y: 0.81,
                accentBar: true, accentBarEnabled: true,
                accentBarColor: '#38bdf8', accentBarHeight: 4, accentBarAnim: 'draw-left'
            });
            pushItem({
                text: '🌐 ' + webText + '   |   💬 WhatsApp: ' + phoneText,
                fontSize: 22, color: '#ffffff',
                boxStyle: 'solid', boxColor: '#0f2744',
                animStyle: 'slide-up', textAnimStyle: 'slide-up', boxAnimStyle: 'slide-up',
                x: 0.5, y: 0.88
            });
        } else if (presetType === 'helpline-pill') {
            // Vibrant green pill badge
            pushItem({
                text: '💬 WhatsApp: ' + phoneText,
                fontSize: 28, color: '#ffffff',
                boxStyle: 'pill', boxColor: '#059669',
                animStyle: 'pill-unfold', textAnimStyle: 'pill-unfold', boxAnimStyle: 'pill-unfold',
                x: 0.5, y: 0.88
            });
        } else if (presetType === 'pinned-cta') {
            // Dark red / gold CTA badge
            pushItem({
                text: ctaText + '  |  WhatsApp: ' + phoneText,
                fontSize: 24, color: '#ffffff',
                boxStyle: 'solid', boxColor: '#881337',
                animStyle: 'spring-pop', textAnimStyle: 'spring-pop', boxAnimStyle: 'spring-pop',
                x: 0.5, y: 0.88,
                accentBar: true, accentBarEnabled: true,
                accentBarColor: '#fbbf24', accentBarHeight: 4, accentBarAnim: 'draw-left'
            });
        } else if (presetType === 'outro-banner') {
            // 3-row Outro banner for end of video
            pushItem({
                text: '🎓 ' + (opt.tagline || cfg.tagline),
                fontSize: 24, color: '#facc15',
                boxStyle: 'solid', boxColor: '#071827',
                animStyle: 'slide-up', textAnimStyle: 'slide-up', boxAnimStyle: 'slide-up',
                x: 0.5, y: 0.76
            });
            pushItem({
                text: '🌐 ' + webText + '   •   💬 ' + phoneText,
                fontSize: 24, color: '#38bdf8',
                boxStyle: 'solid', boxColor: '#0b2447',
                animStyle: 'slide-up', textAnimStyle: 'slide-up', boxAnimStyle: 'slide-up',
                x: 0.5, y: 0.83
            });
            pushItem({
                text: '📘 ' + fbText + '   •   🔴 ' + ytText,
                fontSize: 20, color: '#ffffff',
                boxStyle: 'solid', boxColor: '#020617',
                animStyle: 'slide-up', textAnimStyle: 'slide-up', boxAnimStyle: 'slide-up',
                x: 0.5, y: 0.90
            });
        }

        if (createdIds.length) {
            state.selectedTextOverlayId = createdIds[createdIds.length - 1];
        }

        if (typeof window.renderTextOverlayList === 'function') window.renderTextOverlayList();
        if (typeof window.showTextOverlayTimingFor === 'function' && createdIds.length) {
            window.showTextOverlayTimingFor(createdIds[createdIds.length - 1]);
        }
        if (typeof window.drawEditorFrame === 'function') window.drawEditorFrame();
        if (typeof window.triggerAutoSave === 'function') window.triggerAutoSave();
        if (typeof window.recordEditorHistory === 'function') window.recordEditorHistory('GDS Preset Added');

        showToast('প্রিসেট ব্যানার সফলভাবে ভিডিওতে যুক্ত হয়েছে!');
    }

    // ── DOM UI Injection ─────────────────────────────────────────────────────────
    function injectStep1LogoButtons() {
        var logoContainer = document.querySelector('.logo-upload-container');
        if (!logoContainer || document.getElementById('gds-logo-quick-bar')) return;

        var bar = document.createElement('div');
        bar.id = 'gds-logo-quick-bar';
        bar.style.cssText = 'margin-top:12px; padding:12px 14px; background:linear-gradient(135deg, rgba(10,25,47,0.85), rgba(15,39,68,0.9)); border:1px solid rgba(56,189,248,0.3); border-radius:10px; display:flex; flex-direction:column; gap:8px; box-shadow:0 4px 15px rgba(0,0,0,0.3);';

        var cfg = getConfig();

        bar.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
                <span style="font-size:12.5px; font-weight:700; color:#fbbf24; display:flex; align-items:center; gap:6px;">
                    <i class="fa-solid fa-crown" style="color:#f59e0b;"></i> GDS Training Hub Brand
                </span>
                <span style="font-size:11px; color:#38bdf8; background:rgba(56,189,248,0.12); padding:2px 8px; border-radius:12px; border:1px solid rgba(56,189,248,0.25);">
                    ১-ক্লিক প্রিসেট
                </span>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <button type="button" id="gds-btn-load-logo-png" class="btn btn-sm btn-primary" style="flex:1; min-width:140px; background:linear-gradient(135deg, #0284c7, #0369a1); border:none; font-weight:600; padding:7px 10px; font-size:12px;">
                    <i class="fa-solid fa-bolt"></i> ⚡ Use GDS Logo (PNG)
                </button>
                <button type="button" id="gds-btn-load-logo-gif" class="btn btn-sm btn-outline" style="border-color:rgba(56,189,248,0.4); color:#e0f2fe; font-size:11.5px; padding:7px 10px;">
                    <i class="fa-solid fa-film"></i> Use GIF Logo
                </button>
            </div>
            <label style="display:flex; align-items:center; gap:8px; font-size:11.5px; color:#cbd5e1; cursor:pointer; margin-top:2px;">
                <input type="checkbox" id="gds-auto-logo-checkbox" ${cfg.autoLogo ? 'checked' : ''} style="cursor:pointer; accent-color:#38bdf8;">
                <span>নতুন ভিডিও ওপেন হলে অটোমেটিক এই লোগো সেট রাখুন</span>
            </label>
        `;

        logoContainer.parentNode.insertBefore(bar, logoContainer.nextSibling);

        document.getElementById('gds-btn-load-logo-png').addEventListener('click', function () {
            loadGdsLogo('assets/branding/logo.png');
        });

        document.getElementById('gds-btn-load-logo-gif').addEventListener('click', function () {
            loadGdsLogo('assets/branding/logo.gif');
        });

        var autoCheck = document.getElementById('gds-auto-logo-checkbox');
        if (autoCheck) {
            autoCheck.addEventListener('change', function () {
                var c = getConfig();
                c.autoLogo = autoCheck.checked;
                saveConfig(c);
                showToast(c.autoLogo ? 'অটো-লোগো অন করা হয়েছে' : 'অটো-লোগো অফ করা হয়েছে');
            });
        }
    }

    function injectStep3BrandingCard() {
        var panel3 = document.getElementById('panel-3');
        if (!panel3 || document.getElementById('card-gds-branding')) return;

        var card = document.createElement('div');
        card.className = 'card mt-4';
        card.id = 'card-gds-branding';
        card.style.cssText = 'border: 1px solid rgba(56, 189, 248, 0.35); box-shadow: 0 4px 20px rgba(6, 182, 212, 0.12); position:relative; overflow:hidden;';

        var cfg = getConfig();

        card.innerHTML = `
            <div class="card-header" style="background: linear-gradient(135deg, rgba(10,25,47,0.95), rgba(15,39,68,0.95)); border-bottom: 1px solid rgba(56,189,248,0.25); display:flex; align-items:center; justify-content:space-between;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-crown card-icon" style="color: #f59e0b;"></i>
                    <h3 style="color:#ffffff; font-size:15px; margin:0;">GDS Training Hub — ব্র্যান্ডিং ও সোশ্যাল প্রিসেট</h3>
                </div>
                <span class="badge" style="background: rgba(245,158,11,0.15); color: #fbbf24; border: 1px solid rgba(245,158,11,0.3); font-size: 11px; padding: 2px 8px; border-radius: 6px; font-weight: 600;">
                    ১-ক্লিক এডিটর
                </span>
            </div>
            <div class="card-body" style="background: rgba(7, 24, 39, 0.5);">
                <p class="help-text" style="color: #cbd5e1; font-size: 12.5px; line-height: 1.5;">
                    প্রত্যেক ভিডিওতে বারবার লিঙ্ক টাইপ করার ঝামেলা নেই! আপনার ফেসবুক, ইউটিউব, হোয়াটসঅ্যাপ, ওয়েবসাইট ও লোগো সুন্দর ডিজাইনের বক্সে এক ক্লিকেই ভিডিওতে বসে যাবে।
                </p>

                <!-- Super 1-Click All-in-One Button -->
                <div style="margin: 14px 0 16px 0;">
                    <button type="button" id="gds-action-all-in-one" class="btn btn-primary btn-block" style="background: linear-gradient(135deg, #0284c7, #2563eb); border: 1px solid #38bdf8; font-size: 14px; font-weight: 700; padding: 12px; box-shadow: 0 4px 15px rgba(2,132,199,0.35); display:flex; align-items:center; justify-content:center; gap:8px;">
                        <i class="fa-solid fa-wand-magic-sparkles" style="color:#fde047;"></i> ⚡ অল-ইন-ওয়ান: লোগো + সোশ্যাল বার একসাথে বসান
                    </button>
                </div>

                <!-- Individual Preset Cards Grid -->
                <label style="font-size:12px; font-weight:700; color:#38bdf8; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px; display:block;">
                    আলাদা প্রিসেট ডিজাইনসমূহ (বেছে নিন)
                </label>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px;">
                    <button type="button" id="gds-action-social-strip" class="btn btn-outline" style="padding: 10px 8px; text-align: left; background: rgba(10,25,47,0.7); border-color: rgba(56,189,248,0.3); font-size: 12px; line-height: 1.3;">
                        <div style="font-weight: 700; color: #38bdf8; margin-bottom: 2px;">🌟 ৩-ইন-১ সোশ্যাল বার</div>
                        <span style="font-size: 10.5px; color: #94a3b8;">ওয়েব + হোয়াটসঅ্যাপ + এফবি/ইউটি</span>
                    </button>
                    <button type="button" id="gds-action-reels-card" class="btn btn-outline" style="padding: 10px 8px; text-align: left; background: rgba(10,25,47,0.7); border-color: rgba(251,191,36,0.3); font-size: 12px; line-height: 1.3;">
                        <div style="font-weight: 700; color: #fbbf24; margin-bottom: 2px;">✈️ রিলস ব্র্যান্ড কার্ড</div>
                        <span style="font-size: 10.5px; color: #94a3b8;">গোল্ড হেডার + কন্টাক্ট বক্স</span>
                    </button>
                    <button type="button" id="gds-action-helpline-pill" class="btn btn-outline" style="padding: 10px 8px; text-align: left; background: rgba(10,25,47,0.7); border-color: rgba(34,197,94,0.3); font-size: 12px; line-height: 1.3;">
                        <div style="font-weight: 700; color: #4ade80; margin-bottom: 2px;">🟢 হোয়াটসঅ্যাপ পিল ব্যাজ</div>
                        <span style="font-size: 10.5px; color: #94a3b8;">01674091748 গ্রিন কলআউট</span>
                    </button>
                    <button type="button" id="gds-action-pinned-cta" class="btn btn-outline" style="padding: 10px 8px; text-align: left; background: rgba(10,25,47,0.7); border-color: rgba(244,63,94,0.3); font-size: 12px; line-height: 1.3;">
                        <div style="font-weight: 700; color: #fb7185; margin-bottom: 2px;">📌 পিন কমেন্ট CTA</div>
                        <span style="font-size: 10.5px; color: #94a3b8;">ফুল ভিডিও: পিন করা কমেন্টে 👇</span>
                    </button>
                    <button type="button" id="gds-action-glass-stack" class="btn btn-outline" style="padding: 10px 8px; text-align: left; background: rgba(10,25,47,0.7); border-color: rgba(168,85,247,0.3); font-size: 12px; line-height: 1.3;">
                        <div style="font-weight: 700; color: #c084fc; margin-bottom: 2px;">🎴 ৪-কার্ড গ্লাস স্ট্যাক</div>
                        <span style="font-size: 10.5px; color: #94a3b8;">Reels প্রফেশনাল গ্লাস কার্ড</span>
                    </button>
                    <button type="button" id="gds-action-outro-banner" class="btn btn-outline" style="padding: 10px 8px; text-align: left; background: rgba(10,25,47,0.7); border-color: rgba(250,204,21,0.3); font-size: 12px; line-height: 1.3;">
                        <div style="font-weight: 700; color: #facc15; margin-bottom: 2px;">🎬 আউটরো সোশ্যাল ব্যানার</div>
                        <span style="font-size: 10.5px; color: #94a3b8;">ভিডিওর শেষ ৫ সেকেন্ডের আউটরো</span>
                    </button>
                </div>

                <!-- Delete & Remove Options -->
                <div style="margin-bottom: 14px; padding: 10px 12px; background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.25); border-radius: 8px;">
                    <div style="font-size: 11.5px; font-weight: 700; color: #fca5a5; margin-bottom: 8px; display:flex; align-items:center; gap:6px;">
                        <i class="fa-solid fa-trash-can" style="color:#ef4444;"></i> ডিলিট / রিমুভ অপশনসমূহ (Delete Options)
                    </div>
                    <div style="display:flex; gap:6px; flex-wrap:wrap;">
                        <button type="button" id="gds-action-clear-overlays" class="btn btn-sm btn-outline" style="flex:1; min-width:130px; border-color:rgba(239,68,68,0.45); color:#fca5a5; background:rgba(239,68,68,0.1); font-size:11.5px; padding:6px 10px;">
                            <i class="fa-solid fa-trash-can"></i> ব্যানার মুছুন (Clear)
                        </button>
                        <button type="button" id="gds-action-remove-logo" class="btn btn-sm btn-outline" style="border-color:rgba(239,68,68,0.45); color:#fca5a5; background:rgba(239,68,68,0.1); font-size:11.5px; padding:6px 10px;">
                            <i class="fa-solid fa-image"></i> লোগো মুছুন
                        </button>
                        <button type="button" id="gds-action-clear-all" class="btn btn-sm btn-outline" style="border-color:#ef4444; color:#ffffff; background:rgba(239,68,68,0.25); font-size:11.5px; padding:6px 10px; font-weight:600;">
                            <i class="fa-solid fa-broom"></i> সব রিসেট (All)
                        </button>
                    </div>
                </div>

                <!-- Timing Options -->
                <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 10px 12px; margin-bottom: 12px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
                    <span style="font-size: 12px; color: #e2e8f0; font-weight: 600;"><i class="fa-regular fa-clock"></i> ব্যানারের সময়কাল (Duration):</span>
                    <div style="display: flex; gap: 14px; font-size: 12px; color: #cbd5e1;">
                        <label style="cursor: pointer; display:flex; align-items:center; gap:4px;">
                            <input type="radio" name="gds-timing-radio" value="full" ${cfg.fullDuration ? 'checked' : ''} style="accent-color:#38bdf8;">
                            <span>পুরো ভিডিও জুড়ে (Full Video)</span>
                        </label>
                        <label style="cursor: pointer; display:flex; align-items:center; gap:4px;">
                            <input type="radio" name="gds-timing-radio" value="current" ${!cfg.fullDuration ? 'checked' : ''} style="accent-color:#38bdf8;">
                            <span>৬ সেকেন্ড</span>
                        </label>
                    </div>
                </div>

                <!-- Collapsible Settings for Changing links / numbers -->
                <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 10px;">
                    <button type="button" id="gds-toggle-edit-fields" style="background:none; border:none; color:#38bdf8; font-size:12px; font-weight:600; cursor:pointer; padding:4px 0; display:flex; align-items:center; gap:6px;">
                        <i class="fa-solid fa-gear"></i> লিঙ্ক বা ফোন নম্বর পরিবর্তন / কাস্টমাইজ করুন <i class="fa-solid fa-chevron-down" id="gds-chevron-icon"></i>
                    </button>
                    <div id="gds-edit-fields-panel" style="display:none; margin-top:10px; background:rgba(0,0,0,0.25); padding:12px; border-radius:8px; border:1px solid rgba(255,255,255,0.06);">
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
                            <div>
                                <label style="font-size:11px; color:#94a3b8; display:block; margin-bottom:2px;">ওয়েবসাইট</label>
                                <input type="text" id="gds-input-website" class="form-input" style="font-size:12px; height:32px;" value="${cfg.website}">
                            </div>
                            <div>
                                <label style="font-size:11px; color:#94a3b8; display:block; margin-bottom:2px;">WhatsApp / হেল্পলাইন</label>
                                <input type="text" id="gds-input-whatsapp" class="form-input" style="font-size:12px; height:32px;" value="${cfg.whatsapp}">
                            </div>
                        </div>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
                            <div>
                                <label style="font-size:11px; color:#94a3b8; display:block; margin-bottom:2px;">ফেসবুক পেজ</label>
                                <input type="text" id="gds-input-facebook" class="form-input" style="font-size:12px; height:32px;" value="${cfg.facebook}">
                            </div>
                            <div>
                                <label style="font-size:11px; color:#94a3b8; display:block; margin-bottom:2px;">ইউটিউব চ্যানেল</label>
                                <input type="text" id="gds-input-youtube" class="form-input" style="font-size:12px; height:32px;" value="${cfg.youtube}">
                            </div>
                        </div>
                        <div style="margin-bottom:8px;">
                            <label style="font-size:11px; color:#94a3b8; display:block; margin-bottom:2px;">পিন কমেন্ট টেক্সট</label>
                            <input type="text" id="gds-input-pinned" class="form-input" style="font-size:12px; height:32px;" value="${cfg.pinnedCta}">
                        </div>
                        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">
                            <button type="button" id="gds-btn-save-settings" class="btn btn-sm btn-primary" style="font-size:11.5px; padding:5px 12px;">
                                <i class="fa-solid fa-check"></i> ডিফল্ট হিসেবে সংরক্ষণ করুন
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Insert before or after card-lower-thirds
        var lowerThirdCard = document.getElementById('card-lower-thirds');
        if (lowerThirdCard && lowerThirdCard.parentNode) {
            lowerThirdCard.parentNode.insertBefore(card, lowerThirdCard);
        } else {
            panel3.appendChild(card);
        }

        // Hook click handlers
        function getActiveOptions(extra) {
            var fullRadio = document.querySelector('input[name="gds-timing-radio"]:checked');
            var isFull = fullRadio ? fullRadio.value === 'full' : true;
            return Object.assign({
                fullDuration: isFull,
                website: document.getElementById('gds-input-website') ? document.getElementById('gds-input-website').value.trim() : null,
                whatsapp: document.getElementById('gds-input-whatsapp') ? document.getElementById('gds-input-whatsapp').value.trim() : null,
                facebook: document.getElementById('gds-input-facebook') ? document.getElementById('gds-input-facebook').value.trim() : null,
                youtube: document.getElementById('gds-input-youtube') ? document.getElementById('gds-input-youtube').value.trim() : null,
                pinnedCta: document.getElementById('gds-input-pinned') ? document.getElementById('gds-input-pinned').value.trim() : null
            }, extra || {});
        }

        document.getElementById('gds-action-all-in-one').addEventListener('click', function () {
            applyGdsPreset('all-in-one', getActiveOptions());
        });

        document.getElementById('gds-action-social-strip').addEventListener('click', function () {
            applyGdsPreset('social-strip', getActiveOptions());
        });

        document.getElementById('gds-action-reels-card').addEventListener('click', function () {
            applyGdsPreset('reels-card', getActiveOptions());
        });

        document.getElementById('gds-action-helpline-pill').addEventListener('click', function () {
            applyGdsPreset('helpline-pill', getActiveOptions());
        });

        document.getElementById('gds-action-pinned-cta').addEventListener('click', function () {
            applyGdsPreset('pinned-cta', getActiveOptions());
        });

        document.getElementById('gds-action-glass-stack').addEventListener('click', function () {
            applyGdsPreset('glass-stack', getActiveOptions());
        });

        document.getElementById('gds-action-outro-banner').addEventListener('click', function () {
            applyGdsPreset('outro-banner', getActiveOptions({ isOutro: true }));
        });

        // Delete / Remove action handlers
        var clearOverlaysBtn = document.getElementById('gds-action-clear-overlays');
        if (clearOverlaysBtn) {
            clearOverlaysBtn.addEventListener('click', function () {
                clearGdsOverlays();
            });
        }

        var removeLogoBtn = document.getElementById('gds-action-remove-logo');
        if (removeLogoBtn) {
            removeLogoBtn.addEventListener('click', function () {
                removeGdsLogo();
            });
        }

        var clearAllBtn = document.getElementById('gds-action-clear-all');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', function () {
                clearAllGdsBranding();
            });
        }

        // Toggle edit settings
        var toggleBtn = document.getElementById('gds-toggle-edit-fields');
        var editPanel = document.getElementById('gds-edit-fields-panel');
        var chevron = document.getElementById('gds-chevron-icon');
        if (toggleBtn && editPanel) {
            toggleBtn.addEventListener('click', function () {
                var isOpen = editPanel.style.display !== 'none';
                editPanel.style.display = isOpen ? 'none' : 'block';
                if (chevron) chevron.className = isOpen ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-up';
            });
        }

        // Save settings button
        var saveBtn = document.getElementById('gds-btn-save-settings');
        if (saveBtn) {
            saveBtn.addEventListener('click', function () {
                var current = getConfig();
                current.website = document.getElementById('gds-input-website').value.trim() || current.website;
                current.whatsapp = document.getElementById('gds-input-whatsapp').value.trim() || current.whatsapp;
                current.facebook = document.getElementById('gds-input-facebook').value.trim() || current.facebook;
                current.youtube = document.getElementById('gds-input-youtube').value.trim() || current.youtube;
                current.pinnedCta = document.getElementById('gds-input-pinned').value.trim() || current.pinnedCta;

                var fullRadio = document.querySelector('input[name="gds-timing-radio"]:checked');
                current.fullDuration = fullRadio ? fullRadio.value === 'full' : true;

                saveConfig(current);
                showToast('আপনার ব্র্যান্ড লিঙ্ক ও সেটিংস সংরক্ষিত হয়েছে!');
            });
        }
    }

    function injectHeaderQuickBtn() {
        var headerActions = document.querySelector('.header-actions');
        if (!headerActions || document.getElementById('gds-header-quick-btn')) return;

        var btn = document.createElement('button');
        btn.id = 'gds-header-quick-btn';
        btn.type = 'button';
        btn.className = 'btn btn-outline btn-sm';
        btn.title = 'GDS Training Hub ১-ক্লিক ব্র্যান্ডিং ও সোশ্যাল প্রিসেট';
        btn.style.cssText = 'color:#fbbf24; border-color:rgba(245,158,11,0.5); background:rgba(245,158,11,0.08); font-weight:600; display:flex; align-items:center; gap:5px;';
        btn.innerHTML = '<i class="fa-solid fa-crown" style="color:#f59e0b;"></i> <span>GDS Hub</span>';

        btn.addEventListener('click', function () {
            var state = ve();
            if (state && !state.duration && (!state.clips || !state.clips.length)) {
                // If no video yet, switch to Step 1 to load video / logo
                var step1Btn = document.getElementById('step-btn-1');
                if (step1Btn) step1Btn.click();
                showToast('ভিডিও যোগ করার পর Step 3 থেকে যেকোনো সোশ্যাল প্রিসেট সিলেক্ট করতে পারবেন। নিচে থেকে লোগো যোগ করতে পারেন।');
                return;
            }
            var step3Btn = document.getElementById('step-btn-3');
            if (step3Btn) step3Btn.click();
            setTimeout(function () {
                var card = document.getElementById('card-gds-branding');
                if (card) {
                    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    card.style.transition = 'box-shadow 0.3s ease';
                    card.style.boxShadow = '0 0 25px rgba(56,189,248,0.6)';
                    setTimeout(function () {
                        card.style.boxShadow = '0 4px 20px rgba(6, 182, 212, 0.12)';
                    }, 1200);
                }
            }, 150);
        });

        // Insert before projects btn or at start of actions
        var savedProjectsBtn = document.getElementById('saved-projects-btn');
        if (savedProjectsBtn) {
            headerActions.insertBefore(btn, savedProjectsBtn);
        } else {
            headerActions.appendChild(btn);
        }
    }

    // ── Auto-apply on Video Load ────────────────────────────────────────────────
    function setupAutoLogoListener() {
        var videoInput = document.getElementById('video-input');
        if (videoInput) {
            videoInput.addEventListener('change', function () {
                var cfg = getConfig();
                if (cfg.autoLogo) {
                    setTimeout(function () {
                        loadGdsLogo(null, true);
                    }, 700);
                }
            });
        }
    }

    function init() {
        injectStep1LogoButtons();
        injectStep3BrandingCard();
        injectHeaderQuickBtn();
        setupAutoLogoListener();

        // Check if video is already present on load
        var cfg = getConfig();
        var state = ve();
        if (cfg.autoLogo && state && (!state.logoImg && (state.video || (state.clips && state.clips.length > 0)))) {
            setTimeout(function () {
                loadGdsLogo(null, true);
            }, 1000);
        }
        // Global keyboard shortcut: Delete or Backspace to delete selected text overlay
        document.addEventListener('keydown', function (e) {
            var activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
            if (activeTag === 'input' || activeTag === 'textarea' || (document.activeElement && document.activeElement.isContentEditable)) {
                return;
            }
            if (e.key === 'Delete' || e.key === 'Backspace') {
                var state = ve();
                if (state && state.selectedTextOverlayId) {
                    var delOriginal = document.getElementById('delete-text-overlay-btn');
                    if (delOriginal) {
                        delOriginal.click();
                        e.preventDefault();
                    }
                }
            }
        });
    }

    // Expose to window for external access
    window.GDS_BRANDING = {
        getConfig: getConfig,
        saveConfig: saveConfig,
        loadLogo: loadGdsLogo,
        removeLogo: removeGdsLogo,
        clearOverlays: clearGdsOverlays,
        clearAll: clearAllGdsBranding,
        applyPreset: applyGdsPreset
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            setTimeout(init, 400);
        });
    } else {
        setTimeout(init, 300);
    }
})();
