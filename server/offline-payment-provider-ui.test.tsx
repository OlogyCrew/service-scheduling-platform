// @vitest-environment jsdom
// Run only with an isolated Vitest config that includes TSX and has globalSetup: [].
// The product Vitest config has database cleanup hooks; do not use it for this UI-only suite.
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OfflinePaymentRecord } from "../shared/offlinePaymentPresentation";

(globalThis as typeof globalThis & { React: typeof React }).React = React;
// jsdom lacks layout observation; the genuine Radix controls still render/click.
vi.stubGlobal("ResizeObserver", class {
  observe() {}
  unobserve() {}
  disconnect() {}
});

const mocks = vi.hoisted(() => ({
  user: { id: 41, role: "provider" } as { id: number; role: string } | null,
  profile: { id: 7 } as { id: number } | null | undefined,
  profileError: null as Error | null,
  profileLoading: false,
  offline: undefined as unknown,
  offlineError: null as Error | null,
  offlineFetching: false,
  detail: undefined as unknown,
  confirm: vi.fn(),
  waive: vi.fn(),
  read: vi.fn(),
  providerRead: vi.fn(),
  retry: vi.fn(),
  offlineInvalidate: vi.fn(),
  detailInvalidate: vi.fn(),
  outstandingInvalidate: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      booking: { getDetail: { invalidate: mocks.detailInvalidate } },
      offlinePayment: {
        getForBooking: { invalidate: mocks.offlineInvalidate },
        listProviderOutstanding: { invalidate: mocks.outstandingInvalidate },
      },
    }),
    provider: {
      getMyProfile: { useQuery: (input: unknown, options: unknown) => {
        mocks.providerRead(input, options);
        return { data: mocks.profile, error: mocks.profileError, isLoading: mocks.profileLoading };
      } },
      getPublicTipInfo: { useQuery: () => ({ data: null }) },
    },
    offlinePayment: {
      getForBooking: { useQuery: (input: unknown, options: unknown) => {
        mocks.read(input, options);
        return { data: mocks.offline, error: mocks.offlineError, isFetching: mocks.offlineFetching, refetch: mocks.retry };
      } },
      confirmPayment: { useMutation: () => ({ mutateAsync: mocks.confirm, isPending: false }) },
      waivePayment: { useMutation: () => ({ mutateAsync: mocks.waive, isPending: false }) },
    },
    booking: {
      getDetail: { useQuery: () => ({ data: mocks.detail, isLoading: false, error: null }) },
      getSessions: { useQuery: () => ({ data: [] }) },
      updateStatus: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      updateSessionStatus: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      rescheduleSession: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      editDuration: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
    message: { send: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) } },
  },
}));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("@/components/shared/NavHeader", () => ({ NavHeader: () => null }));
vi.mock("wouter", () => ({
  useParams: () => ({ id: "51" }),
  useLocation: () => ["/booking/51", vi.fn()],
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

import { OfflinePaymentPanel } from "../client/src/components/OfflinePaymentPanel";
import BookingDetail from "../client/src/pages/BookingDetail";
import { getOfflinePaymentPresentation } from "../shared/offlinePaymentPresentation";

function ledger(overrides: Partial<OfflinePaymentRecord> = {}): OfflinePaymentRecord {
  return {
    id: 9,
    bookingId: 51,
    paymentMethod: "pay_at_location",
    status: "due",
    originalAmountDue: "125.50",
    amountReceived: "0.00",
    waiverAmount: "0.00",
    offlinePaymentMethod: null,
    paidAt: null,
    confirmedByUserId: null,
    paymentNote: null,
    waiverReason: null,
    waivedByUserId: null,
    waivedAt: null,
    createdAt: new Date("2026-11-01T12:00:00Z"),
    updatedAt: new Date("2026-11-01T12:00:00Z"),
    providerInstructions: "Please bring cash.\nAsk for a receipt.",
    ...overrides,
  };
}

function detail() {
  return {
    booking: {
      id: 51, customerId: 22, providerId: 7, bookingNumber: "BK-OFFLINE-51",
      bookingDate: "2026-11-07", startTime: "09:00:00", endTime: "10:00:00",
      durationMinutes: 60, locationType: "provider_location", bookingType: "single",
      status: "completed", totalAmount: "999.00", platformFee: "9.00",
      createdAt: new Date("2026-11-01T12:00:00Z"), updatedAt: new Date("2026-11-01T12:00:00Z"),
    },
    // Deliberately no userId. Never infer provider authority from customer mismatch.
    provider: { id: 7, businessName: "Test Provider", isOfficial: false },
    service: { name: "Test service" }, customer: { id: 22, name: "Test Customer" },
    payment: { status: "captured", amount: "999.00", paymentMethod: "Stripe" },
    messages: [], review: null,
  };
}

function renderPanel(payment = ledger(), canManage = true) {
  return render(<OfflinePaymentPanel payment={payment} canManage={canManage} />);
}

function definition(label: string) {
  return screen.getByText(label, { selector: "dt" }).nextElementSibling as HTMLElement;
}

function receiptForm(method = "cash", note = "") {
  fireEvent.click(screen.getByRole("button", { name: "Mark as Paid" }));
  fireEvent.change(screen.getByLabelText("Payment method (required)"), { target: { value: method } });
  if (note) fireEvent.change(screen.getByLabelText("Payment note (optional)"), { target: { value: note } });
  fireEvent.click(screen.getByRole("checkbox", { name: "I confirm I actually received the full $125.50 from the customer." }));
  return screen.getByRole("button", { name: "Confirm full payment" });
}

function waiverForm(reason = "  Goodwill adjustment  ") {
  fireEvent.click(screen.getByRole("button", { name: "Waive Payment" }));
  fireEvent.change(screen.getByLabelText("Waiver reason (required)"), { target: { value: reason } });
  fireEvent.click(screen.getByRole("checkbox", { name: "I confirm I intend to waive the full $125.50 and no payment was received for this waiver." }));
  return screen.getByRole("button", { name: "Confirm full waiver" });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: 41, role: "provider" };
  mocks.profile = { id: 7 };
  mocks.profileError = null;
  mocks.profileLoading = false;
  mocks.offline = ledger();
  mocks.offlineError = null;
  mocks.offlineFetching = false;
  mocks.detail = detail();
  mocks.confirm.mockReset().mockResolvedValue(ledger({ status: "paid", amountReceived: "125.50" }));
  mocks.waive.mockReset().mockResolvedValue(ledger({ status: "waived", waiverAmount: "125.50" }));
  mocks.offlineInvalidate.mockReset().mockResolvedValue(undefined);
  mocks.detailInvalidate.mockReset().mockResolvedValue(undefined);
  mocks.outstandingInvalidate.mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("OfflinePaymentPanel ledger presentation", () => {
  it.each(["due", "paid", "waived"] as const)("preserves the original amount and full-only %s balance", (status) => {
    const payment = ledger({ status, amountReceived: status === "paid" ? "125.50" : "0.00", waiverAmount: status === "waived" ? "125.50" : "0.00" });
    renderPanel(payment);
    expect(definition("Original agreed amount")).toHaveTextContent("$125.50");
    expect(definition("Outstanding balance")).toHaveTextContent(status === "due" ? "$125.50" : "$0.00");
    expect(definition("Amount received")).toHaveTextContent(status === "paid" ? "$125.50" : "$0.00");
    expect(definition("Amount waived")).toHaveTextContent(status === "waived" ? "$125.50" : "$0.00");
    expect(getOfflinePaymentPresentation(payment).outstandingBalance).toBe(status === "due" ? "125.50" : "0.00");
    expect(screen.getByText(/Please bring cash\. Ask for a receipt\./)).toBeVisible();
    if (status !== "due") {
      expect(screen.queryByRole("button", { name: "Mark as Paid" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Waive Payment" })).not.toBeInTheDocument();
    }
  });

  it("shows receipt method, actor ID, local timestamp, and payment note", () => {
    const paidAt = new Date("2026-11-07T15:30:00Z");
    renderPanel(ledger({ status: "paid", amountReceived: "125.50", offlinePaymentMethod: "bank_transfer", confirmedByUserId: 41, paidAt, paymentNote: "Received at venue" }));
    expect(definition("Payment method")).toHaveTextContent("Bank transfer");
    expect(definition("Confirmed by user ID")).toHaveTextContent("41");
    expect(definition("Payment received at")).toHaveTextContent(paidAt.toLocaleString());
    expect(definition("Payment note")).toHaveTextContent("Received at venue");
  });

  it("shows waiver actor, timestamp and reason without treating waiver as receipt", () => {
    const waivedAt = new Date("2026-11-07T16:00:00Z");
    renderPanel(ledger({ status: "waived", waiverAmount: "125.50", waivedByUserId: 68, waivedAt, waiverReason: "Provider goodwill" }));
    expect(definition("Waived by user ID")).toHaveTextContent("68");
    expect(definition("Waived at")).toHaveTextContent(waivedAt.toLocaleString());
    expect(definition("Waiver reason")).toHaveTextContent("Provider goodwill");
    expect(definition("Amount received")).toHaveTextContent("$0.00");
  });

  it("has a meaningful fallback when instructions are absent and is read-only without authority", () => {
    renderPanel(ledger({ providerInstructions: null }), false);
    expect(screen.getByText(/Arrange payment directly with your provider/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Mark as Paid" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Waive Payment" })).not.toBeInTheDocument();
  });
});

describe("BookingDetail offline selection and authority", () => {
  it("uses the actual ledger and current-provider ID, not settings or booking totals", () => {
    render(<BookingDetail />);
    expect(screen.getByText("Pay at Location")).toBeVisible();
    expect(screen.getByRole("button", { name: "Mark as Paid" })).toBeEnabled();
    expect(definition("Original agreed amount")).toHaveTextContent("$125.50");
    expect(mocks.read).toHaveBeenCalledWith({ bookingId: 51 }, expect.objectContaining({ enabled: true, retry: false }));
    expect(mocks.providerRead).toHaveBeenCalledWith(undefined, expect.objectContaining({ enabled: true }));
    // No settings query exists in the mock. This read/card must survive disabled settings.
    expect(screen.queryByText("Platform Fee")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download Receipt" })).not.toBeInTheDocument();
  });

  it.each([
    { name: "customer", user: { id: 22, role: "customer" }, profile: { id: 7 }, error: null },
    { name: "unrelated provider", user: { id: 41, role: "provider" }, profile: { id: 99 }, error: null },
    { name: "non-provider user", user: { id: 41, role: "customer" }, profile: null, error: null },
    { name: "failed ownership query", user: { id: 41, role: "provider" }, profile: { id: 7 }, error: new Error("Access denied") },
    { name: "admin on their own customer booking", user: { id: 22, role: "admin" }, profile: { id: 7 }, error: null },
  ])("keeps $name read-only", ({ user, profile, error }) => {
    mocks.user = user;
    mocks.profile = profile;
    mocks.profileError = error;
    render(<BookingDetail />);
    expect(screen.getByText("Pay at Location")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Mark as Paid" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Waive Payment" })).not.toBeInTheDocument();
  });

  it("does not expose provider actions while ownership is unresolved", () => {
    mocks.profile = undefined;
    mocks.profileLoading = true;
    render(<BookingDetail />);
    expect(screen.queryByRole("button", { name: "Mark as Paid" })).not.toBeInTheDocument();
  });

  it("permits an admin on another customer's booking without inventing provider ownership", () => {
    mocks.user = { id: 68, role: "admin" };
    mocks.profile = null;
    render(<BookingDetail />);
    expect(screen.getByRole("button", { name: "Mark as Paid" })).toBeEnabled();
    expect(mocks.providerRead).toHaveBeenCalledWith(undefined, expect.objectContaining({ enabled: false }));
  });

  it("shows only a loading payment state until the ledger read succeeds", () => {
    mocks.offline = undefined;
    render(<BookingDetail />);
    expect(screen.getByText("Loading payment information…")).toBeVisible();
    expect(screen.queryByText("Platform Fee")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download Receipt" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark as Paid" })).not.toBeInTheDocument();
  });

  it.each([undefined, null, ledger()])("fails closed on offline-read errors even with cached data (%s)", (cached) => {
    mocks.offline = cached;
    mocks.offlineError = new Error("Ledger unavailable");
    render(<BookingDetail />);
    expect(screen.getByRole("alert")).toHaveTextContent("Unable to verify this booking's payment record");
    expect(screen.queryByText("Platform Fee")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download Receipt" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark as Paid" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry payment information" }));
    expect(mocks.retry).toHaveBeenCalledTimes(1);
  });

  it("retains the existing online card and receipt behavior only after a successful null read", () => {
    mocks.offline = null;
    render(<BookingDetail />);
    expect(screen.getByText("Payment Information")).toBeVisible();
    expect(screen.getByText("Platform Fee")).toBeVisible();
    expect(screen.getByText("Stripe")).toBeVisible();
    expect(screen.getByRole("button", { name: "Download Receipt" })).toBeEnabled();
    expect(screen.queryByText("Pay at Location")).not.toBeInTheDocument();
  });
});

describe("Full offline receipt and waiver forms", () => {
  it("requires actual receipt acknowledgement and an explicit method with a read-only full amount", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Mark as Paid" }));
    expect(screen.getByRole("dialog", { name: "Record full offline payment" })).toBeVisible();
    expect(screen.getByLabelText("Full amount received (USD)")).toHaveValue("125.50");
    expect(screen.getByLabelText("Full amount received (USD)")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Payment note (optional)")).toHaveAttribute("maxlength", "1000");
    const submit = screen.getByRole("button", { name: "Confirm full payment" });
    expect(submit).toBeDisabled();
    fireEvent.submit(submit.closest("form")!);
    expect(screen.getByRole("alert")).toHaveTextContent("actually received the full amount");
    fireEvent.click(screen.getByRole("checkbox"));
    expect(submit).toBeDisabled();
    fireEvent.submit(submit.closest("form")!);
    expect(screen.getByRole("alert")).toHaveTextContent("Select the method");
    expect(mocks.confirm).not.toHaveBeenCalled();
  });

  it.each(["cash", "bank_transfer", "mobile_money", "other"])("submits the unchanged full amount and %s only after confirmation", async (method) => {
    renderPanel();
    fireEvent.click(receiptForm(method, "  Actual receipt reference  "));
    await screen.findByText("Full payment recorded.");
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
    expect(mocks.confirm).toHaveBeenCalledWith({ bookingId: 51, amountReceived: "125.50", offlinePaymentMethod: method, paymentNote: "Actual receipt reference" });
    expect(mocks.waive).not.toHaveBeenCalled();
    expect(mocks.offlineInvalidate).toHaveBeenCalledWith({ bookingId: 51 });
    expect(mocks.detailInvalidate).toHaveBeenCalledWith({ id: 51 });
    expect(mocks.outstandingInvalidate).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // No fabricated paid ledger: still displays read props until getForBooking refreshes.
    expect(definition("Outstanding balance")).toHaveTextContent("$125.50");
    expect(screen.queryByText("Paid", { selector: '[data-slot="badge"]' })).not.toBeInTheDocument();
  });

  it("sends a null optional note rather than invented receipt metadata", async () => {
    renderPanel();
    fireEvent.click(receiptForm());
    await screen.findByText("Full payment recorded.");
    expect(mocks.confirm.mock.calls[0][0].paymentNote).toBeNull();
  });

  it("requires a non-blank trimmed waiver reason and explicit full-waiver acknowledgement", async () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Waive Payment" }));
    expect(screen.getByRole("dialog", { name: "Waive full offline payment" })).toBeVisible();
    expect(screen.getByLabelText("Full waiver amount (USD)")).toHaveValue("125.50");
    expect(screen.getByLabelText("Full waiver amount (USD)")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Waiver reason (required)")).toHaveAttribute("maxlength", "2000");
    const submit = screen.getByRole("button", { name: "Confirm full waiver" });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Waiver reason (required)"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("checkbox"));
    expect(submit).toBeDisabled();
    fireEvent.submit(submit.closest("form")!);
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a waiver reason");
    expect(mocks.waive).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Waiver reason (required)"), { target: { value: "  Provider goodwill  " } });
    fireEvent.click(submit);
    await screen.findByText("Full payment waived.");
    expect(mocks.waive).toHaveBeenCalledTimes(1);
    expect(mocks.waive).toHaveBeenCalledWith({ bookingId: 51, waiverAmount: "125.50", waiverReason: "Provider goodwill" });
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(mocks.offlineInvalidate).toHaveBeenCalledWith({ bookingId: 51 });
    expect(mocks.detailInvalidate).toHaveBeenCalledWith({ id: 51 });
    expect(mocks.outstandingInvalidate).toHaveBeenCalledTimes(1);
  });

  it.each(["paid", "waived"] as const)("prevents dismissal/duplicates and stays non-optimistic while %s is pending", async (action) => {
    const waiting = deferred<OfflinePaymentRecord>();
    const mutation = action === "paid" ? mocks.confirm : mocks.waive;
    mutation.mockReturnValue(waiting.promise);
    renderPanel();
    const submit = action === "paid" ? receiptForm() : waiverForm();
    const form = submit.closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(mutation).toHaveBeenCalledTimes(1);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(within(dialog).queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("checkbox")).toBeDisabled();
    if (action === "paid") expect(screen.getByLabelText("Payment method (required)")).toBeDisabled();
    else expect(screen.getByLabelText("Waiver reason (required)")).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
    const overlay = document.querySelector('[data-slot="dialog-overlay"]')!;
    fireEvent.pointerDown(overlay);
    fireEvent.click(overlay);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(definition("Outstanding balance")).toHaveTextContent("$125.50");
    expect(mocks.offlineInvalidate).not.toHaveBeenCalled();
    expect(mocks.detailInvalidate).not.toHaveBeenCalled();
    expect(mocks.outstandingInvalidate).not.toHaveBeenCalled();
    await act(async () => { waiting.resolve(ledger({ status: action })); });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.offlineInvalidate).toHaveBeenCalledTimes(1);
  });

  it.each(["paid", "waived"] as const)("keeps %s errors inline without closing, claiming success or invalidating", async (action) => {
    (action === "paid" ? mocks.confirm : mocks.waive).mockRejectedValue(new Error("Already settled by another actor"));
    renderPanel();
    fireEvent.click(action === "paid" ? receiptForm() : waiverForm());
    expect(await screen.findByRole("alert")).toHaveTextContent("Already settled by another actor");
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
    expect(screen.queryByText("Full payment recorded.")).not.toBeInTheDocument();
    expect(screen.queryByText("Full payment waived.")).not.toBeInTheDocument();
    expect(definition("Outstanding balance")).toHaveTextContent("$125.50");
    expect(mocks.offlineInvalidate).not.toHaveBeenCalled();
    expect(mocks.detailInvalidate).not.toHaveBeenCalled();
    expect(mocks.outstandingInvalidate).not.toHaveBeenCalled();
  });

  it.each(["paid", "waived"] as const)("bounds and sanitizes internal %s errors while preserving retry controls", async (action) => {
    (action === "paid" ? mocks.confirm : mocks.waive).mockRejectedValue(new Error("Failed query: insert into audit_log params: " + "private-details".repeat(100)));
    renderPanel();
    fireEvent.click(action === "paid" ? receiptForm() : waiverForm());
    const error = await screen.findByRole("alert");
    expect(error).toHaveTextContent("The payment was not saved.");
    expect(error).not.toHaveTextContent("Failed query");
    expect(error).not.toHaveTextContent("private-details");
    expect(error).toHaveClass("break-words");
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("overflow-y-auto");
    expect(screen.getByRole("button", { name: action === "paid" ? "Confirm full payment" : "Confirm full waiver" })).toBeEnabled();
    expect(mocks.offlineInvalidate).not.toHaveBeenCalled();
  });

  it("does not pretend success when a resolved server response does not confirm settlement", async () => {
    mocks.confirm.mockResolvedValue(null);
    renderPanel();
    fireEvent.click(receiptForm());
    expect(await screen.findByRole("alert")).toHaveTextContent("did not confirm settlement");
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.queryByText("Full payment recorded.")).not.toBeInTheDocument();
  });

  it.each(["paid", "waived"] as const)("rejects over-limit %s audit text before calling the backend", async (action) => {
    renderPanel();
    const submit = action === "paid" ? receiptForm() : waiverForm();
    const field = screen.getByLabelText(action === "paid" ? "Payment note (optional)" : "Waiver reason (required)");
    // Programmatic tampering bypasses native maxLength; submission still validates the contract.
    fireEvent.change(field, { target: { value: "x".repeat(action === "paid" ? 1001 : 2001) } });
    fireEvent.submit(submit.closest("form")!);
    expect(screen.getByRole("alert")).toHaveTextContent(action === "paid" ? "1,000 characters" : "1 to 2,000 characters");
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(mocks.waive).not.toHaveBeenCalled();
  });

  it("distinguishes a successful settlement from a refresh failure and prevents re-submitting stale due data", async () => {
    mocks.offlineInvalidate.mockRejectedValue(new Error("Refetch failed"));
    renderPanel();
    fireEvent.click(receiptForm());
    expect(await screen.findByRole("status")).toHaveTextContent("Full payment recorded. The booking could not be refreshed; reload to view the latest ledger.");
    expect(screen.getByRole("button", { name: "Mark as Paid" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Waive Payment" })).toBeDisabled();
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
  });

  it("allows cancellation before submission and does not invoke either mutation", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Mark as Paid" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(mocks.waive).not.toHaveBeenCalled();
  });
});
