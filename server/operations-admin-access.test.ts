import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { adminRouter } from "./adminRouter";
import type { TrpcContext } from "./_core/context";
import { hasAdminClearance, hasPartnerSplitAccess } from "./adminPolicy";

const root = resolve(import.meta.dirname, "..");
const source = (path: string) => readFileSync(resolve(root, path), "utf8");

function context(email: string, adminRole: "operations_admin" | "super_admin", role: "admin" | "provider" = "admin") {
  return {
    user: { id: 49831691, email, role, adminRole, deletedAt: null, emailVerified: true },
    req: {}, res: {},
  } as TrpcContext;
}

describe("scoped operations admin", () => {
  const trace = context("trace@visionkwest.com", "operations_admin");
  const caller = adminRouter.createCaller(trace);

  it("requires the named account and its exact approved role; only named super admins see splits", () => {
    expect(hasAdminClearance(trace.user)).toBe(true);
    expect(hasAdminClearance(context("trace@visionkwest.com", "super_admin").user)).toBe(false);
    expect(hasAdminClearance(context("trace@visionkwest.com", "operations_admin", "provider").user)).toBe(false);
    expect(hasAdminClearance(context("another@visionkwest.com", "operations_admin").user)).toBe(false);
    expect(hasPartnerSplitAccess(trace.user)).toBe(false);
    expect(hasPartnerSplitAccess(context("wwilliams@visionkwest.com", "super_admin").user)).toBe(true);
  });

  it("denies each partner summary, list, monthly breakdown and export endpoint before it reaches data", async () => {
    await expect(caller.getPartnerTransferSummary()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.getPartnerTransfers()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.getPartnerMonthlyBreakdown()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.getPartnerTransfersExport()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.getWebhookStatus()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.testWebhook()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("denies team access, role changes, and user deletion at the API layer", async () => {
    await expect(caller.getTeamMembers()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.searchUsers({ query: "trace" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.promoteUser({ userId: 10, adminRole: "super_admin" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.updateTeamRole({ userId: 10, adminRole: "super_admin" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.deleteUser({ userId: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.bulkDeleteUsers({ userIds: [10] })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("preserves ordinary admin operations and hides partner configuration from health", async () => {
    const health = await caller.getSystemHealth();
    expect(health).toHaveProperty("integrations.payments");
    expect(JSON.stringify(health)).not.toContain("partnerAccountId");
  });

  it("filters audit disclosures before paging and through user detail, not just the UI", () => {
    const router = source("server/adminRouter.ts");
    const audit = source("server/db/auditLog.ts");
    expect(router).toContain("excludePartnerFinancials: !hasPartnerSplitAccess(ctx.user)");
    expect(router).toContain('getAuditLogForTarget("user", input.userId, !hasPartnerSplitAccess(ctx.user))');
    expect(audit).toContain("NOT REGEXP 'partner|transfer|split'");
    expect(source("server/systemHealth.ts")).toContain("!includePartnerConfiguration || ENV.partnerStripeAccountId");
  });

  it("never auto-promotes the operations identity on login or exposes hidden tabs through deep links", () => {
    expect(source("server/db/users.ts")).toContain("isApprovedSuperAdminEmail(user.email)");
    const dashboard = source("client/src/pages/AdminDashboard.tsx");
    expect(dashboard).toContain('["partner", "team", "legal", "customers-pilot"].includes(activeTab)');
    expect(dashboard).toContain('{isOwnerAdmin ? <TabsContent value="partner" aria-labelledby="admin-section-heading">');
    expect(dashboard).toContain('{isOwnerAdmin ? <TabsContent value="team" aria-labelledby="admin-section-heading">');
    expect(source("client/src/contexts/ViewModeContext.tsx")).toContain('(isAdmin && !!providerProfile)');
  });
});
