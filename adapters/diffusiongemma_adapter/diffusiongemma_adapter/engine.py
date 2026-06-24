from __future__ import annotations

import os
import threading
from typing import Any

from .prompting import DEFAULT_MODEL, build_generation_options, build_prompt
from .trace_mapping import clean_generated_text


class DiffusionGemmaUnavailable(RuntimeError):
    """Raised when the local MLX DiffusionGemma runtime cannot be used."""


class DiffusionGemmaEngine:
    def __init__(self, model_id: str | None = None) -> None:
        self.model_id = model_id or os.environ.get("DIFFUSIONGEMMA_MODEL", DEFAULT_MODEL)
        self._model = None
        self._processor = None
        self._lock = threading.Lock()

    def refine(self, request: dict[str, Any], seed_trace: dict[str, Any]) -> str:
        prompt = build_prompt(request, seed_trace)
        options = build_generation_options(request)
        model, processor = self._load()
        rendered_prompt = self._apply_chat_template(
            processor,
            getattr(model, "config", None),
            prompt,
            num_images=0,
            num_audios=0,
            enable_thinking=False,
        )

        with self._lock:
            result = self._generate(
                model,
                processor,
                rendered_prompt,
                max_tokens=options.max_tokens,
                max_denoising_steps=options.max_denoising_steps,
                block_length=options.block_length,
                temperature=options.temperature,
                verbose=False,
            )

        text = getattr(result, "text", result)
        return clean_generated_text(str(text))

    def _load(self):
        if self._model is not None and self._processor is not None:
            return self._model, self._processor

        try:
            from mlx_vlm.generate import generate
            from mlx_vlm.prompt_utils import apply_chat_template
            from mlx_vlm.utils import load
        except ImportError as error:
            raise DiffusionGemmaUnavailable(
                "DiffusionGemma adapter requires mlx-vlm. Install it in .venv-diffusiongemma."
            ) from error

        try:
            model, processor = load(self.model_id)
        except Exception as error:
            raise DiffusionGemmaUnavailable(f"Could not load DiffusionGemma model: {error}") from error

        self._generate = generate
        self._apply_chat_template = apply_chat_template
        self._model = model
        self._processor = processor
        return model, processor

    def _generate(self, *args, **kwargs):
        raise DiffusionGemmaUnavailable("DiffusionGemma model has not been loaded.")

    def _apply_chat_template(self, *args, **kwargs):
        raise DiffusionGemmaUnavailable("DiffusionGemma model has not been loaded.")
