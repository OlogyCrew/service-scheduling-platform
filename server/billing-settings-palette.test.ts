import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const provider = source("client/src/pages/BillingHistory.tsx");
const customer = source("client/src/pages/CustomerBillingHistory.tsx");
const billingCss = source("client/src/pages/BillingHistory.css");
const settings = source("client/src/pages/NotificationSettings.tsx");
const settingsCss = source("client/src/pages/NotificationSettings.css");
const push = source("client/src/components/PushNotificationSettings.tsx");

// Palette contracts deliberately do not replace the subscription or notification data model.
describe("billing history and settings people-first palette", () => {
  it("opts both billing audiences into shared styles without changing other routes", () => {
    for (const page of [provider, customer]) {
      expect(page).toContain('import "./BillingHistory.css"');
      expect(page.match(/ology-billing-page/g)).toHaveLength(2);
      expect(page).toContain('ology-billing-content');
      expect(page).toContain('ology-billing-summary');
      expect(page).toContain('ology-billing-transactions');
      expect(page).toContain('ology-billing-row');
      expect(page).toContain('data.nextCursor');
      expect(page).toContain('item.invoicePdfUrl');
      expect(page).toContain('case "action_required"');
      expect(page).toContain('case "pending"');
    }
    expect(provider).toContain('trpc.subscription.billingHistory.useQuery');
    expect(provider).toContain('trpc.subscription.mySubscription.useQuery');
    expect(provider).toContain('href="/provider/subscription"');
    expect(customer).toContain('trpc.customerSubscription.billingHistory.useQuery');
    expect(customer).toContain('trpc.customerSubscription.getSubscription.useQuery');
    expect(customer).toContain('href="/customer/subscription"');
    expect(billingCss).toContain('.ology-billing-page');
    expect(billingCss).toContain('var(--ology-brand-deep)');
    expect(billingCss).toContain('var(--ology-brand-paper)');
  });

  it("scopes notification styling while leaving consent defaults, mutations and disabled SMS intact", () => {
    expect(settings).toContain('import "./NotificationSettings.css"');
    expect(settings).toContain('ology-settings-page min-h-screen bg-page');
    expect(settings).toContain('ology-settings-content');
    expect(settings).toContain('ology-settings-relationship');
    expect(settings).toContain('<PushNotificationSettings />');
    expect(settings).toContain('trpc.notification.updatePreferences.useMutation');
    expect(settings).toContain('updatePrefs.mutate(updated)');
    expect(settings).toContain('relationshipMessageEnabled: false');
    expect(settings).toContain('marketingEmail: false');
    expect(settings).toContain('onCheckedChange={() => toggle("relationshipMessageEnabled")}');
    expect(settings).toContain('onCheckedChange={() => toggle("marketingEmail")}');
    expect(settings).toContain('Coming Soon');
    expect(settings).toContain('checked={false}');
    expect(settings).toContain('disabled');
    expect(push).toContain('permission === "denied"');
    expect(push).toContain('bg-destructive/10');
    expect(push).toContain('isSubscribed');
    expect(settingsCss).toContain('.ology-settings-page');
    expect(settingsCss).toContain('[data-state="checked"]:not(:disabled)');
  });

  it("preserves status meaning and accessible controls without global palette overrides", () => {
    for (const page of [provider, customer]) {
      expect(page).toContain('bg-red-100 text-red-700');
      expect(page).toContain('bg-yellow-100 text-yellow-700');
      expect(page).toContain('bg-green-100 text-green-700');
    }
    for (const css of [billingCss, settingsCss]) {
      expect(css).toContain('@import "../styles/publicBrandTokens.css"');
      expect(css).toContain(':focus-visible');
      expect(css).toContain('@media (prefers-reduced-motion: reduce)');
      expect(css).not.toMatch(/(^|\n):root\s*\{/);
      expect(css).not.toMatch(/(^|\n)\.dark\s*\{/);
    }
  });
});
