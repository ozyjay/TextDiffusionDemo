from __future__ import annotations

import os
from typing import Any

from .trace_mapping import build_trace_from_history


class DreamUnavailable(RuntimeError):
    """Raised when the real Dream runtime cannot be used on this machine."""


class DreamEngine:
    def __init__(self) -> None:
        self.model_path = os.environ.get("DREAM_MODEL_PATH", "Dream-org/Dream-v0-Instruct-7B")
        self.max_new_tokens = int(os.environ.get("DREAM_MAX_NEW_TOKENS", "384"))
        self.steps = int(os.environ.get("DREAM_DIFFUSION_STEPS", "128"))
        self.temperature = float(os.environ.get("DREAM_TEMPERATURE", "0.2"))
        self.top_p = float(os.environ.get("DREAM_TOP_P", "0.95"))
        self._model = None
        self._tokenizer = None
        self._torch = None

    def refine(self, request: dict[str, Any], seed_trace: dict[str, Any]) -> dict[str, Any]:
        if os.environ.get("DREAM_ADAPTER_MOCK") == "1":
            return self.mock_refine(seed_trace)

        self._load()
        prompt = build_prompt(request, seed_trace)

        tokenizer = self._tokenizer
        torch = self._torch
        model = self._model

        messages = [{"role": "user", "content": prompt}]
        inputs = tokenizer.apply_chat_template(
            messages,
            return_tensors="pt",
            return_dict=True,
            add_generation_prompt=True,
        )
        input_ids = inputs.input_ids.to(device="cuda")
        attention_mask = inputs.attention_mask.to(device="cuda")

        with torch.no_grad():
            output = model.diffusion_generate(
                input_ids,
                attention_mask=attention_mask,
                max_new_tokens=self.max_new_tokens,
                output_history=True,
                return_dict_in_generate=True,
                steps=self.steps,
                temperature=self.temperature,
                top_p=self.top_p,
                alg="entropy",
                alg_temp=0.0,
            )

        prompt_length = input_ids.shape[-1]
        final_text = tokenizer.decode(output.sequences[0][prompt_length:].tolist())
        history_texts = [
            tokenizer.decode(history[0][prompt_length:].tolist())
            for history in getattr(output, "history", [])
        ]
        return build_trace_from_history(seed_trace, history_texts, final_text)

    def _load(self) -> None:
        if self._model is not None:
            return

        try:
            import torch
            from transformers import AutoModel, AutoTokenizer
        except ImportError as error:
            raise DreamUnavailable(
                "Dream adapter requires torch and transformers. Install adapters/dream_adapter/requirements.txt."
            ) from error

        if not torch.cuda.is_available():
            raise DreamUnavailable("Dream currently requires a CUDA GPU with at least 20GB memory.")

        tokenizer = AutoTokenizer.from_pretrained(self.model_path, trust_remote_code=True)
        model = AutoModel.from_pretrained(
            self.model_path,
            torch_dtype=torch.bfloat16,
            trust_remote_code=True,
        ).to("cuda").eval()

        self._torch = torch
        self._tokenizer = tokenizer
        self._model = model

    @staticmethod
    def mock_refine(seed_trace: dict[str, Any]) -> dict[str, Any]:
        history = [
            "[MASK] / [MASK] / page / ???",
            "A rough Dream diffusion draft is forming.",
            "The draft now changes several words across the page.",
            "The Dream adapter rewrites the middle and ending together.",
        ]
        final_text = f"{seed_trace['stages'][-1]['text']}\n\n[Dream adapter mock output]"
        return build_trace_from_history(seed_trace, history, final_text)


def build_prompt(request: dict[str, Any], seed_trace: dict[str, Any]) -> str:
    output_type = request.get("outputType", "story")
    prompt = seed_trace.get("prompt", request.get("promptId", ""))
    style = request.get("style", "clear")

    if output_type == "python":
        target = "a small, complete Python script that fits on one page"
    else:
        target = "a short story that fits on one page"

    return (
        f"Create {target} for this prompt:\n{prompt}\n\n"
        f"Style: {style}.\n"
        "Keep the result safe for a public university Open Day booth. "
        "Return only the final text or code, with no markdown fence and no explanation."
    )
