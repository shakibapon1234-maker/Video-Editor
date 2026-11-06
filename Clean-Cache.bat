@echo off
title Studio Flow - Clean Cache & Free Disk Space
echo ========================================================
echo   Studio Flow Video Editor - Cache & Disk Cleanup Tool
echo ========================================================
echo.

set "TARGET_DIR=%APPDATA%\studio-flow-video-editor"

if not exist "%TARGET_DIR%" (
    echo [INFO] No Studio Flow AppData cache found.
    goto done
)

echo [1/3] Closing any running Studio Flow processes...
taskkill /f /im electron.exe /fi "WINDOWTITLE eq Studio Flow*" >nul 2>&1

echo [2/3] Cleaning IndexedDB blobs and media cache...
if exist "%TARGET_DIR%\IndexedDB" (
    rmdir /s /q "%TARGET_DIR%\IndexedDB"
    echo   - IndexedDB blobs removed successfully.
)

echo [3/3] Cleaning temporary exports cache...
if exist "%TARGET_DIR%\exports" (
    rmdir /s /q "%TARGET_DIR%\exports"
    echo   - Exports cache removed successfully.
)

echo.
echo [SUCCESS] Studio Flow cache cleaned! C: drive space restored.
echo ========================================================

:done
echo.
pause

