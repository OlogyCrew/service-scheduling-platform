import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { prefetchForPath } from "../client/src/ssr/prefetch";

describe("SSR route metadata classification", () => {
  it.each([
    "/login",
    "/signup",
    "/forgot-password",
    "/verify-email",
    "/select-role",
    "/account",
    "/notifications",
    "/my-bookings",
    "/admin",
    "/provider/dashboard",
  ])("does not classify %s as a missing provider profile", async (path) => {
    const caller = {
      category: { getBySlug: vi.fn(), getById: vi.fn() },
      service: { getById: vi.fn(), listByCategory: vi.fn() },
      provider: { getBySlug: vi.fn(), getById: vi.fn(), listByCategory: vi.fn() },
      promotion: { getActiveForDisplay: vi.fn() },
    };

    const head = await prefetchForPath(path, new QueryClient(), caller as never);

    expect(head.canonicalPath).toBe(path);
    expect(head.notFound).not.toBe(true);
    expect(caller.provider.getBySlug).not.toHaveBeenCalled();
  });
});
