import unittest
from unittest.mock import patch

from diffusiongemma_adapter.engine_factory import normalise_engine


class EngineFactoryTests(unittest.TestCase):
    def test_engine_aliases(self):
        self.assertEqual(normalise_engine("hf"), "transformers")
        self.assertEqual(normalise_engine("huggingface"), "transformers")
        self.assertEqual(normalise_engine("mlx"), "mlx")

    def test_auto_prefers_transformers_on_linux(self):
        with patch("platform.system", return_value="Linux"):
            from diffusiongemma_adapter.engine_factory import create_engine

            with patch("diffusiongemma_adapter.transformers_engine.TransformersDiffusionGemmaEngine") as engine:
                create_engine("test-model", "auto")
                engine.assert_called_once_with("test-model")


if __name__ == "__main__":
    unittest.main()
