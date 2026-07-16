// Audio Processing Engine

// Jungle Pitch Shifter Implementation (Copyright 2012, Google Inc.)
function createFadeBuffer(context, activeTime, fadeTime) {
    const length1 = activeTime * context.sampleRate;
    const length2 = (activeTime - 2 * fadeTime) * context.sampleRate;
    const length = length1 + length2;
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const p = buffer.getChannelData(0);
    const fadeLength = fadeTime * context.sampleRate;
    const fadeIndex1 = fadeLength;
    const fadeIndex2 = length1 - fadeLength;
    
    for (let i = 0; i < length1; ++i) {
        let value;
        if (i < fadeIndex1) {
            value = Math.sqrt(i / fadeLength);
        } else if (i >= fadeIndex2) {
            value = Math.sqrt(1 - (i - fadeIndex2) / fadeLength);
        } else {
            value = 1;
        }
        p[i] = value;
    }
    for (let i = length1; i < length; ++i) {
        p[i] = 0;
    }
    return buffer;
}

function createDelayTimeBuffer(context, activeTime, fadeTime, shiftUp) {
    const length1 = activeTime * context.sampleRate;
    const length2 = (activeTime - 2 * fadeTime) * context.sampleRate;
    const length = length1 + length2;
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const p = buffer.getChannelData(0);

    for (let i = 0; i < length1; ++i) {
        if (shiftUp) {
            p[i] = (length1 - i) / length;
        } else {
            p[i] = i / length1;
        }
    }
    for (let i = length1; i < length; ++i) {
        p[i] = 0;
    }
    return buffer;
}

class Jungle {
    constructor(context) {
        this.context = context;
        this.input = context.createGain();
        this.output = context.createGain();
        
        this.delayTimeValue = 0.100;
        this.fadeTimeValue = 0.035;
        this.bufferTimeValue = 0.085;
        
        const mod1 = context.createBufferSource();
        const mod2 = context.createBufferSource();
        const mod3 = context.createBufferSource();
        const mod4 = context.createBufferSource();
        
        this.shiftDownBuffer = createDelayTimeBuffer(context, this.bufferTimeValue, this.fadeTimeValue, false);
        this.shiftUpBuffer = createDelayTimeBuffer(context, this.bufferTimeValue, this.fadeTimeValue, true);
        
        mod1.buffer = this.shiftDownBuffer;
        mod2.buffer = this.shiftDownBuffer;
        mod3.buffer = this.shiftUpBuffer;
        mod4.buffer = this.shiftUpBuffer;
        
        mod1.loop = true;
        mod2.loop = true;
        mod3.loop = true;
        mod4.loop = true;

        const mod1Gain = context.createGain();
        const mod2Gain = context.createGain();
        const mod3Gain = context.createGain();
        mod3Gain.gain.value = 0;
        const mod4Gain = context.createGain();
        mod4Gain.gain.value = 0;

        mod1.connect(mod1Gain);
        mod2.connect(mod2Gain);
        mod3.connect(mod3Gain);
        mod4.connect(mod4Gain);

        const modGain1 = context.createGain();
        const modGain2 = context.createGain();

        const delay1 = context.createDelay();
        const delay2 = context.createDelay();
        
        mod1Gain.connect(modGain1);
        mod2Gain.connect(modGain2);
        mod3Gain.connect(modGain1);
        mod4Gain.connect(modGain2);
        
        modGain1.connect(delay1.delayTime);
        modGain2.connect(delay2.delayTime);

        const fade1 = context.createBufferSource();
        const fade2 = context.createBufferSource();
        const fadeBuffer = createFadeBuffer(context, this.bufferTimeValue, this.fadeTimeValue);
        fade1.buffer = fadeBuffer;
        fade2.buffer = fadeBuffer;
        fade1.loop = true;
        fade2.loop = true;

        const mix1 = context.createGain();
        const mix2 = context.createGain();
        mix1.gain.value = 0;
        mix2.gain.value = 0;

        fade1.connect(mix1.gain);    
        fade2.connect(mix2.gain);
            
        this.input.connect(delay1);
        this.input.connect(delay2);    
        delay1.connect(mix1);
        delay2.connect(mix2);
        mix1.connect(this.output);
        mix2.connect(this.output);
        
        const t = context.currentTime + 0.050;
        const t2 = t + this.bufferTimeValue - this.fadeTimeValue;
        mod1.start(t);
        mod2.start(t2);
        mod3.start(t);
        mod4.start(t2);
        fade1.start(t);
        fade2.start(t2);

        this.mod1 = mod1;
        this.mod2 = mod2;
        this.mod1Gain = mod1Gain;
        this.mod2Gain = mod2Gain;
        this.mod3Gain = mod3Gain;
        this.mod4Gain = mod4Gain;
        this.modGain1 = modGain1;
        this.modGain2 = modGain2;
        this.fade1 = fade1;
        this.fade2 = fade2;
        this.mix1 = mix1;
        this.mix2 = mix2;
        this.delay1 = delay1;
        this.delay2 = delay2;
        
        this.setDelay(this.delayTimeValue);
    }
    
    setDelay(delayTime) {
        this.modGain1.gain.setTargetAtTime(0.5 * delayTime, 0, 0.010);
        this.modGain2.gain.setTargetAtTime(0.5 * delayTime, 0, 0.010);
    }
    
    setPitchOffset(mult) {
        if (mult > 0) { // pitch up
            this.mod1Gain.gain.setValueAtTime(0, this.context.currentTime);
            this.mod2Gain.gain.setValueAtTime(0, this.context.currentTime);
            this.mod3Gain.gain.setValueAtTime(1, this.context.currentTime);
            this.mod4Gain.gain.setValueAtTime(1, this.context.currentTime);
        } else { // pitch down
            this.mod1Gain.gain.setValueAtTime(1, this.context.currentTime);
            this.mod2Gain.gain.setValueAtTime(1, this.context.currentTime);
            this.mod3Gain.gain.setValueAtTime(0, this.context.currentTime);
            this.mod4Gain.gain.setValueAtTime(0, this.context.currentTime);
        }
        this.setDelay(this.delayTimeValue * Math.abs(mult));
    }
}

class VoiceChangerEffect {
    constructor(context) {
        this.context = context;
        this.input = context.createGain();
        this.output = context.createGain();
        
        // Pitch Shifter Node
        this.pitchShifter = new Jungle(context);
        
        // Equalizer/Filter Nodes
        this.highpass = context.createBiquadFilter();
        this.highpass.type = 'highpass';
        this.highpass.frequency.setValueAtTime(80, context.currentTime);
        
        this.peaking = context.createBiquadFilter();
        this.peaking.type = 'peaking';
        this.peaking.frequency.setValueAtTime(2500, context.currentTime);
        this.peaking.Q.setValueAtTime(1.0, context.currentTime);
        this.peaking.gain.setValueAtTime(0, context.currentTime);

        // Second formant band: shifting pitch alone doesn't move a voice's
        // formants (throat/mouth resonance), which is why a pitched-up male
        // voice can still sound male or robotic. This second peaking filter
        // boosts the higher formant region so female presets read as
        // brighter/female instead of just "higher pitched male".
        this.peaking2 = context.createBiquadFilter();
        this.peaking2.type = 'peaking';
        this.peaking2.frequency.setValueAtTime(2800, context.currentTime);
        this.peaking2.Q.setValueAtTime(1.1, context.currentTime);
        this.peaking2.gain.setValueAtTime(0, context.currentTime);

        this.lowpass = context.createBiquadFilter();
        this.lowpass.type = 'lowpass';
        this.lowpass.frequency.setValueAtTime(15000, context.currentTime);

        // "Desmear" filter: the Jungle pitch shifter is a granular/WSOLA
        // shifter, which always leaves a faint metallic/warble artifact at
        // grain-boundary frequencies -- the artifact gets worse the further
        // the pitch is shifted. Gently rolling off the top end AFTER the
        // shifter (not before) hides most of that grain noise without
        // making the voice sound muffled, because human speech
        // intelligibility lives mostly below ~6-7kHz. Each profile below
        // tunes this based on how far it shifts pitch.
        this.desmear = context.createBiquadFilter();
        this.desmear.type = 'lowpass';
        this.desmear.frequency.setValueAtTime(16000, context.currentTime); // effectively off by default
        this.desmear.Q.setValueAtTime(0.7, context.currentTime);

        // Robotic Modulation Oscillator and Gain
        this.robotOsc = context.createOscillator();
        this.robotOsc.type = 'sawtooth';
        this.robotOsc.frequency.setValueAtTime(55, context.currentTime);
        
        this.robotGain = context.createGain();
        this.robotGain.gain.setValueAtTime(0, context.currentTime);
        
        // Ring modulation node
        this.ringModNode = context.createGain();
        this.ringModNode.gain.setValueAtTime(1.0, context.currentTime);
        
        // Connect robot modulator: Osc -> Gain -> ringModNode.gain
        this.robotOsc.connect(this.robotGain);
        this.robotGain.connect(this.ringModNode.gain);
        this.robotOsc.start();

        // Echo delay line
        this.echoDelay = context.createDelay();
        this.echoDelay.delayTime.setValueAtTime(0.18, context.currentTime);
        
        this.echoFeedback = context.createGain();
        this.echoFeedback.gain.setValueAtTime(0.25, context.currentTime);
        
        // Connect echo feedback loop: Delay -> Feedback -> Delay
        this.echoDelay.connect(this.echoFeedback);
        this.echoFeedback.connect(this.echoDelay);
        
        this.echoGain = context.createGain();
        this.echoGain.gain.setValueAtTime(0, context.currentTime);
        
        // Connect Graph:
        // input -> highpass -> peaking -> peaking2 -> lowpass -> pitchShifter -> desmear -> ringModNode -> output
        this.input.connect(this.highpass);
        this.highpass.connect(this.peaking);
        this.peaking.connect(this.peaking2);
        this.peaking2.connect(this.lowpass);
        this.lowpass.connect(this.pitchShifter.input);
        this.pitchShifter.output.connect(this.desmear);
        this.desmear.connect(this.ringModNode);
        this.ringModNode.connect(this.output);
        
        // Connect parallel echo path: peaking -> echoDelay -> echoGain -> output
        this.peaking.connect(this.echoDelay);
        this.echoDelay.connect(this.echoGain);
        this.echoGain.connect(this.output);
        
        this.setProfile('none');
    }
    
