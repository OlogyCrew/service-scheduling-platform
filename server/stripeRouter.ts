import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import Stripe from "stripe";
import { ENV } from "./_core/env";
import * as db from "./db";
import { getReferralCreditBalance, spendReferralCredits } from "./db/referrals";
import { providerHasFeature } from "@shared/entitlements";

const stripe = new Stripe(ENV.stripeSecretKey, {
  apiVersion: "2026-01-28.clover" as any,
});

const PLATFORM_FEE_RATE = 0.01; // 1% platform fee (revenue comes from subscriptions)

export const stripeRouter = router({
  /**
   * Preview how much credit can be applied to a booking before checkout.
   */
  previewCreditDiscount: protectedProcedure
    .input(z.object({
      bookingId: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const booking = await db.getBookingById(input.bookingId);
      if (!booking) return { creditBalance: "0.00", applicableCredit: "0.00", finalAmount: "0.00", originalAmount: "0.00", coversFullAmount: false };
      if (booking.customerId !== ctx.user.id) return { creditBalance: "0.00", applicableCredit: "0.00", finalAmount: "0.00", originalAmount: "0.00", coversFullAmount: false };

      const service = await db.getServiceById(booking.serviceId);
      if (!service) return { creditBalance: "0.00", applicableCredit: "0.00", finalAmount: "0.00", originalAmount: "0.00", coversFullAmount: false };

      // Determine original amount
      const amountToCharge = service.depositRequired
        ? parseFloat(booking.depositAmount || "0")
        : parseFloat(booking.totalAmount || "0");

      const creditBalance = parseFloat(await getReferralCreditBalance(ctx.user.id));
      const applicableCredit = Math.min(creditBalance, amountToCharge);
      const finalAmount = Math.max(0, amountToCharge - applicableCredit);

      return {
        creditBalance: creditBalance.toFixed(2),
        applicableCredit: applicableCredit.toFixed(2),
        finalAmount: finalAmount.toFixed(2),
        originalAmount: amountToCharge.toFixed(2),
        coversFullAmount: finalAmount <= 0,
      };
    }),

  createCheckoutSession: protectedProcedure
    .input(z.object({
      bookingId: z.number(),
      useCredits: z.boolean().optional().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const booking = await db.getBookingById(input.bookingId);
      if (!booking) throw new Error("Booking not found");
      if (booking.customerId !== ctx.user.id) throw new Error("Unauthorized");

      const service = await db.getServiceById(booking.serviceId);
      const provider = await db.getProviderById(booking.providerId);
      if (!service || !provider) throw new Error("Service or provider not found");

      if (provider.isActive === false || provider.deletedAt) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This provider is not currently accepting bookings or payments through OlogyCrew. No charge was created.",
        });
      }

      // Demo provider bypass: skip payment entirely for official/demo providers
      if (provider.isOfficial) {
        await db.updateBookingStatus(booking.id, "confirmed", {
          paidAt: new Date().toISOString(),
        });
        try {
          await db.createNotification({
            userId: ctx.user.id,
            notificationType: "payment",
            title: "Demo Booking Confirmed",
            message: `Your demo booking #${booking.bookingNumber} is confirmed — no payment required. This was a free demo experience.`,
            relatedBookingId: booking.id,
          });
        } catch (err) {
          console.error("[Stripe] Failed to create demo booking notification:", err);
        }
        return { url: null, paidWithCredits: false, creditApplied: "0.00", isDemo: true };
      }

      const providerTier = await db.getProviderTier(provider.id);
      if (!providerHasFeature(providerTier, "paymentCollection")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This provider is not currently accepting payments through OlogyCrew. No charge was created.",
        });
      }
      if (!provider.stripeAccountId || !provider.payoutEnabled) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "This provider has not finished payment setup. Your booking is saved, but no charge was created.",
        });
      }

      // Determine amount to charge (deposit or full amount)
      const originalAmount = service.depositRequired
        ? parseFloat(booking.depositAmount || "0")
        : parseFloat(booking.totalAmount || "0");

      if (originalAmount <= 0) throw new Error("Invalid payment amount");

      // Apply referral credits if requested
      let creditApplied = 0;
      if (input.useCredits) {
        const creditBalance = parseFloat(await getReferralCreditBalance(ctx.user.id));
        creditApplied = Math.min(creditBalance, originalAmount);
      }

      const finalAmount = originalAmount - creditApplied;

      // If credits cover the full amount, skip Stripe and mark as paid
      if (finalAmount <= 0) {
        // Spend the credits
        await spendReferralCredits(ctx.user.id, booking.id, originalAmount);

        // Mark booking as paid via credits
        await db.updateBookingStatus(booking.id, "confirmed", {
          paidAt: new Date().toISOString(),
        });

        // Create an in-app notification
        try {
          await db.createNotification({
            userId: ctx.user.id,
            notificationType: "payment",
            title: "Payment Completed with Credits",
            message: `Your booking #${booking.bookingNumber} was fully paid using $${originalAmount.toFixed(2)} in referral credits.`,
            relatedBookingId: booking.id,
          });
        } catch (err) {
          console.error("[Stripe] Failed to create credit payment notification:", err);
        }

        return { url: null, paidWithCredits: true, creditApplied: originalAmount.toFixed(2) };
      }

      // Spend partial credits before creating Stripe session
      if (creditApplied > 0) {
        await spendReferralCredits(ctx.user.id, booking.id, creditApplied);
      }

      const amountInCents = Math.round(finalAmount * 100);
      // Ensure minimum Stripe amount ($0.50)
      if (amountInCents < 50) {
        // If remaining amount is too small for Stripe, treat as fully covered by credits
        // Spend the extra tiny amount from credits
        await spendReferralCredits(ctx.user.id, booking.id, originalAmount - creditApplied);
        await db.updateBookingStatus(booking.id, "confirmed", {
          paidAt: new Date().toISOString(),
        });
        return { url: null, paidWithCredits: true, creditApplied: originalAmount.toFixed(2) };
      }

      const platformFeeInCents = Math.round(amountInCents * PLATFORM_FEE_RATE);

      // Build checkout session options
      const description = creditApplied > 0
        ? `Booking #${booking.bookingNumber} - ${service.depositRequired ? "Deposit" : "Full Payment"} (after $${creditApplied.toFixed(2)} credit applied)`
        : `Booking #${booking.bookingNumber} - ${service.depositRequired ? "Deposit Payment" : "Full Payment"}`;

      const sessionOptions: Stripe.Checkout.SessionCreateParams = {
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: service.name,
                description,
                metadata: {
                  serviceId: service.id.toString(),
                  providerId: provider.id.toString(),
                  bookingId: booking.id.toString(),
                },
              },
              unit_amount: amountInCents,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${ctx.req.headers.origin}/booking/${booking.id}?payment=success`,
        cancel_url: `${ctx.req.headers.origin}/booking/${booking.id}?payment=cancelled`,
        customer_email: ctx.user.email || undefined,
        client_reference_id: ctx.user.id.toString(),
        metadata: {
          bookingId: booking.id.toString(),
          customerId: ctx.user.id.toString(),
          providerId: provider.id.toString(),
          serviceId: service.id.toString(),
          bookingNumber: booking.bookingNumber,
          paymentType: service.depositRequired ? "deposit" : "full",
          creditApplied: creditApplied.toFixed(2),
          originalAmount: originalAmount.toFixed(2),
        },
        allow_promotion_codes: true,
      };

      // Every non-demo booking charge must settle to an entitled, payout-ready provider.
      sessionOptions.payment_intent_data = {
        application_fee_amount: platformFeeInCents,
        transfer_data: {
          destination: provider.stripeAccountId,
        },
        metadata: {
          bookingId: booking.id.toString(),
          customerId: ctx.user.id.toString(),
          providerId: provider.id.toString(),
          paymentType: service.depositRequired ? "deposit" : "full",
        },
      };

      const session = await stripe.checkout.sessions.create(sessionOptions);
      return { url: session.url, paidWithCredits: false, creditApplied: creditApplied.toFixed(2) };
    }),
});
