# Optional Backends — Text Diffusion Lab

This document records optional live-model backend experiments for Text Diffusion Lab.

The public Open Day demo must not depend on any of these backends. The required demo path remains:

1. scripted traces;
2. deterministic/template refinement;
3. optional model-assisted refinement;
4. optional comparison view.

A real text-diffusion backend is useful for research credibility and future development, but it must stay behind the same reset, timeout, fallback, and public-wording rules as the rest of the demo.

---

## Current recommendation

Treat the built-in **Hugging Face Transformers DiffusionGemma worker** as the first local real-model experiment on the Framework Desktop / Fedora path.

Rationale:

- DiffusionGemma is a current experimental diffusion-style text model and fits the demo's “possible future of GenAI” framing.
- The repo already wraps the Transformers worker behind the normal `POST /api/refine` model-assisted path.
- PyTorch `rocm7.2` wheels have passed a real worker smoke on the Framework Desktop's AMD Radeon 8060S / `gfx1151` GPU.
- The backend still falls back to scripted/template traces when the local model is unavailable, slow, invalid, or used on an unsupported output lane.

Unsloth Studio remains a useful research tool, but it is not the first path to wire into this app.

Source to check before implementation:

- <https://unsloth.ai/docs/models/diffusiongemma>

---

## Backend policy

The app must work when DiffusionGemma / Unsloth is not installed.

Required behaviour:

- Startup detects whether the optional backend is configured and reachable.
- If the backend is unavailable, slow, or errors, the app falls back to scripted traces.
- The public screen never blocks indefinitely waiting for a model call.
- The UI clearly displays the current mode: `scripted`, `template`, `model-assisted`, or `DiffusionGemma`.
- Staff can force replay/scripted mode with one control.
- Visitor-facing explanations remain accurate and modest.
- No visitor input is stored beyond the current session unless explicitly documented.

Do not describe the demo as a real DiffusionGemma demo unless the live backend is actually being used during that run.

Safe public wording:

> “This is a simplified demo inspired by diffusion-style text generation. In experimental mode, it can use a real DiffusionGemma backend, but the booth version also has reliable scripted and template-based modes.”

Avoid:

- “This is definitely the future of AI.”
- “This proves diffusion is better than LLMs.”
- “This is a Gemini Diffusion clone.”
- “The model is thinking.”
- “The live backend cannot fail.”

---

## Suggested backend adapter shape

Keep the UI independent of the backend.

```text
Prompt + controls
  -> backend adapter
  -> normalized stage timeline
  -> screen renderer
```

The backend adapter should return the same timeline shape used by scripted traces:

```json
{
  "mode": "DiffusionGemma",
  "prompt": "A robot joins university orientation.",
  "style": "funny",
  "controls": {
    "creativity": "balanced",
    "length": "medium",
    "steps": 5
  },
  "stages": [
    {
      "label": "Noise",
      "text": "robot / campus / lost / ??? / map",
      "note": "Placeholder-token canvas"
    },
    {
      "label": "Rough",
      "text": "A robot was lost at university and needed a map.",
      "note": "First refinement pass fills in rough meaning"
    },
    {
      "label": "Final",
      "text": "On its first day at university, a curious robot followed a duck across campus and accidentally found the best lecture.",
      "note": "Final polish"
    }
  ],
  "metadata": {
    "backend": "unsloth-diffusiongemma",
    "latency_ms": 0,
    "fallback_used": false
  }
}
```

If the real backend only returns final text, the adapter may synthesize intermediate stages for the public timeline. Label this internally as `model-assisted` or `DiffusionGemma + staged display`, not as direct visibility into private model reasoning.

---

## Platform expectations

These are implementation assumptions to verify with smoke tests, not promises.

| Platform | Expected usefulness | Notes |
|---|---|---|
| CUDA / NVIDIA | Best target for real DiffusionGemma testing | Prefer this for first serious live-backend benchmark. |
| macOS / Apple Silicon | Useful for local experimentation if the installed runtime supports it | Benchmark before relying on it for public use. |
| Linux / CUDA | Best target for first serious live-backend benchmark | Prefer this if event hardware has an NVIDIA GPU. |
| Windows | Supported for the Node/Vue demo and PowerShell launch scripts; live-model support depends on the Python/model runtime | Keep scripted/template fallback available. |
| ROCm / AMD | Useful on validated hardware | Framework Desktop / Radeon 8060S passed PyTorch `rocm7.2` allocation, adapter tests, and a real DiffusionGemma worker smoke. GPU smokes must run with host access to `/dev/kfd` and `/dev/dri`. |
| CPU only | Useful for scripted/template modes; real diffusion backend may be too slow | Must remain a valid fallback environment. |

---

## Smoke tests

A backend is considered usable only if all of these pass on the target machine:

