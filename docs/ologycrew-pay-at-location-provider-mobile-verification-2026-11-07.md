# OlogyCrew Pay-at-Location — Provider Mobile Verification

**Date:** November 7, 2026  
**Mode:** Read-only verification  
**Production changes:** None  
**Published application version:** `7b259056`

## Scope and safety boundary

This review verified the published restricted application, Help Center behavior, mobile rendering, and live Pay-at-Location database state. No provider was activated, no setting was saved, no offline payment was created, and no Stripe or financial configuration was changed.

## Production state

Read-only production checks confirmed:

| Check | Result |
|---|---:|
| `offline_booking_payments` rows | 0 |
| `provider_pay_at_location_services` rows | 0 |
| `provider_pay_at_location_settings` rows | 0 |
| Enabled provider settings | 0 |
| Eligible provider/service rows | 0 |
| Offline payment obligations | 0 |

The three Stage 4 tables exist and are empty. Pay-at-Location remains disabled globally in practice because no provider settings or eligible-service rows exist.

Chisolm Audio and Gary Studios were located in the protected-account check and were not modified.

## Help Center verification

The published Help Center was checked at `https://ologycrew.com/help`.

Searching for **Pay at Location** returned exactly one customer-facing guide. The provider setup guide remains unpublished and is not exposed in the live Help Center.

Mobile screenshots were captured at:

- 390 × 844
- 768 × 1024

The Help Center passed the read-only visual review: no obvious horizontal overflow, clipped headings, overlapping controls, or inaccessible primary content were observed. The longer 390px page remains navigable, and the 768px layout uses the available width effectively.

## Provider-dashboard verification

The connected browser was subsequently opened on the authenticated Chisolm Audio provider workspace. The provider identity was visible as **Chisolm Audio**, with the provider navigation and Business Tools available. The session’s `/provider/dashboard` route initially redirected to `/my-bookings`, but the authenticated workspace exposed the provider navigation and `/provider/tools` after the provider context was available.

The following provider settings labels and controls were verified read-only in `/provider/tools` under **Pricing & payments**:

- `Pay at Location`
- `Accept Pay at Location`
- `Customer instructions`
- `Eligible services`
- `Save Pay-at-Location settings`

Chisolm Audio showed two available services for review: **Church Sound Consultation** and **Audio Enhancement**. The Pay-at-Location switch was not enabled, no service checkbox was changed, and the Save button was not pressed.

The following payment-action labels remain **not verified** because Chisolm Audio has no offline payment obligation and the review did not open a booking with an offline payment record:

- `Mark as Paid`
- `Waive`

The connected browser view did not expose a reliable mobile viewport dimension in its own capture. The owner then supplied five authenticated Chisolm Audio iPhone screenshots from the live provider workspace (`IMG_0036.png` through `IMG_0039.png`). The screenshots are 1179 × 2556 pixels and show the provider mobile layout at the relevant settings states.

The supplied screenshots verify:

- Provider mode and the Business Tools workspace are visible.
- Pricing & payments expands correctly.
- Pay at Location is clearly labeled.
- Accept Pay at Location is visibly disabled.
- Customer instructions is readable and usable.
- Eligible services are presented as separate selectable rows.
- Church Sound Consultation, Audio Enhancement, A1, and A2 are visible without clipping.
- Save Pay-at-Location settings is fully visible above the sticky bottom navigation.
- No horizontal overflow, overlapping controls, or inaccessible settings controls are apparent.

No role switch, provider activation, setting save, payment confirmation, waiver, or test record creation was attempted. This completes the provider settings mobile review; Mark as Paid and Waive remain unverified because no offline payment obligation exists for Chisolm Audio.

The owner also supplied five authenticated landscape screenshots (`IMG_0040.png` through `IMG_0044.png`) at 2556 × 1179 pixels. The Pay-at-Location heading, disabled switch, customer-instructions area, eligible-service rows, and Save button remain readable and inside the content area. The fixed bottom navigation remains visible and does not cover the Pay-at-Location controls shown in the screenshots. In the lower Service options screenshot, the fixed navigation covers part of the card’s lower content while the page is scrolled; this is a general sticky-navigation observation, not a Pay-at-Location control defect. The screenshots provide landscape evidence but do not establish an exact 768px CSS viewport.

