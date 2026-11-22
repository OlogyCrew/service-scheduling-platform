import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync("drizzle/schema.ts", "utf8");
const migration = readFileSync("drizzle/0072_groovy_the_stranger.sql", "utf8");
const design = readFileSync("docs/ologycrew-gate2-cancellation-race-design.md", "utf8");

describe("cancellation operation migration review", () => {
  it("defines the approved durable operation fields and unique ownership constraints", () => {
    for (const field of [
      "bookingCancellationOperations",
      'bookingId: int("bookingId").notNull().references(() => bookings.id)',
      'operationKey: varchar("operationKey", { length: 191 }).notNull().unique()',
      'paymentId: int("paymentId").references(() => payments.id)',
      'stripeRefundIdempotencyKey: varchar("stripeRefundIdempotencyKey", { length: 255 })',
      'status: mysqlEnum("status", ["claimed", "refund_pending", "refunded", "no_refund_required", "completed", "retryable", "failed"])',
      'unique("booking_cancel_operation_booking_unique").on(table.bookingId)',
    ]) {
      expect(schema).toContain(field);
    }
  });

  it("is strictly additive and does not rewrite unrelated Pay-at-Location constraints", () => {
    expect(migration).toContain("CREATE TABLE `booking_cancellation_operations`");
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN|INDEX|FOREIGN KEY)/i);
    expect(migration).not.toContain("provider_pay_at_location_services");
    expect(migration).not.toContain("provider_pay_at_location_settings");
    expect(migration).not.toContain("ALTER TABLE `bookings`");
    expect(migration).not.toContain("ALTER TABLE `payments`");
    expect(migration).toContain("booking_cancellation_operations_bookingId_bookings_id_fk");
    expect(migration).toContain("booking_cancellation_operations_requestedByUserId_users_id_fk");
    expect(migration).toContain("booking_cancellation_operations_paymentId_payments_id_fk");
    expect(migration).toContain("booking_cancel_operation_status_retry_idx");
    expect(migration).toContain("booking_cancel_operation_lease_idx");
    expect(migration).toContain("booking_cancel_operation_actor_idx");
  });

  it("keeps the runtime route unchanged until claim and recovery tests are approved", () => {
    expect(schema).toContain("not used by the live cancellation route");
    expect(design).toContain("No migration is applied by this design artifact");
    expect(design).toContain("Required owner decisions before implementation");
  });
});
