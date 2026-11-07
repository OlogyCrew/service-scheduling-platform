import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { formatDuration } from "../../../shared/duration";
import { formatPrice } from "@shared/formatPrice";
import { NavHeader } from "@/components/shared/NavHeader";
import "@/components/customer/CustomerWorkspaceTheme.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { 
  FileText, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  DollarSign,
  Calendar,
  MapPin,
  MessageSquare,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { getLoginUrl } from "@/const";

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Awaiting Quote", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300", icon: Clock },
  quoted: { label: "Quote Received", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", icon: DollarSign },
  accepted: { label: "Accepted", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", icon: CheckCircle2 },
  declined: { label: "Declined", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", icon: XCircle },
  expired: { label: "Expired", color: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300", icon: Clock },
  booked: { label: "Booked", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300", icon: CheckCircle2 },
};

export default function MyQuotes() {
  const { user, loading } = useAuth();
  const [declineQuoteId, setDeclineQuoteId] = useState<number | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [quotePaymentChoices, setQuotePaymentChoices] = useState<Record<number, "online" | "pay_at_location">>({});
  const utils = trpc.useUtils();

  const { data: quotes, isLoading } = trpc.provider.myQuotes.useQuery(undefined, {
    enabled: !!user,
  });

  const [, setLocation] = useLocation();
  const selectedQuote = quotes?.find((quote) => quote.id === Object.keys(quotePaymentChoices).map(Number).find((id) => quotePaymentChoices[id] === "pay_at_location"));
  const { data: selectedQuoteOffline } = trpc.offlinePayment.getProviderSettingsForService.useQuery(
    { providerId: selectedQuote?.providerId || 0, serviceId: selectedQuote?.serviceId || 0 },
    { enabled: !!selectedQuote?.providerId && !!selectedQuote?.serviceId }
  );

  const updateStatus = trpc.provider.updateQuoteStatus.useMutation({
    onSuccess: (data) => {
      utils.provider.myQuotes.invalidate();
      if (data.bookingId) {
        toast.success("Quote accepted! A booking has been created.", {
          action: {
            label: "View Booking",
            onClick: () => setLocation(`/bookings/${data.bookingId}`),
          },
          duration: 8000,
        });
      } else {
        toast.success("Quote updated");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  if (loading || isLoading) {
    return (
      <div className="ology-customer-utility-surface min-h-screen bg-page">
        <NavHeader />
        <div className="container max-w-4xl py-12">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-40 bg-muted rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="ology-customer-utility-surface min-h-screen bg-page">
        <NavHeader />
        <div className="container max-w-4xl py-12 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">Sign in to view your quotes</h2>
          <p className="text-muted-foreground mb-6">Track all your quote requests in one place</p>
          <a href={getLoginUrl()}>
            <Button>Sign In</Button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="ology-customer-utility-surface min-h-screen bg-page">
      <NavHeader />
      <div className="container max-w-4xl py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">My Quote Requests</h1>
            <p className="text-muted-foreground mt-1">Track and manage your custom service quotes</p>
          </div>
        </div>

        {!quotes || quotes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No quote requests yet</h3>
              <p className="text-muted-foreground mb-4">
                Browse providers and request custom quotes for services that need personalized pricing
              </p>
              <Link href="/browse">
                <Button>Browse Services</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {quotes.map((quote) => {
              const status = statusConfig[quote.status] || statusConfig.pending;
              const StatusIcon = status.icon;
              return (
                <Card key={quote.id} className="overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                          <h3 className="font-semibold text-base sm:text-lg truncate">{quote.title}</h3>
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{quote.description}</p>
                        
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          {quote.preferredDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {new Date(quote.preferredDate).toLocaleDateString()}
                              {quote.preferredTime && ` at ${quote.preferredTime}`}
                            </span>
                          )}
                          {quote.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {quote.location}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {new Date(quote.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Provider's Quote Response */}
                    {quote.status === "quoted" && quote.quotedAmount && (
                      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2">
                          <span className="font-semibold text-blue-800 dark:text-blue-300">Provider's Quote</span>
                          <span className="text-xl sm:text-2xl font-bold text-blue-900 dark:text-blue-200">
                            {formatPrice(parseFloat(quote.quotedAmount))}
                          </span>
                        </div>
                        {quote.quotedDurationMinutes && (
                          <p className="text-sm text-blue-700 dark:text-blue-400">
                            Estimated duration: {formatDuration(quote.quotedDurationMinutes)}
                          </p>
                        )}
                        {quote.providerNotes && (
                          <p className="text-sm text-blue-700 dark:text-blue-400 mt-2">
                            <MessageSquare className="h-3.5 w-3.5 inline mr-1" />
                            {quote.providerNotes}
                          </p>
                        )}
                        {quote.validUntil && (
                          <p className="text-xs text-blue-600 dark:text-blue-500 mt-2">
                            Valid until: {new Date(quote.validUntil).toLocaleDateString()}
                          </p>
                        )}
                        <div className="flex gap-2 mt-3">
                          <label className="flex items-center gap-2 text-xs">
                            <input type="radio" name={`quote-payment-${quote.id}`} checked={(quotePaymentChoices[quote.id] || "online") === "online"} onChange={() => setQuotePaymentChoices((v) => ({ ...v, [quote.id]: "online" }))} /> Pay online
                          </label>
                          <label className="flex items-center gap-2 text-xs">
                            <input type="radio" name={`quote-payment-${quote.id}`} checked={quotePaymentChoices[quote.id] === "pay_at_location"} onChange={() => setQuotePaymentChoices((v) => ({ ...v, [quote.id]: "pay_at_location" }))} disabled={!!selectedQuoteOffline && !selectedQuoteOffline.enabled && selectedQuote?.id === quote.id} /> Pay at Location
                          </label>
                          {quotePaymentChoices[quote.id] === "pay_at_location" && selectedQuote?.id === quote.id && selectedQuoteOffline?.enabled && <span className="text-xs text-muted-foreground">No card is charged. {selectedQuoteOffline.instructions || "Follow the provider's instructions."}</span>}
                          <Button
                            size="sm"
                            onClick={() => updateStatus.mutate({ quoteId: quote.id, status: "accepted", paymentMethod: quotePaymentChoices[quote.id] || "online" })}
                            disabled={updateStatus.isPending}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Accept Quote
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDeclineQuoteId(quote.id)}
                            disabled={updateStatus.isPending}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Decline
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Accepted quote - show booking link */}
                    {(quote.status === "accepted" || quote.status === "booked") && quote.quotedAmount && (
                      <div className="mt-4 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-green-800 dark:text-green-300">
                              {quote.status === "booked" ? "Booking Created" : "Quote Accepted"}
                            </p>
                            <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                              Amount: {formatPrice(parseFloat(quote.quotedAmount))}
                              {quote.quotedDurationMinutes && ` • ${quote.quotedDurationMinutes} min`}
                            </p>
                          </div>
                          {(quote as any).bookingId && (
                            <Link href={`/bookings/${(quote as any).bookingId}`}>
                              <Button size="sm" variant="outline" className="border-green-300 text-green-700 hover:bg-green-100">
                                <ExternalLink className="h-4 w-4 mr-1" />
                                View Booking
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    )}

                    {quote.status === "declined" && quote.declineReason && (
                      <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                        <p className="text-sm text-red-700 dark:text-red-400">
                          <strong>Reason:</strong> {quote.declineReason}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Decline Dialog */}
      <Dialog open={declineQuoteId !== null} onOpenChange={() => setDeclineQuoteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline Quote</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Reason for declining (optional)"
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineQuoteId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (declineQuoteId) {
                  updateStatus.mutate({ quoteId: declineQuoteId, status: "declined", reason: declineReason || undefined });
                  setDeclineQuoteId(null);
                  setDeclineReason("");
                }
              }}
            >
              Decline Quote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
