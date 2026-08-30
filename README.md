# Powerlifting Program

A local-first powerlifting and athletic coaching platform.

This repository contains:
- .NET 8 API (`src/PowerliftingProgram.Api`)
- PostgreSQL-backed persistence (`src/PowerliftingProgram.Infrastructure`)
- Expo React Native client with web export (`client`)
- Free GitHub Pages static demo (`https://<your-github-username>.github.io/PowerliftingLogs/`)

## Documentation Index

- [Architecture and System Overview](docs/architecture.md)
- [Local Development Setup](docs/local-development.md)
- [API Endpoints](docs/api-endpoints.md)
- [Free GitHub Pages Deployment (`github.io`)](docs/github-pages-deployment.md)
- [Azure Deployment (Step-by-Step)](docs/azure-deployment.md)
- [Production Notes](docs/production-notes.md)

## Quick Start

1. Restore and test the backend:
   - `dotnet restore PowerliftingProgram.sln`
   - `dotnet test PowerliftingProgram.sln`
2. Start the API:
   - `dotnet run --project src/PowerliftingProgram.Api --launch-profile "PowerliftingProgram.Api (Temporary In-Memory)"`
3. Start the client:
   - `cd client && npm install && npm run web -- --clear`

For complete setup and deployment details, use the documentation index above.
