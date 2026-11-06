import { eq, and, inArray, isNull, not, or, sql } from "drizzle-orm";
import {
  InsertUser,
  users,
  serviceProviders,
  services,
  bookings,
  bookingSessions,
  payments,
  notificationPreferences,
  customerSubscriptions,
  notifications,
  messages,
  reviews,
  customerFavorites,
  savedProviderFolders,
  referralCodes,
  referrals,
  referralCredits,
  promoCodes,
  promoRedemptions,
  pushSubscriptions,
  portfolioItems,
  servicePhotos,
  servicePackages,
  packageItems,
  availabilitySchedules,
  availabilityOverrides,
  providerSubscriptions,
  providerCategories,
  verificationDocuments,
  contactSubmissions,
  contactReplies,
  quoteRequests,
  waitlistEntries,
  auditLog,
  crmContacts,
  crmActivityEvents,
  crmContactNotes,
  crmTasks,
  crmContactStageHistory,
  crmContactPreferences,
  crmMessageDrafts,
  crmAutomationRules,
  crmAutomationRuns,
  crmSavedSegments,
  crmOperationalState,
} from "../../drizzle/schema";
import { ENV } from "../_core/env";
import { getDb } from "./connection";
import { resolveCustomerEntitlement, resolveProviderEntitlement } from "../../shared/entitlements";
import { isApprovedSuperAdminEmail } from "../adminPolicy";

// ============================================================================
// USER MANAGEMENT
// ============================================================================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod", "firstName", "lastName", "phone", "profilePhotoUrl"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (isApprovedSuperAdminEmail(user.email)) {
      values.role = "admin";
      values.adminRole = "super_admin";
      updateSet.role = "admin";
      updateSet.adminRole = "super_admin";
    } else if (user.role !== undefined && user.role !== "admin") {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      console.warn("[Database] Owner identity did not match the approved administrator emails");
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserStripeCustomerId(userId: number, stripeCustomerId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ stripeCustomerId }).where(eq(users.id, userId));
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      id: users.id,
      openId: users.openId,
      name: users.name,
      email: users.email,
      loginMethod: users.loginMethod,
      role: users.role,
      firstName: users.firstName,
      lastName: users.lastName,
      phone: users.phone,
      profilePhotoUrl: users.profilePhotoUrl,
      emailVerified: users.emailVerified,
      hasSelectedRole: users.hasSelectedRole,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      lastSignedIn: users.lastSignedIn,
      deletedAt: users.deletedAt,
      adminRole: users.adminRole,
      authProvider: users.authProvider,
      hasProviderProfile: sql<boolean>`CASE WHEN ${serviceProviders.id} IS NOT NULL THEN true ELSE false END`.as('hasProviderProfile'),
      providerId: serviceProviders.id,
      providerSubTier: providerSubscriptions.tier,
      providerSubStatus: providerSubscriptions.status,
      providerSubTrialEndsAt: providerSubscriptions.trialEndsAt,
      providerSubCurrentPeriodEnd: providerSubscriptions.currentPeriodEnd,
      providerSubCancelAtPeriodEnd: providerSubscriptions.cancelAtPeriodEnd,
      providerSubStripeSubscriptionId: providerSubscriptions.stripeSubscriptionId,
      providerSubStripeCustomerId: providerSubscriptions.stripeCustomerId,
      customerSubTier: customerSubscriptions.tier,
      customerSubStatus: customerSubscriptions.status,
      customerSubTrialEndsAt: customerSubscriptions.trialEndsAt,
      customerSubCurrentPeriodEnd: customerSubscriptions.currentPeriodEnd,
      customerSubCancelAtPeriodEnd: customerSubscriptions.cancelAtPeriodEnd,
      customerSubStripeSubscriptionId: customerSubscriptions.stripeSubscriptionId,
      customerSubStripeCustomerId: customerSubscriptions.stripeCustomerId,
    })
    .from(users)
    .leftJoin(serviceProviders, eq(users.id, serviceProviders.userId))
    .leftJoin(providerSubscriptions, eq(serviceProviders.id, providerSubscriptions.providerId))
    .leftJoin(customerSubscriptions, eq(users.id, customerSubscriptions.userId))
    .orderBy(users.createdAt);

  return results.map(row => {
    const providerEntitlement = resolveProviderEntitlement(row.providerId ? {
      tier: row.providerSubTier,
      status: row.providerSubStatus,
      trialEndsAt: row.providerSubTrialEndsAt,
      currentPeriodEnd: row.providerSubCurrentPeriodEnd,
      cancelAtPeriodEnd: row.providerSubCancelAtPeriodEnd,
      stripeSubscriptionId: row.providerSubStripeSubscriptionId,
      stripeCustomerId: row.providerSubStripeCustomerId,
    } : null);
    const customerEntitlement = resolveCustomerEntitlement(row.customerSubTier ? {
      tier: row.customerSubTier,
      status: row.customerSubStatus,
      trialEndsAt: row.customerSubTrialEndsAt,
      currentPeriodEnd: row.customerSubCurrentPeriodEnd,
      cancelAtPeriodEnd: row.customerSubCancelAtPeriodEnd,
      stripeSubscriptionId: row.customerSubStripeSubscriptionId,
      stripeCustomerId: row.customerSubStripeCustomerId,
    } : null);
    const {
      providerSubStripeSubscriptionId: _providerStripeSubscriptionId,
      providerSubStripeCustomerId: _providerStripeCustomerId,
      customerSubStripeSubscriptionId: _customerStripeSubscriptionId,
      customerSubStripeCustomerId: _customerStripeCustomerId,
      ...adminRow
    } = row;

    return {
      ...adminRow,
      providerConfiguredTier: row.providerSubTier,
      providerSubTier: providerEntitlement.effectiveTier,
      providerEntitlementState: providerEntitlement.state,
      providerAccessEndsAt: providerEntitlement.accessEndsAt,
      providerRequiresBillingAction: providerEntitlement.requiresBillingAction,
      customerConfiguredTier: row.customerSubTier,
      customerSubTier: customerEntitlement.effectiveTier,
      customerEntitlementState: customerEntitlement.state,
      customerAccessEndsAt: customerEntitlement.accessEndsAt,
      customerRequiresBillingAction: customerEntitlement.requiresBillingAction,
    };
  });
}

