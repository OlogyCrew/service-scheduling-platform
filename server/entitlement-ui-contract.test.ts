import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("entitlement-aware customer payment surfaces", () => {
  const serviceDetail = read("client/src/pages/ServiceDetail.tsx");
  const bookingConfirmation = read("client/src/pages/BookingConfirmation.tsx");
  const providerRouter = read("server/routers/providerRouter.ts");

  it("publishes only a boolean payment-availability signal, not the connected account identifier", () => {
    expect(providerRouter).toContain("canAcceptPlatformPayments:");
    expect(providerRouter).toContain('providerHasFeature(effectiveTier, "paymentCollection")');
    expect(providerRouter).toMatch(/const\s*\{\s*stripeAccountId,[\s\S]*\.\.\.safeProviderRaw\s*\}\s*=\s*provider/);
  });

  it("routes priced bookings to payment only when the provider can collect on-platform", () => {
    expect(serviceDetail).toContain("const canAcceptPlatformPayments");
    expect(serviceDetail.match(/paymentRequested && canAcceptPlatformPayments/g)?.length).toBe(3);
    expect(serviceDetail).toContain("This provider will arrange payment after confirming");
    expect(serviceDetail).toContain("!service.requireUpfrontPayment && canAcceptPlatformPayments");
  });

  it("hides later Pay Now actions and explains that no charge was created", () => {
    expect(bookingConfirmation).toContain("Payment Arranged with Provider");
    expect(bookingConfirmation).toContain("No charge has been created");
    expect(bookingConfirmation.match(/canAcceptPlatformPayments &&/g)?.length).toBeGreaterThanOrEqual(2);
  });
});

describe("subscription cancellation and reactivation surfaces", () => {
  const providerPage = read("client/src/pages/SubscriptionManagement.tsx");
  const customerPage = read("client/src/pages/AccountSubscription.tsx");
  const providerRouter = read("server/subscriptionRouter.ts");
  const customerRouter = read("server/customerSubscriptionRouter.ts");

  it("offers no-charge Keep Current Plan reactivation for both account types", () => {
    for (const page of [providerPage, customerPage]) {
      expect(page).toContain("Keep Current Plan");
      expect(page).toContain("currentInterval");
      expect(page).toContain("without a new charge");
    }
  });

  it("guards missing legacy cancellation dates without non-null assertions", () => {
    expect(providerPage).not.toContain("currentPeriodEnd!");
    expect(customerPage).not.toContain("currentPeriodEnd!");
    expect(providerPage).toContain("Cancellation is scheduled for the end of the current billing period");
    expect(customerPage).toContain("Cancellation is scheduled for the end of the current billing period");
  });

  it("does not silently create a new subscription from recently cancelled history", () => {
    for (const source of [providerRouter, customerRouter]) {
      expect(source).not.toContain("recentlyCanceled");
      expect(source).not.toContain("subscriptions.create(");
      expect(source).not.toContain("within the last hour");
    }
  });
});

describe("reconciled plan claims and paid-feature surfaces", () => {
  const providerPlans = read("client/src/pages/SubscriptionManagement.tsx");
  const publicPlans = read("client/src/pages/CustomerPricing.tsx");
  const customerTrial = read("client/src/components/CustomerTrialBanner.tsx");
  const helpCenter = read("client/src/pages/HelpCenter.tsx");
  const helpAssistant = read("server/helpChatRouter.ts");
  const providerDashboard = read("client/src/pages/ProviderDashboard.tsx");
  const providerOverview = read("server/providerOverviewRouter.ts");
  const serviceSearch = read("server/db/services.ts");

  it("does not present Starter as a Stripe payment or transaction-fee plan", () => {
    expect(providerPlans).toContain('{ text: "1% transaction fee on OlogyCrew payments", included: false }');
    expect(publicPlans).toContain('PROVIDER_PAYMENTS_PAUSED ? "1% transaction fee — payment collection unavailable during review" : "1% transaction fee on OlogyCrew payments"');
    expect(providerPlans).not.toContain("All plans include a low 1% transaction fee");
  });

  it("does not promise Manager-only bulk quotes, analytics, or exports to Coordinator trials", () => {
    expect(helpCenter).not.toContain("up to 5 bulk quote requests");
    expect(helpAssistant).not.toContain("5 bulk quote requests");
    expect(customerTrial).toContain('planLabel === "Manager"');
    expect(customerTrial).toContain("up to 50 saved providers, priority booking requests, and provider folders");
  });

  it("explains retained Stripe accounts while effective payment collection is paused", () => {
    expect(providerDashboard).toContain("Payment Collection Paused");
    expect(providerDashboard).toContain("Your connected Stripe account and payout history remain available");
    expect(providerOverview).toContain("!canCollectPayments || !provider.payoutEnabled");
  });

  it("ranks valid trial, grace, and legacy cancellation access without boosting expired states", () => {
    expect(serviceSearch.match(/const hasPaidSearchAccess/g)?.length).toBe(2);
    expect(serviceSearch).toContain("trialEndsAt} > NOW()");
    expect(serviceSearch).toContain("currentPeriodEnd} > NOW()");
    expect(serviceSearch).toContain("cancelAtPeriodEnd} = true");
  });
});
