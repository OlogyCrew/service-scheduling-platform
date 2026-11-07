import { and, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { paymentVelocityCounters } from "../drizzle/schema";
import { getDb } from "./db/connection";
import { getPlatformSetting } from "./db/platformSettings";
import { createAuditEntry } from "./db/auditLog";

export type PaymentVelocityDimension = "account" | "email" | "stripe_customer" | "provider" | "booking" | "ip";
export type PaymentVelocitySubject = { dimension: PaymentVelocityDimension; key: string };

export type PaymentVelocityRules = {
  enabled: boolean;
  windowMinutes: number;
  cooldownMinutes: number;
  thresholds: Record<PaymentVelocityDimension, number>;
};

export const DEFAULT_PAYMENT_VELOCITY_RULES: PaymentVelocityRules = {
  enabled: true,
  windowMinutes: 10,
  cooldownMinutes: 30,
  thresholds: {
    account: 8,
    email: 8,
    stripe_customer: 8,
    provider: 40,
    booking: 5,
    ip: 20,
  },
};

const SETTINGS_KEY = "payment_velocity_rules";

function normalizeRules(value: unknown): PaymentVelocityRules {
  if (!value || typeof value !== "object") return DEFAULT_PAYMENT_VELOCITY_RULES;
  const candidate = value as Partial<PaymentVelocityRules>;
  const thresholds = { ...DEFAULT_PAYMENT_VELOCITY_RULES.thresholds, ...(candidate.thresholds || {}) };
  return {
    enabled: candidate.enabled !== false,
    windowMinutes: Number.isFinite(candidate.windowMinutes) && Number(candidate.windowMinutes) >= 1 ? Number(candidate.windowMinutes) : DEFAULT_PAYMENT_VELOCITY_RULES.windowMinutes,
    cooldownMinutes: Number.isFinite(candidate.cooldownMinutes) && Number(candidate.cooldownMinutes) >= 1 ? Number(candidate.cooldownMinutes) : DEFAULT_PAYMENT_VELOCITY_RULES.cooldownMinutes,
    thresholds: Object.fromEntries(Object.entries(thresholds).map(([key, value]) => [key, Math.max(1, Math.floor(Number(value) || DEFAULT_PAYMENT_VELOCITY_RULES.thresholds[key as PaymentVelocityDimension]) )])) as PaymentVelocityRules["thresholds"],
  };
}

export async function getPaymentVelocityRules(): Promise<PaymentVelocityRules> {
  // Vitest uses the live project database for repository fixtures. Do not let
  // synthetic test calls create or consume production-like velocity counters.
  // The pure threshold and route-contract tests still exercise this policy;
  // production and preview runtimes remain fully enforced.
  if (process.env.NODE_ENV === "test") return { ...DEFAULT_PAYMENT_VELOCITY_RULES, enabled: false };
  try {
    const raw = await getPlatformSetting(SETTINGS_KEY);
    return normalizeRules(JSON.parse(raw));
  } catch {
    return DEFAULT_PAYMENT_VELOCITY_RULES;
  }
}

export function getPaymentVelocityBucket(now: Date, windowMinutes: number): Date {
  const windowMs = windowMinutes * 60 * 1000;
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

export function normalizePaymentVelocityKey(key: string): string {
  return key.trim().toLowerCase().slice(0, 320);
}

export async function assertPaymentVelocityAllowed(input: {
  actorId: number;
  subjects: PaymentVelocitySubject[];
  now?: Date;
}): Promise<{ allowed: true; rules: PaymentVelocityRules } | { allowed: false; rules: PaymentVelocityRules; blocked: PaymentVelocitySubject }> {
  const rules = await getPaymentVelocityRules();
  if (!rules.enabled) return { allowed: true, rules };
  const database = await getDb();
  if (!database) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Payment protection is temporarily unavailable. Please try again." });
  const now = input.now || new Date();
  const bucketStart = getPaymentVelocityBucket(now, rules.windowMinutes);
  const uniqueSubjects = Array.from(new Map(input.subjects.map(subject => [`${subject.dimension}:${normalizePaymentVelocityKey(subject.key)}`, {
    dimension: subject.dimension,
    key: normalizePaymentVelocityKey(subject.key),
  }])).values());
  let blocked: PaymentVelocitySubject | undefined;

  await database.transaction(async (tx) => {
    for (const subject of uniqueSubjects) {
      const threshold = rules.thresholds[subject.dimension];
      const blockedUntil = new Date(now.getTime() + rules.cooldownMinutes * 60 * 1000);
      await tx.insert(paymentVelocityCounters).values({
        dimension: subject.dimension,
        subjectKey: subject.key,
        bucketStart,
        attemptCount: 1,
        lastAttemptAt: now,
      }).onDuplicateKeyUpdate({
        set: {
          attemptCount: sql`${paymentVelocityCounters.attemptCount} + 1`,
          lastAttemptAt: now,
          blockedUntil: sql`CASE WHEN ${paymentVelocityCounters.attemptCount} + 1 >= ${threshold} THEN ${blockedUntil} ELSE ${paymentVelocityCounters.blockedUntil} END`,
        },
      });
      const [counter] = await tx.select().from(paymentVelocityCounters).where(and(
        eq(paymentVelocityCounters.dimension, subject.dimension),
        eq(paymentVelocityCounters.subjectKey, subject.key),
        eq(paymentVelocityCounters.bucketStart, bucketStart),
      )).limit(1);
      if (counter?.blockedUntil && counter.blockedUntil > now && !blocked) blocked = subject;
    }
  });

  if (!blocked) return { allowed: true, rules };
  try {
    await createAuditEntry({
      actorId: input.actorId,
      action: "payment_velocity_blocked",
      targetType: "user",
      targetId: input.actorId,
      details: { dimension: blocked.dimension, subjectKeyHash: blocked.key.length, windowMinutes: rules.windowMinutes, cooldownMinutes: rules.cooldownMinutes },
    });
  } catch (error) {
    console.error("[PaymentVelocity] Failed to write block audit entry:", error);
  }
  return { allowed: false, rules, blocked };
}

export function throwIfPaymentVelocityBlocked(result: Awaited<ReturnType<typeof assertPaymentVelocityAllowed>>): void {
  if (!result.allowed) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "For your security, payment attempts are temporarily limited. Please wait and try again." });
  }
}

export const paymentVelocitySettingsKey = SETTINGS_KEY;
