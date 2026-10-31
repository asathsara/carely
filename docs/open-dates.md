# Open appointment dates

Task 8.3 responsibility 4 is implemented by `getOpenDatesForDoctor(doctorId)` in
`lib/services/booking.ts` and `GET /api/appointments/open-dates?doctorId=...`.

## API contract

The endpoint requires an authenticated patient, receptionist, or admin. Banned
accounts and other roles receive `403`; signed-out requests receive `401`.
Supply exactly one `doctorId` query parameter containing a valid UUID. Missing,
empty, malformed, or repeated IDs receive `400` with `code: "INVALID_INPUT"`.

Successful responses use the existing `OpenDatesResponse` contract:

```json
{
  "doctorId": "11111111-1111-4111-8111-111111111111",
  "doctorName": "Test Doctor",
  "specialtyName": "General Medicine",
  "dates": [
    {
      "date": "2026-10-31",
      "dayOfWeek": 6,
      "startTime": "09:00:00",
      "endTime": "12:00:00",
      "maxPatients": 10,
      "bookedCount": 3,
      "availableCount": 7
    }
  ]
}
```

`specialtyName` is omitted when the doctor has no specialty. An active doctor with
no open sessions returns `200` and `dates: []`. A nonexistent doctor returns `404`
with `DOCTOR_NOT_FOUND`. An inactive doctor, banned doctor account, or account no
longer assigned the doctor role returns `400` with `DOCTOR_INACTIVE`.
Unexpected database failures return a generic `500` response without internal details.
All responses send `Cache-Control: no-store`.

## Date and capacity rules

- The discovery window contains 14 calendar dates: today through today + 13 in
  `Asia/Colombo`. Results are ordered by date and contain at most one session per date.
- An active recurring weekday rule must exist. Disabled and missing weekdays are omitted.
- Today is included only before the session end time. The exact end is closed;
  booking before the session starts is allowed. Future dates are unaffected by
  the current time of day.
- `bookedCount` includes every appointment except those with `status = 'cancelled'`,
  scoped to the requested doctor and individual date. Completed visits use capacity.
- `availableCount` is `maxPatients - bookedCount`. Full or over-capacity dates are omitted.
  A cancellation can reopen a date without reusing its appointment number.

Discovery is read-only and uses three queries: doctor metadata, active weekly
rules, and grouped appointment counts across the date window. It does not reserve
capacity or take booking locks. Counts are a snapshot; the transactional booking
service remains responsible for checking capacity when an appointment is created.
No schema changes or migrations are needed.

## Verification

Route unit tests cover authentication, permitted and rejected roles, banned
accounts, query validation, response shape, empty results, cache headers, and error
handling. PostgreSQL tests in `tests/integration/booking.test.ts` cover recurring
dates, window boundaries across a month change, Colombo midnight, session end,
full and over-capacity dates, cancellations, completed appointments, isolation
between doctors/dates, metadata, and inactive or missing doctors.

Run `pnpm test` for unit tests. The database suite uses the opt-in isolated database
setup documented in [Transactional appointment booking](booking-service.md#verification).

[Patient UI integration, appointment listing, and cancellation](patient-ui.md) are
implemented as responsibility 5.
