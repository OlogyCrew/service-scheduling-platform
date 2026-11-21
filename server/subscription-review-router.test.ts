import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted before ALL application imports. A missed mock cannot make a socket,
// HTTP(S), TLS, DNS, fetch, or WebSocket request, even during module evaluation.
const transportGuards = await vi.hoisted(async () => {
  const { default: net } = await import("node:net");
  const { default: http } = await import("node:http");
  const { default: https } = await import("node:https");
  const { default: tls } = await import("node:tls");
  const { default: dns } = await import("node:dns");
  const deny = () => {
    throw new Error("Hermetic subscription-review test forbids network transports");
  };
  const guards = {
    socketConnect: vi.spyOn(net.Socket.prototype, "connect").mockImplementation(deny),
    netConnect: vi.spyOn(net, "connect").mockImplementation(deny),
    netCreateConnection: vi.spyOn(net, "createConnection").mockImplementation(deny),
    httpRequest: vi.spyOn(http, "request").mockImplementation(deny),
    httpGet: vi.spyOn(http, "get").mockImplementation(deny),
    httpsRequest: vi.spyOn(https, "request").mockImplementation(deny),
    httpsGet: vi.spyOn(https, "get").mockImplementation(deny),
    tlsConnect: vi.spyOn(tls, "connect").mockImplementation(deny),
    fetch: vi.fn(deny),
    webSocket: vi.fn(deny),
  };
  // Cover callback, promise, and custom Resolver DNS transports, not just lookup.
  const dnsGuards: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of [
    "lookup", "lookupService", "resolve", "resolve4", "resolve6", "resolveAny",
    "resolveCaa", "resolveCname", "resolveMx", "resolveNaptr", "resolveNs",
    "resolvePtr", "resolveSoa", "resolveSrv", "resolveTxt", "reverse",
  ] as const) {
    dnsGuards[`dns.${method}`] = vi.spyOn(dns, method).mockImplementation(deny);
    dnsGuards[`dns.promises.${method}`] = vi.spyOn(dns.promises, method).mockImplementation(deny);
    if (method !== "lookup" && method !== "lookupService") {
      dnsGuards[`dns.Resolver.${method}`] = vi.spyOn(dns.Resolver.prototype, method).mockImplementation(deny);
      dnsGuards[`dns.promises.Resolver.${method}`] = vi.spyOn(dns.promises.Resolver.prototype, method).mockImplementation(deny);
    }
  }
  vi.stubGlobal("fetch", guards.fetch);
  vi.stubGlobal("WebSocket", guards.webSocket);
  return { ...guards, ...dnsGuards };
});

const mocks = vi.hoisted(() => {
  const forbidden = (name: string) => vi.fn((..._args: unknown[]) => {
    throw new Error(`Subscription-review gate must stop before ${name}`);
  });
  return {
    stripeConstructor: vi.fn(),
    stripe: {
      subscriptionRetrieve: forbidden("Stripe subscription retrieve"),
      subscriptionUpdate: forbidden("Stripe subscription update"),
      subscriptionCancel: forbidden("Stripe subscription cancel"),
      productList: forbidden("Stripe product list"),
      productSearch: forbidden("Stripe product search"),
      productCreate: forbidden("Stripe product creation"),
      priceList: forbidden("Stripe price list"),
      priceCreate: forbidden("Stripe price creation"),
      customerCreate: forbidden("Stripe customer creation"),
      customerRetrieve: forbidden("Stripe customer retrieve"),
      checkoutCreate: forbidden("Stripe Checkout creation"),
      portalCreate: forbidden("Stripe billing portal creation"),
      invoiceList: forbidden("Stripe invoice list"),
      accountCreate: forbidden("Stripe Connect account creation"),
      accountRetrieve: forbidden("Stripe Connect account retrieve"),
      accountLoginLink: forbidden("Stripe Connect dashboard link"),
      accountLinkCreate: forbidden("Stripe Connect onboarding link"),
      balanceRetrieve: forbidden("Stripe balance retrieve"),
    },
    db: {
      getDb: forbidden("DB acquisition"),
      getProviderByUserId: forbidden("provider lookup"),
      getProviderById: forbidden("provider ID lookup"),
      getProviderSubscription: forbidden("provider subscription read"),
      getProviderTier: forbidden("provider tier read"),
      getActiveServiceCount: forbidden("service usage read"),
      getCustomerSubscription: forbidden("customer subscription read"),
      getCustomerTier: forbidden("customer tier read"),
      getUserFavoriteCount: forbidden("customer favorite usage read"),
      getUserById: forbidden("user read"),
      getCustomerSpendingSummary: forbidden("customer spending read"),
      getCustomerMonthlySpending: forbidden("customer monthly spending read"),
      getCustomerTopProviders: forbidden("customer top provider read"),
      getCustomerCategoryBreakdown: forbidden("customer category read"),
      getCustomerRecentBookings: forbidden("customer booking read"),
      getCustomerBookingsForExport: forbidden("customer export read"),
      upsertProviderSubscription: forbidden("provider subscription write"),
      upsertCustomerSubscription: forbidden("customer subscription write"),
      clearProviderStripeSubscriptionReference: forbidden("provider Stripe reference clear"),
      clearCustomerStripeSubscriptionReference: forbidden("customer Stripe reference clear"),
      updateProviderStripeAccount: forbidden("provider Connect write"),
      createNotification: forbidden("in-app notification write"),
    },
    connection: { getDb: forbidden("scheduled DB acquisition") },
    analytics: { getSubscriptionAnalytics: forbidden("payment analytics") },
    notifications: {
      sendNotification: forbidden("notification transport"),
      sendMultiChannelNotification: forbidden("multi-channel notification transport"),
    },
    trials: {
      sendTrialStartedNotification: forbidden("trial-start notification"),
      checkAndSendTrialMilestoneNotification: forbidden("trial milestone/expiry notification"),
    },
    notices: { createSubscriptionInAppNotice: forbidden("subscription in-app notice") },
    authorization: {
      assertPaymentActorCanInitiate: forbidden("customer payment actor authorization"),
      assertProviderPaymentActor: forbidden("provider payment actor authorization"),
      assertProviderCanCollectPayments: forbidden("provider collection authorization"),
    },
    velocity: {
      assertPaymentVelocityAllowed: forbidden("velocity read/counter/write"),
      throwIfPaymentVelocityBlocked: forbidden("velocity result handling"),
    },
    sdk: { authenticateRequest: forbidden("authentication SDK") },
    driver: {
      createConnection: forbidden("MySQL connection"),
      createPool: forbidden("MySQL pool"),
    },
    env: {
      appId: "", cookieSecret: "", agentHandoffSecret: "", databaseUrl: "",
      oAuthServerUrl: "", ownerOpenId: "", isProduction: false,
      forgeApiUrl: "", forgeApiKey: "",
      stripeSecretKey: "inert-no-credentials", stripeWebhookSecret: "",
      twilioAccountSid: "", twilioAuthToken: "", twilioPhoneNumber: "",
      twilioMessagingServiceSid: "", sendgridApiKey: "", partnerStripeAccountId: "",
      googleClientId: "", googleClientSecret: "", facebookPageAccessToken: "",
      facebookPageId: "", instagramBusinessAccountId: "", linkedinAccessToken: "",
      linkedinOrganizationId: "",
    },
  };
});

