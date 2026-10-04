const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

// Set ffmpeg path to the static binary
ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({
    server,
    maxPayload: 2048 * 1024 * 1024 // 2 GB limit (default ws limit is 100MB)
});

const PORT = 4000;

// Local, offline speech-to-text. The Whisper model is downloaded once on its
// first use and is then kept in Electron's application-data directory.
const WHISPER_TEMP_DIR = path.join(process.env.SF_DATA_DIR || __dirname, 'temp_whisper');
let whisperTranscriberPromise = null;

// Parse JSON bodies for the TTS proxy and AI Thumbnail proxy routes. The
// limit is higher than the TTS route needs on its own because the AI
// Thumbnail proxy carries a base64 PNG data URL of the current frame.
app.use(express.json({ limit: '15mb' }));

app.post('/api/log', (req, res) => {
    try {
        const logPath = path.join(process.env.SF_DATA_DIR || __dirname, 'client_debug.log');
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${req.body.message}\n`);
        res.sendStatus(200);
    } catch (e) {
        res.status(500).send(e.message);
    }
});

async function getWhisperTranscriber() {
    if (!whisperTranscriberPromise) {
        whisperTranscriberPromise = (async () => {
            const { pipeline, env } = await import('@huggingface/transformers');
            env.cacheDir = path.join(process.env.SF_DATA_DIR || __dirname, 'whisper-model-cache');
            console.log('Loading local Whisper model (first use may take a few minutes)...');
            return pipeline('automatic-speech-recognition', 'Xenova/whisper-base', { dtype: 'q8' });
        })().catch((error) => {
            whisperTranscriberPromise = null;
            throw error;
        });
    }
    return whisperTranscriberPromise;
}

function convertRecordingToWhisperAudio(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .noVideo()
            .audioChannels(1)
            .audioFrequency(16000)
            .format('f32le')
            .on('end', resolve)
            .on('error', reject)
            .save(outputPath);
    });
}

app.post('/api/local-transcribe', express.raw({ type: 'audio/*', limit: '25mb' }), async (req, res) => {
    if (!req.body || !req.body.length) {
        return res.status(400).json({ error: 'No audio data received.' });
    }

    if (!fs.existsSync(WHISPER_TEMP_DIR)) fs.mkdirSync(WHISPER_TEMP_DIR, { recursive: true });
    const recordingId = `voice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const inputPath = path.join(WHISPER_TEMP_DIR, `${recordingId}.webm`);
    const audioPath = path.join(WHISPER_TEMP_DIR, `${recordingId}.f32`);
    try {
        await fs.promises.writeFile(inputPath, req.body);
        await convertRecordingToWhisperAudio(inputPath, audioPath);
        const buffer = await fs.promises.readFile(audioPath);
        const samples = new Float32Array(buffer.buffer, buffer.byteOffset, Math.floor(buffer.byteLength / 4));
        const transcriber = await getWhisperTranscriber();
        const result = await transcriber(samples, {
            language: req.query.language === 'en-US' ? 'english' : 'bengali',
            task: 'transcribe',
            sampling_rate: 16000,
            chunk_length_s: 30,
            stride_length_s: 5
        });
        res.json({ text: String(result.text || '').trim() });
    } catch (error) {
        console.error('Local Whisper transcription error:', error);
        res.status(500).json({ error: 'Voice typing failed: ' + String(error && error.message ? error.message : error) });
    } finally {
        fs.promises.unlink(inputPath).catch(() => {});
        fs.promises.unlink(audioPath).catch(() => {});
    }
});

// Helper function to split text into chunks of maximum length while keeping words intact.
function splitTextIntoChunks(text, maxLength = 180) {
    const words = text.split(/\s+/);
    const chunks = [];
    let currentChunk = '';

    for (const word of words) {
        if ((currentChunk + ' ' + word).trim().length > maxLength) {
            if (currentChunk.trim()) {
                chunks.push(currentChunk.trim());
            }
            currentChunk = word;
        } else {
            currentChunk = (currentChunk + ' ' + word).trim();
        }
    }
    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }
    return chunks;
}

