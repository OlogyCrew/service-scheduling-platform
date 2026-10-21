// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
(globalThis as any).React = React;
const mocks = vi.hoisted(() => ({ search: "", owner: false, role: "admin", statsError: false, calls: [] as Array<{ path: string; input: any; options: any }>, navigate: vi.fn(), mutate: vi.fn(), invalidate: vi.fn() }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 1, role: mocks.role, adminRole: mocks.owner ? "super_admin" : "operations_admin" }, loading: false }) }));
vi.mock("@/hooks/useProtectedPage", () => ({ useProtectedPage: () => {} }));
vi.mock("@/components/shared/NavHeader", () => ({ NavHeader: () => React.createElement("header", null, "Shared site header") }));
vi.mock("streamdown", () => ({ Streamdown: ({ children }: any) => React.createElement("div", null, children) }));
vi.mock("wouter", () => ({
  useSearch: () => mocks.search,
  useLocation: () => ["/admin", (url: string) => { mocks.navigate(url); mocks.search = url.split("?")[1] ?? ""; }],
  Link: ({ href, children, ...props }: any) => React.createElement("a", { href, ...props }, children),
}));
vi.mock("@/lib/trpc", () => {
  const tree = (path = ""): any => new Proxy({}, { get(_target, key) {
    if (key === "useUtils") return () => tree("utils");
    if (key === "invalidate") return mocks.invalidate;
    if (key === "useMutation") return () => ({ mutate: mocks.mutate, isPending: false });
    if (key === "useQuery") return (input: any, options: any) => {
      mocks.calls.push({ path, input, options });
      if (path === "admin.getStats") return { data: mocks.statsError ? undefined : { totalUsers: 25, totalProviders: 15, totalBookings: 14, totalRevenue: "555.50" }, isLoading: false, isError: mocks.statsError, error: mocks.statsError ? new Error("Unavailable") : null, refetch: vi.fn() };
      if (path === "admin.searchBookingsFiltered") return { data: { bookings: [], page: input.page, limit: input.limit, totalPages: 0, total: 0 }, isLoading: false, isFetching: false, isError: false };
      if (path === "verification.listPending") return { data: [], isLoading: false };
      return { data: undefined, isLoading: true, isFetching: false, refetch: vi.fn() };
    };
    return tree(path ? `${path}.${String(key)}` : String(key));
  } });
  return { trpc: tree() };
});
const { default: AdminDashboard } = await import("../client/src/pages/AdminDashboard");
beforeEach(() => {
  mocks.search = ""; mocks.owner = false; mocks.role = "admin"; mocks.statsError = false; mocks.calls = [];
  mocks.navigate.mockReset(); mocks.mutate.mockReset();
  window.matchMedia = vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) as any;
});
afterEach(cleanup);
function choose(name: string) { const tab = screen.getByRole("tab", { name }); fireEvent.mouseDown(tab, { button: 0, ctrlKey: false }); fireEvent.click(tab); }
describe("admin integrated workspace shell", () => {
  it("renders metrics only on Overview, requests only five overview bookings, and synchronizes section URLs", () => {
    render(React.createElement(AdminDashboard));
    expect(screen.getByRole("heading", { name: "Admin Overview" })).toBeVisible();
    expect(screen.getByText("Total Users")).toBeVisible();
    expect(mocks.calls.find(call => call.path === "admin.searchBookingsFiltered")?.input).toEqual({ page: 1, limit: 5 });
    choose("Bookings");
    expect(screen.getByRole("heading", { name: "Bookings", level: 1 })).toBeVisible();
    expect(screen.queryByText("Total Users")).toBeNull();
    expect(mocks.navigate).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).toHaveBeenCalledWith("/admin?tab=bookings");
    expect(mocks.calls.filter(call => call.path === "admin.searchBookingsFiltered").some(call => call.input.limit === 25)).toBe(true);
    expect(mocks.calls.filter(call => call.path === "admin.getStats").at(-1)?.options.enabled).toBe(false);
    expect(mocks.mutate).not.toHaveBeenCalled();
  });
  it("normalizes unknown and unauthorized owner deep links and responds to external URL changes", () => {
    mocks.search = "tab=partner";
    const view = render(React.createElement(AdminDashboard));
    expect(screen.getByRole("heading", { name: "Admin Overview" })).toBeVisible();
    expect(screen.queryByRole("tab", { name: "Partner Split" })).toBeNull();
    mocks.search = "tab=bookings";
    view.rerender(React.createElement(AdminDashboard));
    expect(screen.getByRole("heading", { name: "Bookings", level: 1 })).toBeVisible();
    mocks.search = "tab=not-real";
    view.rerender(React.createElement(AdminDashboard));
    expect(screen.getByRole("heading", { name: "Admin Overview" })).toBeVisible();
    expect(mocks.mutate).not.toHaveBeenCalled();
  });
  it("does not display zero metrics when overview statistics fail", () => {
    mocks.statsError = true;
    render(React.createElement(AdminDashboard));
    expect(screen.getByRole("alert")).toHaveTextContent("Overview is unavailable");
    expect(screen.queryByText("Total Users")).toBeNull();
    expect(screen.getByRole("button", { name: "Retry overview" })).toBeEnabled();
  });
  it("denies a non-admin without showing admin navigation or requesting enabled admin data", () => {
    mocks.role = "user";
    render(React.createElement(AdminDashboard));
    expect(screen.getByText("Access Denied")).toBeVisible();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(mocks.calls.filter(call => call.path === "admin.getStats").at(-1)?.options.enabled).toBe(false);
    expect(mocks.mutate).not.toHaveBeenCalled();
  });
});
