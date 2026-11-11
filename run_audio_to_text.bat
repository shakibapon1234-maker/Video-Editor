@echo off
title Instant Bengali Audio to Text Converter (অডিও থেকে বাংলা টেক্সট)
chcp 65001 >nul
setlocal enabledelayedexpansion
set PATH=%~dp0node_modules\ffmpeg-static;%PATH%
cls

if "%~1"=="" (
    echo ==============================================================================
    echo     ⚡ Instant Bengali Audio to Text Converter (বাংলা অডিও থেকে টেক্সট)
    echo ==============================================================================
    echo.
    echo   সমর্থিত অডিও ফরম্যাটসমূহ:
    echo     • MP3, WAV, AAC, FLAC, OGG, OPUS (WhatsApp / Telegram Voice)
    echo     • M4A, MP4 অডিও (ভিডিওর মতো কন্টেইনার অডিও)
    echo     • WEBM, WMA, AMR, 3GP ইত্যাদি
    echo.
    echo   [*] ফাইল সিলেক্ট উইন্ডো ওপেন হচ্ছে...
    echo.
    python "%~dp0audio_to_text.py"
) else (
    echo.
    echo [*] নির্বাচিত ফাইল: %~1
    echo.
    python "%~dp0audio_to_text.py" "%~1"
)
