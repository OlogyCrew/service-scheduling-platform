/**
 * Barrel re-export from domain-specific database helpers.
 *
 * All existing `import * as db from "./db"` statements continue to work.
 * For targeted imports, use `import { fn } from "./db/domain"` directly.
 *
 * Domain files under server/db/:
 *   connection.ts   – shared getDb() + schema re-exports
 *   users.ts        – user CRUD, profile, suspension
 *   providers.ts    – provider profile, earnings, Stripe connect, public profile
 *   services.ts     – service CRUD, categories, photos, search
 *   bookings.ts     – booking CRUD, reminders, export, calendar
 *   availability.ts – availability schedules & overrides
 *   reviews.ts      – review CRUD & moderation
 *   payments.ts     – payment CRUD, subscriptions, analytics
 *   notifications.ts– notification CRUD & preferences
 *   analytics.ts    – provider & admin analytics
 *   promo.ts        – promo/referral codes & redemptions
 *   verification.ts – verification document management
 *   messages.ts     – messaging between users
 */

// Re-export the legacy monolith for backward compatibility.
// All functions are still available from the original file.
// New code should import from ./db/<domain> directly.
export * from "./db-legacy";

// New modules not in the legacy file
export {
  getOrCreateReferralCode,
  getReferralCodeByCode,
  getReferralCodeByUserId,
  validateReferralCode,
  createReferral,
  completeReferral,
  getReferralStats,
  getReferralHistory,
  getPendingReferralForReferee,
  updateReferralCode,
  addReferralCredit,
  getReferralCreditBalance,
  getReferralCreditHistory,
  spendReferralCredits,
  fulfillReferralOnBookingComplete,
  getReferralAnalytics,
  getNextCreditExpiration,
  expireOldCredits,
  getCreditsExpiringSoon,
  getUserReferralTier,
  getReferrerRewardPercent,
  REFERRAL_TIERS,
} from "./db/referrals";

// Provider category management (multi-category support)
export {
  getProviderCategories,
  addProviderCategory,
  addProviderCategories,
  removeProviderCategory,
  setProviderCategories,
  getProvidersByCategory,
  searchProviders,
  getExperiences,
  getPublicCategoriesWithServiceCounts,
  searchPublicServicesForAgents,
} from "./db/services";

// Availability management
export {
  getAvailabilityByProvider,
  getAvailabilityOverrides,
  replaceWeeklySchedule,
} from "./db/availability";

// Portfolio management
export {
  getPortfolioByProvider,
  getPortfolioByProviderAndCategory,
  createPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
  getPortfolioItemCount,
} from "./db/portfolio";

// Customer favorites
export {
  addFavorite,
  removeFavorite,
  isFavorited,
  getUserFavorites,
  getFavoriteCount,
  getFavoriteProviderIdsByFolder,
} from "./db/favorites";

// Schedule conflict detection & calendar
export {
  checkProviderConflicts,
  getProviderCalendarBookings,
  deleteBooking,
  updateBookingTiming,
  updateBookingTimingWithCalendarGuard,
  createBookingWithCalendarGuard,
  rescheduleSessionWithCalendarGuard,
  BookingReservationConflictError,
  QuoteConversionConflictError,
} from "./db/bookings";

// Quote requests
export {
  createQuoteRequest,
  getQuoteById,
  getQuotesByCustomer,
  getQuotesByProvider,
  getPendingQuotesByProvider,
  respondToQuote,
  updateQuoteStatus,
  linkQuoteToBooking,
  getQuoteCountByProvider,
  deleteQuoteRequest,
} from "./db/quotes";

// Evidence-based provider verification
export {
  uploadVerificationDocument,
  getProviderDocuments,
  getAllPendingDocuments,
  getAllDocumentsForAdmin,
  reviewVerificationDocument,
  revokeVerificationDocument,
  deleteVerificationDocument,
  getDocumentById,
  syncProviderIdentityCompatibilityStatus,
  getProviderTrustProfile,
} from "./db/verification";

// Booking sessions (multi-day & recurring)
export {
  createBookingSessions,
  getSessionsByBookingId,
  getSessionsByDateRange,
  getSessionById,
  createSingleSession,
  rescheduleSession,
  updateSessionStatus,
  cancelAllSessionsForBooking,
  checkSessionConflicts,
} from "./db/bookingSessions";

