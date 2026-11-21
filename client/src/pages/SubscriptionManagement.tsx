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
  Star,
  ArrowLeft,
  Loader2,
  Shield,
  Camera,
  Search,
  Palette,
  Users,
  BarChart3,
  AlertTriangle,
  Pause,
  Play,
  Briefcase,
  ShoppingBag,
  ArrowRight,
} from "lucide-react";
import { Link } from "wouter";
import { NavHeader } from "@/components/shared/NavHeader";
import { formatPrice as formatPriceUtil } from "@shared/formatPrice";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PROVIDER_PLANS } from "@shared/entitlements";
import { PLATFORM_SUBSCRIPTIONS_PAUSED, PLATFORM_SUBSCRIPTION_PAUSE_DETAIL, PLATFORM_SUBSCRIPTION_PAUSE_MESSAGE, PROVIDER_TRIALS_PAUSED, PROVIDER_TRIAL_PAUSE_MESSAGE } from "@shared/providerPaymentPause";
import "./SubscriptionManagement.css";

const PLANS = [
  {
    tier: "free" as const,
    name: PROVIDER_PLANS.free.name,
    monthlyPrice: PROVIDER_PLANS.free.monthlyPrice,
    yearlyPrice: PROVIDER_PLANS.free.yearlyPrice,
    description: "Get started and list your services — no cost, no commitment.",
    icon: Star,
    features: [
      { text: `${PROVIDER_PLANS.free.limits.maxCategories} service category`, included: true },
      { text: `Up to ${PROVIDER_PLANS.free.limits.maxServices} services`, included: true },
      { text: `${PROVIDER_PLANS.free.limits.maxPhotosPerService} photo per service`, included: true },
      { text: "Basic public profile", included: true },
      { text: "Standard search placement", included: true },
      { text: "Stripe payment collection", included: false },
      { text: "Invoicing & branded receipts (after review)", included: false },
      { text: "Tip collection (Zelle, Cash App, Venmo)", included: true },
      { text: "1% transaction fee on OlogyCrew payments", included: false },
      { text: "Multiple categories", included: false },
      { text: "Analytics dashboard", included: false },
      { text: "Custom branding", included: false },
      { text: "Priority support", included: false },
    ],
    highlight: false,
  },
  {
    tier: "basic" as const,
    name: PROVIDER_PLANS.basic.name,
    monthlyPrice: PROVIDER_PLANS.basic.monthlyPrice,
    yearlyPrice: PROVIDER_PLANS.basic.yearlyPrice,
    description: "For providers offering multiple service categories — grow your reach.",
    icon: Zap,
    features: [
      { text: "Free trial (temporarily unavailable)", included: false },
      { text: `Up to ${PROVIDER_PLANS.basic.limits.maxCategories} service categories`, included: true },
      { text: `Up to ${PROVIDER_PLANS.basic.limits.maxServices} services`, included: true },
      { text: `${PROVIDER_PLANS.basic.limits.maxPhotosPerService} photos per service`, included: true },
      { text: "Custom profile URL slug", included: true },
      { text: "Priority search placement", included: true },
      { text: "Business analytics", included: true },
      { text: "Stripe payment collection (after review)", included: true },
      { text: "Invoicing & receipts (after review)", included: true },
      { text: "Tip collection (Zelle, Cash App, Venmo)", included: true },
      { text: "1% transaction fee", included: true },
      { text: "Email support", included: true },
      { text: "Custom branding", included: false },
      { text: "Featured listing badge", included: false },
    ],
    highlight: true,
  },
  {
    tier: "premium" as const,
    name: PROVIDER_PLANS.premium.name,
    monthlyPrice: PROVIDER_PLANS.premium.monthlyPrice,
    yearlyPrice: PROVIDER_PLANS.premium.yearlyPrice,
    description: "Unlimited everything for established businesses and full-service pros.",
    icon: Crown,
    features: [
      { text: "Free trial (temporarily unavailable)", included: false },
      { text: "Unlimited service categories", included: true },
      { text: "Unlimited services", included: true },
      { text: "5 photos per service", included: true },
      { text: "Custom branding & colors", included: true },
      { text: "Featured listing badge", included: true },
      { text: "Top search placement", included: true },
      { text: "Full analytics suite", included: true },
      { text: "Stripe payment collection (after review)", included: true },
      { text: "Invoicing & receipts (after review)", included: true },
      { text: "Tip collection (Zelle, Cash App, Venmo)", included: true },
      { text: "1% transaction fee", included: true },
      { text: "Priority support", included: true },
      { text: "Early access to new features", included: true },
    ],
    highlight: false,
  },
];

