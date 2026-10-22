import { Notification, NotificationProvider } from "../types";
import { getTemplate } from "../templates";
import { ENV } from "../../_core/env";
import * as db from "../../db";
import { OLOGYCREW_PUBLIC_ORIGIN } from "../../../shared/publicUrls";
import { getEmailRule, maySendOptionalEmail, type RawEmailOptions } from "../emailPolicy";

// Site logo used in the navbar — same branding in emails
const SITE_LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663275372790/QD7eHrqop9F5cN2Q4sYGpD/logo-navbar_38427c60.png";

/**
 * Keep links in all outbound email on the primary public OlogyCrew domain.
 */
function getSiteUrl(): string {
  return OLOGYCREW_PUBLIC_ORIGIN;
}

// Email sender addresses by context
const EMAIL_SENDERS = {
  noreply: { email: "noreply@ologycrew.com", name: "OlogyCrew" },
  info: { email: "info@ologycrew.com", name: "OlogyCrew" },
  support: { email: "support@ologycrew.com", name: "OlogyCrew Support" },
};

/**
 * Determine the appropriate sender address based on notification type.
 * - noreply: automated transactional emails (confirmations, reminders, password resets)
 * - info: general communications (welcome emails, announcements, referrals)
 * - support: support-related (payment failures, account issues, disputes)
 */
function getSenderForType(type?: string): { email: string; name: string } {
  if (!type) return EMAIL_SENDERS.noreply;

  // Support-related emails
  const supportTypes = ['payment_failed', 'refund_processed', 'subscription_cancelled', 'subscription_payment_failed', 'contact_received', 'contact_reply'];
  if (supportTypes.includes(type)) return EMAIL_SENDERS.support;

  // General/informational emails
  const infoTypes = [
    'welcome_customer', 'welcome_provider', 'referral_signup',
    'referral_completed', 'referral_welcome', 'trial_started',
    'waitlist_spot_available', 'subscription_upgraded', 'subscription_updated',
    'subscription_payment_restored', 'subscription_renewed',
  ];
  if (infoTypes.includes(type)) return EMAIL_SENDERS.info;

  // Everything else is automated/transactional → noreply
  return EMAIL_SENDERS.noreply;
}

export class EmailProvider implements NotificationProvider {
  name = "email";

  supports(channel: string): boolean {
    return channel === "email";
  }

