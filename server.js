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

    command
        .outputOptions([
            '-c:v libx264',
            '-pix_fmt yuv420p',
            '-preset medium',
            '-crf 23'
        ])
        .output(compiledPath.replace(/\\/g, '/'));

    if (hasAudio) {
        command = command.outputOptions([
            '-c:a aac',
            '-b:a 192k',
            '-shortest' // trim audio to match video duration
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

// Serve downloads folder
app.use('/exports', express.static(OUTPUT_DIR));

server.listen(PORT, () => {
    console.log(`Studio Flow Video Editor is running on http://localhost:${PORT}`);
});
