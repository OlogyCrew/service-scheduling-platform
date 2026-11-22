import Stripe from "stripe";
import { ENV } from "./_core/env";
import { getDb } from "./db/connection";
import { partnerTransfers, type PartnerTransfer } from "../drizzle/schema";
import { desc, eq, sql, and, gte, lte } from "drizzle-orm";
import { assertPaymentEligibilityOpen } from "./paymentEligibility";

const stripe = new Stripe(ENV.stripeSecretKey, {
  apiVersion: "2026-01-28.clover",
});

// Revenue split configuration
const PARTNER_SPLIT_PERCENTAGE = 40; // Partner gets 40%
const PLATFORM_SPLIT_PERCENTAGE = 60; // Platform keeps 60%

type TransferSourceType = "provider_subscription" | "customer_subscription" | "booking_platform_fee";
const TRANSFER_SOURCE_TYPES: readonly TransferSourceType[] = [
  "provider_subscription",
  "customer_subscription",
  "booking_platform_fee",
];

interface PartnerTransferInput {
  totalRevenue: number; // Total revenue in dollars
  sourceType: TransferSourceType;
  sourceId: string; // Stripe invoice ID, payment intent ID, etc.
  sourceDescription: string; // Human-readable description
  chargeId?: string; // Stripe charge ID for source_transaction (ties transfer to specific charge)
}

/**
 * Calculate the partner's share of revenue
 */
export function calculatePartnerShare(totalRevenue: number): number {
  return Math.round(totalRevenue * (PARTNER_SPLIT_PERCENTAGE / 100) * 100) / 100;
}

/**
 * Calculate the platform's share of revenue
 */
export function calculatePlatformShare(totalRevenue: number): number {
  return Math.round(totalRevenue * (PLATFORM_SPLIT_PERCENTAGE / 100) * 100) / 100;
}

/**
 * Execute a partner revenue split transfer via Stripe
 * Transfers 40% of the revenue to the partner's connected Stripe account
 */
export async function executePartnerTransfer(input: PartnerTransferInput): Promise<{
  success: boolean;
  transferId?: string;
  amount?: number;
  error?: string;
}> {
  // Keep the runtime boundary fail-closed as this helper can be reached by
  // webhook/cron code and JavaScript callers are not constrained by the TS union.
  // In particular, Pay-at-Location and unknown source types must never reach
  // Stripe or create a partner-transfer ledger row.
  if (!TRANSFER_SOURCE_TYPES.includes(input.sourceType)) {
    return { success: false, error: "Unsupported transfer source type" };
  }

  assertPaymentEligibilityOpen("transfer_or_partner_split");
  const partnerAccountId = ENV.partnerStripeAccountId;

  if (!partnerAccountId) {
    console.warn("[Partner Split] No partner account configured, skipping transfer");
    return { success: false, error: "No partner account configured" };
  }

  const partnerAmount = calculatePartnerShare(input.totalRevenue);

  // Stripe requires minimum transfer of $0.50
  if (partnerAmount < 0.50) {
    console.log(`[Partner Split] Amount too small for transfer: $${partnerAmount} (source: ${input.sourceDescription})`);
    // Still record it for tracking
    await recordTransfer({
      amount: partnerAmount,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      sourceDescription: input.sourceDescription,
      totalRevenue: input.totalRevenue,
      partnerAccountId,
      status: "completed",
      stripeTransferId: null,
      errorMessage: "Amount below Stripe minimum ($0.50), recorded but not transferred",
    });
    return { success: true, amount: partnerAmount };
  }

  const amountInCents = Math.round(partnerAmount * 100);

  try {
    // Build transfer params — use source_transaction when a charge ID is available
    // This ties the transfer to the specific charge, avoiding "insufficient funds" errors
    // that occur when Stripe auto-pays out the platform balance before the transfer
    const transferParams: Stripe.TransferCreateParams = {
      amount: amountInCents,
      currency: "usd",
      destination: partnerAccountId,
      description: `OlogyCrew 40% revenue share: ${input.sourceDescription}`,
      metadata: {
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        splitPercentage: PARTNER_SPLIT_PERCENTAGE.toString(),
        totalRevenue: input.totalRevenue.toFixed(2),
      },
    };

    if (input.chargeId) {
      transferParams.source_transaction = input.chargeId;
      console.log(`[Partner Split] Using source_transaction: ${input.chargeId}`);
    }

    const transfer = await stripe.transfers.create(transferParams, {
      idempotencyKey: `ologycrew-partner-${input.sourceType}-${input.sourceId}-${partnerAccountId}`,
    });

    await recordTransfer({
      amount: partnerAmount,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      sourceDescription: input.sourceDescription,
      totalRevenue: input.totalRevenue,
      partnerAccountId,
      status: "completed",
      stripeTransferId: transfer.id,
      errorMessage: null,
    });

    console.log(`[Partner Split] Transfer successful: $${partnerAmount} to ${partnerAccountId} (${input.sourceDescription})`);
    return { success: true, transferId: transfer.id, amount: partnerAmount };
  } catch (error: any) {
    console.error(`[Partner Split] Transfer failed: ${error.message}`);

    await recordTransfer({
      amount: partnerAmount,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      sourceDescription: input.sourceDescription,
      totalRevenue: input.totalRevenue,
      partnerAccountId,
      status: "failed",
      stripeTransferId: null,
      errorMessage: error.message,
    });

    return { success: false, error: error.message };
  }
}

