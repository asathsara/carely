# SCRUM-157 dispensing verification

Tested on 19 November 2026 (Asia/Colombo) on `feat/pharmacy`, base
`ef2139d` with the dispensing implementation. The sorted manifest of
implementation paths and their SHA-256 hashes had digest
`ae242a1861c9dc16b896fd83f37267dca48f151dcfbc0e3e06f57abbf04fb170`.

`pnpm test` with the disposable local PostgreSQL database and synthetic records
passed **24 tests, 0 skipped**. The temporary suite applied the existing
migrations and covered these eight cases:

1. Consume the earliest unexpired stock first, including batches expiring today.
2. On shortage, name the affected medicines and roll back stock, prescription
   status, dispense records and audit entries.
3. Allow exactly one of two simultaneous requests for the same prescription.
4. Prevent two different prescriptions from exceeding a shared batch's stock.
5. Deny wrong roles and banned users and handle invalid or missing IDs.
6. Dispense catalogue items from a mixed prescription and reject a prescription
   containing only items outside the catalogue.
7. Roll back a dispense when the audit call fails.
8. Check the POST role guard, body validation and response codes. Accept the
   browser's same origin when Next.js normalizes the hostname internally and
   reject a cross-origin request.

The temporary tests used real PostgreSQL transactions. The route test stubbed
the session guard. The date was fixed to 19 November for expiry checks.

The headless Edge test used a real pharmacist session and the production build.
The pharmacist found the prescription by ID, cancelled once with no stock
change, then confirmed. Available stock fell from 10 to 5, and the prescription
still showed **Dispensed** after reload and lookup.

The production build and lint for the changed code passed. The build reported
the existing Next.js 16.4.0 security advisory and succeeded on retry.
After removing the temporary Vitest file, `pnpm test` passed all 16 core tests.
