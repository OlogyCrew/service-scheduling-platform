import { TRPCError } from "@trpc/server";
import { providerHasFeature, type ProviderTier } from "@shared/entitlements";

type PaymentActor = {
  id: number;
  deletedAt?: Date | string | null;
  isSuspended?: boolean | null;
};

type ProviderPaymentProfile = {
  id: number;
  userId: number;
  isActive?: boolean | null;
  deletedAt?: Date | string | null;
  isOfficial?: boolean | null;
  stripeAccountId?: string | null;
  payoutEnabled?: boolean | null;
  stripeAccountStatus?: string | null;
};

type ProviderSubscription = {
  status?: string | null;
};

export type PaymentAuthorizationPurpose =
  | "booking"
  | "invoice"
  | "promotion"
  | "customer_subscription"
  | "provider_subscription";

export function assertPaymentActorCanInitiate(
  actor: PaymentActor,
  purpose: PaymentAuthorizationPurpose,
): void {
  if (actor.deletedAt || actor.isSuspended === true) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `This account cannot initiate ${purpose.replaceAll("_", " ")} payments.`,
    });
  }
}

export function assertProviderPaymentActor(
  actor: PaymentActor,
  provider: ProviderPaymentProfile,
): void {
  assertPaymentActorCanInitiate(actor, "provider_subscription");

  if (provider.userId != null && provider.userId !== actor.id) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Provider account ownership could not be verified." });
  }
  if (provider.deletedAt || provider.isActive === false) {
    throw new TRPCError({ code: "FORBIDDEN", message: "This provider account is not active." });
  }
}

export function assertProviderCanCollectPayments({
  provider,
  tier,
  subscription,
}: {
  provider: ProviderPaymentProfile;
  tier: ProviderTier;
  subscription?: ProviderSubscription | null;
}): void {
  if (provider.isOfficial) return;
  if (provider.deletedAt || provider.isActive === false) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This provider is not currently accepting bookings or payments through OlogyCrew. No charge was created.",
    });
  }

  const hasActivePaidSubscription = subscription?.status === "active";
  if (!hasActivePaidSubscription || !providerHasFeature(tier, "paymentCollection")) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This provider must have an active paid subscription before accepting payments through OlogyCrew. No charge was created.",
    });
  }
  if (!provider.stripeAccountId || !provider.payoutEnabled) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "This provider has not finished payment setup. Your booking is saved, but no charge was created.",
    });
  }
}
