import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import { getDb } from "./db/connection";
import { createService } from "./db/services";
import { createServiceProvider } from "./db/providers";
import { createBookingSessions, createSingleSession, rescheduleSession, updateBookingStatus } from "./db";
import { auditLog, bookingSessions, bookings, offlineBookingPayments, providerPayAtLocationServices, providerPayAtLocationSettings, serviceProviders, services, users } from "../drizzle/schema";

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const customerOpenId = `stage4-remediation-customer-${suffix}`;
const providerOpenId = `stage4-remediation-provider-${suffix}`;
let customerId = 0;
let providerUserId = 0;
let providerId = 0;
let serviceId = 0;
const createdBookingIds: number[] = [];

function context(user: any): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: { origin: "https://test.example.com" } } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
  };
}

async function createFixtureBooking(input: {
  kind: "direct" | "quote" | "recurring" | "multi_day";
  amount: string;
  bookingDate: string;
  quoteRequestId?: number;
}) {
  const id = await db.createBooking({
    bookingNumber: `OC-STAGE4-${suffix}-${createdBookingIds.length}`,
    customerId,
    providerId,
    serviceId,
    bookingDate: input.bookingDate,
    startTime: "10:00",
    endTime: "11:00",
    durationMinutes: 60,
    status: "pending",
    bookingType: input.kind === "direct" || input.kind === "quote" ? "single" : input.kind,
    endDate: input.kind === "multi_day" ? "2026-12-12" : null,
    totalDays: input.kind === "multi_day" ? 3 : 1,
    recurrenceFrequency: input.kind === "recurring" ? "weekly" : null,
    recurrenceDaysOfWeek: input.kind === "recurring" ? "[1]" : null,
    recurrenceTotalWeeks: input.kind === "recurring" ? 3 : null,
    recurrenceTotalSessions: input.kind === "recurring" ? 3 : null,
    locationType: "fixed_location",
    subtotal: input.amount,
    platformFee: "0.00",
    totalAmount: input.amount,
    depositAmount: "0.00",
    remainingAmount: input.amount,
    bookingSource: input.kind === "quote" ? "quote" : "direct",
    quoteRequestId: input.quoteRequestId ?? null,
  });
  createdBookingIds.push(id);
  await db.createOfflinePayment(id, input.amount);
  return id;
}

