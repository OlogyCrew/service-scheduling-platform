# OlogyCrew Gate 2 — Cancellation Race Hardening Design

**Status:** Design only; unpublished and unapplied
**Scope:** Booking cancellation, Stripe refund retry, local idempotency, and notifications
**Production impact:** None

## Current finding

`bookingRouter.cancel` reads the booking and payment, calculates the refund, may call Stripe, updates the payment refund record, and then calls `db.cancelBooking`. `cancelBooking` currently updates the booking by ID without a conditional active-state predicate. Two concurrent requests can therefore both pass the initial status check and both continue through refund, cancellation, and notification work.

The deterministic Stripe idempotency key reduces duplicate Stripe refund creation, but it does not serialize local cancellation or notification work. The booking status enum has no `cancelling` or `refund_pending` state, and no existing cancellation outbox/idempotency table was identified.

## Proposed additive design

Add a dedicated `booking_cancellation_operations` table rather than overloading `bookings.status` or `cancellationReason`.

Required fields:

- `id` primary key;
- `bookingId` foreign key to `bookings.id`;
- `operationKey` unique, derived from booking ID and a server-issued cancellation request key;
- `bookingVersion` or equivalent claim version;
- `requestedByUserId` and actor role;
- `reason`;
- `refundAmount` and refund percentage calculated from the original payment snapshot;
- `stripePaymentIntentId`, payment ID, and deterministic Stripe refund idempotency key when applicable;
- operation status: `claimed`, `refund_pending`, `refunded`, `no_refund_required`, `completed`, `retryable`, or `failed`;
- lease/attempt fields and timestamps;
- error code/message with secrets and payment credentials excluded;
- completion timestamp.

A unique active-operation constraint for a booking must allow only one cancellation operation to own the booking at a time. The claim transaction must lock or conditionally update the booking from an active status and insert the operation record atomically. A losing request must return the existing operation state without issuing a refund or notifications.

## Processing sequence

1. Authorize the caller and read the booking.
2. In one database transaction, verify the booking is cancellable, snapshot the payment/refund inputs, create or claim the unique cancellation operation, and record the calculated refund obligation.
3. Commit the claim before any external Stripe call.
4. Execute the Stripe refund using the stored deterministic idempotency key, or mark `no_refund_required` for offline, uncaptured, or zero-refund cases.
5. In a transaction, record the refund result and transition the booking to `cancelled` only when the operation is complete or safely retryable according to the approved policy.
6. Emit notifications through a durable idempotent outbox keyed by operation ID. Notifications must not be sent directly from every retry.
7. A retry worker or authorized retry endpoint may resume `refund_pending`/`retryable` operations. It must re-read the operation before retrying and never create a second operation for the same booking.

The exact policy for whether a booking becomes visibly cancelled while a Stripe refund is pending requires owner approval. The safer default is to show cancellation requested/pending until the refund operation is durably resolved, rather than silently presenting a completed cancellation with an uncertain refund.

## Acceptance tests before implementation approval

- Two concurrent cancellation requests produce exactly one claimed operation.
- The losing request performs zero Stripe calls, payment mutations, booking mutations, and notifications.
- A Stripe timeout leaves a durable retryable operation and does not create a second operation on retry.
- Replaying a successful refund with the same operation key reuses the same Stripe idempotency key.
- A zero-refund cancellation completes without Stripe and remains idempotent.
- Offline and uncaptured payments never reach Stripe.
- A failed payment-record update does not produce a falsely completed operation.
- Booking cancellation and refund amounts use the immutable payment snapshot, not a later mutable booking total.
- Notifications are emitted once per operation, including after retry recovery.
- Unauthorized callers cannot create or resume an operation.
- Already-cancelled, completed, refunded, and no-show bookings cannot create a new operation.
- Rollback/failure injection proves no partial operation is reported as complete.
- Existing historical bookings and payment records remain unchanged by the additive migration.

## Migration and rollback boundary

This design requires a separately reviewed additive migration for the operation table and, if durable notifications are not already sufficient, an outbox table or an approved reuse of an existing durable queue. No migration is applied by this design artifact.

### Exact candidate migration — not applied

The first additive migration candidate is the following. It intentionally does not alter `bookings`, `payments`, existing Stripe records, or historical rows. The `bookingId` unique constraint permits one durable cancellation operation per booking; retries resume that operation instead of inserting another one.

```sql
CREATE TABLE `booking_cancellation_operations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `bookingId` int NOT NULL,
  `operationKey` varchar(191) NOT NULL,
  `requestedByUserId` int NOT NULL,
  `actorRole` enum('customer','provider','admin') NOT NULL,
  `reason` text NOT NULL,
  `bookingStatusAtClaim` varchar(20) NOT NULL,
  `paymentId` int DEFAULT NULL,
  `stripePaymentIntentId` varchar(255) DEFAULT NULL,
  `refundAmount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `refundPercentage` decimal(5,2) NOT NULL DEFAULT 0.00,
  `stripeRefundIdempotencyKey` varchar(255) DEFAULT NULL,
  `status` enum('claimed','refund_pending','refunded','no_refund_required','completed','retryable','failed') NOT NULL DEFAULT 'claimed',
  `attemptCount` int NOT NULL DEFAULT 0,
  `leaseToken` varchar(64) NOT NULL DEFAULT '',
  `lastAttemptAt` timestamp NULL,
  `nextRetryAt` timestamp NULL,
  `lastError` text DEFAULT NULL,
  `completedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `booking_cancel_operation_booking_unique` (`bookingId`),
  UNIQUE KEY `booking_cancel_operation_key_unique` (`operationKey`),
  KEY `booking_cancel_operation_status_retry_idx` (`status`,`nextRetryAt`),
  KEY `booking_cancel_operation_lease_idx` (`status`,`lastAttemptAt`),
  KEY `booking_cancel_operation_actor_idx` (`requestedByUserId`,`createdAt`),
  CONSTRAINT `booking_cancel_operation_booking_fk` FOREIGN KEY (`bookingId`) REFERENCES `bookings` (`id`),
  CONSTRAINT `booking_cancel_operation_actor_fk` FOREIGN KEY (`requestedByUserId`) REFERENCES `users` (`id`)
);
```

The candidate intentionally leaves notification delivery out until the existing notification persistence path is verified to support an operation-scoped idempotency key. If it does not, a second separately reviewed additive `booking_cancellation_outbox` table is required; notifications must not be made idempotent by deleting or rewriting historical notifications.

Before application, the migration must be generated through the project’s normal Drizzle path, reviewed against the actual hosted TiDB version, tested on a restored disposable backup, and checked for existing orphaned booking/user references. None of those actions has been performed here.

### Required owner decisions before implementation

1. Whether a booking remains visibly active while a refund is `refund_pending`, or receives a separate customer-facing pending-cancellation presentation.
2. Whether one cancellation operation per booking is sufficient for all reschedule/retry semantics.
3. Whether notification delivery can reuse an existing durable queue or requires the optional outbox table.
4. Which roles may retry a failed operation and whether retries are automatic or administrator-authorized.
5. The retention period for operation and error history.

Rollback must not delete operation history. If code rollback is required after the migration, the new tables remain preserved and no new operations are accepted until the compatible code path is restored. Existing bookings, payments, Stripe identifiers, connected accounts, payouts, provider settings, incident evidence, Chisolm Audio, and Gary Studios remain untouched.

## Release disposition

This is a design artifact only. It does not authorize schema changes, code promotion, deployment, publication, provider activation, pilot selection, Stripe calls, or production testing. Gate 2 remains open until the owner separately approves the design, additive migration, implementation, and isolated database-backed race tests.
