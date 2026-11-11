# -*- coding: utf-8 -*-
"""
Standalone Bengali Audio to Text Converter (বাংলা অডিও থেকে টেক্সট রূপান্তরকারী স্বাধীন টুল)

Supports all standard and video-like audio containers:
  - MP3 (.mp3)
  - M4A (.m4a) - MPEG-4 Audio (ভিডিওর মতো কিন্তু অডিও ফরম্যাট)
  - MP4 (.mp4) - Audio-only or video container with audio
  - AAC (.aac)
  - WAV (.wav)
  - OGG (.ogg)
  - OPUS (.opus) - WhatsApp / Telegram voice recordings
  - FLAC (.flac)
  - WEBM (.webm)
  - WMA (.wma), AMR (.amr), 3GP (.3gp)

Engines:
  1. Google Speech Recognition (bn-BD): Super fast (15-30 seconds), free, no API key needed.
  2. Offline OpenAI Whisper AI: 100% offline fallback when there is no internet.
"""

import os
import sys
import subprocess
import argparse
import tempfile
import shutil

# Fix Windows console encoding so Bengali and Unicode characters display properly
if sys.platform == "win32":
    try:
        os.system("chcp 65001 >nul 2>&1")
    except Exception:
        pass
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Ensure local ffmpeg-static is on PATH and configure pydub
script_dir = os.path.dirname(os.path.abspath(__file__))
ffmpeg_dir = os.path.join(script_dir, 'node_modules', 'ffmpeg-static')
ffmpeg_bin = os.path.join(ffmpeg_dir, 'ffmpeg.exe' if sys.platform == "win32" else 'ffmpeg')
if os.path.exists(ffmpeg_dir):
    os.environ["PATH"] = ffmpeg_dir + os.path.pathsep + os.environ.get("PATH", "")

SUPPORTED_EXTENSIONS = (
    '.mp3', '.m4a', '.mp4', '.aac', '.wav', '.ogg',
    '.opus', '.flac', '.webm', '.weba', '.wma', '.amr',
    '.3gp', '.m4r', '.m4b', '.mkv'
)

def format_timestamp(seconds):
    millis   = int((seconds % 1) * 1000)
    seconds  = int(seconds)
    minutes  = seconds // 60
    hours    = minutes  // 60
    minutes  = minutes  %  60
    seconds  = seconds  %  60
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{millis:03d}"

def safe_print(text, flush=True):
    try:
        print(text, flush=flush)
    except Exception:
        try:
            print(text.encode('ascii', errors='replace').decode('ascii'), flush=flush)
        except Exception:
            pass

def check_internet():
    import urllib.request
    try:
        urllib.request.urlopen('https://www.google.com', timeout=3)
        return True
    except Exception:
        return False

def pick_file_with_gui():
    """Opens a native Windows Open File Dialog so the user can easily select any audio file."""
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)
        file_path = filedialog.askopenfilename(
            title="বাংলা টেক্সট করার জন্য অডিও ফাইল সিলেক্ট করুন",
            filetypes=[
                (
                    "সব অডিও ফাইল (*.mp3, *.m4a, *.mp4, *.aac, *.wav, *.ogg, *.opus, *.flac, *.webm)",
                    "*.mp3;*.m4a;*.mp4;*.aac;*.wav;*.ogg;*.opus;*.flac;*.webm;*.weba;*.wma;*.amr;*.3gp;*.mkv"
                ),
                ("M4A / MP4 অডিও (ভিডিওর মতো কন্টেইনার)", "*.m4a;*.mp4"),
                ("MP3 অডিও (*.mp3)", "*.mp3"),
                ("WAV অডিও (*.wav)", "*.wav"),
                ("AAC অডিও (*.aac)", "*.aac"),
                ("OPUS / OGG অডিও (*.opus, *.ogg)", "*.opus;*.ogg"),
                ("FLAC অডিও (*.flac)", "*.flac"),
                ("সকল ফাইল (*.*)", "*.*")
            ]
        )
        root.destroy()
        return file_path
    except Exception:
        return ""

