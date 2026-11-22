import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const proposal = readFileSync("docs/ologycrew-gate2-cancellation-notification-outbox-proposal.md", "utf8");
const guide = readFileSync("docs/ologycrew-provider-cancellation-recovery-guide-draft.md", "utf8");
const schema = readFileSync("drizzle/schema.ts", "utf8");
const migration = readFileSync("drizzle/0073_striped_solo.sql", "utf8");

describe("cancellation notification outbox proposal", () => {
  it("defines operation-scoped uniqueness and lease/retry fields", () => {
    for (const fragment of [
      "booking_cancellation_notification_outbox",
      "UNIQUE KEY `cancel_notification_outbox_key_unique` (`idempotencyKey`)",
      "KEY `cancel_notification_outbox_claim_idx` (`status`,`nextRetryAt`,`lastAttemptAt`)",
      "cancel_notification_outbox_operation_fk",
      "cancel_notification_outbox_recipient_fk",
      "cancel_notification_outbox_booking_fk",
      "SSE remains best effort after the persisted notification",
      "A stale worker cannot mark a newer lease sent",
    ]) {
      expect(proposal).toContain(fragment);
    }
  });

  it("contains only the approved additive outbox table and leaves existing notification data untouched", () => {
    expect(proposal).toContain("does not alter `notifications`, `bookings`, `payments`");
    expect(schema).toContain("bookingCancellationNotificationOutbox");
    expect(migration).toContain("CREATE TABLE `booking_cancellation_notification_outbox`");
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN|INDEX|FOREIGN KEY)/i);
    expect(migration).not.toContain("ALTER TABLE `notifications`");
    expect(migration).not.toContain("ALTER TABLE `bookings`");
    expect(migration).not.toContain("ALTER TABLE `payments`");
    expect(migration).toContain("booking_cancellation_notification_outbox_operationId_booking_cancellation_operations_id_fk");
  });

  it("keeps support wording honest about current versus future behavior", () => {
    expect(guide).toContain("Publication status:** Draft only — not published");
    expect(guide).toContain("Do not tell a customer that this draft’s pending, retry, or notification behavior is already available");
    expect(guide).toContain("Pay-at-Location remains separate from Stripe");
    expect(guide).toContain("Customers should not confirm their own offline payment");
    expect(guide).toContain("compare it with the exact release candidate");
  });
});
