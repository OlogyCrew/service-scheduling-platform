import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  bookings, offlineBookingPayments, providerPayAtLocationServices,
  providerPayAtLocationSettings, services, serviceProviders,
} from "../../drizzle/schema";
import { getDb } from "./connection";
import { insertAuditEntryInTransaction, type AuditAction, type TargetType } from "./auditLog";

export const OFFLINE_METHODS = ["cash", "bank_transfer", "mobile_money", "other"] as const;
export type OfflineMethod = typeof OFFLINE_METHODS[number];

export async function assertPayAtLocationEligible(providerId: number, serviceId: number) {
  const settings = await getProviderPayAtLocationSettings(providerId);
  if (!settings.enabled || !settings.serviceIds.includes(serviceId)) {
    throw new Error("Pay at Location is not available for this service.");
  }
  return settings;
}

export async function getProviderPayAtLocationSettings(providerId: number): Promise<{ providerId?: number; enabled: boolean; instructions: string | null; serviceIds: number[] }> {
  const db = await getDb(); if (!db) return { enabled: false, instructions: null, serviceIds: [] };
  const [settings] = await db.select().from(providerPayAtLocationSettings).where(eq(providerPayAtLocationSettings.providerId, providerId)).limit(1);
  const rows = await db.select({ serviceId: providerPayAtLocationServices.serviceId }).from(providerPayAtLocationServices).where(eq(providerPayAtLocationServices.providerId, providerId));
  return { ...(settings || { providerId, enabled: false, instructions: null }), serviceIds: rows.map(r => r.serviceId) };
}

export async function updateProviderPayAtLocationSettings(providerId: number, input: { enabled: boolean; instructions?: string | null; serviceIds: number[] }) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const valid = input.serviceIds.length ? await db.select({ id: services.id }).from(services).where(and(eq(services.providerId, providerId), inArray(services.id, input.serviceIds))) : [];
  if (valid.length !== input.serviceIds.length) throw new Error("One or more services do not belong to this provider.");
  await db.transaction(async (tx: any) => {
    await tx.insert(providerPayAtLocationSettings).values({ providerId, enabled: input.enabled, instructions: input.instructions?.trim() || null }).onDuplicateKeyUpdate({ set: { enabled: input.enabled, instructions: input.instructions?.trim() || null } });
    await tx.delete(providerPayAtLocationServices).where(eq(providerPayAtLocationServices.providerId, providerId));
    if (input.serviceIds.length) await tx.insert(providerPayAtLocationServices).values(input.serviceIds.map(serviceId => ({ providerId, serviceId })));
  });
  return getProviderPayAtLocationSettings(providerId);
}

export async function createOfflinePayment(bookingId: number, originalAmountDue: string) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const existing = await db.select().from(offlineBookingPayments).where(eq(offlineBookingPayments.bookingId, bookingId)).limit(1);
  if (!existing[0]) {
    try {
      await db.insert(offlineBookingPayments).values({ bookingId, paymentMethod: "pay_at_location", originalAmountDue, status: "due" });
    } catch (error) {
      // A retry racing the unique bookingId constraint is already satisfied.
      const afterRace = await db.select().from(offlineBookingPayments).where(eq(offlineBookingPayments.bookingId, bookingId)).limit(1);
      if (!afterRace[0]) throw error;
    }
  }
  return getOfflinePaymentForBooking(bookingId);
}
export async function getOfflinePaymentForBooking(bookingId: number) {
  const db = await getDb(); if (!db) return null;
  const [row] = await db.select({ payment: offlineBookingPayments, booking: bookings }).from(offlineBookingPayments).innerJoin(bookings, eq(offlineBookingPayments.bookingId, bookings.id)).where(eq(offlineBookingPayments.bookingId, bookingId)).limit(1);
  if (!row) return null;
  const [settings] = await db.select({ instructions: providerPayAtLocationSettings.instructions }).from(providerPayAtLocationSettings).where(eq(providerPayAtLocationSettings.providerId, row.booking.providerId)).limit(1);
  return { ...row.payment, providerInstructions: settings?.instructions || null };
}
export async function listOutstandingOfflinePayments(providerId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select({ payment: offlineBookingPayments, booking: bookings }).from(offlineBookingPayments).innerJoin(bookings, eq(offlineBookingPayments.bookingId, bookings.id)).where(and(eq(bookings.providerId, providerId), eq(offlineBookingPayments.status, "due"))).orderBy(desc(offlineBookingPayments.createdAt));
}
export async function transitionOfflinePayment(input: { bookingId: number; actorId: number; status: "paid" | "waived"; amount: string; method?: OfflineMethod; reason?: string; note?: string | null; auditAction?: AuditAction; auditTargetType?: TargetType; auditTargetId?: number }) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const amount = Number(input.amount); if (!Number.isFinite(amount) || amount < 0) throw new Error("Invalid amount.");
  await db.transaction(async (tx: any) => {
    const rows = await tx.select().from(offlineBookingPayments).where(eq(offlineBookingPayments.bookingId, input.bookingId)).limit(1);
    const row = rows[0]; if (!row) throw new Error("Offline payment not found.");
    if (row.status !== "due") throw new Error("Offline payment has already been settled.");
    if (amount.toFixed(2) !== Number(row.originalAmountDue).toFixed(2)) throw new Error("Full payment or full waiver is required.");
    if (input.status === "paid" && !input.method) throw new Error("Offline payment method is required.");
    if (input.status === "waived" && !input.reason?.trim()) throw new Error("A waiver reason is required.");
    const now = new Date();
    const set = input.status === "paid" ? { status: "paid", amountReceived: input.amount, offlinePaymentMethod: input.method, paidAt: now, confirmedByUserId: input.actorId, paymentNote: input.note || null } : { status: "waived", waiverAmount: input.amount, waiverReason: input.reason!.trim(), waivedAt: now, waivedByUserId: input.actorId };
    const result = await tx.update(offlineBookingPayments).set(set).where(and(eq(offlineBookingPayments.bookingId, input.bookingId), eq(offlineBookingPayments.status, "due")));
    if (!((result as any)[0]?.affectedRows ?? 0)) throw new Error("Offline payment has already been settled.");
    if (!input.auditAction || !input.auditTargetType || input.auditTargetId === undefined) throw new Error("Offline payment audit context is required.");
    await insertAuditEntryInTransaction(tx, {
      actorId: input.actorId,
      action: input.auditAction,
      targetType: input.auditTargetType,
      targetId: input.auditTargetId,
      details: input.status === "paid"
        ? { originalAmountDue: row.originalAmountDue, amountReceived: input.amount, resultingStatus: "paid", offlinePaymentMethod: input.method, paymentNote: input.note || null, confirmedAt: now.toISOString(), confirmingActorId: input.actorId }
        : { originalAmountDue: row.originalAmountDue, waiverAmount: input.amount, waiverReason: input.reason!.trim(), resultingStatus: "waived", waivedAt: now.toISOString(), authorizingActorId: input.actorId },
    });
  });
  return getOfflinePaymentForBooking(input.bookingId);
}
