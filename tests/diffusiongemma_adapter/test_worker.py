import json
import unittest

from diffusiongemma_adapter.worker import handle_line


class FakeEngine:
    def __init__(self):
        self.preloaded = False

    def preload(self):
        self.preloaded = True


class WorkerTests(unittest.TestCase):
    def test_handle_line_preloads_engine_without_refinement_request(self):
        engine = FakeEngine()

        response = handle_line(json.dumps({"id": "warmup-1", "type": "preload"}), engine)

        self.assertEqual(response, {"id": "warmup-1", "ok": True, "ready": True})
        self.assertTrue(engine.preloaded)


if __name__ == "__main__":
    unittest.main()
