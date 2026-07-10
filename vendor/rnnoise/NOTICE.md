# Local AI Denoise attribution

`rnnoise-sync.js` is the prebuilt RNNoise WebAssembly bundle from
<https://github.com/jitsi/rnnoise-wasm>, licensed under Apache-2.0.

The underlying RNNoise neural noise-suppression library is from Xiph.Org and
is licensed under BSD-3-Clause: <https://github.com/xiph/rnnoise>.

`ai-denoise-worklet.js` is this project's adapter for running the bundle in a
browser AudioWorklet. Audio is processed locally; it is not uploaded.
