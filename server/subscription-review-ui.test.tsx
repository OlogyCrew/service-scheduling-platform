// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  tier: "business", status: "active", cancelAtPeriodEnd: false,
  trial: { isTrialing: false, trialExpired: false, hasUsedTrial: true, daysRemaining: 2, trialEndsAt: "2026-11-23T12:00:00Z", currentTier: "free", showUrgentNudge: true },
  checkout: vi.fn(), portal: vi.fn(), pause: vi.fn(), resume: vi.fn(), downgrade: vi.fn(), startTrial: vi.fn(), navigate: vi.fn(),
}));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: true, user: { id: 88001, name: "Synthetic review user" } }) }));
vi.mock("@/components/shared/NavHeader", () => ({ NavHeader: () => <header>Shared header</header> }));
vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a>,
  useLocation: () => ["/customer/subscription", mocks.navigate],
}));
vi.mock("@/lib/trpc", () => ({ trpc: {
  useUtils: () => ({ subscription: { mySubscription: { invalidate: vi.fn() }, checkTrialStatus: { invalidate: vi.fn() } }, customerSubscription: { getSubscription: { invalidate: vi.fn() }, checkTrialStatus: { invalidate: vi.fn() } } }),
  customerSubscription: {
    billingHistory: { useQuery: () => ({ data: { items: [], hasMore: false }, isLoading: false }) },
    getSubscription: { useQuery: () => ({ isLoading: false, data: {
      currentTier: mocks.tier, currentInterval: "month", entitlement: {}, usage: null,
      subscription: mocks.tier === "free" ? null : { status: mocks.status, cancelAtPeriodEnd: mocks.cancelAtPeriodEnd },
    } }) },
    checkTrialStatus: { useQuery: () => ({ data: mocks.trial }) },
    createCheckout: { useMutation: () => ({ mutate: mocks.checkout, isPending: false }) },
    createPortalSession: { useMutation: () => ({ mutate: mocks.portal, isPending: false }) },
    pause: { useMutation: () => ({ mutate: mocks.pause, isPending: false }) },
    resume: { useMutation: () => ({ mutate: mocks.resume, isPending: false }) },
    downgrade: { useMutation: () => ({ mutate: mocks.downgrade, isPending: false }) },
    startTrial: { useMutation: () => ({ mutate: mocks.startTrial, isPending: false }) },
  },
  subscription: {
    billingHistory: { useQuery: () => ({ data: { items: [], hasMore: false }, isLoading: false }) },
    mySubscription: { useQuery: () => ({ data: { currentTier: "basic", entitlement: {} }, isLoading: false }) },
    checkTrialStatus: { useQuery: () => ({ data: mocks.trial }) },
    downgrade: { useMutation: () => ({ mutate: mocks.downgrade, isPending: false }) },
  },
} }));

import AccountSubscription from "../client/src/pages/AccountSubscription";
import BillingHistory from "../client/src/pages/BillingHistory";
import CustomerBillingHistory from "../client/src/pages/CustomerBillingHistory";
import { TrialCountdownBanner, TrialExpiredBanner, TrialExpiredGate, TrialStatusBanner } from "../client/src/components/TrialBanner";
import { CustomerTrialCountdownBanner, CustomerTrialExpiredGate, CustomerTrialStatusBanner } from "../client/src/components/CustomerTrialBanner";

beforeEach(() => {
  mocks.tier = "business"; mocks.status = "active"; mocks.cancelAtPeriodEnd = false;
  mocks.trial.isTrialing = false; mocks.trial.trialExpired = false; mocks.trial.hasUsedTrial = true;
});
afterEach(() => {
  for (const fn of [mocks.checkout, mocks.portal, mocks.pause, mocks.resume, mocks.downgrade, mocks.startTrial]) expect(fn).not.toHaveBeenCalled();
  cleanup(); vi.clearAllMocks();
});

function clickDisabledBillingControls() {
  const controls = screen.getAllByRole("button").filter(button => /Downgrade|Switch to|Select |Unavailable during review|Pause Plan|Manage Billing|Resume Plan|Keep Current Plan/.test(button.textContent || ""));
  expect(controls.length).toBeGreaterThan(0);
  for (const button of controls) { expect(button).toBeDisabled(); fireEvent.click(button); }
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
}

describe("customer billing controls during Stripe review", () => {
  it("blocks active paid plan billing, pause, downgrade and annual checkout", () => {
    render(<AccountSubscription />);
    expect(screen.getByText(/renewal is not verified during review/)).toBeVisible();
    clickDisabledBillingControls();
    fireEvent.click(screen.getByRole("button", { name: /Annual/ }));
    expect(screen.getByRole("button", { name: "Switch to Annual" })).toBeDisabled();
    clickDisabledBillingControls();
  });
  it("blocks resuming a paused plan", () => {
    mocks.status = "paused"; render(<AccountSubscription />);
    expect(screen.getByRole("button", { name: "Resume Plan" })).toBeDisabled(); clickDisabledBillingControls();
  });
  it("blocks re-enabling a cancelling plan", () => {
    mocks.cancelAtPeriodEnd = true; render(<AccountSubscription />);
    expect(screen.getByRole("button", { name: "Keep Current Plan" })).toBeDisabled(); clickDisabledBillingControls();
  });
  it("blocks new trials and upgrades for a new free customer", () => {
    mocks.tier = "free"; mocks.trial.hasUsedTrial = false; render(<AccountSubscription />);
    expect(screen.getByText("New customer trials are paused")).toBeVisible(); clickDisabledBillingControls();
  });
});

describe("billing history is explicit about unavailable Stripe invoices", () => {
  it.each([BillingHistory, CustomerBillingHistory])("does not claim missing invoice history never existed", Component => {
    render(<Component />);
    expect(screen.getByRole("status")).toHaveTextContent("Only locally recorded subscription events are shown");
    expect(screen.getByText("No locally recorded subscription events")).toBeVisible();
    expect(screen.queryByText("No billing history yet")).not.toBeInTheDocument();
  });
});

describe("trial banners do not trap users behind unavailable billing", () => {
  const components = [
    ["provider countdown", () => <TrialCountdownBanner daysRemaining={2} trialEndsAt={mocks.trial.trialEndsAt} showUrgentNudge />],
    ["provider expired banner", () => <TrialExpiredBanner />],
    ["provider expired gate", () => <TrialExpiredGate />],
    ["customer countdown", () => <CustomerTrialCountdownBanner daysRemaining={2} trialEndsAt={mocks.trial.trialEndsAt} showUrgentNudge />],
    ["customer expired gate", () => <CustomerTrialExpiredGate />],
  ] as const;
  it.each(components)("shows only an informational notice for %s", (_name, component) => {
    const { container } = render(component());
    expect(screen.getByRole("status")).toBeVisible();
    expect(screen.getByRole("link", { name: "View subscription record" })).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(container.querySelector(".fixed.inset-0")).toBeNull();
    expect(screen.queryByText(/Subscribe Now|Subscribe to Continue|Upgrade to Keep Features/)).not.toBeInTheDocument();
  });
  it.each([TrialStatusBanner, CustomerTrialStatusBanner])("renders an expired-record notice without forced settlement", Component => {
    mocks.trial.trialExpired = true;
    const { container } = render(<Component />);
    expect(screen.getByText("Your recorded trial has ended")).toBeVisible();
    expect(container.querySelector(".fixed.inset-0")).toBeNull();
  });
});
