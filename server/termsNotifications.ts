import type { TermsVersion } from "../drizzle/schema";
import { createNotification } from "./db/notifications";
import {
  getTermsDeliveryRecipients,
  getTermsDeliverySummary,
  markTermsEmailDelivery,
  markTermsInAppNotified,
} from "./db/terms";
import { EmailProvider } from "./notifications/providers/email";

const SITE_URL = "https://www.ologycrew.com";
const SITE_LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663275372790/QD7eHrqop9F5cN2Q4sYGpD/logo-navbar_38427c60.png";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(value);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

export function buildTermsUpdateEmail(version: TermsVersion, recipient: { firstName?: string | null; name?: string | null; email: string }) {
  const firstName = recipient.firstName?.trim() || recipient.name?.trim().split(/\s+/)[0] || "there";
  const effectiveDate = formatDate(version.effectiveAt);
  const termsUrl = `${SITE_URL}/terms?version=${encodeURIComponent(version.version)}`;
  const arbitrationNotice = version.materialArbitrationChanges && version.arbitrationSection && version.optOutDeadline
    ? `\n\nThe revised Terms also include material updates to the dispute-resolution provisions, including the Arbitration Agreement. If you want to continue using OlogyCrew without accepting those material changes, you may follow the opt-out instructions in Section ${version.arbitrationSection} by ${formatDate(version.optOutDeadline)}.`
    : "";
  const acceptanceText = version.acceptanceMode === "explicit"
    ? "Please review the updated Terms and use the acknowledgment shown in your OlogyCrew account."
    : `By continuing to access, use, or subscribe to OlogyCrew on or after ${effectiveDate}, you acknowledge and accept the updated Terms of Use.`;

  const subject = "Important updates to the OlogyCrew Terms of Use";
  const text = `Hello ${firstName},

We are updating the OlogyCrew Terms of Use to make our terms clearer and to reflect updates to the platform, our services, and how we work with customers and service providers.

${version.summary}

Review the updated Terms of Use: ${termsUrl}

The updated Terms will take effect on ${effectiveDate} for existing OlogyCrew users. ${acceptanceText}${arbitrationNotice}

We encourage you to read the updated Terms carefully. If you have questions, contact us at ${version.contactEmail}.

Thank you for being part of OlogyCrew.

The OlogyCrew Team

This message was sent to ${recipient.email} because you have an OlogyCrew account.
Terms of Use: ${termsUrl}
Privacy Policy: ${SITE_URL}/privacy
Contact Us: ${SITE_URL}/help

OlogyCrew LLC
${version.companyAddress}`;

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f7fb;color:#172033;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;line-height:1.6">
  <div style="max-width:640px;margin:0 auto;padding:28px 16px">
    <div style="background:linear-gradient(135deg,#173f62,#0f6e9c);padding:28px;text-align:center;border-radius:18px 18px 0 0">
      <img src="${SITE_LOGO_URL}" alt="OlogyCrew" width="56" height="56" style="border-radius:12px;display:inline-block">
      <div style="color:#fff;font-size:22px;font-weight:700;margin-top:8px">OlogyCrew</div>
    </div>
    <div style="background:#fff;border:1px solid #dbe5ef;border-top:0;padding:32px;border-radius:0 0 18px 18px">
      <p>Hello ${escapeHtml(firstName)},</p>
      <p>We are updating the <strong>OlogyCrew Terms of Use</strong> to make our terms clearer and to reflect updates to the platform, our services, and how we work with customers and service providers.</p>
      <div style="background:#f1f7fb;border-left:4px solid #1775a5;padding:14px 16px;margin:22px 0">${escapeHtml(version.summary)}</div>
      <p><a href="${termsUrl}" style="display:inline-block;background:#176f9e;color:#fff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px">Review the updated Terms of Use</a></p>
      <p>The updated Terms will take effect on <strong>${effectiveDate}</strong> for existing OlogyCrew users. ${escapeHtml(acceptanceText)}</p>
      ${version.materialArbitrationChanges && version.arbitrationSection && version.optOutDeadline ? `<p><strong>Dispute-resolution update:</strong> The revised Terms include material updates to the Arbitration Agreement. You may follow the opt-out instructions in Section ${escapeHtml(version.arbitrationSection)} by ${formatDate(version.optOutDeadline)}.</p>` : ""}
      <p>We encourage you to read the updated Terms carefully. If you have questions, contact us at <a href="mailto:${escapeHtml(version.contactEmail)}" style="color:#176f9e">${escapeHtml(version.contactEmail)}</a>.</p>
      <p>Thank you for being part of OlogyCrew.<br><strong>The OlogyCrew Team</strong></p>
    </div>
    <div style="padding:20px 12px;text-align:center;color:#607086;font-size:12px">
      <p>This message was sent to ${escapeHtml(recipient.email)} because you have an OlogyCrew account.</p>
      <p><a href="${termsUrl}" style="color:#52677e">Terms of Use</a> &middot; <a href="${SITE_URL}/privacy" style="color:#52677e">Privacy Policy</a> &middot; <a href="${SITE_URL}/help" style="color:#52677e">Contact Us</a></p>
      <p>OlogyCrew LLC<br>${escapeHtml(version.companyAddress)}</p>
    </div>
  </div>
</body></html>`;

  return { subject, text, html, termsUrl };
}

export async function deliverTermsUpdate(version: TermsVersion, retryFailedOnly = false) {
  const recipients = await getTermsDeliveryRecipients(version.id, retryFailedOnly);
  const effectiveDate = formatDate(version.effectiveAt);
  const actionUrl = `/terms?version=${encodeURIComponent(version.version)}`;

  for (let offset = 0; offset < recipients.length; offset += 10) {
    const batch = recipients.slice(offset, offset + 10);
    await Promise.all(batch.map(async ({ notice, user }) => {
      if (!notice.inAppNotifiedAt) {
        try {
          await createNotification({
            userId: user.id,
            notificationType: "terms_updated",
            title: "OlogyCrew Terms of Use updated",
            message: `Review the updated Terms of Use before they take effect on ${effectiveDate}.`,
            actionUrl,
          });
          await markTermsInAppNotified(notice.id);
        } catch (error) {
          console.error(`[Terms] Failed to create in-app notice for user ${user.id}:`, error);
        }
      }

      if (notice.emailStatus === "sent") return;
      if (!user.email || !user.emailVerified) {
        await markTermsEmailDelivery(notice.id, { status: "skipped", reason: "No verified email address" });
        return;
      }

      const email = buildTermsUpdateEmail(version, { firstName: user.firstName, name: user.name, email: user.email });
      const sent = await EmailProvider.sendRaw(
        user.email,
        email.subject,
        email.html,
        email.text,
        "info",
        { purpose: "legal", userId: user.id },
      );
      await markTermsEmailDelivery(notice.id, sent
        ? { status: "sent" }
        : { status: "failed", reason: "Email provider rejected or could not deliver the request" });
    }));
  }

  return getTermsDeliverySummary(version.id);
}
