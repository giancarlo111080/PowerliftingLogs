# Bar Path Model

This workspace trains a direct barbell detector with two ordered keypoints: the left and right bar-sleeve centers as they appear in the image. It replaces the web analyzer's current shoulder/wrist proxy once a model has passed held-out evaluation.

## Dataset

Only use footage for which every athlete has consented to model training. Keep videos and extracted frames out of Git; `datasets/`, `runs/`, and `models/` are ignored.

Put consented source clips in athlete-isolated folders:

```text
source_videos/
  athlete-001/squat/set-01.mp4
  athlete-001/bench/set-01.mp4
  athlete-002/deadlift/set-01.mp4
```

Use pseudonymous athlete IDs, not names or email addresses. The preparation command assigns each athlete wholly to train, validation, or test, extracts representative frames, and writes an annotation manifest:

```powershell
.\ml\bar_path\run_pipeline.ps1 -Stage Prepare
```

This creates the following ignored layout under `ml/bar_path`:

```text
datasets/bar_path/
  images/{train,val,test}/
  labels/{train,val,test}/
```

Each image has one matching YOLO-pose text file:

```text
class cx cy width height left_x left_y left_visibility right_x right_y right_visibility
```

Coordinates are normalized to `[0, 1]`. Visibility is `0` for absent, `1` for labeled but occluded, and `2` for visible. Keep all frames from one athlete/video in only one split to prevent data leakage. Include squat, bench press, and deadlift footage across different racks, plates, lighting, clothing, camera distances, and body types.

Annotate locally with:

```powershell
.\ml\bar_path\run_pipeline.ps1 -Stage Annotate
```

The annotation window is mouse-driven; `Enter` is ignored. For each frame, drag one bounding box around the complete visible bar and release the mouse, then click the image-left sleeve center followed by the image-right sleeve center. The label saves and advances automatically. Right-click when the requested sleeve is hidden outside the frame or by the athlete. Use the on-screen `RESET`, `QUIT`, and `NO BAR` buttons; completed labels are preserved. `NO BAR` is for setup, transition, or outro frames where no usable barbell is present.

You can alternatively import the frames into CVAT, Roboflow, or Label Studio and export YOLO Pose labels into the corresponding `labels/{split}` folders. The repository does not auto-label people without review because incorrect teacher labels would become training ground truth.

Validation rejects datasets with athlete leakage or without squat, bench, and deadlift frames in each split. This means a credible all-lift experiment needs at least three athlete groups and normally many more. Two clips from one athlete are useful for exercising the interface, but cannot support an honest train/validation/test result.

### Three-Clip Prototype

When only one source clip exists for each lift, use prototype mode to exercise the complete learning pipeline:

```powershell
.\run_pipeline.ps1 -Stage Prepare -Overwrite -Prototype
.\run_pipeline.ps1 -Stage Annotate
.\run_pipeline.ps1 -Stage Train -Prototype -Device cpu -Epochs 3 -RunName prototype-smoke
```

Prototype preparation assigns frames from every clip to all three splits. This permits training and catches integration errors, but adjacent frames come from the same recordings, so validation scores are optimistic and the result must not replace the application analyzer. After the smoke run succeeds, use `-Device 0 -Epochs 50 -RunName prototype-v1` when CUDA is available. Production training omits `-Prototype` and requires independent athletes with every lift represented in train, validation, and test.

## Train

From the repository root in PowerShell:

```powershell
.\ml\bar_path\setup.ps1
.\ml\bar_path\run_pipeline.ps1 -Stage Train -Device 0 -Epochs 100
```

If Python is missing or WinGet reports a broken source index, run `install_python.ps1`. It first repairs WinGet and then falls back to the official Python 3.11.9 per-user installer after validating its Python Software Foundation Authenticode signature:

```powershell
.\ml\bar_path\install_python.ps1
```

The training stage first reports Python, Ultralytics, PyTorch, CUDA/GPU, and free-disk status. It then runs focused regression tests and validates all labels before loading a model. Use `-Device cpu -Epochs 3 -RunName smoke-test` only for a smoke test; useful training requires a CUDA-capable GPU. Ultralytics downloads the pretrained `yolo11n-pose.pt` checkpoint on first use.

## Evaluate And Export

Training writes metrics and checkpoints under `runs/bar-sleeves-v1`. Do not promote a model based only on training loss. Evaluate the untouched test split and export ONNX with:

```powershell
.\ml\bar_path\run_pipeline.ps1 -Stage Evaluate -Device 0
.\ml\bar_path\run_pipeline.ps1 -Stage Export
```

The evaluation stage writes `models/evaluation.json` with held-out box/pose mAP, runtime provenance, and direct sleeve-center error. By default, promotion requires all three lifts in the athlete-isolated test set, at least `90%` detection coverage, mean sleeve error no greater than `0.08` bar widths, and 95th-percentile error no greater than `0.15` bar widths. A failed gate stops `All` before export. These are initial engineering thresholds, not a claim of perfect biomechanics; tighten them as reviewed data grows.

The exported ONNX model is the integration artifact for browser or server inference. Version it separately only after recording its dataset version, test metrics, Ultralytics version, and license obligations. Integration into `client/src/lib/analyzeLiftVideo.web.ts` is intentionally deferred until that acceptance gate passes.

After the first annotation pass, the entire machine-driven portion can run in sequence:

```powershell
.\ml\bar_path\run_pipeline.ps1 -Stage All -Device 0 -Epochs 100
```

`All` stops after frame preparation on a new dataset so a person can annotate it. Run it again after labels are present to validate, train, evaluate, and export.