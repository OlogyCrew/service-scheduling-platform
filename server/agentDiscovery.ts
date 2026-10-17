import type { Request, Response } from "express";
import { OLOGYCREW_PUBLIC_API_BASE, OLOGYCREW_PUBLIC_ORIGIN, ologyCrewPublicUrl } from "../shared/publicUrls";
import { OLOGYCREW_BOOKING_TIME_ZONE } from "../shared/bookingPolicy";

export const AGENT_DISCOVERY_VERSION = "1.1.1";

export function buildAgentManifest() {
  return {
    name: "OlogyCrew",
    version: AGENT_DISCOVERY_VERSION,
    description: "Marketplace for discovering service providers and preparing customer-reviewed booking or quote handoffs.",
    url: OLOGYCREW_PUBLIC_ORIGIN,
    logo: "https://d2xsxph8kpxj0f.cloudfront.net/310519663275372790/QD7eHrqop9F5cN2Q4sYGpD/logo-navbar_38427c60.png",
    api: {
      type: "rest",
      url: OLOGYCREW_PUBLIC_API_BASE,
      documentation: `${OLOGYCREW_PUBLIC_API_BASE}/docs`,
      openapi: ologyCrewPublicUrl("/openapi.json"),
    },
    capabilities: {
      search_services: {
        description: "Search active non-demo services by keyword, category, provider location, or public price. Set includeDemo=true to include official demos, labeled isDemo=true after real providers.",
        endpoint: "GET /api/public/services",
        parameters: ["q", "category", "city", "state", "minPrice", "maxPrice", "includeDemo", "limit", "offset"],
      },
      get_provider: {
        description: "Read an active provider's public profile, trust context, categories, and services.",
        endpoint: "GET /api/public/providers/:slug",
      },
      check_availability: {
        description: "Get service-duration-specific available starts without exposing booking details or creating a hold.",
        endpoint: "GET /api/public/availability/:providerId",
        requiredParameters: ["serviceId", "date"],
      },
      prepare_review_handoff: {
        description: "Prepare a 30-minute encrypted URL that preloads OlogyCrew's existing booking-or-quote review flow.",
        endpoint: "POST /api/public/handoffs",
      },
      list_categories: {
        description: "List active service categories with active-service counts.",
        endpoint: "GET /api/public/categories",
      },
    },
    supportedActions: ["search", "browse", "check_availability", "prepare_review_handoff"],
    schedulingTimezone: OLOGYCREW_BOOKING_TIME_ZONE,
    transactionPolicy: {
      agentCanCreateBooking: false,
      agentCanCreateQuote: false,
      agentCanPlaceHold: false,
      agentCanCollectPayment: false,
      customerMustReviewAndSubmit: true,
    },
    authentication: "none_required_for_current_endpoints",
    contact: "support@ologycrew.com",
  };
}

export function buildLlmsTxt() {
  return `# OlogyCrew

> OlogyCrew is a service marketplace where customers discover providers and complete direct bookings or request provider-reviewed quotes.

## Canonical resources

- Website: ${OLOGYCREW_PUBLIC_ORIGIN}
- Sitemap: ${ologyCrewPublicUrl("/sitemap.xml")}
- Agent manifest: ${ologyCrewPublicUrl("/.well-known/agents.json")}
- OpenAPI: ${ologyCrewPublicUrl("/openapi.json")}
- Public API documentation: ${OLOGYCREW_PUBLIC_API_BASE}/docs

## Supported agent capabilities

- Search active public services by keyword, category, provider city/state, and public price. Official demos are excluded by default; send includeDemo=true to include them. Demo results and providers are explicitly labeled isDemo=true, and real providers sort before demos when included.
- Read active provider profiles, public trust context, categories, services, pricing models, demo status, and review URLs.
- Check service-duration-specific available starts for a date without seeing customer or booking details.
- Prepare a short-lived encrypted handoff URL that opens OlogyCrew's existing adaptive booking-or-quote flow for customer review.

All marketplace date and time values currently use the ${OLOGYCREW_BOOKING_TIME_ZONE} IANA timezone.

## Transaction boundary

The public agent API is non-transactional. It does not create bookings, quote requests, availability holds, customers, payment methods, or payments. The customer must open OlogyCrew, review the provider, service, price or quote path, date, time, location, and terms, sign in if needed, and explicitly submit. Availability can change until OlogyCrew accepts a customer submission.

## Public API

- GET ${OLOGYCREW_PUBLIC_API_BASE}/services
- GET ${OLOGYCREW_PUBLIC_API_BASE}/providers/{slug}
- GET ${OLOGYCREW_PUBLIC_API_BASE}/availability/{providerId}?serviceId={serviceId}&date=YYYY-MM-DD
- GET ${OLOGYCREW_PUBLIC_API_BASE}/categories
- POST ${OLOGYCREW_PUBLIC_API_BASE}/handoffs

For exact parameters and response contracts, use ${ologyCrewPublicUrl("/openapi.json")}.
`;
}

