# Powerlifting Program

A local-first powerlifting and athletic coaching platform. The repository contains a .NET 8 API with a PostgreSQL database, an Expo React Native client that exports to the web, and a fully client-side GitHub Pages demo. The product stores a public Instagram post or Reel URL against a training set; it does not upload, proxy, download, or host video.

## Iron Forge Coaching Platform

Iron Forge is dark by default, with charcoal surfaces, chalk text, Iron Crimson actions, zinc highlights, industrial display headings, and monospaced training data. The Expo client uses explicit `COACH` and `ATHLETE` roles. A server-issued JWT is stored only for the authenticated session; client navigation guards keep athletes out of master-program screens, while API guards ensure a coach can access only athletes linked to that coach.

Registration is open for independent coaches and athletes at `/register`. A coach can also generate an athlete invitation from the Dashboard. The API hashes a one-time 256-bit invite token, expires it after 48 hours, sends the branded **Your Coach has invited you to Iron Forge** email through Resend when `Email__Resend__ApiKey` is configured, and forces invite-based registration to create an `ATHLETE` linked to the issuing coach. With no Resend key in local development, the invitation URL is logged by the API and returned only to the authenticated issuing coach.

The coach-only **Programs** route manages reusable master templates: `Template -> Weeks -> Days -> Exercises -> Sets x Reps @ RPE / %1RM / exact load`. Assigning a template clones it into a dated, active live training log for exactly one linked athlete. The master template is unchanged afterward; coaches can update a live training day through the API without mutating the source template. In Training Log, athletes record completed loads, reps, and statuses, and coaches can review and adjust the assigned work.

## System Overview and Architecture

```mermaid
flowchart LR
    A[Expo React Native client] -->|optimistic mutation| B[TanStack Query cache]
    B --> C[Offline command ledger]
    C -->|online batch sync with UUID command IDs| D[.NET 8 Web API]
    D --> E[FluentValidation]
    E --> F[Application services]
    F --> G[EF Core]
    G --> H[(PostgreSQL)]
    C -->|static demo mode| I[AsyncStorage / browser local storage]
    J[WatermelonDB schema] --> C
    K[Instagram post or Reel] -->|stored URL only| H
```

The solution uses Clean Architecture boundaries:

- `PowerliftingProgram.Domain` contains framework-free entities and enumerations.
- `PowerliftingProgram.Application` owns commands, strict FluentValidation rules, fatigue/readiness modeling, programming calculations, session analytics, and reward rules.
- `PowerliftingProgram.Infrastructure` implements EF Core persistence, idempotent command processing, and Instagram URL policy.
- `PowerliftingProgram.Api` exposes HTTP endpoints and selects either a temporary in-memory store or PostgreSQL at startup.
- `client` is the Expo Router application used for Android, iOS, and React Native Web.

The relational hierarchy is `AthleteProfile -> TrainingBlock -> TrainingWeek -> TrainingDay -> PrescribedExercise -> TrainingSet`. Contextual coach conversations can target a day, exercise, or individual set. `SyncCommand.CommandId` is unique in PostgreSQL, so retrying an offline command returns the original outcome instead of applying the mutation twice.

### Training Load and Readiness

For each completed set, the application computes stress as:

$$
Stress = Reps \times \left(\frac{\%1RM}{70}\right)^2 \times (Effort\%)^5 \times ExerciseTypeModifier
$$

The `%1RM` term uses percentage points, for example `75` for $75\%$.

Acute load uses a 7-day exponential decay and chronic load uses a 28-day decay. For either load $L$, daily stress $S$, and decay duration $D$:

$$
L_t = e^{-1/D}L_{t-1} + (1 - e^{-1/D})S_t
$$

The readiness score compares acute load to chronic load, then clamps the fatigue penalty to output an integer from 0 to 100. Rest days are processed as $S_t = 0$, so both loads decay naturally even when no workout is logged.

### Offline and Video Behavior

The client writes a set status or Instagram URL to local storage before network I/O, updates TanStack Query immediately, then appends a UUID-backed command to `sync_commands`. A connectivity listener flushes the commands to `POST /api/sync` when a network is available. The server persists processed command IDs to make the flush idempotent.

