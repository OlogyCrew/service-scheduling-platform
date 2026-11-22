import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { pathToFileURL } from "url";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";
import { getProviderOgTags, getServiceOgTags, getCategoryOgTags, getHomepageOgTags, getProviderBenefitsOgTags, getPublicPageOgTags } from "../ogTags";
import { getCategoryJsonLd, getHomepageJsonLd, getProviderJsonLd, getServiceJsonLd } from "../structuredData";
import { OLOGYCREW_PUBLIC_ORIGIN } from "../../shared/publicUrls";
import { buildSsrPrefetch } from "./ssrCaller";

const escapeHtml = (value: unknown) => String(value ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export function composeSsrHtml(template: string, rendered: { html: string; state: string; head: { title: string; description: string; canonicalPath: string; noindex?: boolean; notFound?: boolean } }, origin: string) {
  const canonicalOrigin = process.env.CANONICAL_ORIGIN || origin;
  const canonical = `${canonicalOrigin.replace(/\/$/, "")}${rendered.head.canonicalPath}`;
  const headTags = `<title>${escapeHtml(rendered.head.title)}</title>\n    <meta name="description" content="${escapeHtml(rendered.head.description)}" />\n    <link rel="canonical" href="${escapeHtml(canonical)}" />\n    <meta name="robots" content="${rendered.head.noindex || rendered.head.notFound ? "noindex, nofollow" : "index, follow"}" />`;
  let html = template.replace(/<title>[\s\S]*?<\/title>/gi, "").replace(/<meta name="description"[^>]*>/gi, "").replace(/<link rel="canonical"[^>]*>/gi, "").replace(/<meta name="robots"[^>]*>/gi, "");
  html = html.replace("<!--app-head-->", () => headTags);
  html = html.replace("<!--app-html-->", () => `${rendered.html}<script>window.__RQ_STATE__=${JSON.stringify(rendered.state)}</script>`);
  return html;
}

export async function injectOgTags(url: string, template: string, _requestOrigin: string): Promise<string> {
  // Never let preview or internal deployment hosts leak into public share cards.
  const origin = OLOGYCREW_PUBLIC_ORIGIN;
  const pathname = url.split(/[?#]/)[0];
  let ogTags = "";
  let jsonLd = "";
  let routeMetadataIsSpecific = false;
  let primaryMetadataWasExplicitlySet = false;

  // Provider profile pages (/p/:slug)
  const providerMatch = url.match(/^\/p\/([^/?#]+)/);
  if (providerMatch) {
    ogTags = await getProviderOgTags(providerMatch[1], origin);
    jsonLd = await getProviderJsonLd(providerMatch[1], origin);
    routeMetadataIsSpecific = Boolean(ogTags);
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
        routeMetadataIsSpecific = Boolean(ogTags);
      }
    }
  }

  // Service detail pages (/service/:id)
  if (!ogTags) {
    const serviceMatch = url.match(/^\/service\/(\d+)/);
    if (serviceMatch) {
      ogTags = await getServiceOgTags(parseInt(serviceMatch[1], 10), origin);
      jsonLd = await getServiceJsonLd(parseInt(serviceMatch[1], 10), origin);
      routeMetadataIsSpecific = Boolean(ogTags);
    }
  }

  // Category pages (/category/:slug)
  if (!ogTags) {
    const categoryMatch = url.match(/^\/category\/([^/?#]+)/);
    if (categoryMatch) {
      ogTags = await getCategoryOgTags(categoryMatch[1], origin);
      jsonLd = await getCategoryJsonLd(categoryMatch[1], origin);
      routeMetadataIsSpecific = Boolean(ogTags);
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
    if (!/<title[\s>]/i.test(template)) {
      template = template.replace("</head>", "<title>The OlogyCrew Platform | Services, Bookings & Business Tools</title>\n  </head>");
    }
    if (!/<meta name="description"/i.test(template)) {
      template = template.replace("</head>", '<meta name="description" content="Discover how OlogyCrew connects service discovery, direct bookings or quotes, and provider business tools on one platform." />\n  </head>');
    }
    primaryMetadataWasExplicitlySet = true;
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
    primaryMetadataWasExplicitlySet = true;
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
    // The same route-specific values must also replace the document title and
    // description. Otherwise crawlers that use the primary HTML metadata see the
    // generic homepage values even though the social card is route-specific.
    if (!primaryMetadataWasExplicitlySet && (routeMetadataIsSpecific || pathname !== "/")) {
      const title = ogTags.match(/<meta property="og:title" content="([^"]*)"/i)?.[1];
      const description = ogTags.match(/<meta property="og:description" content="([^"]*)"/i)?.[1];
      if (title) {
        template = template.replace(/<title>[^<]*<\/title>/i, `<title>${title}</title>`);
      }
      if (description) {
        template = template.replace(
          /<meta name="description" content="[^"]*"\s*\/?\s*>/i,
          `<meta name="description" content="${description}" />`,
        );
      }
      if (title && !/<title[\s>]/i.test(template)) {
        template = template.replace("</head>", `    <title>${title}</title>\n  </head>`);
      }
      if (description && !/<meta name="description"/i.test(template)) {
        template = template.replace("</head>", `    <meta name="description" content="${description}" />\n  </head>`);
      }
    }
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
      const caller = await buildSsrPrefetch(req, res);
      const entry = await vite.ssrLoadModule("/src/entry-server.tsx");
      const rendered = await entry.render(url, (queryClient: any) => import("../../client/src/ssr/prefetch").then(({ prefetchForPath }) => prefetchForPath(url, queryClient, caller)));
      const page = composeSsrHtml(await vite.transformIndexHtml(url, template), rendered, origin);
      const privateHandoff = url.includes("handoff=");
      res.status(rendered.head.notFound ? 404 : 200).set({
        "Content-Type": "text/html",
        "Cache-Control": privateHandoff ? "private, no-store" : "no-cache",
        ...(privateHandoff ? { "Referrer-Policy": "no-referrer" } : {}),
      }).end(page);
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
  app.use(express.static(distPath, { index: false, redirect: false }));

  // fall through to index.html if the file doesn't exist
  app.use("*", async (req, res) => {
    const url = req.originalUrl;
    const indexPath = path.resolve(distPath, "index.html");
    const origin = `${req.protocol}://${req.get("host")}`;

    let html = fs.readFileSync(indexPath, "utf-8");
    html = await injectOgTags(url, html, origin);
    try {
      const caller = await buildSsrPrefetch(req, res);
      const compiledSsrEntry = path.join(import.meta.dirname, "server-ssr", "entry-server.js");
      const sourceSsrEntry = path.resolve(import.meta.dirname, "../..", "dist", "server-ssr", "entry-server.js");
      const ssrEntry = fs.existsSync(compiledSsrEntry) ? compiledSsrEntry : sourceSsrEntry;
      const entry = await import(pathToFileURL(ssrEntry).href);
      const rendered = await entry.render(url, (queryClient: any) => import("../../client/src/ssr/prefetch").then(({ prefetchForPath }) => prefetchForPath(url, queryClient, caller)));
      html = composeSsrHtml(html, rendered, origin);
      if (rendered.head.notFound) res.status(404);
    } catch (error) { console.error("[SSR] render failed", error); }
    const privateHandoff = url.includes("handoff=");
    res.set({
      "Content-Type": "text/html",
      "Cache-Control": privateHandoff ? "private, no-store" : "no-cache",
      ...(privateHandoff ? { "Referrer-Policy": "no-referrer" } : {}),
    }).end(html);
  });
}
