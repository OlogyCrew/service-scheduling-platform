import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { sdk } from "./sdk";
import { API_RATE_LIMITS, getApiRateLimitKey, sendRateLimitResponse } from "../apiRateLimit";
import { normalizePrototypeReviewUrl } from "../previewRouteNormalization";
import { handleRobotsTxt, handleSitemap } from "../sitemap";
import { handleAgentManifest, handleLlmsTxt, handleOpenApi } from "../agentDiscovery";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  const isProduction = process.env.NODE_ENV === "production";

  // Distinguishes OlogyCrew responses from preview-gateway responses during
  // diagnostics. An upstream response will not contain this application header.
  app.use((_req, res, next) => {
    res.setHeader("X-OlogyCrew-Origin", "application");
    next();
  });

  // PRIORITY 1: Force HTTPS in production
  // Cloudflare/reverse proxy sets x-forwarded-proto header
  app.use((req, res, next) => {
    const proto = req.headers['x-forwarded-proto'];
    if (proto === 'http' && req.hostname !== 'localhost' && !req.hostname.startsWith('127.')) {
      return res.redirect(301, `https://${req.hostname}${req.originalUrl}`);
    }
    next();
  });

  // Copying an inline Markdown link can accidentally include the closing backtick.
  // Redirect only prototype review URLs; all other routes remain untouched.
  app.use((req, res, next) => {
    const normalizedUrl = normalizePrototypeReviewUrl(req.originalUrl);
    if (normalizedUrl) {
      return res.redirect(302, normalizedUrl);
    }
    next();
  });

  // PRIORITY 2: Security headers via helmet
  app.use(helmet({
    contentSecurityPolicy: false, // Managed per-route for widgets
    crossOriginEmbedderPolicy: false, // Allow embedding resources
  }));

  // Trust proxy for rate limiting behind reverse proxy
  app.set("trust proxy", 1);

  // PRIORITY 2: Rate limiting
  const generalLimiter = rateLimit({
    windowMs: API_RATE_LIMITS.general.windowMs,
    limit: API_RATE_LIMITS.general.limit,
    identifier: API_RATE_LIMITS.general.identifier,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: getApiRateLimitKey,
    handler: sendRateLimitResponse,
    validate: { xForwardedForHeader: false },
    skip: (req) => {
      // Auth has endpoint-specific limits. Webhooks must never be blocked by browser traffic.
      return req.path.startsWith("/api/auth/") ||
        req.path === "/api/stripe/webhook" ||
        req.path === "/api/twilio/sms";
    },
  });
  const writeLimiter = rateLimit({
    windowMs: API_RATE_LIMITS.write.windowMs,
    limit: API_RATE_LIMITS.write.limit,
    identifier: API_RATE_LIMITS.write.identifier,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: getApiRateLimitKey,
    handler: sendRateLimitResponse,
    validate: { xForwardedForHeader: false },
    skip: (req) => req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS",
  });
  const sensitiveLimiter = rateLimit({
    windowMs: API_RATE_LIMITS.sensitive.windowMs,
    limit: API_RATE_LIMITS.sensitive.limit,
    identifier: API_RATE_LIMITS.sensitive.identifier,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: getApiRateLimitKey,
    handler: sendRateLimitResponse,
    validate: { xForwardedForHeader: false },
  });
  // Broad read throttling is a production abuse-control layer. The managed
  // development preview has its own upstream gateway limits, so applying both
  // creates a confusing double-limit during active testing and visual review.
  if (isProduction) {
    app.use("/api/", generalLimiter);
  } else {
    console.log("[RateLimit] Development: broad API read limiter disabled; write and sensitive limits remain active");
  }
  app.use("/api/trpc", writeLimiter);
  app.use("/api/oauth/", sensitiveLimiter);
  app.use("/api/export/", sensitiveLimiter);

  // Stripe webhook MUST be registered BEFORE express.json() middleware
  // to preserve raw body for signature verification
  const { handleStripeWebhook } = await import("../stripeWebhook");
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);
  
  // Twilio incoming SMS webhook for STOP/START opt-out handling
  const { handleTwilioSmsWebhook } = await import("../twilioSmsWebhook");
  app.post("/api/twilio/sms", express.urlencoded({ extended: false }), handleTwilioSmsWebhook);

  // Allow embedding in iframes for widget routes
  app.use((req, res, next) => {
    // Allow cross-origin framing for embed/widget pages and their API calls
    if (req.path.startsWith('/embed') || req.path.startsWith('/api/trpc/widget')) {
      res.setHeader('X-Frame-Options', 'ALLOWALL');
      res.removeHeader('X-Frame-Options');
      res.setHeader('Content-Security-Policy', "frame-ancestors *");
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
    next();
  });

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // OG page route for social media sharing (bypasses CDN pre-rendering)
  const { handleOgPage } = await import("../ogPageRoute");
  app.get("/api/og/:type/:id", handleOgPage);

  // Booking export routes (CSV/PDF)
  const cookieParser = await import("cookie-parser");
  app.use(cookieParser.default());
  const { handleCSVExport, handlePDFExport } = await import("../bookingExport");
  app.get("/api/export/bookings/csv", handleCSVExport);
  app.get("/api/export/bookings/pdf", handlePDFExport);

  // Analytics PDF report (Business tier)
  const { handleAnalyticsPDFExport } = await import("../analyticsExport");
  app.get("/api/export/analytics/pdf", handleAnalyticsPDFExport);

  // Payment receipt PDF
  const { handleReceiptPDF } = await import("../receiptExport");
  app.get("/api/receipt/:bookingId/pdf", handleReceiptPDF);

  // Real-time SSE notifications endpoint
  const { sseManager } = await import("../sseManager");
  app.get("/api/sse/notifications", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req as any);
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      // Disable request timeout for SSE
      req.setTimeout(0);
      sseManager.addClient(user.id, res);
    } catch {
      res.status(401).json({ error: "Unauthorized" });
    }
  });

  // Calendar feed route (iCal)
  const { handleCalendarFeed, handleBookingIcsDownload } = await import("../calendarFeed");
  app.get("/api/calendar/:token/feed.ics", handleCalendarFeed);
  app.get("/api/calendar/booking/:bookingId/download.ics", handleBookingIcsDownload);
  // Public search-discovery endpoints. Sitemap records are derived from the
  // same active/non-deleted boundaries used by the marketplace.
  app.get("/sitemap.xml", handleSitemap);
  app.get("/robots.txt", handleRobotsTxt);
  app.get("/llms.txt", handleLlmsTxt);
  app.get("/openapi.json", handleOpenApi);
  app.get("/.well-known/agents.json", handleAgentManifest);

  // Scheduled task: trial expiry check (Heartbeat cron)
  const { handleScheduledTrialExpiry } = await import("../scheduledTrialExpiry");
  app.post("/api/scheduled/trial-expiry", handleScheduledTrialExpiry);
  const { handleScheduledReferralCreditExpiry } = await import("../scheduledReferralCreditExpiry");
  app.post("/api/scheduled/referral-credit-expiry", handleScheduledReferralCreditExpiry);

  // Scheduled task: social media auto-post (Heartbeat cron)
  const { handleScheduledSocialPost, handleScheduledSocialDraft } = await import("../scheduledSocialPost");
  app.post("/api/scheduled/social-post", handleScheduledSocialPost);
  app.post("/api/scheduled/social-draft", handleScheduledSocialDraft);

  // Custom auth routes (email/password + Google OAuth)
  const customAuthRouter = (await import("../customAuthRouter")).default;
  const publicApiRouter = (await import("../publicApiRouter")).default;
  app.use("/api/public", (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });
  app.use("/api/public", publicApiRouter);
  app.use(customAuthRouter);

  // Legacy OAuth callback under /api/oauth/callback (kept for existing sessions)
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  // tRPC API
  app.use("/api/trpc", (req, res, next) => {
    if (req.path.includes("agentHandoff.resolve")) {
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("Referrer-Policy", "no-referrer");
    }
    next();
  });
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    
    // Start the reminder service (checks every 15 minutes for upcoming bookings)
    import("../reminderService").then(({ startReminderService }) => {
      startReminderService();
    }).catch(err => {
      console.error("Failed to start reminder service:", err);
    });

    // Start the review reminder service (checks every 30 minutes for completed bookings needing reviews)
    import("../reviewReminderService").then(({ startReviewReminderService }) => {
      startReviewReminderService();
    }).catch(err => {
      console.error("Failed to start review reminder service:", err);
    });

  });
}

startServer().catch(console.error);