Instagram URLs must be HTTPS links hosted on `instagram.com` or a subdomain and begin with `/p/` or `/reel/`. Use only public links that athletes and coaches are permitted to share. The application does not authenticate to Instagram and does not guarantee availability of third-party content.

## Repository Layout

```text
.
├── PowerliftingProgram.sln
├── docker-compose.yml
├── database/scripts/
│   ├── Initialize-LocalPostgres.ps1
│   └── seed-test-data.sql
├── src/
│   ├── PowerliftingProgram.Api/
│   ├── PowerliftingProgram.Application/
│   ├── PowerliftingProgram.Domain/
│   └── PowerliftingProgram.Infrastructure/
├── tests/PowerliftingProgram.Application.Tests/
├── client/
│   ├── app/
│   ├── src/data/watermelonSchema.ts
│   ├── src/data/localStore.ts
│   └── src/hooks/useSyncWorkout.ts
└── .github/workflows/deploy-pages.yml
```

## Local Installation

### Prerequisites

Install the following before starting:

- .NET 8 SDK
- Docker Desktop with Docker Compose v2 for durable PostgreSQL mode
- Node.js 20 LTS and npm
- Android Studio or Xcode only when running a native simulator

### Temporary Mock Database

`Development` uses EF Core's InMemory provider. It creates a transient database named `powerlifting-program-development` and loads a deterministic athlete, active block, Week 4 / Day 1 workout, completed/pending sets, coach feedback, an Instagram link, a sync command, and an achievement. The data exists only while the API process is running.

1. Restore packages with `dotnet restore PowerliftingProgram.sln`.
2. Run the API with `dotnet run --project src/PowerliftingProgram.Api --urls http://localhost:5080`.
3. Open `http://localhost:5080/scalar/v1` and exercise the API against the seeded mock data.

The committed launch profile sets `ASPNETCORE_ENVIRONMENT=Development`, so Visual Studio, Rider, and `dotnet run` use mock mode by default. No Docker or PostgreSQL installation is required for this path.

### Create PostgreSQL and Test Data

The durable PostgreSQL schema is defined by EF migrations `20260827000000_InitialCreate` and `20260828000000_AddCoachingPlatform`. Together they create the athlete, account, coach invitation, master-template, live-training, set logging, comment, achievement, and synchronization-ledger tables. `database/scripts/seed-test-data.sql` is an idempotent fixture matching the mock dataset.

1. Install Docker Desktop and the EF CLI once: `dotnet tool install --global dotnet-ef`.
   On Windows with WinGet, install Docker Desktop with `winget install -e --id Docker.DockerDesktop`, launch Docker Desktop, complete its setup, and reopen PowerShell so `docker --version` succeeds.
2. From the repository root, run:

   ```powershell
   .\database\scripts\Initialize-LocalPostgres.ps1
   ```

3. The script starts the PostgreSQL container, applies EF migrations, and loads test data. The database is `powerlifting_program` at `localhost:5432`, with the `powerlifting` user and password configured in `docker-compose.yml`.
4. To create only the tables and skip sample data, run `./database/scripts/Initialize-LocalPostgres.ps1 -SkipSampleData`.
5. To run the API against PostgreSQL, set the environment before starting it:

   ```powershell
   $env:ASPNETCORE_ENVIRONMENT = "LocalPostgres"
   dotnet run --project src/PowerliftingProgram.Api --urls http://localhost:5080
   ```

### Open the Local PostgreSQL Database

The PostgreSQL database is available only when the Docker container is running. Check its status from the repository root:

```powershell
docker compose ps
```

Open an interactive database prompt with:

```powershell
docker compose exec postgres psql -U powerlifting -d powerlifting_program
```

Useful `psql` commands:

```sql
\dt
SELECT "Email", "DisplayName", "Role", "CoachId" FROM "PlatformUsers";
SELECT "DisplayName", "CompetitionWeightClass" FROM "AthleteProfiles";
\q
```

