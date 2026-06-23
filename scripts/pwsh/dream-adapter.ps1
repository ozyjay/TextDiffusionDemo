param(
    [string]$HostName = "127.0.0.1",
    [int]$Port = 8600,
    [string]$ModelPath = "Dream-org/Dream-v0-Instruct-7B"
)

$ErrorActionPreference = "Stop"

$env:MODEL_ADAPTER_HOST = $HostName
$env:MODEL_ADAPTER_PORT = [string]$Port
$env:DREAM_MODEL_PATH = $ModelPath
$env:PYTHONPATH = "adapters/dream_adapter"

Write-Host "Starting real Dream adapter at http://$HostName`:$Port/"
Write-Host "Model: $ModelPath"
Write-Host "This requires the Dream Python dependencies and a CUDA GPU runtime."

python3 -m dream_adapter.server
