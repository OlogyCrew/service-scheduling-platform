import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

vi.mock("./notifications", async importOriginal => {
  const original = await importOriginal<Record<string, unknown>>();
  return {
    ...original,
    sendNotification: vi.fn().mockResolvedValue({ success: true }),
    sendMultiChannelNotification: vi.fn().mockResolvedValue({ email: true, sms: true }),
  };
});

vi.mock("./notifications/pushHelper", () => ({
  sendPushNotification: vi.fn().mockResolvedValue(undefined),
}));

// ============================================================================
// HELPERS
// ============================================================================

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 1,
    openId: "customer-1",
    email: "customer@example.com",
    name: "Test Customer",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
}

function makeCtx(user: AuthenticatedUser): TrpcContext {
  return {
    user,
    req: {
      protocol: "https",
      headers: { origin: "https://test.example.com" },
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function makePublicCtx(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: { origin: "https://test.example.com" },
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

// ============================================================================
// MOCK DB
// ============================================================================

const mockQuotes: any[] = [];
let nextQuoteId = 1;

vi.mock("./db", async (importOriginal) => {
  const original = await importOriginal() as Record<string, unknown>;
  return {
    ...original,
    getProviderByUserId: vi.fn(async (userId: number) => {
      if (userId === 2) return { id: 10, userId: 2, businessName: "Test Provider", slug: "test-provider-10", isActive: true, deletedAt: null };
      return null;
    }),
    getProviderById: vi.fn(async (id: number) => id === 10
      ? { id: 10, userId: 2, businessName: "Test Provider", isActive: true, deletedAt: null }
      : null),
    getUserById: vi.fn(async (id: number) => {
      if (id === 1) return { id: 1, name: "Test Customer", email: "customer@example.com", deletedAt: null };
      if (id === 2) return { id: 2, name: "Test Provider", email: "provider@example.com", deletedAt: null };
      return null;
    }),
    getServiceById: vi.fn(async (id: number) => id === 5 ? {
      id: 5,
      providerId: 10,
      categoryId: 7,
      name: "Test Service",
      isActive: true,
      deletedAt: null,
      minAdvanceBookingHours: 0,
      maxAdvanceBookingDays: 36500,
      isGroupClass: false,
      maxCapacity: 1,
    } : null),
    getCategoryById: vi.fn(async (id: number) => id === 7 ? { id, isActive: true } : null),
    createBookingWithCalendarGuard: vi.fn(async ({ quoteId }: any) => {
      const quote = mockQuotes.find((entry) => entry.id === quoteId);
      if (quote) {
        quote.status = "booked";
        quote.bookingId = 9001;
      }
      return 9001;
    }),
    createQuoteRequest: vi.fn(async (data: any) => {
      const quote = {
        id: nextQuoteId++,
        ...data,
        status: "pending",
        quotedAmount: null,
        quotedDurationMinutes: null,
        providerNotes: null,
        validUntil: null,
        declineReason: null,
        bookingId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockQuotes.push(quote);
      return { id: quote.id };
    }),
    getQuoteById: vi.fn(async (id: number) => {
      return mockQuotes.find((q) => q.id === id) || null;
    }),
    getQuotesByCustomer: vi.fn(async (customerId: number) => {
      return mockQuotes.filter((q) => q.customerId === customerId);
    }),
    getQuotesByProvider: vi.fn(async (providerId: number) => {
      return mockQuotes.filter((q) => q.providerId === providerId);
    }),
    respondToQuote: vi.fn(async (quoteId: number, data: any) => {
      const quote = mockQuotes.find((q) => q.id === quoteId);
      if (quote) {
        quote.status = "quoted";
        quote.quotedAmount = data.quotedAmount;
        quote.quotedDurationMinutes = data.quotedDurationMinutes;
        quote.providerNotes = data.providerNotes || null;
        quote.validUntil = data.validUntil || null;
      }
    }),
    updateQuoteStatus: vi.fn(async (quoteId: number, status: string, reason?: string) => {
      const quote = mockQuotes.find((q) => q.id === quoteId);
      if (quote) {
        quote.status = status;
        if (reason) quote.declineReason = reason;
      }
    }),
    getQuoteCountByProvider: vi.fn(async (providerId: number) => {
      const providerQuotes = mockQuotes.filter((q) => q.providerId === providerId);
      return {
        pending: providerQuotes.filter((q) => q.status === "pending").length,
        quoted: providerQuotes.filter((q) => q.status === "quoted").length,
        total: providerQuotes.length,
      };
    }),
  };
});

// ============================================================================
// TESTS
// ============================================================================

describe("Quote Request Flow", () => {
  beforeEach(() => {
    mockQuotes.length = 0;
    nextQuoteId = 1;
    vi.clearAllMocks();
  });

  describe("requestQuote", () => {
    it("creates a quote request with valid input", async () => {
      const customer = makeUser({ id: 1 });
      const caller = appRouter.createCaller(makeCtx(customer));

      const result = await caller.provider.requestQuote({
        providerId: 10,
        title: "Need a full home cleaning",
        description: "I need a thorough deep cleaning of my 3-bedroom house including kitchen and bathrooms.",
        preferredDate: "2026-05-01",
        preferredTime: "10:00",
        locationType: "mobile",
        location: "123 Main St, Springfield",
      });

      expect(result).toHaveProperty("id");
      expect(result.id).toBe(1);
    });

    it("rejects title shorter than 5 characters", async () => {
      const customer = makeUser({ id: 1 });
      const caller = appRouter.createCaller(makeCtx(customer));

      await expect(
        caller.provider.requestQuote({
          providerId: 10,
          title: "Hi",
          description: "I need a thorough deep cleaning of my 3-bedroom house.",
        })
      ).rejects.toThrow();
    });

    it("rejects description shorter than 20 characters", async () => {
      const customer = makeUser({ id: 1 });
      const caller = appRouter.createCaller(makeCtx(customer));

      await expect(
        caller.provider.requestQuote({
          providerId: 10,
          title: "Need cleaning",
          description: "Short desc",
        })
      ).rejects.toThrow();
    });

    it("requires authentication", async () => {
      const caller = appRouter.createCaller(makePublicCtx());

      await expect(
        caller.provider.requestQuote({
          providerId: 10,
          title: "Need a full home cleaning",
          description: "I need a thorough deep cleaning of my 3-bedroom house including kitchen and bathrooms.",
        })
      ).rejects.toThrow();
    });
  });

  describe("myQuotes (customer view)", () => {
    it("returns quotes for the logged-in customer", async () => {
      const customer = makeUser({ id: 1 });
      const caller = appRouter.createCaller(makeCtx(customer));

      // Create a quote first
      await caller.provider.requestQuote({
        providerId: 10,
        title: "Need a full home cleaning",
        description: "I need a thorough deep cleaning of my 3-bedroom house including kitchen and bathrooms.",
      });

      const quotes = await caller.provider.myQuotes();
      expect(quotes).toHaveLength(1);
      expect(quotes[0].customerId).toBe(1);
    });
  });

  describe("providerQuotes (provider view)", () => {
    it("returns enriched quotes for the provider", async () => {
      const provider = makeUser({ id: 2, role: "provider" as any });
      const caller = appRouter.createCaller(makeCtx(provider));

      // Seed a quote for this provider
      mockQuotes.push({
        id: 100,
        customerId: 1,
        providerId: 10,
        title: "Need plumbing work",
        description: "Fix a leaky faucet in the kitchen and bathroom",
        status: "pending",
        createdAt: new Date(),
      });

      const quotes = await caller.provider.providerQuotes();
      expect(quotes).toHaveLength(1);
      expect(quotes[0]).toHaveProperty("customerName");
      expect(quotes[0].customerName).toBe("Test Customer");
    });
  });

  describe("respondToQuote", () => {
    it("allows provider to send a quote with price and duration", async () => {
      const provider = makeUser({ id: 2, role: "provider" as any });
      const caller = appRouter.createCaller(makeCtx(provider));

      // Seed a pending quote
      mockQuotes.push({
        id: 200,
        customerId: 1,
        providerId: 10,
        title: "Need plumbing work",
        description: "Fix a leaky faucet in the kitchen and bathroom",
        status: "pending",
        createdAt: new Date(),
      });

      const result = await caller.provider.respondToQuote({
        quoteId: 200,
        quotedAmount: "150.00",
        quotedDurationMinutes: 60,
        providerNotes: "I can fix both faucets in one visit",
        validDays: 7,
      });

      expect(result).toEqual({ success: true });
      expect(mockQuotes[0].status).toBe("quoted");
      expect(mockQuotes[0].quotedAmount).toBe("150.00");
    });

    it("rejects responding to an already-quoted request", async () => {
      const provider = makeUser({ id: 2, role: "provider" as any });
      const caller = appRouter.createCaller(makeCtx(provider));

      mockQuotes.push({
        id: 300,
        customerId: 1,
        providerId: 10,
        title: "Need plumbing work",
        description: "Fix a leaky faucet in the kitchen and bathroom",
        status: "quoted",
        quotedAmount: "100.00",
        createdAt: new Date(),
      });

      await expect(
        caller.provider.respondToQuote({
          quoteId: 300,
          quotedAmount: "200.00",
          quotedDurationMinutes: 90,
        })
      ).rejects.toThrow("Quote has already been responded to");
    });

    it("rejects non-owner provider from responding", async () => {
      const otherProvider = makeUser({ id: 99, role: "provider" as any });
      const caller = appRouter.createCaller(makeCtx(otherProvider));

      mockQuotes.push({
        id: 400,
        customerId: 1,
        providerId: 10,
        title: "Need plumbing work",
        description: "Fix a leaky faucet in the kitchen and bathroom",
        status: "pending",
        createdAt: new Date(),
      });

      await expect(
        caller.provider.respondToQuote({
          quoteId: 400,
          quotedAmount: "150.00",
          quotedDurationMinutes: 60,
        })
      ).rejects.toThrow();
    });
  });

  describe("updateQuoteStatus", () => {
    it("allows customer to accept a quoted price", async () => {
      const customer = makeUser({ id: 1 });
      const caller = appRouter.createCaller(makeCtx(customer));

      mockQuotes.push({
        id: 500,
        customerId: 1,
        providerId: 10,
        serviceId: 5,
        title: "Need plumbing work",
        description: "Fix a leaky faucet in the kitchen and bathroom",
        status: "quoted",
        quotedAmount: "150.00",
        quotedDurationMinutes: 60,
        preferredDate: "2027-06-15",
        preferredTime: "10:00",
        createdAt: new Date(),
      });

      const result = await caller.provider.updateQuoteStatus({
        quoteId: 500,
        status: "accepted",
      });

      expect(result.success).toBe(true);
    });

    it("rejects an expired quote before atomic booking conversion", async () => {
      const customer = makeUser({ id: 1 });
      const caller = appRouter.createCaller(makeCtx(customer));
      const { createBookingWithCalendarGuard } = await import("./db");
      mockQuotes.push({
        id: 501,
        customerId: 1,
        providerId: 10,
        serviceId: 5,
        title: "Expired plumbing quote",
        description: "A complete quote that has passed its provider-set deadline.",
        status: "quoted",
        quotedAmount: "150.00",
        quotedDurationMinutes: 60,
        validUntil: new Date(Date.now() - 60_000),
        createdAt: new Date(),
      });

      await expect(caller.provider.updateQuoteStatus({ quoteId: 501, status: "accepted" }))
        .rejects.toThrow("This quote has expired");
      expect(createBookingWithCalendarGuard).not.toHaveBeenCalled();
    });

    it("rejects customer accepting a non-quoted request", async () => {
      const customer = makeUser({ id: 1 });
      const caller = appRouter.createCaller(makeCtx(customer));

      mockQuotes.push({
        id: 600,
        customerId: 1,
        providerId: 10,
        title: "Need plumbing work",
        description: "Fix a leaky faucet in the kitchen and bathroom",
        status: "pending",
        createdAt: new Date(),
      });

      await expect(
        caller.provider.updateQuoteStatus({
          quoteId: 600,
          status: "accepted",
        })
      ).rejects.toThrow("Can only accept a quoted price");
    });

    it("allows customer to decline a quote with reason", async () => {
      const customer = makeUser({ id: 1 });
      const caller = appRouter.createCaller(makeCtx(customer));

      mockQuotes.push({
        id: 700,
        customerId: 1,
        providerId: 10,
        title: "Need plumbing work",
        description: "Fix a leaky faucet in the kitchen and bathroom",
        status: "quoted",
        quotedAmount: "500.00",
        createdAt: new Date(),
      });

      const result = await caller.provider.updateQuoteStatus({
        quoteId: 700,
        status: "declined",
        reason: "Too expensive",
      });

      expect(result.success).toBe(true);
      expect(result.bookingId).toBeNull();
    });

    it("rejects unauthorized user from updating quote", async () => {
      const stranger = makeUser({ id: 99 });
      const caller = appRouter.createCaller(makeCtx(stranger));

      mockQuotes.push({
        id: 800,
        customerId: 1,
        providerId: 10,
        title: "Need plumbing work",
        description: "Fix a leaky faucet in the kitchen and bathroom",
        status: "quoted",
        quotedAmount: "150.00",
        createdAt: new Date(),
      });

      await expect(
        caller.provider.updateQuoteStatus({
          quoteId: 800,
          status: "accepted",
        })
      ).rejects.toThrow("Access denied");
    });
  });

  describe("quoteCount", () => {
    it("returns quote counts for provider", async () => {
      const provider = makeUser({ id: 2, role: "provider" as any });
      const caller = appRouter.createCaller(makeCtx(provider));

      mockQuotes.push(
        { id: 901, customerId: 1, providerId: 10, status: "pending", createdAt: new Date() },
        { id: 902, customerId: 1, providerId: 10, status: "pending", createdAt: new Date() },
        { id: 903, customerId: 1, providerId: 10, status: "quoted", createdAt: new Date() },
      );

      const counts = await caller.provider.quoteCount();
      expect(counts.pending).toBe(2);
      expect(counts.quoted).toBe(1);
      expect(counts.total).toBe(3);
    });

    it("returns zeros for non-provider user", async () => {
      const customer = makeUser({ id: 1 });
      const caller = appRouter.createCaller(makeCtx(customer));

      const counts = await caller.provider.quoteCount();
      expect(counts).toEqual({ pending: 0, quoted: 0, total: 0 });
    });
  });
});
