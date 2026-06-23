$ErrorActionPreference = "Stop"

Write-Host "Running Node/Vue tests..."
npm test

Write-Host "Running production build..."
npm run build

Write-Host "Running Dream adapter unit tests..."
$env:PYTHONPATH = "adapters/dream_adapter"
python3 -m unittest discover -s tests/dream_adapter -v

Write-Host "Verification complete."
