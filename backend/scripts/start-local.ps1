[CmdletBinding()]
param([ValidateSet('all', 'api', 'worker', 'frontend', 'mail')][string]$Service = 'all')

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$backend = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'
$logs = Join-Path $backend '.tabitrace/local-dev'
$scriptFile = $PSCommandPath
$startupLock = $null
$hasStartupLock = $false
$transcribing = $false

function Resolve-Tool([string]$Name, [string[]]$HomeVariables = @()) {
    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }

    # Explorer may still have the PATH from before a tool was installed.
    # Supplement it only when a required command cannot already be resolved.
    $candidates = @()
    foreach ($variable in $HomeVariables) {
        $toolHome = [Environment]::GetEnvironmentVariable($variable, 'Process')
        if ($toolHome) { $candidates += Join-Path $toolHome 'bin' }
    }
    foreach ($scope in @('User', 'Machine')) {
        $candidates += ([Environment]::GetEnvironmentVariable('Path', $scope) -split ';')
    }
    foreach ($directory in $candidates) {
        if (-not $directory) { continue }
        $directory = [Environment]::ExpandEnvironmentVariables($directory.Trim().Trim('"'))
        $candidate = Join-Path $directory $Name
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
            $env:Path = "$directory;$env:Path"
            return $candidate
        }
    }
    throw "Required tool $Name was not found. Install it or update PATH, then reopen the launcher."
}

function Set-DefaultEnv([string]$Name, [string]$Value) {
    if (-not [Environment]::GetEnvironmentVariable($Name, 'Process')) {
        [Environment]::SetEnvironmentVariable($Name, $Value, 'Process')
    }
}

function Find-Maven {
    $wrapper = Join-Path $backend 'mvnw.cmd'
    if (Test-Path -LiteralPath $wrapper) { return $wrapper }
    return Resolve-Tool 'mvn.cmd' @('MAVEN_HOME', 'M2_HOME')
}

function Test-Port([int]$Port) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $pending = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
        if (-not $pending.AsyncWaitHandle.WaitOne(500)) { return $false }
        $client.EndConnect($pending)
        return $true
    } catch { return $false } finally { $client.Close() }
}

function Test-Ready([string]$Name) {
    try {
        if ($Name -eq 'api') {
            if (-not (Test-Port 8080)) { return $false }
            $health = Invoke-RestMethod -Uri 'http://localhost:8080/actuator/health' -TimeoutSec 3
            $plans = Invoke-RestMethod -Uri 'http://localhost:8080/api/v1/plans/trip-pro' -TimeoutSec 3
            return ($health.status -eq 'UP' -and $plans.success -eq $true)
        }
        if ($Name -eq 'frontend') {
            if (-not (Test-Port 3000)) { return $false }
            $page = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:3000' -TimeoutSec 15
            return ($page.StatusCode -eq 200 -and $page.Content -match 'TabiTrace')
        }
        return ((Test-Port 1025) -and (Test-Port 1080))
    } catch { return $false }
}

function Start-ServiceProcess([string]$Name) {
    # A previous launcher can time out while Maven/Next is still starting.
    # Reuse its live runner even before the HTTP port begins listening.
    $existing = Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" |
        Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -like "*$scriptFile*" -and $_.CommandLine -match "-Service\s+$Name\b" } |
        Select-Object -First 1
    if ($existing) {
        Write-Host "[WAITING] Reusing existing $Name startup (PID $($existing.ProcessId))."
        return Get-Process -Id $existing.ProcessId -ErrorAction Stop
    }
    $outLog = Join-Path $logs "$Name.log"
    $errLog = Join-Path $logs "$Name.err.log"
    # Each child runs this same file in service mode. No shell-built project paths.
    $arguments = @('-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', ('"{0}"' -f $scriptFile), '-Service', $Name)
    $child = Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput $outLog -RedirectStandardError $errLog -PassThru
    Write-Host "[STARTING] $Name (PID $($child.Id))"
    return $child
}

function Wait-Ready([string]$Name, $Child, [int]$Seconds = 180) {
    $deadline = [DateTime]::UtcNow.AddSeconds($Seconds)
    $nextNotice = [DateTime]::UtcNow
    while ([DateTime]::UtcNow -lt $deadline) {
        $Child.Refresh()
        if ($Child.HasExited) {
            throw "$Name exited with code $($Child.ExitCode). Check $logs\$Name.log and $Name.err.log"
        }
        if (Test-Ready $Name) { Write-Host "[OK] $Name is ready."; return }
        if ([DateTime]::UtcNow -ge $nextNotice) {
            Write-Host "[WAITING] $Name is starting / compiling. Log: $logs\$Name.log"
            $nextNotice = [DateTime]::UtcNow.AddSeconds(10)
        }
        Start-Sleep -Seconds 1
    }
    throw "$Name did not become ready within $Seconds seconds. Check $logs\$Name.log and $Name.err.log before retrying."
}

