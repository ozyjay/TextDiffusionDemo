param(
    [string]$HostName = "127.0.0.1",
    [int]$Port = 8600
)

$ErrorActionPreference = "Stop"

$env:MODEL_ADAPTER_HOST = $HostName
$env:MODEL_ADAPTER_PORT = [string]$Port
$env:DREAM_ADAPTER_MOCK = "1"
$env:PYTHONPATH = "adapters/dream_adapter"

Write-Host "Starting mock Dream adapter at http://$HostName`:$Port/"
Write-Host "Mock mode tests wiring only. Do not present this as a real text diffusion model."

python3 -m dream_adapter.server
