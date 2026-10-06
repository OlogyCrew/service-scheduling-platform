// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const mocks = vi.hoisted(() => ({
  user: { id: 1, name: "Example User" } as { id: number; name: string } | null,
  authenticated: true,
  mutation: vi.fn(),
  providerInput: null as unknown,
  customerInput: null as unknown,
}));

const entries = [
  { id: "charge-1", type: "invoice", status: "paid", description: "Subscription invoice", date: "2026-10-01T12:00:00Z", amount: 1200, invoicePdfUrl: "https://example.org/invoice.pdf" },
  { id: "charge-2", type: "payment", status: "action_required", description: "Payment needs attention", date: "2026-10-02T12:00:00Z", amount: 1500, invoicePdfUrl: null },
];
const entitlement = { state: "active", accessEndsAt: null, requiresBillingAction: false };
const preferences = {
  emailEnabled: true, smsEnabled: false, bookingEmail: true, reminderEmail: true,
  messageEmail: true, paymentEmail: true, marketingEmail: false,
  relationshipMessageEnabled: false, bookingSms: false, reminderSms: false,
  messageSms: false, paymentSms: false,
};

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ user: mocks.user, isAuthenticated: mocks.authenticated, loading: false }),
}));
vi.mock("@/components/shared/NavHeader", () => ({
  NavHeader: () => React.createElement("header", null, "Shared header"),
}));
vi.mock("@/components/PushNotificationSettings", () => ({
  PushNotificationSettings: () => React.createElement("div", { "data-testid": "push-notifications" }, "Push controls"),
}));
vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: any) => React.createElement("a", { href, ...props }, children),
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ notification: { getPreferences: { invalidate: vi.fn() } } }),
    subscription: {
      billingHistory: { useQuery: (input: unknown) => { mocks.providerInput = input; return { data: { items: entries, hasMore: true, nextCursor: "next-provider" }, isLoading: false }; } },
      mySubscription: { useQuery: () => ({ data: { currentTier: "premium", entitlement } }) },
    },
    customerSubscription: {
      billingHistory: { useQuery: (input: unknown) => { mocks.customerInput = input; return { data: { items: entries, hasMore: true, nextCursor: "next-customer" }, isLoading: false }; } },
      getSubscription: { useQuery: () => ({ data: { currentTier: "business", entitlement } }) },
    },
    notification: {
      getPreferences: { useQuery: () => ({ data: preferences, isLoading: false }) },
      updatePreferences: { useMutation: () => ({ mutate: mocks.mutation }) },
    },
  },
}));

import BillingHistory from "../client/src/pages/BillingHistory";
import CustomerBillingHistory from "../client/src/pages/CustomerBillingHistory";
import NotificationSettings from "../client/src/pages/NotificationSettings";

afterEach(() => {
  cleanup();
  mocks.user = { id: 1, name: "Example User" };
  mocks.authenticated = true;
  mocks.mutation.mockReset();
  mocks.providerInput = null;
  mocks.customerInput = null;
});

describe("billing and settings visual surfaces", () => {
  it.each([
    ["provider", BillingHistory, "/provider/subscription", "Current Plan: Business"],
    ["customer", CustomerBillingHistory, "/customer/subscription", "Current Plan: Manager"],
  ])("preserves the %s billing records, status and subscription path", (_role, Page, href, plan) => {
    const { container } = render(React.createElement(Page));
    expect(container.firstElementChild).toHaveClass("ology-billing-page");
    expect(screen.getByText((_, node) => node?.tagName === "P" && node.textContent?.includes(plan) === true)).toBeVisible();
    expect(screen.getByText("Subscription invoice")).toBeVisible();
    expect(screen.getByText("Payment needs attention")).toBeVisible();
    expect(screen.getByText("Paid")).toBeVisible();
    expect(screen.getByText("Action required")).toBeVisible();
    expect(screen.getByTitle("Download Invoice PDF")).toHaveAttribute("href", "https://example.org/invoice.pdf");
    expect(screen.getAllByRole("link", { name: /Manage Subscription/ }).every((link) => link.getAttribute("href") === href)).toBe(true);
    expect(screen.getByRole("button", { name: "Load More" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Load More" }));
    expect((_role === "provider" ? mocks.providerInput : mocks.customerInput)).toEqual({ limit: 25, startingAfter: _role === "provider" ? "next-provider" : "next-customer" });
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("shows settings consent options without changing preferences or enabling unavailable SMS", () => {
    const { container } = render(React.createElement(NotificationSettings));
    expect(container.firstElementChild).toHaveClass("ology-settings-page");
    expect(screen.getByRole("heading", { name: "Notification Settings" })).toBeVisible();
    expect(screen.getByTestId("push-notifications")).toBeVisible();
    expect(screen.getByRole("switch", { name: "Allow provider relationship messages" })).toHaveAttribute("data-state", "unchecked");
    expect(screen.getByText("Marketing & Promotions")).toBeVisible();
    expect(screen.getAllByText("Coming Soon")).toHaveLength(2);
    expect(container.querySelectorAll('[data-slot="switch"]:disabled').length).toBeGreaterThan(0);
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("renders the guest settings state without notification controls", () => {
    mocks.user = null;
    mocks.authenticated = false;
    const { container } = render(React.createElement(NotificationSettings));
    expect(container.firstElementChild).toHaveClass("ology-settings-page");
    expect(screen.getByText("Sign in to manage preferences")).toBeVisible();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(mocks.mutation).not.toHaveBeenCalled();
  });
});
