import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const schema = readFileSync("drizzle/schema.ts", "utf8");
const router = readFileSync("server/routers/offlinePaymentRouter.ts", "utf8");
const helper = readFileSync("server/db/offlinePayments.ts", "utf8");
const booking = readFileSync("server/routers/bookingRouter.ts", "utf8");
const migration = readFileSync("drizzle/0071_late_jigsaw.sql", "utf8");

describe("Pay-at-Location source contracts", () => {
  it("uses separate additive tables and a checked-in migration", () => {
    expect(schema).toContain("offlineBookingPayments");
    expect(schema).toContain("providerPayAtLocationSettings");
    expect(schema).toContain("providerPayAtLocationServices");
    expect(migration).toContain("CREATE TABLE `offline_booking_payments`");
    expect(migration).not.toContain("ALTER TABLE `payments`");
    expect(migration).not.toContain("ALTER TABLE `bookings`");
  });
  it("keeps offline booking creation Stripe-free and creates exactly one ledger row", () => {
    expect(booking).toContain('paymentMethod: z.enum(["online", "pay_at_location"])');
    expect(booking).toContain("db.createOfflinePayment(bookingId, totalAmount)");
    expect(booking).not.toContain("createCheckoutSession");
  });
  it("has customer read-only and provider/admin mutation boundaries", () => {
    expect(router).toContain("getForBooking");
    expect(router).toContain("confirmPayment");
    expect(router).toContain("waivePayment");
    expect(router).toContain("mutate ? (!ownsProvider && !admin)");
    expect(helper).toContain("Full payment or full waiver is required");
    expect(helper).toContain("A waiver reason is required");
  });
});
