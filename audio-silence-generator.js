/* ==========================================================================
   Audio Silence & Pause Manager (Audio Section Utility Module)
   ========================================================================== */

(function (window) {
    'use strict';

    const AudioPauseManager = {
        /**
         * Create an AudioBuffer of pure silence for a given duration in seconds.
         * @param {number} durationSeconds - Duration of silence in seconds
         * @param {number} [sampleRate=44100] - Sample rate (Hz)
         * @returns {AudioBuffer}
         */
        createSilenceBuffer(durationSeconds, sampleRate = 44100) {
            const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate });
            const length = Math.ceil(durationSeconds * sampleRate);
            return ctx.createBuffer(1, Math.max(1, length), sampleRate);
        },

        /**
         * Split an existing AudioBuffer at a timestamp and insert silent pause duration.
         * @param {AudioBuffer} originalBuffer 
         * @param {number} insertTimeSeconds - Timestamp where pause should be inserted
         * @param {number} pauseDurationSeconds - Duration of the silence/pause
         * @returns {AudioBuffer} New combined AudioBuffer with silence inserted
         */
        insertPauseIntoBuffer(originalBuffer, insertTimeSeconds, pauseDurationSeconds) {
            const sampleRate = originalBuffer.sampleRate;
            const numberOfChannels = originalBuffer.numberOfChannels;
            
            const insertFrame = Math.floor(Math.min(insertTimeSeconds, originalBuffer.duration) * sampleRate);
            const pauseFrames = Math.floor(pauseDurationSeconds * sampleRate);
            const totalFrames = originalBuffer.length + pauseFrames;

            const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate });
            const newBuffer = ctx.createBuffer(numberOfChannels, totalFrames, sampleRate);

            for (let channel = 0; channel < numberOfChannels; channel++) {
                const origData = originalBuffer.getChannelData(channel);
                const newData = newBuffer.getChannelData(channel);

                // Copy audio before insertion point
                newData.set(origData.subarray(0, insertFrame), 0);

                // Silent gap is automatically 0s in TypedArray allocation

                // Copy audio after insertion point
                newData.set(origData.subarray(insertFrame), insertFrame + pauseFrames);
            }

            return newBuffer;
        },

        /**
         * Export silence of specific duration as a downloadable WAV Blob.
         * @param {number} durationSeconds 
         * @param {number} [sampleRate=44100] 
         * @returns {Blob} WAV file blob
         */
        generateSilenceWavBlob(durationSeconds, sampleRate = 44100) {
            const numChannels = 1;
            const numSamples = Math.floor(durationSeconds * sampleRate);
            const buffer = new ArrayBuffer(44 + numSamples * 2);
            const view = new DataView(buffer);

            // RIFF header
            writeString(view, 0, 'RIFF');
            view.setUint32(4, 36 + numSamples * 2, true);
            writeString(view, 8, 'WAVE');

            // FMT subchunk
            writeString(view, 12, 'fmt ');
            view.setUint32(16, 16, true); // Subchunk1Size
            view.setUint16(20, 1, true);  // AudioFormat PCM
            view.setUint16(22, numChannels, true);
            view.setUint32(24, sampleRate, true);
            view.setUint32(28, sampleRate * numChannels * 2, true);
            view.setUint16(32, numChannels * 2, true);
            view.setUint16(34, 16, true); // BitsPerSample

            // DATA subchunk
            writeString(view, 36, 'data');
            view.setUint32(40, numSamples * 2, true);

            // PCM silence samples remain 0

            return new Blob([buffer], { type: 'audio/wav' });
        }
    };

    function writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    // Attach to global window object under VideoEditor or standalone
    window.AudioPauseManager = AudioPauseManager;

})(window);
