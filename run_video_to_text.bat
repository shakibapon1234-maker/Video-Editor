@echo off
title Instant Bengali Video to Text Converter
setlocal enabledelayedexpansion
set PATH=%~dp0node_modules\ffmpeg-static;%PATH%
cls

if "%~1"=="" (
    echo =====================================================
    echo    Instant Bengali Video to Text (10-15 Seconds)
    echo =====================================================
    echo.
    echo  HOW TO USE:
    echo  1. Drag and drop your Video/Audio file onto this .bat icon.
    echo  2. Or right-click video file -^> "Copy as path", then paste below:
    echo.
    set /p "VIDEOPATH=  Enter video file path: "
    echo.
    echo [*] Processing video file...
    python "%~dp0fast_bengali_speech.py" "!VIDEOPATH!"
) else (
    echo.
    echo [*] Selected File: %~1
    echo [*] Processing video to Bengali text...
    echo.
    python "%~dp0fast_bengali_speech.py" "%~1"
)

echo.
echo =====================================================
echo [*] Done!
echo =====================================================
pause
