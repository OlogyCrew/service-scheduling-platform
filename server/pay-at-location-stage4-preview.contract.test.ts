import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const booking = read("server/routers/bookingRouter.ts");
const provider = read("server/routers/providerRouter.ts");
const offlineRouter = read("server/routers/offlinePaymentRouter.ts");
const helper = read("server/db/offlinePayments.ts");
const schema = read("drizzle/schema.ts");
const migration = read("drizzle/0071_late_jigsaw.sql");
const serviceDetail = read("client/src/pages/ServiceDetail.tsx");
const myQuotes = read("client/src/pages/MyQuotes.tsx");
const customerQuotes = read("client/src/pages/MyBookings.tsx");
const stripe = read("server/stripeWebhook.ts");

const section = (source: string, start: string, end: string) => {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  return source.slice(from, to < 0 ? source.length : to);
};

describe("Stage 4 Pay-at-Location preview contracts", () => {
  it("supports online-default payment selection in direct, multi-day, recurring, and quote flows", () => {
    expect(booking.match(/paymentMethod: z\.enum\(\["online", "pay_at_location"\]\)\.default\("online"\)/g)).toHaveLength(3);
    expect(provider).toContain('paymentMethod: z.enum(["online", "pay_at_location"]).default("online")');
    expect(serviceDetail).toContain("createMultiDay.mutate");
    expect(serviceDetail).toContain("createRecurring.mutate");
    expect(serviceDetail).toContain('paymentMethod: paymentChoice === "pay_at_location" ? "pay_at_location" : "online"');
    expect(myQuotes).toContain('paymentMethod: quotePaymentChoices[quote.id] || "online"');
    expect(customerQuotes).toContain('paymentMethod: quotePaymentChoices[quote.id] || "online"');
  });

  it("validates provider settings and eligible service IDs server-side", () => {
    expect(helper).toContain("assertPayAtLocationEligible");
    expect(helper).toContain("settings.serviceIds.includes(serviceId)");
    expect(booking).toContain("db.assertPayAtLocationEligible(providerId, service.id)");
    expect(provider).toContain("db.assertPayAtLocationEligible(quote.providerId, service.id)");
    expect(offlineRouter).toContain("getProviderSettingsForService");
    expect(serviceDetail).toContain("getProviderSettingsForService.useQuery");
  });

  it("creates one ledger obligation for each aggregate parent booking, using server totals", () => {
    const multiDay = section(booking, "createMultiDay:", "createRecurring:");
    const recurring = section(booking, "createRecurring:", "// Get sessions");
    expect(multiDay).toContain("createOfflinePayment(bookingId, totalAmount)");
    expect(recurring).toContain("createOfflinePayment(bookingId, totalAmount)");
    expect(multiDay).not.toContain("sessions.map");
    expect(recurring).not.toContain("sessions.map");
    expect(schema).toContain("bookingId: int(\"bookingId\").notNull().unique()");
    expect(migration).toContain("UNIQUE(`bookingId`)");
  });

  it("keeps ledger creation duplicate-safe and stale transitions conditional", () => {
    expect(helper).toContain("const existing = await db.select().from(offlineBookingPayments)");
    expect(helper).toContain("afterRace");
    expect(helper).toContain("eq(offlineBookingPayments.bookingId, bookingId)");
    expect(helper).toContain('eq(offlineBookingPayments.status, "due")');
    expect(helper).toContain("Full payment or full waiver is required");
    expect(helper).toContain("A waiver reason is required");
  });

  it("preserves provider-only settlement, audit actions, and customer read-only status", () => {
    expect(offlineRouter).toContain("confirmPayment");
    expect(offlineRouter).toContain("waivePayment");
    expect(offlineRouter).toContain("mutate ? (!ownsProvider && !admin)");
    expect(offlineRouter).toContain('action: "confirm_pay_at_location_payment"');
    expect(offlineRouter).toContain('action: "waive_pay_at_location_payment"');
    expect(offlineRouter).toContain("getForBooking");
    expect(offlineRouter).toContain("booking.customerId !== user.id");
    expect(myQuotes).not.toContain("confirmPayment");
    expect(customerQuotes).not.toContain("confirmPayment");
  });

  it("keeps all four offline paths Stripe-free and excludes offline tables from webhook code", () => {
    for (const source of [booking, provider]) {
      expect(source).not.toContain("createCheckoutSession");
    }
    expect(booking).toContain("createOfflinePayment(bookingId, totalAmount)");
    expect(provider).toContain("createOfflinePayment(bookingId, totalAmount)");
    expect(stripe).not.toContain("offlineBookingPayments");
    expect(stripe).not.toContain("offline_booking_payments");
    expect(offlineRouter).not.toContain("stripe");
  });

  it("keeps historical bookings untouched and disabled settings readable", () => {
    expect(helper).not.toContain("update(bookings)");
    expect(helper).not.toContain("delete(offlineBookingPayments)");
    expect(offlineRouter).toContain("return db.getOfflinePaymentForBooking(input.bookingId)");
    expect(helper).toContain("enabled: false");
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN|INDEX)/i);
    expect(migration).not.toContain("ALTER TABLE `bookings`");
    expect(migration).not.toContain("ALTER TABLE `payments`");
  });

  it("passes migration identifier, FK, index, and additive-table review", () => {
    const identifiers = [...migration.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
    expect(Math.max(...identifiers.map((identifier) => identifier.length))).toBeLessThanOrEqual(64);
    expect(migration).toContain("offline_booking_payments_bookingId_bookings_id_fk");
    expect(migration).toContain("provider_pay_location_services_provider_fk");
    expect(migration).toContain("provider_pay_location_services_service_fk");
    expect(migration).toContain("provider_pay_location_settings_provider_fk");
    expect(migration).toContain("offline_payment_status_idx");
    expect(migration).toContain("provider_pay_location_service_unique");
  });
});
