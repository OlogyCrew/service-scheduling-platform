/**
 * Owner-authorized emergency containment (2026-11-20).
 * Source-controlled and fail-closed: no environment flag, admin bypass,
 * provider exception, expiry, or client parameter can resume collection.
 * Resumption requires a separately approved, tested application release.
 * This policy does not pause platform subscriptions or historical webhooks.
 */
export const PROVIDER_PAYMENTS_PAUSED: boolean = true;
export const PROVIDER_PAYMENT_PAUSE_MESSAGE = "Online payments to providers are temporarily unavailable.";
export const PROVIDER_PAYMENT_PAUSE_DETAIL = "You can still browse providers, send messages, and view bookings and payment history. This pause does not mark unpaid bookings or invoices as paid.";
export const PROVIDER_PAYMENT_PAUSE_POLICY_ID = "provider-collection-pause-2026-11-20";

/**
 * Stripe has closed or is reviewing the account. Keep local Starter/free-trial
 * records available, but fail closed for every action that would create or
 * mutate Stripe billing or Connect state. Existing subscription records remain
 * readable and are not automatically cancelled, downgraded, or rewritten.
 */
export const PLATFORM_SUBSCRIPTIONS_PAUSED: boolean = true;
export const PLATFORM_SUBSCRIPTION_PAUSE_MESSAGE = "Paid subscriptions and Stripe account setup are temporarily unavailable while Stripe reviews OlogyCrew's account.";
export const PLATFORM_SUBSCRIPTION_PAUSE_DETAIL = "Starter setup and the no-card local trial can still be created. Paid checkout, billing changes, and provider payment-account connections will remain unavailable until Stripe restores service.";
export const PLATFORM_SUBSCRIPTION_PAUSE_POLICY_ID = "platform-subscription-pause-2026-11-21";

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