You can also connect using pgAdmin, DBeaver, or a PostgreSQL extension with these values:

```text
Host: localhost
Port: 5432
Database: powerlifting_program
Username: powerlifting
Password: powerlifting
```

The `Development` environment uses an EF Core in-memory database instead. It cannot be opened with a database client and is cleared when the API process stops.

### Run the .NET API

1. Run `dotnet test PowerliftingProgram.sln` after restoring packages.
2. Choose one database mode before starting the API: the mock mode above, or `LocalPostgres` for a durable local database.
3. To add a schema change, modify the entity/configuration, then create and apply a migration:

   ```powershell
   $env:ASPNETCORE_ENVIRONMENT = "LocalPostgres"
   dotnet ef migrations add MeaningfulMigrationName --project src/PowerliftingProgram.Infrastructure --startup-project src/PowerliftingProgram.Api
   dotnet ef database update --project src/PowerliftingProgram.Infrastructure --startup-project src/PowerliftingProgram.Api
   ```

4. Scalar API reference is available at `http://localhost:5080/scalar/v1` in Development and LocalPostgres.

When Docker is unavailable, use the Temporary Mock Database section. It provides the same EF entity model and seed fixture for API development but does not persist data after the API stops.

For a containerized API build, run this from the repository root:

```powershell
docker build -f src/PowerliftingProgram.Api/Dockerfile -t powerlifting-program-api .
docker run --rm -p 8080:8080 --env-file .env powerlifting-program-api
```

### Run the Expo Client

1. Open a second terminal and change to `client`.
2. Install dependencies with `npm install`.
3. Create `client/.env` with the following values for a live local API:

   ```text
   EXPO_PUBLIC_API_URL=http://localhost:5080
   EXPO_PUBLIC_STATIC_DEMO=false
   ```

4. Start the Expo development server with `npm run web -- --clear`, or use `npm run start` then press `w` for the web client, `a` for Android, or `i` for iOS. Use the URL shown by Expo, commonly `http://localhost:8081`.
6. Run `npm run typecheck` before opening a pull request.

The first client visit opens a development-only proxy login. Choose `Alex Morgan` for the lifter dashboard or `Coach Taylor` for the coach dashboard. The role is saved locally, Dashboard is the first signed-in screen, and Log out clears the proxy session. Coaches can select an active athlete from the sidebar; lifters are limited to their own data. The coach-only **Programs** route presents `Program -> Weeks -> Training days -> Exercise prescriptions`: coaches create, edit, activate, and delete programs; add or remove weeks and days; add Squat, Bench, Deadlift, or accessory prescriptions; and prescribe each exercise by RPE, RIR, or an exact kg/lb load. Created programs and every later plan change are immediately available in the selected athlete's **Training Log**. Coaches can also add a dated workout day or a complete accessory prescription directly while reviewing that log. The **Program Schedule** route gives every training day a planned date: coaches set or revise dates, while lifters may move one workout or reflow every workout in a disrupted week from a new start date. The last scheduling change records whether the coach or lifter made it. The shared **Training Log** is the athlete's complete program view: either role can select a program and navigate every scheduled day using the day list or previous/next controls. Athletes enter the actual weight lifted before completing every RPE or RIR set, attach a public Instagram post or Reel to any set, and give the session a $1$–$10$ effort rating for future stress management. Both identities leave local comments directly under the selected training log. **Analytics** reads those program-day logs to render weekly completed tonnage, done/skipped/remaining set adherence, heaviest squat/bench/deadlift sets, session-rating trend, and a fatigue/readiness planning estimate. There is no standalone chat workflow. Profile edits, program edits, schedules, comments, logs, and notification choices are stored locally for development.

The client has a WatermelonDB schema at `client/src/data/watermelonSchema.ts` for the native local database hierarchy. The included static demo adapter uses AsyncStorage, which maps to browser local storage on the web. This makes the app deployable to GitHub Pages while maintaining the same snapshot and command-ledger contract used by the production synchronization path.

### Auth, Invite, and Programming Endpoints

