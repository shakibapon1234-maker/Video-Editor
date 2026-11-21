# -*- coding: utf-8 -*-
"""
Studio Flow — Instant Standalone Audio/Video Silence Muter & Voice Gate
(স্বাধীন অডিও ও ভিডিও সাইলেন্স মিউটার)

Features:
- Mutes silence/pauses without cutting video: Lossless video stream copy (-c:v copy)
- Generates web & player-optimized MP4 with -movflags +faststart & -avoid_negative_ts make_zero
- Compatible with all video players (PotPlayer, VLC, Windows Media Player, QuickTime, Web Browsers)
- Speech is 100% untouched and clear; pauses/gaps are completely muted to 0 volume.
- Works with ANY Video (MP4, MKV, MOV, WEBM, AVI) or Audio (MP3, WAV, M4A, AAC, OPUS, OGG).
- Interactive GUI (Tkinter file picker) when launched without arguments.
"""

import os
import sys
import subprocess
import math
import shutil
import re

# Fix console encoding for Windows
if sys.platform.startswith('win'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

def find_ffmpeg():
    """Find ffmpeg binary from node_modules, PATH, or local script directory."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(script_dir, "node_modules", "ffmpeg-static", "ffmpeg.exe"),
        os.path.join(script_dir, "ffmpeg.exe"),
        "ffmpeg.exe",
        "ffmpeg"
    ]
    for c in candidates:
        if os.path.isabs(c) and os.path.isfile(c):
            return c
        path_which = shutil.which(c)
        if path_which:
            return path_which
    return "ffmpeg"

def db_to_linear(db_val):
    """Convert dB (e.g. -38) to linear amplitude (0.0 - 1.0) for ffmpeg agate."""
    try:
        val = float(db_val)
        return math.pow(10.0, val / 20.0)
    except Exception:
        return 0.012589  # default -38 dB

def is_video_file(file_path):
    ext = os.path.splitext(file_path)[1].lower()
    return ext in ['.mp4', '.mkv', '.mov', '.webm', '.avi', '.flv', '.m4v', '.ts', '.wmv']

def mute_silence(input_path, output_path=None, threshold_db=-38, mode='mute'):
    """
    Process file with ffmpeg agate filter.
    - If video: copies video stream losslessly (-c:v copy), processes audio only, moves moov to start (+faststart).
    - If audio: applies gate and exports clean audio.
    """
    ffmpeg_bin = find_ffmpeg()
    if not os.path.isfile(input_path):
        print(f"❌ এরর: ফাইলটি পাওয়া যায়নি: {input_path}")
        return False

    input_dir, input_filename = os.path.split(input_path)
    name, ext = os.path.splitext(input_filename)

    if not output_path:
        output_filename = f"{name}_silence_muted{ext}"
        output_path = os.path.join(input_dir, output_filename)

    linear_thresh = round(db_to_linear(threshold_db), 6)

    # agate filter: threshold, ratio 100, range 0 (complete silence in pauses), attack 15ms, release 120ms
    agate_filter = f"agate=threshold={linear_thresh}:ratio=100:range=0:attack=15:release=120:detection=rms"

    print("==============================================================================")
    print("⚡ Instant Silence Muter & Voice Gate (স্বাধীন সাইলেন্স মিউটার)")
    print("==============================================================================")
    print(f"📁 ইনপুট ফাইল: {input_path}")
    print(f"🎯 সাইলেন্স থ্রেশহোল্ড: {threshold_db} dB (লিনিয়ার: {linear_thresh})")
    print(f"💾 আউটপুট ফাইল: {output_path}")
    print("------------------------------------------------------------------------------")

    is_video = is_video_file(input_path)

    if is_video:
        print("🎬 ভিডিও ডিটেক্ট হয়েছে: ভিডিও স্ট্রিম হুবহু অক্ষুণ্ণ রাখা হচ্ছে (-c:v copy)...")
        print("⚡ কোনো ফ্রেম রি-এনকোডিং ছাড়াই অতি দ্রুত এক্সপোর্ট হবে!")
        print("📌 FastStart সক্রিয় করা হচ্ছে যাতে PotPlayer সহ সব প্লেয়ারে মসৃণভাবে চলে।")
        cmd = [
            ffmpeg_bin, "-y",
            "-i", input_path,
            "-af", agate_filter,
            "-c:v", "copy",
            "-c:a", "aac",
            "-b:a", "192k",
            "-movflags", "+faststart",
            "-avoid_negative_ts", "make_zero",
            output_path
        ]
    else:
        print("🎵 অডিও ডিটেক্ট হয়েছে: হাই-কোয়ালিটি অডিও ফিল্টারিং হচ্ছে...")
        if ext.lower() == '.wav':
            cmd = [
                ffmpeg_bin, "-y",
                "-i", input_path,
                "-af", agate_filter,
                output_path
            ]
        else:
            cmd = [
                ffmpeg_bin, "-y",
                "-i", input_path,
                "-af", agate_filter,
                "-c:a", "libmp3lame" if ext.lower() == '.mp3' else "aac",
                "-b:a", "192k",
                output_path
            ]

    print(f"🚀 প্রসেসিং শুরু হয়েছে... অনুগ্রহ করে সমাপ্ত হওয়া পর্যন্ত অপেক্ষা করুন...")
    try:
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, universal_newlines=True)
        _, stderr_text = proc.communicate()

        if proc.returncode == 0:
            out_size_mb = os.path.getsize(output_path) / (1024 * 1024)
            print("------------------------------------------------------------------------------")
            print(f"✅ সম্পূর্ণ ১০০% সফলভাবে সম্পন্ন হয়েছে!")
            print(f"🎉 সংরক্ষিত ফাইল: {output_path} ({out_size_mb:.2f} MB)")
            print("👉 কথা বলার সময় ভয়েস স্বাভাবিক রয়েছে এবং নীরব বিরতিগুলো ১০০% নিঃশব্দ হয়েছে।")
            print("👉 এখন আপনি PotPlayer, VLC বা যেকোনো প্লেয়ারে কোনো সমস্যা ছাড়াই চালাতে পারবেন।")
            print("==============================================================================")
            return True
        else:
            print("❌ FFmpeg প্রসেসিং ব্যর্থ হয়েছে:")
            print(stderr_text[-500:])
            return False
    except Exception as e:
        print(f"❌ এরর: {e}")
        return False

def select_file_gui():
    """Open native file dialog if tkinter is available."""
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)
        file_path = filedialog.askopenfilename(
            title="ভিডিও বা অডিও ফাইল সিলেক্ট করুন (Instant Silence Muter)",
            filetypes=[
                ("All Supported Media", "*.mp4;*.mov;*.mkv;*.webm;*.avi;*.mp3;*.wav;*.m4a;*.aac;*.opus;*.ogg"),
                ("Video Files", "*.mp4;*.mov;*.mkv;*.webm;*.avi"),
                ("Audio Files", "*.mp3;*.wav;*.m4a;*.aac;*.opus;*.ogg"),
                ("All Files", "*.*")
            ]
        )
        root.destroy()
        return file_path
    except Exception:
        return None

if __name__ == "__main__":
    threshold = -38

    if len(sys.argv) > 1:
        target_file = sys.argv[1]
        if len(sys.argv) > 2:
            try:
                threshold = float(sys.argv[2])
            except ValueError:
                pass
    else:
        print("📂 ফাইল সিলেক্ট করার উইন্ডো ওপেন হচ্ছে...")
        target_file = select_file_gui()
        if not target_file:
            print("কোনো ফাইল সিলেক্ট করা হয়নি। প্রোগ্রাম বন্ধ করা হচ্ছে।")
            sys.exit(0)

    mute_silence(target_file, threshold_db=threshold)
    input("\nউইন্ডো বন্ধ করতে Enter চাপুন...")
