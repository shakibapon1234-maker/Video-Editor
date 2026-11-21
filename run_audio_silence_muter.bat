@echo off
title Instant Silence Muter & Voice Gate (স্বাধীন সাইলেন্স মিউটার)
chcp 65001 >nul
setlocal enabledelayedexpansion

:: Add local ffmpeg-static to PATH if it exists
if exist "%~dp0node_modules\ffmpeg-static\ffmpeg.exe" (
    set "PATH=%~dp0node_modules\ffmpeg-static;%PATH%"
)
cls

if "%~1"=="" (
    echo ==============================================================================
    echo     ⚡ Instant Silence Muter & Voice Gate (স্বাধীন সাইলেন্স মিউটার)
    echo ==============================================================================
    echo.
    echo   বৈশিষ্ট্য:
    echo     * ভিডিও কাটবে না, ফ্রেম রেন্ডারিং ছাড়া মাত্র ৫-১০ সেকেন্ডে এক্সপোর্ট হবে!
    echo     * কথার সময় ভয়েস ১০০%% অক্ষুণ্ণ থাকবে, নীরবতার সময় ব্যাকগ্রাউন্ড নয়েজ মিউট।
    echo.
    echo   সমর্থিত ফরম্যাটসমূহ:
    echo     * ভিডিও: MP4, MKV, MOV, WEBM, AVI ইত্যাদি
    echo     * অডিও: MP3, WAV, M4A, AAC, OPUS, OGG ইত্যাদি
    echo.
    echo   [*] ফাইল সিলেক্ট করার উইন্ডো ওপেন হচ্ছে...
    echo.
    python "%~dp0audio_silence_muter.py"
) else (
    echo.
    echo [*] নির্বাচিত ফাইল: %~1
    echo.
    python "%~dp0audio_silence_muter.py" "%~1"
)
