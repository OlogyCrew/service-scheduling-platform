import { Link } from "wouter";
import { ALL_TRIAL_PAUSE_MESSAGE } from "@shared/providerPaymentPause";

/** Informational only: no billing mutation or forced downgrade during review. */
export function TrialReviewNotice({ customer = false, expired = false }: { customer?: boolean; expired?: boolean }) {
  return (
    <div role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
      <p className="font-semibold">{expired ? "Your recorded trial has ended" : "Trials and paid upgrades are paused"}</p>
      <p className="mt-1">{ALL_TRIAL_PAUSE_MESSAGE} Existing dates and subscription history are preserved. Available features still follow the recorded access dates; no payment or downgrade is required to dismiss this notice.</p>
      <Link href={customer ? "/customer/subscription" : "/provider/subscription"} className="mt-2 inline-block underline underline-offset-2">View subscription record</Link>
    </div>
  );
}
