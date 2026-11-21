import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { 
  Check, 
  Crown, 
  Zap, 
  Heart,
  ArrowLeft,
  Loader2,
  BarChart3,
  AlertTriangle,
  Pause,
  Play,
  ShoppingBag,
  Star,
} from "lucide-react";
import { Link } from "wouter";
import { NavHeader } from "@/components/shared/NavHeader";
import "@/components/customer/CustomerWorkspaceTheme.css";
import { formatPrice as formatPriceUtil } from "@shared/formatPrice";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CUSTOMER_PLANS } from "@shared/entitlements";
import { ALL_TRIALS_PAUSED, ALL_TRIAL_PAUSE_MESSAGE, PLATFORM_SUBSCRIPTIONS_PAUSED, PLATFORM_SUBSCRIPTION_PAUSE_MESSAGE } from "@shared/providerPaymentPause";

const PLANS = [
  {
    tier: "free" as const,
    name: CUSTOMER_PLANS.free.name,
    monthlyPrice: CUSTOMER_PLANS.free.monthlyPrice,
    yearlyPrice: CUSTOMER_PLANS.free.yearlyPrice,
    description: "Basic access to browse and book services.",
    icon: Heart,
    features: [
      { text: `Save up to ${CUSTOMER_PLANS.free.savedProviderLimit} providers`, included: true },
      { text: "Book any service", included: true },
      { text: "Message providers", included: true },
      { text: "Leave reviews", included: true },
      { text: "Quote requests", included: true },
      { text: "Priority booking", included: false },
      { text: "Provider folders", included: false },
      { text: "Booking analytics", included: false },
    ],
    highlight: false,
  },
  {
    tier: "pro" as const,
    name: CUSTOMER_PLANS.pro.name,
    monthlyPrice: CUSTOMER_PLANS.pro.monthlyPrice,
    yearlyPrice: CUSTOMER_PLANS.pro.yearlyPrice,
    description: "Enhanced features for frequent users — save more, book faster.",
    icon: Star,
    features: [
      { text: "Free trial (temporarily unavailable)", included: false },
      { text: `Save up to ${CUSTOMER_PLANS.pro.savedProviderLimit} providers`, included: true },
      { text: "Priority booking requests", included: true },
      { text: "Organize providers into folders", included: true },
      { text: "Book any service", included: true },
      { text: "Message providers", included: true },
      { text: "Leave reviews", included: true },
      { text: "Quote requests", included: true },
      { text: "Booking analytics", included: false },
      { text: "Dedicated support", included: false },
    ],
    highlight: true,
  },
  {
    tier: "business" as const,
    name: CUSTOMER_PLANS.business.name,
    monthlyPrice: CUSTOMER_PLANS.business.monthlyPrice,
    yearlyPrice: CUSTOMER_PLANS.business.yearlyPrice,
    description: "Full access with analytics, exports, and unlimited providers.",
    icon: Crown,
    features: [
      { text: "Free trial (temporarily unavailable)", included: false },
      { text: "Unlimited saved providers", included: true },
      { text: "Priority booking requests", included: true },
      { text: "Organize providers into folders", included: true },
      { text: "Bulk quote requests", included: true },
      { text: "Booking analytics & spending reports", included: true },
      { text: "Dedicated support", included: true },
      { text: "Book any service", included: true },
      { text: "Message providers", included: true },
      { text: "Leave reviews", included: true },
    ],
    highlight: false,
  },
];

