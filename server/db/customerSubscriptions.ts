import { eq, sql } from "drizzle-orm";
import { customerSubscriptions, customerFavorites } from "../../drizzle/schema";
import type { CustomerSubscription } from "../../drizzle/schema";
import { getDb } from "./connection";
import { resolveCustomerEntitlement } from "../../shared/entitlements";

export async function getCustomerSubscription(userId: number): Promise<CustomerSubscription | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const [sub] = await db
    .select()
    .from(customerSubscriptions)
    .where(eq(customerSubscriptions.userId, userId))
    .limit(1);
  return sub;
}

export async function getCustomerTier(userId: number): Promise<"free" | "pro" | "business"> {
  const sub = await getCustomerSubscription(userId);
  return resolveCustomerEntitlement(sub).effectiveTier;
}

export async function getCustomerEntitlement(userId: number) {
  const sub = await getCustomerSubscription(userId);
  return resolveCustomerEntitlement(sub);
}

export async function getUserFavoriteCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(customerFavorites)
    .where(eq(customerFavorites.userId, userId));
  return result[0]?.count ?? 0;
}

export async function upsertCustomerSubscription(data: {
  userId: number;
  tier: "free" | "pro" | "business";
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  status?: "active" | "trialing" | "past_due" | "cancelled" | "incomplete" | "paused";
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  trialEndsAt?: Date;
  pausedAt?: Date | null;
  resumesAt?: Date | null;
  cancelAtPeriodEnd?: boolean;
}) {
  const db = await getDb();
  if (!db) return;

  const existing = await getCustomerSubscription(data.userId);
  if (existing) {
    await db
      .update(customerSubscriptions)
      .set({
        tier: data.tier,
        status: data.status ?? "active",
        stripeSubscriptionId: data.stripeSubscriptionId ?? existing.stripeSubscriptionId,
        stripeCustomerId: data.stripeCustomerId ?? existing.stripeCustomerId,
        currentPeriodStart: data.currentPeriodStart ?? existing.currentPeriodStart,
        currentPeriodEnd: data.currentPeriodEnd ?? existing.currentPeriodEnd,
        trialEndsAt: data.trialEndsAt ?? existing.trialEndsAt,
        pausedAt: data.pausedAt !== undefined ? data.pausedAt : existing.pausedAt,
        resumesAt: data.resumesAt !== undefined ? data.resumesAt : existing.resumesAt,
        cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? existing.cancelAtPeriodEnd,
      })
      .where(eq(customerSubscriptions.id, existing.id));
  } else {
    await db.insert(customerSubscriptions).values({
      userId: data.userId,
      tier: data.tier,
      status: data.status ?? "active",
      stripeSubscriptionId: data.stripeSubscriptionId,
      stripeCustomerId: data.stripeCustomerId,
      currentPeriodStart: data.currentPeriodStart,
      currentPeriodEnd: data.currentPeriodEnd,
      trialEndsAt: data.trialEndsAt,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? false,
    });
  }
}

export async function clearCustomerStripeSubscriptionReference(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(customerSubscriptions).set({
    tier: "free",
    status: "cancelled",
    stripeSubscriptionId: null,
    cancelAtPeriodEnd: false,
  }).where(eq(customerSubscriptions.userId, userId));
}

export async function getCustomerSubscriptionAnalytics() {
  const db = await getDb();
  if (!db) return { free: 0, pro: 0, business: 0, total: 0 };
  
  const results = await db
    .select({
      tier: customerSubscriptions.tier,
      count: sql<number>`count(*)`,
    })
    .from(customerSubscriptions)
    .where(eq(customerSubscriptions.status, "active"))
    .groupBy(customerSubscriptions.tier);

  const analytics = { free: 0, pro: 0, business: 0, total: 0 };
  for (const r of results) {
    if (r.tier in analytics) {
      (analytics as any)[r.tier] = r.count;
      analytics.total += r.count;
    }
  }
  return analytics;
}