/**
 * Record a partner transfer in the database
 */
async function recordTransfer(data: {
  amount: number;
  sourceType: TransferSourceType;
  sourceId: string;
  sourceDescription: string;
  totalRevenue: number;
  partnerAccountId: string;
  status: "pending" | "completed" | "failed";
  stripeTransferId: string | null;
  errorMessage: string | null;
}) {
  const db = await getDb();
  if (!db) {
    console.error("[Partner Split] Database not available, cannot record transfer");
    return;
  }
  await db.insert(partnerTransfers).values({
    stripeTransferId: data.stripeTransferId,
    amount: data.amount.toFixed(2),
    sourceType: data.sourceType,
    sourceId: data.sourceId,
    sourceDescription: data.sourceDescription,
    status: data.status,
    errorMessage: data.errorMessage,
    partnerAccountId: data.partnerAccountId,
    splitPercentage: PARTNER_SPLIT_PERCENTAGE.toFixed(2),
    totalRevenue: data.totalRevenue.toFixed(2),
  });
}

/**
 * Get partner transfer history with optional filters
 */
export async function getPartnerTransfers(options?: {
  sourceType?: TransferSourceType;
  status?: "pending" | "completed" | "failed";
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) {
  const conditions = [];

  if (options?.sourceType) {
    conditions.push(eq(partnerTransfers.sourceType, options.sourceType));
  }
  if (options?.status) {
    conditions.push(eq(partnerTransfers.status, options.status));
  }
  if (options?.startDate) {
    conditions.push(gte(partnerTransfers.createdAt, options.startDate));
  }
  if (options?.endDate) {
    conditions.push(lte(partnerTransfers.createdAt, options.endDate));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const db = await getDb();
  if (!db) return [];

  const transfers = await db
    .select()
    .from(partnerTransfers)
    .where(whereClause)
    .orderBy(desc(partnerTransfers.createdAt))
    .limit(options?.limit || 50)
    .offset(options?.offset || 0);

  return transfers;
}

/**
 * Get partner transfer summary statistics
 */
export async function getPartnerTransferSummary() {
  return getPartnerTransferSummaryFiltered();
}

export function summarizePartnerTransferRows(rows: PartnerTransfer[]) {
  const sources = new Map<string, {
    sourceType: TransferSourceType;
    totalRevenue: number;
    partnerOwed: number;
    transferred: number;
    hasFailure: boolean;
    isDeferred: boolean;
  }>();

  for (const row of rows) {
    const key = `${row.sourceType}:${row.sourceId || `row-${row.id}`}`;
    const current = sources.get(key) || {
      sourceType: row.sourceType,
      totalRevenue: 0,
      partnerOwed: 0,
      transferred: 0,
      hasFailure: false,
      isDeferred: false,
    };
    current.totalRevenue = Math.max(current.totalRevenue, Number(row.totalRevenue || 0));
    current.partnerOwed = Math.max(current.partnerOwed, Number(row.amount || 0));
    if (row.status === "completed" && row.stripeTransferId) {
      current.transferred = Math.max(current.transferred, Number(row.amount || 0));
    }
    current.hasFailure ||= row.status === "failed";
    current.isDeferred ||= row.status === "completed" && !row.stripeTransferId && row.errorMessage?.includes("below Stripe minimum") === true;
    sources.set(key, current);
  }

  const uniqueSources = Array.from(sources.values());
  const totalRevenue = uniqueSources.reduce((sum, source) => sum + source.totalRevenue, 0);
  const totalTransferred = uniqueSources.reduce((sum, source) => sum + source.transferred, 0);
  const partnerOwed = uniqueSources.reduce((sum, source) => sum + source.partnerOwed, 0);
  const subscriptionRevenue = uniqueSources
    .filter(source => source.sourceType === "provider_subscription" || source.sourceType === "customer_subscription")
    .reduce((sum, source) => sum + source.totalRevenue, 0);
  const bookingFeeRevenue = uniqueSources
    .filter(source => source.sourceType === "booking_platform_fee")
    .reduce((sum, source) => sum + source.totalRevenue, 0);
  const completedCount = uniqueSources.filter(source => source.transferred > 0).length;
  const deferredCount = uniqueSources.filter(source => source.transferred === 0 && source.isDeferred).length;
  const failedCount = uniqueSources.filter(source => source.transferred === 0 && source.hasFailure && !source.isDeferred).length;

  return {
    totalTransferred: Math.round(totalTransferred * 100) / 100,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    platformShare: Math.round(totalRevenue * (PLATFORM_SPLIT_PERCENTAGE / 100) * 100) / 100,
    partnerOwed: Math.round(partnerOwed * 100) / 100,
    partnerOutstanding: Math.round(Math.max(0, partnerOwed - totalTransferred) * 100) / 100,
    totalCount: uniqueSources.length,
    completedCount,
    failedCount,
    deferredCount,
    subscriptionRevenue: Math.round(subscriptionRevenue * 100) / 100,
    bookingFeeRevenue: Math.round(bookingFeeRevenue * 100) / 100,
    failedPartnerAmount: Math.round(uniqueSources
      .filter(source => source.transferred === 0 && source.hasFailure && !source.isDeferred)
      .reduce((sum, source) => sum + source.partnerOwed, 0) * 100) / 100,
    splitPercentage: { partner: PARTNER_SPLIT_PERCENTAGE, platform: PLATFORM_SPLIT_PERCENTAGE },
  };
}

/**
 * Get partner transfer summary with optional date range filter
 */
export async function getPartnerTransferSummaryFiltered(options?: {
  startDate?: Date;
  endDate?: Date;
}) {
  const db = await getDb();
  if (!db) {
    return {
      totalTransferred: 0,
      totalRevenue: 0,
      platformShare: 0,
      totalCount: 0,
      completedCount: 0,
      failedCount: 0,
      deferredCount: 0,
      subscriptionRevenue: 0,
      bookingFeeRevenue: 0,
      splitPercentage: { partner: PARTNER_SPLIT_PERCENTAGE, platform: PLATFORM_SPLIT_PERCENTAGE },
    };
  }

  const conditions = [];
  if (options?.startDate) {
    conditions.push(gte(partnerTransfers.createdAt, options.startDate));
  }
  if (options?.endDate) {
    conditions.push(lte(partnerTransfers.createdAt, options.endDate));
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await db.select().from(partnerTransfers).where(whereClause);
  return summarizePartnerTransferRows(rows);
}

/**
 * Get monthly revenue breakdown for chart display
 */
export async function getMonthlyRevenueBreakdown(options?: {
  months?: number; // How many months back to show, default 12
}) {
  const db = await getDb();
  if (!db) return [];

  const monthsBack = options?.months || 12;
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - monthsBack);
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);

  const rows = await db.select().from(partnerTransfers)
    .where(gte(partnerTransfers.createdAt, startDate))
    .orderBy(partnerTransfers.createdAt);
  const rowsByMonth = new Map<string, PartnerTransfer[]>();
  const sourceMonth = new Map<string, string>();

  for (const row of rows) {
    const sourceKey = `${row.sourceType}:${row.sourceId || `row-${row.id}`}`;
    const month = sourceMonth.get(sourceKey) || row.createdAt.toISOString().slice(0, 7);
    sourceMonth.set(sourceKey, month);
    rowsByMonth.set(month, [...(rowsByMonth.get(month) || []), row]);
  }

  return Array.from(rowsByMonth.entries()).map(([month, monthRows]) => {
    const summary = summarizePartnerTransferRows(monthRows);
    return {
      month,
      totalRevenue: summary.totalRevenue,
      platformShare: summary.platformShare,
      partnerShare: summary.partnerOwed,
      partnerTransferred: summary.totalTransferred,
      transferCount: summary.completedCount,
      failedCount: summary.failedCount,
      outstanding: summary.partnerOutstanding,
    };
  });
}

/**
 * Get all transfers for CSV export (no pagination limit)
 */
export async function getPartnerTransfersForExport(options?: {
  sourceType?: TransferSourceType;
  status?: "pending" | "completed" | "failed";
  startDate?: Date;
  endDate?: Date;
}) {
  const conditions = [];

  if (options?.sourceType) {
    conditions.push(eq(partnerTransfers.sourceType, options.sourceType));
  }
  if (options?.status) {
    conditions.push(eq(partnerTransfers.status, options.status));
  }
  if (options?.startDate) {
    conditions.push(gte(partnerTransfers.createdAt, options.startDate));
  }
  if (options?.endDate) {
    conditions.push(lte(partnerTransfers.createdAt, options.endDate));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const db = await getDb();
  if (!db) return [];

  const transfers = await db
    .select()
    .from(partnerTransfers)
    .where(whereClause)
    .orderBy(desc(partnerTransfers.createdAt));

  return transfers;
}

// Export constants for use in tests and other modules
export const SPLIT_CONFIG = {
  partnerPercentage: PARTNER_SPLIT_PERCENTAGE,
  platformPercentage: PLATFORM_SPLIT_PERCENTAGE,
};
