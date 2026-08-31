[CmdletBinding()]
param(
    [ValidateSet("Prepare", "Annotate", "Train", "Evaluate", "Export", "All")]
    [string]$Stage = "All",
    [string]$Device = "0",
    [int]$Epochs = 100,
    [string]$RunName = "bar-sleeves-v1",
    [switch]$Overwrite,
    [switch]$Prototype
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Python = Join-Path (Split-Path -Parent (Split-Path -Parent $Root)) ".venv-bar-path\Scripts\python.exe"
$Weights = Join-Path $Root "runs\$RunName\weights\best.pt"
$Manifest = Join-Path $Root "datasets\bar_path\annotation_manifest.csv"

if (-not (Test-Path $Python)) {
    throw "Python environment not found. Run: py -3.11 -m venv .venv-bar-path"
}

if ($Stage -eq "Prepare" -or ($Stage -eq "All" -and -not (Test-Path $Manifest))) {
    $PrepareArguments = @((Join-Path $Root "prepare_dataset.py"))
    if ($Overwrite) { $PrepareArguments += "--overwrite" }
    if ($Prototype) { $PrepareArguments += @("--split-mode", "prototype") }
    & $Python @PrepareArguments
    Write-Host "Annotate every frame listed in datasets/bar_path/annotation_manifest.csv, then rerun with -Stage Train."
    if ($Stage -eq "All") {
        exit 0
    }
}

if ($Stage -in @("Annotate", "All")) {
    & $Python (Join-Path $Root "annotate_frames.py")
}

if ($Stage -in @("Train", "All")) {
    & $Python (Join-Path $Root "preflight.py") --device $Device
    & $Python -m unittest discover -s (Join-Path $Root "tests") -v
    $ValidationArguments = @((Join-Path $Root "validate_dataset.py"))
    if ($Prototype) { $ValidationArguments += "--prototype" }
    & $Python @ValidationArguments
    & $Python (Join-Path $Root "train.py") --device $Device --epochs $Epochs --name $RunName
}

if ($Stage -in @("Evaluate", "All")) {
    if (-not (Test-Path $Weights)) { throw "Trained weights not found: $Weights" }
    & $Python (Join-Path $Root "evaluate.py") $Weights --device $Device
}

if ($Stage -in @("Export", "All")) {
    if (-not (Test-Path $Weights)) { throw "Trained weights not found: $Weights" }
    & $Python (Join-Path $Root "export_onnx.py") $Weights
}