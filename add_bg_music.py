# -*- coding: utf-8 -*-
"""
Standalone Video Background Music Adder with Auto-Ducking
Uses FFmpeg Native Stream Copy (-c:v copy) - Instant Export in 20-40 Seconds!
Auto-ducking lowers music volume when speech occurs, raises it back when quiet.
"""

import os
import sys
import subprocess
import argparse
import shutil

# Fix Windows console encoding
if sys.platform == "win32":
    try:
        os.system("chcp 65001 >nul 2>&1")
    except Exception:
        pass
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Ensure local ffmpeg-static is on PATH
script_dir = os.path.dirname(os.path.abspath(__file__))
ffmpeg_dir = os.path.join(script_dir, 'node_modules', 'ffmpeg-static')
if os.path.exists(ffmpeg_dir):
    os.environ["PATH"] = ffmpeg_dir + os.path.pathsep + os.environ.get("PATH", "")

def safe_print(text, flush=True):
    try:
        print(text, flush=flush)
    except Exception:
        try:
            print(text.encode('ascii', errors='replace').decode('ascii'), flush=flush)
        except Exception:
            pass

def check_video_has_audio(video_path):
    try:
        cmd = ['ffmpeg', '-i', video_path]
        res = subprocess.run(cmd, stderr=subprocess.PIPE, stdout=subprocess.DEVNULL, text=True)
        return ('Audio:' in res.stderr)
    except Exception:
        return False

