import { protectedProcedure } from "./_core/trpc";
import { assertPaymentEligibilityOpen } from "./paymentEligibility";

export function assertProviderPaymentCollectionOpen(): void {
  assertPaymentEligibilityOpen("provider_collection");
}

/**
 * Blocks Stripe-backed subscription mutations while retaining read-only
 * subscription visibility and local Starter/free-trial flows.
 */
export function assertPlatformSubscriptionBillingOpen(): void {
  assertPaymentEligibilityOpen("platform_subscription");
}

/** Blocks creation of new local provider trials without changing existing records. */
export function assertProviderTrialStartOpen(): void {
  assertPaymentEligibilityOpen("provider_trial");
}

/** Blocks every new trial start across provider and customer subscriptions. */
export function assertAllTrialStartOpen(): void {
  assertPaymentEligibilityOpen("customer_trial");
}

// Keep authentication and suspension checks first, then stop before the
// handler, DB acquisition, credit spending, demo bypass, velocity writes,
// Stripe Customer creation, or Checkout creation. No role/provider bypass.
export const providerPaymentProcedure = protectedProcedure.use(({ next }) => {
  assertProviderPaymentCollectionOpen();
  return next();
});
