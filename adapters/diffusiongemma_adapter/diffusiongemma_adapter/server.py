from __future__ import annotations

import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

from .engine import DiffusionGemmaEngine, DiffusionGemmaUnavailable
from .prompting import DEFAULT_MODEL
from .trace_mapping import build_trace_from_final


SERVICE_NAME = "diffusiongemma-adapter"


class DiffusionGemmaAdapterHandler(BaseHTTPRequestHandler):
    engine = DiffusionGemmaEngine()

    def do_GET(self) -> None:
        if self.path == "/api/health":
            self._json(
                200,
                {
                    "ok": True,
                    "service": SERVICE_NAME,
                    "model": self.engine.model_id,
                    "storyOnly": True,
                },
            )
            return
        self._json(404, {"error": "not found"})

    def do_POST(self) -> None:
        if self.path != "/api/refine":
            self._json(404, {"error": "not found"})
            return

        try:
            status, payload = refine_payload(self._read_json(), self.engine)
        except DiffusionGemmaUnavailable as error:
            self._json(503, {"error": str(error)})
            return
        except Exception as error:
            self._json(500, {"error": f"DiffusionGemma adapter failed: {error}"})
            return

        self._json(status, payload)

    def log_message(self, format: str, *args: Any) -> None:
        if os.environ.get("DIFFUSIONGEMMA_ADAPTER_QUIET") != "1":
            super().log_message(format, *args)

    def _read_json(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length)
        return json.loads(body.decode("utf-8"))

    def _json(self, status: int, payload: dict[str, Any]) -> None:
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def refine_payload(payload: dict[str, Any], engine: DiffusionGemmaEngine) -> tuple[int, dict[str, Any]]:
    request = payload.get("request")
    seed_trace = payload.get("seedTrace")
    if not isinstance(request, dict) or not isinstance(seed_trace, dict):
        return 400, {"error": "request and seedTrace are required."}

    if request.get("outputType") != "story":
        return 503, {"error": "DiffusionGemma adapter v1 supports story output only."}

    final_text = engine.refine(request, seed_trace)
    trace = build_trace_from_final(seed_trace, final_text)
    return 200, {"trace": trace}


def run() -> None:
    host = os.environ.get("MODEL_ADAPTER_HOST", "127.0.0.1")
    port = int(os.environ.get("MODEL_ADAPTER_PORT", "8600"))
    model_id = os.environ.get("DIFFUSIONGEMMA_MODEL", DEFAULT_MODEL)
    DiffusionGemmaAdapterHandler.engine = DiffusionGemmaEngine(model_id)
    server = ThreadingHTTPServer((host, port), DiffusionGemmaAdapterHandler)
    print(f"DiffusionGemma adapter listening at http://{host}:{port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    run()
