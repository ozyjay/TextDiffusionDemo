from __future__ import annotations

import threading
from typing import Any

from .engine import DiffusionGemmaUnavailable
from .prompting import DEFAULT_MODEL, build_generation_options, build_prompt
from .trace_mapping import clean_generated_text


class TransformersDiffusionGemmaEngine:
    def __init__(self, model_id: str | None = None) -> None:
        self.model_id = model_id or DEFAULT_MODEL
        self._model = None
        self._processor = None
        self._torch = None
        self._lock = threading.Lock()

    def refine(self, request: dict[str, Any], seed_trace: dict[str, Any]) -> dict[str, Any]:
        prompt = build_prompt(request, seed_trace)
        options = build_generation_options(request)
        model, processor, torch = self._load()
        inputs = self._build_inputs(processor, prompt)

        generation_kwargs = {
            "max_new_tokens": options.max_tokens,
            "temperature": options.temperature,
            "do_sample": options.temperature > 0,
        }

        # DiffusionGemma-capable Transformers builds may accept diffusion-specific
        # kwargs. Older/generic builds will reject them, so retry without them.
        diffusion_kwargs = {
            "max_denoising_steps": options.max_denoising_steps,
            "block_length": options.block_length,
        }

        with self._lock:
            try:
                outputs = model.generate(**inputs, **generation_kwargs, **diffusion_kwargs)
            except TypeError:
                outputs = model.generate(**inputs, **generation_kwargs)

        generated = self._decode(processor, outputs, inputs, torch)
        return {
            "snapshots": [],
            "finalText": clean_generated_text(generated),
        }

    def _load(self):
        if self._model is not None and self._processor is not None and self._torch is not None:
            return self._model, self._processor, self._torch

        try:
            import torch
            from transformers import AutoProcessor
        except ImportError as error:
            raise DiffusionGemmaUnavailable(
                "Fedora DiffusionGemma adapter requires torch and transformers. "
                "Install adapters/diffusiongemma_adapter/requirements-fedora.txt."
            ) from error

        model_class = self._resolve_model_class()
        dtype = torch.bfloat16 if torch.cuda.is_available() else torch.float32
        device_map: str | None = "auto" if torch.cuda.is_available() else None

        try:
            processor = AutoProcessor.from_pretrained(self.model_id, trust_remote_code=True)
            model = model_class.from_pretrained(
                self.model_id,
                torch_dtype=dtype,
                device_map=device_map,
                trust_remote_code=True,
            )
            if device_map is None:
                model = model.to("cpu")
            model.eval()
        except Exception as error:
            raise DiffusionGemmaUnavailable(f"Could not load DiffusionGemma with Transformers: {error}") from error

        self._torch = torch
        self._processor = processor
        self._model = model
        return model, processor, torch

    def _resolve_model_class(self):
        try:
            from transformers import AutoModelForImageTextToText

            return AutoModelForImageTextToText
        except ImportError:
            try:
                from transformers import AutoModelForCausalLM

                return AutoModelForCausalLM
            except ImportError as error:
                raise DiffusionGemmaUnavailable(
                    "Installed transformers does not provide a compatible auto model class."
                ) from error

    def _build_inputs(self, processor, prompt: str):
        if hasattr(processor, "apply_chat_template"):
            messages = [{"role": "user", "content": [{"type": "text", "text": prompt}]}]
            try:
                rendered = processor.apply_chat_template(
                    messages,
                    tokenize=False,
                    add_generation_prompt=True,
                )
            except TypeError:
                rendered = processor.apply_chat_template(
                    [{"role": "user", "content": prompt}],
                    tokenize=False,
                    add_generation_prompt=True,
                )
        else:
            rendered = prompt

        try:
            inputs = processor(text=rendered, return_tensors="pt")
        except TypeError:
            inputs = processor(rendered, return_tensors="pt")

        device = getattr(self._model, "device", None)
        if device is not None and hasattr(inputs, "to"):
            inputs = inputs.to(device)
        return inputs

    def _decode(self, processor, outputs, inputs, torch) -> str:
        sequences = outputs.sequences if hasattr(outputs, "sequences") else outputs
        if isinstance(sequences, tuple):
            sequences = sequences[0]

        input_ids = inputs.get("input_ids") if hasattr(inputs, "get") else None
        if input_ids is not None and hasattr(sequences, "shape") and sequences.shape[-1] > input_ids.shape[-1]:
            sequences = sequences[:, input_ids.shape[-1] :]

        with torch.no_grad():
            if hasattr(processor, "batch_decode"):
                return processor.batch_decode(sequences, skip_special_tokens=True)[0]
            tokenizer = getattr(processor, "tokenizer", None)
            if tokenizer and hasattr(tokenizer, "batch_decode"):
                return tokenizer.batch_decode(sequences, skip_special_tokens=True)[0]
        return str(sequences)
