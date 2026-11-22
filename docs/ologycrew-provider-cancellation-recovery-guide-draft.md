# OlogyCrew Cancellation and Refunds — Support Guide Draft

**Publication status:** Draft only — not published
**Audience:** Customers, providers, and support administrators
**Applies to:** Future cancellation-operation recovery release; verify labels and workflow against the approved release candidate before publication

## Current behavior during the payment review

Online provider payments and new paid subscription actions may be temporarily unavailable while payment-safety controls remain active. An unpaid booking or invoice is not treated as paid. Pay-at-Location remains separate from Stripe and is not enabled by this draft.

The current cancellation screen and refund behavior should be described using the labels and policy actually present in the released application. Do not tell a customer that this draft’s pending, retry, or notification behavior is already available.

## Future cancellation workflow

When the future cancellation workflow is released, OlogyCrew will first create a cancellation request record before attempting any external refund. This prevents repeated clicks or concurrent requests from creating multiple cancellation operations. The amount and payment state used for the request are taken from the recorded payment snapshot rather than a later edited booking total.

If a Stripe refund is needed, the operation will use one stable idempotency key. A temporary provider timeout will show a pending or retryable state rather than claiming that the refund completed. A retry resumes the same operation; it does not create another refund request.

Bookings with no captured payment, zero refund due, or an offline payment obligation do not create a Stripe refund. The offline payment record remains separate from Stripe.

## What customers should expect

Customers should not confirm their own offline payment. Customers can view payment status and cancellation/refund status, but they cannot change the amount due, mark an offline obligation paid, waive a balance, or force a refund.

If a cancellation is pending, keep the confirmation reference and do not repeatedly submit the same request. Contact support if the status remains pending beyond the time shown in the released interface.

## What providers should expect

Providers should not promise that a refund is complete until the released booking record or payment history shows the completed result. Provider actions must be authorized for the booking and must not bypass the server-side operation claim.

Offline payment confirmations and waivers remain provider/admin actions governed by the separate Pay-at-Location workflow. They do not create Stripe Checkout Sessions, Payment Intents, charges, transfers, or payouts.

## What support administrators should verify

Support should verify the booking, actor authorization, operation status, payment snapshot, and any retryable error before assisting. Do not manually create a second refund to compensate for a pending operation without reviewing the original operation and Stripe record.

Cancellation notifications will be delivered through an operation-scoped durable process in the future release. Until that release is approved, support must not claim that every cancellation retry is notification-idempotent.

## Publication checklist

Before publishing this article, compare it with the exact release candidate and verify the following: customer-facing pending labels, refund timing language, notification wording, provider permissions, offline-payment terminology, support retry permissions, and the absence of any claim that an unapplied migration or unpublished helper is live.
