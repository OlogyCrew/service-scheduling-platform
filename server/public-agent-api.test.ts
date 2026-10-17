import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  searchPublicServicesForAgents: vi.fn(),
  getPublicCategoriesWithServiceCounts: vi.fn(),
  getProviderBySlug: vi.fn(),
  getProviderById: vi.fn(),
  getUserById: vi.fn(),
  getServicesByProviderId: vi.fn(),
  getProviderCategories: vi.fn(),
  getProviderTrustProfile: vi.fn(),
  getServiceById: vi.fn(),
  getCategoryById: vi.fn(),
  getAvailabilityByProvider: vi.fn(),
  getAvailabilityOverrides: vi.fn(),
  getBookingsByDateRange: vi.fn(),
  getSessionsByDateRange: vi.fn(),
}));

vi.mock("./db", () => dbMocks);

import {
  handleAvailability,
  handleCategories,
  handleCreateHandoff,
  handleGetProvider,
  handleSearchServices,
} from "./publicApiRouter";

function responseMock() {
  const state: { status: number; body?: any; headers: Record<string, string> } = { status: 200, headers: {} };
  const res = {
    status: vi.fn((status: number) => { state.status = status; return res; }),
    json: vi.fn((body: any) => { state.body = body; return res; }),
    send: vi.fn((body: any) => { state.body = body; return res; }),
    set: vi.fn((name: string, value?: string) => {
      if (value) state.headers[name] = value;
      return res;
    }),
  } as unknown as Response;
  return { res, state };
}

function request(input: { query?: any; params?: any; body?: any } = {}) {
  return { query: input.query || {}, params: input.params || {}, body: input.body || {} } as Request;
}

const provider = {
  id: 1,
  userId: 2,
  businessName: "Chisolm Audio",
  profileSlug: "chisolm-audio",
  description: "Professional audio services",
  city: "Hoschton",
  state: "Ga",
  isActive: true,
  deletedAt: null,
  isOfficial: false,
  averageRating: "5.00",
  totalReviews: 3,
  acceptsFixedLocation: true,
  acceptsMobile: true,
  acceptsVirtual: false,
};

const directService = {
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
  minAdvanceBookingHours: 0,
  maxAdvanceBookingDays: 36500,
  isGroupClass: false,
  maxCapacity: 1,
  isActive: true,
  deletedAt: null,
};

const quoteService = {
  ...directService,
  id: 930001,
  name: "Audio Enhancement",
  pricingModel: "custom_quote",
  basePrice: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  dbMocks.getProviderById.mockResolvedValue(provider);
  dbMocks.getProviderBySlug.mockResolvedValue(provider);
  dbMocks.getUserById.mockResolvedValue({ id: 2, profilePhotoUrl: null, deletedAt: null });
  dbMocks.getServiceById.mockResolvedValue(directService);
  dbMocks.getCategoryById.mockResolvedValue({ id: 15, isActive: true });
  dbMocks.getServicesByProviderId.mockResolvedValue([directService]);
  dbMocks.getProviderCategories.mockResolvedValue([{ categoryId: 15, categoryName: "AUDIO VISUAL CREW", categorySlug: "audio-visual-crew" }]);
  dbMocks.getProviderTrustProfile.mockResolvedValue(null);
  dbMocks.getAvailabilityOverrides.mockResolvedValue([]);
  dbMocks.getBookingsByDateRange.mockResolvedValue([]);
  dbMocks.getSessionsByDateRange.mockResolvedValue([]);
});

