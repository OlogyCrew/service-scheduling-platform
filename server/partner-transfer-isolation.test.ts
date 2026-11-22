import { beforeEach, describe, expect, it, vi } from "vitest";

const stripeCreate = vi.fn();
const dbInsertValues = vi.fn();

vi.mock("stripe", () => ({
  default: class MockStripe {
    transfers = { create: stripeCreate };
  },
}));

vi.mock("./db/connection", () => ({
  getDb: vi.fn(async () => ({
    insert: () => ({ values: dbInsertValues }),
  })),
}));

describe("partner transfer isolation and idempotency", () => {
  beforeEach(() => {
    stripeCreate.mockReset();
    stripeCreate.mockResolvedValue({ id: "tr_test_123" });
    dbInsertValues.mockReset();
    dbInsertValues.mockResolvedValue(undefined);
  });

  it("rejects Pay-at-Location and unknown source types before Stripe or ledger writes", async () => {
    const { executePartnerTransfer } = await import("./partnerSplit");

    const offline = await executePartnerTransfer({
      totalRevenue: 100,
      sourceType: "offline_pay_at_location" as never,
      sourceId: "offline-obligation-1",
      sourceDescription: "cash booking",
    });
    const unknown = await executePartnerTransfer({
      totalRevenue: 100,
      sourceType: "untrusted_source" as never,
      sourceId: "attacker-controlled",
      sourceDescription: "unknown",
    });

    expect(offline).toEqual({ success: false, error: "Unsupported transfer source type" });
    expect(unknown).toEqual({ success: false, error: "Unsupported transfer source type" });
    expect(stripeCreate).not.toHaveBeenCalled();
    expect(dbInsertValues).not.toHaveBeenCalled();
  });

  it("uses stable source-scoped idempotency and metadata for repeated transfer attempts", async () => {
    const { executePartnerTransfer } = await import("./partnerSplit");
    const input = {
      totalRevenue: 100,
      sourceType: "booking_platform_fee" as const,
      sourceId: "pi_test_456",
      sourceDescription: "booking platform fee",
      chargeId: "ch_test_789",
    };

    const first = await executePartnerTransfer(input);
    const second = await executePartnerTransfer(input);

    expect(first).toEqual({ success: true, transferId: "tr_test_123", amount: 40 });
    expect(second).toEqual(first);
    expect(stripeCreate).toHaveBeenCalledTimes(2);

    const [firstParams, firstOptions] = stripeCreate.mock.calls[0];
    const [secondParams, secondOptions] = stripeCreate.mock.calls[1];
    expect(firstOptions.idempotencyKey).toMatch(/^ologycrew-partner-booking_platform_fee-pi_test_456-acct_[A-Za-z0-9]+$/);
    expect(secondOptions.idempotencyKey).toBe(firstOptions.idempotencyKey);
    expect(firstParams.source_transaction).toBe("ch_test_789");
    expect(firstParams.metadata).toMatchObject({
      sourceType: "booking_platform_fee",
      sourceId: "pi_test_456",
    });
    expect(secondParams.metadata).toEqual(firstParams.metadata);
    expect(dbInsertValues).toHaveBeenCalledTimes(2);
  });
});
