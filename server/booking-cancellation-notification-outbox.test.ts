import { describe, expect, it } from "vitest";
import {
  buildCancellationNotificationIdempotencyKey,
  claimCancellationNotificationWithDatabase,
  enqueueCancellationNotificationWithDatabase,
  markCancellationNotificationRetryableWithDatabase,
  markCancellationNotificationSentWithDatabase,
} from "./db/bookingCancellationNotifications";

const input = {
  operationId: 7,
  recipientUserId: 22,
  eventName: "refund_completed",
  notificationType: "booking_cancellation_refund",
  title: "Refund completed",
  message: "Your booking refund has been completed.",
  actionUrl: "/my-bookings/77",
  bookingId: 77,
};

function fakeDatabase() {
  let row: any;
  let id = 1;
  const database: any = {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => row ? [row] : [] }) }) }),
    insert: () => ({
      values: async (values: any) => {
        if (row) {
          const error: any = new Error("Duplicate entry");
          error.code = "ER_DUP_ENTRY";
          throw error;
        }
        row = { id: id++, ...values };
        return [{ insertId: row.id }];
      },
    }),
    update: () => ({
      set: (values: any) => ({
        where: async () => {
          if (!row) return [{ affectedRows: 0 }];
          if (values.status === "sending" && (row.status === "pending" || row.status === "retryable" || row.status === "sending_stale")) {
            row = { ...row, ...values, status: values.status };
            return [{ affectedRows: 1 }];
          }
          if (values.status !== "sending" && row.status === "sending") {
            row = { ...row, ...values, status: values.status };
            return [{ affectedRows: 1 }];
          }
          return [{ affectedRows: 0 }];
        },
      }),
    }),
    forceRetryable: () => { row = { ...row, status: "retryable", nextRetryAt: null }; },
    forceStaleSending: () => { row = { ...row, status: "sending_stale" }; },
  };
  return database;
}

describe("isolated cancellation notification outbox", () => {
  it("builds a bounded operation/recipient/event idempotency key", () => {
    expect(buildCancellationNotificationIdempotencyKey(input)).toBe("cancel:7:22:refund_completed");
  });

  it("enqueues exactly one row for a repeated event", async () => {
    const database = fakeDatabase();
    const first = await enqueueCancellationNotificationWithDatabase(database, input);
    const second = await enqueueCancellationNotificationWithDatabase(database, input);
    expect(first.action).toBe("created");
    expect(second.action).toBe("duplicate");
    expect(second.outbox.id).toBe(first.outbox.id);
  });

  it("allows one delivery claimant and prevents a second claimant while sending", async () => {
    const database = fakeDatabase();
    const created = await enqueueCancellationNotificationWithDatabase(database, input);
    const first = await claimCancellationNotificationWithDatabase(database, created.outbox.id);
    const second = await claimCancellationNotificationWithDatabase(database, created.outbox.id);
    expect(first.action).toBe("process");
    expect(second.action).toBe("duplicate");
  });

  it("records a delivery failure as retryable and reclaims it", async () => {
    const database = fakeDatabase();
    const created = await enqueueCancellationNotificationWithDatabase(database, input);
    const claimed = await claimCancellationNotificationWithDatabase(database, created.outbox.id);
    if (claimed.action !== "process") throw new Error("expected delivery claim");
    const failed = await markCancellationNotificationRetryableWithDatabase(database, {
      outboxId: created.outbox.id,
      leaseToken: claimed.outbox.leaseToken,
      error: new Error("notification provider timeout"),
    });
    expect(failed.status).toBe("retryable");
    database.forceRetryable();
    const retry = await claimCancellationNotificationWithDatabase(database, created.outbox.id);
    expect(retry.action).toBe("process");
  });

  it("rejects stale completion after a row is already sent", async () => {
    const database = fakeDatabase();
    const created = await enqueueCancellationNotificationWithDatabase(database, input);
    const claimed = await claimCancellationNotificationWithDatabase(database, created.outbox.id);
    if (claimed.action !== "process") throw new Error("expected delivery claim");
    await markCancellationNotificationSentWithDatabase(database, {
      outboxId: created.outbox.id,
      leaseToken: claimed.outbox.leaseToken,
    });
    await expect(markCancellationNotificationSentWithDatabase(database, {
      outboxId: created.outbox.id,
      leaseToken: claimed.outbox.leaseToken,
    })).rejects.toThrow("stale or already resolved");
  });
});
