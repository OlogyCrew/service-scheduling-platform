# OlogyCrew Payment Security Route Audit and Implementation Specification

**Date:** November 7, 2026  
**Status:** Unpublished planning document  
**Scope:** Read-only source audit; no Stripe settings, production data, credentials, or payment code changed.

## Decision

OlogyCrew should strengthen the existing Stripe integration rather than replace it during the open Stripe fraud investigation. Work is divided into two tracks:

- **Incident track:** preserve evidence, maintain the already-approved reversible containment, reconcile suspicious activity, and continue the existing Stripe case.
- **Hardening track:** improve all payment routes in a separate unpublished development checkpoint, with tests and explicit production approval before deployment.

A Connect charge-type migration is deferred until Stripe confirms negative-balance liability, merchant-of-record implications, fee behavior, transfer behavior, and payout consequences.

## Current payment-producing routes

### 1. Booking Checkout — `server/stripeRouter.ts`

**Current protections found:** authenticated procedure; booking ownership check; server-side service/provider lookup; captured-payment duplicate guard; inactive/deleted-provider guard; active paid-provider subscription and payment-collection entitlement check; connected-account and payout readiness check; server-calculated amount; reusable Stripe Customer; required billing address; booking/provider/customer metadata; deterministic idempotency keys for Customer creation and Checkout Session creation.

**Remaining hardening items:**

- Add atomic application-side payment-attempt reservation so concurrent requests cannot all pass the local checks before Stripe is called.
- Add explicit payment-attempt velocity and cooldown checks.
- Make referral-credit reservation/release atomic around Checkout creation and webhook confirmation. Credits are currently spent before Stripe Checkout creation completes.
- Separate payment state from booking state so a successful payment cannot silently imply every booking or fulfillment transition is complete.
- Add explicit ledger fields and reconciliation for Charge, Transfer, Application Fee, Refund, Dispute, and Balance Transaction identifiers where available.
- Add a first-class `pay_at_location` path that creates no Stripe Checkout Session or Payment Intent.

### 2. Provider Promotion Checkout — `server/promotionRouter.ts`

**Current protections found:** authenticated procedure; provider ownership lookup; server-side tier selection from a fixed pricing map; pending promotion record; Stripe metadata linking the session to the provider and promotion.

**Gaps requiring review:**

- No visible deterministic idempotency key on the Stripe Checkout creation in the audited block.
- The promotion record is created before Checkout creation; failure handling should leave the record retryable without creating duplicate promotions or orphaned payment obligations.
- Apply the shared provider security checks, including account security status, active provider state, paid-plan eligibility where required, and promotion/service ownership validation.
- Add payment-attempt velocity limits and a promotion-specific ledger link.

### 3. Invoice Checkout — `server/invoiceRouter.ts`

**Current protections found:** authenticated procedure; invoice lookup; customer ownership check; paid/cancelled status guard; server-derived line items and total; invoice metadata; stored Checkout Session ID.

**Gaps requiring review:**

- Add a deterministic idempotency key and an atomic “payment session already created” transition.
- Confirm provider eligibility and invoice ownership relationships before creating the session.
- Reconcile invoice session, Payment Intent, Charge, Refund, and Dispute IDs.
- Ensure a canceled or expired session can be retried safely without multiple active payment obligations.

### 4. Customer Subscription Checkout — `server/customerSubscriptionRouter.ts`

**Current protections found:** authenticated procedure; server-side tier/interval pricing; reusable subscription customer when available; trial-use check; subscription metadata; billing portal route.

**Gaps requiring review:**

- Customer creation and Checkout creation need deterministic idempotency protection comparable to booking Checkout.
- Trial eligibility and active-subscription transitions should be atomic under concurrent requests.
- Shared payment-attempt limits should apply, but subscription billing must remain distinct from marketplace booking payments.
- Subscription webhook state transitions need the same event deduplication and out-of-order protections as booking payments.

### 5. Provider Subscription Checkout — `server/subscriptionRouter.ts`

**Current protections found:** authenticated provider lookup; server-side provider pricing; provider metadata; trial configuration; billing portal route; existing subscription/upgrade logic.

**Gaps requiring review:**

- Add deterministic idempotency for Customer and Checkout creation.
- Add atomic trial and plan-transition guards.
- Keep provider subscription payments separate from customer marketplace payments in the ledger and risk reporting.
- Ensure a suspended or security-restricted provider cannot create new subscription/payment activity unless explicitly allowed by policy.

