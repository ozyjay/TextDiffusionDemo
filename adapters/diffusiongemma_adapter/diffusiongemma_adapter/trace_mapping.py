from __future__ import annotations

import re
from typing import Any


FINAL_NOTE = "DiffusionGemma generated the final pass after the visible draft frames."
DRAFT_NOTE = "DiffusionGemma draft frame captured during denoising."


def build_trace_from_final(
    seed_trace: dict[str, Any],
    final_text: str,
    raw_final_text: str | None = None,
) -> dict[str, Any]:
    cleaned_final = clean_generated_text(final_text)
    stages = list(seed_trace.get("stages", []))
    if len(stages) != 5:
        raise ValueError("seedTrace must contain five stages")

    fallback_final = str(stages[-1].get("text", "")).strip()
    final = cleaned_final or fallback_final or "No model output was generated."
    if cleaned_final:
        model_stages = synthesize_stages_from_final(seed_trace, final)
        if raw_final_text is not None:
            model_stages[-1]["rawText"] = raw_final_text
        return {
            **seed_trace,
            "id": f"{seed_trace['promptId']}-diffusiongemma",
            "stages": model_stages,
        }

    final_stage = {
        **stages[-1],
        "label": "Final",
        "text": final,
        "note": FINAL_NOTE,
    }
    if raw_final_text is not None:
        final_stage["rawText"] = raw_final_text

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
    raw_final_text: str | None = None,
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
                **({"rawText": raw_final_text} if raw_final_text is not None else {}),
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
    text = strip_channel_labels(text)
    return text.strip()


def strip_channel_labels(text: str) -> str:
    lines = [line.strip() for line in text.splitlines()]
    while lines and not lines[0]:
        lines.pop(0)
    if not lines:
        return ""

    lowered = [line.lower().rstrip(":") for line in lines]
    for label in ("final", "answer"):
        if label in lowered:
            index = lowered.index(label)
            tail = "\n".join(lines[index + 1 :]).strip()
            if tail:
                return tail

    if lowered[0] in {"thought", "analysis", "assistant", "model", "final", "answer"}:
        return "\n".join(lines[1:]).strip()

    return text


def synthesize_stages_from_final(seed_trace: dict[str, Any], final_text: str) -> list[dict[str, str]]:
    prompt = str(seed_trace.get("prompt", "")).strip()
    noise = build_noise_line(prompt, final_text)
    sentences = split_sentences(final_text)
    rough = sentences[0] if sentences else final_text
    clear = " ".join(sentences[:2]) if len(sentences) > 1 else final_text

    return [
        {
            "label": "Noise",
            "text": noise,
            "note": "The live model output is converted into a noisy starting point for the public demo.",
        },
        {
            "label": "Rough",
            "text": rough,
            "note": "A first readable idea appears from the model-assisted result.",
        },
        {
            "label": "Clear",
            "text": clear,
            "note": "The draft becomes clearer before the final pass.",
        },
        {
            "label": "Styled",
            "text": final_text,
            "note": "The live model result is shown as a styled whole-text revision.",
        },
        {
            "label": "Final",
            "text": final_text,
            "note": FINAL_NOTE,
        },
    ]


def build_noise_line(prompt: str, final_text: str) -> str:
    words: list[str] = []
    for source in (prompt, final_text):
        for word in re.findall(r"[A-Za-z][A-Za-z'-]{2,}", source):
            lower = word.lower()
            if lower in {"the", "and", "for", "with", "that", "this", "from", "into", "about", "write", "short"}:
                continue
            if lower not in words:
                words.append(lower)
            if len(words) >= 8:
                return " / ".join(words[:4] + ["???"] + words[4:])
    return " / ".join(words + ["???"]) if words else "idea / draft / ??? / final"


def split_sentences(text: str) -> list[str]:
    sentences = [part.strip() for part in re.split(r"(?<=[.!?])\s+", text) if part.strip()]
    return sentences or ([text.strip()] if text.strip() else [])
