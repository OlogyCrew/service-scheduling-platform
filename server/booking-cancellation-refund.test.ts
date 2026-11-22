import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getBookingById: vi.fn(),
  getProviderByUserId: vi.fn(),
  getServiceById: vi.fn(),
  getPaymentByBookingId: vi.fn(),
  cancelBooking: vi.fn(),
  getUserById: vi.fn(),
  getProviderById: vi.fn(),
  createNotification: vi.fn(),
  updatePaymentRefund: vi.fn(),
  sendNotification: vi.fn(),
  sendPushNotification: vi.fn(),
  stripeRefundCreate: vi.fn(),
}));

vi.mock("stripe", () => ({
  default: class MockStripe {
    refunds = { create: mocks.stripeRefundCreate };
  },
}));

vi.mock("./db", () => ({
  getBookingById: mocks.getBookingById,
  getProviderByUserId: mocks.getProviderByUserId,
  getServiceById: mocks.getServiceById,
  getPaymentByBookingId: mocks.getPaymentByBookingId,
  cancelBooking: mocks.cancelBooking,
  getUserById: mocks.getUserById,
  getProviderById: mocks.getProviderById,
  createNotification: mocks.createNotification,
  updatePaymentRefund: mocks.updatePaymentRefund,
}));
vi.mock("./notifications", () => ({ sendNotification: mocks.sendNotification }));
vi.mock("./notifications/pushHelper", () => ({ sendPushNotification: mocks.sendPushNotification }));

import { bookingRouter } from "./routers/bookingRouter";

function context(id: number, role: "customer" | "provider" | "admin"): TrpcContext {
  return {
    user: {
      id,
      openId: `test-clean-lifecycle-cancel-${role}-${id}`,
      email: `test-clean-lifecycle-cancel-${role}-${id}@example.invalid`,
      name: `Test Clean Lifecycle ${role}`,
      role,
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
}

const booking = {
  id: 77,
  bookingNumber: "TEST-CLEAN-CANCEL-77",
  customerId: 10,
  providerId: 20,
  serviceId: 30,
  bookingDate: "2035-01-15",
  startTime: "10:00:00",
  status: "confirmed",
  totalAmount: "100.00",
};

describe("clean booking cancellation refund lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getBookingById.mockResolvedValue(booking);
    mocks.getProviderByUserId.mockResolvedValue(null);
    mocks.getServiceById.mockResolvedValue({ id: 30, name: "Test Service", isGroupClass: false });
    mocks.getPaymentByBookingId.mockResolvedValue(null);
    mocks.cancelBooking.mockResolvedValue(undefined);
    mocks.getUserById.mockImplementation(async (id: number) => id === 10
      ? { id: 10, email: "customer@example.invalid", name: "Customer" }
      : { id: 40, email: "provider@example.invalid", name: "Provider" });
    mocks.getProviderById.mockResolvedValue({ id: 20, userId: 40, businessName: "Provider" });
    mocks.createNotification.mockResolvedValue({ id: 1 });
    mocks.updatePaymentRefund.mockResolvedValue(undefined);
    mocks.stripeRefundCreate.mockResolvedValue({ id: "re_test_123" });
    mocks.sendNotification.mockResolvedValue({ success: true });
    mocks.sendPushNotification.mockResolvedValue(true);
  });

  it("returns a zero refund for unpaid or free bookings regardless of the booking total", async () => {
    const result = await bookingRouter.createCaller(context(10, "customer")).cancel({ bookingId: 77, reason: "Plans changed" });
    expect(result.refundPercentage).toBe(100);
    expect(result.refundAmount).toBe("0.00");
    expect(mocks.cancelBooking).toHaveBeenCalledWith(77, expect.objectContaining({ cancelledBy: "customer" }));
  });

  it("calculates a customer refund from a captured deposit rather than the full unpaid booking total", async () => {
    mocks.getPaymentByBookingId.mockResolvedValue({ id: 88, status: "captured", amount: "25.00", refundAmount: "0.00", stripePaymentIntentId: null });
    const result = await bookingRouter.createCaller(context(10, "customer")).cancel({ bookingId: 77, reason: "Plans changed" });
    expect(result.refundPercentage).toBe(100);
    expect(result.refundAmount).toBe("25.00");
  });

  it("refunds only the remaining captured amount when a provider cancels", async () => {
    mocks.getProviderByUserId.mockResolvedValue({ id: 20, userId: 40 });
    mocks.getPaymentByBookingId.mockResolvedValue({ id: 88, status: "captured", amount: "25.00", refundAmount: "5.00", stripePaymentIntentId: null });
    const result = await bookingRouter.createCaller(context(40, "provider")).cancel({ bookingId: 77, reason: "Provider unavailable" });
    expect(result.refundPercentage).toBe(100);
    expect(result.refundAmount).toBe("20.00");
    expect(mocks.cancelBooking).toHaveBeenCalledWith(77, expect.objectContaining({ cancelledBy: "provider" }));
  });

  it("rejects non-participants before refund or cancellation side effects", async () => {
    await expect(bookingRouter.createCaller(context(99, "customer")).cancel({ bookingId: 77, reason: "Not mine" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.getPaymentByBookingId).not.toHaveBeenCalled();
    expect(mocks.cancelBooking).not.toHaveBeenCalled();
  });

  it("rejects a provider who is not associated with the booking before reading payment state", async () => {
    mocks.getProviderByUserId.mockResolvedValue({ id: 999, userId: 40 });

    await expect(bookingRouter.createCaller(context(40, "provider")).cancel({ bookingId: 77, reason: "Not mine" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.getPaymentByBookingId).not.toHaveBeenCalled();
    expect(mocks.stripeRefundCreate).not.toHaveBeenCalled();
    expect(mocks.cancelBooking).not.toHaveBeenCalled();
  });

  it("uses a stable idempotency key for repeated linked-payment refund attempts", async () => {
    mocks.getPaymentByBookingId.mockResolvedValue({
      id: 88,
      status: "captured",
      amount: "25.00",
      refundAmount: "0.00",
      stripePaymentIntentId: "pi_refund_123",
    });

    await bookingRouter.createCaller(context(10, "customer")).cancel({ bookingId: 77, reason: "Plans changed" });
    await bookingRouter.createCaller(context(10, "customer")).cancel({ bookingId: 77, reason: "Plans changed again" });

    expect(mocks.stripeRefundCreate).toHaveBeenCalledTimes(2);
    const firstOptions = mocks.stripeRefundCreate.mock.calls[0]?.[1];
    const secondOptions = mocks.stripeRefundCreate.mock.calls[1]?.[1];
    expect(firstOptions).toEqual({ idempotencyKey: "ologycrew-refund-booking-77-payment-88-2500" });
    expect(secondOptions).toEqual(firstOptions);
    expect(mocks.updatePaymentRefund).toHaveBeenCalledTimes(2);
  });

  it("does not call Stripe for an offline or uncaptured payment", async () => {
    mocks.getPaymentByBookingId.mockResolvedValue({
      id: 89,
      status: "pending",
      amount: "100.00",
      refundAmount: "0.00",
      stripePaymentIntentId: null,
      offlinePaymentMethod: "cash",
    });

    await bookingRouter.createCaller(context(10, "customer")).cancel({ bookingId: 77, reason: "Plans changed" });

    expect(mocks.stripeRefundCreate).not.toHaveBeenCalled();
    expect(mocks.updatePaymentRefund).not.toHaveBeenCalled();
    expect(mocks.cancelBooking).toHaveBeenCalled();
  });
});
