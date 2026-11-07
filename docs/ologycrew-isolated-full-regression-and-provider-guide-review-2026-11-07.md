# OlogyCrew — Isolated Full Regression and Provider Guide Review

**Date:** 7 November 2026  
**Application baseline:** unpublished checkpoint `712c0f91`  
**Decision:** **NOT READY FOR DEPLOYMENT APPROVAL. Keep the UI checkpoint unpublished.**

The previously accepted genuine payment-button walkthrough remains valid for its tested scope. This review did not change payment behavior, production data, provider settings, Stripe configuration, or incident restrictions. It executed the full existing test inventory in an isolated database and prepared a complete provider guide for owner review. It does not authorize deployment, guide publication, or pilot activation.

## 1. Exact results

| Check | Actual result | Verdict |
| --- | --- | --- |
| Full application test files | 232 executed: 218 passed, 14 failed | **FAIL — gate remains open** |
| Full application assertions | 2,321 executed: 2,297 passed, 24 failed; no pending/todo tests | **FAIL** |
| Stage 4 tests within that full suite | 24 passed across five files | PASS for these cases |
| Additional provider/customer UI suites | 70 passed across two files | PASS |
| Test assertions and default inventory | Copied test checksums unchanged; no default test files excluded | PASS |
| Production access | No production connection used by this verification | PASS |
| Provider guide | Complete draft and exact-label review prepared; not placed in Help Center | OWNER REVIEW PENDING |
| Application deployment / guide publication / pilot activation | None performed | NOT AUTHORIZED |

The 24 Stage 4 tests are included in the 2,321-test full application run; do not add them to that total. The additional 70 UI tests were run using `vitest.offline-ui.config.ts` because the default configuration discovers `.test.ts`/`.spec.ts`, not these two new `.test.tsx` files. These 70 also overlap with the prior 90-test focused evidence; do not add this run to earlier totals to imply more distinct coverage.

Vitest's JSON `numTotalTestSuites` counts nested describe suites. File counts above come from its `testResults` array, not nested-suite counts. The successful orchestration-script exit means results were captured; the full Vitest process itself returned **exit code 1**. UI Vitest returned **exit code 0**.

### Invocation and timing

The first `pnpm test` attempt stopped before executing tests because this installed pnpm tried to fetch version information from `registry.npmjs.org`. The no-egress boundary correctly blocked it. Its error and process status are retained as `package-manager-startup-blocked.log` and `package-manager-attempt-status.json`. It is not a failed assertion run and not a pass.

The actual full run used the already-installed executable, equivalent to the package script `vitest run`:

```text
node node_modules/vitest/vitest.mjs run --maxWorkers=1 --minWorkers=1
  --reporter=default --reporter=json --outputFile=<isolated evidence>/full-suite.json
```

Actual full-run start: **22:03:05 UTC** (17:03:05 Eastern). Vitest reported **231.13 seconds**. The wrapper retained teardown time separately. Additional UI execution and result capture finished at **22:07:44 UTC**. No test expectations were weakened to manufacture a green run.

The existing non-fatal Vite close-handle warning remained after test cleanup. This does not change the failed-suite verdict. This verification did not repeat the prior TypeScript or production-bundle build; those passing results belong to the previous UI-remediation report.

## 2. Isolation evidence

The source-only workspace was `/home/ubuntu/verification/ologycrew-full-regression-2026-11-07/app`. An explicit whitelist copied application source, test files, dependency/configuration manifests and one technical implementation note. No environment files, production dump, incident CSV, provider records or live credentials were copied.

The target was a fresh **MariaDB 10.11.14** compatibility database at loopback port **3327**, database `ologycrew_full_regression_20261107`. It is not production TiDB 8.5.3 and this run is not a fresh production-TiDB compatibility certification. Schema-only DDL was applied only to the disposable target. Initial users, providers, services, bookings, online payments, offline obligations and offline-provider settings were empty.

Only 41 canonical public category fixtures matching the project instructions were seeded. Tests created their own synthetic application records. Existing tests expecting extra categories, existing official providers or live CRM rollout state were not supplied production data to satisfy their assumptions.

