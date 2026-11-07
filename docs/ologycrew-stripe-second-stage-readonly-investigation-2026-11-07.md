# OlogyCrew second-stage fraud investigation — read-only

**Prepared:** 2026-11-07
**Scope:** Local reconciliation following the SHANE CALLAHAN Stripe guest review
**Restrictions honored:** no deletes, refunds, disconnects, payout/bank changes, credential rotations, or changes to the three suspended identities. Chisolm Audio and Gary Studios were excluded.

## 1. Local Payment Intent inventory

The verified local export contains **298 booking rows** and **294 payment rows**: **145 captured** and **149 failed**. Every local payment row has a distinct local Stripe Payment Intent ID, producing **294 unique Payment Intent IDs**.

The companion input CSV lists these IDs with local booking, customer, provider, amount, status, and timestamp context. It does not prove that all 294 Payment Intents still exist in Stripe or that any belong to the SHANE CALLAHAN guest record. That requires live-mode Stripe exports or Stripe Support correlation.

## 2. Provider 7020001

Provider **7020001** belongs to local user **516690051 / ZACHARY THOMAS**, connected account **acct_1USpaSFz83v8L6TV**. The local export identifies **37 customer bookings associated with this provider**, not 37 provider-owned bookings.

- `cancelled` booking / `failed` payment: 6 booking(s)
- `cancelled` booking / `no_payment` payment: 3 booking(s)
- `confirmed` booking / `captured` payment: 2 booking(s)
- `pending` booking / `captured` payment: 24 booking(s)
- `pending` booking / `failed` payment: 2 booking(s)

Those 37 bookings contain **26 captured payment rows totaling $260.00** and **8 failed payment rows totaling $80.00**. The provider’s local Stripe status is disabled, payoutEnabled is 0, and isActive is 0 after containment. The local export has no transfer/payout fields; those require Stripe Connect Transfers and Balance Transactions.

## 3. Named booking inconsistencies

- `8040001` / OC-1793239436627-KRCG4RPPF / cancelled / payment 5640003 / captured / $10.00 / pi_3UVihWC7SjggBMst1QlDZi1t / refund none
- `8730001` / OC-1793346188672-D54DM1MFQ / cancelled / payment 6600004 / captured / $10.00 / pi_3UWATFC7SjggBMst1uGqQo5A / refund none

Bookings 8040001 and 8730001 are canceled with captured payments and no local refund ID or refund amount. These are unexplained local reconciliation exceptions, not proof that a refund was owed or that Stripe never issued one. Stripe Charge/Refund and Balance Transaction records must be checked.

There are **4 bookings without a local payment row**: `6540001` (in_progress), `6690001` (cancelled), `6690002` (cancelled), `6690003` (cancelled). A missing row does not prove that a payment attempt occurred.

There are **7 failed payment rows attached to non-canceled bookings**. These are failed attempts, not captured funds, but should be checked against Stripe Payment Intent status and webhook delivery history.

## 4. Repeated attempts

No booking in the local export has more than one payment row. A cross-booking scan found **129 same-customer/same-amount clusters within 15 minutes**. This is a lead only; it does not establish shared device, identity, payment fingerprint, or intent.

## 5. Payment creation and production-surface review

Reviewed source contains Checkout session creation in:

- `server/stripeRouter.ts` — booking Checkout behind an authenticated protected procedure, booking ownership/provider/service checks, active paid-provider requirement, deterministic Customer and Checkout idempotency keys.
- `server/promotionRouter.ts` — promotion Checkout.
- `server/invoiceRouter.ts` — invoice payment Checkout.
- `server/customerSubscriptionRouter.ts` — customer subscription Checkout.
- `server/subscriptionRouter.ts` — provider subscription Checkout.

Source search found no direct `paymentIntents.create`, `paymentIntents.confirm`, or `paymentIntents.capture` call site. `POST /api/stripe/webhook` requires `stripe-signature`, verifies the raw request body, and rejects invalid signatures.

An unauthenticated command-line request to the production site returned HTTP 403 for the public root and Stripe webhook/API paths, so an independent unauthenticated comparison of the exact deployed build could not be completed from this environment. The reviewed source and current preview should not be represented as proof of the exact deployed build.

## 6. Stripe reconciliation required

For each of the 294 Payment Intent IDs, Stripe must provide or the user must export:

- Current Payment Intent status
- Charge ID(s) and charge status
- Refund/dispute status
- Stripe fee and balance transaction ID
- Connect transfer, reversal, destination account, and payout relationship
- Guest/customer identifier and any link to SHANE CALLAHAN

The decisive comparison is Payment Intent ID, not amount or timestamp. The reconciliation-input CSV contains no card numbers, CVCs, or bank-account details.

## 7. Current determination

The local evidence supports treating this as a coordinated payment-abuse investigation and maintaining temporary containment. It does **not** yet determine whether the root cause was fraudulent customers using legitimate checkout, an alternative payment endpoint, coordinated provider-account activity, or multiple overlapping issues. The live Stripe export or Stripe Support’s internal correlation remains decisive.
