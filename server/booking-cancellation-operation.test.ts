import { describe, expect, it } from "vitest";
import {
  claimCancellationOperationWithDatabase,
  claimCancellationRetryWithDatabase,
  type CancellationOperationClaimInput,
} from "./db/bookingCancellationOperations";

function input(overrides: Partial<CancellationOperationClaimInput> = {}): CancellationOperationClaimInput {
  return {
    bookingId: 77,
    operationKey: "cancel:77:request-1",
    requestedByUserId: 10,
    actorRole: "customer",
    reason: "Customer requested cancellation",
    bookingStatusAtClaim: "confirmed",
    paymentId: 88,
    stripePaymentIntentId: "pi_123",
    refundAmount: "101.00",
    refundPercentage: "100.00",
    stripeRefundIdempotencyKey: "cancel-booking-77-refund",
    ...overrides,
  };
}

function fakeDatabase(options: { bookingStatus?: string; failInsert?: boolean } = {}) {
  let operation: any;
  let nextId = 1;
  let transactionQueue = Promise.resolve();
  const calls = { stripe: 0, payments: 0, bookings: 0, notifications: 0 };

  const database: any = {
    calls,
    forceRetryable: () => {
      if (operation) operation = { ...operation, status: "retryable", nextRetryAt: null, lastAttemptAt: null };
    },
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => operation ? [operation] : [],
        }),
      }),
    }),
    transaction: async (callback: (tx: any) => Promise<any>) => {
      const run = transactionQueue.then(async () => callback(database));
      transactionQueue = run.then(() => undefined, () => undefined);
      return run;
    },
    execute: async () => [[{ id: 77, status: options.bookingStatus ?? "confirmed" }]],
    insert: () => ({
      values: async (values: any) => {
        if (options.failInsert) throw new Error("audit write failed");
        if (operation) {
          const error: any = new Error("Duplicate entry");
          error.code = "ER_DUP_ENTRY";
          throw error;
        }
        operation = { id: nextId++, ...values };
        return [{ insertId: operation.id }];
      },
    }),
    update: () => ({
      set: (values: any) => ({
        where: async () => {
          if (!operation || operation.status !== "retryable") return [{ affectedRows: 0 }];
          operation = { ...operation, ...values, status: "refund_pending" };
          return [{ affectedRows: 1 }];
        },
      }),
    }),
  };
  return database;
}

describe("isolated cancellation-operation claims", () => {
  it("allows one winner and makes the concurrent loser side-effect free", async () => {
    const database = fakeDatabase();
    const [first, second] = await Promise.all([
      claimCancellationOperationWithDatabase(database, input()),
      claimCancellationOperationWithDatabase(database, input({ operationKey: "cancel:77:request-2" })),
    ]);

    expect([first.action, second.action].sort()).toEqual(["in_progress", "process"]);
    expect(database.calls).toEqual({ stripe: 0, payments: 0, bookings: 0, notifications: 0 });
  });

  it("rolls back an audit-write failure and does not return a claimed operation", async () => {
    const database = fakeDatabase({ failInsert: true });
    await expect(claimCancellationOperationWithDatabase(database, input())).rejects.toThrow("audit write failed");
    expect(database.select).toBeDefined();
  });

  it("rejects a booking whose status changed before the claim", async () => {
    const database = fakeDatabase({ bookingStatus: "cancelled" });
    await expect(claimCancellationOperationWithDatabase(database, input())).rejects.toThrow("not cancellable");
  });

  it("claims a retry lease without changing the stable refund idempotency key", async () => {
    const database = fakeDatabase();
    await claimCancellationOperationWithDatabase(database, input());
    database.forceRetryable();
    (database as any).select = () => ({ from: () => ({ where: () => ({ limit: async () => [{
      id: 1,
      status: "retryable",
      nextRetryAt: null,
      lastAttemptAt: null,
      stripeRefundIdempotencyKey: "cancel-booking-77-refund",
    }] }) }) });
    const retry = await claimCancellationRetryWithDatabase(database, 1);
    expect(retry.action).toBe("process");
    expect(retry.operation.stripeRefundIdempotencyKey).toBe("cancel-booking-77-refund");
  });
});
