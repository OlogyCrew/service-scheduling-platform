# Pay at Location: a provider guide

**OWNER-REVIEW DRAFT ONLY — 7 November 2026**

Based on **unpublished checkpoint `712c0f91`**. This article is not published in Help Center and does not authorize production deployment, provider activation, or a pilot. The instructions below apply only after separate, explicit access/pilot approval for your provider account and services. Availability is not promised for every provider or customer.

## What Pay at Location means

Pay at Location lets customers book eligible services and arrange payment directly with you. The offline booking flow makes no online Stripe charge; **Mark as Paid** records money already received outside OlogyCrew and does not charge the customer. Your existing Stripe settings are unchanged. The recorded methods are **Cash**, **Bank transfer**, **Mobile money**, and **Other**; agree which you accept in your customer instructions. These method names are recordkeeping options, not built-in transfer services.

## Set up eligible services — only after approval

1. In your provider workspace, open **Business Tools** (the compact mobile navigation says **Tools**; the dashboard shortcut may say **More**).
2. Expand **Pricing & payments** and find **Pay at Location**. If a search is hiding the section, clear it using **Clear Business Tools search**.
3. Turn on **Accept Pay at Location** only for the separately approved use.
4. Add **Customer instructions** describing where, when, and how customers should pay. The field allows up to 2,000 characters. Avoid sensitive account details.
5. Select the approved services under **Eligible services**. Customers can choose **Pay at Location** only where the booking interface offers it; selecting a service does not guarantee the option appears in every booking flow.
6. Select **Save Pay-at-Location settings** and wait for **Pay-at-Location settings saved**. If saving fails, review the error rather than assuming the change took effect.

Seeing a switch or this draft is not permission to enable it. If you have not received explicit approval, or the expected controls are missing, contact OlogyCrew support rather than trying another activation route.

## Read the booking and payment separately

In provider view, open **Bookings**, choose the correct booking's **View Details**, and review the **Pay at Location** card.

**Offline payment status** has three meanings:

| Status | Meaning |
| --- | --- |
| **Due** | The full original amount remains outstanding. |
| **Paid** | The booking provider or an authorized administrator recorded receipt of the full amount. |
| **Waived** | The booking provider or an authorized administrator released the full amount, with a reason. A waiver is not a payment receipt. |

**Original agreed amount** preserves the amount recorded for this offline booking. **Outstanding balance** is what remains due: the original amount while **Due**, and **\$0.00** after **Paid** or **Waived**. It is not a request to pay the original amount again. Review **Amount received**, **Amount waived**, **Payment method**, and **Provider payment instructions** as needed.

The booking lifecycle is separate: **Accept**, **Start Service**, **Mark Complete**, and **Cancel** manage the appointment, not settlement. Completing or cancelling the booking does not by itself record payment or waive the balance. Recording payment or a waiver does not by itself accept or complete the service.

## Record a full payment already received

Only act when the ledger is **Due** and you have actually received the full amount.

1. Select **Mark as Paid** to open **Record full offline payment**.
2. Check the read-only **Full amount received (USD)**. Partial payments are not supported.
3. Choose **Cash**, **Bank transfer**, **Mobile money**, or **Other** in **Payment method (required)**.
4. Optionally add **Payment note (optional)**, up to 1,000 characters. Do not include sensitive account details.
5. Check **“I confirm I actually received the full [displayed amount] from the customer.”**, then select **Confirm full payment**.
6. Wait for **Full payment recorded.** Verify **Paid**, **Outstanding balance** of **\$0.00**, and the receipt details, including **Confirmed by user ID** and **Payment received at**.

## Waive the full amount

Use a waiver only when you intend to release the entire amount, not to record a receipt or issue a refund.

1. Select **Waive Payment** to open **Waive full offline payment**.
2. Check the read-only **Full waiver amount (USD)**. Partial waivers are not supported.
3. Enter **Waiver reason (required)**: 1–2,000 characters after trimming. The reason is saved and is visible in the customer payment record; keep it factual and avoid sensitive information.
4. Check **“I confirm I intend to waive the full [displayed amount] and no payment was received for this waiver.”**, then select **Confirm full waiver**.
5. Wait for **Full payment waived.** Verify **Waived**, **Outstanding balance** of **\$0.00**, **Waiver reason**, **Waived by user ID**, and **Waived at**.

Customers have read-only payment records: they cannot mark payment as paid or waive it. Their confirmation shows **Offline Payment Receipt** for a paid booking or **Payment Waiver** for a waived booking, with the original amount and outstanding balance shown separately.

## Errors, refreshes, and settled bookings

If payment information cannot load, use **Retry payment information** on booking details; the customer confirmation uses **Retry Payment Status**. These retry buttons read the record and do not submit a settlement.

If a save explicitly reports that payment was not saved, retry the same truthful action only while the current ledger remains **Due**. If the response is uncertain, it says settlement was not confirmed, or it tells you to refresh, reload the booking and check the ledger before trying again. If success is confirmed but refreshing fails, reload to view the latest ledger—do not submit another payment or waiver.

**Never collect or charge the same obligation again once it is Paid or Waived.** The payment-action buttons are available only for **Due** records. If the ledger or another payment prompt appears inconsistent, stop and contact support with the booking number. Do not use an online payment prompt to bypass the offline record.

## Stop accepting new offline bookings

After any required authorization to change settings, turn off **Accept Pay at Location** and select **Save Pay-at-Location settings**. This stops new Pay at Location bookings; existing payment history remains visible and existing obligations are not erased or automatically waived.

Bank or mobile-money services may charge their own fees. Any refund or dispute must be handled under the applicable agreement and support process; this guide promises neither automatic/universal refunds nor Stripe liability protection for offline payments.
