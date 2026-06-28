param(
    [switch]$CheckPortsOnly,
    [string]$FrontendUrl = "http://127.0.0.1:3300/",
    [string]$BackendUrl = "http://127.0.0.1:8300"
)

$ErrorActionPreference = "Stop"

function Get-ListeningProcessIds {
    param([int]$Port)

    if (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue) {
        $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        return @($connection | ForEach-Object { $_.OwningProcess } | Sort-Object -Unique)
    }

    if (Get-Command lsof -ErrorAction SilentlyContinue) {
        $output = & lsof -tiTCP:$Port -sTCP:LISTEN 2>$null
        return @($output | Where-Object { $_ } | ForEach-Object { [int]$_ } | Sort-Object -Unique)
    }

    throw "Cannot inspect port $Port because neither Get-NetTCPConnection nor lsof is available."
}

function Test-PortAvailable {
    param([int]$Port)

    $processIds = Get-ListeningProcessIds -Port $Port
    if ($processIds) {
        throw "Port $Port is already in use."
    }
    Write-Host "Port $Port is available."
}

if ($CheckPortsOnly) {
    Test-PortAvailable -Port 3300
    Test-PortAvailable -Port 8300
    return
}

Write-Host "Checking backend health..."
$health = Invoke-RestMethod "$BackendUrl/api/health"
if (-not $health.ok) {
    throw "Backend health check failed."
}
Write-Host "Backend OK: $($health.service)"

Write-Host "Checking frontend..."
$frontend = Invoke-WebRequest $FrontendUrl
if ($frontend.StatusCode -ne 200) {
    throw "Frontend returned HTTP $($frontend.StatusCode)."
}
Write-Host "Frontend OK: $FrontendUrl"

Write-Host "Checking model-assisted fallback..."
$payload = @{
    outputType = "story"
    promptId = "robot-orientation-story"
    style = "clear"
    creativity = "balanced"
    length = "medium"
    constraint = "include-robot"
    steps = 5
    mode = "model-assisted"
} | ConvertTo-Json

$response = Invoke-RestMethod "$BackendUrl/api/refine" -Method Post -ContentType "application/json" -Body $payload
Write-Host "Model-assisted response mode: $($response.mode)"
