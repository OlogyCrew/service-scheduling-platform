import { beforeEach, describe, expect, it, vi } from "vitest";

const stripeMocks = vi.hoisted(() => ({
  checkout: { sessions: { create: vi.fn() } },
  customers: { create: vi.fn() },
}));

const dbMocks = vi.hoisted(() => ({
  getBookingById: vi.fn(),
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
    dbMocks.getPaymentByBookingId.mockResolvedValue(null);
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
    dbMocks.getProviderSubscription.mockResolvedValue({ tier: "basic", status: "active" });
    dbMocks.getUserById.mockResolvedValue({ stripeCustomerId: "cus_booking_customer" });
    dbMocks.getCustomerSubscription.mockResolvedValue(null);
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

  it("denies trialing providers before any Stripe or referral-credit mutation", async () => {
    dbMocks.getProviderSubscription.mockResolvedValue({
      tier: "basic",
      status: "trialing",
      trialEndsAt: new Date(Date.now() + 86_400_000),
    });

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
      customer: "cus_booking_customer",
      billing_address_collection: "required",
      customer_update: { name: "auto", address: "auto" },
      payment_intent_data: expect.objectContaining({
        application_fee_amount: 100,
        transfer_data: { destination: "acct_provider" },
      }),
    }), expect.objectContaining({ idempotencyKey: expect.stringContaining("ologycrew-booking-9001-full") }));
    expect(result.url).toBe("https://checkout.stripe.test/session");
  });

  it("creates and persists a Stripe Customer when the user has none yet", async () => {
    dbMocks.getUserById.mockResolvedValue({ stripeCustomerId: null });
    stripeMocks.customers.create.mockResolvedValue({ id: "cus_new_booking_customer" });

    await stripeRouter.createCaller(ctx()).createCheckoutSession({ bookingId: booking.id });

    expect(stripeMocks.customers.create).toHaveBeenCalledWith(expect.objectContaining({
      email: "customer@example.com",
      name: "Booking Customer",
      metadata: { userId: "101", type: "customer" },
    }), { idempotencyKey: "ologycrew-customer-101" });
    expect(dbMocks.updateUserStripeCustomerId).toHaveBeenCalledWith(101, "cus_new_booking_customer");
    expect(stripeMocks.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({ customer: "cus_new_booking_customer" }), expect.any(Object));
  });

  it("uses the same idempotency keys when first-time payment requests race", async () => {
    dbMocks.getUserById.mockResolvedValue({ stripeCustomerId: null });
    stripeMocks.customers.create.mockResolvedValue({ id: "cus_race_safe" });

    await Promise.all(Array.from({ length: 50 }, () =>
      stripeRouter.createCaller(ctx()).createCheckoutSession({ bookingId: booking.id })
    ));

    expect(stripeMocks.customers.create).toHaveBeenCalledTimes(50);
    expect(stripeMocks.customers.create.mock.calls.map(([, options]) => options.idempotencyKey))
      .toEqual(Array(50).fill("ologycrew-customer-101"));
    expect(stripeMocks.checkout.sessions.create).toHaveBeenCalledTimes(50);
    expect(stripeMocks.checkout.sessions.create.mock.calls.map(([, options]) => options.idempotencyKey))
      .toEqual(Array(50).fill("ologycrew-booking-9001-full-10000-0.00"));
  });

  it("does not create a second Stripe checkout after the same payment was captured", async () => {
    dbMocks.getPaymentByBookingId.mockResolvedValue({ status: "captured", paymentType: "full" });

    await expect(stripeRouter.createCaller(ctx()).createCheckoutSession({ bookingId: booking.id }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(stripeMocks.checkout.sessions.create).not.toHaveBeenCalled();
    expect(referralMocks.spendReferralCredits).not.toHaveBeenCalled();
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
