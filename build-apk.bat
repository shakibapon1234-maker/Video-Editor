@echo off
REM ============================================================
REM  One-click APK builder for Video Editor (Mobile)
REM  - Sets ANDROID_HOME + JDK so Gradle finds the D: SDK
REM  - Refreshes www\ from your latest source (auto-sync)
REM  - Syncs your latest code into the Android project
REM  - Builds a debug APK using Gradle (no need to open Android Studio)
REM  - Copies the APK to apk-out\ for easy transfer
REM
REM  First run: creates the android\ folder automatically.
REM  Later runs: re-syncs + rebuilds your latest changes.
REM ============================================================
setlocal EnableDelayedExpansion
cd /d "%~dp0"

REM Point Gradle/Android tools at the D: install (no need for Android Studio)
set "ANDROID_HOME=D:\Android\Sdk"
set "ANDROID_SDK_ROOT=D:\Android\Sdk"
set "JAVA_HOME=D:\JDK21"

echo [0/5] Refreshing www\ from latest source (auto-sync)...
if not exist "www" mkdir "www"
for %%i in (index.html style.css audio.js editor.js exporter.js render-engine.js phase9.js package.json capacitor.config.json) do (
    if exist "%%i" copy /Y "%%i" "www\%%i" >nul
)
if exist "public" (
    if not exist "www\public" mkdir "www\public"
    robocopy "public" "www\public" /E /R:1 /W:1 /NFL /NDL /NJH /NJS >nul
)

REM Make sure Capacitor android platform exists (only first time)
if not exist "android" (
    echo [1/5] Adding Capacitor Android platform (first time only)...
    call npx cap add android
) else (
    echo [1/5] Android platform already present, skipping add.
)

echo [2/5] Syncing latest code into Android project...
call npx cap sync android

echo [2.5/5] Pointing Gradle to the D: Android SDK and JDK 21...
echo sdk.dir=D:\Android\Sdk>android\local.properties
set "GRADLE_PROP=android\gradle.properties"
findstr /C:"org.gradle.java.home" "%GRADLE_PROP%" >nul 2>&1 || echo org.gradle.java.home=D:\JDK21>>"%GRADLE_PROP%"

echo [3/5] Building debug APK (this can take a few minutes)...
cd android
call gradlew.bat assembleDebug
if errorlevel 1 (
    echo.
    echo BUILD FAILED. See errors above.
    cd ..
    pause
    exit /b 1
)
cd ..

echo [4/5] Copying APK to apk-out\ ...
if not exist "apk-out" mkdir "apk-out"
for /r "android\app\build\outputs\apk\debug" %%f in (*.apk) do (
    copy /Y "%%f" "apk-out\video-editor-debug.apk" >nul
)

echo [5/5] DONE.
echo ============================================================
echo  APK READY in: apk-out\
dir apk-out\*.apk
echo ============================================================
echo  Transfer this APK to your phone and install it.
echo ============================================================
