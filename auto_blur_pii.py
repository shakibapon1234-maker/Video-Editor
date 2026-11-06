#!/usr/bin/env python3
"""
Auto-Blur Sensitive Info (YouTube Policy Protection) Engine
Detects:
 - Emails
 - Phone Numbers (Bangladeshi + International)
 - Dates of Birth (DOB)
 - Passports & NID / National ID Numbers
 - URLs / Web Links / IP Addresses
 - Custom user words, agency codes, or URLs

Performs optical character recognition (OCR) and vertical scroll / motion tracking,
returning blur regions compatible with Studio Flow Video Editor.
"""

import sys
import os
import re
import json
import argparse
import time

# Guarantee UTF-8 output on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

import cv2
import numpy as np

# Regular Expression Patterns for YouTube Policy Sensitive Data
REGEX_PATTERNS = {
    'email': re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', re.IGNORECASE),
    'phone': re.compile(
        r'(?:\+?880\s?1[3-9]\d{8}|01[3-9]\d{8}|\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b|\b\d{3,4}[-.\s]\d{3,4}[-.\s]\d{3,4}\b)'
    ),
    'dob': re.compile(
        r'(?:\b(?:DOB|D\.O\.B|Birth|Date of Birth)[\s:]*([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4}|[0-9]{1,2}\s+[A-Za-z]{3,}\s+[0-9]{2,4})\b|'
        r'\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|'
        r'\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4}\b|'
        r'\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{2,4}\b)',
        re.IGNORECASE
    ),
    'id': re.compile(
        r'(?:\b[A-Z][0-9]{7,9}\b|'  # Standard international passport format
        r'\b(?:\d{10}|\d{13}|\d{17})\b|'  # NID (10, 13, 17 digits)
        r'\b(?:NID|Passport|Pass|ID|National ID)[\s:]*([A-Za-z0-9-]+)\b)',
        re.IGNORECASE
    ),
    'url': re.compile(
        r'(?:https?://[^\s]+|www\.[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|'
        r'\b[a-zA-Z0-9.-]+\.(?:com|org|net|edu|gov|io|ai|bd|me)\b|'
        r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b)',
        re.IGNORECASE
    )
}

def clean_ocr_text(text):
    if not text:
        return ''
    return text.strip()

def match_sensitive_categories(text, categories, custom_words):
    matched_categories = []
    text_clean = clean_ocr_text(text)
    if not text_clean or len(text_clean) < 3:
        return matched_categories

    # Check standard categories
    for cat in ['email', 'phone', 'dob', 'id', 'url']:
        if categories.get(cat, True):
            pattern = REGEX_PATTERNS.get(cat)
            if pattern and pattern.search(text_clean):
                matched_categories.append(cat)

    # Check custom user keywords
    if custom_words:
        lower_text = text_clean.lower()
        for word in custom_words:
            w = word.strip().lower()
            if w and len(w) >= 2 and w in lower_text:
                matched_categories.append(f'custom: {word.strip()}')

    return matched_categories

def detect_pii_in_video(video_path, categories, custom_words, intensity=25, sample_rate=1.0, progress_cb=None):
    if not os.path.exists(video_path):
        raise FileNotFoundError(f"Video file not found: {video_path}")

    import easyocr
    reader = easyocr.Reader(['en'], gpu=True if cv2.cuda.getCudaEnabledDeviceCount() > 0 else False, verbose=False)

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Could not open video file: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    video_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    video_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_duration = total_frames / fps

    step_frames = max(1, int(fps * sample_rate))

    raw_detections = []  # List of { time, x, y, w, h, text, cats }

    sample_indices = list(range(0, total_frames, step_frames))
    total_samples = len(sample_indices)

    for idx, f_idx in enumerate(sample_indices):
        cap.set(cv2.CAP_PROP_POS_FRAMES, f_idx)
        ret, frame = cap.read()
        if not ret:
            break

        time_sec = f_idx / fps
        pct = int((idx / max(1, total_samples)) * 85)
        if progress_cb:
            progress_cb(pct, f"স্ক্যান হচ্ছে: {time_sec:.1f}s / {total_duration:.1f}s")

        # Run OCR on frame
        try:
            results = reader.readtext(frame, detail=1, paragraph=False)
        except Exception:
            results = []

        for item in results:
            bbox, text, prob = item
            if prob < 0.25:
                continue

            matched = match_sensitive_categories(text, categories, custom_words)
            if matched:
                xs = [pt[0] for pt in bbox]
                ys = [pt[1] for pt in bbox]
                x1, x2 = max(0, min(xs)), min(video_w, max(xs))
                y1, y2 = max(0, min(ys)), min(video_h, max(ys))

                # Add padding to fully obscure
                pad_x = max(6, int((x2 - x1) * 0.08))
                pad_y = max(4, int((y2 - y1) * 0.15))
                x1 = max(0, x1 - pad_x)
                y1 = max(0, y1 - pad_y)
                x2 = min(video_w, x2 + pad_x)
                y2 = min(video_h, y2 + pad_y)

                w = x2 - x1
                h = y2 - y1

                if w > 8 and h > 5:
                    norm_x = x1 / video_w
                    norm_y = y1 / video_h
                    norm_w = w / video_w
                    norm_h = h / video_h

                    raw_detections.append({
                        'time': time_sec,
                        'x': norm_x,
                        'y': norm_y,
                        'w': norm_w,
                        'h': norm_h,
                        'text': text,
                        'cats': matched
                    })

    cap.release()

    if progress_cb:
        progress_cb(90, "ব্লার রিজিয়ন এবং টাইমলাইন সমন্বয় হচ্ছে...")

    blur_regions = cluster_detections_into_regions(raw_detections, sample_rate, total_duration, intensity)

    if progress_cb:
        progress_cb(100, f"সম্পন্ন! {len(blur_regions)}টি সংবেদনশীল এলাকা ব্লার করা হয়েছে।")

    return blur_regions

