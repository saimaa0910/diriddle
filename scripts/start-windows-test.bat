@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-windows-test.ps1" %*
endlocal
