@echo off
setlocal EnableExtensions
chcp 65001 >nul
title TabiTrace Local Dev Launcher

rem Keep the entry point double-clickable; the helper checks readiness and saves logs.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0backend\scripts\start-local.ps1"
set "LAUNCH_RESULT=%ERRORLEVEL%"
if not "%LAUNCH_RESULT%"=="0" (
    echo.
    echo Startup failed. Review the error above and backend\.tabitrace\local-dev logs.
    pause
    exit /b %LAUNCH_RESULT%
)
echo.
echo Services are ready. You can close this window.
ping 127.0.0.1 -n 4 >nul
exit /b 0
