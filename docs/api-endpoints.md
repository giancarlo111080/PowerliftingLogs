# API Endpoints

## Auth, Invitation, and Programming

- `POST /api/auth/register` — registers `COACH` or `ATHLETE`, or accepts an invitation.
- `POST /api/auth/login` — returns a JWT-backed session.
- `POST /api/auth/password-reset/request` — requests reset flow.
- `POST /api/auth/password-reset/complete` — consumes reset token and updates password.
- `GET /api/auth/me` — returns authenticated account.
- `GET /api/auth/invitations/{token}` — validates invitation token.
- `POST /api/coach/athlete-invitations` — coach-only athlete invite creation.
- `GET /api/coach/athletes` — coach-only linked athlete roster.
- `GET|POST|PUT|DELETE /api/program-templates` — coach-owned template operations.
- `POST /api/program-templates/{templateId}/assignments` — clone template into one athlete's live log.
- `GET /api/live-training/current` — authenticated athlete active training log.
- `GET /api/live-training/athletes/{athleteProfileId}` — coach-only athlete active log view.
- `PUT /api/live-training/days/{trainingDayId}` — coach-only live-day updates.

## Existing Training and Sync Endpoints

- `POST /api/sync` — accepts batched offline commands (1 to 100).
- `POST /api/sync/logged-set` — applies one completed or skipped set.
- `POST /api/instagram/validate-video-url` — validates Instagram post/Reel URL.
- `POST /api/training/working-sets` — computes RPE-adjusted working set targets.
- `POST /api/training/warm-ups` — computes warm-up progression and plates.
- `GET /api/training/athletes/{athleteId}/readiness` — returns EWMA readiness metrics.
- `GET /api/training/days/{trainingDayId}/analytics?athleteOneRepMaxKg=...` — planned vs completed tonnage and stress.
