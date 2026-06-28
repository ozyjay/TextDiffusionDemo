param(
    [int]$FrontendPort = 3300,
    [int]$BackendPort = 8300
)

$ErrorActionPreference = "Stop"

function Get-ListeningProcessIds {
    param([int]$Port)

    if (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue) {
        $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        return @($connections | ForEach-Object { $_.OwningProcess } | Sort-Object -Unique)
    }

    if (Get-Command lsof -ErrorAction SilentlyContinue) {
        $output = & lsof -tiTCP:$Port -sTCP:LISTEN 2>$null
        return @($output | Where-Object { $_ } | ForEach-Object { [int]$_ } | Sort-Object -Unique)
    }

    throw "Cannot inspect port $Port because neither Get-NetTCPConnection nor lsof is available."
}

function Stop-ReservedPort {
    param([int]$Port)

    $processIds = Get-ListeningProcessIds -Port $Port
    if (-not $processIds) {
        Write-Host "Port $Port is clear."
        return
    }

    foreach ($processId in $processIds) {
        Write-Host "Stopping process on reserved port $Port`: $processId"
        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
}

function Stop-MatchingProcess {
    param([string]$Pattern)

    if (Get-Command Get-CimInstance -ErrorAction SilentlyContinue) {
        $processes = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
            Where-Object { $_.CommandLine -and $_.CommandLine -like "*$Pattern*" }

        foreach ($process in $processes) {
            Write-Host "Stopping previous Text Diffusion Lab process: $($process.ProcessId)"
            Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
        }
        return
    }

    if (Get-Command pgrep -ErrorAction SilentlyContinue) {
        $processIds = & pgrep -f $Pattern 2>$null
        foreach ($processId in $processIds) {
            Write-Host "Stopping previous Text Diffusion Lab process: $processId"
            Stop-Process -Id ([int]$processId) -Force -ErrorAction SilentlyContinue
        }
    }
}

Stop-ReservedPort -Port $FrontendPort
Stop-ReservedPort -Port $BackendPort
Stop-MatchingProcess -Pattern "tsx watch server/index.ts"
Stop-MatchingProcess -Pattern "vite --host 127.0.0.1 --port $FrontendPort"
Stop-MatchingProcess -Pattern "concurrently -k -n server,client"

Start-Sleep -Milliseconds 500

& "$PSScriptRoot\smoke.ps1" -CheckPortsOnly
