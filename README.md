# Text Diffusion Lab

**Beyond Next-Word Prediction: Text Diffusion Lab** is an Open Day demo about one possible future direction for generative AI: text that improves through repeated refinement instead of only appearing one token at a time.

The public demo is intentionally modest. It is a **simplified, diffusion-inspired staged refinement experience**, with reliable scripted/template fallback and an optional local DiffusionGemma mode for staff-supervised experiments.

## What It Shows

Visitors choose a prompt card, press **Diffuse Text**, and watch a whole piece of text change over several passes:

1. noisy fragments;
2. a rough draft;
3. a clearer draft;
4. a styled draft;
5. a final answer.

In staff-only **Model-assisted** mode, the backend can run `mlx-community/diffusiongemma-26B-A4B-it-4bit` locally and show real `Mask` / `Denoise` draft frames before the final model output.

## Quick Start

Install dependencies:

```bash
npm install
```

Run the demo:

```bash
./scripts/dev.sh
```

Open:

- Frontend: `http://127.0.0.1:3300`
- Backend health: `http://127.0.0.1:8300/api/health`

Run checks:

```bash
npm test
npm run build
```

## Model-Assisted DiffusionGemma

Model-assisted mode is optional and staff-only. The frontend still calls `POST /api/refine`; when **Model-assisted** is enabled, the Express backend lazily starts a project-local Python worker and talks to it over newline-delimited JSON.

Set up the local Python runtime on Apple Silicon:

```bash
python3 -m venv .venv-diffusiongemma
.venv-diffusiongemma/bin/python -m pip install -U pip -r adapters/diffusiongemma_adapter/requirements.txt
```

Then start the normal demo:

```bash
./scripts/dev.sh
```

In the UI, open **Staff controls** and enable **Model-assisted**. The first request can take a little while while the backend starts:

```text
.venv-diffusiongemma/bin/python -m diffusiongemma_adapter.worker
```

Later requests reuse the warm worker. If the worker is unavailable, slow, invalid, or used on an unsupported lane, the app returns the safe fallback as `model-fallback`.

Useful environment overrides:

```bash
DIFFUSIONGEMMA_PYTHON=.venv-diffusiongemma/bin/python
DIFFUSIONGEMMA_MODEL=mlx-community/diffusiongemma-26B-A4B-it-4bit
MODEL_ADAPTER_TIMEOUT_MS=30000
```

`MODEL_ADAPTER_URL` is still supported as a legacy third-party adapter escape hatch. If it is set, Express posts to `POST <MODEL_ADAPTER_URL>/api/refine` instead of starting the managed worker. For the built-in worker path, leave `MODEL_ADAPTER_URL` unset.

Direct one-off model smoke test:

```bash
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

## Staff Controls

The default visitor flow uses curated prompt cards only. Staff controls add:

- style, creativity, length, constraint, speed, and draft-frame controls;
- optional **Model-assisted** mode;
- staff-supervised custom story prompts, limited to short prompts and cleared on reset.

Custom prompts are story-only in v1. They are not stored, and they still fall back to the selected curated card scaffold if the live model cannot respond.

## Scripts

```bash
./scripts/dev.sh              # Start frontend and backend
./scripts/open_day_mode.sh    # Start with fixed Open Day env and port checks
./scripts/check_ports.sh      # Check reserved demo ports
```

PowerShell equivalents:

```powershell
.\scripts\pwsh\dev.ps1
.\scripts\pwsh\open-day.ps1
.\scripts\pwsh\smoke.ps1
.\scripts\pwsh\verify.ps1
```

## Ports

Reserved Text Diffusion Lab ports:

- Frontend: `127.0.0.1:3300`
- Backend/API: `127.0.0.1:8300`
- Legacy adapter compatibility: `127.0.0.1:8600`

Open Day mode should not silently choose random fallback ports.

## Testing

Run the JavaScript/TypeScript tests:

```bash
npm test
```

Run the production build/type check:

```bash
npm run build
```

Run the Python adapter unit tests:

```bash
PYTHONPATH=adapters/diffusiongemma_adapter python3 -m unittest discover -s tests/diffusiongemma_adapter -v
```

PowerShell:

```powershell
.\scripts\pwsh\verify.ps1
```

## Project Notes

Start with:

- [`docs/START_HERE.md`](docs/START_HERE.md)
- [`docs/DEMO_SPEC.md`](docs/DEMO_SPEC.md)
- [`AGENTS.md`](AGENTS.md)

Keep the public wording careful:

> “This is a simplified demo of one possible future direction for generative AI.”

Avoid claiming:

> “The AI is thinking.”

## Current Build Priorities

1. **Phase A: From noise to meaning** - strong staged refinement loop.
2. **Phase B: Visitor-controlled refinement** - prompt cards, controls, and staff-supervised options.
3. **Phase C: Compare with today’s LLMs** - optional split-screen teaching layer.
