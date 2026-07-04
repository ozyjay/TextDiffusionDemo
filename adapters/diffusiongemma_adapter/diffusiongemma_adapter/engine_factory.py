from __future__ import annotations

import os
import platform
from typing import Any, Protocol

from .prompting import DEFAULT_MODEL


class RefinementEngine(Protocol):
    model_id: str

    def refine(self, request: dict[str, Any], seed_trace: dict[str, Any]) -> dict[str, Any] | str:
        ...


def create_engine(model_id: str | None = None, engine: str | None = None) -> RefinementEngine:
    model = model_id or os.environ.get("DIFFUSIONGEMMA_MODEL", DEFAULT_MODEL)
    selected = normalise_engine(engine or os.environ.get("DIFFUSIONGEMMA_ENGINE", "auto"))

    if selected == "auto":
        selected = "mlx" if platform.system() == "Darwin" else "transformers"

    if selected == "mlx":
        from .engine import DiffusionGemmaEngine

        return DiffusionGemmaEngine(model)

    if selected == "transformers":
        from .transformers_engine import TransformersDiffusionGemmaEngine

        return TransformersDiffusionGemmaEngine(model)

    raise ValueError(f"Unsupported DIFFUSIONGEMMA_ENGINE: {engine}")


def normalise_engine(value: str) -> str:
    normalised = value.strip().lower()
    if normalised in {"auto", "mlx", "transformers", "hf", "huggingface"}:
        return "transformers" if normalised in {"hf", "huggingface"} else normalised
    return normalised
