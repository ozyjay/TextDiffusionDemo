import json
import unittest
from unittest.mock import Mock

from diffusiongemma_adapter.server import refine_payload


class ServerTests(unittest.TestCase):
    def test_refine_payload_returns_model_trace_for_story_requests(self):
        engine = Mock()
        engine.refine.return_value = "A model-written ending."
        payload = {
            "request": {
                "outputType": "story",
                "style": "clear",
                "creativity": "balanced",
                "length": "medium",
                "constraint": "none",
                "steps": 5,
            },
            "seedTrace": {
                "id": "robot-orientation-story-clear",
                "promptId": "robot-orientation-story",
                "outputType": "story",
                "prompt": "A robot joins university orientation.",
                "style": "clear",
                "controls": {},
                "stages": [
                    {"label": "Noise", "text": "noise", "note": "noise note"},
                    {"label": "Rough", "text": "rough", "note": "rough note"},
                    {"label": "Clear", "text": "clear", "note": "clear note"},
                    {"label": "Styled", "text": "styled", "note": "styled note"},
                    {"label": "Final", "text": "scripted final", "note": "old note"},
                ],
            },
        }

        status, response = refine_payload(payload, engine)

        self.assertEqual(status, 200)
        self.assertEqual(response["trace"]["stages"][-1]["text"], "A model-written ending.")
        engine.refine.assert_called_once_with(payload["request"], payload["seedTrace"])

    def test_refine_payload_rejects_python_lane_so_backend_falls_back(self):
        payload = {
            "request": {"outputType": "python"},
            "seedTrace": {},
        }

        status, response = refine_payload(payload, Mock())

        self.assertEqual(status, 503)
        self.assertIn("story", json.dumps(response).lower())


if __name__ == "__main__":
    unittest.main()
