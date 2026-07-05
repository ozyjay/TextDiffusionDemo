from __future__ import annotations

import json
import sys
from typing import Any

from .engine_factory import create_engine
from .trace_mapping import build_trace_from_final, build_trace_from_snapshots


def main() -> int:
    engine = create_engine()
    for line in sys.stdin:
        if not line.strip():
            continue
        response = handle_line(line, engine)
        sys.stdout.write(json.dumps(response, separators=(",", ":")) + "\n")
        sys.stdout.flush()
    return 0


def handle_line(line: str, engine: DiffusionGemmaEngine) -> dict[str, Any]:
    request_id = None
    try:
        payload = json.loads(line)
        request_id = payload.get("id")
        if not isinstance(request_id, str) or not request_id:
            request_id = "unknown"

        if payload.get("type") == "preload":
            preload = getattr(engine, "preload", None)
            if callable(preload):
                preload()
            return {"id": request_id, "ok": True, "ready": True}

        request = payload["request"]
        seed_trace = payload["seedTrace"]
        if request.get("outputType") != "story":
            return {
                "id": request_id,
                "ok": False,
                "error": "DiffusionGemma worker v1 supports story output only.",
            }

        result = engine.refine(request, seed_trace)
        if result.get("snapshots"):
            trace = build_trace_from_snapshots(
                seed_trace,
                result.get("snapshots", []),
                result.get("finalText", ""),
                preserve_duplicate_frames=bool(request.get("includeEveryFrame", False)),
            )
        else:
            trace = build_trace_from_final(seed_trace, result.get("finalText", ""))
        return {"id": request_id, "ok": True, "trace": trace}
    except Exception as error:
        return {
            "id": request_id or "unknown",
            "ok": False,
            "error": str(error),
        }


if __name__ == "__main__":
    raise SystemExit(main())
