# P4 outside-catalogue prescription verification

Tested on 19 November 2026 (Asia/Colombo) on `feat/pharmacy` at base
`ba58057` with the outside-catalogue changes. The sorted manifest of
implementation paths and their SHA-256 hashes had digest
`1f03928292e724e5b92549afc8d45d0d3d86ece92390b60d425143ff5926bd10`.

`pnpm test` passed all **23 tests** with no skips, including seven temporary
checks against a disposable PostgreSQL instance with the existing migrations
and synthetic records. The API checks stubbed the session guard and exercised
real access policy, workflow checks, and database writes.

1. The doctor catalogue returns active medicines and omits inventory data.
2. Issuing requires one medicine source per line and rejects blank or overlong
   typed names, extra fields, and duplicate catalogue selections.
3. Inactive or unknown catalogue selections fail even when a prescription also
   includes typed medicines.
4. Wrong roles, unassigned doctors, completed encounters and cross-origin
   writes are denied.
5. Both item types persist and appear in the patient and pharmacist responses.
   Dispensing deducts only linked catalogue stock, even if a typed name matches
   a catalogue medicine. Issuing and dispensing record audit entries.
6. Typed-only prescriptions show nothing to dispense, and the dispense API
   returns 409 without changing the prescription or stock.
7. A mixed prescription with insufficient stock reports only the affected
   catalogue medicine.

The headless Edge walkthrough used real doctor, patient, and pharmacist
sign-ins. The doctor used the active consultation to issue a mixed and a
typed-only prescription. Both read views displayed the typed items and
their outside-catalogue labels. The pharmacy view showed **Ready to dispense**
for the mixed prescription and **Nothing to dispense** for the typed-only one.
Next.js continued on retry after displaying the existing 16.4.0 advisory.

TypeScript and lint for the changed code passed. After the temporary checks
were removed, `pnpm test` passed all 16 core tests.
