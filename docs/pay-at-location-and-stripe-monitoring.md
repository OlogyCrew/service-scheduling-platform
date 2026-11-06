# Pay at location and Stripe monitoring plan

## Recommended product model

Treat booking availability, payment collection, and payout eligibility as three separate states.

A provider can be visible and accept a reservation while Stripe payouts remain disabled. A booking can reserve a time slot without creating a Stripe PaymentIntent or payment row. An online payment can be captured only when the provider, service, and connected account pass the payment-collection checks.

This separation is important because a booking is not proof of an online payment. Stripe’s Connected accounts page is the authoritative place to review open risk, onboarding, verification, and capability restrictions; Stripe recommends using its status filters and account-specific requirements when deciding what action to take. [1]

## Schema change

Add an explicit payment mode to services and bookings. The existing `requireUpfrontPayment` field should remain for compatibility, but it should no longer be the only signal that determines whether Stripe Checkout is shown.

Proposed service fields:

```ts
paymentCollectionMode: mysqlEnum("paymentCollectionMode", [
  "online",
  "pay_at_location",
  "online_or_location",
]).default("online").notNull(),
payAtLocationInstructions: text("payAtLocationInstructions"),
reservationHoldMinutes: int("reservationHoldMinutes").default(30).notNull(),
```

Proposed booking fields:

```ts
paymentMode: mysqlEnum("paymentMode", [
  "online",
  "pay_at_location",
]).default("online").notNull(),
offlinePaymentStatus: mysqlEnum("offlinePaymentStatus", [
  "not_applicable",
  "unpaid",
  "reported",
  "confirmed",
  "waived",
  "disputed",
]).default("not_applicable").notNull(),
offlinePaymentConfirmedAt: timestamp("offlinePaymentConfirmedAt"),
offlinePaymentConfirmedBy: int("offlinePaymentConfirmedBy"),
paymentDueAt: timestamp("paymentDueAt"),
reservationExpiresAt: timestamp("reservationExpiresAt"),
```

Add indexes on `(providerId, paymentMode, status)` and `(reservationExpiresAt, status)`. Keep the existing `payments` table for Stripe and other recorded online payments. Do not insert a fake Stripe payment row for a pay-at-location booking.

Backfill every existing service to `paymentCollectionMode = 'online'`. Backfill existing bookings to `paymentMode = 'online'`. This preserves current behavior and prevents the migration from silently changing historical or in-flight bookings.

Generate the Drizzle migration, review the SQL, and apply it with the project’s normal migration workflow. Do not use an ad hoc production `ALTER TABLE` as the long-term implementation. The migration should be backward-compatible and deployed before the UI starts sending the new fields.

## Booking and provider UI

In the provider service editor, add a payment section with three radio choices:

- **Pay online through OlogyCrew**
- **Reserve now, pay at the location**
- **Let the customer choose**

For the second and third choices, require clear instructions such as accepted payment methods, when payment is due, cancellation/no-show terms, and whether a deposit is required in person. Do not allow a provider to claim that an offline reservation is “paid” merely by creating the booking.

On the customer booking form, show the payment choice before the final submit button. Use plain labels:

> Pay online now
>
> Reserve the time and pay the provider at the location

For a pay-at-location booking, show the provider’s instructions, the amount due, the location, and the reservation-expiration rule. The final action should say **Reserve appointment**, not **Pay now**. The confirmation email and in-app booking detail should repeat that OlogyCrew did not charge the card.

When `paymentMode = 'pay_at_location'`:

1. Create the booking and reservation hold.
2. Do not create a Checkout Session, PaymentIntent, transfer, application fee, or Stripe payment row.
3. Set `offlinePaymentStatus = 'unpaid'` and set `paymentDueAt` to the appointment time unless the provider specifies another due time.
4. Release the slot automatically if the provider does not accept the reservation before `reservationExpiresAt`.
5. Let the provider mark payment as received after the appointment; record the actor and timestamp in an audit event.
6. Let the customer report a disagreement, but require provider/admin confirmation before changing the offline payment to `confirmed`.

For `online_or_location`, require the customer to choose one mode before the booking is finalized. Never switch an online booking to offline after a successful Stripe capture without a refund and an explicit audit trail.

The existing Stripe checkout guard should branch on `paymentMode` before creating any Stripe object. Online payment must still require the provider’s active paid subscription, active provider profile, Stripe account, and payout-ready state. Pay-at-location should not bypass provider visibility, cancellation policy, authentication, abuse rate limits, or booking ownership checks.

Referral credits should only be earned from a completed booking’s net captured online payment. An offline reservation must not create referral credit until the platform has a deliberate, separately documented policy for verified offline payments.

