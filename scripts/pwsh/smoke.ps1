param(
    [switch]$CheckPortsOnly,
    [string]$FrontendUrl = "http://127.0.0.1:3300/",
    [string]$BackendUrl = "http://127.0.0.1:8300",
    [string]$AdapterUrl = "http://127.0.0.1:8600"
)

$ErrorActionPreference = "Stop"

function Test-PortAvailable {
    param([int]$Port)

    $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($connection) {
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

Write-Host "Checking adapter health if available..."
try {
    $adapter = Invoke-RestMethod "$AdapterUrl/api/health" -TimeoutSec 2
    Write-Host "Adapter OK: $($adapter.service), mock=$($adapter.mock)"
}
catch {
    Write-Host "Adapter not reachable. This is fine unless you expected Dream adapter mode."
}
