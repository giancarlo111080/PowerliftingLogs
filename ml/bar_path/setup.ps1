[CmdletBinding()]
param(
    [string]$PythonVersion = "3.11"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepositoryRoot = Split-Path -Parent (Split-Path -Parent $Root)
$Environment = Join-Path $RepositoryRoot ".venv-bar-path"
$Python = Join-Path $Environment "Scripts\python.exe"

function Assert-LastCommand([string]$Description) {
    if ($LASTEXITCODE -ne 0) {
        throw "$Description failed with exit code $LASTEXITCODE."
    }
}

if (-not (Test-Path $Python)) {
    $LauncherCommand = Get-Command py -ErrorAction SilentlyContinue
    $LauncherCandidates = @(
        $(if ($LauncherCommand) { $LauncherCommand.Source }),
        (Join-Path $env:LocalAppData "Programs\Python\Launcher\py.exe"),
        (Join-Path $env:SystemRoot "py.exe")
    ) | Where-Object { $_ -and (Test-Path $_) }
    $Launcher = $LauncherCandidates | Select-Object -First 1
    if (-not $Launcher) {
        throw "The Windows Python launcher is missing. Run: .\ml\bar_path\install_python.ps1"
    }

    $SelectedVersion = $null
    $SupportedVersions = @($PythonVersion, "3.12", "3.11", "3.10") | Select-Object -Unique
    foreach ($Version in $SupportedVersions) {
        & $Launcher "-$Version" -c "import sys; print(sys.executable)" 2>$null
        if ($LASTEXITCODE -eq 0) {
            $SelectedVersion = $Version
            break
        }
    }
    if (-not $SelectedVersion) {
        $InstalledVersions = (& $Launcher -0p 2>&1) -join [Environment]::NewLine
        throw "Python 3.10, 3.11, or 3.12 is required but was not found. Installed launchers:`n$InstalledVersions`nRun: .\ml\bar_path\install_python.ps1"
    }

    Write-Host "Creating the environment with Python $SelectedVersion..."
    & $Launcher "-$SelectedVersion" -m venv $Environment
    Assert-LastCommand "Virtual environment creation"
    if (-not (Test-Path $Python)) {
        throw "Virtual environment creation reported success, but $Python was not created."
    }
}

& $Python -m pip install --upgrade pip
Assert-LastCommand "pip upgrade"
& $Python -m pip install -r (Join-Path $Root "requirements.txt")
Assert-LastCommand "ML dependency installation"
& $Python -m unittest discover -s (Join-Path $Root "tests") -v
Assert-LastCommand "ML regression tests"

Write-Host "Bar-path environment ready: $Python"
