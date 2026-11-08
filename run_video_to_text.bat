@echo off
title Instant Bengali Video to Text Converter
chcp 65001 >nul
setlocal enabledelayedexpansion
set PATH=%~dp0node_modules\ffmpeg-static;%PATH%
cls

if "%~1"=="" (
    echo =====================================================
    echo    Instant Bengali Video to Text (বাংলা টেক্সট কনভার্টার)
    echo =====================================================
    echo.
    echo  ব্যবহারের নিয়ম:
    echo  ১. যেকোনো ভিডিও বা অডিও ফাইল ড্র্যাগ করে এনে এখানে ছেড়ে দিন।
    echo  ২. অথবা ফাইলের ওপর রাইট ক্লিক করে "Copy as path" করে নিচে পেস্ট করুন:
    echo.
    set /p "VIDEOPATH=  Enter video file path: "
    echo.
    python "%~dp0video_to_text.py" "!VIDEOPATH!"
) else (
    echo.
    echo [*] Selected File: %~1
    echo.
    python "%~dp0video_to_text.py" "%~1"
)
