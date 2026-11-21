import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { NavHeader } from "@/components/shared/NavHeader";
import "@/components/customer/CustomerWorkspaceTheme.css";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  FileText,
  Download,
  CheckCircle,
  Clock,
  CreditCard,
  ArrowLeft,
  Receipt,
  Eye,
  Search,
  X,
} from "lucide-react";
import { Link, useSearch } from "wouter";
import { toast } from "sonner";
import { PROVIDER_PAYMENTS_PAUSED, PROVIDER_PAYMENT_PAUSE_MESSAGE } from "@shared/providerPaymentPause";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(date: string | Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-700", icon: FileText },
  sent: { label: "Pending", color: "bg-blue-100 text-blue-700", icon: Clock },
  viewed: { label: "Pending", color: "bg-purple-100 text-purple-700", icon: Eye },
  paid: { label: "Paid", color: "bg-green-100 text-green-700", icon: CheckCircle },
  overdue: { label: "Overdue", color: "bg-red-100 text-red-700", icon: Clock },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-500", icon: FileText },
};

export default function Receipts() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const searchParams = useSearch();
  const paidId = new URLSearchParams(searchParams).get("paid");

  const { data: receipts, refetch } = trpc.invoice.getMyReceipts.useQuery();
  const returnedPaymentConfirmed = !!paidId && !!receipts?.some((receipt) => String(receipt.id) === paidId && receipt.status === "paid");

  const payMutation = trpc.invoice.getPaymentLink.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const filteredReceipts = useMemo(() => {
    if (!receipts) return [];
    let results = receipts;
    // Apply status filter
    if (filter === "unpaid") results = results.filter((r) => ["sent", "viewed", "overdue"].includes(r.status));
    else if (filter !== "all") results = results.filter((r) => r.status === filter);
    // Apply search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      results = results.filter((r) =>
        (r.invoiceNumber || "").toLowerCase().includes(q) ||
        (r.customerName || "").toLowerCase().includes(q) ||
        (r.customerEmail || "").toLowerCase().includes(q) ||
        (r.notes || "").toLowerCase().includes(q)
      );
    }
    return results;
  }, [receipts, filter, searchQuery]);

  const stats = useMemo(() => {
    if (!receipts) return { total: 0, paid: 0, unpaid: 0 };
    return {
      total: receipts.length,
      paid: receipts.filter((r) => r.status === "paid").length,
      unpaid: receipts.filter((r) => ["sent", "viewed", "overdue"].includes(r.status)).length,
    };
  }, [receipts]);

  return (
    <div className="ology-customer-utility-surface min-h-screen bg-page">
      <NavHeader />
      <div className="container max-w-4xl py-8">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Receipts & Invoices</h1>
          <p className="text-muted-foreground text-sm">{PROVIDER_PAYMENTS_PAUSED ? "View your payment history and outstanding invoices. Online invoice payments are temporarily unavailable." : "View your payment history and pay outstanding invoices"}</p>
        </div>
      </div>

      {/* Success message for just-paid invoice */}
      {paidId && (
        <Card className="mb-6 border-green-200 bg-green-50">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="font-medium text-green-800">{returnedPaymentConfirmed ? "Payment confirmed" : "Payment status awaiting confirmation"}</p>
              <p className="text-sm text-green-700">{returnedPaymentConfirmed ? "The recorded invoice status is paid. Your payment history is shown below." : "Returning from checkout does not confirm payment. Check the recorded invoice status below; do not retry payment while online collection is paused."}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
        <Card>
          <CardContent className="p-2 sm:p-4 text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2 sm:p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.paid}</div>
            <div className="text-xs text-muted-foreground">Paid</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2 sm:p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.unpaid}</div>
            <div className="text-xs text-muted-foreground">Unpaid</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by invoice #, name, email, or description..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 pr-9"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {["all", "paid", "unpaid"].map((s) => (
          <Button
            key={s}
            variant={filter === s ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(s)}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </Button>
        ))}
      </div>

      {/* Receipt list */}
      {filteredReceipts.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">No receipts yet</h3>
            <p className="text-muted-foreground text-sm">
              Your payment receipts and invoices will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredReceipts.map((inv) => {
            const config = statusConfig[inv.status] || statusConfig.draft;
            const StatusIcon = config.icon;
            const isPayable = ["sent", "viewed", "overdue"].includes(inv.status) && inv.type === "invoice";

            return (
              <Card key={inv.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-sm font-medium">{inv.invoiceNumber}</span>
                        <Badge className={`${config.color} text-xs`}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {config.label}
                        </Badge>
                        {inv.type === "receipt" && (
                          <Badge variant="outline" className="text-xs">Receipt</Badge>
                        )}
                        {inv.type === "credit_note" && (
                          <Badge variant="outline" className="text-xs text-orange-600">Credit Note</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{formatDate(inv.createdAt)}</span>
                        {inv.paidAt && <span>Paid: {formatDate(inv.paidAt)}</span>}
                        {inv.dueDate && !inv.paidAt && <span>Due: {formatDate(inv.dueDate)}</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold">{formatCents(inv.total)}</div>
                      <div className="flex gap-1 mt-1">
                        {isPayable && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => { if (!PROVIDER_PAYMENTS_PAUSED) payMutation.mutate({ invoiceId: inv.id }); }}
                            disabled={payMutation.isPending || PROVIDER_PAYMENTS_PAUSED}
                            title={PROVIDER_PAYMENTS_PAUSED ? PROVIDER_PAYMENT_PAUSE_MESSAGE : undefined}
                          >
                            <CreditCard className="h-3 w-3 mr-1" />
                            {PROVIDER_PAYMENTS_PAUSED ? "Online Payments Paused" : "Pay Now"}
                          </Button>
                        )}
                        {inv.pdfUrl && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => window.open(inv.pdfUrl!, "_blank")}
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}
