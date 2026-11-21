import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "./_core/trpc";
import {
  PLATFORM_SUBSCRIPTIONS_PAUSED,
  PLATFORM_SUBSCRIPTION_PAUSE_MESSAGE,
  PROVIDER_TRIALS_PAUSED,
  PROVIDER_TRIAL_PAUSE_MESSAGE,
  ALL_TRIALS_PAUSED,
  ALL_TRIAL_PAUSE_MESSAGE,
  PROVIDER_PAYMENTS_PAUSED,
  PROVIDER_PAYMENT_PAUSE_MESSAGE,
} from "../shared/providerPaymentPause";

export function assertProviderPaymentCollectionOpen(): void {
  if (PROVIDER_PAYMENTS_PAUSED) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: PROVIDER_PAYMENT_PAUSE_MESSAGE,
    });
  }
}

/**
 * Blocks Stripe-backed subscription mutations while retaining read-only
 * subscription visibility and local Starter/free-trial flows.
 */
export function assertPlatformSubscriptionBillingOpen(): void {
  if (PLATFORM_SUBSCRIPTIONS_PAUSED) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: PLATFORM_SUBSCRIPTION_PAUSE_MESSAGE,
    });
  }
}

/** Blocks creation of new local provider trials without changing existing records. */
export function assertProviderTrialStartOpen(): void {
  if (PROVIDER_TRIALS_PAUSED) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: PROVIDER_TRIAL_PAUSE_MESSAGE,
    });
  }
}

/** Blocks every new trial start across provider and customer subscriptions. */
export function assertAllTrialStartOpen(): void {
  if (ALL_TRIALS_PAUSED) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: ALL_TRIAL_PAUSE_MESSAGE,
    });
  }
}

// Keep authentication and suspension checks first, then stop before the
// handler, DB acquisition, credit spending, demo bypass, velocity writes,
// Stripe Customer creation, or Checkout creation. No role/provider bypass.
export const providerPaymentProcedure = protectedProcedure.use(({ next }) => {
  assertProviderPaymentCollectionOpen();
  return next();
});
