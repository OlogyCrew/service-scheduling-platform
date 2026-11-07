# OlogyCrew Stage 4 Pay-at-Location
## Final preview review and migration plan

**Date:** 2026-11-07  
**Status:** Preview reviewed; migration not applied; no deployment or publication performed.

## 1. Review conclusion

The implementation supports four customer booking paths with `online` as the default and `pay_at_location` as an explicit customer choice:

- Direct booking
- Quote conversion
- Multi-day booking
- Recurring booking

For each offline path, the server validates provider enablement and service-specific eligibility before creating the booking. The offline ledger is created only after the booking exists and uses the server-calculated aggregate `totalAmount`.

Multi-day and recurring bookings create one parent booking with child sessions and exactly one offline obligation linked to the parent booking. Session creation, session cancellation, session completion, and session rescheduling do not call the offline-ledger creation helper and cannot create a second obligation. Quote conversion creates one booking and, when the customer selected Pay-at-Location, one obligation for that booking.

The `offline_booking_payments.bookingId` unique constraint is the database-level one-parent-ledger invariant. The helper also checks for an existing row and handles a concurrent unique-key race without inserting a duplicate.

## 2. Financial-integrity review

### Server-calculated totals

The four paths preserve the existing pricing model:

- Direct booking: subtotal plus the server-calculated platform fee, then deposit and remaining amount are derived from that total.
- Multi-day booking: per-day service price multiplied by the validated number of days, plus the platform fee.
- Recurring booking: per-session price multiplied by the generated unique session dates, plus the platform fee.
- Quote conversion: the accepted quoted amount is used server-side to calculate subtotal, platform fee, and total; the customer-supplied payment method does not supply an amount.

`originalAmountDue` stores the immutable historical amount due at obligation creation. Paid and waived transitions require the full amount; partial offline payments are not supported in this release.

### Cancellation

Cancellation uses the existing online-payment refund path only when a captured online payment exists. Pay-at-Location does not create a Stripe payment or online payment row, so cancellation cannot trigger a Stripe refund, fee, transfer, or payout. The offline obligation is not silently rewritten or auto-waived by cancellation. Any outstanding offline obligation remains historical evidence and requires an authorized provider/admin waiver with a reason if it should be closed without payment. This preserves the original amount and prevents an automatic financial decision without an actor and reason.

Operational rule for rollout: cancelled bookings must be reviewed before settlement; a cancelled booking should be closed through the authorized waiver workflow rather than marked paid unless there is documented authorization for the offline collection.

### Rescheduling and occurrences

Rescheduling changes the affected session's schedule and creates the linked replacement session under the same parent booking. It does not change the parent total, recreate the offline obligation, or create an additional payment obligation. Updating an individual session's status also remains separate from parent-level settlement.

### Waivers and duplicates

Waivers are full-only, require a non-empty reason, require provider/admin authorization, write the waiver amount/reason/actor/timestamp, and create the dedicated waiver audit action. Conditional `due` updates prevent a second confirmation or waiver from overwriting a settled obligation. A unique booking relationship prevents duplicate obligations from retries or concurrent requests.

## 3. Validation results

- Focused Stage 4/quote suite: **49 tests passed across 4 files**.
- Full regression suite: **229 test files / 2,308 tests passed**.
- TypeScript check: passed.
- Production build: passed; only existing non-blocking bundle/dependency warnings.
- Migration review: additive `CREATE TABLE` statements only; no changes to `bookings`, `payments`, Stripe records, payout settings, or credentials.
- Migration identifiers, foreign keys, unique constraints, and indexes reviewed; identifiers are MySQL-safe and no longer than 64 characters.
- Read-only live database check: **426 bookings, 411 payments, 42 users, and 0 Stage 4 tables**.
- No historical booking was converted and no financial/test rows were created by the preview review.

## 4. Production backup verification

A complete logical production backup was created outside the repository at:

`/home/ubuntu/backups/ologycrew/ologycrew-production-2026-11-07.sql.gz`

Verification completed:

- SHA-256: `26c87eb2105ccfb47e0a2d319177c664bb3dfb61a2ff48ff6776092f793f3bfa`
- Compressed size: 213,960 bytes.
- `gzip -t`: passed.
- Dump header and completion footer: present.
- Dump contains 65 `CREATE TABLE` statements and 46 `INSERT INTO` statements.
- Dump completed without client errors using the server-compatible logical-dump mode.
- Credentials were supplied through a temporary mode-600 client configuration and were not written to the repository or report.

### Restore-verification limitation

An actual restore was **not** performed because this sandbox has no isolated MySQL/MariaDB server and restoring into the production database would violate the no-modification restriction. The archive is internally readable and checksum-verified, but restore capability is not fully proven until the backup is restored into an isolated disposable TiDB/MySQL-compatible database. Do not treat the backup as a completed disaster-recovery test until that isolated restore succeeds.

Recommended restore test:

1. Provision an isolated disposable database with the same MySQL/TiDB compatibility level.
2. Verify the SHA-256 checksum before use.
3. Import the gzip stream with `mysql` and capture errors.
4. Compare table count, row counts for bookings/payments/users, foreign-key/index metadata, and representative Stripe/payment identifiers with the source snapshot.
5. Run read-only application health checks against the disposable database.
6. Destroy the disposable database after the evidence is recorded.

## 5. Migration plan

The migration is `drizzle/0071_late_jigsaw.sql` and remains unapplied. It creates only:

- `offline_booking_payments`
- `provider_pay_at_location_settings`
- `provider_pay_at_location_services`

Before application, retain the verified backup, a schema dump, the exact migration SQL, and Drizzle metadata. Apply during a controlled maintenance window using the approved WebDev migration path, not an ad-hoc client command.

Immediately after application, verify:

- All three tables exist.
- Foreign keys and unique constraints exist.
- `offline_booking_payments` is empty.
- Existing booking/payment/user counts are unchanged: expected baseline 426 / 411 / 42 unless legitimate activity occurred between checks.
- No Stripe tables, payment rows, transfers, payouts, or audit evidence changed.
- Provider settings default to disabled and no service eligibility rows exist.
- Chisolm Audio and Gary Studios are unchanged.

Rollback is code-first: disable the feature and remove provider eligibility rows/settings without deleting offline history. A physical table rollback requires a separately reviewed migration after exporting the three Stage 4 tables and related audit entries. It must never alter existing booking, payment, Stripe, payout, or incident records.

## 6. Controlled pilot procedure

Pay-at-Location remains disabled for all providers by default. No pilot provider has been enabled in this checkpoint.

After separate migration and pilot approval:

1. Select two or three trusted, non-suspicious providers with confirmed business identities; do not select any incident-restricted account. Keep Chisolm Audio and Gary Studios unchanged unless the owner explicitly chooses them.
2. Verify each provider owns the selected service IDs and has clear payment instructions.
3. Enable the provider setting and only the explicitly selected service IDs.
4. Run one test booking per selected provider in a controlled test account, confirming the customer sees the offline instructions, no Stripe Checkout/Payment Intent is created, and exactly one parent ledger row exists.
5. Have the provider review the outstanding obligation and test the authorized paid/waived workflow in an approved test record only.
6. Monitor cancellations, rescheduling, session updates, duplicate requests, and audit entries for at least one review cycle.
7. Expand eligibility only after the pilot evidence is reviewed and separately approved.

No provider activation, migration application, deployment, publication, Stripe setting change, payout change, connected-account change, credential rotation, refund, or financial-record modification was performed for this review.
