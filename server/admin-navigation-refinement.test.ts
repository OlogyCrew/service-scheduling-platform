import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
const root = resolve(import.meta.dirname, "..");
const source = (path: string) => readFileSync(resolve(root, path), "utf8");
function rule(css: string, selector: string) {
  const start = css.indexOf(selector);
  expect(start, `Missing scoped rule: ${selector}`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf("{", start);
  return css.slice(open + 1, css.indexOf("}", open));
}
function property(css: string, name: string) {
  return css.match(new RegExp(`(?:^|;)\\s*${name}:\\s*([^;]+)`))?.[1]?.trim();
}

describe("admin navigation rollover and compact overview", () => {
  it("matches provider hover and selected colors without darkening the selected tab on hover", () => {
    const admin = source("client/src/pages/admin/AdminWorkspace.css");
    const provider = source("client/src/components/provider/ProviderWorkspaceTheme.css");
    const hover = rule(admin, '.ology-admin-nav-list .ology-admin-nav-item:not([data-state="active"]):hover');
    const selected = rule(admin, '.ology-admin-nav-list .ology-admin-nav-item[data-state="active"]');
    const providerHover = rule(provider, '.ology-provider-workspace-surface [data-provider-workspace] aside a:not([aria-current="page"]):hover');
    const providerSelected = rule(provider, '.ology-provider-workspace-surface [data-provider-workspace] aside a[aria-current="page"]');
    for (const name of ["background", "color"]) {
      expect(property(hover, name)).toBe(property(providerHover, name));
      expect(property(selected, name)).toBe(property(providerSelected, name));
    }
    expect(property(selected, "font-weight")).toBe("700");
    expect(selected).not.toContain("inset 3px");
    expect(rule(admin, ".ology-admin-nav-list .ology-admin-nav-item {")).toContain("border-radius: 12px");
    expect(admin).toContain(".ology-admin-nav-list .ology-admin-nav-item:focus-visible");
    expect(admin).toContain("prefers-reduced-motion");
  });

  it("uses independent natural-height stacks and a consistent section gap instead of empty overview grid cells", () => {
    const admin = source("client/src/pages/admin/AdminWorkspace.css");
    const grid = rule(admin, ".ology-admin-overview-grid {");
    const stack = rule(admin, ".ology-admin-overview-stack {");
    expect(grid).toContain("minmax(0, 1fr)");
    expect(stack).toContain("display: flex");
    expect(stack).toContain("flex-direction: column");
    expect(stack).toContain("gap: var(--ology-admin-section-gap)");
    expect(stack).not.toMatch(/(?:^|;)\s*(?:height|min-height):/);
    expect(admin).toContain(".ology-admin-overview-grid { grid-template-columns: 1fr; }");
    expect(admin).not.toMatch(/(?:^|\n)\s*(?:body|:root)\s*\{/);
  });
  it("keeps the drawer header and section list from shrinking into each other", () => {
    const admin = source("client/src/pages/admin/AdminWorkspace.css");
    const header = rule(admin, '.ology-admin-drawer [data-slot="sheet-header"]');
    const list = rule(admin, ".ology-admin-drawer .ology-admin-nav-list");
    expect(property(header, "flex-shrink")).toBe("0");
    expect(property(list, "flex")).toBe("1 1 auto");
    expect(property(list, "min-height")).toBe("0");
    expect(property(list, "overflow-y")).toBe("auto");
    expect(header).toContain("safe-area-inset-top");
    expect(rule(admin, ".ology-admin-drawer {")).toContain("overflow: hidden");
    expect(rule(admin, ".ology-admin-drawer {")).toContain("max-height: 100dvh");
    expect(rule(admin, ".ology-admin-drawer > button")).toContain("safe-area-inset-top");
  });
});
