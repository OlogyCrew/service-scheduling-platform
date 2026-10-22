import { EmailProvider } from "./notifications/providers/email";

const LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663275372790/QD7eHrqop9F5cN2Q4sYGpD/logo-navbar_38427c60.png";
const SITE_URL = "https://www.ologycrew.com";

/**
 * Sends a confirmation email when a user deletes their account.
 * This essential security email bypasses cleared notification preferences.
 */
export async function sendAccountDeletionEmail(
  email: string,
  userName: string
): Promise<boolean> {
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1e3a5f 0%, #0ea5e9 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <img src="${LOGO_URL}" alt="OlogyCrew" style="max-width: 60px; height: auto; margin-bottom: 4px; border-radius: 12px;" />
    <div style="color: #ffffff; font-size: 22px; font-weight: 700; margin-top: 8px; letter-spacing: 0.5px;">OlogyCrew</div>
  </div>
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
    <h2 style="color: #1e3a5f; margin-top: 0;">Account Deleted</h2>
    <p>Hi ${userName},</p>
    <p>We're writing to confirm that your OlogyCrew account has been successfully deleted as requested.</p>
    <p><strong>What this means:</strong></p>
    <ul style="color: #555; padding-left: 20px;">
      <li>Your personal information has been anonymized</li>
      <li>Your profile is no longer visible to other users</li>
      <li>Any active subscriptions have been cancelled</li>
      <li>Your booking history has been preserved for record-keeping, but your name and contact details have been removed</li>
    </ul>
    <p>If you did not request this deletion, or if you believe this was done in error, please contact us immediately at <a href="mailto:support@ologycrew.com" style="color: #2563eb;">support@ologycrew.com</a>.</p>
    <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">We're sorry to see you go. If you ever want to come back, you're always welcome to create a new account.</p>
  </div>
  <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; background: #f9fafb;">
    <p>&copy; ${new Date().getFullYear()} OlogyCrew. All rights reserved.</p>
    <p><a href="${SITE_URL}" style="color: #6b7280; text-decoration: underline;">Visit OlogyCrew</a></p>
  </div>
  </body>
</html>`.trim();

  try {
    const sent = await EmailProvider.sendRaw(
      email,
      "Your OlogyCrew Account Has Been Deleted",
      htmlBody,
      `Hi ${userName}, your OlogyCrew account has been deleted. Your personal information has been anonymized and your profile is no longer visible. If this was done in error, contact support@ologycrew.com.`,
      "noreply",
      { purpose: "security" },
    );

    if (sent) {
      console.log(`[AccountDeletion] Confirmation email sent to ${email}`);
      return true;
    }
    console.error("[AccountDeletion] Email provider rejected or could not deliver the request");
    return false;
  } catch (e: any) {
    console.error(`[AccountDeletion] Failed to send email: ${e.message}`);
    return false;
  }
}