export default function SubscriptionManagement() {
  const { isAuthenticated } = useAuth();
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<"month" | "year">("month");

  const { data: currentSub, isLoading: subLoading } = trpc.subscription.mySubscription.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: provider } = trpc.provider.getMyProfile.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const subscribe = trpc.subscription.createCheckout.useMutation({
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

  const [downgradeTarget, setDowngradeTarget] = useState<"free" | "basic" | null>(null);
  const [showDowngradeDialog, setShowDowngradeDialog] = useState(false);
  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const [pauseDuration, setPauseDuration] = useState<"7" | "14" | "30">("30");

  const downgrade = trpc.subscription.downgrade.useMutation({
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

  const manageSubscription = trpc.subscription.createPortalSession.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const pauseSubscription = trpc.subscription.pause.useMutation({
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

  const resumeSubscription = trpc.subscription.resume.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      window.location.reload();
    },
    onError: (err) => toast.error(err.message),
  });

  const currentTier = currentSub?.currentTier || "free";
  const paidBillingUnavailable = PLATFORM_SUBSCRIPTIONS_PAUSED;

  const { data: trialStatus } = trpc.subscription.checkTrialStatus.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const startTrial = trpc.subscription.startProfessionalTrial.useMutation({
    onSuccess: () => {
      toast.success("Pro trial started! You have 14 days of full access.");
      // Invalidate queries to refresh the page
      window.location.reload();
    },
    onError: (err) => toast.error(err.message),
  });

  // Extract returnTo from URL query params (e.g., /provider/subscription?returnTo=/provider/invoices)
  const returnTo = new URLSearchParams(window.location.search).get("returnTo") || undefined;

  const handleSubscribe = (tier: string) => {
    if (tier === "free") return;
    if (paidBillingUnavailable) {
      toast.error(PLATFORM_SUBSCRIPTION_PAUSE_MESSAGE);
      return;
    }
    setSubscribing(tier);
    subscribe.mutate({ 
      tier: tier as "basic" | "premium",
      interval: billingInterval,
      returnTo,
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
      <div className="min-h-screen bg-page ology-provider-plan-page">
        <NavHeader />
        <div className="container py-16 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold mb-4">My Provider Plan Subscription</h1>
          <p className="text-muted-foreground mb-8">Sign in to manage your subscription</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page ology-provider-plan-page">
      <NavHeader />

      <div className="container py-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 ology-provider-plan-intro">
          <Button variant="ghost" size="sm" className="mb-4" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="flex items-center gap-2 mb-2">
            <Briefcase className="h-5 w-5 ology-provider-plan-intro-icon" />
            <h1 className="text-2xl sm:text-3xl font-bold">My Provider Plan Subscription</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Grow your business with more categories, services, and visibility. Starter setup remains available; new trials, paid checkout, and Stripe-backed payment features are temporarily paused.
          </p>
        </div>

        {paidBillingUnavailable && (
          <div role="status" className="mb-8 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
            <p className="font-medium">{PLATFORM_SUBSCRIPTION_PAUSE_MESSAGE}</p>
            <p className="mt-1 text-sm">{PLATFORM_SUBSCRIPTION_PAUSE_DETAIL}</p>
            <p className="mt-2 text-sm">Existing subscription records are shown for reference and are not automatically cancelled or changed. Pricing below is for comparison; renewal and billing interval are not verified with Stripe during review.</p>
          </div>
        )}

        {/* Annual/Monthly Toggle */}
        <div className="flex items-center justify-center gap-3 mb-8 ology-provider-plan-billing-toggle" role="group" aria-label="Provider billing interval">
          <button
            type="button"
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
            type="button"
            aria-label="Annual billing — save up to 20%"
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
          <div className={`mb-6 p-4 rounded-lg border ology-provider-plan-trial ${trialStatus.showUrgentNudge ? "ology-provider-plan-trial--urgent" : "ology-provider-plan-trial--active"}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Zap className="h-5 w-5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">
                    Pro Trial — {trialStatus.daysRemaining} day{trialStatus.daysRemaining !== 1 ? 's' : ''} remaining
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {trialStatus.showUrgentNudge 
                      ? "Your trial is ending soon. Paid checkout is temporarily unavailable while Stripe reviews OlogyCrew's account."
                      : "Your existing local trial remains readable during the review. New trials and paid checkout are paused until Stripe restores service."}
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
                <p className="font-medium text-sm">Your Pro trial has ended</p>
                <p className="text-xs text-muted-foreground">
                  You're on the Starter plan. Paid Pro/Business checkout is temporarily unavailable while Stripe reviews OlogyCrew's account.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* New trial status for free users who have not already started one */}
        {currentTier === "free" && !trialStatus?.isTrialing && !trialStatus?.trialExpired && !trialStatus?.hasUsedTrial && (
          <div className="mb-6 p-4 rounded-lg border ology-provider-plan-trial-offer">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Zap className="h-5 w-5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">New provider trials are paused</p>
                  <p className="text-xs text-muted-foreground">
                    {PROVIDER_TRIAL_PAUSE_MESSAGE} Starter remains available, and existing trial records are not changed.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Current Plan Badge */}
        {currentTier !== "free" && (
          <div className="mb-8 p-4 rounded-lg border ology-provider-plan-current">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Crown className="h-5 w-5 ology-provider-plan-current-icon" />
                <div>
                  <p className="font-medium">
                    Current Plan: <span className="text-primary capitalize">{currentTier === "basic" ? "Pro" : "Business"}</span>
                    {currentSub?.subscription?.status === "paused" && (
                      <Badge variant="secondary" className="ml-2 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                        <Pause className="h-3 w-3 mr-1" /> Paused
                      </Badge>
                    )}
                  </p>
                  {currentSub?.subscription?.status === "active" && (
                    <p className="text-sm text-muted-foreground">
                      {currentSub.subscription.cancelAtPeriodEnd 
                        ? (currentSub.entitlement.accessEndsAt || currentSub.subscription.currentPeriodEnd
                          ? `Cancels on ${new Date((currentSub.entitlement.accessEndsAt || currentSub.subscription.currentPeriodEnd) as Date | string).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}. Starter begins after that date.`
                          : "Cancellation is scheduled for the end of the current billing period. Starter begins afterward.")
                        : paidBillingUnavailable ? "Recorded active status — renewal is not verified during review" : "Active and renewing"}
                    </p>
                  )}
                  {currentSub?.subscription?.status === "paused" && currentSub?.subscription?.resumesAt && (
                    <p className="text-sm text-muted-foreground">
                      {paidBillingUnavailable ? "Recorded resume date (not verified): " : "Resumes on "}{new Date(currentSub.subscription.resumesAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {currentSub?.subscription?.status === "paused" ? (
                  <Button 
                    variant="default" 
                    size="sm"
                    onClick={() => resumeSubscription.mutate()}
                    disabled={paidBillingUnavailable || resumeSubscription.isPending}
                  >
                    {resumeSubscription.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Play className="h-4 w-4 mr-1" />
                    )}
                    Resume Plan
                  </Button>
                ) : currentSub?.subscription?.status === "active" ? (
                  <>
                    {currentSub.subscription.cancelAtPeriodEnd ? (
                      <Button
                        size="sm"
                        onClick={() => subscribe.mutate({
                          tier: currentTier as "basic" | "premium",
                          interval: currentSub.currentInterval,
                          withTrial: false,
                        })}
                        disabled={paidBillingUnavailable || subscribe.isPending}
                      >
                        {subscribe.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
                        Keep Current Plan
                      </Button>
                    ) : (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setShowPauseDialog(true)}
                        disabled={paidBillingUnavailable}
                      >
                        <Pause className="h-4 w-4 mr-1" />
                        Pause Plan
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => manageSubscription.mutate()}
                      disabled={paidBillingUnavailable || manageSubscription.isPending}
                    >
                      {manageSubscription.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Manage Billing"
                      )}
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href="/provider/billing">Billing History</Link>
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* Usage Stats - side by side with current plan */}
        {currentSub?.usage && currentTier !== "free" && (
          <div className="mb-8 p-4 rounded-lg border bg-card ology-provider-plan-usage">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 ology-provider-plan-usage-icon" />
              Your Usage
            </h3>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Services</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${
                      currentSub.usage.servicesUsed >= currentSub.usage.servicesLimit
                        ? "bg-red-500"
                        : "bg-primary"
                    } ology-provider-plan-usage-bar`}
                    style={{ width: `${Math.min(100, (currentSub.usage.servicesUsed / currentSub.usage.servicesLimit) * 100)}%` }}
                  />
                </div>
                <span className="text-sm font-medium">
                  {currentSub.usage.servicesUsed}/{currentSub.usage.servicesLimit === 999 ? "∞" : currentSub.usage.servicesLimit}
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
              (currentTier === "premium" && plan.tier !== "premium") ||
              (currentTier === "basic" && plan.tier === "free");
            const price = formatPrice(plan);
            const savings = getAnnualSavings(plan);

            return (
              <Card 
                key={plan.tier}
                data-provider-plan={plan.tier}
                data-current-plan={isCurrent && (currentTier === "free" || billingInterval === (currentSub?.currentInterval || "month")) ? "true" : "false"}
                className={`relative flex flex-col overflow-visible ology-provider-plan-card ${
                  plan.highlight 
                    ? "border-primary shadow-lg shadow-primary/10 scale-[1.02]" 
                    : ""
                } ${isCurrent && (currentTier === "free" || billingInterval === (currentSub?.currentInterval || "month")) ? "ring-2 ring-primary" : ""}`}
              >
                {/* Plan tags: Most Popular for Pro, Recommended for Business */}
                {plan.tier === "basic" && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <Badge className="bg-primary text-primary-foreground px-3 shadow-sm ology-provider-plan-popular">Most Popular</Badge>
                  </div>
                )}
                {plan.tier === "premium" && !isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <Badge className="bg-amber-700 text-white border-0 px-3 shadow-sm">Recommended</Badge>
                  </div>
                )}
                {/* Current Plan tag - show for free tier always, for paid tiers only when interval matches */}
                {isCurrent && isAuthenticated && (
                  (currentTier === "free" && plan.tier === "free") ||
                  (currentTier !== "free" && billingInterval === (currentSub?.currentInterval || "month"))
                ) && (
                  <div className={`absolute ${plan.tier === "basic" || plan.tier === "premium" ? "top-3" : "-top-3"} left-1/2 -translate-x-1/2 z-10`}>
                    <Badge className="bg-green-600 text-white border-0 shadow-sm whitespace-nowrap">Current Plan</Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3 ology-provider-plan-card-icon">
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
                        <span className={`text-sm ${!feature.included ? "ology-provider-plan-unavailable" : ""} ${
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
                  ) : isCurrent && currentTier !== "free" && billingInterval === (currentSub?.currentInterval || "month") ? (
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  ) : isCurrent && currentTier !== "free" && billingInterval !== (currentSub?.currentInterval || "month") ? (
                    <Button 
                      className="w-full"
                      variant="default"
                      onClick={() => handleSubscribe(plan.tier)}
                      disabled={paidBillingUnavailable || subscribing === plan.tier || subscribe.isPending}
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
                        disabled={paidBillingUnavailable || downgrade.isPending}
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
                      className={`w-full ${plan.tier === "basic" ? "" : ""}`}
                      variant={isDowngrade ? "outline" : plan.tier === "basic" ? "default" : "outline"}
                      onClick={() => {
                        if (isDowngrade) {
                          setDowngradeTarget(plan.tier as "basic");
                          setShowDowngradeDialog(true);
                        } else if (!PROVIDER_TRIALS_PAUSED && currentTier === "free" && trialStatus && !trialStatus.hasUsedTrial) {
                          startTrial.mutate({ tier: plan.tier as "basic" | "premium" });
                        } else {
                          handleSubscribe(plan.tier);
                        }
                      }}
                      disabled={(PROVIDER_TRIALS_PAUSED && currentTier === "free" && !trialStatus?.hasUsedTrial) || (!(!trialStatus?.hasUsedTrial && currentTier === "free") && paidBillingUnavailable) || subscribing === plan.tier || subscribe.isPending || startTrial.isPending || (downgrade.isPending && downgradeTarget === plan.tier)}
                    >
                      {subscribing === plan.tier || startTrial.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : isDowngrade ? (
                        "Downgrade"
                      ) : PROVIDER_TRIALS_PAUSED && currentTier === "free" && !trialStatus?.hasUsedTrial ? (
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
        <DialogContent className="sm:max-w-md ology-provider-plan-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pause className="h-5 w-5 text-amber-600" />
              Pause Your Subscription
            </DialogTitle>
            <DialogDescription asChild className="text-left space-y-3 pt-2">
              <div>
              <p>
                Pausing your subscription will temporarily stop billing. Your profile and data will be preserved, but:
              </p>
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm">
                <ul className="text-amber-700 dark:text-amber-300 space-y-1 text-xs">
                  <li>• You won't be charged during the pause</li>
                  <li>• Customers cannot book new appointments</li>
                  <li>• Your profile will show as "temporarily unavailable"</li>
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
                      type="button"
                      aria-pressed={pauseDuration === days}
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
              disabled={paidBillingUnavailable || pauseSubscription.isPending}
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
        <DialogContent className="sm:max-w-md ology-provider-plan-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Confirm Downgrade
            </DialogTitle>
            <DialogDescription asChild className="text-left space-y-3 pt-2">
              <div>
              <p>
                You're about to downgrade from <strong>{currentTier === "premium" ? "Business" : "Pro"}</strong> to{" "}
                <strong>{downgradeTarget === "free" ? "Starter (Free)" : "Pro"}</strong>.
              </p>
              <p>
                {downgradeTarget === "free"
                  ? "Your current paid plan and features remain active through the end of this billing period. Starter begins afterward. You can keep your current plan before then without a new charge."
                  : "The move to Pro takes effect immediately. Stripe applies any prorated billing adjustment to your existing subscription."}
              </p>
              {downgradeTarget === "free" && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-200 mb-1">You'll lose access to:</p>
                  <ul className="text-amber-700 dark:text-amber-300 space-y-1 text-xs">
                    <li>• Priority search placement</li>
                    <li>• Payment collection and invoicing</li>
                    <li>• Extra service listings (limited to 3)</li>
                    <li>• Additional photo uploads (limited to 1 per service)</li>
                    <li>• Analytics dashboard</li>
                    {currentTier === "premium" && <li>• Custom branding & featured badge</li>}
                  </ul>
                </div>
              )}
              {downgradeTarget === "basic" && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-200 mb-1">You'll lose access to:</p>
                  <ul className="text-amber-700 dark:text-amber-300 space-y-1 text-xs">
                    <li>• Unlimited services (limited to 10)</li>
                    <li>• Custom branding & featured badge</li>
                    <li>• Priority support</li>
                    <li>• 5 photos per service (limited to 3)</li>
                  </ul>
                </div>
              )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowDowngradeDialog(false);
                setDowngradeTarget(null);
              }}
              disabled={downgrade.isPending}
            >
              Keep Current Plan
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (downgradeTarget) {
                  downgrade.mutate({ targetTier: downgradeTarget });
                }
              }}
              disabled={paidBillingUnavailable || downgrade.isPending}
            >
              {downgrade.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Downgrading...</>
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
