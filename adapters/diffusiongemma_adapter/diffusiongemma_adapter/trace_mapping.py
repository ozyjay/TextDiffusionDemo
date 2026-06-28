from __future__ import annotations

import re
from typing import Any


FINAL_NOTE = "DiffusionGemma generated the final pass after the visible draft frames."
DRAFT_NOTE = "DiffusionGemma draft frame captured during denoising."


def build_trace_from_final(seed_trace: dict[str, Any], final_text: str) -> dict[str, Any]:
    cleaned_final = clean_generated_text(final_text)
    stages = list(seed_trace.get("stages", []))
    if len(stages) != 5:
        raise ValueError("seedTrace must contain five stages")

    fallback_final = str(stages[-1].get("text", "")).strip()
    final_stage = {
        **stages[-1],
        "label": "Final",
        "text": cleaned_final or fallback_final or "No model output was generated.",
        "note": FINAL_NOTE,
    }

    return {
        **seed_trace,
        "id": f"{seed_trace['promptId']}-diffusiongemma",
        "stages": [*stages[:4], final_stage],
    }


def build_trace_from_snapshots(
    seed_trace: dict[str, Any],
    snapshots: list[dict[str, str]],
    final_text: str,
    *,
    preserve_duplicate_frames: bool = False,
) -> dict[str, Any]:
    cleaned_snapshots = clean_snapshots(snapshots, preserve_duplicate_frames=preserve_duplicate_frames)
    cleaned_final = clean_generated_text(final_text)
    if not cleaned_snapshots:
        raise ValueError("DiffusionGemma did not return usable draft frames.")

    fallback_final = ""
    stages = list(seed_trace.get("stages", []))
    if stages:
        fallback_final = str(stages[-1].get("text", "")).strip()

    return {
        **seed_trace,
        "id": f"{seed_trace['promptId']}-diffusiongemma",
        "stages": [
            {
                "label": snapshot["label"],
                "text": snapshot["text"],
                "note": DRAFT_NOTE,
            }
            for snapshot in cleaned_snapshots
        ] + [
            {
                "label": "Final",
                "text": cleaned_final or fallback_final or "No model output was generated.",
                "note": FINAL_NOTE,
            }
        ],
    }


def clean_snapshots(
    snapshots: list[dict[str, str]],
    *,
    preserve_duplicate_frames: bool = False,
) -> list[dict[str, str]]:
    cleaned: list[dict[str, str]] = []
    seen_texts: set[str] = set()
    for snapshot in snapshots:
        text = clean_generated_text(str(snapshot.get("text", "")))
        label = str(snapshot.get("label", "")).strip()
        if not text or not label:
            continue
        if not preserve_duplicate_frames and text in seen_texts:
            continue
        seen_texts.add(text)
        cleaned.append({"label": label, "text": text})
    return cleaned


def clean_generated_text(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:\w+)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    text = re.sub(r"<\|[^>]+?\|>", "", text)
    text = text.replace("<bos>", "").replace("<eos>", "")
    text = text.replace("<s>", "").replace("</s>", "")
    text = text.replace("[PAD]", "").replace("[UNK]", "")
    return text.strip()
