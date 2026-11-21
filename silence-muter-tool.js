/* ==========================================================================
   Studio Flow — Standalone Silence Muter & Voice Gate Tool
   Fast lossless video stream copy (-c:v copy) + speech-preserving noise gate
   ========================================================================== */

(function () {
    'use strict';

    function initSilenceMuterTool() {
        const modal = document.getElementById('silence-muter-modal');
        const openBtn = document.getElementById('open-silence-muter-modal-btn');
        const closeBtn1 = document.getElementById('silence-muter-close-x');
        const closeBtn2 = document.getElementById('silence-muter-close-btn');

        const dropzone = document.getElementById('sm-dropzone');
        const fileInput = document.getElementById('sm-file-input');
        const thresholdSlider = document.getElementById('sm-threshold-slider');
        const thresholdVal = document.getElementById('sm-threshold-val');
        const processBtn = document.getElementById('sm-process-btn');

        const progressContainer = document.getElementById('sm-progress-container');
        const progressBar = document.getElementById('sm-progress-bar');
        const statusText = document.getElementById('sm-status-text');

        const resultContainer = document.getElementById('sm-result-container');
        const resultFileInfo = document.getElementById('sm-result-file-info');
        const downloadBtn = document.getElementById('sm-download-btn');

        let selectedFile = null;

        if (!modal) return;

        function openModal() {
            modal.style.display = 'flex';
        }

        function closeModal() {
            modal.style.display = 'none';
        }

        if (openBtn) openBtn.addEventListener('click', openModal);
        if (closeBtn1) closeBtn1.addEventListener('click', closeModal);
        if (closeBtn2) closeBtn2.addEventListener('click', closeModal);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        if (thresholdSlider && thresholdVal) {
            thresholdSlider.addEventListener('input', (e) => {
                thresholdVal.innerText = `${e.target.value} dB`;
            });
        }

        function handleFile(file) {
            if (!file) return;
            selectedFile = file;
            const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
            const dropzoneText = document.getElementById('sm-dropzone-text');
            if (dropzoneText) {
                dropzoneText.innerHTML = `<b>${escapeHtml(file.name)}</b> (${sizeMB} MB) সিলেক্ট করা হয়েছে`;
            }
            if (processBtn) processBtn.disabled = false;
            if (resultContainer) resultContainer.style.display = 'none';
        }

        if (dropzone && fileInput) {
            dropzone.addEventListener('click', () => fileInput.click());

            dropzone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropzone.style.borderColor = '#10b981';
                dropzone.style.background = 'rgba(16,185,129,0.12)';
            });

            dropzone.addEventListener('dragleave', (e) => {
                e.preventDefault();
                dropzone.style.borderColor = 'rgba(16,185,129,0.4)';
                dropzone.style.background = 'rgba(16,185,129,0.04)';
            });

            dropzone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropzone.style.borderColor = 'rgba(16,185,129,0.4)';
                dropzone.style.background = 'rgba(16,185,129,0.04)';
                if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
                    handleFile(e.dataTransfer.files[0]);
                }
            });

            fileInput.addEventListener('change', () => {
                if (fileInput.files && fileInput.files.length) {
                    handleFile(fileInput.files[0]);
                }
            });
        }

        if (processBtn) {
            processBtn.addEventListener('click', async () => {
                if (!selectedFile) {
                    alert('অনুগ্রহ করে একটি ভিডিও বা অডিও ফাইল সিলেক্ট করুন।');
                    return;
                }

                const threshold = thresholdSlider ? thresholdSlider.value : '-38';
                processBtn.disabled = true;
                if (progressContainer) progressContainer.style.display = 'block';
                if (resultContainer) resultContainer.style.display = 'none';
                if (progressBar) progressBar.style.width = '30%';

                // Check if local file path is available in desktop/Electron mode
                let localPath = selectedFile.path || '';
                if (!localPath && window.electronAPI && typeof window.electronAPI.getPathForFile === 'function') {
                    try { localPath = window.electronAPI.getPathForFile(selectedFile) || ''; } catch (_) {}
                }

                try {
                    let data;
                    if (localPath) {
                        // Desktop mode: Process directly without uploading 220MB!
                        if (statusText) statusText.innerText = '⚡ লোকাল ফাইলে হাই-স্পিড FFmpeg দিয়ে নীরব অংশ মিউট করা হচ্ছে...';
                        if (progressBar) progressBar.style.width = '60%';

                        const response = await fetch('/api/silence-muter-direct', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                filePath: localPath,
                                filename: selectedFile.name,
                                threshold: threshold
                            })
                        });

                        data = await response.json();
                        if (!response.ok || !data.success) {
                            throw new Error(data.error || 'সাইলেন্স মিউট করতে ব্যর্থ হয়েছে।');
                        }
                    } else {
                        // Browser streaming mode
                        if (statusText) statusText.innerText = 'ফাইল সার্ভারে পাঠানো হচ্ছে...';
                        const url = `/api/silence-muter?filename=${encodeURIComponent(selectedFile.name)}&threshold=${encodeURIComponent(threshold)}`;

                        const response = await fetch(url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/octet-stream' },
                            body: selectedFile
                        });

                        data = await response.json();
                        if (!response.ok || !data.success) {
                            throw new Error(data.error || 'সাইলেন্স মিউট করতে ব্যর্থ হয়েছে।');
                        }
                    }

                    if (progressBar) progressBar.style.width = '100%';
                    if (statusText) statusText.innerText = '✅ প্রসেসিং সম্পন্ন হয়েছে!';

                    setTimeout(() => {
                        if (progressContainer) progressContainer.style.display = 'none';
                        if (resultContainer) resultContainer.style.display = 'block';

                        let infoMsg = `ফাইলের নাম: ${data.filename || selectedFile.name}`;
                        if (data.localPath) {
                            infoMsg += `<br><small style="color: #a7f3d0;">📁 মূল ফোল্ডারেও সেভ হয়েছে: ${escapeHtml(data.localPath)}</small>`;
                        }
                        if (resultFileInfo) {
                            resultFileInfo.innerHTML = infoMsg;
                        }

                        if (downloadBtn) {
                            downloadBtn.onclick = () => {
                                const a = document.createElement('a');
                                a.href = data.downloadUrl;
                                a.download = data.filename || 'silence_muted.mp4';
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                            };
                        }
                        processBtn.disabled = false;
                    }, 400);

                } catch (err) {
                    console.error('Silence muter error:', err);
                    if (progressBar) progressBar.style.width = '0%';
                    if (statusText) {
                        statusText.innerHTML = `<span style="color:#ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> সমস্যা: ${escapeHtml(err.message)}</span><br><small style="color:#94a3b8;">টিপস: ব্রাউজার রিফ্রেশ করুন বা ডেস্কটপের run_audio_silence_muter.bat ব্যবহার করুন।</small>`;
                    }
                    processBtn.disabled = false;
                }
            });
        }

        function escapeHtml(str) {
            return String(str).replace(/[&<>"']/g, s => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
            }[s]));
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSilenceMuterTool);
    } else {
        initSilenceMuterTool();
    }
})();
