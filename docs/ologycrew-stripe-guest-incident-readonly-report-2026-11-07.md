# OlogyCrew Stripe guest incident — read-only evidence package

**Prepared:** 2026-11-07
**Scope:** SHANE CALLAHAN Stripe guest record and the three supplied email aliases
**Mode:** Read-only evidence collection; no Stripe or database changes were made while generating this package.

## Executive summary

Stripe Dashboard shows one live guest record named **SHANE CALLAHAN**, with primary email `coastal.stately_1b@icloud.com` and alternative emails `nimble.lieges_6d@icloud.com` and `canoes_deep4w@icloud.com`. Stripe shows **$1,222.60 net spend across 122 transactions**. The visible recent page showed eight successful $10.10 transactions and two canceled $10.10 attempts. This does not establish that all 122 transactions were successful or that they all originated from OlogyCrew.

The live Stripe guest record showed multiple debit cards issued in Singapore and the Philippines, a Uganda billing location, and the note that it was created to show payments not associated with a normal account. These are risk signals requiring Stripe correlation, not proof of intent.

## Local OlogyCrew identity correlation

The three aliases map to three different local profiles, not one local Shane Callahan profile:

- **JASON GAINEY** (user 515970001, customer, nimble.lieges_6d@icloud.com): 102 customer bookings, 98 payment rows, $460.00 captured payment-row amount, 52 failed payment rows, $0.00 recorded refunds; customer subscription row: none / none.
- **ZACHARY THOMAS** (user 516690051, provider, coastal.stately_1b@icloud.com): 48 customer bookings, 48 payment rows, $262.60 captured payment-row amount, 22 failed payment rows, $0.00 recorded refunds; customer subscription row: none / none.
- **CARLA VALENCIA** (user 540990071, customer, canoes_deep4w@icloud.com): 148 customer bookings, 148 payment rows, $730.00 captured payment-row amount, 75 failed payment rows, $0.00 recorded refunds; customer subscription row: none / none.

The matching provider-side record is provider **7020001**, owned by local user **516690051**, with Stripe account status `disabled`, payoutEnabled `0`, and local active state `0` after containment. It has 0 provider bookings, 0 local payment rows, $0.00 captured payment-row amount, and 0 failed payment rows.

**Important limitation:** none of the three local profiles had a stored Stripe Customer ID linking them to the Stripe guest record. Matching amounts or timestamps alone are not definitive.

## Application-path review

Source review found the normal booking checkout path is behind an authenticated tRPC protected procedure and requires a booking ID. The flow checks that the caller owns the booking, verifies the provider/service, rejects inactive providers, requires an active paid provider subscription for payment collection, and requires Stripe account/payout setup. The current implementation also uses deterministic Stripe idempotency keys for customer creation and booking Checkout creation.

The webhook route is `POST /api/stripe/webhook`; it requires the `stripe-signature` header and verifies the raw request body with the configured webhook secret before processing events. The server applies general/write/sensitive rate-limiters, while the webhook route uses the raw-body handler.

These controls reduce the likelihood that the normal authenticated booking path alone explains an unauthenticated Stripe guest record, but they do not replace a Stripe transaction-level correlation.

## Evidence still required from Stripe

1. Full live-mode Payments export for the incident window, including Payment Intent ID, Charge ID, status, amount, fee, refund/dispute fields, customer/guest identifier, and timestamps.
2. Connect Transfers export showing destination account, transfer, reversal, and payout relationships.
3. Balance Transactions export showing gross, fee, refund, dispute, transfer, and net movements.
4. Stripe confirmation of whether the 122 count is all transaction attempts, all payment objects, or a mixture of statuses.
5. Stripe correlation of device, IP, payment fingerprint, and connected-account relationships.

Do not export full card numbers, CVCs, bank-account numbers, or other unnecessary sensitive fields.

## Current containment

The three local identities are temporarily suspended, and the associated provider profile/service listing are inactive. Audit entries record the action as reversible containment pending Stripe review. Existing bookings, payments, and evidence remain preserved. No refunds, deletions, Stripe account disconnections, payout-setting changes, bank-setting changes, API-key rotations, or webhook-secret changes were performed. Chisolm Audio and Gary Studios remain excluded.

## Reconciliation caution

The arithmetic difference remains unresolved: 122 × $10.10 = $1,232.20, while Stripe displays $1,222.60 net spend, a $9.60 difference. This must be reconciled from the full Stripe exports before treating the displayed figures as equivalent.

## Attached local export

The companion CSV contains local booking/payment rows relevant to the three customer profiles and the matched provider profile. It excludes card numbers, CVCs, bank details, and other payment-method secrets.

## Conclusion

The evidence supports maintaining temporary containment and escalating to Stripe, but it does not yet prove whether OlogyCrew’s payment infrastructure was exploited or whether this is a cluster of fraudulent accounts using legitimate flows. Transaction-level Stripe-to-OlogyCrew correlation is the next decision point.
