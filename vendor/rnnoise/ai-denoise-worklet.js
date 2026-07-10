// Local AI denoise AudioWorklet. RNNoise processes 480-sample (10 ms at 48 kHz)
// mono PCM frames; this adapter buffers the browser's smaller render quanta and
// runs an independent neural state for each of up to two channels.
import createRNNWasmModuleSync from './rnnoise-sync.js';

const RNNOISE_FRAME_SIZE = 480;
const PCM_SCALE = 32768;

class AIDenoiseProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.rnnoise = createRNNWasmModuleSync();
        this.channelStates = [];
        this.inputFrames = [];
        this.outputFrames = [];
        this.outputOffsets = [];
        this.ready = false;

        try {
            for (let channel = 0; channel < 2; channel++) {
                const state = this.rnnoise._rnnoise_create(0);
                const inputPtr = this.rnnoise._malloc(RNNOISE_FRAME_SIZE * Float32Array.BYTES_PER_ELEMENT);
                const outputPtr = this.rnnoise._malloc(RNNOISE_FRAME_SIZE * Float32Array.BYTES_PER_ELEMENT);
                if (!state || !inputPtr || !outputPtr) throw new Error('RNNoise memory allocation failed');
                this.channelStates.push({ state, inputPtr, outputPtr, writeOffset: 0 });
                this.inputFrames.push(new Float32Array(RNNOISE_FRAME_SIZE));
                this.outputFrames.push([]);
                this.outputOffsets.push(0);
            }
            this.ready = true;
            this.port.postMessage({ type: 'ready' });
        } catch (error) {
            this.port.postMessage({ type: 'error', message: error.message || String(error) });
        }
    }

    process(inputs, outputs) {
        const inputChannels = inputs[0] || [];
        const outputChannels = outputs[0] || [];
        if (!this.ready) {
            outputChannels.forEach(channel => channel.fill(0));
            return true;
        }

        for (let channel = 0; channel < outputChannels.length; channel++) {
            const output = outputChannels[channel];
            const input = inputChannels[Math.min(channel, inputChannels.length - 1)];
            const stateIndex = Math.min(channel, this.channelStates.length - 1);
            const channelState = this.channelStates[stateIndex];
            const frame = this.inputFrames[stateIndex];

            for (let sample = 0; sample < output.length; sample++) {
                frame[channelState.writeOffset++] = input ? input[sample] * PCM_SCALE : 0;
                if (channelState.writeOffset === RNNOISE_FRAME_SIZE) {
                    this.rnnoise.HEAPF32.set(frame, channelState.inputPtr >> 2);
                    this.rnnoise._rnnoise_process_frame(channelState.state, channelState.outputPtr, channelState.inputPtr);
                    const processed = this.rnnoise.HEAPF32.subarray(
                        channelState.outputPtr >> 2,
                        (channelState.outputPtr >> 2) + RNNOISE_FRAME_SIZE
                    );
                    const queue = this.outputFrames[stateIndex];
                    for (let i = 0; i < processed.length; i++) queue.push(processed[i] / PCM_SCALE);
                    channelState.writeOffset = 0;
                }

                const queue = this.outputFrames[stateIndex];
                output[sample] = queue.length ? queue.shift() : 0;
            }
        }
        return true;
    }
}

registerProcessor('ai-denoise-processor', AIDenoiseProcessor);
