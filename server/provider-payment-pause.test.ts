import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

// Install before importing application modules. No sockets, HTTP, DNS, fetch,
// Stripe SDK, DB driver, authentication SDK, PDF storage, or notifications run.
const transportGuards = await vi.hoisted(async () => {
  const { default: net } = await import("node:net");
  const { default: http } = await import("node:http");
  const { default: https } = await import("node:https");
  const { default: tls } = await import("node:tls");
  const { default: dns } = await import("node:dns");
  const deny = () => {
    throw new Error("Hermetic payment-pause test forbids all network transports");
  };
  const guards = {
    socketConnect: vi.spyOn(net.Socket.prototype, "connect").mockImplementation(deny),
    httpRequest: vi.spyOn(http, "request").mockImplementation(deny),
    httpGet: vi.spyOn(http, "get").mockImplementation(deny),
    httpsRequest: vi.spyOn(https, "request").mockImplementation(deny),
    httpsGet: vi.spyOn(https, "get").mockImplementation(deny),
    tlsConnect: vi.spyOn(tls, "connect").mockImplementation(deny),
    dnsLookup: vi.spyOn(dns, "lookup").mockImplementation(deny),
    dnsPromiseLookup: vi.spyOn(dns.promises, "lookup").mockImplementation(deny),
    fetch: vi.fn(deny),
    webSocket: vi.fn(deny),
  };
  vi.stubGlobal("fetch", guards.fetch);
  vi.stubGlobal("WebSocket", guards.webSocket);
  return guards;
});

const mocks = vi.hoisted(() => {
  const forbidden = (name: string) => vi.fn(() => {
    throw new Error(`Payment-pause gate must stop before ${name}`);
  });
  return {
    stripeConstructor: vi.fn(),
    stripe: {
      checkoutSessionCreate: forbidden("Stripe Checkout"),
      customerCreate: forbidden("Stripe Customer"),
      paymentIntentCreate: forbidden("Stripe PaymentIntent"),
      chargeCreate: forbidden("Stripe Charge"),
      transferCreate: forbidden("Stripe Transfer"),
      payoutCreate: forbidden("Stripe Payout"),
    },
    db: {
      getDb: forbidden("DB acquisition"),
      getBookingById: vi.fn(),
      getPaymentByBookingId: vi.fn(),
      getServiceById: vi.fn(),
      getProviderById: vi.fn(),
      getProviderTier: vi.fn(),
      getProviderSubscription: vi.fn(),
      getUserById: vi.fn(),
      getCustomerSubscription: vi.fn(),
      updateUserStripeCustomerId: forbidden("Stripe Customer persistence"),
      updateBookingStatus: forbidden("booking paid/status mutation"),
      createNotification: forbidden("booking notification"),
    },
    referrals: {
      getReferralCreditBalance: vi.fn(),
      spendReferralCredits: forbidden("credit spending"),
    },
    invoiceDb: {
      getInvoiceById: vi.fn(),
      getNextInvoiceNumber: forbidden("invoice numbering"),
      createInvoice: forbidden("invoice creation"),
      getInvoicesByProvider: forbidden("provider invoice read"),
      getInvoicesByCustomer: forbidden("customer invoice read"),
      updateInvoiceStatus: forbidden("invoice paid/status/session mutation"),
      updateInvoicePdfUrl: forbidden("invoice PDF persistence"),
    },
    providerDb: { getProviderByUserId: vi.fn() },
    userDb: { getUserById: vi.fn(), getUserByEmail: vi.fn() },
    paymentDb: { getProviderTier: vi.fn() },
    authorization: {
      assertPaymentActorCanInitiate: forbidden("handler actor authorization"),
      assertProviderCanCollectPayments: forbidden("handler provider authorization"),
    },
    velocity: {
      assertPaymentVelocityAllowed: forbidden("velocity read/counter/write"),
      throwIfPaymentVelocityBlocked: forbidden("handler velocity result"),
    },
    crm: { queueCrmInvoiceProjection: forbidden("CRM projection"), },
    pdf: { generateInvoicePdf: forbidden("PDF generation/storage"), },
    notifications: { sendNotification: forbidden("notification transport"), },
    entitlements: { providerHasFeature: forbidden("handler tier entitlement"), },
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
    checkout = { sessions: { create: mocks.stripe.checkoutSessionCreate } };
    customers = { create: mocks.stripe.customerCreate };
    paymentIntents = { create: mocks.stripe.paymentIntentCreate };
    charges = { create: mocks.stripe.chargeCreate };
    transfers = { create: mocks.stripe.transferCreate };
    payouts = { create: mocks.stripe.payoutCreate };
  },
}));
vi.mock("./_core/env", () => ({ ENV: mocks.env }));
vi.mock("./db", () => mocks.db);
vi.mock("./db-legacy", () => mocks.db);
vi.mock("./db/connection", () => ({ getDb: mocks.db.getDb }));
vi.mock("./db/referrals", () => mocks.referrals);
vi.mock("./db/invoices", () => mocks.invoiceDb);
vi.mock("./db/providers", () => mocks.providerDb);
vi.mock("./db/users", () => mocks.userDb);
vi.mock("./db/payments", () => mocks.paymentDb);
vi.mock("./paymentAuthorization", () => mocks.authorization);
vi.mock("./paymentVelocity", () => mocks.velocity);
vi.mock("./crm/sourceHooks", () => mocks.crm);
vi.mock("./services/invoicePdf", () => mocks.pdf);
vi.mock("./notifications", () => mocks.notifications);
vi.mock("@shared/entitlements", () => mocks.entitlements);
vi.mock("mysql2", () => ({ ...mocks.driver, default: mocks.driver }));
vi.mock("mysql2/promise", () => ({ ...mocks.driver, default: mocks.driver }));

