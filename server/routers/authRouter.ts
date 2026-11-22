import { getSessionCookieOptions } from "../_core/cookies";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "../db";
import { COOKIE_NAME } from "@shared/const";
import { ENV } from "../_core/env";
import bcrypt from "bcryptjs";
import { assertPaymentEligibilityOpen } from "../paymentEligibility";

export const authRouter = router({
  me: publicProcedure.query(opts => {
    if (!opts.ctx.user) return null;
    // Security: Strip sensitive fields from user object
    const { passwordHash, emailVerificationToken, emailVerificationExpires, passwordResetToken, passwordResetExpires, ...safeUser } = opts.ctx.user;
    return safeUser;
  }),

  selectRole: protectedProcedure
    .input(z.object({
      role: z.enum(["customer", "provider"]),
    }))
    .mutation(async ({ ctx, input }) => {
      // Block unverified email users from selecting a role
      if (!ctx.user.emailVerified) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Please verify your email address before setting up your profile. Check your inbox for the verification link.",
        });
      }

      await db.updateUserProfile(ctx.user.id, {
        role: input.role,
        hasSelectedRole: true,
      });

      // Send welcome email for customers (providers get theirs when they create their profile)
      if (input.role === "customer" && ctx.user.email) {
        try {
          const { sendNotification } = await import("../notifications");
          await sendNotification({
            type: "welcome_customer",
            channel: "email",
            recipient: {
              userId: ctx.user.id,
              email: ctx.user.email,
              name: ctx.user.name || undefined,
            },
            data: {
              customerName: ctx.user.name || ctx.user.firstName || "there",
            },
          });
        } catch (err) {
          console.error("[Auth] Failed to send welcome customer email:", err);
        }
      }

      return { success: true, role: input.role };
    }),

  clearPendingPlan: protectedProcedure.mutation(async ({ ctx }) => {
    await db.updateUserProfile(ctx.user.id, { pendingPlanTier: null, pendingPlanAudience: null } as any);
    return { success: true };
  }),
  logout: publicProcedure.mutation(({ ctx }) => {
    // Clear cookie with ALL possible attribute combinations to handle proxy inconsistencies
    const baseCookieOpts = { httpOnly: true, path: "/" };
    const variants = [
      { ...baseCookieOpts, sameSite: "none" as const, secure: true },
      { ...baseCookieOpts, sameSite: "none" as const, secure: false },
      { ...baseCookieOpts, sameSite: "lax" as const, secure: true },
      { ...baseCookieOpts, sameSite: "lax" as const, secure: false },
    ];
    for (const opts of variants) {
      ctx.res.clearCookie(COOKIE_NAME, opts);
      ctx.res.cookie(COOKIE_NAME, "", { ...opts, maxAge: 0, expires: new Date(0) });
    }
    return { success: true } as const;
  }),
  
  /**
   * Delete the current user's account.
   * Requires typing "DELETE" to confirm.
   * Checks for active bookings, anonymizes PII, soft-deletes, and cancels subscriptions.
   */
  deleteAccount: protectedProcedure
    .input(z.object({
      confirmation: z.literal("DELETE"),
    }))
    .mutation(async ({ ctx }) => {
      const userId = ctx.user.id;

      // Block admin self-deletion
      if (ctx.user.role === "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Admin accounts cannot be self-deleted. Please contact support.",
        });
      }

      // Check for active bookings
      const hasActive = await db.hasActiveBookings(userId);
      if (hasActive) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "You have active bookings (pending, confirmed, or in-progress). Please cancel or complete them before deleting your account.",
        });
      }

      assertPaymentEligibilityOpen("account_cleanup");

      // Cancel Stripe subscriptions if any
      try {
        const Stripe = (await import("stripe")).default;
        const stripe = new Stripe(ENV.stripeSecretKey, { apiVersion: "2026-01-28.clover" as any });

        // Check customer subscriptions
        const custSub = await db.getCustomerSubscription?.(userId).catch(() => null);
        if (custSub?.stripeSubscriptionId) {
          try {
            await stripe.subscriptions.cancel(custSub.stripeSubscriptionId);
          } catch (e: any) {
            console.warn(`[DeleteAccount] Failed to cancel customer subscription: ${e.message}`);
          }
        }

        // Cancel provider Stripe subscription if exists
        try {
          const provider = await db.getProviderByUserId(userId);
          if (provider) {
            const providerSub = await db.getProviderSubscription(provider.id);
            if (providerSub?.stripeSubscriptionId) {
              await stripe.subscriptions.cancel(providerSub.stripeSubscriptionId);
            }
          }
        } catch (e: any) {
          console.warn(`[DeleteAccount] Failed to cancel provider subscription: ${e.message}`);
        }
      } catch (e: any) {
        console.warn(`[DeleteAccount] Stripe cleanup warning: ${e.message}`);
      }

      // Perform the deletion (anonymize + soft-delete)
      const result = await db.deleteUserAccount(userId);

      // Send account deletion confirmation email directly via SendGrid
      // (We can't use the notification system since the user is now anonymized)
      try {
        const userEmail = ctx.user.email;
        const userName = ctx.user.name || ctx.user.firstName || "User";
        if (userEmail) {
          const { sendAccountDeletionEmail } = await import("../accountDeletionEmail");
          await sendAccountDeletionEmail(userEmail, userName);
        }
      } catch {
        // Email may fail — non-critical
      }

      // Notify owner
      try {
        const { notifyOwner } = await import("../_core/notification");
        await notifyOwner({
          title: "Account Deleted",
          content: `User ${ctx.user.name || ctx.user.email} (ID: ${userId}, role: ${ctx.user.role}) has deleted their account. Provider deactivated: ${result.providerDeactivated}. Services deactivated: ${result.servicesDeactivated}.`,
        });
      } catch {
        // Non-critical
      }

      // Clear session cookie with all variants to handle proxy inconsistencies
      const baseCookieOpts = { httpOnly: true, path: "/" };
      const clearVariants = [
        { ...baseCookieOpts, sameSite: "none" as const, secure: true },
        { ...baseCookieOpts, sameSite: "none" as const, secure: false },
        { ...baseCookieOpts, sameSite: "lax" as const, secure: true },
        { ...baseCookieOpts, sameSite: "lax" as const, secure: false },
      ];
      for (const opts of clearVariants) {
        ctx.res.clearCookie(COOKIE_NAME, opts);
        ctx.res.cookie(COOKIE_NAME, "", { ...opts, maxAge: 0, expires: new Date(0) });
      }

      return {
        success: true,
        ...result,
      };
    }),

  updateProfile: protectedProcedure
    .input(z.object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      phone: z.string().optional(),
      profilePhotoUrl: z.string().optional(),
      email: z.string().optional(),
      billingAddressLine1: z.string().optional(),
      billingAddressLine2: z.string().optional(),
      billingCity: z.string().optional(),
      billingState: z.string().optional(),
      billingPostalCode: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Auto-compose the display name from firstName + lastName
      const updateData: Record<string, any> = { ...input };
      if (input.firstName !== undefined || input.lastName !== undefined) {
        const currentUser = await db.getUserById(ctx.user.id);
        const newFirst = input.firstName ?? currentUser?.firstName ?? "";
        const newLast = input.lastName ?? currentUser?.lastName ?? "";
        updateData.name = [newFirst, newLast].filter(Boolean).join(" ") || currentUser?.name;
      }
      await db.updateUserProfile(ctx.user.id, updateData);
      const updated = await db.getUserById(ctx.user.id);
      return updated!;
    }),

  // Check if user has a password set (for showing Set vs Change password UI)
  hasPassword: protectedProcedure.query(async ({ ctx }) => {
    const user = await db.getUserById(ctx.user.id);
    return { hasPassword: !!user?.passwordHash };
  }),

  // Change password (requires current password) or Set password (for Google-only accounts)
  changePassword: protectedProcedure
    .input(z.object({
      currentPassword: z.string().optional(), // Optional for Google-only accounts setting password for first time
      newPassword: z.string().min(8, "Password must be at least 8 characters"),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await db.getUserById(ctx.user.id);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

      // If user already has a password, require current password
      if (user.passwordHash) {
        if (!input.currentPassword) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Current password is required" });
        }
        const isValid = await bcrypt.compare(input.currentPassword, user.passwordHash);
        if (!isValid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Current password is incorrect" });
        }
      }

      // Hash and save new password
      const passwordHash = await bcrypt.hash(input.newPassword, 12);
      await db.updateUserPassword(user.id, passwordHash);

      return { success: true, message: user.passwordHash ? "Password changed successfully" : "Password set successfully. You can now log in with email and password." };
    }),

  uploadProfilePhoto: protectedProcedure
    .input(z.object({
      photoData: z.string(), // base64
      contentType: z.string().default("image/jpeg"),
    }))
    .mutation(async ({ ctx, input }) => {
      const { storagePut } = await import("../storage");
      const buffer = Buffer.from(input.photoData, "base64");
      const ext = input.contentType.split("/")[1] || "jpg";
      const suffix = Math.random().toString(36).substring(2, 10);
      const fileKey = `profile-photos/${ctx.user.id}/${Date.now()}-${suffix}.${ext}`;
      const { url } = await storagePut(fileKey, buffer, input.contentType);
      await db.updateUserProfile(ctx.user.id, { profilePhotoUrl: url });
      return { url };
    }),

  // Two-Factor Authentication
  enable2FA: protectedProcedure.mutation(async ({ ctx }) => {
    const { setTwoFactorEnabled, generateTwoFactorCode, sendTwoFactorEmail } = await import("../twoFactor");
    const user = await db.getUserById(ctx.user.id);
    if (!user?.email) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Add an email address to your account before enabling two-factor authentication.",
      });
    }

    // Enable the login requirement only after the verification message is accepted.
    const code = await generateTwoFactorCode(ctx.user.id);
    const delivered = await sendTwoFactorEmail(user.email, code, user.firstName || user.name || undefined);
    if (!delivered) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "We couldn't send your verification code, so two-factor authentication was not enabled. Please try again.",
      });
    }

    await setTwoFactorEnabled(ctx.user.id, true);
    return { success: true, message: "2FA enabled. A verification code has been sent to your email to confirm." };
  }),
  disable2FA: protectedProcedure.mutation(async ({ ctx }) => {
    const { setTwoFactorEnabled } = await import("../twoFactor");
    await setTwoFactorEnabled(ctx.user.id, false);
    return { success: true };
  }),
  get2FAStatus: protectedProcedure.query(async ({ ctx }) => {
    const user = await db.getUserById(ctx.user.id);
    return { enabled: user?.twoFactorEnabled ?? false };
  }),

  removeProfilePhoto: protectedProcedure
    .mutation(async ({ ctx }) => {
      await db.updateUserProfile(ctx.user.id, { profilePhotoUrl: null });
      return { success: true };
    }),
});
