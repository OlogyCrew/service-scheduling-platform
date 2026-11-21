/**
 * Owner-authorized emergency containment (2026-11-20).
 * Source-controlled and fail-closed: no environment flag, admin bypass,
 * provider exception, expiry, or client parameter can resume collection.
 * Resumption requires a separately approved, tested application release.
 * Collection, subscription billing, and new trials are controlled separately
 * below. Historical webhooks and financial reconciliation are not changed.
 */
export const PROVIDER_PAYMENTS_PAUSED: boolean = true;
export const PROVIDER_PAYMENT_PAUSE_MESSAGE = "Online payments to providers are temporarily unavailable.";
export const PROVIDER_PAYMENT_PAUSE_DETAIL = "You can still browse providers, send messages, and view bookings and payment history. This pause does not mark unpaid bookings or invoices as paid.";
export const PROVIDER_PAYMENT_PAUSE_POLICY_ID = "provider-collection-pause-2026-11-20";

/**
 * Stripe has closed or is reviewing the account. Keep local free-plan and historical trial
 * records available, but fail closed for every action that would create or
 * mutate Stripe billing or Connect state. Existing subscription records remain
 * readable and are not automatically cancelled, downgraded, or rewritten.
 */
export const PLATFORM_SUBSCRIPTIONS_PAUSED: boolean = true;
export const PLATFORM_SUBSCRIPTION_PAUSE_MESSAGE = "Paid subscriptions and Stripe account setup are temporarily unavailable while Stripe reviews OlogyCrew's account.";
export const PLATFORM_SUBSCRIPTION_PAUSE_DETAIL = "Starter and Individual free plans remain available. New trials, paid checkout, billing changes, and provider payment-account connections are unavailable during Stripe review. Resumption requires a separately approved, tested release.";
export const PLATFORM_SUBSCRIPTION_PAUSE_POLICY_ID = "platform-subscription-pause-2026-11-21";

/**
 * All new provider and customer trials are paused for the Stripe account-review period.
 * Existing trial/subscription records remain readable and are not rewritten.
 */
export const ALL_TRIALS_PAUSED: boolean = true;
export const ALL_TRIAL_PAUSE_MESSAGE = "New trials are temporarily unavailable while Stripe reviews OlogyCrew's account.";
export const PROVIDER_TRIALS_PAUSED: boolean = ALL_TRIALS_PAUSED;
export const PROVIDER_TRIAL_PAUSE_MESSAGE = "New provider trials are temporarily unavailable while Stripe reviews OlogyCrew's account.";
export const PROVIDER_TRIAL_PAUSE_POLICY_ID = "provider-trial-pause-2026-11-21";

export function getProviderPaymentCollectionStatus() {
  return {
    paused: PROVIDER_PAYMENTS_PAUSED,
    scope: "provider_booking_and_invoice_collection" as const,
    policyId: PROVIDER_PAYMENT_PAUSE_POLICY_ID,
    message: PROVIDER_PAYMENT_PAUSE_MESSAGE,
    detail: PROVIDER_PAYMENT_PAUSE_DETAIL,
    automaticResume: false,
  };
}
