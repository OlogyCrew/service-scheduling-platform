import { eq, and, gt } from "drizzle-orm";
import { getDb } from "./db/connection";
import { twoFactorCodes, trustedDevices, users } from "../drizzle/schema";
import { EmailProvider } from "./notifications/providers/email";
import crypto from "crypto";

/**
 * Generate a 6-digit verification code and store it in the database.
 * Codes expire after 10 minutes.
 */
export async function generateTwoFactorCode(userId: number): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Invalidate any existing unused codes for this user
  await db.update(twoFactorCodes)
    .set({ used: true })
    .where(and(eq(twoFactorCodes.userId, userId), eq(twoFactorCodes.used, false)));

  // Generate a 6-digit code
  const code = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await db.insert(twoFactorCodes).values({
    userId,
    code,
    expiresAt,
  });

  return code;
}

/**
 * Verify a 2FA code for a user.
 * Returns true if valid and unused, false otherwise.
 */
export async function verifyTwoFactorCode(userId: number, code: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const now = new Date();
  const [record] = await db.select()
    .from(twoFactorCodes)
    .where(and(
      eq(twoFactorCodes.userId, userId),
      eq(twoFactorCodes.code, code),
      eq(twoFactorCodes.used, false),
      gt(twoFactorCodes.expiresAt, now)
    ))
    .limit(1);

  if (!record) return false;

  // Mark as used
  await db.update(twoFactorCodes)
    .set({ used: true })
    .where(eq(twoFactorCodes.id, record.id));

  return true;
}

/**
 * Send the 2FA code via email using SendGrid.
 */
export async function sendTwoFactorEmail(email: string, code: string, name?: string): Promise<boolean> {
  const greeting = name ? `Hi ${name}` : "Hi";
  const subject = `${code} is your OlogyCrew verification code`;
  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663275372790/QD7eHrqop9F5cN2Q4sYGpD/logo-navbar_38427c60.png" alt="OlogyCrew" width="48" height="48" style="border-radius: 50%;" />
      </div>
      <h2 style="font-size: 20px; font-weight: 600; color: #1a1a1a; margin-bottom: 8px;">${greeting},</h2>
      <p style="font-size: 15px; color: #4a4a4a; line-height: 1.5; margin-bottom: 24px;">
        Your verification code is:
      </p>
      <div style="background: #f4f4f5; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
        <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #1a1a1a;">${code}</span>
      </div>
      <p style="font-size: 14px; color: #6b6b6b; line-height: 1.5;">
        This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.
      </p>
      <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 32px 0;" />
      <p style="font-size: 12px; color: #9a9a9a; text-align: center;">
        OlogyCrew — The Digital Home for Your Business
      </p>
    </div>
  `;

  try {
    const sent = await EmailProvider.sendRaw(
      email,
      subject,
      htmlBody,
      `${greeting}, your OlogyCrew verification code is: ${code}. This code expires in 10 minutes.`,
      "noreply",
      { purpose: "security" },
    );
    if (!sent) {
      console.error("[2FA] Failed to send email");
    }
    return sent;
  } catch (e) {
    console.error("[2FA] Failed to send email:", e);
    return false;
  }
}

/**
 * Create a trusted device token (valid for 30 days).
 */
export async function createTrustedDevice(userId: number, userAgent?: string): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const deviceToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await db.insert(trustedDevices).values({
    userId,
    deviceToken,
    userAgent: userAgent || null,
    expiresAt,
  });

  return deviceToken;
}

/**
 * Check if a device is trusted for a user.
 */
export async function isDeviceTrusted(userId: number, deviceToken: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const now = new Date();
  const [record] = await db.select()
    .from(trustedDevices)
    .where(and(
      eq(trustedDevices.userId, userId),
      eq(trustedDevices.deviceToken, deviceToken),
      gt(trustedDevices.expiresAt, now)
    ))
    .limit(1);

  return !!record;
}

/**
 * Remove all trusted devices for a user (e.g., when disabling 2FA).
 */
export async function clearTrustedDevices(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(trustedDevices).where(eq(trustedDevices.userId, userId));
}

/**
 * Enable or disable 2FA for a user.
 */
export async function setTwoFactorEnabled(userId: number, enabled: boolean): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ twoFactorEnabled: enabled }).where(eq(users.id, userId));
  if (!enabled) {
    await clearTrustedDevices(userId);
  }
}

/**
 * Check if a user has 2FA enabled.
 */
export async function hasTwoFactorEnabled(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const [user] = await db.select({ twoFactorEnabled: users.twoFactorEnabled })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user?.twoFactorEnabled ?? false;
}