- `POST /api/auth/register`: registers an independent `COACH` or `ATHLETE`, or accepts a valid athlete invitation.
- `POST /api/auth/login`: returns a JWT-backed account session.
- `GET /api/auth/me`: returns the authenticated account.
- `GET /api/auth/invitations/{token}`: validates an unexpired invitation for registration.
- `POST /api/coach/athlete-invitations`: coach-only creation and branded email delivery of a 48-hour athlete invite.
- `GET /api/coach/athletes`: coach-only roster limited to athletes linked to the requesting coach.
- `GET|POST|PUT|DELETE /api/program-templates`: coach-owned master-template operations.
- `POST /api/program-templates/{templateId}/assignments`: clones a template into one athlete's live training log.
- `GET /api/live-training/current`: returns the authenticated athlete's active assigned log.
- `GET /api/live-training/athletes/{athleteProfileId}`: coach-only active-log review for a linked athlete.
- `PUT /api/live-training/days/{trainingDayId}`: coach-only live-day modification; never edits a master template.

### Existing Training Endpoints

- `POST /api/sync`: accepts 1 to 100 pending ledger commands and returns each processed/rejected outcome.
- `POST /api/sync/logged-set`: validates and applies one completed or skipped set.
- `POST /api/instagram/validate-video-url`: validates an Instagram post/Reel URL without storing media.
- `POST /api/training/working-sets`: calculates RPE-adjusted working-set targets from e1RM.
- `POST /api/training/warm-ups`: calculates progressive barbell warm-ups and per-side plate loading.
- `GET /api/training/athletes/{athleteId}/readiness`: returns 7-day/28-day EWMA readiness.
- `GET /api/training/days/{trainingDayId}/analytics?athleteOneRepMaxKg=...`: returns planned versus completed tonnage and stress.

## GitHub Pages Static Demo

GitHub Pages is a static file host. It cannot run ASP.NET Core, PostgreSQL, EF Core migrations, or a secure server-side sync API. The Pages deployment intentionally runs a separate client-only mode:

1. The workflow sets `EXPO_PUBLIC_STATIC_DEMO=true`.
2. `client/src/data/localStore.ts` reads the built-in Day 1 dataset and persists all changes to browser local storage.
3. Logging sets, calculating local e1RM values, attaching Instagram links, and viewing readiness/progress stay fully interactive without an API.
4. Flushing the local ledger in demo mode marks its local commands processed; it never sends data to a server.

To enable deployment:

1. Push this repository to GitHub.
2. In repository **Settings**, open **Pages**.
3. Select **GitHub Actions** as the build and deployment source.
4. Push to `main`, or run **Deploy static demo to GitHub Pages** from the Actions tab.
5. GitHub publishes the demo at `https://<username>.github.io/<repository-name>/`.

The workflow exports the Expo web application with a repository-aware base URL and uploads `client/dist` as the Pages artifact. It does not require API keys, database credentials, or Instagram credentials.

For a real deployment, host the API container on an ASP.NET-compatible service and host PostgreSQL separately. Set the client build variable `EXPO_PUBLIC_API_URL` to the public HTTPS API origin, set API `Cors:AllowedOrigins` to the web application origin, use a managed PostgreSQL connection string via deployment secrets, and turn off automatic migrations unless the deployment process owns schema changes.

## Production Notes

- Keep `Authentication__Jwt__SigningKey` in secret storage, use a random value of at least 32 characters, and rotate it on a regular production schedule.
- Set `Email__Resend__ApiKey` and a verified `Email__Resend__From` address before sending production invitations.
- Terminate TLS before the API and allow only trusted CORS origins.
- Use database backups, health checks, and managed secret injection for the production PostgreSQL connection string.
- Keep the unique `SyncCommands.CommandId` index intact. It is the server-side replay guard for offline mutations.
- Instagram content availability and access are controlled by Instagram and the account owner. Store links only with consent and honor applicable privacy, athlete-data, and platform policies.
#   P o w e r l i f t i n g P r o g r a m 
 
 
gee javier athlete giancarlomallarejavier22@gmail.com
1234567!@#$%

giancarlo javier coach giancarlojavier22@gmail.com
imthecoach