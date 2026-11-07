# OlogyCrew — Isolated Pay-at-Location Walkthrough Report

**Date:** November 7, 2026  
**Source baseline:** `ea614d82635181e0026a23d4e80630b3b4d946e5`  
**Decision:** **VISUAL RELEASE GATE BLOCKED — do not publish the provider guide or activate a pilot on this evidence.**  
**Production application, database, Stripe, protected accounts and incident restrictions:** No changes or production-data access during this walkthrough.

## Executive assessment

The mandatory database-isolation gate passed before any synthetic records were created. Real local email/password authentication, actual OlogyCrew HTTP endpoints and a separate MariaDB database verified a \$101 cash confirmation, a separate \$202 waiver, complete transactionally recorded audits, authorization denials, duplicate prevention and rollback on audit-write failure.

However, the actual client has **no provider-facing Mark as Paid or Waive controls connected to these endpoints**. The provider booking-detail page reads the online payment ledger rather than the offline ledger and continues to show **“No payment recorded yet”** after the synthetic offline obligations have been settled. The customer page shows Paid/Waived but still labels the original amount as **“Amount due”** and displays **“Booking Confirmed — Payment Required.”**

These are genuine interface findings, not reasons to alter Stripe architecture. No replacement UI, mock settlement screen or fabricated click-through demonstration was created. The successful confirmation and waiver were **API actions**, not provider-button actions. The requested visual action walkthrough therefore **has not passed**.

## 1. Mandatory isolation gate — PASS

| Requirement | Evidence |
|---|---|
| Separate database instance | MariaDB `10.11.14-MariaDB-0ubuntu0.24.04.1`; its own directory `/tmp/ologycrew-offline-visual-20261107/data/` |
| Explicit connection target | Host `127.0.0.1`, port `3317`, database `ologycrew_offline_visual_20261107`; local principal `offline_visual` |
| Separate application copy | `/home/ubuntu/verification/ologycrew-isolated-walkthrough-2026-11-07/app`; application source copied without environment files, production data, incident documents or backups |
| Separate network boundary | Test network namespace `net:[4026532144]`; shared sandbox namespace `net:[4026531833]`; only loopback, no default route |
| No production network reachability | Attempt to reach the published website from this namespace failed as expected; the isolated app was also unreachable from the shared namespace |
| Empty database before seed | 66 application tables exported from source schema only; every base table empty before synthetic fixture creation; no database events or triggers |
| No production credentials | Child environments constructed from an explicit allowlist; no inherited Stripe, webhook, SendGrid, Twilio, AWS, Forge or owner-identity credentials |
| No connected accounts | Synthetic providers have null Stripe account IDs, `not_connected`, payouts disabled and `isOfficial=false`; synthetic Stripe Customer IDs are null |
| No production webhook or notification service | Application startup/scheduler module not imported; webhook routes absent; no scheduled jobs started; notification credentials absent |

The UI application required an **inert, unusable test placeholder**, not a Stripe credential, for modules that construct SDK clients at import time. Its Stripe resource request function was additionally replaced in the harness with a fail-closed recorder. It recorded **zero SDK requests**. The separate HTTP integrity harness did not import the full payment router or construct Stripe clients and used **no Stripe key at all**. The OS network boundary prevented external access in both cases.

The first HTTP browser-login attempt did not retain the application's unchanged secure cookie on the plain-HTTP test origin. The isolated application was changed to **localhost HTTPS using a freshly generated disposable certificate**, not by altering product authentication code or inventing a session. Subsequent browser authentication used the actual login form, returned session cookie and `auth.me` checks.

Source-schema export contained five automatically named foreign-key constraints longer than MariaDB's identifier limit. Only those names were replaced by deterministic short aliases in the **disposable schema**; relationships and columns were unchanged. The alias list is included in the evidence bundle. No production schema or migration was changed or applied. This is MariaDB-based isolation evidence, not a new TiDB production-compatibility certification.

## 2. Synthetic identities and fixture provenance

All IDs below belong **only to the isolated database**. In particular, isolated user/provider ID 1 is not production Gary Chisolm or Chisolm Audio.