// ============================================================================
// USER PROFILE UPDATE
// ============================================================================

export async function updateUserProfile(userId: number, data: {
  name?: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  profilePhotoUrl?: string | null;
  role?: "admin" | "customer" | "provider";
  billingAddressLine1?: string;
  billingAddressLine2?: string;
  billingCity?: string;
  billingState?: string;
  billingPostalCode?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updateData: Record<string, any> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.firstName !== undefined) updateData.firstName = data.firstName;
  if (data.lastName !== undefined) updateData.lastName = data.lastName;
  if (data.profilePhotoUrl !== undefined) updateData.profilePhotoUrl = data.profilePhotoUrl;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.billingAddressLine1 !== undefined) updateData.billingAddressLine1 = data.billingAddressLine1;
  if (data.billingAddressLine2 !== undefined) updateData.billingAddressLine2 = data.billingAddressLine2;
  if (data.billingCity !== undefined) updateData.billingCity = data.billingCity;
  if (data.billingState !== undefined) updateData.billingState = data.billingState;
  if (data.billingPostalCode !== undefined) updateData.billingPostalCode = data.billingPostalCode;

  if (Object.keys(updateData).length === 0) return;

  await db.update(users).set(updateData).where(eq(users.id, userId));
}

// ============================================================================
// USER SUSPENSION
// ============================================================================

export async function suspendUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, userId));
}

export async function unsuspendUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ deletedAt: null }).where(eq(users.id, userId));
}

// ============================================================================
// ACCOUNT DELETION (GDPR / CCPA) — COMPREHENSIVE
// ============================================================================

