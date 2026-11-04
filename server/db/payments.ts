import { eq, and, desc, gte, sql } from "drizzle-orm";
import {
  payments,
  bookings,
  providerSubscriptions,
  customerSubscriptions,
  serviceProviders,
  users,
  type ProviderSubscription,
  type CustomerSubscription,
} from "../../drizzle/schema";
import { getDb } from "./connection";
import { CUSTOMER_PLANS, PROVIDER_PLANS, resolveCustomerEntitlement, resolveProviderEntitlement } from "../../shared/entitlements";

export type AdminProviderTierGroup = "free" | "basic" | "premium" | "trialing";

type AdminProviderTierRow = {
  providerId: number;
  businessName: string;
  city: string | null;
  state: string | null;
  userId: number;
  userName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  profilePhotoUrl: string | null;
  subscription: ProviderSubscription | null;
};

function reportableProviderSubscriptionScope() {
  return sql`
    ${serviceProviders.isActive} = 1
    AND ${serviceProviders.deletedAt} IS NULL
    AND ${users.deletedAt} IS NULL
    AND ${serviceProviders.isOfficial} = 0
    AND ${serviceProviders.id} <> 1680002
    AND LOWER(TRIM(${serviceProviders.businessName})) <> 'prattis test'
    AND LOWER(TRIM(SUBSTRING_INDEX(COALESCE(${users.email}, ''), '@', -1))) NOT IN ('test.com', 'example.invalid')
    AND COALESCE(${users.loginMethod}, '') <> 'test'
    AND ${users.openId} NOT LIKE 'test-%'
    AND ${users.openId} NOT LIKE 'test\\_%'
  `;
}

export function summarizeAdminProviderTierMembers(
  rows: AdminProviderTierRow[],
  group: AdminProviderTierGroup,
  now = new Date(),
) {
  const members = rows.flatMap((row) => {
    const entitlement = resolveProviderEntitlement(row.subscription, now);
    const isMember = group === "trialing"
      ? entitlement.state === "trialing"
      : entitlement.effectiveTier === group;
    if (!isMember) return [];

    return [{
      providerId: row.providerId,
      businessName: row.businessName,
      city: row.city,
      state: row.state,
      userId: row.userId,
      userName: row.userName,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      profilePhotoUrl: row.profilePhotoUrl,
      configuredTier: entitlement.configuredTier,
      effectiveTier: entitlement.effectiveTier,
      lifecycleState: entitlement.state,
      requiresBillingAction: entitlement.requiresBillingAction,
      isScheduledToCancel: entitlement.isScheduledToCancel,
      accessEndsAt: entitlement.accessEndsAt,
    }];
  }).sort((left, right) => left.businessName.localeCompare(right.businessName));

  return { group, total: members.length, members };
}

// ============================================================================
// PAYMENT MANAGEMENT
// ============================================================================

export async function createPayment(data: typeof payments.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(payments).values(data);
  return result;
}

export async function getPaymentByBookingId(bookingId: number) {
  const database = await getDb();
  if (!database) return undefined;
  const [payment] = await database.select().from(payments)
    .where(eq(payments.bookingId, bookingId))
    .orderBy(desc(payments.createdAt))
    .limit(1);
  return payment;
}

export async function getPaymentByStripePaymentIntentId(paymentIntentId: string) {
  const database = await getDb();
  if (!database) return undefined;
  const [payment] = await database.select().from(payments)
    .where(eq(payments.stripePaymentIntentId, paymentIntentId))
    .orderBy(desc(payments.createdAt))
    .limit(1);
  return payment;
}