vi.mock("stripe", () => ({
  default: class StripeMock {
    constructor(...args: unknown[]) { mocks.stripeConstructor(...args); }
    subscriptions = {
      retrieve: mocks.stripe.subscriptionRetrieve, update: mocks.stripe.subscriptionUpdate,
      cancel: mocks.stripe.subscriptionCancel,
    };
    products = { list: mocks.stripe.productList, search: mocks.stripe.productSearch, create: mocks.stripe.productCreate };
    prices = { list: mocks.stripe.priceList, create: mocks.stripe.priceCreate };
    customers = { create: mocks.stripe.customerCreate, retrieve: mocks.stripe.customerRetrieve };
    checkout = { sessions: { create: mocks.stripe.checkoutCreate } };
    billingPortal = { sessions: { create: mocks.stripe.portalCreate } };
    invoices = { list: mocks.stripe.invoiceList };
    accounts = {
      create: mocks.stripe.accountCreate, retrieve: mocks.stripe.accountRetrieve,
      createLoginLink: mocks.stripe.accountLoginLink,
    };
    accountLinks = { create: mocks.stripe.accountLinkCreate };
    balance = { retrieve: mocks.stripe.balanceRetrieve };
  },
}));
vi.mock("./db", () => mocks.db);
vi.mock("./db/connection", () => mocks.connection);
vi.mock("./db/payments", () => mocks.analytics);
vi.mock("./notifications", () => mocks.notifications);
vi.mock("./trialNotifications", () => mocks.trials);
vi.mock("./subscriptionNotifications", () => mocks.notices);
vi.mock("./paymentAuthorization", () => mocks.authorization);
vi.mock("./paymentVelocity", () => mocks.velocity);
vi.mock("./_core/env", () => ({ ENV: mocks.env }));
vi.mock("./_core/sdk", () => ({ sdk: mocks.sdk }));
vi.mock("mysql2", () => ({ ...mocks.driver, default: mocks.driver }));
vi.mock("mysql2/promise", () => ({ ...mocks.driver, default: mocks.driver }));

// These are REAL exported routers and REAL protected middleware/entitlements.
// Never import appRouter, createContext, server startup, or project globalSetup.
import type { Request, Response } from "express";
import type { TrpcContext } from "./_core/context";
import { TRPCError } from "@trpc/server";
import { customerSubscriptionRouter } from "./customerSubscriptionRouter";
import { subscriptionRouter } from "./subscriptionRouter";
import { stripeConnectRouter } from "./stripeConnectRouter";
import { handleScheduledTrialExpiry } from "./scheduledTrialExpiry";
import { hasAdminClearance } from "./adminPolicy";
import { CUSTOMER_PLANS, PROVIDER_PLANS } from "../shared/entitlements";
import { UNAUTHED_ERR_MSG } from "../shared/const";
import {
  ALL_TRIALS_PAUSED, ALL_TRIAL_PAUSE_MESSAGE,
  PLATFORM_SUBSCRIPTIONS_PAUSED, PLATFORM_SUBSCRIPTION_PAUSE_MESSAGE,
  PROVIDER_TRIALS_PAUSED, PROVIDER_TRIAL_PAUSE_MESSAGE,
} from "../shared/providerPaymentPause";

const effectGroups = {
  db: mocks.db, connection: mocks.connection, analytics: mocks.analytics,
  stripe: mocks.stripe, notifications: mocks.notifications, trials: mocks.trials,
  notices: mocks.notices, authorization: mocks.authorization, velocity: mocks.velocity,
  sdk: mocks.sdk, driver: mocks.driver,
};
const allEffects = Object.entries(effectGroups).flatMap(([group, spies]) =>
  Object.entries(spies).map(([name, spy]) => ({ name: `${group}.${name}`, spy })),
);
// Preserve the import-time oracle before beforeEach clears invocation histories.
const importCalls = [...allEffects, ...Object.entries(transportGuards).map(([name, spy]) => ({ name, spy }))]
  .map(({ name, spy }) => ({ name, count: spy.mock.calls.length }));
