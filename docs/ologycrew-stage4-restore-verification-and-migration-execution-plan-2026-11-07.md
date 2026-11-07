# OlogyCrew Stage 4 Pay-at-Location
## Isolated restore verification and migration execution plan

**Date:** 2026-11-07  
**Status:** Restore verification and authorized Stage 4 production migration complete; application publication/deployment **not performed**; pilot **not enabled**.

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

The Stage 4 tables were absent in the pre-migration restore and production baseline. They were created only during the separately authorized migration and remain empty with Pay-at-Location disabled.

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

## 7. Maintenance-window record

**Proposed window:** Sunday, November 8, 2026, 02:00–02:45 Eastern Time.

The migration did not wait for that future window. It was executed immediately after the owner’s migration authorization on **November 7, 2026 at approximately 12:57 PM Eastern (17:57 UTC)**. This timing variance is recorded explicitly. The migration remained within the authorized migration-only scope, and the fresh backup and all preconditions were completed immediately beforehand. If a strict scheduled-window policy is required, the owner should treat that as a separate operational-policy review; no automatic rollback was performed because the migration was additive, empty, and fully verified.

## 8. Production migration execution and verification

1. Owner authorization was received for the migration-only scope, with the proposed November 8 maintenance window noted above. Actual execution began at approximately 12:57 PM Eastern on November 7, before that future window.
2. A fresh complete production logical backup was created immediately before migration:
   - Archive: `/home/ubuntu/backups/ologycrew/ologycrew-production-pre-stage4-20261107T175643Z.sql.gz`
   - SHA-256: `311135eccde860dc5fe844d9c4181a4ac8e26bd9f0a7f50f73060a68fde70af9`
   - Size: 214,164 bytes; permissions: owner-only (`600`)
   - `sha256sum -c`: passed; `gzip -t`: passed
   - Dump completed: `2026-11-07 17:56:49` UTC
3. The reviewed migration was checked and contained exactly three additive `CREATE TABLE` statements, six foreign keys, four explicitly declared secondary indexes, and no destructive statements. Valid `ON UPDATE CURRENT_TIMESTAMP` clauses were not treated as destructive updates.
4. Live compatibility was verified as `8.0.11-TiDB-v8.5.3-serverless` with MySQL 8.0 compatibility. Before migration, all three Stage 4 tables were absent.
5. The reviewed SQL was applied through the approved WebDev SQL path. Execution completed successfully in 6.094 seconds.
6. Post-migration metadata verified three new tables with the expected primary and unique constraints:
   - `offline_booking_payments`: 1 primary key, 1 unique booking constraint, 3 foreign keys.
   - `provider_pay_at_location_services`: 1 primary key, 1 unique provider/service constraint, 2 foreign keys.
   - `provider_pay_at_location_settings`: 1 primary key, 1 unique provider constraint, 1 foreign key.
7. The new tables are empty: 0 offline payment obligations, 0 provider settings rows, and 0 provider/service eligibility rows. Enabled provider settings: 0.
8. Before-and-after counts are unchanged: 42 users, 426 bookings, 411 payments, 30 service providers, 128 services, 325 audit rows, and 411 Stripe-linked payment intents. Existing aggregate metadata moved only by the expected additive schema objects: foreign keys 104→110, unique constraints 30→33, and information-schema index entries 359→373.
9. The application smoke test passed against production using read-only helpers for booking, payment, provider, provider Pay-at-Location settings, and outstanding offline obligations. It returned no offline obligations, no enabled settings, no external calls, no notifications, and no Stripe secrets loaded.
10. One attempted TiDB post-check used unsupported `CHECK TABLE ... FOR UPGRADE` syntax and was discarded; it did not modify data. All final verification used TiDB-compatible metadata, counts, constraints, and indexes.
11. Application publication/deployment and pilot activation remain separate approvals. No provider was enabled.

## 9. Rollback and pilot boundary

If a future application rollout or pilot verification fails, stop before enabling the feature. Preserve the backup and migration output, disable any partially exposed code path, and use a separately reviewed rollback procedure. Do not delete or alter existing bookings, payments, Stripe records, payouts, connected accounts, credentials, audit evidence, or incident records.

After a successful migration and separate pilot authorization, activate only two or three individually selected, trusted providers and explicitly selected service IDs. Keep all other providers disabled. Do not select incident-restricted accounts. Chisolm Audio and Gary Studios remain unchanged unless separately selected by the owner.

**The approved database migration was performed. No application deployment, publication, provider activation, Stripe change, financial-record change, payout change, credential change, or restriction change was performed.**
