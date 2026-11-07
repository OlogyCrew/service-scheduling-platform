# OlogyCrew third-stage consolidated fraud investigation

**Prepared:** 2026-11-07
**Priority:** Critical
**Mode:** Read-only

## Executive conclusion

The exact email `fines.forever_2j@icloud.com` is present in the live OlogyCrew database as a local customer account:

- **Local name:** Albert Hale
- **Local user ID:** `591870045`
- **Role:** customer
- **Account created:** November 4, 2026
- **Local Stripe Customer ID:** none stored
- **Local provider profile:** none
- **Local customer/provider subscription row:** none
- **Exact-email audit matches:** none

Albert Hale has **76 bookings across two providers**, **73 local payment rows**, **26 captured payments totaling $262.60**, and **47 failed payment attempts totaling $459.55**. The local account has **26 paid invoices totaling $262.60**, each with a Stripe Payment Intent reference.

The live Stripe Dashboard contains a separate guest record:

- **Stripe guest ID:** `gcus_1UXwO2C7SjggBMstcorDtNYj`
- **Displayed name:** SHANE CALLAHAN
- **Email:** `fines.forever_2j@icloud.com`
- **Net spend:** $262.60
- **Displayed payment results:** 72
- **Billing country shown:** Uganda
- **Guest created:** November 4, 2026

The exact **$262.60** match between Albert Hale’s captured local payments/paid invoices and the Stripe guest’s net spend is significant and warrants Stripe correlation. It is not, by itself, proof that every local payment belongs to that guest or proof of fraudulent intent.

No automatic suspension was applied to Albert Hale, as instructed.

## 1. New guest and local account investigation

The exact email search found one local user record and no second local identity using the same exact email. No local alias field exists that would establish alternate emails for Albert Hale. The local database contains no stored Stripe Customer ID for this account.

Albert Hale’s bookings are distributed across:

- **Provider 7500001 — CRYSTAL:** 1 booking, pending; connected account `acct_1UXsv9C15RjXzXuU`, local Stripe status active, payoutEnabled false, local provider active.
- **Provider 7560001 — SHERRY BROOKS:** 75 bookings: 46 canceled, 17 confirmed, 9 in progress, and 3 pending; connected account `acct_1UXwCkCFyylIXDZY`, local Stripe status restricted, payoutEnabled false, local provider active.

The local payment totals are:

- Captured: 26 rows, $262.60
- Failed: 47 rows, $459.55
- Refunded/canceled payment rows: none in the aggregate result
- Paid invoices: 26, $262.60 total, all carrying a Stripe Payment Intent reference

No customer subscription or provider subscription row was found for the exact email. No audit-log entry matched the email or the local user ID.

## 2. Comparison of the two Stripe guest records

### Earlier guest record

- **Guest ID:** `gcus_1USVVuC7SjggBMstLwfJAX5s`
- **Displayed name:** SHANE CALLAHAN
- **Primary email:** `coastal.stately_1b@icloud.com`
- **Previously supplied alternate emails:** `nimble.lieges_6d@icloud.com` and `canoes_deep4w@icloud.com`
- **Displayed net spend:** $1,222.60
- **Displayed transaction count:** 122
- **Billing country previously observed:** Uganda

### New guest record

- **Guest ID:** `gcus_1UXwO2C7SjggBMstcorDtNYj`
- **Displayed name:** SHANE CALLAHAN
- **Email:** `fines.forever_2j@icloud.com`
- **Displayed net spend:** $262.60
- **Displayed payment results:** 72
- **Billing country:** Uganda

The two records have different Stripe guest IDs and different email identities. The common displayed name and billing country are risk signals for Stripe to investigate, not proof of common ownership.

The new guest’s visible Dashboard details showed multiple payment methods and fingerprints, including:

- Mastercard ending 0905, Philippines origin, fingerprint `UrcObBEA5ICzwRpd`
- Visa ending 9675, Singapore origin, fingerprint `FFf6n57yetppLPqB`
- Mastercard prepaid ending 3278, United Arab Emirates origin, fingerprint `SjYUSd93D1WgSVg8`
- Mastercard ending 7069, South Africa origin, fingerprint `5Me2wb4SI8O3OXzX`, CVC unavailable
- Visa ending 3844, Singapore origin, fingerprint `T6ZWyknhq7yKQUMG`, CVC unavailable