/**
 * Check if a user has any active (non-terminal) bookings.
 * Active = pending, confirmed, or in_progress.
 */
export async function hasActiveBookings(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check as customer
  const customerBookings = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        eq(bookings.customerId, userId),
        inArray(bookings.status, ["pending", "confirmed", "in_progress"] as const)
      )
    )
    .limit(1);

  if (customerBookings.length > 0) return true;

  // Check as provider
  const provider = await db
    .select({ id: serviceProviders.id })
    .from(serviceProviders)
    .where(and(eq(serviceProviders.userId, userId), isNull(serviceProviders.deletedAt)))
    .limit(1);

  if (provider.length > 0) {
    const providerBookings = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(
        and(
          eq(bookings.providerId, provider[0].id),
          inArray(bookings.status, ["pending", "confirmed", "in_progress"] as const)
        )
      )
      .limit(1);

    if (providerBookings.length > 0) return true;
  }

  return false;
}

/**
 * Comprehensive account deletion — removes/anonymizes ALL user data from ALL tables.
 *
 * Strategy:
 * - Anonymizes PII on the user record (name, email, phone, photo)
 * - Soft-deletes the user (sets deletedAt)
 * - Hard-deletes personal data from: messages, notifications, favorites,
 *   folders, push subscriptions, referral codes/credits, promo redemptions
 * - Anonymizes reviews (removes review text but keeps ratings for provider integrity)
 * - Deactivates provider profile, services, portfolio, availability, packages, categories
 * - Disables notification preferences
 * - Cancels subscriptions
 */
