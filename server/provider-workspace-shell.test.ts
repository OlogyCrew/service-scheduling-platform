import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const readSource = (path: string) => readFileSync(resolve(root, path), "utf8");

const shellSource = readSource("client/src/components/provider/ProviderWorkspaceShell.tsx");
const overviewSource = readSource("client/src/pages/ProviderWorkspaceOverview.tsx");
const bookingsSource = readSource("client/src/pages/MyBookings.tsx");
const dashboardSource = readSource("client/src/pages/ProviderDashboard.tsx");
const tabPageSource = readSource("client/src/pages/ProviderTabPage.tsx");
const calendarSource = readSource("client/src/pages/ProviderCalendar.tsx");
const customersSource = readSource("client/src/pages/ProviderCustomers.tsx");
const customerDetailSource = readSource("client/src/pages/ProviderCustomerDetail.tsx");

describe("shared Provider Workspace visual system", () => {
  it("centralizes desktop and mobile navigation with canonical provider destinations", () => {
    expect(shellSource).toContain('aria-label="Provider workspace navigation"');
    expect(shellSource).toContain('aria-label="Provider mobile navigation"');
    expect(shellSource).toContain('aria-current={selected ? "page" : undefined}');

    for (const href of [
      'href: "/"',
      'href: "/my-bookings"',
      'href: "/provider/services"',
      'href: "/provider/calendar"',
      'href: "/provider/finances"',
      'href: "/provider/tools"',
    ]) {
      expect(shellSource).toContain(href);
    }
    expect(shellSource).not.toContain('/provider/dashboard?tab=services" },');
    expect(shellSource).not.toContain('/provider/dashboard?tab=finances');
    expect(shellSource).not.toContain('/provider/dashboard?tab=settings');
  });

  it("uses one shell across every active provider workspace page", () => {
    expect(overviewSource).toContain('<ProviderWorkspaceShell\n      active="overview"');
    expect(bookingsSource).toContain('active="bookings"');
    expect(tabPageSource).toContain('workspaceActive="services"');
    expect(tabPageSource).toContain('workspaceActive="money"');
    expect(calendarSource).toContain('active="calendar"');
    expect(customersSource).toContain('active="customers"');
    expect(customerDetailSource).toContain('active="customers"');
    expect(dashboardSource).toContain("<ProviderDashboardFrame");
    expect(dashboardSource).toContain("<ProviderWorkspacePageHeader");
  });

  it("keeps the shared bg-page surface and opts only Overview into its local brand treatment", () => {
    expect(shellSource).toContain("const providerWorkspaceBackground");
    expect(shellSource).toContain('"min-h-[calc(100vh-4rem)] bg-page"');
    expect(shellSource).toContain('<ProviderWorkspaceBackground className={active === "overview" ? "ology-provider-overview-surface" : undefined}>');
    expect(calendarSource).toContain("<ProviderWorkspaceBackground>");
    expect(customersSource).toContain("<ProviderWorkspaceBackground>");
    expect(customerDetailSource).toContain("<ProviderWorkspaceBackground>");
  });

  it("keeps Calendar and both Customers views under the standard global header", () => {
    expect(calendarSource).toContain("<NavHeader />");
    expect(customersSource).toContain("<NavHeader />");
    expect(customerDetailSource).toContain("<NavHeader />");
  });

  it("keeps the large greeting unique to Overview and gives subpages compact headers", () => {
    expect(overviewSource).toContain('{hasMounted ? greeting() : "Welcome"}, {firstName}.');
    expect(bookingsSource).not.toContain("greeting()");
    expect(dashboardSource).not.toContain("greeting()");
    expect(bookingsSource).toContain('title="Bookings"');
    expect(dashboardSource).toContain('title: "Services"');
    expect(dashboardSource).toContain('title: "Money"');
    expect(calendarSource).toContain('title="My Calendar"');
    expect(customersSource).toContain('title="Customers"');
    expect(customerDetailSource).toContain("title={contact.customerName");
  });

  it("removes the duplicate Customers navigation and retains canonical shared destinations", () => {
    expect(customersSource).not.toContain("ProviderCustomersNav");
    expect(customerDetailSource).not.toContain("ProviderCustomersNav");
    expect(customersSource).not.toContain("/provider/dashboard?tab=bookings");
    expect(customersSource).not.toContain("/provider/dashboard?tab=services");
    expect(customersSource).not.toContain("/provider/dashboard?tab=schedule");
  });

  it("applies the correct shared shell to each My Bookings view", () => {
    expect(bookingsSource).toContain("if (!providerMode)");
    expect(bookingsSource).toContain("<CustomerWorkspaceShell");
    expect(bookingsSource).toContain("<ProviderWorkspaceShell");
    expect(bookingsSource).toContain('providerMode={bookingView === "provider" && canSwitch}');
    expect(bookingsSource).toContain('{bookingView !== "provider" || !canSwitch ? (');
    expect(bookingsSource).toContain('bookingView === "customer" && customerSubscription?.currentTier === "business"');
    expect(bookingsSource).toContain("<CustomerQuotesSection />");
  });

  it("preserves existing service and finance implementations instead of duplicating data behavior", () => {
    for (const token of [
      "trpc.service.update.useMutation",
      "trpc.service.delete.useMutation",
      "PortfolioGallery",
      "PackagesList",
      "StripeConnectSection",
      "trpc.provider.earnings.useQuery",
      "Manage Subscription",
    ]) {
      expect(dashboardSource).toContain(token);
    }
    expect(tabPageSource).not.toContain("trpc.");
  });
});
