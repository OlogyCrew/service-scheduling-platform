import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";
import { TRPCError } from "@trpc/server";
import { canCustomerSaveMore, CUSTOMER_TIERS } from "../customerSubscription";
import { invalidateOgImageCache } from "../ogTags";
import { customerHasFeature, providerHasFeature } from "@shared/entitlements";
import { queueCrmBookingProjection, queueCrmQuoteProjection } from "../crm/sourceHooks";
import { evaluateBookingWindow, OLOGYCREW_BOOKING_TIME_ZONE } from "@shared/bookingPolicy";
import { calculateBookingEndTime } from "@shared/bookingIntervals";
import { BookingReservationConflictError, QuoteConversionConflictError } from "../db/bookings";

export const providerRouter = router({
  create: protectedProcedure
    .input(z.object({
      businessName: z.string(),
      businessType: z.enum(["sole_proprietor", "llc", "corporation", "partnership"]),
      description: z.string().optional(),
      addressLine1: z.string().optional(),
      addressLine2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      serviceRadiusMiles: z.number().optional(),
      acceptsMobile: z.boolean().default(false),
      acceptsFixedLocation: z.boolean().default(true),
      acceptsVirtual: z.boolean().default(false),
      categoryIds: z.array(z.number()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Block unverified email users from creating a provider profile
      if (!ctx.user.emailVerified) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Please verify your email address before setting up your provider profile. Check your inbox for the verification link.",
        });
      }

      const existing = await db.getProviderByUserId(ctx.user.id);
      if (existing) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Provider profile already exists" });
      }
      const { categoryIds, ...providerData } = input;
      await db.createServiceProvider({ userId: ctx.user.id, ...providerData });
      const provider = await db.getProviderByUserId(ctx.user.id);
      if (!provider) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create provider" });
      
      // Update user role to 'provider' and mark role selection complete
      await db.updateUserProfile(ctx.user.id, { role: "provider", hasSelectedRole: true });

      // Auto-generate slug
      const baseSlug = provider.businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const slug = `${baseSlug}-${provider.id}`;
      await db.updateProviderSlug(provider.id, slug);

      // Add categories if provided
      if (categoryIds && categoryIds.length > 0) {
        await db.setProviderCategories(provider.id, categoryIds);
      }

      // Send welcome provider email
      if (ctx.user.email) {
        try {
          const { sendNotification } = await import("../notifications");
          await sendNotification({
            type: "welcome_provider",
            channel: "email",
            recipient: {
              userId: ctx.user.id,
              email: ctx.user.email,
              name: ctx.user.name || undefined,
            },
            data: {
              providerName: provider.businessName || ctx.user.name || "there",
            },
          });
        } catch (err) {
          console.error("[Provider] Failed to send welcome provider email:", err);
        }
      }

      return provider;
    }),
    
  getMyProfile: protectedProcedure.query(async ({ ctx }) => {
    const provider = await db.getProviderByUserId(ctx.user.id);
    if (!provider) return null;
    const user = await db.getUserById(ctx.user.id);
    return {
      ...provider,
      profilePhotoUrl: user?.profilePhotoUrl || null,
    };
  }),
  
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const provider = await db.getProviderById(input.id);
      if (!provider || !provider.isActive) return null;
      const [effectiveTier, trustProfile] = await Promise.all([
        db.getProviderTier(provider.id),
        db.getProviderTrustProfile(provider.id),
      ]);
      // Security: Strip sensitive internal fields from public response
      const {
        stripeAccountId,
        verificationStatus: _legacyVerificationStatus,
        insuranceVerified: _legacyInsuranceVerified,
        backgroundCheckVerified: _legacyBackgroundCheckVerified,
        ...safeProviderRaw
      } = provider;
      const safeProvider = provider.isOfficial
        ? { ...safeProviderRaw, averageRating: "0.00", totalReviews: 0, totalBookings: 0 }
        : safeProviderRaw;
      return {
        ...safeProvider,
        trustProfile,
        canAcceptPlatformPayments:
          !provider.isOfficial &&
          provider.payoutEnabled === true &&
          !!stripeAccountId &&
          providerHasFeature(effectiveTier, "paymentCollection"),
      };
    }),
    
  getMine: protectedProcedure.query(async ({ ctx }) => {
    return await db.getProviderByUserId(ctx.user.id);
  }),
    
  list: publicProcedure
    .input(z.object({
      city: z.string().optional(),
      state: z.string().optional(),
      isActive: z.boolean().optional(),
    }).optional())
    .query(async ({ input }) => {
      return await db.getAllProviders({ ...(input || {}), isActive: true });
    }),

  search: publicProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ input }) => {
      if (!input.query.trim()) return [];
      const providers = await db.searchProviders(input.query.trim());
      // Enrich with categories
      const enriched = await Promise.all(
        providers.map(async (provider: any) => {
          const categories = await db.getProviderCategories(provider.id);
          let slug = provider.profileSlug;
          if (!slug) {
            const baseSlug = provider.businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
            slug = `${baseSlug}-${provider.id}`;
            await db.updateProviderSlug(provider.id, slug);
          }
          return {
            ...provider,
            slug,
            profileSlug: slug,
            categories: categories.map((c: any) => ({ id: c.categoryId, name: c.categoryName })),
          };
        })
      );
      return enriched;
    }),

  /**
   * Get spotlight providers with Established or Top Activity standing, sorted by the internal standing score.
   * Used for the "Provider Spotlight" section on the homepage.
   */
  getSpotlightProviders: publicProcedure.query(async () => {
    const providers = await db.getAllProviders({ isActive: true });
    // Filter to only trusted and top_pro trust levels
    const spotlightCandidates = providers.filter(
      (p: any) => p.trustLevel === "top_pro" || p.trustLevel === "trusted"
    );
    // Sort by trust score descending, then by rating
    const sorted = spotlightCandidates
      .sort((a: any, b: any) => {
        const scoreDiff = (b.trustScore || 0) - (a.trustScore || 0);
        if (scoreDiff !== 0) return scoreDiff;
        return parseFloat(b.averageRating || "0") - parseFloat(a.averageRating || "0");
      })
      .slice(0, 6);
    // Enrich with categories, profile photo, and trust data
    const enriched = await Promise.all(
      sorted.map(async (provider: any) => {
        const categories = await db.getProviderCategories(provider.id);
        const user = await db.getUserById(provider.userId);
        let slug = provider.profileSlug;
        if (!slug) {
          const baseSlug = provider.businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
          slug = `${baseSlug}-${provider.id}`;
          await db.updateProviderSlug(provider.id, slug);
        }
        return {
          id: provider.id,
          businessName: provider.businessName,
          slug,
          profileSlug: slug,
          profilePhotoUrl: user?.profilePhotoUrl || null,
          city: provider.city,
          state: provider.state,
          averageRating: provider.averageRating,
          totalReviews: provider.totalReviews,
          totalBookings: provider.totalBookings,
          trustScore: provider.trustScore,
          trustLevel: provider.trustLevel,
          isOfficial: provider.isOfficial,
          categories: categories.map((c: any) => ({ id: c.categoryId, name: c.categoryName })),
        };
      })
    );
    return enriched;
  }),

  listFeatured: publicProcedure.query(async () => {
    const providers = await db.getAllProviders({ isActive: true });
    // Separate official provider(s) to ensure they always appear first
    const officialProviders = providers.filter((p: any) => p.isOfficial);
    const regularProviders = providers.filter((p: any) => !p.isOfficial);
    // Get top providers by rating
    const sorted = regularProviders
      .filter((p: any) => parseFloat(p.averageRating || "0") > 0 || p.totalReviews > 0)
      .sort((a: any, b: any) => parseFloat(b.averageRating || "0") - parseFloat(a.averageRating || "0"))
      .slice(0, 8 - officialProviders.length);
    // If fewer than needed, fill with recently created active providers
    if (sorted.length < 8 - officialProviders.length) {
      const remaining = regularProviders
        .filter((p: any) => !sorted.find((s: any) => s.id === p.id))
        .slice(0, 8 - officialProviders.length - sorted.length);
      sorted.push(...remaining);
    }
    // Official first, then rated providers
    sorted.unshift(...officialProviders);
    // Enrich with categories, profile photo, and ensure slug exists
    const enriched = await Promise.all(
      sorted.slice(0, 8).map(async (provider: any) => {
        const categories = await db.getProviderCategories(provider.id);
        const user = await db.getUserById(provider.userId);
        // Auto-generate slug if missing
        let slug = provider.profileSlug;
        if (!slug) {
          const baseSlug = provider.businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
          slug = `${baseSlug}-${provider.id}`;
          await db.updateProviderSlug(provider.id, slug);
        }
        return {
          ...provider,
          slug,
          profileSlug: slug,
          profilePhotoUrl: user?.profilePhotoUrl || null,
          categories: categories.map((c: any) => ({ id: c.categoryId, name: c.categoryName })),
        };
      })
    );
    return enriched;
  }),

  update: protectedProcedure
    .input(z.object({
      businessName: z.string().optional(),
      description: z.string().optional(),
      addressLine1: z.string().optional(),
      addressLine2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      serviceRadiusMiles: z.number().optional(),
      acceptsMobile: z.boolean().optional(),
      acceptsFixedLocation: z.boolean().optional(),
      acceptsVirtual: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const provider = await db.getProviderByUserId(ctx.user.id);
      if (!provider) throw new TRPCError({ code: "FORBIDDEN", message: "Must be a provider" });
      await db.updateProviderProfile(provider.id, input);
      // Invalidate OG image cache so social previews reflect updated info
      if (provider.profileSlug) invalidateOgImageCache(provider.profileSlug);
      // Recalculate trust score after profile update
      try { await db.updateProviderTrustScore(provider.id); } catch (e) { console.error("[TrustScore] Recalc failed:", e); }
      const updated = await db.getProviderByUserId(ctx.user.id);
      return updated!;
    }),

  // ============================================================================
  // PROFILE PHOTO
  // ============================================================================

  uploadProfilePhoto: protectedProcedure
    .input(z.object({
      photoData: z.string(), // base64
      contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]).default("image/jpeg"),
    }))
    .mutation(async ({ ctx, input }) => {
      const { storagePut } = await import("../storage");
      const buffer = Buffer.from(input.photoData, "base64");
      // Security: Enforce max file size (5MB)
      if (buffer.length > 5 * 1024 * 1024) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "File too large. Maximum size is 5MB." });
      }
      const ext = input.contentType.split("/")[1] || "jpg";
      const suffix = Math.random().toString(36).substring(2, 10);
      const fileKey = `profile-photos/${ctx.user.id}/${Date.now()}-${suffix}.${ext}`;
      const { url } = await storagePut(fileKey, buffer, input.contentType);
      
      // Update user profile photo
      await db.updateUserProfile(ctx.user.id, { profilePhotoUrl: url });
      // Invalidate OG image cache so social previews use new photo
      const provider = await db.getProviderByUserId(ctx.user.id);
      if (provider?.profileSlug) invalidateOgImageCache(provider.profileSlug);
      // Recalculate trust score after photo upload
      if (provider) { try { await db.updateProviderTrustScore(provider.id); } catch (e) { console.error("[TrustScore] Recalc failed:", e); } }
      return { url };
    }),

  removeProfilePhoto: protectedProcedure
    .mutation(async ({ ctx }) => {
      await db.updateUserProfile(ctx.user.id, { profilePhotoUrl: null });
      const provider = await db.getProviderByUserId(ctx.user.id);
      if (provider?.profileSlug) invalidateOgImageCache(provider.profileSlug);
      return { success: true };
    }),

  // ============================================================================
  // MULTI-CATEGORY MANAGEMENT
  // ============================================================================

  getMyCategories: protectedProcedure.query(async ({ ctx }) => {
    const provider = await db.getProviderByUserId(ctx.user.id);
    if (!provider) return [];
    const providerCats = await db.getProviderCategories(provider.id);
    // Enrich with category details
    const allCategories = await db.getAllCategories();
    const categoryMap = new Map(allCategories.map(c => [c.id, c]));
    return providerCats.map(pc => ({
      ...pc,
      category: categoryMap.get(pc.categoryId),
    }));
  }),

  setMyCategories: protectedProcedure
    .input(z.object({ categoryIds: z.array(z.number()).min(1, "Select at least one category") }))
    .mutation(async ({ ctx, input }) => {
      const provider = await db.getProviderByUserId(ctx.user.id);
      if (!provider) throw new TRPCError({ code: "FORBIDDEN", message: "Must be a provider" });
      // Enforce category limit based on subscription tier
      const { canProviderAddCategory, SUBSCRIPTION_TIERS } = await import("../products");
      const tier = await db.getProviderTier(provider.id);
      const maxCategories = SUBSCRIPTION_TIERS[tier].limits.maxCategories;
      if (input.categoryIds.length > maxCategories) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Your ${SUBSCRIPTION_TIERS[tier].name} plan allows up to ${maxCategories === 999 ? "unlimited" : maxCategories} service ${maxCategories === 1 ? "category" : "categories"}. Upgrade your plan to add more.`,
        });
      }
      await db.setProviderCategories(provider.id, input.categoryIds);
      return { success: true, count: input.categoryIds.length };
    }),

  addCategory: protectedProcedure
    .input(z.object({ categoryId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const provider = await db.getProviderByUserId(ctx.user.id);
      if (!provider) throw new TRPCError({ code: "FORBIDDEN", message: "Must be a provider" });
      // Enforce category limit based on subscription tier
      const { canProviderAddCategory, SUBSCRIPTION_TIERS } = await import("../products");
      const tier = await db.getProviderTier(provider.id);
      const currentCategories = await db.getProviderCategories(provider.id);
      if (!canProviderAddCategory(tier, currentCategories.length)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Your ${SUBSCRIPTION_TIERS[tier].name} plan allows up to ${SUBSCRIPTION_TIERS[tier].limits.maxCategories === 999 ? "unlimited" : SUBSCRIPTION_TIERS[tier].limits.maxCategories} service ${SUBSCRIPTION_TIERS[tier].limits.maxCategories === 1 ? "category" : "categories"}. Upgrade your plan to add more.`,
        });
      }
      await db.addProviderCategory(provider.id, input.categoryId);
      return { success: true };
    }),

  removeCategory: protectedProcedure
    .input(z.object({ categoryId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const provider = await db.getProviderByUserId(ctx.user.id);
      if (!provider) throw new TRPCError({ code: "FORBIDDEN", message: "Must be a provider" });
      await db.removeProviderCategory(provider.id, input.categoryId);
      return { success: true };
    }),

  // ============================================================================
  // EARNINGS & ANALYTICS
  // ============================================================================

  earnings: protectedProcedure.query(async ({ ctx }) => {
    const provider = await db.getProviderByUserId(ctx.user.id);
    if (!provider) throw new TRPCError({ code: "FORBIDDEN", message: "Must be a provider" });
    return await db.getProviderEarnings(provider.id);
  }),

  analytics: protectedProcedure.query(async ({ ctx }) => {
    const provider = await db.getProviderByUserId(ctx.user.id);
    if (!provider) throw new TRPCError({ code: "FORBIDDEN", message: "Must be a provider" });
    const tier = await db.getProviderTier(provider.id);
    if (!providerHasFeature(tier, "analyticsAccess")) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Business analytics are available on Pro and Business. Upgrade to view detailed performance insights.",
      });
    }
    const [bookingTrends, topServices, customerRetention, bookingSources, refundAnalytics] = await Promise.all([
      db.getBookingTrends(provider.id),
      db.getTopServices(provider.id),
      db.getCustomerRetention(provider.id),
      db.getBookingSourceAnalytics(provider.id),
      db.getRefundAnalytics(provider.id),
    ]);
    return { bookingTrends, topServices, customerRetention, bookingSources, refundAnalytics };
  }),

  // ============================================================================
  // PUBLIC PROFILE
  // ============================================================================

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const provider = await db.getProviderBySlug(input.slug);
      if (!provider || !provider.isActive) throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found" });
      const [providerServices, providerReviews, providerCats, trustProfile] = await Promise.all([
        db.getServicesByProvider(provider.id),
        db.getProviderReviewsPublic(provider.id),
        db.getProviderCategories(provider.id),
        db.getProviderTrustProfile(provider.id),
      ]);
      // Enrich categories
      const allCategories = await db.getAllCategories();
      const categoryMap = new Map(allCategories.map(c => [c.id, c]));
      const categories = providerCats.map(pc => categoryMap.get(pc.categoryId)).filter(Boolean);
      
      // Get user info for profile photo
      const user = await db.getUserById(provider.userId);
      // Security: Strip sensitive internal fields from public response
      const {
        stripeAccountId,
        verificationStatus: _legacyVerificationStatus,
        insuranceVerified: _legacyInsuranceVerified,
        backgroundCheckVerified: _legacyBackgroundCheckVerified,
        ...safeProviderRaw
      } = provider;
      const safeProvider = provider.isOfficial
        ? { ...safeProviderRaw, averageRating: "0.00", totalReviews: 0, totalBookings: 0 }
        : safeProviderRaw;
      return { 
        provider: safeProvider, 
        services: providerServices, 
        reviews: provider.isOfficial ? [] : providerReviews,
        categories,
        profilePhoto: user?.profilePhotoUrl || null,
        trustProfile,
      };
    }),

  generateSlug: protectedProcedure.mutation(async ({ ctx }) => {
    const provider = await db.getProviderByUserId(ctx.user.id);
    if (!provider) throw new TRPCError({ code: "FORBIDDEN", message: "Must be a provider" });
    const baseSlug = provider.businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const slug = `${baseSlug}-${provider.id}`;
    await db.updateProviderSlug(provider.id, slug);
    return { slug };
  }),

  updateSlug: protectedProcedure
    .input(z.object({ slug: z.string().min(3).max(100).regex(/^[a-z0-9-]+$/) }))
    .mutation(async ({ ctx, input }) => {
      if (input.slug === "platform") {
        throw new TRPCError({ code: "CONFLICT", message: "This URL is reserved for OlogyCrew" });
      }
      const provider = await db.getProviderByUserId(ctx.user.id);
      if (!provider) throw new TRPCError({ code: "FORBIDDEN", message: "Must be a provider" });
      const tier = await db.getProviderTier(provider.id);
      if (!providerHasFeature(tier, "customSlug")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Custom profile URLs are available on the Pro plan and above. Upgrade to customize your link." });
      }
      const existing = await db.getProviderBySlug(input.slug);
      if (existing && existing.id !== provider.id) {
        throw new TRPCError({ code: "CONFLICT", message: "This URL is already taken" });
      }
      await db.updateProviderSlug(provider.id, input.slug);
      return { slug: input.slug };
    }),

  getPublicServices: publicProcedure
    .input(z.object({ providerId: z.number() }))
    .query(async ({ input }) => {
      return await db.getServicesByProvider(input.providerId);
    }),

  getCalendarFeedUrl: protectedProcedure
    .query(async ({ ctx }) => {
      const provider = await db.getProviderByUserId(ctx.user.id);
      if (!provider) throw new TRPCError({ code: "FORBIDDEN", message: "Must be a provider" });
      const { generateCalendarToken } = await import("../calendarFeed");
      const token = generateCalendarToken(provider.id);
      const origin = ctx.req.headers.origin || ctx.req.headers.host || "";
      const protocol = ctx.req.headers["x-forwarded-proto"] || "https";
      const baseUrl = origin.startsWith("http") ? origin : `${protocol}://${origin}`;
      return {
        feedUrl: `${baseUrl}/api/calendar/${token}/feed.ics`,
        googleCalUrl: `https://calendar.google.com/calendar/r?cid=webcal://${(origin.startsWith("http") ? origin.replace(/^https?:\/\//, "") : origin)}/api/calendar/${token}/feed.ics`,
        token,
      };
    }),

  // ============================================================================
  // PORTFOLIO MANAGEMENT
  // ============================================================================

  getPortfolio: protectedProcedure
    .query(async ({ ctx }) => {
      const provider = await db.getProviderByUserId(ctx.user.id);
      if (!provider) throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found" });
      return await db.getPortfolioByProvider(provider.id);
    }),

  getPublicPortfolio: publicProcedure
    .input(z.object({ providerId: z.number() }))
    .query(async ({ input }) => {
      return await db.getPortfolioByProvider(input.providerId);
    }),

  addPortfolioItem: protectedProcedure
    .input(z.object({
      categoryId: z.number().optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      imageUrl: z.string(),
      mediaType: z.enum(["image", "before_after"]).default("image"),
      beforeImageUrl: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const provider = await db.getProviderByUserId(ctx.user.id);
      if (!provider) throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found" });
      const count = await db.getPortfolioItemCount(provider.id);
      if (count >= 50) throw new TRPCError({ code: "BAD_REQUEST", message: "Maximum 50 portfolio items allowed" });
      await db.createPortfolioItem({ providerId: provider.id, ...input });
      return { success: true };
    }),

  updatePortfolioItem: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      description: z.string().optional(),
      categoryId: z.number().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const provider = await db.getProviderByUserId(ctx.user.id);
      if (!provider) throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found" });
      const { id, ...data } = input;
      await db.updatePortfolioItem(id, provider.id, data);
      return { success: true };
    }),

  deletePortfolioItem: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const provider = await db.getProviderByUserId(ctx.user.id);
      if (!provider) throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found" });
      await db.deletePortfolioItem(input.id, provider.id);
      return { success: true };
    }),

  uploadPortfolioPhoto: protectedProcedure
    .input(z.object({
      base64: z.string(),
      mimeType: z.string(),
      fileName: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const provider = await db.getProviderByUserId(ctx.user.id);
      if (!provider) throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found" });
      const { storagePut } = await import("../storage");
      const buffer = Buffer.from(input.base64, "base64");
      const suffix = Math.random().toString(36).slice(2, 10);
      const key = `portfolio/${provider.id}/${suffix}-${input.fileName}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      return { url };
    }),

  listByCategory: publicProcedure
    .input(z.object({ categoryId: z.number() }))
    .query(async ({ input }) => {
      // Get all providers who have this category in their provider_categories
      const providerIds = await db.getProvidersByCategory(input.categoryId);
      if (providerIds.length === 0) return [];
      // Fetch full provider details
      const providers = await Promise.all(
        providerIds.map(async (id: number) => {
          const provider = await db.getProviderById(id);
          if (!provider || !provider.isActive) return null;
          // Get profile photo
          const user = await db.getUserById(provider.userId);
          return { ...provider, profilePhotoUrl: user?.profilePhotoUrl || null };
        })
      );
      // Sort: official provider first, then by rating
      return providers.filter(Boolean).sort((a: any, b: any) => {
        if (a.isOfficial && !b.isOfficial) return -1;
        if (!a.isOfficial && b.isOfficial) return 1;
        return parseFloat(b.averageRating || '0') - parseFloat(a.averageRating || '0');
      });
    }),

  getNextAvailable: publicProcedure
    .input(z.object({ providerId: z.number(), days: z.number().default(7) }))
    .query(async ({ input }) => {
      const schedule = await db.getAvailabilityByProvider(input.providerId);
      if (!schedule || schedule.length === 0) return { slots: [], hasAvailability: false };

      // Get overrides for the next N days
      const today = new Date();
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + input.days);
      const todayStr = today.toISOString().split("T")[0];
      const endStr = endDate.toISOString().split("T")[0];
      const overrides = await db.getAvailabilityOverrides(input.providerId, todayStr, endStr);

      // Build a map of overrides by date
      const overrideMap = new Map<string, any>();
      for (const o of overrides) {
        overrideMap.set(o.overrideDate, o);
      }

      // Compute next available slots
      const slots: { date: string; dayName: string; startTime: string; endTime: string }[] = [];
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

      for (let d = 0; d < input.days && slots.length < 3; d++) {
        const date = new Date(today);
        date.setDate(date.getDate() + d);
        const dateStr = date.toISOString().split("T")[0];
        const dayOfWeek = date.getDay();

        // Check override first
        const override = overrideMap.get(dateStr);
        if (override && !override.isAvailable) continue;

        // Find schedule for this day
        const daySchedules = schedule.filter((s: any) => s.dayOfWeek === dayOfWeek && s.isAvailable);
        for (const s of daySchedules) {
          if (slots.length >= 3) break;
          slots.push({
            date: dateStr,
            dayName: dayNames[dayOfWeek],
            startTime: s.startTime,
            endTime: s.endTime,
          });
        }
      }

      return { slots, hasAvailability: slots.length > 0 };
    }),

  // ========================================================================
  // FAVORITES
  // ========================================================================
  toggleFavorite: protectedProcedure
    .input(z.object({ providerId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const already = await db.isFavorited(ctx.user.id, input.providerId);
      if (already) {
        await db.removeFavorite(ctx.user.id, input.providerId);
        return { favorited: false, limitReached: false };
      } else {
        // Check saved provider limit based on customer subscription tier
        const tier = await db.getCustomerTier(ctx.user.id);
        const currentCount = await db.getUserFavoriteCount(ctx.user.id);
        if (!canCustomerSaveMore(tier, currentCount)) {
          const config = CUSTOMER_TIERS[tier];
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `You've reached the limit of ${config.savedProviderLimit} saved providers on the ${config.name} plan. Upgrade to save more!`,
          });
        }
        await db.addFavorite(ctx.user.id, input.providerId);
        const newCount = currentCount + 1;
        const limit = CUSTOMER_TIERS[tier].savedProviderLimit;
        return {
          favorited: true,
          limitReached: limit !== -1 && newCount >= limit,
          currentCount: newCount,
          limit,
          tier,
        };
      }
    }),

  checkFavorite: protectedProcedure
    .input(z.object({ providerId: z.number() }))
    .query(async ({ ctx, input }) => {
      return { favorited: await db.isFavorited(ctx.user.id, input.providerId) };
    }),

  myFavorites: protectedProcedure
    .query(async ({ ctx }) => {
      return db.getUserFavorites(ctx.user.id);
    }),

  // ========================================================================
  // SERVICE PACKAGES
  // ========================================================================
  createPackage: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      packagePrice: z.string(),
      originalPrice: z.string(),
      durationMinutes: z.number().optional(),
      imageUrl: z.string().optional(),
      serviceIds: z.array(z.number()).min(2, "A package must include at least 2 services"),
    }))
    .mutation(async ({ ctx, input }) => {
      const provider = await db.getProviderByUserId(ctx.user.id);
      if (!provider) throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found" });
      return db.createPackage({ providerId: provider.id, ...input });
    }),

  updatePackage: protectedProcedure
    .input(z.object({
      packageId: z.number(),
      name: z.string().optional(),
      description: z.string().optional(),
      packagePrice: z.string().optional(),
      originalPrice: z.string().optional(),
      durationMinutes: z.number().optional(),
      imageUrl: z.string().optional(),
      serviceIds: z.array(z.number()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const provider = await db.getProviderByUserId(ctx.user.id);
      if (!provider) throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found" });
      const { packageId, ...data } = input;
      return db.updatePackage(packageId, provider.id, data);
    }),

  deletePackage: protectedProcedure
    .input(z.object({ packageId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const provider = await db.getProviderByUserId(ctx.user.id);
      if (!provider) throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found" });
      await db.deletePackage(input.packageId, provider.id);
      return { success: true };
    }),

  myPackages: protectedProcedure
    .query(async ({ ctx }) => {
      const provider = await db.getProviderByUserId(ctx.user.id);
      if (!provider) return [];
      return db.getPackagesByProvider(provider.id);
    }),

  getPublicPackages: publicProcedure
    .input(z.object({ providerId: z.number() }))
    .query(async ({ input }) => {
      return db.getPublicPackagesByProvider(input.providerId);
    }),

  // ========================================================================
  // RESPONSE TIME
  // ========================================================================
  getResponseTime: publicProcedure
    .input(z.object({ providerId: z.number() }))
    .query(async ({ input }) => {
      // Compute average response time from messages where provider is the recipient
      const provider = await db.getProviderById(input.providerId);
      if (!provider) return { avgMinutes: null, label: "Unknown" };
      
      const { getDb } = await import("../db/connection");
      const dbConn = await getDb();
      if (!dbConn) return { avgMinutes: null, label: "Unknown" };
      
      const { messages } = await import("../../drizzle/schema");
      const { eq, and, isNotNull, sql } = await import("drizzle-orm");
      
      // Get conversations where provider received messages and responded
      // We look at pairs: customer message → provider reply in same conversation
      const providerUserId = provider.userId;
      
      const received = await dbConn
        .select({
          conversationId: messages.conversationId,
          receivedAt: messages.createdAt,
        })
        .from(messages)
        .where(and(
          eq(messages.recipientId, providerUserId),
        ))
        .orderBy(messages.createdAt)
        .limit(100);
      
      const sent = await dbConn
        .select({
          conversationId: messages.conversationId,
          sentAt: messages.createdAt,
        })
        .from(messages)
        .where(eq(messages.senderId, providerUserId))
        .orderBy(messages.createdAt)
        .limit(100);
      
      // For each received message, find the next sent message in the same conversation
      const responseTimes: number[] = [];
      for (const recv of received) {
        const reply = sent.find(
          (s: any) => s.conversationId === recv.conversationId && s.sentAt > recv.receivedAt
        );
        if (reply) {
          const diffMs = new Date(reply.sentAt).getTime() - new Date(recv.receivedAt).getTime();
          const diffMin = diffMs / 60000;
          if (diffMin > 0 && diffMin < 1440) { // Only count responses within 24h
            responseTimes.push(diffMin);
          }
        }
      }
      
      if (responseTimes.length === 0) {
        return { avgMinutes: null, label: "New provider" };
      }
      
      const avg = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      let label = "";
      if (avg < 15) label = "Responds within 15 min";
      else if (avg < 60) label = `Responds within ${Math.round(avg)} min`;
      else if (avg < 120) label = "Responds within 1 hour";
      else if (avg < 240) label = "Responds within a few hours";
      else label = "Responds within a day";
      
      return { avgMinutes: Math.round(avg), label };
    }),

  // ============================================================================
  // QUOTE REQUESTS
  // ============================================================================

  requestQuote: protectedProcedure
    .input(z.object({
      providerId: z.number(),
      serviceId: z.number().optional(),
      categoryId: z.number().optional(),
      title: z.string().min(5, "Title must be at least 5 characters"),
      description: z.string().min(20, "Please describe your needs in at least 20 characters"),
      preferredDate: z.string().optional(),
      preferredTime: z.string().optional(),
      locationType: z.enum(["mobile", "fixed_location", "virtual", "hybrid", "flexible", "teams", "zoom", "other"]).optional(),
      location: z.string().optional(),
      attachmentUrls: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const provider = await db.getProviderById(input.providerId);
      if (!provider || provider.isActive === false || provider.deletedAt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "This provider is not currently available." });
      }
      if (input.serviceId !== undefined) {
        const service = await db.getServiceById(input.serviceId);
        if (!service || !service.isActive || service.deletedAt || service.providerId !== input.providerId) {
          throw new TRPCError({ code: "NOT_FOUND", message: "This service is not currently available." });
        }
      }
      const result = await db.createQuoteRequest({
        customerId: ctx.user.id,
        providerId: input.providerId,
        serviceId: input.serviceId,
        categoryId: input.categoryId,
        title: input.title,
        description: input.description,
        preferredDate: input.preferredDate,
        preferredTime: input.preferredTime,
        locationType: input.locationType,
        location: input.location,
        attachmentUrls: input.attachmentUrls ? JSON.stringify(input.attachmentUrls) : undefined,
      });
      queueCrmQuoteProjection(result.id);

      // Send notification to provider about new quote request
      try {
        const { sendMultiChannelNotification } = await import("../notifications");
        const { sendPushNotification } = await import("../notifications/pushHelper");
        const providerData = await db.getProviderById(input.providerId);
        const providerUser = providerData ? await db.getUserById(providerData.userId) : null;
        if (providerUser) {
          await sendMultiChannelNotification(
            {
              type: "quote_request_new",
              recipient: { userId: providerUser.id, email: providerUser.email || undefined, phone: providerUser.phone || undefined, name: providerUser.name || "Provider" },
              data: {
                quoteTitle: input.title,
                quoteDescription: input.description.slice(0, 200),
                customerName: ctx.user.name || "Customer",
                providerName: providerData?.businessName || providerUser.name || "Provider",
                preferredDate: input.preferredDate,
                preferredTime: input.preferredTime,
                location: input.location,
              },
            },
            ["email", "sms"],
          );
          // Push notification for new quote request
          sendPushNotification("quote_request_new", { userId: providerUser.id, name: providerUser.name || "Provider" }, {
            customerName: ctx.user.name || "Customer",
            quoteTitle: input.title,
          });
        }
      } catch (err) {
        console.error("[QuoteRequest] Notification failed (non-blocking):", err);
      }

      return result;
    }),

  myQuotes: protectedProcedure
    .query(async ({ ctx }) => {
      return db.getQuotesByCustomer(ctx.user.id);
    }),

  providerQuotes: protectedProcedure
    .query(async ({ ctx }) => {
      const provider = await db.getProviderByUserId(ctx.user.id);
      if (!provider) throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found" });
      const quotes = await db.getQuotesByProvider(provider.id);
      // Enrich with customer and service names
      const enriched = await Promise.all(quotes.map(async (q) => {
        const customer = await db.getUserById(q.customerId);
        return {
          ...q,
          customerName: customer?.name || customer?.firstName || "Customer",
          customerEmail: customer?.email,
        };
      }));
      return enriched;
    }),

  respondToQuote: protectedProcedure
    .input(z.object({
      quoteId: z.number(),
      quotedAmount: z.string(),
      quotedDurationMinutes: z.number().min(15),
      providerNotes: z.string().optional(),
      validDays: z.number().default(7),
    }))
    .mutation(async ({ ctx, input }) => {
      const quote = await db.getQuoteById(input.quoteId);
      if (!quote) throw new TRPCError({ code: "NOT_FOUND", message: "Quote not found" });
      
      const provider = await db.getProviderByUserId(ctx.user.id);
      if (!provider || quote.providerId !== provider.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      if (provider.isActive === false || provider.deletedAt) {
        throw new TRPCError({ code: "FORBIDDEN", message: "This provider account is suspended and cannot respond to quotes." });
      }
      if (quote.status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Quote has already been responded to" });
      }

      await db.respondToQuote(input.quoteId, {
        quotedAmount: input.quotedAmount,
        quotedDurationMinutes: input.quotedDurationMinutes,
        providerNotes: input.providerNotes,
        validUntil: new Date(Date.now() + input.validDays * 24 * 60 * 60 * 1000),
      });
      queueCrmQuoteProjection(input.quoteId);

      // Send notification to customer about quote response
      try {
        const { sendMultiChannelNotification } = await import("../notifications");
        const { sendPushNotification } = await import("../notifications/pushHelper");
        const customer = await db.getUserById(quote.customerId);
        if (customer) {
          await sendMultiChannelNotification(
            {
              type: "quote_response_received",
              recipient: { userId: customer.id, email: customer.email || undefined, phone: customer.phone || undefined, name: customer.name || "Customer" },
              data: {
                quoteTitle: quote.title,
                quotedAmount: input.quotedAmount,
                quotedDuration: `${input.quotedDurationMinutes} minutes`,
                providerNotes: input.providerNotes,
                providerName: provider.businessName || "Provider",
                customerName: customer.name || "Customer",
                validUntil: new Date(Date.now() + input.validDays * 24 * 60 * 60 * 1000).toLocaleDateString(),
              },
            },
            ["email", "sms"],
          );
          // Push notification for quote response
          sendPushNotification("quote_response_received", { userId: customer.id, name: customer.name || "Customer" }, {
            providerName: provider.businessName || "Provider",
            quotedAmount: input.quotedAmount,
          });
        }
      } catch (err) {
        console.error("[QuoteRespond] Notification failed (non-blocking):", err);
      }

      return { success: true };
    }),

  updateQuoteStatus: protectedProcedure
    .input(z.object({
      quoteId: z.number(),
      status: z.enum(["accepted", "declined"]),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const quote = await db.getQuoteById(input.quoteId);
      if (!quote) throw new TRPCError({ code: "NOT_FOUND", message: "Quote not found" });
      
      // Customer can accept/decline a quoted price
      // Provider can decline a pending request
      const isCustomer = quote.customerId === ctx.user.id;
      const provider = await db.getProviderByUserId(ctx.user.id);
      const isProvider = provider && quote.providerId === provider.id;
      
      if (!isCustomer && !isProvider) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      if (isCustomer && input.status === "accepted" && quote.status !== "quoted") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Can only accept a quoted price" });
      }
      if (isCustomer && input.status === "accepted" && quote.validUntil && new Date(quote.validUntil).getTime() <= Date.now()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This quote has expired. Please request a new quote." });
      }
      if (isCustomer && input.status === "accepted" && (!quote.quotedAmount || !quote.quotedDurationMinutes)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This quote is incomplete and cannot be accepted." });
      }
      if (input.status === "declined") {
        await db.updateQuoteStatus(input.quoteId, input.status, input.reason);
        queueCrmQuoteProjection(input.quoteId);
      }

      // If accepted, auto-create a booking from the quote
      let bookingId: number | null = null;
      if (isCustomer && input.status === "accepted" && quote.quotedAmount && quote.quotedDurationMinutes) {
        try {
          const service = quote.serviceId ? await db.getServiceById(quote.serviceId) : null;
          const providerData = await db.getProviderById(quote.providerId);
          if (!service?.isActive || service.deletedAt || service.providerId !== quote.providerId || !providerData?.isActive || providerData.deletedAt) {
            throw new TRPCError({ code: "NOT_FOUND", message: "This quoted service is no longer available." });
          }
          const [providerUser, category] = await Promise.all([
            db.getUserById(providerData.userId),
            db.getCategoryById(service.categoryId),
          ]);
          if (!providerUser || providerUser.deletedAt || !category?.isActive) {
            throw new TRPCError({ code: "NOT_FOUND", message: "This quoted service is no longer available." });
          }

          const bookingNumber = `OC-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
          const subtotal = parseFloat(quote.quotedAmount).toFixed(2);
          const platformFee = (parseFloat(subtotal) * 0.01).toFixed(2);
          const totalAmount = (parseFloat(subtotal) + parseFloat(platformFee)).toFixed(2);
          const bookingDate = quote.preferredDate
            ? new Date(quote.preferredDate).toISOString().split("T")[0]
            : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
          const startTime = quote.preferredTime || "09:00";
          const durationMinutes = quote.quotedDurationMinutes;
          if (durationMinutes < 1 || durationMinutes > 24 * 60) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "The quoted duration is invalid." });
          }
          const endTime = calculateBookingEndTime(startTime, durationMinutes);
          const policy = evaluateBookingWindow({
            bookingDate,
            startTime,
            minAdvanceBookingHours: service.minAdvanceBookingHours,
            maxAdvanceBookingDays: service.maxAdvanceBookingDays,
            timeZone: OLOGYCREW_BOOKING_TIME_ZONE,
          });
          if (!policy.allowed) throw new TRPCError({ code: "BAD_REQUEST", message: policy.message });
          bookingId = await db.createBookingWithCalendarGuard({ booking: {
            bookingNumber,
            customerId: ctx.user.id,
            providerId: quote.providerId,
            serviceId: service.id,
            bookingDate,
            startTime,
            endTime,
            durationMinutes,
            status: "pending",
            locationType: quote.locationType || "fixed_location",
            serviceAddressLine1: typeof quote.location === "string" ? quote.location : undefined,
            customerNotes: `Converted from quote: ${quote.title}`,
            bookingSource: "quote",
            quoteRequestId: quote.id,
            subtotal,
            platformFee,
            totalAmount,
            depositAmount: "0.00",
            remainingAmount: totalAmount,
          }, isGroupClass: Boolean(service.isGroupClass), maxCapacity: service.maxCapacity || 1, quoteId: quote.id });

          queueCrmQuoteProjection(quote.id);
          queueCrmBookingProjection(bookingId);
          console.log(`[Quote] Auto-created booking #${bookingNumber} from quote #${quote.id}`);
        } catch (err) {
          console.error("[Quote] Failed to auto-create booking from accepted quote:", err);
          if (err instanceof BookingReservationConflictError) {
            throw new TRPCError({ code: "CONFLICT", message: err.message });
          }
          if (err instanceof QuoteConversionConflictError) {
            throw new TRPCError({ code: "CONFLICT", message: err.message });
          }
          if (err instanceof TRPCError) throw err;
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The quote could not be converted into a booking." });
        }
      }

      // Send notifications for accept/decline
      try {
        const { sendMultiChannelNotification } = await import("../notifications");
        const { sendPushNotification } = await import("../notifications/pushHelper");
        const providerData = await db.getProviderById(quote.providerId);
        const providerUser = providerData ? await db.getUserById(providerData.userId) : null;
        const customer = await db.getUserById(quote.customerId);

        if (input.status === "accepted" && providerUser) {
          await sendMultiChannelNotification(
            {
              type: "quote_accepted",
              recipient: { userId: providerUser.id, email: providerUser.email || undefined, phone: providerUser.phone || undefined, name: providerUser.name || "Provider" },
              data: {
                quoteTitle: quote.title,
                quotedAmount: quote.quotedAmount || "0.00",
                customerName: customer?.name || "Customer",
                providerName: providerData?.businessName || "Provider",
              },
            },
            ["email", "sms"],
          );
          // Push to provider
          sendPushNotification("quote_accepted", { userId: providerUser.id, name: providerUser.name || "Provider" }, {
            customerName: customer?.name || "Customer",
            quoteTitle: quote.title,
            quotedAmount: quote.quotedAmount || "0.00",
          });
        }

        if (input.status === "declined" && providerUser) {
          await sendMultiChannelNotification(
            {
              type: "quote_declined",
              recipient: { userId: providerUser.id, email: providerUser.email || undefined, phone: providerUser.phone || undefined, name: providerUser.name || "Provider" },
              data: {
                quoteTitle: quote.title,
                quotedAmount: quote.quotedAmount || "0.00",
                customerName: customer?.name || "Customer",
                providerName: providerData?.businessName || "Provider",
                declineReason: input.reason,
              },
            },
            ["email", "sms"],
          );
          // Push to provider
          sendPushNotification("quote_declined", { userId: providerUser.id, name: providerUser.name || "Provider" }, {
            customerName: customer?.name || "Customer",
            quoteTitle: quote.title,
          });
        }
      } catch (err) {
        console.error("[QuoteStatus] Notification failed (non-blocking):", err);
      }

      return { success: true, bookingId };
    }),

  quoteCount: protectedProcedure
    .query(async ({ ctx }) => {
      const provider = await db.getProviderByUserId(ctx.user.id);
      if (!provider) return { pending: 0, quoted: 0, total: 0 };
      return db.getQuoteCountByProvider(provider.id);
    }),

  deleteQuote: protectedProcedure
    .input(z.object({ quoteId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const quote = await db.getQuoteById(input.quoteId);
      if (!quote) throw new TRPCError({ code: "NOT_FOUND", message: "Quote not found" });

      // Allow deletion by the provider who received it or the customer who sent it
      const provider = await db.getProviderByUserId(ctx.user.id);
      const isProvider = provider && quote.providerId === provider.id;
      const isCustomer = quote.customerId === ctx.user.id;

      if (!isProvider && !isCustomer) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      await db.deleteQuoteRequest(input.quoteId);
      return { success: true };
    }),

  // ============================================================================
  // BULK QUOTE REQUESTS (Pro/Business perk)
  // ============================================================================

  bulkRequestQuote: protectedProcedure
    .input(z.object({
      providerIds: z.array(z.number()).min(2, "Select at least 2 providers").max(50, "Maximum 50 providers per batch"),
      folderId: z.number().optional(), // Optional: send to all providers in a folder
      categoryId: z.number().optional(),
      title: z.string().min(5, "Title must be at least 5 characters"),
      description: z.string().min(20, "Please describe your needs in at least 20 characters"),
      preferredDate: z.string().optional(),
      preferredTime: z.string().optional(),
      locationType: z.enum(["mobile", "fixed_location", "virtual", "hybrid", "flexible", "teams", "zoom", "other"]).optional(),
      location: z.string().optional(),
      attachmentUrls: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Gate behind Pro/Business subscription
      const tier = await db.getCustomerTier(ctx.user.id);
      if (!customerHasFeature(tier, "bulkQuoteRequests")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Bulk quote requests require a Manager subscription. Upgrade to unlock this feature.",
        });
      }

      // Generate a batch ID to group these quotes
      const batchId = crypto.randomUUID();
      const results: { providerId: number; quoteId: number; success: boolean; error?: string }[] = [];

      for (const providerId of input.providerIds) {
        try {
          const result = await db.createQuoteRequest({
            customerId: ctx.user.id,
            providerId,
            categoryId: input.categoryId,
            title: input.title,
            description: input.description,
            preferredDate: input.preferredDate,
            preferredTime: input.preferredTime,
            locationType: input.locationType,
            location: input.location,
            attachmentUrls: input.attachmentUrls ? JSON.stringify(input.attachmentUrls) : undefined,
            batchId,
          });
          results.push({ providerId, quoteId: result.id, success: true });
          queueCrmQuoteProjection(result.id);

          // Send notification to each provider
          try {
            const { sendMultiChannelNotification } = await import("../notifications");
            const { sendPushNotification } = await import("../notifications/pushHelper");
            const providerData = await db.getProviderById(providerId);
            const providerUser = providerData ? await db.getUserById(providerData.userId) : null;
            if (providerUser) {
              await sendMultiChannelNotification(
                {
                  type: "quote_request_new",
                  recipient: { userId: providerUser.id, email: providerUser.email || undefined, phone: providerUser.phone || undefined, name: providerUser.name || "Provider" },
                  data: {
                    quoteTitle: input.title,
                    quoteDescription: input.description.slice(0, 200),
                    customerName: ctx.user.name || "Customer",
                    providerName: providerData?.businessName || providerUser.name || "Provider",
                    preferredDate: input.preferredDate,
                    preferredTime: input.preferredTime,
                    location: input.location,
                  },
                },
                ["email", "sms"],
              );
              // Push to provider
              sendPushNotification("quote_request_new", { userId: providerUser.id, name: providerUser.name || "Provider" }, {
                customerName: ctx.user.name || "Customer",
                quoteTitle: input.title,
              });
            }
          } catch (err) {
            console.error(`[BulkQuote] Notification failed for provider ${providerId}:`, err);
          }
        } catch (err: any) {
          results.push({ providerId, quoteId: 0, success: false, error: err.message });
        }
      }

      const successCount = results.filter(r => r.success).length;
      return {
        batchId,
        totalSent: successCount,
        totalFailed: results.length - successCount,
        results,
      };
    }),

  getBatchQuotes: protectedProcedure
    .input(z.object({ batchId: z.string() }))
    .query(async ({ ctx }) => {
      const allQuotes = await db.getQuotesByCustomer(ctx.user.id);
      // Note: batchId filtering would need to be added to the DB query
      // For now, return all quotes (the frontend will filter by batchId)
      return allQuotes;
    }),

  // ============================================================================
  // TIPPING SETTINGS
  // ============================================================================

  getTipSettings: protectedProcedure.query(async ({ ctx }) => {
    const provider = await db.getProviderByUserId(ctx.user.id);
    if (!provider) throw new TRPCError({ code: "NOT_FOUND", message: "Provider profile not found" });
    return await db.getTipSettings(provider.id);
  }),

  updateTipSettings: protectedProcedure
    .input(z.object({
      tippingEnabled: z.boolean(),
      tipZelleHandle: z.string().nullable().optional(),
      tipCashAppHandle: z.string().nullable().optional(),
      tipVenmoHandle: z.string().nullable().optional(),
      tipThankYouMessage: z.string().max(200).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const provider = await db.getProviderByUserId(ctx.user.id);
      if (!provider) throw new TRPCError({ code: "NOT_FOUND", message: "Provider profile not found" });
      await db.updateTipSettings(provider.id, input);
      return { success: true };
    }),

  getPublicTipInfo: publicProcedure
    .input(z.object({ providerId: z.number() }))
    .query(async ({ input }) => {
      const settings = await db.getTipSettings(input.providerId);
      if (!settings || !settings.tippingEnabled) return null;
      return {
        tipZelleHandle: settings.tipZelleHandle,
        tipCashAppHandle: settings.tipCashAppHandle,
        tipVenmoHandle: settings.tipVenmoHandle,
        tipThankYouMessage: settings.tipThankYouMessage,
      };
    }),

  // === FREE ESTIMATES ===
  getEstimateSettings: protectedProcedure.query(async ({ ctx }) => {
    const provider = await db.getProviderByUserId(ctx.user.id);
    if (!provider) throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found" });
    return { offersEstimates: provider.offersEstimates, estimateNote: provider.estimateNote };
  }),

  updateEstimateSettings: protectedProcedure
    .input(z.object({
      offersEstimates: z.boolean(),
      estimateNote: z.string().max(255).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const provider = await db.getProviderByUserId(ctx.user.id);
      if (!provider) throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found" });
      await db.updateEstimateSettings(provider.id, {
        offersEstimates: input.offersEstimates,
        estimateNote: input.estimateNote || null,
      });
      return { success: true };
    }),

  getEmergencyServiceSetting: protectedProcedure.query(async ({ ctx }) => {
    const provider = await db.getProviderByUserId(ctx.user.id);
    if (!provider) throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found" });
    return {
      offersEmergencyService: provider.offersEmergencyService,
      emergencyHoursType: provider.emergencyHoursType,
      emergencyHoursNote: provider.emergencyHoursNote,
    };
  }),

  updateEmergencyServiceSetting: protectedProcedure
    .input(z.object({
      offersEmergencyService: z.boolean(),
      emergencyHoursType: z.enum(["24_7", "after_hours", "custom"]).optional(),
      emergencyHoursNote: z.string().max(200).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const provider = await db.getProviderByUserId(ctx.user.id);
      if (!provider) throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found" });
      await db.updateEmergencyService(provider.id, {
        offersEmergencyService: input.offersEmergencyService,
        emergencyHoursType: input.emergencyHoursType,
        emergencyHoursNote: input.emergencyHoursNote,
      });
      return { success: true };
    }),
  // Business logo upload
  uploadBusinessLogo: protectedProcedure
    .input(z.object({
      photoData: z.string(), // base64
      contentType: z.string().default("image/png"),
    }))
    .mutation(async ({ ctx, input }) => {
      const provider = await db.getProviderByUserId(ctx.user.id);
      if (!provider) throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found" });
      const { storagePut } = await import("../storage");
      const buffer = Buffer.from(input.photoData, "base64");
      const ext = input.contentType.split("/")[1] || "png";
      const suffix = Math.random().toString(36).substring(2, 10);
      const fileKey = `business-logos/${provider.id}/${Date.now()}-${suffix}.${ext}`;
      const { url } = await storagePut(fileKey, buffer, input.contentType);
      await db.updateProviderProfile(provider.id, { businessLogoUrl: url });
      return { url };
    }),
  removeBusinessLogo: protectedProcedure
    .mutation(async ({ ctx }) => {
      const provider = await db.getProviderByUserId(ctx.user.id);
      if (!provider) throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found" });
      await db.updateProviderProfile(provider.id, { businessLogoUrl: null });
      return { success: true };
    }),
  // Returns onboarding completion status for steps 1-4 (used by landing page gate)
  getOnboardingStatus: protectedProcedure.query(async ({ ctx }) => {
    const provider = await db.getProviderByUserId(ctx.user.id);
    if (!provider) {
      return {
        hasPlan: false,
        hasProfile: false,
        hasSkills: false,
        hasServices: false,
        hasStripe: false,
        steps1to4Complete: false,
      };
    }
    const subscription = await db.getProviderSubscription(provider.id);
    // Step 1 (Plan) is complete if any subscription exists (including free/Starter tier)
    // This matches the onboarding wizard's logic: tierSelected = !!currentSubscription?.subscription
    const hasPlan = !!subscription;
    const hasProfile = true; // provider record exists
    const categories = await db.getProviderCategories(provider.id);
    const hasSkills = categories.length > 0;
    const services = await db.getServicesByProviderId(provider.id);
    const hasServices = services.length > 0;
    const hasStripe = provider.payoutEnabled === true;
    const steps1to4Complete = hasPlan && hasProfile && hasSkills && hasServices;
    return {
      hasPlan,
      hasProfile,
      hasSkills,
      hasServices,
      hasStripe,
      steps1to4Complete,
    };
  }),
});