function Show-RecentErrors {
    foreach ($name in @('api', 'frontend', 'worker', 'mail')) {
        foreach ($suffix in @('err.log', 'log')) {
            $path = Join-Path $logs "$name.$suffix"
            if (-not (Test-Path -LiteralPath $path)) { continue }
            # Only print diagnostic lines, never dump configuration or environment values.
            $lines = @(Get-Content -LiteralPath $path -Tail 80 -ErrorAction SilentlyContinue |
                Where-Object { $_ -match '(^\[ERROR\]| ERROR |Exception:|Error:|EADDRINUSE|BUILD FAILURE|Failed to|Cannot find)' } |
                Select-Object -Last 6)
            if ($lines.Count -gt 0) {
                Write-Host "[LOG] $path"
                $lines | ForEach-Object { Write-Host $_ }
            }
        }
    }
}

try {
    if ($Service -ne 'all') {
        # Redirected native stderr must remain a log stream in Windows PowerShell 5.1.
        $ErrorActionPreference = 'Continue'
        if ($Service -eq 'frontend') {
            Set-Location -LiteralPath $frontend
            if (-not (Test-Path -LiteralPath 'node_modules/next/package.json')) {
                & npm.cmd ci
                if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
            }
            & npm.cmd run dev -- --port 3000
        } elseif ($Service -eq 'mail') {
            Set-Location -LiteralPath $backend
            & node.exe scripts/dev-mail-catcher.mjs
        } else {
            Set-Location -LiteralPath $backend
            $module = if ($Service -eq 'api') { 'api' } else { 'video-worker' }
            & (Find-Maven) -B -ntp -pl $module spring-boot:run
        }
        exit $LASTEXITCODE
    }

    $null = New-Item -ItemType Directory -Path $logs -Force
    # A named lock prevents two double-clicks from racing to launch the same ports.
    $hash = [Security.Cryptography.SHA256]::Create()
    try { $lockKey = [BitConverter]::ToString($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes($root.ToLowerInvariant()))).Replace('-', '') }
    finally { $hash.Dispose() }
    $startupLock = New-Object Threading.Mutex($false, "Local\TabiTrace-Start-$lockKey")
    try { $hasStartupLock = $startupLock.WaitOne(0) }
    catch [Threading.AbandonedMutexException] { $hasStartupLock = $true }
    if (-not $hasStartupLock) {
        throw "Another TabiTrace launcher is already starting services. Wait for that window. Logs: $logs"
    }
    try {
        $null = Start-Transcript -Path (Join-Path $logs 'launcher.log') -Append -ErrorAction Stop
        $transcribing = $true
    } catch { Write-Host '[NOTE] Cannot save launcher transcript; service logs are still available.' }

    Write-Host "TabiTrace local development - logs: $logs"
    foreach ($file in @((Join-Path $backend 'pom.xml'), (Join-Path $frontend 'package.json'))) {
        if (-not (Test-Path -LiteralPath $file)) { throw "Project file not found: $file" }
    }
    foreach ($command in @('node.exe', 'npm.cmd')) { $null = Resolve-Tool $command }
    $null = Resolve-Tool 'java.exe' @('JAVA_HOME')
    $null = Find-Maven
    Set-DefaultEnv 'DB_URL' 'jdbc:mysql://127.0.0.1:3306/tabitrace?useUnicode=true&characterEncoding=utf8&serverTimezone=UTC&sslMode=DISABLED&allowPublicKeyRetrieval=true'
    Set-DefaultEnv 'SPRING_PROFILES_ACTIVE' 'local'
    Set-DefaultEnv 'STORAGE_MODE' 'local'
    Set-DefaultEnv 'VIDEO_WORK_DIR' (Join-Path $frontend 'public/generated-videos')
    Set-DefaultEnv 'VIDEO_MUSIC_DIR' (Join-Path $backend 'api/.tabitrace/uploads')
    Set-DefaultEnv 'VIDEO_PUBLIC_BASE_URL' 'http://localhost:3000/generated-videos'

    if (-not $env:FFMPEG_BINARY) {
        $ffmpeg = Get-Command ffmpeg.exe -ErrorAction SilentlyContinue
        if ($ffmpeg) { $env:FFMPEG_BINARY = $ffmpeg.Source }
        if (-not $env:FFMPEG_BINARY) {
            $candidates = @((Join-Path $root '.tools/ffmpeg/bin/ffmpeg.exe'))
            $candidates += @(Get-ChildItem "$env:LOCALAPPDATA/Microsoft/WinGet/Packages/Gyan.FFmpeg*/*/bin/ffmpeg.exe" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName)
            $env:FFMPEG_BINARY = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
        }
    }
    $useWorker = [bool]$env:FFMPEG_BINARY
    if ($useWorker) {
        & $env:FFMPEG_BINARY -version *> $null
        if ($LASTEXITCODE -ne 0) { throw 'FFMPEG_BINARY does not point to a working FFmpeg executable.' }
    }
    Set-DefaultEnv 'VIDEO_MOCK_RENDERER' $(if ($useWorker) { 'false' } else { 'true' })
    if ($useWorker -and $env:VIDEO_MOCK_RENDERER -ne 'false') {
        $useWorker = $false
        Write-Host '[NOTE] VIDEO_MOCK_RENDERER is enabled; real worker will not be started.'
    }
    if (-not $useWorker) { Write-Host '[NOTE] Using mock rendering. Install FFmpeg to generate playable videos.' }

    if ($env:DB_URL -match '^jdbc:mysql://(127\.0\.0\.1|localhost)(?::(\d+))?/') {
        $databasePort = if ($Matches[2]) { [int]$Matches[2] } else { 3306 }
        if (-not (Test-Port $databasePort)) {
            throw "Local MySQL is not listening on port $databasePort. Start your MySQL service or Docker database, then retry."
        }
    }
    if (-not $env:MAIL_HOST) {
        if ((Test-Port 1025) -and (Test-Port 1080)) {
            Write-Host '[OK] Local mail service is already listening.'
        } elseif ((Test-Port 1025) -or (Test-Port 1080)) {
            throw 'Mail port 1025 or 1080 is occupied. Check the existing mail service before retrying.'
        } else {
            $mail = Start-ServiceProcess 'mail'
            Wait-Ready 'mail' $mail 20
        }
    }

    if (Test-Port 8080) {
        if (-not (Test-Ready 'api')) { throw 'Port 8080 is occupied but the TabiTrace API is not healthy. Check that process before retrying.' }
        Write-Host '[OK] TabiTrace API is already running.'
    } else {
        $api = Start-ServiceProcess 'api'
        # A cold Maven dependency scan on Windows can take several minutes.
        Wait-Ready 'api' $api 420
    }

    # API readiness includes successful Flyway migration. Only then may the worker poll SQL.
    if ($useWorker) {
        $processes = @(Get-CimInstance Win32_Process)
        $existingWorker = @($processes | Where-Object {
            if ($_.Name -ne 'java.exe' -or $_.CommandLine -notmatch 'com\.tabitrace\.worker\.TabiTraceVideoWorkerApplication') { return $false }
            $parentId = $_.ParentProcessId
            $parent = $processes | Where-Object { $_.ProcessId -eq $parentId } | Select-Object -First 1
            return ($parent -and $parent.CommandLine -like "*$backend*")
        })
        if ($existingWorker.Count -gt 0) {
            Write-Host '[OK] This project video worker is already running.'
        } else {
            $worker = Start-ServiceProcess 'worker'
            $workerReady = $false
            $nextWorkerNotice = [DateTime]::UtcNow
            $deadline = [DateTime]::UtcNow.AddSeconds(300)
            while ([DateTime]::UtcNow -lt $deadline) {
                $worker.Refresh()
                if ($worker.HasExited) { throw "Video worker exited. Check $logs\worker.log and worker.err.log" }
                if (Select-String -LiteralPath (Join-Path $logs 'worker.log') -Pattern 'Started TabiTraceVideoWorkerApplication' -Quiet) { $workerReady = $true; break }
                if (-not $nextWorkerNotice -or [DateTime]::UtcNow -ge $nextWorkerNotice) {
                    Write-Host "[WAITING] Video worker is starting. Log: $logs\worker.log"
                    $nextWorkerNotice = [DateTime]::UtcNow.AddSeconds(10)
                }
                Start-Sleep -Seconds 1
            }
            if (-not $workerReady) { throw "Video worker did not become ready. Check $logs\worker.log" }
            Write-Host '[OK] Video worker is ready.'
        }
    }

    if (Test-Port 3000) {
        if (-not (Test-Ready 'frontend')) {
            # Hot updates and the first compilation can exceed one HTTP timeout.
            # Wait only when this port belongs to this project's Next.js process.
            $listener = Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object -First 1
            $owner = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)"
            $parent = Get-CimInstance Win32_Process -Filter "ProcessId = $($owner.ParentProcessId)"
            if (-not $owner -or -not $parent -or $parent.CommandLine -notlike "*$frontend*next*") {
                throw 'Port 3000 is occupied by another service. Check that process before retrying.'
            }
            Write-Host '[WAITING] Existing TabiTrace frontend is compiling.'
            Wait-Ready 'frontend' (Get-Process -Id $listener.OwningProcess) 360
        }
        Write-Host '[OK] TabiTrace frontend is already running.'
    } else {
        $web = Start-ServiceProcess 'frontend'
        Wait-Ready 'frontend' $web 360
    }
    Write-Host ''
    Write-Host '[READY] Frontend: http://localhost:3000'
    Write-Host '[READY] API health: http://localhost:8080/actuator/health'
    Write-Host '[INFO] Mail viewer (default): http://127.0.0.1:1080'
    Write-Host "[INFO] Services run in the background. Logs: $logs"
    exit 0
} catch {
    Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
    if ($hasStartupLock) { Show-RecentErrors }
    exit 1
} finally {
    if ($transcribing) { $null = Stop-Transcript -ErrorAction SilentlyContinue }
    if ($hasStartupLock) { $startupLock.ReleaseMutex() }
    if ($startupLock) { $startupLock.Dispose() }
}
