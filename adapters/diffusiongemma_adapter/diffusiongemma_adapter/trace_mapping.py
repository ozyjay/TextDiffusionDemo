from __future__ import annotations

import re
from typing import Any


FINAL_NOTE = "DiffusionGemma generated the final pass while the earlier stages stay as booth-safe context."


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


def clean_generated_text(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:\w+)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    text = re.sub(r"<\|[^>]+?\|>", "", text)
    text = text.replace("<bos>", "").replace("<eos>", "")
    text = text.replace("<s>", "").replace("</s>", "")
    text = text.replace("[PAD]", "").replace("[UNK]", "")
    return text.strip()