| Test | Pass condition |
|---|---|
| Install | Unsloth Studio installs without manual debugging. |
| Launch | Backend can be started by staff-facing script or documented shortcut. |
| Load model | DiffusionGemma loads successfully. |
| Single prompt | A curated prompt returns usable text. |
| Latency | One full run finishes in 20–45 seconds or gracefully falls back. |
| Timeout | Slow model call times out without freezing the screen. |
| Fallback | Scripted traces resume automatically after failure. |
| Reset | Staff can clear the current run in one click. |
| Mode label | Screen accurately shows whether it is scripted/template/model-assisted/DiffusionGemma. |

---

## Implementation order

1. Keep scripted traces working.
2. Keep template refinement working.
3. Add a backend adapter interface.
4. Add a mock backend that intentionally fails and confirms fallback behaviour.
5. Add an Unsloth/DiffusionGemma adapter behind a feature flag.
6. Benchmark the validated ROCm path on event hardware if the Framework Desktop is the target machine.
7. Test macOS next if useful.
8. Benchmark CUDA/NVIDIA only if event hardware changes.

Suggested feature flag:

```env
ENABLE_DIFFUSIONGEMMA_BACKEND=false
DIFFUSIONGEMMA_BACKEND_URL=http://127.0.0.1:8888
DIFFUSIONGEMMA_TIMEOUT_MS=10000
```

Current local provider choices:

```env
MODEL_PROVIDER=auto
DIFFUSIONGEMMA_ENGINE=auto
```

- `modeldeck` uses ModelDeck's native asynchronous text-diffusion API at `MODELDECK_BASE_URL` (default `http://127.0.0.1:8600`) with alias `MODELDECK_MODEL` (default `text-diffusion-q4`). ModelDeck must already be running. Start its Q4 worker with `./scripts/start_diffusiongemma_q4.ps1` from the ModelDeck repository, then select it with `MODEL_PROVIDER=modeldeck`.
- `hf-diffusiongemma` uses Hugging Face Transformers and is the preferred Fedora/Linux experiment path.
- `redhat-vllm` uses an OpenAI-compatible vLLM server for `RedHatAI/gemma-4-26B-A4B-it-FP8-Dynamic`. Use this for the Red Hat quant experiment instead of the DiffusionGemma worker.
- On Fedora/Linux with AMD graphics, install PyTorch from `requirements-fedora-rocm.txt` before the generic Hugging Face packages so the adapter gets ROCm-enabled Torch rather than CPU-only Torch. The current file pins PyTorch `rocm7.2`.
- Run ROCm GPU allocation and worker smokes from a normal host shell or an approved unsandboxed command. Sandboxed shells may not expose `/dev/kfd` or `/dev/dri`, which makes PyTorch report no available HIP GPU even when the host works.
- `mlx-diffusiongemma` uses MLX and is the preferred macOS / Apple Silicon experiment path.
- `auto` checks ModelDeck first, then keeps the external adapter and configured Red Hat vLLM endpoint ahead of the platform-appropriate local worker, then falls back.

Red Hat quant model notes:

```env
MODEL_PROVIDER=redhat-vllm
REDHAT_VLLM_BASE_URL=http://127.0.0.1:8000/v1
REDHAT_VLLM_MODEL=RedHatAI/gemma-4-26B-A4B-it-FP8-Dynamic
REDHAT_VLLM_API_KEY=EMPTY
```

The direct Transformers smoke for `RedHatAI/gemma-4-26B-A4B-it-FP8-Dynamic` required `compressed-tensors>=0.15.0` and could preload, but generation produced unusable text while reporting missing/unexpected Gemma4 MoE expert weights. Treat that as a failed drop-in path. The model README positions the checkpoint for vLLM, so any further Red Hat quant testing should use the `redhat-vllm` provider and a separately launched vLLM server.

Framework Desktop / Radeon 8060S `gfx1151` test result:

- `rocminfo` reported the AMD Radeon 8060S Graphics as `gfx1151`.
- The Python 3.12 vLLM test venv with ROCm 7.2 torch could import torch and allocate a tensor on `cuda:0` when run from a host/unsandboxed command.
- vLLM 0.24.0 could import after pointing the test process at compatible OpenMPI and AMD-SMI libraries, and it reached `Gemma4ForConditionalGeneration` initialisation.
- Serving failed during FP8 MoE layer construction with `No FP8 MoE backend supports the deployment configuration`.
- Explicit AITER retries with `VLLM_ROCM_USE_AITER=1` and `VLLM_ROCM_USE_AITER_MOE=1` failed at the same point: `FP8 MoE backend AITER does not support the deployment configuration since kernel does not support current device rocm`.
- Conclusion: keep the `redhat-vllm` provider as an integration point for compatible vLLM hosts, but do not expect this Red Hat FP8 MoE quant to run on the local Halo / Strix Halo ROCm path yet.

Do not expose staff-only backend controls to visitor phones or public routes.

---

## Open decision

Before making this part of a live demo mode, decide whether Unsloth Studio should be:

1. a manual research tool only;
2. a local backend launched separately by staff;
3. wrapped behind the Text Diffusion Lab backend API; or
4. excluded from Open Day mode and used only for development notes.

Default position: **development experiment only until it passes smoke tests on the event hardware.**
