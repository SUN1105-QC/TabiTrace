[CmdletBinding()]
param([ValidateSet('all', 'api', 'worker', 'frontend', 'mail')][string]$Service = 'all')

$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$backend = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'
$logs = Join-Path $backend '.tabitrace/local-dev'
$scriptFile = $PSCommandPath

function Set-DefaultEnv([string]$Name, [string]$Value) {
    if (-not [Environment]::GetEnvironmentVariable($Name, 'Process')) {
        [Environment]::SetEnvironmentVariable($Name, $Value, 'Process')
    }
}

function Find-Maven {
    $wrapper = Join-Path $backend 'mvnw.cmd'
    if (Test-Path -LiteralPath $wrapper) { return $wrapper }
    return (Get-Command mvn.cmd -ErrorAction Stop).Source
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
            $health = Invoke-RestMethod -Uri 'http://localhost:8080/actuator/health' -TimeoutSec 3
            $plans = Invoke-RestMethod -Uri 'http://localhost:8080/api/v1/plans/trip-pro' -TimeoutSec 3
            return ($health.status -eq 'UP' -and $plans.success -eq $true)
        }
        if ($Name -eq 'frontend') {
            $page = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:3000' -TimeoutSec 5
            return ($page.StatusCode -eq 200 -and $page.Content -match 'TabiTrace')
        }
        return ((Test-Port 1025) -and (Test-Port 1080))
    } catch { return $false }
}

function Start-ServiceProcess([string]$Name) {
    $outLog = Join-Path $logs "$Name.log"
    $errLog = Join-Path $logs "$Name.err.log"
    # Each child runs this same file in service mode. No shell-built project paths.
    $arguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"{0}"' -f $scriptFile), '-Service', $Name)
    $child = Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput $outLog -RedirectStandardError $errLog -PassThru
    Write-Host "[STARTING] $Name (PID $($child.Id))"
    return $child
}

function Wait-Ready([string]$Name, $Child, [int]$Seconds = 180) {
    $deadline = [DateTime]::UtcNow.AddSeconds($Seconds)
    while ([DateTime]::UtcNow -lt $deadline) {
        $Child.Refresh()
        if ($Child.HasExited) {
            throw "$Name exited with code $($Child.ExitCode). Check $logs\$Name.log and $Name.err.log"
        }
        if (Test-Ready $Name) { Write-Host "[OK] $Name is ready."; return }
        Start-Sleep -Seconds 1
    }
    throw "$Name did not become ready within $Seconds seconds. Check $logs\$Name.log and $Name.err.log before retrying."
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

    foreach ($file in @((Join-Path $backend 'pom.xml'), (Join-Path $frontend 'package.json'))) {
        if (-not (Test-Path -LiteralPath $file)) { throw "Project file not found: $file" }
    }
    foreach ($command in @('node.exe', 'npm.cmd', 'java.exe')) { $null = Get-Command $command -ErrorAction Stop }
    $null = Find-Maven
    $null = New-Item -ItemType Directory -Path $logs -Force
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

    Write-Host "TabiTrace local development - logs: $logs"
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
        Wait-Ready 'api' $api
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
            $deadline = [DateTime]::UtcNow.AddSeconds(120)
            while ([DateTime]::UtcNow -lt $deadline) {
                $worker.Refresh()
                if ($worker.HasExited) { throw "Video worker exited. Check $logs\worker.log and worker.err.log" }
                if (Select-String -LiteralPath (Join-Path $logs 'worker.log') -Pattern 'Started TabiTraceVideoWorkerApplication' -Quiet) { $workerReady = $true; break }
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
            Wait-Ready 'frontend' (Get-Process -Id $listener.OwningProcess) 240
        }
        Write-Host '[OK] TabiTrace frontend is already running.'
    } else {
        $web = Start-ServiceProcess 'frontend'
        Wait-Ready 'frontend' $web 240
    }
    Write-Host ''
    Write-Host '[READY] Frontend: http://localhost:3000'
    Write-Host '[READY] API health: http://localhost:8080/actuator/health'
    Write-Host '[INFO] Mail viewer (default): http://127.0.0.1:1080'
    Write-Host "[INFO] Services run in the background. Logs: $logs"
    exit 0
} catch {
    Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
