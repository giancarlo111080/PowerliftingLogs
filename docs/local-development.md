# Local Development Setup

## Prerequisites

- .NET 8 SDK
- Docker Desktop with Docker Compose v2
- Node.js 20 LTS and npm
- Android Studio or Xcode (only for native simulator runs)

## Temporary In-Memory Database

Use this for fast local API iteration when persistence is not required.

1. `dotnet restore PowerliftingProgram.sln`
2. `dotnet run --project src/PowerliftingProgram.Api --launch-profile "PowerliftingProgram.Api (Temporary In-Memory)"`
3. Open `http://localhost:5080/scalar/v1`

This mode resets on API shutdown.

Sample accounts:
- `coach@ironforge.local` / `LocalDemoCoach!2026`
- `athlete@ironforge.local` / `LocalDemoAthlete!2026`

## Persistent PostgreSQL (Docker)

1. Install EF CLI once:
   - `dotnet tool install --global dotnet-ef`
2. Initialize local PostgreSQL and apply migrations:
   - `./database/scripts/Initialize-LocalPostgres.ps1`
3. Optional sample fixture data:
   - `./database/scripts/Initialize-LocalPostgres.ps1 -SeedSampleData`
4. Start API in persistent mode:
   - `dotnet run --project src/PowerliftingProgram.Api`

## Reset PostgreSQL for End-to-End Testing

- Standard reset:
  - `./database/scripts/Reset-LocalPostgres.ps1`
- Non-interactive reset:
  - `./database/scripts/Reset-LocalPostgres.ps1 -Force`
- Reset plus fixture seed:
  - `./database/scripts/Reset-LocalPostgres.ps1 -Force -SeedSampleData`

## Open PostgreSQL Locally

- Container status:
  - `docker compose ps`
- Database shell:
  - `docker compose exec postgres psql -U powerlifting -d powerlifting_program`

Connection values:
- Host: `localhost`
- Port: `5432`
- Database: `powerlifting_program`
- Username: `powerlifting`
- Password: `powerlifting`

## Run API and Client Together

1. Backend checks:
   - `dotnet test PowerliftingProgram.sln`
2. Client setup:
   - `cd client`
   - `npm install`
3. Create `client/.env`:

```text
EXPO_PUBLIC_API_URL=http://localhost:5080
EXPO_PUBLIC_STATIC_DEMO=false
```

4. Start client:
   - `npm run web -- --clear`
5. Recommended client checks:
   - `npm run typecheck`
   - `npm run lint`
   - `npm run export:web`