// Only the small routers and real protected middleware are imported: never
// appRouter/createContext/server startup or the project's dangerous global setup.
import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "./_core/context";
import { router } from "./_core/trpc";
import { hasAdminClearance } from "./adminPolicy";
import { stripeRouter } from "./stripeRouter";
import { invoiceRouter } from "./invoiceRouter";
import { assertProviderPaymentCollectionOpen } from "./providerPaymentPause";
import {
  PROVIDER_PAYMENTS_PAUSED,
  PROVIDER_PAYMENT_PAUSE_MESSAGE,
  getProviderPaymentCollectionStatus,
} from "../shared/providerPaymentPause";
import { UNAUTHED_ERR_MSG } from "../shared/const";

const testRouter = router({ stripe: stripeRouter, invoice: invoiceRouter });
const stripeInitialization = mocks.stripeConstructor.mock.calls.map(args => [...args]);
const sideEffectGroups = {
  db: mocks.db, referrals: mocks.referrals, invoiceDb: mocks.invoiceDb,
  providerDb: mocks.providerDb, userDb: mocks.userDb, paymentDb: mocks.paymentDb,
  authorization: mocks.authorization, velocity: mocks.velocity, stripe: mocks.stripe,
  crm: mocks.crm, pdf: mocks.pdf, notifications: mocks.notifications,
  entitlements: mocks.entitlements, driver: mocks.driver,
};

const CUSTOMER_ID = 101;
const booking = {
  id: 9001, bookingNumber: "HERMETIC-9001", customerId: CUSTOMER_ID,
  providerId: 501, serviceId: 701, totalAmount: "100.00", depositAmount: "25.00",
  status: "pending", paidAt: null,
};
const service = { id: 701, name: "Synthetic service", depositRequired: false };
const provider = {
  id: 501, userId: 201, isOfficial: false, isActive: true, deletedAt: null,
  stripeAccountId: "acct_inert_fixture", payoutEnabled: true,
};
const invoice = {
  id: 8001, invoiceNumber: "HERMETIC-8001", providerId: provider.id,
  customerId: CUSTOMER_ID, status: "sent", total: 10000, paidAt: null,
  stripeCheckoutSessionId: null,
  lineItems: [{ description: "Synthetic invoice", unitPrice: 10000, quantity: "1" }],
};
const user = {
  id: CUSTOMER_ID, openId: "hermetic-customer", name: "Synthetic customer",
  email: "customer@example.invalid", role: "customer", adminRole: null, deletedAt: null,
};

