import { readFileSync } from "fs";
import { resolve } from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildAgentManifest, buildLlmsTxt, buildOpenApiDocument } from "./agentDiscovery";
import { buildRobotsTxt } from "./sitemap";

const dbMocks = vi.hoisted(() => ({
  getProviderBySlug: vi.fn(),
  getUserById: vi.fn(),
  getServicesByProviderId: vi.fn(),
  getProviderCategories: vi.fn(),
  getServiceById: vi.fn(),
  getProviderById: vi.fn(),
  getCategoryById: vi.fn(),
  getCategoryBySlug: vi.fn(),
  searchPublicServicesForAgents: vi.fn(),
}));

vi.mock("./db", () => dbMocks);

import { getCategoryJsonLd, getHomepageJsonLd, getProviderJsonLd, getServiceJsonLd } from "./structuredData";

const root = resolve(import.meta.dirname, "..");
const service = {
  id: 330003,
  providerId: 1,
  categoryId: 15,
  name: "A1",
  description: "Lead audio engineer",
  serviceType: "mobile",
  pricingModel: "fixed",
  basePrice: "550.00",
  hourlyRate: null,
  durationMinutes: 60,
  isActive: true,
  deletedAt: null,
};
const provider = {
  id: 1,
  userId: 2,
  businessName: "Chisolm Audio",
  profileSlug: "chisolm-audio",
  description: "Professional audio services",
  city: "Hoschton",
  state: "Ga",
  postalCode: "30548",
  businessLogoUrl: null,
  isActive: true,
  deletedAt: null,
  isOfficial: false,
  averageRating: "5.00",
  totalReviews: 3,
};

beforeEach(() => {
  vi.clearAllMocks();
  dbMocks.getProviderBySlug.mockResolvedValue(provider);
  dbMocks.getProviderById.mockResolvedValue(provider);
  dbMocks.getUserById.mockResolvedValue({ id: 2, profilePhotoUrl: "https://example.com/photo.jpg", phone: "PRIVATE-PHONE", deletedAt: null });
  dbMocks.getServicesByProviderId.mockResolvedValue([service]);
  dbMocks.getProviderCategories.mockResolvedValue([{ categoryId: 15, categoryName: "AUDIO VISUAL CREW", categorySlug: "audio-visual-crew" }]);
  dbMocks.getServiceById.mockResolvedValue(service);
  dbMocks.getCategoryById.mockResolvedValue({ id: 15, name: "AUDIO VISUAL CREW", slug: "audio-visual-crew", isActive: true });
  dbMocks.getCategoryBySlug.mockResolvedValue({ id: 15, name: "AUDIO VISUAL CREW", slug: "audio-visual-crew", description: "AV services", isActive: true });
  dbMocks.searchPublicServicesForAgents.mockResolvedValue({ rows: [service], total: 1 });
});

describe("agent discovery documents", () => {
  it("keeps the manifest, llms.txt, and OpenAPI on the same safe capabilities", () => {
    const manifest = buildAgentManifest();
    const staticManifest = JSON.parse(readFileSync(resolve(root, "client/public/.well-known/agents.json"), "utf8"));
    const llms = buildLlmsTxt();
    const openapi = buildOpenApiDocument();

    expect(manifest.version).toBe("1.1.1");
    expect(staticManifest).toEqual(manifest);
    expect(manifest.capabilities.prepare_review_handoff.endpoint).toBe("POST /api/public/handoffs");
    expect(manifest.capabilities.search_services.parameters).toContain("includeDemo");
    expect(manifest.transactionPolicy).toMatchObject({ agentCanCreateBooking: false, agentCanCollectPayment: false, customerMustReviewAndSubmit: true });
    expect(llms).toContain("does not create bookings, quote requests, availability holds");
    expect(llms).toContain("includeDemo=true");
    expect(llms).toContain("https://ologycrew.com/openapi.json");
    expect(openapi.openapi).toBe("3.1.0");
    expect(openapi.paths["/services"].get.parameters).toContainEqual(expect.objectContaining({ name: "includeDemo", schema: { type: "boolean", default: false } }));
    expect(openapi.components.schemas.ServiceSearchResponse).toBeDefined();
    expect(openapi.components.schemas.HandoffResponse).toBeDefined();
    expect(openapi.components.schemas.ServiceSummary.properties.category.$ref).toBe("#/components/schemas/CategoryReference");
    expect(openapi.components.schemas.ServiceSummary.required).toContain("isDemo");
    expect(openapi.components.schemas.ProviderSummary.required).toContain("isDemo");
    expect(openapi.components.schemas.ProviderResponse.properties.data.required).toContain("isDemo");
    expect(openapi.components.schemas.ProviderServiceSummary.required).toContain("isDemo");
    expect(openapi.components.schemas.ProviderResponse.properties.data.properties.services.items.$ref).toBe("#/components/schemas/ProviderServiceSummary");
    expect(manifest.schedulingTimezone).toBe("America/New_York");
    expect(llms).toContain("America/New_York");
    expect(openapi.paths["/handoffs"].post.description).toContain("creates no booking, quote, hold, payment");
  });

  it("allows the public agent resources while keeping the rest of the API crawler-blocked", () => {
    const robots = buildRobotsTxt();
    expect(robots).toContain("Allow: /api/public/");
    expect(robots).toContain("Allow: /llms.txt");
    expect(robots).toContain("Allow: /openapi.json");
    expect(robots).toContain("Disallow: /api/");
  });
});

