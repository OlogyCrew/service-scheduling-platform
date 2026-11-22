import { beforeEach, describe, expect, it, vi } from "vitest";

const stripeMocks = vi.hoisted(() => ({
  checkout: { sessions: { create: vi.fn() } },
  customers: { create: vi.fn() },
}));

const dbMocks = vi.hoisted(() => ({
  getBookingById: vi.fn(),
  getOfflinePaymentForBooking: vi.fn(),
  getPaymentByBookingId: vi.fn(),
  getServiceById: vi.fn(),
  getProviderById: vi.fn(),
  getProviderTier: vi.fn(),
  getProviderSubscription: vi.fn(),
  getUserById: vi.fn(),
  getCustomerSubscription: vi.fn(),
  updateUserStripeCustomerId: vi.fn(),
  updateBookingStatus: vi.fn(),
  createNotification: vi.fn(),
}));

const referralMocks = vi.hoisted(() => ({
  getReferralCreditBalance: vi.fn(),
  spendReferralCredits: vi.fn(),
}));

vi.mock("stripe", () => ({
  default: class StripeMock {
    checkout = stripeMocks.checkout;
    customers = stripeMocks.customers;
  },
}));

vi.mock("./db", () => dbMocks);
vi.mock("./db/referrals", () => referralMocks);
// This test isolates the route ordering. It bypasses only the outer global
// collection pause so the offline-ledger guard itself can be exercised.
vi.mock("./providerPaymentPause", async () => {
  const { protectedProcedure } = await import("./_core/trpc");
  return { providerPaymentProcedure: protectedProcedure };
});

import { stripeRouter } from "./stripeRouter";

function ctx() {
  return {
    user: {
      id: 101,
      openId: "offline-route-customer",
      name: "Offline Route Customer",
      email: "offline@example.com",
      role: "customer",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { headers: { origin: "https://ologycrew.test" } },
    res: {},
  } as any;
}

const booking = {
  id: 9001,
  customerId: 101,
  providerId: 501,
  serviceId: 701,
  bookingNumber: "BK-9001",
  totalAmount: "100.00",
  depositAmount: null,
};

describe("server-side offline obligation exclusion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.getBookingById.mockResolvedValue(booking);
    dbMocks.getOfflinePaymentForBooking.mockResolvedValue({
      bookingId: booking.id,
      status: "due",
      originalAmountDue: "100.00",
      paymentMethod: "pay_at_location",
    });
    dbMocks.getPaymentByBookingId.mockResolvedValue(null);
    dbMocks.getServiceById.mockResolvedValue({ id: 701, name: "Offline Service", depositRequired: false });
    dbMocks.getProviderById.mockResolvedValue({ id: 501, isOfficial: false, isActive: true, stripeAccountId: "acct_provider", payoutEnabled: true });
    dbMocks.getProviderTier.mockResolvedValue("basic");
    dbMocks.getProviderSubscription.mockResolvedValue({ tier: "basic", status: "active" });
    dbMocks.getUserById.mockResolvedValue({ stripeCustomerId: "cus_customer" });
    dbMocks.getCustomerSubscription.mockResolvedValue(null);
    referralMocks.getReferralCreditBalance.mockResolvedValue("50.00");
  });

  it("rejects Checkout before provider lookup, credits, velocity, customer creation, or Stripe", async () => {
    await expect(stripeRouter.createCaller(ctx()).createCheckoutSession({ bookingId: booking.id, useCredits: true }))
      .rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
        message: "This booking uses Pay at Location and cannot be paid online.",
      });

    expect(dbMocks.getOfflinePaymentForBooking).toHaveBeenCalledWith(booking.id);
    expect(dbMocks.getProviderById).not.toHaveBeenCalled();
    expect(referralMocks.getReferralCreditBalance).not.toHaveBeenCalled();
    expect(referralMocks.spendReferralCredits).not.toHaveBeenCalled();
    expect(stripeMocks.customers.create).not.toHaveBeenCalled();
    expect(stripeMocks.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("returns a non-payable preview without reading or spending referral credit", async () => {
    const result = await stripeRouter.createCaller(ctx()).previewCreditDiscount({ bookingId: booking.id });

    expect(result).toEqual({
      creditBalance: "0.00",
      applicableCredit: "0.00",
      finalAmount: "0.00",
      originalAmount: "0.00",
      coversFullAmount: false,
    });
    expect(referralMocks.getReferralCreditBalance).not.toHaveBeenCalled();
  });
});
