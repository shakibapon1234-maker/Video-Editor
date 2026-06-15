# Studio Flow — Facebook & Reels Video Editor
## AI Context File — Project Plan & Status Tracker

> **এই ফাইলটি AI-এর জন্য।** যখনই এই প্রজেক্টে কাজ করতে হবে, এই ফাইলটি আগে পড়বে যাতে প্রজেক্টের সম্পূর্ণ অবস্থা বোঝা যায়।

---

## প্রজেক্ট পরিচিতি

**নাম:** Studio Flow — Facebook & Reels Video Editor  
**উদ্দেশ্য:** Facebook পেজে পোস্ট করার জন্য ভিডিও এডিট করা  
**টেকনোলজি:** Pure HTML + CSS + JavaScript (কোনো framework/server নেই, সম্পূর্ণ browser-based)  
**ফাইল স্ট্রাকচার:**
```
Video-Editor/
├── index.html        — মূল UI (4-step wizard)
├── editor.js         — Canvas rendering, trim, logo, filters
├── audio.js          — Web Audio API, noise cancel, voiceover recording
├── exporter.js       — MediaRecorder-based video export
├── style.css         — সম্পূর্ণ UI styling
└── PROJECT_PLAN.md   — এই ফাইল (AI context)
```

---

## বর্তমান ফিচার (যা আছে ✅)

| ফিচার | ফাইল | অবস্থা |
|---|---|---|
| ভিডিও আপলোড (drag & drop) | editor.js | ✅ কাজ করে |
| Aspect Ratio selector (1:1, 4:5, 9:16, 16:9) | editor.js | ✅ কাজ করে |
| Video Trim (start/end slider) | editor.js | ✅ কাজ করে |
| Logo Watermark (drag + resize on canvas) | editor.js | ✅ কাজ করে |
| Noise Cancellation (Web Audio bandpass filter) | audio.js | ✅ কাজ করে |
| Noise Gate Threshold slider | audio.js | ✅ কাজ করে |
| Voiceover Recording (mic sync with video) | audio.js | ✅ কাজ করে |
| Facebook Banner/Headline overlay (top/bottom) | editor.js | ✅ কাজ করে |
| Visual Progress Bar overlay | editor.js | ✅ কাজ করে |
| Cinematic Filters (Warm, Cool, Vintage, B&W) | editor.js | ✅ কাজ করে |
| Brightness/Contrast/Saturation sliders | editor.js | ✅ কাজ করে |
| Fit vs Fill layout mode | editor.js | ✅ কাজ করে |
| Video Export (MediaRecorder → WebM/MP4) | exporter.js | ✅ কাজ করে |
| 4-Step Wizard navigation | editor.js | ✅ কাজ করে |
| Mobile Responsive layout | style.css | ✅ ঠিক করা হয়েছে |

---

## Bug Fix ইতিহাস

### v1.1 — Bug Fixes (সম্পন্ন)

**Bug 1 — Export Audio Sync (exporter.js + audio.js)**
- **সমস্যা:** `startVoiceover()` video.play()-এর আগে call হচ্ছিল, ফলে voiceover ও video-র মধ্যে timing মিলছিল না।
- **সমাধান:** `video.play()` await করার পর `startVoiceover()` call করা হয়েছে। `getMixedAudioDestinationStream()` ফাংশনে voiceoverGain properly connected করা হয়েছে। Cleanup-এ `canvasStream.removeTrack()` যোগ করা হয়েছে।

**Bug 2 — Canvas Freeze When Paused (editor.js)**
- **সমস্যা:** Video pause করলে canvas-এ কোনো frame update হচ্ছিল না, trim slider টানলে canvas freeze থাকত।
- **সমাধান:** `video.addEventListener('seeked')` event যোগ করা হয়েছে যেটা pause অবস্থায়ও canvas redraw করে। `window.redrawPausedFrame()` global function তৈরি করা হয়েছে।