export default function AccountSubscription() {
  const { isAuthenticated } = useAuth();
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<"month" | "year">("month");

  const { data: subData, isLoading: subLoading } = trpc.customerSubscription.getSubscription.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const subscribe = trpc.customerSubscription.createCheckout.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      } else if (data.message) {
        toast.success(data.message);
        window.location.reload();
      }
      setSubscribing(null);
    },
    onError: (err) => {
      toast.error(err.message);
      setSubscribing(null);
    },
  });

  const [downgradeTarget, setDowngradeTarget] = useState<"free" | "pro" | null>(null);
  const [showDowngradeDialog, setShowDowngradeDialog] = useState(false);
  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const [pauseDuration, setPauseDuration] = useState<"7" | "14" | "30">("30");

  const downgrade = trpc.customerSubscription.downgrade.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setShowDowngradeDialog(false);
      setDowngradeTarget(null);
      window.location.reload();
    },
    onError: (err) => {
      toast.error(err.message);
      setShowDowngradeDialog(false);
      setDowngradeTarget(null);
    },
  });

  const manageSubscription = trpc.customerSubscription.createPortalSession.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const pauseSubscription = trpc.customerSubscription.pause.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setShowPauseDialog(false);
      window.location.reload();
    },
    onError: (err) => {
      toast.error(err.message);
      setShowPauseDialog(false);
    },
  });

  const resumeSubscription = trpc.customerSubscription.resume.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      window.location.reload();
    },
    onError: (err) => toast.error(err.message),
  });

  const currentTier = subData?.currentTier || "free";

  const { data: trialStatus } = trpc.customerSubscription.checkTrialStatus.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const startTrial = trpc.customerSubscription.startTrial.useMutation({
    onSuccess: () => {
      toast.success("Coordinator trial started! You have 14 days of full access.");
      window.location.reload();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubscribe = (tier: string) => {
    if (tier === "free" || PLATFORM_SUBSCRIPTIONS_PAUSED) return;
    setSubscribing(tier);
    subscribe.mutate({ 
      tier: tier as "pro" | "business",
      interval: billingInterval,
    });
  };

  const formatPrice = (plan: typeof PLANS[0]) => {
    if (plan.tier === "free") return { main: "$0", sub: "forever" };
    if (billingInterval === "year") {
      const monthly = plan.yearlyPrice / 12;
      return { main: formatPriceUtil(monthly), sub: "/mo" };
    }
    return { main: formatPriceUtil(plan.monthlyPrice), sub: "/mo" };
  };

  const getAnnualSavings = (plan: typeof PLANS[0]) => {
    if (plan.tier === "free") return 0;
    return Math.round(plan.monthlyPrice * 12 - plan.yearlyPrice);
  };

  if (!isAuthenticated) {
    return (
      <div className="ology-customer-utility-surface min-h-screen bg-page">
        <NavHeader />
        <div className="container py-16 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold mb-4">My Customer Plan Subscription</h1>
          <p className="text-muted-foreground mb-8">Sign in to manage your subscription</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ology-customer-utility-surface min-h-screen bg-page">
      <NavHeader />

      <div className="container py-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" size="sm" className="mb-4" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="flex items-center gap-2 mb-2">
            <ShoppingBag className="ology-customer-plan-neutral-icon h-5 w-5 text-blue-600" />
            <h1 className="text-2xl sm:text-3xl font-bold">My Customer Plan Subscription</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Unlock more saved providers, priority booking, and analytics.
          </p>
        </div>

        {PLATFORM_SUBSCRIPTIONS_PAUSED && (
          <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-4 mb-6 text-sm text-amber-950">
            <p className="font-semibold">{PLATFORM_SUBSCRIPTION_PAUSE_MESSAGE}</p>
            <p className="mt-1">New trials and all billing changes are paused. Your existing records remain readable. The Individual free plan remains available; displayed dates are historical records, not confirmation of Stripe renewal.</p>
          </div>
        )}

        {/* Annual/Monthly Toggle */}
        <div className="ology-customer-plan-billing-toggle flex items-center justify-center gap-3 mb-8">
          <button
            aria-pressed={billingInterval === "month"}
            onClick={() => setBillingInterval("month")}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              billingInterval === "month"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            Monthly
          </button>
          <button
            aria-pressed={billingInterval === "year"}
            onClick={() => setBillingInterval("year")}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
              billingInterval === "year"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            Annual
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              billingInterval === "year"
                ? "bg-primary-foreground/20 text-primary-foreground"
                : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
            }`}>
              Save up to 20%
            </span>
          </button>
        </div>

        {/* Trial Status Banner */}
        {trialStatus?.isTrialing && (
          <div className="mb-6 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Zap className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="font-medium text-sm">
                    Coordinator Trial — {trialStatus.daysRemaining} day{trialStatus.daysRemaining !== 1 ? 's' : ''} remaining
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {trialStatus.showUrgentNudge 
                      ? "Your trial is ending soon. Paid subscription changes remain unavailable while Stripe reviews OlogyCrew's account."
                      : "Your existing trial remains readable. New trials and paid subscription changes are paused during the review."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {trialStatus?.trialExpired && currentTier === "free" && (
          <div className="mb-6 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-3">
              <Crown className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium text-sm">Your Coordinator trial has ended</p>
                <p className="text-xs text-muted-foreground">
                  Individual features remain available. New trials and paid subscription changes are unavailable during Stripe review; your recorded trial history is preserved.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* New-trial pause notice for free users who have not already started one */}
        {currentTier === "free" && !trialStatus?.isTrialing && !trialStatus?.trialExpired && !trialStatus?.hasUsedTrial && (
          <div className="mb-6 p-4 rounded-lg bg-gradient-to-r from-blue-500/10 to-primary/10 border border-blue-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Zap className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="font-medium text-sm">New customer trials are paused</p>
                  <p className="text-xs text-muted-foreground">
                    {ALL_TRIAL_PAUSE_MESSAGE} The Individual plan remains available, and existing subscription records are not changed.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Current Plan Badge */}
        {currentTier !== "free" && (
          <div className="ology-customer-plan-current mb-8 p-4 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Crown className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">
                    Current Plan: <span className="text-primary capitalize">{currentTier === "pro" ? "Coordinator" : "Manager"}</span>
                    {subData?.subscription?.status === "paused" && (
                      <Badge variant="secondary" className="ml-2 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                        <Pause className="h-3 w-3 mr-1" /> Paused
                      </Badge>
                    )}
                  </p>
                  {subData?.subscription?.status === "active" && (
                    <p className="text-sm text-muted-foreground">
                      {subData.subscription.cancelAtPeriodEnd 
                        ? (subData.entitlement.accessEndsAt || subData.subscription.currentPeriodEnd
                          ? `Cancels on ${new Date((subData.entitlement.accessEndsAt || subData.subscription.currentPeriodEnd) as Date | string).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}. Individual begins after that date.`
                          : "Cancellation is scheduled for the end of the current billing period. Individual begins afterward.")
                        : PLATFORM_SUBSCRIPTIONS_PAUSED ? "Recorded active status — renewal is not verified during review" : "Active and renewing"}
                    </p>
                  )}
                  {subData?.subscription?.status === "paused" && subData?.subscription?.resumesAt && (
                    <p className="text-sm text-muted-foreground">
                      {PLATFORM_SUBSCRIPTIONS_PAUSED ? "Recorded resume date (not verified): " : "Resumes on "}{new Date(subData.subscription.resumesAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {subData?.subscription?.status === "paused" ? (
                  <Button 
                    variant="default" 
                    size="sm"
                    onClick={() => resumeSubscription.mutate()}
                    disabled={PLATFORM_SUBSCRIPTIONS_PAUSED || resumeSubscription.isPending}
                  >
                    {resumeSubscription.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Play className="h-4 w-4 mr-1" />
                    )}
                    Resume Plan
                  </Button>
                ) : subData?.subscription?.status === "active" ? (
                  <>
                    {subData.subscription.cancelAtPeriodEnd ? (
                      <Button
                        size="sm"
                        onClick={() => subscribe.mutate({
                          tier: currentTier as "pro" | "business",
                          interval: subData.currentInterval,
                          withTrial: false,
                        })}
                        disabled={PLATFORM_SUBSCRIPTIONS_PAUSED || subscribe.isPending}
                      >
                        {subscribe.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
                        Keep Current Plan
                      </Button>
                    ) : (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setShowPauseDialog(true)}
                        disabled={PLATFORM_SUBSCRIPTIONS_PAUSED}
                      >
                        <Pause className="h-4 w-4 mr-1" />
                        Pause Plan
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => manageSubscription.mutate()}
                      disabled={PLATFORM_SUBSCRIPTIONS_PAUSED || manageSubscription.isPending}
                    >
                      {manageSubscription.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Manage Billing"
                      )}
                    </Button>
                    <Link href="/customer/billing">
                      <Button variant="ghost" size="sm">
                        Billing History
                      </Button>
                    </Link>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* Usage Stats */}
        {subData?.usage && currentTier !== "free" && (
          <div className="mb-8 p-4 rounded-lg border bg-card">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <BarChart3 className="ology-customer-plan-neutral-icon h-5 w-5 text-primary" />
              Your Usage
            </h3>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Saved Providers</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`ology-customer-plan-usage-bar h-full rounded-full transition-all ${
                      subData.usage.isAtLimit ? "bg-red-500" : "bg-primary"
                    }`}
                    data-state={subData.usage.isAtLimit ? "limit" : "available"}
                    style={{ width: `${subData.usage.savedProviderLimit === -1 ? 10 : Math.min(100, (subData.usage.savedProviders / subData.usage.savedProviderLimit) * 100)}%` }}
                  />
                </div>
                <span className="text-sm font-medium">
                  {subData.usage.savedProviders}/{subData.usage.savedProviderLimit === -1 ? "∞" : subData.usage.savedProviderLimit}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-12 pt-4">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            const isCurrent = currentTier === plan.tier;
            const isDowngrade = 
              (currentTier === "business" && plan.tier !== "business") ||
              (currentTier === "pro" && plan.tier === "free");
            const price = formatPrice(plan);
            const savings = getAnnualSavings(plan);

            return (
              <Card 
                key={plan.tier}
                className={`relative flex flex-col overflow-visible ${
                  plan.highlight 
                    ? "border-primary shadow-lg shadow-primary/10 scale-[1.02]" 
                    : ""
                } ${isCurrent && (currentTier === "free" || billingInterval === (subData?.currentInterval || "month")) ? "ring-2 ring-primary" : ""}`}
              >
                {/* Plan tags */}
                {plan.tier === "pro" && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <Badge className="ology-customer-plan-popular-badge bg-primary text-primary-foreground px-3 shadow-sm">Most Popular</Badge>
                  </div>
                )}
                {plan.tier === "business" && !isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <Badge className="bg-amber-700 text-white border-0 px-3 shadow-sm">Recommended</Badge>
                  </div>
                )}
                {isCurrent && isAuthenticated && (
                  (currentTier === "free" && plan.tier === "free") ||
                  (currentTier !== "free" && billingInterval === (subData?.currentInterval || "month"))
                ) && (
                  <div className={`absolute ${plan.tier === "pro" || plan.tier === "business" ? "top-3" : "-top-3"} left-1/2 -translate-x-1/2 z-10`}>
                    <Badge className="bg-green-600 text-white border-0 shadow-sm whitespace-nowrap">Current Plan</Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-4">
                  <div className="ology-customer-plan-icon w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{price.main}</span>
                    <span className="text-muted-foreground">{price.sub}</span>
                  </div>
                  {billingInterval === "year" && plan.tier !== "free" && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-muted-foreground">
                        Billed as {formatPriceUtil(plan.yearlyPrice)}/year
                      </p>
                      <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-0">
                        Save ${savings}/year
                      </Badge>
                    </div>
                  )}
                </CardHeader>

                <CardContent className="flex-1">
                  <ul className="space-y-3">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className={`h-4 w-4 mt-0.5 shrink-0 ${
                          feature.included ? "text-primary" : "text-muted-foreground/30"
                        }`} />
                        <span className={`text-sm ${
                          feature.included ? "" : "text-muted-foreground/50 line-through"
                        }`}>
                          {feature.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter>
                  {isCurrent && currentTier === "free" && plan.tier === "free" ? (
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  ) : isCurrent && currentTier !== "free" && billingInterval === (subData?.currentInterval || "month") ? (
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  ) : isCurrent && currentTier !== "free" && billingInterval !== (subData?.currentInterval || "month") ? (
                    <Button 
                      className="w-full"
                      variant="default"
                      onClick={() => handleSubscribe(plan.tier)}
                      disabled={PLATFORM_SUBSCRIPTIONS_PAUSED || subscribing === plan.tier || subscribe.isPending}
                    >
                      {subscribing === plan.tier ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</>
                      ) : (
                        `Switch to ${billingInterval === "year" ? "Annual" : "Monthly"}`
                      )}
                    </Button>
                  ) : plan.tier === "free" ? (
                    isDowngrade ? (
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => {
                          setDowngradeTarget("free");
                          setShowDowngradeDialog(true);
                        }}
                        disabled={PLATFORM_SUBSCRIPTIONS_PAUSED || downgrade.isPending}
                      >
                        {downgrade.isPending && downgradeTarget === "free" ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</>
                        ) : "Downgrade"}
                      </Button>
                    ) : (
                      <Button variant="outline" className="w-full" disabled>
                        Current Plan
                      </Button>
                    )
                  ) : (
                    <Button 
                      className={`w-full`}
                      variant={plan.tier === "pro" ? "default" : "outline"}
                      onClick={() => {
                        if (isDowngrade) {
                          setDowngradeTarget(plan.tier as "pro");
                          setShowDowngradeDialog(true);
                        } else if (!ALL_TRIALS_PAUSED && currentTier === "free" && trialStatus && !trialStatus.hasUsedTrial) {
                          startTrial.mutate({ tier: plan.tier as "pro" | "business" });
                        } else {
                          handleSubscribe(plan.tier);
                        }
                      }}
                      disabled={PLATFORM_SUBSCRIPTIONS_PAUSED || (ALL_TRIALS_PAUSED && currentTier === "free" && !trialStatus?.hasUsedTrial) || subscribing === plan.tier || subscribe.isPending || startTrial.isPending || (downgrade.isPending && downgradeTarget === plan.tier)}
                    >
                      {subscribing === plan.tier || startTrial.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : isDowngrade ? (
                        "Downgrade"
                      ) : ALL_TRIALS_PAUSED && currentTier === "free" && !trialStatus?.hasUsedTrial ? (
                        "Unavailable during review"
                      ) : currentTier === "free" && trialStatus && !trialStatus.hasUsedTrial ? (
                        "Start Free Trial"
                      ) : (
                        `Select ${plan.name}`
                      )}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Pause Subscription Dialog */}
      <Dialog open={showPauseDialog} onOpenChange={setShowPauseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pause className="h-5 w-5 text-amber-600" />
              Pause Your Subscription
            </DialogTitle>
            <DialogDescription className="text-left space-y-3 pt-2">
              <p>
                Pausing your subscription will temporarily stop billing. Your saved providers and data will be preserved, but:
              </p>
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm">
                <ul className="text-amber-700 dark:text-amber-300 space-y-1 text-xs">
                  <li>• You won't be charged during the pause</li>
                  <li>• Priority booking will be unavailable</li>
                  <li>• Saved provider limit reverts to 5</li>
                  <li>• Existing bookings remain unaffected</li>
                  <li>• Your plan features are preserved when you resume</li>
                </ul>
              </div>
              <div className="pt-2">
                <p className="text-sm font-medium mb-2">How long would you like to pause?</p>
                <div className="flex gap-2">
                  {(["7", "14", "30"] as const).map((days) => (
                    <button
                      key={days}
                      onClick={() => setPauseDuration(days)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        pauseDuration === days
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted text-muted-foreground border-border hover:border-primary/50"
                      }`}
                    >
                      {days} days
                    </button>
                  ))}
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setShowPauseDialog(false)}
              disabled={pauseSubscription.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => {
                const resumeDate = new Date();
                resumeDate.setDate(resumeDate.getDate() + parseInt(pauseDuration));
                pauseSubscription.mutate({ resumeDate: resumeDate.toISOString() });
              }}
              disabled={PLATFORM_SUBSCRIPTIONS_PAUSED || pauseSubscription.isPending}
            >
              {pauseSubscription.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Pausing...</>
              ) : (
                `Pause for ${pauseDuration} Days`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Downgrade Confirmation Dialog */}
      <Dialog open={showDowngradeDialog} onOpenChange={setShowDowngradeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Confirm Downgrade
            </DialogTitle>
            <DialogDescription className="text-left space-y-3 pt-2">
              <p>
                You're about to downgrade from <strong>{currentTier === "business" ? "Manager" : "Coordinator"}</strong> to{" "}
                <strong>{downgradeTarget === "free" ? "Individual (Free)" : "Coordinator"}</strong>.
              </p>
              <p>
                {downgradeTarget === "free"
                  ? "Your current paid plan and features remain active through the end of this billing period. Individual begins afterward. You can keep your current plan before then without a new charge."
                  : "The move to Coordinator takes effect immediately. Stripe applies any prorated billing adjustment to your existing subscription."}
              </p>
              {downgradeTarget === "free" && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-200 mb-1">You'll lose access to:</p>
                  <ul className="text-amber-700 dark:text-amber-300 space-y-1 text-xs">
                    <li>• Priority booking requests</li>
                    <li>• Extra saved providers (limited to 5)</li>
                    <li>• Provider folders</li>
                    <li>• Booking analytics</li>
                  </ul>
                </div>
              )}
              {downgradeTarget === "pro" && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-200 mb-1">You'll lose access to:</p>
                  <ul className="text-amber-700 dark:text-amber-300 space-y-1 text-xs">
                    <li>• Unlimited saved providers (limited to 50)</li>
                    <li>• Bulk quote requests</li>
                    <li>• Booking analytics & spending reports</li>
                    <li>• Dedicated support</li>
                  </ul>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => { setShowDowngradeDialog(false); setDowngradeTarget(null); }}
              disabled={downgrade.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (downgradeTarget) {
                  downgrade.mutate({ targetTier: downgradeTarget });
                }
              }}
              disabled={PLATFORM_SUBSCRIPTIONS_PAUSED || downgrade.isPending}
            >
              {downgrade.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</>
              ) : (
                "Confirm Downgrade"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