Database and test workers ran inside a dedicated network namespace with loopback enabled, **no external route**, and a failed production-reachability probe. The launcher used an allowlisted, scrubbed environment. A generated local JWT secret was disposable. An inert, non-usable test-shaped Stripe string permitted SDK construction; **no genuine Stripe key, webhook secret, Twilio/SendGrid/social/cloud credential or production OAuth credential was inherited**. No production app, webhooks or background scheduler was started.

These controls prevent live financial or notification operations. A suite returning early because a service credential is absent is not evidence that the service integration authenticated successfully. For example, the Twilio API assertion explicitly returned without calling Twilio; its four configuration assertions failed. The latest Twilio account funding cannot be assessed by this credential-free run.

## 3. All 24 failures, grouped without reclassifying them as passes

| Group | Failed assertions | Interpretation |
| --- | --- | --- |
| Missing isolated integration configuration | 15 | Expected configuration fields deliberately absent; these remain failed checks |
| Existing/synthetic fixture mismatch | 6 | Existing tests rely on state not present in the source-only fixture database |
| Service or test-harness dependency | 3 | Two OG image regeneration comparisons and one local SSE request require follow-up |

### Failure file inventory

| Test file | Failures | Finding |
| --- | --- | --- |
| `facebook-credentials.test.ts` | 3 | Missing Page token, Page ID and application configuration |
| `google-auth.test.ts` | 2 | Missing OAuth client configuration |
| `linkedin-credentials.test.ts` | 3 | Missing token, organization and client configuration |
| `partnerSplit.test.ts` | 1 | Partner connected-account configuration absent |
| `push-notifications.test.ts` | 1 | VAPID configuration absent |
| `sendgrid-key.test.ts` | 1 | SendGrid key absent |
| `twilio-validate.test.ts` | 4 | Phone, Account SID, token and Messaging Service SID absent; API test returned early |
| `customers-phase10.test.ts` | 1 | Expected an existing customer-workspace pilot provider; isolated state was blocked |
| `customers-phase8.test.ts` | 2 | Expected existing rollout/entitlement configuration; isolated state was disabled/ineligible |
| `holistic-share.test.ts` | 1 | Expects category 210, outside the canonical categories supplied for this isolated fixture set |
| `official-provider.test.ts` | 1 | Expects an existing official provider; no provider data was imported |
| `skilllink.test.ts` | 1 | Expects a nonempty existing admin user list |
| `og-tags.test.ts` | 2 | Expected a regenerated image URL after cache invalidation; received the same fallback URL |
| `sse-notifications.test.ts` | 1 | Local SSE endpoint request failed; the required app server was not running in this namespace |

The OG and SSE failures are not established as Stage 4 regressions, but are also **not proven harmless**. A safe follow-up needs a documented synthetic fixture contract, a local-only service harness and explicit mocked integration boundaries. Do not populate real credentials, copy production records, bypass isolation, skip failures silently, or simply call this run green. No fixes to these unrelated tests or application modules were made.

Some existing external-service tests return early when credentials are absent while Vitest reports their assertions as passed. Full JSON/logs retain these outcomes; live integration health remains unverified.

## 4. Stage 4 and UI evidence

All five Stage 4 files passed in the actual full run:

| File | Tests |
| --- | --- |
| `pay-at-location-database.test.ts` | 4 |
| `pay-at-location-remediation.test.ts` | 5 |
| `pay-at-location-stage4-preview.contract.test.ts` | 8 |
| `pay-at-location-stripe-isolation.test.ts` | 4 |
| `pay-at-location.contract.test.ts` | 3 |

The two additional real-component UI suites passed: **37 provider tests** and **33 customer tests**. The earlier genuine button walkthrough remains the evidence for actual browser receipt/waiver actions and durable synthetic audit records. This task did not repeat that walkthrough or create another demonstration obligation in production.

## 5. Provider guide and adjacent source qualifications

