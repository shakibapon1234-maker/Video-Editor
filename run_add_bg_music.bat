@echo off
title Fast Background Music Adder with Auto-Ducking
chcp 65001 >nul
setlocal enabledelayedexpansion
set PATH=%~dp0node_modules\ffmpeg-static;%PATH%
cls

if "%~1"=="" (
    python "%~dp0add_bg_music.py"
) else if "%~2"=="" (
    echo =====================================================
    echo    Fast Background Music Adder (Auto-Ducking)
    echo =====================================================
    echo.
    echo [*] ভিডিও ফাইল সিলেক্টেড: %~1
    echo.
    set /p "AUDIOPATH=  ব্যাকগ্রাউন্ড মিউজিক (MP3/WAV) পাথ দিন: "
    echo.
    python "%~dp0add_bg_music.py" "%~1" "!AUDIOPATH!"
) else (
    python "%~dp0add_bg_music.py" "%~1" "%~2"
)

