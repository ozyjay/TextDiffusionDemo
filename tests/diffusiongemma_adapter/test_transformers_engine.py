import unittest
from types import SimpleNamespace

from diffusiongemma_adapter.transformers_engine import (
    DiffusionDraftCollector,
    TransformersDiffusionGemmaEngine,
)


class FakeTokenIds:
    shape = (1, 3)

    def __init__(self, text):
        self.text = text

    def __getitem__(self, _index):
        return self


class FakeTokenizer:
    def decode(self, value, **_kwargs):
        return value.text


class FakeProcessor:
    tokenizer = FakeTokenizer()


class FakeModel:
    def __init__(self):
        self.kwargs = None

    def generate(self, **kwargs):
        self.kwargs = kwargs
        streamer = kwargs["streamer"]
        streamer.put_draft(FakeTokenIds("[Mask] reef signal"))
        streamer.put_draft(FakeTokenIds("rough reef signal"))
        streamer.put_draft(FakeTokenIds("clear reef signal"))
        return SimpleNamespace(sequences=FakeTokenIds("final reef signal"))


class TransformersEngineTests(unittest.TestCase):
    def test_draft_collector_captures_diffusion_draft_frames(self):
        collector = DiffusionDraftCollector(FakeTokenizer(), total_steps=8, capture_interval=4)

        collector.put_draft(FakeTokenIds("[Mask] [Mask]"))
        collector.put_draft(FakeTokenIds("skip this frame"))
        collector.put_draft(FakeTokenIds("skip this too"))
        collector.put_draft(FakeTokenIds("The reef signal"))

        self.assertEqual(collector.snapshots, [
            {"label": "Mask 0/8", "text": "[Mask] [Mask]"},
            {"label": "Denoise 4/8", "text": "The reef signal"},
        ])

    def test_transformers_engine_uses_diffusion_streamer_without_mlx_block_length(self):
        model = FakeModel()
        engine = TransformersDiffusionGemmaEngine("test-model")
        engine._model = model
        engine._processor = FakeProcessor()
        engine._torch = SimpleNamespace(no_grad=lambda: _NullContext())
        engine._build_inputs = lambda *_args: {"input_ids": FakeTokenIds("prompt")}
        engine._decode = lambda *_args: "<bos>final reef signal<eos>"

        result = engine.refine(
            {
                "outputType": "story",
                "style": "clear",
                "creativity": "balanced",
                "length": "short",
                "constraint": "include-reef",
                "steps": 4,
            },
            {"prompt": "A reef scientist discovers a strange signal."},
        )

        self.assertEqual(result["finalText"], "final reef signal")
        self.assertEqual(result["rawFinalText"], "<bos>final reef signal<eos>")
        self.assertEqual(result["snapshots"][0], {"label": "Mask 0/16", "text": "[Mask] reef signal"})
        self.assertIn("max_denoising_steps", model.kwargs)
        self.assertNotIn("block_length", model.kwargs)
        self.assertNotIn("do_sample", model.kwargs)


class _NullContext:
    def __enter__(self):
        return None

    def __exit__(self, *_args):
        return False


if __name__ == "__main__":
    unittest.main()
