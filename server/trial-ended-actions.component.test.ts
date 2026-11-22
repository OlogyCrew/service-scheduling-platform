// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as typeof globalThis & { React: typeof React }).React = React;
const { createElement } = React;

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  customerMutate: vi.fn(),
  providerMutate: vi.fn(),
  customerGetSubscriptionInvalidate: vi.fn().mockResolvedValue(undefined),
  customerTrialStatusInvalidate: vi.fn().mockResolvedValue(undefined),
  providerSubscriptionInvalidate: vi.fn().mockResolvedValue(undefined),
  providerTrialStatusInvalidate: vi.fn().mockResolvedValue(undefined),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  customerOptions: null as any,
  providerOptions: null as any,
  customerPending: false,
  providerPending: false,
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/", mocks.navigate],
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode } & Record<string, unknown>) =>
    createElement("a", { href, ...props }, children),
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      customerSubscription: {
        getSubscription: { invalidate: mocks.customerGetSubscriptionInvalidate },
        checkTrialStatus: { invalidate: mocks.customerTrialStatusInvalidate },
      },
      subscription: {
        mySubscription: { invalidate: mocks.providerSubscriptionInvalidate },
        checkTrialStatus: { invalidate: mocks.providerTrialStatusInvalidate },
      },
    }),
    customerSubscription: {
      downgrade: {
        useMutation: (options: any) => {
          mocks.customerOptions = options;
          return { mutate: mocks.customerMutate, isPending: mocks.customerPending };
        },
      },
    },
    subscription: {
      downgrade: {
        useMutation: (options: any) => {
          mocks.providerOptions = options;
          return { mutate: mocks.providerMutate, isPending: mocks.providerPending };
        },
      },
    },
  },
}));

import { CustomerTrialExpiredGate } from "../client/src/components/CustomerTrialBanner";
import { TrialExpiredGate } from "../client/src/components/TrialBanner";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.customerPending = false;
  mocks.providerPending = false;
  mocks.customerOptions = null;
  mocks.providerOptions = null;
});

afterEach(cleanup);

describe("trial-ended customer actions", () => {
  it("shows the paused-trials notice and a read-only subscription-record link", () => {
    render(createElement(CustomerTrialExpiredGate));

    expect(screen.getByRole("status")).toHaveTextContent("Your recorded trial has ended");
    expect(screen.getByRole("link", { name: "View subscription record" })).toHaveAttribute("href", "/customer/subscription");
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.customerMutate).not.toHaveBeenCalled();
  });

  it("does not offer customer self-downgrade while trials are paused", () => {
    const onDowngrade = vi.fn();
    render(createElement(CustomerTrialExpiredGate, { onDowngrade }));

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(mocks.customerMutate).not.toHaveBeenCalled();
    expect(onDowngrade).not.toHaveBeenCalled();
  });

  it("preserves customer subscription state without mutation or lifecycle refresh", () => {
    render(createElement(CustomerTrialExpiredGate));

    expect(mocks.customerGetSubscriptionInvalidate).not.toHaveBeenCalled();
    expect(mocks.customerTrialStatusInvalidate).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });
});

describe("trial-ended provider actions", () => {
  it("shows the paused-trials notice and a read-only subscription-record link", () => {
    render(createElement(TrialExpiredGate));

    expect(screen.getByRole("status")).toHaveTextContent("Your recorded trial has ended");
    expect(screen.getByRole("link", { name: "View subscription record" })).toHaveAttribute("href", "/provider/subscription");
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.providerMutate).not.toHaveBeenCalled();
  });

  it("does not offer provider self-downgrade while trials are paused", () => {
    const onDowngrade = vi.fn();
    render(createElement(TrialExpiredGate, { onDowngrade }));

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(mocks.providerMutate).not.toHaveBeenCalled();
    expect(onDowngrade).not.toHaveBeenCalled();
  });

  it("preserves provider subscription state without mutation or lifecycle refresh", () => {
    render(createElement(TrialExpiredGate));

    expect(mocks.providerSubscriptionInvalidate).not.toHaveBeenCalled();
    expect(mocks.providerTrialStatusInvalidate).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });
});
