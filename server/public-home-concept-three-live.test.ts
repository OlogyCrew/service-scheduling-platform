// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { navigate, queries } = vi.hoisted(() => ({
  navigate: vi.fn(),
  queries: { category: {} as any, provider: {} as any },
}));
vi.mock("wouter", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => createElement("a", { href, ...rest }, children),
  useLocation: () => ["/", navigate],
}));
vi.mock("@/components/shared/NavHeader", () => ({ NavHeader: ({ forcePublic = false }: { forcePublic?: boolean }) => createElement("header", { "data-testid": "shared-header", "data-public": forcePublic }, "OlogyCrew header") }));
vi.mock("@/components/shared/Footer", () => ({ Footer: ({ forcePublic, compactPublicHome }: { forcePublic?: boolean; compactPublicHome?: boolean }) => createElement("footer", { "data-testid": "shared-footer", "data-public": forcePublic, "data-compact": compactPublicHome }) }));
vi.mock("@/lib/trpc", () => ({ trpc: {
  category: { list: { useQuery: () => queries.category } },
  provider: { listFeatured: { useQuery: () => queries.provider } },
} }));

import PublicHomepageConceptThree from "../client/src/pages/PublicHomepageConceptThree";
import PublicHomepageLiveReview from "../client/src/pages/prototype/PublicHomepageLiveReview";

const root = resolve(import.meta.dirname, "..");
const home = readFileSync(resolve(root, "client/src/pages/Home.tsx"), "utf8");
const live = readFileSync(resolve(root, "client/src/pages/PublicHomepageConceptThree.tsx"), "utf8");
const app = readFileSync(resolve(root, "client/src/App.tsx"), "utf8");
const footer = readFileSync(resolve(root, "client/src/components/shared/Footer.tsx"), "utf8");
const preview = readFileSync(resolve(root, "client/src/pages/prototype/PublicHomepageDemoPrototype.tsx"), "utf8");
const html = readFileSync(resolve(root, "client/index.html"), "utf8");

beforeEach(() => {
  queries.category = { data: [
    { id: 9, name: "HANDYMAN", slug: "handyman" },
    { id: 10, name: "MASSAGE THERAPIST", slug: "massage-therapist" },
    { id: 7, name: "BARBER SHOP", slug: "barber-shop" },
    { id: 17, name: "PHOTOGRAPHY SERVICES", slug: "photography-services" },
    { id: 177, name: "EVENT PLANNING & MANAGEMENT", slug: "event-planning-management" },
    { id: 178, name: "FINANCIAL ADVISOR", slug: "financial-advisor" },
  ], isLoading: false, isError: false };
  queries.provider = { data: [
    { id: 360001, isOfficial: true, profileSlug: "demo-ologycrew", businessName: "Demo - OlogyCrew", city: "Atlanta", categories: [] },
    { id: 1, isOfficial: false, profileSlug: "chisolm-audio", businessName: "Chisolm Audio", city: "Hoschton", state: "GA", description: "Professional Audio Engineer services", profilePhotoUrl: "https://example.com/chisolm.jpg", averageRating: "5.00", totalReviews: 1, categories: [{ id: 15, name: "AUDIO VISUAL CREW" }] },
    { id: 2, isOfficial: false, profileSlug: "real-studio", businessName: "Real Studio", city: "Atlanta", state: "GA", description: "A locally run studio for creative events.", profilePhotoUrl: null, averageRating: "0.00", totalReviews: 0, categories: [{ id: 217, name: "STUDIO SPACE RENTALS" }] },
    { id: 3, isOfficial: false, profileSlug: "real-wellness", businessName: "Real Wellness", city: "Austin", state: "TX", description: "A neighborhood wellness practice.", profilePhotoUrl: null, averageRating: "4.50", totalReviews: 2, categories: [{ id: 10, name: "MASSAGE THERAPIST" }] },
    { id: 4, isOfficial: false, profileSlug: "", businessName: "No Public URL", description: null, categories: [] },
    { id: 5, isOfficial: false, profileSlug: "thin-profile", businessName: "Thin Profile", description: null, profilePhotoUrl: "https://example.com/upload.jpg", categories: [] },
  ], isLoading: false, isError: false };
});
afterEach(() => { cleanup(); navigate.mockReset(); });

