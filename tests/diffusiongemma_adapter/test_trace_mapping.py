import unittest

from diffusiongemma_adapter.trace_mapping import (
    build_trace_from_final,
    build_trace_from_snapshots,
    clean_generated_text,
)


class TraceMappingTests(unittest.TestCase):
    def test_build_trace_from_final_preserves_intermediate_stages(self):
        seed_trace = {
            "id": "robot-orientation-story-clear",
            "promptId": "robot-orientation-story",
            "outputType": "story",
            "prompt": "A robot joins university orientation.",
            "style": "clear",
            "controls": {
                "creativity": "balanced",
                "length": "medium",
                "constraint": "include-robot",
                "steps": 5,
            },
            "stages": [
                {"label": "Noise", "text": "noise", "note": "noise note"},
                {"label": "Rough", "text": "rough", "note": "rough note"},
                {"label": "Clear", "text": "clear", "note": "clear note"},
                {"label": "Styled", "text": "styled", "note": "styled note"},
                {"label": "Final", "text": "old final", "note": "old note"},
            ],
        }

        trace = build_trace_from_final(seed_trace, "new model final")

        self.assertEqual(trace["id"], "robot-orientation-story-diffusiongemma")
        self.assertEqual([stage["text"] for stage in trace["stages"][:-1]], [
            "noise",
            "rough",
            "clear",
            "styled",
        ])
        self.assertEqual(trace["stages"][-1]["label"], "Final")
        self.assertEqual(trace["stages"][-1]["text"], "new model final")
        self.assertIn("DiffusionGemma", trace["stages"][-1]["note"])

    def test_clean_generated_text_removes_markdown_fences_and_special_tokens(self):
        text = "```text\n<bos> A concise answer. <eos>\n```"

        self.assertEqual(clean_generated_text(text), "A concise answer.")

    def test_build_trace_from_final_uses_safe_fallback_when_output_is_empty(self):
        seed_trace = {
            "id": "reef-signal-story-clear",
            "promptId": "reef-signal-story",
            "outputType": "story",
            "prompt": "A reef scientist discovers a strange signal.",
            "style": "clear",
            "controls": {},
            "stages": [
                {"label": "Noise", "text": "noise", "note": "noise note"},
                {"label": "Rough", "text": "rough", "note": "rough note"},
                {"label": "Clear", "text": "clear", "note": "clear note"},
                {"label": "Styled", "text": "styled", "note": "styled note"},
                {"label": "Final", "text": "scripted final", "note": "old note"},
            ],
        }

        trace = build_trace_from_final(seed_trace, "   ")

        self.assertEqual(trace["stages"][-1]["text"], "scripted final")

    def test_build_trace_from_snapshots_uses_real_draft_frames(self):
        seed_trace = {
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
        }
        snapshots = [
            {"label": "Mask 0/8", "text": "[Mask] [Mask]"},
            {"label": "Denoise 2/8", "text": "The robot [Mask]"},
            {"label": "Denoise 2/8", "text": "The robot [Mask]"},
            {"label": "Denoise 4/8", "text": "The robot waved."},
        ]

        trace = build_trace_from_snapshots(seed_trace, snapshots, "The robot waved at orientation.")

        self.assertEqual([stage["label"] for stage in trace["stages"]], [
            "Mask 0/8",
            "Denoise 2/8",
            "Denoise 4/8",
            "Final",
        ])
        self.assertEqual(trace["stages"][-1]["text"], "The robot waved at orientation.")

    def test_build_trace_from_snapshots_can_preserve_every_denoising_frame(self):
        seed_trace = {
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
        }
        snapshots = [
            {"label": "Mask 0/8", "text": "[Mask] [Mask]"},
            {"label": "Denoise 1/8", "text": "The robot [Mask]"},
            {"label": "Denoise 2/8", "text": "The robot [Mask]"},
        ]

        trace = build_trace_from_snapshots(
            seed_trace,
            snapshots,
            "The robot waved at orientation.",
            preserve_duplicate_frames=True,
        )

        self.assertEqual([stage["label"] for stage in trace["stages"]], [
            "Mask 0/8",
            "Denoise 1/8",
            "Denoise 2/8",
            "Final",
        ])


if __name__ == "__main__":
    unittest.main()
