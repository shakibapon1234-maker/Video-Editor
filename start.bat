@echo off
cd /d "%~dp0"
npm run electron

if errorlevel 1 (
    echo.
    echo Desktop app could not start.
    pause
)
