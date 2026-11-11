@echo off
title Instant Bengali Video to Text Converter (ভিডিও থেকে বাংলা টেক্সট)
chcp 65001 >nul
setlocal enabledelayedexpansion

:: Add local ffmpeg-static to PATH if it exists (project folder use)
if exist "%~dp0node_modules\ffmpeg-static\ffmpeg.exe" (
    set "PATH=%~dp0node_modules\ffmpeg-static;%PATH%"
)
cls

if "%~1"=="" (
    echo ==============================================================================
    echo     ⚡ Instant Bengali Video to Text Converter (ভিডিও থেকে বাংলা টেক্সট)
    echo ==============================================================================
    echo.
    echo   ব্যবহারের নিয়ম:
    echo   * ফাইল সিলেক্টর উইন্ডো থেকে ভিডিও ফাইল সিলেক্ট করুন।
    echo   * অথবা যেকোনো ভিডিও ফাইল ড্র্যাগ করে এনে এখানে ছেড়ে দিন।
    echo.
    echo   [*] ফাইল সিলেক্ট উইন্ডো ওপেন হচ্ছে...
    echo.
    python "%~dp0video_to_text.py"
) else (
    echo.
    echo [*] নির্বাচিত ভিডিও ফাইল: %~1
    echo.
    python "%~dp0video_to_text.py" "%~1"
)
