// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const mocks = vi.hoisted(() => ({
  authenticated: true,
  currentTier: "premium" as "premium" | "free",
  trialing: false,
  urgent: false,
  checkout: vi.fn(),
  downgrade: vi.fn(),
  portal: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  trial: vi.fn(),
}));

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: mocks.authenticated }) }));
vi.mock("@/components/shared/NavHeader", () => ({ NavHeader: () => React.createElement("header", null, "Shared header") }));
vi.mock("wouter", () => ({ Link: ({ href, children, ...props }: any) => React.createElement("a", { href, ...props }, children) }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    provider: { getMyProfile: { useQuery: () => ({ data: undefined }) } },
    subscription: {
      mySubscription: { useQuery: () => ({ data: {
        currentTier: mocks.currentTier,
        currentInterval: "month",
        subscription: mocks.currentTier === "premium" ? { status: "active", cancelAtPeriodEnd: false } : null,
        entitlement: {},
        usage: mocks.currentTier === "premium" ? { servicesUsed: 4, servicesLimit: 999 } : null,
      }, isLoading: false }) },
      checkTrialStatus: { useQuery: () => ({ data: { isTrialing: mocks.trialing, daysRemaining: 2, showUrgentNudge: mocks.urgent, trialExpired: false, hasUsedTrial: mocks.currentTier === "premium" } }) },
      createCheckout: { useMutation: () => ({ mutate: mocks.checkout, isPending: false }) },
      downgrade: { useMutation: () => ({ mutate: mocks.downgrade, isPending: false }) },
      createPortalSession: { useMutation: () => ({ mutate: mocks.portal, isPending: false }) },
      pause: { useMutation: () => ({ mutate: mocks.pause, isPending: false }) },
      resume: { useMutation: () => ({ mutate: mocks.resume, isPending: false }) },
      startProfessionalTrial: { useMutation: () => ({ mutate: mocks.trial, isPending: false }) },
    },
  },
}));

import SubscriptionManagement from "../client/src/pages/SubscriptionManagement";

afterEach(() => {
  cleanup();
  mocks.authenticated = true;
  mocks.currentTier = "premium";
  mocks.trialing = false;
  mocks.urgent = false;
  for (const fn of [mocks.checkout, mocks.downgrade, mocks.portal, mocks.pause, mocks.resume, mocks.trial]) fn.mockReset();
});

describe("provider My Subscription visual states", () => {
  it("renders all real plans and safely changes monthly/annual presentation without creating a checkout", () => {
    const { container } = render(React.createElement(SubscriptionManagement));
    expect(screen.getByRole("heading", { name: "My Provider Plan Subscription" })).toBeVisible();
    const monthly = screen.getByRole("button", { name: "Monthly" });
    const annual = screen.getByRole("button", { name: /Annual billing — save up to 20%/ });
    expect(monthly).toHaveAttribute("aria-pressed", "true");
    expect(annual).toHaveAttribute("aria-pressed", "false");
    expect(container.querySelectorAll(".ology-provider-plan-card")).toHaveLength(3);
    const business = container.querySelector('[data-provider-plan="premium"]') as HTMLElement;
    const pro = container.querySelector('[data-provider-plan="basic"]') as HTMLElement;
    expect(business).toHaveAttribute("data-current-plan", "true");
    expect(within(pro).getByRole("button", { name: "Downgrade" })).toBeDisabled();
    expect(within(business).getByRole("button", { name: "Current Plan" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Billing History" })).toHaveAttribute("href", "/provider/billing");
    expect(container.querySelector("a button, button a")).toBeNull();

    fireEvent.click(annual);
    expect(monthly).toHaveAttribute("aria-pressed", "false");
    expect(annual).toHaveAttribute("aria-pressed", "true");
    expect(business).toHaveAttribute("data-current-plan", "false");
    const annualSwitch = within(business).getByRole("button", { name: "Switch to Annual" });
    expect(annualSwitch).toBeDisabled();
    fireEvent.click(annualSwitch);
    expect(screen.getAllByText(/Billed as/)).toHaveLength(2);
    expect(mocks.checkout).not.toHaveBeenCalled();
    expect(mocks.downgrade).not.toHaveBeenCalled();
  });

  it("retains urgent trial warnings and a guest page without activating plan controls", () => {
    mocks.currentTier = "free";
    mocks.trialing = true;
    mocks.urgent = true;
    const { container, unmount } = render(React.createElement(SubscriptionManagement));
    expect(container.querySelector(".ology-provider-plan-trial--urgent")).not.toBeNull();
    expect(screen.getByText(/Pro Trial — 2 days remaining/)).toBeVisible();
    expect(mocks.trial).not.toHaveBeenCalled();
    unmount();
    mocks.authenticated = false;
    render(React.createElement(SubscriptionManagement));
    expect(screen.getByText("Sign in to manage your subscription")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Monthly" })).not.toBeInTheDocument();
  });

  it("keeps pause, billing, and downgrade controls disabled during Stripe review", () => {
    const { container } = render(React.createElement(SubscriptionManagement));
    const pauseButton = screen.getByRole("button", { name: "Pause Plan" });
    const billingButton = screen.getByRole("button", { name: "Manage Billing" });
    expect(pauseButton).toBeDisabled();
    expect(billingButton).toBeDisabled();
    fireEvent.click(pauseButton);
    expect(screen.queryByRole("dialog", { name: "Pause Your Subscription" })).not.toBeInTheDocument();
    expect(mocks.pause).not.toHaveBeenCalled();
    const pro = container.querySelector('[data-provider-plan="basic"]') as HTMLElement;
    const downgradeButton = within(pro).getByRole("button", { name: "Downgrade" });
    expect(downgradeButton).toBeDisabled();
    fireEvent.click(downgradeButton);
    expect(screen.queryByRole("dialog", { name: "Confirm Downgrade" })).not.toBeInTheDocument();
    expect(mocks.downgrade).not.toHaveBeenCalled();
  });
});
