from __future__ import annotations

from dataclasses import dataclass
from typing import Any


DEFAULT_MODEL = "mlx-community/diffusiongemma-26B-A4B-it-4bit"


@dataclass(frozen=True)
class GenerationOptions:
    max_tokens: int
    max_denoising_steps: int
    block_length: int
    temperature: float


def build_prompt(request: dict[str, Any], seed_trace: dict[str, Any]) -> str:
    prompt = str(seed_trace.get("prompt") or request.get("promptId") or "").strip()
    style = str(request.get("style", "clear")).strip() or "clear"
    creativity = str(request.get("creativity", "balanced")).strip() or "balanced"
    length = str(request.get("length", "medium")).strip() or "medium"
    constraint = constraint_text(str(request.get("constraint", "none")))

    return (
        "Write the final answer for a simplified, diffusion-inspired public university Open Day demo.\n"
        f"Prompt: {prompt}\n"
        f"Style: {style}.\n"
        f"Creativity: {creativity}.\n"
        f"Length: {length}.\n"
        f"Constraint: {constraint}.\n\n"
        "Keep it safe, concise, and suitable for visitors reading from 2-3 metres away. "
        "Return only the final answer, with no markdown fence and no explanation."
    )


def build_generation_options(request: dict[str, Any]) -> GenerationOptions:
    length = str(request.get("length", "medium"))
    creativity = str(request.get("creativity", "balanced"))
    requested_steps = int(request.get("steps", 5))

    return GenerationOptions(
        max_tokens=160 if length == "detailed" else 96,
        max_denoising_steps=bounded_int(requested_steps * 4, minimum=8, maximum=32),
        block_length=32,
        temperature=0.2 if creativity == "surprising" else 0.0,
    )


def constraint_text(value: str) -> str:
    labels = {
        "none": "none",
        "include-reef": "include reef",
        "include-robot": "include robot",
        "university": "include university",
        "under-12-words": "keep it under 12 words",
        "rhyme": "make it rhyme",
    }
    return labels.get(value.strip().lower(), value.strip() or "none")


def bounded_int(value: int, *, minimum: int, maximum: int) -> int:
    return max(minimum, min(maximum, value))