    setProfile(profileName) {
        this.profile = profileName;
        const now = this.context.currentTime;
        
        // Reset defaults
        this.pitchShifter.setPitchOffset(0);
        this.highpass.frequency.setValueAtTime(80, now);
        this.lowpass.frequency.setValueAtTime(15000, now);
        this.desmear.frequency.setValueAtTime(16000, now);
        this.peaking.gain.setValueAtTime(0, now);
        this.peaking2.gain.setValueAtTime(0, now);
        this.robotGain.gain.setValueAtTime(0, now);
        this.echoGain.gain.setValueAtTime(0, now);
        
        switch (profileName) {
            case 'female_sweet': // Sweet female voice
                this.pitchShifter.setPitchOffset(0.34); // dialed back further to cut warble
                this.highpass.frequency.setValueAtTime(210, now); // strip more chest/male resonance
                this.peaking.frequency.setValueAtTime(2900, now);
                this.peaking.Q.setValueAtTime(0.9, now); // wider/gentler bump = less "phasey" ringing
                this.peaking.gain.setValueAtTime(4, now);
                this.peaking2.frequency.setValueAtTime(4200, now); // adds airy female "presence"
                this.peaking2.Q.setValueAtTime(0.9, now);
                this.peaking2.gain.setValueAtTime(3.5, now);
                this.desmear.frequency.setValueAtTime(8200, now); // tame grain artifact from the pitch shift
                break;
                
            case 'female_warm': // Warm female voice
                this.pitchShifter.setPitchOffset(0.24); // gentler shift, relies more on EQ for the feminine read
                this.highpass.frequency.setValueAtTime(180, now);
                this.peaking.frequency.setValueAtTime(1400, now);
                this.peaking.Q.setValueAtTime(0.9, now);
                this.peaking.gain.setValueAtTime(3, now);
                this.peaking2.frequency.setValueAtTime(3200, now); // keeps it from sounding muddy/male
                this.peaking2.Q.setValueAtTime(0.9, now);
                this.peaking2.gain.setValueAtTime(2.5, now);
                this.desmear.frequency.setValueAtTime(8800, now);
                break;

            case 'female_bright': // Confident / attractive female voice (new)
                // Smallest pitch shift of the three female presets -- most of the
                // "female" character here comes from formant EQ rather than raw
                // pitch, which is what keeps it sounding natural instead of
                // "chipmunk-y" or robotic at louder/shoutier parts of a voiceover.
                this.pitchShifter.setPitchOffset(0.20);
                this.highpass.frequency.setValueAtTime(190, now);
                this.peaking.frequency.setValueAtTime(2200, now); // clarity/"smile" band
                this.peaking.Q.setValueAtTime(0.85, now);
                this.peaking.gain.setValueAtTime(4.5, now);
                this.peaking2.frequency.setValueAtTime(3600, now); // upper formant lift for a brighter tone
                this.peaking2.Q.setValueAtTime(0.85, now);
                this.peaking2.gain.setValueAtTime(4, now);
                this.lowpass.frequency.setValueAtTime(13000, now); // trims harsh sibilance before the shifter
                this.desmear.frequency.setValueAtTime(9400, now); // least aggressive desmear since shift is smallest
                break;
                
            case 'male_deep': // Deep marketing male voice
                this.pitchShifter.setPitchOffset(-0.25);
                this.highpass.frequency.setValueAtTime(95, now);
                this.peaking.frequency.setValueAtTime(170, now);
                this.peaking.gain.setValueAtTime(5, now);
                break;
                
            case 'male_bold': // Bold presenter male voice
                this.pitchShifter.setPitchOffset(-0.15);
                this.highpass.frequency.setValueAtTime(110, now);
                this.peaking.frequency.setValueAtTime(2600, now);
                this.peaking.gain.setValueAtTime(4, now);
                break;
                
            case 'cartoon': // Chipmunk / Cartoon
                this.pitchShifter.setPitchOffset(0.75);
                this.highpass.frequency.setValueAtTime(220, now);
                break;
                
            case 'monster': // Monster
                this.pitchShifter.setPitchOffset(-0.5);
                this.highpass.frequency.setValueAtTime(65, now);
                this.peaking.frequency.setValueAtTime(110, now);
                this.peaking.gain.setValueAtTime(6, now);
                break;
                
            case 'robot': // Robotic
                this.pitchShifter.setPitchOffset(0);
                this.highpass.frequency.setValueAtTime(120, now);
                this.lowpass.frequency.setValueAtTime(8000, now);
                this.robotGain.gain.setValueAtTime(0.85, now);
                break;
                
            case 'echo_ambient': // Ambient Echo
                this.pitchShifter.setPitchOffset(0);
                this.highpass.frequency.setValueAtTime(120, now);
                this.echoGain.gain.setValueAtTime(0.35, now);
                break;
                
            case 'none':
            default:
                break;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const state = window.VideoEditor;
    
    // UI selectors
    const noiseCancelToggle = document.getElementById('noise-cancel-toggle');
    const noiseLevelContainer = document.getElementById('noise-level-container');
    const noiseGateSlider = document.getElementById('noise-gate-threshold');
    const noiseGateVal = document.getElementById('noise-gate-val');
    const aiDenoiseToggle = document.getElementById('ai-denoise-toggle');
    const aiDenoiseStatus = document.getElementById('ai-denoise-status');
    
    const micStatus = document.getElementById('mic-status');
    const recordVoiceBtn = document.getElementById('record-voice-btn');
    const stopRecordBtn = document.getElementById('stop-record-btn');
    
    const voiceoverPreviewBox = document.getElementById('voiceover-preview-box');
    const voiceoverAudioPreview = document.getElementById('voiceover-audio-preview');
    const deleteVoiceBtn = document.getElementById('delete-voice-btn');
    
    const voiceoverVolumeContainer = document.getElementById('voiceover-volume-container');
    const voiceoverVolumeSlider = document.getElementById('voiceover-volume-slider');
    const voiceoverVolumeVal = document.getElementById('voiceover-volume-val');
    const voiceChangerSelect = document.getElementById('voice-changer-select');
    const voiceChangerApplyVideoToggle = document.getElementById('voice-changer-apply-video-toggle');

    // Background Music UI selectors (multi-track timeline, v2.3)
    const bgMusicDropzone = document.getElementById('bgmusic-dropzone');
    const bgMusicInput = document.getElementById('bgmusic-input');
    const bgMusicFilename = document.getElementById('bgmusic-filename');
    const bgMusicTrackListEl = document.getElementById('bgmusic-track-list');
    const bgMusicTrackDetail = document.getElementById('bgmusic-track-detail');
    const bgMusicTrackDetailName = document.getElementById('bgmusic-track-detail-name');
    const bgMusicTrackStartInput = document.getElementById('bgmusic-track-start');
    const bgMusicTrackEndInput = document.getElementById('bgmusic-track-end');
    const bgMusicTrackLoopModeSelect = document.getElementById('bgmusic-track-loopmode');
    const bgMusicTrackVolumeSlider = document.getElementById('bgmusic-track-volume');
    const bgMusicTrackVolumeVal = document.getElementById('bgmusic-track-volume-val');
    const removeBgMusicTrackBtn = document.getElementById('remove-bgmusic-track-btn');
    const bgMusicDuckingToggle = document.getElementById('bgmusic-ducking-toggle');

    // One <audio> element per track, created on demand and never inserted into the
    // DOM (played/volume-controlled entirely by JS below — see Bug 7 in
    // PROJECT_PLAN.txt for why we stopped using a single native <audio controls>).
    const bgMusicTrackAudioEls = new Map(); // trackId -> HTMLAudioElement

    function getBgMusicTrackAudioEl(track) {
        let el = bgMusicTrackAudioEls.get(track.id);
        if (!el) {
            el = new Audio();
            el.src = track.url;
            el.preload = 'auto';
            bgMusicTrackAudioEls.set(track.id, el);
        }
        return el;
    }

    function removeBgMusicTrackAudioEl(trackId) {
        const el = bgMusicTrackAudioEls.get(trackId);
        if (el) {
            el.pause();
            el.src = '';
            bgMusicTrackAudioEls.delete(trackId);
        }
    }

    function getTotalTimelineDuration() {
        if (state.clips && state.clips.length) {
            return state.clips.reduce((sum, c) => sum + Math.max(0, c.end - c.start), 0);
        }
        return (state.video && isFinite(state.video.duration)) ? state.video.duration : Infinity;
    }

    // Returns whichever track "owns" this point on the timeline (startSec <= elapsed < endSec),
    // or null if no track covers it. endSec === null means "runs to the end of the video".
    function getActiveBgMusicTrack(elapsed) {
        return state.bgMusicTracks.find(t => {
            const end = (t.endSec == null) ? Infinity : t.endSec;
            return elapsed >= t.startSec && elapsed < end;
        }) || null;
    }

    function renderBgMusicTrackList() {
        if (!bgMusicTrackListEl) return;
        bgMusicTrackListEl.innerHTML = '';
        state.bgMusicTracks.forEach((t) => {
            const row = document.createElement('div');
            row.className = 'bgmusic-track-item' + (t.id === state.selectedBgMusicTrackId ? ' active' : '');

            const label = document.createElement('span');
            const preview = t.name.length > 22 ? t.name.slice(0, 22) + '…' : t.name;
            label.innerText = `🎵 ${preview}`;

            const timeLabel = document.createElement('span');
            timeLabel.className = 'track-time';
            const endText = (t.endSec == null) ? 'শেষ পর্যন্ত' : t.endSec.toFixed(1) + 's';
            timeLabel.innerText = `${t.startSec.toFixed(1)}s–${endText} · ${t.loopMode === 'loop' ? 'Loop' : 'Once'}`;

            row.appendChild(label);
            row.appendChild(timeLabel);
            row.addEventListener('click', () => {
                state.selectedBgMusicTrackId = t.id;
                renderBgMusicTrackList();
                showBgMusicTrackDetail(t.id);
            });
            bgMusicTrackListEl.appendChild(row);
        });
    }
    window.renderBgMusicTrackListGlobal = renderBgMusicTrackList;

    function showBgMusicTrackDetail(id) {
        const t = state.bgMusicTracks.find(x => x.id === id);
        if (!t) {
            if (bgMusicTrackDetail) bgMusicTrackDetail.style.display = 'none';
            return;
        }
        if (bgMusicTrackDetail) bgMusicTrackDetail.style.display = 'block';
        if (bgMusicTrackDetailName) bgMusicTrackDetailName.innerText = `🎵 ${t.name}`;
        if (bgMusicTrackStartInput) bgMusicTrackStartInput.value = t.startSec;
        if (bgMusicTrackEndInput) bgMusicTrackEndInput.value = (t.endSec == null) ? '' : t.endSec;
        if (bgMusicTrackLoopModeSelect) bgMusicTrackLoopModeSelect.value = t.loopMode;
        const pct = Math.round(t.volume * 100);
        if (bgMusicTrackVolumeSlider) bgMusicTrackVolumeSlider.value = pct;
        if (bgMusicTrackVolumeVal) bgMusicTrackVolumeVal.innerText = pct + '%';
    }

    function addBgMusicTrack(file) {
        const track = {
            id: 'bgm_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            blob: file,
            url: URL.createObjectURL(file),
            name: file.name,
            duration: null, // filled in once metadata loads, used for loop-modulo math
            volume: 0.4,
            startSec: 0,
            endSec: null, // null = plays until the end of the video
            loopMode: 'loop'
        };
        // Default a new track's start time to right where the previous track's window
        // ends, so adding several tracks back-to-back naturally lines them up on the
        // timeline (e.g. Track 1: 0s–300s, Track 2 defaults to starting at 300s).
        if (state.bgMusicTracks.length > 0) {
            const last = state.bgMusicTracks[state.bgMusicTracks.length - 1];
            if (last.endSec != null) track.startSec = last.endSec;
        }
        state.bgMusicTracks.push(track);
        state.selectedBgMusicTrackId = track.id;

        const probe = new Audio();
        probe.src = track.url;
        probe.addEventListener('loadedmetadata', () => {
            track.duration = probe.duration;
        });

        renderBgMusicTrackList();
        showBgMusicTrackDetail(track.id);
        if (bgMusicFilename) bgMusicFilename.innerText = `${state.bgMusicTracks.length} track(s) added — click "Add Music Track" for more`;
    }

    function removeBgMusicTrack(id) {
        const idx = state.bgMusicTracks.findIndex(t => t.id === id);
        if (idx === -1) return;
        const t = state.bgMusicTracks[idx];
        removeBgMusicTrackAudioEl(id);
        if (t.url) URL.revokeObjectURL(t.url);
        state.bgMusicTracks.splice(idx, 1);
        if (state.selectedBgMusicTrackId === id) state.selectedBgMusicTrackId = null;
        renderBgMusicTrackList();
        showBgMusicTrackDetail(null);
        if (bgMusicFilename) {
            bgMusicFilename.innerText = state.bgMusicTracks.length
                ? `${state.bgMusicTracks.length} track(s) added — click "Add Music Track" for more`
                : '+ Add Music Track';
        }
    }

    // Continuously runs (independent of the drawFrame/animation-frame loop in
    // editor.js) and decides, frame by frame, which single music track "owns" the
    // playhead right now — pausing every other track and playing/seeking the
    // active one to the right offset. This is what makes multi-track timelines
    // (e.g. Track A for the first 5 minutes, Track B after that) actually switch
    // over at the right moment during live preview.
    let lastActiveBgMusicTrackId = null;

    function bgMusicSyncTick() {
        const isPlaying = state.video && !state.video.paused && !state.video.ended;
        if (!isPlaying) {
            state.bgMusicTracks.forEach(t => {
                const el = bgMusicTrackAudioEls.get(t.id);
                if (el && !el.paused) el.pause();
            });
            lastActiveBgMusicTrackId = null;
            requestAnimationFrame(bgMusicSyncTick);
            return;
        }

        const elapsed = (state.video.currentTime || 0) - (state.startTime || 0);
        const active = getActiveBgMusicTrack(elapsed);

        state.bgMusicTracks.forEach(t => {
            if (!active || t.id !== active.id) {
                const el = bgMusicTrackAudioEls.get(t.id);
                if (el && !el.paused) el.pause();
            }
        });

        if (active) {
            const el = getBgMusicTrackAudioEl(active);
            const localElapsed = elapsed - active.startSec;
            const dur = el.duration || active.duration || 0;

            if (active.loopMode === 'once') {
                el.loop = false;
                if (dur > 0 && localElapsed >= dur) {
                    // Already played through once inside this window — stay silent
                    // for the rest of it, exactly like the "Play Once" label promises.
                    if (!el.paused) el.pause();
                } else if (el.paused || active.id !== lastActiveBgMusicTrackId) {
                    el.currentTime = Math.max(0, localElapsed);
                    el.play().catch(() => {});
                }
            } else {
                el.loop = true;
                if (dur > 0) {
                    const target = ((localElapsed % dur) + dur) % dur;
                    if (active.id !== lastActiveBgMusicTrackId || Math.abs((el.currentTime || 0) - target) > 0.75) {
                        el.currentTime = target;
                    }
                }
                if (el.paused) el.play().catch(() => {});
            }
        }

        lastActiveBgMusicTrackId = active ? active.id : null;
        requestAnimationFrame(bgMusicSyncTick);
    }
    requestAnimationFrame(bgMusicSyncTick);

    // Web Audio Variables
    // Web Audio Variables
    let audioCtx = null;
    let videoSourceNode = null;
    
    // DSP Nodes
    let videoGainNode = null;
    let videoVoiceChanger = null; // Voice Changer applied to the ORIGINAL video's own audio (separate from voiceoverVoiceChanger below)
    let highpassNode = null;
    let lowpassNode = null;
    let noiseGateGainNode = null;
    let noiseGateAnalyser = null;
    // Hysteresis state prevents the gate from rapidly fluttering open/closed
    // when a voice sits close to the selected threshold.
    let noiseGateIsOpen = true;
    let aiDenoiseNode = null;
    let aiDenoiseWorkletLoaded = false;
    let aiDenoiseLoadPromise = null;
    let compressorNode = null;
    let makeupGainNode = null; // Auto-compensates volume lost to the noise-cancel compressor
    let speakerMuteGain = null; // Isolated speaker on/off switch that never touches the export tap
    
    // Voiceover Web Audio nodes
    let voiceoverMediaSource = null;
    let voiceoverVoiceChanger = null;
    let voiceoverVolumeGain = null;
    
    // Voiceover Audio elements
    let micStream = null;
    let mediaRecorder = null;
    let recordedChunks = [];
    let isRecording = false;
    
    // Voiceover play source during normal preview playback
    let voiceoverAudioNode = null; 

    // --- Dynamic Auto-Ducking Engine ---
    // Instead of a flat "always duck while X" switch, this continuously measures
    // real speech energy (video dialogue, recorded voiceover playback, and live mic
    // input while recording) and smoothly lowers/raises the background music to match —
    // ducks the instant someone talks, eases back up the instant they go quiet.
    let videoDialogueAnalyser = null;
    let voiceoverPreviewAnalyser = null;
    let micAnalyser = null;
    let exportVoiceoverAnalyser = null; // set per-export inside getMixedAudioDestinationStream
    let exportBgMusicGains = [];         // [{gain, track}] set per-export inside getMixedAudioDestinationStream
    let duckAmount = 0; // 0 = full bg music volume, 1 = fully ducked
    const DUCK_RMS_THRESHOLD = 0.018;
    const DUCK_ATTACK = 0.35;  // how fast it ducks down when talking starts
    const DUCK_RELEASE = 0.05; // how fast it eases back up when talking stops
    const DUCK_DEPTH = 0.25;   // ducked level = bgMusicVolume * DUCK_DEPTH

    function isDuckingActive() {
        return duckAmount > 0.05;
    }

    function measureRms(analyser) {
        if (!analyser) return 0;
        const buffer = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
        return Math.sqrt(sum / buffer.length);
    }

    function duckingTick() {
        if (!state.bgMusicDuckingEnabled || state.bgMusicTracks.length === 0) {
            requestAnimationFrame(duckingTick);
            return;
        }

        const rms = Math.max(
            measureRms(videoDialogueAnalyser),
            measureRms(voiceoverPreviewAnalyser),
            measureRms(micAnalyser),
            measureRms(exportVoiceoverAnalyser)
        );
        const talking = rms > DUCK_RMS_THRESHOLD;

        duckAmount += talking ? (1 - duckAmount) * DUCK_ATTACK : (0 - duckAmount) * DUCK_RELEASE;
        if (duckAmount < 0.001) duckAmount = 0;

        // Live preview: apply to whichever track element(s) are currently audible.
        // (Each track keeps its own volume, so ducking scales each one proportionally
        // to its own level rather than one shared value.)
        state.bgMusicTracks.forEach(t => {
            const el = bgMusicTrackAudioEls.get(t.id);
            if (el && !el.paused) {
                const fullLevel = Math.min(1.0, t.volume);
                const duckedLevel = fullLevel * DUCK_DEPTH;
                el.volume = Math.min(1.0, fullLevel - (fullLevel - duckedLevel) * duckAmount);
            }
        });

        // Export mix: one Web Audio gain node per track, all ridden by the same duck amount.
        if (exportBgMusicGains.length && audioCtx) {
            exportBgMusicGains.forEach(({ gain, track }) => {
                const fullLevel = Math.min(1.0, track.volume);
                const duckedLevel = fullLevel * DUCK_DEPTH;
                const targetVolume = fullLevel - (fullLevel - duckedLevel) * duckAmount;
                gain.gain.setValueAtTime(targetVolume, audioCtx.currentTime);
            });
        }

        requestAnimationFrame(duckingTick);
    }
    requestAnimationFrame(duckingTick);
    
    // Expose Node references to window
    window.videoGainNode = null;

    function setAIDenoiseStatus(message, isError) {
        if (!aiDenoiseStatus) return;
        aiDenoiseStatus.textContent = message;
        aiDenoiseStatus.style.color = isError ? '#fca5a5' : '';
    }

    // The AI node sits between the speech filter and the existing gate. Keeping
    // the gate after RNNoise removes any residual room noise in pauses, while the
    // neural model handles noise overlapping the spoken frequency range.
    function routeAIDenoise(enabled) {
        if (!lowpassNode || !noiseGateGainNode || !noiseGateAnalyser) return;
        try { lowpassNode.disconnect(); } catch (e) {}
        try { if (aiDenoiseNode) aiDenoiseNode.disconnect(); } catch (e) {}

        if (enabled && aiDenoiseNode) {
            lowpassNode.connect(aiDenoiseNode);
            aiDenoiseNode.connect(noiseGateGainNode);
            aiDenoiseNode.connect(noiseGateAnalyser);
        } else {
            lowpassNode.connect(noiseGateGainNode);
            lowpassNode.connect(noiseGateAnalyser);
        }
    }

    async function setAIDenoiseEnabled(enabled) {
        if (!enabled) {
            state.isAiDenoiseActive = false;
            routeAIDenoise(false);
            if (aiDenoiseToggle) aiDenoiseToggle.checked = false;
            setAIDenoiseStatus('AI denoise বন্ধ। সাধারণ noise filter এখনো ব্যবহার করতে পারবেন।');
            return;
        }

        if (!audioCtx || !audioCtx.audioWorklet || !window.WebAssembly) {
            state.isAiDenoiseActive = false;
            if (aiDenoiseToggle) aiDenoiseToggle.checked = false;
            setAIDenoiseStatus('এই browser-এ AI denoise-এর জন্য প্রয়োজনীয় AudioWorklet/WebAssembly নেই।', true);
            return;
        }
        if (audioCtx.sampleRate !== 48000) {
            state.isAiDenoiseActive = false;
            if (aiDenoiseToggle) aiDenoiseToggle.checked = false;
            setAIDenoiseStatus('AI denoise বর্তমানে 48 kHz audio device-এ কাজ করে। সাধারণ noise filter চালু আছে।', true);
            return;
        }

        try {
            if (!aiDenoiseNode) {
                setAIDenoiseStatus('Local AI model প্রস্তুত হচ্ছে…');
                if (!aiDenoiseWorkletLoaded) {
                    aiDenoiseLoadPromise = aiDenoiseLoadPromise || audioCtx.audioWorklet.addModule('vendor/rnnoise/ai-denoise-worklet.js');
                    await aiDenoiseLoadPromise;
                    aiDenoiseWorkletLoaded = true;
                }
                // The user may have turned the option off while its local model
                // was loading; do not reconnect it after that explicit choice.
                if (!aiDenoiseToggle || !aiDenoiseToggle.checked) return;
                aiDenoiseNode = new AudioWorkletNode(audioCtx, 'ai-denoise-processor', {
                    channelCount: 2,
                    channelCountMode: 'explicit',
                    outputChannelCount: [2]
                });
                aiDenoiseNode.port.onmessage = (event) => {
                    if (event.data && event.data.type === 'error') {
                        console.error('AI denoise worklet error:', event.data.message);
                        state.isAiDenoiseActive = false;
                        routeAIDenoise(false);
                        if (aiDenoiseToggle) aiDenoiseToggle.checked = false;
                        setAIDenoiseStatus('AI denoise চালু করা যায়নি; সাধারণ filter ব্যবহার হচ্ছে।', true);
                    }
                };
            }
            routeAIDenoise(true);
            state.isAiDenoiseActive = true;
            if (aiDenoiseToggle) aiDenoiseToggle.checked = true;
            setAIDenoiseStatus('AI denoise চালু — audio আপনার browser-এর মধ্যেই process হচ্ছে।');
        } catch (error) {
            console.error('AI denoise setup failed:', error);
            state.isAiDenoiseActive = false;
            routeAIDenoise(false);
            if (aiDenoiseToggle) aiDenoiseToggle.checked = false;
            setAIDenoiseStatus((error && error.message) || 'AI denoise চালু করা যায়নি; সাধারণ filter ব্যবহার হচ্ছে।', true);
        }
    }
    
    // --- 1. Initialize Audio Context & DSP Chain ---
    window.initializeAudioSource = function() {
        if (audioCtx) return; // Already initialized
        
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioContext();
            
            // Create MediaElementSource from the video tag
            videoSourceNode = audioCtx.createMediaElementSource(state.video);
            
            // Create Gain Node for video volume
            videoGainNode = audioCtx.createGain();
            videoGainNode.gain.setValueAtTime(state.videoVolume, 0);
            window.videoGainNode = videoGainNode;

            // Voice Changer for the original video's own audio. Reuses the exact
            // same VoiceChangerEffect class as the voiceover, but is a SEPARATE
            // instance/profile so the video's own voice and the recorded voiceover
            // can (in theory) be changed independently. Defaults to 'none' (bypass)
            // and is only driven away from 'none' when the user checks the
            // "Also apply to original video audio" toggle.
            videoVoiceChanger = new VoiceChangerEffect(audioCtx);
            // Sync with whatever the user had already selected/toggled before the
            // video (and therefore this audio graph) finished loading.
            videoVoiceChanger.setProfile(state.applyVoiceChangerToVideo ? (state.voiceoverProfile || 'none') : 'none');
            window.videoVoiceChanger = videoVoiceChanger;

            // Create Biquad Filters for Noise Cancellation
            highpassNode = audioCtx.createBiquadFilter();
            highpassNode.type = 'highpass';
            // Default bypass: 10Hz (doesn't filter speech)
            highpassNode.frequency.setValueAtTime(10, 0);
            
            lowpassNode = audioCtx.createBiquadFilter();
            lowpassNode.type = 'lowpass';
            // Default bypass: 22000Hz (doesn't filter speech)
            lowpassNode.frequency.setValueAtTime(22000, 0);
            
            // Compressor acts as a gentle voice leveler and peak limiter. The
            // gate below is responsible for reducing silence; using a very high
            // compressor ratio here would otherwise make noise more noticeable.
            compressorNode = audioCtx.createDynamicsCompressor();
            compressorNode.threshold.setValueAtTime(-20, 0);
            compressorNode.knee.setValueAtTime(18, 0);
            compressorNode.ratio.setValueAtTime(3, 0);
            compressorNode.attack.setValueAtTime(0.008, 0);
            compressorNode.release.setValueAtTime(0.18, 0);
            
            // Makeup gain: automatically restores the loudness the compressor
            // takes away when Noise Cancellation is on. Without this, a low
            // gate threshold + high ratio crushes the entire voice signal
            // down near-silence with no way to bring the level back up.
            makeupGainNode = audioCtx.createGain();
            makeupGainNode.gain.setValueAtTime(1, 0);

            // Noise gate nodes
            noiseGateGainNode = audioCtx.createGain();
            noiseGateGainNode.gain.setValueAtTime(1, 0);
            window.noiseGateGainNode = noiseGateGainNode;

            noiseGateAnalyser = audioCtx.createAnalyser();
            noiseGateAnalyser.fftSize = 256;

            // Speaker-only mute switch. This sits AFTER makeupGainNode so it only
            // affects what comes out of the computer speakers during export/preview
            // muting. The export tap in getMixedAudioDestinationStream connects
            // directly off makeupGainNode (bypassing this node entirely), so muting
            // the speaker can never silence the recorded/exported audio again.
            speakerMuteGain = audioCtx.createGain();
            speakerMuteGain.gain.setValueAtTime(1, 0);

            // Link DSP chain: Source -> Volume -> VideoVoiceChanger -> Highpass -> Lowpass -> NoiseGate -> Compressor -> MakeupGain -> SpeakerMute -> Destination
            videoSourceNode.connect(videoGainNode);
            videoGainNode.connect(videoVoiceChanger.input);
            videoVoiceChanger.output.connect(highpassNode);
            highpassNode.connect(lowpassNode);
            lowpassNode.connect(noiseGateGainNode);
            lowpassNode.connect(noiseGateAnalyser); // Measure audio level before gating it
            noiseGateGainNode.connect(compressorNode);
            compressorNode.connect(makeupGainNode);
            makeupGainNode.connect(speakerMuteGain);
            speakerMuteGain.connect(audioCtx.destination);

            // Analyser tap for the auto-ducking engine (video's own dialogue).
            // Pure fan-out — does not touch the speaker/export routing above.
            videoDialogueAnalyser = audioCtx.createAnalyser();
            videoDialogueAnalyser.fftSize = 512;
            makeupGainNode.connect(videoDialogueAnalyser);

            // Continuously read how much the compressor is reducing the signal
            // (compressorNode.reduction, always <= 0 dB) and add that loudness
            // back via makeupGainNode. This is what keeps Noise Cancellation
            // from silencing the audio: the filters/gate still cut hiss and
            // low-level noise, but real speech gets its volume restored.
            (function pumpMakeupGain() {
                if (audioCtx) {
                    // 1. Process Noise Gate envelope follower
                    if (state.isNoiseCancelActive && noiseGateAnalyser && noiseGateGainNode) {
                        const array = new Float32Array(noiseGateAnalyser.fftSize);
                        noiseGateAnalyser.getFloatTimeDomainData(array);
                        
                        let sum = 0;
                        for (let i = 0; i < array.length; i++) {
                            sum += array[i] * array[i];
                        }
                        const rms = Math.sqrt(sum / array.length);
                        const db = rms > 0 ? 20 * Math.log10(rms) : -99;
                        
                        // Use a 5 dB hysteresis window: it only opens once speech is
                        // clearly above the threshold, but stays open until the level
                        // has genuinely fallen below it. This removes gate chatter and
                        // protects quiet syllables at the end of words.
                        const closeAt = state.noiseGateThreshold;
                        const openAt = closeAt + 5;
                        if (noiseGateIsOpen && db < closeAt) noiseGateIsOpen = false;
                        else if (!noiseGateIsOpen && db > openAt) noiseGateIsOpen = true;

                        // Keep a small residual signal rather than hard-zeroing it;
                        // -34 dB is deep enough to hide room/fan noise in pauses while
                        // avoiding audible digital-looking cuts. Smooth ramps preserve
                        // consonant onsets and word tails.
                        const targetGateGain = noiseGateIsOpen ? 1.0 : 0.02;
                        const timeConstant = noiseGateIsOpen ? 0.012 : 0.16;
                        noiseGateGainNode.gain.setTargetAtTime(targetGateGain, audioCtx.currentTime, timeConstant);
                    } else if (noiseGateGainNode) {
                        noiseGateIsOpen = true;
                        noiseGateGainNode.gain.setTargetAtTime(1.0, audioCtx.currentTime, 0.05);
                    }

                    // 2. Process Compressor Auto Makeup Gain
                    if (compressorNode && makeupGainNode) {
                        if (state.isNoiseCancelActive) {
                            const reductionDb = compressorNode.reduction || 0; // negative dB
                            // Cap compensation at +9dB so we don't also blast
                            // residual background noise back up to full volume.
                            const compensationDb = Math.min(9, -reductionDb);
                            const targetGain = Math.pow(10, compensationDb / 20);
                            makeupGainNode.gain.setTargetAtTime(targetGain, audioCtx.currentTime, 0.08);
                        } else {
                            makeupGainNode.gain.setTargetAtTime(1, audioCtx.currentTime, 0.08);
                        }
                    }
                }
                requestAnimationFrame(pumpMakeupGain);
            })();
            
            // Route recorded voiceover preview element through AudioContext
            const voiceoverAudioPreviewEl = document.getElementById('voiceover-audio-preview');
            if (voiceoverAudioPreviewEl) {
                voiceoverMediaSource = audioCtx.createMediaElementSource(voiceoverAudioPreviewEl);
                voiceoverVoiceChanger = new VoiceChangerEffect(audioCtx);
                voiceoverVolumeGain = audioCtx.createGain();
                
                voiceoverVolumeGain.gain.setValueAtTime(state.voiceoverVolume, 0);
                voiceoverVoiceChanger.setProfile(state.voiceoverProfile || 'none');
                
                // Connect preview stream: voiceoverAudioPreviewEl -> voiceoverMediaSource -> VoiceChanger -> VolumeGain -> DSP Chain (for Noise Cancellation)
                voiceoverMediaSource.connect(voiceoverVoiceChanger.input);
                voiceoverVoiceChanger.output.connect(voiceoverVolumeGain);
                voiceoverVolumeGain.connect(highpassNode);

                // Analyser tap for the auto-ducking engine (recorded voiceover during preview)
                voiceoverPreviewAnalyser = audioCtx.createAnalyser();
                voiceoverPreviewAnalyser.fftSize = 512;
                voiceoverVolumeGain.connect(voiceoverPreviewAnalyser);
                
                // Expose to window for external adjustments
                window.voiceoverVoiceChanger = voiceoverVoiceChanger;
                window.voiceoverVolumeGain = voiceoverVolumeGain;
                
                // Ensure audio context resumes when voiceover preview starts playing
                voiceoverAudioPreviewEl.addEventListener('play', () => {
                    if (audioCtx && audioCtx.state === 'suspended') {
                        audioCtx.resume();
                    }
                });
            }
            
            // Try requesting Mic access early for step 3 prep
            requestMicrophoneAccess();

            // A restored project may have its enhancement settings ready before
            // the media element creates this audio graph. Apply them now that the
            // graph exists instead of silently dropping the AI preference.
            applyNoiseCancelSettings();
            if (state.isAiDenoiseActive) setAIDenoiseEnabled(true);
        } catch (e) {
            console.error("Failed to initialize Web Audio API", e);
        }
    };

    // Mute/unmute ONLY the live speaker output, completely isolated from the
    // export/recording tap. Previously this toggled videoGainNode directly —
    // but videoGainNode sits upstream of the same path the exporter taps for
    // recording, so muting the speaker during export was silencing the
    // recorded video audio too (while separately-routed bg music/voiceover
    // stayed audible). speakerMuteGain sits AFTER the export tap point, so
    // muting it now only affects what comes out of the speakers.
    window.setSpeakerMuted = function(muted) {
        if (!speakerMuteGain || !audioCtx) return false; // caller should fall back to video.volume
        speakerMuteGain.gain.setValueAtTime(muted ? 0 : 1, audioCtx.currentTime);
        return true;
    };
    
    // Resume audio context when playing
    state.video.addEventListener('play', () => {
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    });
    
    // --- 2. DSP Settings Changes (Noise Cancel) ---
    function applyNoiseCancelSettings() {
        if (!audioCtx || !highpassNode || !lowpassNode || !compressorNode) return;
        
        if (state.isNoiseCancelActive) {
            // Speech-focused bandpass: removes low fan/handling rumble and the
            // highest hiss while preserving the body and clarity of most voices.
            highpassNode.frequency.setValueAtTime(110, audioCtx.currentTime);
            lowpassNode.frequency.setValueAtTime(8000, audioCtx.currentTime);
            
            // The dedicated gate uses the user-selected threshold. Keep the
            // compressor moderate so it levels speech instead of crushing it.
            compressorNode.threshold.setValueAtTime(-20, audioCtx.currentTime);
            compressorNode.ratio.setValueAtTime(3, audioCtx.currentTime);
            noiseGateIsOpen = true;
            
            noiseLevelContainer.style.display = 'block';
        } else {
            // Bypass filters
            highpassNode.frequency.setValueAtTime(10, audioCtx.currentTime);
            lowpassNode.frequency.setValueAtTime(22000, audioCtx.currentTime);
            
            // Reset compressor to mild settings
            compressorNode.threshold.setValueAtTime(-20, audioCtx.currentTime);
            compressorNode.ratio.setValueAtTime(3, audioCtx.currentTime);
            noiseGateIsOpen = true;
            if (state.isAiDenoiseActive) setAIDenoiseEnabled(false);
            
            noiseLevelContainer.style.display = 'none';
        }
    }

    noiseCancelToggle.addEventListener('change', (e) => {
        state.isNoiseCancelActive = e.target.checked;
        applyNoiseCancelSettings();
    });
    
    noiseGateSlider.addEventListener('input', (e) => {
        state.noiseGateThreshold = parseInt(e.target.value);
        noiseGateVal.innerText = state.noiseGateThreshold + ' dB';
        
    });

    if (aiDenoiseToggle) {
        aiDenoiseToggle.addEventListener('change', async (e) => {
            if (e.target.checked && !state.isNoiseCancelActive) {
                state.isNoiseCancelActive = true;
                if (noiseCancelToggle) noiseCancelToggle.checked = true;
                applyNoiseCancelSettings();
            }
            await setAIDenoiseEnabled(e.target.checked);
        });
    }
    
    // --- 3. Microphone Access Check ---
    async function requestMicrophoneAccess() {
        try {
            // Explicitly request the browser's own native noise-reduction DSP
            // (separate from our own highpass/lowpass/gate chain below). Chrome/
            // Edge/Firefox all implement real adaptive noise suppression + echo
            // cancellation + auto-gain at the OS/browser level for getUserMedia,
            // which does a much better job on noise that overlaps the speech
            // frequency range than a static filter ever can. Falls back to plain
            // { audio: true } if a browser rejects these as invalid constraints.
            const micConstraints = {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 1
                }
            };
            try {
                micStream = await navigator.mediaDevices.getUserMedia(micConstraints);
            } catch (constraintErr) {
                console.warn('Advanced mic constraints rejected, falling back to basic audio:true', constraintErr);
                micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            }

            // Analyser tap for the auto-ducking engine (live mic input while recording).
            // Connected for analysis only — never routed to any destination, so it can't cause feedback.
            if (audioCtx) {
                try {
                    const micSourceNode = audioCtx.createMediaStreamSource(micStream);
                    micAnalyser = audioCtx.createAnalyser();
                    micAnalyser.fftSize = 512;
                    micSourceNode.connect(micAnalyser);
                } catch (e) {
                    console.warn('Could not attach mic analyser for auto-ducking', e);
                }
            }
            
            // Update UI
            micStatus.classList.add('active');
            micStatus.innerHTML = '<i class="fa-solid fa-microphone"></i> <span>Microphone Connected</span>';
            recordVoiceBtn.disabled = false;
        } catch (err) {
            console.warn("Microphone access denied or unavailable", err);
            micStatus.classList.remove('active');
            micStatus.innerHTML = '<i class="fa-solid fa-microphone-slash"></i> <span>Microphone blocked or not found</span>';
            recordVoiceBtn.disabled = true;
        }
    }
    
