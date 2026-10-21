import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getAllBookings: vi.fn(),
}));

vi.mock("./db", () => ({
  getAllBookings: mocks.getAllBookings,
}));

const { adminRouter } = await import("./adminRouter");

const booking = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  bookingNumber: `BK-${id}`,
  serviceName: `Service ${id}`,
  customerName: `Customer ${id}`,
  providerName: `Provider ${id}`,
  bookingDate: "2026-10-22",
  status: "pending",
  ...overrides,
});

function context(role: "admin" | "provider" = "admin") {
  return {
    user: {
      id: 1,
      email: role === "admin" ? "garychisolm30@gmail.com" : "customer@example.com",
      role,
      adminRole: role === "admin" ? "super_admin" : null,
      deletedAt: null,
      emailVerified: true,
    },
    req: {},
    res: {},
  } as TrpcContext;
}

describe("admin.searchBookingsFiltered pagination", () => {
  beforeEach(() => {
    mocks.getAllBookings.mockReset();
    mocks.getAllBookings.mockResolvedValue(Array.from({ length: 30 }, (_, index) => booking(index + 1)));
  });

  it("denies non-admin callers before booking data is read", async () => {
    await expect(
      adminRouter.createCaller(context("provider")).searchBookingsFiltered({ page: 1, limit: 25 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.getAllBookings).not.toHaveBeenCalled();
  });

  it("rejects invalid bounded integer pagination before booking data is read", async () => {
    const caller = adminRouter.createCaller(context());
    await expect(caller.searchBookingsFiltered({ page: 0, limit: 25 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.searchBookingsFiltered({ page: 1.5, limit: 25 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.searchBookingsFiltered({ page: 1, limit: 101 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.getAllBookings).not.toHaveBeenCalled();
  });

  it("uses the authoritative getAllBookings scope, searches every legacy and enriched field, then pages the result", async () => {
    mocks.getAllBookings.mockResolvedValue([
      booking(1, { bookingNumber: "OC-ALPHA", serviceName: "Massage", status: "confirmed", bookingDate: "2026-10-22", customerName: "Jamie Customer", providerName: "Studio Provider" }),
      booking(2, { bookingNumber: "OC-BETA", serviceName: "Yoga", status: "pending", bookingDate: "2026-09-10", customerName: "Other", providerName: "Other" }),
      booking(3, { bookingNumber: "OC-GAMMA", serviceName: "Photography", status: "completed", bookingDate: "2026-08-02", customerName: "Taylor", providerName: "Creative House" }),
    ]);
    const caller = adminRouter.createCaller(context());

    await expect(caller.searchBookingsFiltered({ query: "alpha", page: 1, limit: 25 })).resolves.toMatchObject({ total: 1, bookings: [{ id: 1 }] });
    await expect(caller.searchBookingsFiltered({ query: "confirmed", page: 1, limit: 25 })).resolves.toMatchObject({ total: 1, bookings: [{ id: 1 }] });
    await expect(caller.searchBookingsFiltered({ query: "2026-10", page: 1, limit: 25 })).resolves.toMatchObject({ total: 1, bookings: [{ id: 1 }] });
    await expect(caller.searchBookingsFiltered({ query: "jamie", page: 1, limit: 25 })).resolves.toMatchObject({ total: 1, bookings: [{ id: 1 }] });
    await expect(caller.searchBookingsFiltered({ query: "creative", page: 1, limit: 25 })).resolves.toMatchObject({ total: 1, bookings: [{ id: 3 }] });

    const secondPage = await caller.searchBookingsFiltered({ page: 2, limit: 2 });
    expect(secondPage).toMatchObject({ total: 3, page: 2, limit: 2, totalPages: 2, bookings: [{ id: 3 }] });
    expect(mocks.getAllBookings).toHaveBeenCalledTimes(6);
  });
});