## Stripe fraud and payout-hold monitoring

Maintain two separate local controls:

- `providerActive`: marketplace visibility and whether new reservations are accepted.
- `payoutEnabled` plus Stripe’s actual payout/capability state: whether funds may be released.

A Stripe flag should normally create a review item and payout hold, not automatically prove that the provider is fraudulent. The platform can keep a provider visible while Stripe investigates, as was done for the restored providers, but it should block payout release and avoid new online charges when Stripe or local controls say the account is not payout-ready.

Create a `stripe_account_risk_snapshots` table or equivalent immutable audit record containing the provider ID, Stripe account ID, checked time, charges-enabled state, payouts-enabled state, disabled reason, currently-due and past-due requirement counts, balance totals, payout schedule, source event/request ID, and reviewer decision. Store hashes or counts rather than unnecessary personal or payment-method data.

Process Stripe webhooks idempotently and retain the event ID. At minimum, route account capability or requirement changes, payout failures, payout success/cancellation, balance changes, payment failures, refunds, disputes, and chargebacks into the review queue. Reconcile periodically from Stripe rather than trusting only webhooks. Stripe’s account-fraud guidance specifically recommends monitoring suspicious accounts across their lifecycle, using risk signals and alerts, and pausing payouts or offboarding accounts when appropriate. [3]

Use a review state machine such as `new`, `monitoring`, `provider_contacted`, `stripe_review`, `cleared`, `restricted`, and `closed`. Require an explicit reviewer and reason before changing `payoutEnabled` or releasing a manual payout. Protect Chisolm Audio and Gary Studios with an allowlist only for accidental containment recovery—not as an exception to Stripe’s risk controls.

Use alerts for these conditions:

- Stripe account becomes restricted, rejected, or has a disabled reason.
- `currently_due` or `past_due` requirements become non-empty.
- Stripe charges or payouts become disabled.
- A local payout flag disagrees with Stripe.
- A provider has a high failed-payment ratio, repeated attempts from very few customers, or unusual cross-provider customer/payment-method overlap.
- A payout fails, a dispute appears, or the platform balance/recovery debit changes unexpectedly.

Manual payout is a timing control, not escrow. Stripe says manual payouts hold funds until the platform initiates a payout and also states that Stripe does not provide escrow; the platform must respect the country-specific holding period. For US connected accounts, Stripe currently documents a two-year holding period. [2]

Do not log API keys, webhook secrets, full payment-method data, bank-account numbers, or raw identity documents. Use least-privilege access, encrypted secrets, redacted structured logs, rate-limited reconciliation jobs, and a dead-letter queue for failed webhook processing.

## Read-only status checker

The project now includes `scripts/stripe-provider-status.ts` and the package command:

```bash
pnpm stripe:provider-status
pnpm stripe:provider-status -- --csv
pnpm stripe:provider-status -- --fail-on-issues
```

The checker finds all non-official, non-deleted, locally active providers with a Stripe account, then reads each Stripe Account and Balance object. It reports local provider/service state, charges and payouts enabled, outstanding requirements, disabled reason, payout schedule, and available/pending balance. It is intentionally read-only: it never creates payouts, changes account settings, mutates the database, or prints secrets.

The command requires `DATABASE_URL` and `STRIPE_SECRET_KEY`. It refuses a test key unless `--allow-test` is explicitly provided. Use the live key only from the authorized secret store, not from a pasted terminal command or source file.

The checker does not claim to retrieve every Radar rule match. Radar-specific flags and account-risk decisions should remain in Stripe Dashboard or an approved Stripe data export/Sigma workflow, then be reconciled into the local review queue. The script is a capability and payout-health check, not a fraud verdict.

## Safe rollout order

1. Add and migrate the new nullable/defaulted schema fields.
2. Backfill existing services and bookings to online mode.
3. Add provider and customer UI with explicit copy and expiration behavior.
4. Add server-side validation and tests for both modes.
5. Add webhook/reconciliation snapshots and alerting.
6. Run the read-only status checker in staging and compare its results with Stripe Dashboard.
7. Test online checkout, pay-at-location reservation, expiration, cancellation, provider confirmation, dispute reporting, and duplicate-submit behavior.
8. Publish only after review of the migration, tests, and payment safeguards. Do not publish the current unpublished security checkpoint or this plan automatically.

## References

[1]: https://docs.stripe.com/connect/dashboard/review-actionable-accounts "Review and take action on connected accounts"
[2]: https://docs.stripe.com/connect/manual-payouts "Using manual payouts"
[3]: https://stripe.com/radar/account-fraud "Stripe Radar account fraud detection and prevention"
