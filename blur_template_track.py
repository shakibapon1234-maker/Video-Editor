#!/usr/bin/env python3
"""
Studio Flow — Blur Template Tracker
====================================
Given a reference template image (cropped from a blur box in the editor)
and a video file, this script tracks where that template appears in every
frame and outputs JSON keyframe positions for the blur region.

Usage (called from server.js):
  python blur_template_track.py
    --video  <path to video>
    --template <path to template PNG>
    --region-x <pixel x of original blur box>
    --region-y <pixel y of original blur box>
    --region-w <pixel w of blur box>
    --region-h <pixel h of blur box>
    --start-sec <float>
    --end-sec   <float>
    --search-margin <pixels to search around original position, default 400>
    --sample-rate <seconds between sampled frames, default 0.25>

Output: JSON on stdout
  { "status": "success", "keyframes": [{"t": 0.0, "x": 120, "y": 340}, ...] }
  Progress lines: {"progress": 50, "message": "..."} (interleaved)
"""

import sys
import os
import json
import argparse
import time

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

import cv2
import numpy as np


def emit_progress(pct, msg):
    print(json.dumps({"progress": pct, "message": msg}, ensure_ascii=False), flush=True)


def track_template(
    video_path,
    template_path,
    orig_x, orig_y,
    region_w, region_h,
    start_sec, end_sec,
    search_margin=400,
    sample_rate=0.25,
):
    if not os.path.exists(video_path):
        raise FileNotFoundError(f"Video not found: {video_path}")
    if not os.path.exists(template_path):
        raise FileNotFoundError(f"Template not found: {template_path}")

    template = cv2.imread(template_path)
    if template is None:
        raise ValueError("Could not load template image.")

    tmpl_h, tmpl_w = template.shape[:2]

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    vid_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    vid_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_dur = total_frames / fps

    # Clamp time range
    s_frame = max(0, int(start_sec * fps))
    e_frame = min(total_frames - 1, int(end_sec * fps))
    step = max(1, int(fps * sample_rate))
    sample_indices = list(range(s_frame, e_frame + 1, step))
    total_samples = len(sample_indices)

    keyframes = []
    last_good_x = orig_x
    last_good_y = orig_y
    last_confidence = 0.0

    for idx, fi in enumerate(sample_indices):
        cap.set(cv2.CAP_PROP_POS_FRAMES, fi)
        ret, frame = cap.read()
        if not ret:
            break

        t = fi / fps
        pct = int((idx / max(1, total_samples)) * 90)
        emit_progress(pct, f"ট্র্যাকিং: {t:.1f}s / {min(end_sec, total_dur):.1f}s")

        # Search window around last known position
        sx = max(0, last_good_x - search_margin)
        sy = max(0, last_good_y - search_margin)
        ex = min(vid_w, last_good_x + region_w + search_margin)
        ey = min(vid_h, last_good_y + region_h + search_margin)

        roi = frame[sy:ey, sx:ex]
        if roi.shape[0] < tmpl_h or roi.shape[1] < tmpl_w:
            # ROI too small — keep last position
            keyframes.append({"t": round(t, 3), "x": last_good_x, "y": last_good_y})
            continue

        result = cv2.matchTemplate(roi, template, cv2.TM_CCOEFF_NORMED)
        _, max_val, _, max_loc = cv2.minMaxLoc(result)

        if max_val >= 0.35:
            # Found a match — convert back to full-frame coordinates
            found_x = sx + max_loc[0]
            found_y = sy + max_loc[1]
            last_good_x = found_x
            last_good_y = found_y
            last_confidence = max_val
        else:
            # No good match — keep last known position (don't wander)
            found_x = last_good_x
            found_y = last_good_y

        keyframes.append({"t": round(t, 3), "x": found_x, "y": found_y})

    cap.release()

    # --- Simplify: remove keyframes where position didn't change much (< 2px) ---
    simplified = []
    for kf in keyframes:
        if not simplified:
            simplified.append(kf)
            continue
        last = simplified[-1]
        if abs(kf["x"] - last["x"]) >= 2 or abs(kf["y"] - last["y"]) >= 2:
            simplified.append(kf)
        else:
            # Update time of last to extend it
            last["t"] = kf["t"]

    # Always keep first and last
    if keyframes and simplified:
        if simplified[0]["t"] != keyframes[0]["t"]:
            simplified.insert(0, keyframes[0])
        if simplified[-1]["t"] != keyframes[-1]["t"]:
            simplified.append(keyframes[-1])

    emit_progress(100, f"সম্পন্ন! {len(simplified)}টি ট্র্যাকিং পয়েন্ট পাওয়া গেছে।")
    return simplified


def main():
    parser = argparse.ArgumentParser(description="Blur Template Tracker")
    parser.add_argument("--video", required=True)
    parser.add_argument("--template", required=True)
    parser.add_argument("--region-x", type=int, default=0)
    parser.add_argument("--region-y", type=int, default=0)
    parser.add_argument("--region-w", type=int, default=100)
    parser.add_argument("--region-h", type=int, default=50)
    parser.add_argument("--start-sec", type=float, default=0.0)
    parser.add_argument("--end-sec", type=float, default=99999.0)
    parser.add_argument("--search-margin", type=int, default=400)
    parser.add_argument("--sample-rate", type=float, default=0.25)
    args = parser.parse_args()

    try:
        kfs = track_template(
            video_path=args.video,
            template_path=args.template,
            orig_x=args.region_x,
            orig_y=args.region_y,
            region_w=args.region_w,
            region_h=args.region_h,
            start_sec=args.start_sec,
            end_sec=args.end_sec,
            search_margin=args.search_margin,
            sample_rate=args.sample_rate,
        )
        result = {"status": "success", "count": len(kfs), "keyframes": kfs}
    except Exception as e:
        result = {"status": "error", "error": str(e)}

    print("###RESULT_START###")
    print(json.dumps(result, ensure_ascii=False))
    print("###RESULT_END###", flush=True)


if __name__ == "__main__":
    main()
