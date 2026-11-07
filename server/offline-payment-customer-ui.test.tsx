// @vitest-environment jsdom
// Run with an isolated Vitest config that includes this .test.tsx file and no DB global setup.
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatPrice } from "../shared/formatPrice";

type OfflinePayment = {
  id: number;
  bookingId: number;
  status: "due" | "paid" | "waived";
  originalAmountDue: string;
  amountReceived: string;
  waiverAmount: string;
  offlinePaymentMethod: string | null;
  paidAt: Date | null;
  confirmedByUserId: number | null;
  paymentNote: string | null;
  waivedAt: Date | null;
  waivedByUserId: number | null;
  waiverReason: string | null;
  providerInstructions: string | null;
};
type OfflineQuery = {
  data: OfflinePayment | null | undefined;
  isSuccess: boolean;
  isPending: boolean;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
};

const mocks = vi.hoisted(() => ({
  booking: {} as Record<string, unknown>,
  service: {} as Record<string, unknown>,
  provider: {} as Record<string, unknown>,
  user: { id: 7 } as { id: number } | null,
  offline: {} as OfflineQuery,
  previewData: { applicableCredit: "25.00", coversFullAmount: false },
  checkoutPending: false,
  checkout: vi.fn(),
  cancel: vi.fn(),
  refetch: vi.fn(),
  navigate: vi.fn(),
  previewQuery: vi.fn(),
  offlineQuery: vi.fn(),
  paymentMethodsRender: vi.fn(),
  confirmPaymentHook: vi.fn(),
  waivePaymentHook: vi.fn(),
  confirmPayment: vi.fn(),
  waivePayment: vi.fn(),
}));

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("@/components/shared/NavHeader", () => ({
  NavHeader: () => React.createElement("header", null, "Navigation"),
}));
vi.mock("@/components/PaymentMethods", () => ({
  PaymentMethods: () => {
    mocks.paymentMethodsRender();
    return React.createElement("div", { "data-testid": "online-payment-methods" }, "Online card payment methods");
  },
}));
vi.mock("wouter", () => ({
  useParams: () => ({ id: "41" }),
  useLocation: () => ["/booking/41/confirmation", mocks.navigate],
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => React.createElement("a", { href }, children),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    booking: {
      getById: { useQuery: () => ({ data: mocks.booking, isLoading: false }) },
      cancel: { useMutation: () => ({ mutate: mocks.cancel, isPending: false }) },
    },
    service: { getById: { useQuery: () => ({ data: mocks.service }) } },
    provider: { getById: { useQuery: () => ({ data: mocks.provider }) } },
    referral: {
      getCreditBalance: { useQuery: () => ({ data: { balance: "75.00" } }) },
      getMyCode: { useQuery: () => ({ data: null }) },
    },
    stripe: {
      previewCreditDiscount: {
        useQuery: (input: unknown, options: unknown) => {
          mocks.previewQuery(input, options);
          // Deliberately return cached data even when disabled: it must not leak into offline UI.
          return { data: mocks.previewData };
        },
      },
      createCheckoutSession: {
        useMutation: () => ({ mutate: mocks.checkout, isPending: mocks.checkoutPending }),
      },
    },
    offlinePayment: {
      getForBooking: {
        useQuery: (input: unknown, options: unknown) => {
          mocks.offlineQuery(input, options);
          return { ...mocks.offline, refetch: mocks.refetch };
        },
      },
      confirmPayment: {
        useMutation: () => {
          mocks.confirmPaymentHook();
          return { mutate: mocks.confirmPayment };
        },
      },
      waivePayment: {
        useMutation: () => {
          mocks.waivePaymentHook();
          return { mutate: mocks.waivePayment };
        },
      },
    },
  },
}));

(globalThis as typeof globalThis & { React: typeof React }).React = React;
import BookingConfirmation from "../client/src/pages/BookingConfirmation";

function ledger(status: OfflinePayment["status"] = "due"): OfflinePayment {
  return {
    id: 11,
    bookingId: 41,
    status,
    originalAmountDue: "125.00",
    amountReceived: status === "paid" ? "99.00" : "0.00",
    waiverAmount: status === "waived" ? "67.00" : "0.00",
    offlinePaymentMethod: status === "paid" ? "bank_transfer" : null,
    paidAt: status === "paid" ? new Date("2026-11-06T14:15:00Z") : null,
    confirmedByUserId: status === "paid" ? 22 : null,
    paymentNote: status === "paid" ? "Recorded receipt for this booking" : null,
    waivedAt: status === "waived" ? new Date("2026-11-06T16:20:00Z") : null,
    waivedByUserId: status === "waived" ? 33 : null,
    waiverReason: status === "waived" ? "Approved service recovery" : null,
    providerInstructions: "Pay cash at reception after your appointment.",
  };
}

