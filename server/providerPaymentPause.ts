import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "./_core/trpc";
import {
  PLATFORM_SUBSCRIPTIONS_PAUSED,
  PLATFORM_SUBSCRIPTION_PAUSE_MESSAGE,
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

// Keep authentication and suspension checks first, then stop before the
// handler, DB acquisition, credit spending, demo bypass, velocity writes,
// Stripe Customer creation, or Checkout creation. No role/provider bypass.
export const providerPaymentProcedure = protectedProcedure.use(({ next }) => {
  assertProviderPaymentCollectionOpen();
  return next();
});
