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

The demo includes an optional staff-only model-assisted mode for local
DiffusionGemma experiments. The frontend still calls `POST /api/refine`; when
staff enable **Model-assisted**, the Express backend lazily starts a
project-local Python worker and talks to it over newline-delimited JSON.

Model-assisted story runs can return real DiffusionGemma draft frames such as
`Mask 0/8` and `Denoise 2/8`, followed by the final model output. Unsupported
lanes, missing runtimes, timeouts, invalid traces, or empty draft frames return
the scripted fallback as `model-fallback`.

### Local DiffusionGemma runtime

For local Apple Silicon experiments with `mlx-community/diffusiongemma-26B-A4B-it-4bit`,
use `mlx-vlm` from a project-local virtual environment:

```bash
python3 -m venv .venv-diffusiongemma
.venv-diffusiongemma/bin/python -m pip install -U pip -r adapters/diffusiongemma_adapter/requirements.txt
```

Start the main demo:

```bash
./scripts/dev.sh
```

Enable **Model-assisted** under Staff controls. The first request may take a
while because the backend starts `.venv-diffusiongemma/bin/python -m
diffusiongemma_adapter.worker` and loads the model once; later requests reuse
the warm worker. Set `DIFFUSIONGEMMA_PYTHON` or `DIFFUSIONGEMMA_MODEL` to
override the defaults. Set `MODEL_ADAPTER_TIMEOUT_MS` if you need a shorter or
longer live-model wait; the default is `30000`.

`MODEL_ADAPTER_URL` is still accepted as a legacy third-party adapter escape
hatch. If it is set, Express posts to `POST <MODEL_ADAPTER_URL>/api/refine`
instead of starting the managed worker.

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
