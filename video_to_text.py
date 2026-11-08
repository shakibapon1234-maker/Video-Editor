# -*- coding: utf-8 -*-
"""
Standalone Video/Audio to Text Converter (বাংলা স্পিচ টু টেক্সট)
Supports:
  1. Fast & Accurate Google Speech Recognition (bn-BD) - FREE, NO API KEY, Takes 15-30s! (Recommended)
  2. Offline OpenAI Whisper AI - Works 100% offline without Internet.
"""

import os
import sys
import subprocess
import argparse
import tempfile
import shutil

# Fix Windows console encoding so Bengali/emoji prints properly
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

def convert_with_google(file_path):
    """Fast Google Speech Recognition (bn-BD)"""
    safe_print("\n[+] মোড: ⚡ Google Speech Recognition (বাংলা bn-BD)")
    safe_print("[*] অডিও প্রস্তুত করা হচ্ছে...")

    temp_dir = tempfile.mkdtemp(prefix="video_to_text_")
    temp_wav = os.path.join(temp_dir, "temp_full.wav")

    try:
        # Extract 16kHz mono WAV
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

        chunk_length_ms = 12000  # 12-second chunks
        chunks = [sound[i:i + chunk_length_ms] for i in range(0, len(sound), chunk_length_ms)]
        total_chunks = len(chunks)

        safe_print(f"[*] মোট অডিও সেগমেন্ট: {total_chunks} টি (প্রতিটি ১২ সেকেন্ড)")
        safe_print("[*] বাংলা ভয়েস থেকে টেক্সটে রূপান্তর শুরু হচ্ছে...\n")

        full_text = []
        srt_entries = []

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
                        preview = text.strip()[:65] + ("..." if len(text.strip()) > 65 else "")
                        safe_print(f"  [{idx:02d}/{total_chunks:02d}] ✓ {preview}")
                except sr.UnknownValueError:
                    # Silence or inaudible chunk
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
    safe_print("[*] Whisper মডেল লোড করা হচ্ছে... (CPU-তে কিছুটা সময় লাগতে পারে)")

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
        srt_entries.append((i, seg['start'], seg['end'], seg['text'].strip()))

    return final_transcript, srt_entries

def convert_video_to_text(file_path, engine='auto', model_name='small'):
    file_path = os.path.abspath(file_path.strip('"\' '))
    if not os.path.exists(file_path):
        safe_print(f"\n[ERROR] ফাইলটি খুঁজে পাওয়া যায়নি:\n   {file_path}")
        return False

    safe_print(f"\n========================================================")
    safe_print(f"[*] Video / Audio to Text Converter (বাংলা টেক্সট কনভার্টার)")
    safe_print(f"========================================================")
    safe_print(f"[FILE] {file_path}")

    final_text = ""
    srt_entries = []

    # Engine selection
    use_google = (engine == 'google')
    if engine == 'auto':
        has_net = check_internet()
        if has_net:
            use_google = True
        else:
            safe_print("[!] ইন্টারনেট সংযোগ নেই। অফলাইন Whisper ব্যবহার করা হচ্ছে...")
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
        safe_print("\n[!] কোনো কথা বা টেক্সট শনাক্ত করা যায়নি। অডিও স্পষ্ট কিনা চেক করুন।")
        return False

    # Save output files
    base_name = os.path.splitext(file_path)[0]
    txt_path = os.path.abspath(f"{base_name}_transcript.txt")
    srt_path = os.path.abspath(f"{base_name}_subtitle.srt")

    with open(txt_path, 'w', encoding='utf-8') as f:
        f.write(final_text)

    with open(srt_path, 'w', encoding='utf-8') as f:
        for item in srt_entries:
            idx, s_time, e_time, text = item
            f.write(f"{idx}\n{format_timestamp(s_time)} --> {format_timestamp(e_time)}\n{text}\n\n")

    safe_print("\n========================================================")
    safe_print("[OK] সফল হয়েছে! ভিডিও থেকে টেক্সট তৈরি সম্পন্ন!")
    safe_print("========================================================")
    safe_print(f"[TXT ফাইল] {txt_path}")
    safe_print(f"[SRT ফাইল] {srt_path}\n")
    safe_print("--------------------------------------------------------")
    safe_print("প্রিভিউ (প্রথম ৪০০ অক্ষর):")
    safe_print("--------------------------------------------------------")
    safe_print(final_text[:400] + ("..." if len(final_text) > 400 else ""))
    safe_print("--------------------------------------------------------\n")

    # Automatically open File Explorer and Notepad
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
    parser = argparse.ArgumentParser(description="Convert Video/Audio to Bangla Text")
    parser.add_argument("file", nargs="?", help="Path to video or audio file")
    parser.add_argument("--engine", choices=['auto', 'google', 'whisper'], default='auto',
                        help="Speech engine: auto (default), google (fast bn-BD), whisper (offline)")
    parser.add_argument("--model", default="small",
                        help="Whisper model (if offline): tiny/base/small/medium")
    args = parser.parse_args()

    input_file = args.file

    if not input_file:
        safe_print("\n========================================================")
        safe_print("       [*] Video to Text Converter (বাংলা টেক্সট)        ")
        safe_print("========================================================")
        safe_print("[>] ভিডিও বা অডিও ফাইলের পাথ পেস্ট করে Enter চাপুন:")
        try:
            input_file = input("   > ").strip('"\' ')
        except Exception:
            input_file = sys.stdin.readline().strip('"\' \n\r')

    if input_file:
        success = convert_video_to_text(input_file, engine=args.engine, model_name=args.model)
        if success:
            safe_print("[OK] File Explorer এবং Notepad স্বয়ংক্রিয়ভাবে ওপেন হয়েছে!")
        else:
            safe_print("[ERROR] কনভার্ট সম্পন্ন হতে পারেনি।")
    else:
        safe_print("[ERROR] কোনো ফাইল সিলেক্ট করা হয়নি।")

    try:
        input("\n[>] বন্ধ করতে ENTER চাপুন...")
    except Exception:
        pass
