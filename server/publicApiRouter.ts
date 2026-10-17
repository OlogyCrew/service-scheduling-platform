import type { Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import * as db from "./db";
import { getAdaptiveBookingDecision } from "../shared/adaptiveBooking";
import { generateTimeSlots } from "../shared/timeSlots";
import {
  addCalendarDays,
  evaluateBookingWindow,
  getBookingDateViolation,
  OLOGYCREW_BOOKING_TIME_ZONE,
} from "../shared/bookingPolicy";
import { OLOGYCREW_PUBLIC_API_BASE, ologyCrewPublicUrl } from "../shared/publicUrls";
import {
  agentHandoffRequestSchema,
  buildAgentHandoffReviewUrl,
  createAgentHandoffToken,
} from "./agentHandoff";
import { AGENT_DISCOVERY_VERSION } from "./agentDiscovery";

const router = Router();

const optionalQueryText = (max: number) => z.preprocess(
  (value) => Array.isArray(value) ? value[0] : value,
  z.string().trim().max(max).optional(),
);
const optionalQueryNumber = z.preprocess(
  (value) => value === undefined || value === "" ? undefined : Number(Array.isArray(value) ? value[0] : value),
  z.number().finite().nonnegative().optional(),
);
const queryBooleanWithDefault = (defaultValue: boolean) => z.preprocess((value) => {
  const normalized = Array.isArray(value) ? value[0] : value;
  if (normalized === undefined || normalized === "") return defaultValue;
  if (normalized === "true" || normalized === true) return true;
  if (normalized === "false" || normalized === false) return false;
  return normalized;
}, z.boolean());

const serviceSearchSchema = z.object({
  q: optionalQueryText(200),
  category: optionalQueryText(120),
  city: optionalQueryText(120),
  state: optionalQueryText(80),
  minPrice: optionalQueryNumber,
  maxPrice: optionalQueryNumber,
  includeDemo: queryBooleanWithDefault(false),
  limit: z.preprocess((value) => value === undefined ? 20 : Number(Array.isArray(value) ? value[0] : value), z.number().int().min(1).max(50)),
  offset: z.preprocess((value) => value === undefined ? 0 : Number(Array.isArray(value) ? value[0] : value), z.number().int().min(0).max(10_000)),
}).refine((value) => value.minPrice === undefined || value.maxPrice === undefined || value.minPrice <= value.maxPrice, {
  message: "minPrice must not exceed maxPrice",
});

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Invalid date");

function sendValidationError(res: Response, error: unknown) {
  const message = error instanceof z.ZodError
    ? error.issues[0]?.message || "Invalid request"
    : "Invalid request";
  return res.status(400).json({ success: false, error: message });
}

function numericPrice(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function publicServicePrice(service: any) {
  if (service.pricingModel === "custom_quote") return { amount: null, unit: "quote" as const };
  if (service.pricingModel === "consultation") return { amount: 0, unit: "service" as const };
  if (service.pricingModel === "hourly") return { amount: numericPrice(service.hourlyRate ?? service.basePrice), unit: "hour" as const };
  return { amount: numericPrice(service.basePrice), unit: "service" as const };
}

function publicServiceSummary(service: any) {
  const decision = getAdaptiveBookingDecision(service);
  const isDemo = Boolean(service.isDemo ?? service.providerOfficial);
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    isDemo,
    category: {
      id: service.categoryId,
      name: service.categoryName,
      slug: service.categorySlug,
    },
    serviceType: service.serviceType,
    pricingModel: service.pricingModel,
    price: publicServicePrice(service),
    durationMinutes: service.durationMinutes,
    isExperience: Boolean(service.isExperience),
    bookingMode: decision.mode,
    reviewUrl: ologyCrewPublicUrl(`/service/${service.id}?entry=agent-discovery`),
    handoffEndpoint: `${OLOGYCREW_PUBLIC_API_BASE}/handoffs`,
    provider: {
      id: service.providerId,
      name: service.businessName,
      slug: service.providerSlug,
      city: service.providerCity,
      state: service.providerState,
      isDemo,
      profileUrl: service.providerSlug ? ologyCrewPublicUrl(`/${service.providerSlug}`) : null,
      averageRating: service.providerOfficial ? null : numericPrice(service.providerRating),
      totalReviews: service.providerOfficial ? 0 : Number(service.providerReviewCount ?? 0),
      trustLevel: service.providerTrustLevel ?? "new",
    },
  };
}

async function getPublicServiceAndProvider(serviceId: number) {
  const service = await db.getServiceById(serviceId);
  if (!service || !service.isActive || service.deletedAt) return null;
  const provider = await db.getProviderById(service.providerId);
  if (!provider?.isActive || provider.deletedAt) return null;
  const user = await db.getUserById(provider.userId);
  if (!user || user.deletedAt) return null;
  const category = await db.getCategoryById(service.categoryId);
  if (!category?.isActive) return null;
  return { service, provider, category };
}

async function buildAvailability(providerId: number, service: any, date: string) {
  const queryStart = addCalendarDays(date, -1);
  const queryEnd = addCalendarDays(date, 1);
  const [weeklySchedule, overrides, existingBookings, existingSessions] = await Promise.all([
    db.getAvailabilityByProvider(providerId),
    db.getAvailabilityOverrides(providerId, date, date),
    db.getBookingsByDateRange(providerId, queryStart, queryEnd),
    db.getSessionsByDateRange(providerId, queryStart, queryEnd),
  ]);

  const slots = generateTimeSlots(
    date,
    service.durationMinutes || 60,
    weeklySchedule.map((schedule: any) => ({
      dayOfWeek: schedule.dayOfWeek,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      isAvailable: schedule.isAvailable,
    })),
    overrides.map((override: any) => ({
      overrideDate: override.overrideDate,
      startTime: override.startTime,
      endTime: override.endTime,
      isAvailable: override.isAvailable,
    })),
    [
      ...existingBookings
        .filter((booking: any) => !booking.bookingType || booking.bookingType === "single")
        .map((booking: any) => ({
          serviceId: booking.serviceId,
          bookingDate: booking.bookingDate,
          bookingTime: booking.startTime,
          endTime: booking.endTime,
          durationMinutes: booking.durationMinutes,
          status: booking.status,
        })),
      ...existingSessions.map((row: any) => ({
        serviceId: row.serviceId ?? row.booking?.serviceId,
        bookingDate: row.session?.sessionDate ?? row.sessionDate,
        bookingTime: row.session?.startTime ?? row.startTime,
        endTime: row.session?.endTime ?? row.endTime,
        status: row.bookingStatus ?? "pending",
      })),
    ],
    30,
    service.isGroupClass ? service.maxCapacity || 1 : 1,
    service.isGroupClass ? service.id : undefined,
  );

  return slots
    .filter((slot) => slot.available && evaluateBookingWindow({
      bookingDate: date,
      startTime: slot.time,
      minAdvanceBookingHours: service.minAdvanceBookingHours,
      maxAdvanceBookingDays: service.maxAdvanceBookingDays,
      timeZone: OLOGYCREW_BOOKING_TIME_ZONE,
    }).allowed)
    .map((slot) => ({
      startTime: slot.time,
      isNextDay: Boolean(slot.isNextDay),
      spotsRemaining: slot.spotsRemaining,
    }));
}

export async function handlePublicApiRoot(_req: Request, res: Response) {
  return res.json({
    name: "OlogyCrew Public Agent API",
    version: AGENT_DISCOVERY_VERSION,
    documentation: `${OLOGYCREW_PUBLIC_API_BASE}/docs`,
    openapi: ologyCrewPublicUrl("/openapi.json"),
    agentManifest: ologyCrewPublicUrl("/.well-known/agents.json"),
    schedulingTimezone: OLOGYCREW_BOOKING_TIME_ZONE,
    capabilities: ["search_services", "get_provider", "list_categories", "check_service_availability", "prepare_user_review_handoff"],
    transactionPolicy: {
      agentCanCreateBooking: false,
      agentCanCreateQuote: false,
      agentCanPlaceHold: false,
      agentCanCollectPayment: false,
      userReviewAndSubmissionRequired: true,
    },
  });
}

export async function handleSearchServices(req: Request, res: Response) {
  try {
    const input = serviceSearchSchema.parse(req.query);
    const result = await db.searchPublicServicesForAgents({
      query: input.q,
      category: input.category,
      city: input.city,
      state: input.state,
      minPrice: input.minPrice,
      maxPrice: input.maxPrice,
      includeDemo: input.includeDemo,
      limit: input.limit,
      offset: input.offset,
    });

    return res.json({
      success: true,
      data: result.rows.map(publicServiceSummary),
      pagination: { limit: input.limit, offset: input.offset, total: result.total },
    });
  } catch (error) {
    if (error instanceof z.ZodError) return sendValidationError(res, error);
    console.error("[PublicAPI] Error searching services:", error);
    return res.status(503).json({ success: false, error: "Service discovery is temporarily unavailable" });
  }
}

export async function handleGetProvider(req: Request, res: Response) {
  try {
    const slug = z.string().trim().min(1).max(255).regex(/^[a-z0-9-]+$/).parse(req.params.slug);
    const provider = await db.getProviderBySlug(slug);
    if (!provider || !provider.isActive) {
      return res.status(404).json({ success: false, error: "Provider not found" });
    }
    if (provider.deletedAt) {
      return res.status(404).json({ success: false, error: "Provider not found" });
    }

    const [user, services, categories, trustProfile] = await Promise.all([
      db.getUserById(provider.userId),
      db.getServicesByProviderId(provider.id),
      db.getProviderCategories(provider.id),
      db.getProviderTrustProfile(provider.id),
    ]);
    if (!user || user.deletedAt) return res.status(404).json({ success: false, error: "Provider not found" });

    return res.json({
      success: true,
      data: {
        id: provider.id,
        name: provider.businessName,
        slug: provider.profileSlug,
        isDemo: Boolean(provider.isOfficial),
        description: provider.description,
        city: provider.city,
        state: provider.state,
        profileUrl: ologyCrewPublicUrl(`/${provider.profileSlug}`),
        profilePhoto: user?.profilePhotoUrl || null,
        averageRating: provider.isOfficial ? null : numericPrice(provider.averageRating),
        totalReviews: provider.isOfficial ? 0 : Number(provider.totalReviews ?? 0),
        verified: trustProfile?.identityReviewed || false,
        verifiedMeaning: "Government identity evidence reviewed by OlogyCrew; this does not verify service quality, safety, or suitability.",
        trust: trustProfile ? {
          evidenceReviewed: trustProfile.publicEvidence,
          activity: trustProfile.activity,
          standing: trustProfile.standing,
          explanation: trustProfile.publicExplanation,
        } : null,
        categories: categories.map((category: any) => ({
          id: category.categoryId,
          name: category.categoryName,
          slug: category.categorySlug,
        })),
        services: services.filter((service: any) => !service.deletedAt).map((service: any) => {
          const decision = getAdaptiveBookingDecision(service);
          return {
            id: service.id,
            name: service.name,
            description: service.description,
            isDemo: Boolean(provider.isOfficial),
            categoryId: service.categoryId,
            serviceType: service.serviceType,
            pricingModel: service.pricingModel,
            price: publicServicePrice(service),
            durationMinutes: service.durationMinutes,
            isExperience: Boolean(service.isExperience),
            bookingMode: decision.mode,
            reviewUrl: ologyCrewPublicUrl(`/service/${service.id}?entry=agent-discovery`),
            handoffEndpoint: `${OLOGYCREW_PUBLIC_API_BASE}/handoffs`,
          };
        }),
        serviceModes: {
          fixedLocation: provider.acceptsFixedLocation,
          mobile: provider.acceptsMobile,
          virtual: provider.acceptsVirtual,
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) return sendValidationError(res, error);
    console.error("[PublicAPI] Error fetching provider:", error);
    return res.status(503).json({ success: false, error: "Provider discovery is temporarily unavailable" });
  }
}

export async function handleAvailability(req: Request, res: Response) {
  try {
    res.set("Cache-Control", "no-store");
    const providerId = z.coerce.number().int().positive().parse(req.params.providerId);
    const date = dateSchema.parse(Array.isArray(req.query.date) ? req.query.date[0] : req.query.date);
    const serviceId = z.coerce.number().int().positive().parse(Array.isArray(req.query.serviceId) ? req.query.serviceId[0] : req.query.serviceId);
    const record = await getPublicServiceAndProvider(serviceId);
    if (!record || record.provider.id !== providerId) {
      return res.status(404).json({ success: false, error: "Active service and provider combination not found" });
    }
    const dateViolation = getBookingDateViolation({
      bookingDate: date,
      maxAdvanceBookingDays: record.service.maxAdvanceBookingDays,
      timeZone: OLOGYCREW_BOOKING_TIME_ZONE,
    });
    if (dateViolation) {
      return res.status(400).json({
        success: false,
        error: dateViolation === "too_far"
          ? `date exceeds this service's ${record.service.maxAdvanceBookingDays ?? 90}-day booking window`
          : "date must be today or later",
      });
    }

    const decision = getAdaptiveBookingDecision(record.service);
    if (decision.mode === "quote") {
      return res.json({
        success: true,
        data: {
          providerId,
          serviceId,
          date,
          bookingMode: "quote",
          availableSlots: [],
          message: "This service requires provider review. Prepare a quote handoff instead of selecting a slot.",
          handoffEndpoint: `${OLOGYCREW_PUBLIC_API_BASE}/handoffs`,
        },
      });
    }

    const availableSlots = await buildAvailability(providerId, record.service, date);
    return res.json({
      success: true,
      data: {
        providerId,
        serviceId,
        date,
        durationMinutes: record.service.durationMinutes || 60,
        bookingMode: "direct",
        available: availableSlots.length > 0,
        availableSlots,
        timezone: OLOGYCREW_BOOKING_TIME_ZONE,
        timezoneNote: "OlogyCrew currently schedules all marketplace times in America/New_York. Confirm the displayed date and time during review.",
        generatedAt: new Date().toISOString(),
        holdsCreated: 0,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) return sendValidationError(res, error);
    console.error("[PublicAPI] Error checking availability:", error);
    return res.status(503).json({ success: false, error: "Availability is temporarily unavailable" });
  }
}

export async function handleCategories(_req: Request, res: Response) {
  try {
    const categories = await db.getPublicCategoriesWithServiceCounts();
    return res.json({
      success: true,
      data: categories.map((category: any) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        serviceCount: Number(category.serviceCount ?? 0),
        url: ologyCrewPublicUrl(`/category/${category.slug}`),
      })),
    });
  } catch (error) {
    console.error("[PublicAPI] Error listing categories:", error);
    return res.status(503).json({ success: false, error: "Categories are temporarily unavailable" });
  }
}

export async function handleCreateHandoff(req: Request, res: Response) {
  try {
    res.set("Cache-Control", "no-store");
    const input = agentHandoffRequestSchema.parse(req.body);
    if (input.preferredTime && !input.preferredDate) {
      return res.status(400).json({ success: false, error: "preferredDate is required when preferredTime is supplied" });
    }
    const record = await getPublicServiceAndProvider(input.serviceId);
    if (!record) return res.status(404).json({ success: false, error: "Service not found" });

    if (input.preferredDate) {
      const dateViolation = getBookingDateViolation({
        bookingDate: input.preferredDate,
        maxAdvanceBookingDays: record.service.maxAdvanceBookingDays,
        timeZone: OLOGYCREW_BOOKING_TIME_ZONE,
      });
      if (dateViolation) {
        return res.status(400).json({ success: false, error: "preferredDate is outside this service's booking window" });
      }
      if (input.preferredTime) {
        const policy = evaluateBookingWindow({
          bookingDate: input.preferredDate,
          startTime: input.preferredTime,
          minAdvanceBookingHours: record.service.minAdvanceBookingHours,
          maxAdvanceBookingDays: record.service.maxAdvanceBookingDays,
          timeZone: OLOGYCREW_BOOKING_TIME_ZONE,
        });
        if (!policy.allowed) {
          return res.status(400).json({ success: false, error: policy.message });
        }
      }
    }

    const decision = getAdaptiveBookingDecision(record.service);
    if (decision.mode === "direct" && input.preferredDate && input.preferredTime) {
      const availableSlots = await buildAvailability(record.provider.id, record.service, input.preferredDate);
      if (!availableSlots.some((slot) => slot.startTime === input.preferredTime)) {
        return res.status(409).json({ success: false, error: "The requested time is no longer available" });
      }
    }

    const { token, expiresAt } = createAgentHandoffToken(input, decision.mode);
    return res.status(201).json({
      success: true,
      data: {
        mode: decision.mode,
        reviewUrl: buildAgentHandoffReviewUrl(input.serviceId, token),
        expiresAt,
        requiresHumanReview: true,
        createsBooking: false,
        createsQuote: false,
        createsHold: false,
        collectsPayment: false,
        message: decision.mode === "direct"
          ? "Open the review URL so the customer can verify availability, sign in, and submit the booking themselves."
          : "Open the review URL so the customer can review the prefilled details, sign in, and send the quote request themselves.",
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) return sendValidationError(res, error);
    console.error("[PublicAPI] Error creating agent handoff:", error);
    return res.status(503).json({ success: false, error: "A review handoff could not be prepared" });
  }
}

export async function handlePublicApiDocs(_req: Request, res: Response) {
  return res.json({
    name: "OlogyCrew Public Agent API",
    version: AGENT_DISCOVERY_VERSION,
    description: "Read-only discovery plus a short-lived, user-reviewed handoff into OlogyCrew's existing adaptive booking or quote flow.",
    baseUrl: OLOGYCREW_PUBLIC_API_BASE,
    schedulingTimezone: OLOGYCREW_BOOKING_TIME_ZONE,
    authentication: "None required for current discovery and handoff endpoints",
    rateLimit: "Subject to OlogyCrew's public API limits; respect 429 Retry-After responses",
    safety: {
      agentCanCreateBooking: false,
      agentCanCreateQuote: false,
      agentCanPlaceHold: false,
      agentCanCollectPayment: false,
      customerMustReviewAndSubmit: true,
    },
    endpoints: [
      { method: "GET", path: "/services", description: "Search active services by keyword, category, provider location, and public price. Official demo providers are excluded unless includeDemo=true." },
      { method: "GET", path: "/providers/:slug", description: "Get an active provider's public profile, categories, trust context, and active services" },
      { method: "GET", path: "/availability/:providerId?serviceId={id}&date=YYYY-MM-DD", description: "Get service-duration-specific available starts without revealing booking details or creating a hold" },
      { method: "GET", path: "/categories", description: "List active service categories with active-service counts" },
      { method: "POST", path: "/handoffs", description: "Prepare a 30-minute encrypted review URL. This creates no booking, quote, hold, payment, or database record." },
    ],
  });
}

router.get("/", handlePublicApiRoot);
router.get("/services", handleSearchServices);
router.get("/providers/:slug", handleGetProvider);
router.get("/availability/:providerId", handleAvailability);
router.get("/categories", handleCategories);
router.post("/handoffs", handleCreateHandoff);
router.get("/docs", handlePublicApiDocs);

export default router;
