import { useState } from "react";
import { formatPrice } from "@shared/formatPrice";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { NavHeader } from "@/components/shared/NavHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Heart, Crown, Zap, Check, X,
  FolderHeart, BarChart3, Headphones, Send,
  Star, Shield, Loader2, AlertTriangle,
  Briefcase, Users, Layers, Camera, Search,
  MessageSquare, Bell, Palette, TrendingUp, Clock,
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CUSTOMER_PLANS, PROVIDER_PLANS } from "@shared/entitlements";
import { ALL_TRIALS_PAUSED, ALL_TRIAL_PAUSE_MESSAGE } from "@shared/providerPaymentPause";
import "./CustomerPricing.css";

// ─── PROVIDER PLANS ────────────────────────────────────────────────────────────

const providerPlans = [
  {
    tier: "free" as const,
    name: PROVIDER_PLANS.free.name,
    monthlyPrice: PROVIDER_PLANS.free.monthlyPrice,
    yearlyPrice: PROVIDER_PLANS.free.yearlyPrice,
    icon: Star,
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    borderColor: "border-border",
    description: "Get started and list your services — no cost, no commitment.",
    highlights: [
      { text: "Free Forever", icon: Star },
      { text: `${PROVIDER_PLANS.free.limits.maxCategories} service category`, icon: Layers },
      { text: `Up to ${PROVIDER_PLANS.free.limits.maxServices} services`, icon: Briefcase },
      { text: `${PROVIDER_PLANS.free.limits.maxPhotosPerService} photo per service`, icon: Camera },
    ],
    features: [
      { text: "Basic public profile", included: true },
      { text: "Standard search placement", included: true },
      { text: "Booking management", included: true },
      { text: "Customer messaging", included: true },
      { text: "Stripe payment collection", included: false },
      { text: "Invoicing & receipts", included: false },
      { text: "Tip collection (Zelle, Cash App, Venmo)", included: true },
      { text: "1% transaction fee on OlogyCrew payments", included: false },
      { text: "Priority search placement", included: false },
      { text: "Analytics dashboard", included: false },
      { text: "Custom branding", included: false },
      { text: "Featured listing badge", included: false },
      { text: "Priority support", included: false },
    ],
  },
  {
    tier: "basic" as const,
    name: PROVIDER_PLANS.basic.name,
    monthlyPrice: PROVIDER_PLANS.basic.monthlyPrice,
    yearlyPrice: PROVIDER_PLANS.basic.yearlyPrice / 12,
    icon: Zap,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    popular: true,
    description: "For providers offering multiple service categories — grow your reach.",
    highlights: [
      { text: "14 Day Free Trial", icon: Clock },
      { text: `Up to ${PROVIDER_PLANS.basic.limits.maxCategories} categories`, icon: Layers },
      { text: `Up to ${PROVIDER_PLANS.basic.limits.maxServices} services`, icon: Briefcase },
      { text: `${PROVIDER_PLANS.basic.limits.maxPhotosPerService} photos per service`, icon: Camera },
    ],
    features: [
      { text: "Enhanced public profile", included: true },
      { text: "Custom profile URL slug", included: true },
      { text: "Priority search placement", included: true },
      { text: "Business analytics", included: true },
      { text: "Stripe payment collection", included: true },
      { text: "1% transaction fee", included: true },
      { text: "Email support", included: true },
      { text: "Booking management", included: true },
      { text: "Customer messaging", included: true },
      { text: "Invoicing & receipts", included: true },
      { text: "Tip collection (Zelle, Cash App, Venmo)", included: true },
      { text: "Custom branding", included: false },
      { text: "Featured listing badge", included: false },
    ],
  },
  {
    tier: "premium" as const,
    name: PROVIDER_PLANS.premium.name,
    monthlyPrice: PROVIDER_PLANS.premium.monthlyPrice,
    yearlyPrice: PROVIDER_PLANS.premium.yearlyPrice / 12,
    icon: Crown,
    color: "text-amber-700 dark:text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    description: "Unlimited everything for established businesses and full-service pros.",
    highlights: [
      { text: "14 Day Free Trial", icon: Clock },
      { text: "Unlimited categories", icon: Layers },
      { text: "Unlimited services", icon: Briefcase },
      { text: "5 photos per service", icon: Camera },
    ],
    features: [
      { text: "Premium public profile", included: true },
      { text: "Custom branding & colors", included: true },
      { text: "Featured listing badge", included: true },
      { text: "Top search placement", included: true },
      { text: "Full analytics suite", included: true },
      { text: "Stripe payment collection", included: true },
      { text: "1% transaction fee", included: true },
      { text: "Invoicing & receipts", included: true },
      { text: "Tip collection (Zelle, Cash App, Venmo)", included: true },
      { text: "Priority support", included: true },
      { text: "Email notifications", included: true },
      { text: "Early access to new features", included: true },
      { text: "Custom profile URL slug", included: true },
    ],
  },
];