function ctx(userOverride: Record<string, unknown> | null = {}): TrpcContext {
  return {
    user: userOverride === null ? null : { ...user, ...userOverride },
    req: { headers: { origin: "https://app.example.invalid" }, ip: "192.0.2.1" },
    res: {},
  } as unknown as TrpcContext;
}

type PaymentRoute = "checkout" | "preview" | "invoice";
const routes: PaymentRoute[] = ["checkout", "preview", "invoice"];
function invoke(route: PaymentRoute, context = ctx(), input?: unknown) {
  const caller = testRouter.createCaller(context);
  switch (route) {
    case "checkout": return caller.stripe.createCheckoutSession(
      (input === undefined ? { bookingId: booking.id, useCredits: true } : input) as never,
    );
    case "preview": return caller.stripe.previewCreditDiscount(
      (input === undefined ? { bookingId: booking.id } : input) as never,
    );
    case "invoice": return caller.invoice.getPaymentLink(
      (input === undefined ? { invoiceId: invoice.id } : input) as never,
    );
  }
}

async function expectPaused(result: Promise<unknown>) {
  await expect(result).rejects.toMatchObject({
    code: "PRECONDITION_FAILED",
    message: "Online payments to providers are temporarily unavailable.",
  });
}

function expectNoSideEffects() {
  for (const [groupName, group] of Object.entries(sideEffectGroups)) {
    for (const [name, spy] of Object.entries(group)) {
      expect(spy, `${groupName}.${name} must not run`).not.toHaveBeenCalled();
    }
  }
  for (const [name, spy] of Object.entries(transportGuards)) {
    expect(spy, `${name} transport must not run`).not.toHaveBeenCalled();
  }
}

beforeEach(() => {
  vi.clearAllMocks(); // Preserve fail-fast transport implementations.
  mocks.db.getBookingById.mockResolvedValue({ ...booking });
  mocks.db.getPaymentByBookingId.mockResolvedValue(null);
  mocks.db.getServiceById.mockResolvedValue({ ...service });
  mocks.db.getProviderById.mockResolvedValue({ ...provider });
  mocks.db.getProviderTier.mockResolvedValue("basic");
  mocks.db.getProviderSubscription.mockResolvedValue({ tier: "basic", status: "active" });
  mocks.db.getUserById.mockResolvedValue({ id: CUSTOMER_ID, stripeCustomerId: null });
  mocks.db.getCustomerSubscription.mockResolvedValue(null);
  mocks.referrals.getReferralCreditBalance.mockResolvedValue("100.00");
  mocks.invoiceDb.getInvoiceById.mockResolvedValue({ ...invoice });
  mocks.providerDb.getProviderByUserId.mockResolvedValue({ ...provider });
  mocks.userDb.getUserById.mockResolvedValue({ ...user });
  mocks.userDb.getUserByEmail.mockResolvedValue(null);
  mocks.paymentDb.getProviderTier.mockResolvedValue("basic");
});

afterEach(() => {
  // Every test, including authentication failures, has a zero-side-effect oracle.
  expectNoSideEffects();
});

