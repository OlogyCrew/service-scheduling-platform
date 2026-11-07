import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import Stripe from "stripe";
import { ENV } from "./_core/env";
import * as db from "./db";
import { SUBSCRIPTION_TIERS, STRIPE_PRODUCT_NAME, getTrialDays, type SubscriptionTier } from "./products";
import { sendTrialStartedNotification, checkAndSendTrialMilestoneNotification } from "./trialNotifications";
import { sendNotification } from "./notifications";
import { TRIAL_DAYS, providerHasFeature, resolveProviderEntitlement } from "../shared/entitlements";
import { isStripeResourceMissing, requireStripeSubscriptionPeriodEnd } from "./stripeSubscriptionLifecycle";
import { getSubscriptionAnalytics as getEffectiveSubscriptionAnalytics } from "./db/payments";
import { createSubscriptionInAppNotice } from "./subscriptionNotifications";
import { assertProviderPaymentActor } from "./paymentAuthorization";
import { assertPaymentVelocityAllowed, throwIfPaymentVelocityBlocked } from "./paymentVelocity";

const stripe = new Stripe(ENV.stripeSecretKey, {
  apiVersion: "2026-01-28.clover" as any,
});

// Cache for Stripe price IDs (created on first use)
const priceCache: Record<string, string> = {};

async function getOrCreateStripePrice(tier: SubscriptionTier, interval: "month" | "year"): Promise<string> {
  const cacheKey = `${tier}_${interval}`;
  if (priceCache[cacheKey]) return priceCache[cacheKey];

  const config = SUBSCRIPTION_TIERS[tier];
  const amount = interval === "month"
    ? Math.round(config.monthlyPrice * 100)
    : Math.round(config.yearlyPrice * 100);

  if (amount === 0) throw new Error("Cannot create Stripe price for free tier");

  // Search for existing product
  const products = await stripe.products.list({ limit: 10 });
  let product = products.data.find(p => p.name === STRIPE_PRODUCT_NAME && p.active);

  if (!product) {
    product = await stripe.products.create({
      name: STRIPE_PRODUCT_NAME,
      description: "OlogyCrew provider subscription for service professionals",
    });
  }

  // Search for existing price
  const prices = await stripe.prices.list({ product: product.id, limit: 20, active: true });
  const existingPrice = prices.data.find(
    p => p.unit_amount === amount && p.recurring?.interval === interval
  );

  if (existingPrice) {
    priceCache[cacheKey] = existingPrice.id;
    return existingPrice.id;
  }

  // Create new price
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: amount,
    currency: "usd",
    recurring: { interval },
    metadata: { tier, interval },
  });

  priceCache[cacheKey] = price.id;
  return price.id;
}

