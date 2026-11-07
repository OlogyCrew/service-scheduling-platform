import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const stripeCalls = {
  checkoutSessionCreate: vi.fn(),
  paymentIntentCreate: vi.fn(),
  chargeCreate: vi.fn(),
  transferCreate: vi.fn(),
  payoutCreate: vi.fn(),
};

vi.mock("stripe", () => ({
  default: class MockStripe {
    checkout = { sessions: { create: stripeCalls.checkoutSessionCreate } };
    paymentIntents = { create: stripeCalls.paymentIntentCreate };
    charges = { create: stripeCalls.chargeCreate };
    transfers = { create: stripeCalls.transferCreate };
    payouts = { create: stripeCalls.payoutCreate };
  },
}));

const read = (path: string) => readFileSync(path, "utf8");
const directAndQuote = read("server/routers/bookingRouter.ts");
const recurringAndMultiDay = read("server/routers/providerRouter.ts");
const offlineRouter = read("server/routers/offlinePaymentRouter.ts");

const forbiddenStripeSideEffects = [
  "checkout.sessions.create",
  "paymentIntents.create",
  "charges.create",
  "transfers.create",
  "payouts.create",
];

describe("Pay-at-Location mocked Stripe negative coverage", () => {
  it.each([
    ["direct and quote conversion", directAndQuote],
    ["recurring and multi-day booking", recurringAndMultiDay],
    ["offline settlement router", offlineRouter],
  ])("does not invoke Stripe for %s", (_path, source) => {
    for (const sideEffect of forbiddenStripeSideEffects) expect(source).not.toContain(sideEffect);
    expect(source).not.toContain("stripe.checkout");
    expect(source).not.toContain("stripe.paymentIntents");
    expect(source).not.toContain("stripe.transfers");
    expect(source).not.toContain("stripe.payouts");
  });

  it("keeps every mocked Stripe creation spy unused for the offline path contract", () => {
    expect(Object.values(stripeCalls).every((call) => call.mock.calls.length === 0)).toBe(true);
  });
});
