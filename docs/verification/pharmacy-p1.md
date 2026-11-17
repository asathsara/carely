# Teammate 1: P1 catalogue and stock verification

Date: 17 November 2026 (Asia/Colombo). Branch: `feat/pharmacy`.
Tested revision: base `3677296` plus the uncommitted P1 implementation.

The 17 changed/new implementation files have source-manifest SHA256
`69072b41850bf9561b4221848b989f4c8e1df71dd3bfcc36790933e9f87a1751`.
The manifest is the sorted list of `path:lowercase-file-SHA256`, joined with LF,
from `git ls-files --modified --others --exclude-standard`, excluding this note
and `tests/temporary/**`. Temporary test source SHA256:
`f6608cdfd22e1de531253aadbf8097838ab18ba979869855a425cd77c8fa6202`.

## Implemented

- Pharmacist-only GET/POST `/api/pharmacy/medicines` and PATCH
  `/api/pharmacy/medicines/:id`.
- Pharmacist-only GET/POST `/api/pharmacy/medicines/:id/batches`.
- Strict request validation, active-account checks, missing-record handling,
  same-origin write checks and uncached responses.
- Catalogue totals sum batches with expiry on or after the current Colombo
  date; zero-stock medicines remain visible. Batch reads include expired rows.
- Batch receiving accepts whole quantities from 0 to 2147483647, rejects expired
  batches and inactive medicines, and preserves each receipt as a separate row.
- Medicine creation/editing and batch receipts record `medicine.created`,
  `medicine.updated` and `stock.received` inside the mutation transaction.
- Inventory and stock pages use real API data, with catalogue create/edit,
  batch receiving/history, refresh/error/empty states and URL medicine selection.
  Demo thresholds were removed because the existing schema has no threshold.

## Passing verification before temporary-test cleanup

Command:

```powershell
node --env-file=.env.local node_modules/vitest/vitest.mjs run --configLoader native --testTimeout 20000 --hookTimeout 20000
```

Result: **24 passed, 0 failed, 0 skipped** in 8 files: 16 retained core tests plus
8 temporary P1 checks. The temporary checks used real PostgreSQL and synthetic
actors/medicines/batches. Every fixture transaction was rolled back, including
its audit rows; no permanent sample records were added. No migration was run.
An initial sandboxed attempt could not connect; the successful run used the
approved network access.

The eight checks covered:

1. Medicine create/edit audit writes; partial edits preserve inactive status.
2. Multiple-batch totals, expiry today, expired exclusion, zero-quantity receipts
   and medicines without batches.
3. Wrong roles, forged/stale roles and banned pharmacists.
4. Unknown fields, empty updates, invalid calendar dates and invalid quantities.
5. Expired batches, inactive medicines and missing-record failures without writes.
6. Real savepoint rollback of medicine create/edit and batch receipts when the
   audit call fails, including removal of the rolled-back audit inserts.
7. Persisted batch reads, timestamp serialization and invalid/missing identifiers.
8. HTTP create/read/edit/receive wiring, no-store headers, malformed JSON,
   strict bodies, cross-origin rejection and wrong-role denial on each route.

The service and SQL checks used real permissions stored in PostgreSQL. The HTTP
test stubbed the session guard; it is not evidence of a browser login journey.
Colombo date was fixed to 2026-11-17 for deterministic expiry boundary checks.

TypeScript: `pnpm exec tsc --noEmit --incremental false` passed.
Lint: `pnpm lint` passed with the two pre-existing staff-directory warnings.
After recording the above evidence, the temporary test file was removed per
`docs/testing.md`. Final `pnpm test`: **16 passed, 0 failed, 0 skipped** in 7 files.
Formatting checks and `git diff --check` passed.

`pnpm build` compiled the application, passed TypeScript and generated all 57
pages, including the pharmacy routes. It then stopped at the existing Next.js
16.4.0 security-advisory gate. Repeating `pnpm build` as directed by the build
message completed successfully (exit 0), with the advisory warning still present.
The build also logs the existing admin-specialties prerender bailout diagnostic;
the pharmacy routes compile successfully. Upgrade Next.js before deployment;
this pharmacy change does not update the dependency.

## Remaining work

Browser walkthrough: sign in as a pharmacist, create/edit a medicine, receive a
batch, then reload inventory and stock pages to confirm persistence and feedback.
No interactive browser tool was available for this run.

P2 dispensing and P3/P4 prescription improvements are separate next steps. The
unused demo prescription workbench/provider files are retained for that follow-up;
the active pharmacy layout no longer mounts the demo provider.
