import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { injectOgTags } from "./_core/vite";
import { PEOPLE_FIRST_OG_IMAGE } from "./ogTags";

const template = readFileSync(resolve(import.meta.dirname, "../client/index.html"), "utf8");
const dynamicCards = readFileSync(resolve(import.meta.dirname, "./ogImage.ts"), "utf8");
const internalOrigin = "https://internal-run.example";
const socialImage = `content="${PEOPLE_FIRST_OG_IMAGE}"`;

function value(html: string, key: string, attr = "property"): string | undefined {
  return html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`))?.[1];
}

describe("people-first OG injection into public HTML", () => {
  const routes = [
    { path: "/", url: "https://ologycrew.com/", title: "Good work starts with people" },
    { path: "/?ref=FRIEND", url: "https://ologycrew.com/", title: "Good work starts with people" },
    { path: "/browse?q=barber", url: "https://ologycrew.com/browse", title: "Find Your Person" },
    { path: "/search?q=barber", url: "https://ologycrew.com/browse", title: "Find Your Person" },
    { path: "/pricing?audience=provider", url: "https://ologycrew.com/pricing", title: "Customers and Providers" },
    { path: "/help", url: "https://ologycrew.com/help", title: "Help &amp; Resources" },
    { path: "/referral-program?ref=PRIVATE-CODE", url: "https://ologycrew.com/referral-program", title: "Share Good Work" },
    { path: "/signup?ref=PRIVATE-CODE", url: "https://ologycrew.com/signup", title: "Find Your People" },
    { path: "/provider/onboarding?ref=PRIVATE-CODE", url: "https://ologycrew.com/provider/onboarding", title: "Bring Your Work" },
    { path: "/featured", url: "https://ologycrew.com/featured", title: "Featured Professionals" },
    { path: "/experiences", url: "https://ologycrew.com/experiences", title: "Explore Experiences" },
    { path: "/terms", url: "https://ologycrew.com/terms", title: "Terms of Service" },
    { path: "/privacy", url: "https://ologycrew.com/privacy", title: "Privacy Policy" },
  ];

  it.each(routes)("renders a single canonical branded preview for $path", async ({ path, url, title }) => {
    const html = await injectOgTags(path, template, internalOrigin);
    expect(value(html, "og:title")).toContain(title);
    expect(value(html, "og:url")).toBe(url);
    expect(value(html, "og:image")).toBe(PEOPLE_FIRST_OG_IMAGE);
    expect(value(html, "og:image:width")).toBe("1200");
    expect(value(html, "og:image:height")).toBe("630");
    expect(value(html, "twitter:card", "name")).toBe("summary_large_image");
    expect(value(html, "twitter:image", "name")).toBe(PEOPLE_FIRST_OG_IMAGE);
    expect(html.match(/property="og:title"/g)).toHaveLength(1);
    expect(html.match(/property="og:image"/g)).toHaveLength(1);
    expect(html).toContain(socialImage);
    expect(html).not.toContain(internalOrigin);
    expect(html).not.toContain("PRIVATE-CODE");
    expect(html).not.toContain("The Digital Home for Your Business");
    expect(html).not.toContain("logo-navbar_38427c60.png\" />");
  });

  it("does not surface the old every-referral card or imply a signup-only reward", async () => {
    const html = await injectOgTags("/referral-program?ref=EXAMPLE", template, internalOrigin);
    expect(value(html, "og:description")).toContain("eligible paid booking");
    expect(value(html, "og:description")).toContain("net captured payment");
    expect(html).not.toContain("ologycrew-referral-og-compressed");
    expect(html).not.toContain("earn credits on every referral");
  });

  it("uses the public homepage preview for account-only routes without indexing private queries", async () => {
    const html = await injectOgTags("/my-bookings?token=DO-NOT-SHARE", template, internalOrigin);
    expect(value(html, "og:url")).toBe("https://ologycrew.com/");
    expect(value(html, "og:image")).toBe(PEOPLE_FIRST_OG_IMAGE);
    expect(html).not.toContain("DO-NOT-SHARE");
  });

  it("keeps the dedicated provider-benefits photograph and canonical URL", async () => {
    const html = await injectOgTags("/for-providers?campaign=test", template, internalOrigin);
    expect(value(html, "og:url")).toBe("https://ologycrew.com/for-providers");
    expect(value(html, "og:image")).toContain("independent-designer-at-work_08f09cd1.jpg");
    expect(value(html, "og:image:width")).toBe("3000");
    expect(value(html, "og:image:height")).toBe("1688");
  });

  it("keeps the primary HTML title and description aligned with the route-specific share card", async () => {
    const html = await injectOgTags("/browse", template, internalOrigin);
    expect(html.match(/<title>[^<]*<\/title>/g)).toHaveLength(1);
    expect(html).toContain("<title>Find Your Person — Explore OlogyCrew</title>");
    expect(html).toContain(
      '<meta name="description" content="Explore service categories and real professional profiles. Compare available services, then book or request a quote when you are ready." />',
    );
    expect(html).not.toContain("<title>OlogyCrew — Local work, well done</title>");
  });

  it("keeps distinct provider and service cards while aligning their palette and avoiding a false direct-booking promise", () => {
    const providerCard = dynamicCards.split("export async function generateProviderOgImage")[1].split("export async function generateHomepageOgImage")[0];
    const serviceCard = dynamicCards.split("export async function generateServiceOgImage")[1].split("export async function generateProviderOgImage")[0];
    expect(providerCard).toContain("businessName");
    expect(serviceCard).toContain("serviceName");
    for (const card of [providerCard, serviceCard]) {
      expect(card).toContain("#123332");
      expect(card).toContain("#bd4b35");
      expect(card).toContain("#c5d75d");
      expect(card).toContain('backgroundColor: "#f5f2e9"');
      expect(card).not.toContain('background: "#22c55e"');
      expect(card).not.toContain('background: "linear-gradient(90deg, #3b82f6');
    }
    expect(serviceCard).toContain('children: "Explore this service"');
    expect(serviceCard).not.toContain('children: "Book this service now"');
    expect(providerCard).toContain('children: "Good work starts with people"');
  });
});
