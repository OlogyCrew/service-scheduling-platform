import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import {
  PLATFORM_SUBSCRIPTIONS_PAUSED,
  PLATFORM_SUBSCRIPTION_PAUSE_MESSAGE,
  PROVIDER_TRIALS_PAUSED,
  PROVIDER_TRIAL_PAUSE_MESSAGE,
  ALL_TRIALS_PAUSED,
  ALL_TRIAL_PAUSE_MESSAGE,
} from "../shared/providerPaymentPause";
import { assertPlatformSubscriptionBillingOpen, assertProviderTrialStartOpen, assertAllTrialStartOpen } from "./providerPaymentPause";

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

  it("keeps all new provider trial starts paused", () => {
    expect(PROVIDER_TRIALS_PAUSED).toBe(true);
    try {
      assertProviderTrialStartOpen();
      throw new Error("expected the trial guard to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      expect((error as TRPCError).code).toBe("PRECONDITION_FAILED");
      expect((error as Error).message).toBe(PROVIDER_TRIAL_PAUSE_MESSAGE);
    }
  });

  it("keeps all customer and provider trial starts paused", () => {
    expect(ALL_TRIALS_PAUSED).toBe(true);
    try {
      assertAllTrialStartOpen();
      throw new Error("expected the all-trials guard to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      expect((error as TRPCError).code).toBe("PRECONDITION_FAILED");
      expect((error as Error).message).toBe(ALL_TRIAL_PAUSE_MESSAGE);
    }
  });
});