### 6. Stripe Webhook — `server/stripeWebhook.ts`

**Current protections found:** raw-body route; Stripe signature verification; handlers for Checkout completion, Payment Intent success/failure, refunds, and subscription/invoice events; defensive payment upserts; subscription resource-missing handling.

**Priority gaps:**

- Add a durable processed-event table keyed by Stripe event ID, with safe replay behavior.
- Add payment-state transition validation so old or out-of-order events cannot overwrite a later final state.
- Record webhook processing attempts and failures for reconciliation and alerting.
- Add handlers or reconciliation coverage for disputes, transfer reversals, balance transactions, and other financial events relevant to Connect reporting.
- Ensure fulfillment, referral crediting, notifications, and partner transfers are each independently idempotent.

## Recommended implementation phases

### Phase 1 — Shared authorization contract

Create a server-side payment authorization service used by booking, promotion, invoice, and subscription routes. It should validate authenticated identity, security status, ownership, server-calculated amounts, provider eligibility, payment purpose, existing payment state, and connected-account readiness.

This phase must not change the Connect charge type or production Stripe settings.

### Phase 2 — Atomic abuse prevention

Add a durable payment-attempt record or equivalent atomic counter. Enforce configurable limits by customer, email, Stripe Customer, IP, provider, booking, and time window. Begin with conservative thresholds and an admin-review/cooldown response rather than permanent blocking.

Use Stripe Checkout and the risk signals it receives. Do not store raw card details or create invasive fingerprinting. Do not block international customers solely by country.

### Phase 3 — Financial integrity

Add explicit Stripe event-ID deduplication, state-transition rules, idempotent side effects, and daily reconciliation. Reconciliation should match OlogyCrew records to Payment Intents, Charges, Transfers, Application Fees, Refunds, Disputes, and Balance Transactions.

### Phase 4 — Pay at location

Add a separate booking payment method and status path. It should reserve the booking without creating a Stripe charge, state clearly that payment is due directly to the provider, expire according to booking policy, and never enter Stripe transfer or fee logic.

### Phase 5 — Payment Risk Center

Add admin visibility for failed attempts, velocity alerts, restricted customers/providers, unmatched Stripe records, captured payments attached to canceled or pending bookings, transfers, refunds, disputes, and reversible security actions.

### Phase 6 — Connect architecture review

After Stripe responds to the open investigation, document whether destination charges remain appropriate or whether some flows should use direct charges. Do not make that change based only on payment amounts, guest names, or the current incident pattern.

## Required acceptance tests before production approval

- A restricted customer cannot initiate a new charge through any supported route.
- A restricted or payout-disabled provider cannot receive a new marketplace payment.
- Fifty concurrent requests for one booking create at most one financial obligation.
- A duplicate webhook event produces no duplicate payment, credit, notification, or transfer side effect.
- An out-of-order webhook cannot revert a final payment state.
- Failed-attempt velocity triggers a reversible cooldown without deleting records.
- Pay-at-location creates no Stripe Checkout Session, Payment Intent, transfer, or platform fee.
- Legitimate customers can still complete booking, invoice, and subscription flows.
- Refunds and disputes are represented in the ledger and reconciliation output.
- Reconciliation reports unmatched local and Stripe records.
- Chisolm Audio and Gary Studios remain excluded from incident containment and test fixtures.
- All changes remain unpublished until explicit production approval.

## External basis

Stripe describes direct charges as placing refunds and chargebacks primarily on connected accounts, while destination charges place them on the platform balance. This is why the Connect architecture decision must wait for liability and merchant-of-record review: [Stripe risk and liability management](https://docs.stripe.com/connect/risk-management) and [Stripe Connect charge types](https://docs.stripe.com/connect/charges).

Stripe recommends Checkout or other supported integrations, collecting customer email, name, billing address, and IP-related risk signals, plus rate limits and targeted friction for card-testing prevention: [Stripe card-testing prevention](https://docs.stripe.com/disputes/prevention/card-testing).

Stripe supports idempotency keys for safe retries of create/update operations: [Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests).

## Next action

The next implementation checkpoint should cover **Phase 1 only**: a shared authorization contract and route adapters, with no Connect charge-type change, no bank or payout changes, no credential rotation, and no automatic restrictions beyond the existing incident containment.
