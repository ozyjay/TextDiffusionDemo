import unittest
from types import SimpleNamespace

from diffusiongemma_adapter.engine import DiffusionGemmaEngine


class EngineTests(unittest.TestCase):
    def test_refine_collects_draft_frames_and_final_text_from_stream(self):
        engine = DiffusionGemmaEngine("test-model")
        engine._model = SimpleNamespace(config={})
        engine._processor = object()
        engine._apply_chat_template = lambda *_args, **_kwargs: "rendered prompt"
        engine._stream_generate = lambda *_args, **_kwargs: iter([
            SimpleNamespace(is_draft=True, draft_text="[Mask] [Mask]", diffusion_step=0, diffusion_total_steps=8),
            SimpleNamespace(is_draft=True, draft_text="The robot [Mask]", diffusion_step=2, diffusion_total_steps=8),
            SimpleNamespace(is_draft=False, text="The robot waved", diffusion_step=0, diffusion_total_steps=0),
            SimpleNamespace(is_draft=False, text=" at orientation.", diffusion_step=0, diffusion_total_steps=0),
        ])

        result = engine.refine(
            {
                "outputType": "story",
                "style": "funny",
                "creativity": "balanced",
                "length": "short",
                "constraint": "include-robot",
                "steps": 5,
            },
            {"prompt": "A robot joins university orientation."},
        )

        self.assertEqual(result["finalText"], "The robot waved at orientation.")
        self.assertEqual(result["snapshots"][0], {"label": "Mask 0/8", "text": "[Mask] [Mask]"})
        self.assertEqual(result["snapshots"][1], {"label": "Denoise 2/8", "text": "The robot [Mask]"})


if __name__ == "__main__":
    unittest.main()
