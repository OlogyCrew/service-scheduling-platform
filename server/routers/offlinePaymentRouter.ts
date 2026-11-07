import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "../db";
import { createAuditEntry } from "../db/auditLog";
import { OFFLINE_METHODS } from "../db/offlinePayments";

const methodSchema = z.enum(OFFLINE_METHODS);

async function providerForUser(userId: number) {
  return db.getProviderByUserId(userId);
}

async function assertBookingAccess(user: { id: number; role: string }, bookingId: number, mutate = false) {
  const booking = await db.getBookingById(bookingId);
  if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found" });
  const provider = await providerForUser(user.id);
  const ownsProvider = provider?.id === booking.providerId;
  const admin = user.role === "admin";
  if (mutate ? (!ownsProvider && !admin) : (booking.customerId !== user.id && !ownsProvider && !admin)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
  }
  return booking;
}

export const offlinePaymentRouter = router({
  getProviderSettings: protectedProcedure.query(async ({ ctx }) => {
    const provider = await providerForUser(ctx.user.id);
    if (!provider) throw new TRPCError({ code: "FORBIDDEN", message: "Provider access required" });
    return db.getProviderPayAtLocationSettings(provider.id);
  }),

  updateProviderSettings: protectedProcedure
    .input(z.object({ enabled: z.boolean(), instructions: z.string().max(2000).nullable().optional(), serviceIds: z.array(z.number().int().positive()).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const provider = await providerForUser(ctx.user.id);
      if (!provider) throw new TRPCError({ code: "FORBIDDEN", message: "Provider access required" });
      const before = await db.getProviderPayAtLocationSettings(provider.id);
      let settings;
      try {
        settings = await db.updateProviderPayAtLocationSettings(provider.id, input);
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Unable to update settings" });
      }
      await createAuditEntry({ actorId: ctx.user.id, action: "update_pay_at_location_settings", targetType: "provider", targetId: provider.id, details: { enabled: input.enabled, serviceIds: input.serviceIds, previousEnabled: before.enabled, previousServiceIds: before.serviceIds } });
      return settings;
    }),

  getForBooking: protectedProcedure
    .input(z.object({ bookingId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await assertBookingAccess(ctx.user, input.bookingId);
      return db.getOfflinePaymentForBooking(input.bookingId);
    }),

  listProviderOutstanding: protectedProcedure.query(async ({ ctx }) => {
    const provider = await providerForUser(ctx.user.id);
    if (!provider) throw new TRPCError({ code: "FORBIDDEN", message: "Provider access required" });
    return db.listOutstandingOfflinePayments(provider.id);
  }),

  confirmPayment: protectedProcedure
    .input(z.object({ bookingId: z.number().int().positive(), amountReceived: z.string(), offlinePaymentMethod: methodSchema, paymentNote: z.string().max(1000).nullable().optional() }))
    .mutation(async ({ ctx, input }) => {
      const booking = await assertBookingAccess(ctx.user, input.bookingId, true);
      try {
        const payment = await db.transitionOfflinePayment({ bookingId: input.bookingId, actorId: ctx.user.id, status: "paid", amount: input.amountReceived, method: input.offlinePaymentMethod, note: input.paymentNote });
        await createAuditEntry({ actorId: ctx.user.id, action: "confirm_pay_at_location_payment", targetType: "booking", targetId: booking.id, details: { amountReceived: input.amountReceived, offlinePaymentMethod: input.offlinePaymentMethod } });
        return payment;
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Unable to confirm payment" });
      }
    }),

  waivePayment: protectedProcedure
    .input(z.object({ bookingId: z.number().int().positive(), waiverAmount: z.string(), waiverReason: z.string().trim().min(1).max(2000) }))
    .mutation(async ({ ctx, input }) => {
      const booking = await assertBookingAccess(ctx.user, input.bookingId, true);
      try {
        const payment = await db.transitionOfflinePayment({ bookingId: input.bookingId, actorId: ctx.user.id, status: "waived", amount: input.waiverAmount, reason: input.waiverReason });
        await createAuditEntry({ actorId: ctx.user.id, action: "waive_pay_at_location_payment", targetType: "booking", targetId: booking.id, details: { waiverAmount: input.waiverAmount } });
        return payment;
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Unable to waive payment" });
      }
    }),
});
