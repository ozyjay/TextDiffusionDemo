from __future__ import annotations

import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

from .engine import DreamEngine, DreamUnavailable


class DreamAdapterHandler(BaseHTTPRequestHandler):
    engine = DreamEngine()

    def do_GET(self) -> None:
        if self.path == "/api/health":
            self._json(
                200,
                {
                    "ok": True,
                    "service": "dream-diffusion-adapter",
                    "model": self.engine.model_path,
                    "mock": os.environ.get("DREAM_ADAPTER_MOCK") == "1",
                },
            )
            return
        self._json(404, {"error": "not found"})

    def do_POST(self) -> None:
        if self.path != "/api/refine":
            self._json(404, {"error": "not found"})
            return

        try:
            payload = self._read_json()
            request = payload["request"]
            seed_trace = payload["seedTrace"]
            trace = self.engine.refine(request, seed_trace)
        except DreamUnavailable as error:
            self._json(503, {"error": str(error)})
            return
        except Exception as error:
            self._json(500, {"error": f"Dream adapter failed: {error}"})
            return

        self._json(200, {"trace": trace})

    def log_message(self, format: str, *args: Any) -> None:
        if os.environ.get("DREAM_ADAPTER_QUIET") != "1":
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


def run() -> None:
    host = os.environ.get("MODEL_ADAPTER_HOST", "127.0.0.1")
    port = int(os.environ.get("MODEL_ADAPTER_PORT", "8600"))
    server = ThreadingHTTPServer((host, port), DreamAdapterHandler)
    print(f"Dream adapter listening at http://{host}:{port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    run()
