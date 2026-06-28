$ErrorActionPreference = "Stop"

$env:DEMO_NAME = "text-diffusion-lab"
$env:DEMO_MODE = "open-day"
$env:FRONTEND_HOST = "127.0.0.1"
$env:FRONTEND_PORT = "3300"
$env:BACKEND_HOST = "127.0.0.1"
$env:BACKEND_PORT = "8300"

& "$PSScriptRoot\stop-reserved-ports.ps1" -FrontendPort 3300 -BackendPort 8300

Write-Host "Starting Open Day mode on fixed ports."
npm run dev
