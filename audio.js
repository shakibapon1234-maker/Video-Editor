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
        // input -> highpass -> peaking -> peaking2 -> lowpass -> pitchShifter -> ringModNode -> output
        this.input.connect(this.highpass);
        this.highpass.connect(this.peaking);
        this.peaking.connect(this.peaking2);
        this.peaking2.connect(this.lowpass);
        this.lowpass.connect(this.pitchShifter.input);
        this.pitchShifter.output.connect(this.ringModNode);
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
        this.peaking.gain.setValueAtTime(0, now);
        this.peaking2.gain.setValueAtTime(0, now);
        this.robotGain.gain.setValueAtTime(0, now);
        this.echoGain.gain.setValueAtTime(0, now);
        
        switch (profileName) {
            case 'female_sweet': // Sweet female voice
                this.pitchShifter.setPitchOffset(0.40); // slightly less than before to reduce warble artifacts
                this.highpass.frequency.setValueAtTime(210, now); // strip more chest/male resonance
                this.peaking.frequency.setValueAtTime(3000, now);
                this.peaking.gain.setValueAtTime(5, now);
                this.peaking2.frequency.setValueAtTime(4200, now); // adds airy female "presence"
                this.peaking2.gain.setValueAtTime(4, now);
                break;
                
            case 'female_warm': // Warm female voice
                this.pitchShifter.setPitchOffset(0.30);
                this.highpass.frequency.setValueAtTime(180, now);
                this.peaking.frequency.setValueAtTime(1400, now);
                this.peaking.gain.setValueAtTime(3, now);
                this.peaking2.frequency.setValueAtTime(3200, now); // keeps it from sounding muddy/male
                this.peaking2.gain.setValueAtTime(3, now);
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

    // Background Music UI selectors (Phase 3A)
    const bgMusicDropzone = document.getElementById('bgmusic-dropzone');
    const bgMusicInput = document.getElementById('bgmusic-input');
    const bgMusicFilename = document.getElementById('bgmusic-filename');
    const bgMusicControlsContainer = document.getElementById('bgmusic-controls-container');
    const bgMusicVolumeSlider = document.getElementById('bgmusic-volume-slider');
    const bgMusicVolumeVal = document.getElementById('bgmusic-volume-val');
    const bgMusicDuckingToggle = document.getElementById('bgmusic-ducking-toggle');
    const bgMusicAudioPreview = document.getElementById('bgmusic-audio-preview');
    const removeBgMusicBtn = document.getElementById('remove-bgmusic-btn');
    
    // Web Audio Variables
    let audioCtx = null;
    let videoSourceNode = null;
    
    // DSP Nodes
    let videoGainNode = null;
    let highpassNode = null;
    let lowpassNode = null;
    let compressorNode = null;
    let makeupGainNode = null; // Auto-compensates volume lost to the noise-cancel compressor
    
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
    
    // Expose Node references to window
    window.videoGainNode = null;
    
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
            
            // Create Biquad Filters for Noise Cancellation
            highpassNode = audioCtx.createBiquadFilter();
            highpassNode.type = 'highpass';
            // Default bypass: 10Hz (doesn't filter speech)
            highpassNode.frequency.setValueAtTime(10, 0);
            
            lowpassNode = audioCtx.createBiquadFilter();
            lowpassNode.type = 'lowpass';
            // Default bypass: 22000Hz (doesn't filter speech)
            lowpassNode.frequency.setValueAtTime(22000, 0);
            
            // Compressor to act as automatic volume stabilizer & peak limiter
            compressorNode = audioCtx.createDynamicsCompressor();
            compressorNode.threshold.setValueAtTime(-24, 0);
            compressorNode.knee.setValueAtTime(30, 0);
            compressorNode.ratio.setValueAtTime(12, 0);
            compressorNode.attack.setValueAtTime(0.003, 0);
            compressorNode.release.setValueAtTime(0.25, 0);
            
            // Makeup gain: automatically restores the loudness the compressor
            // takes away when Noise Cancellation is on. Without this, a low
            // gate threshold + high ratio crushes the entire voice signal
            // down near-silence with no way to bring the level back up.
            makeupGainNode = audioCtx.createGain();
            makeupGainNode.gain.setValueAtTime(1, 0);

            // Link DSP chain: Source -> Volume -> Highpass -> Lowpass -> Compressor -> MakeupGain -> Destination
            videoSourceNode.connect(videoGainNode);
            videoGainNode.connect(highpassNode);
            highpassNode.connect(lowpassNode);
            lowpassNode.connect(compressorNode);
            compressorNode.connect(makeupGainNode);
            makeupGainNode.connect(audioCtx.destination);

            // Continuously read how much the compressor is reducing the signal
            // (compressorNode.reduction, always <= 0 dB) and add that loudness
            // back via makeupGainNode. This is what keeps Noise Cancellation
            // from silencing the audio: the filters/gate still cut hiss and
            // low-level noise, but real speech gets its volume restored.
            (function pumpMakeupGain() {
                if (compressorNode && makeupGainNode && audioCtx) {
                    if (state.isNoiseCancelActive) {
                        const reductionDb = compressorNode.reduction || 0; // negative dB
                        // Cap compensation at +14dB (~5x) so we don't also blast
                        // residual background noise back up to full volume.
                        const compensationDb = Math.min(14, -reductionDb);
                        const targetGain = Math.pow(10, compensationDb / 20);
                        makeupGainNode.gain.setTargetAtTime(targetGain, audioCtx.currentTime, 0.08);
                    } else {
                        makeupGainNode.gain.setTargetAtTime(1, audioCtx.currentTime, 0.08);
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
                
                // Connect preview stream: voiceoverAudioPreviewEl -> voiceoverMediaSource -> VoiceChanger -> VolumeGain -> Destination
                voiceoverMediaSource.connect(voiceoverVoiceChanger.input);
                voiceoverVoiceChanger.output.connect(voiceoverVolumeGain);
                voiceoverVolumeGain.connect(audioCtx.destination);
                
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
        } catch (e) {
            console.error("Failed to initialize Web Audio API", e);
        }
    };

    // Mute/unmute the video's audio via the Web Audio gain node instead of
    // HTMLMediaElement.volume. Setting video.volume = 0 while the element is
    // routed through createMediaElementSource() silences the audio graph
    // entirely in Chrome, which was killing the exported video's sound.
    // This mutes only what goes to the speakers; the MediaRecorder tap
    // (post-gain in the chain) keeps receiving full audio either way.
    window.setSpeakerMuted = function(muted) {
        if (!videoGainNode || !audioCtx) return false; // caller should fall back to video.volume
        const targetGain = muted ? 0 : state.videoVolume;
        videoGainNode.gain.setValueAtTime(targetGain, audioCtx.currentTime);
        return true;
    };
    
    // Resume audio context when playing
    state.video.addEventListener('play', () => {
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    });
    
    // --- 2. DSP Settings Changes (Noise Cancel) ---
    noiseCancelToggle.addEventListener('change', (e) => {
        state.isNoiseCancelActive = e.target.checked;
        
        if (state.isNoiseCancelActive) {
            // Apply human speech optimized bandpass filters (cuts sub-hum and static hiss)
            highpassNode.frequency.setValueAtTime(120, audioCtx.currentTime); // Cut frequencies below 120Hz
            lowpassNode.frequency.setValueAtTime(7000, audioCtx.currentTime); // Cut frequencies above 7000Hz
            
            // Apply heavier compression threshold to act as a soft noise gate
            compressorNode.threshold.setValueAtTime(state.noiseGateThreshold, audioCtx.currentTime);
            compressorNode.ratio.setValueAtTime(16, audioCtx.currentTime);
            
            noiseLevelContainer.style.display = 'block';
        } else {
            // Bypass filters
            highpassNode.frequency.setValueAtTime(10, audioCtx.currentTime);
            lowpassNode.frequency.setValueAtTime(22000, audioCtx.currentTime);
            
            // Reset compressor to mild settings
            compressorNode.threshold.setValueAtTime(-24, audioCtx.currentTime);
            compressorNode.ratio.setValueAtTime(12, audioCtx.currentTime);
            
            noiseLevelContainer.style.display = 'none';
        }
    });
    
    noiseGateSlider.addEventListener('input', (e) => {
        state.noiseGateThreshold = parseInt(e.target.value);
        noiseGateVal.innerText = state.noiseGateThreshold + ' dB';
        
        if (state.isNoiseCancelActive) {
            compressorNode.threshold.setValueAtTime(state.noiseGateThreshold, audioCtx.currentTime);
        }
    });
    
    // --- 3. Microphone Access Check ---
    async function requestMicrophoneAccess() {
        try {
            micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
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
        if (window.applyDuckingToBgMusicPreview) window.applyDuckingToBgMusicPreview();
        
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
        if (window.applyDuckingToBgMusicPreview) window.applyDuckingToBgMusicPreview();
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
        });
    }

    // --- 4B. Background Music (Phase 3A) ---
    bgMusicDropzone.addEventListener('click', () => bgMusicInput.click());

    bgMusicInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        loadBgMusicFile(file);
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
            loadBgMusicFile(file);
        }
    });

    function loadBgMusicFile(file) {
        state.bgMusicBlob = file;
        state.bgMusicUrl = URL.createObjectURL(file);
        state.bgMusicAdded = true;

        bgMusicFilename.innerText = file.name;
        bgMusicAudioPreview.src = state.bgMusicUrl;
        bgMusicAudioPreview.loop = true;
        bgMusicAudioPreview.volume = state.bgMusicVolume;
        bgMusicControlsContainer.style.display = 'block';
    }

    removeBgMusicBtn.addEventListener('click', () => {
        bgMusicAudioPreview.pause();
        if (state.bgMusicUrl) URL.revokeObjectURL(state.bgMusicUrl);
        state.bgMusicBlob = null;
        state.bgMusicUrl = null;
        state.bgMusicAdded = false;

        bgMusicFilename.innerText = 'No music added';
        bgMusicAudioPreview.src = '';
        bgMusicInput.value = '';
        bgMusicControlsContainer.style.display = 'none';
    });

    bgMusicVolumeSlider.addEventListener('input', (e) => {
        state.bgMusicVolume = parseInt(e.target.value) / 100;
        bgMusicVolumeVal.innerText = e.target.value + '%';
        // Only reflect base volume on preview element when NOT actively ducking during preview playback
        if (!(state.bgMusicDuckingEnabled && window.isRecordingVoiceover)) {
            bgMusicAudioPreview.volume = Math.min(1.0, state.bgMusicVolume);
        }
    });

    bgMusicDuckingToggle.addEventListener('change', (e) => {
        state.bgMusicDuckingEnabled = e.target.checked;
    });
    
    // --- 5. Sync Voiceover & Background Music playing during preview playback ---
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

        if (state.bgMusicAdded && state.bgMusicUrl) {
            const musicOffset = (state.video.currentTime - state.startTime) % (bgMusicAudioPreview.duration || Infinity);
            if (musicOffset >= 0 && isFinite(musicOffset)) {
                bgMusicAudioPreview.currentTime = musicOffset;
            }
            applyDuckingToBgMusicPreview();
            bgMusicAudioPreview.play().catch(err => {
                console.log("Auto-play blocked for background music", err);
            });
        }
    };
    
    window.onPlaybackStop = function() {
        if (state.voiceoverRecorded) {
            voiceoverAudioPreview.pause();
        }
        if (state.bgMusicAdded) {
            bgMusicAudioPreview.pause();
        }
    };

    // Lower bg music volume while voiceover recording is in progress (auto-ducking)
    function applyDuckingToBgMusicPreview() {
        if (!state.bgMusicAdded) return;
        if (state.bgMusicDuckingEnabled && window.isRecordingVoiceover) {
            bgMusicAudioPreview.volume = Math.min(1.0, state.bgMusicVolume * 0.25);
        } else {
            bgMusicAudioPreview.volume = Math.min(1.0, state.bgMusicVolume);
        }
    }
    window.applyDuckingToBgMusicPreview = applyDuckingToBgMusicPreview;
    
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
        if (state.bgMusicAdded && bgMusicAudioPreview.duration) {
            const musicOffset = (state.video.currentTime - state.startTime) % bgMusicAudioPreview.duration;
            if (musicOffset >= 0 && isFinite(musicOffset)) {
                bgMusicAudioPreview.currentTime = musicOffset;
            }
        }
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
        
        // Disconnect video chain from speakers and route into export destination.
        // Tap AFTER makeupGainNode so the exported file gets the same
        // noise-cancel volume compensation as the live preview does.
        makeupGainNode.disconnect(audioCtx.destination);
        makeupGainNode.connect(dest);
        
        // Pre-create gain node for voiceover mixing
        let voiceoverSource = null;
        let voiceoverGain = null;
        
        if (state.voiceoverRecorded && state.voiceoverBlob) {
            voiceoverGain = audioCtx.createGain();
            voiceoverGain.gain.setValueAtTime(Math.min(1.0, state.voiceoverVolume), audioCtx.currentTime);
            voiceoverGain.connect(dest); // Connect voiceover gain directly to export destination
        }

        // Pre-create gain node for background music mixing (Phase 3A)
        let bgMusicSource = null;
        let bgMusicGain = null;

        if (state.bgMusicAdded && state.bgMusicBlob) {
            bgMusicGain = audioCtx.createGain();
            // If voiceover is also present and ducking is enabled, start at the ducked level
            // since both tracks begin together at export start.
            const duckedLevel = Math.min(1.0, state.bgMusicVolume * 0.25);
            const fullLevel = Math.min(1.0, state.bgMusicVolume);
            const shouldDuckThroughout = state.bgMusicDuckingEnabled && state.voiceoverRecorded && state.voiceoverBlob;
            bgMusicGain.gain.setValueAtTime(shouldDuckThroughout ? duckedLevel : fullLevel, audioCtx.currentTime);
            bgMusicGain.connect(dest);
        }
        
        return {
            stream: dest.stream,
            // Restore speaker connection after export finishes
            cleanup: function() {
                try { makeupGainNode.disconnect(dest); } catch(e) {}
                makeupGainNode.connect(audioCtx.destination);
                
                if (voiceoverSource) {
                    try { voiceoverSource.stop(); } catch(e) {}
                    try { voiceoverSource.disconnect(); } catch(e) {}
                }
                if (voiceoverGain) {
                    try { voiceoverGain.disconnect(); } catch(e) {}
                }
                if (bgMusicSource) {
                    try { bgMusicSource.stop(); } catch(e) {}
                    try { bgMusicSource.disconnect(); } catch(e) {}
                }
                if (bgMusicGain) {
                    try { bgMusicGain.disconnect(); } catch(e) {}
                }
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
            // Called immediately AFTER video.play() resolves to keep music in sync; loops for full trim duration
            startBgMusic: async function() {
                if (state.bgMusicAdded && state.bgMusicBlob && bgMusicGain) {
                    try {
                        const arrayBuffer = await state.bgMusicBlob.arrayBuffer();
                        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
                        
                        bgMusicSource = audioCtx.createBufferSource();
                        bgMusicSource.buffer = audioBuffer;
                        bgMusicSource.loop = true; // Loop music across the whole exported clip
                        bgMusicSource.connect(bgMusicGain);
                        
                        bgMusicSource.start(audioCtx.currentTime);
                    } catch(e) {
                        console.error('Background music export mix error:', e);
                    }
                }
            }
        };
    };

    // --- 7. Auto Subtitle (Phase 5A) ---
    const generateSubtitleBtn = document.getElementById('generate-subtitle-btn');
    const subtitleEnabledToggle = document.getElementById('subtitle-enabled-toggle');
    const subtitleListEl = document.getElementById('subtitle-list');
    const subtitleBrowserWarning = document.getElementById('subtitle-browser-warning');

    const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;
    let speechRecognizer = null;
    let subtitleSegmentStartTime = 0;

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
        speechRecognizer.interimResults = false;
        speechRecognizer.lang = 'bn-BD'; // Bangla recognition; falls back gracefully if unsupported

        subtitleSegmentStartTime = state.video.currentTime;

        speechRecognizer.onresult = (event) => {
            const result = event.results[event.results.length - 1];
            if (!result.isFinal) return;

            const transcriptText = result[0].transcript.trim();
            if (!transcriptText) return;

            const endTime = state.video.currentTime;
            const startTime = Math.max(subtitleSegmentStartTime, endTime - 4); // cap a single line to ~4s if recognition was slow

            state.subtitles.push({
                id: Date.now(),
                text: transcriptText,
                startSec: startTime,
                endSec: Math.max(startTime + 0.5, endTime)
            });

            subtitleSegmentStartTime = endTime;
            renderSubtitleList();
        };

        speechRecognizer.onerror = (event) => {
            console.warn('Speech recognition error:', event.error);
            if (event.error === 'no-speech') return; // keep listening through silence
            stopSubtitleRecognition();
        };

        speechRecognizer.onend = () => {
            // Browsers auto-stop recognition periodically; restart while still actively listening and video still playing
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

    function stopSubtitleRecognition() {
        state.isSubtitleRecognitionActive = false;
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

    // Stop listening automatically once the trimmed playback range ends or video is paused
    state.video.addEventListener('pause', () => {
        if (state.isSubtitleRecognitionActive) {
            stopSubtitleRecognition();
        }
    });
});
