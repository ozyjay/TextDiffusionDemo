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

In staff-only **Model-assisted** mode, the backend can run `google/diffusiongemma-26B-A4B-it` locally and show real `Mask` / `Denoise` draft frames before the final model output when the local runtime supports it.

## Quick Start

Install dependencies:

```bash
npm install
```

Run the demo:

```bash
./scripts/dev.sh
```

Windows PowerShell:

```powershell
.\scripts\pwsh\dev.ps1
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

Set up the local Python runtime on Fedora/Linux:

```bash
python3 -m venv .venv-diffusiongemma
.venv-diffusiongemma/bin/python -m pip install -U pip
.venv-diffusiongemma/bin/python -m pip install -r adapters/diffusiongemma_adapter/requirements-fedora-rocm.txt
.venv-diffusiongemma/bin/python -m pip install -r adapters/diffusiongemma_adapter/requirements-fedora.txt
```

The first install command intentionally uses PyTorch's ROCm wheel index and pins the ROCm build versions available from that index. This avoids accidentally installing CPU-only PyTorch on the Framework Desktop. The current Fedora/Linux pin uses PyTorch's `rocm7.2` wheels, which have been smoke-tested on the Framework Desktop's AMD Radeon 8060S / `gfx1151` GPU.

On Fedora systems where the PyTorch ROCm wheel bundles an HSA runtime that does not match the host ROCm packages, the worker launcher automatically preloads `/usr/lib64/libhsa-runtime64.so.1` for the Linux Transformers runtime when that file exists. This avoids first-allocation crashes seen with some ROCm wheel/host combinations and is compatible with the current `rocm7.2` pin. To use a different HSA runtime path, set `DIFFUSIONGEMMA_HSA_RUNTIME_PRELOAD`; to manage preloads yourself, set `LD_PRELOAD` before starting the app.

Set up the local Python runtime on macOS / Apple Silicon:

```bash
python3 -m venv .venv-diffusiongemma
.venv-diffusiongemma/bin/python -m pip install -U pip
.venv-diffusiongemma/bin/python -m pip install -r adapters/diffusiongemma_adapter/requirements-mlx.txt
```

Windows PowerShell:

```powershell
py -3 -m venv .venv-diffusiongemma
.\.venv-diffusiongemma\Scripts\python.exe -m pip install -U pip
.\.venv-diffusiongemma\Scripts\python.exe -m pip install -r adapters\diffusiongemma_adapter\requirements-fedora-rocm.txt
.\.venv-diffusiongemma\Scripts\python.exe -m pip install -r adapters\diffusiongemma_adapter\requirements-fedora.txt
```

Then start the normal demo:

```bash
./scripts/dev.sh
```

Windows PowerShell:

```powershell
.\scripts\pwsh\dev.ps1
```

In the UI, use **Staff controls** to enable **Model-assisted**. For booth use, set `MODEL_PRELOAD=1` so the backend starts loading the local model as soon as the API starts:

```text
macOS/Linux: .venv-diffusiongemma/bin/python -m diffusiongemma_adapter.worker
Windows:     .venv-diffusiongemma\Scripts\python.exe -m diffusiongemma_adapter.worker
```

The API begins listening immediately, then logs `[model] preload: ... ready` when the local worker has loaded the model. Later requests reuse the warm worker. If the worker is unavailable, slow, invalid, or used on an unsupported lane, the app returns the safe fallback as `model-fallback`.

Useful environment overrides:

```bash
DIFFUSIONGEMMA_ENGINE=auto
DIFFUSIONGEMMA_MODEL=google/diffusiongemma-26B-A4B-it
MODEL_PROVIDER=auto
MODEL_ADAPTER_TIMEOUT_MS=30000
MODEL_WORKER_TIMEOUT_MS=300000
MODEL_PRELOAD=1
MODEL_PRELOAD_TIMEOUT_MS=600000
```

Leave `DIFFUSIONGEMMA_PYTHON` unset to use the project virtualenv default for the current OS. Override it only when the Python executable lives somewhere else:

```bash
DIFFUSIONGEMMA_PYTHON=.venv-diffusiongemma/bin/python
```

```powershell
$env:DIFFUSIONGEMMA_PYTHON = ".\.venv-diffusiongemma\Scripts\python.exe"
```

`MODEL_PROVIDER` can be `auto`, `external-adapter`, `hf-diffusiongemma`, `mlx-diffusiongemma`, or `fallback`. In `auto` mode, the backend tries a configured external adapter first, then the platform-appropriate local DiffusionGemma worker, then falls back safely. On Fedora/Linux and Windows, `auto` enables the Hugging Face Transformers worker. On macOS, `auto` enables the MLX worker. `MODEL_ADAPTER_URL` is still supported for third-party adapters that expose `GET <MODEL_ADAPTER_URL>/api/health` and `POST <MODEL_ADAPTER_URL>/api/refine`.

`DIFFUSIONGEMMA_ENGINE` can be `auto`, `transformers`, or `mlx`. Leave it as `auto` unless you are explicitly testing one runtime.

The HTTP adapter timeout stays short so unavailable external services fail over quickly. The local worker timeout is separate because a cold 26B model load can take a while. `MODEL_PRELOAD=1` sends a preload command to the local worker on backend startup, and `MODEL_PRELOAD_TIMEOUT_MS` controls how long startup logging waits for the ready signal.

Provider diagnostics are available for staff/debug tooling:

```bash
curl http://127.0.0.1:8300/api/model-providers
```

Fedora/Linux smoke test:

```bash
LD_PRELOAD=/usr/lib64/libhsa-runtime64.so.1 \
  .venv-diffusiongemma/bin/python -c "import torch; x=torch.ones((2,2), device='cuda'); print(torch.__version__, torch.version.hip, x.device)"
