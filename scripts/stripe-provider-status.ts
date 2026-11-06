#!/usr/bin/env tsx

/**
 * Read-only Stripe Connect/provider status report.
 *
 * Safety properties:
 * - Reads only local provider rows and Stripe Account/Balance objects.
 * - Never creates payouts, changes payout schedules, mutates accounts, or writes to the database.
 * - Never prints API keys, account secrets, or full payment-method data.
 * - Exits non-zero with --fail-on-issues when any account needs review.
 *
 * Required environment variables:
 *   DATABASE_URL
 *   STRIPE_SECRET_KEY
 *
 * Examples:
 *   pnpm stripe:provider-status
 *   pnpm stripe:provider-status -- --fail-on-issues
 *   pnpm stripe:provider-status -- --csv
 *   pnpm stripe:provider-status -- --allow-test
 */

import Stripe from "stripe";
import mysql from "mysql2/promise";

const args = new Set(process.argv.slice(2));
const csv = args.has("--csv");
const failOnIssues = args.has("--fail-on-issues");
const allowTest = args.has("--allow-test");

const databaseUrl = process.env.DATABASE_URL;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!databaseUrl) throw new Error("DATABASE_URL is required");
if (!stripeSecretKey) throw new Error("STRIPE_SECRET_KEY is required");
if (!stripeSecretKey.startsWith("sk_live_") && !(allowTest && stripeSecretKey.startsWith("sk_test_"))) {
  throw new Error("Refusing to run: use a live STRIPE_SECRET_KEY, or pass --allow-test explicitly for test mode.");
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2026-01-28.clover" as any,
  maxNetworkRetries: 2,
  timeout: 15_000,
});

const pool = mysql.createPool({
  uri: databaseUrl,
  connectionLimit: 3,
  enableKeepAlive: true,
});

type LocalProvider = {
  providerId: number;
  userName: string | null;
  businessName: string;
  stripeAccountId: string;
  providerActive: number;
  payoutEnabled: number;
  stripeAccountStatus: string;
  serviceCount: number;
  activeServiceCount: number;
};

type ReportRow = {
  providerId: number;
  userName: string | null;
  businessName: string;
  stripeAccountId: string;
  local: {
    providerActive: boolean;
    payoutEnabled: boolean;
    stripeAccountStatus: string;
    serviceCount: number;
    activeServiceCount: number;
  };
  stripe?: {
    livemode: boolean;
    type: string | null;
    detailsSubmitted: boolean;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    disabledReason: string | null;
    currentlyDue: string[];
    pastDue: string[];
    eventuallyDue: string[];
    capabilities: Record<string, string>;
    payoutSchedule: { interval: string | null; delayDays: number | null };
    balance: {
      available: number;
      pending: number;
      currency: string;
    };
  };
  issues: string[];
  error?: string;
};

function moneyAmount(amount: number, currency: string): number {
  return currency.toLowerCase() === "jpy" ? amount : amount / 100;
}

function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function printCsv(rows: ReportRow[]): void {
  const headers = [
    "provider_id",
    "business_name",
    "user_name",
    "stripe_account_id",
    "local_provider_active",
    "local_payout_enabled",
    "local_stripe_status",
    "active_services",
    "stripe_livemode",
    "stripe_details_submitted",
    "stripe_charges_enabled",
    "stripe_payouts_enabled",
    "stripe_disabled_reason",
    "stripe_currently_due_count",
    "stripe_past_due_count",
    "stripe_eventually_due_count",
    "stripe_balance_available",
    "stripe_balance_pending",
    "issues",
    "error",
  ];
  console.log(headers.join(","));
  for (const row of rows) {
    const values = [
      row.providerId,
      row.businessName,
      row.userName,
      row.stripeAccountId,
      row.local.providerActive,
      row.local.payoutEnabled,
      row.local.stripeAccountStatus,
      row.local.activeServiceCount,
      row.stripe?.livemode,
      row.stripe?.detailsSubmitted,
      row.stripe?.chargesEnabled,
      row.stripe?.payoutsEnabled,
      row.stripe?.disabledReason,
      row.stripe?.currentlyDue.length,
      row.stripe?.pastDue.length,
      row.stripe?.eventuallyDue.length,
      row.stripe?.balance.available,
      row.stripe?.balance.pending,
      row.issues.join(" | "),
      row.error,
    ];
    console.log(values.map(csvCell).join(","));
  }
}

