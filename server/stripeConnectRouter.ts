import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import Stripe from "stripe";
import { ENV } from "./_core/env";
import * as db from "./db";
import { TRPCError } from "@trpc/server";
import { providerHasFeature } from "@shared/entitlements";
import { assertPlatformSubscriptionBillingOpen } from "./providerPaymentPause";
import { PLATFORM_SUBSCRIPTIONS_PAUSED, PROVIDER_PAYMENTS_PAUSED } from "../shared/providerPaymentPause";

const stripe = new Stripe(ENV.stripeSecretKey!, {
  apiVersion: "2026-01-28.clover" as any,
});

export const stripeConnectRouter = router({
  // Start Stripe Connect onboarding — creates an Express account and returns an onboarding link
  startOnboarding: protectedProcedure
    .input(z.object({
      origin: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertPlatformSubscriptionBillingOpen();
      const provider = await db.getProviderByUserId(ctx.user.id);
      if (!provider) throw new TRPCError({ code: "NOT_FOUND", message: "Provider profile not found" });

      // Free accounts cannot connect a payment account — must upgrade first
      const currentTier = await db.getProviderTier(provider.id);
      if (!providerHasFeature(currentTier, "paymentCollection")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Payment account setup requires a Pro or Business subscription. Please upgrade your plan first.",
        });
      }

      if (!ENV.stripeSecretKey) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Payment setup is temporarily unavailable. Please try again later or contact support.",
        });
      }

      try {
        // If already has a Stripe account, return a new onboarding link
        if (provider.stripeAccountId) {
          try {
            const accountLink = await stripe.accountLinks.create({
              account: provider.stripeAccountId,
              refresh_url: `${input.origin}/provider/finances?stripe=refresh`,
              return_url: `${input.origin}/provider/finances?stripe=return`,
              type: "account_onboarding",
            });
            return { url: accountLink.url, accountId: provider.stripeAccountId };
          } catch (linkError: any) {
            // If the existing account is invalid, clear it and create a new one
            if (linkError?.type === "StripeInvalidRequestError") {
              console.warn(`[StripeConnect] Existing account ${provider.stripeAccountId} is invalid, creating new one`);
              await db.updateProviderStripeAccount(provider.id, {
                stripeAccountId: null as any,
                stripeAccountStatus: "not_connected",
                stripeOnboardingComplete: false,
                payoutEnabled: false,
              });
              // Fall through to create a new account
            } else {
              throw linkError;
            }
          }
        }

        // Create a new Express account
        const account = await stripe.accounts.create({
          type: "express",
          country: "US",
          email: ctx.user.email || undefined,
          business_type: provider.businessType === "sole_proprietor" ? "individual" : "company",
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          metadata: {
            providerId: provider.id.toString(),
            userId: ctx.user.id.toString(),
            platform: "ologycrew",
          },
        });

        const accountId = account.id;

        await db.updateProviderStripeAccount(provider.id, {
          stripeAccountId: accountId,
          stripeAccountStatus: "onboarding",
        });

        const accountLink = await stripe.accountLinks.create({
          account: accountId,
          refresh_url: `${input.origin}/provider/finances?stripe=refresh`,
          return_url: `${input.origin}/provider/finances?stripe=return`,
          type: "account_onboarding",
        });

        return { url: accountLink.url, accountId };
      } catch (error: any) {
        console.error("[StripeConnect] Onboarding error:", error?.message || error);

        if (error instanceof TRPCError) throw error;

        // Provide user-friendly error messages based on Stripe error types
        if (error?.type === "StripeAuthenticationError") {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Payment service configuration error. Please contact support.",
          });
        }
        if (error?.type === "StripeConnectionError" || error?.code === "ECONNREFUSED") {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Unable to connect to payment service. Please try again in a few minutes.",
          });
        }
        if (error?.type === "StripeRateLimitError") {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Too many requests. Please wait a moment and try again.",
          });
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Unable to set up payments right now. Please try again later or skip this step.",
        });
      }
    }),

  // Check the status of the provider's Stripe Connect account
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const provider = await db.getProviderByUserId(ctx.user.id);
    if (!provider) throw new TRPCError({ code: "NOT_FOUND", message: "Provider profile not found" });
    const currentTier = await db.getProviderTier(provider.id);
    const hasPaymentEntitlement = providerHasFeature(currentTier, "paymentCollection");

    if (PLATFORM_SUBSCRIPTIONS_PAUSED || PROVIDER_PAYMENTS_PAUSED) {
      // Preserve stored Connect identifiers/status; never refresh or rewrite
      // them from Stripe on a page load while collection is paused.
      return {
        connected: !!provider.stripeAccountId,
        status: provider.stripeAccountStatus || "not_connected",
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: !!provider.stripeOnboardingComplete,
        paymentCollectionEnabled: false,
        requiresPaidPlan: !hasPaymentEntitlement,
        reviewPaused: true,
      };
    }

    if (!provider.stripeAccountId) {
      return {
        connected: false,
        status: "not_connected" as const,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        paymentCollectionEnabled: false,
        requiresPaidPlan: !hasPaymentEntitlement,
      };
    }

    try {
      const account = await stripe.accounts.retrieve(provider.stripeAccountId);

      const newStatus = account.charges_enabled && account.payouts_enabled
        ? "active"
        : account.details_submitted
          ? "restricted"
          : "onboarding";

      await db.updateProviderStripeAccount(provider.id, {
        stripeAccountStatus: newStatus,
        stripeOnboardingComplete: account.details_submitted || false,
        payoutEnabled: account.payouts_enabled || false,
      });

      return {
        connected: true,
        status: newStatus,
        chargesEnabled: account.charges_enabled || false,
        payoutsEnabled: account.payouts_enabled || false,
        detailsSubmitted: account.details_submitted || false,
        paymentCollectionEnabled: hasPaymentEntitlement && !!account.charges_enabled && !!account.payouts_enabled,
        requiresPaidPlan: !hasPaymentEntitlement,
      };
    } catch (error) {
      console.error("[StripeConnect] Error retrieving account:", error);
      return {
        connected: true,
        status: provider.stripeAccountStatus,
        chargesEnabled: false,
        payoutsEnabled: provider.payoutEnabled,
        detailsSubmitted: provider.stripeOnboardingComplete,
        paymentCollectionEnabled: hasPaymentEntitlement && provider.payoutEnabled,
        requiresPaidPlan: !hasPaymentEntitlement,
      };
    }
  }),

  // Get a link to the Stripe Express Dashboard
  getDashboardLink: protectedProcedure.mutation(async ({ ctx }) => {
    assertPlatformSubscriptionBillingOpen();
    const provider = await db.getProviderByUserId(ctx.user.id);
    if (!provider?.stripeAccountId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "No Stripe account connected. Please complete Stripe onboarding first." });
    }

    try {
      const loginLink = await stripe.accounts.createLoginLink(provider.stripeAccountId);
      return { url: loginLink.url };
    } catch (error: any) {
      console.error("[StripeConnect] Dashboard link error:", error?.message || error);
      if (error?.type === "StripeInvalidRequestError") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Your Stripe account needs to complete onboarding before you can access the dashboard.",
        });
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Unable to access Stripe dashboard. Please try again later.",
      });
    }
  }),

  // Get a new onboarding link (for resuming incomplete onboarding)
  getOnboardingLink: protectedProcedure
    .input(z.object({ origin: z.string() }))
    .mutation(async ({ ctx, input }) => {
      assertPlatformSubscriptionBillingOpen();
      const provider = await db.getProviderByUserId(ctx.user.id);
      if (!provider?.stripeAccountId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No Stripe account connected. Please start the onboarding process first." });
      }
      const currentTier = await db.getProviderTier(provider.id);
      if (!providerHasFeature(currentTier, "paymentCollection")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Complete payment setup is available on Pro or Business. Your Stripe account connection has been retained.",
        });
      }

      try {
        const accountLink = await stripe.accountLinks.create({
          account: provider.stripeAccountId,
          refresh_url: `${input.origin}/provider/finances?stripe=refresh`,
          return_url: `${input.origin}/provider/finances?stripe=return`,
          type: "account_onboarding",
        });
        return { url: accountLink.url };
      } catch (error: any) {
        console.error("[StripeConnect] Onboarding link error:", error?.message || error);
        if (error?.type === "StripeInvalidRequestError") {
          // Account may be deleted or invalid, reset and ask user to start over
          await db.updateProviderStripeAccount(provider.id, {
            stripeAccountId: null as any,
            stripeAccountStatus: "not_connected",
            stripeOnboardingComplete: false,
            payoutEnabled: false,
          });
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Your previous Stripe account is no longer valid. Please start the setup process again.",
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Unable to generate onboarding link. Please try again later.",
        });
      }
    }),

  // Get the provider's Stripe balance
  getBalance: protectedProcedure.query(async ({ ctx }) => {
    const provider = await db.getProviderByUserId(ctx.user.id);
    if (!provider?.stripeAccountId) {
      return { available: 0, pending: 0 };
    }

    try {
      const balance = await stripe.balance.retrieve({
        stripeAccount: provider.stripeAccountId,
      });

      const available = balance.available.reduce((sum, b) => sum + b.amount, 0) / 100;
      const pending = balance.pending.reduce((sum, b) => sum + b.amount, 0) / 100;

      return { available, pending };
    } catch (error) {
      console.error("[StripeConnect] Error retrieving balance:", error);
      return { available: 0, pending: 0 };
    }
  }),
});
