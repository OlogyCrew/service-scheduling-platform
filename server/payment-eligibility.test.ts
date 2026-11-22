import { beforeEach, describe, expect, it, vi } from "vitest";

const stripeMocks = vi.hoisted(() => ({
  checkout: { sessions: { create: vi.fn() } },
}));
const promotionMocks = vi.hoisted(() => ({
  createPromotion: vi.fn(),
  updatePromotionStripeSession: vi.fn(),
}));
const providerMocks = vi.hoisted(() => ({ getProviderByUserId: vi.fn() }));
const velocityMocks = vi.hoisted(() => ({
  assertPaymentVelocityAllowed: vi.fn(),
  throwIfPaymentVelocityBlocked: vi.fn(),
}));

vi.mock("stripe", () => ({
  default: class StripeMock {
    checkout = stripeMocks.checkout;
  },
}));
vi.mock("./db/promotions", () => promotionMocks);
vi.mock("./db/providers", () => providerMocks);
vi.mock("./paymentVelocity", () => velocityMocks);

import {
  assertPaymentEligibilityOpen,
  getPaymentEligibilityDecision,
  paymentEligibilityMessages,
} from "./paymentEligibility";
import { promotionRouter } from "./promotionRouter";

function context() {
  return {
    user: {
      id: 501,
      openId: "gate-2-provider",
      name: "Gate 2 Provider",
      email: "provider@example.com",
      role: "provider",
      avatarUrl: null,
      isSuspended: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    req: { ip: "127.0.0.1", headers: {} },
    res: {},
  } as any;
}

const input = {
  tier: "quick_boost" as const,
  headline: "Gate 2 test promotion",
  description: "Must never reach a financial side effect while paused.",
  aiGenerated: false,
  origin: "https://ologycrew.test",
};

describe("centralized payment eligibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails closed for every new financial operation currently under containment", () => {
    for (const operation of [
      "provider_collection",
      "promotion_collection",
      "platform_subscription",
      "customer_subscription",
      "connect_onboarding",
      "provider_trial",
      "customer_trial",
    ] as const) {
      const decision = getPaymentEligibilityDecision(operation);
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe("platform_review");
      expect(decision.policyIds.length).toBeGreaterThan(0);
      expect(() => assertPaymentEligibilityOpen(operation)).toThrow();
    }
  });

  it("keeps the promotion pause message explainable and stable", () => {
    expect(getPaymentEligibilityDecision("promotion_collection")).toMatchObject({
      allowed: false,
      message: paymentEligibilityMessages.promotionPaused,
      policyIds: ["provider-promotion-pause-2026-11-22"],
    });
  });

  it("classifies non-collection paths without implicitly blocking them", () => {
    for (const operation of [
      "refund_or_cancellation",
      "transfer_or_partner_split",
      "webhook_reconciliation",
      "connect_balance_read",
      "offline_pay_at_location",
      "account_cleanup",
    ] as const) {
      expect(getPaymentEligibilityDecision(operation)).toMatchObject({
        operation,
        allowed: true,
        reason: "open",
      });
    }
  });
});

describe("promotion Checkout containment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    providerMocks.getProviderByUserId.mockResolvedValue({ id: 44, userId: 501 });
    velocityMocks.assertPaymentVelocityAllowed.mockResolvedValue({ allowed: true });
    promotionMocks.createPromotion.mockResolvedValue({ id: 99 });
    stripeMocks.checkout.sessions.create.mockResolvedValue({ id: "cs_should_not_exist", url: "" });
  });

  it("blocks before provider lookup, velocity, local promotion creation, and Stripe", async () => {
    await expect(promotionRouter.createCaller(context()).createCheckout(input))
      .rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: paymentEligibilityMessages.promotionPaused });

    expect(providerMocks.getProviderByUserId).not.toHaveBeenCalled();
    expect(velocityMocks.assertPaymentVelocityAllowed).not.toHaveBeenCalled();
    expect(velocityMocks.throwIfPaymentVelocityBlocked).not.toHaveBeenCalled();
    expect(promotionMocks.createPromotion).not.toHaveBeenCalled();
    expect(promotionMocks.updatePromotionStripeSession).not.toHaveBeenCalled();
    expect(stripeMocks.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("remains side-effect free under concurrent repeated attempts", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 50 }, () => promotionRouter.createCaller(context()).createCheckout(input)),
    );

    expect(results).toHaveLength(50);
    expect(results.every((result) => result.status === "rejected")).toBe(true);
    expect(providerMocks.getProviderByUserId).not.toHaveBeenCalled();
    expect(promotionMocks.createPromotion).not.toHaveBeenCalled();
    expect(stripeMocks.checkout.sessions.create).not.toHaveBeenCalled();
  });
});
