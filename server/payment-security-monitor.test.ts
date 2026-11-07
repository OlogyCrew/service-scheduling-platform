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
  });

  it("does not return raw velocity subjects to the admin monitor", () => {
    const source = read("server/adminRouter.ts");
    expect(source).not.toContain("subjectKey: counter.subjectKey");
    expect(source).toContain("const sanitized = counters.map");
    expect(source).toContain("attemptCount: counter.attemptCount");
  });

  it("shows blocked attempts, trigger dimensions, cooldowns, history, and release action", () => {
    const source = read("client/src/pages/admin/PaymentSecurityPanel.tsx");
    for (const text of ["Blocked dimensions", "Attempt history", "Admin override history", "Cooldown", "Release", "Raw identifiers are intentionally not shown"]) {
      expect(source).toContain(text);
    }
    expect(source).toContain("releasePaymentVelocityCooldown");
    expect(source).toContain("entry.action === \"payment_velocity_blocked\"");
  });

  it("keeps admin navigation and dashboard wiring synchronized", () => {
    const navigation = read("client/src/pages/admin/adminNavigation.ts");
    const dashboard = read("client/src/pages/AdminDashboard.tsx");
    expect(navigation).toContain('id: "payment-security"');
    expect(dashboard).toContain('value="payment-security"');
    expect(dashboard).toContain("<PaymentSecurityPanel />");
  });
});