def convert_with_google(file_path):
    """Fast Google Speech Recognition (bn-BD)"""
    safe_print("\n[+] মোড: ⚡ Google Speech Recognition (বাংলা bn-BD)")
    safe_print("[*] অডিও প্রস্তুত করা হচ্ছে...")

    temp_dir = tempfile.mkdtemp(prefix="audio_to_text_")
    temp_wav = os.path.join(temp_dir, "temp_full.wav")

    try:
        # Extract audio using FFmpeg (-vn ensures any video track is ignored)
        cmd = [
            'ffmpeg', '-y', '-i', file_path,
            '-vn',
            '-acodec', 'pcm_s16le',
            '-ar', '16000', '-ac', '1', '-f', 'wav',
            temp_wav
        ]
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

        import speech_recognition as sr
        from pydub import AudioSegment
        if os.path.exists(ffmpeg_bin):
            AudioSegment.converter = ffmpeg_bin

        r = sr.Recognizer()
        sound = AudioSegment.from_wav(temp_wav)

        chunk_length_ms = 12000  # 12-second chunks
        chunks = [sound[i:i + chunk_length_ms] for i in range(0, len(sound), chunk_length_ms)]
        total_chunks = len(chunks)

        duration_sec = len(sound) / 1000.0
        safe_print(f"[*] মোট অডিও দৈর্ঘ্য: {duration_sec:.1f} সেকেন্ড ({total_chunks} টি সেগমেন্ট)")
        safe_print("[*] বাংলা ভয়েস থেকে টেক্সটে রূপান্তর চলছে...\n")

        full_text = []
        srt_entries = []

        for idx, chunk in enumerate(chunks, 1):
            chunk_file = os.path.join(temp_dir, f"chunk_{idx}.wav")
            chunk.export(chunk_file, format="wav")

            start_sec = ((idx - 1) * chunk_length_ms) / 1000.0
            end_sec = min((idx * chunk_length_ms) / 1000.0, duration_sec)

            with sr.AudioFile(chunk_file) as source:
                audio_data = r.record(source)
                try:
                    text = r.recognize_google(audio_data, language="bn-BD")
                    if text.strip():
                        clean_text = text.strip()
                        full_text.append(clean_text)
                        srt_entries.append((len(srt_entries) + 1, start_sec, end_sec, clean_text))
                        preview = clean_text[:65] + ("..." if len(clean_text) > 65 else "")
                        safe_print(f"  [{idx:02d}/{total_chunks:02d}] ✓ {preview}")
                except sr.UnknownValueError:
                    # Silence or background noise
                    pass
                except sr.RequestError as e:
                    safe_print(f"  [{idx:02d}/{total_chunks:02d}] ⚠️ রিকোয়েস্ট সমস্যা: {e}")

            try:
                if os.path.exists(chunk_file):
                    os.remove(chunk_file)
            except Exception:
                pass

        final_transcript = " ".join(full_text).strip()
        return final_transcript, srt_entries

    finally:
        try:
            shutil.rmtree(temp_dir, ignore_errors=True)
        except Exception:
            pass

def convert_with_whisper(file_path, model_name='small'):
    """Offline OpenAI Whisper Recognition"""
    safe_print(f"\n[+] মোড: 🔒 Offline Whisper AI (মডেল: {model_name})")
    safe_print("[*] Whisper AI মডেল লোড করা হচ্ছে... (CPU-তে কিছুটা সময় লাগতে পারে)")

    import whisper
    model = whisper.load_model(model_name)

    safe_print("[*] ট্রান্সক্রিপশন চলছে... দয়া করে অপেক্ষা করুন...")

    result = model.transcribe(
        file_path,
        language='bn',
        task='transcribe',
        condition_on_previous_text=False,
        temperature=0.0,
        compression_ratio_threshold=2.4,
        no_speech_threshold=0.6,
        verbose=False,
    )

    final_transcript = result.get('text', '').strip()
    segments = result.get('segments', [])

    srt_entries = []
    for i, seg in enumerate(segments, 1):
        clean_text = seg.get('text', '').strip()
        if clean_text:
            srt_entries.append((i, seg['start'], seg['end'], clean_text))

    return final_transcript, srt_entries

