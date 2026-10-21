import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { TRPCError } from "@trpc/server";
import { ENV } from "./_core/env";
import { createAuditEntry, getAuditLog, getAuditLogForTarget } from "./db/auditLog";
import { getAdminTeamMembers, promoteToAdmin, demoteFromAdmin, updateAdminRole, searchUsersForAdmin } from "./db/adminTeam";
import {
  getAdminProviderTierMembers,
  getSubscriptionAnalytics as getEffectiveSubscriptionAnalytics,
} from "./db/payments";
import { hasAdminClearance, hasPartnerSplitAccess, isApprovedAdminEmail, isApprovedSuperAdminEmail, OPERATIONS_ADMIN_EMAIL } from "./adminPolicy";
import {
  isActiveReportableAdminProvider,
  isActiveReportableAdminUser,
  isReportableAdminIdentity,
} from "../shared/adminDataScope";

function reportableAdminUsers(allUsers: any[], activeOnly: boolean) {
  return allUsers.filter((user) => activeOnly
    ? isActiveReportableAdminUser(user)
    : isReportableAdminIdentity(user));
}

function reportableAdminProviders(allProviders: any[], allUsers: any[]) {
  const usersByProviderId = new Map(
    allUsers.filter((user) => user.providerId != null).map((user) => [Number(user.providerId), user]),
  );
  return allProviders.filter((provider) => {
    const user = usersByProviderId.get(Number(provider.id));
    return !!user && isActiveReportableAdminProvider({
      ...user,
      providerId: provider.id,
      providerBusinessName: provider.businessName,
      providerIsOfficial: provider.isOfficial,
      providerIsActive: provider.isActive,
      providerDeletedAt: provider.deletedAt,
    });
  });
}

// Admin-only procedure that checks if user has admin role
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!hasAdminClearance(ctx.user)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }
  return next({ ctx });
});

// Super admin procedure — only the platform owner or super_admins can manage team
const superAdminProcedure = adminProcedure.use(({ ctx, next }) => {
  const isSuperAdmin = hasPartnerSplitAccess(ctx.user);
  if (!isSuperAdmin) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only the platform owner or super admins can perform this action",
    });
  }
  return next({ ctx });
});

const partnerSplitProcedure = adminProcedure.use(({ ctx, next }) => {
  if (!hasPartnerSplitAccess(ctx.user)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Partner financial access required" });
  }
  return next({ ctx });
});

function isPermittedAdminRole(email: string | null, adminRole: string): boolean {
  if (email?.trim().toLowerCase() === OPERATIONS_ADMIN_EMAIL) return adminRole === "operations_admin";
  return isApprovedSuperAdminEmail(email) && adminRole !== "operations_admin";
}

