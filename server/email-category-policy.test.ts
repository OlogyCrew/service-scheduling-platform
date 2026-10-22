import { describe, expect, it } from "vitest";
import { EMAIL_CATEGORY_RULES, maySendOptionalEmail } from "./notifications/emailPolicy";

const enabled = {
  emailEnabled: true, bookingEmail: true, reminderEmail: true,
  messageEmail: true, paymentEmail: true, marketingEmail: false,
};

describe("email notification category policy", () => {
  const categories = {
    bookingEmail: ["booking_created", "booking_confirmed", "booking_cancelled", "booking_completed", "quote_request_new", "quote_response_received", "quote_accepted", "quote_declined", "session_completed", "session_cancelled", "session_rescheduled", "waitlist_spot_available"],
    reminderEmail: ["reminder_24h", "reminder_1h"],
    messageEmail: ["message_received", "review_received"],
    paymentEmail: ["payment_received", "payment_failed", "refund_processed", "invoice_sent", "invoice_paid", "invoice_overdue", "subscription_payment_failed", "subscription_payment_restored", "subscription_renewed", "referral_completed"],
    marketingEmail: ["referral_signup", "referral_welcome", "review_reminder", "welcome_customer", "welcome_provider", "trial_7_days", "trial_3_days", "trial_1_day"],
  };
  for (const [flag, types] of Object.entries(categories)) {
    it.each(types)(`%s honors ${flag} independently`, (type) => {
      const prefs = { ...enabled, marketingEmail: true };
      expect(maySendOptionalEmail(type, prefs)).toBe(true);
      expect(maySendOptionalEmail(type, { ...prefs, [flag]: false })).toBe(false);
      expect(maySendOptionalEmail(type, { ...prefs, emailEnabled: false })).toBe(false);
      expect(EMAIL_CATEGORY_RULES[type as keyof typeof EMAIL_CATEGORY_RULES].category).toBe(flag);
    });
  }
  it("uses schema defaults for a confirmed missing row, never implicitly opts into marketing", () => {
    expect(maySendOptionalEmail("booking_confirmed", null)).toBe(true);
    expect(maySendOptionalEmail("reminder_24h", null)).toBe(true);
    expect(maySendOptionalEmail("welcome_customer", null)).toBe(false);
    expect(maySendOptionalEmail("trial_7_days", null)).toBe(false);
  });
  it("denies unknown types and malformed preference fields", () => {
    expect(maySendOptionalEmail("new_unclassified_campaign", enabled)).toBe(false);
    expect(maySendOptionalEmail("booking_confirmed", { emailEnabled: true } as any)).toBe(false);
    expect(maySendOptionalEmail("booking_confirmed", { ...enabled, bookingEmail: 1 } as any)).toBe(false);
  });
  it.each(["trial_started", "trial_expired", "subscription_cancelled", "subscription_updated", "subscription_upgraded", "subscription_downgraded", "subscription_paused", "subscription_resumed"])("account lifecycle %s still honors master email control", (type) => {
    expect(maySendOptionalEmail(type, enabled)).toBe(true);
    expect(maySendOptionalEmail(type, { ...enabled, emailEnabled: false })).toBe(false);
  });
  it.each(["contact_received", "contact_reply"])("only explicitly requested support type %s is essential", (type) => {
    expect(EMAIL_CATEGORY_RULES[type as keyof typeof EMAIL_CATEGORY_RULES].essential).toBe("support");
    expect(maySendOptionalEmail(type, enabled)).toBe(false);
  });
});
