import { and, eq, lte, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  bookingCancellationNotificationOutbox,
  type BookingCancellationNotificationOutbox,
} from "../../drizzle/schema";
import { getDb } from "./connection";

const DELIVERY_LEASE_MS = 5 * 60 * 1000;
const RETRY_DELAY_MS = 60 * 1000;
type DatabaseLike = any;

export type CancellationNotificationOutboxInput = {
  operationId: number;
  recipientUserId: number;
  eventName: string;
  notificationType: string;
  title: string;
  message: string;
  actionUrl?: string | null;
  bookingId: number;
};

export type CancellationNotificationClaim =
  | { action: "process"; outbox: BookingCancellationNotificationOutbox }
  | { action: "duplicate"; outbox: BookingCancellationNotificationOutbox }
  | { action: "in_progress"; outbox: BookingCancellationNotificationOutbox };

export function buildCancellationNotificationIdempotencyKey(input: Pick<CancellationNotificationOutboxInput, "operationId" | "recipientUserId" | "eventName">) {
  const eventName = input.eventName.trim();
  if (!eventName || eventName.length > 64) throw new Error("Invalid cancellation notification event");
  return `cancel:${input.operationId}:${input.recipientUserId}:${eventName}`;
}

function isDuplicateInsertError(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String((error as any).code) : "";
  const message = error instanceof Error ? error.message : String(error);
  return code === "ER_DUP_ENTRY" || /duplicate entry|unique constraint/i.test(message);
}

function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/(sk|rk|whsec|Bearer)_[A-Za-z0-9_\-]+/gi, "[redacted]").slice(0, 1000);
}

async function readOutbox(database: DatabaseLike, id: number) {
  const [outbox] = await database.select().from(bookingCancellationNotificationOutbox)
    .where(eq(bookingCancellationNotificationOutbox.id, id)).limit(1);
  if (!outbox) throw new Error("Cancellation notification outbox row could not be read");
  return outbox as BookingCancellationNotificationOutbox;
}

async function findByKey(database: DatabaseLike, idempotencyKey: string) {
  const [outbox] = await database.select().from(bookingCancellationNotificationOutbox)
    .where(eq(bookingCancellationNotificationOutbox.idempotencyKey, idempotencyKey)).limit(1);
  return outbox as BookingCancellationNotificationOutbox | undefined;
}

export async function enqueueCancellationNotificationWithDatabase(
  database: DatabaseLike,
  input: CancellationNotificationOutboxInput,
) {
  const idempotencyKey = buildCancellationNotificationIdempotencyKey(input);
  const existing = await findByKey(database, idempotencyKey);
  if (existing) return { action: "duplicate" as const, outbox: existing };

  try {
    const inserted = await database.insert(bookingCancellationNotificationOutbox).values({
      ...input,
      idempotencyKey,
      actionUrl: input.actionUrl ?? null,
      status: "pending",
      attemptCount: 0,
      leaseToken: "",
    });
    const id = Number((inserted as any)?.[0]?.insertId ?? (inserted as any)?.insertId);
    if (!id) throw new Error("Cancellation notification outbox insert did not return an id");
    return { action: "created" as const, outbox: await readOutbox(database, id) };
  } catch (error) {
    if (!isDuplicateInsertError(error)) throw error;
    const concurrent = await findByKey(database, idempotencyKey);
    if (!concurrent) throw new Error("Concurrent cancellation notification enqueue could not be loaded");
    return { action: "duplicate" as const, outbox: concurrent };
  }
}

export async function enqueueCancellationNotification(input: CancellationNotificationOutboxInput) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  return enqueueCancellationNotificationWithDatabase(database, input);
}

function canRetry(outbox: Pick<BookingCancellationNotificationOutbox, "status" | "nextRetryAt" | "lastAttemptAt">, now: Date) {
  if (outbox.status === "pending") return true;
  if (outbox.status === "retryable") return !outbox.nextRetryAt || outbox.nextRetryAt <= now;
  return outbox.status === "sending" && (!outbox.lastAttemptAt || outbox.lastAttemptAt <= new Date(now.getTime() - DELIVERY_LEASE_MS));
}

export async function claimCancellationNotificationWithDatabase(database: DatabaseLike, outboxId: number, now = new Date()): Promise<CancellationNotificationClaim> {
  const leaseToken = randomUUID();
  const updated = await database.update(bookingCancellationNotificationOutbox).set({
    status: "sending",
    attemptCount: sql`${bookingCancellationNotificationOutbox.attemptCount} + 1`,
    leaseToken,
    lastAttemptAt: now,
    nextRetryAt: null,
    lastError: null,
  }).where(and(
    eq(bookingCancellationNotificationOutbox.id, outboxId),
    or(
      eq(bookingCancellationNotificationOutbox.status, "pending"),
      and(eq(bookingCancellationNotificationOutbox.status, "retryable"), or(sql`${bookingCancellationNotificationOutbox.nextRetryAt} IS NULL`, lte(bookingCancellationNotificationOutbox.nextRetryAt, now))),
      and(eq(bookingCancellationNotificationOutbox.status, "sending"), or(sql`${bookingCancellationNotificationOutbox.lastAttemptAt} IS NULL`, lte(bookingCancellationNotificationOutbox.lastAttemptAt, new Date(now.getTime() - DELIVERY_LEASE_MS)))),
    ),
  ));

  if (!((updated as any)[0]?.affectedRows ?? 0)) {
    const current = await readOutbox(database, outboxId);
    return canRetry(current, now)
      ? { action: "in_progress", outbox: current }
      : { action: "duplicate", outbox: current };
  }
  return { action: "process", outbox: await readOutbox(database, outboxId) };
}

export async function markCancellationNotificationSentWithDatabase(database: DatabaseLike, input: { outboxId: number; leaseToken: string; now?: Date }) {
  const updated = await database.update(bookingCancellationNotificationOutbox).set({
    status: "sent",
    sentAt: input.now ?? new Date(),
    nextRetryAt: null,
    lastError: null,
  }).where(and(
    eq(bookingCancellationNotificationOutbox.id, input.outboxId),
    eq(bookingCancellationNotificationOutbox.leaseToken, input.leaseToken),
    eq(bookingCancellationNotificationOutbox.status, "sending"),
  ));
  if (!((updated as any)[0]?.affectedRows ?? 0)) throw new Error("Cancellation notification lease is stale or already resolved");
  return readOutbox(database, input.outboxId);
}

export async function markCancellationNotificationRetryableWithDatabase(database: DatabaseLike, input: { outboxId: number; leaseToken: string; error: unknown; nextRetryAt?: Date; now?: Date }) {
  const now = input.now ?? new Date();
  const updated = await database.update(bookingCancellationNotificationOutbox).set({
    status: "retryable",
    nextRetryAt: input.nextRetryAt ?? new Date(now.getTime() + RETRY_DELAY_MS),
    lastError: safeErrorMessage(input.error),
  }).where(and(
    eq(bookingCancellationNotificationOutbox.id, input.outboxId),
    eq(bookingCancellationNotificationOutbox.leaseToken, input.leaseToken),
    eq(bookingCancellationNotificationOutbox.status, "sending"),
  ));
  if (!((updated as any)[0]?.affectedRows ?? 0)) throw new Error("Cancellation notification lease is stale or already resolved");
  return readOutbox(database, input.outboxId);
}

export const cancellationNotificationOutboxPolicy = {
  deliveryLeaseMs: DELIVERY_LEASE_MS,
  retryDelayMs: RETRY_DELAY_MS,
};
