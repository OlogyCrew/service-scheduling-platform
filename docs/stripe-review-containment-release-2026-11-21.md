# OlogyCrew — Stripe-review containment release

**Date:** November 21, 2026. **Baseline:** `b03802c4`. **Scope:** Owner-authorized corrections to subscription/trial containment, record-preserving status reads, review-period copy, and tests. This release does not promote the separately frozen Phase 2 or Pay-at-Location patches.

## Release behavior

All new provider and customer trials are unavailable. Customer/provider paid checkout, billing portals, downgrade, pause/resume, billing-interval changes, and Connect onboarding/dashboard links fail closed before handler DB lookups, billing writes, Stripe calls, velocity counters, or notifications. Optional Stripe trial checkout paths also have their own trial guard. Existing provider booking/invoice collection containment remains enabled.

Provider/customer subscription summaries are local-only during review. They do not retrieve Stripe subscriptions or clear retained identifiers on `resource_missing`. The API explicitly marks the billing interval as unverified. Trial-status reads derive current access/expiry from stored dates without saving a downgrade, clearing dates, or sending conversion reminders. The authenticated scheduled trial-expiry handler returns a paused no-op before DB acquisition. Connect status reads retain stored reference fields without refreshing Stripe or updating provider records; current online collection/charge/payout availability is reported disabled.

Provider Starter selection returns any existing subscription unchanged during review, including paused/canceled/legacy states. A genuinely new free record may still be created. Onboarding no longer auto-consumes pending paid choices or starts trials after profile creation. Existing paid/trial records are retained rather than being overwritten by free-plan continuation. A stored payment connection is explicitly historical, not proof that payments are available.

Pricing, signup, Help Center, provider/customer subscription pages, and trial banners reflect the pause. Paid controls are disabled; monthly/annual presentation remains available for comparison only. Expired-trial banners no longer trap users behind blocked payment/downgrade actions. Subscription billing history shows local events with an explicit notice that Stripe invoices/downloads are not refreshed; empty results do not imply previous charges or invoices never existed. Unpaid bookings and invoices remain unpaid.

Resumption is not automatic. Stripe service restoration must be followed by a separately approved, tested application release.

## Actual validation

| Check | Final result |
|---|---|
| `pnpm check` | PASS; actual exit 0 |
| `pnpm build` (client, SSR, server) | PASS; actual exit 0 |
| Explicit pure/mocked release gate | 12 files, **552 tests passed**, 0 failures; actual exit 0 |
| Actual subscription/Connect routers and scheduled handler | 399 tests passed; included in 552, not additive |
| Provider booking/invoice collection containment | 67 route tests + 17 UI tests passed; included in 552 |
| Review billing/banner/history UI | 13 tests passed; included in 552 |
| Provider subscription UI | 3 tests passed; includes disabled annual-switch assertion |
| Other included checks | Helper policy, hydration, Help Center, pricing, SSR HTML, OG route, sitemap |
| `git diff --check` | PASS |
| Responsive preview | 16 page/layout cases at 390 × 844 and 768 × 1024, no measured horizontal overflow, no captured application errors; reviewed billing controls disabled |

Final logs: `corrected-typescript-20261121T232002Z.log`, `corrected-build-20261121T232002Z.log`, `corrected-release-tests-20261121T232034Z.log`. Result manifests and repeatable runner are retained outside the repository under `/home/ubuntu/release-verification-2026-11-21/`.

Tests used an explicit standalone configuration with `envDir:false`, no default/global database setup, no `DATABASE_URL`, and no live service credentials. Router tests use actual protected middleware with mocked DB/Stripe/notification dependencies and deny network transports before imports. Guest/suspended/role variants, default/true/false trial requests, active/expired/milestone/paused/canceled records, failed reads, missing-resource simulations, history preservation, free setup, and cron authentication boundaries are covered. These tests do not certify genuine integration health or the full application regression suite.

Responsive capture used visitor pages and synthetic client API fixtures in disposable browser contexts. Every application API response was intercepted; all POSTs and external requests were blocked. Signed-in screenshots are **not genuine authenticated backend evidence**. They do not certify native iPhone/iPad behavior, every onboarding step, or protected-account production state.

## Preserved failures and limitations

The earlier expanded release run remains **147 passed / 7 failed, exit 1**. Its seven OG tests required DB fixtures that were intentionally unavailable. That run and its initial configuration-resolution error are preserved; it was not relabeled green. The final safe gate is a separately declared pure/mocked partition, not a full regression rerun.

The first new router-suite run remains 392 passed / 7 failed, exit 1: a matcher unsupported by installed Vitest was replaced with equivalent call-count/argument checks. Subsequent focused and final release runs passed. The first responsive attempt failed because the synthetic terms fixture returned an invalid shape; its log and screenshots were preserved. Corrected fixture capture passed without application changes for that issue.

Build warnings remain: large bundles, existing Zod annotation warnings, pnpm settings warnings, and absent analytics placeholders in the credential-scrubbed build. The already-running development reminder service logged a transient DB timeout; later status showed a successful connection and no due review reminders. This work did not recertify reminder-service/integration availability.

The pause does not freeze or extend existing trial dates. Effective feature access still follows stored dates and entitlement rules. No Stripe subscription cancellation, remote billing-schedule change, prior checkout-link revocation, refund, payout, or connected-account change was performed. Historical webhooks/reconciliation and explicit account-lifecycle behavior remain outside this correction; the existing re-registration cleanup path is not changed. Record-preservation tests specifically cover the guarded billing actions, summary/status/Connect reads, free selection, and scheduled trial expiry—not an indefinite guarantee against all possible account operations or historical webhook events. Scheduled SDK authentication failures retain the existing HTTP 500 behavior, with no DB access in the tested failure path.

## Preservation and release boundaries

No schema/migration changes, production test fixtures, financial operations, Stripe settings/credentials/webhook-secret changes, provider activation, pilot selection, Pay-at-Location settings, incident restrictions, or protected Chisolm Audio/Gary Studios records were changed by this validation. Source fingerprints confirm the schema, user lifecycle helper, authentication router, and historical Stripe webhook unchanged from baseline. No fresh production database counts or genuine Stripe/Twilio/email checks are claimed.

## Publication and follow-up

A saved checkpoint is not proof of publication. The available WebDev tools do not expose a deploy/publish action. Publish the corrected checkpoint through the project's WebDev **Publish** control only; do not save Stripe settings as a deployment workaround and do not roll back to a pre-patched deployment.

After confirmed publication, perform read-only live verification: confirm the deployment identity and refreshed assets, pricing/provider/customer notices and disabled controls, free navigation, Help wording, and mobile/tablet layout. Do not test real payments/trials, save provider settings, create obligations, or call financial mutations in production. Existing separately restricted work remains on hold.
