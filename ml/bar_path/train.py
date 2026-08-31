from __future__ import annotations

import argparse
from pathlib import Path

import yaml
from ultralytics import YOLO


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train the Iron Forge bar-sleeve keypoint detector.")
    parser.add_argument("--data", type=Path, default=Path(__file__).parent / "dataset.yaml")
    parser.add_argument("--model", default="yolo11n-pose.pt")
    parser.add_argument("--epochs", type=int, default=100)
    parser.add_argument("--image-size", type=int, default=960)
    parser.add_argument("--batch", type=int, default=8)
    parser.add_argument("--device", default=None, help="CUDA device such as 0, cpu, or mps.")
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--project", type=Path, default=Path(__file__).parent / "runs")
    parser.add_argument("--name", default="bar-sleeves-v1")
    return parser.parse_args()


def validate_config(path: Path) -> None:
    if not path.is_file():
        raise FileNotFoundError(f"Dataset config not found: {path}")
    config = yaml.safe_load(path.read_text(encoding="utf-8"))
    if config.get("kpt_shape") != [2, 3]:
        raise ValueError("The dataset must define two (x, y, visibility) sleeve keypoints.")
    if config.get("names") != {0: "barbell"}:
        raise ValueError("The dataset must contain one class named 'barbell'.")


def main() -> None:
    args = parse_args()
    validate_config(args.data)
    model = YOLO(args.model)
    model.train(
        data=str(args.data.resolve()),
        epochs=args.epochs,
        imgsz=args.image_size,
        batch=args.batch,
        device=args.device,
        workers=args.workers,
        project=str(args.project.resolve()),
        name=args.name,
        patience=20,
        seed=42,
        deterministic=True,
        plots=True,
    )


if __name__ == "__main__":
    main()