| Identity | Local user ID | Role | Associated provider ID |
|---|---:|---|---:|
| Synthetic Owner | 1 | provider, not admin | 1 — Synthetic Offline Walkthrough Lab |
| Synthetic Customer | 2 | customer | None |
| Synthetic Unrelated | 3 | provider, not admin | 2 — Synthetic Unrelated Walkthrough Lab |
| Synthetic Administrator | 4 | admin | None |

Addresses use `example.invalid`. Fresh passwords were created locally, hashed with bcrypt and never printed or included in delivery. Both associated and unrelated provider roles use the actual schema's `provider` enum. The schema does not support a literal `user` role. The synthetic administrator's clearance was verified only in the separate test-mode harness, using the existing test allowlist; **no admin settlement demonstration is claimed**. Valid settlement was performed as the associated **non-admin provider**, with the unrelated provider rejected.

Exactly two confirmed appointments were created by direct isolated-only inserts to avoid notification/registration hooks:

| Booking | Local booking ID | Original obligation | Initial status |
|---|---:|---:|---|
| `OC-SYN-20261107-PAID` | 1 | \$101.00 | Due |
| `OC-SYN-20261107-WAIVED` | 2 | \$202.00 | Due |

A third **cancelled**, separate synthetic booking/obligation, `OC-SYN-20261107-ROLLBACK`, local ID 3, original amount \$303.00, was used only for transaction-failure probes. It was not another confirmed appointment. It remained Due with no settlement audit.

No historical booking, customer, provider, payment, connected account, incident record or protected owner account was imported or accessed. No paid subscription was fabricated.

## 3. Actual execution results

| Execution | Actual result | Evidence scope |
|---|---|---|
| Isolation gate and empty-table checks | PASS | Separate DB instance, network and scrubbed processes |
| Real HTTP preflight | **9/9 check groups PASS** | Authentication, customer/unrelated-provider denials, reasons, full amounts, real audit-write rollback |
| Real HTTP complete API walkthrough | **13/13 check groups PASS** | Repeats preflight, performs valid Paid/Waived actions, verifies audits/duplicates/history and disables synthetic settings |
| Authenticated browser review | Captured before and after, provider and customer | Actual unchanged client at 768 × 1024 CSS pixels |
| Provider visual Mark as Paid/Waive action | **BLOCKED** | Real controls are absent; no substitute screens/buttons used |
| Stripe financial action isolation | PASS for this run | No gateway SDK calls, payment rows, Stripe IDs, webhook destinations or external network access |

The 9-check preflight overlaps with the 13-check full execution; these are **not 22 distinct regression tests**. These scripts used real HTTP requests and the real database, not mocked settlement helpers. No application source changed, so a new full product regression run was not performed against a shared database. Earlier Vitest results remain historical evidence and are not substituted for this independent isolation run.

### Authorization and negative checks

- Every synthetic account authenticated through the actual `/api/auth/login` route and normal `auth.me` procedure. Safe auth responses did not expose password hashes.
- The customer could read the obligation but both confirmation and waiver returned `FORBIDDEN`.
- The unrelated provider could neither read nor settle the associated provider's obligations; responses were `FORBIDDEN`.
- Missing, empty and whitespace-only waiver reasons returned `BAD_REQUEST` with ledger/audit snapshots unchanged.
- \$100 confirmation against a \$101 obligation and \$201 waiver against a \$202 obligation were rejected as non-full settlement.
- Duplicate confirmation, duplicate waiver and Paid-to-Waived / Waived-to-Paid requests were rejected with no extra audit entries or state changes.
- Disabling the synthetic provider through the real settings endpoint removed its service eligibility but preserved all three obligations and both settlement audits. Owner and customer could still read the history.

### Transaction and audit-write rollback — PASS

A temporary `BEFORE INSERT` audit trigger existed only in the isolated database and only targeted the \$303 synthetic rollback booking's settlement actions. It demonstrably raised SQLSTATE `45000`. Both real confirmation and waiver requests then failed. Complete before/after ledger and audit snapshots were identical: the obligation remained Due, received/waiver amounts remained zero, settlement actors/timestamps remained null and no audit entry was committed.

The trigger was removed in `finally`; the final database contained **zero triggers**. The application settlement helper commits its conditional update and audit insert inside the **same database transaction**. The successful endpoint reads and independent committed-row queries verified the durable outcomes below. This is practical transaction/rollback evidence, not a claim of a distributed financial transaction with Stripe.

