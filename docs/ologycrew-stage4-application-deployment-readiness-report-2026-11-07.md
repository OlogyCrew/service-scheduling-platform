# OlogyCrew Stage 4 Pay-at-Location
## Application Deployment-Readiness Report

**Date:** November 7, 2026  
**Decision:** **NOT READY FOR APPLICATION DEPLOYMENT**  
**Database migration:** Accepted and complete  
**Pay-at-Location activation:** Disabled  
**Pilot providers:** None selected or activated

## Executive summary

The production database foundation is compatible with the current Stage 4 application code, and the additive migration is present and verified. TypeScript validation, the production build, 67 focused tests, and the complete regression suite passed. The production smoke test was read-only and loaded no Stripe or notification credentials.

The application should remain on hold for deployment, however. Two readiness conditions remain open:

1. Offline payment settlement updates the ledger and then writes the audit entry in a separate operation. A settlement could therefore succeed while its audit insert fails.
2. The current Stage 4 test coverage is primarily source-contract and mocked/integration coverage; it does not yet provide a dedicated database-backed end-to-end test that exercises an offline obligation through confirmation/waiver plus cancellation, rescheduling, recurring, and multi-day behavior.

No provider should be enabled and no application deployment or publication should be requested until these conditions are resolved and the report is re-run.

## Scope and restrictions observed

This review did not deploy or publish the application, enable any provider, change Stripe settings, change connected accounts or payout settings, rotate credentials, alter incident restrictions, or modify financial records. Chisolm Audio and Gary Studios were not changed. The three Stage 4 tables remain empty and all provider Pay-at-Location settings remain disabled.

## Evidence reviewed

- `drizzle/schema.ts`
- `drizzle/0071_late_jigsaw.sql`
- `server/db/offlinePayments.ts`
- `server/routers/offlinePaymentRouter.ts`
- `server/routers/bookingRouter.ts`
- `server/routers/providerRouter.ts`
- `server/stripeWebhook.ts`
- `server/pay-at-location-stage4-preview.contract.test.ts`
- `server/pay-at-location.contract.test.ts`
- `server/quote-booking-sessions.test.ts`
- `server/quotes.test.ts`
- `docs/ologycrew-stage4-restore-verification-and-migration-execution-plan-2026-11-07.md`

## Validation results

| Check | Result |
|---|---|
| TypeScript validation (`pnpm check`) | Passed |
| Production client/server build (`pnpm build`) | Passed; only existing chunk-size and toolchain warnings |
| Focused Stage 4/booking/payment tests | 7 files, 67 tests passed |
| Full regression suite | 229 files, 2,308 tests passed |
| Test cleanup | 26 synthetic test accounts and 8 test providers removed |
| Production read-only smoke test | Passed; no Stripe, notification, or write side effects |
| Production database state | Three Stage 4 tables present, all empty; provider settings disabled |

The test runner still reports the known non-failing Vite close-time warning after successful completion. It does not change the reported test totals or assertions.

## Six deployment-readiness requirements

### 1. Schema compatibility — **PASS**

The production TiDB environment was verified as `8.0.11-TiDB-v8.5.3-serverless` with MySQL 8.0 compatibility. The additive migration created:

- `offline_booking_payments`: primary key, unique `bookingId`, three foreign keys.
- `provider_pay_at_location_services`: primary key, unique provider/service pair, two foreign keys.
- `provider_pay_at_location_settings`: primary key, unique provider, one foreign key.

The application build and TypeScript checks pass against the checked-in schema. The production read-only smoke test successfully loaded booking, payment, provider, Pay-at-Location settings, and outstanding offline-payment helpers. Existing counts and Stripe-linked identifiers remain unchanged.

### 2. Stripe isolation — **PASS, with test-mode/runtime evidence boundary**

The direct, quote-conversion, recurring, and multi-day offline paths create an offline ledger obligation and do not call the Stripe Checkout path. The offline router imports no Stripe module. The webhook handler does not reference the offline tables. Focused contracts assert that these paths do not create Checkout Sessions, Payment Intents, charges, transfers, or payouts.