These fingerprints are included only as Stripe-support correlation identifiers. They do not prove that the cards belong to one person or that the earlier guest shares any of them. A complete comparison requires Stripe to compare both guest records’ fingerprints, IP addresses, device identifiers, and Payment Intent/Charge relationships internally.

## 3. Relationship to the 294 prior local Payment Intents

The earlier 294-Payment-Intent reconciliation file was generated from the three previously suspended identities: Jason Gainey, Zachary Thomas, and Carla Valencia. An exact-email check found **zero rows** for `fines.forever_2j@icloud.com` in that 294-ID file.

Therefore:

- There is no exact local-email evidence that the new Albert Hale activity is included in the prior 294 rows.
- The new account’s 73 local payment rows must be reconciled as a separate local activity set.
- The exact $262.60 match is a useful correlation lead, but Payment Intent IDs remain decisive.

The 294-ID reconciliation still requires Stripe Support or a direct Dashboard-list comparison because Stripe’s export dialog warns that direct charges are excluded from the normal export file.

## 4. Repeated booking activity

The previously reported 129 same-customer/same-amount clusters were calculated from the earlier local correlation export and do not include Albert Hale because the new email was not present in that file.

Albert Hale’s separate local activity shows 76 bookings over approximately November 4–6, with 46 canceled bookings, no completed bookings, 17 confirmed bookings, and 9 in-progress bookings. The bookings involve two providers, including restricted connected account `acct_1UXwCkCFyylIXDZY`.

The local records do not contain IP addresses, device identifiers, card fingerprints, or automation telemetry. The database alone cannot determine whether booking creation was automated. Stripe and hosting logs must be used for that question.

## 5. Payment-flow review

The reviewed source contains Checkout creation in:

- `server/stripeRouter.ts` — booking Checkout behind authenticated protected procedures, booking ownership checks, provider/service checks, active paid-provider requirement, and deterministic idempotency keys.
- `server/promotionRouter.ts` — promotion Checkout.
- `server/invoiceRouter.ts` — invoice payment Checkout.
- `server/customerSubscriptionRouter.ts` — customer subscription Checkout.
- `server/subscriptionRouter.ts` — provider subscription Checkout.

The source search found no direct `paymentIntents.create`, `paymentIntents.confirm`, or `paymentIntents.capture` call site. The webhook route requires `stripe-signature` and verifies the raw request body before processing events.

An independent unauthenticated HTTP comparison of the exact deployed build was not possible because the production site returned HTTP 403 to command-line requests. The reviewed source and current preview should not be treated as proof of the exact production deployment.

## 6. Financial exposure currently supported by local evidence

For the new local Albert Hale account, the locally recorded captured exposure is **$262.60**, with an additional **$459.55 in failed payment attempts**. The failed amount is not captured revenue and should not be treated as a loss without Stripe confirmation.

For the earlier three-identity investigation, the local evidence remains 294 payment rows: 145 captured and 149 failed. Those amounts must remain separate until exact Payment Intent matching is completed.

No local transfer, reversal, payout, refund, or dispute fields prove movement of funds to either connected account. Those relationships require Stripe Connect Transfers, Balance Transactions, and payout records.

## 7. Required Stripe Support correlation request

Ask Stripe to correlate both guest IDs and all local Payment Intent IDs, including the new Albert Hale payment set, using exact identifiers:

1. Map the 294 prior Payment Intent IDs and Albert Hale’s 73 local Payment Intent IDs to live Payment Intent status.
2. Return Charge IDs, refunds, disputes, fees, and Balance Transaction IDs.
3. Identify direct charges versus destination charges.
4. Identify Connect transfers, reversals, destination accounts, and payouts.
5. Compare both guest records’ card fingerprints, IPs, device signals, and other technical identifiers.
6. Confirm whether any Payment Intent belongs to either guest record.
7. Confirm whether the 72-result new guest record and Albert Hale’s 73 local payment rows differ because of canceled/failed object handling, missing webhook events, or another reconciliation issue.

Do not send full card numbers, CVCs, bank-account numbers, or other unnecessary sensitive data.

## Current decision

Maintain the existing three-identity containment and preserve all evidence. Do not suspend Albert Hale automatically. Do not delete, refund, disconnect, rotate credentials, change banking/payout settings, or modify payment architecture while Stripe performs the exact-ID reconciliation.
