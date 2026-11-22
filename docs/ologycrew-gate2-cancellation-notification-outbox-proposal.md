# OlogyCrew Gate 2 — Cancellation Notification Outbox Proposal

**Status:** Unpublished design plus generated migration candidate; no SQL or runtime changes applied
**Scope:** Operation-scoped cancellation notifications only
**Safety boundary:** The live cancellation route, existing notifications, Stripe, payments, bookings, and provider settings remain unchanged.

## Finding

The existing `notifications` table has no operation-scoped idempotency key. `createNotification` inserts a notification and then best-effort pushes SSE, so calling it directly from every cancellation retry could create duplicate persisted notifications and duplicate real-time events. Existing notification history must not be deleted or rewritten to compensate.

## Proposed boundary

Add a separate `booking_cancellation_notification_outbox` table in a later, separately reviewed additive migration. One row is created for each operation/recipient/event combination inside the same transaction that finalizes the cancellation operation. The unique idempotency key is derived from the cancellation operation ID, recipient user ID, and event name. A delivery worker claims the row with a lease, creates the user notification once, and marks the outbox row sent only after the persisted notification is confirmed.

The outbox worker must never call Stripe, update payment amounts, change booking status, or create a second cancellation operation. SSE remains best effort after the persisted notification; an SSE failure leaves the outbox row recoverable and does not cause a second notification row.

## Exact candidate DDL — generated as `drizzle/0073_striped_solo.sql`, not applied

```sql
CREATE TABLE `booking_cancellation_notification_outbox` (
  `id` int NOT NULL AUTO_INCREMENT,
  `operationId` int NOT NULL,
  `recipientUserId` int NOT NULL,
  `eventName` varchar(64) NOT NULL,
  `idempotencyKey` varchar(191) NOT NULL,
  `notificationType` varchar(50) NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `actionUrl` varchar(500) DEFAULT NULL,
  `bookingId` int NOT NULL,
  `status` enum('pending','sending','sent','retryable','failed') NOT NULL DEFAULT 'pending',
  `attemptCount` int NOT NULL DEFAULT 0,
  `leaseToken` varchar(64) NOT NULL DEFAULT '',
  `lastAttemptAt` timestamp NULL,
  `nextRetryAt` timestamp NULL,
  `lastError` text DEFAULT NULL,
  `sentAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `cancel_notification_outbox_key_unique` (`idempotencyKey`),
  KEY `cancel_notification_outbox_claim_idx` (`status`,`nextRetryAt`,`lastAttemptAt`),
  KEY `cancel_notification_outbox_operation_idx` (`operationId`),
  KEY `cancel_notification_outbox_recipient_idx` (`recipientUserId`,`createdAt`),
  CONSTRAINT `cancel_notification_outbox_operation_fk` FOREIGN KEY (`operationId`) REFERENCES `booking_cancellation_operations` (`id`),
  CONSTRAINT `cancel_notification_outbox_recipient_fk` FOREIGN KEY (`recipientUserId`) REFERENCES `users` (`id`),
  CONSTRAINT `cancel_notification_outbox_booking_fk` FOREIGN KEY (`bookingId`) REFERENCES `bookings` (`id`)
);
```

The candidate intentionally does not alter `notifications`, `bookings`, `payments`, or historical rows. It must not be applied until the operation-table migration, hosted TiDB compatibility, notification retention, and delivery semantics are separately approved.

## Delivery protocol

1. In the operation-finalization transaction, insert one outbox row per required recipient/event using the unique idempotency key.
2. A worker claims `pending` or due `retryable` rows, or reclaims a stale `sending` lease, using a conditional update and a fresh lease token.
3. The worker checks for an existing notification with the operation-scoped key once that key is available in the notification model. If the existing table cannot safely store that key, the worker must use the outbox row's sent state and transaction boundary rather than an unscoped notification-type query.
4. Persist the notification exactly once, commit, then perform best-effort SSE delivery.
5. Mark the outbox row `sent` only after persistence succeeds. On provider/SSE failure, record a bounded redacted error and retry without creating a second operation.
6. Permanent failures remain auditable; no cleanup job may delete the outbox history to make counts look clean.

## Required owner decisions

- Which recipients receive cancellation-requested, refund-completed, no-refund, and refund-pending events.
- Whether `notifications` receives a future additive `sourceKey` column or whether the outbox row remains the authoritative duplicate-prevention record.
- Whether delivery is an application worker, scheduled job, or authorized retry endpoint.
- Retry delay, maximum attempts, permanent-failure handling, and retention period.
- Whether a booking remains visibly active while refund processing is pending.

## Acceptance tests before implementation

- Concurrent finalization creates one outbox row per operation/recipient/event.
- Duplicate delivery attempts create one persisted notification and at most one successful SSE event per outbox row.
- A stale worker cannot mark a newer lease sent.
- Notification persistence failure leaves the outbox retryable and does not mark it sent.
- SSE failure does not create another notification row.
- Notification delivery never calls Stripe or mutates payments/bookings.
- Existing notification history and unrelated notification types remain unchanged.
- Unauthorized callers cannot enqueue or retry cancellation notifications.

## Release disposition

This is an unpublished design and migration-review artifact. It does not authorize migration execution, a notification worker in production, route integration, deployment, publication, provider activation, pilot selection, or production testing.