describe("public agent API", () => {
  it("passes every advertised service filter to the authoritative query and returns canonical review data", async () => {
    dbMocks.searchPublicServicesForAgents.mockResolvedValue({
      rows: [{
        ...directService,
        categoryName: "AUDIO VISUAL CREW",
        categorySlug: "audio-visual-crew",
        businessName: "Chisolm Audio",
        providerSlug: "chisolm-audio",
        providerCity: "Hoschton",
        providerState: "Ga",
        providerRating: "5.00",
        providerReviewCount: 3,
        providerOfficial: false,
        providerTrustLevel: "trusted",
      }],
      total: 1,
    });
    const { res, state } = responseMock();

    await handleSearchServices(request({ query: {
      q: "audio",
      category: "audio-visual-crew",
      city: "Hoschton",
      state: "GA",
      minPrice: "100",
      maxPrice: "600",
      limit: "10",
      offset: "2",
    } }), res);

    expect(dbMocks.searchPublicServicesForAgents).toHaveBeenCalledWith({
      query: "audio",
      category: "audio-visual-crew",
      city: "Hoschton",
      state: "GA",
      minPrice: 100,
      maxPrice: 600,
      includeDemo: false,
      limit: 10,
      offset: 2,
    });
    expect(state.body.data[0]).toMatchObject({
      id: 330003,
      isDemo: false,
      bookingMode: "direct",
      reviewUrl: "https://ologycrew.com/service/330003?entry=agent-discovery",
      provider: { slug: "chisolm-audio", city: "Hoschton", state: "Ga", isDemo: false },
    });
  });

  it("includes and explicitly labels official demo services only when requested", async () => {
    dbMocks.searchPublicServicesForAgents.mockResolvedValue({
      rows: [{
        ...directService,
        categoryName: "AUDIO VISUAL CREW",
        categorySlug: "audio-visual-crew",
        businessName: "Demo - OlogyCrew",
        providerSlug: "demo-ologycrew",
        providerCity: "Atlanta",
        providerState: "GA",
        providerRating: null,
        providerReviewCount: 0,
        providerOfficial: true,
        providerTrustLevel: "new",
        isDemo: true,
      }],
      total: 1,
    });
    const { res, state } = responseMock();

    await handleSearchServices(request({ query: { includeDemo: "true" } }), res);

    expect(dbMocks.searchPublicServicesForAgents).toHaveBeenCalledWith(expect.objectContaining({ includeDemo: true }));
    expect(state.body).toMatchObject({ pagination: { total: 1 } });
    expect(state.body.data[0]).toMatchObject({
      isDemo: true,
      provider: { isDemo: true, averageRating: null, totalReviews: 0 },
    });
  });

  it("returns canonical provider category IDs and names rather than relationship IDs", async () => {
    const { res, state } = responseMock();
    await handleGetProvider(request({ params: { slug: "chisolm-audio" } }), res);

    expect(state.status).toBe(200);
    expect(state.body.data.isDemo).toBe(false);
    expect(state.body.data.categories).toEqual([{ id: 15, name: "AUDIO VISUAL CREW", slug: "audio-visual-crew" }]);
    expect(state.body.data.services[0]).toMatchObject({ id: 330003, isDemo: false, bookingMode: "direct" });
  });

  it("labels an official provider and every service in its detail response as demo", async () => {
    dbMocks.getProviderBySlug.mockResolvedValue({ ...provider, isOfficial: true });
    const { res, state } = responseMock();

    await handleGetProvider(request({ params: { slug: "demo-ologycrew" } }), res);

    expect(state.status).toBe(200);
    expect(state.body.data).toMatchObject({ isDemo: true, services: [{ id: 330003, isDemo: true }] });
  });

  it("returns real category counts and canonical category URLs", async () => {
    dbMocks.getPublicCategoriesWithServiceCounts.mockResolvedValue([{ id: 15, name: "AUDIO VISUAL CREW", slug: "audio-visual-crew", description: "AV", serviceCount: "8" }]);
    const { res, state } = responseMock();
    await handleCategories(request(), res);

    expect(state.body.data).toEqual([{ id: 15, name: "AUDIO VISUAL CREW", slug: "audio-visual-crew", description: "AV", serviceCount: 8, url: "https://ologycrew.com/category/audio-visual-crew" }]);
  });

  it("returns duration-specific available starts without exposing booking details or creating a hold", async () => {
    const date = "2099-01-05";
    const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
    dbMocks.getAvailabilityByProvider.mockResolvedValue([{ dayOfWeek, startTime: "09:00", endTime: "12:00", isAvailable: true }]);
    dbMocks.getBookingsByDateRange.mockResolvedValue([{ bookingDate: date, startTime: "09:00", endTime: "10:00", durationMinutes: 60, status: "confirmed", customerEmail: "private@example.com" }]);
    const { res, state } = responseMock();

    await handleAvailability(request({ params: { providerId: "1" }, query: { serviceId: "330003", date } }), res);

    expect(state.body.data).toMatchObject({
      providerId: 1,
      serviceId: 330003,
      durationMinutes: 60,
      bookingMode: "direct",
      holdsCreated: 0,
      timezone: "America/New_York",
    });
    expect(state.body.data.availableSlots.map((slot: any) => slot.startTime)).toEqual(["10:00", "10:30", "11:00"]);
    expect(JSON.stringify(state.body)).not.toContain("private@example.com");
  });

  it("guides quote-only services to a review handoff without returning schedule internals", async () => {
    dbMocks.getServiceById.mockResolvedValue(quoteService);
    const { res, state } = responseMock();
    await handleAvailability(request({ params: { providerId: "1" }, query: { serviceId: "930001", date: "2099-01-05" } }), res);

    expect(state.body.data).toMatchObject({ bookingMode: "quote", availableSlots: [] });
    expect(dbMocks.getAvailabilityByProvider).not.toHaveBeenCalled();
  });

  it("prepares an encrypted, customer-reviewed handoff without transactional side effects", async () => {
    const { res, state } = responseMock();
    await handleCreateHandoff(request({ body: {
      serviceId: 330003,
      intent: "Book an A1 for a church event",
      location: "Hoschton, GA",
    } }), res);

    expect(state.status).toBe(201);
    expect(state.body.data).toMatchObject({
      mode: "direct",
      requiresHumanReview: true,
      createsBooking: false,
      createsQuote: false,
      createsHold: false,
      collectsPayment: false,
    });
    expect(state.body.data.reviewUrl).toMatch(/^https:\/\/ologycrew\.com\/service\/330003\?entry=agent&handoff=v1\./);
    expect(state.body.data.reviewUrl).not.toContain("Hoschton");
  });

  it("excludes services whose category is no longer public", async () => {
    dbMocks.getCategoryById.mockResolvedValueOnce({ id: 15, isActive: false });
    const { res, state } = responseMock();
    await handleCreateHandoff(request({ body: { serviceId: 330003, intent: "Book audio support" } }), res);

    expect(state.status).toBe(404);
    expect(state.body.success).toBe(false);
  });
});
