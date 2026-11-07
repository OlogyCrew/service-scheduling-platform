import { and, desc, eq, lte, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb } from "./connection";
import { stripeWebhookEvents, type StripeWebhookEvent } from "../../drizzle/schema";

const PROCESSING_LEASE_MS = 5 * 60 * 1000;
const RETRY_DELAY_MS = 60 * 1000;

export type StripeWebhookEventInput = {
  stripeEventId: string;
  eventType: string;
  accountId?: string | null;
  livemode: boolean;
  apiVersion?: string | null;
  paymentIntentId?: string | null;
  checkoutSessionId?: string | null;
  chargeId?: string | null;
  invoiceId?: string | null;
  subscriptionId?: string | null;
  bookingId?: number | null;
  metadata?: Record<string, string | number | boolean | null>;
};

export type StripeWebhookClaim =
  | { action: "process"; event: StripeWebhookEvent }
  | { action: "duplicate"; event: StripeWebhookEvent }
  | { action: "in_progress"; event: StripeWebhookEvent };

export type WebhookClaimDecision = "duplicate" | "process" | "in_progress";

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/(sk|rk|whsec|Bearer)_[A-Za-z0-9_\-]+/gi, "[redacted]").slice(0, 1000);
}

function isDuplicateInsertError(error: unknown): boolean {
  const code = typeof error === "object" && error && "code" in error ? String((error as any).code) : "";
  const message = error instanceof Error ? error.message : String(error);
  return code === "ER_DUP_ENTRY" || /duplicate entry|unique constraint/i.test(message);
}

export function classifyExistingWebhookClaim(
  event: Pick<StripeWebhookEvent, "status" | "nextRetryAt" | "lastAttemptAt">,
  now = new Date(),
): WebhookClaimDecision {
  if (event.status === "processed") return "duplicate";
  const leaseCutoff = new Date(now.getTime() - PROCESSING_LEASE_MS);
  const retryable = event.status === "received"
    || (event.status === "failed" && (!event.nextRetryAt || event.nextRetryAt <= now))
    || (event.status === "processing" && (!event.lastAttemptAt || event.lastAttemptAt <= leaseCutoff));
  return retryable ? "process" : "in_progress";
}

async function getEventByStripeId(stripeEventId: string): Promise<StripeWebhookEvent | undefined> {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  const [event] = await database.select().from(stripeWebhookEvents)
    .where(eq(stripeWebhookEvents.stripeEventId, stripeEventId))
    .orderBy(desc(stripeWebhookEvents.id))
    .limit(1);
  return event;
}

export async function claimStripeWebhookEvent(input: StripeWebhookEventInput): Promise<StripeWebhookClaim> {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  const now = new Date();
  const leaseToken = randomUUID();
  const metadata = input.metadata ? JSON.stringify(input.metadata) : null;

  try {
    await database.insert(stripeWebhookEvents).values({
      ...input,
      metadata,
      status: "processing",
      attemptCount: 1,
      leaseToken,
      firstReceivedAt: now,
      lastAttemptAt: now,
    });
    const inserted = await getEventByStripeId(input.stripeEventId);
    if (!inserted) throw new Error("Webhook event was inserted but could not be read back");
    return { action: "process", event: inserted };
  } catch (error) {
    if (!isDuplicateInsertError(error)) throw error;
  }

  const existing = await getEventByStripeId(input.stripeEventId);
  if (!existing) throw new Error("Duplicate webhook event could not be loaded");
  const decision = classifyExistingWebhookClaim(existing, now);
  if (decision !== "process") return { action: decision, event: existing };
  const leaseCutoff = new Date(now.getTime() - PROCESSING_LEASE_MS);

  const updated = await database.update(stripeWebhookEvents)
    .set({
      status: "processing",
      attemptCount: sql`${stripeWebhookEvents.attemptCount} + 1`,
      leaseToken,
      lastAttemptAt: now,
      nextRetryAt: null,
      lastError: null,
    })
    .where(and(
      eq(stripeWebhookEvents.id, existing.id),
      or(
        eq(stripeWebhookEvents.status, "received"),
        and(eq(stripeWebhookEvents.status, "failed"), or(sql`${stripeWebhookEvents.nextRetryAt} IS NULL`, lte(stripeWebhookEvents.nextRetryAt, now))),
        and(eq(stripeWebhookEvents.status, "processing"), or(sql`${stripeWebhookEvents.lastAttemptAt} IS NULL`, lte(stripeWebhookEvents.lastAttemptAt, leaseCutoff))),
      ),
    ));

  if (!((updated as any)[0]?.affectedRows ?? 0)) {
    const current = await getEventByStripeId(input.stripeEventId);
    if (!current) throw new Error("Webhook event disappeared during claim");
    return current.status === "processed"
      ? { action: "duplicate", event: current }
      : { action: "in_progress", event: current };
  }

  const claimed = await getEventByStripeId(input.stripeEventId);
  if (!claimed) throw new Error("Claimed webhook event could not be loaded");
  return { action: "process", event: claimed };
}

export async function markStripeWebhookEventProcessed(id: number, leaseToken: string): Promise<void> {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  await database.update(stripeWebhookEvents).set({
    status: "processed",
    processedAt: new Date(),
    nextRetryAt: null,
    lastError: null,
  }).where(and(eq(stripeWebhookEvents.id, id), eq(stripeWebhookEvents.leaseToken, leaseToken)));
}

export async function markStripeWebhookEventFailed(id: number, leaseToken: string, error: unknown): Promise<void> {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  await database.update(stripeWebhookEvents).set({
    status: "failed",
    nextRetryAt: new Date(Date.now() + RETRY_DELAY_MS),
    lastError: safeErrorMessage(error),
  }).where(and(eq(stripeWebhookEvents.id, id), eq(stripeWebhookEvents.leaseToken, leaseToken)));
}

export const stripeWebhookLedgerPolicy = {
  processingLeaseMs: PROCESSING_LEASE_MS,
  retryDelayMs: RETRY_DELAY_MS,
};
