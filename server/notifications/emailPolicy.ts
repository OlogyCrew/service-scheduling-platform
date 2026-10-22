import type { NotificationType } from "./types";

export type EmailCategory = "bookingEmail" | "reminderEmail" | "messageEmail" | "paymentEmail" | "marketingEmail";
export type EssentialEmailPurpose = "security" | "legal" | "support";
export interface RawEmailOptions { purpose: EssentialEmailPurpose; userId?: number }
export interface EmailPreferences {
  emailEnabled: boolean;
  bookingEmail: boolean;
  reminderEmail: boolean;
  messageEmail: boolean;
  paymentEmail: boolean;
  marketingEmail: boolean;
}
interface EmailRule { category?: EmailCategory; essential?: EssentialEmailPurpose }

// Exhaustive by NotificationType: new types must be classified explicitly.
// Actual account lifecycle changes honor the master switch. Invitations,
// onboarding promotions, review solicitation and trial upsells require opt-in.
export const EMAIL_CATEGORY_RULES: Record<NotificationType, EmailRule> = {
  booking_created: { category: "bookingEmail" },
  booking_confirmed: { category: "bookingEmail" },
  booking_cancelled: { category: "bookingEmail" },
  booking_completed: { category: "bookingEmail" },
  quote_request_new: { category: "bookingEmail" },
  quote_response_received: { category: "bookingEmail" },
  quote_accepted: { category: "bookingEmail" },
  quote_declined: { category: "bookingEmail" },
  session_completed: { category: "bookingEmail" },
  session_cancelled: { category: "bookingEmail" },
  session_rescheduled: { category: "bookingEmail" },
  waitlist_spot_available: { category: "bookingEmail" },
  reminder_24h: { category: "reminderEmail" },
  reminder_1h: { category: "reminderEmail" },
  message_received: { category: "messageEmail" },
  review_received: { category: "messageEmail" },
  payment_received: { category: "paymentEmail" },
  payment_failed: { category: "paymentEmail" },
  refund_processed: { category: "paymentEmail" },
  invoice_sent: { category: "paymentEmail" },
  invoice_paid: { category: "paymentEmail" },
  invoice_overdue: { category: "paymentEmail" },
  subscription_payment_failed: { category: "paymentEmail" },
  subscription_payment_restored: { category: "paymentEmail" },
  subscription_renewed: { category: "paymentEmail" },
  referral_completed: { category: "paymentEmail" },
  referral_signup: { category: "marketingEmail" },
  referral_welcome: { category: "marketingEmail" },
  review_reminder: { category: "marketingEmail" },
  welcome_customer: { category: "marketingEmail" },
  welcome_provider: { category: "marketingEmail" },
  trial_7_days: { category: "marketingEmail" },
  trial_3_days: { category: "marketingEmail" },
  trial_1_day: { category: "marketingEmail" },
  trial_started: {},
  trial_expired: {},
  subscription_cancelled: {},
  subscription_updated: {},
  subscription_upgraded: {},
  subscription_downgraded: {},
  subscription_paused: {},
  subscription_resumed: {},
  contact_received: { essential: "support" },
  contact_reply: { essential: "support" },
};
const DEFAULT_EMAIL_PREFERENCES: EmailPreferences = {
  emailEnabled: true, bookingEmail: true, reminderEmail: true,
  messageEmail: true, paymentEmail: true, marketingEmail: false,
};

export function getEmailRule(type: string): EmailRule | undefined {
  return Object.prototype.hasOwnProperty.call(EMAIL_CATEGORY_RULES, type)
    ? EMAIL_CATEGORY_RULES[type as NotificationType] : undefined;
}

/** null means a confirmed missing row, NOT an unavailable preference store. */
export function maySendOptionalEmail(type: string, preferences: EmailPreferences | null): boolean {
  const rule = getEmailRule(type);
  if (!rule || rule.essential) return false;
  const prefs = preferences === null ? DEFAULT_EMAIL_PREFERENCES : preferences;
  return prefs.emailEnabled === true && (!rule.category || prefs[rule.category] === true);
}