export function buildOpenApiDocument() {
  const jsonResponse = (description: string, schema: Record<string, unknown>) => ({
    description,
    content: { "application/json": { schema } },
  });
  const errorResponse = (description: string) => jsonResponse(description, { $ref: "#/components/schemas/ErrorResponse" });

  return {
    openapi: "3.1.0",
    info: {
      title: "OlogyCrew Public Agent API",
      version: AGENT_DISCOVERY_VERSION,
      description: "Public service discovery and short-lived customer-review handoffs. No endpoint creates a booking, quote, hold, or payment.",
      contact: { email: "support@ologycrew.com" },
    },
    servers: [{ url: OLOGYCREW_PUBLIC_API_BASE }],
    paths: {
      "/services": {
        get: {
          operationId: "searchServices",
          summary: "Search active public services",
          parameters: [
            { name: "q", in: "query", schema: { type: "string", maxLength: 200 } },
            { name: "category", in: "query", schema: { type: "string", maxLength: 120 } },
            { name: "city", in: "query", schema: { type: "string", maxLength: 120 } },
            { name: "state", in: "query", schema: { type: "string", maxLength: 80 } },
            { name: "minPrice", in: "query", schema: { type: "number", minimum: 0 } },
            { name: "maxPrice", in: "query", schema: { type: "number", minimum: 0 } },
            { name: "includeDemo", in: "query", description: "Include official OlogyCrew demo providers. Defaults to false; real providers sort before demos when true.", schema: { type: "boolean", default: false } },
            { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 50, default: 20 } },
            { name: "offset", in: "query", schema: { type: "integer", minimum: 0, maximum: 10000, default: 0 } },
          ],
          responses: {
            "200": jsonResponse("Paginated service results", { $ref: "#/components/schemas/ServiceSearchResponse" }),
            "400": errorResponse("Invalid filter"),
            "503": errorResponse("Temporarily unavailable"),
          },
        },
      },
      "/providers/{slug}": {
        get: {
          operationId: "getProvider",
          summary: "Get an active provider's public profile",
          parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string", pattern: "^[a-z0-9-]+$" } }],
          responses: {
            "200": jsonResponse("Public provider profile", { $ref: "#/components/schemas/ProviderResponse" }),
            "404": errorResponse("Provider not found"),
          },
        },
      },
      "/availability/{providerId}": {
        get: {
          operationId: "checkServiceAvailability",
          summary: "Get available service start times without creating a hold",
          parameters: [
            { name: "providerId", in: "path", required: true, schema: { type: "integer", minimum: 1 } },
            { name: "serviceId", in: "query", required: true, schema: { type: "integer", minimum: 1 } },
            { name: "date", in: "query", required: true, schema: { type: "string", format: "date" } },
          ],
          responses: {
            "200": jsonResponse("Available starts or quote-path guidance", { $ref: "#/components/schemas/AvailabilityResponse" }),
            "400": errorResponse("Invalid request"),
            "404": errorResponse("Service/provider combination not found"),
          },
        },
      },
      "/categories": {
        get: {
          operationId: "listCategories",
          summary: "List active categories and active-service counts",
          responses: { "200": jsonResponse("Category list", { $ref: "#/components/schemas/CategoryResponse" }) },
        },
      },
      "/handoffs": {
        post: {
          operationId: "prepareReviewHandoff",
          summary: "Prepare a customer-reviewed booking-or-quote handoff",
          description: "Returns a 30-minute encrypted review URL. It creates no booking, quote, hold, payment, customer, or database record.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HandoffRequest" },
              },
            },
          },
          responses: {
            "201": jsonResponse("Short-lived review URL prepared", { $ref: "#/components/schemas/HandoffResponse" }),
            "400": errorResponse("Invalid request"),
            "404": errorResponse("Service not found"),
            "409": errorResponse("Requested start time is no longer available"),
          },
        },
      },
    },
    components: {
      schemas: {
        ErrorResponse: {
          type: "object",
          required: ["success", "error"],
          properties: { success: { const: false }, error: { type: "string" } },
        },
        Price: {
          type: "object",
          required: ["amount", "unit"],
          properties: {
            amount: { type: ["number", "null"] },
            unit: { enum: ["service", "hour", "quote"] },
          },
        },
        CategoryReference: {
          type: "object",
          required: ["id", "name", "slug"],
          properties: {
            id: { type: "integer" },
            name: { type: "string" },
            slug: { type: "string" },
          },
        },
        Category: {
          type: "object",
          required: ["id", "name", "slug", "serviceCount", "url"],
          properties: {
            id: { type: "integer" },
            name: { type: "string" },
            slug: { type: "string" },
            description: { type: ["string", "null"] },
            serviceCount: { type: "integer", minimum: 0 },
            url: { type: "string", format: "uri" },
          },
        },
        ProviderSummary: {
          type: "object",
          required: ["id", "name", "slug", "isDemo", "profileUrl"],
          properties: {
            id: { type: "integer" },
            name: { type: ["string", "null"] },
            slug: { type: ["string", "null"] },
            isDemo: { type: "boolean", description: "True only for an official OlogyCrew demo provider." },
            city: { type: ["string", "null"] },
            state: { type: ["string", "null"] },
            profileUrl: { type: ["string", "null"], format: "uri" },
            averageRating: { type: ["number", "null"] },
            totalReviews: { type: "integer", minimum: 0 },
            trustLevel: { type: "string" },
          },
        },
        ServiceSummary: {
          type: "object",
          required: ["id", "name", "isDemo", "category", "pricingModel", "price", "bookingMode", "reviewUrl", "handoffEndpoint", "provider"],
          properties: {
            id: { type: "integer" },
            name: { type: "string" },
            description: { type: ["string", "null"] },
            isDemo: { type: "boolean", description: "True only when the service belongs to an official OlogyCrew demo provider." },
            category: { $ref: "#/components/schemas/CategoryReference" },
            serviceType: { type: "string" },
            pricingModel: { enum: ["fixed", "hourly", "package", "custom_quote", "consultation"] },
            price: { $ref: "#/components/schemas/Price" },
            durationMinutes: { type: ["integer", "null"] },
            isExperience: { type: "boolean" },
            bookingMode: { enum: ["direct", "quote"] },
            reviewUrl: { type: "string", format: "uri" },
            handoffEndpoint: { type: "string", format: "uri" },
            provider: { $ref: "#/components/schemas/ProviderSummary" },
          },
        },
        ServiceSearchResponse: {
          type: "object",
          required: ["success", "data", "pagination"],
          properties: {
            success: { const: true },
            data: { type: "array", items: { $ref: "#/components/schemas/ServiceSummary" } },
            pagination: {
              type: "object",
              required: ["limit", "offset", "total"],
              properties: { limit: { type: "integer" }, offset: { type: "integer" }, total: { type: "integer" } },
            },
          },
        },
        ProviderServiceSummary: {
          type: "object",
          required: ["id", "name", "isDemo", "categoryId", "pricingModel", "price", "bookingMode", "reviewUrl", "handoffEndpoint"],
          properties: {
            id: { type: "integer" },
            name: { type: "string" },
            description: { type: ["string", "null"] },
            isDemo: { type: "boolean", description: "True only when the service belongs to an official OlogyCrew demo provider." },
            categoryId: { type: "integer" },
            serviceType: { type: "string" },
            pricingModel: { enum: ["fixed", "hourly", "package", "custom_quote", "consultation"] },
            price: { $ref: "#/components/schemas/Price" },
            durationMinutes: { type: ["integer", "null"] },
            isExperience: { type: "boolean" },
            bookingMode: { enum: ["direct", "quote"] },
            reviewUrl: { type: "string", format: "uri" },
            handoffEndpoint: { type: "string", format: "uri" },
          },
        },
        ProviderResponse: {
          type: "object",
          required: ["success", "data"],
          properties: {
            success: { const: true },
            data: {
              type: "object",
              required: ["id", "name", "slug", "isDemo", "profileUrl", "categories", "services"],
              properties: {
                id: { type: "integer" },
                name: { type: ["string", "null"] },
                slug: { type: ["string", "null"] },
                isDemo: { type: "boolean", description: "True only for an official OlogyCrew demo provider." },
                description: { type: ["string", "null"] },
                city: { type: ["string", "null"] },
                state: { type: ["string", "null"] },
                profileUrl: { type: "string", format: "uri" },
                categories: { type: "array", items: { $ref: "#/components/schemas/CategoryReference" } },
                services: { type: "array", items: { $ref: "#/components/schemas/ProviderServiceSummary" } },
              },
            },
          },
        },
        AvailableStart: {
          type: "object",
          required: ["startTime", "isNextDay", "spotsRemaining"],
          properties: {
            startTime: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" },
            isNextDay: { type: "boolean" },
            spotsRemaining: { type: "integer", minimum: 1 },
          },
        },
        AvailabilityResponse: {
          type: "object",
          required: ["success", "data"],
          properties: {
            success: { const: true },
            data: {
              type: "object",
              required: ["providerId", "serviceId", "date", "bookingMode", "availableSlots"],
              properties: {
                providerId: { type: "integer" },
                serviceId: { type: "integer" },
                date: { type: "string", format: "date" },
                bookingMode: { enum: ["direct", "quote"] },
                available: { type: "boolean" },
                availableSlots: { type: "array", items: { $ref: "#/components/schemas/AvailableStart" } },
                timezone: { const: OLOGYCREW_BOOKING_TIME_ZONE },
                timezoneNote: { type: "string" },
                holdsCreated: { const: 0 },
                message: { type: "string" },
              },
            },
          },
        },
        CategoryResponse: {
          type: "object",
          required: ["success", "data"],
          properties: { success: { const: true }, data: { type: "array", items: { $ref: "#/components/schemas/Category" } } },
        },
        HandoffRequest: {
          type: "object",
          additionalProperties: false,
          required: ["serviceId"],
          properties: {
            serviceId: { type: "integer", minimum: 1 },
            intent: { type: "string", maxLength: 500 },
            location: { type: "string", maxLength: 300 },
            timing: { type: "string", maxLength: 200 },
            preferredDate: { type: "string", format: "date" },
            preferredTime: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" },
          },
        },
        HandoffResponse: {
          type: "object",
          required: ["success", "data"],
          properties: {
            success: { const: true },
            data: {
              type: "object",
              required: ["mode", "reviewUrl", "expiresAt", "requiresHumanReview", "createsBooking", "createsQuote", "createsHold", "collectsPayment"],
              properties: {
                mode: { enum: ["direct", "quote"] },
                reviewUrl: { type: "string", format: "uri" },
                expiresAt: { type: "string", format: "date-time" },
                requiresHumanReview: { const: true },
                createsBooking: { const: false },
                createsQuote: { const: false },
                createsHold: { const: false },
                collectsPayment: { const: false },
                message: { type: "string" },
              },
            },
          },
        },
      },
    },
  };
}

export function handleAgentManifest(_req: Request, res: Response) {
  return res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=3600").json(buildAgentManifest());
}

export function handleLlmsTxt(_req: Request, res: Response) {
  return res
    .set("Content-Type", "text/plain; charset=utf-8")
    .set("Cache-Control", "public, max-age=300, stale-while-revalidate=3600")
    .send(buildLlmsTxt());
}

export function handleOpenApi(_req: Request, res: Response) {
  return res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=3600").json(buildOpenApiDocument());
}
