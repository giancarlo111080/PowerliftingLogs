from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

import torch
import ultralytics


def main() -> None:
    parser = argparse.ArgumentParser(description="Check the local runtime before bar-path training.")
    parser.add_argument("--device", default="0")
    parser.add_argument("--minimum-free-gb", type=float, default=10.0)
    args = parser.parse_args()
    workspace = Path(__file__).resolve().parent
    free_gb = shutil.disk_usage(workspace).free / (1024 ** 3)
    cuda_requested = args.device.lower() not in {"cpu", "mps"}
    cuda_available = torch.cuda.is_available()
    report = {
        "python": sys.version.split()[0],
        "ultralytics": ultralytics.__version__,
        "torch": torch.__version__,
        "requestedDevice": args.device,
        "cudaAvailable": cuda_available,
        "cudaDeviceCount": torch.cuda.device_count() if cuda_available else 0,
        "cudaDeviceNames": [torch.cuda.get_device_name(index) for index in range(torch.cuda.device_count())] if cuda_available else [],
        "freeDiskGb": round(free_gb, 2),
    }
    print(json.dumps(report, indent=2))
    errors: list[str] = []
    if sys.version_info < (3, 10):
        errors.append("Python 3.10 or newer is required")
    if cuda_requested and not cuda_available:
        errors.append("a CUDA device was requested but CUDA is unavailable; install a CUDA-enabled PyTorch build or use -Device cpu for a smoke test")
    if free_gb < args.minimum_free_gb:
        errors.append(f"at least {args.minimum_free_gb:g} GB of free disk space is required")
    if errors:
        raise SystemExit("Preflight failed:\n- " + "\n- ".join(errors))


if __name__ == "__main__":
    main()
