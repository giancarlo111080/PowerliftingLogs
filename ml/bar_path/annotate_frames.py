from __future__ import annotations

import argparse
import csv
from pathlib import Path

import cv2

WINDOW_NAME = "Iron Forge bar annotation"
HEADER_HEIGHT = 52
MINIMUM_BOX_SIZE = 8
NO_BAR = "no-bar"
MAXIMUM_DISPLAY_WIDTH = 1200
MAXIMUM_DISPLAY_HEIGHT = 820


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Annotate one bar box and two sleeve centers per extracted frame.")
    parser.add_argument("--dataset", type=Path, default=Path(__file__).parent / "datasets" / "bar_path")
    return parser.parse_args()


def collect_annotation(image: cv2.typing.MatLike) -> tuple[tuple[int, int, int, int], list[tuple[int, int, int]]] | str | None:
    image_height, image_width = image.shape[:2]
    scale = min(1.0, MAXIMUM_DISPLAY_WIDTH / image_width, (MAXIMUM_DISPLAY_HEIGHT - HEADER_HEIGHT) / image_height)
    display_width = max(1, round(image_width * scale))
    display_height = max(1, round(image_height * scale))
    display_image = cv2.resize(image, (display_width, display_height), interpolation=cv2.INTER_AREA) if scale < 1 else image.copy()
    state: dict[str, object] = {
        "box": None,
        "drag_start": None,
        "drag_current": None,
        "points": [],
        "quit": False,
        "no_bar": False,
    }

    def reset() -> None:
        state["box"] = None
        state["drag_start"] = None
        state["drag_current"] = None
        state["points"] = []

    def on_mouse(event: int, x_value: int, y_value: int, _flags: int, _parameter: object) -> None:
        if event == cv2.EVENT_LBUTTONDOWN and y_value < HEADER_HEIGHT:
            if x_value < 100:
                reset()
            elif x_value < 200:
                state["quit"] = True
            elif x_value < 310:
                state["no_bar"] = True
            return
        image_y = y_value - HEADER_HEIGHT
        if state["box"] is None:
            if event == cv2.EVENT_LBUTTONDOWN and image_y >= 0:
                state["drag_start"] = (x_value, image_y)
                state["drag_current"] = (x_value, image_y)
            elif event == cv2.EVENT_MOUSEMOVE and state["drag_start"] is not None:
                state["drag_current"] = (x_value, image_y)
            elif event == cv2.EVENT_LBUTTONUP and state["drag_start"] is not None:
                start_x, start_y = state["drag_start"]  # type: ignore[misc]
                left, top = min(start_x, x_value), min(start_y, image_y)
                width, height = abs(x_value - start_x), abs(image_y - start_y)
                state["drag_start"] = None
                state["drag_current"] = None
                if width >= MINIMUM_BOX_SIZE and height >= MINIMUM_BOX_SIZE:
                    state["box"] = (left, top, width, height)
            return
        points = state["points"]
        if event == cv2.EVENT_LBUTTONDOWN and image_y >= 0 and isinstance(points, list) and len(points) < 2:
            points.append((x_value, image_y, 2))
        elif event == cv2.EVENT_RBUTTONDOWN and isinstance(points, list) and len(points) < 2:
            points.append((0, 0, 0))

    cv2.setMouseCallback(WINDOW_NAME, on_mouse)
    while True:
        frame = cv2.copyMakeBorder(display_image, HEADER_HEIGHT, 0, 0, 0, cv2.BORDER_CONSTANT, value=(0, 0, 0))
        box = state["box"]
        drag_start = state["drag_start"]
        drag_current = state["drag_current"]
        points = state["points"]
        if isinstance(box, tuple):
            x_coordinate, y_coordinate, width, height = box
            cv2.rectangle(frame, (x_coordinate, y_coordinate + HEADER_HEIGHT), (x_coordinate + width, y_coordinate + height + HEADER_HEIGHT), (0, 255, 0), 2)
        elif isinstance(drag_start, tuple) and isinstance(drag_current, tuple):
            cv2.rectangle(frame, (drag_start[0], drag_start[1] + HEADER_HEIGHT), (drag_current[0], drag_current[1] + HEADER_HEIGHT), (0, 255, 255), 2)
        if isinstance(points, list):
            for index, point in enumerate(points):
                point_x, point_y, visibility = point
                label = "LEFT" if index == 0 else "RIGHT"
                if visibility == 0:
                    cv2.putText(frame, f"{label}: hidden", (12, 82 + index * 26), cv2.FONT_HERSHEY_SIMPLEX, 0.58, (0, 0, 255), 2)
                else:
                    display_point = (point_x, point_y + HEADER_HEIGHT)
                    cv2.circle(frame, display_point, 6, (0, 0, 255), -1)
                    cv2.putText(frame, label, (display_point[0] + 8, display_point[1]), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 0, 255), 2)
        cv2.rectangle(frame, (0, 0), (frame.shape[1], HEADER_HEIGHT), (0, 0, 0), -1)
        cv2.rectangle(frame, (8, 8), (96, 43), (70, 70, 70), -1)
        cv2.rectangle(frame, (104, 8), (192, 43), (40, 40, 160), -1)
        cv2.rectangle(frame, (200, 8), (306, 43), (130, 80, 20), -1)
        cv2.putText(frame, "RESET", (20, 32), cv2.FONT_HERSHEY_SIMPLEX, 0.52, (255, 255, 255), 2)
        cv2.putText(frame, "QUIT", (125, 32), cv2.FONT_HERSHEY_SIMPLEX, 0.52, (255, 255, 255), 2)
        cv2.putText(frame, "NO BAR", (216, 32), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (255, 255, 255), 2)
        if box is None:
            instruction = "Drag a box around the actual bar; release to confirm"
        else:
            point_count = len(points) if isinstance(points, list) else 0
            side = "LEFT" if point_count == 0 else "RIGHT"
            instruction = f"Click image-{side} hub; right-click if hidden"
        cv2.putText(frame, instruction, (320, 32), cv2.FONT_HERSHEY_SIMPLEX, 0.43, (255, 255, 255), 1)
        cv2.imshow(WINDOW_NAME, frame)
        key = cv2.waitKey(20) & 0xFF
        if key in {ord("q"), 27} or state["quit"]:
            return None
        if state["no_bar"]:
            return NO_BAR
        if key == ord("r"):
            reset()
        if isinstance(box, tuple) and isinstance(points, list) and len(points) == 2:
            original_box = tuple(round(value / scale) for value in box)
            original_points = [(round(point_x / scale), round(point_y / scale), visibility) if visibility else (0, 0, 0) for point_x, point_y, visibility in points]
            return original_box, original_points


