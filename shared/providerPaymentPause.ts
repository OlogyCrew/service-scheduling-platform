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