def cluster_detections_into_regions(detections, sample_rate, total_duration, intensity):
    if not detections:
        return []

    detections.sort(key=lambda d: (d['time'], d['y'], d['x']))
    clusters = []

    for d in detections:
        placed = False
        for c in clusters:
            last = c['detections'][-1]
            time_gap = d['time'] - last['time']
            if 0 <= time_gap <= (sample_rate * 2.5):
                x_dist = abs(d['x'] - last['x'])
                y_dist = abs(d['y'] - last['y'])

                # Text is in same column (horizontal distance < 0.12) and reasonable vertical shift
                if x_dist < 0.12 and y_dist < 0.35:
                    c['detections'].append(d)
                    c['endSec'] = min(total_duration, d['time'] + sample_rate * 1.5)
                    c['cats'].update(d['cats'])
                    c['x'] = min(c['x'], d['x'])
                    c['y'] = min(c['y'], d['y'])
                    c['w'] = max(c['w'], d['w'], (d['x'] + d['w']) - c['x'])
                    c['h'] = max(c['h'], d['h'], (d['y'] + d['h']) - c['y'])
                    placed = True
                    break

        if not placed:
            clusters.append({
                'id': int(time.time() * 1000) + len(clusters),
                'x': d['x'],
                'y': d['y'],
                'w': d['w'],
                'h': d['h'],
                'intensity': intensity,
                'startSec': max(0.0, round(d['time'] - sample_rate * 0.5, 2)),
                'endSec': min(total_duration, round(d['time'] + sample_rate * 1.5, 2)),
                'cats': set(d['cats']),
                'detections': [d]
            })

    result = []
    for c in clusters:
        cat_labels = ", ".join(sorted(list(c['cats'])))
        result.append({
            'id': c['id'],
            'x': round(c['x'], 4),
            'y': round(c['y'], 4),
            'w': round(min(1.0 - c['x'], c['w']), 4),
            'h': round(min(1.0 - c['y'], c['h']), 4),
            'intensity': c['intensity'],
            'startSec': round(c['startSec'], 1),
            'endSec': round(c['endSec'], 1),
            'label': f"🛡️ {cat_labels}"
        })

    return result

def main():
    parser = argparse.ArgumentParser(description="Auto-Blur YouTube Policy Sensitive Information")
    parser.add_argument("--video", required=True, help="Path to input video")
    parser.add_argument("--output-json", default="", help="Path to output JSON")
    parser.add_argument("--categories", default="email,phone,dob,id,url", help="Comma separated categories")
    parser.add_argument("--custom-words", default="", help="Comma separated custom words to blur")
    parser.add_argument("--intensity", type=int, default=28, help="Blur intensity")
    parser.add_argument("--sample-rate", type=float, default=1.0, help="Seconds between scanned frames")

    args = parser.parse_args()

    enabled_cats = [c.strip().lower() for c in args.categories.split(",") if c.strip()]
    categories = {
        'email': 'email' in enabled_cats,
        'phone': 'phone' in enabled_cats,
        'dob': 'dob' in enabled_cats,
        'id': 'id' in enabled_cats,
        'url': 'url' in enabled_cats
    }

    custom_words = [w.strip() for w in args.custom_words.split(",") if w.strip()]

    def progress_callback(pct, message):
        print(json.dumps({"progress": pct, "message": message}, ensure_ascii=False), flush=True)

    try:
        regions = detect_pii_in_video(
            video_path=args.video,
            categories=categories,
            custom_words=custom_words,
            intensity=args.intensity,
            sample_rate=args.sample_rate,
            progress_cb=progress_callback
        )

        output_data = {
            "status": "success",
            "count": len(regions),
            "regions": regions
        }

        if args.output_json:
            with open(args.output_json, "w", encoding="utf-8") as f:
                json.dump(output_data, f, ensure_ascii=False, indent=2)

        print("###RESULT_START###")
        print(json.dumps(output_data, ensure_ascii=False))
        print("###RESULT_END###", flush=True)

    except Exception as e:
        err = {"status": "error", "error": str(e)}
        print("###RESULT_START###")
        print(json.dumps(err, ensure_ascii=False))
        print("###RESULT_END###", flush=True)
        sys.exit(1)

if __name__ == "__main__":
    main()