function resolved(data: OfflinePayment | null): OfflineQuery {
  return {
    data,
    isSuccess: true,
    isPending: false,
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
  };
}

function expectNoOnlinePayment() {
  expect(screen.queryByTestId("online-payment-methods")).not.toBeInTheDocument();
  expect(mocks.paymentMethodsRender).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: /Pay Now|Pay Deposit|Pay with Credits/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  expect(screen.queryByText("Apply Referral Credits")).not.toBeInTheDocument();
  expect(screen.queryByText("Credits Available")).not.toBeInTheDocument();
  expect(screen.queryByText("Deposit Required")).not.toBeInTheDocument();
  expect(screen.queryByText("Deposit Due")).not.toBeInTheDocument();
  expect(screen.queryByText("Payment Information")).not.toBeInTheDocument();
  expect(screen.queryByText(/Please complete payment to secure your spot/)).not.toBeInTheDocument();
  expect(mocks.previewQuery).toHaveBeenCalled();
  expect(mocks.previewQuery.mock.calls.every(([, options]) => options.enabled === false)).toBe(true);
  expect(mocks.checkout).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: 7 };
  mocks.checkoutPending = false;
  mocks.previewData = { applicableCredit: "25.00", coversFullAmount: false };
  mocks.booking = {
    id: 41,
    customerId: 7,
    serviceId: 9,
    providerId: 3,
    bookingNumber: "OC-0041",
    status: "confirmed",
    paidAt: null,
    depositPaidAt: null,
    bookingDate: "2026-11-10",
    startTime: "10:00",
    endTime: "11:00",
    totalAmount: "200.00", // Different from the ledger's historical agreement.
    durationMinutes: 60,
    locationType: "fixed_location",
  };
  mocks.service = {
    id: 9,
    name: "Test Service",
    pricingModel: "fixed",
    basePrice: "210.00",
    depositRequired: false,
    depositType: "fixed",
    depositAmount: "40.00",
  };
  mocks.provider = {
    id: 3,
    businessName: "Test Provider",
    canAcceptPlatformPayments: true,
    isOfficial: false,
  };
  mocks.offline = resolved(ledger());
});

afterEach(() => {
  cleanup();
  expect(mocks.confirmPaymentHook).not.toHaveBeenCalled();
  expect(mocks.waivePaymentHook).not.toHaveBeenCalled();
  expect(mocks.confirmPayment).not.toHaveBeenCalled();
  expect(mocks.waivePayment).not.toHaveBeenCalled();
  expect(mocks.cancel).not.toHaveBeenCalled();
});

