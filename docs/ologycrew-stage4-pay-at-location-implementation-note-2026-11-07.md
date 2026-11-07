# Stage 4 Pay-at-Location implementation note

Implemented as a revised unpublished checkpoint on 2026-11-07. The checked-in migration is `drizzle/0071_late_jigsaw.sql` (with Drizzle metadata in `drizzle/meta/0071_snapshot.json` and `_journal.json`). It creates only `offline_booking_payments`, `provider_pay_at_location_settings`, and `provider_pay_at_location_services`; existing `bookings`, `payments`, Stripe Connect, payout settings, credentials, and financial records are not modified. The migration is additive and contains no destructive statements. Foreign-key/index/unique identifiers were reviewed and shortened where needed so all MySQL identifiers are at most 64 characters.

## Booking and quote behavior

The direct `booking.create`, `booking.createMultiDay`, and `booking.createRecurring` flows accept `paymentMethod: online | pay_at_location`, defaulting to `online`. The multi-day and recurring flows calculate one server-authoritative parent `totalAmount` across all sessions and create exactly one offline ledger row linked to that parent booking; they never create one row per session. Quote acceptance through `provider.updateQuoteStatus` also defaults to online, validates the provider setting and eligible service before conversion, and creates exactly one ledger row for the converted booking when the customer selects Pay-at-Location. Provider-side booking creation and public-agent transaction policy remain unchanged.

For every offline path, the server validates provider enablement and service eligibility before creating the booking. Offline creation does not create a Checkout Session, Payment Intent, Charge, Stripe customer attempt, transfer, payout, or online `payments` row. The ledger helper is duplicate-safe through an existing-row check plus unique-key race handling. The `bookingId` unique constraint is the one-parent-ledger invariant.

ServiceDetail now queries service-specific eligibility and passes the payment method through single-day, multi-day, and recurring mutations. MyQuotes and CustomerQuotesSection provide an online-default customer choice for quote acceptance and show provider instructions for Pay-at-Location when eligible. Customers have no self-confirm or self-waive controls.

Provider/admin settlement remains available through `offlinePayment.confirmPayment` and `offlinePayment.waivePayment`. Paid and waived transitions require the full immutable original amount, use a conditional `due` update for stale/duplicate safety, require a waiver reason, and write `confirm_pay_at_location_payment` or `waive_pay_at_location_payment` audit actions with details. Customer status reads remain read-only. Disabled settings do not delete or rewrite existing ledger/history rows.

## Preview coverage

`server/pay-at-location-stage4-preview.contract.test.ts` adds 8 focused source contracts covering:

- online-default payment selection and UI wiring for direct, multi-day, recurring, and quote flows;
- provider settings and eligible service validation;
- one parent-level ledger obligation and server-calculated total for multi-day and recurring bookings;
- duplicate-safe ledger creation and stale/duplicate transitions;
- provider/admin settlement boundaries, mandatory waiver reason, audit actions/details, and customer read-only status;
- Stripe-free behavior for all four flows and webhook exclusion of offline tables;
- no historical auto-conversion and readable history when settings are disabled; and
- migration FK, index, uniqueness, identifier-length, additive-only, and non-destructive review.

Focused validation passed **49 tests across 4 files**:

```text
server/pay-at-location-stage4-preview.contract.test.ts  8
server/pay-at-location.contract.test.ts                  3
server/quote-booking-sessions.test.ts                   22
server/quotes.test.ts                                    16
Total                                                     49 passed
```

No synthetic database rows were left by the focused tests; the test cleanup reported no test accounts requiring cleanup. The existing test harness may print a Vite close-time warning after successful completion, but the test process reports all tests passed.

## Migration and live-database review

The migration was reviewed without applying it. It has three additive `CREATE TABLE` statements, foreign keys to existing tables, a unique `bookingId` ledger constraint, a unique provider/service eligibility constraint, status/provider/service indexes, and no `DROP`, destructive `ALTER`, or changes to `bookings`/`payments`. A read-only SQL query was attempted against `information_schema.tables` for the three Stage 4 table names. The sandbox has `DATABASE_URL` set but no reachable local MySQL socket (`ERROR 2002: Can't connect to local MySQL server through socket`), so no result could be obtained and no SQL mutation was performed. The migration remains unapplied; the parent agent must re-run the same read-only query through the authorized live-database connection before checkpointing.

Recommended read-only query:

```sql
SELECT TABLE_NAME
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name IN (
    'offline_booking_payments',
    'provider_pay_at_location_settings',
    'provider_pay_at_location_services'
  )
ORDER BY TABLE_NAME;
```

## Backup and rollback / disable plan

Before any future migration application, take the approved database backup/snapshot and retain the migration SQL, Drizzle metadata, and a schema dump. To stop new offline bookings without deleting history, disable the provider setting or remove all eligible service IDs. Existing ledger rows remain readable and must not be deleted. If code rollback is required, disable the new procedures/UI after in-flight confirmations settle; do not alter Stripe tables, historical bookings, audit history, or financial records. If a physical table rollback is ever approved, export the three Stage 4 tables plus related audit entries first, verify the backup, and remove only the newly created tables/constraints through a separately reviewed migration. Restore by reapplying the reviewed additive migration and restoring only the exported Stage 4 objects if necessary. No migration was applied and no checkpoint was saved by this work.
