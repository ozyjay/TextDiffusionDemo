import unittest

from diffusiongemma_adapter.prompting import build_generation_options, build_prompt


class PromptingTests(unittest.TestCase):
    def test_build_prompt_includes_public_demo_constraints(self):
        request = {
            "outputType": "story",
            "style": "funny",
            "creativity": "balanced",
            "length": "short",
            "constraint": "include-robot",
            "steps": 5,
        }
        seed_trace = {
            "prompt": "A robot joins university orientation.",
        }

        prompt = build_prompt(request, seed_trace)

        self.assertIn("A robot joins university orientation.", prompt)
        self.assertIn("Style: funny.", prompt)
        self.assertIn("Creativity: balanced.", prompt)
        self.assertIn("Length: short.", prompt)
        self.assertIn("Constraint: include robot.", prompt)
        self.assertIn("public university Open Day", prompt)
        self.assertIn("Return only the final answer", prompt)

    def test_generation_options_map_controls_to_bounded_diffusion_settings(self):
        request = {
            "creativity": "surprising",
            "length": "detailed",
            "steps": 99,
        }

        options = build_generation_options(request)

        self.assertEqual(options.max_tokens, 160)
        self.assertEqual(options.max_denoising_steps, 32)
        self.assertEqual(options.block_length, 32)
        self.assertEqual(options.temperature, 0.2)
        self.assertEqual(options.diffusion_unmasking_interval, 1)

    def test_generation_options_keep_safer_short_outputs_deterministic(self):
        request = {
            "creativity": "safer",
            "length": "short",
            "steps": 1,
        }

        options = build_generation_options(request)

        self.assertEqual(options.max_tokens, 96)
        self.assertEqual(options.max_denoising_steps, 8)
        self.assertEqual(options.temperature, 0.0)
        self.assertEqual(options.diffusion_unmasking_interval, 8)

    def test_generation_options_use_steps_as_visible_frame_count(self):
        request = {
            "creativity": "balanced",
            "length": "short",
            "steps": 6,
        }

        options = build_generation_options(request)

        self.assertEqual(options.max_denoising_steps, 24)
        self.assertEqual(options.diffusion_unmasking_interval, 4)

    def test_generation_options_can_request_every_internal_frame(self):
        request = {
            "creativity": "balanced",
            "length": "short",
            "steps": 6,
            "includeEveryFrame": True,
        }

        options = build_generation_options(request)

        self.assertEqual(options.max_denoising_steps, 24)
        self.assertEqual(options.diffusion_unmasking_interval, 1)


if __name__ == "__main__":
    unittest.main()
