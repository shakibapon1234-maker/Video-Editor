(() => {
    'use strict';

    const fileInput = document.getElementById('fast-join-files');
    const picker = document.getElementById('fast-join-picker');
    const browseButton = document.getElementById('fast-join-browse');
    const pickerLabel = document.getElementById('fast-join-picker-label');
    const queue = document.getElementById('fast-join-queue');
    const outputName = document.getElementById('fast-join-output-name');
    const startButton = document.getElementById('fast-join-start');
    const progressWrap = document.getElementById('fast-join-progress-wrap');
    const progressBar = document.getElementById('fast-join-progress');
    const progressPercent = document.getElementById('fast-join-percent');
    const statusText = document.getElementById('fast-join-status');
    const result = document.getElementById('fast-join-result');
    if (!fileInput || !startButton) return;

    let files = [];
    let busy = false;
    const formatSize = (bytes) => bytes < 1024 * 1024
        ? `${Math.max(1, Math.round(bytes / 1024))} KB`
        : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

    function renderQueue() {
        queue.replaceChildren();
        files.forEach((file, index) => {
            const row = document.createElement('li');
            row.className = 'fast-join-queue-row';
            const name = document.createElement('span');
            name.textContent = `${index + 1}. ${file.name} (${formatSize(file.size)})`;
            name.title = file.name;
            const controls = document.createElement('span');
            controls.className = 'fast-join-row-controls';
            [[-1, 'Move up'], [1, 'Move down']].forEach(([delta, label]) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'btn btn-sm btn-outline';
                button.textContent = delta < 0 ? '↑' : '↓';
                button.title = label;
                button.disabled = busy || index + delta < 0 || index + delta >= files.length;
                button.addEventListener('click', () => {
                    [files[index], files[index + delta]] = [files[index + delta], files[index]];
                    renderQueue();
                });
                controls.appendChild(button);
            });
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'btn btn-sm btn-outline';
            remove.textContent = '×';
            remove.title = 'Remove clip';
            remove.disabled = busy;
            remove.addEventListener('click', () => { files.splice(index, 1); renderQueue(); });
            controls.appendChild(remove);
            row.append(name, controls);
            queue.appendChild(row);
        });
        pickerLabel.textContent = files.length ? `${files.length} clip(s) selected — choose more to add` : 'Select 2 or more finished video clips';
        startButton.disabled = busy || files.length < 2;
    }

    function setProgress(percent, message) {
        const value = Math.max(0, Math.min(100, Math.round(percent)));
        progressBar.value = value;
        progressPercent.textContent = `${value}%`;
        if (message) statusText.textContent = message;
    }

    async function postJson(url, body) {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
        return data;
    }

    function uploadFile(sessionId, file, index, basePercent, weightPercent) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', `/api/fast-join/${encodeURIComponent(sessionId)}/upload/${index}`);
            xhr.setRequestHeader('Content-Type', 'application/octet-stream');
            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) setProgress(basePercent + (event.loaded / event.total) * weightPercent, `Uploading clip ${index + 1} of ${files.length}…`);
            };
            xhr.onerror = () => reject(new Error('Upload connection failed. Keep the editor open and try again.'));
            xhr.onload = () => {
                let data = {};
                try { data = JSON.parse(xhr.responseText); } catch (_) {}
                if (xhr.status < 200 || xhr.status >= 300) reject(new Error(data.error || `Upload failed (${xhr.status}).`));
                else resolve();
            };
            xhr.send(file);
        });
    }

    function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

    async function run() {
        if (busy || files.length < 2) return;
        busy = true;
        result.textContent = '';
        progressWrap.hidden = false;
        setProgress(0, 'Preparing clips…');
        renderQueue();
        try {
            const extension = (files[0].name.match(/\.[^.]+$/) || ['.mp4'])[0].toLowerCase();
            const selectedExts = [...new Set(files.map((file) => (file.name.match(/\.[^.]+$/) || ['.mp4'])[0].toLowerCase()))];
            if (selectedExts.length !== 1) throw new Error('For fast joining, all clips must have the same file format (for example, all MP4).');
            if (!outputName.value.trim()) outputName.value = `joined-video${extension}`;
            const session = await postJson('/api/fast-join/init', { files: files.map((file) => file.name) });
            const totalBytes = files.reduce((sum, file) => sum + file.size, 0) || 1;
            let uploadedBytes = 0;
            for (let i = 0; i < files.length; i++) {
                const portion = (files[i].size / totalBytes) * 50;
                const start = (uploadedBytes / totalBytes) * 50;
                await uploadFile(session.sessionId, files[i], i, start, portion);
                uploadedBytes += files[i].size;
            }
            setProgress(50, 'Joining clips without re-rendering…');
            await postJson(`/api/fast-join/${encodeURIComponent(session.sessionId)}/compile`, { outputName: outputName.value.trim() });
            let state;
            do {
                await wait(700);
                const response = await fetch(`/api/fast-join/${encodeURIComponent(session.sessionId)}/status`, { cache: 'no-store' });
                state = await response.json();
                if (!response.ok) throw new Error(state.error || 'Could not check joining progress.');
                setProgress(50 + (state.percent || 0) * 0.3, state.status === 'done' ? 'Preparing save…' : 'Joining clips without re-rendering…');
                if (state.status === 'error') throw new Error(state.error || 'FFmpeg could not join these clips.');
            } while (state.status !== 'done');
            if (window.electronAPI && typeof window.electronAPI.saveFastJoinVideo === 'function') {
                setProgress(80, 'Choose where to save the joined video…');
                const unsubscribe = typeof window.electronAPI.onFastJoinSaveProgress === 'function'
                    ? window.electronAPI.onFastJoinSaveProgress((progress) => setProgress(80 + (progress.percent || 0) * 0.2, 'Saving joined video…'))
                    : () => {};
                try {
                    const saved = await window.electronAPI.saveFastJoinVideo(state.downloadUrl, state.filename || outputName.value.trim());
                    if (saved.canceled) {
                        setProgress(80, 'Save canceled');
                        result.textContent = 'The joined file is ready. Choose Join Clips again to save it.';
                    } else {
                        setProgress(100, 'Saved');
                        result.textContent = `Saved: ${saved.filePath}`;
                    }
                } finally { unsubscribe(); }
            } else {
                const link = document.createElement('a');
                link.href = state.downloadUrl;
                link.download = state.filename || outputName.value.trim();
                document.body.appendChild(link);
                link.click();
                link.remove();
                setProgress(100, 'Download started');
                result.textContent = `Ready: ${state.filename}. Your browser will save the joined video.`;
            }
        } catch (error) {
            result.textContent = `${error.message} This fast-join tool requires the Studio Flow desktop app's local FFmpeg service.`;
            progressWrap.hidden = false;
            statusText.textContent = 'Could not complete';
        } finally {
            busy = false;
            renderQueue();
        }
    }

    browseButton.addEventListener('click', () => fileInput.click());
    picker.addEventListener('click', (event) => { if (event.target === picker || event.target === pickerLabel) fileInput.click(); });
    fileInput.addEventListener('change', () => {
        const incoming = Array.from(fileInput.files || []);
        incoming.forEach((file) => { if (!files.some((existing) => existing.name === file.name && existing.size === file.size && existing.lastModified === file.lastModified)) files.push(file); });
        fileInput.value = '';
        if (files[0] && outputName.value === 'joined-video.mp4') {
            const ext = (files[0].name.match(/\.[^.]+$/) || ['.mp4'])[0];
            const stem = files[0].name.slice(0, -ext.length).replace(/\s*\(part\s*\d+\)\s*$/i, '');
            outputName.value = `${stem}-joined${ext}`;
        }
        renderQueue();
    });
    startButton.addEventListener('click', run);
    renderQueue();
})();
