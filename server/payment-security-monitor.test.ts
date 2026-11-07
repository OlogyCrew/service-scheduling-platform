import { describe, expect, it } from "vitest";
import fs from "node:fs";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(`${root}/${file}`, "utf8");

describe("payment security monitoring", () => {
  it("keeps monitoring and release procedures behind the existing admin boundary", () => {
    const source = read("server/adminRouter.ts");
    expect(source).toContain("getPaymentVelocityMonitor: adminProcedure");
    expect(source).toContain("releasePaymentVelocityCooldown: adminProcedure");
    expect(source).toContain('action: "release_payment_velocity_cooldown"');
    expect(source).toContain("reason: z.string().trim().min(3");
    expect(source).toContain("expectedUpdatedAt: z.coerce.date()");
    expect(source).toContain("expectedBlockedUntil: z.coerce.date()");
  });

  it("does not return raw velocity subjects to the admin monitor", () => {
    const source = read("server/adminRouter.ts");
    expect(source).not.toContain("subjectKey: counter.subjectKey");
    expect(source).toContain("const sanitized = result.items.map");
    expect(source).toContain("attemptCount: counter.attemptCount");
  });

  it("shows blocked attempts, trigger dimensions, cooldowns, history, and release action", () => {
    const source = read("client/src/pages/admin/PaymentSecurityPanel.tsx");
    for (const text of ["Blocked in page", "Attempt history", "Admin override history", "Cooldown", "Review release", "Raw identifiers are intentionally not shown", "Security dimension", "Triggered rule", "Blocked payment attempts", "Page {pagination.page}"]) {
      expect(source).toContain(text);
    }
    expect(source).toContain("releasePaymentVelocityCooldown");
    expect(source).toContain("entry.action === \"payment_velocity_blocked\"");
    expect(source).toContain("It is not an account suspension");
  });

  it("supports server-side filters and pagination while returning only safe summaries", () => {
    const router = read("server/adminRouter.ts");
    const helper = read("server/db/paymentVelocity.ts");
    for (const text of ["startDate", "endDate", "dimension", "status", "rule", "page", "limit", "pagination"]) {
      expect(router).toContain(text);
    }
    for (const text of ["gte(paymentVelocityCounters.lastAttemptAt", "lte(paymentVelocityCounters.lastAttemptAt", "limit(limit).offset", "count()", "blockedUntil"]) {
      expect(helper).toContain(text);
    }
    expect(router).not.toContain("subjectKey: counter.subjectKey");
    expect(router).toContain('restrictionType: "payment_attempt_cooldown"');
    expect(router).toContain("restrictionScope");
  });

  it("guards concurrent and stale release attempts with an atomic state check", () => {
    const helper = read("server/db/paymentVelocity.ts");
    for (const text of ["expectedUpdatedAt", "expectedBlockedUntil", "gt(paymentVelocityCounters.blockedUntil", "affectedRows", "code: \"CONFLICT\""]) {
      expect(helper).toContain(text);
    }
    const router = read("server/adminRouter.ts");
    for (const text of ["restrictionStateVerified: true", "reason: input.reason.trim()", "outcome: \"released\""]) {
      expect(router).toContain(text);
    }
  });

  it("keeps admin navigation and dashboard wiring synchronized", () => {
    const navigation = read("client/src/pages/admin/adminNavigation.ts");
    const dashboard = read("client/src/pages/AdminDashboard.tsx");
    expect(navigation).toContain('id: "payment-security"');
    expect(dashboard).toContain('value="payment-security"');
    expect(dashboard).toContain("<PaymentSecurityPanel />");
  });
});
