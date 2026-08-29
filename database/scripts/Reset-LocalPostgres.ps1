[CmdletBinding(SupportsShouldProcess, ConfirmImpact = "High")]
param(
    [switch]$Force,
    [switch]$SeedSampleData
)

$ErrorActionPreference = "Stop"
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$composeFile = Join-Path $repositoryRoot "docker-compose.yml"
$initializeScript = Join-Path $PSScriptRoot "Initialize-LocalPostgres.ps1"
$solutionFile = Join-Path $repositoryRoot "PowerliftingProgram.sln"
$databaseName = "powerlifting_program"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker Desktop with Docker Compose v2 is required. Start Docker Desktop, reopen PowerShell, and rerun this script."
}

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    throw "The .NET 8 SDK is required. Install it, reopen PowerShell, and rerun this script."
}

Write-Host "Validating the solution before resetting PostgreSQL..."
dotnet build $solutionFile
if ($LASTEXITCODE -ne 0) {
    throw "Solution build failed. PostgreSQL was not modified. Resolve the compiler errors above, then rerun this script."
}

if (-not $Force -and -not $PSCmdlet.ShouldProcess(
    "local PostgreSQL database '$databaseName'",
    "Permanently delete all accounts, invitations, coaching assignments, programs, logs, and events")) {
    Write-Host "Database reset cancelled."
    exit 0
}

Push-Location $repositoryRoot
try {
    $expectedContainerId = & docker compose -f $composeFile ps -q postgres 2>$null
    $namedContainerId = & docker ps -aq --filter "name=^/powerlifting-program-postgres$" 2>$null
    if ($namedContainerId -and $namedContainerId -ne $expectedContainerId) {
        $containerImage = & docker inspect --format "{{.Config.Image}}" $namedContainerId 2>$null
        if ($containerImage -notlike "postgres:*") {
            throw "Container name 'powerlifting-program-postgres' is owned by image '$containerImage'. Rename or remove that container manually before resetting the database."
        }

        Write-Host "Removing conflicting local PostgreSQL container $namedContainerId..."
        docker rm -f $namedContainerId
        if ($LASTEXITCODE -ne 0) {
            throw "Could not remove the conflicting local PostgreSQL container."
        }
    }

    docker compose -f $composeFile up -d postgres
    if ($LASTEXITCODE -ne 0) {
        throw "Could not start the local PostgreSQL container."
    }

    $isReady = $false
    for ($attempt = 1; $attempt -le 30; $attempt++) {
        $healthStatus = & docker inspect --format "{{.State.Health.Status}}" powerlifting-program-postgres 2>$null
        if ($healthStatus -eq "healthy") {
            $isReady = $true
            break
        }
        Start-Sleep -Seconds 2
    }
    if (-not $isReady) {
        throw "PostgreSQL did not become ready within 60 seconds."
    }

    $resetSql = @"
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '$databaseName' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS $databaseName;
CREATE DATABASE $databaseName OWNER powerlifting;
"@
    $resetSql | docker compose -f $composeFile exec -T postgres psql -v ON_ERROR_STOP=1 -U powerlifting -d postgres
    if ($LASTEXITCODE -ne 0) {
        throw "Database recreation failed. Stop the API and any database clients, then rerun the script."
    }

    $initializeArguments = @{}
    if ($SeedSampleData) {
        $initializeArguments.SeedSampleData = $true
    }
    & $initializeScript @initializeArguments
    if ($LASTEXITCODE -ne 0) {
        throw "The database was cleared, but schema initialization failed. Review the error above."
    }

    Write-Host "Local PostgreSQL was reset successfully." -ForegroundColor Green
    Write-Host "Database: $databaseName"
    Write-Host $(if ($SeedSampleData) { "Sample workflow data was loaded." } else { "Database is empty and ready for registration and invitation testing." })
}
finally {
    Pop-Location
}