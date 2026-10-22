import { AI_DISCOVERY_LEGAL_RELEASE } from "@shared/legalPolicyRelease";

export const REVISED_PRIVACY_POLICY_VERSION = AI_DISCOVERY_LEGAL_RELEASE.privacyVersion;
export const LEGACY_PRIVACY_POLICY_VERSION = AI_DISCOVERY_LEGAL_RELEASE.privacyPreviousVersion;
export const PRIVACY_POLICY_EFFECTIVE_AT = AI_DISCOVERY_LEGAL_RELEASE.effectiveAt;

export const REVISED_PRIVACY_POLICY_CONTENT = `## 1. Introduction

OlogyCrew ("we," "our," or "us") operates the OlogyCrew service scheduling platform. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform, including our website, mobile applications, and related services (collectively, the "Service").

## 2. Information We Collect

### Personal Information

When you create an account or use our Service, we may collect the following personal information:

- Name, email address, and phone number.
- Profile photo and business information (for service providers).
- Physical address information, including billing address information used for invoices and receipts, and service or booking location information.
- Payment information (processed securely through Stripe).
- Communication preferences and notification settings.

### Public Discovery and Review-Link Context

When an independent assistant prepares a review link through a documented public interface, we receive the selected service and any supplied request context, such as service needs, location, timing, and a preferred date or time. We use this information to prepare the review link and prefill the customer review form.

### Automatically Collected Information

When you access the Service, we may automatically collect certain information, including your IP address, browser type, device information, and usage data such as pages visited and actions taken.

## 3. How We Use Your Information

We use the information we collect to:

- Provide, operate, and maintain the Service.
- Process bookings, payments, and transactions.
- Send transactional notifications (booking confirmations, reminders, payment receipts).
- Send email notifications related to your bookings and account activity.
- Facilitate communication between customers and service providers.
- Improve and personalize your experience.
- Respond to your inquiries and provide customer support.
- Detect and prevent fraud or abuse.
- **Generative features:** When you use the Help Assistant, process the chat content and limited conversation context needed to generate a response. When a provider requests ad-copy assistance, process the provider’s prompt and the relevant business and service information needed to generate a draft. If you send a message to an OlogyCrew official demo provider, process your displayed name and message text to generate the clearly identified automated demo reply. We also use generative tools for OlogyCrew social-post drafts using platform campaign information. These features use a generative-model service configured through Forge. Please do not submit payment credentials, sensitive medical information, or other information not needed for the requested feature, and review generated content before use.

## 4. Communications

OlogyCrew primarily communicates with users via email for booking confirmations, appointment reminders, payment receipts, and other transactional notifications. By creating an account, you consent to receive these transactional emails.

Notification Settings displays separate controls for booking updates, appointment reminders, message alerts, payment receipts, and Marketing & Promotions email. Marketing & Promotions is off by default. Providers with a qualifying OlogyCrew relationship may send an occasional in-app relationship follow-up only if you enable the separate relationship-message preference. That preference is off by default, may be turned off at any time, and does not enable marketing email, SMS, or push notifications.

You can manage your email notification preferences at any time through your account notification settings. You may also unsubscribe from non-essential emails using the unsubscribe link included in each message.

Turning off optional email does not prevent account verification, password-reset, two-factor authentication, account-deletion confirmation, responses to support requests, or required legal notices. Those necessary messages may still be sent. A message sent to someone without an OlogyCrew account may provide a link to account notification settings rather than an account-specific unsubscribe token.

We will not share your email address or phone number with third parties for their own marketing purposes.

## 5. Information Sharing

We do not sell your personal information. We may share your information in the following circumstances:

- **Service Providers:** With third-party service providers who assist in operating our platform (for example, Stripe for payment processing).
- **Between Users:** Booking details are shared between customers and service providers to facilitate service delivery.
- **Public discovery and review links:** Public provider and service information may be made available through OlogyCrew’s website and documented public discovery interfaces, including to independent AI assistants. This may include business names, public descriptions and photos, city and state, public pricing, ratings and trust information, and available appointment starts. These public interfaces do not provide private customer booking records, payment credentials, or providers’ private customer notes.
- **Legal Requirements:** When required by law, regulation, or legal process.
- **Business Transfers:** In connection with a merger, acquisition, or sale of assets.

When an assistant prepares a review link, OlogyCrew receives the selected service and any supplied request context, such as service needs, location, timing, and a preferred date or time. We use this information to prepare a short-lived encrypted link and prefill the customer review form. The link expires within 30 minutes; anyone who receives it may be able to open it during that period. Keep it private and include only information needed for the service request. Do not include payment credentials or sensitive medical information in free-text fields. The 30-minute expiration is a link-validity period, not a promise that every copy is deleted at that time; copies may remain in browser history, an independent assistant’s systems, or security or operational logs subject to the applicable party’s retention practices.

If you submit a booking or quote request, the submitted information is handled under our ordinary booking, communication, and retention practices. An independent assistant may process information under its own terms and privacy policy. Third parties may retain copies of public information they have accessed; deactivating a listing does not necessarily remove those copies immediately.

Preparing or opening a review link does not create a booking or quote request, reserve a time, place a hold, or initiate a payment; customer review, sign-in where required, and submission are required.

## 6. Data Security

We implement appropriate technical and organizational security measures to protect your personal information. Card payment credentials are collected and processed by Stripe through Stripe Checkout; OlogyCrew does not store full card numbers, CVCs, or expiration dates. OlogyCrew may store limited transaction and subscription metadata, such as amount, status, payment-method label, and Stripe transaction, customer, or subscription identifiers, to operate the Service. However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.

## 7. Data Retention & Anonymization

We retain your personal information for as long as your account is active or as needed to provide the Service. Account deletion deactivates the account and pseudonymizes selected profile fields in OlogyCrew’s active application records. It does not necessarily remove every identifier or all information from active systems, backups, logs, third-party processors, or records that must be maintained for security, legal, tax, accounting, fraud-prevention, or other legitimate purposes. A deleted account may be reactivated through a subsequent sign-in or registration process; previously deleted content does not automatically return unless we state otherwise at that time.

When you delete your account, we handle data in the active application records as follows:

- **Messages, customer booking records, and reviews:** Messages sent or received by a deleting user are deleted from the active application records. For a deleting customer, the application deletes that customer’s booking, booking-session, and associated payment records. Customer-authored review text is removed while a rating may remain to support provider-rating integrity.
- **Provider profiles and services:** Provider profiles and services are deactivated when the deleting user is a provider.
- **Payment information and other limited records:** Stripe and other payment providers may independently retain payment-related records under their own policies and applicable law. We may retain limited information where necessary for security, fraud prevention, legal, tax, or accounting requirements; retention periods depend on the record and applicable requirements.

We may retain limited de-identified, security, audit, compliance, or legally required information where permitted or required, and deletion is not a promise of immediate removal from every backup, log, or third-party system. We may also retain certain aggregated, non-identifiable information for analytics and platform improvement purposes. This data cannot be used to identify you.

## 8. Account Deletion

You have the right to delete your account at any time. To do so, navigate to your **Profile** page and select **"Delete My Account"** at the bottom of the page. The deletion process includes a two-step confirmation to prevent accidental deletions.

### What Happens When You Delete Your Account

When you confirm account deletion, the following actions are taken as part of the account-deletion process:

- **Data handling:** Your account is deactivated and selected profile fields are pseudonymized, and other information is handled as described in Section 7.
- **Provider Profile Deactivation:** If you are a service provider, your provider profile and all listed services are deactivated and will no longer appear in search results or public listings.
- **Subscription Cancellation:** During account deletion, we will attempt to cancel eligible active subscriptions and mark the applicable OlogyCrew subscription record as cancelled. Payment-provider processing, any remaining charges, and cancellation timing are subject to Stripe and the applicable plan terms.
- **Notification Preferences:** We disable the account’s notification preferences. We may send an account-deletion confirmation and communications required by law or reasonably necessary to administer the closure; delivery of email is not guaranteed.
- **Session Termination:** Your login session is ended and you are signed out of the platform.

### Restrictions

Account deletion may be temporarily blocked if you have active bookings (pending, confirmed, or in-progress). You must complete or cancel all active bookings before your account can be deleted. This protects both you and the other party involved in the booking.

### Confirmation

We may send an account-deletion confirmation to the email address associated with your account. If you believe your account was deleted in error, please contact us immediately at the address listed below.

## 9. Your Rights

Depending on your location, you may have the following rights under applicable data protection laws, including the General Data Protection Regulation (GDPR) and the California Consumer Privacy Act (CCPA):

- **Right to Access:** You may request a copy of the personal information we hold about you.
- **Right to Correction:** You may update or correct inaccurate personal information through your Profile page or by contacting us.
- **Right to Deletion:** You may delete your account and personal information at any time through the self-service deletion feature on your Profile page, as described in Section 8 above.
- **Right to Data Portability:** You may request your booking history and account data in a portable format by contacting us.
- **Right to Opt Out:** You may opt out of marketing communications and email notifications via the Unsubscribe link in any email or through your Notification Settings.
- **Right to Non-Discrimination:** We will not discriminate against you for exercising any of your privacy rights.

To exercise any of these rights, you may use the self-service features in your account settings or contact us at the address provided below. We will respond to your request within 30 days.

## 10. Cookies and Tracking

We use essential cookies to maintain your session and authentication state. We may also use analytics tools to understand how users interact with the Service. You can control cookie settings through your browser preferences.

## 11. Children's Privacy

The Service is not intended for individuals under the age of 18. We do not knowingly collect personal information from children. If we become aware that we have collected information from a child, we will take steps to delete it.

## 12. Changes to This Policy

We may update this Privacy Policy from time to time. We will post any revised Privacy Policy with its effective date. For a material change, we will provide the notice identified for that update, such as an in-product notice and/or service email, before or when it takes effect, as applicable. We will not rely on continued use alone where applicable law requires a different form of consent or choice.

## 13. Contact Us

If you have questions or concerns about this Privacy Policy or our data practices, please contact us at:

**OlogyCrew**  
Email: [info@ologycrew.com](mailto:info@ologycrew.com)`;

