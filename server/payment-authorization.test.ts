import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import {
  assertPaymentActorCanInitiate,
  assertProviderCanCollectPayments,
  assertProviderPaymentActor,
} from "./paymentAuthorization";

const customer = { id: 10, deletedAt: null, isSuspended: false };
const provider = {
  id: 20,
  userId: 11,
  isActive: true,
  deletedAt: null,
  isOfficial: false,
  stripeAccountId: "acct_provider",
  payoutEnabled: true,
};

function expectCode(action: () => void, code: string) {
  try {
    action();
    throw new Error("expected authorization to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(TRPCError);
    expect((error as TRPCError).code).toBe(code);
  }
}

describe("shared payment authorization", () => {
  it("denies suspended or deleted payment actors", () => {
    expectCode(() => assertPaymentActorCanInitiate({ ...customer, isSuspended: true }, "booking"), "FORBIDDEN");
    expectCode(() => assertPaymentActorCanInitiate({ ...customer, deletedAt: new Date() }, "invoice"), "FORBIDDEN");
  });

  it("requires provider ownership and active provider status", () => {
    expectCode(() => assertProviderPaymentActor(customer, provider), "FORBIDDEN");
    expectCode(() => assertProviderPaymentActor({ id: 11 }, { ...provider, isActive: false }), "FORBIDDEN");
  });

  it("requires a paid, payout-ready provider for marketplace collection", () => {
    assertProviderCanCollectPayments({ provider, tier: "basic", subscription: { status: "active" } });
    expectCode(() => assertProviderCanCollectPayments({ provider, tier: "free", subscription: { status: "active" } }), "FORBIDDEN");
    expectCode(() => assertProviderCanCollectPayments({ provider, tier: "basic", subscription: { status: "trialing" } }), "FORBIDDEN");
    expectCode(() => assertProviderCanCollectPayments({
      provider: { ...provider, payoutEnabled: false },
      ...tierArgs(),
    }), "PRECONDITION_FAILED");
  });

  it("preserves the official demo bypass", () => {
    assertProviderCanCollectPayments({
      provider: { ...provider, isOfficial: true, stripeAccountId: null, payoutEnabled: false },
      tier: "free",
      subscription: null,
    });
  });
});

function tierArgs() {
  return { tier: "basic" as const, subscription: { status: "active" } };
}