**Bug 3 — Mobile Layout Break (style.css + editor.js)**
- **সমস্যা:** Mobile-এ sidebar ও workspace overlap করছিল, canvas container height ভুল।
- **সমাধান:** `@media` queries যোগ করা হয়েছে (860px, 520px breakpoints)। Mobile-এ sidebar horizontal হয়, workspace single-column-এ আসে। `offsetWidth` দিয়ে canvas height calculation ঠিক করা হয়েছে।

---

## পরবর্তী কাজের পূর্ণ পরিকল্পনা

### Phase 2 — Video Editing Core (পরবর্তী প্রায়োরিটি)

#### 2A — Visual Crop Tool 🔲
**কী করতে হবে:**
- `editor.js`-এ cropState যোগ করতে হবে: `{ x: 0, y: 0, w: 1, h: 1 }` (normalized 0–1)
- Canvas-এ step 2-এর সময় drag করে crop region select করার UI তৈরি করতে হবে
- `drawFrame()` ফাংশনে `ctx.drawImage(video, srcX, srcY, srcW, srcH, destX, destY, destW, destH)` দিয়ে crop region render করতে হবে
- Reset crop button যোগ করতে হবে
- **HTML:** Step 2 panel-এ "Crop" card যোগ করতে হবে

#### 2B — Multi-Clip Timeline 🔲
**কী করতে হবে:**
- `state.clips[]` array তৈরি করতে হবে প্রতিটি clip-এর জন্য `{ file, url, start, end, duration }`
- Timeline UI-তে multiple clip block দেখাতে হবে (drag to reorder)
- Export pipeline-এ clips sequential play করতে হবে
- **জটিলতা:** HIGH — বড় refactor দরকার

#### 2C — Text Overlay (উন্নত) 🔲
**কী করতে হবে:**
- `state.textOverlays[]` array তৈরি করতে হবে
- প্রতিটি text overlay-এর জন্য: `{ text, x, y, fontSize, color, font, startSec, endSec }`
- Canvas-এ drag করে text position করার সুবিধা
- বাংলা font support (Hind Siliguri already loaded)
- `drawFrame()` ফাংশনে text overlay render করতে হবে

---

### Phase 3 — Audio উন্নতি

#### 3A — Background Music 🔲
**কী করতে হবে:**
- `index.html`-এ Step 3 panel-এ "Background Music" card যোগ করতে হবে
- MP3/WAV file input যোগ করতে হবে
- `audio.js`-এ bgMusicBuffer, bgMusicGain node তৈরি করতে হবে
- `getMixedAudioDestinationStream()` ফাংশনে bgMusicGain connect করতে হবে
- Preview playback-এ also bgMusic sync করতে হবে

#### 3B — Audio Ducking 🔲
**কী করতে হবে:**
- `audio.js`-এ voiceover চলার সময় bgMusicGain automatically কমানোর logic যোগ করতে হবে
- Toggle checkbox দিয়ে enable/disable করা

---

### Phase 4 — Visual Effects

#### 4A — Sticker/Emoji Overlay 🔲
**কী করতে হবে:**
- `state.stickers[]` array
- Emoji picker UI (HTML entity list)
- Canvas drag & resize (same system as logo)
- `drawFrame()`-এ sticker render

#### 4B — Blur/Mosaic Tool 🔲
**কী করতে হবে:**
- `state.blurRegions[]` array — `{ x, y, w, h }` (normalized)
- Canvas selection দিয়ে blur region আঁকা
- `drawFrame()`-এ: region clip → `ctx.filter = 'blur(10px)'` → drawImage → restore

#### 4C — Color Grading (LUT) 🔲
**বর্তমানে:** CSS filter দিয়ে preset আছে (Warm, Cool, Vintage)
**উন্নতি করতে হবে:**
- Custom per-channel curve adjustment (RGB curves)
- অথবা predefined LUT JSON apply করা pixel-level-এ (OffscreenCanvas)

---

### Phase 5 — Facebook/Social Media Specific

