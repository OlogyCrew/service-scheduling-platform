# OlogyCrew Stage 4 Pay-at-Location
## Isolated restore verification and migration execution plan

**Date:** 2026-11-07  
**Status:** Restore verification complete; Stage 4 migration **not applied**; publication/deployment **not performed**; pilot **not enabled**.

## 1. Backup under test

- Archive: `/home/ubuntu/backups/ologycrew/ologycrew-production-2026-11-07.sql.gz`
- SHA-256: `26c87eb2105ccfb47e0a2d319177c664bb3dfb61a2ff48ff6776092f793f3bfa`
- Archive size: 213,960 bytes
- Backup header: MySQL dump 10.13, source database `QD7eHrqop9F5cN2Q4sYGpD`
- Source database version recorded in dump: `8.0.11-TiDB-v8.5.3-serverless`
- Dump completion timestamp: `2026-11-07 16:53:28` UTC
- `sha256sum -c`: passed
- `gzip -t`: passed

The backup was created with credentials supplied through a temporary mode-600 client configuration. No credentials were placed in the repository or report.

## 2. Isolated restore environment

The archive was restored into a disposable local MariaDB 10.11.14 instance, database `ologycrew_restore`, bound only to `127.0.0.1:3307`. The instance was not connected to the production database, Stripe, production webhooks, SendGrid, or customer notification services.

The application read smoke test used a local-only `DATABASE_URL` and explicitly loaded empty Stripe, webhook, and SendGrid credentials. It invoked existing read helpers only; it did not start the application server, send mail, call Stripe, process webhooks, or mutate data.

The disposable database and listener were stopped and removed after verification. Port 3307 is closed.

## 3. Restore result

- Restore exit code: `0`
- Import errors: none
- Restored table count: 65
- Restored database size: 7,471,104 bytes
- MariaDB version: `10.11.14-MariaDB-0ubuntu0.24.04.1`
- `FOREIGN_KEY_CHECKS`: enabled (`1`)
- Event scheduler: disabled (`OFF`)
- `CHECK TABLE` on users, bookings, payments, service_providers, services, and booking_sessions: all `OK`
- Foreign-key constraints: 104
- Index entries: 359
- Unique constraints: 30
- Primary keys verified on bookings and payments

## 4. Record-count verification

| Table | Restored count | Expected baseline | Result |
|---|---:|---:|---|
| users | 42 | 42 | Pass |
| bookings | 426 | 426 | Pass |
| payments | 411 | 411 | Pass |
| service_providers | 30 | 30 | Pass |
| services | 128 | 128 | Pass |
| audit_log | 325 | 325 | Pass |
| Stage 4 tables | 0 | 0 before migration | Pass |

The Stage 4 tables were absent as expected: `offline_booking_payments`, `provider_pay_at_location_settings`, and `provider_pay_at_location_services` were not created by the restore and remain unapplied in production.

## 5. Relationship verification

The restored database has valid booking-to-customer, booking-to-provider, booking-to-service, booking-session-to-booking, and payment-to-booking foreign-key definitions in its metadata. Booking customer/provider/service orphan checks and booking-session orphan checks returned zero.

Two existing payment rows did not match a booking:

- Payment 1, booking ID 60001, full, captured, $109.25, `pi_test_completed_001`
- Payment 2, booking ID 60002, deposit, captured, $100.00, `pi_test_confirmed_001`

These are legacy test-fixture-style rows (`pi_test_*`) present in the backup itself. They are not restore-created rows and were not modified. Because the source schema declares `payments.bookingId` as non-null with a foreign key while these historical rows have no matching booking, the backup contains this pre-existing referential anomaly. It should be preserved as incident evidence and handled separately; it must not block the additive Stage 4 migration unless the production owner wants a separate data-integrity remediation. No cleanup was performed.

## 6. Application read-query verification

Existing application database helpers successfully read from the isolated restore:

- `getBookingById`
- `getPaymentByBookingId`
- `getUserById`
- `getProviderById`
- `getServiceById`

The smoke test returned a real restored booking (`1680001`, status `cancelled`) and successfully resolved its customer, provider, and service. No external calls or side effects occurred.

## 7. Proposed maintenance window

**Proposed window:** Sunday, November 8, 2026, 02:00–02:45 Eastern Time.

This is a proposal only and is not authorization to migrate. Before the window begins, obtain a fresh production backup and verify its checksum. If legitimate production activity changes the baseline, record the new counts rather than treating those changes as migration effects.

## 8. Migration execution plan after separate authorization

1. Confirm the owner-approved maintenance window.
2. Create a fresh complete production logical backup immediately before migration; verify checksum and gzip integrity.
3. Confirm `drizzle/0071_late_jigsaw.sql` still contains only the three additive Stage 4 table definitions, foreign keys, unique constraints, and indexes.
4. Reconfirm the current production counts and that all three Stage 4 tables are absent.
5. Apply the reviewed migration through the approved WebDev SQL path. Do not use an ad-hoc production client command.
6. Verify the three new tables, six foreign keys, unique booking/provider/provider-service constraints, and the Stage 4 indexes.
7. Verify `offline_booking_payments` and both provider configuration tables are empty after migration; no historical bookings are converted.
8. Recheck existing users, bookings, payments, providers, services, audit rows, Stripe identifiers, and incident evidence against the pre-migration baseline.
9. Run application smoke tests for ordinary booking reads, provider settings reads, customer payment-status reads, and admin/provider offline-payment reads.
10. Confirm provider settings are disabled globally and no service eligibility rows exist.
11. Keep publication/deployment and pilot activation as separate approvals. Do not enable any provider during migration.

## 9. Rollback and pilot boundary

If migration verification fails, stop before enabling the feature. Preserve the backup and migration output, disable any partially exposed code path, and use a separately reviewed rollback procedure. Do not delete or alter existing bookings, payments, Stripe records, payouts, connected accounts, credentials, audit evidence, or incident records.

After a successful migration and separate pilot authorization, activate only two or three individually selected, trusted providers and explicitly selected service IDs. Keep all other providers disabled. Do not select incident-restricted accounts. Chisolm Audio and Gary Studios remain unchanged unless separately selected by the owner.

**No migration, deployment, publication, provider activation, Stripe change, financial-record change, payout change, credential change, or restriction change was performed during restore verification.**