## 4. Test A — \$101 cash confirmation (API evidence, not a visual action)

The associated provider invoked the existing `offlinePayment.confirmPayment` endpoint with \$101.00, `cash` and the note **“Synthetic local cash receipt at appointment.”**

| Field | Committed value |
|---|---|
| Booking / obligation ID | 1 / 1, isolated database only |
| Original amount due | \$101.00, preserved |
| Amount received | \$101.00 |
| Offline method | cash |
| Resulting status | paid |
| Confirming actor | Synthetic Owner, local user ID 1 |
| Ledger confirmation time | November 7, 2026 21:08:23 UTC |
| Audit ID / action | 1 / `confirm_pay_at_location_payment` |

Complete audit details:

```json
{
  "originalAmountDue": "101.00",
  "amountReceived": "101.00",
  "resultingStatus": "paid",
  "offlinePaymentMethod": "cash",
  "paymentNote": "Synthetic local cash receipt at appointment",
  "confirmedAt": "2026-11-07T21:08:23.922Z",
  "confirmingActorId": 1
}
```

The audit row separately records actor ID 1, target type `booking`, target ID 1 and creation timestamp `2026-11-07 21:08:23` UTC. The complete raw ledger/audit row export accompanies this report.

## 5. Test B — \$202 full waiver (API evidence, not a visual action)

The associated provider invoked `offlinePayment.waivePayment` for a full \$202.00 with the reason **“Synthetic local approved service recovery waiver.”**

| Field | Committed value |
|---|---|
| Booking / obligation ID | 2 / 2, isolated database only |
| Original amount due | \$202.00, preserved |
| Waiver amount | \$202.00 |
| Amount received | \$0.00 |
| Resulting status | waived |
| Authorizing actor | Synthetic Owner, local user ID 1 |
| Ledger waiver time | November 7, 2026 21:08:23 UTC |
| Audit ID / action | 2 / `waive_pay_at_location_payment` |

Complete audit details:

```json
{
  "originalAmountDue": "202.00",
  "waiverAmount": "202.00",
  "waiverReason": "Synthetic local approved service recovery waiver",
  "resultingStatus": "waived",
  "waivedAt": "2026-11-07T21:08:23.946Z",
  "authorizingActorId": 1
}
```

The audit row separately records actor ID 1, target type `booking`, target ID 2 and creation timestamp `2026-11-07 21:08:23` UTC. No payment method or receipt is asserted for a waiver because no money was received.

## 6. Visual findings and release blockers

### V1 — Settlement controls absent: BLOCKED

A full client source search returned zero uses of `offlinePayment.confirmPayment`, zero uses of `offlinePayment.waivePayment` and no offline **Mark as Paid** control. Actual authenticated provider booking-detail captures also showed zero Mark as Paid/Waive buttons. Unrelated invoice-payment controls were not substituted.

Relevant code: `client/src/pages/BookingDetail.tsx:760–811`; `server/routers/offlinePaymentRouter.ts` contains the backend endpoints.

**Required correction:** Wire actual authorized provider/admin offline settlement forms to the existing endpoints, including fixed full amount, payment method/note, mandatory waiver reason, pending/error states and refresh of committed payment/audit status. Customers must remain read-only. This work was **not implemented** during this verification-only task.

### V2 — Provider details omit offline history: FAIL

`booking.getDetail` reads `getPaymentByBookingId` from the online `payments` ledger. The provider UI therefore displays **“No payment recorded yet”** for both settled offline obligations.

Relevant code: `server/routers/bookingRouter.ts:308–333`; `client/src/pages/BookingDetail.tsx:760–811`.

**Required correction:** Return and render the distinct offline obligation, original amount, outstanding balance, settlement method/reason, actor and timestamp. Do not merge it into the Stripe ledger.

![Actual isolated provider details after the \$101 API confirmation; offline history is not displayed](/home/ubuntu/verification/ologycrew-isolated-walkthrough-2026-11-07/evidence/provider-paid-detail-after.png)

### V3 — Settled customer amounts still described as due: FAIL

