import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ADMIN_SOCIAL_PLATFORMS,
  ADMIN_SOCIAL_PLATFORM_OPTIONS,
  normalizeAdminSocialPlatforms,
} from "../shared/adminSocialPlatforms";

const projectRoot = resolve(import.meta.dirname, "..");
const adminSource = readFileSync(resolve(projectRoot, "client/src/pages/AdminSocialMedia.tsx"), "utf8");
const routerSource = readFileSync(resolve(projectRoot, "server/routers/socialMediaRouter.ts"), "utf8");
const publisherSource = readFileSync(resolve(projectRoot, "server/socialMedia.ts"), "utf8");
const healthSource = readFileSync(resolve(projectRoot, "server/systemHealth.ts"), "utf8");

describe("Admin social posting channels", () => {
  it("supports only Facebook and LinkedIn for new Admin posts", () => {
    expect(ADMIN_SOCIAL_PLATFORMS).toEqual(["facebook", "linkedin"]);
    expect(ADMIN_SOCIAL_PLATFORM_OPTIONS).toEqual([
      { id: "facebook", label: "Facebook" },
      { id: "linkedin", label: "LinkedIn" },
    ]);
  });

  it("drops Instagram from legacy platform selections instead of attempting a publish", () => {
    expect(normalizeAdminSocialPlatforms(["facebook", "instagram", "linkedin"])).toEqual(["facebook", "linkedin"]);
    expect(normalizeAdminSocialPlatforms(["instagram"])).toEqual([]);
    expect(normalizeAdminSocialPlatforms(undefined)).toEqual(["facebook", "linkedin"]);
  });

  it("removes Instagram controls, credential warnings, and publishing calls from the Admin feature", () => {
    expect(adminSource).toContain("ADMIN_SOCIAL_PLATFORM_OPTIONS.map");
    expect(adminSource).toContain("activeResults");
    expect(adminSource).toContain("Facebook and LinkedIn");
    expect(adminSource).not.toMatch(/instagram/i);

    expect(routerSource).toContain("z.enum(ADMIN_SOCIAL_PLATFORMS)");
    expect(routerSource).toContain("hasAdminClearance(ctx.user)");
    expect(routerSource).not.toMatch(/instagram/i);

    expect(publisherSource).toContain("remaining.map(async (platform)");
    expect(publisherSource).toContain("normalizeAdminSocialPlatforms(post.platforms)");
    expect(publisherSource).toContain("facebook: postToFacebook");
    expect(publisherSource).toContain("linkedin: postToLinkedIn");
    expect(publisherSource).not.toMatch(/postToInstagram|instagramBusinessAccountId|Instagram credentials/i);

    expect(healthSource).not.toMatch(/instagram/i);
  });
});
