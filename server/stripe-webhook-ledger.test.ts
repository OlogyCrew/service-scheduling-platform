import { describe, expect, it } from "vitest";
import {
  classifyExistingWebhookClaim,
  stripeWebhookLedgerPolicy,
} from "./db/stripeWebhookEvents";
import { resolveWebhookPaymentStatus } from "./db/payments";
import { getWebhookLedgerInput } from "./stripeWebhook";

const NOW = new Date("2026-11-07T08:00:00.000Z");

describe("Stripe webhook durable ledger contract", () => {
  it("acknowledges a processed duplicate without reprocessing", () => {
    expect(classifyExistingWebhookClaim({
      status: "processed",
      nextRetryAt: null,
      lastAttemptAt: new Date("2026-11-07T07:59:00.000Z"),
    }, NOW)).toBe("duplicate");
  });

  it("retries a failed event after its retry window", () => {
    expect(classifyExistingWebhookClaim({
      status: "failed",
      nextRetryAt: new Date("2026-11-07T07:59:00.000Z"),
      lastAttemptAt: new Date("2026-11-07T07:58:00.000Z"),
    }, NOW)).toBe("process");
  });

  it("holds an actively leased event for the current worker", () => {
    expect(classifyExistingWebhookClaim({
      status: "processing",
      nextRetryAt: null,
      lastAttemptAt: new Date(NOW.getTime() - stripeWebhookLedgerPolicy.processingLeaseMs + 1),
    }, NOW)).toBe("in_progress");
  });

  it("allows an interrupted stale lease to be reclaimed", () => {
    expect(classifyExistingWebhookClaim({
      status: "processing",
      nextRetryAt: null,
      lastAttemptAt: new Date(NOW.getTime() - stripeWebhookLedgerPolicy.processingLeaseMs - 1),
    }, NOW)).toBe("process");
  });

  it("does not allow an older failure to regress a processed payment", () => {
    const paymentState = { status: "processed", nextRetryAt: null, lastAttemptAt: NOW } as const;
    expect(classifyExistingWebhookClaim(paymentState, new Date(NOW.getTime() + 1000))).toBe("duplicate");
    expect(resolveWebhookPaymentStatus("captured", "failed")).toBe("captured");
    expect(resolveWebhookPaymentStatus("refunded", "failed")).toBe("refunded");
  });

  it("keeps Stripe object identifiers and metadata scoped to the authentic event object", () => {
    const input = getWebhookLedgerInput({
      id: "evt_booking_1",
      type: "payment_intent.succeeded",
      livemode: false,
      api_version: "2026-01-28.clover",
      data: {
        object: {
          id: "pi_booking_1",
          metadata: {
            bookingId: "42",
            type: "booking",
            paymentType: "full",
            providerId: "7",
            userId: "9",
            offlinePayment: "true",
          },
        },
      },
    } as any);

    expect(input.paymentIntentId).toBe("pi_booking_1");
    expect(input.bookingId).toBe(42);
    expect(input.metadata).toEqual({
      type: "booking",
      paymentType: "full",
      providerId: "7",
      userId: "9",
    });
    // Offline-only markers are not promoted into Stripe payment state by the ledger contract.
    expect(input.metadata).not.toHaveProperty("offlinePayment");
  });

  it("does not infer a booking scope from invalid or absent metadata", () => {
    const input = getWebhookLedgerInput({
      id: "evt_invoice_1",
      type: "invoice.payment_succeeded",
      livemode: false,
      data: { object: { id: "in_1", metadata: { bookingId: "not-a-positive-integer" } } },
    } as any);

    expect(input.invoiceId).toBe("in_1");
    expect(input.bookingId).toBeNull();
  });
});