export async function deleteUserAccount(userId: number): Promise<{
  anonymized: boolean;
  providerDeactivated: boolean;
  servicesDeactivated: number;
  subscriptionsCancelled: number;
  messagesDeleted: number;
  notificationsDeleted: number;
  favoritesDeleted: number;
  foldersDeleted: number;
  reviewsAnonymized: number;
  referralDataDeleted: number;
  pushSubscriptionsDeleted: number;
  waitlistDeleted: number;
  bookingsDeleted: number;
  bookingSessionsDeleted: number;
  paymentsDeleted: number;
  promoCodesDeleted: number;
  crmRecordsDeleted: number;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const now = new Date();
  const anonymizedLabel = `deleted-user-${userId}`;
  let providerDeactivated = false;
  let servicesDeactivated = 0;
  let subscriptionsCancelled = 0;
  let messagesDeleted = 0;
  let notificationsDeleted = 0;
  let favoritesDeleted = 0;
  let foldersDeleted = 0;
  let reviewsAnonymized = 0;
  let referralDataDeleted = 0;
  let pushSubscriptionsDeleted = 0;
  let crmRecordsDeleted = 0;

  // 1. Anonymize and soft-delete the user
  await db.update(users).set({
    name: anonymizedLabel,
    firstName: "Deleted",
    lastName: "User",
    email: `${anonymizedLabel}@deleted.ologycrew.com`,
    phone: null,
    profilePhotoUrl: null,
    deletedAt: now,
  }).where(eq(users.id, userId));

  // 2. Delete all messages sent by or received by this user
  try {
    const msgResult = await db.delete(messages).where(
      or(
        eq(messages.senderId, userId),
        eq(messages.recipientId, userId)
      )
    );
    messagesDeleted = msgResult[0]?.affectedRows ?? 0;
  } catch (e) {
    console.warn(`[DeleteAccount] Messages cleanup: ${(e as Error).message}`);
  }

  // 3. Delete all notifications for this user
  try {
    const notifResult = await db.delete(notifications).where(
      eq(notifications.userId, userId)
    );
    notificationsDeleted = notifResult[0]?.affectedRows ?? 0;
  } catch (e) {
    console.warn(`[DeleteAccount] Notifications cleanup: ${(e as Error).message}`);
  }

  // 4. Delete customer favorites and saved provider folders
  try {
    const favResult = await db.delete(customerFavorites).where(
      eq(customerFavorites.userId, userId)
    );
    favoritesDeleted = favResult[0]?.affectedRows ?? 0;
  } catch (e) {
    console.warn(`[DeleteAccount] Favorites cleanup: ${(e as Error).message}`);
  }

  try {
    const folderResult = await db.delete(savedProviderFolders).where(
      eq(savedProviderFolders.userId, userId)
    );
    foldersDeleted = folderResult[0]?.affectedRows ?? 0;
  } catch (e) {
    console.warn(`[DeleteAccount] Folders cleanup: ${(e as Error).message}`);
  }

  // 5. Anonymize reviews (keep ratings for provider integrity, remove PII text)
  try {
    const reviewResult = await db.update(reviews).set({
      reviewText: "[Review removed - account deleted]",
    }).where(eq(reviews.customerId, userId));
    reviewsAnonymized = reviewResult[0]?.affectedRows ?? 0;
  } catch (e) {
    console.warn(`[DeleteAccount] Reviews cleanup: ${(e as Error).message}`);
  }

  // 6. Delete push subscriptions
  try {
    const pushResult = await db.delete(pushSubscriptions).where(
      eq(pushSubscriptions.userId, userId)
    );
    pushSubscriptionsDeleted = pushResult[0]?.affectedRows ?? 0;
  } catch (e) {
    console.warn(`[DeleteAccount] Push subscriptions cleanup: ${(e as Error).message}`);
  }

  // 7. Delete referral codes, referrals, and referral credits
  try {
    // Delete referral credits
    const creditResult = await db.delete(referralCredits).where(
      eq(referralCredits.userId, userId)
    );
    referralDataDeleted += creditResult[0]?.affectedRows ?? 0;

    // Delete referrals where user is referrer or referee
    const refResult = await db.delete(referrals).where(
      or(
        eq(referrals.referrerId, userId),
        eq(referrals.refereeId, userId)
      )
    );
    referralDataDeleted += refResult[0]?.affectedRows ?? 0;

    // Delete referral codes
    const codeResult = await db.delete(referralCodes).where(
      eq(referralCodes.userId, userId)
    );
    referralDataDeleted += codeResult[0]?.affectedRows ?? 0;
  } catch (e) {
    console.warn(`[DeleteAccount] Referral cleanup: ${(e as Error).message}`);
  }

  // 8. Delete promo redemptions
  try {
    await db.delete(promoRedemptions).where(
      eq(promoRedemptions.userId, userId)
    );
  } catch (e) {
    console.warn(`[DeleteAccount] Promo redemptions cleanup: ${(e as Error).message}`);
  }

  // 9. Anonymize contact submissions
  try {
    await db.update(contactSubmissions).set({
      name: anonymizedLabel,
      email: `${anonymizedLabel}@deleted.ologycrew.com`,
    }).where(eq(contactSubmissions.userId, userId));
  } catch (e) {
    console.warn(`[DeleteAccount] Contact submissions cleanup: ${(e as Error).message}`);
  }

  // 10. Anonymize quote requests where user is customer
  // Quote requests reference customerId (FK to users table) — the user row is already
  // anonymized above, so the quote's PII is effectively scrubbed. We just clean up
  // any free-text description that might contain personal info.
  try {
    await db.update(quoteRequests).set({
      description: "[Removed - account deleted]",
      location: null,
      attachmentUrls: null,
    }).where(eq(quoteRequests.customerId, userId));
  } catch (e) {
    console.warn(`[DeleteAccount] Quote requests cleanup: ${(e as Error).message}`);
  }

  // 11. Deactivate provider profile if exists
  const providerRows = await db
    .select({ id: serviceProviders.id })
    .from(serviceProviders)
    .where(eq(serviceProviders.userId, userId))
    .limit(1);

  // Remove all provider-owned and customer-owned Customers projection data.
  // Authoritative source records continue to follow their existing cleanup rules.
  try {
    const providerId = providerRows[0]?.id;
    const contactCondition = providerId
      ? or(eq(crmContacts.customerId, userId), eq(crmContacts.providerId, providerId))
      : eq(crmContacts.customerId, userId);
    const contactRows = await db.select({ id: crmContacts.id }).from(crmContacts).where(contactCondition);
    const contactIds = contactRows.map((contact) => contact.id);

    if (contactIds.length > 0) {
      const runsResult = await db.delete(crmAutomationRuns).where(inArray(crmAutomationRuns.contactId, contactIds));
      const draftsResult = await db.delete(crmMessageDrafts).where(inArray(crmMessageDrafts.contactId, contactIds));
      const tasksResult = await db.delete(crmTasks).where(inArray(crmTasks.contactId, contactIds));
      const eventsResult = await db.delete(crmActivityEvents).where(inArray(crmActivityEvents.contactId, contactIds));
      const notesResult = await db.delete(crmContactNotes).where(inArray(crmContactNotes.contactId, contactIds));
      const preferencesResult = await db.delete(crmContactPreferences).where(inArray(crmContactPreferences.contactId, contactIds));
      const stagesResult = await db.delete(crmContactStageHistory).where(inArray(crmContactStageHistory.contactId, contactIds));
      const contactsResult = await db.delete(crmContacts).where(inArray(crmContacts.id, contactIds));
      crmRecordsDeleted += [
        runsResult,
        draftsResult,
        tasksResult,
        eventsResult,
        notesResult,
        preferencesResult,
        stagesResult,
        contactsResult,
      ].reduce((total, result) => total + (result[0]?.affectedRows ?? 0), 0);
    }

    if (providerId) {
      const segmentResult = await db.delete(crmSavedSegments).where(eq(crmSavedSegments.providerId, providerId));
      crmRecordsDeleted += segmentResult[0]?.affectedRows ?? 0;
      const ruleResult = await db.delete(crmAutomationRules).where(eq(crmAutomationRules.providerId, providerId));
      crmRecordsDeleted += ruleResult[0]?.affectedRows ?? 0;
    }

    await db.update(crmOperationalState).set({ updatedByUserId: null })
      .where(eq(crmOperationalState.updatedByUserId, userId));
  } catch (e) {
    console.warn(`[DeleteAccount] Customers cleanup: ${(e as Error).message}`);
  }

  if (providerRows.length > 0) {
    const providerId = providerRows[0].id;

    await db.update(serviceProviders).set({
      isActive: false,
      deletedAt: now,
      businessName: `${anonymizedLabel}-business`,
      description: null,
    }).where(eq(serviceProviders.id, providerId));

    providerDeactivated = true;

    // Get all service IDs for this provider (needed for cascading deletes)
    const providerServices = await db
      .select({ id: services.id })
      .from(services)
      .where(eq(services.providerId, providerId));
    const serviceIds = providerServices.map(s => s.id);

    // Soft-delete all services
    if (serviceIds.length > 0) {
      const svcResult = await db.update(services).set({
        isActive: false,
        deletedAt: now,
      }).where(eq(services.providerId, providerId));
      servicesDeactivated = svcResult[0]?.affectedRows ?? 0;

      // Delete service photos for all services
      try {
        await db.delete(servicePhotos).where(
          inArray(servicePhotos.serviceId, serviceIds)
        );
      } catch (e) {
        console.warn(`[DeleteAccount] Service photos cleanup: ${(e as Error).message}`);
      }
    }

    // Delete portfolio items
    try {
      await db.delete(portfolioItems).where(
        eq(portfolioItems.providerId, providerId)
      );
    } catch (e) {
      console.warn(`[DeleteAccount] Portfolio cleanup: ${(e as Error).message}`);
    }

    // Delete availability schedules and overrides
    try {
      await db.delete(availabilitySchedules).where(
        eq(availabilitySchedules.providerId, providerId)
      );
      await db.delete(availabilityOverrides).where(
        eq(availabilityOverrides.providerId, providerId)
      );
    } catch (e) {
      console.warn(`[DeleteAccount] Availability cleanup: ${(e as Error).message}`);
    }

    // Delete provider categories
    try {
      await db.delete(providerCategories).where(
        eq(providerCategories.providerId, providerId)
      );
    } catch (e) {
      console.warn(`[DeleteAccount] Provider categories cleanup: ${(e as Error).message}`);
    }

    // Delete verification documents
    try {
      await db.delete(verificationDocuments).where(
        eq(verificationDocuments.providerId, providerId)
      );
    } catch (e) {
      console.warn(`[DeleteAccount] Verification docs cleanup: ${(e as Error).message}`);
    }

    // Get package IDs then delete package items, then packages
    try {
      const providerPackages = await db
        .select({ id: servicePackages.id })
        .from(servicePackages)
        .where(eq(servicePackages.providerId, providerId));
      const packageIds = providerPackages.map(p => p.id);

      if (packageIds.length > 0) {
        await db.delete(packageItems).where(
          inArray(packageItems.packageId, packageIds)
        );
      }
      await db.delete(servicePackages).where(
        eq(servicePackages.providerId, providerId)
      );
    } catch (e) {
      console.warn(`[DeleteAccount] Packages cleanup: ${(e as Error).message}`);
    }

    // Cancel provider subscription
    try {
      const provSubResult = await db.update(providerSubscriptions).set({
        status: "cancelled",
      }).where(
        and(
          eq(providerSubscriptions.providerId, providerId),
          inArray(providerSubscriptions.status, ["active", "trialing"])
        )
      );
      subscriptionsCancelled += provSubResult[0]?.affectedRows ?? 0;
    } catch (e) {
      console.warn(`[DeleteAccount] Provider subscription cleanup: ${(e as Error).message}`);
    }
  }

  // 12. Delete waitlist entries
  let waitlistDeleted = 0;
  try {
    const wlResult = await db.delete(waitlistEntries).where(
      eq(waitlistEntries.userId, userId)
    );
    waitlistDeleted = wlResult[0]?.affectedRows ?? 0;
  } catch (e) {
    console.warn(`[DeleteAccount] Waitlist cleanup: ${(e as Error).message}`);
  }

  // 13. Delete/anonymize bookings and related records
  let bookingsDeleted = 0;
  let bookingSessionsDeleted = 0;
  let paymentsDeleted = 0;
  try {
    // Get all booking IDs for this customer
    const userBookings = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(eq(bookings.customerId, userId));
    const bookingIds = userBookings.map(b => b.id);

    if (bookingIds.length > 0) {
      // Delete booking sessions first (child records)
      const sessResult = await db.delete(bookingSessions).where(
        inArray(bookingSessions.bookingId, bookingIds)
      );
      bookingSessionsDeleted = sessResult[0]?.affectedRows ?? 0;

      // Delete payments for these bookings
      const payResult = await db.delete(payments).where(
        inArray(payments.bookingId, bookingIds)
      );
      paymentsDeleted = payResult[0]?.affectedRows ?? 0;

      // Delete the bookings themselves
      const bkResult = await db.delete(bookings).where(
        eq(bookings.customerId, userId)
      );
      bookingsDeleted = bkResult[0]?.affectedRows ?? 0;
    }
  } catch (e) {
    console.warn(`[DeleteAccount] Bookings/payments cleanup: ${(e as Error).message}`);
  }

  // 14. Delete promo codes owned by provider (if applicable)
  let promoCodesDeleted = 0;
  if (providerRows.length > 0) {
    const providerId = providerRows[0].id;
    try {
      const promoResult = await db.delete(promoCodes).where(
        eq(promoCodes.providerId, providerId)
      );
      promoCodesDeleted = promoResult[0]?.affectedRows ?? 0;
    } catch (e) {
      console.warn(`[DeleteAccount] Promo codes cleanup: ${(e as Error).message}`);
    }
  }

  // 15. Delete contact replies to user's submissions
  try {
    const userSubmissions = await db
      .select({ id: contactSubmissions.id })
      .from(contactSubmissions)
      .where(eq(contactSubmissions.userId, userId));
    const submissionIds = userSubmissions.map(s => s.id);
    if (submissionIds.length > 0) {
      await db.delete(contactReplies).where(
        inArray(contactReplies.submissionId, submissionIds)
      );
    }
  } catch (e) {
    console.warn(`[DeleteAccount] Contact replies cleanup: ${(e as Error).message}`);
  }

  // 16. Anonymize audit log entries where user is the target
  try {
    await db.update(auditLog).set({
      details: "[Account deleted]",
    }).where(eq(auditLog.targetId, userId));
  } catch (e) {
    console.warn(`[DeleteAccount] Audit log cleanup: ${(e as Error).message}`);
  }

  // 17. Disable email notifications
  try {
    await db.update(notificationPreferences).set({
      emailEnabled: false,
      pushEnabled: false,
      smsEnabled: false,
      relationshipMessageEnabled: false,
    }).where(eq(notificationPreferences.userId, userId));
  } catch {
    // Preferences row may not exist — that's fine
  }

  // 18. Mark customer subscriptions as cancelled
  try {
    const subResult = await db.update(customerSubscriptions).set({
      status: "cancelled",
    }).where(
      and(
        eq(customerSubscriptions.userId, userId),
        inArray(customerSubscriptions.status, ["active", "trialing"])
      )
    );
    subscriptionsCancelled += subResult[0]?.affectedRows ?? 0;
  } catch {
    // No subscriptions — fine
  }

  console.log(`[DeleteAccount] User ${userId} deletion complete:`, {
    providerDeactivated,
    servicesDeactivated,
    subscriptionsCancelled,
    messagesDeleted,
    notificationsDeleted,
    favoritesDeleted,
    foldersDeleted,
    reviewsAnonymized,
    referralDataDeleted,
    pushSubscriptionsDeleted,
    waitlistDeleted,
    bookingsDeleted,
    bookingSessionsDeleted,
    paymentsDeleted,
    promoCodesDeleted,
    crmRecordsDeleted,
  });

  return {
    anonymized: true,
    providerDeactivated,
    servicesDeactivated,
    subscriptionsCancelled,
    messagesDeleted,
    notificationsDeleted,
    favoritesDeleted,
    foldersDeleted,
    reviewsAnonymized,
    referralDataDeleted,
    pushSubscriptionsDeleted,
    waitlistDeleted,
    bookingsDeleted,
    bookingSessionsDeleted,
    paymentsDeleted,
    promoCodesDeleted,
    crmRecordsDeleted,
  };
}