def normalized_label(image: cv2.typing.MatLike, box: tuple[int, int, int, int], points: list[tuple[int, int, int]]) -> str:
    image_height, image_width = image.shape[:2]
    x_coordinate, y_coordinate, box_width, box_height = box
    center_x = (x_coordinate + box_width / 2) / image_width
    center_y = (y_coordinate + box_height / 2) / image_height
    values: list[float | int] = [0, center_x, center_y, box_width / image_width, box_height / image_height]
    for point_x, point_y, visibility in points:
        values.extend((point_x / image_width, point_y / image_height, visibility))
    return " ".join(str(value) if isinstance(value, int) else f"{value:.6f}" for value in values) + "\n"


def main() -> None:
    args = parse_args()
    dataset = args.dataset.resolve()
    manifest_path = dataset / "annotation_manifest.csv"
    if not manifest_path.is_file():
        raise SystemExit(f"Annotation manifest not found: {manifest_path}. Run prepare_dataset.py first.")
    with manifest_path.open(encoding="utf-8", newline="") as manifest:
        rows = list(csv.DictReader(manifest))
    source_metadata_path = Path(__file__).parent / "source_videos" / "metadata.csv"
    if source_metadata_path.is_file():
        with source_metadata_path.open(encoding="utf-8", newline="") as metadata:
            expected = {row["file"]: (row["athlete"], row["lift"]) for row in csv.DictReader(metadata)}
        stale_rows = [row for row in rows if expected.get(row["source_video"]) != (row["athlete"], row["lift"])]
        if stale_rows:
            raise SystemExit("The annotation manifest uses stale athlete/lift metadata. Run: .\\run_pipeline.ps1 -Stage Prepare -Overwrite")
    pending = [row for row in rows if not (dataset / row["label"]).is_file()]
    if not pending:
        print("All manifest frames are already annotated.")
        return
    cv2.namedWindow(WINDOW_NAME, cv2.WINDOW_AUTOSIZE)
    if hasattr(cv2, "WND_PROP_TOPMOST"):
        cv2.setWindowProperty(WINDOW_NAME, cv2.WND_PROP_TOPMOST, 1)
    try:
        for index, row in enumerate(pending, start=1):
            image_path = dataset / row["image"]
            label_path = dataset / row["label"]
            image = cv2.imread(str(image_path))
            if image is None:
                raise RuntimeError(f"Could not read {image_path}")
            cv2.setWindowTitle(WINDOW_NAME, f"Iron Forge bar annotation ({index}/{len(pending)})")
            annotation = collect_annotation(image)
            if annotation is None:
                print(f"Stopped before {image_path.name}; completed labels were preserved.")
                break
            label_path.parent.mkdir(parents=True, exist_ok=True)
            if annotation == NO_BAR:
                label_path.write_text("", encoding="utf-8")
            else:
                box, points = annotation
                label_path.write_text(normalized_label(image, box, points), encoding="utf-8")
            print(f"Annotated {row['image']}")
    finally:
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()