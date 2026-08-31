[CmdletBinding()]
param(
    [string]$Version = "3.11.9"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Python = Join-Path $env:LocalAppData "Programs\Python\Python311\python.exe"
$Launcher = Join-Path $env:LocalAppData "Programs\Python\Launcher\py.exe"

if ((Test-Path $Python) -and (Test-Path $Launcher)) {
    Write-Host "Python is already installed at $Python"
    & (Join-Path $Root "setup.ps1")
    exit $LASTEXITCODE
}

$Winget = Get-Command winget -ErrorAction SilentlyContinue
if ($Winget) {
    Write-Host "Repairing WinGet package sources..."
    & $Winget.Source source reset --force
    & $Winget.Source source update
    Write-Host "Trying the WinGet Python package..."
    & $Winget.Source install -e --id Python.Python.3.11 --source winget --scope user --accept-source-agreements --accept-package-agreements
    if ($LASTEXITCODE -eq 0 -and (Test-Path $Launcher)) {
        & (Join-Path $Root "setup.ps1")
        exit $LASTEXITCODE
    }
    Write-Warning "WinGet remains unavailable; using the signed python.org installer instead."
}

$Installer = Join-Path $env:TEMP "python-$Version-amd64.exe"
$Download = "https://www.python.org/ftp/python/$Version/python-$Version-amd64.exe"
try {
    Write-Host "Downloading Python $Version from python.org..."
    Invoke-WebRequest -Uri $Download -OutFile $Installer -UseBasicParsing
    $Signature = Get-AuthenticodeSignature $Installer
    if ($Signature.Status -ne "Valid" -or $Signature.SignerCertificate.Subject -notmatch "Python Software Foundation") {
        throw "The downloaded Python installer did not have a valid Python Software Foundation signature."
    }
    $Process = Start-Process -FilePath $Installer -ArgumentList @(
        "/quiet",
        "InstallAllUsers=0",
        "PrependPath=1",
        "Include_launcher=1",
        "Include_pip=1",
        "Include_test=0"
    ) -Wait -PassThru
    if ($Process.ExitCode -ne 0) {
        throw "The Python installer failed with exit code $($Process.ExitCode)."
    }
} finally {
    Remove-Item $Installer -Force -ErrorAction SilentlyContinue
}

if (-not (Test-Path $Launcher)) {
    throw "Python installation finished but the launcher was not found at $Launcher."
}

Write-Host "Python installed successfully. Creating the ML environment..."
& (Join-Path $Root "setup.ps1")
exit $LASTEXITCODE