describe("hermetic provider payment emergency containment", () => {
  it("uses only an inert mocked Stripe constructor and a credential-free process", () => {
    expect(process.env.NODE_ENV).toBe("test");
    expect(process.env.STRIPE_SECRET_KEY).toBe("inert-no-credentials");
    for (const key of [
      "DATABASE_URL", "STRIPE_DEV_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "JWT_SECRET",
      "AGENT_HANDOFF_SECRET", "BUILT_IN_FORGE_API_KEY", "TWILIO_AUTH_TOKEN",
      "SENDGRID_API_KEY", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY",
    ]) expect(process.env[key], `${key} must be absent`).toBeUndefined();
    expect(mocks.env.databaseUrl).toBe("");
    expect(stripeInitialization).toHaveLength(2);
    for (const [key] of stripeInitialization) expect(key).toBe("inert-no-credentials");
  });

  it("keeps the source-controlled assertion fail-closed", () => {
    expect(PROVIDER_PAYMENTS_PAUSED).toBe(true);
    expect(() => assertProviderPaymentCollectionOpen()).toThrow(TRPCError);
    try {
      assertProviderPaymentCollectionOpen();
    } catch (error) {
      expect(error).toMatchObject({ code: "PRECONDITION_FAILED", message: PROVIDER_PAYMENT_PAUSE_MESSAGE });
    }
  });

  it("publishes collectionStatus without authentication, lookup, or mutation", async () => {
    const expected = {
      paused: true,
      scope: "provider_booking_and_invoice_collection",
      policyId: "provider-collection-pause-2026-11-20",
      message: "Online payments to providers are temporarily unavailable.",
      detail: "You can still browse providers, send messages, and view bookings and payment history. This pause does not mark unpaid bookings or invoices as paid.",
      automaticResume: false,
    };
    await expect(testRouter.createCaller(ctx(null)).stripe.collectionStatus()).resolves.toEqual(expected);
    expect(getProviderPaymentCollectionStatus()).toEqual(expected);
  });

  it("returns the same public status for authenticated and suspended identities", async () => {
    const publicStatus = await testRouter.createCaller(ctx(null)).stripe.collectionStatus();
    for (const context of [ctx(), ctx({ deletedAt: new Date("2026-11-20T00:00:00Z") })]) {
      await expect(testRouter.createCaller(context).stripe.collectionStatus()).resolves.toEqual(publicStatus);
    }
  });

  it.each([
    { label: "useCredits omitted", input: { bookingId: booking.id }, balance: "100.00" },
    { label: "useCredits false", input: { bookingId: booking.id, useCredits: false }, balance: "100.00" },
    { label: "useCredits true without credits", input: { bookingId: booking.id, useCredits: true }, balance: "0.00" },
    { label: "partial referral credits", input: { bookingId: booking.id, useCredits: true }, balance: "50.00" },
    { label: "credit-only exact balance", input: { bookingId: booking.id, useCredits: true }, balance: "100.00" },
    { label: "credit-only excess balance", input: { bookingId: booking.id, useCredits: true }, balance: "500.00" },
    { label: "tiny remainder credit settlement", input: { bookingId: booking.id, useCredits: true }, balance: "99.75" },
  ])("rejects booking checkout with $label before reads or settlement", async ({ input, balance }) => {
    mocks.referrals.getReferralCreditBalance.mockResolvedValue(balance);
    await expectPaused(invoke("checkout", ctx(), input));
  });

  it("rejects deposit checkout before any payment or credit calculation", async () => {
    mocks.db.getServiceById.mockResolvedValue({ ...service, depositRequired: true });
    await expectPaused(invoke("checkout"));
  });

  it("rejects the credit preview before booking/service/balance reads", async () => {
    await expectPaused(invoke("preview"));
  });

  it("rejects invoice.getPaymentLink before invoice reads or session persistence", async () => {
    await expectPaused(invoke("invoice"));
  });

  const roleCases = [
    { label: "user", fields: { role: "user" } },
    { label: "customer", fields: { role: "customer" } },
    { label: "provider", fields: { role: "provider" } },
    { label: "approved super-admin", fields: { role: "admin", adminRole: "super_admin", email: "admin@example.invalid" } },
  ];
  it.each(roleCases.flatMap(roleCase => routes.map(route => ({ ...roleCase, route }))))(
    "$label cannot bypass $route containment",
    async ({ fields, route }) => {
      if (fields.role === "admin") expect(hasAdminClearance(ctx(fields).user)).toBe(true);
      await expectPaused(invoke(route, ctx(fields)));
    },
  );

  it.each([
    { label: "official/demo", fixture: { ...provider, isOfficial: true, stripeAccountId: null, payoutEnabled: false } },
    { label: "paid payout-ready", fixture: { ...provider } },
    { label: "inactive", fixture: { ...provider, isActive: false } },
    { label: "different provider", fixture: { ...provider, id: 999, userId: CUSTOMER_ID } },
  ])("does not let a $label provider bypass or mark a booking paid", async ({ fixture }) => {
    mocks.db.getProviderById.mockResolvedValue(fixture);
    await expectPaused(invoke("checkout"));
  });

  it.each(routes)("authentication takes precedence over the pause on %s", async route => {
    await expect(invoke(route, ctx(null))).rejects.toMatchObject({
      code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG,
    });
  });

  // Application suspendUser uses deletedAt, not an isSuspended schema field.
  it.each(routes)("suspended/deleted account denial takes precedence on %s", async route => {
    await expect(invoke(route, ctx({ deletedAt: new Date("2026-11-20T00:00:00Z") }))).rejects.toMatchObject({
      code: "FORBIDDEN", message: "This account has been suspended.",
    });
  });

  it.each(routes)("even a suspended admin is denied before the pause on %s", async route => {
    await expect(invoke(route, ctx({
      role: "admin", adminRole: "super_admin", email: "admin@example.invalid",
      deletedAt: new Date("2026-11-20T00:00:00Z"),
    }))).rejects.toMatchObject({ code: "FORBIDDEN", message: "This account has been suspended." });
  });

  const malformedInputs = [
    { label: "null", value: null },
    { label: "missing ID", value: {} },
    { label: "string IDs and non-boolean credits", value: { bookingId: "9001", invoiceId: "8001", useCredits: "false" } },
    { label: "array", value: [] },
    { label: "non-finite IDs", value: { bookingId: Number.NaN, invoiceId: Number.POSITIVE_INFINITY } },
  ];
  it.each(malformedInputs.flatMap(input => routes.map(route => ({ ...input, route }))))(
    "malformed $label input cannot bypass $route or reach parsing/handler",
    async ({ value, route }) => { await expectPaused(invoke(route, ctx(), value)); },
  );

  it.each(routes)("missing raw input is still rejected by the pause before %s parsing", async route => {
    const caller = testRouter.createCaller(ctx());
    const noInput = undefined as never;
    const result = route === "checkout" ? caller.stripe.createCheckoutSession(noInput)
      : route === "preview" ? caller.stripe.previewCreditDiscount(noInput)
      : caller.invoice.getPaymentLink(noInput);
    await expectPaused(result);
  });

  it.each(routes)("malformed %s input preserves authentication and suspension precedence", async route => {
    await expect(invoke(route, ctx(null), null)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(invoke(route, ctx({ deletedAt: new Date("2026-11-20T00:00:00Z") }), null))
      .rejects.toMatchObject({ code: "FORBIDDEN", message: "This account has been suspended." });
  });

  it.each(routes)("client override fields and headers cannot reopen %s", async route => {
    const context = ctx();
    context.req.headers["x-provider-payments-paused"] = "false";
    context.req.headers["x-admin-bypass"] = "true";
    await expectPaused(invoke(route, context, {
      bookingId: booking.id, invoiceId: invoice.id, useCredits: true,
      paused: false, providerPaymentsPaused: false, bypass: true,
      isAdmin: true, isOfficial: true, providerId: provider.id,
    }));
  });

  it.each(routes)("repeated %s requests reject without consuming credit or velocity state", async route => {
    for (let attempt = 0; attempt < 20; attempt++) await expectPaused(invoke(route));
  });

  it("rejects 90 concurrent mixed checkout/preview/invoice requests with zero side effects", async () => {
    const results = await Promise.allSettled(Array.from({ length: 90 }, (_, index) => {
      const route = routes[index % routes.length];
      const roleCase = roleCases[index % roleCases.length];
      return invoke(route, ctx(roleCase.fields));
    }));
    expect(results).toHaveLength(90);
    for (const result of results) {
      expect(result.status).toBe("rejected");
      if (result.status === "rejected") {
        expect(result.reason).toBeInstanceOf(TRPCError);
        expect(result.reason).toMatchObject({ code: "PRECONDITION_FAILED", message: PROVIDER_PAYMENT_PAUSE_MESSAGE });
      }
    }
  });
});