The complete guide is `docs/ologycrew-provider-pay-at-location-guide-draft-2026-11-07.md`; exact interface/source mapping is in `docs/ologycrew-provider-guide-label-review-2026-11-07.md`.

The guide describes the corrected unpublished forms and verified settings labels, full-only receipt/waiver, required reason and acknowledgment, participant-visible notes/history, original agreement versus outstanding balance, customer read-only access, conservative retry/refresh handling and history preservation on disablement. It requires separate authorization before any setup and makes no promise of a technical global flag, universal access, automatic refunds or fee-free external transfers.

The review also identified adjacent gaps outside the accepted three-form UI remediation:

1. **Server-side offline exclusion is not explicit in booking Checkout.** `server/stripeRouter.ts:51–265` retrieves the booking, checks ownership/account/provider/subscription/velocity and captured **online** payments, but does not read or reject the separate offline ledger before credit spending or Checkout creation. `previewCreditDiscount` likewise does not exclude offline obligations. The corrected customer UI prevents its normal offline flow from reaching Checkout; the existing zero-Stripe walkthrough does **not** prove that every direct API path is excluded. This is a deployment-readiness/security qualification, not evidence that an unauthorized live charge occurred. No endpoint was invoked in production and no backend fix was applied. Require a separately reviewed server-side guard and direct-route negative tests before claiming system-wide offline/Stripe separation.
2. **The generic customer booking list can show an inconsistent Pay Now prompt.** `client/src/pages/MyBookings.tsx:1037–1046` uses booking confirmation/`paidAt` and a network-connectivity flag, not the offline ledger. Offline settlement intentionally does not rewrite `booking.paidAt`. The corrected confirmation page is ledger-gated, but the legacy list prompt still needs assessment. No list UI change was made.
3. **Help content contains contradictory broad Stripe wording.** `client/src/pages/HelpCenter.tsx:373–380` contains both “All payments … through Stripe” and the existing customer Pay at Location article. Related payment FAQ/fee/refund language must be reconciled before publishing the new provider guide. HelpCenter was not edited.

Other documented label qualifications include mobile navigation labels, search keywords, current instructions rather than an immutable booking-time instruction snapshot, and user-ID rather than named-signature history. The existing admin audit table still truncates its Details column; full audit evidence was verified in the earlier isolated database export. No additional feature development was performed here.

## 6. Post-test state and cleanup

The existing global cleanup reported removal of **26 synthetic test accounts and eight synthetic providers**. An independent local-only count check after completion found zero rows in users, providers, services, bookings, online payments, audit log, all three Stage 4 tables and the webhook event ledger; enabled offline providers were zero. Those are **isolated counts, not production counts**. Canonical category fixtures remain local to this disposable database.

The disposable database and namespace are stopped after evidence capture, the generated local JWT secret is removed, and the teardown record is included with the evidence archive. Test logs and machine-readable results are retained. No historical production cleanup was performed.

Production Pay-at-Location provider state and any global flag were **not freshly measured**. This task preserves the previously established operationally disabled state; it does not re-certify it. A separately authorized read-only state check is required immediately before any deployment decision. Chisolm Audio, Gary Studios, incident evidence and restrictions remain untouched by this work.

## 7. Required next decisions

1. **Do not deploy.** The full application gate failed, and the backend-wide offline exclusion qualification remains unresolved.
2. Approve a narrowly scoped isolated test-harness/fixture review if a green hermetic full-suite gate is required. Preserve an explicit distinction between unit/database tests and genuinely external service-health checks.
3. Review and separately authorize any backend offline-checkout/credit guard and legacy list-message correction, with direct API negative tests; do not infer that the accepted visual forms prove every adjacent route safe.
4. Review the complete provider guide. Its placement and related Help wording need owner approval; no guide is published by this report.
5. Deployment, production disabled-state recheck and later pilot selection/activation remain separate approvals.

**Final assessment:** Stage 4's executed tests and the new UI suites passed. **Full application regression failed. Provider guide is ready for review, not publication. Production deployment and pilot activation remain on hold.**