const stripeInitialization = mocks.stripeConstructor.mock.calls.map(args => [...args]);
const NOW = "2026-11-21T12:00:00.000Z";
const USER_ID = 71001;
const PROVIDER_ID = 72001;
const ORIGIN = "https://app.example.invalid";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
const providerFixture = deepFreeze({
  id: PROVIDER_ID, userId: USER_ID, businessName: "Synthetic review provider",
  isOfficial: false, isActive: true, deletedAt: null, businessType: "sole_proprietor",
  stripeAccountId: "acct_inert_retained", stripeAccountStatus: "active",
  stripeOnboardingComplete: true, payoutEnabled: true,
});
const userFixture = deepFreeze({
  id: USER_ID, openId: "hermetic-review-user", name: "Synthetic review user",
  email: "review@example.invalid", role: "customer", adminRole: null, deletedAt: null,
});
function context(fields: Record<string, unknown> | null = {}): TrpcContext {
  return {
    user: fields === null ? null : { ...userFixture, ...fields },
    req: { headers: { origin: ORIGIN }, ip: "192.0.2.71" }, res: {},
  } as unknown as TrpcContext;
}

// Exact per-test call allowances, NOT a blanket read/write exception. Every
// unlisted DB read, authorization, velocity counter, Stripe call, notification,
// driver access, SDK call, and transport must have zero calls after EVERY test.
let expectedCalls: Map<unknown, number>;
let preservedRecords: Array<{ value: unknown; snapshot: string }>;
function allow(spy: (typeof allEffects)[number]["spy"], result: unknown, count = 1) {
  expectedCalls.set(spy, count);
  spy.mockResolvedValue(result as never);
}
function preserve<T>(record: T): T {
  deepFreeze(record);
  preservedRecords.push({ value: record, snapshot: JSON.stringify(record) });
  return record;
}
function assertNoUnexpectedEffects() {
  for (const { name, spy } of allEffects) {
    expect(spy, `${name}: only explicitly allowed synthetic calls may run`)
      .toHaveBeenCalledTimes(expectedCalls.get(spy) ?? 0);
  }
  for (const [name, spy] of Object.entries(transportGuards)) {
    expect(spy, `${name}: network is forbidden`).not.toHaveBeenCalled();
  }
  expect(mocks.stripeConstructor, "no additional Stripe SDK initialization").not.toHaveBeenCalled();
  for (const { value, snapshot } of preservedRecords) {
    expect(Object.isFrozen(value)).toBe(true);
    // Object.freeze(Date) alone does not stop setTime: serialization catches it.
    expect(JSON.stringify(value), "stored synthetic record/history must remain identical").toBe(snapshot);
  }
}
beforeEach(() => {
  vi.clearAllMocks(); // Never remove the fail-fast native transport guards.
  for (const { name, spy } of allEffects) {
    spy.mockReset().mockImplementation((..._args: unknown[]) => {
      throw new Error(`Unexpected hermetic dependency call: ${name}`);
    });
  }
  mocks.stripe.subscriptionRetrieve.mockImplementation(() => {
    throw Object.assign(new Error("No such subscription: sub_inert_retained"), {
      code: "resource_missing", type: "StripeInvalidRequestError", statusCode: 404,
    });
  });
  mocks.stripe.accountRetrieve.mockImplementation(() => {
    throw Object.assign(new Error("No such account: acct_inert_retained"), { code: "resource_missing" });
  });
  expectedCalls = new Map();
  preservedRecords = [];
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(NOW));
});
afterEach(() => {
  try { assertNoUnexpectedEffects(); } finally { vi.useRealTimers(); }
});

type RouteCase = {
  label: string;
  pausedMessage?: string;
  invoke: (ctx: TrpcContext, input?: unknown) => Promise<unknown>;
};
const blockedRoutes: RouteCase[] = [
  { label: "customer.createCheckout", invoke: (ctx, input = { tier: "pro" }) => customerSubscriptionRouter.createCaller(ctx).createCheckout(input as never) },
  { label: "customer.createPortalSession", invoke: ctx => customerSubscriptionRouter.createCaller(ctx).createPortalSession() },
  { label: "customer.downgrade", invoke: (ctx, input = { targetTier: "free" }) => customerSubscriptionRouter.createCaller(ctx).downgrade(input as never) },
  { label: "customer.pause", invoke: (ctx, input = {}) => customerSubscriptionRouter.createCaller(ctx).pause(input as never) },
  { label: "customer.resume", invoke: ctx => customerSubscriptionRouter.createCaller(ctx).resume() },
  { label: "customer.startTrial", pausedMessage: ALL_TRIAL_PAUSE_MESSAGE, invoke: (ctx, input = {}) => customerSubscriptionRouter.createCaller(ctx).startTrial(input as never) },
  { label: "provider.createCheckout", invoke: (ctx, input = { tier: "basic" }) => subscriptionRouter.createCaller(ctx).createCheckout(input as never) },
  { label: "provider.createPortalSession", invoke: ctx => subscriptionRouter.createCaller(ctx).createPortalSession() },
  { label: "provider.downgrade", invoke: (ctx, input = { targetTier: "free" }) => subscriptionRouter.createCaller(ctx).downgrade(input as never) },
  { label: "provider.changeBillingInterval", invoke: (ctx, input = { interval: "year" }) => subscriptionRouter.createCaller(ctx).changeBillingInterval(input as never) },
  { label: "provider.pause", invoke: (ctx, input = {}) => subscriptionRouter.createCaller(ctx).pause(input as never) },
  { label: "provider.resume", invoke: ctx => subscriptionRouter.createCaller(ctx).resume() },
  { label: "provider.startProfessionalTrial", pausedMessage: PROVIDER_TRIAL_PAUSE_MESSAGE, invoke: (ctx, input) => subscriptionRouter.createCaller(ctx).startProfessionalTrial(input as never) },
  { label: "connect.startOnboarding", invoke: (ctx, input = { origin: ORIGIN }) => stripeConnectRouter.createCaller(ctx).startOnboarding(input as never) },
  { label: "connect.getDashboardLink", invoke: ctx => stripeConnectRouter.createCaller(ctx).getDashboardLink() },
  { label: "connect.getOnboardingLink", invoke: (ctx, input = { origin: ORIGIN }) => stripeConnectRouter.createCaller(ctx).getOnboardingLink(input as never) },
];
const readRoutes: RouteCase[] = [
  { label: "customer.getSubscription", invoke: ctx => customerSubscriptionRouter.createCaller(ctx).getSubscription() },
  { label: "customer.checkTrialStatus", invoke: ctx => customerSubscriptionRouter.createCaller(ctx).checkTrialStatus() },
  { label: "customer.billingHistory", invoke: ctx => customerSubscriptionRouter.createCaller(ctx).billingHistory() },
  { label: "provider.mySubscription", invoke: ctx => subscriptionRouter.createCaller(ctx).mySubscription() },
  { label: "provider.checkTrialStatus", invoke: ctx => subscriptionRouter.createCaller(ctx).checkTrialStatus() },
  { label: "provider.billingHistory", invoke: ctx => subscriptionRouter.createCaller(ctx).billingHistory() },
  { label: "provider.selectFreeTier", invoke: ctx => subscriptionRouter.createCaller(ctx).selectFreeTier() },
  { label: "connect.getStatus", invoke: ctx => stripeConnectRouter.createCaller(ctx).getStatus() },
];
async function expectPaused(route: RouteCase, ctx = context(), input?: unknown) {
  await expect(route.invoke(ctx, input)).rejects.toMatchObject({
    code: "PRECONDITION_FAILED", message: route.pausedMessage ?? PLATFORM_SUBSCRIPTION_PAUSE_MESSAGE,
  });
}
const roles = [
  { label: "customer", fields: { role: "customer" } },
  { label: "provider", fields: { role: "provider" } },
  { label: "user", fields: { role: "user" } },
  { label: "approved super-admin", fields: { role: "admin", adminRole: "super_admin", email: "admin@example.invalid" } },
];

