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

## Implemented: complete a consultation

`POST /api/encounters/:id/complete` accepts an empty body or `{}`. The encounter
ID must be a UUID. Body fields are rejected, including supplied note IDs, actors,
timestamps and status values. The endpoint requires a doctor session and rejects
cross-origin writes. All responses use `Cache-Control: no-store`.

The service calls `assertEncounterWritable` inside its transaction. That helper
rechecks the live account, assigned active doctor, today's booked appointment,
in-progress encounter and `with_doctor` queue state. It holds the appointment and
encounter locks through the rest of the transaction, matching the contract for
every clinical-note and prescription writer.

Completion requires at least one existing `clinical_note` for that same encounter.
The query reads only its ID; note content does not appear in the response, audit
metadata or error logs. Teammate 3 owns the note-creation service and API; the
completion service reads the shared clinical-note table.

In the same transaction, completion:

1. Changes the encounter from `in_progress` to `completed` and sets `ended_at`
   using server time, with a conditional update to reject a stale state.
2. Calls `transitionQueueEntry` with that transaction to move `with_doctor` to
   `completed` and record `queue.status_changed`.
3. Records `consultation.completed` against the encounter, with the session
   doctor as actor and only the old/new statuses in metadata.

The completion actor is stored in the audit record, as specified by the ERD.
No new schema columns are needed. Existing appointment status, appointment number,
encounter start time, check-in time and called-at time are preserved. A failure
in the queue transition or either audit write rolls the entire completion back.

Success returns 200:

```json
{
  "consultation": {
    "encounterId": "<encounter UUID>",
    "queueEntryId": "<queue UUID>",
    "status": "completed",
    "endedAt": "<ISO timestamp>"
  }
}
```

Errors follow the authentication, origin and validation conventions above. An
unrelated doctor, inactive profile, missing encounter or cancelled appointment
returns 404 through the shared policy. A missing clinical note returns 409 with
`CLINICAL_NOTE_REQUIRED`; completed encounters return 409 with
`ENCOUNTER_COMPLETED`. Wrong workflow phase, non-today/non-booked appointments,
or conditional update/transition conflicts also return 409. Repeated completion
requests cannot change the end time or insert additional audit events.

After commit, `assertEncounterWritable` rejects further intake, clinical-note
and prescription writes with 409. Teammate 3's writers must call that helper
inside their own transactions for this guarantee to hold.

## Connected doctor controls

The `/doctor` dashboard now renders the live consultation queue. It polls
`GET /api/doctor/queue`, which derives the active doctor profile from the session
and returns only that doctor's booked, checked-in visits dated today. Rows include
encounter and queue IDs, patient identification, queue status and a boolean for
whether a clinical note exists. Note text is not returned by this endpoint.

The dashboard offers opening only in `intake_done` and completion only in
`with_doctor`. Completion stays disabled until a clinical note exists. State
changes call the open/complete APIs above, disable controls while pending and
refresh the queue on success or failure. Polling errors disable actions until a
fresh read succeeds. Waiting and completed entries have no transition controls.

Doctor clinical-note creation and patient/history review remain owned by
Teammate 3. Their existing prototype screens have not been connected by this
change. The queue controls do not fabricate notes to bypass the completion rule.

## UI verification

```powershell
pnpm exec vitest run tests/unit/intake-form.test.ts tests/unit/workspace-read-services.test.ts tests/unit/doctor-queue-route.test.ts tests/unit/nurse-intake-page.test.ts tests/unit/clinical-workspace-render.test.ts --configLoader native --no-cache --no-fsModuleCache
```

The database suite also checks doctor-queue isolation and note-existence updates.
The following browser walkthrough remains for SCRUM-191 with a configured test
deployment and Teammate 3's clinical-record work:

- Check in today's appointment through reception.
- Select it from Nurse Intake; verify the selection survives a reload.
- Verify invalid measurements do not submit and changing patients warns about drafts.
- Save both intake sections; reload the server-verified confirmation.
- Open the visit from the assigned doctor's dashboard.
- Create a clinical note through Teammate 3's feature, refresh the queue, then complete.
- Verify duplicate actions, wrong roles, unrelated doctors and writes after completion fail.

## API and database verification

```powershell
pnpm exec vitest run tests/unit/consultation-open-route.test.ts tests/unit/consultation-open-service.test.ts --configLoader native --no-cache --no-fsModuleCache
pnpm exec vitest run tests/unit/consultation-complete-route.test.ts tests/unit/consultation-complete-service.test.ts --configLoader native --no-cache --no-fsModuleCache
pnpm exec tsc --noEmit --incremental false
```

`tests/integration/consultation.test.ts` covers actual nurse intake followed by
opening, ownership and account checks, concurrent opens/completions, the same-visit
note requirement, invalid workflow states, rollback on audit failure, and clinical
write locking through completion. Note and prescription write checks simulate
Teammate 3's shared-lock contract rather than calling unmerged feature APIs.
It follows the existing explicit test-database
contract: set `FOUNDATION_TEST_DATABASE_URL` or `BOOKING_TEST_DATABASE_URL` to a
dedicated PostgreSQL test service with a role able to create databases. It creates
and drops only its uniquely named test database and migrates only that database.
It never falls back to the application's `DATABASE_URL`; without test credentials,
the suite is skipped.

```powershell
pnpm exec vitest run tests/integration/consultation.test.ts --configLoader native --no-cache --no-fsModuleCache
```

## Next task

Perform the final cross-track workflow verification (SCRUM-191) after the required
branches merge and a dedicated PostgreSQL test database is configured.
The [SCRUM-191 verification report](verification/scrum-191.md) records the completed
519-test run with PostgreSQL and the remaining cross-track/browser checks.
