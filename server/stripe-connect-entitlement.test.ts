import { beforeEach, describe, expect, it, vi } from "vitest";

const stripeMocks = vi.hoisted(() => ({
  accounts: {
    retrieve: vi.fn(),
    create: vi.fn(),
    createLoginLink: vi.fn(),
  },
  accountLinks: { create: vi.fn() },
  balance: { retrieve: vi.fn() },
}));

const dbMocks = vi.hoisted(() => ({
  getProviderByUserId: vi.fn(),
  getProviderTier: vi.fn(),
  updateProviderStripeAccount: vi.fn(),
}));

vi.mock("stripe", () => ({
  default: class StripeMock {
    accounts = stripeMocks.accounts;
    accountLinks = stripeMocks.accountLinks;
    balance = stripeMocks.balance;
  },
}));
vi.mock("./db", () => dbMocks);

import { stripeConnectRouter } from "./stripeConnectRouter";

const context = {
  user: {
    id: 101,
    email: "provider@example.com",
    name: "Provider",
    role: "provider",
  },
  req: { headers: { origin: "https://ologycrew.test" } },
  res: {},
} as any;

describe("Stripe Connect effective payment entitlement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.getProviderByUserId.mockResolvedValue({
      id: 501,
      businessType: "llc",
      stripeAccountId: "acct_retained",
      stripeAccountStatus: "active",
      stripeOnboardingComplete: true,
      payoutEnabled: true,
    });
    dbMocks.getProviderTier.mockResolvedValue("basic");
    stripeMocks.accounts.retrieve.mockResolvedValue({
      charges_enabled: true,
      payouts_enabled: true,
      details_submitted: true,
    });
    stripeMocks.accounts.createLoginLink.mockResolvedValue({ url: "https://stripe.test/dashboard" });
  });

  it("reports a retained account as connected but payment collection disabled on Starter", async () => {
    dbMocks.getProviderTier.mockResolvedValue("free");

    const result = await stripeConnectRouter.createCaller(context).getStatus();

    expect(result).toMatchObject({
      connected: true,
      chargesEnabled: false,
      payoutsEnabled: false,
      paymentCollectionEnabled: false,
      requiresPaidPlan: true,
    });
  });

  it("reports payment collection enabled only when paid entitlement and Stripe readiness are both true", async () => {
    const result = await stripeConnectRouter.createCaller(context).getStatus();

    expect(result).toMatchObject({ paymentCollectionEnabled: false, requiresPaidPlan: false });
  });

  it("blocks resumed onboarding on Starter without deleting the retained account", async () => {
    dbMocks.getProviderTier.mockResolvedValue("free");

    await expect(stripeConnectRouter.createCaller(context).getOnboardingLink({ origin: "https://ologycrew.test" }))
      .rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

    expect(stripeMocks.accountLinks.create).not.toHaveBeenCalled();
    expect(dbMocks.updateProviderStripeAccount).not.toHaveBeenCalled();
  });

  it("blocks Stripe dashboard access while Stripe account setup is paused", async () => {
    dbMocks.getProviderTier.mockResolvedValue("free");

    await expect(stripeConnectRouter.createCaller(context).getDashboardLink())
      .rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(stripeMocks.accounts.createLoginLink).not.toHaveBeenCalled();
  });
});
