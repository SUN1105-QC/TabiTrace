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

rem The local MySQL instance currently aborts automatic TLS negotiation.
rem Keep an explicitly supplied DB_URL, otherwise use the safe local development URL.
if not defined DB_URL set "DB_URL=jdbc:mysql://127.0.0.1:3306/tabitrace?useUnicode=true&characterEncoding=utf8&serverTimezone=UTC&sslMode=DISABLED"

echo.
echo ============================================
echo   TabiTrace Local Launcher
echo ============================================
echo Frontend: %FRONTEND%
echo Backend : %BACKEND%
echo.

rem Do not start a duplicate backend when its health endpoint is already available.
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:8080/actuator/health' -TimeoutSec 3; if ($r.StatusCode -eq 200) { exit 0 } } catch {}; exit 1" >nul 2>&1
if not errorlevel 1 (
    echo [OK] Backend is already running at http://localhost:8080
) else (
    rem Start backend in a new terminal. Prefer Maven Wrapper when available.
    if exist "%BACKEND%\mvnw.cmd" (
        start "TabiTrace Backend - Local Dev" cmd /k "cd /d ""%BACKEND%"" && call mvnw.cmd -pl api spring-boot:run"
    ) else (
        start "TabiTrace Backend - Local Dev" cmd /k "cd /d ""%BACKEND%"" && call mvn.cmd -pl api spring-boot:run"
    )
    echo [STARTING] Backend terminal opened.
)

rem Use ping for a short delay; unlike timeout it also works with redirected input.
ping 127.0.0.1 -n 3 >nul

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
echo.
echo You may close this launcher window. Keep newly opened service windows running.
ping 127.0.0.1 -n 6 >nul
exit /b 0