export const LEGACY_PRIVACY_POLICY_CONTENT = `## 1. Introduction

OlogyCrew ("we," "our," or "us") operates the OlogyCrew service scheduling platform. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform, including our website, mobile applications, and related services (collectively, the "Service").

## 2. Information We Collect

### Personal Information

When you create an account or use our Service, we may collect the following personal information:

- Name, email address, and phone number
- Profile photo and business information (for service providers)
- Physical address and location data (for service delivery)
- Payment information (processed securely through Stripe)
- Communication preferences and notification settings

### Automatically Collected Information

When you access the Service, we may automatically collect certain information, including your IP address, browser type, device information, and usage data such as pages visited and actions taken.

## 3. How We Use Your Information

We use the information we collect to:

- Provide, operate, and maintain the Service
- Process bookings, payments, and transactions
- Send transactional notifications (booking confirmations, reminders, payment receipts)
- Send email notifications related to your bookings and account activity
- Facilitate communication between customers and service providers
- Improve and personalize your experience
- Respond to your inquiries and provide customer support
- Detect and prevent fraud or abuse

## 4. Communications

OlogyCrew primarily communicates with users via email for booking confirmations, appointment reminders, payment receipts, and other transactional notifications. By creating an account, you consent to receive these transactional emails.

You can manage your email notification preferences at any time through your account notification settings. You may also unsubscribe from non-essential emails using the unsubscribe link included in each message.

We will not share your email address or phone number with third parties for marketing purposes. Your contact information is used solely for transactional communications related to the Service.

## 5. Information Sharing

We do not sell your personal information. We may share your information in the following circumstances:

- **Service Providers:** With third-party service providers who assist in operating our platform (e.g., Stripe for payment processing)
- **Between Users:** Booking details are shared between customers and service providers to facilitate service delivery
- **Legal Requirements:** When required by law, regulation, or legal process
- **Business Transfers:** In connection with a merger, acquisition, or sale of assets

## 6. Data Security

We implement appropriate technical and organizational security measures to protect your personal information. Payment data is processed securely through Stripe and is never stored on our servers. However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.

## 7. Data Retention & Anonymization

We retain your personal information for as long as your account is active or as needed to provide the Service. When you delete your account, we handle your data as follows:

- **Personal Information:** Your name, email address, phone number, and profile photo are permanently removed and replaced with anonymized placeholders. This process is irreversible.
- **Booking History:** Records of past bookings are retained in an anonymized form for legitimate business purposes, including financial reporting, dispute resolution, and platform integrity. Your identity is no longer linked to these records.
- **Reviews:** Reviews you have written or received remain on the platform but are attributed to an anonymous user. This preserves the integrity of provider ratings and the review ecosystem.
- **Messages:** Conversation history is retained for dispute resolution purposes but your personal details are anonymized within these records.
- **Payment Records:** Transaction records are retained as required by applicable tax and financial regulations. Stripe may independently retain payment data in accordance with their own privacy policy.

We may also retain certain aggregated, non-identifiable information for analytics and platform improvement purposes. This data cannot be used to identify you.

## 8. Account Deletion

You have the right to delete your account at any time. To do so, navigate to your **Profile** page and select **"Delete My Account"** at the bottom of the page. The deletion process includes a two-step confirmation to prevent accidental deletions.

### What Happens When You Delete Your Account

When you confirm account deletion, the following actions are taken immediately:

- **Data Anonymization:** Your personal information (name, email, phone number, profile photo) is permanently replaced with anonymized placeholders. This cannot be undone.
- **Provider Profile Deactivation:** If you are a service provider, your provider profile and all listed services are deactivated and will no longer appear in search results or public listings.
- **Subscription Cancellation:** Any active subscriptions (provider tiers or customer memberships) are automatically cancelled.
- **Notification Preferences:** All email and push notification preferences are cleared. You will not receive any further communications from OlogyCrew.
- **Session Termination:** Your login session is ended and you are signed out of the platform.

### Restrictions

Account deletion may be temporarily blocked if you have active bookings (pending, confirmed, or in-progress). You must complete or cancel all active bookings before your account can be deleted. This protects both you and the other party involved in the booking.

### Confirmation

Upon successful deletion, you will receive a confirmation email at the email address associated with your account. If you believe your account was deleted in error, please contact us immediately at the address listed below.

## 9. Your Rights

Depending on your location, you may have the following rights under applicable data protection laws, including the General Data Protection Regulation (GDPR) and the California Consumer Privacy Act (CCPA):

- **Right to Access:** You may request a copy of the personal information we hold about you.
- **Right to Correction:** You may update or correct inaccurate personal information through your Profile page or by contacting us.
- **Right to Deletion:** You may delete your account and personal information at any time through the self-service deletion feature on your Profile page, as described in Section 8 above.
- **Right to Data Portability:** You may request your booking history and account data in a portable format by contacting us.
- **Right to Opt Out:** You may opt out of marketing communications and email notifications via the Unsubscribe link in any email or through your Notification Settings.
- **Right to Non-Discrimination:** We will not discriminate against you for exercising any of your privacy rights.

To exercise any of these rights, you may use the self-service features in your account settings or contact us at the address provided below. We will respond to your request within 30 days.

## 10. Cookies and Tracking

We use essential cookies to maintain your session and authentication state. We may also use analytics tools to understand how users interact with the Service. You can control cookie settings through your browser preferences.

## 11. Children's Privacy

The Service is not intended for individuals under the age of 18. We do not knowingly collect personal information from children. If we become aware that we have collected information from a child, we will take steps to delete it.

## 12. Changes to This Policy

We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the updated policy on this page with a revised "Last updated" date. Your continued use of the Service after changes constitutes acceptance of the updated policy.

## 13. Contact Us

If you have questions or concerns about this Privacy Policy or our data practices, please contact us at:

**OlogyCrew**  
Email: info@ologycrew.com`;

