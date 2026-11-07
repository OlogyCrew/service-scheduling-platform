# Stripe live Dashboard observation — read-only addendum

**Observed:** 2026-11-07
**Source:** https://dashboard.stripe.com/acct_1CN1r0C7SjggBMst/payments
**Mode:** Live Stripe Dashboard, read-only inspection

## Observation

The live Payments page reported **1–20 of 424 results** for Ologycrew.com.

The visible latest records included repeated `$10.10 USD` payments under the guest email `fines.forever_2j@icloud.com`:

- Four visible succeeded payments at $10.10, including several within minutes of one another.
- Multiple canceled $10.10 and $5.05 attempts in the same visible activity window.
- Stripe displayed the Payment Intent IDs and masked payment-card last four digits in the Dashboard.

The visible activity is additional evidence of repeated payment attempts, but it is not by itself proof that this guest record is SHANE CALLAHAN or that it maps to any of the three suspended OlogyCrew identities.

## Export limitation

Opening Stripe’s Payments export dialog displayed this warning:

> Direct charges aren't in exports yet. Payments created with direct charges won't appear in this file. To view them, use the Dashboard payments list.

Therefore, a normal Payments CSV export would be incomplete for this investigation. No incomplete export was downloaded.

## Consequence for reconciliation

The 294 local Payment Intent IDs should be matched using one of these safer paths:

1. Stripe Support’s internal live-mode correlation of the Payment Intent IDs;
2. Dashboard Payments-list review/search, including direct charges; or
3. A Stripe-supported export/report that explicitly includes direct charges, Connect relationships, and balance transactions.

No payment, payout, bank, credential, refund, or account settings were changed during this inspection.