def add_background_music(video_path, audio_path, music_volume=0.18, voice_volume=1.0, ducking=True, ducking_ratio=5.0, loop=True, output_path=None):
    video_path = os.path.abspath(video_path.strip('"\' '))
    audio_path = os.path.abspath(audio_path.strip('"\' '))

    if not os.path.exists(video_path):
        safe_print(f"[ERROR] ভিডিও ফাইলটি পাওয়া যায়নি: {video_path}")
        return False

    if not os.path.exists(audio_path):
        safe_print(f"[ERROR] অডিও ফাইলটি পাওয়া যায়নি: {audio_path}")
        return False

    safe_print("\n========================================================")
    safe_print("  [*] Fast Background Music & Auto-Ducking Adder ⚡")
    safe_print("========================================================")
    safe_print(f"[ভিডিও] {video_path}")
    safe_print(f"[মিউজিক] {audio_path}")
    safe_print(f"[ভয়েস ভলিউম] {int(voice_volume * 100)}%")
    safe_print(f"[মিউজিক ভলিউম] {int(music_volume * 100)}%")
    safe_print(f"[অটো-ডাকিং] {'চালু (ভয়েস এলে মিউজিক কমবে)' if ducking else 'বন্ধ'}")
    safe_print(f"[লুপ মোড] {'চালু (ভিডিওর শেষ পর্যন্ত লুপ হবে)' if loop else 'বন্ধ'}")

    has_audio = check_video_has_audio(video_path)

    # Determine output filename
    if not output_path:
        base, ext = os.path.splitext(video_path)
        output_path = f"{base}_with_bgmusic{ext}"
        counter = 1
        while os.path.exists(output_path):
            output_path = f"{base}_with_bgmusic_{counter}{ext}"
            counter += 1

    safe_print(f"[আউটপুট] {output_path}")
    safe_print("[*] প্রসেসিং শুরু হচ্ছে... (Stream Copy: মাত্র ২০–৪০ সেকেন্ড লাগবে)")

    # Build FFmpeg command
    cmd = ['ffmpeg', '-y', '-i', video_path]
    if loop:
        cmd.extend(['-stream_loop', '-1', '-i', audio_path])
    else:
        cmd.extend(['-i', audio_path])

    if has_audio and ducking:
        # Sidechain compress: voice (0:a) controls compression on music (1:a)
        filter_str = (
            f"[0:a]volume={voice_volume},asplit=2[voice_main][voice_side];"
            f"[1:a]volume={music_volume}[music_raw];"
            f"[music_raw][voice_side]sidechaincompress=threshold=0.03:ratio={ducking_ratio}:attack=150:release=700:makeup=1[ducked_music];"
            f"[voice_main][ducked_music]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,alimiter=limit=-1dB[aout]"
        )
        cmd.extend(['-filter_complex', filter_str, '-map', '0:v:0', '-map', '[aout]'])
    elif has_audio:
        # Plain mix without ducking
        filter_str = (
            f"[0:a]volume={voice_volume}[va];"
            f"[1:a]volume={music_volume}[na];"
            f"[va][na]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,alimiter=limit=-1dB[aout]"
        )
        cmd.extend(['-filter_complex', filter_str, '-map', '0:v:0', '-map', '[aout]'])
    else:
        # Video has no audio track, just add music
        filter_str = f"[1:a]volume={music_volume}[aout]"
        cmd.extend(['-filter_complex', filter_str, '-map', '0:v:0', '-map', '[aout]'])

    # Stream copy video (0ms re-encoding time, 100% original quality preserved)
    cmd.extend([
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-shortest',
        '-movflags', '+faststart',
        output_path
    ])

    try:
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        _, stderr = proc.communicate()

        if proc.returncode != 0:
            safe_print(f"\n[ERROR] FFmpeg সমস্যা হয়েছে: {stderr[-500:]}")
            return False

        safe_print("\n========================================================")
        safe_print("[OK] সফল হয়েছে! ব্যাকগ্রাউন্ড মিউজিক সফলভাবে যুক্ত হয়েছে!")
        safe_print("========================================================")
        safe_print(f"[নতুন ভিডিও ফাইল]:\n  {output_path}\n")

        # Select file in Windows Explorer
        try:
            subprocess.Popen(['explorer', '/select,', output_path])
        except Exception:
            pass

        return True

    except Exception as e:
        safe_print(f"\n[ERROR] ব্যর্থ হয়েছে: {e}")
        return False

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Add Background Music to Video with Auto-Ducking")
    parser.add_argument("video", nargs="?", help="Path to video file")
    parser.add_argument("audio", nargs="?", help="Path to background music file")
    parser.add_argument("--music-vol", type=float, default=0.18, help="Music volume (0.01 to 1.0, default 0.18)")
    parser.add_argument("--voice-vol", type=float, default=1.0, help="Voice volume (default 1.0)")
    parser.add_argument("--no-ducking", action="store_true", help="Disable auto-ducking")
    parser.add_argument("--ratio", type=float, default=5.0, help="Ducking ratio (default 5.0)")
    args = parser.parse_args()

    v_file = args.video
    a_file = args.audio

    if not v_file:
        safe_print("\n========================================================")
        safe_print("    [*] Fast Video Background Music Adder (Auto-Ducking)")
        safe_print("========================================================")
        safe_print("[>] ১. ভিডিও ফাইলের পাথ কপি করে পেস্ট করুন (অথবা ড্র্যাগ-ড্রপ করুন):")
        try:
            v_file = input("   > ").strip('"\' ')
        except Exception:
            v_file = sys.stdin.readline().strip('"\' \n\r')

    if not a_file and v_file:
        safe_print("\n[>] ২. ব্যাকগ্রাউন্ড মিউজিক ফাইলের পাথ দিন (MP3/WAV ড্র্যাগ-ড্রপ করুন):")
        try:
            a_file = input("   > ").strip('"\' ')
        except Exception:
            a_file = sys.stdin.readline().strip('"\' \n\r')

    if v_file and a_file:
        add_background_music(
            v_file,
            a_file,
            music_volume=args.music_vol,
            voice_volume=args.voice_vol,
            ducking=(not args.no_ducking),
            ducking_ratio=args.ratio,
            loop=True
        )
    else:
        safe_print("[ERROR] ভিডিও বা অডিও ফাইল সিলেক্ট করা হয়নি।")

    try:
        input("\n[>] বন্ধ করতে ENTER চাপুন...")
    except Exception:
        pass