def convert_audio_to_text(file_path, engine='auto', model_name='small', no_ui=False):
    file_path = os.path.abspath(file_path.strip('"\' '))
    if not os.path.exists(file_path):
        safe_print(f"\n[ERROR] ফাইলটি খুঁজে পাওয়া যায়নি:\n   {file_path}")
        return False

    ext = os.path.splitext(file_path)[1].lower()
    format_label = ext.replace('.', '').upper()
    if ext == '.m4a':
        format_info = "M4A (MPEG-4 Audio / Apple & Phone Voice)"
    elif ext == '.mp4':
        format_info = "MP4 Audio Container"
    elif ext == '.opus':
        format_info = "OPUS (WhatsApp / Telegram Voice)"
    elif ext == '.mp3':
        format_info = "MP3 Audio"
    elif ext == '.wav':
        format_info = "WAV Lossless Audio"
    else:
        format_info = f"{format_label} Audio"

    safe_print("\n========================================================")
    safe_print("  ⚡ Instant Audio to Text Converter (অডিও থেকে টেক্সট)")
    safe_print("========================================================")
    safe_print(f"[FILE] {file_path}")
    safe_print(f"[FORMAT] {format_info}")

    final_text = ""
    srt_entries = []

    # Engine selection
    use_google = (engine == 'google')
    if engine == 'auto':
        has_net = check_internet()
        if has_net:
            use_google = True
        else:
            safe_print("[!] ইন্টারনেট সংযোগ পাওয়া যায়নি। অফলাইন Whisper AI ব্যবহার করা হচ্ছে...")
            use_google = False

    if use_google:
        try:
            final_text, srt_entries = convert_with_google(file_path)
        except Exception as e:
            safe_print(f"\n[⚠️ Google Engine Error]: {e}")
            safe_print("[*] অফলাইন Whisper মডেলে রূপান্তর করার চেষ্টা করা হচ্ছে...")
            final_text, srt_entries = convert_with_whisper(file_path, model_name=model_name)
    else:
        final_text, srt_entries = convert_with_whisper(file_path, model_name=model_name)

    if not final_text:
        safe_print("\n[!] কোনো কথা বা টেক্সট শনাক্ত করা যায়নি। অডিও স্পষ্ট ও কথা আছে কিনা চেক করুন।")
        return False

    # Save output files alongside input audio
    base_name = os.path.splitext(file_path)[0]
    txt_path = os.path.abspath(f"{base_name}_audio_transcript.txt")
    srt_path = os.path.abspath(f"{base_name}_audio_subtitle.srt")

    with open(txt_path, 'w', encoding='utf-8') as f:
        f.write(final_text)

    with open(srt_path, 'w', encoding='utf-8') as f:
        for item in srt_entries:
            idx, s_time, e_time, text = item
            f.write(f"{idx}\n{format_timestamp(s_time)} --> {format_timestamp(e_time)}\n{text}\n\n")

    safe_print("\n========================================================")
    safe_print("[OK] সফল হয়েছে! অডিও থেকে বাংলা টেক্সট রূপান্তর সম্পন্ন!")
    safe_print("========================================================")
    safe_print(f"[TXT ফাইল] {txt_path}")
    safe_print(f"[SRT ফাইল] {srt_path}\n")
    safe_print("--------------------------------------------------------")
    safe_print("প্রিভিউ (প্রথম ৪০০ অক্ষর):")
    safe_print("--------------------------------------------------------")
    safe_print(final_text[:400] + ("..." if len(final_text) > 400 else ""))
    safe_print("--------------------------------------------------------\n")

    # Automatically highlight file in File Explorer and open in Notepad
    if not no_ui:
        try:
            subprocess.Popen(['explorer', '/select,', txt_path])
        except Exception:
            pass
        try:
            os.startfile(txt_path)
        except Exception:
            pass

    return True

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Convert Audio to Bengali Text (Supports MP3, M4A, MP4, AAC, WAV, etc.)")
    parser.add_argument("file", nargs="?", help="Path to audio file (MP3, M4A, MP4, AAC, WAV, etc.)")
    parser.add_argument("--engine", choices=['auto', 'google', 'whisper'], default='auto',
                        help="Speech engine: auto (default), google (fast bn-BD), whisper (offline)")
    parser.add_argument("--model", default="small",
                        help="Whisper model (if offline): tiny/base/small/medium")
    parser.add_argument("--no-ui", action="store_true",
                        help="Run without opening explorer/notepad or waiting for ENTER key")
    args = parser.parse_args()

    input_file = args.file

    if not input_file and not args.no_ui:
        # Step 1: Try native GUI file dialog
        safe_print("\n[*] অডিও ফাইল সিলেক্ট করার উইন্ডো ওপেন করা হচ্ছে...")
        input_file = pick_file_with_gui()

    if not input_file:
        # Step 2: Fall back to console input
        safe_print("\n========================================================")
        safe_print("  ⚡ Instant Audio to Text Converter (বাংলা টেক্সট)     ")
        safe_print("  সমর্থিত: MP3, M4A, MP4, AAC, WAV, OGG, OPUS, FLAC ইত্যাদি")
        safe_print("========================================================")
        safe_print("[>] অডিও ফাইল ড্র্যাগ করে এনে ছেড়ে দিন অথবা পাথ পেস্ট করুন:")
        try:
            input_file = input("   > ").strip('"\' ')
        except Exception:
            input_file = sys.stdin.readline().strip('"\' \n\r')

    if input_file and os.path.exists(input_file):
        success = convert_audio_to_text(input_file, engine=args.engine, model_name=args.model, no_ui=args.no_ui)
        if success:
            if not args.no_ui:
                safe_print("[OK] Notepad এবং File Explorer ওপেন হয়েছে!")
        else:
            safe_print("[ERROR] কনভার্ট সম্পন্ন হতে পারেনি।")
    else:
        safe_print("[ERROR] কোনো ফাইল সিলেক্ট করা হয়নি বা ফাইলের পাথ সঠিক নয়।")

    if not args.no_ui:
        try:
            input("\n[>] বন্ধ করতে ENTER চাপুন...")
        except Exception:
            pass
