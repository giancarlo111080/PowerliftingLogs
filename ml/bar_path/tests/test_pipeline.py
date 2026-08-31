from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

BAR_PATH_ROOT = Path(__file__).parents[1]
sys.path.insert(0, str(BAR_PATH_ROOT))

from prepare_dataset import prototype_split, split_for
from validate_dataset import validate_label


class SplitTests(unittest.TestCase):
    def test_split_is_deterministic_for_an_athlete(self) -> None:
        self.assertEqual(split_for("athlete-001"), split_for("athlete-001"))

    def test_split_is_one_of_the_supported_values(self) -> None:
        self.assertIn(split_for("athlete-002"), {"train", "val", "test"})

    def test_prototype_cycle_uses_the_configured_ratio(self) -> None:
        splits = [prototype_split(index) for index in range(20)]
        self.assertEqual(splits.count("train"), 14)
        self.assertEqual(splits.count("val"), 3)
        self.assertEqual(splits.count("test"), 3)


class LabelValidationTests(unittest.TestCase):
    def validate(self, content: str) -> list[str]:
        with tempfile.TemporaryDirectory() as directory:
            label = Path(directory) / "frame.txt"
            label.write_text(content, encoding="utf-8")
            return validate_label(label)

    def test_accepts_a_valid_bar_pose_label(self) -> None:
        self.assertEqual(self.validate("0 0.5 0.5 0.8 0.1 0.1 0.5 2 0.9 0.5 2\n"), [])

    def test_accepts_an_empty_negative_frame_label(self) -> None:
        self.assertEqual(self.validate(""), [])

    def test_rejects_missing_sleeve_values(self) -> None:
        errors = self.validate("0 0.5 0.5 0.8 0.1 0.1 0.5 2\n")
        self.assertTrue(any("expected 11 values" in error for error in errors))

    def test_rejects_out_of_bounds_coordinates(self) -> None:
        errors = self.validate("0 0.5 0.5 0.8 0.1 -0.1 0.5 2 0.9 0.5 2\n")
        self.assertTrue(any("coordinates must be normalized" in error for error in errors))

    def test_rejects_invalid_visibility(self) -> None:
        errors = self.validate("0 0.5 0.5 0.8 0.1 0.1 0.5 3 0.9 0.5 2\n")
        self.assertTrue(any("visibility must be" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
