/* ==========================================================================
   Studio Flow — Standalone Audio to Text Converter (UI & Client Integration)
   Supports: MP3, M4A, MP4 (Audio), AAC, WAV, OGG, OPUS, FLAC, WEBM etc.
   ========================================================================== */

(function () {
    'use strict';

    let currentTranscript = '';
    let currentSrt = '';
    let currentFileName = '';

    function initAudioToText() {
        const modal = document.getElementById('audio-to-text-modal');
        const openNavBtn = document.getElementById('audio-to-text-nav-btn');
        const openPanelBtn = document.getElementById('open-audio-to-text-panel-btn');
        const closeBtn1 = document.getElementById('att-modal-close');
        const closeBtn2 = document.getElementById('att-modal-close-btn');

        const dropzone = document.getElementById('att-dropzone');
        const fileInput = document.getElementById('att-file-input');

        const progressWrap = document.getElementById('att-progress-container');
        const progressBar = document.getElementById('att-progress-bar');
        const statusText = document.getElementById('att-status-text');

        const resultWrap = document.getElementById('att-result-container');
        const resultTextarea = document.getElementById('att-text-result');
        const fileInfo = document.getElementById('att-file-info');

        const copyBtn = document.getElementById('att-copy-btn');
        const dlTxtBtn = document.getElementById('att-dl-txt-btn');
        const dlSrtBtn = document.getElementById('att-dl-srt-btn');
        const addSubtitlesBtn = document.getElementById('att-add-subtitles-btn');

        if (!modal) return;

        function openModal() {
            modal.style.display = 'flex';
        }

        function closeModal() {
            modal.style.display = 'none';
        }

        if (openNavBtn) openNavBtn.addEventListener('click', openModal);
        if (openPanelBtn) openPanelBtn.addEventListener('click', openModal);
        if (closeBtn1) closeBtn1.addEventListener('click', closeModal);
        if (closeBtn2) closeBtn2.addEventListener('click', closeModal);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        // Trigger file input on dropzone click
        if (dropzone && fileInput) {
            dropzone.addEventListener('click', () => fileInput.click());

            dropzone.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.style.borderColor = '#38bdf8';
                dropzone.style.background = 'rgba(56,189,248,0.12)';
            });

            dropzone.addEventListener('dragleave', (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.style.borderColor = 'rgba(56,189,248,0.4)';
                dropzone.style.background = 'rgba(56,189,248,0.03)';
            });

            dropzone.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.style.borderColor = 'rgba(56,189,248,0.4)';
                dropzone.style.background = 'rgba(56,189,248,0.03)';
                if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
                    handleAudioFile(e.dataTransfer.files[0]);
                }
            });

            fileInput.addEventListener('change', () => {
                if (fileInput.files && fileInput.files.length) {
                    handleAudioFile(fileInput.files[0]);
                }
            });
        }

        async function handleAudioFile(file) {
            if (!file) return;
            currentFileName = file.name;
            const sizeMB = (file.size / (1024 * 1024)).toFixed(1);

            if (resultWrap) resultWrap.style.display = 'none';
            if (progressWrap) progressWrap.style.display = 'block';
            if (progressBar) progressBar.style.width = '20%';
            if (statusText) statusText.innerHTML = `<b>${escapeHtml(file.name)}</b> (${sizeMB} MB) আপলোড হচ্ছে...`;

            try {
                // Upload via streaming fetch
                const url = `/api/audio-to-text?filename=${encodeURIComponent(file.name)}`;
                if (progressBar) progressBar.style.width = '40%';
                if (statusText) statusText.innerText = 'অডিও সার্ভারে আপলোড হচ্ছে...';

                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/octet-stream' },
                    body: file
                });

                if (progressBar) progressBar.style.width = '75%';
                if (statusText) statusText.innerText = '⚡ বাংলা স্পিচ রিকগনিশন (bn-BD) দ্বারা অডিও থেকে টেক্সট তৈরি হচ্ছে...';

                const data = await response.json();
                if (!response.ok || !data.success) {
                    throw new Error(data.error || 'কনভার্ট ব্যর্থ হয়েছে।');
                }

                if (progressBar) progressBar.style.width = '100%';
                if (statusText) statusText.innerText = 'সম্পন্ন হয়েছে!';

                currentTranscript = data.text || '';
                currentSrt = data.srt || '';

                setTimeout(() => {
                    if (progressWrap) progressWrap.style.display = 'none';
                    if (resultWrap) resultWrap.style.display = 'block';
                    if (resultTextarea) resultTextarea.value = currentTranscript;
                    if (fileInfo) fileInfo.innerText = `${file.name} • ${sizeMB} MB`;
                }, 300);

            } catch (err) {
                console.error('Audio to text error:', err);
                if (progressBar) progressBar.style.width = '0%';
                if (statusText) {
                    statusText.innerHTML = `<span style="color:#ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> সমস্যা: ${escapeHtml(err.message)}</span>`;
                }
            }
        }

        // Action: Copy Text
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                const text = resultTextarea ? resultTextarea.value : currentTranscript;
                if (!text) return;
                navigator.clipboard.writeText(text).then(() => {
                    const originalHtml = copyBtn.innerHTML;
                    copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> কপি হয়েছে!';
                    copyBtn.style.color = '#4ade80';
                    setTimeout(() => {
                        copyBtn.innerHTML = originalHtml;
                        copyBtn.style.color = '';
                    }, 2000);
                }).catch(() => {
                    if (resultTextarea) {
                        resultTextarea.select();
                        document.execCommand('copy');
                    }
                });
            });
        }

        // Action: Download TXT
        if (dlTxtBtn) {
            dlTxtBtn.addEventListener('click', () => {
                const text = resultTextarea ? resultTextarea.value : currentTranscript;
                if (!text) return;
                const base = (currentFileName || 'audio').replace(/\.[^/.]+$/, "");
                downloadFile(`${base}_transcript.txt`, text, 'text/plain;charset=utf-8');
            });
        }

        // Action: Download SRT
        if (dlSrtBtn) {
            dlSrtBtn.addEventListener('click', () => {
                if (!currentSrt) {
                    alert('কোনো SRT সাবটাইটেল ডেটা পাওয়া যায়নি।');
                    return;
                }
                const base = (currentFileName || 'audio').replace(/\.[^/.]+$/, "");
                downloadFile(`${base}_subtitle.srt`, currentSrt, 'text/plain;charset=utf-8');
            });
        }

        // Action: Add Subtitles directly into Timeline
        if (addSubtitlesBtn) {
            addSubtitlesBtn.addEventListener('click', () => {
                if (!currentSrt) {
                    alert('কোনো সাবটাইটেল ডেটা নেই।');
                    return;
                }

                const state = window.VideoEditor;
                if (!state) {
                    alert('ভিডিও এডিটর স্টেট পাওয়া যায়নি।');
                    return;
                }

                const cues = parseSrtText(currentSrt);
                if (!cues.length) {
                    alert('সাবটাইটেল পার্স করা যায়নি।');
                    return;
                }

                if (!state.subtitles) state.subtitles = [];
                const baseId = Date.now();
                cues.forEach((c, idx) => {
                    state.subtitles.push({
                        id: baseId + idx + Math.random(),
                        text: c.text,
                        startSec: c.startSec,
                        endSec: c.endSec
                    });
                });

                state.subtitles.sort((a, b) => a.startSec - b.startSec);

                if (typeof window.renderSubtitleList === 'function') window.renderSubtitleList();
                if (typeof window.drawEditorFrame === 'function') window.drawEditorFrame();

                addSubtitlesBtn.innerHTML = '<i class="fa-solid fa-check"></i> টাইমলাইনে যুক্ত হয়েছে!';
                addSubtitlesBtn.style.background = '#059669';

                setTimeout(() => {
                    closeModal();
                    addSubtitlesBtn.innerHTML = '<i class="fa-solid fa-closed-captioning"></i> টাইমলাইনে সাবটাইটেল হিসেবে যুক্ত করুন';
                    addSubtitlesBtn.style.background = '#10b981';

                    // If possible, navigate to Step 3 (Overlays / Subtitles)
                    const step3Btn = document.getElementById('step-btn-3');
                    if (step3Btn) step3Btn.click();
                }, 1000);
            });
        }
    }

    function parseSrtText(srtContent) {
        const text = srtContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const blocks = text.split(/\n\s*\n/);
        const arrowRe = /([0-9:.,]+)\s*-->\s*([0-9:.,]+)/;
        const cues = [];

        blocks.forEach(block => {
            const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            if (lines.length === 0) return;

            let arrowLineIdx = -1;
            let match = null;
            for (let i = 0; i < lines.length; i++) {
                const m = arrowRe.exec(lines[i]);
                if (m) { arrowLineIdx = i; match = m; break; }
            }
            if (arrowLineIdx === -1) return;

            const startSec = parseTimestamp(match[1]);
            const endSec = parseTimestamp(match[2]);
            if (startSec == null || endSec == null) return;

            const cueText = lines.slice(arrowLineIdx + 1).join(' ').trim();
            if (!cueText) return;

            cues.push({
                text: cueText,
                startSec: startSec,
                endSec: endSec <= startSec ? startSec + 0.5 : endSec
            });
        });

        return cues;
    }

    function parseTimestamp(raw) {
        if (!raw) return null;
        const t = raw.trim().replace(',', '.');
        const parts = t.split(':');
        if (parts.length === 3) {
            return (parseFloat(parts[0]) || 0) * 3600 + (parseFloat(parts[1]) || 0) * 60 + (parseFloat(parts[2]) || 0);
        } else if (parts.length === 2) {
            return (parseFloat(parts[0]) || 0) * 60 + (parseFloat(parts[1]) || 0);
        }
        return null;
    }

    function downloadFile(filename, content, mime) {
        const blob = new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function escapeHtml(str) {
        return String(str || '').replace(/[&<>"']/g, m => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        })[m]);
    }

    // Expose helper on window
    window.openAudioToTextModal = function () {
        const modal = document.getElementById('audio-to-text-modal');
        if (modal) modal.style.display = 'flex';
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAudioToText);
    } else {
        initAudioToText();
    }
})();