describe("canonical structured data", () => {
  it("emits canonical homepage discovery data", () => {
    const html = getHomepageJsonLd("https://internal.example");
    expect(html).toContain('"url":"https://ologycrew.com"');
    expect(html).toContain('"@type":"SearchAction"');
    expect(html).toContain("https://ologycrew.com/browse?q={search_term_string}");
    expect(html).not.toContain("https://ologycrew.com/search?q=");
    expect(html).not.toContain("internal.example");
  });

  it("emits provider offers with correct service fields and no private phone data", async () => {
    const html = await getProviderJsonLd("chisolm-audio", "https://internal.example");
    expect(html).toContain('"name":"A1"');
    expect(html).toContain('"price":"550.00"');
    expect(html).toContain('"estimatedDuration":"PT60M"');
    expect(html).toContain("https://ologycrew.com/chisolm-audio");
    expect(html).not.toContain("PRIVATE-PHONE");
    expect(html).not.toContain("internal.example");
  });

  it("emits dedicated service and category schemas", async () => {
    const serviceHtml = await getServiceJsonLd(330003, "https://internal.example");
    const categoryHtml = await getCategoryJsonLd("audio-visual-crew", "https://internal.example");
    expect(serviceHtml).toContain('"@type":"Service"');
    expect(serviceHtml).toContain("https://ologycrew.com/service/330003");
    expect(categoryHtml).toContain('"@type":"CollectionPage"');
    expect(categoryHtml).toContain('"@type":"ItemList"');
  });

  it("reports the full category result count while limiting embedded items", async () => {
    dbMocks.searchPublicServicesForAgents.mockResolvedValueOnce({ rows: [service], total: 72 });
    const categoryHtml = await getCategoryJsonLd("audio-visual-crew", "https://internal.example");
    expect(categoryHtml).toContain('"numberOfItems":72');
  });
});

describe("agent review boundary integration", () => {
  const publicApi = readFileSync(resolve(root, "server/publicApiRouter.ts"), "utf8");
  const resolver = readFileSync(resolve(root, "server/routers/agentHandoffRouter.ts"), "utf8");
  const servicePage = readFileSync(resolve(root, "client/src/pages/ServiceDetail.tsx"), "utf8");
  const htmlServer = readFileSync(resolve(root, "server/_core/vite.ts"), "utf8");
  const appServer = readFileSync(resolve(root, "server/_core/index.ts"), "utf8");

  it("contains no transactional write path in the public API or token resolver", () => {
    for (const source of [publicApi, resolver]) {
      expect(source).not.toContain("createBooking(");
      expect(source).not.toContain("requestQuote.mutate");
      expect(source).not.toContain("createCheckoutSession");
      expect(source).not.toContain("db.insert");
    }
  });

  it("requires review, resolves the encrypted token, and preserves it through login", () => {
    expect(servicePage).toContain("trpc.agentHandoff.resolve.useMutation");
    expect(servicePage).toContain("Nothing has been booked, quoted, held, or charged.");
    expect(servicePage).toContain("window.location.pathname}${window.location.search}");
    expect(servicePage).toContain('data-testid="agent-handoff-review-notice"');
    expect(servicePage).toContain("agentPreferredTimeApplied");
    expect(servicePage).toContain("availableSlots.some((slot) => slot.available && slot.time === agentHandoff.preferredTime)");
    expect(servicePage).toContain("Select the highlighted time to confirm and continue.");
    expect(htmlServer).toContain('res.set("Cache-Control", "private, no-store")');
    expect(htmlServer).toContain('res.set("Referrer-Policy", "no-referrer")');
    expect(resolver).toContain(".mutation(async");
    expect(resolver).toContain("db.getUserById(provider.userId)");
    expect(resolver).toContain("db.getCategoryById(service.categoryId)");
    expect(appServer).toContain('req.path.includes("agentHandoff.resolve")');
    expect(appServer).toContain('res.setHeader("Cache-Control", "private, no-store")');
  });
});
