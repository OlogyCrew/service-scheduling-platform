import { describe, it, expect, beforeAll, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

vi.setConfig({ testTimeout: 15_000, hookTimeout: 30_000 });

vi.mock("./notifications", async importOriginal => {
  const original = await importOriginal<Record<string, unknown>>();
  return { ...original, sendNotification: vi.fn().mockResolvedValue({ success: true }) };
});

// ─── Context Helpers ──────────────────────────────────────────────────────────
function makeCtx(user: TrpcContext["user"]): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: { origin: "http://localhost:3000" } } as any,
    res: {
      clearCookie: () => {},
      cookie: () => {},
    } as unknown as TrpcContext["res"],
  };
}
function guestCtx(): TrpcContext {
  return makeCtx(null);
}

// ─── Test State ───────────────────────────────────────────────────────────────
const TEST_PREFIX = `sc-${Date.now()}`;
let providerUserId1: number;
let providerUserId2: number;
let providerUserId3: number;
let providerUserId4: number;
let providerUserId5: number;
let providerUserId6: number;
let providerUserId7: number;
let providerUserId8: number;
let customerUserId: number;

// ─── Setup ────────────────────────────────────────────────────────────────────
beforeAll(async () => {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Create test users directly in DB
  const providerNames = ["SlugGen", "SlugUpdate", "InvalidSlug", "ShortSlug", "PubProfile", "SvcProfile", "PubSvc", "NoStripe"];
  for (let i = 0; i < providerNames.length; i++) {
    await db.insert(users).values({
      openId: `${TEST_PREFIX}-prov-${i}`,
      name: `${providerNames[i]} Provider`,
      email: `${TEST_PREFIX}-prov-${i}@test.com`,
      role: "provider",
      loginMethod: "test",
      emailVerified: true,
      lastSignedIn: new Date(),
    });
  }
  await db.insert(users).values({
    openId: `${TEST_PREFIX}-cust`,
    name: "Test Customer",
    email: `${TEST_PREFIX}-cust@test.com`,
    role: "customer",
    loginMethod: "test",
    emailVerified: true,
    lastSignedIn: new Date(),
  });

  const fetchId = async (openId: string) => {
    const [u] = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
    return u!.id;
  };

  providerUserId1 = await fetchId(`${TEST_PREFIX}-prov-0`);
  providerUserId2 = await fetchId(`${TEST_PREFIX}-prov-1`);
  providerUserId3 = await fetchId(`${TEST_PREFIX}-prov-2`);
  providerUserId4 = await fetchId(`${TEST_PREFIX}-prov-3`);
  providerUserId5 = await fetchId(`${TEST_PREFIX}-prov-4`);
  providerUserId6 = await fetchId(`${TEST_PREFIX}-prov-5`);
  providerUserId7 = await fetchId(`${TEST_PREFIX}-prov-6`);
  providerUserId8 = await fetchId(`${TEST_PREFIX}-prov-7`);
  customerUserId = await fetchId(`${TEST_PREFIX}-cust`);
});

