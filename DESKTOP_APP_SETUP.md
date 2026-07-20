# Studio Flow — Desktop App (Electron) Setup

## Run locally

```sh
npm install
npm run electron
```

## Build a Windows installer

```sh
npm run dist
```

The installer is written to `dist/`. When packaged, exports, temporary render files, and the FFmpeg error log are stored in Electron's per-user data directory instead of the read-only installation folder.
