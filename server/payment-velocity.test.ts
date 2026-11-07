import { describe, expect, it } from "vitest";
import fs from "node:fs";
import {
  DEFAULT_PAYMENT_VELOCITY_RULES,
  getPaymentVelocityBucket,
  normalizePaymentVelocityKey,
  throwIfPaymentVelocityBlocked,
} from "./paymentVelocity";

const ROOT = process.cwd();

describe("payment velocity controls", () => {
  it("uses scoped defaults without geographic restrictions", () => {
    expect(DEFAULT_PAYMENT_VELOCITY_RULES.enabled).toBe(true);
    expect(DEFAULT_PAYMENT_VELOCITY_RULES.windowMinutes).toBe(10);
    expect(DEFAULT_PAYMENT_VELOCITY_RULES.cooldownMinutes).toBe(30);
    expect(DEFAULT_PAYMENT_VELOCITY_RULES.thresholds).toEqual({
      account: 8,
      email: 8,
      stripe_customer: 8,
      provider: 40,
      booking: 5,
      ip: 20,
    });
    expect(Object.keys(DEFAULT_PAYMENT_VELOCITY_RULES.thresholds)).not.toContain("country");
  });

  it("maps attempts to deterministic fixed-window buckets and normalized keys", () => {
    const now = new Date("2026-11-07T08:07:59.000Z");
    expect(getPaymentVelocityBucket(now, 10)).toEqual(new Date("2026-11-07T08:00:00.000Z"));
    expect(normalizePaymentVelocityKey("  USER@Example.COM ")).toBe("user@example.com");
  });

  it("returns a reversible too-many-requests error only when a counter is blocked", () => {
    expect(() => throwIfPaymentVelocityBlocked({ allowed: true, rules: DEFAULT_PAYMENT_VELOCITY_RULES })).not.toThrow();
    expect(() => throwIfPaymentVelocityBlocked({
      allowed: false,
      rules: DEFAULT_PAYMENT_VELOCITY_RULES,
      blocked: { dimension: "account", key: "42" },
    })).toThrow("temporarily limited");
  });

  it("covers every payment-producing route with the shared gate", () => {
    for (const file of ["server/stripeRouter.ts", "server/promotionRouter.ts", "server/invoiceRouter.ts", "server/customerSubscriptionRouter.ts", "server/subscriptionRouter.ts"]) {
      const source = fs.readFileSync(`${ROOT}/${file}`, "utf8");
      expect(source).toContain("assertPaymentVelocityAllowed");
      expect(source).toContain("throwIfPaymentVelocityBlocked");
    }
  });

  it("keeps the control key private from public settings reads", () => {
    const source = fs.readFileSync(`${ROOT}/server/routers/platformSettingsRouter.ts`, "utf8");
    expect(source).toContain("delete settings.payment_velocity_rules");
    expect(source).toContain('input.key === "payment_velocity_rules"');
    expect(source).toContain("update_payment_velocity_controls");
  });
});
