# Nurse intake: queue API (SCRUM-145)

Teammate 2 branch: `feat/intake-consultation`.

## Implemented: GET /api/nurse/queue

The endpoint requires a nurse session and rechecks the current database account's
role and deactivation status. It needs no query parameters: today is calculated
on the server using `Asia/Colombo`.

The response is `{ entries: NurseQueueEntry[] }`, defined in
`lib/schemas/intake.ts`. Each entry contains the queue ID, encounter ID, appointment
ID and unchanged appointment number, check-in timestamp in ISO format, doctor ID
and name, and patient ID, patient number and name. An empty queue returns
`{ entries: [] }`. No clinical history, notes, prescriptions or contact details
are included.

Entries must have a booked appointment dated today, a waiting queue entry and an
in-progress encounter. They are ordered by check-in timestamp, then queue ID.
Both successful and error responses use `Cache-Control: no-store`.

The route returns 401 without a session, 403 for other roles or an unavailable
account, and a generic 500 response for unexpected failures. It does not write
records or advance workflow state.

## Verification

```powershell
pnpm exec vitest run tests/unit/nurse-queue-route.test.ts tests/unit/nurse-queue-service.test.ts --configLoader native --no-cache --no-fsModuleCache
pnpm exec tsc --noEmit --incremental false
```

`tests/integration/intake.test.ts` verifies the actual PostgreSQL joins, filtering,
ordering and access restrictions. Following the existing integration suites, it
requires `FOUNDATION_TEST_DATABASE_URL` or `BOOKING_TEST_DATABASE_URL` explicitly
pointing to a dedicated PostgreSQL test service whose role can create databases.
It creates and drops only its own uniquely named database, runs the migrations
there, and never falls back to the application's `DATABASE_URL`. Without either
test variable, the suite is skipped.

```powershell
pnpm exec vitest run tests/integration/intake.test.ts --configLoader native --no-cache --no-fsModuleCache
```

## Next task

Implement validated intake writes and atomic handoff through
`POST /api/encounters/:id/intake`. Nurse UI wiring remains a later task; the
existing nurse prototype still uses its temporary provider. The vitals,
preliminary-note and audit schemas are already supplied by the shared foundation.
