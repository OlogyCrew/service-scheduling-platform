import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getCanonicalProviderDashboardDestination } from "../client/src/lib/providerDashboardRedirect";

const root = resolve(process.cwd());
const readSource = (path: string) => readFileSync(resolve(root, path), "utf8");

const appSource = readSource("client/src/App.tsx");
const tabPageSource = readSource("client/src/pages/ProviderTabPage.tsx");
const dashboardSource = readSource("client/src/pages/ProviderDashboard.tsx");
const shellSource = readSource("client/src/components/provider/ProviderWorkspaceShell.tsx");
const redirectSource = readSource("client/src/lib/providerDashboardRedirect.ts");
const bookingsSource = readSource("client/src/pages/MyBookings.tsx");

describe("standalone provider Business Tools page", () => {
  it("registers a provider-only canonical Business Tools route", () => {
    expect(appSource).toContain("ProviderTools");
    expect(appSource).toContain('<Route path="/provider/tools">{() => <ProviderOnlyGuard featureName="Business Tools"><ProviderTools /></ProviderOnlyGuard>}</Route>');
    expect(appSource.indexOf('path="/provider/tools"')).toBeLessThan(appSource.indexOf('path="/:slug"'));
  });

  it("reuses the complete existing More tab inside the shared workspace shell", () => {
    expect(tabPageSource).toContain("export function ProviderTools()");
    expect(tabPageSource).toContain('<ProviderDashboard initialTab="settings" hideChrome={true} workspaceActive="more" />');
    expect(tabPageSource).not.toContain("trpc.");
    expect(dashboardSource).toContain('title: "Business Tools"');

    for (const content of [
      "Customer Reviews",
      "Promo Codes",
      "TipSettingsSection",
      "FreeEstimatesSection",
      "EmergencyServiceSection",
      "ReferProviderCard",
      "VerificationDocumentsTab",
    ]) {
      expect(dashboardSource).toContain(content);
    }
  });

  it("groups Business Tools into four searchable, collapsible sections", () => {
    expect(dashboardSource).toContain('from "@/components/ui/accordion"');
    expect(dashboardSource).toContain('placeholder="Search business tools..."');
    expect(dashboardSource).toContain('aria-label="Search Business Tools"');
    expect(dashboardSource).toContain('type="multiple"');
    expect(dashboardSource).toContain("value={displayedBusinessToolGroups}");
    for (const group of ["Reputation & trust", "Growth & promotion", "Pricing & payments", "Service options"]) {
      expect(dashboardSource).toContain(group);
    }
    for (const component of ["TipSettingsSection", "FreeEstimatesSection", "EmergencyServiceSection", "ReferProviderCard", "VerificationDocumentsTab"]) {
      expect(dashboardSource).toContain(`<${component} />`);
    }
    expect(dashboardSource).toContain("No business tools found");
  });

  it("points shared and legacy dashboard More controls to the canonical page", () => {
    expect(shellSource.match(/href="\/provider\/tools"/g)?.length).toBe(1);
    expect(shellSource).toContain('href: "/provider/tools"');
    expect(shellSource).toContain("Business Tools");
    expect(dashboardSource.match(/href="\/provider\/tools"/g)?.length).toBe(2);
    expect(dashboardSource.match(/aria-label="Open Business Tools"/g)?.length).toBe(2);
    expect(shellSource).not.toContain("/provider/dashboard?tab=settings");
  });

  it("redirects every supported legacy dashboard tab to its canonical page", () => {
    expect(appSource).toContain("function ProviderDashboardRoute()");
    expect(appSource).toContain("getCanonicalProviderDashboardDestination(location.includes(\"?\") ? location.slice(location.indexOf(\"?\")) : \"\")");
    for (const [tab, destination] of Object.entries({
      bookings: "/my-bookings",
      quotes: "/my-bookings?tab=quotes",
      services: "/provider/services",
      portfolio: "/provider/services#portfolio-work-samples",
      schedule: "/provider/calendar",
      finances: "/provider/finances",
      payouts: "/provider/finances",
      analytics: "/provider/analytics",
      "my-page": "/provider/my-page",
      subscription: "/provider/subscription",
      settings: "/provider/tools",
      more: "/provider/tools",
    })) {
      expect(getCanonicalProviderDashboardDestination(`?tab=${tab}`)).toBe(destination);
    }
    expect(getCanonicalProviderDashboardDestination("?tab=finances&stripe=return")).toBe("/provider/finances?stripe=return");
    expect(getCanonicalProviderDashboardDestination("?tab=quotes&source=email")).toBe("/my-bookings?tab=quotes&source=email");
    expect(getCanonicalProviderDashboardDestination("?tab=subscription&status=success")).toBe("/provider/subscription?status=success");
    expect(getCanonicalProviderDashboardDestination("?tab=portfolio&upload=1")).toBe("/provider/services?upload=1#portfolio-work-samples");
    expect(getCanonicalProviderDashboardDestination("?tab=unknown")).toBeUndefined();
    expect(getCanonicalProviderDashboardDestination("")).toBeUndefined();
    expect(redirectSource).toContain('legacyParams.delete("tab")');
    expect(bookingsSource).toContain('const defaultBookingTab = ["upcoming", "past", "drafts", "quotes"].includes');
    expect(bookingsSource).toContain("<Tabs defaultValue={defaultBookingTab}");
    expect(appSource).toContain('setLocation(canonicalDestination, { replace: true })');
    expect(appSource).toContain('path="/provider/dashboard" component={ProviderDashboardRoute}');
    expect(appSource).toContain("if (canonicalDestination) return null");
  });

  it("retains the legacy settings implementation only as the canonical page content source", () => {
    expect(dashboardSource).toContain('params.get("tab") || "bookings"');
    expect(dashboardSource).toContain('<TabsContent value="settings"');
    expect(tabPageSource).toContain('<ProviderDashboard initialTab="settings" hideChrome={true} workspaceActive="more" />');
  });
});
