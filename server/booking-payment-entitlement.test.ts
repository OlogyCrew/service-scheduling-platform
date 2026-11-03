import { beforeEach, describe, expect, it, vi } from "vitest";

const stripeMocks = vi.hoisted(() => ({
  checkout: { sessions: { create: vi.fn() } },
}));

const dbMocks = vi.hoisted(() => ({
  getBookingById: vi.fn(),
  getServiceById: vi.fn(),
  getProviderById: vi.fn(),
  getProviderTier: vi.fn(),
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
  },
}));

vi.mock("./db", () => dbMocks);
vi.mock("./db/referrals", () => referralMocks);

import { stripeRouter } from "./stripeRouter";

function ctx() {
  return {
    user: {
      id: 101,
      openId: "booking-customer",
      name: "Booking Customer",
      email: "customer@example.com",
      role: "customer",
      avatarUrl: null,
      isSuspended: false,
      createdAt: new Date(),
      updatedAt: new Date(),
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

const service = {
  id: 701,
  name: "Lifecycle Service",
  depositRequired: false,
};

describe("booking payment entitlement boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.getBookingById.mockResolvedValue(booking);
    dbMocks.getServiceById.mockResolvedValue(service);
    dbMocks.getProviderById.mockResolvedValue({
      id: 501,
      businessName: "Lifecycle Provider",
      isOfficial: false,
      isActive: true,
      stripeAccountId: "acct_provider",
      payoutEnabled: true,
    });
    dbMocks.getProviderTier.mockResolvedValue("basic");
    referralMocks.getReferralCreditBalance.mockResolvedValue("0.00");
    stripeMocks.checkout.sessions.create.mockResolvedValue({ id: "cs_booking", url: "https://checkout.stripe.test/session" });
  });

  it("denies Starter providers even when a retained Stripe account remains connected", async () => {
    dbMocks.getProviderTier.mockResolvedValue("free");

    await expect(stripeRouter.createCaller(ctx()).createCheckoutSession({ bookingId: booking.id }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(stripeMocks.checkout.sessions.create).not.toHaveBeenCalled();
    expect(referralMocks.spendReferralCredits).not.toHaveBeenCalled();
  });

  it("denies inactive providers before any Stripe or referral-credit mutation", async () => {
    dbMocks.getProviderById.mockResolvedValue({
      id: 501,
      businessName: "Contained Provider",
      isOfficial: false,
      isActive: false,
      stripeAccountId: "acct_provider",
      payoutEnabled: true,
    });

    await expect(stripeRouter.createCaller(ctx()).createCheckoutSession({ bookingId: booking.id }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(stripeMocks.checkout.sessions.create).not.toHaveBeenCalled();
    expect(referralMocks.spendReferralCredits).not.toHaveBeenCalled();
  });

  it("denies paid providers whose connected account is not payout-ready", async () => {
    dbMocks.getProviderById.mockResolvedValue({
      id: 501,
      businessName: "Lifecycle Provider",
      isOfficial: false,
      isActive: true,
      stripeAccountId: "acct_provider",
      payoutEnabled: false,
    });

    await expect(stripeRouter.createCaller(ctx()).createCheckoutSession({ bookingId: booking.id }))
      .rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

    expect(stripeMocks.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("creates every real charge as a destination payment to an entitled provider", async () => {
    const result = await stripeRouter.createCaller(ctx()).createCheckoutSession({ bookingId: booking.id });

    expect(stripeMocks.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({
      payment_intent_data: expect.objectContaining({
        application_fee_amount: 100,
        transfer_data: { destination: "acct_provider" },
      }),
    }));
    expect(result.url).toBe("https://checkout.stripe.test/session");
  });

  it("keeps the official demo bypass free and never creates a Stripe charge", async () => {
    dbMocks.getProviderById.mockResolvedValue({
      id: 501,
      businessName: "OlogyCrew Demo",
      isOfficial: true,
      isActive: true,
      stripeAccountId: null,
      payoutEnabled: false,
    });

    const result = await stripeRouter.createCaller(ctx()).createCheckoutSession({ bookingId: booking.id });

    expect(result).toMatchObject({ url: null, isDemo: true });
    expect(dbMocks.updateBookingStatus).toHaveBeenCalledWith(booking.id, "confirmed", expect.any(Object));
    expect(stripeMocks.checkout.sessions.create).not.toHaveBeenCalled();
  });
});
