import { useState } from "react";
import { Clock, Zap, ArrowRight, X, Sparkles, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ALL_TRIALS_PAUSED, PLATFORM_SUBSCRIPTIONS_PAUSED } from "@shared/providerPaymentPause";
import { TrialReviewNotice } from "./TrialReviewNotice";

/**
 * CustomerTrialCountdownBanner — Shows during active customer trial.
 * Displays days remaining, features unlocked, and upgrade CTA.
 * Becomes urgent (red) when <= 3 days remain.
 */
export function CustomerTrialCountdownBanner({
  daysRemaining,
  trialEndsAt,
  showUrgentNudge,
  tierName,
}: {
  daysRemaining: number;
  trialEndsAt: string | Date | null;
  showUrgentNudge?: boolean;
  tierName?: string;
}) {
  const [, navigate] = useLocation();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;
  if (ALL_TRIALS_PAUSED || PLATFORM_SUBSCRIPTIONS_PAUSED) return <TrialReviewNotice customer />;

  const isUrgent = showUrgentNudge || daysRemaining <= 3;
  const endDate = trialEndsAt
    ? new Date(trialEndsAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : null;

  const planLabel = tierName || "Coordinator";
  const trialBenefits = planLabel === "Manager"
    ? "unlimited saved providers, folders, bulk quote requests, analytics, and booking exports"
    : "up to 50 saved providers, priority booking requests, and provider folders";

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
                : `${planLabel} Trial — ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining`}
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
              ? `Don't lose access to ${trialBenefits}. Subscribe now to keep your features.`
              : `Your ${planLabel} trial includes ${trialBenefits}.`}
          </p>

          <div className="flex items-center gap-2 mt-2">
            <Button
              size="sm"
              variant={isUrgent ? "destructive" : "default"}
              className="h-7 text-xs"
              onClick={() => navigate("/customer/subscription")}
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
 * CustomerTrialExpiredGate — Full-page blocking overlay when customer trial has expired.
 * Customer must either subscribe or downgrade to Individual (free).
 * This is NOT dismissable — it blocks access to premium customer features.
 */
export function CustomerTrialExpiredGate({ onDowngrade }: { onDowngrade?: () => void }) {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const downgrade = trpc.customerSubscription.downgrade.useMutation({
    onSuccess: async (data) => {
      toast.success(data.message || "You're continuing with the Individual plan.");
      await Promise.all([
        utils.customerSubscription.getSubscription.invalidate(),
        utils.customerSubscription.checkTrialStatus.invalidate(),
      ]);
      onDowngrade?.();
    },
    onError: (error) => toast.error(error.message || "We couldn't continue with Individual. Please try again."),
  });

  if (ALL_TRIALS_PAUSED || PLATFORM_SUBSCRIPTIONS_PAUSED) return <TrialReviewNotice customer expired />;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-card border rounded-xl shadow-2xl p-8 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto">
          <AlertTriangle className="h-8 w-8 text-amber-600" />
        </div>

        <div>
          <h2 className="text-2xl font-bold">Your 14-Day Trial Has Ended</h2>
          <p className="text-muted-foreground mt-2">
            Your free trial has expired. Subscribe to restore the features included with your selected paid plan, or continue with Individual for core booking and messaging.
          </p>
        </div>

        <div className="space-y-3">
          <Button
            size="lg"
            className="w-full"
            onClick={() => navigate("/customer/subscription")}
            aria-label="View customer subscription plans"
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
            aria-label="Continue with Individual plan"
          >
            {downgrade.isPending ? "Downgrading..." : "Continue with Individual Plan (Limited Features)"}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Individual plan includes: browse all providers, book services, save up to 5 providers, and basic messaging.
        </p>
      </div>
    </div>
  );
}

/**
 * CustomerTrialStatusBanner — Auto-selects the right banner based on customer trial status.
 * Use this on customer-facing pages that should be gated (SavedProviders, BookingAnalytics).
 */
export function CustomerTrialStatusBanner() {
  const { data: trialStatus } = trpc.customerSubscription.checkTrialStatus.useQuery(undefined, {
    staleTime: 60_000,
  });

  if (!trialStatus) return null;

  const getTierName = (tier: string) => {
    switch (tier) {
      case "business": return "Manager";
      case "pro": return "Coordinator";
      default: return "Individual";
    }
  };

  if (trialStatus.isTrialing) {
    return (
      <CustomerTrialCountdownBanner
        daysRemaining={trialStatus.daysRemaining}
        trialEndsAt={trialStatus.trialEndsAt}
        tierName={getTierName(trialStatus.currentTier)}
        showUrgentNudge={trialStatus.showUrgentNudge}
      />
    );
  }

  if (trialStatus.trialExpired) {
    return <CustomerTrialExpiredGate />;
  }

  return null;
}
