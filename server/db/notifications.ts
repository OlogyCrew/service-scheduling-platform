import { eq, and, desc, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import {
  notifications,
  notificationPreferences,
  type NotificationPreference,
} from "../../drizzle/schema";
import { getDb } from "./connection";

// ============================================================================
// NOTIFICATION MANAGEMENT
// ============================================================================

export async function createNotification(data: typeof notifications.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(notifications).values(data);

  // Push real-time SSE notification to connected clients
  try {
    const { sseManager } = await import("../sseManager");
    sseManager.pushNotification(data.userId, {
      notificationType: data.notificationType,
      title: data.title,
      message: data.message,
      actionUrl: data.actionUrl ?? null,
      relatedBookingId: data.relatedBookingId ?? null,
      createdAt: new Date(),
    });
    // Also push updated unread count
    const unread = await getUnreadCount(data.userId);
    sseManager.pushUnreadCount(data.userId, unread);
  } catch (err) {
    // SSE push is non-blocking; log and continue
    console.error("[SSE] Failed to push notification:", err);
  }

  return result;
}

export async function getUnreadCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select().from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return rows.length;
}

export async function getNotificationsByUser(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function getNotificationsByType(userId: number, notificationType: string) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(notifications)
    .where(and(
      eq(notifications.userId, userId),
      eq(notifications.notificationType, notificationType)
    ))
    .orderBy(desc(notifications.createdAt));
}

export async function markNotificationRead(notificationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(eq(notifications.id, notificationId));
}

export async function markAllNotificationsAsRead(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
}

// ============================================================================
// NOTIFICATION PREFERENCES
// ============================================================================

export async function getNotificationPreferences(userId: number): Promise<NotificationPreference | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);
  return rows[0] || null;
}

/** Delivery must distinguish an unavailable store from a confirmed missing row. */
export async function getEmailNotificationPreferences(userId: number): Promise<NotificationPreference | null> {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  const rows = await database.select().from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId)).limit(1);
  return rows[0] || null;
}

/** Concurrent emails must not replace a token already delivered to a user. */
export async function ensureNotificationUnsubscribeToken(userId: number): Promise<string> {
  if (!Number.isInteger(userId) || userId <= 0) throw new Error("Invalid unsubscribe user");
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  const token = randomBytes(32).toString("hex");
  await database.insert(notificationPreferences).values({ userId, unsubscribeToken: token })
    .onDuplicateKeyUpdate({ set: {
      unsubscribeToken: sql`COALESCE(NULLIF(${notificationPreferences.unsubscribeToken}, ''), ${token})`,
    } });
  const preferences = await getEmailNotificationPreferences(userId);
  if (!preferences?.unsubscribeToken) throw new Error("Unable to persist unsubscribe token");
  return preferences.unsubscribeToken;
}

export async function upsertNotificationPreferences(
  userId: number,
  prefs: Partial<Omit<NotificationPreference, "id" | "userId" | "createdAt" | "updatedAt">>
): Promise<NotificationPreference> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getNotificationPreferences(userId);
  if (existing) {
    await db.update(notificationPreferences)
      .set(prefs)
      .where(eq(notificationPreferences.userId, userId));
  } else {
    await db.insert(notificationPreferences).values({ userId, ...prefs });
  }
  return (await getNotificationPreferences(userId))!;
}

export async function getPreferencesByUnsubscribeToken(token: string): Promise<NotificationPreference | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(notificationPreferences)
    .where(eq(notificationPreferences.unsubscribeToken, token))
    .limit(1);
  return rows[0] || null;
}

export async function deleteNotification(notificationId: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  await db.delete(notifications)
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
  return true;
}

export async function clearAllNotifications(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  await db.delete(notifications)
    .where(eq(notifications.userId, userId));
  return true;
}

export async function unsubscribeAllEmail(token: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const pref = await getPreferencesByUnsubscribeToken(token);
  if (!pref) return false;
  await db.update(notificationPreferences)
    .set({
      emailEnabled: false, bookingEmail: false, reminderEmail: false,
      messageEmail: false, paymentEmail: false, marketingEmail: false,
    })
    .where(eq(notificationPreferences.unsubscribeToken, token));
  return true;
}

/**
 * Update individual email preferences by unsubscribe token.
 * Returns the updated preferences or null if token is invalid.
 */
export async function updateEmailPreferencesByToken(
  token: string,
  prefs: {
    bookingEmail?: boolean;
    reminderEmail?: boolean;
    messageEmail?: boolean;
    paymentEmail?: boolean;
    marketingEmail?: boolean;
  }
): Promise<{ bookingEmail: boolean; reminderEmail: boolean; messageEmail: boolean; paymentEmail: boolean; marketingEmail: boolean } | null> {
  const db = await getDb();
  if (!db) return null;
  const pref = await getPreferencesByUnsubscribeToken(token);
  if (!pref) return null;
  
  // Determine if any email type is still enabled after update
  const updated = {
    bookingEmail: prefs.bookingEmail ?? pref.bookingEmail,
    reminderEmail: prefs.reminderEmail ?? pref.reminderEmail,
    messageEmail: prefs.messageEmail ?? pref.messageEmail,
    paymentEmail: prefs.paymentEmail ?? pref.paymentEmail,
    marketingEmail: prefs.marketingEmail ?? pref.marketingEmail,
  };
  const anyEnabled = Object.values(updated).some(v => v);
  
  await db.update(notificationPreferences)
    .set({
      ...prefs,
      emailEnabled: anyEnabled,
    })
    .where(eq(notificationPreferences.unsubscribeToken, token));
  
  return updated;
}
