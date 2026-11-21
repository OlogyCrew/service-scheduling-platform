import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Mail, Eye } from "lucide-react";

const SITE_URL = typeof window === "undefined" ? "https://ologycrew.com" : window.location.origin;
const LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663275372790/QD7eHrqop9F5cN2Q4sYGpD/ologycrew-logo-bpuqPGEAxn4sv2cDWUMqrC.webp";

function formatEmailHTML(body: string): string {
  let html = body
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[(.*?)\]\((.*?)\)/g, (_: string, text: string, href: string) => {
      const fullHref = href.startsWith('/') ? `${SITE_URL}${href}` : href;
      return `<a href="${fullHref}" style="color: #2563eb; text-decoration: none;">${text}</a>`;
    })
    .replace(/\n- /g, '<br>• ')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');

  const unsubscribeUrl = `${SITE_URL}/unsubscribe/test-token-123`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1e3a5f 0%, #0ea5e9 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <img src="${LOGO_URL}" alt="OlogyCrew" style="max-width: 220px; height: auto; margin-bottom: 4px;" />
  </div>
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p>${html}</p>
  </div>
  <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
    <p>&copy; ${new Date().getFullYear()} OlogyCrew. All rights reserved.</p>
    <p>
      <a href="${unsubscribeUrl}" style="color: #6b7280; text-decoration: underline;">Unsubscribe from emails</a>
      &nbsp;&middot;&nbsp;
      <a href="${SITE_URL}/notification-settings" style="color: #6b7280; text-decoration: underline;">Manage preferences</a>
    </p>
  </div>
</body>
</html>`.trim();
}

interface EmailTemplate {
  type: string;
  category: string;
  subject: string;
  body: string;
}

const testEmails: EmailTemplate[] = [
  // BOOKING NOTIFICATIONS
  {
    type: "booking_created",
    category: "Booking",
    subject: "Booking Request #BK-10042 - Deep Tissue Massage",
    body: `Hello Gary,

You have a new booking request!

**Service:** Deep Tissue Massage
**Customer:** Sarah Johnson
**Date:** May 5, 2026
**Time:** 2:00 PM - 3:30 PM

Please review and confirm this booking in your dashboard.

[View Booking](/provider/bookings/42)

Best regards,
OlogyCrew Team`,
  },
  {
    type: "booking_confirmed",
    category: "Booking",
    subject: "Booking Confirmed #BK-10042 - Deep Tissue Massage",
    body: `Hello Sarah,

Your booking has been confirmed!

**Service:** Deep Tissue Massage
**Provider:** Gary Chisolm
**Date:** May 5, 2026
**Time:** 2:00 PM - 3:30 PM
**Total:** $120.00

[View Booking Details](/bookings/42)

We'll send you a reminder 24 hours before your appointment.

Best regards,
OlogyCrew Team`,
  },
  {
    type: "booking_cancelled",
    category: "Booking",
    subject: "Booking Cancelled #BK-10042",
    body: `Hello Sarah,

Your booking has been cancelled.

**Service:** Deep Tissue Massage
**Original Date:** May 5, 2026
**Reason:** Schedule conflict

A refund of $120.00 will be processed within 5-7 business days.

If you have any questions, please contact support.

Best regards,
OlogyCrew Team`,
  },
  {
    type: "booking_completed",
    category: "Booking",
    subject: "Service Completed - Please Review",
    body: `Hello Sarah,

Thank you for using OlogyCrew!

Your Deep Tissue Massage service with Gary Chisolm has been completed.

We'd love to hear about your experience. Please take a moment to leave a review.

[Leave a Review](/reviews/new?booking=42)

Best regards,
OlogyCrew Team`,
  },

  // PAYMENT NOTIFICATIONS
  {
    type: "payment_received",
    category: "Payment",
    subject: "Payment Received - $120.00",
    body: `Hello Sarah,

We've received your payment!

**Amount:** $120.00
**Booking:** #BK-10042
**Service:** Deep Tissue Massage
**Date:** May 5, 2026

[View Receipt](/payments/receipt/42)

Best regards,
OlogyCrew Team`,
  },
  {
    type: "payment_failed",
    category: "Payment",
    subject: "Payment Failed - Action Required",
    body: `Hello Sarah,

We were unable to process your payment for booking #BK-10042.

**Service:** Deep Tissue Massage
**Amount:** $120.00

Please update your payment method and try again.

[Update Payment](/payments/update?booking=42)

Best regards,
OlogyCrew Team`,
  },

  // MESSAGING
  {
    type: "message_received",
    category: "Messaging",
    subject: "New Message from Sarah Johnson",
    body: `Hello Gary,