export const subscriptionRouter = router({
  // Get available tiers and current subscription
  getTiers: publicProcedure.query(() => {
    return Object.values(SUBSCRIPTION_TIERS);
  }),

  // Start 14-day trial for new providers (no credit card required)
  startProfessionalTrial: protectedProcedure
    .input(z.object({
      tier: z.enum(["basic", "premium"]).default("basic"),
    }).optional())
    .mutation(async ({ ctx, input }) => {
    const provider = await db.getProviderByUserId(ctx.user.id);
    if (!provider) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Must be a provider" });
    }

    const trialTier = input?.tier || "basic";

    // Check if already has an active/trialing subscription
    const existing = await db.getProviderSubscription(provider.id);
    if (existing && existing.status === "trialing") {
      return { tier: existing.tier, status: existing.status, trialEndsAt: existing.trialEndsAt };
    }
    if (existing && existing.status === "active" && existing.tier !== "free") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Already have an active paid subscription" });
    }
    // Enforce one-time trial per account lifetime
    if (existing && existing.trialEndsAt != null) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "You have already used your free trial. Please subscribe to continue." });
    }

    // Start 14-day trial (no credit card required)
    const now = new Date();
    const trialEnd = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

    await db.upsertProviderSubscription({
      providerId: provider.id,
      tier: trialTier,
      status: "trialing",
      trialEndsAt: trialEnd,
      currentPeriodStart: now,
      currentPeriodEnd: trialEnd,
    });

    // Send trial started email notification (fire-and-forget)
    const user = ctx.user;
    sendTrialStartedNotification({
      providerId: provider.id,
      userId: user.id,
      email: user.email || undefined,
      providerName: provider.businessName,
      daysRemaining: TRIAL_DAYS,
      trialEndsAt: trialEnd,
    }).catch(err => console.error("[Trial] Failed to send trial_started notification:", err));

    return { tier: trialTier, status: "trialing" as const, trialEndsAt: trialEnd };
  }),

  // Check and handle trial expiry (called on dashboard load)
  checkTrialStatus: protectedProcedure.query(async ({ ctx }) => {
    const provider = await db.getProviderByUserId(ctx.user.id);
    if (!provider) return null;

    const sub = await db.getProviderSubscription(provider.id);
    if (!sub) return null;
    const entitlement = resolveProviderEntitlement(sub);

    // If trialing, check if expired
    if (sub.status === "trialing" && sub.trialEndsAt) {
      const now = new Date();
      const trialEnd = new Date(sub.trialEndsAt);
      const daysRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      if (daysRemaining <= 0) {
        // Trial expired — downgrade to free (keep trialEndsAt as historical record)
        await db.upsertProviderSubscription({
          providerId: provider.id,
          tier: "free",
          status: "active",
          trialEndsAt: sub.trialEndsAt ? new Date(sub.trialEndsAt) : undefined,
          currentPeriodStart: undefined,
          currentPeriodEnd: undefined,
        });
      // Send trial expired notification (fire-and-forget)
      const user = ctx.user;
      checkAndSendTrialMilestoneNotification({
        providerId: provider.id,
        userId: user.id,
        email: user.email || undefined,
        providerName: provider.businessName,
        daysRemaining: 0,
        trialEndsAt: new Date(sub.trialEndsAt!),
      }).catch(err => console.error("[Trial] Failed to send trial_expired notification:", err));

      return {
        isTrialing: false,
        trialExpired: true,
        trialTier: "basic" as const,
        daysRemaining: 0,
        trialEndsAt: sub.trialEndsAt,
        currentTier: "free" as const,
        hasUsedTrial: true,
      };
      }

      // Check and send milestone notifications (7, 3, 1 day) — fire-and-forget
      const user = ctx.user;
      checkAndSendTrialMilestoneNotification({
        providerId: provider.id,
        userId: user.id,
        email: user.email || undefined,
        providerName: provider.businessName,
        daysRemaining,
        trialEndsAt: new Date(sub.trialEndsAt!),
      }).catch(err => console.error("[Trial] Failed to send milestone notification:", err));

      return {
        isTrialing: true,
        trialExpired: false,
        trialTier: sub.tier,
        daysRemaining,
        trialEndsAt: sub.trialEndsAt,
        currentTier: entitlement.effectiveTier,
        entitlement,
        showUrgentNudge: daysRemaining <= 3,
        hasUsedTrial: true,
      };
    }

    // Check if trial was ever used (trialEndsAt is non-null even after expiry)
    const hasUsedTrial = sub.trialEndsAt != null;

    return {
      isTrialing: false,
      trialExpired: false,
      trialTier: null,
      daysRemaining: 0,
      trialEndsAt: null,
      currentTier: entitlement.effectiveTier,
      entitlement,
      hasUsedTrial,
    };
  }),

  // Select free tier explicitly during onboarding (creates a subscription record)
  selectFreeTier: protectedProcedure.mutation(async ({ ctx }) => {
    const provider = await db.getProviderByUserId(ctx.user.id);
    if (!provider) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Must be a provider" });
    }

    // Check if already has a subscription
    const existing = await db.getProviderSubscription(provider.id);
    if (existing && (existing.status === "active" || existing.status === "trialing")) {
      return { tier: existing.tier, status: existing.status };
    }

    // Create a free tier subscription record
    await db.upsertProviderSubscription({
      providerId: provider.id,
      tier: "free",
      status: "active",
    });

    return { tier: "free" as const, status: "active" as const };
  }),

  // Get current provider's subscription
  mySubscription: protectedProcedure.query(async ({ ctx }) => {
    const provider = await db.getProviderByUserId(ctx.user.id);
    if (!provider) return null;

    const subscription = await db.getProviderSubscription(provider.id);
    const tier = await db.getProviderTier(provider.id);
    const entitlement = resolveProviderEntitlement(subscription);
    const serviceCount = await db.getActiveServiceCount(provider.id);
    const tierConfig = SUBSCRIPTION_TIERS[tier];

    // Get current billing interval from Stripe if subscription exists
    let currentInterval: "month" | "year" = "month";
    if (subscription?.stripeSubscriptionId && subscription.status === "active") {
      try {
        const stripeSub = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
        const item = stripeSub.items.data[0];
        if (item?.price.recurring?.interval) {
          currentInterval = item.price.recurring.interval as "month" | "year";
        }
      } catch (e) {
        if (isStripeResourceMissing(e)) {
          await db.clearProviderStripeSubscriptionReference(provider.id);
        }
        // If Stripe call fails, default to month without failing the dashboard.
      }
    }

    return {
      subscription,
      currentTier: tier,
      entitlement,
      currentInterval,
      tierConfig,
      usage: {
        servicesUsed: serviceCount,
        servicesLimit: tierConfig.limits.maxServices,
      },
    };
  }),

  // Create checkout session for subscription
  createCheckout: protectedProcedure
    .input(z.object({
      tier: z.enum(["basic", "premium"]),
      interval: z.enum(["month", "year"]).default("month"),
      withTrial: z.boolean().default(false),
      returnTo: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const provider = await db.getProviderByUserId(ctx.user.id);
      if (!provider) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Must be a provider to subscribe" });
      }
      assertProviderPaymentActor(ctx.user, provider);

      const currentSub = await db.getProviderSubscription(provider.id);
      const velocity = await assertPaymentVelocityAllowed({
        actorId: ctx.user.id,
        subjects: [
          { dimension: "account", key: String(ctx.user.id) },
          { dimension: "email", key: ctx.user.email || `user:${ctx.user.id}` },
          ...(currentSub?.stripeCustomerId ? [{ dimension: "stripe_customer" as const, key: currentSub.stripeCustomerId }] : []),
          { dimension: "provider", key: String(provider.id) },
          { dimension: "ip", key: ctx.req.ip || ctx.req.headers["x-forwarded-for"]?.toString().split(",")[0] || "unknown" },
        ],
      });
      throwIfPaymentVelocityBlocked(velocity);

      // Reuse every retained live Stripe subscription instead of creating a duplicate.
      if (currentSub?.stripeSubscriptionId) {
        let stripeSub: Stripe.Subscription | null = null;
        try {
          stripeSub = await stripe.subscriptions.retrieve(currentSub.stripeSubscriptionId);
        } catch (error) {
          if (!isStripeResourceMissing(error)) throw error;
          await db.clearProviderStripeSubscriptionReference(provider.id);
        }

        // If the Stripe subscription is actually canceled (e.g., trial ended without payment),
        // skip the in-place update and fall through to create a new checkout session
        if (!stripeSub) {
          // The local reference was stale; the new checkout below will create a fresh subscription.
        } else if (stripeSub.status === "canceled" || stripeSub.status === "incomplete_expired") {
          // Update local DB to reflect the actual canceled state
          await db.upsertProviderSubscription({
            providerId: provider.id,
            tier: "free",
            status: "cancelled",
          });
        } else {
        if (["past_due", "unpaid", "paused", "incomplete"].includes(stripeSub.status)) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Resolve the existing subscription in billing settings before changing plans.",
          });
        }
        const currentItem = stripeSub.items.data[0];
        const currentInterval = currentItem?.price.recurring?.interval as "month" | "year" || "month";
        if (stripeSub.cancel_at_period_end && currentSub.tier === input.tier && currentInterval === input.interval) {
          const reactivated = await stripe.subscriptions.update(currentSub.stripeSubscriptionId, {
            cancel_at_period_end: false,
          });
          const accessEndsAt = requireStripeSubscriptionPeriodEnd(reactivated as any);
          await db.upsertProviderSubscription({
            providerId: provider.id,
            tier: input.tier,
            status: "active",
            cancelAtPeriodEnd: false,
            currentPeriodEnd: accessEndsAt,
          });
          if (ctx.user.email) {
            await sendNotification({
              type: "subscription_resumed",
              channel: "email",
              recipient: { userId: ctx.user.id, email: ctx.user.email, name: ctx.user.name || undefined },
              data: {
                customerName: ctx.user.name || undefined,
                businessName: provider.businessName || undefined,
                tier: SUBSCRIPTION_TIERS[input.tier].name,
                accessEndsAt: accessEndsAt.toISOString(),
                noNewCharge: true,
              },
            });
          }
          await createSubscriptionInAppNotice({
            userId: ctx.user.id,
            type: "subscription_resumed",
            title: `${SUBSCRIPTION_TIERS[input.tier].name} will continue`,
            message: `The scheduled cancellation was removed. No new charge was created; the current period continues through ${accessEndsAt.toLocaleDateString("en-US")}.`,
            actionUrl: "/provider/subscription",
          });
          return { url: null, message: `Your ${SUBSCRIPTION_TIERS[input.tier].name} plan will continue. No new charge was created.` };
        }
        if (currentSub.tier === input.tier && currentInterval === input.interval) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Already subscribed to this tier and interval" });
        }

        // In-place update: same tier different interval, OR upgrade (basic→premium) with card on file
        const tierOrder: Record<string, number> = { free: 0, basic: 1, premium: 2 };
        const isUpgrade = tierOrder[input.tier] > tierOrder[currentSub.tier];
        const isSameTierIntervalSwitch = currentSub.tier === input.tier && currentInterval !== input.interval;

        if (tierOrder[input.tier] < tierOrder[currentSub.tier]) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Use the downgrade action to move to a lower plan." });
        }

        if (isSameTierIntervalSwitch || isUpgrade) {
          const newPriceId = await getOrCreateStripePrice(input.tier, input.interval);
          await stripe.subscriptions.update(currentSub.stripeSubscriptionId, {
            items: [{
              id: currentItem.id,
              price: newPriceId,
            }],
            proration_behavior: "create_prorations",
            cancel_at_period_end: false,
          });

          // Update local subscription record for tier upgrades
          if (isUpgrade) {
            await db.upsertProviderSubscription({
              providerId: provider.id,
              tier: input.tier,
              status: "active",
              cancelAtPeriodEnd: false,
            });
          }

          const message = isUpgrade
            ? `Upgraded to ${input.tier === "premium" ? "Business" : "Pro"}! Proration applied to your existing payment method.`
            : `Switched to ${input.interval === "year" ? "annual" : "monthly"} billing. Proration applied.`;
          return { url: null, message };
        }
        }
      }

      const priceId = await getOrCreateStripePrice(input.tier, input.interval);

      // Get or create Stripe customer
      let customerId = currentSub?.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: ctx.user.email || undefined,
          name: provider.businessName,
          metadata: {
            providerId: provider.id.toString(),
            userId: ctx.user.id.toString(),
          },
        });
        customerId = customer.id;
      }

      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: "subscription",
        success_url: input.returnTo
          ? `${ctx.req.headers.origin}${input.returnTo}?status=upgraded`
          : `${ctx.req.headers.origin}/provider/subscription?status=success`,
        cancel_url: input.returnTo
          ? `${ctx.req.headers.origin}${input.returnTo}`
          : `${ctx.req.headers.origin}/provider/subscription?status=cancelled`,
        metadata: {
          providerId: provider.id.toString(),
          userId: ctx.user.id.toString(),
          tier: input.tier,
          type: "provider_subscription",
        },
        allow_promotion_codes: true,
      };

      if (input.withTrial) {
        sessionParams.subscription_data = {
          trial_period_days: getTrialDays(),
          metadata: {
            providerId: provider.id.toString(),
            tier: input.tier,
            type: "provider_subscription",
          },
        };
      } else {
        sessionParams.subscription_data = {
          metadata: {
            providerId: provider.id.toString(),
            tier: input.tier,
            type: "provider_subscription",
          },
        };
      }

      const session = await stripe.checkout.sessions.create(sessionParams);
      return { url: session.url };
    }),

  // Create portal session for managing subscription
  createPortalSession: protectedProcedure.mutation(async ({ ctx }) => {
    const provider = await db.getProviderByUserId(ctx.user.id);
    if (!provider) throw new TRPCError({ code: "FORBIDDEN", message: "Must be a provider" });

    const sub = await db.getProviderSubscription(provider.id);
    if (!sub?.stripeCustomerId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "No active subscription found" });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${ctx.req.headers.origin}/provider/subscription`,
    });

    return { url: session.url };
  }),

  // Check feature access for current tier
  checkAccess: protectedProcedure
    .input(z.object({
      feature: z.enum(["customSlug", "prioritySearch", "customBranding", "analyticsAccess", "premiumSupport", "featuredListing"]),
    }))
    .query(async ({ ctx, input }) => {
      const provider = await db.getProviderByUserId(ctx.user.id);
      if (!provider) return { allowed: false, currentTier: "free" as const, requiredTier: "basic" as const };

      const tier = await db.getProviderTier(provider.id);
      const allowed = providerHasFeature(tier, input.feature);

      // Find minimum tier that allows this feature
      let requiredTier: SubscriptionTier = "premium";
      for (const t of ["free", "basic", "premium"] as SubscriptionTier[]) {
        if (providerHasFeature(t, input.feature)) {
          requiredTier = t;
          break;
        }
      }

      return { allowed, currentTier: tier, requiredTier };
    }),

  // Downgrade paid subscriptions without taking away already-purchased access.
  downgrade: protectedProcedure
    .input(z.object({
      targetTier: z.enum(["free", "basic"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const provider = await db.getProviderByUserId(ctx.user.id);
      if (!provider) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Must be a provider" });
      }

      const sub = await db.getProviderSubscription(provider.id);
      if (!sub) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No subscription found" });
      }

      const currentTier = sub.tier;
      const targetTier = input.targetTier;
      const entitlement = resolveProviderEntitlement(sub);

      // Trial expiry already resolves access to Starter before this button is
      // clicked. Treat confirming that effective free tier as an idempotent
      // acknowledgement: no Stripe cancellation, checkout, or notification.
      if (
        targetTier === "free" &&
        entitlement.effectiveTier === "free" &&
        (entitlement.state === "trial_expired" || sub.tier === "free")
      ) {
        const alreadyNormalized = sub.tier === "free" && sub.status === "active" && !sub.cancelAtPeriodEnd;
        if (!alreadyNormalized) {
          await db.upsertProviderSubscription({
            providerId: provider.id,
            tier: "free",
            status: "active",
            cancelAtPeriodEnd: false,
            currentPeriodStart: undefined,
            currentPeriodEnd: undefined,
          });
        }

        return {
          success: true,
          newTier: "free" as const,
          unchanged: alreadyNormalized,
          message: "You're continuing with Starter (Free).",
        };
      }

      // Validate this is actually a downgrade
      const tierOrder: Record<string, number> = { free: 0, basic: 1, premium: 2 };
      if (tierOrder[targetTier] >= tierOrder[currentTier]) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Target tier must be lower than current tier" });
      }

      // Paid plan → Starter: schedule cancellation at period end. This avoids
      // duplicate charges and keeps the provider's purchased access unambiguous.
      if (targetTier === "free") {
        if (sub.stripeSubscriptionId) {
          try {
            const stripeSubscription = await stripe.subscriptions.update(sub.stripeSubscriptionId, {
              cancel_at_period_end: true,
            });
            const periodEnd = requireStripeSubscriptionPeriodEnd(stripeSubscription as any);

            await db.upsertProviderSubscription({
              providerId: provider.id,
              tier: currentTier,
              status: "active",
              cancelAtPeriodEnd: true,
              stripeSubscriptionId: sub.stripeSubscriptionId,
              stripeCustomerId: sub.stripeCustomerId || undefined,
              currentPeriodEnd: periodEnd,
            });

            if (ctx.user.email) {
              await sendNotification({
                type: "subscription_downgraded",
                channel: "email",
                recipient: { userId: ctx.user.id, email: ctx.user.email, name: ctx.user.name || undefined },
                data: {
                  tier: "Starter (Free)",
                  previousTier: SUBSCRIPTION_TIERS[currentTier].name,
                  businessName: provider.businessName || undefined,
                  accessEndsAt: periodEnd.toISOString(),
                },
              });
            }
            await createSubscriptionInAppNotice({
              userId: ctx.user.id,
              type: "subscription_downgraded",
              title: "Starter downgrade scheduled",
              message: `${SUBSCRIPTION_TIERS[currentTier].name} remains active through ${periodEnd.toLocaleDateString("en-US")}. Starter begins after that date.`,
              actionUrl: "/provider/subscription",
            });

            return {
              success: true,
              newTier: currentTier,
              scheduledTier: "free" as const,
              accessEndsAt: periodEnd,
              message: `${SUBSCRIPTION_TIERS[currentTier].name} remains active until ${periodEnd.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}. Starter begins after that date.`,
            };
          } catch (err: any) {
            console.error("[Downgrade] Failed to schedule Stripe cancellation:", err.message);
            if (!err.message?.includes("No such subscription")) {
              throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to downgrade subscription" });
            }
          }
        }

        // Trials or legacy local grants have no Stripe period to preserve.
        await db.upsertProviderSubscription({
          providerId: provider.id,
          tier: "free",
          status: "active",
          cancelAtPeriodEnd: false,
          stripeSubscriptionId: undefined,
          stripeCustomerId: sub.stripeCustomerId || undefined, // Keep customer ID for future re-subscribe
          currentPeriodStart: undefined,
          currentPeriodEnd: undefined,
        });

        // Send downgrade notification
        if (ctx.user.email) {
          await sendNotification({
            type: "subscription_downgraded",
            channel: "email",
            recipient: { userId: ctx.user.id, email: ctx.user.email, name: ctx.user.name || undefined },
            data: {
              tier: "Starter (Free)",
              previousTier: SUBSCRIPTION_TIERS[currentTier].name,
              businessName: provider.businessName || undefined,
            },
          });
        }

        return { success: true, newTier: "free" as const, message: "Downgraded to Starter (Free)." };
      }

      // If downgrading from premium to basic, switch the subscription price immediately
      if (currentTier === "premium" && targetTier === "basic") {
        if (!sub.stripeSubscriptionId) {
          // No Stripe subscription (e.g. trial) — just update locally
          await db.upsertProviderSubscription({
            providerId: provider.id,
            tier: "basic",
            status: sub.status,
          });
          return { success: true, newTier: "basic" as const, message: "Downgraded to Pro." };
        }

        try {
          // Get the current subscription from Stripe
          const stripeSubscription = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
          const currentItem = stripeSubscription.items.data[0];

          if (!currentItem) {
            throw new Error("No subscription item found");
          }

          // Get the interval from the current subscription
          const currentInterval = currentItem.price.recurring?.interval as "month" | "year" || "month";
          
          // Get or create the new price for the basic tier
          const newPriceId = await getOrCreateStripePrice("basic", currentInterval);

          // Update the subscription with the new price (immediate proration)
          await stripe.subscriptions.update(sub.stripeSubscriptionId, {
            items: [{
              id: currentItem.id,
              price: newPriceId,
            }],
            proration_behavior: "create_prorations", // Immediate prorated credit
            cancel_at_period_end: false,
          });

          // Update local subscription record
          await db.upsertProviderSubscription({
            providerId: provider.id,
            tier: "basic",
            status: "active",
            cancelAtPeriodEnd: false,
          });

          // Send downgrade notification
          if (ctx.user.email) {
            await sendNotification({
              type: "subscription_downgraded",
              channel: "email",
              recipient: { userId: ctx.user.id, email: ctx.user.email, name: ctx.user.name || undefined },
              data: {
                tier: SUBSCRIPTION_TIERS.basic.name,
                previousTier: SUBSCRIPTION_TIERS.premium.name,
                businessName: provider.businessName || undefined,
              },
            });
          }

          return { success: true, newTier: "basic" as const, message: "Downgraded to Pro. Prorated credit applied." };
        } catch (err: any) {
          console.error("[Downgrade] Failed to update Stripe subscription:", err.message);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to downgrade subscription" });
        }
      }

      throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid downgrade path" });
    }),

  // Change billing interval (monthly <-> annual) for same tier
  changeBillingInterval: protectedProcedure
    .input(z.object({
      interval: z.enum(["month", "year"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const provider = await db.getProviderByUserId(ctx.user.id);
      if (!provider) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Must be a provider" });
      }

      const sub = await db.getProviderSubscription(provider.id);
      if (!sub || !sub.stripeSubscriptionId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No active subscription found" });
      }

      if (sub.tier === "free") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Free tier has no billing interval" });
      }

      // Retrieve the Stripe subscription
      const stripeSubscription = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
      const currentItem = stripeSubscription.items.data[0];
      if (!currentItem) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No subscription item found" });
      }

      const currentInterval = currentItem.price.recurring?.interval as "month" | "year" || "month";
      if (currentInterval === input.interval) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Already on ${input.interval}ly billing` });
      }

      // Get or create the new price for the same tier but different interval
      const newPriceId = await getOrCreateStripePrice(sub.tier as "basic" | "premium", input.interval);

      // Update the subscription with proration
      await stripe.subscriptions.update(sub.stripeSubscriptionId, {
        items: [{
          id: currentItem.id,
          price: newPriceId,
        }],
        proration_behavior: "create_prorations",
        cancel_at_period_end: false,
      });

      await db.upsertProviderSubscription({
        providerId: provider.id,
        tier: sub.tier,
        status: "active",
        cancelAtPeriodEnd: false,
      });

      return {
        success: true,
        message: `Switched to ${input.interval === "year" ? "annual" : "monthly"} billing. Proration applied automatically.`,
      };
    }),

  // Pause subscription (up to 30 days)
  pause: protectedProcedure
    .input(z.object({
      resumeDate: z.string().optional(), // ISO date string when to auto-resume
    }))
    .mutation(async ({ ctx, input }) => {
      const provider = await db.getProviderByUserId(ctx.user.id);
      if (!provider) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Must be a provider" });
      }

      const sub = await db.getProviderSubscription(provider.id);
      if (!sub || !sub.stripeSubscriptionId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No active subscription to pause" });
      }

      if (sub.status === "paused") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Subscription is already paused" });
      }

      if (sub.status !== "active") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only active subscriptions can be paused" });
      }

      // Calculate resume date (default 30 days, max 30 days)
      const now = new Date();
      let resumesAt: Date;
      if (input.resumeDate) {
        resumesAt = new Date(input.resumeDate);
        const maxDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        if (resumesAt > maxDate) resumesAt = maxDate;
        if (resumesAt <= now) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Resume date must be in the future" });
        }
      } else {
        resumesAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      }

      // Pause the Stripe subscription
      try {
        await stripe.subscriptions.update(sub.stripeSubscriptionId, {
          pause_collection: {
            behavior: "void",
            resumes_at: Math.floor(resumesAt.getTime() / 1000),
          },
        });
      } catch (err: any) {
        console.error("[Pause] Failed to pause Stripe subscription:", err.message);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to pause subscription" });
      }

      // Update local record
      await db.upsertProviderSubscription({
        providerId: provider.id,
        tier: sub.tier,
        status: "paused",
        pausedAt: now,
        resumesAt: resumesAt,
      });

      // Send notification
      if (ctx.user.email) {
        await sendNotification({
          type: "subscription_paused",
          channel: "email",
          recipient: { userId: ctx.user.id, email: ctx.user.email, name: ctx.user.name || undefined },
          data: {
            tier: SUBSCRIPTION_TIERS[sub.tier].name,
            businessName: provider.businessName || undefined,
            resumeDate: resumesAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
          },
        });
      }

      return {
        success: true,
        pausedAt: now.toISOString(),
        resumesAt: resumesAt.toISOString(),
        message: `Subscription paused. Will auto-resume on ${resumesAt.toLocaleDateString()}.`,
      };
    }),

  // Resume a paused subscription
  resume: protectedProcedure.mutation(async ({ ctx }) => {
    const provider = await db.getProviderByUserId(ctx.user.id);
    if (!provider) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Must be a provider" });
    }

    const sub = await db.getProviderSubscription(provider.id);
    if (!sub || !sub.stripeSubscriptionId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "No subscription found" });
    }

    if (sub.status !== "paused") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Subscription is not paused" });
    }

    // Resume the Stripe subscription
    try {
      await stripe.subscriptions.update(sub.stripeSubscriptionId, {
        pause_collection: "",  // Remove pause
      } as any);
    } catch (err: any) {
      console.error("[Resume] Failed to resume Stripe subscription:", err.message);
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to resume subscription" });
    }

    // Update local record
    await db.upsertProviderSubscription({
      providerId: provider.id,
      tier: sub.tier,
      status: "active",
      pausedAt: null,
      resumesAt: null,
    });

    // Send notification
    if (ctx.user.email) {
      await sendNotification({
        type: "subscription_resumed",
        channel: "email",
        recipient: { userId: ctx.user.id, email: ctx.user.email, name: ctx.user.name || undefined },
        data: {
          tier: SUBSCRIPTION_TIERS[sub.tier].name,
          businessName: provider.businessName || undefined,
        },
      });
    }

    return {
      success: true,
      message: "Subscription resumed! Your plan is active again.",
    };
  }),

  // Get billing history (invoices + charges from Stripe)
  billingHistory: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(25),
      startingAfter: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const provider = await db.getProviderByUserId(ctx.user.id);
      if (!provider) throw new TRPCError({ code: "FORBIDDEN", message: "Must be a provider" });

      const sub = await db.getProviderSubscription(provider.id);
      if (!sub?.stripeCustomerId) {
        // No Stripe customer yet — return empty with subscription events from DB
        const events: Array<{
          id: string;
          type: "subscription_change" | "invoice" | "payment" | "refund" | "trial";
          date: string;
          description: string;
          amount: number | null;
          status: string;
          invoicePdfUrl: string | null;
        }> = [];

        const entitlement = resolveProviderEntitlement(sub);
        if (sub && entitlement.state === "cancelling" && entitlement.accessEndsAt) {
          events.push({
            id: `cancelling_${sub.providerId}`,
            type: "subscription_change",
            date: new Date(sub.updatedAt || Date.now()).toISOString(),
            description: `Starter scheduled for ${entitlement.accessEndsAt.toLocaleDateString("en-US")}; paid access continues until then`,
            amount: null,
            status: "scheduled",
            invoicePdfUrl: null,
          });
        } else if (sub && entitlement.requiresBillingAction) {
          events.push({
            id: `billing_action_${sub.providerId}`,
            type: "subscription_change",
            date: new Date(sub.updatedAt || Date.now()).toISOString(),
            description: "Subscription billing needs attention",
            amount: null,
            status: "action_required",
            invoicePdfUrl: null,
          });
        }

        // Add trial start event if applicable
        if (sub?.status === "trialing" && sub.currentPeriodStart) {
          events.push({
            id: `trial_${sub.providerId}`,
            type: "trial",
            date: new Date(sub.currentPeriodStart).toISOString(),
            description: `Started 14-day ${sub.tier === "premium" ? "Business" : "Pro"} trial`,
            amount: null,
            status: "active",
            invoicePdfUrl: null,
          });
        }

        // Add plan selection event
        if (sub) {
          events.push({
            id: `plan_${sub.providerId}`,
            type: "subscription_change",
            date: new Date(sub.currentPeriodStart || sub.createdAt || Date.now()).toISOString(),
            description: `Selected ${sub.tier === "premium" ? "Business" : sub.tier === "basic" ? "Pro" : "Starter"} plan`,
            amount: null,
            status: sub.status,
            invoicePdfUrl: null,
          });
        }

        return { items: events, hasMore: false, nextCursor: null };
      }

      // Fetch invoices from Stripe
      const params: any = {
        customer: sub.stripeCustomerId,
        limit: input?.limit || 25,
        expand: ["data.charge"],
      };
      if (input?.startingAfter) {
        params.starting_after = input.startingAfter;
      }

      const invoices = await stripe.invoices.list(params);

      const items = invoices.data.map((inv) => {
        let description = "";
        if (inv.lines?.data?.[0]?.description) {
          description = inv.lines.data[0].description;
        } else if (inv.description) {
          description = inv.description;
        } else {
          description = `Invoice #${inv.number || inv.id.slice(-8)}`;
        }

        let status = inv.status || "unknown";
        if (inv.status === "paid") status = "paid";
        else if (inv.status === "open") status = "pending";
        else if (inv.status === "void") status = "voided";
        else if (inv.status === "uncollectible") status = "failed";

        return {
          id: inv.id,
          type: "invoice" as const,
          date: new Date((inv.created || 0) * 1000).toISOString(),
          description,
          amount: inv.amount_paid || inv.total || 0,
          status,
          invoicePdfUrl: inv.invoice_pdf || null,
        };
      });

      // Prepend subscription events from DB
      const events: Array<{
        id: string;
        type: "subscription_change" | "invoice" | "payment" | "refund" | "trial";
        date: string;
        description: string;
        amount: number | null;
        status: string;
        invoicePdfUrl: string | null;
      }> = [];

      const entitlement = resolveProviderEntitlement(sub);
      if (entitlement.state === "cancelling" && entitlement.accessEndsAt) {
        events.push({
          id: `cancelling_${sub.providerId}`,
          type: "subscription_change",
          date: new Date(sub.updatedAt || Date.now()).toISOString(),
          description: `Starter scheduled for ${entitlement.accessEndsAt.toLocaleDateString("en-US")}; paid access continues until then`,
          amount: null,
          status: "scheduled",
          invoicePdfUrl: null,
        });
      } else if (entitlement.requiresBillingAction) {
        events.push({
          id: `billing_action_${sub.providerId}`,
          type: "subscription_change",
          date: new Date(sub.updatedAt || Date.now()).toISOString(),
          description: "Subscription billing needs attention",
          amount: null,
          status: "action_required",
          invoicePdfUrl: null,
        });
      }

      // Add trial event if applicable
      if (sub.status === "trialing" || (sub.trialEndsAt && new Date(sub.trialEndsAt) > new Date(sub.currentPeriodStart || 0))) {
        events.push({
          id: `trial_${sub.providerId}`,
          type: "trial",
          date: new Date(sub.currentPeriodStart || Date.now()).toISOString(),
          description: `Started 14-day ${sub.tier === "premium" ? "Business" : "Pro"} trial (no charge)`,
          amount: null,
          status: sub.status === "trialing" ? "active" : "ended",
          invoicePdfUrl: null,
        });
      }

      // Combine and sort by date descending
      const allItems = [...events, ...items].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      return { items: allItems, hasMore: invoices.has_more, nextCursor: invoices.data[invoices.data.length - 1]?.id || null };
    }),

  // Admin: get subscription analytics
  getAnalytics: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
    }
    return await getEffectiveSubscriptionAnalytics();
  }),
});