async function main(): Promise<void> {
  const [providers] = await pool.query<mysql.RowDataPacket[]>(`
    SELECT
      sp.id AS providerId,
      u.name AS userName,
      sp.businessName,
      sp.stripeAccountId,
      sp.isActive AS providerActive,
      sp.payoutEnabled,
      sp.stripeAccountStatus,
      COUNT(s.id) AS serviceCount,
      SUM(CASE WHEN s.isActive = 1 AND s.deletedAt IS NULL THEN 1 ELSE 0 END) AS activeServiceCount
    FROM service_providers sp
    JOIN users u ON u.id = sp.userId
    LEFT JOIN services s ON s.providerId = sp.id
    WHERE COALESCE(sp.isOfficial, 0) = 0
      AND sp.isActive = 1
      AND sp.deletedAt IS NULL
      AND sp.stripeAccountId IS NOT NULL
      AND TRIM(sp.stripeAccountId) <> ''
    GROUP BY
      sp.id, u.name, sp.businessName, sp.stripeAccountId,
      sp.isActive, sp.payoutEnabled, sp.stripeAccountStatus
    ORDER BY sp.id
  `);

  const rows: ReportRow[] = [];
  for (const provider of providers as unknown as LocalProvider[]) {
    const row: ReportRow = {
      providerId: Number(provider.providerId),
      userName: provider.userName,
      businessName: provider.businessName,
      stripeAccountId: provider.stripeAccountId,
      local: {
        providerActive: Boolean(Number(provider.providerActive)),
        payoutEnabled: Boolean(Number(provider.payoutEnabled)),
        stripeAccountStatus: provider.stripeAccountStatus,
        serviceCount: Number(provider.serviceCount),
        activeServiceCount: Number(provider.activeServiceCount),
      },
      issues: [],
    };

    try {
      const account = await stripe.accounts.retrieve(row.stripeAccountId);
      const balance = await stripe.balance.retrieve({}, { stripeAccount: row.stripeAccountId });
      const currency = balance.available[0]?.currency ?? balance.pending[0]?.currency ?? "usd";
      const available = balance.available.reduce((sum, item) => sum + moneyAmount(item.amount, item.currency), 0);
      const pending = balance.pending.reduce((sum, item) => sum + moneyAmount(item.amount, item.currency), 0);
      const capabilities = Object.fromEntries(
        Object.entries(account.capabilities ?? {}).map(([key, value]) => [key, String(value)])
      );
      const requirements = account.requirements;

      row.stripe = {
        livemode: stripeSecretKey.startsWith("sk_live_"),
        type: account.type ?? null,
        detailsSubmitted: Boolean(account.details_submitted),
        chargesEnabled: Boolean(account.charges_enabled),
        payoutsEnabled: Boolean(account.payouts_enabled),
        disabledReason: requirements?.disabled_reason ?? null,
        currentlyDue: requirements?.currently_due ?? [],
        pastDue: requirements?.past_due ?? [],
        eventuallyDue: requirements?.eventually_due ?? [],
        capabilities,
        payoutSchedule: {
          interval: account.settings?.payouts?.schedule?.interval ?? null,
          delayDays: account.settings?.payouts?.schedule?.delay_days ?? null,
        },
        balance: { available, pending, currency },
      };

      if (row.local.payoutEnabled && !row.stripe.payoutsEnabled) {
        row.issues.push("local payout flag says enabled but Stripe payouts are disabled");
      }
      if (row.stripe.currentlyDue.length > 0 || row.stripe.pastDue.length > 0) {
        row.issues.push("Stripe requirements are due or past due");
      }
      if (row.stripe.disabledReason) row.issues.push(`Stripe disabled reason: ${row.stripe.disabledReason}`);
      if (!row.stripe.chargesEnabled) row.issues.push("Stripe charges are not enabled");
      if (!row.stripe.payoutsEnabled) row.issues.push("Stripe payouts are not enabled");
    } catch (error) {
      row.error = error instanceof Error ? error.message.replaceAll(stripeSecretKey, "[REDACTED]") : "Stripe lookup failed";
      row.issues.push("Stripe lookup failed");
    }

    rows.push(row);
  }

  if (csv) printCsv(rows);
  else console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    readOnly: true,
    providerCount: rows.length,
    issueCount: rows.filter((row) => row.issues.length > 0).length,
    rows,
  }, null, 2));

  await pool.end();
  if (failOnIssues && rows.some((row) => row.issues.length > 0)) process.exitCode = 2;
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : "Status check failed");
  await pool.end();
  process.exitCode = 1;
});
