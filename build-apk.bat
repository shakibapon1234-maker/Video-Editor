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

REM Point Gradle/Android tools at the correct SDK and JDK
set "ANDROID_HOME=C:\Users\Lenovo\AppData\Local\Android\Sdk"
set "ANDROID_SDK_ROOT=C:\Users\Lenovo\AppData\Local\Android\Sdk"
set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot"
set "GRADLE_USER_HOME=C:\Users\Lenovo\.gradle"
set "PATH=%JAVA_HOME%\bin;%PATH%"


echo [0/5] Refreshing www\ from latest source (auto-sync)...
if not exist "www" mkdir "www"
copy /Y *.js www\ >nul
copy /Y *.css www\ >nul
copy /Y *.html www\ >nul
copy /Y *.json www\ >nul
if exist "public" (
    if not exist "www\public" mkdir "www\public"
    robocopy "public" "www\public" /E /R:1 /W:1 /NFL /NDL /NJH /NJS >nul
)
if exist "assets" (
    if not exist "www\assets" mkdir "www\assets"
    robocopy "assets" "www\assets" /E /R:1 /W:1 /NFL /NDL /NJH /NJS >nul
)

REM Make sure Capacitor android platform exists (only first time)
if not exist "android" (
    echo [1/5] Adding Capacitor Android platform - first time only...
    call npx cap add android
) else (
    echo [1/5] Android platform already present, skipping add.
)

echo [2/5] Syncing latest code into Android project...
call npx cap sync android

echo [2.5/5] Pointing Gradle to the correct Android SDK and JDK...
echo sdk.dir=C:/Users/Lenovo/AppData/Local/Android/Sdk>android\local.properties
set "GRADLE_PROP=android\gradle.properties"
findstr /C:"org.gradle.java.home" "%GRADLE_PROP%" >nul 2>&1 || echo org.gradle.java.home=C:/Program Files/Eclipse Adoptium/jdk-21.0.12.101-hotspot>>"%GRADLE_PROP%"

echo [3/5] Building debug APK (this can take a few minutes)...
cd android
call gradlew.bat assembleDebug
if errorlevel 1 (
    echo.
    echo BUILD FAILED. See errors above.
    cd ..
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