describe("real subscription/Connect route pause gates", () => {
  it("imports with only three inert Stripe constructors and no credentials or I/O", () => {
    expect(process.env.NODE_ENV).toBe("test");
    expect(process.env.STRIPE_SECRET_KEY).toBe("inert-no-credentials");
    for (const key of [
      "DATABASE_URL", "STRIPE_DEV_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "JWT_SECRET",
      "AGENT_HANDOFF_SECRET", "BUILT_IN_FORGE_API_KEY", "TWILIO_AUTH_TOKEN",
      "SENDGRID_API_KEY", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY",
    ]) expect(process.env[key], `${key}: credential must be absent`).toBeUndefined();
    expect(mocks.env.databaseUrl).toBe("");
    expect(stripeInitialization).toHaveLength(3);
    for (const [key] of stripeInitialization) expect(key).toBe("inert-no-credentials");
    for (const { name, count } of importCalls) expect(count, `${name}: no import-time I/O`).toBe(0);
  });

  it("uses the actual source-controlled subscription and all-trial pause constants", () => {
    expect(PLATFORM_SUBSCRIPTIONS_PAUSED).toBe(true);
    expect(ALL_TRIALS_PAUSED).toBe(true);
    expect(PROVIDER_TRIALS_PAUSED).toBe(true);
  });

  it.each(blockedRoutes)("$label rejects selected defaults before even a DB read", async route => {
    await expectPaused(route);
  });

  const checkoutVariants = ["customer", "provider"].flatMap(kind =>
    (kind === "customer" ? ["pro", "business"] : ["basic", "premium"]).flatMap(tier =>
      [undefined, "month", "year"].flatMap(interval =>
        [undefined, true, false].map(withTrial => ({
          label: `${kind} ${tier} ${interval ?? "default interval"} withTrial=${withTrial ?? "default"}`,
          route: blockedRoutes.find(route => route.label === `${kind}.createCheckout`)!,
          input: { tier, ...(interval === undefined ? {} : { interval }), ...(withTrial === undefined ? {} : { withTrial }) },
        })),
      ),
    ),
  );
  it.each(checkoutVariants)("$label cannot start checkout/authorization/velocity tracking", async ({ route, input }) => {
    await expectPaused(route, context(), input);
  });

  const actionVariants = [
    { label: "customer trial pro", route: "customer.startTrial", input: { tier: "pro" } },
    { label: "customer trial business", route: "customer.startTrial", input: { tier: "business" } },
    { label: "provider trial empty object", route: "provider.startProfessionalTrial", input: {} },
    { label: "provider trial basic", route: "provider.startProfessionalTrial", input: { tier: "basic" } },
    { label: "provider trial premium", route: "provider.startProfessionalTrial", input: { tier: "premium" } },
    { label: "customer downgrade paid", route: "customer.downgrade", input: { targetTier: "pro" } },
    { label: "provider downgrade paid", route: "provider.downgrade", input: { targetTier: "basic" } },
    { label: "provider monthly interval", route: "provider.changeBillingInterval", input: { interval: "month" } },
    { label: "customer explicit resume date", route: "customer.pause", input: { resumeDate: "2026-11-25T12:00:00Z" } },
    { label: "provider explicit resume date", route: "provider.pause", input: { resumeDate: "2026-11-25T12:00:00Z" } },
  ];
  it.each(actionVariants)("$label cannot mutate an existing record", async ({ route: label, input }) => {
    await expectPaused(blockedRoutes.find(route => route.label === label)!, context(), input);
  });

  it.each(roles.flatMap(role => blockedRoutes.map(route => ({ role, route, label: `${role.label}: ${route.label}` }))))(
    "$label has no role-based pause bypass", async ({ role, route }) => {
      const ctx = context(role.fields);
      if (role.fields.role === "admin") expect(hasAdminClearance(ctx.user)).toBe(true);
      await expectPaused(route, ctx);
    },
  );

  it.each([...blockedRoutes, ...readRoutes])("$label enforces actual guest UNAUTHORIZED before any dependency", async route => {
    await expect(route.invoke(context(null))).rejects.toMatchObject({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  });
  it.each([...blockedRoutes, ...readRoutes])("$label enforces deleted-user FORBIDDEN before pause/read/free creation", async route => {
    await expect(route.invoke(context({ deletedAt: new Date("2026-11-20T00:00:00Z") })))
      .rejects.toMatchObject({ code: "FORBIDDEN", message: "This account has been suspended." });
  });
  it.each([...blockedRoutes, ...readRoutes])("$label denies even an approved but deleted admin", async route => {
    const ctx = context({ ...roles[3].fields, deletedAt: new Date("2026-11-20T00:00:00Z") });
    expect(hasAdminClearance(ctx.user)).toBe(true);
    await expect(route.invoke(ctx)).rejects.toMatchObject({ code: "FORBIDDEN", message: "This account has been suspended." });
  });

  it.each(blockedRoutes)("$label ignores forged bypass headers on valid inputs", async route => {
    const ctx = context(roles[3].fields);
    Object.assign(ctx.req.headers, {
      "x-platform-subscriptions-paused": "false", "x-all-trials-paused": "false", "x-admin-bypass": "true",
    });
    await expectPaused(route, ctx);
  });

  it("concurrent mixed authenticated attempts do not consume velocity state or reach DB/Stripe", async () => {
    const results = await Promise.allSettled(Array.from({ length: 64 }, (_, index) =>
      blockedRoutes[index % blockedRoutes.length].invoke(context(roles[index % roles.length].fields)),
    ));
    expect(results).toHaveLength(64);
    for (let index = 0; index < results.length; index++) {
      const result = results[index];
      expect(result.status).toBe("rejected");
      if (result.status === "rejected") {
        expect(result.reason).toBeInstanceOf(TRPCError);
        expect(result.reason).toMatchObject({
          code: "PRECONDITION_FAILED",
          message: blockedRoutes[index % blockedRoutes.length].pausedMessage ?? PLATFORM_SUBSCRIPTION_PAUSE_MESSAGE,
        });
      }
    }
  });
});

// Absolute synthetic dates plus a fixed Date clock make expiry/milestones
// independent of the runner's wall clock. Every row retains its Stripe IDs.
const snapshotCases = [
  { label: "active paid", status: "active", state: "active", paid: true },
  { label: "scheduled cancellation", status: "active", cancelAtPeriodEnd: true, state: "cancelling", paid: true },
  { label: "expired trial", status: "trialing", trialEndsAt: "2026-11-20T12:00:00Z", state: "trial_expired", paid: false, expired: true, days: 0 },
  { label: "trial exactly at expiry", status: "trialing", trialEndsAt: NOW, state: "trial_expired", paid: false, expired: true, days: 0 },
  { label: "trial at 7-day milestone", status: "trialing", trialEndsAt: "2026-11-28T12:00:00Z", state: "trialing", paid: true, days: 7 },
  { label: "trial at 3-day milestone", status: "trialing", trialEndsAt: "2026-11-24T12:00:00Z", state: "trialing", paid: true, days: 3 },
  { label: "trial at 1-day milestone", status: "trialing", trialEndsAt: "2026-11-22T12:00:00Z", state: "trialing", paid: true, days: 1 },
  { label: "trial without expiry", status: "trialing", state: "trial_expired", paid: false },
  { label: "paused paid", status: "paused", state: "paused", paid: false },
  { label: "canceled paid", status: "cancelled", state: "cancelled", paid: false },
  { label: "legacy canceled spelling", status: "canceled", state: "cancelled", paid: false },
  { label: "legacy canceled with purchased future period", status: "cancelled", cancelAtPeriodEnd: true, state: "cancelling", paid: true },
  { label: "past-due grace", status: "past_due", state: "past_due_grace", paid: true },
  { label: "past-due expired access", status: "past_due", currentPeriodEnd: "2026-11-20T12:00:00Z", state: "past_due_suspended", paid: false },
  { label: "incomplete paid", status: "incomplete", state: "incomplete", paid: false },
  { label: "historical trial on active paid", status: "active", trialEndsAt: "2026-11-01T12:00:00Z", state: "active", paid: true, days: 0 },
  { label: "free active", status: "active", free: true, state: "free", paid: false },
  { label: "free paused", status: "paused", free: true, state: "free", paid: false },
  { label: "free canceled", status: "cancelled", free: true, state: "free", paid: false },
] as const;
type SnapshotCase = (typeof snapshotCases)[number];
function subscriptionRecord(kind: "customer" | "provider", fixture: SnapshotCase, tierOverride?: string) {
  const fields = fixture as SnapshotCase & {
    trialEndsAt?: string; currentPeriodEnd?: string; cancelAtPeriodEnd?: boolean; free?: boolean;
  };
  return preserve({
    id: kind === "customer" ? 73001 : 74001,
    ...(kind === "customer" ? { userId: USER_ID } : { providerId: PROVIDER_ID }),
    tier: fields.free ? "free" : tierOverride ?? (kind === "customer" ? "business" : "premium"),
    status: fields.status, trialEndsAt: fields.trialEndsAt ? new Date(fields.trialEndsAt) : null,
    currentPeriodStart: new Date("2026-11-01T12:00:00Z"),
    currentPeriodEnd: new Date(fields.currentPeriodEnd ?? "2026-12-21T12:00:00Z"),
    cancelAtPeriodEnd: fields.cancelAtPeriodEnd ?? false,
    stripeSubscriptionId: `sub_inert_retained_${kind}`, stripeCustomerId: `cus_inert_retained_${kind}`,
    pausedAt: fields.status === "paused" ? new Date("2026-11-19T12:00:00Z") : null,
    resumesAt: fields.status === "paused" ? new Date("2026-11-25T12:00:00Z") : null,
    createdAt: new Date("2026-11-01T12:00:00Z"), updatedAt: new Date("2026-11-19T12:00:00Z"),
  });
}
function allowProviderLookup() {
  allow(mocks.db.getProviderByUserId, preserve(providerFixture));
}
function allowSubscriptionRead(kind: "customer" | "provider", record: unknown) {
  if (kind === "provider") allowProviderLookup();
  allow(kind === "customer" ? mocks.db.getCustomerSubscription : mocks.db.getProviderSubscription, record);
}
const bothSnapshots = ["customer", "provider"].flatMap(kind => snapshotCases.map(fixture => ({
  kind: kind as "customer" | "provider", fixture, label: `${kind}: ${fixture.label}`,
})));

describe("paused subscription summary/trial queries preserve frozen historical rows", () => {
  it.each(bothSnapshots)("$label summary is local-only and never clears retained Stripe references", async ({ kind, fixture }) => {
    const record = subscriptionRecord(kind, fixture);
    const effectiveTier = fixture.paid ? record.tier : "free";
    allowSubscriptionRead(kind, record);
    allow(kind === "customer" ? mocks.db.getCustomerTier : mocks.db.getProviderTier, effectiveTier);
    allow(kind === "customer" ? mocks.db.getUserFavoriteCount : mocks.db.getActiveServiceCount, 2);
    const result = kind === "customer"
      ? await customerSubscriptionRouter.createCaller(context()).getSubscription()
      : await subscriptionRouter.createCaller(context({ role: "provider" })).mySubscription();
    expect(result?.subscription).toBe(record);
    expect(result?.currentInterval).toBe("month");
    expect(result?.billingIntervalVerified).toBe(false);
    expect(result?.currentTier).toBe(effectiveTier);
    expect(result?.entitlement).toMatchObject({
      configuredTier: record.tier, effectiveTier, state: fixture.state, hasPaidAccess: fixture.paid,
    });
    expect(result?.tierConfig).toEqual(kind === "customer"
      ? CUSTOMER_PLANS[effectiveTier as keyof typeof CUSTOMER_PLANS]
      : PROVIDER_PLANS[effectiveTier as keyof typeof PROVIDER_PLANS]);
    expect(record.stripeSubscriptionId).toBe(`sub_inert_retained_${kind}`);
    // retrieve throws resource_missing if called, but a swallowed error still
    // fails the exact zero-call oracle; clearReference must also stay uncalled.
    expect(mocks.stripe.subscriptionRetrieve).not.toHaveBeenCalled();
    expect(kind === "customer" ? mocks.db.clearCustomerStripeSubscriptionReference : mocks.db.clearProviderStripeSubscriptionReference)
      .not.toHaveBeenCalled();
  });

  it.each(bothSnapshots)("$label trial status derives access without normalization or milestone reminders", async ({ kind, fixture }) => {
    const record = subscriptionRecord(kind, fixture);
    allowSubscriptionRead(kind, record);
    const fields = fixture as SnapshotCase & { days?: number; expired?: boolean };
    const result = kind === "customer"
      ? await customerSubscriptionRouter.createCaller(context()).checkTrialStatus()
      : await subscriptionRouter.createCaller(context({ role: "provider" })).checkTrialStatus();
    expect(result).toMatchObject({
      isTrialing: fixture.state === "trialing", trialExpired: fields.expired ?? false,
      daysRemaining: fields.days ?? 0, trialEndsAt: record.trialEndsAt,
      currentTier: fixture.paid ? record.tier : "free", showUrgentNudge: false,
      hasUsedTrial: record.trialEndsAt !== null, reviewPaused: true,
      entitlement: { state: fixture.state, hasPaidAccess: fixture.paid },
    });
    if (kind === "customer") expect(result).toHaveProperty("requiresPayment", false);
    else expect(result).toHaveProperty("trialTier", record.tier);
    expect(mocks.trials.checkAndSendTrialMilestoneNotification).not.toHaveBeenCalled();
  });

  it.each(["customer", "provider"] as const)("%s summaries preserve lower paid tiers too", async kind => {
    const record = subscriptionRecord(kind, snapshotCases[0], kind === "customer" ? "pro" : "basic");
    allowSubscriptionRead(kind, record);
    allow(kind === "customer" ? mocks.db.getCustomerTier : mocks.db.getProviderTier, record.tier);
    allow(kind === "customer" ? mocks.db.getUserFavoriteCount : mocks.db.getActiveServiceCount, 0);
    const result = kind === "customer"
      ? await customerSubscriptionRouter.createCaller(context()).getSubscription()
      : await subscriptionRouter.createCaller(context()).mySubscription();
    expect(result?.subscription).toBe(record);
    expect(result?.billingIntervalVerified).toBe(false);
    expect(result?.entitlement).toMatchObject({ effectiveTier: record.tier, state: "active" });
  });

  it.each(["customer", "provider"] as const)("%s missing trial subscription returns null without creating one", async kind => {
    allowSubscriptionRead(kind, null);
    const result = kind === "customer"
      ? await customerSubscriptionRouter.createCaller(context()).checkTrialStatus()
      : await subscriptionRouter.createCaller(context()).checkTrialStatus();
    expect(result).toBeNull();
  });

  it.each(["mySubscription", "checkTrialStatus"] as const)("provider %s without profile returns null without subscription lookup", async route => {
    allow(mocks.db.getProviderByUserId, null);
    expect(await subscriptionRouter.createCaller(context())[route]()).toBeNull();
  });

  it.each(["customer", "provider"] as const)("%s missing summary subscription is read-only free access", async kind => {
    allowSubscriptionRead(kind, null);
    allow(kind === "customer" ? mocks.db.getCustomerTier : mocks.db.getProviderTier, "free");
    allow(kind === "customer" ? mocks.db.getUserFavoriteCount : mocks.db.getActiveServiceCount, 0);
    const result = kind === "customer"
      ? await customerSubscriptionRouter.createCaller(context()).getSubscription()
      : await subscriptionRouter.createCaller(context()).mySubscription();
    expect(result).toMatchObject({ subscription: null, currentTier: "free", currentInterval: "month", billingIntervalVerified: false, entitlement: { state: "free", hasPaidAccess: false } });
  });

  it.each(bothSnapshots)("$label billing history never requests live Stripe invoices", async ({ kind, fixture }) => {
    const record = subscriptionRecord(kind, fixture);
    allowSubscriptionRead(kind, record);
    const result = kind === "customer"
      ? await customerSubscriptionRouter.createCaller(context()).billingHistory({ limit: 100, startingAfter: "in_inert_cursor" })
      : await subscriptionRouter.createCaller(context()).billingHistory({ limit: 100, startingAfter: "in_inert_cursor" });
    expect(result).toMatchObject({ hasMore: false, nextCursor: null, stripeHistoryUnavailable: true });
    expect(result.items).toContainEqual(expect.objectContaining({
      id: `plan_${kind === "customer" ? USER_ID : PROVIDER_ID}`,
      type: "subscription_change", status: record.status, amount: null, invoicePdfUrl: null,
    }));
    if (record.status === "trialing" && record.trialEndsAt) {
      expect(result.items).toContainEqual(expect.objectContaining({
        id: `trial_${kind === "customer" ? USER_ID : PROVIDER_ID}`,
        type: "trial", amount: null, invoicePdfUrl: null,
        status: record.trialEndsAt.getTime() <= Date.now() ? "ended" : "active",
      }));
    }
    expect(result.items.every(item => item.type !== "invoice" && item.type !== "payment" && item.type !== "refund")).toBe(true);
    expect(mocks.stripe.invoiceList).not.toHaveBeenCalled();
  });
});

describe("selectFreeTier preserves ANY existing row while allowing synthetic new free creation", () => {
  it.each(snapshotCases)("retains $label tier/status/dates/Stripe identifiers instead of overwriting to free", async fixture => {
    const record = subscriptionRecord("provider", fixture);
    allowSubscriptionRead("provider", record);
    await expect(subscriptionRouter.createCaller(context({ role: "provider" })).selectFreeTier())
      .resolves.toEqual({ tier: record.tier, status: record.status });
    expect(mocks.db.upsertProviderSubscription).not.toHaveBeenCalled();
  });

  it("also retains an unknown legacy status instead of normalizing it", async () => {
    const record = preserve({ ...subscriptionRecord("provider", snapshotCases[0]), status: "legacy_unclassified", tier: "basic" });
    allowSubscriptionRead("provider", record);
    await expect(subscriptionRouter.createCaller(context()).selectFreeTier())
      .resolves.toEqual({ tier: "basic", status: "legacy_unclassified" });
  });

  it("creates exactly one NEW synthetic free row with no Stripe, authz, velocity, or notifications", async () => {
    allowSubscriptionRead("provider", null);
    const syntheticWrites: unknown[] = [];
    expectedCalls.set(mocks.db.upsertProviderSubscription, 1);
    mocks.db.upsertProviderSubscription.mockImplementation(async (record: unknown) => {
      syntheticWrites.push(structuredClone(record));
    });
    await expect(subscriptionRouter.createCaller(context({ role: "provider" })).selectFreeTier())
      .resolves.toEqual({ tier: "free", status: "active" });
    expect(mocks.db.getProviderByUserId).toHaveBeenCalledWith(USER_ID);
    expect(mocks.db.getProviderSubscription).toHaveBeenCalledWith(PROVIDER_ID);
    expect(syntheticWrites).toEqual([{ providerId: PROVIDER_ID, tier: "free", status: "active" }]);
    expect(mocks.db.upsertProviderSubscription).toHaveBeenCalledWith(syntheticWrites[0]);
  });

  it("denies missing provider without creating a free row", async () => {
    allow(mocks.db.getProviderByUserId, null);
    await expect(subscriptionRouter.createCaller(context()).selectFreeTier())
      .rejects.toMatchObject({ code: "FORBIDDEN", message: "Must be a provider" });
  });
});

describe("paused Connect status is a local reference, never verified/refreshed remotely", () => {
  const connectCases = ["free", "basic", "premium"].flatMap(tier => [
    { label: `${tier} connected ready`, tier, fields: {} },
    { label: `${tier} connected restricted`, tier, fields: { stripeAccountStatus: "restricted", stripeOnboardingComplete: false, payoutEnabled: false } },
    { label: `${tier} connected legacy no status`, tier, fields: { stripeAccountStatus: null } },
    { label: `${tier} not connected`, tier, fields: { stripeAccountId: null, stripeAccountStatus: null, stripeOnboardingComplete: false, payoutEnabled: false } },
  ]);
  it.each(connectCases)("$label retains stored status but disables collection/charges/payouts", async ({ tier, fields }) => {
    const provider = preserve({ ...providerFixture, ...fields });
    allow(mocks.db.getProviderByUserId, provider);
    allow(mocks.db.getProviderTier, tier);
    await expect(stripeConnectRouter.createCaller(context({ role: "provider" })).getStatus()).resolves.toEqual({
      connected: !!provider.stripeAccountId, status: provider.stripeAccountStatus || "not_connected",
      chargesEnabled: false, payoutsEnabled: false, detailsSubmitted: !!provider.stripeOnboardingComplete,
      paymentCollectionEnabled: false, requiresPaidPlan: tier === "free", reviewPaused: true,
    });
    expect(mocks.db.getProviderByUserId).toHaveBeenCalledWith(USER_ID);
    expect(mocks.db.getProviderTier).toHaveBeenCalledWith(PROVIDER_ID);
    expect(mocks.stripe.accountRetrieve).not.toHaveBeenCalled();
    expect(mocks.db.updateProviderStripeAccount).not.toHaveBeenCalled();
  });

  it("missing provider remains NOT_FOUND with no Stripe or update", async () => {
    allow(mocks.db.getProviderByUserId, null);
    await expect(stripeConnectRouter.createCaller(context()).getStatus())
      .rejects.toMatchObject({ code: "NOT_FOUND", message: "Provider profile not found" });
  });
});

describe("DB read failures cannot trigger cleanup, free normalization, or notifications", () => {
  const failureRoutes = [
    { label: "customer summary", route: readRoutes[0], reads: [mocks.db.getCustomerSubscription, mocks.db.getCustomerTier, mocks.db.getUserFavoriteCount] },
    { label: "customer trial status", route: readRoutes[1], reads: [mocks.db.getCustomerSubscription] },
    { label: "customer history", route: readRoutes[2], reads: [mocks.db.getCustomerSubscription] },
    { label: "provider summary", route: readRoutes[3], reads: [mocks.db.getProviderByUserId, mocks.db.getProviderSubscription, mocks.db.getProviderTier, mocks.db.getActiveServiceCount] },
    { label: "provider trial status", route: readRoutes[4], reads: [mocks.db.getProviderByUserId, mocks.db.getProviderSubscription] },
    { label: "provider history", route: readRoutes[5], reads: [mocks.db.getProviderByUserId, mocks.db.getProviderSubscription] },
    { label: "provider selectFreeTier", route: readRoutes[6], reads: [mocks.db.getProviderByUserId, mocks.db.getProviderSubscription] },
    { label: "Connect status", route: readRoutes[7], reads: [mocks.db.getProviderByUserId, mocks.db.getProviderTier] },
  ];
  const failureCases = failureRoutes.flatMap(entry => entry.reads.map((_, failureIndex) => ({
    ...entry, failureIndex, label: `${entry.label}: read ${failureIndex + 1} fails`,
  })));
  it.each(failureCases)("$label propagates failure without subsequent reads or writes", async ({ route, reads, failureIndex }) => {
    const kind = route.label.startsWith("customer.") ? "customer" : "provider";
    const record = subscriptionRecord(kind, snapshotCases[2]);
    for (let index = 0; index <= failureIndex; index++) {
      const spy = reads[index];
      allow(spy, spy === mocks.db.getProviderByUserId ? preserve(providerFixture)
        : spy === mocks.db.getCustomerTier || spy === mocks.db.getProviderTier ? "free" : record);
    }
    const failure = new Error("Synthetic DB read unavailable; no real database");
    reads[failureIndex].mockRejectedValue(failure as never);
    await expect(route.invoke(context())).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR", message: failure.message });
  });
});

function scheduledResponse() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}
function scheduledRequest(): Request {
  return {
    url: "/api/scheduled/trial-expiry", method: "POST",
    headers: { authorization: "Bearer synthetic-not-a-real-token", "x-cron": "true" },
    body: { isCron: true, taskUid: "forged-client-task" },
  } as unknown as Request;
}

describe("scheduled trial expiry authenticates cron before returning paused, never acquiring DB", () => {
  it("SDK-authenticated cron with taskUid returns exact paused zero-processing JSON", async () => {
    const req = scheduledRequest();
    const res = scheduledResponse();
    allow(mocks.sdk.authenticateRequest, { id: USER_ID, isCron: true, taskUid: "synthetic-authorized-cron-task" });
    res.json.mockImplementation(() => {
      expect(mocks.sdk.authenticateRequest).toHaveBeenCalledTimes(1);
      expect(mocks.sdk.authenticateRequest).toHaveBeenCalledWith(req);
      expect(mocks.connection.getDb).not.toHaveBeenCalled();
      return res;
    });
    const result = await handleScheduledTrialExpiry(req, res as unknown as Response);
    expect(result).toBe(res);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({
      ok: true, paused: true, customerTrialsExpired: 0, providerTrialsExpired: 0,
      notificationsSent: 0, errors: [], processedAt: NOW,
    });
  });

  it.each([
    { label: "non-cron with a task", identity: { isCron: false, taskUid: "synthetic-task" } },
    { label: "non-cron without a task", identity: { isCron: false } },
    { label: "cron missing taskUid", identity: { isCron: true } },
    { label: "cron empty taskUid", identity: { isCron: true, taskUid: "" } },
    { label: "cron null taskUid", identity: { isCron: true, taskUid: null } },
    { label: "admin without cron authority", identity: { role: "admin", adminRole: "super_admin", taskUid: "synthetic-task" } },
  ])("$label is denied despite forged cron body/header flags", async ({ identity }) => {
    const req = scheduledRequest();
    const res = scheduledResponse();
    allow(mocks.sdk.authenticateRequest, { id: USER_ID, ...identity });
    await handleScheduledTrialExpiry(req, res as unknown as Response);
    expect(mocks.sdk.authenticateRequest).toHaveBeenCalledWith(req);
    expect(res.status).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({ error: "cron-only" });
  });

  it("authentication failure returns the existing error response with no DB acquisition", async () => {
    const req = scheduledRequest();
    const res = scheduledResponse();
    const error = new Error("Synthetic authentication rejected");
    expectedCalls.set(mocks.sdk.authenticateRequest, 1);
    mocks.sdk.authenticateRequest.mockRejectedValue(error as never);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await handleScheduledTrialExpiry(req, res as unknown as Response);
      expect(mocks.sdk.authenticateRequest).toHaveBeenCalledWith(req);
      // The real handler currently catches authentication errors as HTTP 500,
      // not 401/403. Assert the actual contract, not an idealized replacement.
      expect(res.status).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledTimes(1);
      expect(res.json).toHaveBeenCalledWith({
        error: error.message, stack: error.stack,
        context: { url: req.url, taskUid: undefined }, timestamp: NOW,
      });
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalledWith("[ScheduledTrialExpiry] Fatal error:", error);
    } finally { consoleError.mockRestore(); }
  });
});