// ------------------------------------------------------------
// [10-1] TTS External API — CORS-free proxy
// ------------------------------------------------------------
// The browser cannot call OpenAI/ElevenLabs directly (CORS block),
// so the request is routed through this local server endpoint
// instead. The server adds the API key header and forwards the
// call, then streams the audio back to the browser.
app.post('/api/tts-proxy', async (req, res) => {
    try {
        const { provider, apiKey, voice, text } = req.body || {};
        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }

        if (provider !== 'free-google' && !apiKey) {
            return res.status(400).json({ error: 'apiKey is required for this provider' });
        }

        let upstreamUrl, headers, body;

        if (provider === 'free-google') {
            const lang = voice || 'bn-BD';
            const chunks = splitTextIntoChunks(text, 180);
            const buffers = [];

            for (const chunk of chunks) {
                const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(lang)}&client=tw-ob&q=${encodeURIComponent(chunk)}`;
                const response = await fetch(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                });
                if (!response.ok) {
                    const detail = await response.text();
                    throw new Error(`Google Translate TTS failed: ${detail.slice(0, 100)}`);
                }
                buffers.push(Buffer.from(await response.arrayBuffer()));
            }

            const buf = Buffer.concat(buffers);
            res.setHeader('Content-Type', 'audio/mpeg');
            res.setHeader('Access-Control-Allow-Origin', '*');
            return res.send(buf);
        } else if (provider === 'openai') {
            upstreamUrl = 'https://api.openai.com/v1/audio/speech';
            headers = {
                'Authorization': 'Bearer ' + apiKey,
                'Content-Type': 'application/json'
            };
            body = JSON.stringify({
                model: 'tts-1',
                input: text,
                voice: voice || 'alloy',
                response_format: 'mp3'
            });
        } else if (provider === 'elevenlabs') {
            if (!voice) return res.status(400).json({ error: 'ElevenLabs requires a voice id' });
            upstreamUrl = 'https://api.elevenlabs.io/v1/text-to-speech/' + encodeURIComponent(voice);
            headers = {
                'xi-api-key': apiKey,
                'Content-Type': 'application/json'
            };
            body = JSON.stringify({
                text: text,
                model_id: 'eleven_multilingual_v2',
                voice_settings: { stability: 0.5, similarity_boost: 0.5 }
            });
        } else {
            return res.status(400).json({ error: 'Unknown provider' });
        }

        const fetchOptions = {
            method: body ? 'POST' : 'GET',
            headers
        };
        if (body) fetchOptions.body = body;

        const upstream = await fetch(upstreamUrl, fetchOptions);

        if (!upstream.ok) {
            const detail = await upstream.text();
            return res.status(upstream.status).json({ error: detail.slice(0, 300) });
        }

        const buf = Buffer.from(await upstream.arrayBuffer());
        res.setHeader('Content-Type', upstream.headers.get('content-type') || 'audio/mpeg');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.send(buf);
    } catch (err) {
        console.error('TTS proxy error:', err);
        res.status(500).json({ error: String(err && err.message ? err.message : err) });
    }
});



// ------------------------------------------------------------
// [10-3] AI Thumbnail Generator -- CORS-free proxy
// ------------------------------------------------------------
// Same reasoning as the [10-1] TTS proxy: the browser can't call
// Stability AI / OpenAI directly with an API key attached, so the
// current preview frame (already captured client-side as a PNG data
// URL, overlays baked in) is forwarded here, sent on to the chosen
// image API, and the resulting image is streamed back as a plain PNG.
app.post('/api/thumbnail-proxy', async (req, res) => {
    try {
        const { provider, apiKey, prompt, imageBase64 } = req.body || {};
        if (!imageBase64) return res.status(400).json({ error: 'imageBase64 (current frame) is required' });
        if (!apiKey) return res.status(400).json({ error: 'apiKey is required' });

        const base64Data = imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');

        let resultBuffer;

        if (provider === 'openai') {
            const form = new FormData();
            form.append('image', new Blob([imageBuffer], { type: 'image/png' }), 'frame.png');
            form.append('model', 'gpt-image-1');
            form.append('prompt', prompt || 'Enhance this video frame into an eye-catching YouTube thumbnail: vibrant colors, sharp contrast, cinematic look.');
            form.append('size', '1024x1024');

            const upstream = await fetch('https://api.openai.com/v1/images/edits', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + apiKey },
                body: form
            });
            if (!upstream.ok) {
                const detail = await upstream.text();
                return res.status(upstream.status).json({ error: detail.slice(0, 300) });
            }
            const data = await upstream.json();
            const b64 = data && data.data && data.data[0] && data.data[0].b64_json;
            if (!b64) return res.status(500).json({ error: 'OpenAI returned no image data' });
            resultBuffer = Buffer.from(b64, 'base64');
        } else {
            // Default / 'stability': Stability AI image-to-image (SDXL).
            const form = new FormData();
            form.append('init_image', new Blob([imageBuffer], { type: 'image/png' }), 'frame.png');
            form.append('init_image_mode', 'IMAGE_STRENGTH');
            form.append('image_strength', '0.35');
            form.append('text_prompts[0][text]', prompt || 'vibrant colors, cinematic lighting, bold contrast, eye-catching YouTube thumbnail style');
            form.append('text_prompts[0][weight]', '1');
            form.append('cfg_scale', '7');
            form.append('samples', '1');
            form.append('steps', '30');

            const upstream = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/image-to-image', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + apiKey, 'Accept': 'application/json' },
                body: form
            });
            if (!upstream.ok) {
                const detail = await upstream.text();
                return res.status(upstream.status).json({ error: detail.slice(0, 300) });
            }
            const data = await upstream.json();
            const b64 = data && data.artifacts && data.artifacts[0] && data.artifacts[0].base64;
            if (!b64) return res.status(500).json({ error: 'Stability AI returned no image data' });
            resultBuffer = Buffer.from(b64, 'base64');
        }

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.send(resultBuffer);
    } catch (err) {
        console.error('Thumbnail proxy error:', err);
        res.status(500).json({ error: String(err && err.message ? err.message : err) });
    }
});

// Serve favicon to prevent 404 in console
app.get('/favicon.ico', (req, res) => {
    const iconPath = path.join(__dirname, 'icon.png');
    if (fs.existsSync(iconPath)) {
        res.sendFile(iconPath);
    } else {
        res.status(204).end();
    }
});

// Serve editor static files
app.use(express.static(__dirname));

// Ensure output and temp directories exist
const DATA_DIR = process.env.SF_DATA_DIR || __dirname;
const OUTPUT_DIR = path.join(DATA_DIR, 'exports');
const TEMP_BASE_DIR = path.join(DATA_DIR, 'temp_render');

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);
if (!fs.existsSync(TEMP_BASE_DIR)) fs.mkdirSync(TEMP_BASE_DIR);

wss.on('connection', (ws) => {
    console.log('Client connected for offline render');

    let renderId = null;
    let tempDir = null;
    let frameCount = 0;
    let totalFrames = 0;
    let expectedFilename = 'output.mp4';
    let enhanceQuality = false;
    let mode = 'idle'; // idle, frames, audio

    ws.on('message', async (message, isBinary) => {
        try {
            try {
                const logPath = path.join(DATA_DIR, 'ws_debug.log');
                if (!isBinary) {
                    fs.appendFileSync(logPath, `[${new Date().toISOString()}] TEXT: ${message.toString()}\n`);
                } else {
                    fs.appendFileSync(logPath, `[${new Date().toISOString()}] BINARY: len=${message.length}, mode=${mode}, nextFrameIndex=${frameCount + 1}\n`);
                }
            } catch (logErr) {
                console.error('Failed to write ws_debug.log:', logErr);
            }

            if (!isBinary) {
                // Handle JSON control messages
                const data = JSON.parse(message.toString());
                console.log('Received control message:', data);

                if (data.type === 'ping') {
                    ws.send(JSON.stringify({ type: 'pong' }));
                    return;
                }

                if (data.type === 'init') {
                    renderId = `render_${Date.now()}`;
                    tempDir = path.join(TEMP_BASE_DIR, renderId);
                    fs.mkdirSync(tempDir);
                    
                    frameCount = 0;
                    totalFrames = data.totalFrames;
                    expectedFilename = data.filename || 'output.mp4';
                    enhanceQuality = !!data.enhanceQuality;
                    if (data.customThumbnailData) {
                        const imageData = data.customThumbnailData.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
                        fs.writeFileSync(path.join(tempDir, 'custom-thumbnail.jpg'), Buffer.from(imageData, 'base64'));
                    }
                    mode = 'frames';

                    console.log(`Starting render session ${renderId}. Expecting ${totalFrames} frames.`);
                    ws.send(JSON.stringify({ type: 'init_ok', renderId }));
                }                 else if (data.type === 'audio_start') {
                    mode = 'audio';
                    if (tempDir) {
                        const audioPath = path.join(tempDir, 'audio.wav');
                        if (fs.existsSync(audioPath)) {
                            try { fs.unlinkSync(audioPath); } catch (e) {}
                        }
                    }
                    console.log('Ready to receive audio file (chunked streaming enabled).');
                    ws.send(JSON.stringify({ type: 'audio_ready' }));
                }
                else if (data.type === 'audio_end') {
                    console.log('Finished receiving audio file chunks.');
                    mode = 'frames';
                    ws.send(JSON.stringify({ type: 'audio_ok' }));
                }
                else if (data.type === 'compile') {
                    console.log(`Starting compile... Received ${frameCount} frames.`);
                    mode = 'idle';
                    const diskFrames = fs.existsSync(tempDir) ? fs.readdirSync(tempDir).filter(f => f.startsWith('frame_')).length : frameCount;
                    const finalFrameCount = Math.max(diskFrames, frameCount, totalFrames || 0);
                    compileVideo(ws, tempDir, expectedFilename, finalFrameCount, enhanceQuality);
                }
            } else {
                // Handle binary payloads
                if (mode === 'frames') {
                    frameCount++;
                    const framePath = path.join(tempDir, `frame_${String(frameCount).padStart(5, '0')}.jpg`);
                    fs.writeFileSync(framePath, message);
                    
                    if (frameCount % 30 === 0 || frameCount === totalFrames) {
                        console.log(`Saved frame ${frameCount}/${totalFrames}`);
                        ws.send(JSON.stringify({ type: 'progress', step: 'frames', current: frameCount, total: totalFrames }));
                    }
                } 
                else if (mode === 'audio') {
                    if (tempDir) {
                        const audioPath = path.join(tempDir, 'audio.wav');
                        fs.appendFileSync(audioPath, message);
                    }
                }
            }
        } catch (err) {
            console.error('WS Message error:', err);
            ws.send(JSON.stringify({ type: 'error', message: err.message }));
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected.');
        // Cleanup temp files if compilation didn't complete
        if (mode !== 'idle' && tempDir && fs.existsSync(tempDir)) {
            console.log('Cleaning up incomplete render files:', tempDir);
            cleanupDir(tempDir);
        }
    });
});

function cleanupDir(dirPath) {
    if (fs.existsSync(dirPath)) {
        fs.readdirSync(dirPath).forEach((file) => {
            const curPath = path.join(dirPath, file);
            if (fs.lstatSync(curPath).isDirectory()) {
                cleanupDir(curPath);
            } else {
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(dirPath);
    }
}

function compileVideo(ws, tempDir, filename, totalFrames, enhanceQuality = false) {
    const audioPath = path.join(tempDir, 'audio.wav');
    const customThumbnailPath = path.join(tempDir, 'custom-thumbnail.jpg');
    const finalOutputPath = path.join(OUTPUT_DIR, filename);

    // Count exact number of frame files on disk to guarantee zero truncated frames
    const diskFrames = fs.existsSync(tempDir) ? fs.readdirSync(tempDir).filter(f => f.startsWith('frame_')).length : 0;
    const actualFrames = diskFrames > 0 ? diskFrames : totalFrames;

    // If file already exists, generate unique name
    let compiledPath = finalOutputPath;
    let baseName = path.basename(filename, path.extname(filename));
    let ext = path.extname(filename);
    let counter = 1;
    while (fs.existsSync(compiledPath)) {
        compiledPath = path.join(OUTPUT_DIR, `${baseName}_${counter}${ext}`);
        counter++;
    }

    console.log(`Compiling video at ${compiledPath} (totalFrames=${totalFrames}, actualFrames=${actualFrames})`);
    ws.send(JSON.stringify({ type: 'progress', step: 'compiling', current: 0, total: 100 }));

    // Duplicate the last frame to pad the image sequence by exactly 1 frame.
    const lastFramePath = path.join(tempDir, `frame_${String(actualFrames).padStart(5, '0')}.jpg`);
    const extraFramePath = path.join(tempDir, `frame_${String(actualFrames + 1).padStart(5, '0')}.jpg`);
    if (fs.existsSync(lastFramePath)) {
        try {
            fs.copyFileSync(lastFramePath, extraFramePath);
            console.log(`Padded video sequence: duplicated frame ${actualFrames} to ${actualFrames + 1}`);
        } catch (e) {
            console.error('Failed to duplicate frame for padding:', e);
        }
    }

    const hasAudio = fs.existsSync(audioPath);
    const inputPattern = path.join(tempDir, 'frame_%05d.jpg').replace(/\\/g, '/');
    const videoFilterChain = enhanceQuality
        ? 'hqdn3d=1.5:1.5:4:4,scale=1920:-2:flags=lanczos,unsharp=5:5:0.8:5:5:0.4,scale=trunc(iw/16)*16:trunc(ih/16)*16,setsar=1'
        : 'scale=trunc(iw/16)*16:trunc(ih/16)*16,setsar=1';

    let command = ffmpeg()
        .input(inputPattern)
        .inputOptions(['-framerate 30'])
        .fps(30)
        .videoFilters(videoFilterChain);

    if (hasAudio) {
        command = command.input(audioPath.replace(/\\/g, '/'));
    }

    // Set output duration explicitly from actual frames so outro is never cut
    const duration = actualFrames / 30 + 0.05;

    const encodeOptions = enhanceQuality
        ? ['-c:v libx264', '-pix_fmt yuv420p', '-preset fast', '-crf 16']
        : ['-c:v libx264', '-pix_fmt yuv420p', '-preset fast', '-crf 23'];

    command
        .outputOptions([
            ...encodeOptions,
            '-g 60',
            '-keyint_min 30',
            '-sc_threshold 0',
            '-movflags +faststart',
            `-t ${duration}`
        ])
        .output(compiledPath.replace(/\\/g, '/'));

    if (hasAudio) {
        command = command.outputOptions([
            '-c:a aac',
            '-b:a 192k',
            '-ar 44100'
        ]);
    }

    command
        .on('progress', (progress) => {
            // progress.frames tells us how many frames have been processed
            const percent = Math.min(99, Math.round((progress.frames / totalFrames) * 100)) || 0;
            ws.send(JSON.stringify({ type: 'progress', step: 'compiling', current: percent, total: 100 }));
        })
        .on('end', () => {
            console.log('Compilation complete!');
            const finish = () => {
                const downloadUrl = `/exports/${path.basename(compiledPath)}`;
                ws.send(JSON.stringify({ type: 'complete', downloadUrl, filename: path.basename(compiledPath) }));
                setTimeout(() => cleanupDir(tempDir), 5000);
            };
            finish();
        })
        .on('error', (err, stdout, stderr) => {
            console.error('FFmpeg compile error:', err);
            console.error('FFmpeg stderr:', stderr);
            try {
                const files = fs.existsSync(tempDir) ? fs.readdirSync(tempDir) : [];
                fs.writeFileSync(
                    path.join(DATA_DIR, 'ffmpeg_error.log'),
                    `Error: ${err.message}\n` +
                    `TempDir exists: ${fs.existsSync(tempDir)}\n` +
                    `TempDir path: ${tempDir}\n` +
                    `TempDir files count: ${files.length}\n` +
                    `Files snippet: ${files.slice(0, 50).join(', ')}\n` +
                    `Stdout:\n${stdout}\nStderr:\n${stderr}`
                );
            } catch (writeErr) {
                console.error('Failed to write ffmpeg_error.log:', writeErr);
            }
            ws.send(JSON.stringify({ type: 'error', message: `FFmpeg error: ${err.message}` }));
            cleanupDir(tempDir);
        })
        .run();
}

// ─────────────────────────────────────────────────────────────────────────────
// CHUNKED UPLOAD INFRASTRUCTURE
// Large files (1 GB+) can't be sent as a single HTTP body without freezing the
// browser and PC RAM. Instead the client slices the File into ~20 MB chunks,
// uploads them one at a time, and only then triggers the FFmpeg operation.
// Flow:
//   1. POST /api/chunk-upload/init          creates session + empty temp file
//   2. POST /api/chunk-upload/:id/chunk     appends one raw chunk to the file
//   3. GET  /api/chunk-upload/:id/status    returns { received, total, done }
//   4. POST /api/chunk-upload/:id/finalize  marks upload done, returns filePath
//   5. POST /api/chunk-upload/:id/cleanup   deletes temp file after processing
// ─────────────────────────────────────────────────────────────────────────────
const CHUNK_TEMP_DIR = path.join(DATA_DIR, 'temp_chunks');
if (!fs.existsSync(CHUNK_TEMP_DIR)) fs.mkdirSync(CHUNK_TEMP_DIR, { recursive: true });
const chunkSessions = new Map(); // sessionId -> { filePath, totalChunks, receivedChunks, done, createdAt }

// Auto-cleanup stale chunk sessions every hour
setInterval(() => {
    const cutoff = Date.now() - 4 * 60 * 60 * 1000; // 4 hours
    for (const [id, s] of chunkSessions) {
        if (s.createdAt < cutoff) {
            try { if (fs.existsSync(s.filePath)) fs.unlinkSync(s.filePath); } catch (e) {}
            chunkSessions.delete(id);
        }
    }
}, 60 * 60 * 1000).unref?.();

app.post('/api/chunk-upload/init', express.json({ limit: '1mb' }), (req, res) => {
    try {
        const { filename, totalChunks } = req.body || {};
        if (!filename || !totalChunks || totalChunks < 1 || totalChunks > 5000) {
            return res.status(400).json({ error: 'filename and totalChunks required.' });
        }
        const sessionId = `chunk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const ext = path.extname(String(filename || 'video.mp4').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_')).toLowerCase() || '.mp4';
        const filePath = path.join(CHUNK_TEMP_DIR, `${sessionId}${ext}`);
        fs.writeFileSync(filePath, Buffer.alloc(0)); // create empty file
        chunkSessions.set(sessionId, {
            filePath,
            originalName: String(filename).replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,150),
            totalChunks: Number(totalChunks),
            receivedChunks: 0,
            done: false,
            createdAt: Date.now()
        });
        res.json({ sessionId });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/chunk-upload/:id/chunk', express.raw({ type: '*/*', limit: '50mb' }), (req, res) => {
    const session = chunkSessions.get(req.params.id);
    if (!session || session.done) return res.status(400).json({ error: 'Invalid or finalised session.' });
    if (!req.body || !req.body.length) return res.status(400).json({ error: 'Empty chunk.' });
    try {
        fs.appendFileSync(session.filePath, req.body);
        session.receivedChunks++;
        res.json({ ok: true, received: session.receivedChunks, total: session.totalChunks });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/chunk-upload/:id/status', (req, res) => {
    const session = chunkSessions.get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found.' });
    res.json({ received: session.receivedChunks, total: session.totalChunks, done: session.done });
});

app.post('/api/chunk-upload/:id/finalize', (req, res) => {
    const session = chunkSessions.get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found.' });
    if (session.receivedChunks < session.totalChunks) {
        return res.status(400).json({ error: `Only ${session.receivedChunks}/${session.totalChunks} chunks received.` });
    }
    session.done = true;
    res.json({ ok: true, filePath: session.filePath, filename: session.originalName });
});

app.post('/api/chunk-upload/:id/cleanup', (req, res) => {
    const session = chunkSessions.get(req.params.id);
    if (session) {
        try { if (fs.existsSync(session.filePath)) fs.unlinkSync(session.filePath); } catch (e) {}
        chunkSessions.delete(req.params.id);
    }
    res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────────

// Chunked-session-based remove-audio (called by /api/remove-audio-from-session)
// The video was already uploaded via chunk-upload; we just need the session ID.
app.post('/api/remove-audio-from-session', express.json({ limit: '1mb' }), (req, res) => {
    const { sessionId, mode = 'full', start = 0, end = 0 } = req.body || {};
    const session = chunkSessions.get(sessionId);
    if (!session || !session.done) return res.status(400).json({ error: 'Chunk session not ready.' });
    if (!fs.existsSync(session.filePath)) return res.status(400).json({ error: 'Uploaded file not found.' });

    const inputPath = session.filePath;
    const ext = path.extname(inputPath) || '.mp4';
    const baseName = path.basename(session.originalName, path.extname(session.originalName)) || 'video';
    let outputPath = path.join(OUTPUT_DIR, `${baseName}_no_audio${ext}`);
    let counter = 1;
    while (fs.existsSync(outputPath)) {
        outputPath = path.join(OUTPUT_DIR, `${baseName}_no_audio_${counter}${ext}`);
        counter++;
    }

    const startSec = parseFloat(start) || 0;
    const endSec = parseFloat(end) || 0;
    const outputOptions = ['-c:v copy', '-movflags +faststart'];
    if (mode === 'range' && endSec > startSec) {
        outputOptions.push('-af', `volume=0:enable='between(t,${startSec.toFixed(3)},${endSec.toFixed(3)})'`);
        outputOptions.push('-c:a', 'aac');
    } else {
        outputOptions.push('-an');
    }

    ffmpeg(inputPath)
        .outputOptions(outputOptions)
        .output(outputPath)
        .on('end', () => {
            res.json({ downloadUrl: `/exports/${path.basename(outputPath)}`, filename: path.basename(outputPath) });
            // cleanup chunk session file
            try { fs.unlinkSync(inputPath); } catch (e) {}
            chunkSessions.delete(sessionId);
        })
        .on('error', (err) => {
            if (!res.headersSent) res.status(500).json({ error: `FFmpeg error: ${err.message}` });
            try { fs.unlinkSync(inputPath); } catch (e) {}
            chunkSessions.delete(sessionId);
        })
        .run();
});

// --- Remove Audio (Mute Video) ---
// Strips the audio track from an uploaded video entirely. This is a plain
// remux (-c:v copy -an), not a re-encode -- we never touch the video pixels,
// so it doesn't need the frame-by-frame WebSocket render pipeline the main
// exporter uses. It's just a raw file upload -> ffmpeg -> download link.
const MUTE_TEMP_DIR = path.join(DATA_DIR, 'temp_mute');
if (!fs.existsSync(MUTE_TEMP_DIR)) fs.mkdirSync(MUTE_TEMP_DIR);

app.post('/api/remove-audio', express.raw({ type: '*/*', limit: '2gb' }), (req, res) => {
    if (!req.body || !req.body.length) {
        return res.status(400).json({ error: 'No video data received.' });
    }
    const originalName = decodeURIComponent(req.query.filename || 'video.mp4');
    const mode = req.query.mode || 'full';
    const startSec = parseFloat(req.query.start) || 0;
    const endSec = parseFloat(req.query.end) || 0;

    const ext = path.extname(originalName) || '.mp4';
    const baseName = path.basename(originalName, ext) || 'video';
    const inputPath = path.join(MUTE_TEMP_DIR, `mute_in_${Date.now()}${ext}`);

    fs.writeFile(inputPath, req.body, (writeErr) => {
        if (writeErr) {
            console.error('Failed to save uploaded video for audio removal:', writeErr);
            return res.status(500).json({ error: writeErr.message });
        }

        // Same "find a free filename" pattern as compileVideo().
        let outputPath = path.join(OUTPUT_DIR, `${baseName}_no_audio${ext}`);
        let counter = 1;
        while (fs.existsSync(outputPath)) {
            outputPath = path.join(OUTPUT_DIR, `${baseName}_no_audio_${counter}${ext}`);
            counter++;
        }

        console.log(`Removing audio (mode: ${mode}): ${inputPath} -> ${outputPath}`);

        const outputOptions = [
            '-c:v copy', // don't re-encode video -- fast copy
            '-movflags +faststart'
        ];

        if (mode === 'range' && endSec > startSec) {
            outputOptions.push(`-af`, `volume=0:enable='between(t,${startSec.toFixed(3)},${endSec.toFixed(3)})'`);
            outputOptions.push('-c:a', 'aac');
        } else {
            outputOptions.push('-an'); // "-an" = no audio at all
        }

        ffmpeg(inputPath)
            .outputOptions(outputOptions)
            .output(outputPath)
            .on('end', () => {
                console.log('Audio removed successfully:', outputPath);
                res.json({ downloadUrl: `/exports/${path.basename(outputPath)}`, filename: path.basename(outputPath) });
                fs.unlink(inputPath, () => {});
            })
            .on('error', (err, stdout, stderr) => {
                console.error('Remove-audio ffmpeg error:', err.message);
                console.error('FFmpeg stderr:', stderr);
                res.status(500).json({ error: `FFmpeg error: ${err.message}` });
                fs.unlink(inputPath, () => {});
            })
            .run();
    });
});

// --- Add Audio to Video ---
// Takes a video file and a separate audio file and produces a new video
// with the audio either replacing the original track entirely, or mixed
// together with it. Like Remove Audio, this needs ffmpeg (the browser can't
// remux/mix audio into an existing video container), but this tool needs
// TWO files instead of one, so it's a 3-step session flow instead of a
// single raw upload:
//   1. POST /api/add-audio/init            -> creates a temp session dir
//   2. POST /api/add-audio/upload-video    -> raw video bytes, saved to session dir
//   3. POST /api/add-audio/upload-audio    -> raw audio bytes, saved to session dir
//   4. POST /api/add-audio/compile         -> runs ffmpeg, returns download link
// Kept as raw uploads (no multer) to match the rest of this file's style.
const ADDAUDIO_TEMP_DIR = path.join(DATA_DIR, 'temp_addaudio');
if (!fs.existsSync(ADDAUDIO_TEMP_DIR)) fs.mkdirSync(ADDAUDIO_TEMP_DIR);

// Fast joining for already-rendered chunks. Files are streamed to disk and
// FFmpeg uses stream copy, so no frames are decoded or re-encoded.
const FASTJOIN_TEMP_DIR = path.join(DATA_DIR, 'temp_fastjoin');
if (!fs.existsSync(FASTJOIN_TEMP_DIR)) fs.mkdirSync(FASTJOIN_TEMP_DIR, { recursive: true });
const fastJoinSessions = new Map();
function safeJoinName(name) {
    const safe = path.basename(String(name || 'video.mp4')).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 150);
    return !safe || safe === '.' || safe === '..' ? 'video.mp4' : safe;
}
function fastJoinSession(req, res) {
    const session = fastJoinSessions.get(req.params.sessionId);
    if (!session) res.status(404).json({ error: 'Joining session expired. Please select the files again.' });
    return session;
}
app.post('/api/fast-join/init', (req, res) => {
    try {
        const names = req.body && req.body.files;
        if (!Array.isArray(names) || names.length < 2 || names.length > 50) return res.status(400).json({ error: 'Select between 2 and 50 video files.' });
        const sessionId = `fastjoin_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const tempDir = path.join(FASTJOIN_TEMP_DIR, sessionId);
        fs.mkdirSync(tempDir);
        const session = { tempDir, files: names.map(safeJoinName), uploaded: new Set(), status: 'uploading', percent: 0 };
        session.expiryTimer = setTimeout(() => {
            if (fastJoinSessions.get(sessionId) === session && session.status !== 'joining') {
                cleanupDir(tempDir);
                fastJoinSessions.delete(sessionId);
            }
        }, 6 * 60 * 60 * 1000);
        if (session.expiryTimer.unref) session.expiryTimer.unref();
        fastJoinSessions.set(sessionId, session);
        res.json({ sessionId });
    } catch (error) { res.status(500).json({ error: error.message }); }
});
app.post('/api/fast-join/:sessionId/upload/:index', (req, res) => {
    const session = fastJoinSession(req, res);
    if (!session) return;
    const index = Number(req.params.index);
    if (!Number.isInteger(index) || index < 0 || index >= session.files.length || session.status !== 'uploading') return res.status(400).json({ error: 'Invalid upload request.' });
    const ext = path.extname(session.files[index]).toLowerCase();
    if (!['.mp4', '.m4v', '.mov', '.webm', '.mkv'].includes(ext)) return res.status(400).json({ error: 'Unsupported video file type.' });
    const out = fs.createWriteStream(path.join(session.tempDir, `part_${String(index).padStart(3, '0')}${ext}`));
    req.on('error', (error) => out.destroy(error));
    out.on('error', (error) => { if (!res.headersSent) res.status(500).json({ error: error.message }); });
    out.on('finish', () => { session.uploaded.add(index); res.json({ ok: true }); });
    req.pipe(out);
});
app.post('/api/fast-join/:sessionId/compile', (req, res) => {
    const session = fastJoinSession(req, res);
    if (!session) return;
    if (session.uploaded.size !== session.files.length || session.status !== 'uploading') return res.status(400).json({ error: 'Upload all selected videos first.' });
    const ext = path.extname(session.files[0]).toLowerCase();
    if (session.files.some((name) => path.extname(name).toLowerCase() !== ext)) return res.status(400).json({ error: 'All clips must use the same container format (for example, all MP4).' });
    session.outputName = safeJoinName((req.body && req.body.outputName) || `joined-video${ext}`);
    if (path.extname(session.outputName).toLowerCase() !== ext) session.outputName = `${path.basename(session.outputName, path.extname(session.outputName))}${ext}`;
    session.outputPath = path.join(session.tempDir, session.outputName);
    session.status = 'joining';
    const listPath = path.join(session.tempDir, 'concat.txt');
    const list = session.files.map((name, i) => {
        const inputPath = path.join(session.tempDir, `part_${String(i).padStart(3, '0')}${ext}`);
        return `file '${inputPath.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`;
    }).join('\n');
    fs.writeFileSync(listPath, list, 'utf8');
    ffmpeg()
        .input(listPath).inputOptions(['-f concat', '-safe 0'])
        .outputOptions(['-c copy', ...(ext === '.mp4' || ext === '.m4v' || ext === '.mov' ? ['-movflags +faststart'] : [])])
        .output(session.outputPath)
        .on('progress', (progress) => { session.percent = Math.max(0, Math.min(99, Math.round(progress.percent || 0))); })
        .on('end', () => { session.percent = 100; session.status = 'done'; })
        .on('error', (error, stdout, stderr) => {
            session.status = 'error';
            session.error = /codec|parameter|stream/i.test(stderr || '') ? 'এই ক্লিপগুলোর encoding/stream এক নয়, তাই দ্রুত জোড়া লাগানো যায়নি। একই export settings-এ আবার export করুন।' : error.message;
            clearTimeout(session.expiryTimer);
            setTimeout(() => { cleanupDir(session.tempDir); fastJoinSessions.delete(req.params.sessionId); }, 10 * 60 * 1000).unref?.();
        })
        // fluent-ffmpeg only starts after run(). Without this the session stays
        // in "joining" forever and the UI remains at 50%.
        .run();
    res.json({ ok: true });
});
app.get('/api/fast-join/:sessionId/status', (req, res) => {
    const session = fastJoinSession(req, res);
    if (!session) return;
    res.json({ status: session.status, percent: session.percent, error: session.error || null, downloadUrl: session.status === 'done' ? `/api/fast-join/${encodeURIComponent(req.params.sessionId)}/download` : null, filename: session.outputName || null });
});
app.get('/api/fast-join/:sessionId/download', (req, res) => {
    const session = fastJoinSession(req, res);
    if (!session) return;
    if (session.status !== 'done' || !fs.existsSync(session.outputPath)) return res.status(409).send('Joined video is not ready.');
    res.download(session.outputPath, session.outputName, () => setTimeout(() => {
        cleanupDir(session.tempDir);
        fastJoinSessions.delete(req.params.sessionId);
    }, 30000));
});

