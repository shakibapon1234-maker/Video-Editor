import cv2
import numpy as np
import subprocess
import time
import os
import sys

input_video = r'H:\shakib\malaisia e visa application.mp4'
output_video = r'H:\shakib\malaisia e visa application (policy fixed).mp4'
ffmpeg_exe = r'C:\Users\starlink\AppData\Local\Programs\Python\Python312\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe'

def blur_box(image, x1, y1, x2, y2, k=41):
    h, w = image.shape[:2]
    x1, y1 = max(0, int(x1)), max(0, int(y1))
    x2, y2 = min(w, int(x2)), min(h, int(y2))
    if x2 <= x1 or y2 <= y1:
        return
    roi = image[y1:y2, x1:x2]
    if roi.size == 0:
        return
    k_val = min(k, min(roi.shape[0], roi.shape[1]))
    if k_val % 2 == 0:
        k_val -= 1
    if k_val >= 3:
        b = cv2.GaussianBlur(roi, (k_val, k_val), 0)
        b = cv2.GaussianBlur(b, (k_val, k_val), 0)
        image[y1:y2, x1:x2] = b

def main():
    if not os.path.exists(input_video):
        print(f"Error: {input_video} not found!")
        sys.exit(1)

    # Remove incomplete file if exists
    if os.path.exists(output_video):
        try:
            os.remove(output_video)
        except Exception:
            pass

    cap = cv2.VideoCapture(input_video)
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    duration = total_frames / fps

    print(f"Starting render: {width}x{height} @ {fps}fps, {total_frames} frames ({duration:.1f}s)")

    # Prepare template for Personal Details scrolling tracking
    cap.set(cv2.CAP_PROP_POS_FRAMES, int(370 * fps))
    ret, ref_frame = cap.read()
    banner_tmpl = None
    if ret:
        banner_tmpl = ref_frame[265:330, 240:800].copy()

    # Reset video to frame 0
    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)

    # Launch FFmpeg subprocess with DEVNULL for stderr to prevent pipe buffer deadlock
    cmd = [
        ffmpeg_exe, '-y',
        '-f', 'rawvideo',
        '-vcodec', 'rawvideo',
        '-s', f'{width}x{height}',
        '-pix_fmt', 'bgr24',
        '-r', str(fps),
        '-i', '-',
        '-i', input_video,
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '19',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        '-c:a', 'copy',
        output_video
    ]

    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    t_start = time.time()
    frame_idx = 0
    cached_dy = 0
    cached_val = 0.0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        sec = frame_idx / fps

        # --- SECTION 1: Registration Form (55s to 145s) ---
        if 55 <= sec < 145:
            if sec < 100:
                blur_box(frame, 1120, 330, 1690, 390)
                blur_box(frame, 1120, 600, 1690, 650)
            elif sec < 125:
                blur_box(frame, 1120, 330, 1690, 390)
                blur_box(frame, 1120, 520, 1690, 570)
                blur_box(frame, 1120, 660, 1690, 710)
            else:
                blur_box(frame, 1120, 380, 1690, 440)
                blur_box(frame, 1120, 520, 1690, 570)

        # --- SECTION 2: Gmail OTP & Login (160s to 215s) ---
        elif 160 <= sec < 215:
            if frame[193, 54, 2] > 180:
                blur_box(frame, 350, 360, 1800, 950, k=45)
                blur_box(frame, 220, 35, 410, 75, k=25)
            else:
                blur_box(frame, 1040, 460, 1400, 520)

        # --- SECTION 3: Dashboard Header Banner (230s to 275s) ---
        elif 230 <= sec < 275:
            blur_box(frame, 520, 195, 1750, 310, k=41)

        # --- SECTION 4: Personal Details Form & Photo Editor (280s to 472s) ---
        elif 280 <= sec < 472:
            if 452 <= sec < 464:
                blur_box(frame, 350, 235, 790, 695, k=55)

            # Update template matching every 5 frames for 5x speed
            if frame_idx % 5 == 0:
                search_roi = frame[100:950, 230:810]
                res = cv2.matchTemplate(search_roi, banner_tmpl, cv2.TM_CCOEFF_NORMED)
                _, max_val, _, max_loc = cv2.minMaxLoc(res)
                cached_val = max_val
                if max_val > 0.6:
                    cached_dy = (max_loc[1] + 100) - 265

            if cached_val > 0.6:
                dy = cached_dy
                blur_box(frame, 230, 140 + dy, 770, 500 + dy, k=45)
                blur_box(frame, 230, 560 + dy, 770, 860 + dy, k=51)
                blur_box(frame, 980, 165 + dy, 1550, 225 + dy)
                blur_box(frame, 980, 270 + dy, 1550, 330 + dy)
                blur_box(frame, 980, 590 + dy, 1550, 650 + dy)
                blur_box(frame, 340, 425 + dy, 915, 475 + dy)
                blur_box(frame, 980, 425 + dy, 1555, 475 + dy)
                blur_box(frame, 340, 530 + dy, 915, 580 + dy)
                blur_box(frame, 980, 530 + dy, 1555, 580 + dy)
                blur_box(frame, 340, 775 + dy, 850, 830 + dy)
                blur_box(frame, 340, 928 + dy, 850, 978 + dy)
                blur_box(frame, 980, 840 + dy, 1500, 890 + dy)
            else:
                if 464 <= sec < 472:
                    blur_box(frame, 340, 225, 915, 275)
                    blur_box(frame, 980, 225, 1555, 275)
                    blur_box(frame, 340, 330, 915, 380)
                    blur_box(frame, 980, 330, 1555, 380)
                    blur_box(frame, 340, 775, 850, 830)
                    blur_box(frame, 340, 928, 850, 978)
                    blur_box(frame, 980, 840, 1500, 890)

        # --- SECTION 5: Document Upload Page (475s to 572s) ---
        elif 475 <= sec < 572:
            if 545 <= sec < 570:
                blur_box(frame, 410, 140, 660, 490, k=45)

        # --- SECTION 6: Review Page (575s to 592s) ---
        elif 575 <= sec < 592:
            blur_box(frame, 370, 640, 700, 685)
            blur_box(frame, 580, 190, 860, 240)
            blur_box(frame, 1030, 190, 1480, 240)
            blur_box(frame, 740, 715, 900, 765)
            blur_box(frame, 1370, 715, 1530, 765)
            blur_box(frame, 640, 825, 800, 870)
            blur_box(frame, 1210, 825, 1380, 870)
            blur_box(frame, 740, 1035, 1800, 1072)
            blur_box(frame, 580, 50, 1800, 300)

        try:
            proc.stdin.write(frame.tobytes())
        except (BrokenPipeError, OSError):
            break

        frame_idx += 1
        if frame_idx % 1000 == 0 or frame_idx == total_frames:
            elapsed = time.time() - t_start
            cur_fps = frame_idx / elapsed
            percent = (frame_idx / total_frames) * 100
            eta = (total_frames - frame_idx) / max(1.0, cur_fps)
            print(f"Progress: {percent:.1f}% ({frame_idx}/{total_frames}) | FPS: {cur_fps:.1f} | ETA: {eta:.0f}s", flush=True)

    proc.stdin.close()
    proc.wait()
    cap.release()

    total_time = time.time() - t_start
    print(f"\nSUCCESS: Processing Complete in {total_time:.1f}s ({total_time/60:.2f} mins)!", flush=True)
    if os.path.exists(output_video):
        size_mb = os.path.getsize(output_video) / (1024*1024)
        print(f"Output saved to: {output_video} ({size_mb:.2f} MB)", flush=True)

if __name__ == '__main__':
    main()
