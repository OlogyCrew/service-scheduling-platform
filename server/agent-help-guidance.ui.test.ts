// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as typeof globalThis & { React: typeof React }).React = React;
const mocks = vi.hoisted(() => ({ submit: vi.fn() }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: false, user: null }) }));
vi.mock("@/components/shared/NavHeader", () => ({ NavHeader: () => React.createElement("header", null, "Shared header") }));
vi.mock("wouter", () => ({ Link: ({ href, children, ...props }: any) => React.createElement("a", { href, ...props }, children) }));
vi.mock("@/lib/trpc", () => ({ trpc: {
  platformSettings: { getAll: { useQuery: () => ({ data: {} }) } },
  contact: { submit: { useMutation: () => ({ mutate: mocks.submit, isPending: false }) } },
} }));
const { default: HelpCenter } = await import("../client/src/pages/HelpCenter");

beforeEach(() => {
  window.history.replaceState(null, "", "/help");
  mocks.submit.mockReset();
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function searchGuides() {
  render(React.createElement(HelpCenter));
  fireEvent.change(screen.getByRole("searchbox", { name: /search help/i }), { target: { value: "AI assistant" } });
}

describe("released agent discovery Help guidance", () => {
  it("lets a guest read review-link safety, expiry and demo instructions through Help search", () => {
    searchGuides();
    fireEvent.click(screen.getByRole("button", { name: /^Booking from an AI Assistant's Review Link/ }));
    expect(screen.getByRole("heading", { name: "Booking from an AI Assistant's Review Link" })).toBeVisible();
    expect(screen.getByText(/Review links expire after 30 minutes/)).toBeVisible();
    expect(screen.getByText(/does not create a booking, send a quote request, reserve a time slot, or charge you/)).toBeVisible();
    expect(screen.getByText(/Do not post your review link publicly/)).toBeVisible();
    expect(screen.getByText(/Demo services are samples/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Find a Service Manually" })).toHaveAttribute("href", "/browse");
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it("lets a guest read accurate provider visibility guidance without promising AI referrals", () => {
    searchGuides();
    fireEvent.click(screen.getByRole("button", { name: /^How AI Assistants Find Your Services/ }));
    expect(screen.getByRole("heading", { name: "How AI Assistants Find Your Services" })).toBeVisible();
    expect(screen.getByText(/Discovery does not guarantee recommendations or new bookings/)).toBeVisible();
    expect(screen.getByText(/Keep service names, descriptions, prices, duration, location and availability accurate/)).toBeVisible();
    expect(screen.getByText(/Private customer details, provider notes and booking history are not part of public discovery/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Review Your Services" })).toHaveAttribute("href", "/provider/services");
    expect(mocks.submit).not.toHaveBeenCalled();
  });
});
