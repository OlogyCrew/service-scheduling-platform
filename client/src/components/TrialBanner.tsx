import { useState } from "react";
import { Clock, Zap, ArrowRight, X, Sparkles, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ALL_TRIALS_PAUSED, PLATFORM_SUBSCRIPTIONS_PAUSED } from "@shared/providerPaymentPause";
import { TrialReviewNotice } from "./TrialReviewNotice";

/**
 * TrialCountdownBanner — Shows during active Pro trial.
 * Displays days remaining, features unlocked, and upgrade CTA.
 * Becomes urgent (red) when <= 3 days remain.
 */
export function TrialCountdownBanner({
  daysRemaining,
  trialEndsAt,
  showUrgentNudge,
}: {
  daysRemaining: number;
  trialEndsAt: string | Date | null;
  showUrgentNudge?: boolean;
}) {
  const [, navigate] = useLocation();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;
  if (ALL_TRIALS_PAUSED || PLATFORM_SUBSCRIPTIONS_PAUSED) return <TrialReviewNotice />;

  const isUrgent = showUrgentNudge || daysRemaining <= 3;
  const endDate = trialEndsAt
    ? new Date(trialEndsAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : null;

  return (
    <div
      className={`relative rounded-lg border px-4 py-3 mb-4 ${
        isUrgent
          ? "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800"
          : "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800"
      }`}
    >
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground p-1"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <div
          className={`mt-0.5 rounded-full p-1.5 ${
            isUrgent
              ? "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400"
              : "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400"
          }`}
        >
          {isUrgent ? <AlertTriangle className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">
              {isUrgent
                ? `Only ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} left on your trial!`
                : `Pro Trial — ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining`}
            </span>
            <span
              className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                isUrgent
                  ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                  : "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
              }`}
            >
              <Clock className="h-3 w-3" />
              {endDate ? `Ends ${endDate}` : "Trial active"}
            </span>
          </div>

          <p className="text-xs text-muted-foreground mt-1">
            {isUrgent
              ? "Don't lose access to 5 categories, 10 services, priority search, analytics, and custom URL. Subscribe now to keep your Pro features."
              : "You have access to 5 categories, 10 services, priority search placement, analytics, and custom profile URL during your trial."}
          </p>

          <div className="flex items-center gap-2 mt-2">
            <Button
              size="sm"
              variant={isUrgent ? "destructive" : "default"}
              className="h-7 text-xs"
              onClick={() => navigate("/provider/subscription")}
            >
              <Zap className="h-3 w-3 mr-1" />
              {isUrgent ? "Subscribe Now" : "Upgrade to Keep Features"}
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * TrialExpiredBanner — Shows after trial has ended and provider is back on Free.
 * Encourages conversion with a clear value proposition.
 */
export function TrialExpiredBanner() {
  const [, navigate] = useLocation();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;
  if (ALL_TRIALS_PAUSED || PLATFORM_SUBSCRIPTIONS_PAUSED) return <TrialReviewNotice expired />;

  return (
    <div className="relative rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-3 mb-4">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground p-1"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <div className="mt-0.5 rounded-full p-1.5 bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0">
          <span className="font-semibold text-sm">Your Pro trial has ended</span>
          <p className="text-xs text-muted-foreground mt-1">
            You're back on the Starter plan (1 category, 3 services). Upgrade to Pro to restore 5 categories,
            10 service listings, priority search placement, analytics, and your custom profile URL.
          </p>

          <div className="flex items-center gap-2 mt-2">
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={() => navigate("/provider/subscription")}
            >
              <Zap className="h-3 w-3 mr-1" />
              Upgrade to Pro — $12/mo
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * TrialExpiredGate — Full-page blocking overlay when trial has expired.
 * Provider must either add a payment method to continue or downgrade to Free.
 * This is NOT dismissable — it blocks access to provider features.
 */
export function TrialExpiredGate({ onDowngrade }: { onDowngrade?: () => void }) {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const downgrade = trpc.subscription.downgrade.useMutation({
    onSuccess: async (data) => {
      toast.success(data.message || "You're continuing with Starter (Free).");
      await Promise.all([
        utils.subscription.mySubscription.invalidate(),
        utils.subscription.checkTrialStatus.invalidate(),
      ]);
      onDowngrade?.();
    },
    onError: (error) => toast.error(error.message || "We couldn't continue with Starter. Please try again."),
  });

  // Preserve backend access limits without trapping users behind paused billing.
  if (ALL_TRIALS_PAUSED || PLATFORM_SUBSCRIPTIONS_PAUSED) return <TrialReviewNotice expired />;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-card border rounded-xl shadow-2xl p-8 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto">
          <AlertTriangle className="h-8 w-8 text-amber-600" />
        </div>

        <div>
          <h2 className="text-2xl font-bold">Your 14-Day Trial Has Ended</h2>
          <p className="text-muted-foreground mt-2">
            Your free trial of Pro features has expired. To continue using premium features like
            multiple categories, priority search, analytics, and custom URLs, please subscribe to a plan.
          </p>
        </div>

        <div className="space-y-3">
          <Button
            size="lg"
            className="w-full"
            onClick={() => navigate("/provider/subscription")}
            aria-label="View provider subscription plans"
          >
            <Zap className="h-4 w-4 mr-2" />
            Subscribe to Continue — Starting at $12/mo
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={() => downgrade.mutate({ targetTier: "free" })}
            disabled={downgrade.isPending}
            aria-label="Continue with Starter plan"
          >
            {downgrade.isPending ? "Downgrading..." : "Continue with Free Plan (Limited Features)"}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Free plan includes: 1 category, up to 3 services, basic profile, and booking management.
        </p>
      </div>
    </div>
  );
}

/**
 * TrialStatusBanner — Auto-selects the right banner based on trial status.
 * Use this in the Provider Dashboard for a single integration point.
 */
export function TrialStatusBanner() {
  const { data: trialStatus } = trpc.subscription.checkTrialStatus.useQuery(undefined, {
    staleTime: 60_000,
  });

  if (!trialStatus) return null;

  if (trialStatus.isTrialing) {
    return (
      <TrialCountdownBanner
        daysRemaining={trialStatus.daysRemaining}
        trialEndsAt={trialStatus.trialEndsAt}
        showUrgentNudge={trialStatus.showUrgentNudge}
      />
    );
  }

  if (trialStatus.trialExpired) {
    return <TrialExpiredGate />;
  }

  return null;
}
