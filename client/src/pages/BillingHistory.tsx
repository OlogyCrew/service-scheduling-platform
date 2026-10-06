import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { NavHeader } from "@/components/shared/NavHeader";
import "./BillingHistory.css";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Download,
  CreditCard,
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Sparkles,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { Link } from "wouter";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getStatusBadge(status: string) {
  switch (status) {
    case "paid":
      return (
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0">
          <CheckCircle className="h-3 w-3 mr-1" />
          Paid
        </Badge>
      );
    case "pending":
    case "open":
      return (
        <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-0">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    case "failed":
    case "uncollectible":
      return (
        <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0">
          <XCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    case "voided":
      return (
        <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400 border-0">
          <XCircle className="h-3 w-3 mr-1" />
          Voided
        </Badge>
      );
    case "active":
      return (
        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0">
          <Sparkles className="h-3 w-3 mr-1" />
          Active
        </Badge>
      );
    case "ended":
      return (
        <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400 border-0">
          <Clock className="h-3 w-3 mr-1" />
          Ended
        </Badge>
      );
    case "scheduled":
      return (
        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-0">
          <Clock className="h-3 w-3 mr-1" /> Scheduled
        </Badge>
      );
    case "action_required":
      return (
        <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-0">
          <AlertCircle className="h-3 w-3 mr-1" /> Action required
        </Badge>
      );
    default:
      return (
        <Badge variant="outline">
          <AlertCircle className="h-3 w-3 mr-1" />
          {status}
        </Badge>
      );
  }
}

function getTypeIcon(type: string) {
  switch (type) {
    case "invoice":
      return <FileText className="h-5 w-5 text-blue-500" />;
    case "trial":
      return <Sparkles className="h-5 w-5 text-purple-500" />;
    case "subscription_change":
      return <RefreshCw className="h-5 w-5 text-indigo-500" />;
    case "payment":
      return <CreditCard className="h-5 w-5 text-green-500" />;
    case "refund":
      return <CreditCard className="h-5 w-5 text-orange-500" />;
    default:
      return <FileText className="h-5 w-5 text-muted-foreground" />;
  }
}

export default function BillingHistory() {
  const { user } = useAuth();
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  const { data, isLoading, error } = trpc.subscription.billingHistory.useQuery(
    cursor ? { limit: 25, startingAfter: cursor } : { limit: 25 }
  );

  const subscriptionSummary = trpc.subscription.mySubscription.useQuery();

  if (!user) {
    return (
      <div className="ology-billing-page min-h-screen bg-page">
        <NavHeader />
        <div className="container py-12 text-center">
          <p className="text-muted-foreground">Please log in to view billing history.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ology-billing-page min-h-screen bg-page">
      <NavHeader />
      <div className="ology-billing-content container max-w-4xl py-6 px-4">
        {/* Header */}
        <div className="ology-billing-heading flex items-center gap-3 mb-6">
          <Link href="/provider/subscription">
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Back to provider subscription">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Provider Billing History</h1>
            <p className="text-sm text-muted-foreground">
              View your subscription charges, plan changes, and payment history
            </p>
          </div>
        </div>

        {/* Current Plan Summary */}
        {subscriptionSummary.data && (
          <Card className="ology-billing-summary mb-6 border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="ology-billing-summary-icon w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">
                      Current Plan: <span>{subscriptionSummary.data.currentTier === "premium" ? "Business" : subscriptionSummary.data.currentTier === "basic" ? "Pro" : "Starter"}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {subscriptionSummary.data.entitlement.state === "trialing" && subscriptionSummary.data.entitlement.accessEndsAt
                        ? `Trial access through ${formatDate(subscriptionSummary.data.entitlement.accessEndsAt.toISOString())}`
                        : subscriptionSummary.data.entitlement.state === "cancelling" && subscriptionSummary.data.entitlement.accessEndsAt
                        ? `${subscriptionSummary.data.currentTier === "premium" ? "Business" : "Pro"} remains active through ${formatDate(subscriptionSummary.data.entitlement.accessEndsAt.toISOString())}; Starter begins after`
                        : subscriptionSummary.data.entitlement.state === "past_due_grace" && subscriptionSummary.data.entitlement.accessEndsAt
                        ? `Payment due — paid access available through ${formatDate(subscriptionSummary.data.entitlement.accessEndsAt.toISOString())}`
                        : subscriptionSummary.data.entitlement.requiresBillingAction
                        ? "Billing action required to restore paid access"
                        : subscriptionSummary.data.currentTier === "free"
                        ? "Starter plan active"
                        : "Active paid subscription"}
                    </p>
                  </div>
                </div>
                <Link href="/provider/subscription">
                  <Button variant="outline" size="sm">
                    Manage Subscription
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Billing Items */}
        <Card className="ology-billing-transactions">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Transaction History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4 p-4 rounded-lg bg-muted/30 animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-48 bg-muted rounded" />
                      <div className="h-3 w-32 bg-muted rounded" />
                    </div>
                    <div className="h-4 w-16 bg-muted rounded" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Unable to load billing history.</p>
                <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
              </div>
            ) : !data?.items?.length ? (
              <div className="text-center py-12">
                <CreditCard className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground font-medium">No billing history yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your subscription charges and plan changes will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
               {data.items.map((item, idx) => (
                 <div
                   key={item.id}
                    className={`ology-billing-row flex flex-col gap-2 p-4 rounded-lg hover:bg-muted/30 transition-colors ${
                     idx < data.items.length - 1 ? "border-b border-border/50" : ""
                   }`}
                 >
                    {/* Row 1: Icon + Description + Amount */}
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-muted/50 flex items-center justify-center shrink-0 mt-0.5">
                        {getTypeIcon(item.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm leading-snug">{item.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(item.date)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {item.amount !== null && item.amount > 0 ? (
                          <p className="font-semibold text-sm">{formatCents(item.amount)}</p>
                        ) : item.amount === null ? (
                          <p className="text-sm text-muted-foreground">—</p>
                        ) : (
                          <p className="text-sm text-muted-foreground">$0.00</p>
                        )}
                      </div>
                    </div>
                    {/* Row 2: Status + Download (aligned under description) */}
                    <div className="flex items-center gap-2 pl-12">
                      {getStatusBadge(item.status)}
                      {item.invoicePdfUrl && (
                        <a
                          href={item.invoicePdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground transition-colors ml-auto"
                          title="Download Invoice PDF"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      )}
                   </div>
                 </div>
                ))}

                {/* Load More */}
                {data.hasMore && (
                  <div className="pt-4 text-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (data.nextCursor) setCursor(data.nextCursor);
                      }}
                    >
                      Load More
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stripe Portal Link */}
        <div className="mt-4 text-center">
          <p className="text-xs text-muted-foreground">
            Need to update your payment method or download older invoices?{" "}
            <Link href="/provider/subscription" className="text-primary hover:underline">
              Manage Subscription
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