The source implementation does contain the expected labels and authorization boundaries, including provider-only settings and provider/admin-only payment confirmation and waiver operations, but source inspection is not a substitute for an authenticated mobile rendering test.

## Final assessment

| Requirement | Result |
|---|---|
| Production feature remains disabled | **PASS** |
| No offline obligations created | **PASS** |
| Help Center mobile layout | **PASS** |
| Provider guide remains unpublished | **PASS** |
| Authenticated provider dashboard and settings labels | **PASS** |
| Provider-dashboard mobile settings review | **PASS — owner-supplied iPhone screenshots** |
| Provider-dashboard landscape review | **PASS — owner-supplied screenshots** |
| Authenticated 768 × 1024 provider settings controls | **PASS — exact Chromium viewport; November 7, 2026 20:49 UTC** |
| Mark as Paid / Waive automated tests | **PASS — see focused release-gate results below** |
| Visual Mark as Paid / Waive on an isolated obligation | **PENDING — automated tests are not visual evidence** |
| Stripe, payout, credential, and incident settings unchanged | **PASS / no action taken** |
| Pilot provider selection or activation | **NOT PERFORMED** |

## Non-production offline-payment release-gate tests

The focused non-production suite was rerun serially after the mobile review:

- `pay-at-location-database.test.ts`: 4 passed
- `pay-at-location-remediation.test.ts`: 5 passed
- `pay-at-location-stage4-preview.contract.test.ts`: 8 passed
- `pay-at-location-stripe-isolation.test.ts`: 4 passed
- `pay-at-location.contract.test.ts`: 3 passed
- **Total: 5 test files, 24 tests passed**

The run covered direct, quote, recurring, and multi-day offline obligations; customer read-only restrictions; provider confirmation; duplicate settlement prevention; waiver authorization and required reasons; complete audit details; audit-failure rollback; disabled-settings history preservation; webhook separation; and negative Stripe side-effect assertions. Test cleanup found no remaining synthetic test accounts. No production offline obligation or provider setting was created.

Vitest reported its existing non-failing close-handle/Vite shutdown warning after the passing tests; it did not produce a test failure.

## Isolated payment-action walkthrough

The database-backed walkthrough was rerun separately for the requested release gate:

- **2 test files passed; 9 tests passed.**
- A synthetic customer could read the obligation but could not confirm it.
- The synthetic provider confirmed a full **$101.00 cash** payment.
- A duplicate confirmation on the settled obligation was rejected.
- A separate synthetic obligation was waived for **$202.00** with a mandatory reason.
- Confirmation and waiver audit entries recorded the amount, resulting status, payment/waiver details, timestamp, and authorizing actor.
- Disabling provider Pay-at-Location settings did not remove the existing offline history.
- Test cleanup completed without leaving synthetic accounts or obligations.

This verifies the payment-action and audit behavior in the isolated database-backed test environment. No visual payment-action walkthrough was performed against a production or Chisolm Audio booking, and no production offline obligation was created.

## Exact authenticated tablet controls

The November 7, 2026 final tablet review used the owner's authenticated Chisolm Audio provider workspace on the published application, in a sandbox Chromium viewport measured at exactly **768 × 1024 CSS pixels**. Authentication and provider association were confirmed through read-only application queries, not mocked UI data. The screenshot includes the expanded Pricing & payments heading, Pay at Location, disabled Accept Pay at Location switch, empty customer instructions, all four unchecked services, and the visible Save button. All reviewed controls fit within the viewport; document content and scroll widths both measured 753px, with no horizontal overflow. This is responsive Chromium evidence, not native iPad/Safari emulation.

Only accordion expansion and scrolling were performed. Non-GET requests were blocked during capture, Save was not pressed, and no setting or obligation was created. Read-only production checks confirmed zero provider settings, zero enabled providers, zero eligibility rows, and zero offline obligations; protected provider connection/status fields remained unchanged. No financial or incident configuration was modified. The provider guide remains unpublished.

Full scoped evidence and limitations are recorded in `docs/ologycrew-authenticated-tablet-controls-verification-2026-11-07.md`; the screenshot and machine-readable measurements are under `/home/ubuntu/verification/ologycrew-tablet-2026-11-07/`.

## Recommended next step

Complete the visual Mark as Paid and Waive walkthrough on separate isolated non-production obligations, including audit records. Then present the provider guide for owner review before any guide publication. Keep production Pay-at-Location disabled; pilot selection and activation remain separate owner approvals.
