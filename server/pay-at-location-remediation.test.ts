import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const auditInsert = vi.hoisted(() => vi.fn());
const getDb = vi.hoisted(() => vi.fn());
vi.mock("./db/connection", () => ({ getDb }));
vi.mock("./db/auditLog", () => ({ insertAuditEntryInTransaction: auditInsert }));

const read = (path: string) => readFileSync(path, "utf8");
const offline = read("server/db/offlinePayments.ts");
const router = read("server/routers/offlinePaymentRouter.ts");
const booking = read("server/routers/bookingRouter.ts");
const provider = read("server/routers/providerRouter.ts");
const webhook = read("server/stripeWebhook.ts");
const note = read("docs/ologycrew-stage4-pay-at-location-implementation-note-2026-11-07.md");

function transactionalDb(options?: { auditFails?: boolean }) {
  const payment = {
    bookingId: 990001,
    originalAmountDue: "125.00",
    status: "due",
    amountReceived: null,
    waiverReason: null,
  };
  let committed = false;
  let rolledBack = false;
  const tx = {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([payment]) })) })) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue([{ affectedRows: 1 }]) })) })),
  };
  const db = {
    transaction: vi.fn(async (callback: (tx: typeof tx) => Promise<unknown>) => {
      try {
        const result = await callback(tx);
        committed = true;
        return result;
      } catch (error) {
        rolledBack = true;
        throw error;
      }
    }),
    select: vi.fn(() => {
      const chain: any = {};
      chain.from = vi.fn(() => chain);
      chain.innerJoin = vi.fn(() => chain);
      chain.where = vi.fn(() => chain);
      chain.limit = vi.fn().mockResolvedValue([{ payment, booking: { providerId: 771 } }]);
      return chain;
    }),
  };
  auditInsert.mockImplementation(async () => {
    if (options?.auditFails) throw new Error("simulated audit failure");
  });
  return { db, payment, tx, state: () => ({ committed, rolledBack }) };
}

describe("Stage 4 deployment-remediation contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("settles and audits in the same transaction with complete waiver evidence", () => {
    expect(offline).toContain("db.transaction(async (tx: any) =>");
    expect(offline).toContain("await insertAuditEntryInTransaction(tx");
    expect(offline).toContain("originalAmountDue: row.originalAmountDue");
    expect(offline).toContain("resultingStatus: \"waived\"");
    expect(offline).toContain("waiverReason: input.reason!.trim()");
    expect(offline).toContain("authorizingActorId: input.actorId");
    expect(router).toContain('auditAction: "confirm_pay_at_location_payment"');
    expect(router).toContain('auditAction: "waive_pay_at_location_payment"');
  });

  it("rolls back the settlement when the audit insert fails", async () => {
    const fixture = transactionalDb({ auditFails: true });
    getDb.mockResolvedValue(fixture.db);
    const { transitionOfflinePayment } = await import("./db/offlinePayments");

    await expect(transitionOfflinePayment({
      bookingId: 990001,
      actorId: 990002,
      status: "waived",
      amount: "125.00",
      reason: "Approved hardship waiver",
      auditAction: "waive_pay_at_location_payment",
      auditTargetType: "booking",
      auditTargetId: 990001,
    })).rejects.toThrow("simulated audit failure");

    expect(fixture.db.transaction).toHaveBeenCalledTimes(1);
    expect(fixture.state()).toEqual({ committed: false, rolledBack: true });
  });

  it("commits the settlement only after the complete audit insert succeeds", async () => {
    const fixture = transactionalDb();
    getDb.mockResolvedValue(fixture.db);
    const { transitionOfflinePayment } = await import("./db/offlinePayments");

    await transitionOfflinePayment({
      bookingId: 990001,
      actorId: 990002,
      status: "paid",
      amount: "125.00",
      method: "bank_transfer",
      auditAction: "confirm_pay_at_location_payment",
      auditTargetType: "booking",
      auditTargetId: 990001,
    });

    expect(auditInsert).toHaveBeenCalledWith(fixture.tx, expect.objectContaining({
      action: "confirm_pay_at_location_payment",
      details: expect.objectContaining({ originalAmountDue: "125.00", resultingStatus: "paid", offlinePaymentMethod: "bank_transfer", confirmingActorId: 990002 }),
    }));
    expect(fixture.state()).toEqual({ committed: true, rolledBack: false });
  });

  it("keeps all booking lifecycle paths database-obligation-safe and webhook-isolated", () => {
    for (const source of [booking, provider]) {
      expect(source).toContain('paymentMethod: z.enum(["online", "pay_at_location"]).default("online")');
      expect(source).toContain("createOfflinePayment(bookingId, totalAmount)");
      expect(source).not.toContain("checkout.sessions.create");
      expect(source).not.toContain("paymentIntents.create");
    }
    expect(booking).toContain("createMultiDay");
    expect(booking).toContain("createRecurring");
    expect(booking).toContain("updateBookingStatus");
    expect(booking).toContain("resched");
    expect(webhook).not.toContain("offlineBookingPayments");
    expect(webhook).not.toContain("offline_booking_payments");
    expect(note).toContain("Disabled settings do not delete or rewrite existing ledger/history rows");
  });

  it("keeps customer mutations restricted and waiver/confirmation duplicate-safe", () => {
    expect(router).toContain("mutate ? (!ownsProvider && !admin)");
    expect(offline).toContain("A waiver reason is required");
    expect(offline).toContain('eq(offlineBookingPayments.status, "due")');
    expect(offline).toContain("Offline payment has already been settled");
  });
});