No production Stripe call was made during this review. That is intentional and correct while providers remain disabled. Before deployment, add one explicit test using a mocked Stripe client that fails the test if any Stripe creation method is invoked during each offline path; the existing source-contract evidence is strong but should not be the only guard for a financial boundary.

### 3. Authorization — **PASS**

`server/routers/offlinePaymentRouter.ts` uses `assertBookingAccess` for all offline mutations. Customers may read their booking status, but mutation access requires either the booking’s associated provider user or an administrator. Provider settings require provider ownership. Customers have no confirm or waive controls in the reviewed customer UI. Full payment/full waiver amount checks, required offline method, and mandatory waiver reason are enforced server-side.

Focused Stage 4 and payment-authorization tests passed, including unauthorized and customer read-only boundary assertions.

### 4. Auditability — **CONDITIONAL FAIL; must be corrected before deployment**

The ledger stores confirmation/waiver actor, timestamp, amount, method or waiver reason, and status. The router then calls `createAuditEntry` with the corresponding action. However, these are separate operations:

- `transitionOfflinePayment` updates the offline ledger first.
- `createAuditEntry` runs afterward in `offlinePaymentRouter.ts`.
- If the audit insert fails after the ledger update, the payment can be marked paid or waived without the required audit event.
- The waiver audit details currently include the amount but omit the waiver reason, even though the ledger stores it.

Required remediation before deployment:

1. Make settlement and its audit record atomic, using one transaction or a durable outbox/transactional event pattern.
2. Include the waiver reason, original amount due, resulting status, method where applicable, and actor in the durable audit evidence.
3. Add tests for audit-write failure and transaction rollback, plus confirmation/waiver audit completeness.

### 5. Integration testing — **CONDITIONAL FAIL; coverage expansion required**

The code and focused tests cover online-default selection, provider/service eligibility, direct booking, quote conversion, recurring bookings, multi-day bookings, one parent-level obligation, duplicate-safe creation, stale/duplicate settlement, customer read-only status, and Stripe-free source boundaries. The full suite passed.

The remaining gap is deployment-grade, database-backed end-to-end coverage for a real synthetic offline obligation across all required lifecycle paths:

- customer creates a direct offline booking;
- quote converts to one offline obligation;
- recurring and multi-day totals create one parent obligation each;
- provider confirms paid with each approved offline method;
- authorized administrator waives with a reason;
- customer cannot mutate either state;
- cancellation and rescheduling do not create duplicate obligations or silently lose the obligation;
- Stripe/webhook paths cannot change the offline status;
- disabled provider settings preserve already-created history.

The review did not enable providers or create production obligations, which is correct. These cases should be implemented against an isolated test database or controlled test fixtures before application deployment.

### 6. Separate pilot approval — **PASS / PROCESS GATE OPEN**

No providers are enabled, no eligible service rows exist, and no pilot providers have been selected. The migration and this readiness review do not authorize provider activation. Pilot selection must be a separate approval after all conditional-fail items are closed and the application is deployed and smoke-tested.

## Risks and operational notes

- The migration ran immediately after authorization on November 7 at approximately 12:57 PM Eastern rather than waiting for the proposed November 8 maintenance window. This variance is documented in the execution report and did not produce data or financial changes.
- Two historical `pi_test_*` payment rows lack matching booking rows. They were preserved and are outside this feature review; do not silently clean them as part of Stage 4.
- The application deployment must be treated as a separate change from the already-completed database migration. The database is additive and empty, so the current deployed application has no new Pay-at-Location behavior until the application is separately deployed.

## Required next checkpoint

Before requesting deployment authorization:

1. Implement atomic settlement-plus-audit behavior.
2. Add complete waiver audit details and failure/rollback tests.
3. Add isolated database-backed end-to-end Stage 4 lifecycle tests, including cancellation and rescheduling.
4. Add mocked-Stripe negative tests for all four offline booking paths.
5. Re-run `pnpm check`, `pnpm build`, focused tests, and the full suite.
6. Re-run a read-only production smoke test confirming tables are empty and settings remain disabled.

**Current conclusion: keep application deployment, publication, provider activation, and pilot selection on hold.**
