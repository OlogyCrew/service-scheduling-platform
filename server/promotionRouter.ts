import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import Stripe from "stripe";
import { invokeLLM } from "./_core/llm";
import { ENV } from "./_core/env";
import * as promotionDb from "./db/promotions";
import { getProviderByUserId } from "./db/providers";
import { getServiceById } from "./db/services";
import { assertProviderPaymentActor } from "./paymentAuthorization";
import { assertPaymentVelocityAllowed, throwIfPaymentVelocityBlocked } from "./paymentVelocity";

const stripe = new Stripe(ENV.stripeSecretKey, { apiVersion: "2025-04-30.basil" as any });

// Pricing in cents
const TIER_PRICING: Record<string, { cents: number; durationHours: number; label: string }> = {
  quick_boost: { cents: 499, durationHours: 24, label: "Quick Boost (24 hours)" },
  category_spotlight: { cents: 1499, durationHours: 168, label: "Category Spotlight (7 days)" },
  homepage_feature: { cents: 2999, durationHours: 168, label: "Homepage Feature (7 days)" },
  smart_bundle: { cents: 3999, durationHours: 168, label: "Smart Bundle (All 3 for 7 days)" },
};

export const promotionRouter = router({
  // Generate AI ad copy from service details
  generateAdCopy: protectedProcedure
    .input(z.object({ serviceId: z.number().optional(), customPrompt: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const provider = await getProviderByUserId(ctx.user.id);
      if (!provider) throw new TRPCError({ code: "FORBIDDEN", message: "Provider account required" });
      assertProviderPaymentActor(ctx.user, provider);

      let serviceContext = "";
      if (input.serviceId) {
        const service = await getServiceById(input.serviceId);
        if (service) {
          serviceContext = `Service: "${service.name}" - ${service.description || "No description"}. Price: $${service.basePrice || service.hourlyRate || "varies"}. Duration: ${service.durationMinutes || "varies"} minutes.`;
        }
      }

      const businessContext = `Business: "${provider.businessName}". Location: ${provider.city || ""}, ${provider.state || ""}. Rating: ${provider.averageRating || "New"}.`;

      const prompt = input.customPrompt
        ? `Generate promotional ad copy for this business. Additional context from the provider: "${input.customPrompt}". ${businessContext} ${serviceContext}`
        : `Generate promotional ad copy for this business. ${businessContext} ${serviceContext}`;

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are an expert marketing copywriter for a service booking platform. Generate compelling, concise ad copy that drives bookings. Return JSON with exactly these fields:
- "headline": A catchy headline (max 100 characters, no quotes around it)
- "description": A compelling description (max 200 characters, highlights value proposition)
- "cta": A call-to-action phrase (max 30 characters)
Be specific, action-oriented, and highlight what makes this service special. Do NOT use generic phrases like "Book now" without context.`,
          },
          { role: "user", content: prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "ad_copy",
            strict: true,
            schema: {
              type: "object",
              properties: {
                headline: { type: "string", description: "Catchy headline, max 100 chars" },
                description: { type: "string", description: "Compelling description, max 200 chars" },
                cta: { type: "string", description: "Call to action, max 30 chars" },
              },
              required: ["headline", "description", "cta"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices?.[0]?.message?.content;
      if (!content || typeof content !== 'string') throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI generation failed" });

      return JSON.parse(content) as { headline: string; description: string; cta: string };
    }),

  // Get pricing tiers
  getTiers: publicProcedure.query(() => {
    return Object.entries(TIER_PRICING).map(([key, val]) => ({
      id: key,
      label: val.label,
      priceFormatted: `$${(val.cents / 100).toFixed(2)}`,
      priceCents: val.cents,
      durationHours: val.durationHours,
    }));
  }),

  // Create a promotion and get Stripe checkout URL
  createCheckout: protectedProcedure
    .input(z.object({
      tier: z.enum(["quick_boost", "category_spotlight", "homepage_feature", "smart_bundle"]),
      serviceId: z.number().optional(),
      headline: z.string().min(1).max(200),
      description: z.string().min(1).max(500),
      aiGenerated: z.boolean().default(false),
      origin: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const provider = await getProviderByUserId(ctx.user.id);
      if (!provider) throw new TRPCError({ code: "FORBIDDEN", message: "Provider account required" });
      assertProviderPaymentActor(ctx.user, provider);
      const velocity = await assertPaymentVelocityAllowed({
        actorId: ctx.user.id,
        subjects: [
          { dimension: "account", key: String(ctx.user.id) },
          { dimension: "email", key: ctx.user.email || `user:${ctx.user.id}` },
          { dimension: "provider", key: String(provider.id) },
          { dimension: "ip", key: ctx.req.ip || ctx.req.headers["x-forwarded-for"]?.toString().split(",")[0] || "unknown" },
        ],
      });
      throwIfPaymentVelocityBlocked(velocity);

      const tierInfo = TIER_PRICING[input.tier];
      if (!tierInfo) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid tier" });

      // Create promotion record (pending)
      const promotion = await promotionDb.createPromotion({
        providerId: provider.id,
        serviceId: input.serviceId || null,
        tier: input.tier,
        status: "pending",
        headline: input.headline,
        description: input.description,
        aiGenerated: input.aiGenerated,
        amountPaid: tierInfo.cents,
      });

      if (!promotion) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create promotion" });

      // Create Stripe checkout session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: "usd",
            product_data: {
              name: `OlogyCrew Promotion: ${tierInfo.label}`,
              description: `"${input.headline}" - ${input.description}`,
              metadata: { promotionId: promotion.id.toString(), tier: input.tier },
            },
            unit_amount: tierInfo.cents,
          },
          quantity: 1,
        }],
        mode: "payment",
        success_url: `${input.origin}/provider/promotions?payment=success&promotionId=${promotion.id}`,
        cancel_url: `${input.origin}/provider/promotions?payment=cancelled`,
        customer_email: ctx.user.email || undefined,
        client_reference_id: ctx.user.id.toString(),
        metadata: {
          type: "promotion",
          promotionId: promotion.id.toString(),
          providerId: provider.id.toString(),
          tier: input.tier,
        },
      });

      // Store session ID
      await promotionDb.updatePromotionStripeSession(promotion.id, session.id!);

      return { url: session.url, promotionId: promotion.id };
    }),

  // Get my promotions (provider)
  getMyPromotions: protectedProcedure.query(async ({ ctx }) => {
    const provider = await getProviderByUserId(ctx.user.id);
    if (!provider) return [];
    return await promotionDb.getPromotionsByProvider(provider.id);
  }),

  // Get active promotions for display (public)
  getActiveForDisplay: publicProcedure
    .input(z.object({ tier: z.string().optional() }).optional())
    .query(async ({ input }) => {
      return await promotionDb.getActivePromotions(input?.tier);
    }),

  // Get a single promotion with provider and service details (public, for shareable pages)
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const promotion = await promotionDb.getPromotionById(input.id);
      if (!promotion) throw new TRPCError({ code: "NOT_FOUND", message: "Promotion not found" });
      if (promotion.status !== "active") throw new TRPCError({ code: "NOT_FOUND", message: "Promotion is not active" });

      // Get provider details
      const { getProviderById } = await import("./db/providers");
      const provider = await getProviderById(promotion.providerId);
      if (!provider) throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found" });

      // Get service details if linked
      let service = null;
      if (promotion.serviceId) {
        service = await getServiceById(promotion.serviceId);
      }

      return { promotion, provider, service };
    }),

  // Track a page view on a promotion (when someone visits the shareable page)
  trackView: publicProcedure
    .input(z.object({ promotionId: z.number() }))
    .mutation(async ({ input }) => {
      await promotionDb.incrementImpressions([input.promotionId]);
      return { success: true };
    }),

  // Track a click on a promotion
  trackClick: publicProcedure
    .input(z.object({ promotionId: z.number() }))
    .mutation(async ({ input }) => {
      await promotionDb.incrementClicks(input.promotionId);
      return { success: true };
    }),
});