function provCtx(userId: number, name: string): TrpcContext {
  return makeCtx({
    id: userId,
    openId: `${TEST_PREFIX}-prov`,
    name,
    email: `${name.toLowerCase()}@test.com`,
    role: "provider",
    emailVerified: true,
    avatarUrl: null,
    isSuspended: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function custCtx(): TrpcContext {
  return makeCtx({
    id: customerUserId,
    openId: `${TEST_PREFIX}-cust`,
    name: "Test Customer",
    email: `${TEST_PREFIX}-cust@test.com`,
    role: "customer",
    avatarUrl: null,
    isSuspended: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("Stripe Connect & Public Profile", () => {
  describe("Provider Slug Management", () => {
    it("should generate a slug for a provider", async () => {
      const ctx = provCtx(providerUserId1, "SlugGen Provider");
      const caller = appRouter.createCaller(ctx);

      await caller.provider.create({
        businessName: "Test Barber Shop SC",
        businessType: "sole_proprietor",
        addressLine1: "123 Main St",
        city: "Atlanta",
        state: "GA",
        postalCode: "30301",
      });

      const result = await caller.provider.generateSlug();
      expect(result.slug).toBeDefined();
      expect(result.slug).toContain("test-barber-shop");
    });

    it("should update a provider slug (requires Basic+ tier)", async () => {
      const ctx = provCtx(providerUserId2, "SlugUpdate Provider");
      const caller = appRouter.createCaller(ctx);

      const provider = await caller.provider.create({
        businessName: "Slug Update Shop SC",
        businessType: "sole_proprietor",
        addressLine1: "456 Oak Ave",
        city: "Dallas",
        state: "TX",
        postalCode: "75201",
      });

      await caller.provider.generateSlug();

      // Give provider a basic subscription so slug update is allowed
      const { upsertProviderSubscription } = await import("./db");
      await upsertProviderSubscription({
        providerId: provider.id,
        tier: "basic",
        status: "active",
      });

      const customSlug = `custom-barber-sc-${Date.now()}`;
      const result = await caller.provider.updateSlug({ slug: customSlug });
      expect(result.slug).toBe(customSlug);
    });

    it("should reject invalid slug formats", async () => {
      const ctx = provCtx(providerUserId3, "InvalidSlug Provider");
      const caller = appRouter.createCaller(ctx);

      await caller.provider.create({
        businessName: "Invalid Slug Shop SC",
        businessType: "sole_proprietor",
        addressLine1: "789 Pine St",
        city: "Miami",
        state: "FL",
        postalCode: "33101",
      });

      await expect(
        caller.provider.updateSlug({ slug: "INVALID SLUG!" })
      ).rejects.toThrow();
    });

    it("should reject slug shorter than 3 characters", async () => {
      const ctx = provCtx(providerUserId4, "ShortSlug Provider");
      const caller = appRouter.createCaller(ctx);

      await caller.provider.create({
        businessName: "Short Slug Shop SC",
        businessType: "sole_proprietor",
        addressLine1: "101 Elm St",
        city: "Denver",
        state: "CO",
        postalCode: "80201",
      });

      await expect(
        caller.provider.updateSlug({ slug: "ab" })
      ).rejects.toThrow();
    });
  });

  describe("Public Profile Access", () => {
    it("should fetch a provider by slug (public, no auth)", async () => {
      const ctx = provCtx(providerUserId5, "PubProfile Provider");
      const caller = appRouter.createCaller(ctx);

      await caller.provider.create({
        businessName: "Public Profile Barber SC",
        businessType: "sole_proprietor",
        addressLine1: "222 Maple Dr",
        city: "Seattle",
        state: "WA",
        postalCode: "98101",
      });

      const { slug } = await caller.provider.generateSlug();

      const publicCaller = appRouter.createCaller(guestCtx());
      const profile = await publicCaller.provider.getBySlug({ slug });
      expect(profile.provider).toBeDefined();
      expect(profile.provider.businessName).toBe("Public Profile Barber SC");
      expect(profile.services).toBeDefined();
      expect(profile.reviews).toBeDefined();
    });

    it("should return 404 for non-existent slug", async () => {
      const publicCaller = appRouter.createCaller(guestCtx());

      await expect(
        publicCaller.provider.getBySlug({ slug: "non-existent-slug-xyz-999" })
      ).rejects.toThrow("Provider not found");
    });

    it("should include services in public profile", async () => {
      const ctx = provCtx(providerUserId6, "SvcProfile Provider");
      const caller = appRouter.createCaller(ctx);

      await caller.provider.create({
        businessName: "Services Profile Shop SC",
        businessType: "sole_proprietor",
        addressLine1: "333 Cedar Ln",
        city: "Portland",
        state: "OR",
        postalCode: "97201",
      });

      await caller.service.create({
        categoryId: 7,
        name: "Premium Haircut SC",
        description: "A premium haircut service",
        serviceType: "fixed_location",
        pricingModel: "fixed",
        basePrice: 45,
        durationMinutes: 45,
      });

      const { slug } = await caller.provider.generateSlug();

      const publicCaller = appRouter.createCaller(guestCtx());
      const profile = await publicCaller.provider.getBySlug({ slug });
      expect(profile.services.length).toBeGreaterThanOrEqual(1);
      expect(profile.services.some((s: any) => s.name === "Premium Haircut SC")).toBe(true);
    });
  });

  describe("Public Services by Provider ID", () => {
    it("should list active services for a provider (no auth)", async () => {
      const ctx = provCtx(providerUserId7, "PubSvc Provider");
      const caller = appRouter.createCaller(ctx);

      const provider = await caller.provider.create({
        businessName: "Public Services Shop SC",
        businessType: "sole_proprietor",
        addressLine1: "444 Birch St",
        city: "Austin",
        state: "TX",
        postalCode: "73301",
      });

      await caller.service.create({
        categoryId: 7,
        name: "Basic Cut SC",
        serviceType: "fixed_location",
        pricingModel: "fixed",
        basePrice: 25,
        durationMinutes: 30,
      });

      const publicCaller = appRouter.createCaller(guestCtx());
      const services = await publicCaller.provider.getPublicServices({ providerId: provider.id });
      expect(services.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Stripe Connect Router", () => {
    it("should return not_connected status when no Stripe account", async () => {
      const ctx = provCtx(providerUserId8, "NoStripe Provider");
      const caller = appRouter.createCaller(ctx);

      await caller.provider.create({
        businessName: "No Stripe Shop SC",
        businessType: "sole_proprietor",
        addressLine1: "555 Walnut Ave",
        city: "Nashville",
        state: "TN",
        postalCode: "37201",
      });

      const status = await caller.stripeConnect.getStatus();
      expect(status.connected).toBe(false);
      expect(status.status).toBe("not_connected");
      expect(status.chargesEnabled).toBe(false);
      expect(status.payoutsEnabled).toBe(false);
    });

    it("should return zero balance when no Stripe account", async () => {
      // Reuse providerUserId8 which already has a provider profile
      const ctx = provCtx(providerUserId8, "NoStripe Provider");
      const caller = appRouter.createCaller(ctx);

      const balance = await caller.stripeConnect.getBalance();
      expect(balance.available).toBe(0);
      expect(balance.pending).toBe(0);
    });

    it("should require provider profile for getStatus", async () => {
      const caller = appRouter.createCaller(custCtx());
      await expect(caller.stripeConnect.getStatus()).rejects.toThrow("Provider profile not found");
    });

    it("should require Stripe account for getDashboardLink", async () => {
      // Reuse providerUserId8 which has no Stripe account
      const ctx = provCtx(providerUserId8, "NoStripe Provider");
      const caller = appRouter.createCaller(ctx);

      await expect(caller.stripeConnect.getDashboardLink()).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    });
  });
});
