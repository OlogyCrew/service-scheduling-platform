import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  claim: vi.fn(),
  markProcessed: vi.fn(),
  markFailed: vi.fn(),
}));

vi.mock("stripe", () => ({
  default: class MockStripe {
    webhooks = { constructEvent: mocks.constructEvent };
    transfers = { create: vi.fn() };
  },
}));

vi.mock("./db/stripeWebhookEvents", () => ({
  claimStripeWebhookEvent: mocks.claim,
  markStripeWebhookEventProcessed: mocks.markProcessed,
  markStripeWebhookEventFailed: mocks.markFailed,
}));

import { handleStripeWebhook } from "./stripeWebhook";

function response() {
  return {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as any;
}

describe("Stripe webhook signature boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a request without stripe-signature before Stripe or the event ledger", async () => {
    const res = response();
    await handleStripeWebhook({ headers: {}, body: Buffer.from("{}") } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("Missing stripe-signature header");
    expect(mocks.constructEvent).not.toHaveBeenCalled();
    expect(mocks.claim).not.toHaveBeenCalled();
  });

  it("rejects an invalid signature before ledger claims or financial handlers", async () => {
    mocks.constructEvent.mockImplementation(() => {
      throw new Error("No signatures found matching the expected signature for payload");
    });
    const res = response();

    await handleStripeWebhook({
      headers: { "stripe-signature": "invalid" },
      body: Buffer.from('{"id":"evt_bad"}'),
    } as any, res);

    expect(mocks.constructEvent).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining("Webhook Error"));
    expect(mocks.claim).not.toHaveBeenCalled();
  });

  it("acknowledges an authenticated verification event without claiming or mutating a ledger row", async () => {
    mocks.constructEvent.mockReturnValue({
      id: "evt_test_signature_boundary",
      type: "payment_intent.succeeded",
      livemode: false,
      data: { object: { id: "pi_test" } },
    });
    const res = response();

    await handleStripeWebhook({
      headers: { "stripe-signature": "t=1,v1=valid" },
      body: Buffer.from('{"id":"evt_test_signature_boundary"}'),
    } as any, res);

    expect(mocks.constructEvent).toHaveBeenCalledWith(
      expect.any(Buffer),
      "t=1,v1=valid",
      expect.any(String),
    );
    expect(res.json).toHaveBeenCalledWith({ verified: true });
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.markProcessed).not.toHaveBeenCalled();
  });
});
