import { z } from "zod";
import { TRPCError } from "@trpc/server";
import Stripe from "stripe";
import { protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { CUSTOMER_TIERS, CUSTOMER_STRIPE_PRODUCT_NAME, type CustomerTier } from "./customerSubscription";
import { ENV } from "./_core/env";
import { sendNotification } from "./notifications";
import { customerHasFeature, resolveCustomerEntitlement } from "../shared/entitlements";
import { isStripeResourceMissing, requireStripeSubscriptionPeriodEnd } from "./stripeSubscriptionLifecycle";
import { createSubscriptionInAppNotice } from "./subscriptionNotifications";
import { assertPaymentActorCanInitiate } from "./paymentAuthorization";

const stripe = new Stripe(ENV.stripeSecretKey, { apiVersion: "2026-01-28.clover" as any });

// Cache for Stripe price IDs
const priceCache = new Map<string, string>();

async function getOrCreateCustomerStripePrice(tier: "pro" | "business", interval: "month" | "year"): Promise<string> {
  const cacheKey = `customer_${tier}_${interval}`;
  if (priceCache.has(cacheKey)) return priceCache.get(cacheKey)!;

  const config = CUSTOMER_TIERS[tier];
  const amount = interval === "month" ? config.monthlyPrice : config.yearlyPrice;

  // Search for existing product
  const products = await stripe.products.search({
    query: `name:"${CUSTOMER_STRIPE_PRODUCT_NAME} - ${config.name}"`,
  });

  let productId: string;
  if (products.data.length > 0) {
    productId = products.data[0].id;
  } else {
    const product = await stripe.products.create({
      name: `${CUSTOMER_STRIPE_PRODUCT_NAME} - ${config.name}`,
      description: `OlogyCrew ${config.name} plan for customers`,
      metadata: { tier, type: "customer" },
    });
    productId = product.id;
  }

  // Search for existing price
  const prices = await stripe.prices.list({
    product: productId,
    active: true,
    recurring: { interval },
  });

  const targetAmount = Math.round(amount * 100);
  const existingPrice = prices.data.find(
    (p) => p.unit_amount === targetAmount && p.recurring?.interval === interval
  );

  if (existingPrice) {
    priceCache.set(cacheKey, existingPrice.id);
    return existingPrice.id;
  }

  const price = await stripe.prices.create({
    product: productId,
    unit_amount: targetAmount,
    currency: "usd",
    recurring: { interval },
    metadata: { tier, type: "customer" },
  });

  priceCache.set(cacheKey, price.id);
  return price.id;
}

export const customerSubscriptionRouter = router({
  // Get current subscription status
  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    const subscription = await db.getCustomerSubscription(ctx.user.id);
    const tier = await db.getCustomerTier(ctx.user.id);
    const entitlement = resolveCustomerEntitlement(subscription);
    const favoriteCount = await db.getUserFavoriteCount(ctx.user.id);
    const tierConfig = CUSTOMER_TIERS[tier];

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
          await db.clearCustomerStripeSubscriptionReference(ctx.user.id);
        }
        // If Stripe call fails, default to month without failing the account page.
      }
    }

    return {
      subscription,
      currentTier: tier,
      entitlement,
      currentInterval,
      tierConfig,
      usage: {
        savedProviders: favoriteCount,
        savedProviderLimit: tierConfig.savedProviderLimit,
        isAtLimit: tierConfig.savedProviderLimit !== -1 && favoriteCount >= tierConfig.savedProviderLimit,
      },
    };
  }),

  // Get all tier configs for pricing page
  getTiers: protectedProcedure.query(() => {
    return CUSTOMER_TIERS;
  }),

  // Create checkout session for customer subscription
  createCheckout: protectedProcedure
    .input(z.object({
      tier: z.enum(["pro", "business"]),
      interval: z.enum(["month", "year"]).default("month"),
      withTrial: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      assertPaymentActorCanInitiate(ctx.user, "customer_subscription");
      const existingSubForCheck = await db.getCustomerSubscription(ctx.user.id);
      if (existingSubForCheck?.stripeSubscriptionId) {
        // Reuse every retained live Stripe subscription instead of creating a duplicate.
        let stripeSub: Stripe.Subscription | null = null;
        try {
          stripeSub = await stripe.subscriptions.retrieve(existingSubForCheck.stripeSubscriptionId);
        } catch (error) {
          if (!isStripeResourceMissing(error)) throw error;
          await db.clearCustomerStripeSubscriptionReference(ctx.user.id);
        }
        // If the Stripe subscription is canceled (e.g., trial ended), skip update and create new checkout
        if (stripeSub && stripeSub.status !== "canceled" && stripeSub.status !== "incomplete_expired") {
        if (["past_due", "unpaid", "paused", "incomplete"].includes(stripeSub.status)) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Resolve the existing subscription in billing settings before changing plans.",
          });
        }
        const currentItem = stripeSub.items.data[0];
        const currentInterval = currentItem?.price.recurring?.interval as "month" | "year" || "month";
        if (stripeSub.cancel_at_period_end && existingSubForCheck.tier === input.tier && currentInterval === input.interval) {
          const reactivated = await stripe.subscriptions.update(existingSubForCheck.stripeSubscriptionId, {
            cancel_at_period_end: false,
          });
          const accessEndsAt = requireStripeSubscriptionPeriodEnd(reactivated as any);
          await db.upsertCustomerSubscription({
            userId: ctx.user.id,
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
                tier: CUSTOMER_TIERS[input.tier].name,
                accessEndsAt: accessEndsAt.toISOString(),
                noNewCharge: true,
              },
            });
          }
          await createSubscriptionInAppNotice({
            userId: ctx.user.id,
            type: "subscription_resumed",
            title: `${CUSTOMER_TIERS[input.tier].name} will continue`,
            message: `The scheduled cancellation was removed. No new charge was created; the current period continues through ${accessEndsAt.toLocaleDateString("en-US")}.`,
            actionUrl: "/customer/subscription",
          });
          return { url: null, message: `Your ${CUSTOMER_TIERS[input.tier].name} plan will continue. No new charge was created.` };
        }
        if (existingSubForCheck.tier === input.tier && currentInterval === input.interval) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Already subscribed to this tier and interval" });
        }

        const tierOrder: Record<CustomerTier, number> = { free: 0, pro: 1, business: 2 };
        if (tierOrder[input.tier] < tierOrder[existingSubForCheck.tier as CustomerTier]) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Use the downgrade action to move to a lower plan." });
        }

        // Upgrade or change the interval in place, clearing any pending cancellation.
        const newPriceId = await getOrCreateCustomerStripePrice(input.tier, input.interval);
        await stripe.subscriptions.update(existingSubForCheck.stripeSubscriptionId, {
          items: [{
            id: currentItem.id,
            price: newPriceId,
          }],
          proration_behavior: "create_prorations",
          cancel_at_period_end: false,
        });
        await db.upsertCustomerSubscription({
          userId: ctx.user.id,
          tier: input.tier,
          status: "active",
          cancelAtPeriodEnd: false,
        });
        const isUpgrade = tierOrder[input.tier] > tierOrder[existingSubForCheck.tier as CustomerTier];
        return {
          url: null,
          message: isUpgrade
            ? `Upgraded to ${CUSTOMER_TIERS[input.tier].name}. Proration applied to the existing subscription.`
            : `Switched to ${input.interval === "year" ? "annual" : "monthly"} billing. Proration applied.`,
        };
        }
      }

      const priceId = await getOrCreateCustomerStripePrice(input.tier, input.interval);

      // Get or create Stripe customer
      const existingSub = await db.getCustomerSubscription(ctx.user.id);
      let customerId = existingSub?.stripeCustomerId;

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: ctx.user.email || undefined,
          name: ctx.user.name || undefined,
          metadata: {
            userId: ctx.user.id.toString(),
            type: "customer",
          },
        });
        customerId = customer.id;
      }

      // Check if user has already used a trial (reuse existingSub from above)
      const hasUsedTrial = existingSub?.trialEndsAt != null;
      const shouldApplyTrial = input.withTrial && !hasUsedTrial;

      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: "subscription",
        success_url: `${ctx.req.headers.origin}/saved-providers?status=success`,
        cancel_url: `${ctx.req.headers.origin}/pricing?status=cancelled`,
        metadata: {
          userId: ctx.user.id.toString(),
          tier: input.tier,
          type: "customer_subscription",
        },
        allow_promotion_codes: true,
      };

      if (shouldApplyTrial) {
        sessionParams.subscription_data = {
          trial_period_days: 14,
          metadata: {
            userId: ctx.user.id.toString(),
            tier: input.tier,
            type: "customer_subscription",
          },
        };
      } else {
        sessionParams.subscription_data = {
          metadata: {
            userId: ctx.user.id.toString(),
            tier: input.tier,
            type: "customer_subscription",
          },
        };
      }

      const session = await stripe.checkout.sessions.create(sessionParams);

      return { url: session.url };
    }),

  // Create portal session for managing subscription
  createPortalSession: protectedProcedure.mutation(async ({ ctx }) => {
    const sub = await db.getCustomerSubscription(ctx.user.id);
    if (!sub?.stripeCustomerId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "No active subscription found" });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${ctx.req.headers.origin}/saved-providers`,
    });

    return { url: session.url };
  }),

  // Booking analytics (Business tier only)
  bookingAnalytics: protectedProcedure.query(async ({ ctx }) => {
    const tier = await db.getCustomerTier(ctx.user.id);
    if (!customerHasFeature(tier, "bookingAnalytics")) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Booking analytics is available for Manager subscribers. Upgrade to access spending insights.",
      });
    }

    const [summary, monthlySpending, topProviders, categoryBreakdown, recentBookings] = await Promise.all([
      db.getCustomerSpendingSummary(ctx.user.id),
      db.getCustomerMonthlySpending(ctx.user.id, 12),
      db.getCustomerTopProviders(ctx.user.id, 10),
      db.getCustomerCategoryBreakdown(ctx.user.id),
      db.getCustomerRecentBookings(ctx.user.id, 20),
    ]);

    return { summary, monthlySpending, topProviders, categoryBreakdown, recentBookings };
  }),

  // Export booking history (Business tier only)
  exportBookings: protectedProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      format: z.enum(["csv", "json"]).default("csv"),
    }))
    .query(async ({ ctx, input }) => {
      const tier = await db.getCustomerTier(ctx.user.id);
      if (!customerHasFeature(tier, "bookingExports")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Booking export is available for Manager subscribers.",
        });
      }

      const bookings = await db.getCustomerBookingsForExport(
        ctx.user.id,
        input.startDate,
        input.endDate,
      );

      if (input.format === "csv") {
        const headers = [
          "Booking #", "Date", "Start Time", "End Time", "Duration (min)",
          "Status", "Type", "Location Type", "Service", "Provider",
          "Category", "Subtotal", "Travel Fee", "Platform Fee", "Total", "Notes",
        ];
        const rows = bookings.map(b => [
          b.bookingNumber,
          b.bookingDate,
          b.startTime,
          b.endTime,
          b.durationMinutes,
          b.status,
          b.bookingType,
          b.locationType,
          `"${(b.serviceName || "").replace(/"/g, '""')}"`,
          `"${(b.businessName || "").replace(/"/g, '""')}"`,
          `"${(b.categoryName || "").replace(/"/g, '""')}"`,
          b.subtotal,
          b.travelFee,
          b.platformFee,
          b.totalAmount,
          `"${(b.customerNotes || "").replace(/"/g, '""')}"`,
        ]);

        const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        return { data: csv, count: bookings.length, format: "csv" as const };
      }

      return { data: JSON.stringify(bookings, null, 2), count: bookings.length, format: "json" as const };
    }),

  // Downgrade paid subscriptions without taking away already-purchased access.
  downgrade: protectedProcedure
    .input(z.object({
      targetTier: z.enum(["free", "pro"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const targetTier = input.targetTier;
      const sub = await db.getCustomerSubscription(ctx.user.id);
      const entitlement = resolveCustomerEntitlement(sub);
      const currentTier = entitlement.effectiveTier;

      // Trial expiry already resolves access to Individual before this button is
      // clicked. Treat confirming that effective free tier as an idempotent
      // acknowledgement: no Stripe cancellation, checkout, or notification.
      if (
        targetTier === "free" &&
        currentTier === "free" &&
        (entitlement.state === "trial_expired" || sub?.tier === "free")
      ) {
        const alreadyNormalized = !!sub && sub.tier === "free" && sub.status === "active" && !sub.cancelAtPeriodEnd;
        if (sub && !alreadyNormalized) {
          await db.upsertCustomerSubscription({
            userId: ctx.user.id,
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
          message: "You're continuing with the Individual plan.",
        };
      }

      // Validate this is actually a downgrade
      const tierOrder: Record<string, number> = { free: 0, pro: 1, business: 2 };
      if (tierOrder[targetTier] >= tierOrder[currentTier]) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Target tier must be lower than current tier" });
      }

      // If downgrading to free, schedule cancellation at period end
      // This allows the user to re-upgrade without being charged again
      if (targetTier === "free") {
        if (sub?.stripeSubscriptionId) {
          try {
            const stripeSubscription = await stripe.subscriptions.update(sub.stripeSubscriptionId, {
              cancel_at_period_end: true,
            });
            const periodEnd = requireStripeSubscriptionPeriodEnd(stripeSubscription as any);

            await db.upsertCustomerSubscription({
              userId: ctx.user.id,
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
                  tier: "Individual",
                  previousTier: CUSTOMER_TIERS[currentTier].name,
                  customerName: ctx.user.name || undefined,
                  accessEndsAt: periodEnd.toISOString(),
                },
              });
            }
            await createSubscriptionInAppNotice({
              userId: ctx.user.id,
              type: "subscription_downgraded",
              title: "Individual downgrade scheduled",
              message: `${CUSTOMER_TIERS[currentTier].name} remains active through ${periodEnd.toLocaleDateString("en-US")}. Individual begins after that date.`,
              actionUrl: "/customer/subscription",
            });

            return {
              success: true,
              newTier: currentTier,
              scheduledTier: "free" as const,
              accessEndsAt: periodEnd,
              message: `${CUSTOMER_TIERS[currentTier].name} remains active until ${periodEnd.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}. Individual begins after that date.`,
            };
          } catch (err: any) {
            console.error("[Customer Downgrade] Failed to schedule subscription cancellation:", err.message);
            if (!err.message?.includes("No such subscription")) {
              throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to downgrade subscription" });
            }
          }
        }

        await db.upsertCustomerSubscription({
          userId: ctx.user.id,
          tier: "free",
          status: "active",
          cancelAtPeriodEnd: false,
          stripeSubscriptionId: undefined,
          stripeCustomerId: sub?.stripeCustomerId || undefined,
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
              tier: "Individual",
              previousTier: CUSTOMER_TIERS[currentTier].name,
              customerName: ctx.user.name || undefined,
            },
          });
        }

        return { success: true, newTier: "free" as const, message: "Downgraded to Individual." };
      }

      // If downgrading from business to pro, switch the subscription price immediately
      if (currentTier === "business" && targetTier === "pro") {
        if (!sub?.stripeSubscriptionId) {
          await db.upsertCustomerSubscription({
            userId: ctx.user.id,
            tier: "pro",
            status: sub?.status || "active",
          });
          return { success: true, newTier: "pro" as const, message: "Downgraded to Coordinator." };
        }

        try {
          const stripeSubscription = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
          const currentItem = stripeSubscription.items.data[0];

          if (!currentItem) {
            throw new Error("No subscription item found");
          }

          const currentInterval = currentItem.price.recurring?.interval as "month" | "year" || "month";
          const newPriceId = await getOrCreateCustomerStripePrice("pro", currentInterval);

          await stripe.subscriptions.update(sub.stripeSubscriptionId, {
            items: [{
              id: currentItem.id,
              price: newPriceId,
            }],
            proration_behavior: "create_prorations",
            cancel_at_period_end: false,
          });

          await db.upsertCustomerSubscription({
            userId: ctx.user.id,
            tier: "pro",
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
                tier: CUSTOMER_TIERS.pro.name,
                previousTier: CUSTOMER_TIERS.business.name,
                customerName: ctx.user.name || undefined,
              },
            });
          }

          return { success: true, newTier: "pro" as const, message: "Downgraded to Coordinator. Prorated credit applied." };
        } catch (err: any) {
          console.error("[Customer Downgrade] Failed to update Stripe subscription:", err.message);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to downgrade subscription" });
        }
      }

      throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid downgrade path" });
    }),

  // Pause customer subscription
  pause: protectedProcedure
    .input(z.object({
      resumeDate: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const sub = await db.getCustomerSubscription(ctx.user.id);
      if (!sub || !sub.stripeSubscriptionId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No active subscription to pause" });
      }

      if (sub.status === "paused") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Subscription is already paused" });
      }

      if (sub.status !== "active") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only active subscriptions can be paused" });
      }

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

      try {
        await stripe.subscriptions.update(sub.stripeSubscriptionId, {
          pause_collection: {
            behavior: "void",
            resumes_at: Math.floor(resumesAt.getTime() / 1000),
          },
        });
      } catch (err: any) {
        console.error("[Customer Pause] Failed to pause Stripe subscription:", err.message);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to pause subscription" });
      }

      await db.upsertCustomerSubscription({
        userId: ctx.user.id,
        tier: sub.tier as "pro" | "business",
        status: "paused",
        pausedAt: now,
        resumesAt: resumesAt,
      });

      if (ctx.user.email) {
        await sendNotification({
          type: "subscription_paused",
          channel: "email",
          recipient: { userId: ctx.user.id, email: ctx.user.email, name: ctx.user.name || undefined },
          data: {
            tier: CUSTOMER_TIERS[sub.tier as "pro" | "business"].name,
            customerName: ctx.user.name || undefined,
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

  // Resume customer subscription
  resume: protectedProcedure.mutation(async ({ ctx }) => {
    const sub = await db.getCustomerSubscription(ctx.user.id);
    if (!sub || !sub.stripeSubscriptionId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "No subscription found" });
    }

    if (sub.status !== "paused") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Subscription is not paused" });
    }

    try {
      await stripe.subscriptions.update(sub.stripeSubscriptionId, {
        pause_collection: "",
      } as any);
    } catch (err: any) {
      console.error("[Customer Resume] Failed to resume Stripe subscription:", err.message);
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to resume subscription" });
    }

    await db.upsertCustomerSubscription({
      userId: ctx.user.id,
      tier: sub.tier as "pro" | "business",
      status: "active",
      pausedAt: null,
      resumesAt: null,
    });

    if (ctx.user.email) {
      await sendNotification({
        type: "subscription_resumed",
        channel: "email",
        recipient: { userId: ctx.user.id, email: ctx.user.email, name: ctx.user.name || undefined },
        data: {
          tier: CUSTOMER_TIERS[sub.tier as "pro" | "business"].name,
          customerName: ctx.user.name || undefined,
        },
      });
    }

    return {
      success: true,
      message: "Subscription resumed! Your plan is active again.",
    };
  }),

  // Start 14-day free trial for customer (Coordinator tier)
  startTrial: protectedProcedure
    .input(z.object({
      tier: z.enum(["pro", "business"]).default("pro"),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if already has an active/trialing subscription
      const existing = await db.getCustomerSubscription(ctx.user.id);
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

      // Start 14-day trial
      const now = new Date();
      const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

      await db.upsertCustomerSubscription({
        userId: ctx.user.id,
        tier: input.tier,
        status: "trialing",
        trialEndsAt: trialEnd,
        currentPeriodStart: now,
        currentPeriodEnd: trialEnd,
      });

      // Send trial started notification (fire-and-forget)
      const tierConfig = CUSTOMER_TIERS[input.tier];
      if (ctx.user.email) {
        sendNotification({
          type: "trial_started",
          channel: "email",
          recipient: {
            userId: ctx.user.id,
            email: ctx.user.email,
            name: ctx.user.name || undefined,
          },
          data: {
            providerName: ctx.user.name || "there",
            trialEndDate: trialEnd.toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            }),
            dashboardUrl: "/saved-providers",
            tierName: tierConfig.name,
          },
        }).catch(err => console.error("[CustomerTrial] Failed to send trial_started notification:", err));
      }

      return { tier: input.tier, status: "trialing" as const, trialEndsAt: trialEnd };
    }),

  // Check and handle customer trial expiry (called on page load)
  checkTrialStatus: protectedProcedure.query(async ({ ctx }) => {
    const sub = await db.getCustomerSubscription(ctx.user.id);
    if (!sub) return null;
    const entitlement = resolveCustomerEntitlement(sub);

    // If trialing, check if expired
    if (sub.status === "trialing" && sub.trialEndsAt) {
      const now = new Date();
      const trialEnd = new Date(sub.trialEndsAt);
      const daysRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      if (daysRemaining <= 0) {
        // Trial expired — downgrade to free (keep trialEndsAt as historical record)
        await db.upsertCustomerSubscription({
          userId: ctx.user.id,
          tier: "free",
          status: "active",
          trialEndsAt: sub.trialEndsAt ? new Date(sub.trialEndsAt) : undefined,
          currentPeriodStart: undefined,
          currentPeriodEnd: undefined,
        });

        // Send trial expired notification (fire-and-forget)
        if (ctx.user.email) {
          sendNotification({
            type: "trial_expired",
            channel: "email",
            recipient: {
              userId: ctx.user.id,
              email: ctx.user.email,
              name: ctx.user.name || undefined,
            },
            data: {
              providerName: ctx.user.name || "there",
              upgradeUrl: "/pricing",
            },
          }).catch(err => console.error("[CustomerTrial] Failed to send trial_expired notification:", err));
        }

        return {
          isTrialing: false,
          trialExpired: true,
          daysRemaining: 0,
          trialEndsAt: sub.trialEndsAt,
          currentTier: "free" as const,
          requiresPayment: true,
          hasUsedTrial: true,
        };
      }

      return {
        isTrialing: true,
        trialExpired: false,
        daysRemaining,
        trialEndsAt: sub.trialEndsAt,
        currentTier: entitlement.effectiveTier,
        entitlement,
        showUrgentNudge: daysRemaining <= 3,
        requiresPayment: false,
        hasUsedTrial: true,
      };
    }

    // Check if trial was ever used (trialEndsAt is non-null even after expiry)
    const hasUsedTrial = sub.trialEndsAt != null;

    return {
      isTrialing: false,
      trialExpired: false,
      daysRemaining: 0,
      trialEndsAt: null,
      currentTier: entitlement.effectiveTier,
      entitlement,
      requiresPayment: false,
      hasUsedTrial,
    };
  }),

  // Billing history for customer subscription
  billingHistory: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(25),
      startingAfter: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const sub = await db.getCustomerSubscription(ctx.user.id);

      const events: Array<{
        id: string;
        type: "subscription_change" | "invoice" | "payment" | "refund" | "trial";
        date: string;
        description: string;
        amount: number | null;
        status: string;
        invoicePdfUrl: string | null;
      }> = [];

      const entitlement = resolveCustomerEntitlement(sub);
      if (sub && entitlement.state === "cancelling" && entitlement.accessEndsAt) {
        events.push({
          id: `cancelling_${sub.userId}`,
          type: "subscription_change",
          date: new Date(sub.updatedAt || Date.now()).toISOString(),
          description: `Individual scheduled for ${entitlement.accessEndsAt.toLocaleDateString("en-US")}; paid access continues until then`,
          amount: null,
          status: "scheduled",
          invoicePdfUrl: null,
        });
      } else if (sub && entitlement.requiresBillingAction) {
        events.push({
          id: `billing_action_${sub.userId}`,
          type: "subscription_change",
          date: new Date(sub.updatedAt || Date.now()).toISOString(),
          description: "Subscription billing needs attention",
          amount: null,
          status: "action_required",
          invoicePdfUrl: null,
        });
      }

      if (!sub?.stripeCustomerId) {
        // No Stripe customer yet — return events from DB only
        if (sub?.status === "trialing" && sub.trialEndsAt) {
          events.push({
            id: `trial_${sub.userId}`,
            type: "trial",
            date: new Date(sub.createdAt).toISOString(),
            description: `Started 14-day ${sub.tier === "business" ? "Manager" : "Coordinator"} trial`,
            amount: null,
            status: "active",
            invoicePdfUrl: null,
          });
        }

        if (sub) {
          events.push({
            id: `plan_${sub.userId}`,
            type: "subscription_change",
            date: new Date(sub.createdAt).toISOString(),
            description: `Selected ${sub.tier === "business" ? "Manager" : sub.tier === "pro" ? "Coordinator" : "Individual"} plan`,
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

      let invoices;
      try {
        invoices = await stripe.invoices.list(params);
      } catch (err: any) {
        // Handle invalid/deleted Stripe customer gracefully
        if (err?.code === "resource_missing" || err?.message?.includes("No such customer")) {
          // Return just the local events (trial, plan changes) without Stripe data
          if (sub.status === "trialing" || (sub.trialEndsAt && new Date(sub.trialEndsAt) > new Date(sub.createdAt))) {
            events.push({
              id: `trial_${sub.userId}`,
              type: "trial",
              date: new Date(sub.createdAt).toISOString(),
              description: `Started 14-day ${sub.tier === "business" ? "Manager" : "Coordinator"} trial (no charge)`,
              amount: null,
              status: sub.status === "trialing" ? "active" : "ended",
              invoicePdfUrl: null,
            });
          }
          events.push({
            id: `plan_${sub.userId}`,
            type: "subscription_change",
            date: new Date(sub.createdAt).toISOString(),
            description: `Selected ${sub.tier === "business" ? "Manager" : sub.tier === "pro" ? "Coordinator" : "Individual"} plan`,
            amount: null,
            status: sub.status,
            invoicePdfUrl: null,
          });
          return { items: events, hasMore: false, nextCursor: null };
        }
        throw err;
      }

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

      // Add trial event if applicable
      if (sub.status === "trialing" || (sub.trialEndsAt && new Date(sub.trialEndsAt) > new Date(sub.createdAt))) {
        events.push({
          id: `trial_${sub.userId}`,
          type: "trial",
          date: new Date(sub.createdAt).toISOString(),
          description: `Started 14-day ${sub.tier === "business" ? "Manager" : "Coordinator"} trial (no charge)`,
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

  // Check if user can save more providers (used before toggling favorite)
  canSaveMore: protectedProcedure.query(async ({ ctx }) => {
    const tier = await db.getCustomerTier(ctx.user.id);
    const count = await db.getUserFavoriteCount(ctx.user.id);
    const config = CUSTOMER_TIERS[tier];
    const limit = config.savedProviderLimit;
    const canSave = limit === -1 || count < limit;

    return {
      canSave,
      currentCount: count,
      limit,
      currentTier: tier,
      tierName: config.name,
    };
  }),
});
