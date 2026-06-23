from __future__ import annotations

import re
from typing import Any


STAGE_LABELS = ("Noise", "Rough", "Clear", "Styled", "Final")


def build_trace_from_history(
    seed_trace: dict[str, Any],
    history_texts: list[str],
    final_text: str,
) -> dict[str, Any]:
    """Convert Dream intermediate denoising snapshots into the demo trace shape."""
    stage_texts = select_stage_texts(history_texts, final_text)

    return {
        **seed_trace,
        "id": f"{seed_trace['promptId']}-dream",
        "style": seed_trace.get("style", "model-assisted"),
        "stages": [
            {
                "label": label,
                "text": text,
                "note": note_for_stage(label),
            }
            for label, text in zip(STAGE_LABELS, stage_texts, strict=True)
        ],
    }


def select_stage_texts(history_texts: list[str], final_text: str) -> list[str]:
    cleaned_history = [clean_generated_text(text) for text in history_texts]
    cleaned_history = [text for text in cleaned_history if text]
    cleaned_final = clean_generated_text(final_text)

    if cleaned_final and (not cleaned_history or cleaned_history[-1] != cleaned_final):
        cleaned_history.append(cleaned_final)

    if not cleaned_history:
        cleaned_history = ["[MASK] / [MASK] / ??? / [MASK]", cleaned_final or "No output generated."]

    if len(cleaned_history) >= len(STAGE_LABELS):
        indexes = evenly_spaced_indexes(len(cleaned_history), len(STAGE_LABELS))
        return [cleaned_history[index] for index in indexes]

    padded = cleaned_history[:]
    while len(padded) < len(STAGE_LABELS):
        padded.insert(0, "[MASK] / ??? / [MASK] / refining")
    return padded[-len(STAGE_LABELS) :]


def clean_generated_text(text: str) -> str:
    text = re.sub(r"<\|[^>]+?\|>", "", text)
    text = text.replace("<s>", "").replace("</s>", "")
    text = text.replace("[PAD]", "").replace("[UNK]", "")
    return text.strip()


def evenly_spaced_indexes(total: int, count: int) -> list[int]:
    if count <= 1:
        return [0]
    if total <= count:
        return list(range(total))
    return [round(index * (total - 1) / (count - 1)) for index in range(count)]


def note_for_stage(label: str) -> str:
    notes = {
        "Noise": "Dream begins from a masked/noisy sequence.",
        "Rough": "Early denoising produces a rough shape.",
        "Clear": "A middle pass resolves more of the page at once.",
        "Styled": "Later denoising rewrites wording and structure.",
        "Final": "The final denoised sample is returned by the diffusion language model.",
    }
    return notes[label]
