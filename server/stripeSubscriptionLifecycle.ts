export type LocalSubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "cancelled"
  | "incomplete"
  | "paused";

type StripeSubscriptionLike = {
  status?: string | null;
  start_date?: number | null;
  current_period_start?: number | null;
  current_period_end?: number | null;
  cancel_at?: number | null;
  ended_at?: number | null;
  items?: {
    data?: Array<{
      current_period_start?: number | null;
      current_period_end?: number | null;
    }>;
  };
};

export function mapStripeSubscriptionStatus(status: string): LocalSubscriptionStatus {
  if (status === "active") return "active";
  if (status === "trialing") return "trialing";
  if (status === "past_due" || status === "unpaid") return "past_due";
  if (status === "paused") return "paused";
  if (status === "canceled") return "cancelled";
  return "incomplete";
}

function toDate(seconds?: number | null): Date | undefined {
  if (!seconds || !Number.isFinite(seconds)) return undefined;
  return new Date(seconds * 1000);
}

export function getStripeSubscriptionPeriod(subscription: StripeSubscriptionLike): {
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
} {
  const primaryItem = subscription.items?.data?.[0];
  const startSeconds =
    primaryItem?.current_period_start ??
    subscription.current_period_start ??
    subscription.start_date;
  const endSeconds =
    primaryItem?.current_period_end ??
    subscription.current_period_end ??
    subscription.cancel_at ??
    subscription.ended_at;

  return {
    currentPeriodStart: toDate(startSeconds),
    currentPeriodEnd: toDate(endSeconds),
  };
}

export function requireStripeSubscriptionPeriodEnd(subscription: StripeSubscriptionLike): Date {
  const { currentPeriodEnd } = getStripeSubscriptionPeriod(subscription);
  if (!currentPeriodEnd) {
    throw new Error("Stripe subscription is missing its current period end");
  }
  return currentPeriodEnd;
}

/** Stripe returns resource_missing when a local reference outlives a deleted object. */
export function isStripeResourceMissing(error: unknown): boolean {
  const candidate = error as { type?: string; code?: string; statusCode?: number; raw?: { code?: string }; message?: string } | null;
  return candidate?.code === "resource_missing"
    || candidate?.raw?.code === "resource_missing"
    || candidate?.statusCode === 404
    || (candidate?.type === "StripeInvalidRequestError" && /resource_missing|No such subscription|No such payment intent/i.test(candidate.message || ""));
}
