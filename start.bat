@echo off
setlocal
cd /d "%~dp0"
title Studio Flow Video Editor

where node >nul 2>&1
if errorlevel 1 (
    echo Node.js was not found. Install Node.js LTS, then run this file again.
    pause
    exit /b 1
)

if not exist "node_modules\electron\dist\electron.exe" (
    echo Installing required packages. Please wait...
    call npm ci
    if errorlevel 1 (
        echo.
        echo Package installation failed. Check your internet connection and try again.
        pause
        exit /b 1
    )
)

echo Starting Studio Flow Video Editor...
"%CD%\node_modules\electron\dist\electron.exe" .
set "START_EXIT=%ERRORLEVEL%"

if not "%START_EXIT%"=="0" (
    echo.
    echo Desktop app closed with error code %START_EXIT%.
    pause
)
