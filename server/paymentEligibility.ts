import { TRPCError } from "@trpc/server";
import {
  ALL_TRIALS_PAUSED,
  ALL_TRIAL_PAUSE_MESSAGE,
  PLATFORM_SUBSCRIPTION_PAUSE_POLICY_ID,
  PLATFORM_SUBSCRIPTION_PAUSE_MESSAGE,
  PLATFORM_SUBSCRIPTIONS_PAUSED,
  PROVIDER_PAYMENT_PAUSE_POLICY_ID,
  PROVIDER_PAYMENT_PAUSE_MESSAGE,
  PROVIDER_PAYMENTS_PAUSED,
  PROVIDER_TRIAL_PAUSE_POLICY_ID,
  PROVIDER_TRIAL_PAUSE_MESSAGE,
} from "../shared/providerPaymentPause";

/**
 * Server-side operation categories. These are intentionally narrower than a
 * generic "payment" flag so reconciliation and existing-payment operations do
 * not get blocked as if they were new collection.
 */
export type PaymentEligibilityOperation =
  | "provider_collection"
  | "promotion_collection"
  | "platform_subscription"
  | "customer_subscription"
  | "connect_onboarding"
  | "provider_trial"
  | "customer_trial"
  | "refund_or_cancellation"
  | "transfer_or_partner_split"
  | "webhook_reconciliation"
  | "connect_balance_read"
  | "offline_pay_at_location"
  | "account_cleanup";

export type PaymentEligibilityDecision = {
  allowed: boolean;
  operation: PaymentEligibilityOperation;
  reason: "platform_review" | "open";
  message?: string;
  policyIds: string[];
};

const PROMOTION_PAYMENT_PAUSE_MESSAGE = "Provider promotion payments are temporarily unavailable while Stripe reviews OlogyCrew's account.";
const PROMOTION_PAYMENT_PAUSE_POLICY_ID = "provider-promotion-pause-2026-11-22";

/**
 * The authoritative source-controlled decision for new payment-producing
 * operations during the Stripe review. It performs no database or Stripe I/O.
 * A future persisted eligibility state must be evaluated here, before callers
 * perform local financial mutations or external financial side effects.
 */
export function getPaymentEligibilityDecision(
  operation: PaymentEligibilityOperation,
): PaymentEligibilityDecision {
  if (operation === "provider_collection" && PROVIDER_PAYMENTS_PAUSED) {
    return {
      allowed: false,
      operation,
      reason: "platform_review",
      message: PROVIDER_PAYMENT_PAUSE_MESSAGE,
      policyIds: [PROVIDER_PAYMENT_PAUSE_POLICY_ID],
    };
  }

  if (operation === "promotion_collection" && PROVIDER_PAYMENTS_PAUSED) {
    return {
      allowed: false,
      operation,
      reason: "platform_review",
      message: PROMOTION_PAYMENT_PAUSE_MESSAGE,
      policyIds: [PROMOTION_PAYMENT_PAUSE_POLICY_ID],
    };
  }

  if ((operation === "platform_subscription" || operation === "customer_subscription" || operation === "connect_onboarding") && PLATFORM_SUBSCRIPTIONS_PAUSED) {
    return {
      allowed: false,
      operation,
      reason: "platform_review",
      message: PLATFORM_SUBSCRIPTION_PAUSE_MESSAGE,
      policyIds: [PLATFORM_SUBSCRIPTION_PAUSE_POLICY_ID],
    };
  }

  if ((operation === "provider_trial" || operation === "customer_trial") && ALL_TRIALS_PAUSED) {
    return {
      allowed: false,
      operation,
      reason: "platform_review",
      message: operation === "provider_trial" ? PROVIDER_TRIAL_PAUSE_MESSAGE : ALL_TRIAL_PAUSE_MESSAGE,
      policyIds: [PROVIDER_TRIAL_PAUSE_POLICY_ID],
    };
  }

  return { allowed: true, operation, reason: "open", policyIds: [] };
}

export function assertPaymentEligibilityOpen(operation: PaymentEligibilityOperation): void {
  const decision = getPaymentEligibilityDecision(operation);
  if (!decision.allowed) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: decision.message || "This payment operation is temporarily unavailable.",
    });
  }
}

export const paymentEligibilityMessages = {
  promotionPaused: PROMOTION_PAYMENT_PAUSE_MESSAGE,
};
