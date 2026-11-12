@echo off
setlocal
title Motion Diagram and Infographic Studio
cd /d "%~dp0"

echo ==============================================================================
echo       Motion Diagram and Infographic Studio (Animated Maker)
echo ==============================================================================
echo.
echo [*] Opening Studio in your default browser...
echo.

start "" "%~dp0motion_diagram_studio.html"

echo [OK] Studio opened in your browser!
echo.
ping 127.0.0.1 -n 3 >nul
exit /b 0
