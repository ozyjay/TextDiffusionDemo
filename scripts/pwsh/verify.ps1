$ErrorActionPreference = "Stop"

function Invoke-ProjectPython {
    param([string[]]$Arguments)

    if (Get-Command python3 -ErrorAction SilentlyContinue) {
        & python3 @Arguments
        return
    }

    if (Get-Command py -ErrorAction SilentlyContinue) {
        & py -3 @Arguments
        return
    }

    if (Get-Command python -ErrorAction SilentlyContinue) {
        & python @Arguments
        return
    }

    throw "Python was not found. Install Python 3 and make python3, py -3, or python available."
}

Write-Host "Running Node/Vue tests..."
npm test

Write-Host "Running production build..."
npm run build

Write-Host "Running DiffusionGemma adapter unit tests..."
$env:PYTHONPATH = "adapters/diffusiongemma_adapter"
Invoke-ProjectPython -Arguments @("-m", "unittest", "discover", "-s", "tests/diffusiongemma_adapter", "-v")

Write-Host "Verification complete."
