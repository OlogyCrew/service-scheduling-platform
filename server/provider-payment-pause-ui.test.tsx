// @vitest-environment jsdom
// Run only with vitest.provider-payment-pause.config.ts (no connected DB global setup).
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  booking: {} as Record<string, any>, service: {} as Record<string, any>, provider: {} as Record<string, any>,
  user: { id: 7 } as { id: number } | null,
  offline: {} as Record<string, any>, receipts: [] as any[], search: "",
  preview: vi.fn(), checkout: vi.fn(), invoiceCheckout: vi.fn(), methods: vi.fn(), navigate: vi.fn(),
  toastError: vi.fn(), cancel: vi.fn(), refetch: vi.fn(),
}));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("@/components/shared/NavHeader", () => ({ NavHeader: () => React.createElement("header", null, "Navigation") }));
vi.mock("@/components/PaymentMethods", () => ({ PaymentMethods: () => { mocks.methods(); return React.createElement("div", null, "Active card options"); } }));
vi.mock("wouter", () => ({
  useParams: () => ({ id: "41" }), useLocation: () => ["/booking/41", mocks.navigate], useSearch: () => mocks.search,
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => React.createElement("a", { href }, children),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: mocks.toastError } }));
vi.mock("@/lib/trpc", () => ({ trpc: {
  booking: { getById: { useQuery: () => ({ data: mocks.booking, isLoading: false }) }, cancel: { useMutation: () => ({ mutate: mocks.cancel, isPending: false }) } },
  service: { getById: { useQuery: () => ({ data: mocks.service }) } },
  provider: { getById: { useQuery: () => ({ data: mocks.provider }) } },
  referral: { getCreditBalance: { useQuery: () => ({ data: { balance: "500.00" } }) }, getMyCode: { useQuery: () => ({ data: null }) } },
  stripe: {
    previewCreditDiscount: { useQuery: (input: any, options: any) => { mocks.preview(input, options); return { data: { applicableCredit: "200.00", coversFullAmount: true } }; } },
    createCheckoutSession: { useMutation: () => ({ mutate: mocks.checkout, isPending: false }) },
  },
  offlinePayment: { getForBooking: { useQuery: () => ({ ...mocks.offline, refetch: mocks.refetch }) } },
  invoice: { getMyReceipts: { useQuery: () => ({ data: mocks.receipts, refetch: mocks.refetch }) }, getPaymentLink: { useMutation: () => ({ mutate: mocks.invoiceCheckout, isPending: false }) } },
} }));
(globalThis as any).React = React;
import BookingConfirmation from "../client/src/pages/BookingConfirmation";
import Receipts from "../client/src/pages/Receipts";
import { usePayment } from "../client/src/hooks/usePayment";
import { ProviderPaymentPauseBanner } from "../client/src/components/shared/ProviderPaymentPauseBanner";
import { PROVIDER_PAYMENT_PAUSE_MESSAGE } from "../shared/providerPaymentPause";
import { formatPrice } from "../shared/formatPrice";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: 7 }; mocks.search = "";
  mocks.booking = { id: 41, customerId: 7, providerId: 3, serviceId: 9, bookingNumber: "OC-0041", status: "confirmed", paidAt: null, depositPaidAt: null, totalAmount: "200.00", durationMinutes: 60, bookingDate: "2026-12-10", startTime: "10:00", endTime: "11:00", locationType: "fixed_location" };
  mocks.service = { id: 9, name: "Synthetic Service", pricingModel: "fixed", basePrice: "200.00", depositRequired: false, depositType: "fixed", depositAmount: "40.00" };
  mocks.provider = { id: 3, businessName: "Synthetic Provider", canAcceptPlatformPayments: true, isOfficial: false };
  mocks.offline = { data: null, isSuccess: true, isFetching: false, isError: false, isPending: false, isLoading: false, error: null };
  mocks.receipts = [{ id: 51, type: "invoice", status: "sent", invoiceNumber: "SYNTH-51", total: 12500, createdAt: "2026-11-01", dueDate: "2026-12-01", pdfUrl: "https://example.invalid/invoice.pdf" }];
});
afterEach(() => {
  cleanup();
  expect(mocks.checkout).not.toHaveBeenCalled(); expect(mocks.invoiceCheckout).not.toHaveBeenCalled(); expect(mocks.cancel).not.toHaveBeenCalled();
});
function expectNoActiveCollection() {
  expect(screen.queryByRole("button", { name: /Pay Now|Pay Deposit|Pay with Credits/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  expect(screen.queryByText("Apply Referral Credits")).not.toBeInTheDocument();
  expect(mocks.methods).not.toHaveBeenCalled();
  expect(mocks.preview.mock.calls.every(([, options]) => options.enabled === false)).toBe(true);
}
describe("provider collection pause customer UI", () => {
  it("renders a non-dismissable accessible notice without an offline workaround", () => {
    render(<ProviderPaymentPauseBanner />);
    expect(screen.getByRole("status", { name: "Provider payment collection paused" })).toHaveTextContent(PROVIDER_PAYMENT_PAUSE_MESSAGE);
    expect(screen.getByText(/does not mark unpaid bookings or invoices as paid/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
  it("disables confirmed booking checkout and preserves navigation", () => {
    render(<BookingConfirmation />);
    expect(screen.getByText("Booking Confirmed — Online Payments Paused")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Online Payments Paused" });
    expect(button).toBeDisabled(); fireEvent.click(button);
    fireEvent.click(screen.getByRole("button", { name: "View My Bookings" }));
    expect(mocks.navigate).toHaveBeenCalledWith("/my-bookings");
    expect(screen.queryByText(/Please complete payment to secure/)).not.toBeInTheDocument();
    expectNoActiveCollection();
  });
  it("does not apply a cached full-credit preview to the original amount", () => {
    render(<BookingConfirmation />);
    expect(screen.getAllByText(formatPrice(200)).length).toBeGreaterThan(0);
    expect(screen.queryByText("Total After Credits")).not.toBeInTheDocument();
    expect(screen.queryByText(/credits fully cover this payment/)).not.toBeInTheDocument();
    expectNoActiveCollection();
  });
  it("disables deposit checkout while retaining the agreed deposit", () => {
    mocks.service.depositRequired = true;
    render(<BookingConfirmation />);
    expect(screen.getByRole("button", { name: "Online Payments Paused" })).toBeDisabled();
    expect(screen.getAllByText(formatPrice(40)).length).toBeGreaterThan(0);
    expectNoActiveCollection();
  });
  it("does not promise automatic collection after provider confirmation", () => {
    mocks.booking.status = "pending";
    render(<BookingConfirmation />);
    expect(screen.queryByText("Payment will be processed after provider confirms the booking.")).not.toBeInTheDocument();
    expect(screen.getByText(/no payment has been collected by this pause/)).toBeInTheDocument();
    expectNoActiveCollection();
  });
  it("preserves genuine recorded paid status", () => {
    mocks.booking.paidAt = "2026-11-01T12:00:00Z";
    render(<BookingConfirmation />);
    expect(screen.getByText("Booking Confirmed & Paid!")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Online Payments Paused" })).not.toBeInTheDocument();
    expectNoActiveCollection();
  });
  it.each(["due", "paid", "waived"])("preserves existing offline %s history without online options", (status) => {
    mocks.offline.data = { id: 1, bookingId: 41, status, originalAmountDue: "125.00", amountReceived: status === "paid" ? "125.00" : "0.00", waiverAmount: status === "waived" ? "125.00" : "0.00", offlinePaymentMethod: status === "paid" ? "cash" : null, providerInstructions: null, paidAt: status === "paid" ? new Date("2026-11-01") : null, waivedAt: status === "waived" ? new Date("2026-11-01") : null, waiverReason: status === "waived" ? "Synthetic reason" : null };
    render(<BookingConfirmation />);
    expect(screen.getAllByText(formatPrice(125)).length).toBeGreaterThan(0);
    expectNoActiveCollection();
  });
  it("keeps unavailable payment-status reads fail closed", () => {
    mocks.offline = { data: undefined, isSuccess: false, isFetching: false, isError: true, error: new Error("Synthetic failure") };
    render(<BookingConfirmation />);
    expect(screen.getByText("Payment Status Unavailable")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Online Payments Paused" })).not.toBeInTheDocument();
    expectNoActiveCollection();
  });
  it("blocks checkout in the shared hook even when directly invoked", () => {
    const { result } = renderHook(() => usePayment());
    expect(result.current.isPaused).toBe(true);
    result.current.initiatePayment(41);
    expect(mocks.toastError).toHaveBeenCalledWith(PROVIDER_PAYMENT_PAUSE_MESSAGE);
  });
  it.each(["sent", "viewed", "overdue"])("disables invoice checkout for %s without losing PDF access", (status) => {
    mocks.receipts[0].status = status;
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<Receipts />);
    const button = screen.getByRole("button", { name: "Online Payments Paused" });
    expect(button).toBeDisabled(); fireEvent.click(button);
    expect(screen.getByText("$125.00")).toBeInTheDocument();
    const download = screen.getAllByRole("button").find(el => !!el.querySelector("svg.lucide-download"));
    expect(download).toBeDefined(); fireEvent.click(download!);
    expect(open).toHaveBeenCalledWith("https://example.invalid/invoice.pdf", "_blank"); open.mockRestore();
  });
  it("preserves paid invoice status without offering another payment", () => {
    mocks.receipts[0].status = "paid"; mocks.receipts[0].paidAt = "2026-11-01";
    render(<Receipts />);
    expect(screen.queryByRole("button", { name: "Online Payments Paused" })).not.toBeInTheDocument();
    expect(screen.getByText("$125.00")).toBeInTheDocument();
  });
  it("does not trust an invoice return URL as proof of payment", () => {
    mocks.search = "?paid=51";
    render(<Receipts />);
    expect(screen.getByText("Payment status awaiting confirmation")).toBeInTheDocument();
    expect(screen.queryByText("Payment successful!")).not.toBeInTheDocument();
  });
  it("shows a return payment as confirmed only when the recorded invoice is paid", () => {
    mocks.search = "?paid=51"; mocks.receipts[0].status = "paid";
    render(<Receipts />);
    expect(screen.getByText("Payment confirmed")).toBeInTheDocument();
  });
});
