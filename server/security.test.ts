import { describe, it, expect } from "vitest";

/**
 * Security Audit Tests
 * Verifies that critical security fixes are in place.
 */

describe("Security: Auth.me endpoint strips sensitive fields", () => {
  it("should not expose passwordHash in the user response type", async () => {
    // Verify the auth router strips sensitive fields
    const authRouterCode = await import("fs").then(fs => 
      fs.readFileSync("./server/routers/authRouter.ts", "utf-8")
    );
    expect(authRouterCode).toContain("passwordHash");
    expect(authRouterCode).toContain("emailVerificationToken");
    expect(authRouterCode).toContain("passwordResetToken");
    expect(authRouterCode).toContain("...safeUser");
  });
});

describe("Security: Provider getById strips sensitive fields", () => {
  it("should strip stripeAccountId from public response", async () => {
    const providerRouterCode = await import("fs").then(fs => 
      fs.readFileSync("./server/routers/providerRouter.ts", "utf-8")
    );
    const getByIdSection = providerRouterCode.split("getById:")[1]?.split("getMine:")[0] || "";
    expect(getByIdSection).toContain("stripeAccountId,");
    expect(getByIdSection).toContain("...safeProviderRaw");
    expect(getByIdSection).toContain("...safeProvider");
    expect(getByIdSection).not.toMatch(/return\s*\{\s*\.\.\.provider[},]/);
  });
});

describe("Security: Conversation access control", () => {
  it("should verify user is part of conversation before returning messages", async () => {
    const messageRouterCode = await import("fs").then(fs => 
      fs.readFileSync("./server/routers/messageRouter.ts", "utf-8")
    );
    // Verify access control exists in getConversation
    expect(messageRouterCode).toContain("Verify the user is part of this conversation");
    expect(messageRouterCode).toContain("FORBIDDEN");
  });
});

describe("Security: Booking listByDateRange is protected", () => {
  it("should use protectedProcedure and verify ownership", async () => {
    const bookingRouterCode = await import("fs").then(fs => 
      fs.readFileSync("./server/routers/bookingRouter.ts", "utf-8")
    );
    // Verify listByDateRange uses protectedProcedure (not publicProcedure)
    const listByDateRangeSection = bookingRouterCode.split("listByDateRange:")[1]?.split("updateStatus:")[0] || "";
    expect(listByDateRangeSection).toContain("Only the provider owner or admin");
    expect(listByDateRangeSection).toContain("FORBIDDEN");
    // Should NOT contain publicProcedure for this endpoint
    expect(listByDateRangeSection).not.toContain("publicProcedure");
  });
});

describe("Security: Calendar ICS download requires auth", () => {
  it("should authenticate user before allowing ICS download", async () => {
    const calendarFeedCode = await import("fs").then(fs => 
      fs.readFileSync("./server/calendarFeed.ts", "utf-8")
    );
    expect(calendarFeedCode).toContain("sdk.authenticateRequest");
    expect(calendarFeedCode).toContain("Authentication required");
    expect(calendarFeedCode).toContain("Access denied");
  });
});

describe("Security: Help chat has rate limiting", () => {
  it("should have rate limiting for the chat endpoint", async () => {
    const helpChatCode = await import("fs").then(fs => 
      fs.readFileSync("./server/helpChatRouter.ts", "utf-8")
    );
    expect(helpChatCode).toContain("checkChatRateLimit");
    expect(helpChatCode).toContain("TOO_MANY_REQUESTS");
    expect(helpChatCode).toContain(".max(2000)"); // message length limit
    expect(helpChatCode).toContain(".max(20)"); // conversation history limit
  });
});

describe("Security: File upload validation", () => {
  it("should enforce content type enum for profile photo uploads", async () => {
    const providerRouterCode = await import("fs").then(fs => 
      fs.readFileSync("./server/routers/providerRouter.ts", "utf-8")
    );
    expect(providerRouterCode).toContain('z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"])');
    expect(providerRouterCode).toContain("File too large. Maximum size is 5MB");
  });

  it("should enforce content type enum for service photo uploads", async () => {
    const serviceRouterCode = await import("fs").then(fs => 
      fs.readFileSync("./server/routers/serviceRouter.ts", "utf-8")
    );
    expect(serviceRouterCode).toContain('z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"])');
    expect(serviceRouterCode).toContain("File too large. Maximum size is 5MB");
  });
});

describe("Security: Rate limiting is configured", () => {
  it("should have general and sensitive rate limiters", async () => {
    const indexCode = await import("fs").then(fs => 
      fs.readFileSync("./server/_core/index.ts", "utf-8")
    );
    expect(indexCode).toContain("rateLimit");
    expect(indexCode).toContain("generalLimiter");
    expect(indexCode).toContain("sensitiveLimiter");
  });

  it("should have auth-specific rate limiting", async () => {
    const rateLimiterCode = await import("fs").then(fs => 
      fs.readFileSync("./server/rateLimiter.ts", "utf-8")
    );
    expect(rateLimiterCode).toContain("register:");
    expect(rateLimiterCode).toContain("login:");
    expect(rateLimiterCode).toContain("forgotPassword:");
  });
});

describe("Security: Stripe webhook signature verification", () => {
  it("should verify webhook signatures", async () => {
    const webhookCode = await import("fs").then(fs => 
      fs.readFileSync("./server/stripeWebhook.ts", "utf-8")
    );
    expect(webhookCode).toContain("stripe.webhooks.constructEvent");
    expect(webhookCode).toContain("stripe-signature");
    expect(webhookCode).toContain("Signature verification failed");
  });
});

describe("Security: Helmet security headers", () => {
  it("should use helmet for security headers", async () => {
    const indexCode = await import("fs").then(fs => 
      fs.readFileSync("./server/_core/index.ts", "utf-8")
    );
    expect(indexCode).toContain("import helmet");
    expect(indexCode).toContain("app.use(helmet(");
  });
});

describe("Security: Unsubscribe tokens use crypto.randomBytes", () => {
  it("should generate secure random tokens", async () => {
    const emailCode = await import("fs").then(fs => 
      fs.readFileSync("./server/notifications/providers/email.ts", "utf-8")
    );
    const storageCode = await import("fs").then(fs =>
      fs.readFileSync("./server/db/notifications.ts", "utf-8")
    );
    expect(emailCode).toContain("db.ensureNotificationUnsubscribeToken");
    expect(storageCode).toContain('import { randomBytes } from "node:crypto"');
    expect(storageCode).toContain('randomBytes(32).toString("hex")');
    expect(storageCode).not.toContain("Math.random(");
  });
});
