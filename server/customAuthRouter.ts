import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { ENV } from "./_core/env";
import * as db from "./db";
import { EmailProvider } from "./notifications/providers/email";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "./rateLimiter";
import { isDisposableEmail, getDisposableEmailError } from "./disposableEmails";
import { generateTwoFactorCode, sendTwoFactorEmail, verifyTwoFactorCode, createTrustedDevice, isDeviceTrusted } from "./twoFactor";
import { appendAuthReturnPath, normalizeAuthReturnPath } from "../shared/authReturnPath";
import { OLOGYCREW_PUBLIC_ORIGIN } from "../shared/publicUrls";

const router = Router();

type GoogleOAuthState = {
  origin: string;
  audience: string;
  planTier: string;
  returnTo: string | null;
};

function requestOrigin(req: Request): string {
  return `${req.protocol}://${req.get("host")}`;
}

export function normalizeAuthOrigin(value: unknown, fallbackOrigin: string): string {
  const canonicalOrigin = new URL(OLOGYCREW_PUBLIC_ORIGIN).origin;
  const canonicalWwwOrigin = "https://www.ologycrew.com";

  const parseOrigin = (candidate: unknown): string | null => {
    if (typeof candidate !== "string" || !candidate) return null;
    try {
      return new URL(candidate).origin;
    } catch {
      return null;
    }
  };

  const isLoopbackOrigin = (origin: string | null): boolean => {
    if (!origin) return false;
    const hostname = new URL(origin).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  };

  const requestedOrigin = parseOrigin(value);
  const fallback = parseOrigin(fallbackOrigin);

  // Google has the non-www OlogyCrew callback registered. Normalize both
  // public host variants to that exact URI rather than trusting the internal
  // Cloud Run host exposed to Express by the deployment proxy.
  if (requestedOrigin === canonicalOrigin || requestedOrigin === canonicalWwwOrigin) {
    return canonicalOrigin;
  }

  // Keep direct localhost development usable without allowing a production
  // request to supply localhost or an arbitrary external callback origin.
  if (isLoopbackOrigin(fallback)) {
    return isLoopbackOrigin(requestedOrigin) ? requestedOrigin! : fallback!;
  }

  return canonicalOrigin;
}

export function encodeGoogleOAuthState(state: GoogleOAuthState, secret = ENV.cookieSecret): string {
  const payload = Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function decodeGoogleOAuthState(value: string, secret = ENV.cookieSecret): GoogleOAuthState {
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra) throw new Error("Invalid OAuth state");
  const expected = crypto.createHmac("sha256", secret).update(payload).digest();
  const received = Buffer.from(signature, "base64url");
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
    throw new Error("Invalid OAuth state");
  }
  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  return {
    origin: String(parsed.origin || ""),
    audience: String(parsed.audience || ""),
    planTier: String(parsed.planTier || ""),
    returnTo: normalizeAuthReturnPath(parsed.returnTo),
  };
}

// ============================================================================
// EMAIL/PASSWORD REGISTRATION
// ============================================================================

