import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";
import { getProviderOgTags, getServiceOgTags, getCategoryOgTags, getHomepageOgTags, getProviderBenefitsOgTags, getPublicPageOgTags } from "../ogTags";
import { getCategoryJsonLd, getHomepageJsonLd, getProviderJsonLd, getServiceJsonLd } from "../structuredData";
import { OLOGYCREW_PUBLIC_ORIGIN } from "../../shared/publicUrls";

export async function injectOgTags(url: string, template: string, _requestOrigin: string): Promise<string> {
  // Never let preview or internal deployment hosts leak into public share cards.
  const origin = OLOGYCREW_PUBLIC_ORIGIN;
  const pathname = url.split(/[?#]/)[0];
  let ogTags = "";
  let jsonLd = "";

  // Provider profile pages (/p/:slug)
  const providerMatch = url.match(/^\/p\/([^/?#]+)/);
  if (providerMatch) {
    ogTags = await getProviderOgTags(providerMatch[1], origin);
    jsonLd = await getProviderJsonLd(providerMatch[1], origin);
  }

  // Clean provider profile URLs (/:slug) — check after /p/ but before other routes
  if (!ogTags) {
    const cleanSlugMatch = url.match(/^\/([a-z0-9][a-z0-9-]*[a-z0-9])(?:[/?#]|$)/);
    if (cleanSlugMatch) {
      // Only treat as provider slug if it's not a known app route
      const knownRoutes = ['login','signup','forgot-password','reset-password','verify-email','select-role','browse','featured','search','category','provider','service','booking','bulk-booking','monthly-planner','my-bookings','messages','dm','admin','my-reviews','profile','account','notifications','notification-settings','unsubscribe','embed','receipts','referrals','saved-providers','my-quotes','my-waitlist','pricing','platform','for-providers','customer','analytics','privacy','terms','help','referral-program','404','experiences'];
      const slug = cleanSlugMatch[1];
      if (!knownRoutes.includes(slug) && !slug.startsWith('p/')) {
        ogTags = await getProviderOgTags(slug, origin);
          jsonLd = await getProviderJsonLd(slug, origin);
      }
    }
  }

  // Service detail pages (/service/:id)
  if (!ogTags) {
    const serviceMatch = url.match(/^\/service\/(\d+)/);
    if (serviceMatch) {
      ogTags = await getServiceOgTags(parseInt(serviceMatch[1], 10), origin);
      jsonLd = await getServiceJsonLd(parseInt(serviceMatch[1], 10), origin);
    }
  }

  // Category pages (/category/:slug)
  if (!ogTags) {
    const categoryMatch = url.match(/^\/category\/([^/?#]+)/);
    if (categoryMatch) {
      ogTags = await getCategoryOgTags(categoryMatch[1], origin);
      jsonLd = await getCategoryJsonLd(categoryMatch[1], origin);
    }
  }

  // Embed widget pages (/embed/provider/:id) - reuse provider OG tags
  if (!ogTags) {
    const embedProviderMatch = url.match(/^\/embed\/provider\/(\d+)/);
    if (embedProviderMatch) {
      // Look up the provider's slug by ID to get their OG tags
      try {
        const { getProviderById } = await import("../db");
        const provider = await getProviderById(parseInt(embedProviderMatch[1], 10));
        if (provider?.profileSlug) {
          ogTags = await getProviderOgTags(provider.profileSlug, origin);
        } else if (provider) {
          // Fallback: build basic OG tags for the provider
          const businessName = provider.businessName || "Service Provider";
          ogTags = getPublicPageOgTags(
            `/embed/provider/${embedProviderMatch[1]}`,
            `Services from ${businessName} — OlogyCrew`,
            `Explore available services from ${businessName}, then book or request a quote when the service allows it.`
          );
        }
      } catch (e) {
        console.error("[OG Tags] Error generating embed provider OG tags:", e);
      }
    }
  }

  // Public overview of the customer and provider platform
  if (!ogTags && pathname === "/platform") {
    ogTags = getPublicPageOgTags(
      "/platform",
      "The OlogyCrew Platform — Services, Bookings & Business Tools",
      "Explore service professionals, book or request a quote, and keep the work connected. Providers can manage their pages, schedules and customer relationships with tools available to their plan."
    );
    template = template.replace(/<title>[^<]*<\/title>/, "<title>The OlogyCrew Platform | Services, Bookings & Business Tools</title>");
    template = template.replace(/<meta name="description" content="[^"]*"\s*\/>/, '<meta name="description" content="Discover how OlogyCrew connects service discovery, direct bookings or quotes, and provider business tools on one platform." />');
  }

  // Public Help & Resources library
  if (!ogTags && pathname === "/help") {
    ogTags = getPublicPageOgTags(
      "/help",
      "OlogyCrew Help & Resources — Find the Right Guide",
      "Practical guides for finding a service, managing bookings, growing your business and getting help when you need it."
    );
  }

  // Referral program page
  if (!ogTags && pathname === "/referral-program") {
    ogTags = getPublicPageOgTags(
      "/referral-program",
      "Share Good Work — OlogyCrew Referral Program",
      "Share a referral link. When a referred account completes an eligible paid booking, the referrer can earn credits based on net captured payment."
    );
  }

  // Provider onboarding referral page (/provider/onboarding?ref=...)
  if (!ogTags && pathname === "/provider/onboarding") {
    ogTags = getPublicPageOgTags(
      "/provider/onboarding",
      "Bring Your Work to OlogyCrew",
      "Set up a public profile, share your services and choose the business tools that fit the way you work."
    );
  }

  // Signup referral page (/signup?ref=...)
  if (!ogTags && pathname === "/signup") {
    ogTags = getPublicPageOgTags(
      "/signup",
      "Join OlogyCrew — Find Your People",
      "Create an account to find a service professional or introduce your work as an independent provider."
    );
  }

  // Public provider benefits page (static marketing route, not a provider slug).
  if (!ogTags && (url === "/for-providers" || url.startsWith("/for-providers?"))) {
    ogTags = getProviderBenefitsOgTags(origin);
    template = template.replace(/<title>[^<]*<\/title>/, "<title>For Service Providers | OlogyCrew</title>");
    template = template.replace(/<meta name="description" content="[^"]*"\s*\/>/, '<meta name="description" content="Build a public home for your services on OlogyCrew. Help customers find your work, manage bookings and conversations, and compare plans for additional business tools." />');
  }

  if (!ogTags && (pathname === "/browse" || pathname === "/search")) {
    ogTags = getPublicPageOgTags(
      "/browse",
      "Find Your Person — Explore OlogyCrew",
      "Explore service categories and real professional profiles. Compare available services, then book or request a quote when you are ready."
    );
  }

  if (!ogTags && pathname === "/pricing") {
    ogTags = getPublicPageOgTags(
      "/pricing",
      "Plans for Customers and Providers — OlogyCrew",
      "Compare customer and provider options, from getting started to the business tools that fit your work."
    );
  }

  const otherPublicPages: Record<string, [string, string]> = {
    "/featured": ["Featured Professionals — OlogyCrew", "Get to know independent professionals and explore their public profiles, services and available reviews."],
    "/experiences": ["Explore Experiences — OlogyCrew", "Find group classes and experiences offered by independent service professionals on OlogyCrew."],
    "/terms": ["Terms of Service — OlogyCrew", "Read the OlogyCrew Terms of Service."],
    "/privacy": ["Privacy Policy — OlogyCrew", "Read the OlogyCrew Privacy Policy."],
  };
  if (!ogTags && otherPublicPages[pathname]) {
    const [title, description] = otherPublicPages[pathname];
    ogTags = getPublicPageOgTags(pathname, title, description);
  }

  // Referral parameters on the homepage must not change the public share card.
  if (!ogTags && pathname === "/") {
    ogTags = await getHomepageOgTags(origin);
  }

  // Unknown or account-only pages must not advertise a provider-only promise
  // or leak internal deployment hosts in their social previews.
  if (!ogTags) {
    ogTags = await getHomepageOgTags(origin);
  }

  if (ogTags) {
    // Remove default OG tags from index.html before injecting page-specific ones
    // Social media crawlers use the FIRST og: tags they find, so we must remove defaults
    template = template.replace(/<meta property="og:[^"]*" content="[^"]*"\s*\/>\s*\n?/g, "");
    template = template.replace(/<meta name="twitter:[^"]*" content="[^"]*"\s*\/>\s*\n?/g, "");
    template = template.replace("</head>", `    ${ogTags}\n  </head>`);
  }

  // Inject JSON-LD structured data for AI agent discoverability
  if (!jsonLd && pathname === "/") {
    jsonLd = getHomepageJsonLd(origin);
  }
  if (jsonLd) {
    template = template.replace("</head>", `    ${jsonLd}\n  </head>`);
  }

  return template;
}

export async function setupVite(app: Express, server: Server) {
  // Attach HMR WebSocket to the same HTTP server so it works through the proxy.
  // The proxy forwards WebSocket upgrade on the same port (3000), so HMR works
  // when the WebSocket shares the HTTP server rather than using a separate port.
  // clientPort: 443 tells the browser to connect on HTTPS port (the proxy port)
  // so the WebSocket connection goes through the proxy correctly.
  const serverOptions = {
    middlewareMode: true,
    hmr: {
      server,
      clientPort: 443,
    },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );

      const origin = `${req.protocol}://${req.get("host")}`;
      template = await injectOgTags(url, template, origin);

      const page = await vite.transformIndexHtml(url, template);
      if (url.includes("handoff=")) {
        res.set("Cache-Control", "private, no-store");
        res.set("Referrer-Policy", "no-referrer");
      }
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  // The homepage must reach the HTML handler below so crawler-visible OG and
  // JSON-LD are injected. Keep assets and Google verification files static.
  app.use(express.static(distPath, { index: false }));

  // fall through to index.html if the file doesn't exist
  app.use("*", async (req, res) => {
    const url = req.originalUrl;
    const indexPath = path.resolve(distPath, "index.html");
    const origin = `${req.protocol}://${req.get("host")}`;

    let html = fs.readFileSync(indexPath, "utf-8");
    html = await injectOgTags(url, html, origin);
    if (url.includes("handoff=")) {
      res.set("Cache-Control", "private, no-store");
      res.set("Referrer-Policy", "no-referrer");
    }
    res.status(200).set({ "Content-Type": "text/html" }).end(html);
  });
}
