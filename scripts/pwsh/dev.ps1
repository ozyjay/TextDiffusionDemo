param(
    [string]$FrontendHost = "127.0.0.1",
    [int]$FrontendPort = 3300,
    [string]$BackendHost = "127.0.0.1",
    [int]$BackendPort = 8300
)

$ErrorActionPreference = "Stop"

$env:FRONTEND_HOST = $FrontendHost
$env:FRONTEND_PORT = [string]$FrontendPort
$env:BACKEND_HOST = $BackendHost
$env:BACKEND_PORT = [string]$BackendPort

Write-Host "Starting Text Diffusion Lab..."
Write-Host "Frontend: http://$FrontendHost`:$FrontendPort/"
Write-Host "Backend:  http://$BackendHost`:$BackendPort/"

npm run dev
