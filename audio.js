// Audio Processing Engine
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
    
    // Web Audio Variables
    let audioCtx = null;
    let videoSourceNode = null;
    
    // DSP Nodes
    let videoGainNode = null;
    let highpassNode = null;
    let lowpassNode = null;
    let compressorNode = null;
    
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
            
            // Link DSP chain: Source -> Volume -> Highpass -> Lowpass -> Compressor -> Destination
            videoSourceNode.connect(videoGainNode);
            videoGainNode.connect(highpassNode);
            highpassNode.connect(lowpassNode);
            lowpassNode.connect(compressorNode);
            compressorNode.connect(audioCtx.destination);
            
            // Try requesting Mic access early for step 3 prep
            requestMicrophoneAccess();
        } catch (e) {
            console.error("Failed to initialize Web Audio API", e);
        }
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
    });
    
    // --- 5. Sync Voiceover playing during preview playback ---
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
    });
    
    // --- 6. Export Mixing Node function ---
    // This exposes a mixed AudioNode stream of BOTH the video sound & voiceover for recorder output
    window.getMixedAudioDestinationStream = function() {
        if (!audioCtx) return null;
        
        // Create destination node
        const dest = audioCtx.createMediaStreamDestination();
        
        // Disconnect video chain from speakers and connect to destination node during export
        compressorNode.disconnect(audioCtx.destination);
        compressorNode.connect(dest);
        
        // If voiceover exists, set up an AudioNode node for it and connect to destination
        let voiceoverSource = null;
        let voiceoverGain = null;
        
        if (state.voiceoverRecorded && state.voiceoverBlob) {
            // We need a helper to play the voiceover arrayBuffer directly in context
            voiceoverGain = audioCtx.createGain();
            voiceoverGain.gain.setValueAtTime(state.voiceoverVolume, 0);
            voiceoverGain.connect(dest);
        }
        
        return {
            stream: dest.stream,
            // Restore connection function to speaker when done exporting
            cleanup: function() {
                compressorNode.disconnect(dest);
                compressorNode.connect(audioCtx.destination);
                
                if (voiceoverSource) {
                    try { voiceoverSource.stop(); } catch(e){}
                }
            },
            // Call this right when video playback starts for export to play the buffer
            startVoiceover: async function() {
                if (state.voiceoverRecorded && state.voiceoverBlob) {
                    const arrayBuffer = await state.voiceoverBlob.arrayBuffer();
                    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
                    
                    voiceoverSource = audioCtx.createBufferSource();
                    voiceoverSource.buffer = audioBuffer;
                    voiceoverSource.connect(voiceoverGain);
                    
                    // Start playing at 0 delay (synchronized with the start of export playback)
                    voiceoverSource.start(0);
                }
            }
        };
    };
});
