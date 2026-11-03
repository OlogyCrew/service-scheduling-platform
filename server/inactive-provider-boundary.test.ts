import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getProviderById: vi.fn(),
  getAllProviders: vi.fn(),
  getProviderBySlug: vi.fn(),
  getServiceById: vi.fn(),
  getServicesByProviderId: vi.fn(),
  getProviderTier: vi.fn(),
  getProviderTrustProfile: vi.fn(),
}));

vi.mock("./db", () => ({
  getProviderById: mocks.getProviderById,
  getAllProviders: mocks.getAllProviders,
  getProviderBySlug: mocks.getProviderBySlug,
  getServiceById: mocks.getServiceById,
  getServicesByProviderId: mocks.getServicesByProviderId,
  getProviderTier: mocks.getProviderTier,
  getProviderTrustProfile: mocks.getProviderTrustProfile,
}));

import { providerRouter } from "./routers/providerRouter";
import { serviceRouter } from "./routers/serviceRouter";
import { bookingRouter } from "./routers/bookingRouter";
import { waitlistRouter } from "./routers/waitlistRouter";

const publicContext = { user: null, req: { headers: {} }, res: {} } as unknown as TrpcContext;
const customerContext = {
  user: {
    id: 20,
    openId: "test-clean-lifecycle-customer",
    email: "test-clean-lifecycle-customer@example.invalid",
    name: "Test Clean Lifecycle Customer",
    role: "customer",
    loginMethod: "test",
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    deletedAt: null,
  },
  req: { headers: {} },
  res: {},
} as unknown as TrpcContext;

describe("inactive provider public boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAllProviders.mockResolvedValue([]);
    mocks.getServicesByProviderId.mockResolvedValue([]);
  });

  it("hides inactive providers from direct public ID and slug endpoints", async () => {
    const inactive = { id: 7, userId: 70, businessName: "Hidden", isActive: false };
    mocks.getProviderById.mockResolvedValue(inactive);
    mocks.getProviderBySlug.mockResolvedValue(inactive);
    const caller = providerRouter.createCaller(publicContext);

    await expect(caller.getById({ id: 7 })).resolves.toBeNull();
    await expect(caller.getBySlug({ slug: "hidden" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.getProviderTrustProfile).not.toHaveBeenCalled();
  });

  it("forces public provider lists to active supply even when callers request inactive records", async () => {
    const caller = providerRouter.createCaller(publicContext);
    await caller.list({ city: "Atlanta", isActive: false });
    expect(mocks.getAllProviders).toHaveBeenCalledWith({ city: "Atlanta", isActive: true });
  });

  it("hides services owned by inactive providers", async () => {
    mocks.getServiceById.mockResolvedValue({ id: 11, providerId: 7, isActive: true });
    mocks.getProviderById.mockResolvedValue({ id: 7, isActive: false });
    const caller = serviceRouter.createCaller(publicContext);

    await expect(caller.getById({ id: 11 })).resolves.toBeNull();
    await expect(caller.listByProvider({ providerId: 7 })).resolves.toEqual([]);
    expect(mocks.getServicesByProviderId).not.toHaveBeenCalled();
  });

  it("rejects constructed-ID bookings before availability or notification side effects", async () => {
    mocks.getServiceById.mockResolvedValue({ id: 11, providerId: 7, isActive: true });
    mocks.getProviderById.mockResolvedValue({ id: 7, isActive: false });
    const caller = bookingRouter.createCaller(customerContext);

    await expect(caller.create({
      serviceId: 11,
      bookingDate: "2030-01-01",
      startTime: "10:00",
      endTime: "11:00",
      locationType: "fixed_location",
    })).rejects.toMatchObject({ code: "NOT_FOUND", message: "Service is not currently available" });
  });

  it("rejects quote requests to inactive providers before creating a quote", async () => {
    mocks.getProviderById.mockResolvedValue({ id: 7, isActive: false });
    const caller = providerRouter.createCaller(customerContext);

    await expect(caller.requestQuote({
      providerId: 7,
      title: "Need help with a project",
      description: "Please provide a detailed quote for this project and timeline.",
    })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects waitlist enrollment for an inactive provider before booking reads", async () => {
    mocks.getServiceById.mockResolvedValue({ id: 11, providerId: 7, isActive: true, isGroupClass: true });
    mocks.getProviderById.mockResolvedValue({ id: 7, isActive: false });
    const caller = waitlistRouter.createCaller(customerContext);

    await expect(caller.join({
      serviceId: 11,
      providerId: 7,
      bookingDate: "2030-01-01",
      startTime: "10:00",
      endTime: "11:00",
    })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("applies the same inactive-provider rule to the public agent API", () => {
    const source = readFileSync(new URL("./publicApiRouter.ts", import.meta.url), "utf8");
    expect(source).toContain("if (!provider || !provider.isActive)");
  });

  it("blocks authenticated procedures for suspended identities", () => {
    const source = readFileSync(new URL("./_core/trpc.ts", import.meta.url), "utf8");
    expect(source).toContain("if (ctx.user.deletedAt)");
  });
});
