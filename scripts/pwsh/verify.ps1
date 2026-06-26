$ErrorActionPreference = "Stop"

Write-Host "Running Node/Vue tests..."
npm test

Write-Host "Running production build..."
npm run build

Write-Host "Running DiffusionGemma adapter unit tests..."
$env:PYTHONPATH = "adapters/diffusiongemma_adapter"
python3 -m unittest discover -s tests/diffusiongemma_adapter -v

Write-Host "Verification complete."