You have a new message regarding booking #BK-10042.

**From:** Sarah Johnson
**Message:** Hi Gary, I wanted to confirm the address for tomorrow's appointment. Is it still at 123 Main St?

[Reply to Message](/messages?booking=42)

Best regards,
OlogyCrew Team`,
  },

  // REVIEWS
  {
    type: "review_received",
    category: "Reviews",
    subject: "New Review Received",
    body: `Hello Gary,

You've received a new review!

**Rating:** 5/5 stars
**Customer:** Sarah Johnson
**Service:** Deep Tissue Massage
**Review:** Amazing experience! Gary is incredibly skilled and professional. The deep tissue massage was exactly what I needed. Highly recommend!

[View Review](/provider/reviews)

Best regards,
OlogyCrew Team`,
  },

  // REMINDERS
  {
    type: "reminder_24h",
    category: "Reminders",
    subject: "Reminder: Upcoming Appointment Tomorrow",
    body: `Hello Sarah,

This is a reminder about your upcoming appointment.

**Service:** Deep Tissue Massage
**Provider:** Gary Chisolm
**Date:** May 5, 2026
**Time:** 2:00 PM
**Location:** 123 Main St, Atlanta, GA 30301

[View Booking](/bookings/42)

See you tomorrow!

Best regards,
OlogyCrew Team`,
  },
  {
    type: "reminder_1h",
    category: "Reminders",
    subject: "Reminder: Appointment in 1 Hour",
    body: `Hello Sarah,

Your appointment is coming up in 1 hour!

**Service:** Deep Tissue Massage
**Time:** 2:00 PM
**Location:** 123 Main St, Atlanta, GA 30301

[View Booking](/bookings/42)

Best regards,
OlogyCrew Team`,
  },

  // SUBSCRIPTION
  {
    type: "subscription_cancelled",
    category: "Subscription",
    subject: "Subscription Cancelled - Gary's Wellness Studio",
    body: `Hello,

Your OlogyCrew subscription has been cancelled.

**Business:** Gary's Wellness Studio

Your account has been downgraded to the Starter tier. You can resubscribe at any time from My Dashboard.

Best regards,
OlogyCrew Team`,
  },
  {
    type: "subscription_updated",
    category: "Subscription",
    subject: "Subscription Updated - Pro Plan",
    body: `Hello,

Your OlogyCrew subscription has been updated.

**New Plan:** Pro
**Business:** Gary's Wellness Studio

Enjoy your new features! Visit your dashboard to explore what's available.

Best regards,
OlogyCrew Team`,
  },

  // REFUND
  {
    type: "refund_processed",
    category: "Payment",
    subject: "Refund Processed - $120.00",
    body: `Hello,

Your refund has been processed successfully.

**Booking:** #BK-10042
**Refund Amount:** $120.00
**Original Amount:** $120.00

The refund will appear on your statement within 5-10 business days, depending on your bank.

If you have any questions, please don't hesitate to contact us.

Best regards,
OlogyCrew Team`,
  },

  // QUOTE NOTIFICATIONS
  {
    type: "quote_request_new",
    category: "Quotes",
    subject: "New Quote Request: Kitchen Renovation Estimate",
    body: `Hello Gary,

You have a new quote request from Marcus Williams!

**Request:** Kitchen Renovation Estimate
**Description:** Looking for a complete kitchen renovation including new countertops, cabinets, and backsplash. Kitchen is approximately 200 sq ft.
**Preferred Date:** May 15, 2026
**Preferred Time:** Morning
**Location:** 456 Oak Ave, Atlanta, GA 30302

Please respond with your pricing in My Dashboard.

Best regards,
OlogyCrew Team`,
  },
  {
    type: "quote_response_received",
    category: "Quotes",
    subject: "Quote Received: $3,500.00 for Kitchen Renovation Estimate",
    body: `Hello Marcus,

Gary Chisolm has responded to your quote request!

**Request:** Kitchen Renovation Estimate
**Quoted Price:** $3,500.00
**Estimated Duration:** 2 weeks
**Provider Notes:** Price includes materials and labor. We can start as early as May 20th. I'll bring sample materials for you to choose from during the initial consultation.
**Valid Until:** May 30, 2026

Visit your Quotes page to accept or decline this offer.

Best regards,
OlogyCrew Team`,
  },
  {
    type: "quote_accepted",
    category: "Quotes",
    subject: "Quote Accepted by Marcus Williams - Kitchen Renovation Estimate",
    body: `Hello Gary,

Great news! Marcus Williams has accepted your quote.

**Request:** Kitchen Renovation Estimate
**Accepted Price:** $3,500.00

