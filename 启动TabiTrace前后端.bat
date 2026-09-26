@echo off
setlocal EnableExtensions
chcp 65001 >nul
title TabiTrace Local Dev Launcher

set "ROOT=%~dp0"

rem Auto-detect frontend project
set "FRONTEND="
if exist "%ROOT%frontend\package.json" set "FRONTEND=%ROOT%frontend"
if not defined FRONTEND if exist "%ROOT%TabiTrace-Frontend-v7-Complete\package.json" set "FRONTEND=%ROOT%TabiTrace-Frontend-v7-Complete"
if not defined FRONTEND if exist "%ROOT%TabiTrace-Frontend-v6-Integrated\package.json" set "FRONTEND=%ROOT%TabiTrace-Frontend-v6-Integrated"

rem Auto-detect backend project
set "BACKEND="
if exist "%ROOT%backend\pom.xml" set "BACKEND=%ROOT%backend"
if not defined BACKEND if exist "%ROOT%TabiTrace-Backend-v6-Integrated\pom.xml" set "BACKEND=%ROOT%TabiTrace-Backend-v6-Integrated"
if not defined BACKEND if exist "%ROOT%TabiTrace-Backend-v5-Integrated\pom.xml" set "BACKEND=%ROOT%TabiTrace-Backend-v5-Integrated"

if not defined FRONTEND (
    echo [ERROR] Frontend project not found.
    echo Put this BAT file in the directory containing frontend or TabiTrace-Frontend-v7-Complete.
    pause
    exit /b 1
)

if not defined BACKEND (
    echo [ERROR] Backend project not found.
    echo Put this BAT file in the directory containing backend or TabiTrace-Backend-v6-Integrated.
    pause
    exit /b 1
)

rem Verify required commands before opening child terminals.
where npm.cmd >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm.cmd was not found in PATH. Install Node.js and reopen this file.
    pause
    exit /b 1
)

if not exist "%BACKEND%\mvnw.cmd" (
    where mvn.cmd >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] mvn.cmd was not found in PATH and the project has no Maven Wrapper.
        pause
        exit /b 1
    )
)
set "MVN=mvn.cmd"
if exist "%BACKEND%\mvnw.cmd" set "MVN=mvnw.cmd"

rem The local MySQL instance currently aborts automatic TLS negotiation.
rem Without TLS, MySQL 8 (caching_sha2_password) needs the server RSA public key for the
rem first login after every MySQL restart; allowPublicKeyRetrieval=true permits that.
rem It is safe here because the connection only goes to 127.0.0.1.
rem Keep an explicitly supplied DB_URL, otherwise use the safe local development URL.
rem The video worker inherits the same DB_URL.
if not defined DB_URL set "DB_URL=jdbc:mysql://127.0.0.1:3306/tabitrace?useUnicode=true&characterEncoding=utf8&serverTimezone=UTC&sslMode=DISABLED&allowPublicKeyRetrieval=true"

rem ---------------------------------------------------------------------------
rem Video rendering needs FFmpeg. Search order: FFMPEG_BINARY, PATH, the repo's
rem .tools folder, then the winget install folder (winget PATH changes only reach
rem newly started programs, so the folder is checked directly as well).
rem ---------------------------------------------------------------------------
if defined FFMPEG_BINARY if not exist "%FFMPEG_BINARY%" set "FFMPEG_BINARY="
if not defined FFMPEG_BINARY for /f "delims=" %%F in ('where ffmpeg.exe 2^>nul') do if not defined FFMPEG_BINARY set "FFMPEG_BINARY=%%F"
if not defined FFMPEG_BINARY if exist "%ROOT%.tools\ffmpeg\bin\ffmpeg.exe" set "FFMPEG_BINARY=%ROOT%.tools\ffmpeg\bin\ffmpeg.exe"
if not defined FFMPEG_BINARY for /d %%D in ("%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg*") do for /d %%E in ("%%D\*") do if not defined FFMPEG_BINARY if exist "%%E\bin\ffmpeg.exe" set "FFMPEG_BINARY=%%E\bin\ffmpeg.exe"

rem With a real worker the API's built-in mock renderer must be off, otherwise it
rem grabs queued videos first and marks them done without producing an MP4.
rem Without FFmpeg keep the mock renderer so the video flow still works for UI work.
set "START_WORKER=0"
if defined FFMPEG_BINARY set "START_WORKER=1"
if not defined VIDEO_MOCK_RENDERER (
    if "%START_WORKER%"=="1" (set "VIDEO_MOCK_RENDERER=false") else (set "VIDEO_MOCK_RENDERER=true")
)

