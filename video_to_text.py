# -*- coding: utf-8 -*-
"""
Standalone Video/Audio to Text Converter (Offline Speech-to-Text)
Uses OpenAI Whisper - Works 100% locally without any API keys or Internet!
"""

import os
import sys
import subprocess
import argparse

# Fix Windows console encoding so Bengali/emoji prints without crashing
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Ensure local ffmpeg-static is on PATH
script_dir = os.path.dirname(os.path.abspath(__file__))
ffmpeg_dir = os.path.join(script_dir, 'node_modules', 'ffmpeg-static')
if os.path.exists(ffmpeg_dir):
    os.environ["PATH"] = ffmpeg_dir + os.path.pathsep + os.environ.get("PATH", "")

# Rich Bengali initial_prompt -- forces Bengali Unicode script output
BENGALI_PROMPT = (
    "\u09ac\u09bf\u09b6\u09cd\u09ac \u098f\u0996\u09a8 \u09b9\u09be\u09a4\u09c7\u09b0 \u09ae\u09c1\u09a0\u09cb\u09af\u09bc\u0964 "
    "\u09aa\u09cd\u09b0\u09a4\u09bf\u09a6\u09bf\u09a8 \u09b9\u09be\u099c\u09be\u09b0\u09cb \u09ae\u09be\u09a8\u09c1\u09b7 "
    "\u099f\u09cd\u09b0\u09be\u09ad\u09c7\u09b2 \u098f\u099c\u09c7\u09a8\u09cd\u09b8\u09bf\u09b0 \u0995\u09cb\u09b0\u09cd\u09b8 "
    "\u09b6\u09bf\u0996\u099b\u09c7\u09a8\u0964 \u09ac\u09be\u0982\u09b2\u09be\u09a6\u09c7\u09b6\u09c7 \u09ac\u09bf\u09ae\u09be\u09a8 "
    "\u099a\u09b2\u09be\u099a\u09b2 \u0993 \u09ad\u09bf\u09b8\u09be \u09aa\u09cd\u09b0\u09b8\u09c7\u09b8\u09bf\u0982 \u09b6\u09bf\u09b2\u09cd\u09aa\u09c7 "
    "\u0995\u09b0\u09cd\u09ae\u09b8\u0982\u09b8\u09cd\u09a5\u09be\u09a8\u09c7\u09b0 \u09ac\u09bf\u09b6\u09be\u09b2 \u09b8\u09c1\u09af\u09cb\u0997 \u09b0\u09af\u09bc\u09c7\u099b\u09c7\u0964"
)

def get_cached_models():
    cache_dir = os.path.join(os.path.expanduser("~"), ".cache", "whisper")
    if not os.path.exists(cache_dir):
        return []
    name_map = {
        'tiny.pt': 'tiny', 'base.pt': 'base',
        'small.pt': 'small', 'medium.pt': 'medium',
        'large-v3.pt': 'large-v3'
    }
    return [name_map[f] for f in os.listdir(cache_dir) if f in name_map]

def safe_print(text):
    try:
        print(text)
    except Exception:
        print(text.encode('ascii', errors='replace').decode('ascii'))

def convert_video_to_text(file_path, model_name='small'):
    file_path = os.path.abspath(file_path.strip('"\' '))
    if not os.path.exists(file_path):
        safe_print(f"\n[ERROR] File not found:\n   {file_path}")
        return False

    safe_print(f"\n==========================================")
    safe_print(f"[*] Video to Text Converter (Whisper Offline)")
    safe_print(f"==========================================")
    safe_print(f"[FILE] {file_path}")
    safe_print(f"[LANG] Bengali Unicode (bangla horof)")
    safe_print(f"[MODEL] {model_name}")
    safe_print(f"[...] Processing... please wait...\n")

    try:
        import whisper

        model = whisper.load_model(model_name)

        result = model.transcribe(
            file_path,
            language='bengali',
            task='transcribe',
            initial_prompt=BENGALI_PROMPT,
            condition_on_previous_text=False,  # Prevents repetition/hallucination loops
            temperature=(0.0, 0.2, 0.4, 0.6),  # Fallback temps if hallucination detected
            compression_ratio_threshold=2.4,    # Skip segments that repeat too much
            no_speech_threshold=0.6,            # Skip silent segments
            verbose=False,
        )

        transcribed_text = result.get('text', '').strip()

        base_name = os.path.splitext(file_path)[0]
        txt_path = os.path.abspath(f"{base_name}_transcript.txt")
        srt_path = os.path.abspath(f"{base_name}_subtitle.srt")

        with open(txt_path, 'w', encoding='utf-8') as f:
            f.write(transcribed_text)

        segments = result.get('segments', [])
        with open(srt_path, 'w', encoding='utf-8') as f:
            for i, seg in enumerate(segments, 1):
                start = format_timestamp(seg['start'])
                end   = format_timestamp(seg['end'])
                text  = seg['text'].strip()
                f.write(f"{i}\n{start} --> {end}\n{text}\n\n")

        safe_print("==========================================")
        safe_print("[OK] SUCCESS! Transcription completed!")
        safe_print("==========================================")
        safe_print(f"[TXT] {txt_path}\n")
        safe_print(f"[SRT] {srt_path}\n")
        safe_print("------------------------------------------")
        safe_print("Preview (first 500 chars):")
        safe_print("------------------------------------------")
        safe_print(transcribed_text[:500] + ("..." if len(transcribed_text) > 500 else ""))
        safe_print("------------------------------------------\n")

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
        safe_print(f"\n[ERROR] Transcription failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def format_timestamp(seconds):
    millis   = int((seconds % 1) * 1000)
    seconds  = int(seconds)
    minutes  = seconds // 60
    hours    = minutes  // 60
    minutes  = minutes  %  60
    seconds  = seconds  %  60
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{millis:03d}"

if __name__ == '__main__':
    cached = get_cached_models()
    safe_print("\n[*] Video / Audio => Bangla Text Converter")
    safe_print("=" * 45)
    safe_print(f"[OK] Available (no download): {', '.join(cached) if cached else 'none'}")
    safe_print("=" * 45)

    parser = argparse.ArgumentParser(description="Convert Video/Audio to Text Offline")
    parser.add_argument("file",    nargs="?", help="Path to video or audio file")
    parser.add_argument("--model", default="small",
                        help="Whisper model: tiny/base/small(default)/medium/large-v3")
    args = parser.parse_args()

    model_choice = args.model
    input_file   = args.file

    if not input_file:
        safe_print(f"\n[>] Video/audio file er path ta drag kore drop korun, tahole Enter chapon:")
        try:
            input_file = input("   > ").strip('"\' ')
        except Exception:
            input_file = sys.stdin.readline().strip('"\' \n\r')

    if input_file:
        success = convert_video_to_text(input_file, model_name=model_choice)
        if success:
            safe_print("[OK] File Explorer and Notepad opened automatically!")
        else:
            safe_print("[ERROR] Something went wrong. See above message.")
    else:
        safe_print("[ERROR] No file selected.")

    try:
        input("\n[>] Press ENTER to close...")
    except Exception:
        pass