The read-only customer card correctly shows Paid or Waived but unconditionally renders `originalAmountDue` as **“Amount due.”** The main confirmed-booking headline still says **“Payment Required”** and requests payment to secure the appointment.

Relevant code: `client/src/pages/BookingConfirmation.tsx:237–246` and the existing confirmed-booking/payment presentation.

**Required correction:** Preserve and label the original agreed amount as historical; display current outstanding balance separately (\$0 after full payment/waiver), appropriate offline status/instructions, and no contradictory online-payment prompts for an offline booking. Existing backend online-checkout rejection for offline obligations remains important and must be retained.

![Actual isolated customer Paid status after API confirmation; amount due and payment-required text remain misleading](/home/ubuntu/verification/ologycrew-isolated-walkthrough-2026-11-07/evidence/customer-paid-status-after.png)

![Actual isolated customer Waived status after API waiver; amount due and payment-required text remain misleading](/home/ubuntu/verification/ologycrew-isolated-walkthrough-2026-11-07/evidence/customer-waived-status-after.png)

### Capture limitations

All eight screenshots are actual application captures at **768 × 1024**, DPR 1, with document width 768 and no horizontal overflow. They show backend outcomes and current interface defects, **not clicks on missing controls**. This does not reopen the separately passed responsive settings review.

The unchanged client displays its generic preview/shared-data warning and an offline indicator. Those generic banners are **not the connection evidence** for this run: separate database/process/network evidence establishes the actual synthetic target. External fonts/assets/device telemetry were blocked by the browser guard and network namespace, so some branding assets are unavailable. Each before/after browser execution recorded eight `WebSocket closed without opened` errors associated with the disabled dev-server websocket; no settlement UI render failure is inferred from these expected harness limitations.

## 7. Final isolated counts and teardown

| Object | Initial empty DB | After seed | Final preserved state |
|---|---:|---:|---:|
| Users | 0 | 4 | 4 |
| Providers | 0 | 2 | 2 |
| Services | 0 | 4 | 4 |
| Bookings | 0 | 3 | 3 |
| Offline obligations | 0 | 3 | 3: Paid \$101, Waived \$202, Due \$303 rollback fixture |
| Online payment rows | 0 | 0 | 0 |
| Audit rows | 0 | 0 | 3: confirmation, waiver, settings disable |
| Provider settings rows | 0 | 2 | 2, both disabled |
| Eligible-service rows | 0 | 3 | 0 |
| Enabled providers | 0 | 1, synthetic only | 0 |
| DB triggers / scheduled events | 0 / 0 | 0 / 0 | 0 / 0 |

No Stripe financial action, real account ID, notification record or production financial record was created. Synthetic categories and relationships were local-only and do not change the platform's service-category taxonomy.

The isolated application and MariaDB were shut down; listeners on 3107/3317 closed; the separate namespace holder was stopped. Fresh synthetic plaintext passwords, local JWT secret and local TLS key/certificate were removed. **No synthetic ledger or audit rows were deleted:** the stopped disposable DB is retained offline and sanitized committed-row evidence is delivered. Its private data files include only synthetic data; they are not part of the public evidence bundle. No production cleanup was necessary or attempted.

All current-operation claims apply to the isolated instance. Production was not queried again during this walkthrough, in accordance with the no-production-access boundary. No activation/save/pilot selection, migration, application change, publication, banking action, credential rotation or incident-restriction change occurred.

## 8. Evidence delivery and next decision

The evidence bundle includes the source audit/hash baseline, pre-seed isolation metadata, process/network gate, complete synthetic payment and audit records, all before/after screenshots and measurements, 9-check preflight and 13-check complete HTTP reports, schema constraint aliases, cleanup confirmation and the preparation scripts. It deliberately excludes passwords, hashes, session cookies, JWT/TLS secrets, production data and the synthetic DB's private data files.

**Recommended next step:** approve a narrowly scoped, **unpublished UI remediation** for V1–V3, then repeat the same isolated visual gate using the genuine buttons and inspect both committed audits. No further changes to Stripe architecture or the offline ledger are indicated by these tests. Keep the provider guide unpublished and pilot activation subject to separate owner approval.

**This checkpoint is documentation/evidence only. It does not authorize deployment, provider activation or guide publication.**