// ============================================================================
// CUSTOM AUTH HELPERS
// ============================================================================

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(and(eq(users.email, email), isNull(users.deletedAt))).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByGoogleId(googleId: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(and(eq(users.googleId, googleId), isNull(users.deletedAt))).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Find a soft-deleted user by Google ID (for reactivation)
export async function getDeletedUserByGoogleId(googleId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(and(eq(users.googleId, googleId), not(isNull(users.deletedAt)))).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Find a soft-deleted user by email (for reactivation)
export async function getDeletedUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(and(eq(users.email, email), not(isNull(users.deletedAt)))).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Reactivate a soft-deleted user account
export async function reactivateUser(userId: number, updates?: { name?: string; firstName?: string; lastName?: string; profilePhotoUrl?: string | null; email?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({
    deletedAt: null,
    hasSelectedRole: false,
    lastSignedIn: new Date(),
    updatedAt: new Date(),
    ...(updates || {}),
  }).where(eq(users.id, userId));

  // Clean up old provider profile and subscription from the deleted account
  // so the user starts completely fresh on re-registration
  const providerRows = await db.select({ id: serviceProviders.id }).from(serviceProviders).where(eq(serviceProviders.userId, userId)).limit(1);
  if (providerRows.length > 0) {
    const providerId = providerRows[0].id;
    // Delete any cancelled subscriptions from the old account
    try {
      await db.delete(providerSubscriptions).where(eq(providerSubscriptions.providerId, providerId));
    } catch (e) { /* ignore */ }
    // Delete old provider categories
    try {
      await db.delete(providerCategories).where(eq(providerCategories.providerId, providerId));
    } catch (e) { /* ignore */ }
    // Delete old services (must be before provider profile due to FK)
    try {
      await db.delete(services).where(eq(services.providerId, providerId));
    } catch (e) { /* ignore */ }
    // Delete the old anonymized provider profile
    try {
      await db.delete(serviceProviders).where(eq(serviceProviders.id, providerId));
    } catch (e) { /* ignore */ }
  }

  // Also clean up old customer subscription if exists
  try {
    await db.delete(customerSubscriptions).where(eq(customerSubscriptions.userId, userId));
  } catch (e) { /* ignore */ }

  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createUserWithEmail(data: {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  emailVerificationToken: string;
  emailVerificationExpires: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const openId = `email_${crypto.randomUUID()}`;
  const name = `${data.firstName} ${data.lastName}`.trim();

  await db.insert(users).values({
    openId,
    email: data.email,
    name,
    firstName: data.firstName,
    lastName: data.lastName,
    passwordHash: data.passwordHash,
    emailVerified: false,
    emailVerificationToken: data.emailVerificationToken,
    emailVerificationExpires: data.emailVerificationExpires,
    authProvider: "email",
    loginMethod: "email",
    hasSelectedRole: false,
    lastSignedIn: new Date(),
  });

  return getUserByOpenId(openId);
}

export async function createUserWithGoogle(data: {
  googleId: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  profilePhotoUrl?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const openId = `google_${data.googleId}`;

  await db.insert(users).values({
    openId,
    email: data.email,
    name: data.name,
    firstName: data.firstName,
    lastName: data.lastName,
    profilePhotoUrl: data.profilePhotoUrl || null,
    googleId: data.googleId,
    emailVerified: true,
    authProvider: "google",
    loginMethod: "google",
    hasSelectedRole: false,
    lastSignedIn: new Date(),
  });

  return getUserByOpenId(openId);
}

export async function setEmailVerificationToken(userId: number, token: string, expires: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(users).set({
    emailVerificationToken: token,
    emailVerificationExpires: expires,
  }).where(eq(users.id, userId));
}

export async function verifyUserEmail(token: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(users)
    .where(eq(users.emailVerificationToken, token))
    .limit(1);

  if (result.length === 0) return { success: false, error: "Invalid token" };

  const user = result[0];
  if (user.emailVerificationExpires && user.emailVerificationExpires < new Date()) {
    return { success: false, error: "Token expired" };
  }

  await db.update(users).set({
    emailVerified: true,
    emailVerificationToken: null,
    emailVerificationExpires: null,
  }).where(eq(users.id, user.id));

  return { success: true, user };
}

/**
 * Mark a user's email as verified (used for OAuth users who authenticated through a trusted provider).
 */
export async function markEmailVerified(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(users).set({
    emailVerified: true,
    emailVerificationToken: null,
    emailVerificationExpires: null,
  }).where(eq(users.id, userId));
}

export async function setPasswordResetToken(userId: number, token: string, expires: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(users).set({
    passwordResetToken: token,
    passwordResetExpires: expires,
  }).where(eq(users.id, userId));
}

export async function resetPassword(token: string, newPasswordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(users)
    .where(eq(users.passwordResetToken, token))
    .limit(1);

  if (result.length === 0) return { success: false, error: "Invalid token" };

  const user = result[0];
  if (user.passwordResetExpires && user.passwordResetExpires < new Date()) {
    return { success: false, error: "Token expired" };
  }

  await db.update(users).set({
    passwordHash: newPasswordHash,
    passwordResetToken: null,
    passwordResetExpires: null,
  }).where(eq(users.id, user.id));

  return { success: true, user };
}

export async function updateUserPassword(userId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}

export async function linkGoogleAccount(userId: number, googleId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(users).set({
    googleId,
    authProvider: "google",
  }).where(eq(users.id, userId));
}
