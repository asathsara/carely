# SCRUM-151/152 prescription view verification

Tested on 19 November 2026 (Asia/Colombo) on `feat/pharmacy` at base
`e87bce8` with the prescription view changes. The sorted manifest of
implementation paths and their SHA-256 hashes had digest
`24ad681f956faa89c4181ddb536053ff0031e2c3610ed511fb2690f0005f5ffe`.

`pnpm test` passed all **21 tests** with no skips, including five temporary
checks against a disposable PostgreSQL instance with the existing migrations
and synthetic records. The route checks used a stubbed session guard and
exercised the real service and database access policy.

1. Each of two patients received only their own prescriptions. The patient
   response keeps inventory eligibility private.
2. Anonymous and wrong-role lookup attempts were denied, as was a pharmacist
   request for patient history.
3. Lookup by UUID returned the ready prescription. Invalid and missing IDs
   returned 400 and 404 respectively.
4. Eligibility summed usable batches, included stock expiring on the clinic
   date, excluded expired stock, and combined repeated medicine lines. It
   named every medicine that was short.
5. Already dispensed prescriptions and those with no items to dispense had
   distinct statuses.

The headless Edge check used real sign-ins. The pharmacist looked up all four
eligibility states by ID and saw both shortages with the dispense button
disabled. Each of two patient accounts saw its own prescription IDs and none
from the other account. A patient attempting the pharmacist lookup received 403. Next.js continued on retry after showing the existing 16.4.0 advisory.

TypeScript and lint for the changed code passed. After the temporary checks were
removed, `pnpm test` passed all 16 core tests.