// In-memory session registry: sessionId -> { tempDir, videoPath, audioPath, videoOriginalName }
const addAudioSessions = new Map();

function addAudioSessionOrError(req, res) {
    const sessionId = req.query.session;
    const session = sessionId && addAudioSessions.get(sessionId);
    if (!session) {
        res.status(400).json({ error: 'Invalid or expired session. Please start over.' });
        return null;
    }
    return session;
}

app.post('/api/add-audio/init', (req, res) => {
    try {
        const sessionId = `addaudio_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const tempDir = path.join(ADDAUDIO_TEMP_DIR, sessionId);
        fs.mkdirSync(tempDir);
        addAudioSessions.set(sessionId, { tempDir, videoPath: null, audioPath: null, videoOriginalName: 'video.mp4', createdAt: Date.now() });
        res.json({ sessionId });
    } catch (err) {
        console.error('add-audio init error:', err);
        res.status(500).json({ error: String(err && err.message ? err.message : err) });
    }
});

app.post('/api/add-audio/upload-video', express.raw({ type: '*/*', limit: '2gb' }), (req, res) => {
    const session = addAudioSessionOrError(req, res);
    if (!session) return;
    if (!req.body || !req.body.length) {
        return res.status(400).json({ error: 'No video data received.' });
    }
    const originalName = decodeURIComponent(req.query.filename || 'video.mp4');
    const ext = path.extname(originalName) || '.mp4';
    const videoPath = path.join(session.tempDir, `video${ext}`);
    fs.writeFile(videoPath, req.body, (writeErr) => {
        if (writeErr) {
            console.error('Failed to save uploaded video:', writeErr);
            return res.status(500).json({ error: writeErr.message });
        }
        session.videoPath = videoPath;
        session.videoOriginalName = originalName;
        res.json({ ok: true });
    });
});

app.post('/api/add-audio/upload-audio', express.raw({ type: '*/*', limit: '2gb' }), (req, res) => {
    const session = addAudioSessionOrError(req, res);
    if (!session) return;
    if (!req.body || !req.body.length) {
        return res.status(400).json({ error: 'No audio data received.' });
    }
    const originalName = decodeURIComponent(req.query.filename || 'audio.mp3');
    const ext = path.extname(originalName) || '.mp3';
    const audioPath = path.join(session.tempDir, `audio${ext}`);
    fs.writeFile(audioPath, req.body, (writeErr) => {
        if (writeErr) {
            console.error('Failed to save uploaded audio:', writeErr);
            return res.status(500).json({ error: writeErr.message });
        }
        session.audioPath = audioPath;
        res.json({ ok: true });
    });
});

app.post('/api/add-audio/compile', (req, res) => {
    const sessionId = req.query.session;
    const session = sessionId && addAudioSessions.get(sessionId);
    if (!session || !session.videoPath || !session.audioPath) {
        return res.status(400).json({ error: 'Upload both a video and an audio file before compiling.' });
    }

    const { mode = 'replace', videoVolume = 1, audioVolume = 1, offsetSec = 0, shortest = true } = req.body || {};
    const offsetMs = Math.max(0, Math.round((parseFloat(offsetSec) || 0) * 1000));
    const vVol = Math.max(0, parseFloat(videoVolume));
    const aVol = Math.max(0, parseFloat(audioVolume));

    const originalName = req.body.filename || session.videoOriginalName || 'video.mp4';
    const ext = path.extname(originalName) || '.mp4';
    const baseName = path.basename(originalName, ext) || 'video';

    let outputPath = path.join(OUTPUT_DIR, `${baseName}_with_audio${ext}`);
    let counter = 1;
    while (fs.existsSync(outputPath)) {
        outputPath = path.join(OUTPUT_DIR, `${baseName}_with_audio_${counter}${ext}`);
        counter++;
    }

    let filterStr, mapArgs;
    if (mode === 'mix') {
        // Mix the new audio with the video's existing audio track. Each side
        // gets its own volume filter before amix combines them; duration
        // follows the video's original audio length when "shortest" is on
        // (matching the video, same as -shortest below) or the longer of the
        // two tracks otherwise.
        filterStr = `[0:a]volume=${vVol}[va];[1:a]adelay=${offsetMs}:all=1,volume=${aVol}[na];[va][na]amix=inputs=2:duration=${shortest ? 'first' : 'longest'}:dropout_transition=2[aout]`;
        mapArgs = ['-map', '0:v:0', '-map', '[aout]'];
    } else {
        // Replace mode: drop the video's own audio, use only the new track
        // (still respecting the start offset and volume).
        filterStr = `[1:a]adelay=${offsetMs}:all=1,volume=${aVol}[aout]`;
        mapArgs = ['-map', '0:v:0', '-map', '[aout]'];
    }

    console.log(`Adding audio (${mode}): ${session.videoPath} + ${session.audioPath} -> ${outputPath}`);

    const outputOptions = [
        '-filter_complex', filterStr,
        ...mapArgs,
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-movflags', '+faststart'
    ];
    if (shortest) outputOptions.push('-shortest');

    ffmpeg()
        .input(session.videoPath)
        .input(session.audioPath)
        .outputOptions(outputOptions)
        .output(outputPath)
        .on('end', () => {
            console.log('Add-audio compile complete:', outputPath);
            res.json({ downloadUrl: `/exports/${path.basename(outputPath)}`, filename: path.basename(outputPath) });
            setTimeout(() => cleanupDir(session.tempDir), 5000);
            addAudioSessions.delete(sessionId);
        })
        .on('error', (err, stdout, stderr) => {
            console.error('Add-audio ffmpeg error:', err.message);
            console.error('FFmpeg stderr:', stderr);
            let message = `FFmpeg error: ${err.message}`;
            if (mode === 'mix' && /Stream map .*0:a.* matches no streams|does not contain any stream/i.test(stderr || '')) {
                message = 'মূল ভিডিওতে কোনো অডিও ট্র্যাক নেই, তাই Mix করা যায়নি। "Replace Original Audio" মোড ব্যবহার করুন।';
            }
            res.status(500).json({ error: message });
            cleanupDir(session.tempDir);
            addAudioSessions.delete(sessionId);
        })
        .run();
});

// --- Fast Direct Timeline Render ---
// Renders the timeline directly with native FFmpeg in 1-2 minutes without
// canvas frame-by-frame seeking. Guarantees 0% jitter on VFR screen recordings.
const DIRECT_RENDER_TEMP_DIR = path.join(DATA_DIR, 'temp_direct_render');
if (!fs.existsSync(DIRECT_RENDER_TEMP_DIR)) fs.mkdirSync(DIRECT_RENDER_TEMP_DIR, { recursive: true });
const directRenderSessions = new Map();

function parseTimemarkToSeconds(tm) {
    if (!tm || typeof tm !== 'string') return 0;
    const parts = tm.split(':');
    if (parts.length === 3) {
        return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
    }
    return 0;
}

app.post('/api/fast-direct-render', express.json({ limit: '500mb' }), async (req, res) => {
    try {
        const { clips, audioBase64, filename: reqFilename, totalDuration } = req.body || {};
        if (!Array.isArray(clips) || clips.length === 0) {
            return res.status(400).json({ error: 'No clips provided for direct render.' });
        }

        const renderId = `direct_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const tempDir = path.join(DIRECT_RENDER_TEMP_DIR, renderId);
        fs.mkdirSync(tempDir, { recursive: true });

        const session = {
            status: 'rendering',
            percent: 0,
            tempDir,
            downloadUrl: null,
            filename: null,
            error: null
        };
        directRenderSessions.set(renderId, session);

        // Auto-cleanup session memory after 2 hours
        setTimeout(() => {
            if (directRenderSessions.has(renderId)) {
                cleanupDir(tempDir);
                directRenderSessions.delete(renderId);
            }
        }, 2 * 60 * 60 * 1000);

        // Return renderId immediately so client can poll
        res.json({ ok: true, renderId });

        // Asynchronous FFmpeg processing
        (async () => {
            try {
                let audioPath = null;
                if (audioBase64) {
                    audioPath = path.join(tempDir, 'audio.wav');
                    const cleanB64 = audioBase64.replace(/^data:audio\/[a-zA-Z0-9+]+;base64,/, '');
                    fs.writeFileSync(audioPath, Buffer.from(cleanB64, 'base64'));
                }

                // Verify clips exist on disk or save base64
                const inputPaths = [];
                for (let i = 0; i < clips.length; i++) {
                    const c = clips[i];
                    if (c.filePath && fs.existsSync(c.filePath)) {
                        inputPaths.push(c.filePath);
                    } else if (c.base64) {
                        const ext = path.extname(c.name || 'clip.mp4') || '.mp4';
                        const p = path.join(tempDir, `clip_${i}${ext}`);
                        const cleanB64 = c.base64.replace(/^data:video\/[a-zA-Z0-9+]+;base64,/, '');
                        fs.writeFileSync(p, Buffer.from(cleanB64, 'base64'));
                        inputPaths.push(p);
                    } else {
                        throw new Error(`সোর্স ভিডিও ফাইল খুঁজে পাওয়া যায়নি: ${c.name || 'ক্লিপ ' + (i + 1)}`);
                    }
                }

                const filterParts = [];
                const videoLabels = [];
                inputPaths.forEach((inp, i) => {
                    const clip = clips[i];
                    const s = Math.max(0, parseFloat(clip.start) || 0);
                    const e = Math.max(s + 0.1, parseFloat(clip.end) || 99999);
                    filterParts.push(`[${i}:v]trim=start=${s.toFixed(3)}:end=${e.toFixed(3)},setpts=PTS-STARTPTS,fps=30,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black,setsar=1[v${i}]`);
                    videoLabels.push(`[v${i}]`);
                });
                filterParts.push(`${videoLabels.join('')}concat=n=${inputPaths.length}:v=1:a=0[vout]`);

                if (audioPath && fs.existsSync(audioPath)) {
                    const audioIdx = inputPaths.length;
                    filterParts.push(`[${audioIdx}:a]pan=stereo|c0=0.5*c0+0.5*c1|c1=0.5*c0+0.5*c1,highpass=f=80,afftdn=nf=-25,aformat=sample_rates=44100:channel_layouts=stereo[aout]`);
                }

                let outFilename = safeJoinName(reqFilename || `direct-render-${Date.now()}.mp4`);
                if (!outFilename.toLowerCase().endsWith('.mp4')) outFilename += '.mp4';
                let compiledPath = path.join(OUTPUT_DIR, outFilename);
                let counter = 1;
                const baseName = path.basename(outFilename, '.mp4');
                while (fs.existsSync(compiledPath)) {
                    compiledPath = path.join(OUTPUT_DIR, `${baseName}_${counter}.mp4`);
                    counter++;
                }

                const cmd = ffmpeg();
                inputPaths.forEach(p => cmd.input(p));
                if (audioPath && fs.existsSync(audioPath)) {
                    cmd.input(audioPath);
                }

                const estDuration = parseFloat(totalDuration) || 400;

                cmd
                    .complexFilter(filterParts)
                    .outputOptions([
                        '-map', '[vout]',
                        ...(audioPath && fs.existsSync(audioPath) ? ['-map', '[aout]', '-c:a', 'aac', '-b:a', '192k', '-ar', '44100'] : ['-an']),
                        '-c:v', 'libx264',
                        '-preset', 'fast',
                        '-crf', '18',
                        '-pix_fmt', 'yuv420p',
                        '-movflags', '+faststart'
                    ])
                    .output(compiledPath)
                    .on('progress', (prog) => {
                        const sec = prog.timemark ? parseTimemarkToSeconds(prog.timemark) : 0;
                        const pct = Math.min(99, Math.max(1, Math.round((sec / estDuration) * 100)));
                        session.percent = pct;
                    })
                    .on('end', () => {
                        session.status = 'done';
                        session.percent = 100;
                        session.downloadUrl = `/exports/${path.basename(compiledPath)}`;
                        session.filename = path.basename(compiledPath);
                        setTimeout(() => cleanupDir(tempDir), 5000);
                    })
                    .on('error', (err, stdout, stderr) => {
                        console.error('Direct render FFmpeg error:', err.message);
                        session.status = 'error';
                        session.error = err.message;
                        cleanupDir(tempDir);
                    })
                    .run();

            } catch (renderErr) {
                console.error('Direct render initialization error:', renderErr);
                session.status = 'error';
                session.error = renderErr.message;
                cleanupDir(tempDir);
            }
        })();

    } catch (err) {
        console.error('fast-direct-render route error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/fast-direct-render/status/:renderId', (req, res) => {
    const session = directRenderSessions.get(req.params.renderId);
    if (!session) {
        return res.status(404).json({ error: 'Render session not found or expired.' });
    }
    res.json({
        status: session.status,
        percent: session.percent,
        downloadUrl: session.downloadUrl,
        filename: session.filename,
        error: session.error
    });
});

// Serve downloads folder
app.use('/exports', express.static(OUTPUT_DIR));

server.listen(PORT, () => {
    console.log(`Studio Flow Video Editor is running on http://localhost:${PORT}`);
});

module.exports = { app, server, PORT };