describe("customer offline payment confirmation (mocked UI; no backend or DB)", () => {
  it("shows confirmed Due with original agreement, full outstanding balance and location instructions only", () => {
    mocks.service.depositRequired = true;
    render(React.createElement(BookingConfirmation));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Booking Confirmed — Pay at Location");
    expect(screen.getByText(/Original agreed amount:/)).toHaveTextContent(formatPrice(125));
    expect(screen.getByText(/Outstanding balance:/)).toHaveTextContent(formatPrice(125));
    expect(screen.getByText(/Payment status:/)).toHaveTextContent("due");
    expect(screen.getByText(/Provider instructions:/)).toHaveTextContent(ledger().providerInstructions!);
    expect(screen.queryByText(/Payment Required/)).not.toBeInTheDocument();
    expectNoOnlinePayment();
    expect(mocks.offlineQuery).toHaveBeenCalledWith({ bookingId: 41 }, { enabled: true, retry: false });
  });

  it("shows Paid without booking.paidAt and retains the actual receipt amount, method, date and actor", () => {
    mocks.offline = resolved(ledger("paid"));
    mocks.service.depositRequired = true;
    render(React.createElement(BookingConfirmation));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Booking Confirmed — Paid at Location");
    expect(screen.getByText("Offline Payment Receipt")).toBeVisible();
    expect(screen.getByText(/Original agreed amount:/)).toHaveTextContent(formatPrice(125));
    expect(screen.getByText(/Outstanding balance:/)).toHaveTextContent(formatPrice(0));
    expect(screen.getByText(/Amount received:/)).toHaveTextContent(formatPrice(99));
    expect(screen.getByText(/Payment method:/)).toHaveTextContent("bank transfer");
    expect(screen.getByText(/Payment recorded:/)).toHaveTextContent(ledger("paid").paidAt!.toLocaleString());
    expect(screen.getByText(/Recorded by user:/)).toHaveTextContent("22");
    expect(screen.getByText(/Payment note:/)).toHaveTextContent("Recorded receipt for this booking");
    expect(screen.queryByText(/Provider instructions:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Payment Required/)).not.toBeInTheDocument();
    expectNoOnlinePayment();
  });

  it("shows Waived without booking.paidAt and retains the actual waiver value, reason, date and actor", () => {
    mocks.offline = resolved(ledger("waived"));
    render(React.createElement(BookingConfirmation));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Booking Confirmed — Payment Waived");
    expect(screen.getByText("Payment Waiver")).toBeVisible();
    expect(screen.getByText(/Original agreed amount:/)).toHaveTextContent(formatPrice(125));
    expect(screen.getByText(/Outstanding balance:/)).toHaveTextContent(formatPrice(0));
    expect(screen.getByText(/Amount waived:/)).toHaveTextContent(formatPrice(67));
    expect(screen.getByText(/Waiver reason:/)).toHaveTextContent("Approved service recovery");
    expect(screen.getByText(/Payment waived:/)).toHaveTextContent(ledger("waived").waivedAt!.toLocaleString());
    expect(screen.getByText(/Waived by user:/)).toHaveTextContent("33");
    expect(screen.queryByText(/Provider instructions:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Payment Required/)).not.toBeInTheDocument();
    expectNoOnlinePayment();
  });

  it.each(["due", "paid", "waived"] as const)("keeps cancelled lifecycle separate from %s payment history", (status) => {
    mocks.booking.status = "cancelled";
    mocks.booking.paidAt = new Date("2026-11-05T12:00:00Z");
    mocks.offline = resolved(ledger(status));
    render(React.createElement(BookingConfirmation));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/^Booking Cancelled$/);
    expect(screen.queryByRole("heading", { name: /Booking Confirmed/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Provider instructions:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Show up at the scheduled time/)).not.toBeInTheDocument();
    expect(screen.getByText(/Payment status:/)).toHaveTextContent(status);
    expect(screen.getByText(/Outstanding balance:/)).toHaveTextContent(formatPrice(status === "due" ? 125 : 0));
    expectNoOnlinePayment();
  });

  it.each([
    ["completed", "Booking Completed"],
    ["in_progress", "Booking In Progress"],
    ["pending", "Booking Request Submitted!"],
  ])("preserves %s lifecycle independently of offline settlement", (status, heading) => {
    mocks.booking.status = status;
    mocks.offline = resolved(ledger("paid"));
    render(React.createElement(BookingConfirmation));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(heading);
    expect(screen.queryByRole("heading", { name: /Booking Confirmed/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Amount received:/)).toHaveTextContent(formatPrice(99));
    expectNoOnlinePayment();
  });

  it.each([false, true])("uses the existing offline ledger regardless of provider online capability (%s)", (canAcceptPlatformPayments) => {
    mocks.provider.canAcceptPlatformPayments = canAcceptPlatformPayments;
    render(React.createElement(BookingConfirmation));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Booking Confirmed — Pay at Location");
    expect(screen.queryByText("Payment Arranged with Provider")).not.toBeInTheDocument();
    expectNoOnlinePayment();
  });
});

describe("customer payment-status authority and fail-closed handling", () => {
  it.each([
    ["initial pending", { data: undefined, isSuccess: false, isPending: true, isLoading: true, isFetching: true }],
    ["disabled or paused pending", { data: undefined, isSuccess: false, isPending: true, isLoading: false, isFetching: false }],
    ["unexpected undefined success", { data: undefined, isSuccess: true }],
    ["refreshing cached null", { data: null, isSuccess: true, isFetching: true }],
    ["refreshing cached offline instructions", { data: ledger(), isSuccess: true, isFetching: true }],
  ] as const)("fails closed for %s", (_name, state) => {
    mocks.offline = { ...resolved(null), ...state };
    mocks.service.depositRequired = true;
    render(React.createElement(BookingConfirmation));
    expect(screen.getByRole("status")).toHaveTextContent("Checking Payment Status");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/^Booking Confirmed$/);
    expect(screen.queryByText(/Provider instructions:/)).not.toBeInTheDocument();
    expect(screen.queryByText("Pay at Location")).not.toBeInTheDocument();
    expect(screen.queryByText("Payment Arranged with Provider")).not.toBeInTheDocument();
    expectNoOnlinePayment();
    fireEvent.click(screen.getByRole("button", { name: "View My Bookings" }));
    expect(mocks.navigate).toHaveBeenCalledWith("/my-bookings");
    expect(mocks.checkout).not.toHaveBeenCalled();
  });

  it.each([undefined, null, ledger()] as const)("hides payment instructions and checkout on status error, including stale data (%s)", (data) => {
    mocks.offline = { ...resolved(null), data, isSuccess: false, isError: true, error: new Error("Status lookup failed") };
    mocks.service.depositRequired = true;
    render(React.createElement(BookingConfirmation));
    expect(screen.getByRole("alert")).toHaveTextContent("Payment Status Unavailable");
    expect(screen.queryByText(/Provider instructions:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Original agreed amount:/)).not.toBeInTheDocument();
    expectNoOnlinePayment();
    fireEvent.click(screen.getByRole("button", { name: "Retry Payment Status" }));
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
    expect(mocks.checkout).not.toHaveBeenCalled();
  });

  it.each([null, ledger("paid")] as const)("re-evaluates after retry using only the successful status response (%s)", (data) => {
    mocks.offline = { ...resolved(null), isSuccess: false, isError: true, error: new Error("Status lookup failed") };
    const view = render(React.createElement(BookingConfirmation));
    expectNoOnlinePayment();
    fireEvent.click(screen.getByRole("button", { name: "Retry Payment Status" }));
    mocks.offline = resolved(data);
    view.rerender(React.createElement(BookingConfirmation));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    if (data === null) {
      expect(mocks.previewQuery).toHaveBeenLastCalledWith({ bookingId: 41 }, { enabled: true });
      fireEvent.click(screen.getByRole("button", { name: /Pay Now/ }));
      expect(mocks.checkout).toHaveBeenCalledWith({ bookingId: 41, useCredits: true });
    } else {
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Booking Confirmed — Paid at Location");
      expectNoOnlinePayment();
    }
  });

  it("removes all online controls when a status refresh starts and resolves offline", () => {
    mocks.offline = resolved(null);
    const view = render(React.createElement(BookingConfirmation));
    expect(screen.getByRole("button", { name: /Pay Now/ })).toBeVisible();
    mocks.offline = { ...resolved(null), isFetching: true };
    view.rerender(React.createElement(BookingConfirmation));
    expect(screen.queryByRole("button", { name: /Pay Now/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId("online-payment-methods")).not.toBeInTheDocument();
    expect(mocks.previewQuery).toHaveBeenLastCalledWith({ bookingId: 41 }, { enabled: false });
    mocks.offline = resolved(ledger());
    view.rerender(React.createElement(BookingConfirmation));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Booking Confirmed — Pay at Location");
    expect(screen.queryByRole("button", { name: /Pay Now|Pay Deposit|Pay with Credits/ })).not.toBeInTheDocument();
    expect(mocks.checkout).not.toHaveBeenCalled();
  });
});

describe("resolved-null legacy online customer payment behavior", () => {
  beforeEach(() => { mocks.offline = resolved(null); });

  it("keeps the legacy confirmed online heading, credit preview, card methods and actual Pay Now dispatch", () => {
    render(React.createElement(BookingConfirmation));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Booking Confirmed — Payment Required");
    expect(screen.getByText("The provider has confirmed your booking. Please complete payment to secure your spot.")).toBeVisible();
    expect(screen.getByTestId("online-payment-methods")).toBeVisible();
    expect(screen.getByText("Apply Referral Credits")).toBeVisible();
    expect(screen.getByText("Service Price").parentElement).toHaveTextContent(formatPrice(200));
    expect(mocks.previewQuery).toHaveBeenLastCalledWith({ bookingId: 41 }, { enabled: true });
    fireEvent.click(screen.getByRole("button", { name: `Pay Now (${formatPrice(175)})` }));
    expect(mocks.checkout).toHaveBeenCalledTimes(1);
    expect(mocks.checkout).toHaveBeenCalledWith({ bookingId: 41, useCredits: true });
  });

  it("preserves the legacy credit toggle and dispatches useCredits false", () => {
    render(React.createElement(BookingConfirmation));
    fireEvent.click(screen.getByRole("switch"));
    expect(mocks.previewQuery).toHaveBeenLastCalledWith({ bookingId: 41 }, { enabled: false });
    fireEvent.click(screen.getByRole("button", { name: `Pay Now (${formatPrice(200)})` }));
    expect(mocks.checkout).toHaveBeenCalledWith({ bookingId: 41, useCredits: false });
  });

  it("keeps legacy Paid detection based on booking.paidAt and removes Pay Now", () => {
    mocks.booking.paidAt = new Date("2026-11-06T14:15:00Z");
    render(React.createElement(BookingConfirmation));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Booking Confirmed & Paid!");
    expect(screen.getByText("Your booking is fully confirmed and paid.")).toBeVisible();
    expect(screen.getByTestId("online-payment-methods")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Pay Now/ })).not.toBeInTheDocument();
    expect(mocks.checkout).not.toHaveBeenCalled();
  });

  it("keeps the pending online request copy and no full-payment button", () => {
    mocks.booking.status = "pending";
    render(React.createElement(BookingConfirmation));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Booking Request Submitted!");
    expect(screen.getByText("Payment will be processed after provider confirms the booking.")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Pay Now/ })).not.toBeInTheDocument();
    expect(mocks.checkout).not.toHaveBeenCalled();
  });

  it("preserves actual online deposit dispatch and depositPaidAt suppression", () => {
    mocks.service.depositRequired = true;
    const view = render(React.createElement(BookingConfirmation));
    expect(screen.getByText("Deposit Required").parentElement).toHaveTextContent(formatPrice(40));
    fireEvent.click(screen.getByRole("button", { name: `Pay Deposit (${formatPrice(15)})` }));
    expect(mocks.checkout).toHaveBeenCalledWith({ bookingId: 41, useCredits: true });
    mocks.booking.depositPaidAt = new Date("2026-11-06T14:15:00Z");
    view.rerender(React.createElement(BookingConfirmation));
    expect(screen.queryByRole("button", { name: /Pay Deposit/ })).not.toBeInTheDocument();
  });

  it("preserves full-credit online payment dispatch", () => {
    mocks.previewData = { applicableCredit: "200.00", coversFullAmount: true };
    render(React.createElement(BookingConfirmation));
    expect(screen.getByText("Your credits fully cover this payment — no card needed!")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Pay with Credits" }));
    expect(mocks.checkout).toHaveBeenCalledWith({ bookingId: 41, useCredits: true });
  });

  it.each([false, true])("keeps the no-online-capability provider card with no card methods or payment actions (deposit %s)", (depositRequired) => {
    mocks.provider.canAcceptPlatformPayments = false;
    mocks.service.depositRequired = depositRequired;
    render(React.createElement(BookingConfirmation));
    expect(screen.getByText("Payment Arranged with Provider")).toBeVisible();
    expect(screen.getByText(/This provider is not currently accepting online payments/)).toHaveTextContent("No charge has been created.");
    expect(screen.queryByTestId("online-payment-methods")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pay Now|Pay Deposit|Pay with Credits/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(mocks.checkout).not.toHaveBeenCalled();
  });

  it.each([null, { id: 88 }] as const)("keeps payment actions unavailable to a non-owner (%s)", (user) => {
    mocks.user = user;
    render(React.createElement(BookingConfirmation));
    expect(screen.queryByRole("button", { name: /Pay Now|Pay Deposit|Pay with Credits/ })).not.toBeInTheDocument();
    expect(mocks.checkout).not.toHaveBeenCalled();
  });

  it("keeps processing checkout disabled without a second dispatch", () => {
    mocks.checkoutPending = true;
    render(React.createElement(BookingConfirmation));
    const processing = screen.getByRole("button", { name: /Processing/ });
    expect(processing).toBeDisabled();
    fireEvent.click(processing);
    expect(mocks.checkout).not.toHaveBeenCalled();
  });
});
