import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";
import { TRPCError } from "@trpc/server";

export const serviceRouter = router({
  create: protectedProcedure
    .input(z.object({
      categoryId: z.number(),
      name: z.string(),
      description: z.string().optional(),
      serviceType: z.enum(["mobile", "fixed_location", "virtual", "hybrid", "flexible", "teams", "zoom", "other"]),
      pricingModel: z.enum(["fixed", "hourly", "package", "custom_quote", "consultation"]),
      basePrice: z.union([z.number(), z.string()]).optional(),
      hourlyRate: z.union([z.number(), z.string()]).optional(),
      durationMinutes: z.number().optional(),
      depositRequired: z.boolean().default(false),
      depositType: z.enum(["fixed", "percentage"]).optional(),
      depositAmount: z.union([z.number(), z.string()]).optional().transform(v => {
        if (v === undefined || v === null || v === "") return undefined;
        const n = typeof v === "string" ? parseFloat(v) : v;
        return isNaN(n) ? undefined : n;
      }),
      depositPercentage: z.union([z.number(), z.string()]).optional().transform(v => {
        if (v === undefined || v === null || v === "") return undefined;
        const n = typeof v === "string" ? parseFloat(v) : v;
        return isNaN(n) ? undefined : n;
      }),
      isGroupClass: z.boolean().default(false),
      maxCapacity: z.number().min(1).default(1),
      isExperience: z.boolean().default(false),
      minGuests: z.number().min(1).default(1),
      pricePerPerson: z.union([z.number(), z.string()]).optional(),
      whatsIncluded: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const provider = await db.getProviderByUserId(ctx.user.id);
      if (!provider || provider.isActive === false || provider.deletedAt) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Must be a provider to create services" });
      }
      const existingServices = await db.getServicesByProviderId(provider.id);
      const tier = await db.getProviderTier(provider.id);
      const { canProviderAddService, SUBSCRIPTION_TIERS } = await import("../products");
      if (!canProviderAddService(tier, existingServices.length)) {
        throw new TRPCError({ 
          code: "FORBIDDEN", 
          message: `Your ${SUBSCRIPTION_TIERS[tier].name} plan allows up to ${SUBSCRIPTION_TIERS[tier].limits.maxServices} services. Upgrade your plan to add more.` 
        });
      }
      await db.createService({
        providerId: provider.id,
        categoryId: input.categoryId,
        name: input.name,
        description: input.description,
        serviceType: input.serviceType,
        pricingModel: input.pricingModel,
        basePrice: input.basePrice?.toString().trim() || null,
        hourlyRate: input.hourlyRate?.toString().trim() || null,
        durationMinutes: input.durationMinutes,
        depositRequired: input.depositRequired,
        depositType: input.depositType,
        depositAmount: input.depositAmount?.toString().trim() || null,
        depositPercentage: input.depositPercentage?.toString().trim() || null,
        isGroupClass: input.isGroupClass,
        maxCapacity: input.maxCapacity,
        isExperience: input.isExperience,
        minGuests: input.minGuests,
        pricePerPerson: input.pricePerPerson?.toString().trim() || null,
        whatsIncluded: input.whatsIncluded || null,
      });
      const providerServices = await db.getServicesByProviderId(provider.id);
      const created = providerServices.find(s => s.name === input.name);
      if (!created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to retrieve created service" });
      return created;
    }),
    
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const service = await db.getServiceById(input.id);
      if (!service || !service.isActive) return null;
      const provider = await db.getProviderById(service.providerId);
      return provider?.isActive ? service : null;
    }),
    
  listByProvider: publicProcedure
    .input(z.object({ providerId: z.number() }))
    .query(async ({ input }) => {
      const provider = await db.getProviderById(input.providerId);
      if (!provider?.isActive) return [];
      return await db.getServicesByProviderId(input.providerId);
    }),
    
  listByCategory: publicProcedure
    .input(z.object({ categoryId: z.number() }))
    .query(async ({ input }) => {
      return await db.getServicesByCategory(input.categoryId);
    }),
  
  listExperiences: publicProcedure
    .query(async () => {
      return await db.getExperiences();
    }),
    
  search: publicProcedure
    .input(z.object({ 
      query: z.string().optional(),
      keyword: z.string().optional(),
      categoryId: z.number().optional(),
      minPrice: z.number().optional(),
      maxPrice: z.number().optional(),
      sortBy: z.enum(["price", "rating", "distance"]).optional(),
      location: z.string().optional(),
    }))
    .query(async ({ input }) => {
      // Ensure DB is available before searching
      await db.requireDb();
      const searchTerm = input.query || input.keyword || "";
      let results = await db.searchServices(searchTerm);
      
      if (input.categoryId) {
        results = results.filter(s => s.categoryId === input.categoryId);
      }
      if (input.minPrice !== undefined) {
        results = results.filter(s => {
          if (!s.basePrice) return false;
          return parseFloat(s.basePrice) >= input.minPrice!;
        });
      }
      if (input.maxPrice !== undefined) {
        results = results.filter(s => {
          if (!s.basePrice) return false;
          return parseFloat(s.basePrice) <= input.maxPrice!;
        });
      }
      if (input.location && input.location.trim()) {
        const loc = input.location.toLowerCase().trim();
        const providerIds = Array.from(new Set(results.map(s => s.providerId)));
        const providers = await Promise.all(providerIds.map(id => db.getProviderById(id)));
        const providerMap = new Map(providers.filter(Boolean).map(p => [p!.id, p!]));
        results = results.filter(s => {
          const provider = providerMap.get(s.providerId);
          if (!provider) return false;
          const city = (provider.city || "").toLowerCase();
          const state = (provider.state || "").toLowerCase();
          const zip = ((provider as any).zipCode || "").toLowerCase();
          return city.includes(loc) || state.includes(loc) || zip.includes(loc) || loc.includes(city) || loc.includes(state);
        });
      }
      if (input.sortBy === "price") {
        results.sort((a, b) => parseFloat(a.basePrice || "0") - parseFloat(b.basePrice || "0"));
      }
      // Default ranking (trust score + tier boost + official) is handled in the DB query
      return results;
    }),
    
  listMine: protectedProcedure.query(async ({ ctx }) => {
    const provider = await db.getProviderByUserId(ctx.user.id);
    if (!provider) return [];
    return await db.getServicesByProviderId(provider.id);
  }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      description: z.string().optional(),
      categoryId: z.number().optional(),
      serviceType: z.enum(["mobile", "fixed_location", "virtual", "hybrid", "flexible", "teams", "zoom", "other"]).optional(),
      pricingModel: z.enum(["fixed", "hourly", "package", "custom_quote", "consultation"]).optional(),
      basePrice: z.union([z.number(), z.string()]).optional(),
      hourlyRate: z.union([z.number(), z.string()]).optional(),
      durationMinutes: z.number().optional(),
      depositRequired: z.boolean().optional(),
      depositType: z.enum(["fixed", "percentage"]).optional(),
      depositAmount: z.union([z.number(), z.string()]).optional().transform(v => {
        if (v === undefined || v === null || v === "") return undefined;
        const n = typeof v === "string" ? parseFloat(v) : v;
        return isNaN(n) ? undefined : n;
      }),
      depositPercentage: z.union([z.number(), z.string()]).optional().transform(v => {
        if (v === undefined || v === null || v === "") return undefined;
        const n = typeof v === "string" ? parseFloat(v) : v;
        return isNaN(n) ? undefined : n;
      }),
      cancellationPolicy: z.string().optional(),
      specialRequirements: z.string().optional(),
      requireUpfrontPayment: z.boolean().optional(),
      isActive: z.boolean().optional(),
      isGroupClass: z.boolean().optional(),
      maxCapacity: z.number().min(1).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const provider = await db.getProviderByUserId(ctx.user.id);
      if (!provider || provider.isActive === false || provider.deletedAt) throw new TRPCError({ code: "FORBIDDEN", message: "Must be a provider" });
      const service = await db.getServiceById(input.id);
      if (!service) throw new TRPCError({ code: "NOT_FOUND", message: "Service not found" });
      if (service.providerId !== provider.id) throw new TRPCError({ code: "FORBIDDEN", message: "Not your service" });
      const { id, ...updateData } = input;
      const cleanData: Record<string, any> = {};
      const numericStringFields = ["basePrice", "hourlyRate", "depositAmount", "depositPercentage"];
      const optionalTextFields = ["cancellationPolicy", "specialRequirements", "description"];
      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined) {
          if (numericStringFields.includes(key)) {
            // Convert empty strings to null for decimal columns
            const strVal = value?.toString().trim();
            cleanData[key] = strVal ? strVal : null;
          } else if (optionalTextFields.includes(key)) {
            // Convert empty strings to null for optional text columns
            const strVal = typeof value === "string" ? value.trim() : value;
            cleanData[key] = strVal || null;
          } else {
            cleanData[key] = value;
          }
        }
      }
      await db.updateService(input.id, cleanData);
      const updated = await db.getServiceById(input.id);
      return updated!;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const provider = await db.getProviderByUserId(ctx.user.id);
      if (!provider || provider.isActive === false || provider.deletedAt) throw new TRPCError({ code: "FORBIDDEN", message: "Must be a provider" });
      const service = await db.getServiceById(input.id);
      if (!service) throw new TRPCError({ code: "NOT_FOUND", message: "Service not found" });
      if (service.providerId !== provider.id) throw new TRPCError({ code: "FORBIDDEN", message: "Not your service" });
      await db.deleteService(input.id);
      return { success: true };
    }),

  getPhotos: publicProcedure
    .input(z.object({ serviceId: z.number() }))
    .query(async ({ input }) => {
      return await db.getServicePhotos(input.serviceId);
    }),

  uploadPhoto: protectedProcedure
    .input(z.object({
      serviceId: z.number(),
      photoData: z.string(),
      contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]).default("image/jpeg"),
      caption: z.string().optional(),
      isPrimary: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const provider = await db.getProviderByUserId(ctx.user.id);
      if (!provider || provider.isActive === false || provider.deletedAt) throw new TRPCError({ code: "FORBIDDEN", message: "Must be a provider" });
      const service = await db.getServiceById(input.serviceId);
      if (!service) throw new TRPCError({ code: "NOT_FOUND", message: "Service not found" });
      if (service.providerId !== provider.id) throw new TRPCError({ code: "FORBIDDEN", message: "Not your service" });

      const existingPhotos = await db.getServicePhotos(input.serviceId);
      const tier = await db.getProviderTier(provider.id);
      const { SUBSCRIPTION_TIERS } = await import("../products");
      const maxPhotos = SUBSCRIPTION_TIERS[tier]?.limits?.maxPhotosPerService || 1;
      if (existingPhotos.length >= maxPhotos) {
        const tierName = tier === "free" ? "Starter" : tier === "basic" ? "Pro" : "Business";
        throw new TRPCError({ 
          code: "FORBIDDEN", 
          message: `${tierName} plan allows up to ${maxPhotos} photo${maxPhotos > 1 ? "s" : ""} per service. Upgrade your plan for more.` 
        });
      }

      const { storagePut } = await import("../storage");
      const buffer = Buffer.from(input.photoData, "base64");
      // Security: Enforce max file size (5MB)
      if (buffer.length > 5 * 1024 * 1024) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "File too large. Maximum size is 5MB." });
      }
      const ext = input.contentType.split("/")[1] || "jpg";
      const suffix = Math.random().toString(36).substring(2, 10);
      const fileKey = `service-photos/${input.serviceId}/${Date.now()}-${suffix}.${ext}`;
      const { url } = await storagePut(fileKey, buffer, input.contentType);

      await db.addServicePhoto({
        serviceId: input.serviceId,
        photoUrl: url,
        caption: input.caption,
        sortOrder: existingPhotos.length,
        isPrimary: input.isPrimary || existingPhotos.length === 0,
      });

      return { url, success: true };
    }),

  deletePhoto: protectedProcedure
    .input(z.object({ photoId: z.number(), serviceId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const provider = await db.getProviderByUserId(ctx.user.id);
      if (!provider || provider.isActive === false || provider.deletedAt) throw new TRPCError({ code: "FORBIDDEN", message: "Must be a provider" });
      const service = await db.getServiceById(input.serviceId);
      if (!service || service.providerId !== provider.id) throw new TRPCError({ code: "FORBIDDEN", message: "Not your service" });
      await db.deleteServicePhoto(input.photoId);
      return { success: true };
    }),

  setPrimaryPhoto: protectedProcedure
    .input(z.object({ photoId: z.number(), serviceId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const provider = await db.getProviderByUserId(ctx.user.id);
      if (!provider || provider.isActive === false || provider.deletedAt) throw new TRPCError({ code: "FORBIDDEN", message: "Must be a provider" });
      const service = await db.getServiceById(input.serviceId);
      if (!service || service.providerId !== provider.id) throw new TRPCError({ code: "FORBIDDEN", message: "Not your service" });
      await db.setServicePrimaryPhoto(input.serviceId, input.photoId);
      return { success: true };
    }),
});