// Customer subscriptions
export {
  getCustomerSubscription,
  getCustomerTier,
  getUserFavoriteCount,
  upsertCustomerSubscription,
  getCustomerSubscriptionAnalytics,
} from "./db/customerSubscriptions";

// Booking payment lifecycle helpers
export {
  upsertBookingPaymentByStripeIntent,
} from "./db/payments";

// Service packages
export {
  createPackage,
  updatePackage,
  deletePackage,
  getPackagesByProvider,
  getPublicPackagesByProvider,
} from "./db/packages";

// Customer booking analytics
export {
  getCustomerSpendingSummary,
  getCustomerMonthlySpending,
  getCustomerTopProviders,
  getCustomerCategoryBreakdown,
  getCustomerRecentBookings,
  getCustomerBookingsForExport,
} from "./db/customerAnalytics";

// Notification helpers
export {
  getUnreadCount,
  getNotificationsByType,
  createNotification,
  getNotificationPreferences,
  getEmailNotificationPreferences,
  ensureNotificationUnsubscribeToken,
  upsertNotificationPreferences,
  deleteNotification,
  clearAllNotifications,
  updateEmailPreferencesByToken,
} from "./db/notifications";

// Saved provider folders
export {
  createFolder,
  getUserFolders,
  updateFolder,
  deleteFolder,
  moveToFolder,
  bulkMoveToFolder,
} from "./db/folders";

// Contact form submissions, replies, and templates
export {
  createContactSubmission,
  getContactSubmissions,
  getContactSubmissionsFiltered,
  getContactSubmissionById,
  updateContactSubmissionStatus,
  getContactSubmissionStats,
  createContactReply,
  getContactReplies,
  createReplyTemplate,
  getReplyTemplates,
  updateReplyTemplate,
  deleteReplyTemplate,
  incrementTemplateUsage,
} from "./db/contactSubmissions";

// Push notification analytics
export {
  getPushAnalytics,
} from "./db/analytics";

// Trust score system
export {
  gatherTrustScoreInput,
  updateProviderTrustScore,
  getProviderTrustScore,
  recalculateAllTrustScores,
} from "./db/trustScore";

// Message management
export {
  deleteMessage,
  deleteConversation,
} from "./db/messages";

// Account deletion (GDPR/CCPA)
export {
  hasActiveBookings,
  deleteUserAccount,
} from "./db/users";

// Custom auth helpers
export {
  getUserByEmail,
  getUserByGoogleId,
  getDeletedUserByGoogleId,
  getDeletedUserByEmail,
  reactivateUser,
  createUserWithEmail,
  createUserWithGoogle,
  setEmailVerificationToken,
  verifyUserEmail,
  markEmailVerified,
  setPasswordResetToken,
  resetPassword,
  updateUserPassword,
  linkGoogleAccount,
} from "./db/users";

// Bulk booking drafts
export {
  createBulkDraft,
  updateBulkDraft,
  getBulkDraftsByUser,
  getBulkDraftById,
  deleteBulkDraft,
} from "./db/bulkDrafts";

// Event templates (reusable configurations)
export {
  getEventTemplatesByUser,
  getEventTemplateById,
  createEventTemplate,
  updateEventTemplate,
  incrementTemplateUsage as incrementEventTemplateUsage,
  deleteEventTemplate,
} from "./db/eventTemplates";

// Waitlist management
export {
  getNextWaitlistPosition,
  joinWaitlist,
  isUserOnWaitlist,
  leaveWaitlist,
  getUserWaitlistEntries,
  getNextOnWaitlist,
  markWaitlistNotified,
  markWaitlistBooked,
  expireOldNotifications,
  getWaitlistCount,
  getProviderWaitlistEntries,
  providerRemoveFromWaitlist,
} from "./db/waitlist";

// Provider activation
export {
  setProviderActive,
  updateTipSettings,
  getTipSettings,
  updateEstimateSettings,
  updateEmergencyService,
} from "./db/providers";

// Reviews (domain file)
export {
  getReviewsByCustomer,
} from "./db/reviews";
