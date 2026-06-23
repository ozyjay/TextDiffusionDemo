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

### Real text diffusion adapter

For a true text diffusion model, use the Dream adapter:

```bash
python3 -m venv .venv-dream
source .venv-dream/bin/activate
pip install -r adapters/dream_adapter/requirements.txt
./scripts/dream_adapter.sh
```

By default it targets `Dream-org/Dream-v0-Instruct-7B`. Dream's published
runtime expects CUDA and at least 20 GB GPU memory, so this adapter is intended
for a CUDA workstation or GPU host rather than the local Apple Silicon laptop.
If the model runtime is unavailable, the adapter returns HTTP 503 and the demo
falls back to scripted traces.

For wiring tests only, `DREAM_ADAPTER_MOCK=1 ./scripts/dream_adapter.sh` starts
a mock adapter with the same API shape. Do not present mock mode as a real text
diffusion model.

### PowerShell helpers

If you mainly use `pwsh`, use the scripts in `scripts/pwsh/`.

Run the main demo:

```powershell
.\scripts\pwsh\dev.ps1
```

Run the mock Dream adapter in a second terminal:

```powershell
.\scripts\pwsh\dream-adapter-mock.ps1
```

Run the real Dream adapter on a CUDA GPU host:

```powershell
.\scripts\pwsh\dream-adapter.ps1
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