describe("Concept 3 public homepage with actual OlogyCrew data", () => {
  it("uses Concept 3 only for public visitors and keeps signed-in homes and comparison routes", () => {
    expect(home).toContain("if (isAuthenticated && user) return <LoggedInHome />");
    expect(home).toContain("return <PublicHomepageConceptThree />");
    expect(home).toContain('localStorage.setItem("customer_referral_code"');
    expect(app).toContain('path="/" component={Home}');
    for (const path of ["public-home-demo", "public-home-refresh", "public-home-original"]) expect(app).toContain(`/preview/${path}`);
    expect(app).toContain('path="/preview/public-home-live" component={PublicHomepageLiveReview}');
    expect(live).toContain("<NavHeader forcePublic={forcePublicHeader} />");
    expect(preview).toContain("<NavHeader forcePublic />");
    expect(app).toContain('<Footer compactPublicHome={location === "/" || location === "/for-providers" || isPlatformPage} />');
    expect(footer).toContain("compactPublicHome && !isAuthenticated");
    render(createElement(PublicHomepageConceptThree));
    expect(screen.getByTestId("shared-header")).toBeVisible();
    expect(screen.getByTestId("shared-header")).toHaveAttribute("data-public", "false");
    expect(screen.getByRole("heading", { level: 1, name: /good work starts with people/i })).toBeVisible();
    expect(document.title).toBe("OlogyCrew — Local work, well done");
  });

  it("opens the same real-data homepage on a review route even while signed in", () => {
    render(createElement(PublicHomepageLiveReview));
    expect(screen.getByLabelText("Unpublished public homepage review notice")).toHaveTextContent("live OlogyCrew data");
    expect(screen.getByTestId("shared-header")).toHaveAttribute("data-public", "true");
    expect(screen.getByTestId("shared-footer")).toHaveAttribute("data-public", "true");
    expect(screen.getByTestId("shared-footer")).toHaveAttribute("data-compact", "true");
    expect(screen.getByRole("article", { name: "Chisolm Audio" })).toBeVisible();
  });

  it("offers two clear customer and provider paths without a second generic conversion block", () => {
    render(createElement(PublicHomepageConceptThree));
    const paths = screen.getByRole("region", { name: "Find your way in." });
    expect(within(paths).getByText("One platform, two clear paths")).toBeVisible();
    const customer = within(paths).getByRole("article", { name: "Find someone who knows their craft." });
    const provider = within(paths).getByRole("article", { name: "Your work deserves a home of its own." });
    expect(within(customer).getByText("01 / FOR CUSTOMERS")).toBeVisible();
    expect(within(customer).getByRole("link", { name: "Explore services" })).toHaveAttribute("href", "/browse");
    expect(within(provider).getByText("02 / FOR PROVIDERS")).toBeVisible();
    expect(within(provider).getByRole("link", { name: "Why providers choose OlogyCrew" })).toHaveAttribute("href", "/for-providers");
    expect(within(provider).getByRole("link", { name: "See provider plans" })).toHaveAttribute("href", "/pricing");
    expect(within(provider).getByRole("link", { name: "Explore a sample profile" })).toHaveAttribute("href", "/demo-ologycrew");
    expect(within(paths).getAllByRole("article")).toHaveLength(2);
  });

  it("introduces the same two paths quietly on the hero without displacing its people-first search", () => {
    render(createElement(PublicHomepageConceptThree));
    const hero = screen.getByRole("region", { name: /good work starts with people/i });
    expect(within(hero).getByRole("heading", { level: 1 })).toHaveTextContent("Good work starts with people.");
    const search = within(hero).getByRole("search", { name: "Search local services and professionals" });
    expect(within(search).getByRole("button", { name: "Find your pro" })).toBeVisible();
    const cue = within(hero).getByLabelText("One platform, two clear paths");
    expect(within(cue).getByText("One platform. Two clear paths.")).toBeVisible();
    expect(within(cue).getByRole("link", { name: "Find a pro" })).toHaveAttribute("href", "/browse");
    expect(within(cue).getByRole("link", { name: "Offer your services" })).toHaveAttribute("href", "/for-providers");
    expect(search.compareDocumentPosition(cue) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("uses the requested provider invitation on the craft photograph without hiding that it is illustrative", () => {
    render(createElement(PublicHomepageConceptThree));
    const craft = screen.getByRole("region", { name: "Independent professionals deserve a better home" });
    expect(within(craft).getByText("THE PEOPLE BEHIND THE CRAFT • PROVIDERS NEEDED")).toBeVisible();
    expect(within(craft).getByRole("img", { name: "Illustrative photograph of a plumber at work" })).toBeVisible();
    expect(craft).not.toHaveTextContent("THE PERSON BEHIND THE CRAFT · ILLUSTRATIVE PHOTO");
  });

  it("renders only real categories and non-demo public provider records, without made-up prices or badges", () => {
    render(createElement(PublicHomepageConceptThree));
    expect(screen.getByLabelText("OlogyCrew discovery paths")).toHaveTextContent("6featured categories");
    expect(screen.getByLabelText("OlogyCrew discovery paths")).toHaveTextContent("3providers featured here");
    for (const name of ["HANDYMAN", "MASSAGE THERAPIST", "BARBER SHOP", "PHOTOGRAPHY SERVICES", "EVENT PLANNING & MANAGEMENT", "FINANCIAL ADVISOR"]) {
      expect(screen.getByRole("link", { name: `Explore ${name} services on OlogyCrew` })).toHaveAttribute("href", expect.stringMatching(/^\/category\//));
    }
    const audio = screen.getByRole("article", { name: "Chisolm Audio" });
    expect(within(audio).getByRole("link", { name: "View Chisolm Audio profile" })).toHaveAttribute("href", "/chisolm-audio");
    expect(within(audio).getByLabelText("5.0 out of 5 based on 1 review")).toBeVisible();
    expect(screen.getByRole("article", { name: "Real Studio" })).not.toHaveTextContent("0.0");
    expect(within(screen.getByRole("article", { name: "Real Studio" })).getByText("A locally run studio for creative events.")).toBeVisible();
    expect(screen.queryByRole("article", { name: "Demo - OlogyCrew" })).not.toBeInTheDocument();
    expect(screen.queryByRole("article", { name: "No Public URL" })).not.toBeInTheDocument();
    expect(screen.queryByRole("article", { name: "Thin Profile" })).not.toBeInTheDocument();
    for (const falseClaim of ["4,812", "4.83 / 5", "Harbor & Hearth Plumbing", "Stillwater Massage Studio", "Velvet & Vine Hair", "$95", "$125", "Verified"]) {
      expect(screen.queryByText(falseClaim)).not.toBeInTheDocument();
      expect(live).not.toContain(falseClaim);
    }
    expect(screen.queryByRole("button", { name: /save .* preview/i })).not.toBeInTheDocument();
    expect(live).not.toMatch(/trpc\.booking\.|trpc\.payment\.|toggleSample/);
  });

  it("submits search to canonical Explore and keeps category, profile, pricing and sample paths functional", () => {
    render(createElement(PublicHomepageConceptThree));
    const input = screen.getByRole("searchbox", { name: "Search local services and professionals" });
    fireEvent.change(input, { target: { value: "  audio engineer  " } });
    fireEvent.submit(screen.getByRole("search", { name: "Search local services and professionals" }));
    expect(navigate).toHaveBeenCalledWith("/browse?q=audio%20engineer");
    fireEvent.change(input, { target: { value: " " } });
    fireEvent.submit(screen.getByRole("search", { name: "Search local services and professionals" }));
    expect(navigate).toHaveBeenCalledWith("/browse");
    expect(screen.getByRole("link", { name: "Explore all services" })).toHaveAttribute("href", "/browse");
    expect(screen.getByRole("link", { name: "Explore a sample profile" })).toHaveAttribute("href", "/demo-ologycrew");
    expect(screen.getByRole("link", { name: "See provider plans" })).toHaveAttribute("href", "/pricing");
  });

  it("is honest about empty, unavailable, or still-loading query results", () => {
    queries.category = { data: undefined, isLoading: true, isError: false };
    queries.provider = { data: undefined, isLoading: true, isError: false };
    const result = render(createElement(PublicHomepageConceptThree));
    expect(screen.getAllByRole("status")).toHaveLength(2);
    expect(screen.getAllByRole("status")[0]).toHaveTextContent("Loading service categories");
    expect(screen.queryByRole("article", { name: "Chisolm Audio" })).not.toBeInTheDocument();
    result.unmount();
    queries.category = { data: undefined, isLoading: false, isError: true };
    queries.provider = { data: undefined, isLoading: false, isError: true };
    render(createElement(PublicHomepageConceptThree));
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    expect(screen.getAllByRole("alert")[0]).toHaveTextContent("Categories are temporarily unavailable");
    expect(screen.queryByText("0", { exact: true })).not.toBeInTheDocument();
  });

  it("keeps essential public footer routes while limiting Concept 3 colors to the public page", () => {
    for (const path of ["/browse", "/pricing", "/referral-program", "/help", "/terms", "/privacy"]) expect(footer).toContain(`href="${path}"`);
    expect(live).toContain('import "./prototype/PublicHomepageDemoPrototype.css"');
    expect(live).toContain("/manus-storage/ology-refined-hero_");
    expect(live).toContain("Illustrative photograph");
    expect(live).not.toContain("bg-page");
    expect(footer).toContain("if (compactPublicHome && !isAuthenticated)");
    expect(preview).toContain("Homepage concept 3 · Supplied demo design");
    expect(html).toContain("<title>OlogyCrew — Local work, well done</title>");
    expect(html).toContain("Good work starts with people — OlogyCrew");
    expect(html).toContain('content="https://ologycrew.com/manus-storage/ologycrew-people-first-social-1200x630_05d25d5b.jpg"');
    expect(html).toContain('<meta property="og:image:width" content="1200" />');
    expect(html).toContain('<meta property="og:image:height" content="630" />');
  });
});