PYTHONPATH=adapters/diffusiongemma_adapter DIFFUSIONGEMMA_ENGINE=transformers \
  .venv-diffusiongemma/bin/python -c "from diffusiongemma_adapter.engine_factory import create_engine; print(type(create_engine()).__name__)"
```

Run ROCm GPU smokes from a normal host shell, or through an approved unsandboxed command, so `/dev/kfd` and `/dev/dri` are visible. Sandboxed shells can make ROCm appear unavailable even when `rocminfo` and PyTorch work on the host.

Framework Desktop ROCm validation as of the `rocm7.2` pin:

```text
torch 2.11.0+rocm7.2
HIP 7.2.26015
device cuda:0 AMD Radeon 8060S Graphics
```

For normal testing, start the app and use the provider diagnostics endpoint:

```bash
curl http://127.0.0.1:8300/api/model-providers
```

macOS / MLX one-off model smoke test:

```bash
.venv-diffusiongemma/bin/python -m mlx_vlm.generate \
  --model google/diffusiongemma-26B-A4B-it \
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

The main screen exposes curated prompt cards, a staff-supervised custom prompt, and simple style/creativity/length/constraint controls. Staff controls add:

- replay and looping autoplay;
- step and every-frame inspection modes;
- optional **Model-assisted** mode;
- reduced motion and reset controls.

Custom prompts are story-only in v1. They are not stored, and they still fall back to the selected curated card scaffold if the live model cannot respond.

## Scripts

macOS/Linux:

```bash
./scripts/dev.sh                 # Stop stale reserved-port processes, then start frontend and backend
./scripts/open_day_mode.sh       # Start with fixed Open Day env after reserved-port cleanup
./scripts/kill_reserved_ports.sh # Stop stale frontend/backend dev processes on reserved ports
./scripts/check_ports.sh         # Check reserved demo ports
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
$env:PYTHONPATH = "adapters/diffusiongemma_adapter"
py -3 -m unittest discover -s tests/diffusiongemma_adapter -v
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