// ─── CUSTOMER PLANS ────────────────────────────────────────────────────────────

const customerPlans = [
  {
    tier: "free" as const,
    name: CUSTOMER_PLANS.free.name,
    monthlyPrice: CUSTOMER_PLANS.free.monthlyPrice,
    yearlyPrice: CUSTOMER_PLANS.free.yearlyPrice,
    icon: Heart,
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    borderColor: "border-border",
    description: "Perfect for individuals booking personal services occasionally.",
    highlights: [
      { text: "Free Forever", icon: Star },
      { text: `Save up to ${CUSTOMER_PLANS.free.savedProviderLimit} providers`, icon: Heart },
      { text: "Book any service", icon: Briefcase },
      { text: "Message providers", icon: MessageSquare },
    ],
    features: [
      { text: "Browse all providers & services", included: true },
      { text: "Book and pay securely", included: true },
      { text: "Message your providers", included: true },
      { text: "Booking notifications", included: true },
      { text: "Priority booking requests", included: false },
      { text: "Provider folders", included: false },
      { text: "Bulk quote requests", included: false },
      { text: "Booking analytics", included: false },
      { text: "Dedicated support", included: false },
    ],
  },
  {
    tier: "pro" as const,
    name: CUSTOMER_PLANS.pro.name,
    monthlyPrice: CUSTOMER_PLANS.pro.monthlyPrice,
    yearlyPrice: CUSTOMER_PLANS.pro.yearlyPrice / 12,
    icon: Zap,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    popular: true,
    description: "For frequent bookers and small event planners managing multiple providers.",
    highlights: [
      { text: "14 Day Free Trial", icon: Clock },
      { text: `Save up to ${CUSTOMER_PLANS.pro.savedProviderLimit} providers`, icon: Heart },
      { text: "Priority booking", icon: Star },
      { text: "Organize into folders", icon: FolderHeart },
    ],
    features: [
      { text: "Everything in Individual", included: true },
      { text: "Priority booking requests", included: true },
      { text: "Organize providers into folders", included: true },
      { text: "Email support", included: true },
      { text: "Bulk quote requests", included: false },
      { text: "Booking analytics", included: false },
      { text: "Spend reports", included: false },
      { text: "Dedicated support", included: false },
    ],
  },
  {
    tier: "business" as const,
    name: CUSTOMER_PLANS.business.name,
    monthlyPrice: CUSTOMER_PLANS.business.monthlyPrice,
    yearlyPrice: CUSTOMER_PLANS.business.yearlyPrice / 12,
    icon: Crown,
    color: "text-amber-700 dark:text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    description: "For logistics managers, agencies, and production companies booking large crews.",
    highlights: [
      { text: "14 Day Free Trial", icon: Clock },
      { text: "Unlimited saved providers", icon: Heart },
      { text: "Bulk quote requests", icon: Send },
      { text: "Booking analytics", icon: BarChart3 },
    ],
    features: [
      { text: "Everything in Coordinator", included: true },
      { text: "Unlimited saved providers", included: true },
      { text: "Unlimited bulk quote requests", included: true },
      { text: "Booking analytics & spend reports", included: true },
      { text: "Dedicated support", included: true },
    ],
  },
];