The customer can now book this service directly. Check your dashboard for updates.

Best regards,
OlogyCrew Team`,
  },
  {
    type: "quote_declined",
    category: "Quotes",
    subject: "Quote Declined - Kitchen Renovation Estimate",
    body: `Hello Gary,

Marcus Williams has declined your quote.

**Request:** Kitchen Renovation Estimate
**Quoted Price:** $3,500.00
**Reason:** Found a lower price elsewhere

Don't be discouraged — keep responding to quote requests to grow your business!

Best regards,
OlogyCrew Team`,
  },

  // SESSION NOTIFICATIONS
  {
    type: "session_completed",
    category: "Sessions",
    subject: "Session Completed - Personal Training",
    body: `Hello Sarah,

Your session has been marked as completed.

**Service:** Personal Training
**Date:** May 3, 2026
**Session:** 3 of 10

Thank you for using OlogyCrew!

Best regards,
OlogyCrew Team`,
  },
  {
    type: "session_cancelled",
    category: "Sessions",
    subject: "Session Cancelled - Personal Training",
    body: `Hello Sarah,

A session has been cancelled.

**Service:** Personal Training
**Date:** May 7, 2026
**Session:** 4 of 10
**Notes:** Provider is unavailable due to a scheduling conflict. We'll reschedule for next week.

Please contact your provider if you have questions.

Best regards,
OlogyCrew Team`,
  },
  {
    type: "session_rescheduled",
    category: "Sessions",
    subject: "Session Rescheduled - Personal Training",
    body: `Hello Sarah,

A session has been rescheduled.

**Service:** Personal Training
**Original Date:** May 7, 2026
**New Date:** May 9, 2026
**New Time:** 10:00 AM

Please update your calendar accordingly.

Best regards,
OlogyCrew Team`,
  },

  // REVIEW REMINDER
  {
    type: "review_reminder",
    category: "Reviews",
    subject: "How was your Deep Tissue Massage? Leave a review!",
    body: `Hello Sarah,

We hope you enjoyed your recent Deep Tissue Massage with Gary Chisolm!

Your feedback helps other customers find great service providers and helps Gary Chisolm improve.

It only takes a minute to share your experience.

[Leave a Review](/reviews/new?booking=42)

If you've already left a review, thank you! You can ignore this message.

Best regards,
OlogyCrew Team`,
  },

  // REFERRAL NOTIFICATIONS
  {
    type: "referral_signup",
    category: "Referrals",
    subject: "Someone joined OlogyCrew using your referral!",
    body: `Hello Gary,

Great news! **Lisa Thompson** has signed up on OlogyCrew using your referral link.

Your referral is now **pending**. Once they complete their first booking, you'll earn referral credits that can be applied to your future bookings.

Keep sharing your referral link to earn more rewards!

[View Your Referrals](/referrals)

Best regards,
OlogyCrew Team`,
  },
  {
    type: "referral_completed",
    category: "Referrals",
    subject: "You earned $10.00 in referral credits!",
    body: `Hello Gary,

Congratulations! Your referral **Lisa Thompson** has completed a booking for **Mobile Auto Detailing**.

You've earned **$10.00** in referral credits! These credits will be automatically applied to your next booking.

[View Your Credit Balance](/referrals)

Thank you for helping grow the OlogyCrew community!

Best regards,
OlogyCrew Team`,
  },
  {
    type: "referral_welcome",
    category: "Referrals",
    subject: "Welcome to OlogyCrew — You've been referred!",
    body: `Hello Lisa,

Welcome to OlogyCrew! You were referred by **Gary Chisolm**.

As a referred member, you'll receive a **10% discount** on your first booking!

Browse our 48+ service categories and book your first appointment today.

[Browse Services](/services)

Best regards,
OlogyCrew Team`,
  },

  // TRIAL MILESTONE NOTIFICATIONS
  {
    type: "trial_started",
    category: "Trial",
    subject: "Welcome to Your 14-Day Pro Trial!",
    body: `Hello Gary,

Congratulations! Your **14-day Pro trial** has started.

Here's what you now have access to:
- **Up to 10 services** listed on the platform
- **3 photos per service** to showcase your work
- **Priority search placement** to attract more customers
- **Custom profile slug** for easy sharing

Your trial ends on **May 16, 2026**. Make the most of it!

[Open Provider Overview](/)

Best regards,
OlogyCrew Team`,
  },
  {
    type: "trial_7_days",
    category: "Trial",
    subject: "7 Days Left on Your Pro Trial",
    body: `Hello Gary,

You have **7 days** remaining on your Pro trial.

Here's what you've accomplished so far:
- **5 services** listed
- **12 bookings** received
- **8 reviews** earned

