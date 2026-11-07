import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../server/routers";

/** Presentation only: the existing booking ledger read remains the source of truth. */
export type OfflinePaymentRecord = NonNullable<
  inferRouterOutputs<AppRouter>["offlinePayment"]["getForBooking"]
>;
export type OfflinePaymentMethod = NonNullable<OfflinePaymentRecord["offlinePaymentMethod"]>;

export const OFFLINE_PAYMENT_METHOD_LABELS: Record<OfflinePaymentMethod, string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  mobile_money: "Mobile money",
  other: "Other",
};

export function getOfflinePaymentPresentation(payment: OfflinePaymentRecord) {
  return {
    statusLabel: { due: "Due", paid: "Paid", waived: "Waived" }[payment.status],
    originalAmount: payment.originalAmountDue,
    // The existing ledger supports full receipt or full waiver only, not partial settlement.
    outstandingBalance: payment.status === "due" ? payment.originalAmountDue : "0.00",
    amountReceived: payment.amountReceived,
    amountWaived: payment.waiverAmount,
    methodLabel: payment.offlinePaymentMethod
      ? OFFLINE_PAYMENT_METHOD_LABELS[payment.offlinePaymentMethod]
      : "Not recorded",
    isDue: payment.status === "due",
  };
}

export function formatOfflinePaymentAmount(value: string): string {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)
    : "Unavailable";
}

export function formatOfflinePaymentTimestamp(value: Date | string | null): string {
  if (!value) return "Not recorded";
  const date = new Date(value instanceof Date ? value.getTime() : value);
  return Number.isNaN(date.getTime()) ? "Unavailable" : date.toLocaleString();
}
