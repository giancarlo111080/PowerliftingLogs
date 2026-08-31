from __future__ import annotations

import argparse
from pathlib import Path

from ultralytics import YOLO


def main() -> None:
    parser = argparse.ArgumentParser(description="Export a trained bar-sleeve detector to ONNX.")
    parser.add_argument("weights", type=Path)
    parser.add_argument("--image-size", type=int, default=960)
    parser.add_argument("--half", action="store_true")
    args = parser.parse_args()
    if not args.weights.is_file():
        raise FileNotFoundError(f"Weights not found: {args.weights}")
    YOLO(str(args.weights)).export(format="onnx", imgsz=args.image_size, half=args.half, simplify=True)


if __name__ == "__main__":
    main()