  async send(notification: Notification): Promise<boolean> {
    if (!notification.recipient.email) {
      console.warn("[EmailProvider] No email address provided for recipient");
      return false;
    }

    if (!ENV.sendgridApiKey) {
      console.warn("[EmailProvider] SendGrid API key not configured, skipping email");
      return false;
    }

    const rule = getEmailRule(notification.type);
    if (!rule) return false; // Unknown/new types do not inherit permission.
    const userId = notification.recipient.userId;
    // Existing provider-created invoices can address a non-account customer.
    // This narrow transactional exception never permits reminders/promotions.
    const externalInvoice = notification.type === "invoice_sent" && userId === 0;
    let unsubscribeToken = "";
    if (!rule.essential && !externalInvoice) {
      if (!Number.isInteger(userId) || userId <= 0) return false;
      try {
        const prefs = await db.getEmailNotificationPreferences(userId);
        if (!maySendOptionalEmail(notification.type, prefs)) return false;
        unsubscribeToken = prefs?.unsubscribeToken || await db.ensureNotificationUnsubscribeToken(userId);
        if (!unsubscribeToken) return false;
        // Token creation may race a preference change: do not reset or ignore it.
        if (!prefs?.unsubscribeToken && !maySendOptionalEmail(notification.type, await db.getEmailNotificationPreferences(userId))) return false;
      } catch {
        console.warn("[EmailProvider] Optional email suppressed: preferences or unsubscribe unavailable");
        return false;
      }
    } else if (Number.isInteger(userId) && userId > 0) {
      try { unsubscribeToken = await db.ensureNotificationUnsubscribeToken(userId); }
      catch { /* Necessary requested-support email retains a settings link. */ }
    }

    const unsubscribeUrl = EmailProvider.unsubscribeUrl(unsubscribeToken);
    const template = getTemplate(notification.type, { ...notification.data, unsubscribeUrl });

    try {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${ENV.sendgridApiKey}`,
        },
        body: JSON.stringify({
          personalizations: [{
            to: [{ email: notification.recipient.email }],
          }],
          from: getSenderForType(notification.type),
          subject: template.subject,
          ...(!rule.essential ? { headers: { "List-Unsubscribe": `<${unsubscribeUrl}>` } } : {}),
          content: [
            {
              type: "text/plain",
              value: EmailProvider.withPreferenceText(template.body, unsubscribeUrl),
            },
            {
              type: "text/html",
              value: this.formatEmailHTML(template.body, {
                ...notification.data,
                unsubscribeToken,
              }),
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[EmailProvider] SendGrid error:", response.status, errorText);
        return false;
      }

      console.log(`[EmailProvider] Email sent to ${notification.recipient.email} via SendGrid`);
      return true;
    } catch (error) {
      console.error("[EmailProvider] Error sending email:", error);
      return false;
    }
  }

  /**
   * Explicit necessary account/security, legal, or requested-support notice.
   * Unclassified callers fail closed. This is not a campaign delivery bypass.
   * @param senderType - which sender address to use: 'noreply' | 'info' | 'support'
   */
  static async sendRaw(to: string, subject: string, htmlBody: string, textBody: string, senderType: 'noreply' | 'info' | 'support' = 'noreply', options?: RawEmailOptions): Promise<boolean> {
    if (!options || !["security", "legal", "support"].includes(options.purpose) || !to) return false;
    if (!ENV.sendgridApiKey) {
      console.warn("[EmailProvider] SendGrid API key not configured");
      return false;
    }

    let token = "";
    if (Number.isInteger(options.userId) && options.userId! > 0) {
      try { token = await db.ensureNotificationUnsubscribeToken(options.userId!); }
      catch { /* Necessary notices must not depend on optional preferences. */ }
    }
    const unsubscribeUrl = EmailProvider.unsubscribeUrl(token);
    const footer = `<div style="padding:16px;text-align:center;font-size:12px;color:#53665d"><a href="${unsubscribeUrl}">Unsubscribe from optional emails</a> · <a href="${getSiteUrl()}/notification-settings">Manage preferences</a><p>Security, account-access, requested support and required legal notices may still be sent.</p></div>`;
    const htmlWithFooter = /<\/body>/i.test(htmlBody) ? htmlBody.replace(/<\/body>/i, `${footer}</body>`) : `${htmlBody}${footer}`;
    try {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${ENV.sendgridApiKey}`,
        },
        body: JSON.stringify({
          personalizations: [{
            to: [{ email: to }],
          }],
          from: EMAIL_SENDERS[senderType],
          subject,
          content: [
            { type: "text/plain", value: EmailProvider.withPreferenceText(textBody, unsubscribeUrl) },
            { type: "text/html", value: htmlWithFooter },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[EmailProvider.sendRaw] SendGrid error:", response.status, errorText);
        return false;
      }

      return true;
    } catch (error) {
      console.error("[EmailProvider.sendRaw] Error:", error);
      return false;
    }
  }

  private static unsubscribeUrl(token: string): string {
    return token ? `${getSiteUrl()}/unsubscribe/${encodeURIComponent(token)}` : `${getSiteUrl()}/notification-settings`;
  }

  private static withPreferenceText(body: string, url: string): string {
    return `${body}\n\nUnsubscribe from optional emails: ${url}\nManage preferences: ${getSiteUrl()}/notification-settings\nSecurity, account-access, requested support and required legal notices may still be sent.`;
  }

  private formatEmailHTML(body: string, data: any): string {
    const siteUrl = getSiteUrl();

    // Convert markdown-style formatting to HTML, making relative URLs absolute
    let html = body
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\[(.*?)\]\((.*?)\)/g, (_: string, text: string, href: string) => {
        const fullHref = href.startsWith('/') ? `${siteUrl}${href}` : href;
        return `<a href="${fullHref}" style="color: #2563eb; text-decoration: none;">${text}</a>`;
      })
      .replace(/\n- /g, '<br>\u2022 ')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');

    // Build absolute unsubscribe URL
    // For non-system customers (no token), link to notification-settings page
    const unsubscribeUrl = EmailProvider.unsubscribeUrl(data.unsubscribeToken || "");

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1e3a5f 0%, #0ea5e9 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <img src="${SITE_LOGO_URL}" alt="OlogyCrew" style="max-width: 60px; height: auto; margin-bottom: 4px; border-radius: 12px;" />
    <div style="color: #ffffff; font-size: 22px; font-weight: 700; margin-top: 8px; letter-spacing: 0.5px;">OlogyCrew</div>
  </div>
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p>${html}</p>
  </div>
  <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
    <p>&copy; ${new Date().getFullYear()} OlogyCrew. All rights reserved.</p>
    <p>
      <a href="${unsubscribeUrl}" style="color: #6b7280; text-decoration: underline;">Unsubscribe from emails</a>
      &nbsp;&middot;&nbsp;
      <a href="${siteUrl}/notification-settings" style="color: #6b7280; text-decoration: underline;">Manage preferences</a>
    </p>
    <p>Security, account-access, requested support and required legal notices may still be sent.</p>
  </div>
</body>
</html>
    `.trim();
  }
}
