// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { OfflineBanner } from "../client/src/components/OfflineBanner";
import { ProfileLoadingSkeleton } from "../client/src/components/shared/NavHeader";

const setOnlineState = (online: boolean) => {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: online,
  });
};

afterEach(() => {
  cleanup();
  setOnlineState(true);
});

describe("hydration-safe connectivity and profile loading UI", () => {
  it("does not render offline UI on the first render, then responds to connectivity events", () => {
    setOnlineState(true);
    render(<OfflineBanner />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    setOnlineState(false);
    fireEvent(window, new Event("offline"));
    expect(screen.getByRole("status")).toHaveTextContent("Offline");
    expect(screen.getByText(/changes will resume/i)).toBeVisible();

    setOnlineState(true);
    fireEvent(window, new Event("online"));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("renders an accessible profile skeleton with stable geometry", () => {
    render(<ProfileLoadingSkeleton />);
    const status = screen.getByRole("status", { name: "Loading your profile" });
    expect(status).toBeVisible();
    expect(status.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(2);
    expect(screen.getByText("Loading your profile")).toHaveClass("sr-only");
  });
});
