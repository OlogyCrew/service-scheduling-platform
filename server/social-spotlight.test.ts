import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const { requireDb } = vi.hoisted(() => ({ requireDb: vi.fn() }));
vi.mock("./db/connection", () => ({ requireDb }));
import { DJ_SPOTLIGHT, isDjSpotlightAvailable } from "./socialSpotlight";

function query(rows: Array<{ serviceId: number }>) {
  return { select: () => ({ from: () => ({ innerJoin: () => ({ innerJoin: () => ({ innerJoin: () => ({ where: () => ({ limit: async () => rows }) }) }) }) }) }) };
}
beforeEach(() => { vi.resetAllMocks(); });

describe("DJ category spotlight availability gate", () => {
  it("targets the known DJ category, never the unresolved Barber Shop listing", () => {
    expect(DJ_SPOTLIGHT).toEqual({ id: 20, name: "DJ & MUSIC SERVICES", slug: "dj-music-services" });
  });
  it("needs a qualifying active service before returning eligible", async () => {
    requireDb.mockResolvedValueOnce(query([])).mockResolvedValueOnce(query([{ serviceId: 98 }]));
    expect(await isDjSpotlightAvailable()).toBe(false);
    expect(await isDjSpotlightAvailable()).toBe(true);
  });
  it("fails closed on database errors instead of claiming unavailable providers are eligible", async () => {
    requireDb.mockRejectedValueOnce(new Error("Database unavailable"));
    await expect(isDjSpotlightAvailable()).rejects.toThrow("Database unavailable");
  });
  it("requires a real active verified provider, active category and service, and undeleted provider account", () => {
    const source = readFileSync(resolve(import.meta.dirname, "socialSpotlight.ts"), "utf8");
    for (const clause of [
      'eq(services.isActive, true)', 'isNull(services.deletedAt)',
      'eq(serviceProviders.isOfficial, false)', 'eq(serviceProviders.verificationStatus, "verified")',
      'eq(serviceProviders.isActive, true)', 'isNull(serviceProviders.deletedAt)',
      'eq(users.role, "provider")', 'isNull(users.deletedAt)',
      'eq(serviceCategories.isActive, true)',
    ]) expect(source).toContain(clause);
  });
});
