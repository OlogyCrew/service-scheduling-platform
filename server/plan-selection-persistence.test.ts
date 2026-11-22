import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (relativePath: string) => readFileSync(resolve(root, relativePath), "utf8");

describe("clean-account plan selection persistence", () => {
  const customAuth = read("server/customAuthRouter.ts");
  const login = read("client/src/pages/Login.tsx");
  const signup = read("client/src/pages/SignUp.tsx");
  const customerHome = read("client/src/pages/LoggedInHome.tsx");
  const providerOnboarding = read("client/src/pages/ProviderOnboarding.tsx");

  it("carries pricing audience and tier through both login and signup to the server callback", () => {
    for (const source of [login, signup]) {
      expect(source).toContain('params.set("audience"');
      expect(source).toContain('params.set("planTier"');
      expect(source).toContain("ologycrew_selected_plan");
    }
    expect(customAuth).toContain("const audience = req.query.audience as string");
    expect(customAuth).toContain("const planTier = req.query.planTier as string");
  });

  it("assigns the selected account role once and persists plan intent for new and returning users", () => {
    expect(customAuth).toContain('audience === "provider" || audience === "customer"');
    expect(customAuth).toContain("hasSelectedRole: true");
    expect(customAuth.match(/pendingPlanTier: planTier/g)?.length).toBeGreaterThanOrEqual(2);
    expect(customAuth.match(/pendingPlanAudience:/g)?.length).toBeGreaterThanOrEqual(2);
    expect(customAuth).toContain('redirectPath = "/provider/onboarding"');
    expect(customAuth).toContain('redirectPath = "/"');
  });

  it("activates a selected customer paid plan once and clears local and server pending intent", () => {
    expect(customerHome).toContain('pendingAudience === "customer"');
    expect(customerHome).toContain('pendingTier === "pro" || pendingTier === "business"');
    expect(customerHome).toContain("customerStartTrial.mutate({ tier: pendingTier })");
    expect(customerHome).toContain('localStorage.removeItem("ologycrew_selected_plan")');
    expect(customerHome).toContain("clearPendingPlan.mutate()");
  });

  it("restores a selected provider plan from the database without auto-activating paid access", () => {
    expect(providerOnboarding).toContain("pendingPlanTier");
    expect(providerOnboarding).toContain("pendingPlanAudience");
    expect(providerOnboarding).toContain("Fallback: read from user's pendingPlanTier in DB");
    expect(providerOnboarding).toContain("selectFreeTier.mutate()");
    expect(providerOnboarding).toContain("startTrial.mutate({ tier: \"basic\" })");
    expect(providerOnboarding).toContain("New provider trials are paused");
  });

  it("does not activate a provider plan until the provider profile exists", () => {
    const profileCreate = providerOnboarding.indexOf("await createProvider.mutateAsync");
    const planActivation = providerOnboarding.indexOf("No provider profile yet - advance without automatic plan activation");
    expect(profileCreate).toBeGreaterThan(-1);
    expect(planActivation).toBeGreaterThan(profileCreate);
  });
});
