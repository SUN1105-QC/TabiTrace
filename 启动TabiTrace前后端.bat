@echo off
setlocal EnableExtensions
chcp 65001 >nul
title TabiTrace Local Dev Launcher

rem Use the Windows PowerShell path even when Explorer has an outdated PATH.
if not exist "%~dp0backend\scripts\start-local.ps1" (
    echo Startup script not found: "%~dp0backend\scripts\start-local.ps1"
    pause
    exit /b 1
)
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0backend\scripts\start-local.ps1"
set "LAUNCH_RESULT=%ERRORLEVEL%"
if not "%LAUNCH_RESULT%"=="0" (
    echo.
    echo Startup failed. Review the error above and the logs in:
    echo "%~dp0backend\.tabitrace\local-dev"
    pause
    exit /b %LAUNCH_RESULT%
)
echo.
echo Frontend: http://localhost:3000
echo API health: http://localhost:8080/actuator/health
echo Services run in the background. Closing this window will not stop them.
echo Press any key to close this launcher.
pause >nul
exit /b 0