echo.
echo ============================================
echo   TabiTrace Local Launcher
echo ============================================
echo Frontend: %FRONTEND%
echo Backend : %BACKEND%
rem Single-line IFs: a path containing parentheses would break a parenthesized block.
if "%START_WORKER%"=="1" echo FFmpeg  : %FFMPEG_BINARY%
if not "%START_WORKER%"=="1" echo FFmpeg  : not found - videos will use the mock renderer and cannot be played
if not "%START_WORKER%"=="1" echo           Install it with: winget install --id Gyan.FFmpeg -e
echo.

rem Local dev mail catcher (SMTP 127.0.0.1:1025, viewer http://127.0.0.1:1080).
rem Registration sends real SMTP mail; locally it lands here instead of a real mailbox.
rem Skip it when MAIL_HOST points to a real SMTP server or port 1025 is already in use.
if not defined MAIL_HOST (
    powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "if (Get-NetTCPConnection -LocalPort 1025 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }" >nul 2>&1
    if not errorlevel 1 (
        echo [OK] Dev mail catcher is already listening on port 1025.
    ) else (
        start "TabiTrace Dev Mail Catcher" cmd /k "cd /d ""%BACKEND%"" && node scripts\dev-mail-catcher.mjs"
        echo [STARTING] Dev mail catcher opened. View mails at http://127.0.0.1:1080
    )
)

rem Do not start a duplicate backend when its health endpoint is already available.
set "BACKEND_WAS_RUNNING=0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:8080/actuator/health' -TimeoutSec 3; if ($r.StatusCode -eq 200) { exit 0 } } catch {}; exit 1" >nul 2>&1
if not errorlevel 1 (
    set "BACKEND_WAS_RUNNING=1"
    echo [OK] Backend is already running at http://localhost:8080
) else (
    start "TabiTrace Backend - Local Dev" cmd /k "cd /d ""%BACKEND%"" && call %MVN% -pl api spring-boot:run"
    echo [STARTING] Backend terminal opened.
)

rem Use ping for a short delay; unlike timeout it also works with redirected input.
ping 127.0.0.1 -n 3 >nul

rem Video worker: no HTTP port, so detect a running instance by its Java process.
if "%START_WORKER%"=="1" (
    powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "if (Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'java.exe' -and $_.CommandLine -match 'TabiTraceVideoWorkerApplication' }) { exit 0 } else { exit 1 }" >nul 2>&1
    if not errorlevel 1 (
        echo [OK] Video worker is already running.
    ) else (
        call :start_worker
    )
    if "%BACKEND_WAS_RUNNING%"=="1" (
        echo [NOTE] The backend was already running before this launcher. If it was started
        echo        with the mock video renderer, close the backend window and run this file again.
    )
) else (
    echo [SKIPPED] Video worker was not started because FFmpeg was not found.
)

ping 127.0.0.1 -n 2 >nul

rem Do not start a duplicate frontend when port 3000 already serves the app.
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:3000' -TimeoutSec 3; if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { exit 0 } } catch {}; exit 1" >nul 2>&1
if not errorlevel 1 (
    echo [OK] Frontend is already running at http://localhost:3000
) else (
    rem Parenthesizing IF makes npm run dev execute whether node_modules already exists or not.
    start "TabiTrace Frontend - Local Dev" cmd /k "cd /d ""%FRONTEND%"" && (if not exist node_modules call npm.cmd install) && call npm.cmd run dev"
    echo [STARTING] Frontend terminal opened.
)

echo.
echo Frontend default URL: http://localhost:3000
echo Backend default URL : http://localhost:8080
echo Backend health URL  : http://localhost:8080/actuator/health
echo Dev mail viewer     : http://127.0.0.1:1080
echo.
echo You may close this launcher window. Keep newly opened service windows running.
ping 127.0.0.1 -n 6 >nul
exit /b 0

rem ---------------------------------------------------------------------------
rem Start the video worker in its own terminal. Variables set here are local to
rem this launcher and are only inherited by the worker window opened below.
rem Rendered videos go to the frontend's public folder so the dev server serves them.
rem ---------------------------------------------------------------------------
:start_worker
if not defined VIDEO_WORK_DIR set "VIDEO_WORK_DIR=%FRONTEND%\public\generated-videos"
if not defined VIDEO_MUSIC_DIR set "VIDEO_MUSIC_DIR=%FRONTEND%\public\music"
if not defined VIDEO_PUBLIC_BASE_URL set "VIDEO_PUBLIC_BASE_URL=http://localhost:3000/generated-videos"
set "STORAGE_MODE=local"
start "TabiTrace Video Worker - Local Dev" cmd /k "cd /d ""%BACKEND%"" && call %MVN% -pl video-worker spring-boot:run"
echo [STARTING] Video worker terminal opened.
exit /b 0
