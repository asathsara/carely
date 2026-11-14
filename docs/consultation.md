# Consultation API (SCRUM-144)

Teammate 2 branch: `feat/intake-consultation`.

## Implemented: open a consultation

`POST /api/doctor/queue/:entryId/open` accepts an empty body or `{}`. The entry ID
must be a UUID. All JSON body fields are rejected: the caller cannot choose a
doctor, a timestamp, or a target status. Session authentication supplies the actor.
Cross-origin writes are rejected, and every response uses `Cache-Control: no-store`.

The service requires a current active doctor account and active doctor profile
assigned to the appointment. The appointment must be booked for today in
`Asia/Colombo`, the checked-in encounter must be in progress, and the queue entry
must be `intake_done`.

The service locks appointment → encounter → queue, then calls
`transitionQueueEntry` with the same transaction to change `intake_done` to
`with_doctor`. That helper sets `queue_entry.called_at` using server time and
writes `queue.status_changed`. The service writes `consultation.opened` against
the encounter in the same transaction. Its audit metadata contains only the old
and new statuses. If any part fails, the state, timestamp and audits roll back.

Opening checks `intake_done` itself; it cannot call `assertEncounterWritable`
before opening because that helper expects the doctor to be in `with_doctor`.
The encounter remains in progress, preserving its original `started_at`, and
appointment numbers and check-in timestamps remain unchanged. Reopening an
already-open visit returns a conflict. No limit of one active visit per doctor
is imposed; the sprint plan treats that rule as optional hardening.

Success returns 200:

```json
{
  "consultation": {
    "encounterId": "<encounter UUID>",
    "queueEntryId": "<queue UUID>",
    "status": "with_doctor",
    "calledAt": "<ISO timestamp>"
  }
}
```

Errors:

- 400: invalid queue UUID, malformed JSON, or unsupported body fields.
- 401: no authenticated session.
- 403: wrong role, unavailable current account, or cross-origin write.
- 404: missing entry/appointment, an unrelated doctor, an inactive doctor profile,
  or a cancelled appointment (excluded by the shared treating-doctor policy).
- 409: wrong queue phase, missing checked-in encounter, completed encounter,
  a non-booked or non-today appointment otherwise accessible to the doctor,
  or a concurrent transition conflict.
- 500: unexpected failure; response and logs omit database-error details.

## Verification

```powershell
pnpm exec vitest run tests/unit/consultation-open-route.test.ts tests/unit/consultation-open-service.test.ts --configLoader native --no-cache --no-fsModuleCache
pnpm exec tsc --noEmit --incremental false
```

`tests/integration/consultation.test.ts` covers actual nurse intake followed by
opening, ownership and account checks, concurrent opens, invalid workflow states,
and rollback on audit failure. It follows the existing explicit test-database
contract: set `FOUNDATION_TEST_DATABASE_URL` or `BOOKING_TEST_DATABASE_URL` to a
dedicated PostgreSQL test service with a role able to create databases. It creates
and drops only its uniquely named test database and migrates only that database.
It never falls back to the application's `DATABASE_URL`; without test credentials,
the suite is skipped.

```powershell
pnpm exec vitest run tests/integration/consultation.test.ts --configLoader native --no-cache --no-fsModuleCache
```

## Next task

Implement `POST /api/encounters/:id/complete`, requiring a clinical note before
atomically completing the encounter and queue. Doctor UI controls and the final
cross-track verification remain later tasks.
