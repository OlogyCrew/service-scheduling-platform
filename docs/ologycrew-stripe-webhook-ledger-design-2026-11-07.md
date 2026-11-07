# OlogyCrew Stage 2 — Stripe Webhook Ledger Design

**Date:** November 7, 2026  
**Status:** Design and migration plan; unpublished  
**Scope:** Design only. No production schema, Stripe configuration, financial records, or webhook behavior changed.

## Objective

Create a durable Stripe event ledger so OlogyCrew can safely process duplicate, retried, and out-of-order webhook deliveries without duplicating payment, fulfillment, referral-credit, notification, refund, or transfer side effects.

Signature verification remains required, but it is not a deduplication mechanism. The ledger will preserve the event history and processing outcome independently of business tables.

## Proposed table: `stripe_webhook_events`

The migration will add a new table with these fields:

- `id`: internal auto-increment primary key.
- `stripeEventId`: Stripe event ID, required and unique.
- `eventType`: Stripe event type, required and indexed.
- `accountId`: connected-account context when present, nullable and indexed.
- `livemode`: boolean, required.
- `apiVersion`: Stripe event API version, nullable.
- `paymentIntentId`: related Payment Intent ID when available, nullable and indexed.
- `checkoutSessionId`: related Checkout Session ID when available, nullable and indexed.
- `chargeId`: related Charge ID when available, nullable and indexed.
- `invoiceId`: related Invoice ID when available, nullable and indexed.
- `subscriptionId`: related Subscription ID when available, nullable and indexed.
- `bookingId`: parsed internal booking ID when present, nullable and indexed.
- `status`: `received`, `processing`, `processed`, or `failed`.
- `attemptCount`: integer, default 0.
- `firstReceivedAt`: timestamp, required.
- `lastAttemptAt`: timestamp, nullable.
- `processedAt`: timestamp, nullable.
- `nextRetryAt`: timestamp, nullable.
- `lastError`: text, nullable; must not contain secrets or raw payment data.
- `metadata`: JSON/text summary of safe event identifiers and routing information only.
- `createdAt` and `updatedAt`: timestamps.

The unique constraint on `stripeEventId` is the core duplicate-delivery protection. Indexes support reconciliation by event type, Stripe identifier, connected account, and internal booking.

## Processing contract

1. Verify the Stripe signature against the raw request body before reading or writing the event ledger.
2. Extract only safe routing identifiers from the verified event.
3. Insert the event using the unique Stripe event ID.
4. If the insert conflicts with an existing event:
   - Return success immediately when the existing state is `processed`.
   - Permit a controlled retry when the state is `failed` and the retry policy allows it.
   - Return success without a second side effect when another worker owns `processing` and the lease is still valid.
5. Mark the event `processing` with an attempt count and processing timestamp.
6. Execute the existing event-specific handler through an idempotent business-operation boundary.
7. Mark the event `processed` only after all required side effects complete.
8. On failure, mark it `failed`, record a sanitized error, and set a retry timestamp. Return a retryable HTTP response so Stripe can retry.
9. A stale `processing` lease can be reclaimed after a defined timeout. Reclaimed processing must still rely on idempotent business writes.

## Out-of-order handling

The ledger alone does not make event order safe. Each business handler must validate the current local state before applying a transition.

Examples:

- A later captured/refunded state cannot be overwritten by an older failed state.
- A canceled subscription event cannot be undone by an older update event.
- A duplicate Checkout completion cannot create a second payment row, referral reward, notification, or partner transfer.
- A refund or dispute event must be represented even when the original payment row is temporarily unavailable; reconciliation can resolve the relationship later.

Event timestamps are useful evidence but must not be treated as a substitute for current Stripe object retrieval or valid local state-transition rules.

## Required side-effect protections

The implementation must protect each of these independently:

- Booking payment upsert by Payment Intent and payment type.
- Booking confirmation and deposit/final-payment timestamps.
- Referral fulfillment and credit creation.
- Customer and provider notifications.
- Invoice payment state.
- Promotion activation.
- Subscription status and entitlement transitions.
- Partner revenue split transfers.
- Refund and dispute ledger updates.

A webhook event must never be marked `processed` if a required financial side effect failed.

## Migration plan

1. Add the Drizzle `stripeWebhookEvents` table and generated migration.
2. Review the generated SQL for a single additive `CREATE TABLE`, unique event ID, safe indexes, and no destructive statements.
3. Apply the migration only to the project database after explicit review; do not alter existing financial rows.
4. Add database helpers for insert-or-read, lease acquisition, processed, and failed transitions.
5. Add a small event-routing extractor that reads verified Stripe objects and stores only safe IDs.
6. Refactor `handleStripeWebhook` to use the ledger wrapper around existing handlers.
7. Add tests for duplicate, failed/retryable, stale-processing, and out-of-order events.
8. Run focused tests, TypeScript validation, production build, and the full regression suite.
9. Save an unpublished checkpoint. Do not deploy or publish without explicit approval.

## Acceptance tests

- The same Stripe event ID delivered twice produces one business side effect.
- Two concurrent deliveries of the same event ID produce one successful processor and one safe duplicate response.
- A failed event remains retryable and is not falsely marked processed.
- A retry after the failure can complete exactly once.
- A stale processing lease can be reclaimed safely.
- An older failed event cannot overwrite a captured payment.
- An older subscription update cannot undo a newer canceled or active state.
- Duplicate Checkout completion cannot duplicate referral credit, notifications, or partner transfers.
- Invalid webhook signatures create no ledger row and no side effect.
- Test-mode events remain isolated from live-mode records.
- No secret, raw card data, or sensitive payment payload is stored in the ledger.
- Existing protected owner accounts and incident evidence remain unchanged.

## Explicit non-goals for Stage 2

- No Connect charge-type migration.
- No payout or bank-setting changes.
- No credential or webhook-secret rotation.
- No automatic suspension or deletion of accounts.
- No velocity controls yet; those are Stage 3.
- No pay-at-location schema or UI yet; that is Stage 4.
