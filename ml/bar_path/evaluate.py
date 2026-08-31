from __future__ import annotations

import argparse
import csv
import json
import platform
import statistics
from datetime import datetime, timezone
from pathlib import Path

import ultralytics
from ultralytics import YOLO


def metric_value(metrics: object, name: str) -> float | None:
    results = getattr(metrics, "results_dict", {})
    value = results.get(name)
    return float(value) if value is not None else None


def percentile(values: list[float], fraction: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    position = fraction * (len(ordered) - 1)
    lower = int(position)
    upper = min(lower + 1, len(ordered) - 1)
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower)


def sleeve_errors(model: YOLO, dataset_root: Path, image_size: int, device: str | None) -> tuple[dict[str, object], dict[str, dict[str, object]]]:
    manifest_path = dataset_root / "annotation_manifest.csv"
    with manifest_path.open(encoding="utf-8", newline="") as manifest:
        test_rows = [row for row in csv.DictReader(manifest) if row["split"] == "test"]
    by_lift: dict[str, list[float]] = {"squat": [], "bench": [], "deadlift": []}
    predicted_by_lift = {lift: 0 for lift in by_lift}
    expected_by_lift = {lift: 0 for lift in by_lift}
    for row in test_rows:
        lift = row["lift"]
        label_fields = (dataset_root / row["label"]).read_text(encoding="utf-8").split()
        if not label_fields:
            continue
        expected_by_lift[lift] += 1
        label_values = [float(value) for value in label_fields]
        bar_width = max(label_values[3], 1e-6)
        ground_truth = ((label_values[5], label_values[6]), (label_values[8], label_values[9]))
        result = model.predict(str(dataset_root / row["image"]), imgsz=image_size, device=device, verbose=False)[0]
        if result.keypoints is None or result.boxes is None or len(result.boxes) == 0:
            continue
        prediction_index = int(result.boxes.conf.argmax().item())
        predicted = result.keypoints.xyn[prediction_index].cpu().tolist()
        if len(predicted) != 2:
            continue
        predicted_by_lift[lift] += 1
        direct = [((predicted[index][0] - ground_truth[index][0]) ** 2 + (predicted[index][1] - ground_truth[index][1]) ** 2) ** 0.5 / bar_width for index in range(2)]
        swapped = [((predicted[1 - index][0] - ground_truth[index][0]) ** 2 + (predicted[1 - index][1] - ground_truth[index][1]) ** 2) ** 0.5 / bar_width for index in range(2)]
        by_lift[lift].extend(direct if sum(direct) <= sum(swapped) else swapped)

    def summarize(lift: str) -> dict[str, object]:
        errors = by_lift[lift]
        expected = expected_by_lift[lift]
        predicted = predicted_by_lift[lift]
        return {
            "testFrames": expected,
            "predictedFrames": predicted,
            "coverage": predicted / expected if expected else 0.0,
            "meanSleeveErrorBarWidths": statistics.fmean(errors) if errors else None,
            "p95SleeveErrorBarWidths": percentile(errors, 0.95),
        }

    per_lift = {lift: summarize(lift) for lift in by_lift}
    all_errors = [error for errors in by_lift.values() for error in errors]
    total_expected = sum(expected_by_lift.values())
    total_predicted = sum(predicted_by_lift.values())
    aggregate = {
        "testFrames": total_expected,
        "predictedFrames": total_predicted,
        "coverage": total_predicted / total_expected if total_expected else 0.0,
        "meanSleeveErrorBarWidths": statistics.fmean(all_errors) if all_errors else None,
        "p95SleeveErrorBarWidths": percentile(all_errors, 0.95),
    }
    return aggregate, per_lift


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate bar-sleeve keypoints on the untouched test split.")
    parser.add_argument("weights", type=Path)
    parser.add_argument("--data", type=Path, default=Path(__file__).parent / "dataset.yaml")
    parser.add_argument("--image-size", type=int, default=960)
    parser.add_argument("--device", default=None)
    parser.add_argument("--output", type=Path, default=Path(__file__).parent / "models" / "evaluation.json")
    parser.add_argument("--minimum-coverage", type=float, default=0.9)
    parser.add_argument("--maximum-mean-error", type=float, default=0.08, help="Maximum sleeve error as a fraction of labeled bar width.")
    parser.add_argument("--maximum-p95-error", type=float, default=0.15, help="Maximum 95th percentile sleeve error as a fraction of labeled bar width.")
    args = parser.parse_args()
    if not args.weights.is_file():
        raise FileNotFoundError(f"Weights not found: {args.weights}")
    model = YOLO(str(args.weights))
    metrics = model.val(data=str(args.data.resolve()), split="test", imgsz=args.image_size, device=args.device, plots=True)
    dataset_config = __import__("yaml").safe_load(args.data.read_text(encoding="utf-8"))
    configured_root = Path(dataset_config["path"])
    dataset_root = configured_root if configured_root.is_absolute() else args.data.parent / configured_root
    aggregate, per_lift = sleeve_errors(model, dataset_root.resolve(), args.image_size, args.device)
    passed = (
        aggregate["coverage"] >= args.minimum_coverage
        and aggregate["meanSleeveErrorBarWidths"] is not None
        and aggregate["meanSleeveErrorBarWidths"] <= args.maximum_mean_error
        and aggregate["p95SleeveErrorBarWidths"] is not None
        and aggregate["p95SleeveErrorBarWidths"] <= args.maximum_p95_error
        and all(result["testFrames"] > 0 for result in per_lift.values())
    )
    report = {
        "evaluatedAt": datetime.now(timezone.utc).isoformat(),
        "weights": str(args.weights.resolve()),
        "dataset": str(args.data.resolve()),
        "ultralyticsVersion": ultralytics.__version__,
        "pythonVersion": platform.python_version(),
        "metrics": {
            "boxMap50": metric_value(metrics, "metrics/mAP50(B)"),
            "boxMap50To95": metric_value(metrics, "metrics/mAP50-95(B)"),
            "poseMap50": metric_value(metrics, "metrics/mAP50(P)"),
            "poseMap50To95": metric_value(metrics, "metrics/mAP50-95(P)"),
        },
        "barPath": {"aggregate": aggregate, "byLift": per_lift},
        "acceptance": {
            "passed": passed,
            "minimumCoverage": args.minimum_coverage,
            "maximumMeanErrorBarWidths": args.maximum_mean_error,
            "maximumP95ErrorBarWidths": args.maximum_p95_error,
            "requiresEveryLiftInTest": True,
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"Evaluation report: {args.output.resolve()}")
    if not passed:
        raise SystemExit("Model did not pass the bar-path promotion thresholds. See the evaluation report.")


if __name__ == "__main__":
    main()
