from __future__ import annotations

import argparse
import csv
import hashlib
import shutil
from pathlib import Path

import cv2

VIDEO_EXTENSIONS = {".avi", ".mkv", ".mov", ".mp4", ".webm"}
SPLITS = (("train", 70), ("val", 15), ("test", 15))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract annotation frames without video leakage between splits.")
    parser.add_argument("--source", type=Path, default=Path(__file__).parent / "source_videos")
    parser.add_argument("--output", type=Path, default=Path(__file__).parent / "datasets" / "bar_path")
    parser.add_argument("--frames-per-second", type=float, default=2.0)
    parser.add_argument("--split-mode", choices=("athlete", "prototype"), default="athlete")
    parser.add_argument("--overwrite", action="store_true")
    return parser.parse_args()


def split_for(group: str) -> str:
    bucket = int(hashlib.sha256(group.encode("utf-8")).hexdigest()[:8], 16) % 100
    boundary = 0
    for split, percentage in SPLITS:
        boundary += percentage
        if bucket < boundary:
            return split
    return "test"


def prototype_split(frame_index: int) -> str:
    slot = frame_index % 20
    if slot < 14:
        return "train"
    if slot < 17:
        return "val"
    return "test"


def folder_metadata(source: Path, root: Path) -> tuple[str, str]:
    relative = source.relative_to(root)
    if len(relative.parts) < 3:
        raise ValueError(f"{relative}: expected source_videos/<athlete>/<lift>/<video>")
    athlete, lift = relative.parts[0].strip(), relative.parts[1].strip().lower()
    if lift not in {"squat", "bench", "deadlift"}:
        raise ValueError(f"{relative}: lift folder must be squat, bench, or deadlift")
    return athlete, lift


def source_videos(root: Path) -> list[tuple[Path, str, str]]:
    metadata_path = root / "metadata.csv"
    if metadata_path.is_file():
        with metadata_path.open(encoding="utf-8", newline="") as metadata:
            rows = list(csv.DictReader(metadata))
        required_columns = {"file", "athlete", "lift"}
        if not rows or not required_columns.issubset(rows[0]):
            raise ValueError(f"{metadata_path}: expected columns {', '.join(sorted(required_columns))}")
        videos: list[tuple[Path, str, str]] = []
        for row in rows:
            source = (root / row["file"]).resolve()
            if root not in source.parents or not source.is_file():
                raise ValueError(f"{row['file']}: source video is missing or outside {root}")
            athlete = row["athlete"].strip()
            lift = row["lift"].strip().lower()
            if not athlete:
                raise ValueError(f"{row['file']}: athlete is required")
            if lift not in {"squat", "bench", "deadlift"}:
                raise ValueError(f"{row['file']}: lift must be squat, bench, or deadlift")
            videos.append((source, athlete, lift))
        return videos
    paths = sorted(path for path in root.rglob("*") if path.suffix.lower() in VIDEO_EXTENSIONS) if root.is_dir() else []
    return [(path, *folder_metadata(path, root)) for path in paths]


def main() -> None:
    args = parse_args()
    source_root = args.source.resolve()
    output_root = args.output.resolve()
    if args.frames_per_second <= 0:
        raise ValueError("--frames-per-second must be greater than zero")
    videos = source_videos(source_root)
    if not videos:
        raise SystemExit(f"No videos found under {source_root}. Expected <athlete>/<lift>/<video>.")
    manifest_path = output_root / "annotation_manifest.csv"
    if manifest_path.exists() and not args.overwrite:
        raise SystemExit(f"{manifest_path} already exists; use --overwrite to rebuild extracted frames.")
    if args.overwrite:
        for generated_path in (output_root / "images", output_root / "labels"):
            if generated_path.exists():
                shutil.rmtree(generated_path)
        manifest_path.unlink(missing_ok=True)
    rows: list[dict[str, object]] = []
    for source, athlete, lift in videos:
        athlete_split = split_for(athlete)
        capture = cv2.VideoCapture(str(source))
        source_fps = capture.get(cv2.CAP_PROP_FPS)
        if not capture.isOpened() or source_fps <= 0:
            capture.release()
            raise RuntimeError(f"Could not read {source}")
        interval = max(1, round(source_fps / args.frames_per_second))
        frame_index = 0
        extracted_index = 0
        while True:
            available, frame = capture.read()
            if not available:
                break
            if frame_index % interval == 0:
                split = prototype_split(extracted_index) if args.split_mode == "prototype" else athlete_split
                image_directory = output_root / "images" / split
                label_directory = output_root / "labels" / split
                image_directory.mkdir(parents=True, exist_ok=True)
                label_directory.mkdir(parents=True, exist_ok=True)
                stem = f"{athlete}_{lift}_{source.stem}_{extracted_index:05d}"
                image_path = image_directory / f"{stem}.jpg"
                if not cv2.imwrite(str(image_path), frame, [cv2.IMWRITE_JPEG_QUALITY, 92]):
                    raise RuntimeError(f"Could not write {image_path}")
                rows.append({"image": image_path.relative_to(output_root).as_posix(), "label": f"labels/{split}/{stem}.txt", "athlete": athlete, "lift": lift, "split": split, "split_mode": args.split_mode, "source_video": source.relative_to(source_root).as_posix(), "time_seconds": round(frame_index / source_fps, 3)})
                extracted_index += 1
            frame_index += 1
        capture.release()
    output_root.mkdir(parents=True, exist_ok=True)
    with manifest_path.open("w", newline="", encoding="utf-8") as manifest:
        writer = csv.DictWriter(manifest, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    print(f"Extracted {len(rows)} frames from {len(videos)} videos. Annotation manifest: {manifest_path}")


if __name__ == "__main__":
    main()