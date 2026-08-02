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
            view.setUint32(16, 16, true);
            view.setUint16(20, 1, true);  // PCM
            view.setUint16(22, numChannels, true);
            view.setUint32(24, sampleRate, true);
            view.setUint32(28, sampleRate * numChannels * 2, true);
            view.setUint16(32, numChannels * 2, true);
            view.setUint16(34, 16, true);

            // DATA subchunk
            writeString(view, 36, 'data');
            view.setUint32(40, numSamples * 2, true);

            return new Blob([buffer], { type: 'audio/wav' });
        },

        /**
         * Convert any AudioBuffer into a 16-bit PCM WAV Blob.
         * @param {AudioBuffer} audioBuffer 
         * @returns {Blob} WAV file blob
         */
        audioBufferToWavBlob(audioBuffer) {
            const numChannels = audioBuffer.numberOfChannels;
            const sampleRate = audioBuffer.sampleRate;
            const format = 1; // PCM
            const bitDepth = 16;
            
            let result;
            if (numChannels === 2) {
                const left = audioBuffer.getChannelData(0);
                const right = audioBuffer.getChannelData(1);
                result = interleave(left, right);
            } else {
                result = audioBuffer.getChannelData(0);
            }

            return encodeWAV(result, numChannels, sampleRate, bitDepth);
        }
    };

    function interleave(inputL, inputR) {
        const length = inputL.length + inputR.length;
        const result = new Float32Array(length);

        let index = 0;
        let inputIndex = 0;

        while (index < length) {
            result[index++] = inputL[inputIndex];
            result[index++] = inputR[inputIndex];
            inputIndex++;
        }
        return result;
    }

    function encodeWAV(samples, numChannels, sampleRate, bitDepth) {
        const bytesPerSample = bitDepth / 8;
        const blockAlign = numChannels * bytesPerSample;
        const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
        const view = new DataView(buffer);

        /* RIFF identifier */
        writeString(view, 0, 'RIFF');
        /* RIFF chunk length */
        view.setUint32(4, 36 + samples.length * bytesPerSample, true);
        /* RIFF type */
        writeString(view, 8, 'WAVE');
        /* format chunk identifier */
        writeString(view, 12, 'fmt ');
        /* format chunk length */
        view.setUint32(16, 16, true);
        /* sample format (raw) */
        view.setUint16(20, 1, true);
        /* channel count */
        view.setUint16(22, numChannels, true);
        /* sample rate */
        view.setUint32(24, sampleRate, true);
        /* byte rate (sample rate * block align) */
        view.setUint32(28, sampleRate * blockAlign, true);
        /* block align */
        view.setUint16(32, blockAlign, true);
        /* bits per sample */
        view.setUint16(34, bitDepth, true);
        /* data chunk identifier */
        writeString(view, 36, 'data');
        /* data chunk length */
        view.setUint32(40, samples.length * bytesPerSample, true);

        floatTo16BitPCM(view, 44, samples);

        return new Blob([buffer], { type: 'audio/wav' });
    }

    function floatTo16BitPCM(output, offset, input) {
        for (let i = 0; i < input.length; i++, offset += 2) {
            const s = Math.max(-1, Math.min(1, input[i]));
            output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
    }

    function writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    window.AudioPauseManager = AudioPauseManager;

})(window);
