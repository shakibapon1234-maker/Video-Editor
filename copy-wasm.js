// Copies the ffmpeg.wasm packages out of node_modules into ./public/ffmpeg
// so the Android app can load them locally (no CDN, works offline, and avoids
// the COOP/COEP Cross-Origin header requirement that breaks SharedArrayBuffer
// inside the Capacitor Android WebView). Runs automatically via "postinstall".
const fs = require('fs');
const path = require('path');

const root = __dirname;
const outDir = path.join(root, 'public', 'ffmpeg');
const capDir = path.join(root, 'public', 'capacitor');

function copyFileOrDir(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyFileOrDir(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function copyFromPackage(pkgRelPath, outRelPath, destRoot) {
  const src = path.join(root, 'node_modules', pkgRelPath);
  if (!fs.existsSync(src)) {
    console.warn('[copy-wasm] skip (not found):', pkgRelPath);
    return;
  }
  const dest = path.join(destRoot, outRelPath);
  copyFileOrDir(src, dest);
  console.log('[copy-wasm] copied', pkgRelPath);
}

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(capDir, { recursive: true });

// Core wasm bundle (ffmpeg-core.js + ffmpeg-core.wasm)
copyFromPackage('@ffmpeg/core/dist/esm', 'core', outDir);

// ESM API + util so we can import them locally instead of from a CDN
copyFromPackage('@ffmpeg/ffmpeg/dist/esm', 'api', outDir);
copyFromPackage('@ffmpeg/util/dist/esm', 'util', outDir);

// Capacitor core UMD loader so `window.Capacitor` is defined on plain browsers
// too (inside the native WebView the bridge is injected automatically, but the
// dev-server / fallback path needs this script tag to no-op safely).
copyFromPackage('@capacitor/core/dist/capacitor.js', 'capacitor.js', capDir);

console.log('[copy-wasm] done');
