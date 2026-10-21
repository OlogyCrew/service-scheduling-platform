// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

type QueryInput = { page: number; limit: number; query?: string; status?: string };
type QueryResult = {
  data?: { bookings: any[]; total: number; page: number; limit: number; totalPages: number };
  isLoading?: boolean;
  isFetching?: boolean;
  isError?: boolean;
  error?: Error;
  refetch?: ReturnType<typeof vi.fn>;
};

const mocks = vi.hoisted(() => {
  const state: {
    calls: QueryInput[];
    lastKey: string | null;
    queryResult: (input: QueryInput) => QueryResult;
  } = {
    calls: [],
    lastKey: null,
    queryResult: () => ({ data: undefined, isLoading: true, isFetching: false, isError: false, refetch: vi.fn() }),
  };

  return state;
});

vi.mock("@/lib/trpc", () => ({
  trpc: {
    admin: {
      searchBookingsFiltered: {
        useQuery: (input: QueryInput) => {
          const key = JSON.stringify(input);
          if (mocks.lastKey !== key) {
            mocks.lastKey = key;
            mocks.calls.push(input);
          }
          return mocks.queryResult(input);
        },
      },
    },
  },
}));

const { AdminBookingsPanel } = await import("../client/src/pages/admin/AdminBookingsPanel");

const booking = (id: number, status = "pending") => ({
  id,
  bookingNumber: `BK-${id}`,
  serviceName: `Service ${id}`,
  bookingDate: "2026-10-22",
  startTime: "09:00",
  endTime: "10:00",
  locationType: "at_provider",
  totalAmount: "125.50",
  status,
});

function result(input: QueryInput, overrides: Partial<QueryResult["data"]> = {}): QueryResult {
  const total = overrides.total ?? 287;
  const totalPages = overrides.totalPages ?? Math.ceil(total / input.limit);
  return {
    data: {
      bookings: overrides.bookings ?? [booking(input.page)],
      total,
      page: overrides.page ?? input.page,
      limit: overrides.limit ?? input.limit,
      totalPages,
    },
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  mocks.calls = [];
  mocks.lastKey = null;
  mocks.queryResult = (input) => result(input);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("AdminBookingsPanel pagination", () => {
  it("does not reset a selected page when an unchanged initial search debounce expires", () => {
    render(React.createElement(AdminBookingsPanel));
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    act(() => { vi.advanceTimersByTime(300); });
    expect(mocks.calls.at(-1)).toEqual({ page: 2, limit: 25 });
    expect(screen.getByRole("spinbutton", { name: "Go to page" })).toHaveValue(2);
  });

  it("requests page 25 at a time and bounds Previous and Next", () => {
    mocks.queryResult = (input) => result(input);
    render(React.createElement(AdminBookingsPanel));

    expect(mocks.calls).toEqual([{ page: 1, limit: 25 }]);
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    expect(screen.getByText("Showing 1–25 of 287")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(mocks.calls.at(-1)).toEqual({ page: 2, limit: 25 });
    expect(screen.getByRole("button", { name: "Previous page" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    expect(mocks.calls.at(-1)).toEqual({ page: 1, limit: 25 });
  });

  it("commits direct page 12 only on Enter, never while the page draft is being typed", () => {
    render(React.createElement(AdminBookingsPanel));
    mocks.calls = [];

    const pageInput = screen.getByRole("spinbutton", { name: "Go to page" });
    fireEvent.change(pageInput, { target: { value: "1" } });
    fireEvent.change(pageInput, { target: { value: "12" } });
    expect(mocks.calls).toEqual([]);

    fireEvent.keyDown(pageInput, { key: "Enter" });
    expect(mocks.calls).toEqual([{ page: 12, limit: 25 }]);
    expect(screen.getByText("Showing 276–287 of 287")).toBeVisible();
  });

  it("resets to page one only after the debounced search is committed", () => {
    render(React.createElement(AdminBookingsPanel));
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(mocks.calls.at(-1)).toEqual({ page: 2, limit: 25 });

    mocks.calls = [];
    fireEvent.change(screen.getByRole("searchbox", { name: "Search bookings" }), { target: { value: "BK-12" } });
    act(() => { vi.advanceTimersByTime(249); });
    expect(mocks.calls).toEqual([]);

    act(() => { vi.advanceTimersByTime(1); });
    expect(mocks.calls).toEqual([{ page: 1, limit: 25, query: "BK-12" }]);
  });

  it("clamps a stale page to the last available page after a filtered result shrinks", () => {
    mocks.queryResult = (input) => input.page === 1
      ? result(input)
      : result(input, {
        total: 40,
        totalPages: 2,
        bookings: [booking(input.page)],
      });
    render(React.createElement(AdminBookingsPanel));
    mocks.calls = [];

    const pageInput = screen.getByRole("spinbutton", { name: "Go to page" });
    fireEvent.change(pageInput, { target: { value: "12" } });
    fireEvent.keyDown(pageInput, { key: "Enter" });

    expect(mocks.calls).toEqual([
      { page: 12, limit: 25 },
      { page: 2, limit: 25 },
    ]);
    expect(pageInput).toHaveValue(2);
    expect(screen.getByText("Showing 26–40 of 40")).toBeVisible();
  });

  it("shows a loading state instead of prior data while a changed filter is fetching", () => {
    mocks.queryResult = () => ({
      data: { bookings: [booking(1)], total: 1, page: 1, limit: 25, totalPages: 1 },
      isLoading: false,
      isFetching: true,
      isError: false,
      refetch: vi.fn(),
    });
    render(React.createElement(AdminBookingsPanel));

    expect(screen.getByText("Loading bookings…")).toBeVisible();
    expect(screen.queryByText("Service 1")).not.toBeInTheDocument();
  });

  it("has distinct empty, no-match, and error states", () => {
    mocks.queryResult = (input) => result(input, { total: 0, totalPages: 0, bookings: [] });
    const view = render(React.createElement(AdminBookingsPanel));
    expect(screen.getByText("No bookings yet")).toBeVisible();

    view.unmount();
    mocks.lastKey = null;
    mocks.queryResult = (input) => input.query
      ? result(input, { total: 0, totalPages: 0, bookings: [] })
      : result(input);
    render(React.createElement(AdminBookingsPanel));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search bookings" }), { target: { value: "not found" } });
    act(() => { vi.advanceTimersByTime(250); });
    expect(screen.getByText("No bookings match the current filters.")).toBeVisible();

    cleanup();
    mocks.lastKey = null;
    mocks.queryResult = () => ({ isLoading: false, isFetching: false, isError: true, error: new Error("Request failed"), refetch: vi.fn() });
    render(React.createElement(AdminBookingsPanel));
    expect(screen.getByText("We couldn’t load bookings.")).toBeVisible();
    expect(screen.getByText("Request failed")).toBeVisible();
  });

  it("preserves the legacy status badge variants", () => {
    mocks.queryResult = (input) => result(input, {
      total: 3,
      totalPages: 1,
      bookings: [booking(1, "confirmed"), booking(2, "cancelled"), booking(3, "pending")],
    });
    render(React.createElement(AdminBookingsPanel));

    expect(document.querySelector('[data-slot="badge"].bg-primary')).toHaveTextContent("confirmed");
    expect(document.querySelector('[data-slot="badge"].bg-destructive')).toHaveTextContent("cancelled");
    expect(document.querySelector('[data-slot="badge"].bg-secondary')).toHaveTextContent("pending");
  });
});
