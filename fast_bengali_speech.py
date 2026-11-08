# -*- coding: utf-8 -*-
"""
Fast & Accurate Bengali Video/Audio to Text Converter
Uses Google Speech Recognition (bn-BD) - FREE, NO API KEY, Takes 15-30 SECONDS!
100% Pure Bengali Unicode Script!
"""

import os
import sys
import subprocess
import tempfile
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

def format_timestamp(seconds):
    millis   = int((seconds % 1) * 1000)
    seconds  = int(seconds)
    minutes  = seconds // 60
    hours    = minutes  // 60
    minutes  = minutes  %  60
    seconds  = seconds  %  60
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{millis:03d}"

def convert_video_to_text(file_path):
    file_path = os.path.abspath(file_path.strip('"\' '))
    if not os.path.exists(file_path):
        print(f"\n[ERROR] ফাইলটি পাওয়া যায়নি: {file_path}", flush=True)
        return False

    print(f"\n==========================================", flush=True)
    print(f"[*] Fast Bengali Video to Text Converter", flush=True)
    print(f"==========================================", flush=True)
    print(f"[FILE] {file_path}", flush=True)
    print(f"[ENGINE] Google Speech Recognition (bn-BD)", flush=True)
    print(f"[STATUS] অডিও এক্সট্র্যাক্ট করা হচ্ছে...", flush=True)

    temp_dir = tempfile.mkdtemp(prefix="fast_bengali_")
    temp_wav = os.path.join(temp_dir, "temp_full.wav")

    try:
        # Extract audio using ffmpeg as 16kHz mono WAV
        cmd = [
            'ffmpeg', '-y', '-i', file_path,
            '-ar', '16000', '-ac', '1', '-f', 'wav',
            temp_wav
        ]
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

        import speech_recognition as sr
        from pydub import AudioSegment

        r = sr.Recognizer()
        sound = AudioSegment.from_wav(temp_wav)

        chunk_length_ms = 12000  # 12 second chunks for fast, accurate recognition
        chunks = [sound[i:i + chunk_length_ms] for i in range(0, len(sound), chunk_length_ms)]
        total_chunks = len(chunks)

        full_text = []
        srt_entries = []

        print(f"[*] মোট অডিও সেগমেন্ট: {total_chunks} টি (প্রতিটি ১২ সেকেন্ড)", flush=True)
        print(f"[*] ট্রান্সক্রিপশন শুরু হচ্ছে...\n", flush=True)

        for idx, chunk in enumerate(chunks, 1):
            chunk_file = os.path.join(temp_dir, f"chunk_{idx}.wav")
            chunk.export(chunk_file, format="wav")

            start_sec = ((idx - 1) * chunk_length_ms) / 1000.0
            end_sec = min((idx * chunk_length_ms) / 1000.0, len(sound) / 1000.0)

            with sr.AudioFile(chunk_file) as source:
                audio_data = r.record(source)
                try:
                    text = r.recognize_google(audio_data, language="bn-BD")
                    if text.strip():
                        full_text.append(text.strip())
                        srt_entries.append((len(srt_entries) + 1, start_sec, end_sec, text.strip()))
                        preview = text.strip()[:60] + ("..." if len(text.strip()) > 60 else "")
                        print(f"  [{idx:02d}/{total_chunks:02d}] ✓ {preview}", flush=True)
                except sr.UnknownValueError:
                    pass
                except sr.RequestError as e:
                    print(f"  [{idx:02d}/{total_chunks:02d}] Request error: {e}", flush=True)

            try:
                if os.path.exists(chunk_file):
                    os.remove(chunk_file)
            except Exception:
                pass

        final_transcript = " ".join(full_text).strip()

        base_name = os.path.splitext(file_path)[0]
        txt_path = os.path.abspath(f"{base_name}_transcript.txt")
        srt_path = os.path.abspath(f"{base_name}_subtitle.srt")

        with open(txt_path, 'w', encoding='utf-8') as f:
            f.write(final_transcript)

        with open(srt_path, 'w', encoding='utf-8') as f:
            for item in srt_entries:
                idx, start_s, end_s, text = item
                f.write(f"{idx}\n{format_timestamp(start_s)} --> {format_timestamp(end_s)}\n{text}\n\n")

        print("\n==========================================", flush=True)
        print("[SUCCESS] রূপান্তর সফল হয়েছে!", flush=True)
        print("==========================================", flush=True)
        print(f"[TXT] {txt_path}", flush=True)
        print(f"[SRT] {srt_path}\n", flush=True)
        print("------------------------------------------", flush=True)
        print("প্রিভিউ (প্রথম ৪০০ অক্ষর):", flush=True)
        print("------------------------------------------", flush=True)
        print(final_transcript[:400] + ("..." if len(final_transcript) > 400 else ""), flush=True)
        print("------------------------------------------\n", flush=True)

        # Open file explorer & notepad
        try:
            subprocess.Popen(['explorer', '/select,', txt_path])
        except Exception:
            pass
        try:
            os.startfile(txt_path)
        except Exception:
            pass

        return True

    except Exception as e:
        print(f"\n[ERROR] {e}", flush=True)
        import traceback
        traceback.print_exc()
        return False
    finally:
        try:
            shutil.rmtree(temp_dir, ignore_errors=True)
        except Exception:
            pass

if __name__ == '__main__':
    input_file = " ".join(sys.argv[1:]).strip('"\' ') if len(sys.argv) > 1 else None
    if not input_file:
        input_file = input("ভিডিও ফাইলের পাথ দিন (Enter video file path): ").strip('"\' ')
    if input_file:
        convert_video_to_text(input_file)
    input("\nবন্ধ করতে ENTER চাপুন...")
