# Stage 4 Pay-at-Location implementation note

Implemented as an additive feature on 2026-11-07. The checked-in migration is `drizzle/0071_late_jigsaw.sql` (with Drizzle metadata in `drizzle/meta/0071_snapshot.json` and `_journal.json`). It creates only `offline_booking_payments`, `provider_pay_at_location_settings`, and `provider_pay_at_location_services`; existing `bookings`, `payments`, Stripe Connect, payout settings, credentials, and financial records are not modified.

The direct `booking.create` flow accepts `paymentMethod: online | pay_at_location` (defaulting to `online`). For Pay-at-Location, the server validates provider enablement and service eligibility, creates the normal booking, and then creates one separate `due` ledger row with the server-calculated total. No Checkout Session, Payment Intent, Charge, Stripe customer attempt, transfer, payout, or online `payments` row is created. Stripe webhook processing remains isolated to Stripe-linked records.

Provider settings and eligible services are managed through `offlinePayment.getProviderSettings` and `offlinePayment.updateProviderSettings`. Settlement is provider/admin-only through `confirmPayment` or `waivePayment`; customers have status reads only. Transitions require the full immutable `originalAmountDue`, use a conditional `due` update for stale/duplicate safety, and record audit actions. Multi-day, recurring, quote-conversion, provider-side, and public-agent booking writers were deliberately left unchanged in this release; the direct ServiceDetail path is the only UI-integrated creation path.

## Rollback / disable

To stop new offline bookings without deleting history, set a provider's Pay-at-Location setting to disabled (or remove all eligible service IDs). Existing ledger rows remain readable and should not be deleted. If code rollback is required, disable the new procedures/UI after in-flight confirmations are settled; do not alter Stripe tables or historical financial records. A physical table rollback, if ever approved, must export the three new tables and related audit entries first and remove only those newly added objects.
