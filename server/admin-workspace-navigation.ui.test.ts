// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Tabs, TabsContent } from "../client/src/components/ui/tabs";
import { AdminNavigation } from "../client/src/pages/admin/AdminNavigation";
import { getAdminNavGroups, resolveAdminSection } from "../client/src/pages/admin/adminNavigation";
(globalThis as any).React = React;
let compact = false;
function Workspace({ owner = false, initial = "overview" }) {
  const [section, setSection] = React.useState(resolveAdminSection(initial, owner));
  return React.createElement(Tabs, { value: section, onValueChange: setSection, orientation: "vertical", activationMode: "manual" },
    React.createElement(AdminNavigation, { isOwnerAdmin: owner, activeSection: section }),
    ...getAdminNavGroups(owner).flatMap(group => group.items).map(item => React.createElement(TabsContent, { key: item.id, value: item.id }, `${item.label} workspace`)),
  );
}
beforeEach(() => {
  compact = false;
  window.matchMedia = vi.fn(() => ({ matches: compact, media: "", onchange: null, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn() })) as any;
});
afterEach(cleanup);
function choose(name: string) {
  const tab = screen.getByRole("tab", { name });
  fireEvent.mouseDown(tab, { button: 0, ctrlKey: false });
  fireEvent.click(tab);
}
describe("admin grouped navigation", () => {
  it("keeps all operations tools but hides owner entries and falls back on an owner deep link", () => {
    render(React.createElement(Workspace, { initial: "partner" }));
    expect(screen.getAllByRole("tab")).toHaveLength(13);
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    for (const name of ["Partner Split", "Team", "Legal Terms", "Customers Rollout"]) expect(screen.queryByRole("tab", { name })).toBeNull();
    choose("Bookings");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Bookings workspace");
  });
  it("shows the four existing owner entries only to owners without removing operations", () => {
    render(React.createElement(Workspace, { owner: true }));
    expect(screen.getAllByRole("tab")).toHaveLength(17);
    expect(screen.getByRole("group", { name: "Owner Controls" })).toBeInTheDocument();
    choose("Customers Rollout");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Customers Rollout workspace");
  });
  it("places a mobile section menu before content and closes on selection without duplicate trigger IDs", async () => {
    compact = true;
    render(React.createElement(Workspace, { owner: true }));
    expect(screen.queryByRole("tablist")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Admin sections — Overview" }));
    const dialog = screen.getByRole("dialog", { name: "Admin sections" });
    expect(within(dialog).getAllByRole("tab")).toHaveLength(17);
    const header = within(dialog).getByRole("heading", { name: "Admin sections" }).closest('[data-slot="sheet-header"]');
    expect(header).not.toBeNull();
    expect(within(header as HTMLElement).getByText("Choose a workspace.")).toBeVisible();
    const list = within(dialog).getByRole("tablist");
    expect(header?.nextElementSibling).toBe(list);
    expect(within(dialog).getByRole("button", { name: "Close" })).toBeVisible();
    const ids = Array.from(document.querySelectorAll('[role="tab"]')).map(el => el.id);
    expect(new Set(ids).size).toBe(ids.length);
    choose("Users");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("button", { name: "Admin sections — Users" })).toBeInTheDocument();
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Users workspace");
  });
  it("allows dismissing the drawer without selecting a workspace", async () => {
    compact = true;
    render(React.createElement(Workspace));
    fireEvent.click(screen.getByRole("button", { name: "Admin sections — Overview" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Overview workspace");
  });
});