    // --- 4. Voiceover Recording Loop ---
    recordVoiceBtn.addEventListener('click', () => {
        if (!micStream) return;
        
        recordedChunks = [];
        mediaRecorder = new MediaRecorder(micStream);
        
        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                recordedChunks.push(e.data);
            }
        };
        
        mediaRecorder.onstop = () => {
            state.voiceoverBlob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
            state.voiceoverUrl = URL.createObjectURL(state.voiceoverBlob);
            
            // Show preview player
            voiceoverAudioPreview.src = state.voiceoverUrl;
            voiceoverPreviewBox.style.display = 'block';
            voiceoverVolumeContainer.style.display = 'block';
            state.voiceoverRecorded = true;
            
            // Stop UI animation
            micStatus.classList.remove('recording');
            micStatus.classList.add('active');
            micStatus.innerHTML = '<i class="fa-solid fa-microphone"></i> <span>Microphone Connected</span>';
            
            recordVoiceBtn.style.display = 'inline-flex';
            stopRecordBtn.style.display = 'none';
        };
        
        // Start playing the video from the start trim position
        state.video.currentTime = state.startTime;
        state.video.play();
        state.isPlaying = true;
        document.getElementById('play-pause-btn').innerHTML = '<i class="fa-solid fa-pause"></i>';
        
