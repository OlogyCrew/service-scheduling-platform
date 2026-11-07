import { and, count, desc, eq, gt, gte, isNull, lte, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { paymentVelocityCounters } from "../../drizzle/schema";
import type { PaymentVelocityDimension } from "../paymentVelocity";
import { getDb } from "./connection";

export type PaymentVelocityMonitorStatus = "all" | "blocked" | "monitoring";
export type PaymentVelocityMonitorFilters = {
  startDate?: Date;
  endDate?: Date;
  dimension?: PaymentVelocityDimension;
  status?: PaymentVelocityMonitorStatus;
  rule?: `${PaymentVelocityDimension}_attempt_threshold`;
  page?: number;
  limit?: number;
};

const ruleToDimension = (rule?: PaymentVelocityMonitorFilters["rule"]) => rule?.replace(/_attempt_threshold$/, "") as PaymentVelocityDimension | undefined;

function buildConditions(filters: PaymentVelocityMonitorFilters, now: Date) {
  const conditions = [] as ReturnType<typeof eq>[];
  const ruleDimension = ruleToDimension(filters.rule);
  if (filters.dimension) conditions.push(eq(paymentVelocityCounters.dimension, filters.dimension));
  if (ruleDimension) conditions.push(eq(paymentVelocityCounters.dimension, ruleDimension));
  if (filters.startDate) conditions.push(gte(paymentVelocityCounters.lastAttemptAt, filters.startDate));
  if (filters.endDate) conditions.push(lte(paymentVelocityCounters.lastAttemptAt, filters.endDate));
  if (filters.status === "blocked") conditions.push(gt(paymentVelocityCounters.blockedUntil, now));
  if (filters.status === "monitoring") conditions.push(or(isNull(paymentVelocityCounters.blockedUntil), lte(paymentVelocityCounters.blockedUntil, now))!);
  return conditions;
}

export async function getPaymentVelocityCounters(filters: PaymentVelocityMonitorFilters = {}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0, page: 1, limit: 25, totalPages: 0 };
  const page = Math.max(1, Math.floor(filters.page || 1));
  const limit = Math.min(Math.max(Math.floor(filters.limit || 25), 1), 100);
  const now = new Date();
  const conditions = buildConditions(filters, now);
  const where = conditions.length ? and(...conditions) : undefined;
  const [items, [{ total }]] = await Promise.all([
    db.select().from(paymentVelocityCounters).where(where)
      .orderBy(desc(paymentVelocityCounters.lastAttemptAt), desc(paymentVelocityCounters.id))
      .limit(limit).offset((page - 1) * limit),
    db.select({ total: count() }).from(paymentVelocityCounters).where(where),
  ]);
  const numericTotal = Number(total || 0);
  return { items, total: numericTotal, page, limit, totalPages: Math.ceil(numericTotal / limit) };
}

export async function releasePaymentVelocityCooldown(input: {
  counterId: number;
  expectedUpdatedAt: Date;
  expectedBlockedUntil: Date;
}) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Database temporarily unavailable" });
  const now = new Date();
  const result = await db.update(paymentVelocityCounters)
    .set({ attemptCount: 0, blockedUntil: null })
    .where(and(
      eq(paymentVelocityCounters.id, input.counterId),
      eq(paymentVelocityCounters.updatedAt, input.expectedUpdatedAt),
      eq(paymentVelocityCounters.blockedUntil, input.expectedBlockedUntil),
      gt(paymentVelocityCounters.blockedUntil, now),
    ));
  if (!((result as any)[0]?.affectedRows ?? 0)) {
    throw new TRPCError({ code: "CONFLICT", message: "This restriction changed or is no longer active. Refresh the monitor and review the current state." });
  }
  return { releasedAt: now };
}