// ─── COMPONENT ─────────────────────────────────────────────────────────────────

export default function CustomerPricing() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [audience, setAudience] = useState<"provider" | "customer">("provider");
  const [yearly, setYearly] = useState(false);

  // Customer subscription state
  const { data: customerSubInfo } = trpc.customerSubscription.getSubscription.useQuery(undefined, {
    enabled: !!user,
  });

  const customerCreateCheckout = trpc.customerSubscription.createCheckout.useMutation({
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (err) => toast.error(err.message),
  });

  const customerStartTrial = trpc.customerSubscription.startTrial.useMutation({
    onSuccess: (data) => {
      toast.success(`Your 14-day ${data.tier === "business" ? "Manager" : "Coordinator"} trial has started!`);
      navigate("/saved-providers");
    },
    onError: (err) => toast.error(err.message),
  });

  const customerCreatePortal = trpc.customerSubscription.createPortalSession.useMutation({
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (err) => toast.error(err.message),
  });

  const [downgradeTarget, setDowngradeTarget] = useState<string | null>(null);
  const [showDowngradeDialog, setShowDowngradeDialog] = useState(false);

  const customerDowngrade = trpc.customerSubscription.downgrade.useMutation({
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

  // Provider subscription state
  const { data: providerSubInfo } = trpc.subscription.mySubscription.useQuery(undefined, {
    enabled: !!user,
  });

  const providerCreateCheckout = trpc.subscription.createCheckout.useMutation({
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (err) => toast.error(err.message),
  });

  const providerCreatePortal = trpc.subscription.createPortalSession.useMutation({
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (err) => toast.error(err.message),
  });

  const providerDowngrade = trpc.subscription.downgrade.useMutation({
    onSuccess: () => {
      toast.success("Plan downgraded successfully");
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

  const customerCurrentTier = customerSubInfo?.currentTier || "free";
  const providerCurrentTier = providerSubInfo?.currentTier || "free";

  const isProvider = !!providerSubInfo || user?.role === "provider";

  return (
    <div className="min-h-screen ology-pricing-page">
      <NavHeader />
      <main className="ology-pricing-content container py-12 max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="ology-pricing-intro text-center mb-8">
          <div className="ology-pricing-eyebrow inline-flex items-center gap-2 bg-emerald-100 text-emerald-800 rounded-full px-4 py-1.5 text-sm font-medium mb-4">
            <Shield className="h-4 w-4" />
            {audience === "provider" ? "No Gatekeeping" : "Local work, well done"}
          </div>
          <h1 className="ology-pricing-heading text-2xl sm:text-3xl md:text-4xl font-bold mb-3">
            {audience === "provider" ? "Your business. Your profile. Your customers. Your money." : "Find good people for the work you need."}
          </h1>
          <p className="ology-pricing-intro-copy text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
            {audience === "provider"
              ? "OlogyCrew provides the infrastructure — you own the relationship. Choose the plan that fits where you are today."
              : "Find independent local professionals, compare services, then book or request a quote directly. Choose the plan that fits how you book."}
          </p>
        </div>

        {/* Audience Toggle */}
        <div className="ology-pricing-audience flex justify-center mb-8">
          <div role="group" aria-label="Choose your pricing plans" className="inline-flex items-center bg-muted rounded-lg p-1 gap-1">
            <button
              onClick={() => setAudience("provider")}
              aria-pressed={audience === "provider"}
              className={`px-5 py-2.5 rounded-md text-sm font-medium transition-all ${
                audience === "provider"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Briefcase className="h-4 w-4 inline-block mr-1.5 -mt-0.5" />
              I Provide Services
            </button>
            <button
              onClick={() => setAudience("customer")}
              aria-pressed={audience === "customer"}
              className={`px-5 py-2.5 rounded-md text-sm font-medium transition-all ${
                audience === "customer"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users className="h-4 w-4 inline-block mr-1.5 -mt-0.5" />
              I Book Services
            </button>
          </div>
        </div>

        {/* Billing toggle */}
        <div role="group" aria-label="Choose billing interval" className="ology-pricing-billing flex items-center justify-center gap-3 mb-10">
          <button
            onClick={() => setYearly(false)}
            aria-pressed={!yearly}
            className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${
              !yearly ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setYearly(true)}
            aria-pressed={yearly}
            className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${
              yearly ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Yearly
          </button>
          {yearly && (
            <Badge variant="secondary" className="ology-pricing-savings text-green-600 bg-green-500/10 border-green-500/20">
              Save up to 20%
            </Badge>
          )}
        </div>

        {/* ─── PROVIDER PLANS ─────────────────────────────────────────────── */}
        {audience === "provider" && (
          <>
            <div className="text-center mb-8">
              <p className="ology-pricing-context text-sm text-muted-foreground max-w-2xl mx-auto">
                Build your digital home on OlogyCrew. Every plan includes your profile, booking management, and customer messaging. Pro and Business add secure payment collection and invoicing — with no lead fees.
              </p>
            </div>

            <div className="ology-pricing-grid grid gap-6 md:grid-cols-3 mb-16">
              {providerPlans.map((plan) => {
                const isCurrent = providerCurrentTier === plan.tier && isProvider;
                const isDowngrade = isProvider && (
                  (providerCurrentTier === "premium" && plan.tier !== "premium") ||
                  (providerCurrentTier === "basic" && plan.tier === "free")
                );
                const price = yearly ? plan.yearlyPrice : plan.monthlyPrice;

                return (
                  <Card
                    key={plan.tier}
                    data-popular={!!plan.popular}
                    className={`ology-pricing-plan relative flex flex-col overflow-visible ${
                      plan.popular ? `${plan.borderColor} border-2 shadow-lg` : ""
                    } ${isCurrent ? "ring-2 ring-primary" : ""}`}
                  >
                    {plan.popular && (
                      <Badge className="ology-pricing-popular absolute -top-3 left-1/2 -translate-x-1/2 z-10 bg-blue-500 text-white border-0 px-4 py-1 shadow-sm">
                        Most Popular
                      </Badge>
                    )}
                    {isCurrent && (
                      <Badge className={`ology-pricing-current absolute ${plan.popular ? "top-4" : "-top-3"} left-1/2 -translate-x-1/2 z-10 bg-green-600 text-white border-0 px-3 py-1 shadow-sm whitespace-nowrap`}>
                        Current Plan
                      </Badge>
                    )}

                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`ology-pricing-plan-icon p-2 rounded-lg ${plan.bgColor}`}>
                          <plan.icon className={`h-5 w-5 ${plan.color}`} />
                        </div>
                        <CardTitle className="text-xl">{plan.name}</CardTitle>
                      </div>
                      <p className="text-sm text-muted-foreground">{plan.description}</p>
                    </CardHeader>

                    <CardContent className="flex-1 flex flex-col">
                      {/* Price */}
                      <div className="ology-pricing-plan-price mb-5">
                        {price === 0 ? (
                          <div className="text-3xl font-bold">Free</div>
                        ) : (
                          <div>
                            <span className="text-3xl font-bold">{formatPrice(price)}</span>
                            <span className="text-muted-foreground">/mo</span>
                            {yearly && (
                              <div className="ology-pricing-billing-note text-xs text-muted-foreground mt-1">
                                Billed {formatPrice(price * 12)}/year
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* CTA — same tier action and handler, now adjacent to the price */}
                      <div data-acquisition={!isCurrent && !isDowngrade} className="ology-pricing-plan-action">
                      {plan.tier === "free" ? (
                        isCurrent ? (
                          <Button variant="outline" disabled className="w-full">
                            Current Plan
                          </Button>
                        ) : isDowngrade ? (
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => {
                              setDowngradeTarget("free");
                              setShowDowngradeDialog(true);
                            }}
                            disabled={providerDowngrade.isPending}
                          >
                            Downgrade
                          </Button>
                        ) : (
                          <Button variant="outline" className="w-full" onClick={() => { if (!user) { localStorage.setItem("ologycrew_selected_plan", JSON.stringify({ tier: "free", name: "Starter", price: "0", interval: "month", audience: "provider" })); navigate("/signup?plan=free&audience=provider"); } else { navigate("/provider/onboarding"); } }}>
                            Get Started Free
                          </Button>
                        )
                      ) : isCurrent ? (
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => providerCreatePortal.mutate()}
                          disabled={providerCreatePortal.isPending}
                        >
                          {providerCreatePortal.isPending ? "Loading..." : "Manage Subscription"}
                        </Button>
                      ) : isDowngrade ? (
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => {
                            setDowngradeTarget(plan.tier);
                            setShowDowngradeDialog(true);
                          }}
                          disabled={providerDowngrade.isPending}
                        >
                         Downgrade
                      </Button>
                    ) : (
                       
                         <Button
                           className="w-full"
                           variant={plan.popular ? "default" : "outline"}
                           onClick={() => {
                             if (!user) {
                               localStorage.setItem("ologycrew_selected_plan", JSON.stringify({
                                 tier: plan.tier,
                                 name: plan.name,
                                 price: yearly ? plan.yearlyPrice.toFixed(2) : plan.monthlyPrice.toFixed(2),
                                 interval: yearly ? "year" : "month",
                                 audience: "provider",
                               }));
                               navigate(`/signup?plan=${plan.tier}&audience=provider`);
                               return;
                             }
                             providerCreateCheckout.mutate({
                               tier: plan.tier as "basic" | "premium",
                               interval: yearly ? "year" : "month",
                             });
                           }}
                           disabled={ALL_TRIALS_PAUSED || providerCreateCheckout.isPending}
                         >
                           {providerCreateCheckout.isPending ? (
                             <Loader2 className="h-4 w-4 animate-spin mr-2" />
                           ) : null}
                           {ALL_TRIALS_PAUSED ? "Unavailable during review" : providerCreateCheckout.isPending ? "Loading..." : (!user ? "Start 14-Day Free Trial" : `Select ${plan.name}`)}
                         </Button>
                       
                     )}
                      </div>

                      {/* Key highlights */}
                      <div className="ology-pricing-highlights rounded-lg border p-3 mb-5 space-y-2">
                        {plan.highlights.map((h, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <h.icon className={`h-4 w-4 shrink-0 ${plan.color}`} />
                            <span className="font-medium">{h.text}</span>
                          </div>
                        ))}
                      </div>

                      {/* Feature list */}
                      <ul className="ology-pricing-plan-features space-y-2 mb-6 flex-1">
                        {plan.features.map((feature, i) => (
                          <li key={i} className="flex items-center gap-2.5 text-sm">
                            {feature.included ? (
                              <Check className={`h-4 w-4 shrink-0 ${plan.color}`} />
                            ) : (
                              <X className="ology-pricing-excluded-icon h-4 w-4 shrink-0 text-muted-foreground/40" />
                            )}
                            <span className={feature.included ? "" : "ology-pricing-excluded text-muted-foreground/60"}>
                              {feature.text}
                            </span>
                          </li>
                        ))}
                      </ul>

                   </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}

        {/* ─── CUSTOMER PLANS ─────────────────────────────────────────────── */}
        {audience === "customer" && (
          <>
            <div className="text-center mb-8">
              <p className="ology-pricing-context text-sm text-muted-foreground max-w-xl mx-auto">
                Booking services on OlogyCrew is always free. Upgrade for priority access, organization tools, and analytics when you're managing multiple providers or large crews.
              </p>
              <div role="status" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                {ALL_TRIAL_PAUSE_MESSAGE} Existing customer subscriptions remain readable and are not automatically changed.
              </div>
            </div>

            <div className="ology-pricing-grid grid gap-6 md:grid-cols-3 mb-16">
              {customerPlans.map((plan) => {
                const isCurrent = customerCurrentTier === plan.tier;
                const isDowngrade = (customerCurrentTier === "business" && plan.tier !== "business") ||
                  (customerCurrentTier === "pro" && plan.tier === "free");
                const price = yearly ? plan.yearlyPrice : plan.monthlyPrice;

                return (
                  <Card
                    key={plan.tier}
                    data-popular={!!plan.popular}
                    className={`ology-pricing-plan relative flex flex-col overflow-visible ${
                      plan.popular ? `${plan.borderColor} border-2 shadow-lg` : ""
                    } ${isCurrent && user ? "ring-2 ring-primary" : ""}`}
                  >
                    {plan.popular && (
                      <Badge className="ology-pricing-popular absolute -top-3 left-1/2 -translate-x-1/2 z-10 bg-blue-500 text-white border-0 px-4 py-1 shadow-sm">
                        Most Popular
                      </Badge>
                    )}
                    {isCurrent && user && (
                      <Badge className={`ology-pricing-current absolute ${plan.popular ? "top-4" : "-top-3"} left-1/2 -translate-x-1/2 z-10 bg-green-600 text-white border-0 px-3 py-1 shadow-sm whitespace-nowrap`}>
                        Current Plan
                      </Badge>
                    )}

                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`ology-pricing-plan-icon p-2 rounded-lg ${plan.bgColor}`}>
                          <plan.icon className={`h-5 w-5 ${plan.color}`} />
                        </div>
                        <CardTitle className="text-xl">{plan.name}</CardTitle>
                      </div>
                      <p className="text-sm text-muted-foreground">{plan.description}</p>
                    </CardHeader>

                    <CardContent className="flex-1 flex flex-col">
                      {/* Price */}
                      <div className="ology-pricing-plan-price mb-5">
                        {price === 0 ? (
                          <div className="text-3xl font-bold">Free</div>
                        ) : (
                          <div>
                            <span className="text-3xl font-bold">{formatPrice(price)}</span>
                            <span className="text-muted-foreground">/mo</span>
                            {yearly && (
                              <div className="ology-pricing-billing-note text-xs text-muted-foreground mt-1">
                                Billed {formatPrice(price * 12)}/year
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* CTA — same tier action and handler, now adjacent to the price */}
                      <div data-acquisition={!isCurrent && !isDowngrade} className="ology-pricing-plan-action">
                      {plan.tier === "free" ? (
                        isCurrent && user ? (
                          <Button variant="outline" disabled className="w-full">
                            Current Plan
                          </Button>
                        ) : isDowngrade ? (
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => {
                              setDowngradeTarget("free");
                              setShowDowngradeDialog(true);
                            }}
                            disabled={customerDowngrade.isPending}
                          >
                            Downgrade
                          </Button>
                        ) : (
                          <Button variant="outline" className="w-full" onClick={() => { if (!user) { localStorage.setItem("ologycrew_selected_plan", JSON.stringify({ tier: "free", name: "Individual", price: "0", interval: "month", audience: "customer" })); navigate("/signup?plan=free&audience=customer"); } else { navigate("/browse"); } }}>
                            {user ? "Start Booking Free" : "Get Started Free"}
                          </Button>
                        )
                      ) : isCurrent ? (
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => customerCreatePortal.mutate()}
                          disabled={customerCreatePortal.isPending}
                        >
                          {customerCreatePortal.isPending ? "Loading..." : "Manage Subscription"}
                        </Button>
                      ) : isDowngrade ? (
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => {
                            setDowngradeTarget(plan.tier);
                            setShowDowngradeDialog(true);
                          }}
                          disabled={customerDowngrade.isPending}
                        >
                          Downgrade
                        </Button>
                      ) : audience === "customer" && ALL_TRIALS_PAUSED ? (
                        <Button className="w-full" variant="outline" disabled>
                          Trials unavailable during review
                        </Button>
                      ) : (
                          <Button
                           className="w-full"
                           variant={plan.popular ? "default" : "outline"}
                           onClick={() => {
                             if (!user) {
                                localStorage.setItem("ologycrew_selected_plan", JSON.stringify({
                                  tier: plan.tier,
                                  name: plan.name,
                                  price: yearly ? plan.yearlyPrice.toFixed(2) : plan.monthlyPrice.toFixed(2),
                                  interval: yearly ? "year" : "month",
                                  audience: "customer",
                                }));
                                navigate(`/signup?plan=${plan.tier}&audience=customer`);
                                return;
                              }
                             customerStartTrial.mutate({ tier: plan.tier as "pro" | "business" });
                            }}
                            disabled={customerStartTrial.isPending}
                          >
                            {customerStartTrial.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <Clock className="h-4 w-4 mr-2" />
                            )}
                            {customerStartTrial.isPending ? "Starting..." : "Start 14-Day Free Trial"}
                          </Button>
                        
                      )}
                      </div>

                      {/* Key highlights */}
                      <div className="ology-pricing-highlights rounded-lg border p-3 mb-5 space-y-2">
                        {plan.highlights.map((h, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <h.icon className={`h-4 w-4 shrink-0 ${plan.color}`} />
                            <span className="font-medium">{h.text}</span>
                          </div>
                        ))}
                      </div>

                      {/* Feature list */}
                      <ul className="ology-pricing-plan-features space-y-2 mb-6 flex-1">
                        {plan.features.map((feature, i) => (
                          <li key={i} className="flex items-center gap-2.5 text-sm">
                            {feature.included ? (
                              <Check className={`h-4 w-4 shrink-0 ${plan.color}`} />
                            ) : (
                              <X className="ology-pricing-excluded-icon h-4 w-4 shrink-0 text-muted-foreground/40" />
                            )}
                            <span className={feature.included ? "" : "ology-pricing-excluded text-muted-foreground/60"}>
                              {feature.text}
                            </span>
                          </li>
                        ))}
                      </ul>

                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}

        {/* ─── FAQ ────────────────────────────────────────────────────────── */}
        <div className="ology-pricing-faq">
          <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {audience === "provider" ? (
              <>
                {[
                  {
                    q: "What counts as a service category?",
                    a: "A category is a type of service you offer (e.g., Barber, Mobile Auto Detailing, Photography). Each category can have multiple individual services listed under it.",
                  },
                  {
                    q: "Can I accept payments on the free plan?",
                    a: "Secure Stripe payment collection and provider invoicing are included with Pro and Business. Starter providers can list services, manage bookings, and message customers, then upgrade when they are ready to collect payments through OlogyCrew.",
                  },
                  {
                    q: "What is the 1% transaction fee?",
                    a: "OlogyCrew takes a 1% fee when a Pro or Business provider collects a booking payment through the platform. Starter does not include Stripe payment collection, so the fee does not apply there.",
                  },
                  {
                    q: "Can I cancel or downgrade anytime?",
                    a: "Yes. A move to Starter is scheduled for the end of your current paid period, so you keep paid access until that date and can reactivate without another charge. Paid-tier or billing-interval changes apply to the existing Stripe subscription with proration.",
                  },
                  {
                    q: "Is there a free trial for Pro?",
                    a: "New provider trials are temporarily suspended while Stripe reviews OlogyCrew's account. Starter setup remains available, and existing subscription records are not automatically changed.",
                  },
                  {
                    q: "How do customers find my services?",
                    a: "Customers discover you through category browsing, search, and location-based results. Pro and Business plans get priority search placement to help you stand out.",
                  },
                ].map((faq, i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <h3 className="font-semibold mb-1">{faq.q}</h3>
                      <p className="text-sm text-muted-foreground">{faq.a}</p>
                    </CardContent>
                  </Card>
                ))}
              </>
            ) : (
              <>
                {[
                  {
                    q: "Is booking really free?",
                    a: "Yes! Browsing providers, booking services, messaging, and paying securely is completely free. You only pay for the services you book — no platform fees for customers.",
                  },
                  {
                    q: "Who needs the Coordinator or Manager plan?",
                    a: "If you book multiple providers regularly, manage events, or coordinate large crews (like a logistics manager with 100+ techs), the paid plans give you organization tools, priority access, and analytics.",
                  },
                  {
                    q: "What are saved providers?",
                    a: "Save your favorite providers for quick, easy rebooking. Individual users can save up to 5, Coordinator gets 50, and Manager gets unlimited.",
                  },
                  {
                    q: "Can I cancel anytime?",
                    a: "Yes. A move to Individual is scheduled for the end of your current paid period, so you keep paid access until that date and can reactivate without another charge. Paid-tier or billing-interval changes apply to the existing Stripe subscription with proration.",
                  },
                  {
                    q: "Is there a free trial for Coordinator or Manager?",
                    a: "New customer trials are temporarily suspended while Stripe reviews OlogyCrew's account. The Individual plan remains available, and existing subscription records are not automatically changed.",
                  },
                  {
                    q: "What payment methods do you accept?",
                    a: "We accept all major credit and debit cards through Stripe's secure payment processing.",
                  },
                  {
                    q: "How is my payment information protected?",
                    a: "All payments are processed through Stripe, a PCI-compliant payment processor. OlogyCrew never stores your card details — they're encrypted and handled entirely by Stripe.",
                  },
                ].map((faq, i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <h3 className="font-semibold mb-1">{faq.q}</h3>
                      <p className="text-sm text-muted-foreground">{faq.a}</p>
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </div>
        </div>


      </main>

      {/* ─── DOWNGRADE DIALOG ───────────────────────────────────────────── */}
      <Dialog open={showDowngradeDialog} onOpenChange={setShowDowngradeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Confirm Downgrade
            </DialogTitle>
            <DialogDescription className="text-left space-y-3 pt-2">
              <p>
                {downgradeTarget === "free" ? (
                  <>This change will take effect at the <strong>end of your current paid period</strong>. You keep your current plan until then and can reactivate it before that date without a new charge.</>
                ) : (
                  <>This paid-plan change takes effect <strong>immediately</strong>. Stripe applies the prorated billing adjustment to your existing subscription.</>
                )}
              </p>
              {audience === "provider" && downgradeTarget === "free" && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-200 mb-1">At the end of the paid period, you'll lose access to:</p>
                  <ul className="text-amber-700 dark:text-amber-300 space-y-1 text-xs">
                    <li>• Extra service categories (limited to 1)</li>
                    <li>• Extra services (limited to 3)</li>
                    <li>• Priority search placement</li>
                    <li>• Analytics dashboard</li>
                    <li>• Stripe payment collection and invoicing</li>
                  </ul>
                </div>
              )}
              {audience === "customer" && downgradeTarget === "free" && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-200 mb-1">At the end of the paid period, you'll lose access to:</p>
                  <ul className="text-amber-700 dark:text-amber-300 space-y-1 text-xs">
                    <li>• Priority booking requests</li>
                    <li>• Extra saved providers (limited to 5)</li>
                    <li>• Provider folders</li>
                    <li>• Bulk quote requests</li>
                  </ul>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowDowngradeDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (audience === "provider") {
                  providerDowngrade.mutate({ targetTier: downgradeTarget as "free" | "basic" });
                } else {
                  customerDowngrade.mutate({ targetTier: downgradeTarget as "free" | "pro" });
                }
              }}
              disabled={providerDowngrade.isPending || customerDowngrade.isPending}
            >
              {(providerDowngrade.isPending || customerDowngrade.isPending) ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Confirm Downgrade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