type PrivacyPolicyVersion = {
  version: string;
  revisionDate: string;
  content: string;
};

export type PrivacyPolicyPresentation = PrivacyPolicyVersion & {
  state: "upcoming" | "current" | "prior";
};

const revisedPrivacyPolicy: PrivacyPolicyVersion = {
  version: REVISED_PRIVACY_POLICY_VERSION,
  revisionDate: AI_DISCOVERY_LEGAL_RELEASE.revisedOn,
  content: REVISED_PRIVACY_POLICY_CONTENT,
};

const legacyPrivacyPolicy: PrivacyPolicyVersion = {
  version: LEGACY_PRIVACY_POLICY_VERSION,
  revisionDate: "June 18, 2026",
  content: LEGACY_PRIVACY_POLICY_CONTENT,
};

export function getPrivacyPolicyPresentation(
  requestedVersion: string | null | undefined,
  now = new Date(),
): PrivacyPolicyPresentation | undefined {
  const revisedIsEffective = now.getTime() >= new Date(PRIVACY_POLICY_EFFECTIVE_AT).getTime();
  const version = requestedVersion || REVISED_PRIVACY_POLICY_VERSION;

  if (version === REVISED_PRIVACY_POLICY_VERSION) {
    return { ...revisedPrivacyPolicy, state: revisedIsEffective ? "current" : "upcoming" };
  }

  if (version === LEGACY_PRIVACY_POLICY_VERSION) {
    return { ...legacyPrivacyPolicy, state: revisedIsEffective ? "prior" : "current" };
  }

  return undefined;
}
