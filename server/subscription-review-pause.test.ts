import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import {
  PLATFORM_SUBSCRIPTIONS_PAUSED,
  PLATFORM_SUBSCRIPTION_PAUSE_MESSAGE,
} from "../shared/providerPaymentPause";
import { assertPlatformSubscriptionBillingOpen } from "./providerPaymentPause";

describe("Stripe review subscription containment", () => {
  it("keeps the source-controlled paid billing pause enabled", () => {
    expect(PLATFORM_SUBSCRIPTIONS_PAUSED).toBe(true);
  });

  it("rejects Stripe-backed billing mutations before side effects", () => {
    try {
      assertPlatformSubscriptionBillingOpen();
      throw new Error("expected the billing guard to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      expect((error as TRPCError).code).toBe("PRECONDITION_FAILED");
      expect((error as Error).message).toBe(PLATFORM_SUBSCRIPTION_PAUSE_MESSAGE);
    }
  });
});