Don't lose your progress — upgrade to Pro for just **$12/month** (or save 16% with annual billing at $10.08/month).

[Upgrade Now](/provider/subscription)

Your trial ends on **May 16, 2026**.

Best regards,
OlogyCrew Team`,
  },
  {
    type: "trial_3_days",
    category: "Trial",
    subject: "Only 3 Days Left — Don't Lose Your Pro Features",
    body: `Hello Gary,

Your Pro trial ends in just **3 days** (May 16, 2026).

When your trial expires, you'll lose access to:
- Priority search placement
- Services beyond the free limit (3)
- Extra photo uploads
- Custom profile slug

**Upgrade now to keep everything you've built.**

[Upgrade to Pro — $12/mo](/provider/subscription)

Or save 16% with annual billing at just **$10.08/month**.

Best regards,
OlogyCrew Team`,
  },
  {
    type: "trial_1_day",
    category: "Trial",
    subject: "Last Day — Your Pro Trial Expires Tomorrow",
    body: `Hello Gary,

**Your Pro trial expires tomorrow.**

After expiration, your account will be downgraded to the Starter tier:
- Only 3 services visible (extras will be hidden)
- 1 photo per service
- Standard search placement
- No custom profile slug

Don't let your hard work go to waste. Upgrade now and keep growing your business.

[Upgrade to Pro — $12/mo](/provider/subscription)

Best regards,
OlogyCrew Team`,
  },
  {
    type: "trial_expired",
    category: "Trial",
    subject: "Your Pro Trial Has Ended",
    body: `Hello Gary,

Your 14-day Pro trial has ended, and your account has been moved to the **Starter tier**.

You can still use OlogyCrew with the Starter plan (1 category, 3 services), but you'll have limited features.

Ready to upgrade? You can reactivate Pro anytime:

[Upgrade to Pro — $12/mo](/provider/subscription)

Or save 16% with annual billing at just **$10.08/month**.

We'd love to have you back on Pro!

Best regards,
OlogyCrew Team`,
  },
];

const categories = Array.from(new Set(testEmails.map((e) => e.category)));

export default function EmailPreview() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  const [previewEmail, setPreviewEmail] = useState<EmailTemplate | null>(null);

  const filtered =
    selectedCategory === "all"
      ? testEmails
      : testEmails.filter((e) => e.category === selectedCategory);

  return (
    <div className="min-h-screen bg-page">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center gap-3 mb-4">
            <Mail className="h-6 w-6 text-sky-600" />
            <h1 className="text-2xl font-bold">Email Template Preview</h1>
            <Badge variant="secondary">{testEmails.length} templates</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={selectedCategory === "all" ? "default" : "outline"}
              onClick={() => setSelectedCategory("all")}
            >
              All ({testEmails.length})
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat}
                size="sm"
                variant={selectedCategory === cat ? "default" : "outline"}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat} ({testEmails.filter((e) => e.category === cat).length})
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="container py-6">
        {/* Full preview modal */}
        {previewEmail && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-[700px] w-full max-h-[90vh] overflow-auto">
              <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
                <div>
                  <Badge className="mb-1">{previewEmail.category}</Badge>
                  <h3 className="font-semibold">{previewEmail.subject}</h3>
                  <p className="text-sm text-muted-foreground">
                    Type: {previewEmail.type}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewEmail(null)}
                >
                  Close
                </Button>
              </div>
              <div className="p-4">
                <iframe
                  srcDoc={formatEmailHTML(previewEmail.body)}
                  className="w-full border rounded-lg"
                  style={{ height: "600px" }}
                  title={`Preview: ${previewEmail.subject}`}
                />
              </div>
            </div>
          </div>
        )}

        {/* Email list */}
        <div className="space-y-3">
          {filtered.map((email) => (
            <Card key={email.type} className="overflow-hidden">
              <CardHeader
                className="cursor-pointer py-3 px-4"
                onClick={() =>
                  setExpandedEmail(
                    expandedEmail === email.type ? null : email.type
                  )
                }
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className="text-xs shrink-0"
                    >
                      {email.category}
                    </Badge>
                    <div>
                      <CardTitle className="text-sm font-medium">
                        {email.subject}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {email.type}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewEmail(email);
                      }}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Preview
                    </Button>
                    {expandedEmail === email.type ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </CardHeader>
              {expandedEmail === email.type && (
                <CardContent className="pt-0 px-4 pb-4">
                  <iframe
                    srcDoc={formatEmailHTML(email.body)}
                    className="w-full border rounded-lg"
                    style={{ height: "500px" }}
                    title={`Preview: ${email.subject}`}
                  />
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
