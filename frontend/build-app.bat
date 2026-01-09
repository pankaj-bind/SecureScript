@echo off
setlocal enabledelayedexpansion
echo ========================================
echo SecureScript Build Script
echo ========================================
echo.

cd /d "%~dp0"

:: Step 1: Clean previous build
echo Step 1: Cleaning previous build...
if exist release\win-unpacked rmdir /s /q release\win-unpacked 2>nul
echo Done!
echo.

:: Step 2: Generate icons
echo Step 2: Generating icons...
call node generate-icons.js
if %errorlevel% neq 0 (
    echo ERROR: Icon generation failed!
    pause
    exit /b 1
)
echo Done!
echo.

:: Step 3: Build React app
echo Step 3: Building React app...
set CI=false
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: React build failed!
    pause
    exit /b 1
)
echo Done!
echo.

:: Step 4: Download Electron
echo Step 4: Preparing Electron runtime...
if not exist "node_modules\electron\dist" (
    echo Downloading Electron...
    call npx electron-rebuild
)

:: Step 5: Copy Electron runtime
echo Step 5: Setting up application package...
mkdir release\win-unpacked 2>nul
xcopy /E /I /Y "node_modules\electron\dist\*" "release\win-unpacked\" >nul

:: Step 6: Create app folder and copy files
mkdir "release\win-unpacked\resources\app" 2>nul
xcopy /E /I /Y "build" "release\win-unpacked\resources\app\build" >nul
xcopy /E /I /Y "build-resources" "release\win-unpacked\resources\app\build-resources" >nul
copy /Y "main.js" "release\win-unpacked\resources\app\" >nul
copy /Y "preload.js" "release\win-unpacked\resources\app\" >nul
copy /Y "package.json" "release\win-unpacked\resources\app\" >nul

:: Step 7: Rename executable
if exist "release\win-unpacked\electron.exe" (
    ren "release\win-unpacked\electron.exe" "SecureScript.exe"
)
echo Done!
echo.

:: Step 8: Set application icon
echo Step 6: Setting application icon...
call node -e "const {rcedit} = require('rcedit'); rcedit('release/win-unpacked/SecureScript.exe', {icon: 'build-resources/icon.ico'}).then(() => console.log('Icon set!')).catch(e => console.error(e))"
echo Done!
echo.

echo ========================================
echo BUILD COMPLETE!
echo ========================================
echo.
echo Your application is ready at:
echo   release\win-unpacked\SecureScript.exe
echo.
echo To run the application, double-click:
echo   SecureScript.exe
echo.
pause
