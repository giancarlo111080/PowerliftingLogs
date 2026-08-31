from __future__ import annotations

import argparse
import csv
from collections import Counter
from pathlib import Path

import yaml

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
EXPECTED_VALUES = 11


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate Iron Forge YOLO-pose annotations.")
    parser.add_argument("--data", type=Path, default=Path(__file__).parent / "dataset.yaml")
    parser.add_argument("--prototype", action="store_true", help="Allow frame-level splits for non-promotable pipeline development.")
    return parser.parse_args()


def dataset_root(config_path: Path, config: dict[object, object]) -> Path:
    configured = Path(str(config["path"]))
    return configured if configured.is_absolute() else config_path.parent / configured


def validate_label(label_path: Path) -> list[str]:
    errors: list[str] = []
    lines = [line.strip() for line in label_path.read_text(encoding="utf-8").splitlines() if line.strip()]
    if not lines:
        return errors
    if len(lines) != 1:
        errors.append(f"{label_path}: expected exactly one barbell annotation, found {len(lines)}")
        return errors
    fields = lines[0].split()
    if len(fields) != EXPECTED_VALUES:
        errors.append(f"{label_path}: expected {EXPECTED_VALUES} values, found {len(fields)}")
        return errors
    try:
        values = [float(field) for field in fields]
    except ValueError:
        return [f"{label_path}: all annotation values must be numeric"]
    if values[0] != 0:
        errors.append(f"{label_path}: class id must be 0")
    for index, value in enumerate(values[1:5], start=1):
        if not 0 <= value <= 1:
            errors.append(f"{label_path}: bounding-box value {index} must be normalized to [0, 1]")
    for keypoint_index in range(2):
        offset = 5 + (keypoint_index * 3)
        x_coordinate, y_coordinate, visibility = values[offset : offset + 3]
        if not 0 <= x_coordinate <= 1 or not 0 <= y_coordinate <= 1:
            errors.append(f"{label_path}: keypoint {keypoint_index} coordinates must be normalized to [0, 1]")
        if visibility not in {0, 1, 2}:
            errors.append(f"{label_path}: keypoint {keypoint_index} visibility must be 0, 1, or 2")
    return errors


def main() -> None:
    args = parse_args()
    config_path = args.data.resolve()
    config = yaml.safe_load(config_path.read_text(encoding="utf-8"))
    root = dataset_root(config_path, config).resolve()
    errors: list[str] = []
    counts: Counter[str] = Counter()
    manifest_path = root / "annotation_manifest.csv"
    if not manifest_path.is_file():
        errors.append(f"dataset manifest is missing: {manifest_path}")
        manifest_rows: list[dict[str, str]] = []
    else:
        with manifest_path.open(encoding="utf-8", newline="") as manifest:
            manifest_rows = list(csv.DictReader(manifest))
    athlete_splits: dict[str, set[str]] = {}
    lift_splits: dict[str, set[str]] = {"squat": set(), "bench": set(), "deadlift": set()}
    for row in manifest_rows:
        athlete_splits.setdefault(row["athlete"], set()).add(row["split"])
        if row["lift"] in lift_splits:
            lift_splits[row["lift"]].add(row["split"])
    split_modes = {row.get("split_mode", "athlete") for row in manifest_rows}
    expected_mode = "prototype" if args.prototype else "athlete"
    if split_modes and split_modes != {expected_mode}:
        errors.append(f"dataset split mode is {', '.join(sorted(split_modes))}; expected {expected_mode}")
    if not args.prototype:
        for athlete, splits in athlete_splits.items():
            if len(splits) > 1:
                errors.append(f"athlete leakage: {athlete} appears in {', '.join(sorted(splits))}")
    for lift, splits in lift_splits.items():
        missing_splits = {"train", "val", "test"} - splits
        if missing_splits:
            errors.append(f"{lift}: missing manifest frames in {', '.join(sorted(missing_splits))}")
    for split in ("train", "val", "test"):
        image_directory = root / str(config[split])
        label_directory = root / "labels" / split
        if not image_directory.is_dir() or not label_directory.is_dir():
            errors.append(f"{split}: expected {image_directory} and {label_directory}")
            continue
        images = sorted(path for path in image_directory.iterdir() if path.suffix.lower() in IMAGE_EXTENSIONS)
        counts[split] = len(images)
        if not images:
            errors.append(f"{split}: contains no supported images")
        for image_path in images:
            label_path = label_directory / f"{image_path.stem}.txt"
            if not label_path.is_file():
                errors.append(f"{image_path}: matching label is missing")
            else:
                errors.extend(validate_label(label_path))
    manifest_images = {row["image"] for row in manifest_rows}
    if len(manifest_images) != len(manifest_rows):
        errors.append("annotation manifest contains duplicate image rows")
    if counts["train"] and counts["val"] < max(1, counts["train"] // 20):
        errors.append("val: use at least 5% as many frames as the training split")
    if errors:
        raise SystemExit("Dataset validation failed:\n- " + "\n- ".join(errors))
    print(f"Dataset valid: train={counts['train']}, val={counts['val']}, test={counts['test']}")


if __name__ == "__main__":
    main()
