import { and, eq, lte, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  bookingCancellationOperations,
  type BookingCancellationOperation,
} from "../../drizzle/schema";
import { getDb } from "./connection";

const CLAIM_LEASE_MS = 5 * 60 * 1000;
const CANCELLABLE_BOOKING_STATUSES = new Set(["pending", "confirmed", "in_progress"]);

type DatabaseLike = any;

type CancellationSnapshot = {
  bookingStatusAtClaim: string;
  paymentId?: number | null;
  stripePaymentIntentId?: string | null;
  refundAmount: string;
  refundPercentage: string;
  stripeRefundIdempotencyKey?: string | null;
};

export type CancellationOperationClaimInput = CancellationSnapshot & {
  bookingId: number;
  operationKey: string;
  requestedByUserId: number;
  actorRole: "customer" | "provider" | "admin";
  reason: string;
};

export type CancellationOperationClaim =
  | { action: "process"; operation: BookingCancellationOperation }
  | { action: "duplicate"; operation: BookingCancellationOperation }
  | { action: "in_progress"; operation: BookingCancellationOperation };

function isDuplicateInsertError(error: unknown): boolean {
  const code = typeof error === "object" && error && "code" in error ? String((error as any).code) : "";
  const message = error instanceof Error ? error.message : String(error);
  return code === "ER_DUP_ENTRY" || /duplicate entry|unique constraint/i.test(message);
}

function operationRetryable(operation: Pick<BookingCancellationOperation, "status" | "nextRetryAt" | "lastAttemptAt">, now: Date) {
  if (operation.status !== "retryable" && operation.status !== "refund_pending") return false;
  const leaseExpired = !operation.lastAttemptAt || operation.lastAttemptAt <= new Date(now.getTime() - CLAIM_LEASE_MS);
  const retryDue = !operation.nextRetryAt || operation.nextRetryAt <= now;
  return leaseExpired && retryDue;
}

async function findOperation(database: DatabaseLike, input: { operationKey?: string; bookingId?: number }) {
  const predicates = [];
  if (input.operationKey) predicates.push(eq(bookingCancellationOperations.operationKey, input.operationKey));
  if (input.bookingId !== undefined) predicates.push(eq(bookingCancellationOperations.bookingId, input.bookingId));
  if (!predicates.length) return undefined;
  const [operation] = await database.select().from(bookingCancellationOperations)
    .where(predicates.length === 1 ? predicates[0] : or(...predicates))
    .limit(1);
  return operation as BookingCancellationOperation | undefined;
}

async function readClaimedOperation(database: DatabaseLike, operationId: number) {
  const [operation] = await database.select().from(bookingCancellationOperations)
    .where(eq(bookingCancellationOperations.id, operationId))
    .limit(1);
  if (!operation) throw new Error("Cancellation operation could not be read after claim");
  return operation as BookingCancellationOperation;
}

/**
 * Claims a cancellation operation only. This deliberately stops before Stripe,
 * payment, booking-status, or notification work. The live route is not wired
 * to this helper until the owner-approved recovery/outbox policy is complete.
 */
export async function claimCancellationOperationWithDatabase(
  database: DatabaseLike,
  input: CancellationOperationClaimInput,
): Promise<CancellationOperationClaim> {
  const existing = await findOperation(database, input);
  if (existing) {
    return operationRetryable(existing, new Date())
      ? { action: "in_progress", operation: existing }
      : { action: "duplicate", operation: existing };
  }

  const now = new Date();
  const leaseToken = randomUUID();
  try {
    const operation = await database.transaction(async (tx: DatabaseLike) => {
      const bookingRows = await tx.execute(sql`
        SELECT id, status
        FROM bookings
        WHERE id = ${input.bookingId}
        FOR UPDATE
      `);
      const booking = (bookingRows as any)?.[0]?.[0] ?? (bookingRows as any)?.[0];
      if (!booking) throw new Error("Booking not found");
      if (!CANCELLABLE_BOOKING_STATUSES.has(String(booking.status))) {
        throw new Error("Booking is not cancellable");
      }
      if (String(booking.status) !== input.bookingStatusAtClaim) {
        throw new Error("Booking status changed before cancellation claim");
      }

      const inserted = await tx.insert(bookingCancellationOperations).values({
        bookingId: input.bookingId,
        operationKey: input.operationKey,
        requestedByUserId: input.requestedByUserId,
        actorRole: input.actorRole,
        reason: input.reason,
        bookingStatusAtClaim: input.bookingStatusAtClaim,
        paymentId: input.paymentId ?? null,
        stripePaymentIntentId: input.stripePaymentIntentId ?? null,
        refundAmount: input.refundAmount,
        refundPercentage: input.refundPercentage,
        stripeRefundIdempotencyKey: input.stripeRefundIdempotencyKey ?? null,
        status: "claimed",
        attemptCount: 1,
        leaseToken,
        lastAttemptAt: now,
      });
      const operationId = Number((inserted as any)?.[0]?.insertId ?? (inserted as any)?.insertId);
      if (!operationId) throw new Error("Cancellation operation claim did not return an id");
      return readClaimedOperation(tx, operationId);
    });
    return { action: "process", operation };
  } catch (error) {
    if (!isDuplicateInsertError(error)) throw error;
    const concurrent = await findOperation(database, input);
    if (!concurrent) throw new Error("Concurrent cancellation claim could not be loaded");
    return { action: "in_progress", operation: concurrent };
  }
}

export async function claimCancellationOperation(input: CancellationOperationClaimInput) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  return claimCancellationOperationWithDatabase(database, input);
}

/** Claims a retry lease without changing the stable Stripe idempotency key. */
export async function claimCancellationRetryWithDatabase(database: DatabaseLike, operationId: number, now = new Date()) {
  const leaseToken = randomUUID();
  const updated = await database.update(bookingCancellationOperations).set({
    status: "refund_pending",
    attemptCount: sql`${bookingCancellationOperations.attemptCount} + 1`,
    leaseToken,
    lastAttemptAt: now,
    nextRetryAt: null,
    lastError: null,
  }).where(and(
    eq(bookingCancellationOperations.id, operationId),
    or(
      and(eq(bookingCancellationOperations.status, "retryable"), or(sql`${bookingCancellationOperations.nextRetryAt} IS NULL`, lte(bookingCancellationOperations.nextRetryAt, now))),
      and(eq(bookingCancellationOperations.status, "refund_pending"), or(sql`${bookingCancellationOperations.lastAttemptAt} IS NULL`, lte(bookingCancellationOperations.lastAttemptAt, new Date(now.getTime() - CLAIM_LEASE_MS)))),
    ),
  ));

  if (!((updated as any)[0]?.affectedRows ?? 0)) {
    const current = await readClaimedOperation(database, operationId);
    return operationRetryable(current, now)
      ? { action: "in_progress" as const, operation: current }
      : { action: "duplicate" as const, operation: current };
  }
  return { action: "process" as const, operation: await readClaimedOperation(database, operationId) };
}

export const cancellationOperationPolicy = {
  claimLeaseMs: CLAIM_LEASE_MS,
  cancellableBookingStatuses: Array.from(CANCELLABLE_BOOKING_STATUSES),
};
