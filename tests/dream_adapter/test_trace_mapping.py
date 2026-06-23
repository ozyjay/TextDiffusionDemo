import unittest

from dream_adapter.trace_mapping import (
    build_trace_from_history,
    clean_generated_text,
    evenly_spaced_indexes,
)


class TraceMappingTests(unittest.TestCase):
    def test_builds_five_demo_stages_from_history(self):
        seed_trace = {
            "id": "seed",
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
            "stages": [],
        }

        trace = build_trace_from_history(
            seed_trace,
            [
                "[MASK] [MASK] campus",
                "robot campus rough",
                "A robot arrives on campus.",
                "A robot arrives on campus and gets lost.",
            ],
            "A robot arrives on campus, gets lost, and makes friends.",
        )

        self.assertEqual(trace["id"], "robot-orientation-story-dream")
        self.assertEqual(trace["outputType"], "story")
        self.assertEqual([stage["label"] for stage in trace["stages"]], ["Noise", "Rough", "Clear", "Styled", "Final"])
        self.assertIn("makes friends", trace["stages"][-1]["text"])

    def test_cleans_special_tokens(self):
        self.assertEqual(clean_generated_text("<s>Hello</s><|end|>"), "Hello")

    def test_evenly_spaced_indexes_include_first_and_last(self):
        self.assertEqual(evenly_spaced_indexes(9, 5), [0, 2, 4, 6, 8])


if __name__ == "__main__":
    unittest.main()
