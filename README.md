# Text Diffusion Lab

**Beyond Next-Word Prediction: Text Diffusion Lab** is an Open Day demo showing one possible future direction for generative AI: text that improves through repeated refinement instead of only appearing one token at a time.

Start with [`docs/START_HERE.md`](docs/START_HERE.md), then read [`AGENTS.md`](AGENTS.md) before using an AI coding agent on this repository.

## Build order

1. Phase A — From noise to meaning.
2. Phase B — Visitor-controlled refinement.
3. Phase C — Compare with today’s LLM-style left-to-right generation.

## MVP principle

Scripted traces first. Model-assisted refinement later.

## Model-assisted spike

The demo includes an optional staff-only model-assisted mode. Set `MODEL_ADAPTER_URL`
to a local adapter, expected by default at `http://127.0.0.1:8600`. When enabled,
the Express API posts to `POST <MODEL_ADAPTER_URL>/api/refine` with:

- `request`: selected prompt, output type, style, and controls;
- `seedTrace`: the scripted fallback trace.

The adapter may return either `{ "trace": <trace> }` or a trace object directly.
Returned traces are validated and must keep the requested prompt lane. If the
adapter is missing, slow, invalid, or unavailable, the demo returns the scripted
fallback as `model-fallback`.

### Local DiffusionGemma adapter

For local Apple Silicon experiments with `mlx-community/diffusiongemma-26B-A4B-it-4bit`,
use `mlx-vlm` from a project-local virtual environment:

```bash
python3 -m venv .venv-diffusiongemma
.venv-diffusiongemma/bin/python -m pip install -U pip -r adapters/diffusiongemma_adapter/requirements.txt
```

Start the adapter in a second terminal:

```bash
./scripts/diffusiongemma_adapter.sh
```

Then start the main demo with `MODEL_ADAPTER_URL` pointing to the adapter:

```bash
MODEL_ADAPTER_URL=http://127.0.0.1:8600 ./scripts/dev.sh
```

Enable **Model-assisted** under Staff controls to try live DiffusionGemma output.
The public demo still falls back to scripted traces whenever model-assisted mode
is unavailable, slow, invalid, or used for an unsupported output lane.
Set `MODEL_ADAPTER_TIMEOUT_MS` if you need a shorter or longer live-model wait;
the default is `30000`.

For a direct one-off model smoke test without the demo UI:

.venv-diffusiongemma/bin/python -m mlx_vlm.generate \
  --model mlx-community/diffusiongemma-26B-A4B-it-4bit \
  --system "You write safe, concise text for a public university Open Day AI demo. Return only the answer." \
  --prompt "Prompt: A robot joins university orientation. Style: funny. Constraint: include university. Write one sentence under 18 words." \
  --max-tokens 64 \
  --max-denoising-steps 24 \
  --block-length 32 \
  --temperature 0.0 \
  --seed 11 \
  --no-verbose
```

### PowerShell helpers

If you mainly use `pwsh`, use the scripts in `scripts/pwsh/`.

Run the main demo:

```powershell
.\scripts\pwsh\dev.ps1
```

Run the DiffusionGemma adapter in a second terminal:

```powershell
.\scripts\pwsh\diffusiongemma-adapter.ps1
```

Smoke-test running services:

```powershell
.\scripts\pwsh\smoke.ps1
```

Run tests and build:

```powershell
.\scripts\pwsh\verify.ps1
```

## Ports

- Frontend: `3300`
- Backend/API: `8300`

## Public wording

Use:

> “This is a simplified demo of one possible future direction for generative AI.”

Avoid:

> “The AI is thinking.”