describe("Stage 4 real-database lifecycle and financial-integrity coverage", () => {
  beforeAll(async () => {
    await db.upsertUser({ openId: customerOpenId, name: "Stage 4 Test Customer", email: `${customerOpenId}@test.com`, loginMethod: "test", role: "customer", emailVerified: true });
    await db.upsertUser({ openId: providerOpenId, name: "Stage 4 Test Provider", email: `${providerOpenId}@test.com`, loginMethod: "test", role: "provider", emailVerified: true });
    const customer = await db.getUserByOpenId(customerOpenId);
    const providerUser = await db.getUserByOpenId(providerOpenId);
    if (!customer || !providerUser) throw new Error("Stage 4 fixture users were not created");
    customerId = customer.id;
    providerUserId = providerUser.id;
    await createServiceProvider({ userId: providerUserId, businessName: `Stage 4 Test Business ${suffix}`, businessType: "llc", profileSlug: `stage4-${suffix}`, isActive: true });
    const provider = await db.getProviderByUserId(providerUserId);
    if (!provider) throw new Error("Stage 4 fixture provider was not created");
    providerId = provider.id;
    const created = await createService({ providerId, categoryId: 7, name: `Stage 4 Test Service ${suffix}`, serviceType: "fixed_location", pricingModel: "fixed", basePrice: "100.00", durationMinutes: 60, minAdvanceBookingHours: 0, maxAdvanceBookingDays: 36500, isActive: true });
    serviceId = Number((created as any)[0]?.insertId ?? (created as any).insertId);
    if (!serviceId) throw new Error("Stage 4 fixture service was not created");
    await db.updateProviderPayAtLocationSettings(providerId, { enabled: true, instructions: "Pay the provider at the appointment.", serviceIds: [serviceId] });
  });

  afterAll(async () => {
    const connection = await getDb();
    if (!connection) return;
    if (createdBookingIds.length) {
      await connection.delete(auditLog).where(andAuditActor(customerId, providerUserId));
      await connection.delete(bookingSessions).where(inArray(bookingSessions.bookingId, createdBookingIds));
      await connection.delete(offlineBookingPayments).where(inArray(offlineBookingPayments.bookingId, createdBookingIds));
      await connection.delete(bookings).where(inArray(bookings.id, createdBookingIds));
    }
    if (providerId) {
      await connection.delete(providerPayAtLocationServices).where(eq(providerPayAtLocationServices.providerId, providerId));
      await connection.delete(providerPayAtLocationSettings).where(eq(providerPayAtLocationSettings.providerId, providerId));
    }
    if (serviceId) await connection.delete(services).where(eq(services.id, serviceId));
    if (providerId) await connection.delete(serviceProviders).where(eq(serviceProviders.id, providerId));
    await connection.delete(users).where(inArray(users.openId, [customerOpenId, providerOpenId]));
  });

  it("creates one obligation per direct, quote, recurring, and multi-day aggregate booking", async () => {
    const direct = await createFixtureBooking({ kind: "direct", amount: "101.00", bookingDate: "2026-12-01" });
    const quote = await createFixtureBooking({ kind: "quote", amount: "202.00", bookingDate: "2026-12-02", quoteRequestId: 991001 });
    const recurring = await createFixtureBooking({ kind: "recurring", amount: "303.00", bookingDate: "2026-12-03" });
    const multiDay = await createFixtureBooking({ kind: "multi_day", amount: "404.00", bookingDate: "2026-12-10" });
    await createBookingSessions([
      { bookingId: recurring, sessionDate: "2026-12-03", startTime: "10:00", endTime: "11:00", sessionNumber: 1, status: "scheduled" },
      { bookingId: recurring, sessionDate: "2026-12-10", startTime: "10:00", endTime: "11:00", sessionNumber: 2, status: "scheduled" },
      { bookingId: multiDay, sessionDate: "2026-12-10", startTime: "10:00", endTime: "11:00", sessionNumber: 1, status: "scheduled" },
      { bookingId: multiDay, sessionDate: "2026-12-11", startTime: "10:00", endTime: "11:00", sessionNumber: 2, status: "scheduled" },
      { bookingId: multiDay, sessionDate: "2026-12-12", startTime: "10:00", endTime: "11:00", sessionNumber: 3, status: "scheduled" },
    ]);
    const connection = await getDb();
    if (!connection) throw new Error("Database unavailable");
    const rows = await connection.select().from(offlineBookingPayments).where(inArray(offlineBookingPayments.bookingId, [direct, quote, recurring, multiDay]));
    expect(rows).toHaveLength(4);
    expect(rows.map((row) => row.originalAmountDue).sort()).toEqual(["101.00", "202.00", "303.00", "404.00"]);
  });

  it("preserves the obligation across cancellation and session rescheduling", async () => {
    const bookingId = createdBookingIds[3];
    await updateBookingStatus(bookingId, "cancelled", { cancelledBy: "provider", cancellationReason: "Provider unavailable" });
    const oldSession = await createSingleSession({ bookingId, sessionDate: "2026-12-15", startTime: "10:00", endTime: "11:00", sessionNumber: 4, status: "scheduled" });
    const newSession = await createSingleSession({ bookingId, sessionDate: "2026-12-16", startTime: "10:00", endTime: "11:00", sessionNumber: 4, status: "scheduled" });
    await rescheduleSession(oldSession, newSession, "2026-12-15");
    const payment = await db.getOfflinePaymentForBooking(bookingId);
    expect(payment?.status).toBe("due");
    expect(payment?.originalAmountDue).toBe("404.00");
  });

  it("allows customer status viewing but rejects customer self-confirmation and requires provider authorization", async () => {
    const bookingId = createdBookingIds[0];
    const customer = await db.getUserByOpenId(customerOpenId);
    const providerUser = await db.getUserByOpenId(providerOpenId);
    if (!customer || !providerUser) throw new Error("Fixture users missing");
    const customerCaller = appRouter.createCaller(context(customer));
    const providerCaller = appRouter.createCaller(context(providerUser));
    await expect(customerCaller.offlinePayment.getForBooking({ bookingId })).resolves.toMatchObject({ status: "due", originalAmountDue: "101.00" });
    await expect(customerCaller.offlinePayment.confirmPayment({ bookingId, amountReceived: "101.00", offlinePaymentMethod: "cash" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(providerCaller.offlinePayment.confirmPayment({ bookingId, amountReceived: "101.00", offlinePaymentMethod: "cash", paymentNote: "Received at appointment" })).resolves.toMatchObject({ status: "paid", amountReceived: "101.00" });
    await expect(providerCaller.offlinePayment.confirmPayment({ bookingId, amountReceived: "101.00", offlinePaymentMethod: "cash" })).rejects.toThrow("already been settled");
  });

  it("records a complete waiver and preserves history after settings are disabled", async () => {
    const bookingId = createdBookingIds[1];
    const providerUser = await db.getUserByOpenId(providerOpenId);
    if (!providerUser) throw new Error("Provider fixture missing");
    const providerCaller = appRouter.createCaller(context(providerUser));
    await expect(providerCaller.offlinePayment.waivePayment({ bookingId, waiverAmount: "202.00", waiverReason: "Approved service recovery waiver" })).resolves.toMatchObject({ status: "waived", waiverAmount: "202.00", waiverReason: "Approved service recovery waiver" });
    await providerCaller.offlinePayment.updateProviderSettings({ enabled: false, instructions: null, serviceIds: [] });
    const connection = await getDb();
    if (!connection) throw new Error("Database unavailable");
    const [payment] = await connection.select().from(offlineBookingPayments).where(eq(offlineBookingPayments.bookingId, bookingId)).limit(1);
    const waiverAudits = await connection.select().from(auditLog).where(and(eq(auditLog.actorId, providerUser.id), eq(auditLog.action, "waive_pay_at_location_payment"))).orderBy(auditLog.createdAt);
    const settings = await db.getProviderPayAtLocationSettings(providerId);
    expect(payment.status).toBe("waived");
    expect(payment.waiverReason).toBe("Approved service recovery waiver");
    expect(waiverAudits.some((entry) => entry.targetId === bookingId && String(entry.details).includes("Approved service recovery waiver") && String(entry.details).includes("202.00") && String(entry.details).includes("waived"))).toBe(true);
    expect(settings.enabled).toBe(false);
    expect(settings.serviceIds).toEqual([]);
  });
});

function andAuditActor(first: number, second: number) {
  return inArray(auditLog.actorId, [first, second]);
}
