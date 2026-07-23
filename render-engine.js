// Mobile Render Engine — replaces the old WebSocket-to-Node-server pipeline
// (server.js + ffmpeg-static, Windows-only) with an entirely in-browser
// pipeline using ffmpeg.wasm. This runs identically on the PC browser, on
// mobile Chrome, and inside a Capacitor WebView on Android — no local
// server, no network connection required after the first load (ffmpeg.wasm
// itself is fetched from CDN once and cached by the browser).
//
// This mirrors the OLD server.js API shape on purpose (init / sendFrame /
// sendAudio / compile) so exporter.js's frame-timing, B-roll-sync, and
// frame-padding logic — all hard-won across many debugging sessions —
// did not need to change AT ALL. Only the transport changed.
window.MobileRenderEngine = class MobileRenderEngine {
    constructor() {
        this.ffmpeg = null;
        this.frameCount = 0;
        this.hasAudio = false;
        this._loaded = false;
    }

    // Resolves the absolute base URL of our local ffmpeg bundle so it loads
    // correctly both from a dev server (http://localhost:5000/public/ffmpeg/...)
    // and from inside the Capacitor Android WebView. `public/` is copied to the
    // web root by Capacitor, so the path is always /public/ffmpeg/ from the
    // document's perspective.
    _resolveBase() {
        if (this._base) return this._base;
        const docBase = (typeof document !== 'undefined' && document.baseURI)
            ? document.baseURI
            : (typeof location !== 'undefined' ? location.href : '');
        // Strip any trailing file name so we always end with a slash.
        const dir = docBase.replace(/[^/]*$/, '');
        this._base = dir.replace(/\/?$/, '') + '/public/ffmpeg/';
        return this._base;
    }

    // Loads the ffmpeg.wasm core (~30MB, cached by the browser after first
    // run) and resets per-export state. Must be called once per export.
    async init(totalFrames, filename, onStatus) {
        this.totalFrames = totalFrames;
        this.filename = filename || 'export.mp4';
        this.frameCount = 0;
        this.hasAudio = false;

        if (!this._loaded) {
            if (onStatus) onStatus('রেন্ডার ইঞ্জিন লোড হচ্ছে... (প্রথমবার একটু সময় লাগবে)');
            // Load ffmpeg.wasm from our LOCAL bundle (public/ffmpeg) instead of a
            // CDN. This keeps the app fully offline-capable and avoids the
            // COOP/COEP cross-origin header requirement that breaks the WebView's
            // SharedArrayBuffer on Android. When served by `npx serve` or bundled
            // by Capacitor, these files live at ./public/ffmpeg/... relative to the
            // web root. The base path is resolved against the current document so
            // it works both on a dev server and inside the Capacitor WebView.
            const base = this._resolveBase();
            const ffmpegMod = await import(/* @vite-ignore */ `${base}api/index.js`);
            const { FFmpeg } = ffmpegMod;

            this.ffmpeg = new FFmpeg();
            await this.ffmpeg.load({
                // ffmpeg.wasm 0.12 uses the option name `classWorkerURL`. It does
                // `new Worker(new URL(classWorkerURL, import.meta.url), {type:'module'})`,
                // so import.meta.url (the api/ folder) becomes the base and the
                // worker's internal `import "./const.js"` resolves correctly.
                // MUST be a real same-origin URL (NOT a toBlobURL blob: URL) — a blob
                // URL has no base directory so the relative import 404s and the worker
                // never spawns, hanging the export after audio render.
                classWorkerURL: `${base}api/worker.js`,
                coreURL: `${base}core/ffmpeg-core.js`,
                wasmURL: `${base}core/ffmpeg-core.wasm`,
            });
            this._loaded = true;
        } else {
            // Reused instance across exports (e.g. batch mode) — clear any
            // leftover files from a previous run so frame numbering can't collide.
            await this._cleanupFiles();
        }
    }

    // Writes one JPEG frame into ffmpeg.wasm's virtual filesystem, numbered
    // sequentially exactly like the old server did on disk.
    async sendFrame(blob) {
        this.frameCount++;
        const name = `frame_${String(this.frameCount).padStart(5, '0')}.jpg`;
        const data = new Uint8Array(await blob.arrayBuffer());
        await this.ffmpeg.writeFile(name, data);
    }

    // Writes the offline-mixed WAV audio track into the virtual filesystem.
    async sendAudio(blob) {
        const data = new Uint8Array(await blob.arrayBuffer());
        await this.ffmpeg.writeFile('audio.wav', data);
        this.hasAudio = true;
    }

    // Compiles the written frames (+ optional audio) into an MP4, using the
    // exact same ffmpeg flags server.js used (framerate, even-dimension scale
    // filter, explicit -t duration, last-frame padding for boundary timing).
    // Returns a Blob the caller can turn into a download link.
    async compile(onProgress) {
        if (this.frameCount === 0) throw new Error('No frames were captured.');

        // Pad by duplicating the last frame by one — mirrors server.js's fix
        // that guarantees FFmpeg has a frame at the exact boundary timestamp.
        const lastName = `frame_${String(this.frameCount).padStart(5, '0')}.jpg`;
        const padName = `frame_${String(this.frameCount + 1).padStart(5, '0')}.jpg`;
        try {
            const lastData = await this.ffmpeg.readFile(lastName);
            await this.ffmpeg.writeFile(padName, lastData);
        } catch (e) {
            console.warn('Frame padding skipped:', e);
        }

        const progressHandler = ({ progress }) => {
            if (onProgress) onProgress(Math.max(0, Math.min(99, Math.round(progress * 100))));
        };
        this.ffmpeg.on('progress', progressHandler);

        const duration = (this.frameCount / 30 + 0.05).toFixed(3);
        const args = ['-framerate', '30', '-i', 'frame_%05d.jpg'];
        if (this.hasAudio) args.push('-i', 'audio.wav');
        args.push(
            '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            // 'ultrafast' trades some file size for a lot of speed — chosen
            // over the desktop's 'medium' preset because mobile/lower-end CPUs
            // running everything in WASM (no hardware encoder access) need the
            // speed far more than they need the smaller file.
            '-preset', 'ultrafast',
            '-crf', '26'
        );
        if (this.hasAudio) args.push('-c:a', 'aac', '-b:a', '192k');
        args.push('-t', duration, 'output.mp4');

        await this.ffmpeg.exec(args);
        this.ffmpeg.off('progress', progressHandler);

        const data = await this.ffmpeg.readFile('output.mp4');
        return new Blob([data.buffer], { type: 'video/mp4' });
    }

    // Frees the virtual filesystem so the next export (or a batch export's
    // next item) starts clean — otherwise WASM linear memory just keeps growing.
    async _cleanupFiles() {
        try {
            const files = await this.ffmpeg.listDir('/');
            for (const f of files) {
                if (f.isDir) continue;
                if (/^frame_\d+\.jpg$/.test(f.name) || f.name === 'audio.wav' || f.name === 'output.mp4') {
                    try { await this.ffmpeg.deleteFile(f.name); } catch (e) { /* ignore */ }
                }
            }
        } catch (e) {
            console.warn('Cleanup skipped:', e);
        }
    }

    async cleanup() {
        if (this.ffmpeg) await this._cleanupFiles();
    }
};
