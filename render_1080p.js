const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const FFMPEG_PATH = path.resolve(__dirname, 'node_modules/ffmpeg-static/ffmpeg.exe');
const BANNER_PNG = 'C:/Users/starlink/.gemini/antigravity/brain/ca179edc-971c-4f2a-898e-e5ad95a2a268/banner_cropped.png';
const LOGO_GIF = path.resolve(__dirname, 'assets/branding/logo.gif');
const OUTPUT_MP4 = 'C:/Users/starlink/Downloads/Sabre part 2 (1080p Full HD).mp4';

const projectJsonPath = 'H:/shakib/studio-flow-project-settings-sabre part 2.json';
const data = JSON.parse(fs.readFileSync(projectJsonPath, 'utf8'));

const clipSourceMap = {
    'sabre 2.mp4': 'C:/Users/starlink/Downloads/sabre 2.mp4',
    'Sabre 2 a.mp4': 'C:/Users/starlink/Downloads/Sabre 2 a.mp4',
    'sabre 3.mp4': 'C:/Users/starlink/Downloads/sabre 3.mp4'
};

const clips = data.clips;
console.log(`Loaded ${clips.length} clips from project settings.`);

const args = [];

clips.forEach((c) => {
    const src = clipSourceMap[c.name];
    if (!src || !fs.existsSync(src)) {
        throw new Error(`File not found: ${c.name} at ${src}`);
    }
    args.push('-i', src);
});

const logoIndex = clips.length;
const bannerIndex = clips.length + 1;

args.push('-ignore_loop', '0', '-i', LOGO_GIF);
args.push('-i', BANNER_PNG);

const filterLines = [];
const vConcatLabels = [];
const aConcatLabels = [];

clips.forEach((c, i) => {
    const s = Number(c.start);
    const e = Number(c.end);
    
    // Video trim & scale to 1920x1080
    filterLines.push(`[${i}:v]trim=start=${s.toFixed(3)}:end=${e.toFixed(3)},setpts=PTS-STARTPTS,scale=1920:1080,fps=30[v${i}]`);
    vConcatLabels.push(`[v${i}]`);
    
    // Audio trim
    filterLines.push(`[${i}:a]atrim=start=${s.toFixed(3)}:end=${e.toFixed(3)},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo[a${i}]`);
    aConcatLabels.push(`[a${i}]`);
});

// Concat video
filterLines.push(`${vConcatLabels.join('')}concat=n=${clips.length}:v=1:a=0[vbase]`);
// Concat audio
filterLines.push(`${aConcatLabels.join('')}concat=n=${clips.length}:v=0:a=1[abase]`);

// Scale overlays
// Tightly cropped banner is 1249x416. Scale to 1066x175 for full, bold text visibility!
filterLines.push(`[${bannerIndex}:v]scale=1066:175[vbanner]`);
filterLines.push(`[${logoIndex}:v]scale=220:204[vlogo]`);

// Overlay banner with smooth entry
filterLines.push(`[vbase][vbanner]overlay=x='if(lte(t,0.4),1920-(1920-427)*(t/0.4),427)':y=20[vover1]`);
// Overlay logo with smooth entry
filterLines.push(`[vover1][vlogo]overlay=x=1640:y='if(lte(t,0.4),-204+(204)*(t/0.4),5)':shortest=1[vfinal]`);

const filterComplex = filterLines.join(';');

args.push('-filter_complex', filterComplex);
args.push('-map', '[vfinal]');
args.push('-map', '[abase]');
args.push(
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-movflags', '+faststart',
    '-y',
    OUTPUT_MP4
);

console.log(`Starting FFmpeg render to: ${OUTPUT_MP4}`);
const proc = spawn(FFMPEG_PATH, args);

let lastTime = '';
proc.stderr.on('data', (d) => {
    const text = d.toString();
    const match = text.match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/);
    if (match && match[1] !== lastTime) {
        lastTime = match[1];
        process.stdout.write(`Rendering: ${lastTime} / 00:03:56\r`);
    }
});

proc.on('close', (code) => {
    if (code === 0) {
        console.log(`\nRender completed successfully! Output: ${OUTPUT_MP4}`);
        const stat = fs.statSync(OUTPUT_MP4);
        console.log(`File size: ${(stat.size / (1024 * 1024)).toFixed(2)} MB`);
    } else {
        console.error(`\nFFmpeg failed with code ${code}`);
        process.exit(code);
    }
});