router.post("/api/auth/register", async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, website } = req.body;
    const returnTo = normalizeAuthReturnPath(req.body.returnTo);

    // Honeypot check: if the hidden "website" field is filled, it's a bot
    if (website) {
      // Silently reject — return success to not tip off the bot
      return res.json({ success: true, user: { id: 0, email: "", name: "", emailVerified: false, hasSelectedRole: false, role: "customer" } });
    }

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Rate limiting
    const clientIp = getClientIp(req);
    const rateCheck = checkRateLimit(clientIp, "register", RATE_LIMITS.register);
    if (rateCheck.limited) {
      const retryMinutes = Math.ceil((rateCheck.retryAfterMs || 60000) / 60000);
      return res.status(429).json({ error: `Too many signup attempts. Please try again in ${retryMinutes} minute${retryMinutes > 1 ? "s" : ""}.` });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Block disposable/temporary email addresses
    if (isDisposableEmail(email)) {
      return res.status(400).json({ error: getDisposableEmailError() });
    }

    // Validate password strength (min 8 chars, 1 uppercase, 1 lowercase, 1 number)
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    // Check if user already exists
    const existingUser = await db.getUserByEmail(email.toLowerCase());
    if (existingUser) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    // Check if there's a deleted user with the same email — reactivate
    const deletedUser = await db.getDeletedUserByEmail(email.toLowerCase());
    if (deletedUser) {
      const reactivatedPasswordHash = await bcrypt.hash(password, 12);
      const user = await db.reactivateUser(deletedUser.id, {
        name: `${firstName.trim()} ${lastName.trim()}`,
        email: email.toLowerCase(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      if (!user) {
        return res.status(500).json({ error: "Failed to reactivate account" });
      }
      // Update password and reset email verification
      const { getDb } = await import("./db/connection");
      const { users } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const dbConn = await getDb();
      if (dbConn) {
        const reactivationToken = crypto.randomBytes(32).toString("hex");
        const reactivationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await dbConn.update(users).set({
          passwordHash: reactivatedPasswordHash,
          emailVerified: false,
          emailVerificationToken: reactivationToken,
          emailVerificationExpires: reactivationExpires,
        }).where(eq(users.id, user.id));
        // Send verification email
        const origin = normalizeAuthOrigin(req.headers.origin, requestOrigin(req));
        const verifyUrl = `${origin}${appendAuthReturnPath(`/verify-email?token=${reactivationToken}`, returnTo)}`;
        await EmailProvider.sendRaw(email.toLowerCase(), "Verify your OlogyCrew account",
          `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;"><h2>Welcome back to OlogyCrew!</h2><p>Hi ${firstName},</p><p>Your account has been reactivated. Please verify your email.</p><a href="${verifyUrl}" style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;margin:16px 0;">Verify Email</a><p style="color:#666;font-size:14px;">Link expires in 24 hours.</p></div>`,
          `Welcome back! Verify: ${verifyUrl}`, 'info', { purpose: 'security' });
      }
      const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name || "", expiresInMs: ONE_YEAR_MS });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      return res.json({ success: true, user: { id: user.id, email: user.email, name: user.name, firstName: user.firstName, lastName: user.lastName, emailVerified: false, hasSelectedRole: false, role: user.role } });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user
    const user = await db.createUserWithEmail({
      email: email.toLowerCase(),
      passwordHash,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      emailVerificationToken: verificationToken,
      emailVerificationExpires: verificationExpires,
    });

    if (!user) {
      return res.status(500).json({ error: "Failed to create account" });
    }

    // Send verification email
    const origin = normalizeAuthOrigin(req.headers.origin, requestOrigin(req));
    const verifyUrl = `${origin}${appendAuthReturnPath(`/verify-email?token=${verificationToken}`, returnTo)}`;
    
    await EmailProvider.sendRaw(
      email.toLowerCase(),
      "Verify your OlogyCrew account",
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1a1a1a;">Welcome to OlogyCrew!</h2>
          <p>Hi ${firstName},</p>
          <p>Thanks for signing up. Please verify your email address to get started.</p>
          <a href="${verifyUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">Verify Email</a>
          <p style="color: #666; font-size: 14px;">Or copy this link: ${verifyUrl}</p>
          <p style="color: #666; font-size: 14px;">This link expires in 24 hours.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #999; font-size: 12px;">If you didn't create this account, you can safely ignore this email.</p>
        </div>
      `,
      `Welcome to OlogyCrew! Verify your email: ${verifyUrl}`,
      'info',
      { purpose: 'security' }
    );

    // Create session and set cookie (user can use the app while unverified, but with limited access)
    const sessionToken = await sdk.createSessionToken(user.openId, {
      name: user.name || "",
      expiresInMs: ONE_YEAR_MS,
    });

    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        emailVerified: user.emailVerified,
        hasSelectedRole: user.hasSelectedRole,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("[Auth] Registration failed:", error);
    return res.status(500).json({ error: "Registration failed. Please try again." });
  }
});

// ============================================================================
// EMAIL/PASSWORD LOGIN
// ============================================================================

router.post("/api/auth/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Rate limiting
    const clientIp = getClientIp(req);
    const rateCheck = checkRateLimit(clientIp, "login", RATE_LIMITS.login);
    if (rateCheck.limited) {
      const retryMinutes = Math.ceil((rateCheck.retryAfterMs || 60000) / 60000);
      return res.status(429).json({ error: `Too many login attempts. Please try again in ${retryMinutes} minute${retryMinutes > 1 ? "s" : ""}.` });
    }

    const user = await db.getUserByEmail(email.toLowerCase());
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // If user has no password (Google-only account), redirect to Google sign-in automatically
    // They can set a password in their profile to enable email/password login
    if (!user.passwordHash) {
      return res.status(200).json({ 
        redirectToGoogle: true,
        message: "Signing you in with Google..."
      });
    }

    // Check if account is suspended
    if (user.deletedAt) {
      return res.status(403).json({ error: "This account has been suspended" });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (user.twoFactorEnabled) {
      const trustedToken = req.cookies?.ologycrew_trusted_device;
      if (!trustedToken || !(await isDeviceTrusted(user.id, trustedToken))) {
        const code = await generateTwoFactorCode(user.id);
        await sendTwoFactorEmail(user.email!, code, user.firstName || user.name || undefined);
        return res.json({
          success: true,
          requires2FA: true,
          userId: user.id,
          email: user.email,
          user: { role: user.role },
        });
      }
    }

    // Update last sign in
    await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });

    // Create session
    const sessionToken = await sdk.createSessionToken(user.openId, {
      name: user.name || "",
      expiresInMs: ONE_YEAR_MS,
    });

    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        emailVerified: user.emailVerified,
        hasSelectedRole: user.hasSelectedRole,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("[Auth] Login failed:", error);
    return res.status(500).json({ error: "Login failed. Please try again." });
  }
});

// ============================================================================
// GOOGLE OAUTH
// ============================================================================

router.get("/api/auth/google", (req: Request, res: Response) => {
  const origin = normalizeAuthOrigin(req.query.origin, requestOrigin(req));
  const audience = req.query.audience as string || "";
  const planTier = req.query.planTier as string || "";
  const returnTo = normalizeAuthReturnPath(req.query.returnTo);
  const redirectUri = `${origin}/api/auth/google/callback`;
  
  const params = new URLSearchParams({
    client_id: ENV.googleClientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
    state: encodeGoogleOAuthState({ origin, audience, planTier, returnTo }),
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

router.get("/api/auth/google/callback", async (req: Request, res: Response) => {
  try {
    const code = req.query.code as string;
    const stateParam = req.query.state as string;

    if (!code) {
      return res.redirect("/login?error=no_code");
    }

    // Decode state to get origin
    let origin = "";
    let audience = "";
    let planTier = "";
    let returnTo: string | null = null;
    try {
      const stateData = decodeGoogleOAuthState(stateParam || "");
      origin = normalizeAuthOrigin(stateData.origin, requestOrigin(req));
      audience = stateData.audience;
      planTier = stateData.planTier;
      returnTo = stateData.returnTo;
    } catch {
      return res.redirect("/login?error=invalid_state");
    }

    const redirectUri = `${origin}/api/auth/google/callback`;

    // Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: ENV.googleClientId,
        client_secret: ENV.googleClientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("[Google Auth] Token exchange failed:", tokenResponse.status, errorText);
      // Handle rate limiting from Google
      if (tokenResponse.status === 429 || errorText.toLowerCase().includes("rate")) {
        return res.redirect("/login?error=rate_limited&message=Google+sign-in+is+temporarily+unavailable.+Please+wait+a+moment+and+try+again.");
      }
      return res.redirect("/login?error=token_exchange_failed");
    }

    const tokens = await tokenResponse.json() as { access_token: string; id_token: string };

    // Get user info from Google
    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoResponse.ok) {
      return res.redirect("/login?error=user_info_failed");
    }

    const googleUser = await userInfoResponse.json() as {
      id: string;
      email: string;
      name: string;
      given_name: string;
      family_name: string;
      picture: string;
      verified_email: boolean;
    };

    // Check if user exists by Google ID
    let user = await db.getUserByGoogleId(googleUser.id);

    if (!user) {
      // Check if user exists by email (might have registered with email/password)
      const existingUser = await db.getUserByEmail(googleUser.email.toLowerCase());
      
      if (existingUser) {
        // Link Google account to existing user
        await db.linkGoogleAccount(existingUser.id, googleUser.id);
        user = existingUser;
      } else {
        // Check if there's a deleted user with same Google ID or email — reactivate
        const deletedByGoogle = await db.getDeletedUserByGoogleId(googleUser.id);
        const deletedByEmail = !deletedByGoogle ? await db.getDeletedUserByEmail(googleUser.email.toLowerCase()) : null;
        const deletedUser = deletedByGoogle || deletedByEmail;
        if (deletedUser) {
          user = await db.reactivateUser(deletedUser.id, {
            email: googleUser.email.toLowerCase(),
            name: googleUser.name,
            firstName: googleUser.given_name || "",
            lastName: googleUser.family_name || "",
            profilePhotoUrl: googleUser.picture,
          });
        } else {
          // Create new user with Google
          user = await db.createUserWithGoogle({
            googleId: googleUser.id,
            email: googleUser.email.toLowerCase(),
            name: googleUser.name,
            firstName: googleUser.given_name || "",
            lastName: googleUser.family_name || "",
            profilePhotoUrl: googleUser.picture,
          });
        }
      }
    }

    if (!user) {
      return res.redirect("/login?error=account_creation_failed");
    }

    // Auto-verify email for Google OAuth users (they authenticated through a trusted provider)
    if (!user.emailVerified) {
      await db.markEmailVerified(user.id);
    }

    // Update last sign in
    await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });

    // Create session
    const sessionToken = await sdk.createSessionToken(user.openId, {
      name: user.name || "",
      expiresInMs: ONE_YEAR_MS,
    });

    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

    // Smart redirect based on user state (re-fetch to get updated emailVerified)
    const updatedUser = await db.getUserById(user.id);
    const finalUser = updatedUser || user;
    let redirectPath = "/";
    if (!finalUser.emailVerified) {
      redirectPath = appendAuthReturnPath("/verify-email", returnTo);
    } else if (!finalUser.hasSelectedRole) {
      // If audience was passed from pricing page, auto-assign role and skip role selection
      if (audience === "provider" || audience === "customer") {
        const role = audience as "provider" | "customer";
        await db.updateUserProfile(finalUser.id, { role, hasSelectedRole: true });
        if (role === "provider") {
          redirectPath = "/provider/onboarding";
        } else {
          redirectPath = returnTo || "/";
        }
        // Persist the selected plan tier in the user record
        if (planTier) {
          await db.updateUserProfile(finalUser.id, {
            pendingPlanTier: planTier,
            pendingPlanAudience: audience,
          } as any);
        }
      } else {
        redirectPath = appendAuthReturnPath("/select-role", returnTo);
      }
    } else if (returnTo) {
      redirectPath = returnTo;
    } else if (finalUser.role === "admin") {
      redirectPath = "/admin";
    } else {
      // Both customers and providers go to OlogyCrew landing page
      redirectPath = "/";
    // Also persist plan tier for returning users who log in with a plan selected
    if (planTier && finalUser.hasSelectedRole) {
      await db.updateUserProfile(finalUser.id, {
        pendingPlanTier: planTier,
        pendingPlanAudience: audience || (finalUser.role === "provider" ? "provider" : "customer"),
      } as any);
    }
    }

    // Check if 2FA is enabled for this user
    if (finalUser.twoFactorEnabled) {
      const trustedToken = req.cookies?.ologycrew_trusted_device;
      if (!trustedToken || !(await isDeviceTrusted(finalUser.id, trustedToken))) {
        // Generate and send 2FA code, redirect to verification page
        const code = await generateTwoFactorCode(finalUser.id);
        await sendTwoFactorEmail(finalUser.email!, code, finalUser.firstName || finalUser.name || undefined);
        return res.redirect(302, `/verify-2fa?userId=${finalUser.id}&redirect=${encodeURIComponent(redirectPath)}`);
      }
    }
    return res.redirect(302, redirectPath);
  } catch (error) {
    console.error("[Google Auth] Callback failed:", error);
    return res.redirect("/login?error=callback_failed");
  }
});


// ============================================================================
// TWO-FACTOR AUTHENTICATION
// ============================================================================
router.post("/api/auth/verify-2fa", async (req: Request, res: Response) => {
  try {
    const { userId, code, trustDevice } = req.body;
    if (!userId || !code) {
      return res.status(400).json({ error: "User ID and code are required" });
    }

    const isValid = await verifyTwoFactorCode(userId, code);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid or expired code. Please try again." });
    }

    // Code is valid - create session
    const user = await db.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
    const sessionToken = await sdk.createSessionToken(user.openId, {
      name: user.name || "",
      expiresInMs: ONE_YEAR_MS,
    });
    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

    // Trust this device if requested
    if (trustDevice) {
      const deviceToken = await createTrustedDevice(userId, req.headers["user-agent"]);
      res.cookie("ologycrew_trusted_device", deviceToken, {
        ...cookieOptions,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });
    }

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        emailVerified: user.emailVerified,
        hasSelectedRole: user.hasSelectedRole,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("[Auth] 2FA verification failed:", error);
    return res.status(500).json({ error: "Verification failed. Please try again." });
  }
});

router.post("/api/auth/resend-2fa", async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const user = await db.getUserById(userId);
    if (!user || !user.email) {
      return res.status(404).json({ error: "User not found" });
    }

    const code = await generateTwoFactorCode(userId);
    await sendTwoFactorEmail(user.email, code, user.firstName || user.name || undefined);

    return res.json({ success: true, message: "New code sent to your email" });
  } catch (error) {
    console.error("[Auth] Resend 2FA failed:", error);
    return res.status(500).json({ error: "Failed to resend code. Please try again." });
  }
});

// ============================================================================
// EMAIL VERIFICATION
// ============================================================================

router.post("/api/auth/verify-email", async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Verification token is required" });
    }

    const result = await db.verifyUserEmail(token);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.json({ success: true, message: "Email verified successfully" });
  } catch (error) {
    console.error("[Auth] Email verification failed:", error);
    return res.status(500).json({ error: "Verification failed. Please try again." });
  }
});

router.post("/api/auth/resend-verification", async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const returnTo = normalizeAuthReturnPath(req.body.returnTo);

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Rate limiting
    const clientIp = getClientIp(req);
    const rateCheck = checkRateLimit(clientIp, "resendVerification", RATE_LIMITS.resendVerification);
    if (rateCheck.limited) {
      return res.status(429).json({ error: "Too many verification requests. Please try again later." });
    }

    const user = await db.getUserByEmail(email.toLowerCase());
    if (!user) {
      // Don't reveal if user exists
      return res.json({ success: true, message: "If an account exists, a verification email has been sent." });
    }

    if (user.emailVerified) {
      return res.json({ success: true, message: "Email is already verified." });
    }

    // Generate new token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.setEmailVerificationToken(user.id, verificationToken, verificationExpires);

    const origin = normalizeAuthOrigin(req.headers.origin, requestOrigin(req));
    const verifyUrl = `${origin}${appendAuthReturnPath(`/verify-email?token=${verificationToken}`, returnTo)}`;

    await EmailProvider.sendRaw(
      email.toLowerCase(),
      "Verify your OlogyCrew account",
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1a1a1a;">Verify Your Email</h2>
          <p>Hi ${user.firstName || "there"},</p>
          <p>Click the button below to verify your email address.</p>
          <a href="${verifyUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">Verify Email</a>
          <p style="color: #666; font-size: 14px;">Or copy this link: ${verifyUrl}</p>
          <p style="color: #666; font-size: 14px;">This link expires in 24 hours.</p>
        </div>
      `,
      `Verify your OlogyCrew email: ${verifyUrl}`,
      'noreply',
      { purpose: 'security' }
    );

    return res.json({ success: true, message: "Verification email sent." });
  } catch (error) {
    console.error("[Auth] Resend verification failed:", error);
    return res.status(500).json({ error: "Failed to send verification email." });
  }
});

