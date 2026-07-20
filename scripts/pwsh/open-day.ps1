param(
    [switch]$PreflightOnly,
    [string]$ModelDeckBaseUrl = $(if ($env:MODELDECK_BASE_URL) { $env:MODELDECK_BASE_URL } else { "http://127.0.0.1:8600" }),
    [string]$ModelDeckModel = $(if ($env:MODELDECK_MODEL) { $env:MODELDECK_MODEL } else { "text-diffusion-lab-q4" })
)

$ErrorActionPreference = "Stop"

function Test-ModelDeckPreflight {
    param(
        [string]$BaseUrl,
        [string]$Model
    )

    try {
        $gateway = $BaseUrl.TrimEnd("/")
        $health = Invoke-RestMethod "$gateway/v1/health" -Method Get -TimeoutSec 2
        if ($health.ok -eq $false) {
            throw "health response was not OK"
        }

        $modelsResponse = Invoke-RestMethod "$gateway/v1/models" -Method Get -TimeoutSec 2
        $models = if ($modelsResponse.models) {
            @($modelsResponse.models)
        } elseif ($modelsResponse.data) {
            @($modelsResponse.data)
        } else {
            @($modelsResponse)
        }
        $route = $models | Where-Object {
            $_.id -eq $Model -or $_.model -eq $Model -or $_.alias -eq $Model -or $_.name -eq $Model
        } | Select-Object -First 1

        if ($route -and $route.ready -eq $true) {
            Write-Host "ModelDeck preflight OK: route `"$Model`" is ready."
            return $true
        }

        $routeState = if ($route.state) { [string]$route.state } elseif ($route.status) { [string]$route.status } else { "not ready" }
        Write-Warning "ModelDeck route `"$Model`" is $routeState. Start it from ModelDeck. Model-assisted mode will use the safe fallback."
        return $false
    } catch {
        Write-Warning "ModelDeck is unavailable. Model-assisted mode will use the safe fallback; scripted and template modes remain available."
        return $false
    }
}

$env:DEMO_NAME = "text-diffusion-lab"
$env:DEMO_MODE = "open-day"
$env:FRONTEND_HOST = "127.0.0.1"
$env:FRONTEND_PORT = "3300"
$env:BACKEND_HOST = "127.0.0.1"
$env:BACKEND_PORT = "8300"
$env:MODEL_PROVIDER = "modeldeck"
$env:MODELDECK_BASE_URL = $ModelDeckBaseUrl
$env:MODELDECK_MODEL = $ModelDeckModel
$env:MODELDECK_DENOISING_STEPS = "48"
$env:MODELDECK_TIMEOUT_SECONDS = "60"
$env:MODEL_PRELOAD = "0"
Remove-Item Env:MODEL_ADAPTER_URL -ErrorAction SilentlyContinue

$modelDeckReady = Test-ModelDeckPreflight -BaseUrl $ModelDeckBaseUrl -Model $ModelDeckModel
if ($PreflightOnly) {
    if ($modelDeckReady) {
        Write-Host "Open Day preflight complete."
    } else {
        Write-Host "Open Day preflight complete with safe model fallback."
    }
    return
}

& "$PSScriptRoot\stop-reserved-ports.ps1" -FrontendPort 3300 -BackendPort 8300

Write-Host "Starting Open Day mode on fixed ports."
npm run dev
