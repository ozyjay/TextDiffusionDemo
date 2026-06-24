param(
    [string]$HostName = "127.0.0.1",
    [int]$Port = 8600,
    [string]$Model = "mlx-community/diffusiongemma-26B-A4B-it-4bit",
    [string]$Python = ".venv-diffusiongemma/bin/python"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $Python)) {
    Write-Error "DiffusionGemma Python runtime not found at $Python. Create it with: python3 -m venv .venv-diffusiongemma; .venv-diffusiongemma/bin/python -m pip install -U pip -r adapters/diffusiongemma_adapter/requirements.txt"
}

$env:MODEL_ADAPTER_HOST = $HostName
$env:MODEL_ADAPTER_PORT = [string]$Port
$env:DIFFUSIONGEMMA_MODEL = $Model
$env:PYTHONPATH = "adapters/diffusiongemma_adapter"

Write-Host "Starting DiffusionGemma adapter at http://$HostName`:$Port/"
& $Python -m diffusiongemma_adapter.server