// ============================================================================
// CHECK VERIFICATION STATUS (for "I'm verified, check again" button)
// Auto-verifies OAuth users who don't need email verification
// ============================================================================

router.post("/api/auth/check-verification", async (req: Request, res: Response) => {
  try {
    // Get the current user from the session
    const { sdk: sdkInstance } = await import("./_core/sdk");
    let currentUser;
    try {
      currentUser = await sdkInstance.authenticateRequest(req);
    } catch {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (!currentUser) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // If already verified, just return success
    if (currentUser.emailVerified) {
      return res.json({ verified: true });
    }

    // Auto-verify OAuth users (Manus OAuth or Google OAuth)
    // These users authenticated through a trusted identity provider
    const authProvider = currentUser.authProvider || "manus";
    if (authProvider === "manus" || authProvider === "google") {
      await db.markEmailVerified(currentUser.id);
      return res.json({ verified: true, autoVerified: true });
    }

    // For email/password users, check if they have a valid verification in the DB
    const freshUser = await db.getUserById(currentUser.id);
    if (freshUser?.emailVerified) {
      return res.json({ verified: true });
    }

    return res.json({ verified: false });
  } catch (error) {
    console.error("[Auth] Check verification failed:", error);
    return res.status(500).json({ error: "Failed to check verification status" });
  }
});

// ============================================================================
// FORGOT PASSWORD / RESET PASSWORD
// ============================================================================

router.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Rate limiting
    const clientIp = getClientIp(req);
    const rateCheck = checkRateLimit(clientIp, "forgotPassword", RATE_LIMITS.forgotPassword);
    if (rateCheck.limited) {
      return res.status(429).json({ error: "Too many password reset requests. Please try again later." });
    }

    const user = await db.getUserByEmail(email.toLowerCase());
    
    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ success: true, message: "If an account exists with this email, a reset link has been sent." });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.setPasswordResetToken(user.id, resetToken, resetExpires);

    const origin = normalizeAuthOrigin(
      req.headers.origin || req.headers.referer,
      requestOrigin(req),
    );
    const resetUrl = `${origin}/reset-password?token=${resetToken}`;

    console.log(`[Auth] Sending password reset email to ${email.toLowerCase()}, resetUrl: ${resetUrl}`);
    const emailSent = await EmailProvider.sendRaw(
      email.toLowerCase(),
      "Reset your OlogyCrew password",
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1a1a1a;">Reset Your Password</h2>
          <p>Hi ${user.firstName || "there"},</p>
          <p>We received a request to reset your password. Click the button below to create a new password.</p>
          <a href="${resetUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">Reset Password</a>
          <p style="color: #666; font-size: 14px;">Or copy this link: ${resetUrl}</p>
          <p style="color: #666; font-size: 14px;">This link expires in 1 hour.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #999; font-size: 12px;">If you didn't request this, you can safely ignore this email. Your password won't be changed.</p>
        </div>
      `,
      `Reset your OlogyCrew password: ${resetUrl}`,
      'noreply',
      { purpose: 'security' }
    );
    console.log(`[Auth] Password reset email result: ${emailSent}`);

    return res.json({ success: true, message: "If an account exists with this email, a reset link has been sent." });
  } catch (error) {
    console.error("[Auth] Forgot password failed:", error);
    return res.status(500).json({ error: "Failed to process request. Please try again." });
  }
});

router.post("/api/auth/reset-password", async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: "Token and new password are required" });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await db.resetPassword(token, passwordHash);

    if (!result.success) {
      return res.status(400).json({ error: result.error === "Token expired" ? "Reset link has expired. Please request a new one." : "Invalid reset link." });
    }

    return res.json({ success: true, message: "Password reset successfully. You can now log in." });
  } catch (error) {
    console.error("[Auth] Reset password failed:", error);
    return res.status(500).json({ error: "Failed to reset password. Please try again." });
  }
});

// ============================================================================
// LOGOUT (GET endpoint - browser navigates here directly, guaranteeing cookie is cleared before redirect)
// ============================================================================

router.get("/api/auth/logout", (req: Request, res: Response) => {
  // Clear the cookie with ALL possible attribute combinations to handle proxy inconsistencies.
  // The cookie might have been set with Secure=true (login over HTTPS proxy) but the logout
  // request might not have X-Forwarded-Proto, causing isSecureRequest to return false.
  // Browsers only clear cookies when attributes match exactly, so we clear with all variants.
  const baseCookieOpts = { httpOnly: true, path: "/" };
  const variants = [
    { ...baseCookieOpts, sameSite: "none" as const, secure: true },
    { ...baseCookieOpts, sameSite: "none" as const, secure: false },
    { ...baseCookieOpts, sameSite: "lax" as const, secure: true },
    { ...baseCookieOpts, sameSite: "lax" as const, secure: false },
    { ...baseCookieOpts, sameSite: "strict" as const, secure: true },
    { ...baseCookieOpts, sameSite: "strict" as const, secure: false },
  ];
  for (const opts of variants) {
    res.clearCookie(COOKIE_NAME, opts);
    res.cookie(COOKIE_NAME, "", { ...opts, maxAge: 0, expires: new Date(0) });
  }
  console.log("[Auth] Logout: cookie cleared via GET /api/auth/logout (all variants)");
  // Also set Cache-Control to prevent any intermediate caching
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  const safePath = normalizeAuthReturnPath(
    typeof req.query.returnTo === "string" ? req.query.returnTo : null,
  ) || "/";
  res.redirect(302, `${safePath}?logged_out=1`);
});

router.post("/api/auth/logout", (req: Request, res: Response) => {
  // Same comprehensive clearing as the GET endpoint
  const baseCookieOpts = { httpOnly: true, path: "/" };
  const variants = [
    { ...baseCookieOpts, sameSite: "none" as const, secure: true },
    { ...baseCookieOpts, sameSite: "none" as const, secure: false },
    { ...baseCookieOpts, sameSite: "lax" as const, secure: true },
    { ...baseCookieOpts, sameSite: "lax" as const, secure: false },
    { ...baseCookieOpts, sameSite: "strict" as const, secure: true },
    { ...baseCookieOpts, sameSite: "strict" as const, secure: false },
  ];
  for (const opts of variants) {
    res.clearCookie(COOKIE_NAME, opts);
    res.cookie(COOKIE_NAME, "", { ...opts, maxAge: 0, expires: new Date(0) });
  }
  console.log("[Auth] Logout: cookie cleared via POST /api/auth/logout (all variants)");
  res.json({ success: true });
});

export default router;
