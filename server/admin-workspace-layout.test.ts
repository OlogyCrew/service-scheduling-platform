import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
const root = resolve(import.meta.dirname, "..");
const source = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("admin workspace layout and palette boundaries", () => {
  it("groups navigation, retains all section IDs, and normalizes unknown and owner-only links", async () => {
    const { ADMIN_NAV_GROUPS, resolveAdminSection } = await import("../client/src/pages/admin/adminNavigation");
    const ids = ADMIN_NAV_GROUPS.flatMap(group => group.items.map(item => item.id));
    expect(new Set(ids).size).toBe(17);
    for (const id of ["overview", "users", "providers", "bookings", "subscriptions", "reviews", "documents", "support", "referrals", "push", "social-media", "audit", "settings", "team", "legal", "partner", "customers-pilot"]) expect(ids).toContain(id);
    for (const id of ["team", "legal", "partner", "customers-pilot"]) {
      expect(resolveAdminSection(id, false)).toBe("overview");
      expect(resolveAdminSection(id, true)).toBe(id);
    }
    expect(resolveAdminSection("unknown", true)).toBe("overview");
    expect(resolveAdminSection(null, true)).toBe("overview");
  });

  it("contains KPI cards within Overview and uses a separate paginated booking panel", () => {
    const dashboard = source("client/src/pages/AdminDashboard.tsx");
    const overviewStart = dashboard.indexOf('<TabsContent value="overview"');
    const overviewEnd = dashboard.indexOf('</TabsContent>', overviewStart);
    for (const title of ["Total Users", "Active Providers", "Total Bookings", "Platform Revenue"]) {
      expect(dashboard.indexOf(`>${title}</CardTitle>`)).toBeGreaterThan(overviewStart);
      expect(dashboard.indexOf(`>${title}</CardTitle>`)).toBeLessThan(overviewEnd);
    }
    expect(dashboard).toContain("<AdminBookingsPanel />");
    expect(dashboard).not.toContain("trpc.admin.listUsers.useQuery");
    expect(dashboard).not.toContain("trpc.admin.listProviders.useQuery");
    expect(dashboard).not.toContain("trpc.admin.listBookings.useQuery");
    expect(dashboard).toContain('visibleTab === "overview"');
    expect(dashboard).toContain("useLocation()");
    expect(dashboard).toContain("/admin?tab=");
  });

  it("keeps the palette opt-in, retains semantic states and supports narrow screens and reduced motion", () => {
    const css = source("client/src/pages/admin/AdminWorkspace.css");
    expect(css).toContain('@import "../../styles/publicBrandTokens.css"');
    expect(css).toContain(".ology-admin");
    expect(css).toContain("var(--ology-brand-paper)");
    expect(css).toContain("var(--ology-brand-deep)");
    expect(css).toContain("var(--ology-brand-coral)");
    expect(css).toContain("background: #e6edd8");
    expect(css).toContain("focus-visible");
    expect(css).toContain("prefers-reduced-motion");
    expect(css).toContain("max-width: 1023px");
    expect(css).not.toMatch(/(?:^|\n)\s*(?:body|:root|button)\s*\{/);
    expect(css).not.toContain('[data-variant="destructive"] {');
    expect(source("client/src/pages/AdminDashboard.tsx")).toContain('"border-l-emerald-500" : "border-l-amber-500"');
  });
});
