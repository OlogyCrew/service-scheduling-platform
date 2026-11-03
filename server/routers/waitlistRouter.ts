import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";
import { TRPCError } from "@trpc/server";
import { sendNotification } from "../notifications";

export const waitlistRouter = router({
  /**
   * Join the waitlist for a full group class time slot
   */
  join: protectedProcedure
    .input(z.object({
      serviceId: z.number(),
      providerId: z.number(),
      bookingDate: z.string(),
      startTime: z.string(),
      endTime: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify the service exists and is a group class
      const service = await db.getServiceById(input.serviceId);
      if (!service) throw new TRPCError({ code: "NOT_FOUND", message: "Service not found" });
      const provider = await db.getProviderById(input.providerId);
      if (!provider || provider.isActive === false || provider.deletedAt || service.providerId !== input.providerId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "This service is not currently available" });
      }
      if (!service.isActive || service.deletedAt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "This service is not currently available" });
      }
      if (!service.isGroupClass) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Waitlist is only available for group classes" });
      }

      // Check if user is already on the waitlist
      const alreadyOnWaitlist = await db.isUserOnWaitlist(
        ctx.user.id, input.serviceId, input.bookingDate, input.startTime
      );
      if (alreadyOnWaitlist) {
        throw new TRPCError({ code: "CONFLICT", message: "You are already on the waitlist for this time slot" });
      }

      // Check if the slot is actually full (otherwise they should just book)
      const existingBookings = await db.getBookingsByDateRange(
        input.providerId, input.bookingDate, input.bookingDate
      );
      const sameSlotBookings = existingBookings.filter((b: any) => {
        if (["cancelled", "refunded", "no_show"].includes(b.status)) return false;
        return b.serviceId === input.serviceId && b.startTime === input.startTime;
      });
      const maxCapacity = service.maxCapacity || 1;
      if (sameSlotBookings.length < maxCapacity) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This slot still has availability. You can book directly." });
      }

      const waitlistId = await db.joinWaitlist({
        userId: ctx.user.id,
        serviceId: input.serviceId,
        providerId: input.providerId,
        bookingDate: input.bookingDate,
        startTime: input.startTime,
        endTime: input.endTime,
      });

      const position = await db.getNextWaitlistPosition(input.serviceId, input.bookingDate, input.startTime) - 1;

      return { id: waitlistId, position, message: `You are #${position} on the waitlist. We'll notify you when a spot opens up.` };
    }),

  /**
   * Leave the waitlist (cancel your entry)
   */
  leave: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const success = await db.leaveWaitlist(input.id, ctx.user.id);
      if (!success) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Waitlist entry not found or already cancelled" });
      }
      return { success: true };
    }),

  /**
   * Get current user's waitlist entries
   */
  myEntries: protectedProcedure.query(async ({ ctx }) => {
    const entries = await db.getUserWaitlistEntries(ctx.user.id);
    // Enrich with service info
    const enriched = await Promise.all(entries.map(async (entry) => {
      const service = await db.getServiceById(entry.serviceId);
      return {
        ...entry,
        serviceName: service?.name || "Unknown Service",
        servicePrice: service?.basePrice || "0.00",
      };
    }));
    return enriched;
  }),

  /**
   * Get waitlist count for a specific slot (public info)
   */
  slotCount: protectedProcedure
    .input(z.object({
      serviceId: z.number(),
      bookingDate: z.string(),
      startTime: z.string(),
    }))
    .query(async ({ input }) => {
      const count = await db.getWaitlistCount(input.serviceId, input.bookingDate, input.startTime);
      return { count };
    }),

  /**
   * Check if current user is on waitlist for a slot
   */
  isOnWaitlist: protectedProcedure
    .input(z.object({
      serviceId: z.number(),
      bookingDate: z.string(),
      startTime: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const onWaitlist = await db.isUserOnWaitlist(ctx.user.id, input.serviceId, input.bookingDate, input.startTime);
      return { onWaitlist };
    }),

  /**
   * Check waitlist status for a slot (combines isOnWaitlist + count)
   */
  checkStatus: protectedProcedure
    .input(z.object({
      serviceId: z.number(),
      bookingDate: z.string(),
      startTime: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const onWaitlist = await db.isUserOnWaitlist(ctx.user.id, input.serviceId, input.bookingDate, input.startTime);
      const count = await db.getWaitlistCount(input.serviceId, input.bookingDate, input.startTime);
      return { onWaitlist, count };
    }),

  /**
   * Provider: view waitlist entries for their services
   */
  providerEntries: protectedProcedure.query(async ({ ctx }) => {
    const provider = await db.getProviderByUserId(ctx.user.id);
    if (!provider) throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found" });
    const entries = await db.getProviderWaitlistEntries(provider.id);
    // Enrich with user and service info
    const enriched = await Promise.all(entries.map(async (entry: any) => {
      const user = await db.getUserById(entry.userId);
      const service = await db.getServiceById(entry.serviceId);
      return {
        ...entry,
        userName: user?.name || user?.firstName || "Unknown",
        userEmail: user?.email || "",
        serviceName: service?.name || "Unknown Service",
      };
    }));
    return enriched;
  }),

  /**
   * Provider: remove a user from their waitlist
   */
  providerRemove: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const provider = await db.getProviderByUserId(ctx.user.id);
      if (!provider) throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found" });
      const success = await db.providerRemoveFromWaitlist(input.id, provider.id);
      if (!success) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Waitlist entry not found" });
      }
      return { success: true };
    }),
});

/**
 * Notify the next person on the waitlist when a spot opens up.
 * Call this when a booking is cancelled for a group class.
 */
export async function notifyNextOnWaitlist(
  serviceId: number,
  bookingDate: string,
  startTime: string,
  serviceName: string
) {
  const nextEntry = await db.getNextOnWaitlist(serviceId, bookingDate, startTime);
  if (!nextEntry) return null;

  // Mark as notified
  await db.markWaitlistNotified(nextEntry.id);

  // Get user info for notification
  const user = await db.getUserById(nextEntry.userId);
  if (!user) return null;

  // Create in-app notification
  await db.createNotification({
    userId: nextEntry.userId,
    notificationType: "waitlist_spot_available",
    title: "A spot opened up!",
    message: `A spot is now available for "${serviceName}" on ${bookingDate} at ${startTime}. You have 24 hours to book before the spot goes to the next person.`,
    actionUrl: `/services/${serviceId}`,
    isRead: false,
  });

  // Send email notification
  if (user.email) {
    try {
      await sendNotification({
        type: "waitlist_spot_available",
        channel: "email",
        recipient: { userId: nextEntry.userId, email: user.email, name: user.name || user.firstName || "" },
        data: {
          serviceName,
          bookingDate,
          startTime,
          userName: user.name || user.firstName || "there",
        },
      });
    } catch (e) {
      console.error("[Waitlist] Failed to send email notification:", e);
    }
  }

  return { userId: nextEntry.userId, userName: user.name || user.firstName };
}
