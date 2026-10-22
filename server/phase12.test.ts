import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import { SMSProvider } from "./notifications/providers/sms";
import { EmailProvider } from "./notifications/providers/email";

// ============================================================================
// Phase 12 Tests: Twilio SMS, Notification Preferences, Unsubscribe
// ============================================================================

function createAuthContext(role: "customer" | "provider" | "admin", userId: number, name: string, email?: string) {
  return {
    user: { id: userId, openId: `test-p12-${userId}`, name, role, email },
    req: { headers: { origin: "http://localhost:3000" } } as any,
  };
}

describe("Phase 12: SMS, Notification Preferences, Unsubscribe", () => {
  let customerUserId: number;
  let providerUserId: number;

  beforeAll(async () => {
    const suffix = Math.floor(Math.random() * 100000) + 120000;

    // Create customer user
    await db.upsertUser({
      openId: `test-p12-customer-${suffix}`,
      name: "P12 Customer",
      email: `p12customer${suffix}@test.com`,
      role: "customer",
    });
    const cUser = await db.getUserByOpenId(`test-p12-customer-${suffix}`);
    customerUserId = cUser!.id;

    // Create provider user
    await db.upsertUser({
      openId: `test-p12-provider-${suffix}`,
      name: "P12 Provider",
      email: `p12provider${suffix}@test.com`,
      role: "provider",
    });
    const pUser = await db.getUserByOpenId(`test-p12-provider-${suffix}`);
    providerUserId = pUser!.id;
  });

  // ========================================================================
  // SMS Provider Tests
  // ========================================================================

  describe("SMS Provider", () => {
    it("should instantiate SmsProvider", () => {
      const provider = new SMSProvider();
      expect(provider.name).toBe("sms");
    });

    it("should support 'sms' channel", () => {
      const provider = new SMSProvider();
      expect(provider.supports("sms")).toBe(true);
      expect(provider.supports("email")).toBe(false);
      expect(provider.supports("push")).toBe(false);
    });

    it("should fail gracefully when no phone number provided", async () => {
      const provider = new SMSProvider();
      const result = await provider.send({
        type: "booking_created",
        channel: "sms",
        recipient: { userId: 1, name: "Test" },
        data: { bookingNumber: "BK-001" },
      });
      expect(result).toBe(false);
    });

    it("should fail gracefully when the Twilio client is unavailable", async () => {
      const provider = new SMSProvider();
      (provider as unknown as { initialized: boolean; client: null }).initialized = true;
      (provider as unknown as { initialized: boolean; client: null }).client = null;
      const result = await provider.send({
        type: "booking_created",
        channel: "sms",
        recipient: { userId: 1, name: "Test", phone: "+15551234567" },
        data: { bookingNumber: "BK-001" },
      });
      expect(result).toBe(false);
    });
  });

  // ========================================================================
  // Email Provider Tests
  // ========================================================================

  describe("Email Provider", () => {
    it("should instantiate EmailProvider", () => {
      const provider = new EmailProvider();
      expect(provider.name).toBe("email");
    });

    it("should support 'email' channel", () => {
      const provider = new EmailProvider();
      expect(provider.supports("email")).toBe(true);
      expect(provider.supports("sms")).toBe(false);
    });

    it("should fail gracefully when no email provided", async () => {
      const provider = new EmailProvider();
      const result = await provider.send({
        type: "booking_created",
        channel: "email",
        recipient: { userId: 1, name: "Test" },
        data: {},
      });
      expect(result).toBe(false);
    });
  });

  // ========================================================================
  // Notification Preferences Tests
  // ========================================================================

  describe("Notification Preferences", () => {
    it("should return null for user with no preferences", async () => {
      const prefs = await db.getNotificationPreferences(customerUserId);
      expect(prefs).toBeNull();
    });

    it("should create default preferences via upsert", async () => {
      const prefs = await db.upsertNotificationPreferences(customerUserId, {});
      expect(prefs).toBeDefined();
      expect(prefs.userId).toBe(customerUserId);
      expect(prefs.emailEnabled).toBe(true);
      expect(prefs.smsEnabled).toBe(true);
      expect(prefs.bookingEmail).toBe(true);
      expect(prefs.reminderEmail).toBe(true);
      expect(prefs.marketingEmail).toBe(false);
      expect(prefs.relationshipMessageEnabled).toBe(false);
    });

    it("should update existing preferences", async () => {
      const prefs = await db.upsertNotificationPreferences(customerUserId, {
        emailEnabled: false,
        smsEnabled: false,
      });
      expect(prefs.emailEnabled).toBe(false);
      expect(prefs.smsEnabled).toBe(false);
    });

    it("should re-enable preferences", async () => {
      const prefs = await db.upsertNotificationPreferences(customerUserId, {
        emailEnabled: true,
        smsEnabled: true,
      });
      expect(prefs.emailEnabled).toBe(true);
      expect(prefs.smsEnabled).toBe(true);
    });

    it("should get preferences via tRPC", async () => {
      const caller = appRouter.createCaller(createAuthContext("customer", customerUserId, "P12 Customer"));
      const prefs = await caller.notification.getPreferences();
      expect(prefs).toBeDefined();
      expect(prefs!.emailEnabled).toBe(true);
    });

    it("should update preferences via tRPC", async () => {
      const caller = appRouter.createCaller(createAuthContext("customer", customerUserId, "P12 Customer"));
      const prefs = await caller.notification.updatePreferences({
        reminderEmail: false,
        bookingSms: false,
      });
      expect(prefs.reminderEmail).toBe(false);
      expect(prefs.bookingSms).toBe(false);
    });

    it("should toggle individual email types", async () => {
      const caller = appRouter.createCaller(createAuthContext("customer", customerUserId, "P12 Customer"));
      
      // Disable marketing email
      await caller.notification.updatePreferences({ marketingEmail: true });
      let prefs = await caller.notification.getPreferences();
      expect(prefs!.marketingEmail).toBe(true);

      // Re-disable
      await caller.notification.updatePreferences({ marketingEmail: false });
      prefs = await caller.notification.getPreferences();
      expect(prefs!.marketingEmail).toBe(false);
    });

    it("should explicitly opt into and back out of provider relationship messages", async () => {
      const caller = appRouter.createCaller(createAuthContext("customer", customerUserId, "P12 Customer"));
      await expect(caller.notification.updatePreferences({ relationshipMessageEnabled: true })).resolves.toMatchObject({ relationshipMessageEnabled: true });
      await expect(caller.notification.updatePreferences({ relationshipMessageEnabled: false })).resolves.toMatchObject({ relationshipMessageEnabled: false });
    });

    it("should toggle individual SMS types", async () => {
      const caller = appRouter.createCaller(createAuthContext("customer", customerUserId, "P12 Customer"));
      
      await caller.notification.updatePreferences({ messageSms: true, paymentSms: true });
      let prefs = await caller.notification.getPreferences();
      expect(prefs!.messageSms).toBe(true);
      expect(prefs!.paymentSms).toBe(true);

      await caller.notification.updatePreferences({ messageSms: false, paymentSms: false });
      prefs = await caller.notification.getPreferences();
      expect(prefs!.messageSms).toBe(false);
      expect(prefs!.paymentSms).toBe(false);
    });
  });

  // ========================================================================
  // Unsubscribe Token Tests
  // ========================================================================

  describe("Unsubscribe Tokens", () => {
    let unsubToken: string;

    it("should generate unsubscribe token", async () => {
      const token = require("crypto").randomBytes(32).toString("hex");
      const prefs = await db.upsertNotificationPreferences(providerUserId, {
        unsubscribeToken: token,
      });
      expect(prefs.unsubscribeToken).toBe(token);
      unsubToken = token;
    });

    it("should find preferences by unsubscribe token", async () => {
      const prefs = await db.getPreferencesByUnsubscribeToken(unsubToken);
      expect(prefs).toBeDefined();
      expect(prefs!.userId).toBe(providerUserId);
    });

    it("should return null for invalid token", async () => {
      const prefs = await db.getPreferencesByUnsubscribeToken("invalid-token-xyz");
      expect(prefs).toBeNull();
    });

    it("should unsubscribe all email via token", async () => {
      const success = await db.unsubscribeAllEmail(unsubToken);
      expect(success).toBe(true);

      const prefs = await db.getNotificationPreferences(providerUserId);
      expect(prefs!.emailEnabled).toBe(false);
      expect(prefs!.bookingEmail).toBe(false);
      expect(prefs!.reminderEmail).toBe(false);
      expect(prefs!.messageEmail).toBe(false);
      expect(prefs!.paymentEmail).toBe(false);
      expect(prefs!.marketingEmail).toBe(false);
    });

    it("keeps concurrent email tokens stable without undoing unsubscribe choices", async () => {
      const tokens = await Promise.all([
        db.ensureNotificationUnsubscribeToken(providerUserId),
        db.ensureNotificationUnsubscribeToken(providerUserId),
      ]);
      expect(tokens).toEqual([unsubToken, unsubToken]);
      const prefs = await db.getEmailNotificationPreferences(providerUserId);
      expect(prefs!.emailEnabled).toBe(false);
      expect(prefs!.bookingEmail).toBe(false);
      expect(prefs!.marketingEmail).toBe(false);
    });

    it("should fail unsubscribe with invalid token", async () => {
      const success = await db.unsubscribeAllEmail("nonexistent-token");
      expect(success).toBe(false);
    });

    it("should get preferences by token via tRPC (public)", async () => {
      const caller = appRouter.createCaller({} as any);
      const prefs = await caller.notification.getByToken({ token: unsubToken });
      expect(prefs).toBeDefined();
      expect(prefs!.emailEnabled).toBe(false);
    });

    it("should return null for invalid token via tRPC", async () => {
      const caller = appRouter.createCaller({} as any);
      const prefs = await caller.notification.getByToken({ token: "bad-token" });
      expect(prefs).toBeNull();
    });

    it("should unsubscribe via tRPC (public)", async () => {
      // Re-enable first
      await db.upsertNotificationPreferences(providerUserId, {
        emailEnabled: true,
        bookingEmail: true,
      });

      const caller = appRouter.createCaller({} as any);
      const result = await caller.notification.unsubscribe({ token: unsubToken });
      expect(result.success).toBe(true);

      const prefs = await db.getNotificationPreferences(providerUserId);
      expect(prefs!.emailEnabled).toBe(false);
    });
  });

  // ========================================================================
  // Mark All Notifications Read
  // ========================================================================

  describe("Mark All Notifications Read", () => {
    it("should create and mark all notifications as read", async () => {
      // Create a few notifications
      await db.createNotification({
        userId: customerUserId,
        notificationType: "booking_created",
        title: "P12 Test Notification 1",
        message: "Test message 1",
      });
      await db.createNotification({
        userId: customerUserId,
        notificationType: "reminder_24h",
        title: "P12 Test Notification 2",
        message: "Test message 2",
      });

      // Verify unread
      let unread = await db.getUserNotifications(customerUserId, true);
      const unreadBefore = unread.length;
      expect(unreadBefore).toBeGreaterThanOrEqual(2);

      // Mark all read
      await db.markAllNotificationsAsRead(customerUserId);

      // Verify all read
      unread = await db.getUserNotifications(customerUserId, true);
      expect(unread.length).toBe(0);
    });

    it("should mark all read via tRPC", async () => {
      // Create another notification
      await db.createNotification({
        userId: customerUserId,
        notificationType: "booking_confirmed",
        title: "P12 Test Notification 3",
        message: "Test message 3",
      });

      const caller = appRouter.createCaller(createAuthContext("customer", customerUserId, "P12 Customer"));
      
      // Verify unread count
      let count = await caller.notification.unreadCount();
      expect(count.count).toBeGreaterThanOrEqual(1);

      // Mark all read
      const result = await caller.notification.markAllRead();
      expect(result.success).toBe(true);

      // Verify all read
      count = await caller.notification.unreadCount();
      expect(count.count).toBe(0);
    });
  });

  // ========================================================================
  // Notification List & Filtering
  // ========================================================================

  describe("Notification List", () => {
    it("should list all notifications for user", async () => {
      const caller = appRouter.createCaller(createAuthContext("customer", customerUserId, "P12 Customer"));
      const all = await caller.notification.list({ unreadOnly: false });
      expect(Array.isArray(all)).toBe(true);
      expect(all.length).toBeGreaterThanOrEqual(3);
    });

    it("should filter unread only", async () => {
      // All should be read from previous test
      const caller = appRouter.createCaller(createAuthContext("customer", customerUserId, "P12 Customer"));
      const unread = await caller.notification.list({ unreadOnly: true });
      expect(Array.isArray(unread)).toBe(true);
      expect(unread.length).toBe(0);
    });
  });
});