export const adminRouter = router({
  // Get platform statistics (real data)
  getStats: adminProcedure.query(async () => {
    return await db.getAdminStats();
  }),

  // Compact operational health for the admin Overview. No secret values are returned.
  getSystemHealth: adminProcedure.query(async ({ ctx }) => {
    const { getSystemHealthSnapshot } = await import("./systemHealth");
    return await getSystemHealthSnapshot(hasPartnerSplitAccess(ctx.user));
  }),

  // List all users (with optional pagination)
  listUsers: adminProcedure
    .input(z.object({
      page: z.number().default(1),
      limit: z.number().default(50),
    }).optional())
    .query(async ({ input }) => {
      const allUsers = reportableAdminUsers(await db.getAllUsers(), true);
      if (!input) return allUsers;
      const offset = (input.page - 1) * input.limit;
      return allUsers.slice(offset, offset + input.limit);
    }),

  // List all providers
  listProviders: adminProcedure
    .input(z.object({
      page: z.number().default(1),
      limit: z.number().default(50),
    }).optional())
    .query(async ({ input }) => {
      const [providers, users] = await Promise.all([db.getAllProviders(), db.getAllUsers()]);
      const reportableProviders = reportableAdminProviders(providers, users);
      const allProviders = await Promise.all(reportableProviders.map(async (provider: any) => ({
        ...provider,
        trustProfile: await db.getProviderTrustProfile(provider.id),
      })));
      if (!input) return allProviders;
      const offset = (input.page - 1) * input.limit;
      return allProviders.slice(offset, offset + input.limit);
    }),

  // List all bookings (with optional pagination)
  listBookings: adminProcedure
    .input(z.object({
      page: z.number().default(1),
      limit: z.number().default(50),
    }).optional())
    .query(async ({ input }) => {
      const allBookings = await db.getAllBookings();
      if (!input) return allBookings;
      const offset = (input.page - 1) * input.limit;
      return allBookings.slice(offset, offset + input.limit);
    }),

  // Suspend a user (sets deletedAt timestamp)
  suspendUser: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const user = await db.getUserById(input.userId);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      if (user.role === "admin") throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot suspend admin users" });
      await db.suspendUser(input.userId);
      await createAuditEntry({ actorId: ctx.user.id, action: "suspend_user", targetType: "user", targetId: input.userId, details: { userName: user.name, userEmail: user.email } });
      return { success: true };
    }),

  // Unsuspend a user
  unsuspendUser: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.unsuspendUser(input.userId);
      await createAuditEntry({ actorId: ctx.user.id, action: "unsuspend_user", targetType: "user", targetId: input.userId });
      return { success: true };
    }),

  // Verify a provider
  verifyProvider: adminProcedure
    .input(z.object({ providerId: z.number() }))
    .mutation(async () => {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Blanket provider verification is retired. Review the provider's individual evidence records instead.",
      });
    }),

  // Reject provider verification
  rejectProvider: adminProcedure
    .input(z.object({ providerId: z.number(), reason: z.string() }))
    .mutation(async () => {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Blanket provider rejection is retired. Reject the relevant evidence record with a reason instead.",
      });
    }),

  // Toggle provider active/inactive status
  toggleProviderActive: adminProcedure
    .input(z.object({ providerId: z.number(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await db.setProviderActive(input.providerId, input.isActive);
      await createAuditEntry({ actorId: ctx.user.id, action: input.isActive ? "activate_provider" : "deactivate_provider", targetType: "provider", targetId: input.providerId });
      return { success: true };
    }),

  // Get subscription analytics
  getSubscriptionAnalytics: adminProcedure.query(async () => {
    return await getEffectiveSubscriptionAnalytics();
  }),

  // Lazy provider drill-down for the lifecycle-aware tier distribution card.
  getSubscriptionTierMembers: adminProcedure
    .input(z.object({ group: z.enum(["free", "basic", "premium", "trialing"]) }))
    .query(async ({ input }) => {
      return await getAdminProviderTierMembers(input.group);
    }),

  // Get booking source analytics (widget vs direct)
  getBookingSourceAnalytics: adminProcedure.query(async () => {
    return await db.getAdminBookingSourceAnalytics();
  }),

  // Manually trigger reminder processing
  triggerReminders: adminProcedure.mutation(async ({ ctx }) => {
    const { processReminders } = await import("./reminderService");
    const result = await processReminders();
    await createAuditEntry({ actorId: ctx.user.id, action: "trigger_reminders", targetType: "system", targetId: 0, details: { result } });
    return result;
  }),

  // Manually trigger review reminder processing
  triggerReviewReminders: adminProcedure.mutation(async ({ ctx }) => {
    const { processReviewReminders } = await import("./reviewReminderService");
    const result = await processReviewReminders();
    await createAuditEntry({ actorId: ctx.user.id, action: "trigger_review_reminders", targetType: "system", targetId: 0, details: { result } });
    return result;
  }),

  // Update provider verification status (flexible)
  updateProviderVerification: adminProcedure
    .input(z.object({
      providerId: z.number(),
      verificationStatus: z.enum(["pending", "verified", "rejected"]),
      reason: z.string().optional(),
    }))
    .mutation(async () => {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Provider verification is evidence-specific. Use the document review workflow.",
      });
    }),

  // Review Moderation
  listReviews: adminProcedure
    .input(z.object({ flaggedOnly: z.boolean().default(false) }).optional())
    .query(async ({ input }) => {
      return await db.getAllReviewsForAdmin(input?.flaggedOnly ?? false);
    }),

  flagReview: adminProcedure
    .input(z.object({ reviewId: z.number(), reason: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await db.flagReview(input.reviewId, input.reason);
      await createAuditEntry({ actorId: ctx.user.id, action: "flag_review", targetType: "review", targetId: input.reviewId, details: { reason: input.reason } });
      return { success: true };
    }),

  unflagReview: adminProcedure
    .input(z.object({ reviewId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.unflagReview(input.reviewId);
      await createAuditEntry({ actorId: ctx.user.id, action: "unflag_review", targetType: "review", targetId: input.reviewId });
      return { success: true };
    }),

  hideReview: adminProcedure
    .input(z.object({ reviewId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.hideReview(input.reviewId);
      await createAuditEntry({ actorId: ctx.user.id, action: "hide_review", targetType: "review", targetId: input.reviewId });
      return { success: true };
    }),

  deleteReview: adminProcedure
    .input(z.object({ reviewId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.deleteReview(input.reviewId);
      await createAuditEntry({ actorId: ctx.user.id, action: "delete_review", targetType: "review", targetId: input.reviewId });
      return { success: true };
    }),

  // Push Notification Analytics
  getPushAnalytics: adminProcedure.query(async () => {
    return await db.getPushAnalytics();
  }),

  // Referral Analytics
  getReferralAnalytics: adminProcedure.query(async () => {
    return await db.getReferralAnalytics();
  }),

  // ============================================================================
  // TEAM MANAGEMENT
  // ============================================================================

  // Get all admin team members
  getTeamMembers: superAdminProcedure.query(async () => {
    const members = await getAdminTeamMembers();
    return members.filter(member => isApprovedAdminEmail(member.email));
  }),

  // Search users for promote dialog
  searchUsers: superAdminProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input }) => {
      const matches = await searchUsersForAdmin(input.query);
      return matches.filter(user => isApprovedAdminEmail(user.email));
    }),

  // Promote a user to admin
  promoteUser: superAdminProcedure
    .input(z.object({
      userId: z.number(),
      adminRole: z.enum(["super_admin", "support_agent", "moderator", "operations_admin"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await db.getUserById(input.userId);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      if (!isApprovedAdminEmail(user.email)) throw new TRPCError({ code: "FORBIDDEN", message: "Administrative clearance is restricted to the approved administrator identities" });
      if (!isPermittedAdminRole(user.email, input.adminRole)) throw new TRPCError({ code: "FORBIDDEN", message: "That administrative role is not approved for this identity" });
      if (user.role === "admin") throw new TRPCError({ code: "BAD_REQUEST", message: "User is already an admin" });
      await promoteToAdmin(input.userId, input.adminRole);
      await createAuditEntry({
        actorId: ctx.user.id,
        action: "promote_to_admin",
        targetType: "user",
        targetId: input.userId,
        details: { userName: user.name, userEmail: user.email, adminRole: input.adminRole },
      });
      return { success: true };
    }),

  // Demote an admin back to their previous role
  demoteUser: superAdminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const user = await db.getUserById(input.userId);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      if (user.openId === ENV.ownerOpenId) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot demote the platform owner" });
      if (user.role !== "admin") throw new TRPCError({ code: "BAD_REQUEST", message: "User is not an admin" });
      // Check if user has a provider profile to determine fallback role
      const provider = await db.getProviderByUserId(input.userId);
      const fallbackRole = provider ? "provider" : "customer";
      await demoteFromAdmin(input.userId, fallbackRole);
      await createAuditEntry({
        actorId: ctx.user.id,
        action: "demote_from_admin",
        targetType: "user",
        targetId: input.userId,
        details: { userName: user.name, userEmail: user.email, newRole: fallbackRole },
      });
      return { success: true };
    }),

  // Update an admin's sub-role
  updateTeamRole: superAdminProcedure
    .input(z.object({
      userId: z.number(),
      adminRole: z.enum(["super_admin", "support_agent", "moderator", "operations_admin"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await db.getUserById(input.userId);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      if (!isApprovedAdminEmail(user.email)) throw new TRPCError({ code: "FORBIDDEN", message: "Administrative clearance is restricted to the approved administrator identities" });
      if (!isPermittedAdminRole(user.email, input.adminRole)) throw new TRPCError({ code: "FORBIDDEN", message: "That administrative role is not approved for this identity" });
      if (user.role !== "admin") throw new TRPCError({ code: "BAD_REQUEST", message: "User is not an admin" });
      await updateAdminRole(input.userId, input.adminRole);
      await createAuditEntry({
        actorId: ctx.user.id,
        action: "change_admin_role",
        targetType: "user",
        targetId: input.userId,
        details: { userName: user.name, newAdminRole: input.adminRole },
      });
      return { success: true };
    }),

  // ============================================================================
  // USER DETAIL VIEW
  // ============================================================================

  // Get full user detail for admin view
  getUserDetail: adminProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ ctx, input }) => {
      const user = await db.getUserById(input.userId);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

      // Get provider profile if exists
      const provider = await db.getProviderByUserId(input.userId);
      const providerTrustProfile = provider ? await db.getProviderTrustProfile(provider.id) : null;

      // Get bookings as customer
      const customerBookings = await db.getCustomerBookings(input.userId);

      // Get bookings as provider (if they are one)
      let providerBookings: any[] = [];
      if (provider) {
        providerBookings = await db.getProviderBookings(provider.id);
      }

      // Get reviews by this user
      const { getReviewsByCustomer, getReviewsByProvider } = await import("./db/reviews");
      const reviewsGiven = await getReviewsByCustomer(input.userId);

      // Get reviews received (if provider)
      let reviewsReceived: any[] = [];
      if (provider) {
        reviewsReceived = await getReviewsByProvider(provider.id);
      }

      // Get services (if provider)
      let services: any[] = [];
      if (provider) {
        services = await db.getServicesByProvider(provider.id);
      }

      // Get audit history for this user
      const auditHistory = await getAuditLogForTarget("user", input.userId, !hasPartnerSplitAccess(ctx.user));

      return {
        user,
        provider: provider ? { ...provider, trustProfile: providerTrustProfile } : null,
        customerBookings: customerBookings.slice(0, 20), // Last 20
        providerBookings: providerBookings.slice(0, 20),
        reviewsGiven: reviewsGiven.slice(0, 20),
        reviewsReceived: reviewsReceived.slice(0, 20),
        services,
        auditHistory,
        isOwner: user.openId === ENV.ownerOpenId,
      };
    }),

  // ============================================================================
  // SEARCH & FILTERS
  // ============================================================================

  // Search users with filters
  searchUsersFiltered: adminProcedure
    .input(z.object({
      query: z.string().optional(),
      role: z.enum(["customer", "provider", "admin"]).optional(),
      status: z.enum(["active", "suspended"]).optional(),
      page: z.number().default(1),
      limit: z.number().default(20),
    }))
    .query(async ({ input }) => {
      const allUsers = await db.getAllUsers();
      let filtered = reportableAdminUsers(allUsers, false);

      // Text search
      if (input.query) {
        const q = input.query.toLowerCase();
        filtered = filtered.filter((u: any) =>
          (u.name && u.name.toLowerCase().includes(q)) ||
          (u.email && u.email.toLowerCase().includes(q)) ||
          (u.phone && u.phone.includes(q))
        );
      }

      // Role filter
      if (input.role) {
        filtered = filtered.filter((u: any) => u.role === input.role);
      }

      // Status filter
      if (input.status === "suspended") {
        filtered = filtered.filter((u: any) => u.deletedAt !== null);
      } else if (input.status === "active") {
        filtered = filtered.filter((u: any) => u.deletedAt === null);
      }

      const total = filtered.length;
      const offset = (input.page - 1) * input.limit;
      const paginated = filtered.slice(offset, offset + input.limit);

      return {
        users: paginated,
        total,
        page: input.page,
        limit: input.limit,
        totalPages: Math.ceil(total / input.limit),
      };
    }),

  // Search providers with filters
  searchProvidersFiltered: adminProcedure
    .input(z.object({
      query: z.string().optional(),
      verificationStatus: z.enum(["pending", "verified", "rejected"]).optional(),
      sortBy: z.enum(["rating", "joined"]).optional(),
      sortOrder: z.enum(["asc", "desc"]).optional(),
      page: z.number().default(1),
      limit: z.number().default(20),
    }))
    .query(async ({ input }) => {
      const [providers, users] = await Promise.all([db.getAllProviders(), db.getAllUsers()]);
      const reportableProviders = reportableAdminProviders(providers, users);
      const allProviders = await Promise.all(reportableProviders.map(async (provider: any) => ({
        ...provider,
        trustProfile: await db.getProviderTrustProfile(provider.id),
      })));
      let filtered = allProviders;

      // Text search
      if (input.query) {
        const q = input.query.toLowerCase();
        filtered = filtered.filter((p: any) =>
          (p.businessName && p.businessName.toLowerCase().includes(q)) ||
          (p.city && p.city.toLowerCase().includes(q)) ||
          (p.state && p.state.toLowerCase().includes(q))
        );
      }

      // Verification status filter
      if (input.verificationStatus) {
        filtered = filtered.filter((p: any) => p.trustProfile?.compatibilityVerificationStatus === input.verificationStatus);
      }

      // Sorting
      if (input.sortBy) {
        filtered = [...filtered].sort((a: any, b: any) => {
          if (input.sortBy === "rating") {
            const ratingA = parseFloat(a.averageRating || "0");
            const ratingB = parseFloat(b.averageRating || "0");
            return input.sortOrder === "asc" ? ratingA - ratingB : ratingB - ratingA;
          }
          if (input.sortBy === "joined") {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            return input.sortOrder === "asc" ? dateA - dateB : dateB - dateA;
          }
          return 0;
        });
      }

      const total = filtered.length;
      const offset = (input.page - 1) * input.limit;
      const paginated = filtered.slice(offset, offset + input.limit);

      return {
        providers: paginated,
        total,
        page: input.page,
        limit: input.limit,
        totalPages: Math.ceil(total / input.limit),
      };
    }),

  // Search bookings with filters
  searchBookingsFiltered: adminProcedure
    .input(z.object({
      query: z.string().optional(),
      status: z.string().optional(),
      page: z.number().int().min(1).max(10_000).default(1),
      limit: z.number().int().min(1).max(100).default(25),
    }))
    .query(async ({ input }) => {
      const allBookings = await db.getAllBookings();
      let filtered = allBookings;

      // Text search
      if (input.query) {
        const q = input.query.toLowerCase();
        filtered = filtered.filter((b: any) =>
          (b.customerName && b.customerName.toLowerCase().includes(q)) ||
          (b.providerName && b.providerName.toLowerCase().includes(q)) ||
          (b.serviceName && b.serviceName.toLowerCase().includes(q)) ||
          (b.bookingNumber && b.bookingNumber.toLowerCase().includes(q)) ||
          (b.status && b.status.toLowerCase().includes(q)) ||
          (b.bookingDate && b.bookingDate.includes(q))
        );
      }

      // Status filter
      if (input.status) {
        filtered = filtered.filter((b: any) => b.status === input.status);
      }

      const total = filtered.length;
      const offset = (input.page - 1) * input.limit;
      const paginated = filtered.slice(offset, offset + input.limit);

      return {
        bookings: paginated,
        total,
        page: input.page,
        limit: input.limit,
        totalPages: Math.ceil(total / input.limit),
      };
    }),

  // ============================================================================
  // AUDIT LOG
  // ============================================================================

  // Get audit log with filters
  getAuditLog: adminProcedure
    .input(z.object({
      action: z.string().optional(),
      actorId: z.number().optional(),
      targetType: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      page: z.number().default(1),
      limit: z.number().default(50),
    }).optional())
    .query(async ({ input, ctx }) => {
      return await getAuditLog({
        action: input?.action,
        actorId: input?.actorId,
        targetType: input?.targetType,
        startDate: input?.startDate ? new Date(input.startDate) : undefined,
        endDate: input?.endDate ? new Date(input.endDate) : undefined,
        page: input?.page,
        limit: input?.limit,
        excludePartnerFinancials: !hasPartnerSplitAccess(ctx.user),
      });
    }),

  // Get audit log for a specific user/target
  getAuditLogForTarget: adminProcedure
    .input(z.object({
      targetType: z.string(),
      targetId: z.number(),
    }))
    .query(async ({ input, ctx }) => {
      return await getAuditLogForTarget(input.targetType, input.targetId, !hasPartnerSplitAccess(ctx.user));
    }),

  // ============================================================================
  // PARTNER REVENUE SPLIT
  // ============================================================================

  getPartnerTransferSummary: partnerSplitProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const { getPartnerTransferSummaryFiltered } = await import("./partnerSplit");
      return await getPartnerTransferSummaryFiltered({
        startDate: input?.startDate ? new Date(input.startDate) : undefined,
        endDate: input?.endDate ? new Date(input.endDate) : undefined,
      });
    }),

  getPartnerTransfers: partnerSplitProcedure
    .input(z.object({
      sourceType: z.enum(["provider_subscription", "customer_subscription", "booking_platform_fee"]).optional(),
      status: z.enum(["pending", "completed", "failed"]).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ input }) => {
      const { getPartnerTransfers } = await import("./partnerSplit");
      return await getPartnerTransfers({
        sourceType: input?.sourceType,
        status: input?.status,
        startDate: input?.startDate ? new Date(input.startDate) : undefined,
        endDate: input?.endDate ? new Date(input.endDate) : undefined,
        limit: input?.limit,
        offset: input?.offset,
      });
    }),

  getPartnerMonthlyBreakdown: partnerSplitProcedure
    .input(z.object({
      months: z.number().min(1).max(24).default(12),
    }).optional())
    .query(async ({ input }) => {
      const { getMonthlyRevenueBreakdown } = await import("./partnerSplit");
      return await getMonthlyRevenueBreakdown({ months: input?.months });
    }),

  getPartnerTransfersExport: partnerSplitProcedure
    .input(z.object({
      sourceType: z.enum(["provider_subscription", "customer_subscription", "booking_platform_fee"]).optional(),
      status: z.enum(["pending", "completed", "failed"]).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const { getPartnerTransfersForExport } = await import("./partnerSplit");
      return await getPartnerTransfersForExport({
        sourceType: input?.sourceType,
        status: input?.status,
        startDate: input?.startDate ? new Date(input.startDate) : undefined,
        endDate: input?.endDate ? new Date(input.endDate) : undefined,
      });
    }),
  // Webhook health check - verify Stripe webhook is configured correctly
  getWebhookStatus: partnerSplitProcedure.query(async () => {
    try {
      const Stripe = (await import("stripe")).default;
      const { ENV } = await import("./_core/env");
      const stripe = new Stripe(ENV.stripeSecretKey, { apiVersion: "2026-01-28.clover" as any });
      const endpoints = await stripe.webhookEndpoints.list({ limit: 10 });
      const activeEndpoints = endpoints.data.filter(e => e.status === "enabled");
      return {
        configured: activeEndpoints.length > 0,
        endpoints: activeEndpoints.map(e => ({
          id: e.id,
          url: e.url,
          status: e.status,
          enabledEvents: e.enabled_events,
          created: new Date(e.created * 1000).toISOString(),
        })),
        webhookSecretSet: !!ENV.stripeWebhookSecret,
        partnerAccountSet: !!ENV.partnerStripeAccountId,
        partnerAccountId: ENV.partnerStripeAccountId || null,
      };
    } catch (err: any) {
      const { ENV } = await import("./_core/env");
      return {
        configured: false,
        endpoints: [],
        webhookSecretSet: !!ENV.stripeWebhookSecret,
        partnerAccountSet: !!ENV.partnerStripeAccountId,
        partnerAccountId: ENV.partnerStripeAccountId || null,
        error: err.message,
      };
    }
  }),
  // Send a test webhook event to verify the endpoint is working
  testWebhook: partnerSplitProcedure.mutation(async () => {
    try {
      const Stripe = (await import("stripe")).default;
      const { ENV } = await import("./_core/env");
      const stripe = new Stripe(ENV.stripeSecretKey, { apiVersion: "2026-01-28.clover" as any });
      const endpoints = await stripe.webhookEndpoints.list({ limit: 10 });
      const activeEndpoint = endpoints.data.find(e => e.status === "enabled");
      if (!activeEndpoint) {
        return { success: false, error: "No active webhook endpoint found" };
      }
      // Stripe doesn't have a direct "send test" API, but we can verify the endpoint exists
      return {
        success: true,
        message: `Webhook endpoint configured at ${activeEndpoint.url} with ${activeEndpoint.enabled_events.length} events`,
        url: activeEndpoint.url,
        events: activeEndpoint.enabled_events,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }),
  deleteUser: superAdminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const { userId } = input;
      // Prevent deleting yourself
      if (userId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot delete your own account" });
      }
      // Prevent deleting other super admins
      const targetUser = await db.getUserById(userId);
      if (!targetUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }
      if (targetUser.role === "admin" && (targetUser as any).adminRole === "super_admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot delete a super admin. Demote them first." });
      }
      // Perform cascading delete
      const { deleteUserCascade } = await import("./db/deleteUser");
      await deleteUserCascade(userId);
      // Create audit entry
      await createAuditEntry({
        action: "delete_user",
        actorId: ctx.user.id,
        targetId: userId,
        targetType: "user",
        details: { deletedName: targetUser.name, deletedEmail: targetUser.email || 'no email' },
      });
      return { success: true, message: `User ${targetUser.name} has been deleted` };
    }),

  // Bulk delete users (super admin only)
  bulkDeleteUsers: superAdminProcedure
    .input(z.object({ userIds: z.array(z.number()).min(1).max(100) }))
    .mutation(async ({ input, ctx }) => {
      const { userIds } = input;
      // Prevent deleting yourself
      if (userIds.includes(ctx.user.id)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot delete your own account" });
      }
      // Prevent deleting super admins
      const users = await Promise.all(userIds.map(id => db.getUserById(id)));
      const superAdmins = users.filter(u => u && u.role === "admin" && (u as any).adminRole === "super_admin");
      if (superAdmins.length > 0) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot delete super admin accounts. Demote them first." });
      }
      // Perform cascading delete for each user
      const { deleteUserCascade } = await import("./db/deleteUser");
      let deleted = 0;
      for (const userId of userIds) {
        try {
          await deleteUserCascade(userId);
          deleted++;
        } catch (e) {
          // Skip users that fail (may already be deleted)
          console.error(`Failed to delete user ${userId}:`, e);
        }
      }
      // Create audit entry
      await createAuditEntry({
        action: "bulk_delete_users",
        actorId: ctx.user.id,
        targetId: userIds[0],
        targetType: "user",
        details: { count: deleted, userIds },
      });
      return { success: true, deleted, message: `${deleted} user(s) deleted successfully` };
    }),
});
