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
const wss = new WebSocket.Server({ server });

const PORT = 4000;

// Parse JSON bodies for the TTS proxy route.
app.use(express.json({ limit: '2mb' }));

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
        if (!apiKey || !text) {
            return res.status(400).json({ error: 'apiKey and text are required' });
        }

        let upstreamUrl, headers, body;

        if (provider === 'openai') {
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

        const upstream = await fetch(upstreamUrl, {
            method: 'POST',
            headers,
            body
        });

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


// Serve editor static files
app.use(express.static(__dirname));

// Ensure output and temp directories exist
const OUTPUT_DIR = path.join(__dirname, 'exports');
const TEMP_BASE_DIR = path.join(__dirname, 'temp_render');

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);
if (!fs.existsSync(TEMP_BASE_DIR)) fs.mkdirSync(TEMP_BASE_DIR);

wss.on('connection', (ws) => {
    console.log('Client connected for offline render');

    let renderId = null;
    let tempDir = null;
    let frameCount = 0;
    let totalFrames = 0;
    let expectedFilename = 'output.mp4';
    let mode = 'idle'; // idle, frames, audio

    ws.on('message', async (message, isBinary) => {
        try {
            if (!isBinary) {
                // Handle JSON control messages
                const data = JSON.parse(message.toString());
                console.log('Received control message:', data);

                if (data.type === 'init') {
                    renderId = `render_${Date.now()}`;
                    tempDir = path.join(TEMP_BASE_DIR, renderId);
                    fs.mkdirSync(tempDir);
                    
                    frameCount = 0;
                    totalFrames = data.totalFrames;
                    expectedFilename = data.filename || 'output.mp4';
                    mode = 'frames';

                    console.log(`Starting render session ${renderId}. Expecting ${totalFrames} frames.`);
                    ws.send(JSON.stringify({ type: 'init_ok', renderId }));
                } 
                else if (data.type === 'audio_start') {
                    mode = 'audio';
                    console.log('Ready to receive audio file.');
                    ws.send(JSON.stringify({ type: 'audio_ready' }));
                }
                else if (data.type === 'compile') {
                    console.log('Starting compile...');
                    mode = 'idle';
                    compileVideo(ws, tempDir, expectedFilename, totalFrames);
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
                    const audioPath = path.join(tempDir, 'audio.wav');
                    fs.writeFileSync(audioPath, message);
                    console.log('Saved mixed WAV audio file.');
                    mode = 'frames'; // Switch mode to receive video frames
                    ws.send(JSON.stringify({ type: 'audio_ok' }));
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

function compileVideo(ws, tempDir, filename, totalFrames) {
    const audioPath = path.join(tempDir, 'audio.wav');
    const finalOutputPath = path.join(OUTPUT_DIR, filename);

    // If file already exists, generate unique name
    let compiledPath = finalOutputPath;
    let baseName = path.basename(filename, path.extname(filename));
    let ext = path.extname(filename);
    let counter = 1;
    while (fs.existsSync(compiledPath)) {
        compiledPath = path.join(OUTPUT_DIR, `${baseName}_${counter}${ext}`);
        counter++;
    }

    console.log(`Compiling video at ${compiledPath}`);
    ws.send(JSON.stringify({ type: 'progress', step: 'compiling', current: 0, total: 100 }));

    // Duplicate the last frame to pad the image sequence by exactly 1 frame.
    // This ensures FFmpeg has a frame at the boundary timestamp (e.g. 215.0s),
    // allowing the output video stream to have the exact requested duration
    // instead of stopping at the last frame's presentation timestamp (214.967s).
    const lastFramePath = path.join(tempDir, `frame_${String(totalFrames).padStart(5, '0')}.jpg`);
    const extraFramePath = path.join(tempDir, `frame_${String(totalFrames + 1).padStart(5, '0')}.jpg`);
    if (fs.existsSync(lastFramePath)) {
        try {
            fs.copyFileSync(lastFramePath, extraFramePath);
            console.log(`Padded video sequence: duplicated frame ${totalFrames} to ${totalFrames + 1}`);
        } catch (e) {
            console.error('Failed to duplicate frame for padding:', e);
        }
    }

    const hasAudio = fs.existsSync(audioPath);
    const inputPattern = path.join(tempDir, 'frame_%05d.jpg').replace(/\\/g, '/');
    // JPEG image sequences do not contain a reliable frame-rate marker.  FFmpeg
    // otherwise assumes 25 FPS, which makes a 30 FPS export too long.  Apply the
    // frame rate to both sides of the pipeline explicitly.
    let command = ffmpeg()
        .input(inputPattern)
        .inputOptions(['-framerate 30'])
        .fps(30)
        // H.264 with yuv420p requires even dimensions.  Cropping to the nearest
        // even pixel prevents exports such as 1080x585 from failing at frame 0.
        .videoFilters('scale=trunc(iw/2)*2:trunc(ih/2)*2');

    if (hasAudio) {
        command = command.input(audioPath.replace(/\\/g, '/'));
    }

    // Set output duration explicitly to prevent FFmpeg from truncating the last second early
    const duration = totalFrames / 30 + 0.05;

    command
        .outputOptions([
            '-c:v libx264',
            '-pix_fmt yuv420p',
            '-preset medium',
            '-crf 23',
            `-t ${duration}`
        ])
        .output(compiledPath.replace(/\\/g, '/'));

    if (hasAudio) {
        command = command.outputOptions([
            '-c:a aac',
            '-b:a 192k'
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
            const downloadUrl = `/exports/${path.basename(compiledPath)}`;
            ws.send(JSON.stringify({ type: 'complete', downloadUrl, filename: path.basename(compiledPath) }));
            
            // Clean up temp frames and audio
            setTimeout(() => {
                cleanupDir(tempDir);
            }, 5000);
        })
        .on('error', (err, stdout, stderr) => {
            console.error('FFmpeg compile error:', err);
            console.error('FFmpeg stderr:', stderr);
            try {
                fs.writeFileSync(path.join(__dirname, 'ffmpeg_error.log'), `Error: ${err.message}\nStdout:\n${stdout}\nStderr:\n${stderr}`);
            } catch (writeErr) {
                console.error('Failed to write ffmpeg_error.log:', writeErr);
            }
            ws.send(JSON.stringify({ type: 'error', message: `FFmpeg error: ${err.message}` }));
            cleanupDir(tempDir);
        })
        .run();
}

// --- Remove Audio (Mute Video) ---
// Strips the audio track from an uploaded video entirely. This is a plain
// remux (-c:v copy -an), not a re-encode -- we never touch the video pixels,
// so it doesn't need the frame-by-frame WebSocket render pipeline the main
// exporter uses. It's just a raw file upload -> ffmpeg -> download link.
const MUTE_TEMP_DIR = path.join(__dirname, 'temp_mute');
if (!fs.existsSync(MUTE_TEMP_DIR)) fs.mkdirSync(MUTE_TEMP_DIR);

app.post('/api/remove-audio', express.raw({ type: '*/*', limit: '2gb' }), (req, res) => {
    if (!req.body || !req.body.length) {
        return res.status(400).json({ error: 'No video data received.' });
    }

    const originalName = decodeURIComponent(req.query.filename || 'video.mp4');
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

        console.log(`Removing audio: ${inputPath} -> ${outputPath}`);

        ffmpeg(inputPath)
            .outputOptions([
                '-c:v copy', // don't re-encode video -- just drop the audio stream, so this is near-instant
                '-an',       // "-an" = no audio in the output at all
                '-movflags +faststart'
            ])
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

// Serve downloads folder
app.use('/exports', express.static(OUTPUT_DIR));

server.listen(PORT, () => {
    console.log(`Studio Flow Video Editor is running on http://localhost:${PORT}`);
});