#### 5A — Auto Subtitle 🔲
**কী করতে হবে:**
- Web Speech API (`SpeechRecognition`) দিয়ে video audio থেকে transcript নেওয়া
- `state.subtitles[]` array — `{ text, startSec, endSec }`
- `drawFrame()`-এ current time অনুযায়ী subtitle render করা
- **সীমাবদ্ধতা:** Web Speech API শুধু live audio-তে কাজ করে, recorded video-তে করে না। Workaround: video play করতে করতে speech recognition চালানো।

#### 5B — Thumbnail Generator 🔲
**কী করতে হবে:**
- Step 4-এ "Generate Thumbnail" button
- Current canvas frame → `canvas.toBlob()` → PNG download
- Custom text/logo overlay যোগ করার option

#### 5C — Intro/Outro Template 🔲
**কী করতে হবে:**
- কয়েকটি pre-built template (JSON-based) যেগুলো canvas-এ animate করবে
- setTimeout/requestAnimationFrame দিয়ে 2-3 second intro animate করা

---

### Phase 6 — Export উন্নতি

#### 6A — Quality Selector 🔲
**কী করতে হবে:**
- `index.html` Step 4-এ resolution dropdown (480p / 720p / 1080p)
- `exporter.js`-এ: export শুরুর আগে canvas.width/height resize করা
- `videoBitsPerSecond` quality অনুযায়ী change করা (480p: 2Mbps, 720p: 5Mbps, 1080p: 8Mbps)

#### 6B — Export Progress UX 🔲
**কী করতে হবে:**
- Real-time estimated time remaining দেখানো
- Cancel button যোগ করা (recorder.stop() + cleanup)

---

## কোড Architecture নোট

### state object (editor.js-এ `window.VideoEditor`)
নতুন ফিচার যোগ করতে এখানে নতুন property যোগ করতে হবে। উদাহরণ:
```javascript
window.VideoEditor = {
  // existing...
  cropX: 0, cropY: 0, cropW: 1, cropH: 1,  // Phase 2A
  textOverlays: [],                           // Phase 2C
  bgMusicBlob: null, bgMusicVolume: 0.5,     // Phase 3A
  stickers: [],                              // Phase 4A
  blurRegions: [],                           // Phase 4B
}
```

### drawFrame() ফাংশন (editor.js)
সব visual rendering এখানে হয়। নতুন visual element যোগ করতে এই function-এর শেষে নতুন block যোগ করতে হবে। বর্তমান render order:
1. Background fill (black)
2. Video frame (with filters)
3. Facebook banners (top/bottom)
4. Logo watermark
5. Progress bar
6. *[এখানে নতুন overlays যোগ করতে হবে]*

### getMixedAudioDestinationStream() (audio.js)
Export-এ audio mixing এখানে হয়। নতুন audio track (bg music) যোগ করতে এই function-এ নতুন gain node তৈরি করে `dest`-এ connect করতে হবে।

---

## কাজের অগ্রাধিকার (Priority Order)

```
1. ✅ Bug Fix v1.1 (সম্পন্ন)
2. 🔲 Phase 2A — Crop Tool
3. 🔲 Phase 3A — Background Music  
4. 🔲 Phase 2C — Text Overlay
5. 🔲 Phase 5B — Thumbnail Generator
6. 🔲 Phase 6A — Quality Selector
7. 🔲 Phase 4B — Blur Tool
8. 🔲 Phase 5A — Auto Subtitle
9. 🔲 Phase 2B — Multi-Clip (সবচেয়ে জটিল, শেষে)
```

---

## এই ফাইল আপডেট করার নিয়ম

যখনই কোনো Phase সম্পন্ন হবে:
- `🔲` → `✅` করতে হবে
- Bug Fix section-এ নতুন entry যোগ করতে হবে
- বর্তমান ফিচার টেবিলে নতুন row যোগ করতে হবে

---
*শেষ আপডেট: v1.1 — Bug Fix Release*