export async function updatePaymentRefund(paymentId: number, data: {
  status: string;
  refundAmount: string;
  refundReason: string;
  stripeRefundId?: string;
  refundedAt: Date;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  await database.update(payments).set(data as any).where(eq(payments.id, paymentId));
}

export async function updatePaymentStatus(paymentId: number, status: string, additionalData?: Record<string, any>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateData: Record<string, any> = { status };
  if (additionalData) Object.assign(updateData, additionalData);
  await db.update(payments).set(updateData).where(eq(payments.id, paymentId));
}

export async function upsertBookingPaymentByStripeIntent(input: {
  bookingId: number;
  paymentType: "deposit" | "final" | "full";
  amount: string;
  currency?: string;
  status: "pending" | "authorized" | "captured" | "failed" | "cancelled";
  stripePaymentIntentId: string;
  failureReason?: string | null;
  processedAt?: Date | null;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  await database.insert(payments).values({
    bookingId: input.bookingId,
    paymentType: input.paymentType,
    amount: input.amount,
    currency: (input.currency || "USD").toUpperCase(),
    status: input.status,
    stripePaymentIntentId: input.stripePaymentIntentId,
    failureReason: input.failureReason ?? null,
    processedAt: input.processedAt ?? null,
  }).onDuplicateKeyUpdate({
    set: {
      bookingId: input.bookingId,
      paymentType: input.paymentType,
      amount: input.amount,
      currency: (input.currency || "USD").toUpperCase(),
      status: sql`CASE
        WHEN ${payments.status} = 'refunded' THEN 'refunded'
        WHEN ${payments.status} = 'captured' AND ${input.status} = 'failed' THEN 'captured'
        ELSE ${input.status}
      END`,
      failureReason: sql`CASE
        WHEN ${payments.status} IN ('captured', 'refunded') AND ${input.status} = 'failed' THEN ${payments.failureReason}
        ELSE ${input.failureReason ?? null}
      END`,
      processedAt: input.processedAt ?? null,
    },
  });
  return getPaymentByStripePaymentIntentId(input.stripePaymentIntentId);
}

// ============================================================================
// SUBSCRIPTION HELPERS
// ============================================================================

export async function getProviderSubscription(providerId: number): Promise<ProviderSubscription | undefined> {
  const database = await getDb();
  if (!database) return undefined;
  const [sub] = await database.select().from(providerSubscriptions)
    .where(eq(providerSubscriptions.providerId, providerId))
    .limit(1);
  return sub;
}

export async function upsertProviderSubscription(data: {
  providerId: number;
  tier: "free" | "basic" | "premium";
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  status: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  trialEndsAt?: Date;
  pausedAt?: Date | null;
  resumesAt?: Date | null;
  cancelAtPeriodEnd?: boolean;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  const existing = await getProviderSubscription(data.providerId);
  if (existing) {
    const setData: any = {
      tier: data.tier,
      stripeSubscriptionId: data.stripeSubscriptionId,
      stripeCustomerId: data.stripeCustomerId,
      status: data.status,
      currentPeriodStart: data.currentPeriodStart,
      currentPeriodEnd: data.currentPeriodEnd,
      trialEndsAt: data.trialEndsAt,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd,
    };
    if (data.pausedAt !== undefined) setData.pausedAt = data.pausedAt;
    if (data.resumesAt !== undefined) setData.resumesAt = data.resumesAt;
    await database.update(providerSubscriptions)
      .set(setData)
      .where(eq(providerSubscriptions.id, existing.id));
  } else {
    await database.insert(providerSubscriptions).values(data as any);
  }
}

export async function clearProviderStripeSubscriptionReference(providerId: number) {
  const database = await getDb();
  if (!database) return;
  await database.update(providerSubscriptions).set({
    tier: "free",
    status: "cancelled",
    stripeSubscriptionId: null,
    cancelAtPeriodEnd: false,
  }).where(eq(providerSubscriptions.providerId, providerId));
}

export async function getProviderTier(providerId: number): Promise<"free" | "basic" | "premium"> {
  const sub = await getProviderSubscription(providerId);
  return resolveProviderEntitlement(sub).effectiveTier;
}

export async function getProviderEntitlement(providerId: number) {
  const sub = await getProviderSubscription(providerId);
  return resolveProviderEntitlement(sub);
}

export function summarizeProviderSubscriptionAnalytics(
  subs: ProviderSubscription[],
  totalProviders: number,
  now = new Date(),
) {
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const resolved = subs.map(sub => ({ sub, entitlement: resolveProviderEntitlement(sub, now) }));
  const active = resolved.filter(({ entitlement }) => entitlement.hasPaidAccess);
  const paying = resolved.filter(({ sub, entitlement }) =>
    entitlement.hasPaidAccess && sub.status === "active" && !!sub.stripeSubscriptionId
  );
  const cancelled = subs.filter(sub => sub.status === "cancelled");
  const cancelledThisMonth = cancelled.filter(sub => sub.updatedAt && new Date(sub.updatedAt) >= firstOfMonth).length;
  const newThisMonth = subs.filter(sub => sub.createdAt && new Date(sub.createdAt) >= firstOfMonth && sub.tier !== "free").length;
  const basic = active.filter(({ entitlement }) => entitlement.effectiveTier === "basic").length;
  const premium = active.filter(({ entitlement }) => entitlement.effectiveTier === "premium").length;
  const trialing = resolved.filter(({ entitlement }) => entitlement.state === "trialing").length;
  const freeCount = Math.max(0, totalProviders - basic - premium);
  const mrr = paying.reduce((total, { sub, entitlement }) => {
    const plan = PROVIDER_PLANS[entitlement.effectiveTier];
    const periodStart = sub.currentPeriodStart ? new Date(sub.currentPeriodStart).getTime() : 0;
    const periodEnd = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).getTime() : 0;
    const periodDays = periodStart && periodEnd ? (periodEnd - periodStart) / 86_400_000 : 0;
    return total + (periodDays > 300 ? plan.yearlyPrice / 12 : plan.monthlyPrice);
  }, 0);
  const activeAtStart = Math.max(0, active.length - newThisMonth + cancelledThisMonth);
  const churnRate = activeAtStart > 0 ? (cancelledThisMonth / activeAtStart) * 100 : 0;
  const everBasicOrHigher = subs.filter(sub => sub.tier === "basic" || sub.tier === "premium").length;
  const everPremium = subs.filter(sub => sub.tier === "premium").length;
  const freeToBasic = totalProviders > 0 ? (everBasicOrHigher / totalProviders) * 100 : 0;
  const basicToPremium = everBasicOrHigher > 0 ? (everPremium / everBasicOrHigher) * 100 : 0;

  return {
    tiers: { free: freeCount, basic, premium, trialing },
    mrr: Math.round(mrr * 100) / 100,
    churnRate: Math.round(churnRate * 10) / 10,
    totalProviders,
    activeSubscribers: basic + premium,
    payingSubscribers: paying.length,
    trialingSubscribers: trialing,
    graceSubscribers: resolved.filter(({ entitlement }) => entitlement.state === "past_due_grace").length,
    scheduledCancellations: resolved.filter(({ entitlement }) => entitlement.isScheduledToCancel).length,
    cancelledThisMonth,
    newThisMonth,
    conversionRates: {
      freeToBasic: Math.round(freeToBasic * 10) / 10,
      basicToPremium: Math.round(basicToPremium * 10) / 10,
    },
  };
}

export function summarizeCustomerSubscriptionAnalytics(subs: CustomerSubscription[], now = new Date()) {
  const resolved = subs.map(sub => ({ sub, entitlement: resolveCustomerEntitlement(sub, now) }));
  const active = resolved.filter(({ entitlement }) => entitlement.hasPaidAccess);
  const paying = resolved.filter(({ sub, entitlement }) =>
    entitlement.hasPaidAccess && sub.status === "active" && !!sub.stripeSubscriptionId
  );
  const mrr = paying.reduce((total, { sub, entitlement }) => {
    const plan = CUSTOMER_PLANS[entitlement.effectiveTier];
    const periodStart = sub.currentPeriodStart ? new Date(sub.currentPeriodStart).getTime() : 0;
    const periodEnd = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).getTime() : 0;
    const periodDays = periodStart && periodEnd ? (periodEnd - periodStart) / 86_400_000 : 0;
    return total + (periodDays > 300 ? plan.yearlyPrice / 12 : plan.monthlyPrice);
  }, 0);

  return {
    activeSubscribers: active.length,
    payingSubscribers: paying.length,
    trialingSubscribers: resolved.filter(({ entitlement }) => entitlement.state === "trialing").length,
    graceSubscribers: resolved.filter(({ entitlement }) => entitlement.state === "past_due_grace").length,
    scheduledCancellations: resolved.filter(({ entitlement }) => entitlement.isScheduledToCancel).length,
    mrr: Math.round(mrr * 100) / 100,
  };
}

export async function getAdminProviderTierMembers(group: AdminProviderTierGroup) {
  const database = await getDb();
  if (!database) return { group, total: 0, members: [] };

  const rows = await database.select({
    providerId: serviceProviders.id,
    businessName: serviceProviders.businessName,
    city: serviceProviders.city,
    state: serviceProviders.state,
    userId: users.id,
    userName: users.name,
    firstName: users.firstName,
    lastName: users.lastName,
    email: users.email,
    profilePhotoUrl: users.profilePhotoUrl,
    subscription: providerSubscriptions,
  })
    .from(serviceProviders)
    .innerJoin(users, eq(users.id, serviceProviders.userId))
    .leftJoin(providerSubscriptions, eq(providerSubscriptions.providerId, serviceProviders.id))
    .where(reportableProviderSubscriptionScope());

  return summarizeAdminProviderTierMembers(rows, group);
}

export async function getSubscriptionAnalytics() {
  const database = await getDb();
  if (!database) return {
    tiers: { free: 0, basic: 0, premium: 0, trialing: 0 },
    mrr: 0, churnRate: 0, totalProviders: 0, activeSubscribers: 0,
    payingSubscribers: 0, trialingSubscribers: 0, graceSubscribers: 0, scheduledCancellations: 0,
    providerActiveSubscribers: 0, customerActiveSubscribers: 0, providerMrr: 0, customerMrr: 0,
    cancelledThisMonth: 0, newThisMonth: 0,
    conversionRates: { freeToBasic: 0, basicToPremium: 0 },
  };

  const providerRows = await database.select({ subscription: providerSubscriptions })
    .from(providerSubscriptions)
    .innerJoin(serviceProviders, eq(serviceProviders.id, providerSubscriptions.providerId))
    .innerJoin(users, eq(users.id, serviceProviders.userId))
    .where(reportableProviderSubscriptionScope());
  const customerRows = await database.select({ subscription: customerSubscriptions })
    .from(customerSubscriptions)
    .innerJoin(users, eq(users.id, customerSubscriptions.userId))
    .where(sql`
      ${users.deletedAt} IS NULL
      AND LOWER(TRIM(SUBSTRING_INDEX(COALESCE(${users.email}, ''), '@', -1))) NOT IN ('test.com', 'example.invalid')
      AND COALESCE(${users.loginMethod}, '') <> 'test'
      AND ${users.openId} NOT LIKE 'test-%'
      AND ${users.openId} NOT LIKE 'test\\_%'
      AND NOT EXISTS (
        SELECT 1 FROM service_providers customer_provider
        WHERE customer_provider.userId = ${users.id}
          AND (customer_provider.isOfficial = 1 OR customer_provider.id = 1680002 OR LOWER(TRIM(customer_provider.businessName)) = 'prattis test')
      )
    `);
  const subs = providerRows.map(row => row.subscription);
  const customerSubs = customerRows.map(row => row.subscription);
  const allProviders = await database.select({ count: sql<number>`COUNT(*)` })
    .from(serviceProviders)
    .innerJoin(users, eq(users.id, serviceProviders.userId))
    .where(reportableProviderSubscriptionScope());
  const totalProviders = allProviders[0]?.count ?? 0;
  const providerSummary = summarizeProviderSubscriptionAnalytics(subs, totalProviders);
  const customerSummary = summarizeCustomerSubscriptionAnalytics(customerSubs);
  return {
    ...providerSummary,
    mrr: Math.round((providerSummary.mrr + customerSummary.mrr) * 100) / 100,
    activeSubscribers: providerSummary.activeSubscribers + customerSummary.activeSubscribers,
    payingSubscribers: providerSummary.payingSubscribers + customerSummary.payingSubscribers,
    trialingSubscribers: providerSummary.trialingSubscribers + customerSummary.trialingSubscribers,
    graceSubscribers: providerSummary.graceSubscribers + customerSummary.graceSubscribers,
    scheduledCancellations: providerSummary.scheduledCancellations + customerSummary.scheduledCancellations,
    providerActiveSubscribers: providerSummary.activeSubscribers,
    customerActiveSubscribers: customerSummary.activeSubscribers,
    providerMrr: providerSummary.mrr,
    customerMrr: customerSummary.mrr,
  };
}
