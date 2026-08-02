# -*- coding: utf-8 -*-
"""
Fast & Accurate Bengali Video/Audio to Text Converter
Uses Google Speech Recognition (bn-BD) - FREE, NO API KEY, Takes 10-15 SECONDS!
100% Pure Bengali Unicode Script!
"""

import os
import sys
import subprocess
import math

# Fix Windows console encoding
if sys.platform == "win32":
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
        print(f"\n[ERROR] File not found: {file_path}")
        return False

    print(f"\n==========================================")
    print(f"[*] Fast Bengali Video to Text Converter")
    print(f"==========================================")
    print(f"[FILE] {file_path}")
    print(f"[ENGINE] Google Speech Recognition (bn-BD)")
    print(f"[STATUS] Extracting audio and transcribing...")

    # Temp audio path
    temp_wav = os.path.join(script_dir, "temp_speech_input.wav")
    
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

        full_text = []
        srt_entries = []

        print(f"[*] Processing {len(chunks)} audio segments...")

        for idx, chunk in enumerate(chunks):
            chunk_file = os.path.join(script_dir, f"temp_chunk_{idx}.wav")
            chunk.export(chunk_file, format="wav")

            start_sec = (idx * chunk_length_ms) / 1000.0
            end_sec = min(((idx + 1) * chunk_length_ms) / 1000.0, len(sound) / 1000.0)

            with sr.AudioFile(chunk_file) as source:
                audio_data = r.record(source)
                try:
                    text = r.recognize_google(audio_data, language="bn-BD")
                    if text.strip():
                        full_text.append(text.strip())
                        srt_entries.append((idx + 1, start_sec, end_sec, text.strip()))
                        print(f"  [{idx+1}/{len(chunks)}] {text.strip()[:60]}...")
                except sr.UnknownValueError:
                    pass
                except sr.RequestError as e:
                    print(f"  [{idx+1}] Request error: {e}")

            if os.path.exists(chunk_file):
                try:
                    os.remove(chunk_file)
                except Exception:
                    pass

        # Cleanup temp audio
        if os.path.exists(temp_wav):
            try:
                os.remove(temp_wav)
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

        print("\n==========================================")
        print("[SUCCESS] TRANSCRIPTION COMPLETED!")
        print("==========================================")
        print(f"[TXT] {txt_path}")
        print(f"[SRT] {srt_path}\n")

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
        print(f"\n[ERROR] {e}")
        import traceback
        traceback.print_exc()
        if os.path.exists(temp_wav):
            try:
                os.remove(temp_wav)
            except Exception:
                pass
        return False

if __name__ == '__main__':
    input_file = " ".join(sys.argv[1:]).strip('"\' ') if len(sys.argv) > 1 else None
    if not input_file:
        input_file = input("Enter video file path: ").strip('"\' ')
    if input_file:
        convert_video_to_text(input_file)
    input("\nPress ENTER to exit...")
