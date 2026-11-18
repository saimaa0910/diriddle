@echo off
setlocal
echo ========================================================
echo   Launching diriddle Admin Windows Installer...
echo ========================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-admin-desktop.ps1"
if %ERRORLEVEL% EQU 0 (
    echo.
    echo Press any key to launch diriddle Admin Desktop...
    pause >nul
    start "" "%LOCALAPPDATA%\Programs\diriddle-admin\diriddle-admin.exe"
) else (
    echo.
    echo Installation encountered an error.
    pause
)
