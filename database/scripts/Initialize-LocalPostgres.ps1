[CmdletBinding()]
param(
    [switch]$SeedSampleData
)

$ErrorActionPreference = "Stop"
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$composeFile = Join-Path $repositoryRoot "docker-compose.yml"
$infrastructureProject = Join-Path $repositoryRoot "src\PowerliftingProgram.Infrastructure"
$apiProject = Join-Path $repositoryRoot "src\PowerliftingProgram.Api"
$sampleDataScript = Join-Path $PSScriptRoot "seed-test-data.sql"
$previousAspNetCoreEnvironment = $env:ASPNETCORE_ENVIRONMENT

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker Desktop with Docker Compose v2 is required to create the local PostgreSQL database. Install Docker Desktop, start it, reopen PowerShell, then rerun this script. Use the 'PowerliftingProgram.Api (Temporary In-Memory)' launch profile when persistence is not required."
}

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    throw "The .NET 8 SDK is required. Install it, reopen PowerShell, then rerun this script."
}

$null = & dotnet ef --version 2>$null
if ($LASTEXITCODE -ne 0) {
    throw "The EF Core CLI is required. Run 'dotnet tool install --global dotnet-ef', reopen PowerShell, then rerun this script."
}

Push-Location $repositoryRoot
try {
    $env:ASPNETCORE_ENVIRONMENT = "LocalPostgres"
    docker compose -f $composeFile up -d postgres

    $isReady = $false
    for ($attempt = 1; $attempt -le 30; $attempt++) {
        $healthStatus = (& docker inspect --format "{{.State.Health.Status}}" powerlifting-program-postgres).Trim()
        if ($healthStatus -eq "healthy") {
            $isReady = $true
            break
        }

        Start-Sleep -Seconds 2
    }

    if (-not $isReady) {
        throw "PostgreSQL did not become ready within 60 seconds. Run 'docker compose -f $composeFile logs postgres' to diagnose the container."
    }

    dotnet ef database update --project $infrastructureProject --startup-project $apiProject
    if ($LASTEXITCODE -ne 0) {
        throw "EF Core migrations failed. The test data was not loaded. Resolve the migration error and rerun this script."
    }

    if ($SeedSampleData) {
        Get-Content -LiteralPath $sampleDataScript -Raw |
            docker compose -f $composeFile exec -T postgres psql -v ON_ERROR_STOP=1 -U powerlifting -d powerlifting_program
        if ($LASTEXITCODE -ne 0) {
            throw "Loading PostgreSQL test data failed. Review the psql error above, then rerun this script."
        }
    }
}
finally {
    if ($null -eq $previousAspNetCoreEnvironment) {
        Remove-Item Env:ASPNETCORE_ENVIRONMENT -ErrorAction SilentlyContinue
    }
    else {
        $env:ASPNETCORE_ENVIRONMENT = $previousAspNetCoreEnvironment
    }
    Pop-Location
}
