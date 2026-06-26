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
    });

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
        
        // Disconnect video chain from speakers and route into export destination
        compressorNode.disconnect(audioCtx.destination);
        compressorNode.connect(dest);
        
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
                try { compressorNode.disconnect(dest); } catch(e) {}
                compressorNode.connect(audioCtx.destination);
                
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
                        voiceoverSource.connect(voiceoverGain);
                        
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