        // Start recording
        mediaRecorder.start();
        isRecording = true;
        window.isRecordingVoiceover = true;
        
        // Update UI
        micStatus.classList.add('recording');
        micStatus.innerHTML = '<i class="fa-solid fa-record-vinyl"></i> <span>Recording Voiceover...</span>';
        recordVoiceBtn.style.display = 'none';
        stopRecordBtn.style.display = 'inline-flex';
    });
    
    stopRecordBtn.addEventListener('click', () => {
        if (!isRecording) return;
        
        mediaRecorder.stop();
        state.video.pause();
        state.isPlaying = false;
        document.getElementById('play-pause-btn').innerHTML = '<i class="fa-solid fa-play"></i>';
        
        isRecording = false;
        window.isRecordingVoiceover = false;
    });
    
    deleteVoiceBtn.addEventListener('click', () => {
        state.voiceoverBlob = null;
        state.voiceoverUrl = null;
        state.voiceoverRecorded = false;
        voiceoverAudioPreview.src = '';
        voiceoverPreviewBox.style.display = 'none';
        voiceoverVolumeContainer.style.display = 'none';
    });
    
    // Voiceover volume controls
    voiceoverVolumeSlider.addEventListener('input', (e) => {
        state.voiceoverVolume = parseInt(e.target.value) / 100;
        voiceoverVolumeVal.innerText = e.target.value + '%';
        
        // Update preview player element volume
        voiceoverAudioPreview.volume = Math.min(1.0, state.voiceoverVolume);
        
        // Also update the Web Audio Gain Node to stay in sync
        if (window.voiceoverVolumeGain && audioCtx) {
            window.voiceoverVolumeGain.gain.setValueAtTime(state.voiceoverVolume, audioCtx.currentTime);
        }
    });

    // Voice Changer Select Controls
    if (voiceChangerSelect) {
        voiceChangerSelect.value = state.voiceoverProfile || 'none';
        voiceChangerSelect.addEventListener('change', (e) => {
            state.voiceoverProfile = e.target.value;
            if (window.voiceoverVoiceChanger) {
                window.voiceoverVoiceChanger.setProfile(state.voiceoverProfile);
            }
            // Keep the original video's own voice changer in sync, but only if
            // the user has opted into applying it there too.
            if (window.videoVoiceChanger && state.applyVoiceChangerToVideo) {
                window.videoVoiceChanger.setProfile(state.voiceoverProfile);
            }
        });
    }

    // "Also apply to original video audio" toggle
    if (voiceChangerApplyVideoToggle) {
        voiceChangerApplyVideoToggle.checked = !!state.applyVoiceChangerToVideo;
        voiceChangerApplyVideoToggle.addEventListener('change', (e) => {
            state.applyVoiceChangerToVideo = e.target.checked;
            if (window.videoVoiceChanger) {
                // When ON, mirror whatever profile is currently selected.
                // When OFF, force back to 'none' so the video's own audio is untouched.
                window.videoVoiceChanger.setProfile(state.applyVoiceChangerToVideo ? (state.voiceoverProfile || 'none') : 'none');
            }
        });
    }

    // --- 4B. Background Music: multi-track timeline (v2.3) ---
    bgMusicDropzone.addEventListener('click', () => bgMusicInput.click());

    bgMusicInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) addBgMusicTrack(file);
        bgMusicInput.value = '';
    });

    // Allow drag & drop onto the dropzone too, consistent with video/logo dropzones
    bgMusicDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        bgMusicDropzone.classList.add('drag-over');
    });
    bgMusicDropzone.addEventListener('dragleave', () => {
        bgMusicDropzone.classList.remove('drag-over');
    });
    bgMusicDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        bgMusicDropzone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('audio/')) {
            addBgMusicTrack(file);
        }
    });

    if (bgMusicTrackStartInput) {
        bgMusicTrackStartInput.addEventListener('input', (e) => {
            const t = state.bgMusicTracks.find(x => x.id === state.selectedBgMusicTrackId);
            if (t) {
                t.startSec = Math.max(0, parseFloat(e.target.value) || 0);
                renderBgMusicTrackList();
            }
        });
    }

    if (bgMusicTrackEndInput) {
        bgMusicTrackEndInput.addEventListener('input', (e) => {
            const t = state.bgMusicTracks.find(x => x.id === state.selectedBgMusicTrackId);
            if (t) {
                const v = e.target.value.trim();
                t.endSec = (v === '') ? null : Math.max(t.startSec + 0.1, parseFloat(v) || (t.startSec + 1));
                renderBgMusicTrackList();
            }
        });
    }

    if (bgMusicTrackLoopModeSelect) {
        bgMusicTrackLoopModeSelect.addEventListener('change', (e) => {
            const t = state.bgMusicTracks.find(x => x.id === state.selectedBgMusicTrackId);
            if (t) {
                t.loopMode = e.target.value;
                renderBgMusicTrackList();
            }
        });
    }

    if (bgMusicTrackVolumeSlider) {
        bgMusicTrackVolumeSlider.addEventListener('input', (e) => {
            const t = state.bgMusicTracks.find(x => x.id === state.selectedBgMusicTrackId);
            if (t) {
                t.volume = parseInt(e.target.value) / 100;
                bgMusicTrackVolumeVal.innerText = e.target.value + '%';
            }
        });
    }

    if (removeBgMusicTrackBtn) {
        removeBgMusicTrackBtn.addEventListener('click', () => {
            if (state.selectedBgMusicTrackId) removeBgMusicTrack(state.selectedBgMusicTrackId);
        });
    }

    bgMusicDuckingToggle.addEventListener('change', (e) => {
        state.bgMusicDuckingEnabled = e.target.checked;
    });

    // --- 5. Sync Voiceover during preview playback ---
    // (Background music playback/looping/switching-between-tracks is handled entirely
    // by the always-on bgMusicSyncTick() loop above — it doesn't need onPlaybackStart/
    // onPlaybackStop hooks because it already checks state.video.paused every frame.)
    window.onPlaybackStart = function() {
        if (state.voiceoverRecorded && state.voiceoverUrl) {
            // Seek and play voiceover preview synced to current playback time relative to trim start
            const currentVideoOffset = state.video.currentTime - state.startTime;
            
            if (currentVideoOffset >= 0) {
                voiceoverAudioPreview.currentTime = currentVideoOffset;
                voiceoverAudioPreview.volume = Math.min(1.0, state.voiceoverVolume);
                
                // Play audio element
                voiceoverAudioPreview.play().catch(err => {
                    console.log("Auto-play blocked for voiceover", err);
                });
            }
        }
    };
    
    window.onPlaybackStop = function() {
        if (state.voiceoverRecorded) {
            voiceoverAudioPreview.pause();
        }
    };
    
    // Track video seeking and align voiceover
    state.video.addEventListener('seeking', () => {
        if (state.voiceoverRecorded) {
            const currentVideoOffset = state.video.currentTime - state.startTime;
            if (currentVideoOffset >= 0 && currentVideoOffset < voiceoverAudioPreview.duration) {
                voiceoverAudioPreview.currentTime = currentVideoOffset;
            } else {
                voiceoverAudioPreview.currentTime = 0;
            }
        }
        // Background music re-syncs itself on the very next bgMusicSyncTick frame
        // (it re-checks elapsed time continuously), so no seek handling needed here.
    });
    
    // --- 6. Export Mixing Node function ---
    // This exposes a mixed AudioNode stream of BOTH the video sound & voiceover & bg music for recorder output
    window.getMixedAudioDestinationStream = function() {
        if (!audioCtx) return null;
        
        // Resume context if suspended (browser autoplay policy)
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        
        // Create destination node for MediaRecorder to capture
        const dest = audioCtx.createMediaStreamDestination();
        
        // Add a parallel tap off makeupGainNode straight into the export
        // destination. This does NOT touch makeupGainNode's existing
        // connection to speakerMuteGain/speakers — Web Audio nodes can fan
        // out to multiple destinations at once — so muting the speaker
        // during export can never affect what gets recorded here.
        makeupGainNode.connect(dest);
        
        // Pre-create gain node for voiceover mixing
        let voiceoverSource = null;
        let voiceoverGain = null;
        
        if (state.voiceoverRecorded && state.voiceoverBlob) {
            voiceoverGain = audioCtx.createGain();
            voiceoverGain.gain.setValueAtTime(Math.min(1.0, state.voiceoverVolume), audioCtx.currentTime);
            voiceoverGain.connect(highpassNode); // Connect voiceover gain to DSP Chain so it receives noise cancellation

            // Analyser tap for the auto-ducking engine — lets export dynamically
            // duck the bg music exactly when the voiceover is actually speaking.
            exportVoiceoverAnalyser = audioCtx.createAnalyser();
            exportVoiceoverAnalyser.fftSize = 512;
            voiceoverGain.connect(exportVoiceoverAnalyser);
        }

        // Pre-create one gain node per background music track (v2.3 multi-track timeline)
        const bgMusicSources = []; // AudioBufferSourceNode[]
        const bgMusicGainNodes = []; // {gain, track}[]

        state.bgMusicTracks.forEach(track => {
            const gain = audioCtx.createGain();
            gain.gain.setValueAtTime(Math.min(1.0, track.volume), audioCtx.currentTime);
            gain.connect(dest);
            bgMusicGainNodes.push({ gain, track });
        });
        // Hand these off to the duckingTick loop so it dynamically rides each track's
        // gain up/down in real time as the export renders, instead of a flat duck.
        exportBgMusicGains = bgMusicGainNodes;
        
        return {
            stream: dest.stream,
            // Restore speaker connection after export finishes
            cleanup: function() {
                try { makeupGainNode.disconnect(dest); } catch(e) {}
                
                if (voiceoverSource) {
                    try { voiceoverSource.stop(); } catch(e) {}
                    try { voiceoverSource.disconnect(); } catch(e) {}
                }
                if (voiceoverGain) {
                    try { voiceoverGain.disconnect(); } catch(e) {}
                }
                bgMusicSources.forEach(src => {
                    try { src.stop(); } catch(e) {}
                    try { src.disconnect(); } catch(e) {}
                });
                bgMusicGainNodes.forEach(({ gain }) => {
                    try { gain.disconnect(); } catch(e) {}
                });
                exportVoiceoverAnalyser = null;
                exportBgMusicGains = [];
            },
            // Called immediately AFTER video.play() resolves to keep audio in sync
            startVoiceover: async function() {
                if (state.voiceoverRecorded && state.voiceoverBlob && voiceoverGain) {
                    try {
                        const arrayBuffer = await state.voiceoverBlob.arrayBuffer();
                        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
                        
                        voiceoverSource = audioCtx.createBufferSource();
                        voiceoverSource.buffer = audioBuffer;
                        
                        if (state.voiceoverProfile && state.voiceoverProfile !== 'none') {
                            const exportVoiceChanger = new VoiceChangerEffect(audioCtx);
                            exportVoiceChanger.setProfile(state.voiceoverProfile);
                            voiceoverSource.connect(exportVoiceChanger.input);
                            exportVoiceChanger.output.connect(voiceoverGain);
                        } else {
                            voiceoverSource.connect(voiceoverGain);
                        }
                        
                        // Start immediately, synchronized with video playback
                        voiceoverSource.start(audioCtx.currentTime);
                    } catch(e) {
                        console.error('Voiceover export mix error:', e);
                    }
                }
            },
            // Called immediately AFTER video.play() resolves to keep music in sync.
            // Schedules every track to start/stop at its own startSec/endSec on the
            // timeline (relative to right now = the moment the export starts playing),
            // looping within its window if loopMode is 'loop', or playing through once
            // and then staying silent for the rest of the window if 'once'.
            startBgMusic: async function() {
                const totalDuration = getTotalTimelineDuration();
                for (const { gain, track } of bgMusicGainNodes) {
                    if (!track.blob) continue;
                    try {
                        const arrayBuffer = await track.blob.arrayBuffer();
                        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

                        const source = audioCtx.createBufferSource();
                        source.buffer = audioBuffer;
                        source.loop = (track.loopMode === 'loop');
                        source.connect(gain);

                        const windowStart = track.startSec;
                        const windowEnd = (track.endSec == null || !isFinite(track.endSec))
                            ? (isFinite(totalDuration) ? totalDuration : windowStart + audioBuffer.duration)
                            : track.endSec;

                        const now = audioCtx.currentTime;
                        source.start(now + Math.max(0, windowStart));
                        // Cuts the track off exactly at the end of its window, whether it's
                        // looping (would otherwise run forever) or playing once (harmless
                        // no-op if it already finished naturally before this point).
                        try { source.stop(now + Math.max(windowStart + 0.05, windowEnd)); } catch(e) {}

                        bgMusicSources.push(source);
                    } catch(e) {
                        console.error('Background music export mix error for track "' + track.name + '":', e);
                    }
                }
            }
        };
    };

    // --- 7. B-roll Entry/Exit Sound Effects (Phase 5D+) ---
    // Synthesized entirely via Web Audio (no external sound files needed) so a
    // "whoosh" / "pop" / "click" can play exactly when a B-roll item enters or
    // exits. Routed through makeupGainNode — the same bus both the live speakers
    // AND the export recording tap (getMixedAudioDestinationStream) read from —
    // so the sound is audible in preview AND correctly baked into the exported
    // video's audio track, without any extra export-time wiring.
    window.playBrollSfx = function(type) {
        if (!type || type === 'none') return;
        if (!audioCtx || !makeupGainNode) return; // audio not initialized yet (no video loaded)
        if (audioCtx.state === 'suspended') audioCtx.resume();

        const now = audioCtx.currentTime;
        const sfxGain = audioCtx.createGain();
        sfxGain.gain.setValueAtTime(0.0001, now);
        sfxGain.connect(makeupGainNode);

        function makeNoiseBuffer(durSec) {
            const bufferSize = Math.max(1, Math.floor(audioCtx.sampleRate * durSec));
            const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
            return buffer;
        }

        if (type === 'whoosh') {
            const dur = 0.32;
            const noise = audioCtx.createBufferSource();
            noise.buffer = makeNoiseBuffer(dur);
            const bandpass = audioCtx.createBiquadFilter();
            bandpass.type = 'bandpass';
            bandpass.Q.setValueAtTime(1.1, now);
            bandpass.frequency.setValueAtTime(350, now);
            bandpass.frequency.exponentialRampToValueAtTime(2200, now + dur * 0.55);
            bandpass.frequency.exponentialRampToValueAtTime(280, now + dur);
            noise.connect(bandpass);
            bandpass.connect(sfxGain);
            sfxGain.gain.linearRampToValueAtTime(0.45, now + dur * 0.15);
            sfxGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
            noise.start(now);
            noise.stop(now + dur);
        } else if (type === 'pop') {
            const dur = 0.16;
            const osc = audioCtx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(760, now);
            osc.frequency.exponentialRampToValueAtTime(180, now + dur);
            osc.connect(sfxGain);
            sfxGain.gain.linearRampToValueAtTime(0.55, now + 0.012);
            sfxGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
            osc.start(now);
            osc.stop(now + dur);
        } else if (type === 'click') {
            const dur = 0.06;
            const noise = audioCtx.createBufferSource();
            noise.buffer = makeNoiseBuffer(dur);
            const hp = audioCtx.createBiquadFilter();
            hp.type = 'highpass';
            hp.frequency.setValueAtTime(1600, now);
            noise.connect(hp);
            hp.connect(sfxGain);
            sfxGain.gain.linearRampToValueAtTime(0.45, now + 0.004);
            sfxGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
            noise.start(now);
            noise.stop(now + dur);
        } else if (type === 'thud') {
            // Soft low-pitched impact — pairs well with Bounce In/Drop entrances.
            const dur = 0.22;
            const osc = audioCtx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(45, now + dur);
            const noise = audioCtx.createBufferSource();
            noise.buffer = makeNoiseBuffer(0.04);
            const lp = audioCtx.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.setValueAtTime(500, now);
            noise.connect(lp);
            lp.connect(sfxGain);
            osc.connect(sfxGain);
            sfxGain.gain.linearRampToValueAtTime(0.5, now + 0.01);
            sfxGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
            osc.start(now);
            osc.stop(now + dur);
            noise.start(now);
            noise.stop(now + 0.04);
        } else if (type === 'chime') {
            // Bright two-note sparkle — pairs well with Blur Focus / Spin entrances.
            const dur = 0.5;
            [880, 1320].forEach((freq, i) => {
                const osc = audioCtx.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + i * 0.06);
                const noteGain = audioCtx.createGain();
                noteGain.gain.setValueAtTime(0.0001, now + i * 0.06);
                noteGain.gain.linearRampToValueAtTime(0.28, now + i * 0.06 + 0.02);
                noteGain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.06 + dur);
                osc.connect(noteGain);
                noteGain.connect(sfxGain);
                osc.start(now + i * 0.06);
                osc.stop(now + i * 0.06 + dur);
            });
            sfxGain.gain.setValueAtTime(1, now);
        } else if (type === 'swipe') {
            // Fast filtered-noise sweep, brighter/quicker than "whoosh" -- good
            // for text/B-roll that slides in from the side rather than pops in.
            const dur = 0.22;
            const noise = audioCtx.createBufferSource();
            noise.buffer = makeNoiseBuffer(dur);
            const bandpass = audioCtx.createBiquadFilter();
            bandpass.type = 'bandpass';
            bandpass.Q.setValueAtTime(0.9, now);
            bandpass.frequency.setValueAtTime(1200, now);
            bandpass.frequency.exponentialRampToValueAtTime(4500, now + dur * 0.7);
            noise.connect(bandpass);
            bandpass.connect(sfxGain);
            sfxGain.gain.linearRampToValueAtTime(0.35, now + dur * 0.1);
            sfxGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
            noise.start(now);
            noise.stop(now + dur);
        } else if (type === 'camera') {
            // Two-part shutter click: a sharp high click followed a beat later
            // by a softer low "mirror slap" thud, like a DSLR shutter.
            const clickDur = 0.045;
            const clickNoise = audioCtx.createBufferSource();
            clickNoise.buffer = makeNoiseBuffer(clickDur);
            const clickHp = audioCtx.createBiquadFilter();
            clickHp.type = 'highpass';
            clickHp.frequency.setValueAtTime(3000, now);
            clickNoise.connect(clickHp);
            clickHp.connect(sfxGain);

            const slapDelay = 0.045;
            const slapDur = 0.05;
            const slapNoise = audioCtx.createBufferSource();
            slapNoise.buffer = makeNoiseBuffer(slapDur);
            const slapLp = audioCtx.createBiquadFilter();
            slapLp.type = 'lowpass';
            slapLp.frequency.setValueAtTime(900, now);
            const slapGain = audioCtx.createGain();
            slapGain.gain.setValueAtTime(0.0001, now + slapDelay);
            slapGain.gain.linearRampToValueAtTime(0.4, now + slapDelay + 0.006);
            slapGain.gain.exponentialRampToValueAtTime(0.0001, now + slapDelay + slapDur);
            slapNoise.connect(slapLp);
            slapLp.connect(slapGain);
            slapGain.connect(makeupGainNode);

            sfxGain.gain.linearRampToValueAtTime(0.5, now + 0.004);
            sfxGain.gain.exponentialRampToValueAtTime(0.0001, now + clickDur);
            clickNoise.start(now);
            clickNoise.stop(now + clickDur);
            slapNoise.start(now + slapDelay);
            slapNoise.stop(now + slapDelay + slapDur);
        } else if (type === 'rise') {
            // Rising pitch riser -- good as an "entrance" cue that builds
            // anticipation right before a B-roll/stat appears on screen.
            const dur = 0.55;
            const osc = audioCtx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(140, now);
            osc.frequency.exponentialRampToValueAtTime(1100, now + dur);
            const lp = audioCtx.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.setValueAtTime(600, now);
            lp.frequency.exponentialRampToValueAtTime(6000, now + dur);
            osc.connect(lp);
            lp.connect(sfxGain);
            sfxGain.gain.setValueAtTime(0.0001, now);
            sfxGain.gain.exponentialRampToValueAtTime(0.32, now + dur * 0.85);
            sfxGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
            osc.start(now);
            osc.stop(now + dur);
        } else if (type === 'bass_drop') {
            // Deep falling sub-bass hit -- pairs well with a bold/impactful
            // B-roll exit or a "reveal" moment.
            const dur = 0.5;
            const osc = audioCtx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(180, now);
            osc.frequency.exponentialRampToValueAtTime(35, now + dur * 0.8);
            osc.connect(sfxGain);
            sfxGain.gain.setValueAtTime(0.0001, now);
            sfxGain.gain.linearRampToValueAtTime(0.6, now + 0.02);
            sfxGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
            osc.start(now);
            osc.stop(now + dur);
        } else if (type === 'notification') {
            // Clean two-note "ding" like a phone notification -- more
            // minimal/neutral than the sparkly "chime" preset.
            const dur = 0.3;
            [1046, 1568].forEach((freq, i) => {
                const osc = audioCtx.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + i * 0.09);
                const noteGain = audioCtx.createGain();
                noteGain.gain.setValueAtTime(0.0001, now + i * 0.09);
                noteGain.gain.linearRampToValueAtTime(0.32, now + i * 0.09 + 0.015);
                noteGain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.09 + dur);
                osc.connect(noteGain);
                noteGain.connect(sfxGain);
                osc.start(now + i * 0.09);
                osc.stop(now + i * 0.09 + dur);
            });
            sfxGain.gain.setValueAtTime(1, now);
        }

        // Clean up nodes shortly after the sound finishes to avoid leaking them.
        setTimeout(() => { try { sfxGain.disconnect(); } catch (e) {} }, 700);
    };

    // --- 7. Auto Subtitle (Phase 5A) ---
    const generateSubtitleBtn = document.getElementById('generate-subtitle-btn');
    const subtitleEnabledToggle = document.getElementById('subtitle-enabled-toggle');
    const subtitleListEl = document.getElementById('subtitle-list');
    const subtitleBrowserWarning = document.getElementById('subtitle-browser-warning');

    const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;
    let speechRecognizer = null;
    let subtitleSegmentStartTime = 0;
    let latestInterimText = ''; // running not-yet-final transcript, flushed if a session ends before finalizing

    if (subtitleEnabledToggle) {
        subtitleEnabledToggle.addEventListener('change', (e) => {
            state.subtitlesEnabled = e.target.checked;
            if (window.drawEditorFrame) window.drawEditorFrame();
        });
    }

    if (generateSubtitleBtn) {
        if (!SpeechRecognitionImpl) {
            generateSubtitleBtn.disabled = true;
            if (subtitleBrowserWarning) subtitleBrowserWarning.style.display = 'block';
        } else {
            generateSubtitleBtn.addEventListener('click', () => {
                if (state.isSubtitleRecognitionActive) {
                    stopSubtitleRecognition();
                } else {
                    startSubtitleRecognition();
                }
            });
        }
    }

    function startSubtitleRecognition() {
        if (!state.duration) {
            alert('Please load a video first before generating subtitles.');
            return;
        }

        speechRecognizer = new SpeechRecognitionImpl();
        speechRecognizer.continuous = true;
        // Turned ON (was false). With interimResults:false, Chrome's bn-BD
        // recognizer often only delivers a "final" result right as a session
        // ends — and these sessions auto-terminate every so often (network
        // timeout / silence detection). If that termination happened mid-
        // sentence, NOTHING had been finalized yet, so onend fired, we
        // restarted, and everything spoken in that window was silently lost —
        // this is why only one word at a time was making it through. Now we
        // track the latest interim (non-final) text as we go, and flush
        // whatever we have (final or not) both when a result finalizes AND
        // when the session ends, instead of only ever trusting isFinal.
        speechRecognizer.interimResults = true;
        speechRecognizer.lang = 'bn-BD'; // Bangla recognition; falls back gracefully if unsupported

        subtitleSegmentStartTime = state.video.currentTime;
        latestInterimText = '';

        speechRecognizer.onresult = (event) => {
            // event.results is a running list; only look at newly-updated results
            // from resultIndex onward (older ones were already handled).
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                const transcriptText = (result[0] && result[0].transcript || '').trim();
                if (!transcriptText) continue;

                if (result.isFinal) {
                    commitSubtitleSegment(transcriptText);
                    latestInterimText = '';
                } else {
                    // Keep the running partial text so it isn't lost if the
                    // session ends before Google's engine ever finalizes it.
                    latestInterimText = transcriptText;
                }
            }
        };

        speechRecognizer.onerror = (event) => {
            console.warn('Speech recognition error:', event.error);
            if (event.error === 'no-speech') return; // keep listening through silence
            // Flush any not-yet-finalized text before giving up, so a hard
            // error doesn't silently drop the last thing that was said.
            flushInterimAsSegment();
            stopSubtitleRecognition();
        };

        speechRecognizer.onend = () => {
            // Browser cut the session (periodic auto-stop, silence, network
            // hiccup, etc). Flush whatever partial text we were holding so it
            // still ends up as a subtitle line instead of vanishing, then
            // restart if the user is still actively listening.
            flushInterimAsSegment();
            if (state.isSubtitleRecognitionActive && !state.video.paused) {
                try { speechRecognizer.start(); } catch (e) { /* already started */ }
            }
        };

        try {
            speechRecognizer.start();
            state.isSubtitleRecognitionActive = true;
            generateSubtitleBtn.innerHTML = '<i class="fa-solid fa-stop"></i> Stop Listening (থামান)';

            if (state.video.paused) {
                state.video.play();
            }
        } catch (e) {
            console.error('Could not start speech recognition:', e);
            alert('Speech recognition শুরু করা যায়নি। মাইক্রোফোন পারমিশন দিয়েছেন কিনা চেক করুন।');
        }
    }

    // Pushes a finished piece of transcript into state.subtitles with a
    // timestamp window, and advances the segment start marker for the next line.
    function commitSubtitleSegment(transcriptText) {
        const endTime = state.video.currentTime;
        const startTime = Math.max(subtitleSegmentStartTime, endTime - 4); // cap a single line to ~4s if recognition was slow

        state.subtitles.push({
            id: Date.now() + Math.random(),
            text: transcriptText,
            startSec: startTime,
            endSec: Math.max(startTime + 0.5, endTime)
        });

        subtitleSegmentStartTime = endTime;
        renderSubtitleList();
    }

    // Commits whatever interim (not-yet-"final") text is still pending, so a
    // session cutting off mid-sentence doesn't just discard it.
    function flushInterimAsSegment() {
        const text = (latestInterimText || '').trim();
        latestInterimText = '';
        if (text) {
            commitSubtitleSegment(text);
        }
    }

    function stopSubtitleRecognition() {
        state.isSubtitleRecognitionActive = false;
        flushInterimAsSegment();
        if (speechRecognizer) {
            try { speechRecognizer.stop(); } catch (e) {}
        }
        if (generateSubtitleBtn) {
            generateSubtitleBtn.innerHTML = '<i class="fa-solid fa-closed-captioning"></i> Listen & Generate (ভিডিও থেকে শোনা শুরু করুন)';
        }
    }

    function renderSubtitleList() {
        if (!subtitleListEl) return;
        subtitleListEl.innerHTML = '';
        state.subtitles.forEach((sub) => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.justifyContent = 'space-between';
            row.style.gap = '8px';
            row.style.padding = '8px 12px';
            row.style.borderRadius = '6px';
            row.style.marginBottom = '6px';
            row.style.background = 'rgba(255,255,255,0.04)';

            const label = document.createElement('span');
            label.innerText = sub.text;
            label.style.fontSize = '13px';
            label.style.flex = '1';

            const timeLabel = document.createElement('span');
            timeLabel.innerText = `${sub.startSec.toFixed(1)}s`;
            timeLabel.style.fontSize = '11px';
            timeLabel.style.opacity = '0.6';

            const removeBtn = document.createElement('button');
            removeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            removeBtn.style.background = 'transparent';
            removeBtn.style.border = 'none';
            removeBtn.style.color = '#f87171';
            removeBtn.style.cursor = 'pointer';
            removeBtn.addEventListener('click', () => {
                state.subtitles = state.subtitles.filter(s => s.id !== sub.id);
                renderSubtitleList();
                if (window.drawEditorFrame) window.drawEditorFrame();
            });

            row.appendChild(label);
            row.appendChild(timeLabel);
            row.appendChild(removeBtn);
            subtitleListEl.appendChild(row);
        });
    }

    // --- Subtitle Styling + Silence-Aware Snap (Phase 5A enhancements) ---
    const banglaPresetBtn = document.getElementById('subtitle-bangla-preset-btn');
    const subtitleSnapBtn = document.getElementById('subtitle-snap-btn');
    const subtitleSnapStatus = document.getElementById('subtitle-snap-status');
    const subtitleFontsizeSlider = document.getElementById('subtitle-fontsize-slider');
    const subtitleHighlightToggle = document.getElementById('subtitle-highlight-toggle');
    const subtitlePositionSelect = document.getElementById('subtitle-position-select');
    const subtitleBgpillToggle = document.getElementById('subtitle-bgpill-toggle');

    // Returns the active (non-image) video clip whose audio we can decode, so the
    // same clip the subtitles were generated from is the one we snap against.
    function getActiveSubtitleClip() {
        const clip = state.clips.find(c => c.id === state.activeClipId);
        if (!clip || clip.type === 'image' || !clip.file) return null;
        return clip;
    }

    // Finds the speech region closest to time `t` (by distance to the segment),
    // but only if it is within `tol` seconds — so we never yank a caption onto a
    // completely different spoken phrase that happens to be nearby.
    function nearestSpeechBoundary(speechRegions, t, tol) {
        let best = null, bestDist = Infinity;
        for (const seg of speechRegions) {
            let d;
            if (t >= seg.start && t <= seg.end) d = 0;
            else if (t < seg.start) d = seg.start - t;
            else d = t - seg.end;
            if (d < bestDist && d <= tol) { bestDist = d; best = seg; }
        }
        return best;
    }

    // One-Click "Bangla Caption Style" Preset — Facebook/Reels-friendly Bengali
    // captions: big bold outlined lowercase-free text, pill background, bottom
    // anchored, with word-by-word TikTok-style highlight animation.
    if (banglaPresetBtn) {
        banglaPresetBtn.addEventListener('click', () => {
            state.subtitleStyle = {
                fontFamily: '"Hind Siliguri", "Plus Jakarta Sans", sans-serif',
                fontSizePct: 0.06,
                fontWeight: 800,
                color: '#ffffff',
                outlineColor: '#000000',
                outlineWidth: 6,
                bgPillEnabled: true,
                bgPillColor: 'rgba(0, 0, 0, 0.55)',
                bgPillRadius: 9999,
                position: 'bottom',
                positionPct: 0.08,
                highlightEnabled: true,
                highlightColor: '#ffe600'
            };
            syncSubtitleStyleUI();
            if (window.drawEditorFrame) window.drawEditorFrame();
        });
    }

    // Auto Silence-Aware Subtitle Timing Sync — reuses the 7A silence-detection
    // engine to find real speech moments, then snaps each caption's start/end to
    // the nearest spoken onset/offset so timings line up with actual speech.
    if (subtitleSnapBtn) {
        subtitleSnapBtn.addEventListener('click', async () => {
            if (!state.subtitles || state.subtitles.length === 0) {
                alert('আগে "Listen & Generate" দিয়ে সাবটাইটেল তৈরি করুন।');
                return;
            }
            const clip = getActiveSubtitleClip();
            if (!clip || !window.computeSpeechRegions) {
                alert('সাবটাইটেল সিঙ্ক করতে ভিডিও ক্লিপটি লোড করুন।');
                return;
            }

            if (subtitleSnapStatus) {
                subtitleSnapStatus.style.display = 'block';
                subtitleSnapStatus.style.color = 'var(--text-secondary)';
                subtitleSnapStatus.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> অডিও বিশ্লেষণ করা হচ্ছে...';
            }
            subtitleSnapBtn.disabled = true;

            try {
                const { speechRegions } = await window.computeSpeechRegions(clip, -40, 0.15);

                const maxLook = 2.0;   // seconds to search for the nearest speech boundary
                const padding = 0.05;  // tiny pad so the first/last sound isn't clipped

                state.subtitles.forEach(s => {
                    const onsetSeg = nearestSpeechBoundary(speechRegions, s.startSec, maxLook);
                    if (onsetSeg) s.startSec = Math.max(0, onsetSeg.start - padding);

                    const offsetSeg = nearestSpeechBoundary(speechRegions, s.endSec, maxLook);
                    if (offsetSeg) s.endSec = offsetSeg.end + padding;

                    if (s.endSec <= s.startSec) s.endSec = s.startSec + 0.4;
                });

                renderSubtitleList();
                if (window.drawEditorFrame) window.drawEditorFrame();

                if (subtitleSnapStatus) {
                    subtitleSnapStatus.style.color = 'var(--success)';
                    subtitleSnapStatus.innerHTML = '<i class="fa-solid fa-circle-check"></i> সাবটাইটেল স্পিচ মুহূর্তের সাথে সিঙ্ক করা হয়েছে।';
                }
            } catch (err) {
                console.error('Subtitle snap failed:', err);
                if (subtitleSnapStatus) {
                    subtitleSnapStatus.style.color = 'var(--danger)';
                    subtitleSnapStatus.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> সিঙ্ক ব্যর্থ — ফাইলে অডিও ট্র্যাক থাকতে হবে।';
                }
            } finally {
                subtitleSnapBtn.disabled = false;
            }
        });
    }

    // Reflect current state.subtitleStyle into the style controls.
    function syncSubtitleStyleUI() {
        const st = state.subtitleStyle || {};
        if (subtitleFontsizeSlider) subtitleFontsizeSlider.value = (st.fontSizePct != null ? st.fontSizePct * 100 : 4.5);
        if (subtitleHighlightToggle) subtitleHighlightToggle.checked = !!st.highlightEnabled;
        if (subtitlePositionSelect) subtitlePositionSelect.value = st.position || 'bottom';
        if (subtitleBgpillToggle) subtitleBgpillToggle.checked = (st.bgPillEnabled !== false);
    }

    if (subtitleFontsizeSlider) {
        subtitleFontsizeSlider.addEventListener('input', (e) => {
            state.subtitleStyle.fontSizePct = parseFloat(e.target.value) / 100;
            if (window.drawEditorFrame) window.drawEditorFrame();
        });
    }
    if (subtitleHighlightToggle) {
        subtitleHighlightToggle.addEventListener('change', (e) => {
            state.subtitleStyle.highlightEnabled = e.target.checked;
            if (window.drawEditorFrame) window.drawEditorFrame();
        });
    }
    if (subtitlePositionSelect) {
        subtitlePositionSelect.addEventListener('change', (e) => {
            state.subtitleStyle.position = e.target.value;
            if (window.drawEditorFrame) window.drawEditorFrame();
        });
    }
    if (subtitleBgpillToggle) {
        subtitleBgpillToggle.addEventListener('change', (e) => {
            state.subtitleStyle.bgPillEnabled = e.target.checked;
            if (window.drawEditorFrame) window.drawEditorFrame();
        });
    }
    syncSubtitleStyleUI();

    window.syncAudioUIFromStateGlobal = function() {
        if (noiseCancelToggle) {
            noiseCancelToggle.checked = state.isNoiseCancelActive;
        }
        if (noiseLevelContainer) {
            noiseLevelContainer.style.display = state.isNoiseCancelActive ? 'block' : 'none';
        }
        if (noiseGateSlider) {
            noiseGateSlider.value = state.noiseGateThreshold;
        }
        if (noiseGateVal) {
            noiseGateVal.innerText = state.noiseGateThreshold + ' dB';
        }
        if (aiDenoiseToggle) {
            aiDenoiseToggle.checked = !!state.isAiDenoiseActive;
        }
        applyNoiseCancelSettings();
        if (state.isAiDenoiseActive && audioCtx) {
            setAIDenoiseEnabled(true);
        }
        if (voiceoverVolumeSlider) {
            voiceoverVolumeSlider.value = state.voiceoverVolume * 100;
        }
        if (voiceoverVolumeVal) {
            voiceoverVolumeVal.innerText = Math.round(state.voiceoverVolume * 100) + '%';
        }
        if (voiceChangerSelect) {
            voiceChangerSelect.value = state.voiceoverProfile || 'none';
        }
        if (bgMusicDuckingToggle) {
            bgMusicDuckingToggle.checked = state.bgMusicDuckingEnabled;
        }
        if (state.voiceoverRecorded) {
            if (voiceoverPreviewBox) voiceoverPreviewBox.style.display = 'block';
            if (voiceoverVolumeContainer) voiceoverVolumeContainer.style.display = 'block';
            if (voiceoverAudioPreview && state.voiceoverUrl) {
                voiceoverAudioPreview.src = state.voiceoverUrl;
            }
        } else {
            if (voiceoverPreviewBox) voiceoverPreviewBox.style.display = 'none';
            if (voiceoverVolumeContainer) voiceoverVolumeContainer.style.display = 'none';
            if (voiceoverAudioPreview) voiceoverAudioPreview.src = '';
        }
        if (window.renderBgMusicTrackListGlobal) {
            window.renderBgMusicTrackListGlobal();
        }
        renderSubtitleList();
        syncSubtitleStyleUI();
    };
    // Offline audio rendering engine using OfflineAudioContext
    window.renderAudioOffline = async function(totalDuration) {
        if (!state.clips || state.clips.length === 0) {
            return null;
        }

        const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        const sampleRate = 48000;
        const offlineCtx = new OfflineCtx(2, sampleRate * totalDuration, sampleRate);

        // DSP nodes on the Speech path (video clips & voiceover)
        const hp = offlineCtx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.setValueAtTime(state.isNoiseCancelActive ? Math.max(10, state.highpassFreq || 80) : 10, 0);

        const lp = offlineCtx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(state.isNoiseCancelActive ? Math.min(22000, state.lowpassFreq || 8000) : 22000, 0);

        // Compressor
        const comp = offlineCtx.createDynamicsCompressor();
        comp.threshold.setValueAtTime(-20, 0);
        comp.knee.setValueAtTime(18, 0);
        comp.ratio.setValueAtTime(3, 0);
        comp.attack.setValueAtTime(0.008, 0);
        comp.release.setValueAtTime(0.18, 0);

        const makeup = offlineCtx.createGain();
        makeup.gain.setValueAtTime(1.0, 0);

        const speechGate = offlineCtx.createGain();
        speechGate.gain.setValueAtTime(1.0, 0);

        // AI Denoise (RNNoise AudioWorklet) — the live preview graph inserts this
        // between the lowpass filter and the noise gate (see routeAIDenoise/
        // setAIDenoiseEnabled above). AudioWorkletNodes cannot be shared across
        // contexts, so a fresh worklet module load + node is required here for
        // the OfflineAudioContext used by the server-render pipeline. Without
        // this, "AI Denoise" would appear enabled in the UI but silently have
        // zero effect on the actual rendered/exported file.
        let offlineAiDenoiseNode = null;
        if (state.isAiDenoiseActive && offlineCtx.audioWorklet && window.WebAssembly) {
            try {
                await offlineCtx.audioWorklet.addModule('vendor/rnnoise/ai-denoise-worklet.js');
                offlineAiDenoiseNode = new AudioWorkletNode(offlineCtx, 'ai-denoise-processor', {
                    channelCount: 2,
                    channelCountMode: 'explicit',
                    outputChannelCount: [2]
                });
            } catch (err) {
                console.error('Offline AI denoise setup failed; exporting with standard filter only:', err);
                offlineAiDenoiseNode = null;
            }
        }

        // Route: hp -> lp -> [aiDenoise if enabled] -> speechGate -> comp -> makeup -> offlineCtx.destination
        hp.connect(lp);
        if (offlineAiDenoiseNode) {
            lp.connect(offlineAiDenoiseNode);
            offlineAiDenoiseNode.connect(speechGate);
        } else {
            lp.connect(speechGate);
        }
        speechGate.connect(comp);
        comp.connect(makeup);
        makeup.connect(offlineCtx.destination);

        // --- 1. Video Clips Audio ---
        let timelineTime = 0;
        const decodedVideoBuffers = [];

        // Pre-decode all video clips
        for (let i = 0; i < state.clips.length; i++) {
            const clip = state.clips[i];
            const clipTrimDuration = Math.max(0, clip.end - clip.start);
            if (clipTrimDuration <= 0) continue;

            if (clip.type !== 'image' && clip.file) {
                try {
                    const arrayBuffer = await clip.file.arrayBuffer();
                    const decodeCtx = new (window.AudioContext || window.webkitAudioContext)();
                    const audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer);
                    await decodeCtx.close();

                    decodedVideoBuffers.push({
                        buffer: audioBuffer,
                        clip,
                        timelineStart: timelineTime,
                        clipTrimDuration
                    });
                } catch (err) {
                    console.error(`Error decoding audio for clip ${clip.name}:`, err);
                }
            }
            timelineTime += clipTrimDuration;
        }

        // Add Video clips to offlineCtx
        decodedVideoBuffers.forEach(({ buffer, clip, timelineStart, clipTrimDuration }) => {
            const source = offlineCtx.createBufferSource();
            source.buffer = buffer;

            const clipGain = offlineCtx.createGain();
            clipGain.gain.setValueAtTime(state.videoVolume, 0);

            // Connect voice changer if enabled on original video
            if (state.applyVoiceChangerToVideo && state.voiceoverProfile && state.voiceoverProfile !== 'none') {
                const changer = new VoiceChangerEffect(offlineCtx);
                changer.setProfile(state.voiceoverProfile);
                source.connect(changer.input);
                changer.output.connect(clipGain);
            } else {
                source.connect(clipGain);
            }

            clipGain.connect(hp);

            // Play the trimmed portion
            source.start(timelineStart, clip.start, clipTrimDuration);
        });

        // --- 2. Voiceover ---
        let voiceoverBuffer = null;
        if (state.voiceoverRecorded && state.voiceoverBlob) {
            try {
                const arrayBuffer = await state.voiceoverBlob.arrayBuffer();
                const decodeCtx = new (window.AudioContext || window.webkitAudioContext)();
                voiceoverBuffer = await decodeCtx.decodeAudioData(arrayBuffer);
                await decodeCtx.close();

                const source = offlineCtx.createBufferSource();
                source.buffer = voiceoverBuffer;

                const voGain = offlineCtx.createGain();
                voGain.gain.setValueAtTime(Math.min(1.0, state.voiceoverVolume), 0);

                if (state.voiceoverProfile && state.voiceoverProfile !== 'none') {
                    const changer = new VoiceChangerEffect(offlineCtx);
                    changer.setProfile(state.voiceoverProfile);
                    source.connect(changer.input);
                    changer.output.connect(voGain);
                } else {
                    source.connect(voGain);
                }

                voGain.connect(hp);
                source.start(0);
            } catch (err) {
                console.error('Error decoding voiceover audio:', err);
            }
        }

        // --- 3. Noise Gate & Compressor Auto Makeup (Envelope Analysis) ---
        if (state.isNoiseCancelActive) {
            const interval = 0.05; // 50ms
            const threshold = Math.pow(10, state.noiseGateThreshold / 20);
            const openAt = threshold * 1.78; // +5dB hysteresis
            
            let gateOpen = true;
            for (let t = 0; t < totalDuration; t += interval) {
                let maxRms = 0;
                
                // Check voiceover
                if (voiceoverBuffer) {
                    const sampleOffset = Math.floor(t * voiceoverBuffer.sampleRate);
                    if (sampleOffset < voiceoverBuffer.length) {
                        const len = Math.min(voiceoverBuffer.length - sampleOffset, Math.floor(interval * voiceoverBuffer.sampleRate));
                        const data = voiceoverBuffer.getChannelData(0);
                        let sum = 0;
                        for (let j = 0; j < len; j++) sum += data[sampleOffset + j] * data[sampleOffset + j];
                        const rms = Math.sqrt(sum / Math.max(1, len));
                        if (rms > maxRms) maxRms = rms;
                    }
                }
                
                // Check video clips
                decodedVideoBuffers.forEach(({ buffer, clip, timelineStart, clipTrimDuration }) => {
                    if (t >= timelineStart && t < timelineStart + clipTrimDuration) {
                        const clipTime = clip.start + (t - timelineStart);
                        const sampleOffset = Math.floor(clipTime * buffer.sampleRate);
                        if (sampleOffset < buffer.length) {
                            const len = Math.min(buffer.length - sampleOffset, Math.floor(interval * buffer.sampleRate));
                            const data = buffer.getChannelData(0);
                            let sum = 0;
                            for (let j = 0; j < len; j++) sum += data[sampleOffset + j] * data[sampleOffset + j];
                            const rms = Math.sqrt(sum / Math.max(1, len));
                            if (rms > maxRms) maxRms = rms;
                        }
                    }
                });
                
                if (gateOpen && maxRms < threshold) gateOpen = false;
                else if (!gateOpen && maxRms > openAt) gateOpen = true;
                
                const targetGate = gateOpen ? 1.0 : 0.02;
                speechGate.gain.setValueAtTime(targetGate, t);
            }
            makeup.gain.setValueAtTime(1.5, 0); // compensation for compressor
        }

        // --- 4. Background Music Tracks ---
        const bgMusicGains = [];
        for (let i = 0; i < state.bgMusicTracks.length; i++) {
            const track = state.bgMusicTracks[i];
            if (track.blob) {
                try {
                    const arrayBuffer = await track.blob.arrayBuffer();
                    const decodeCtx = new (window.AudioContext || window.webkitAudioContext)();
                    const musicBuffer = await decodeCtx.decodeAudioData(arrayBuffer);
                    await decodeCtx.close();

                    const source = offlineCtx.createBufferSource();
                    source.buffer = musicBuffer;
                    source.loop = (track.loopMode === 'loop');

                    const trackGain = offlineCtx.createGain();
                    trackGain.gain.setValueAtTime(Math.min(1.0, track.volume), 0);

                    source.connect(trackGain);
                    trackGain.connect(offlineCtx.destination);

                    const windowStart = track.startSec || 0;
                    const windowEnd = (track.endSec == null || !isFinite(track.endSec))
                        ? totalDuration
                        : track.endSec;

                    source.start(Math.max(0, windowStart));
                    try { source.stop(Math.max(windowStart + 0.05, windowEnd)); } catch(e) {}

                    bgMusicGains.push({
                        gainNode: trackGain,
                        track,
                        windowStart,
                        windowEnd
                    });
                } catch (err) {
                    console.error('Error decoding background music:', err);
                }
            }
        }

        // --- 5. Ducking Automation on Background Music ---
        if (state.bgMusicDuckingEnabled && bgMusicGains.length > 0) {
            const interval = 0.05; // 50ms chunks
            const threshold = 0.018; // DUCK_RMS_THRESHOLD
            
            for (let t = 0; t < totalDuration; t += interval) {
                let speechActive = false;
                
                if (voiceoverBuffer) {
                    const sampleOffset = Math.floor(t * voiceoverBuffer.sampleRate);
                    if (sampleOffset < voiceoverBuffer.length) {
                        const len = Math.min(voiceoverBuffer.length - sampleOffset, Math.floor(interval * voiceoverBuffer.sampleRate));
                        const data = voiceoverBuffer.getChannelData(0);
                        let sum = 0;
                        for (let j = 0; j < len; j++) sum += data[sampleOffset + j] * data[sampleOffset + j];
                        const rms = Math.sqrt(sum / Math.max(1, len));
                        if (rms > threshold) speechActive = true;
                    }
                }
                
                decodedVideoBuffers.forEach(({ buffer, clip, timelineStart, clipTrimDuration }) => {
                    if (t >= timelineStart && t < timelineStart + clipTrimDuration) {
                        const clipTime = clip.start + (t - timelineStart);
                        const sampleOffset = Math.floor(clipTime * buffer.sampleRate);
                        if (sampleOffset < buffer.length) {
                            const len = Math.min(buffer.length - sampleOffset, Math.floor(interval * buffer.sampleRate));
                            const data = buffer.getChannelData(0);
                            let sum = 0;
                            for (let j = 0; j < len; j++) sum += data[sampleOffset + j] * data[sampleOffset + j];
                            const rms = Math.sqrt(sum / Math.max(1, len));
                            if (rms > threshold) speechActive = true;
                        }
                    }
                });

                if (speechActive) {
                    bgMusicGains.forEach(({ gainNode, track }) => {
                        const fullLevel = Math.min(1.0, track.volume);
                        const duckedLevel = fullLevel * 0.25; // DUCK_DEPTH
                        gainNode.gain.setValueAtTime(duckedLevel, t);
                    });
                } else {
                    bgMusicGains.forEach(({ gainNode, track }) => {
                        const fullLevel = Math.min(1.0, track.volume);
                        gainNode.gain.setValueAtTime(fullLevel, t);
                    });
                }
            }
        }

        // --- 6. Render Offline Audio ---
        console.log('Rendering audio offline...');
        const renderedBuffer = await offlineCtx.startRendering();
        console.log('Audio rendering complete.');
        return renderedBuffer;
    };

    // Stop listening automatically once the trimmed playback range ends or video is paused
    state.video.addEventListener('pause', () => {
        if (state.isSubtitleRecognitionActive) {
            stopSubtitleRecognition();
        }
    });
});
