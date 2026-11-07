import { useState, useMemo, useEffect, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { trpc } from "@/lib/trpc";
import { Calendar, Clock, MapPin, DollarSign, MessageSquare, XCircle, AlertTriangle, Loader2, Download, FileText, FileSpreadsheet, WifiOff, RefreshCw, Search, X, Trash2, RotateCcw, CalendarDays, Layers, Archive, Users, Play, ArrowUpDown, ListFilter, CheckCircle2, Eye, Globe } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import { getLoginUrl } from "@/const";
import { formatTimeForDisplay } from "@shared/timeSlots";
import { NavHeader } from "@/components/shared/NavHeader";
import { ProviderWorkspacePageHeader, ProviderWorkspaceShell } from "@/components/provider/ProviderWorkspaceShell";
import { CustomerWorkspacePageHeader, CustomerWorkspaceShell } from "@/components/customer/CustomerWorkspaceShell";
import { toast } from "sonner";
import { useOfflineBookings } from "@/hooks/useOfflineBookings";
import { useViewMode } from "@/contexts/ViewModeContext";
import { HelpTip } from "@/components/shared/HelpTip";
import { formatPrice } from "@shared/formatPrice";
import { formatDuration, DURATION_PRESETS } from "../../../shared/duration";
import { formatCurrency } from "@/lib/dateUtils";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BookingsSkeleton } from "@/components/DashboardSkeleton";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext, PaginationEllipsis } from "@/components/ui/pagination";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";

function BookingsPageFrame({
  providerMode,
  businessName,
  profileSlug,
  customersVisible,
  children,
}: {
  providerMode: boolean;
  businessName?: string | null;
  profileSlug?: string | null;
  customersVisible?: boolean;
  children: ReactNode;
}) {
  if (!providerMode) {
    return (
      <CustomerWorkspaceShell
        active="bookings"
        contentClassName="[&_[data-slot=card]]:rounded-2xl [&_[data-slot=card]]:border-slate-200 [&_[data-slot=card]]:shadow-[0_18px_50px_-42px_rgba(15,23,42,0.5)]"
      >
        {children}
      </CustomerWorkspaceShell>
    );
  }

  return (
    <ProviderWorkspaceShell
      active="bookings"
      businessName={businessName}
      profileSlug={profileSlug}
      isPageLive={Boolean(profileSlug)}
      customersVisible={customersVisible}
      contentClassName="[&_[data-slot=card]]:rounded-2xl [&_[data-slot=card]]:border-slate-200 [&_[data-slot=card]]:shadow-[0_18px_50px_-42px_rgba(15,23,42,0.5)]"
    >
      <ProviderWorkspacePageHeader
        eyebrow="Customer requests"
        title="Bookings"
        description="Review new requests, manage confirmed work, respond to quotes, and keep customer appointments moving."
        actions={(
          <Button asChild className="bg-white text-[#174a73] hover:bg-blue-50">
            <Link href="/provider/calendar"><Calendar className="mr-2 h-4 w-4" />Open calendar</Link>
          </Button>
        )}
      />
      <div className="mt-6">{children}</div>
    </ProviderWorkspaceShell>
  );
}

export default function MyBookings() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();
  const { canSwitch, isProviderView } = useViewMode();
  const bookingView = isProviderView ? "provider" : "customer";
  const requestedBookingTab = new URLSearchParams(window.location.search).get("tab");
  const defaultBookingTab = ["upcoming", "past", "drafts", "quotes"].includes(requestedBookingTab ?? "")
    ? requestedBookingTab!
    : "upcoming";
  const { data: customerSubscription } = trpc.customerSubscription.getSubscription.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const canExportBookings = bookingView === "customer" && customerSubscription?.currentTier === "business";

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Reset search/filters when role view changes
  useEffect(() => {
    setSearchQuery("");
  }, [bookingView]);

  // Hidden (deleted) bookings state — stored locally
  const [hiddenBookingIds, setHiddenBookingIds] = useState<Set<number>>(() => {
    try {
      const stored = localStorage.getItem("hiddenBookingIds");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Confirm delete dialog
  const [deleteBookingId, setDeleteBookingId] = useState<number | null>(null);
  const [deleteBookingLabel, setDeleteBookingLabel] = useState("");

  // Customer bookings (bookings I made)
  const { data: onlineBookings, isLoading, refetch } = trpc.booking.listMine.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // Provider bookings (bookings I received) — only fetch for providers
  const { data: receivedBookings, isLoading: isLoadingReceived, refetch: refetchReceived } = trpc.booking.listForProvider.useQuery(undefined, {
    enabled: isAuthenticated && canSwitch,
  });

  // Wire in offline bookings support
  const { bookings: rawBookings, isOffline, isUsingCache, cachedAt, cacheAge } = useOfflineBookings(
    bookingView === "customer" ? onlineBookings : receivedBookings,
    bookingView === "customer" ? isLoading : isLoadingReceived
  );

  // Filter out hidden bookings
  const bookings = useMemo(() => {
    if (!rawBookings) return [];
    return rawBookings.filter((b: any) => !hiddenBookingIds.has(b.id));
  }, [rawBookings, hiddenBookingIds]);

  // Search filter
  const filteredBookings = useMemo(() => {
    if (!bookings || !searchQuery.trim()) return bookings;
    const q = searchQuery.toLowerCase().trim();
    return bookings.filter((b: any) => {
      const bookingNum = (b.bookingNumber || "").toLowerCase();
      const serviceName = (b.serviceName || "").toLowerCase();
      const providerName = (b.providerName || "").toLowerCase();
      return bookingNum.includes(q) || serviceName.includes(q) || providerName.includes(q);
    });
  }, [bookings, searchQuery]);

  const hideBooking = (bookingId: number) => {
    const newHidden = new Set(hiddenBookingIds);
    newHidden.add(bookingId);
    setHiddenBookingIds(newHidden);
    localStorage.setItem("hiddenBookingIds", JSON.stringify(Array.from(newHidden)));
    setDeleteBookingId(null);
    toast.success("Booking removed from your list");
  };

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, bookingView]);

  // Count active demo bookings (pending/confirmed from official provider)
  const demoBookingCount = useMemo(() => {
    if (!bookings || bookingView !== "customer") return 0;
    return bookings.filter((b: any) =>
      (b.status === "pending" || b.status === "confirmed") &&
      b.providerName?.startsWith("Demo")
    ).length;
  }, [bookings, bookingView]);

  const utils = trpc.useUtils();
  const cancelAllDemo = trpc.booking.cancelAllDemo.useMutation({
    onSuccess: (data) => {
      toast.success(`Cleared ${data.cancelled} demo booking${data.cancelled !== 1 ? "s" : ""}!`);
      utils.booking.listMine.invalidate();
    },
    onError: (err: any) => toast.error(err.message || "Failed to clear demo bookings"),
  });

  // === Provider-specific state & mutations ===
  const { data: providerProfile } = trpc.provider.getMyProfile.useQuery(undefined, {
    enabled: isAuthenticated && canSwitch,
  });
  const { data: customersAccess } = trpc.customers.getAccess.useQuery(undefined, {
    enabled: isAuthenticated && isProviderView,
  });
  const { data: providerQuotes } = trpc.provider.providerQuotes.useQuery(undefined, {
    enabled: isAuthenticated && !!providerProfile,
  });
  const { data: quoteCount } = trpc.provider.quoteCount.useQuery(undefined, {
    enabled: isAuthenticated && !!providerProfile,
  });

  // Customer quotes (for customer view)
  const { data: customerQuotes } = trpc.provider.myQuotes.useQuery(undefined, {
    enabled: isAuthenticated && bookingView !== "provider",
  });

  const updateBookingStatus = trpc.booking.updateStatus.useMutation({
    onSuccess: () => {
      utils.booking.listForProvider.invalidate();
      toast.success("Booking updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteBookingRecord = trpc.booking.delete.useMutation({
    onSuccess: () => {
      utils.booking.listForProvider.invalidate();
      setDeletingBookingId(null);
      toast.success("Booking removed");
    },
    onError: (err) => toast.error(err.message),
  });

  const respondToQuote = trpc.provider.respondToQuote.useMutation({
    onSuccess: () => {
      utils.provider.providerQuotes.invalidate();
      utils.provider.quoteCount.invalidate();
      setRespondingQuoteId(null);
      setQuoteAmount("");
      setQuoteDuration("");
      setQuoteNotes("");
      setQuoteValidDays("7");
      toast.success("Quote sent to customer!");
    },
    onError: (err) => toast.error(err.message),
  });

  const declineQuoteRequest = trpc.provider.updateQuoteStatus.useMutation({
    onSuccess: () => {
      utils.provider.providerQuotes.invalidate();
      utils.provider.quoteCount.invalidate();
      toast.success("Quote request declined");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteQuoteRequest = trpc.provider.deleteQuote.useMutation({
    onSuccess: () => {
      utils.provider.providerQuotes.invalidate();
      utils.provider.quoteCount.invalidate();
      toast.success("Quote request deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  // Provider dialog state
  const [conflictBookingId, setConflictBookingId] = useState<number | null>(null);
  const [showConflictWarning, setShowConflictWarning] = useState(false);
  const [conflictData, setConflictData] = useState<any[]>([]);
  const [deletingBookingId, setDeletingBookingId] = useState<number | null>(null);
  const [respondingQuoteId, setRespondingQuoteId] = useState<number | null>(null);
  const [quoteAmount, setQuoteAmount] = useState("");
  const [quoteDuration, setQuoteDuration] = useState("");
  const [quoteNotes, setQuoteNotes] = useState("");
  const [quoteValidDays, setQuoteValidDays] = useState("7");

  // Provider action handlers
  const handleAcceptBooking = async (bookingId: number) => {
    try {
      const result = await utils.booking.checkConflicts.fetch({ bookingId });
      if (result && result.hasConflicts && result.conflicts.length > 0) {
        setConflictBookingId(bookingId);
        setConflictData(result.conflicts);
        setShowConflictWarning(true);
      } else {
        updateBookingStatus.mutate({ id: bookingId, status: "confirmed" });
      }
    } catch {
      updateBookingStatus.mutate({ id: bookingId, status: "confirmed" });
    }
  };

  const handleDeclineBooking = (bookingId: number) => {
    updateBookingStatus.mutate({ id: bookingId, status: "cancelled", cancellationReason: "Declined by provider" });
  };

  const handleStartService = (bookingId: number) => {
    updateBookingStatus.mutate({ id: bookingId, status: "in_progress" });
  };

  const handleCompleteBooking = (bookingId: number) => {
    updateBookingStatus.mutate({ id: bookingId, status: "completed" });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-page">
        <NavHeader />
        <div className="container max-w-7xl py-8">
          <BookingsSkeleton />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  const filterBookings = (status?: string[]) => {
    if (!filteredBookings) return [];
    if (!status) return filteredBookings;
    return filteredBookings.filter((b: any) => status.includes(b.status));
  };

  const upcomingBookings = filterBookings(bookingView === "provider" ? ["pending", "confirmed", "in_progress"] : ["pending", "confirmed"]);
  const pastBookings = filterBookings(["completed", "cancelled", "no_show", "refunded"]);

  // Pagination helper
  const paginateList = (list: any[]) => {
    const totalPages = Math.ceil(list.length / ITEMS_PER_PAGE);
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginated = list.slice(start, start + ITEMS_PER_PAGE);
    return { paginated, totalPages, total: list.length };
  };

  const formatCacheAge = (ms: number | null) => {
    if (!ms) return "";
    const minutes = Math.floor(ms / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="min-h-screen bg-page">
      <NavHeader />

      <BookingsPageFrame
        providerMode={bookingView === "provider" && canSwitch}
        businessName={providerProfile?.businessName}
        profileSlug={providerProfile?.profileSlug}
        customersVisible={customersAccess?.visible}
      >
        {/* Offline / Cached Data Banner */}
        {(isOffline || isUsingCache) && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <WifiOff className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    {isOffline ? "You're offline" : "Showing cached data"}
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    {isUsingCache && cachedAt
                      ? `Last synced ${formatCacheAge(cacheAge)}`
                      : "Your bookings will refresh when you're back online."}
                  </p>
                </div>
              </div>
              {!isOffline && (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/30"
                  onClick={() => {
                    bookingView === "customer" ? refetch() : refetchReceived();
                    toast.info("Refreshing bookings...");
                  }}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Refresh
                </Button>
              )}
            </div>
          </div>
        )}



        {bookingView !== "provider" || !canSwitch ? (
          <div className="mb-7">
            <CustomerWorkspacePageHeader
              eyebrow="Your service activity"
              title="My Bookings"
              description="Track upcoming work, past services, saved drafts, and provider quotes in one place."
              actions={(
                <>
                  <Button size="sm" className="gap-2 bg-white text-[#174a73] hover:bg-blue-50" onClick={() => setLocation("/bulk-booking")}>
                    <Layers className="h-4 w-4" />Bulk Book
                  </Button>
                  <Button size="sm" className="gap-2 bg-white text-[#174a73] hover:bg-blue-50" onClick={() => setLocation("/monthly-planner")}>
                    <CalendarDays className="h-4 w-4" />Planner
                  </Button>
                  {canExportBookings ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" className="gap-2 bg-white text-[#174a73] hover:bg-blue-50" disabled={isOffline}>
                          <Download className="h-4 w-4" />Export
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { window.open("/api/export/bookings/csv", "_blank"); toast.success("Downloading CSV..."); }}>
                          <FileSpreadsheet className="mr-2 h-4 w-4" />Download CSV
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { window.open("/api/export/bookings/pdf", "_blank"); toast.success("Generating PDF..."); }}>
                          <FileText className="mr-2 h-4 w-4" />Download PDF
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </>
              )}
            />
            <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
              <HelpTip text="Track all your bookings here. You can message providers, cancel bookings, or export your history. Click on any booking to see full details." variant="info" />
              <span>Use the tabs below to move between active work, history, drafts, and quotes.</span>
            </div>
            {demoBookingCount > 0 ? (
              <Button
                variant="outline"
                size="sm"
                className="mt-3 gap-2 border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800"
                onClick={() => cancelAllDemo.mutate()}
                disabled={cancelAllDemo.isPending}
              >
                <Trash2 className="h-4 w-4" />
                {cancelAllDemo.isPending ? "Clearing..." : `Clear All Demo Bookings (${demoBookingCount})`}
              </Button>
            ) : null}
          </div>
        ) : null}

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by booking #, service, or provider..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {searchQuery && (
            <p className="text-xs text-muted-foreground mt-1.5 ml-1">
              {filteredBookings?.length || 0} result{(filteredBookings?.length || 0) !== 1 ? "s" : ""} for "{searchQuery}"
            </p>
          )}
        </div>

        <SectionErrorBoundary fallbackTitle="Bookings couldn't load">
        <Tabs defaultValue={defaultBookingTab} className="space-y-6">
          <div className="overflow-x-auto -mx-1 px-1 pb-1">
          <TabsList>
            <TabsTrigger value="upcoming">
              New ({upcomingBookings.length})
            </TabsTrigger>
            <TabsTrigger value="past">
              Past ({pastBookings.length})
            </TabsTrigger>
            <TabsTrigger value="drafts">
              <Archive className="h-3.5 w-3.5 mr-1" />
              Drafts
            </TabsTrigger>
            <TabsTrigger value="quotes">
              <DollarSign className="h-3.5 w-3.5 mr-1" />
              Quotes {bookingView === "provider" && quoteCount && typeof quoteCount === "object" && quoteCount.total ? `(${quoteCount.total})` : customerQuotes ? `(${customerQuotes.length})` : ""}
            </TabsTrigger>
          </TabsList>
          </div>

          <TabsContent value="upcoming" className="space-y-4">
            {isLoading && !isUsingCache ? (
              <BookingsSkeleton />
            ) : upcomingBookings.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">
                    {searchQuery ? "No matching new bookings" : "No new bookings"}
                  </p>
                  {!searchQuery && (
                    <Button onClick={() => setLocation("/browse")} disabled={isOffline}>
                      Browse Services
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <>
                {paginateList(upcomingBookings).paginated.map((booking: any) => (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    setLocation={setLocation}
                    isOffline={isOffline}
                    isProviderView={bookingView === "provider"}
                    onAccept={bookingView === "provider" ? handleAcceptBooking : undefined}
                    onDecline={bookingView === "provider" ? handleDeclineBooking : undefined}
                    onStartService={bookingView === "provider" ? handleStartService : undefined}
                    onComplete={bookingView === "provider" ? handleCompleteBooking : undefined}
                    onRemove={bookingView === "provider" ? (id) => setDeletingBookingId(id) : undefined}
                    isUpdating={updateBookingStatus.isPending}
                  />
                ))}
                <BookingPagination
                  currentPage={currentPage}
                  totalPages={paginateList(upcomingBookings).totalPages}
                  total={paginateList(upcomingBookings).total}
                  perPage={ITEMS_PER_PAGE}
                  onPageChange={setCurrentPage}
                />
              </>
            )}
          </TabsContent>

          <TabsContent value="past" className="space-y-4">
            {isLoading && !isUsingCache ? (
              <BookingsSkeleton />
            ) : pastBookings.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">
                    {searchQuery ? "No matching past bookings" : "No past bookings"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {paginateList(pastBookings).paginated.map((booking: any) => (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    setLocation={setLocation}
                    isOffline={isOffline}
                    isProviderView={bookingView === "provider"}
                    canDelete={bookingView !== "provider"}
                    onDelete={(id, label) => {
                      setDeleteBookingId(id);
                      setDeleteBookingLabel(label);
                    }}
                    onRemove={bookingView === "provider" ? (id) => setDeletingBookingId(id) : undefined}
                    isUpdating={updateBookingStatus.isPending}
                  />
                ))}
                <BookingPagination
                  currentPage={currentPage}
                  totalPages={paginateList(pastBookings).totalPages}
                  total={paginateList(pastBookings).total}
                  perPage={ITEMS_PER_PAGE}
                  onPageChange={setCurrentPage}
                />
              </>
            )}
          </TabsContent>

          <TabsContent value="drafts" className="space-y-4">
            <SavedDraftsTab />
          </TabsContent>

          {/* Quotes Tab - Both Provider and Customer */}
          <TabsContent value="quotes" className="space-y-4">
            {bookingView === "provider" && canSwitch ? (
              <QuoteRequestsSection
                quotes={providerQuotes || []}
                onRespond={(id) => setRespondingQuoteId(id)}
                onDecline={(id) => declineQuoteRequest.mutate({ quoteId: id, status: "declined", reason: "Unable to fulfill this request" })}
                onDelete={(id) => {
                  if (confirm("Are you sure you want to delete this quote request? This cannot be undone.")) {
                    deleteQuoteRequest.mutate({ quoteId: id });
                  }
                }}
                isDeclinePending={declineQuoteRequest.isPending}
                isDeletePending={deleteQuoteRequest.isPending}
              />
            ) : (
              <CustomerQuotesSection />
            )}
          </TabsContent>
        </Tabs>
        </SectionErrorBoundary>
      </BookingsPageFrame>

      {/* Delete (Hide) Booking Confirmation */}
      <AlertDialog open={!!deleteBookingId} onOpenChange={(open) => !open && setDeleteBookingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove booking from list?</AlertDialogTitle>
            <AlertDialogDescription>
              This will hide <strong>{deleteBookingLabel}</strong> from your bookings list.
              The booking record will still exist for reference if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteBookingId) hideBooking(deleteBookingId);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Provider: Schedule Conflict Warning Dialog */}
      <Dialog open={showConflictWarning} onOpenChange={setShowConflictWarning}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
              Schedule Conflict Detected
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This booking overlaps with {conflictData.length} existing booking{conflictData.length > 1 ? "s" : ""}:
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {conflictData.map((conflict, i) => (
                <div key={i} className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                  <p className="font-medium text-sm">{conflict.serviceName}</p>
                  <p className="text-xs text-muted-foreground">
                    {conflict.bookingDate} &middot; {formatTimeForDisplay(conflict.startTime)} - {formatTimeForDisplay(conflict.endTime)}
                  </p>
                  <span className="text-xs px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">
                    {conflict.status}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-sm font-medium">
              Do you still want to accept this booking?
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConflictWarning(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (conflictBookingId) {
                  updateBookingStatus.mutate({ id: conflictBookingId, status: "confirmed" });
                }
                setShowConflictWarning(false);
                setConflictBookingId(null);
                setConflictData([]);
              }}
            >
              Accept Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Provider: Delete Booking Confirmation */}
      <Dialog open={!!deletingBookingId} onOpenChange={() => setDeletingBookingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Booking</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this booking from your list? This will permanently delete the booking record and any associated messages, reviews, and payment records. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingBookingId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deletingBookingId && deleteBookingRecord.mutate({ id: deletingBookingId })} disabled={deleteBookingRecord.isPending}>
              {deleteBookingRecord.isPending ? "Removing..." : "Remove Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Provider: Respond to Quote Dialog */}
      <Dialog open={respondingQuoteId !== null} onOpenChange={() => setRespondingQuoteId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Send Your Quote
            </DialogTitle>
            <DialogDescription>
              Provide your pricing and estimated duration for this service request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="quote-amount">Your Price ($) *</Label>
              <Input
                id="quote-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g., 150.00"
                value={quoteAmount}
                onChange={(e) => setQuoteAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quote-duration">Estimated Duration *</Label>
              <select
                id="quote-duration"
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={quoteDuration}
                onChange={(e) => setQuoteDuration(e.target.value)}
              >
                <option value="">Select duration...</option>
                {DURATION_PRESETS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quote-notes">Notes for Customer</Label>
              <Textarea
                id="quote-notes"
                placeholder="Any additional details about your quote..."
                value={quoteNotes}
                onChange={(e) => setQuoteNotes(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quote-valid">Quote Valid For (days)</Label>
              <Input
                id="quote-valid"
                type="number"
                min="1"
                max="30"
                value={quoteValidDays}
                onChange={(e) => setQuoteValidDays(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRespondingQuoteId(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!respondingQuoteId || !quoteAmount || !quoteDuration) {
                  toast.error("Please fill in price and duration");
                  return;
                }
                respondToQuote.mutate({
                  quoteId: respondingQuoteId,
                  quotedAmount: quoteAmount,
                  quotedDurationMinutes: parseInt(quoteDuration),
                  providerNotes: quoteNotes || undefined,
                  validDays: parseInt(quoteValidDays) || 7,
                });
              }}
              disabled={respondToQuote.isPending || !quoteAmount || !quoteDuration}
            >
              {respondToQuote.isPending ? "Sending..." : "Send Quote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BookingCard({
  booking,
  setLocation,
  isOffline,
  canDelete,
  onDelete,
  isProviderView,
  onAccept,
  onDecline,
  onStartService,
  onComplete,
  onRemove,
  isUpdating,
}: {
  booking: any;
  setLocation: (path: string) => void;
  isOffline: boolean;
  canDelete?: boolean;
  onDelete?: (id: number, label: string) => void;
  isProviderView?: boolean;
  onAccept?: (id: number) => void;
  onDecline?: (id: number) => void;
  onStartService?: (id: number) => void;
  onComplete?: (id: number) => void;
  onRemove?: (id: number) => void;
  isUpdating?: boolean;
}) {
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const utils = trpc.useUtils();

  const { data: service } = trpc.service.getById.useQuery({ id: booking.serviceId }, {
    enabled: !isOffline,
  });
  const { data: provider } = trpc.provider.getById.useQuery({ id: booking.providerId }, {
    enabled: !isOffline,
  });

  const cancelBooking = trpc.booking.cancel.useMutation({
    onSuccess: (data: any) => {
      toast.success(
        data.refundStatus === "full_refund" 
          ? "Booking cancelled. Full refund will be processed." 
          : data.refundStatus === "partial_refund"
          ? `Booking cancelled. Partial refund of ${formatPrice((data.refundAmount / 100))} will be processed.`
          : "Booking cancelled. No refund applicable per the cancellation policy."
      );
      utils.booking.listMine.invalidate();
      setShowCancelDialog(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      confirmed: "default",
      in_progress: "default",
      completed: "outline",
      cancelled: "destructive",
      no_show: "destructive",
      refunded: "outline",
    };

    return (
      <Badge variant={variants[status] || "default"}>
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  // Calculate refund eligibility
  const getRefundInfo = () => {
    const bookingDate = new Date(booking.bookingDate + 'T00:00:00');
    const now = new Date();
    const hoursUntilBooking = (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilBooking > 48) {
      return { type: "full", message: "Full refund — more than 48 hours before your appointment." };
    } else if (hoursUntilBooking > 24) {
      return { type: "partial", message: "50% refund — between 24-48 hours before your appointment." };
    } else {
      return { type: "none", message: "No refund — less than 24 hours before your appointment." };
    }
  };

  const refundInfo = getRefundInfo();
  const canCancel = !isOffline && (booking.status === "pending" || booking.status === "confirmed");

  // Use cached service/provider names from the booking object when offline
  const serviceName = service?.name || booking.serviceName || "Service";
  const providerName = provider?.businessName || booking.providerName || "Provider";

  const isDemo = (provider as any)?.isOfficial;

  return (
    <>
      <Card className={`${isOffline ? "opacity-90" : ""} ${isDemo ? "border-amber-200 bg-amber-50/30" : ""}`}>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-xl flex items-center gap-2 flex-wrap">
                {serviceName}
                {isDemo && (
                  <Badge className="bg-amber-100 text-amber-700 border-amber-300 text-[10px] font-semibold uppercase tracking-wide hover:bg-amber-100">
                    Demo Booking
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                by {providerName}
                {isDemo && <span className="text-amber-700 ml-1">(Demo Provider)</span>}
              </CardDescription>
              <p className="text-xs text-muted-foreground mt-1">
                Booking #{booking.bookingNumber}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(booking.status)}
              {!isProviderView && !isDemo && booking.status === "confirmed" && !(booking as any).paidAt && parseFloat(booking.totalAmount || "0") > 0 && (
                <Badge variant="outline" className="border-blue-300 text-blue-600 text-xs">Payment Due</Badge>
              )}
              {canDelete && onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(booking.id, `${serviceName} - #${booking.bookingNumber}`);
                  }}
                  title="Remove from list"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {booking.bookingType === "multi_day" && booking.endDate
                  ? `${formatDate(booking.bookingDate)} — ${formatDate(booking.endDate)}`
                  : formatDate(booking.bookingDate)}
              </span>
            </div>
            {booking.bookingType && booking.bookingType !== "single" && (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold">
                  {booking.bookingType === "multi_day"
                    ? `Multi-Day • ${booking.totalDays || "—"} days`
                    : `Recurring • ${booking.recurrenceTotalSessions || "—"} sessions`}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {formatTimeForDisplay(booking.startTime)} - {formatTimeForDisplay(booking.endTime)}
              </span>
            </div>
            {booking.locationType === "mobile" && booking.serviceAddressLine1 && (
              <div className="flex items-center gap-2 md:col-span-2">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm">
                  {booking.serviceAddressLine1}, {booking.serviceCity}, {booking.serviceState}
                </span>
              </div>
            )}
            {booking.totalPrice && (
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{isDemo ? <span className="text-amber-700 font-medium">FREE (Demo)</span> : `$${booking.totalPrice}`}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            {/* Provider Actions */}
            {isProviderView && booking.status === "pending" && onAccept && (
              <Button
                size="sm"
                onClick={() => onAccept(booking.id)}
                disabled={isUpdating}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Accept
              </Button>
            )}
            {isProviderView && booking.status === "pending" && onDecline && (
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => onDecline(booking.id)}
                disabled={isUpdating}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Decline
              </Button>
            )}
            {isProviderView && booking.status === "confirmed" && onStartService && (
              <Button
                size="sm"
                onClick={() => onStartService(booking.id)}
                disabled={isUpdating}
              >
                <Play className="h-4 w-4 mr-1" />
                Start Service
              </Button>
            )}
            {isProviderView && booking.status === "confirmed" && onDecline && (
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => onDecline(booking.id)}
                disabled={isUpdating}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            )}
            {isProviderView && booking.status === "in_progress" && onComplete && (
              <Button
                size="sm"
                onClick={() => onComplete(booking.id)}
                disabled={isUpdating}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Mark Complete
              </Button>
            )}

            {/* Customer Actions */}
            {!isProviderView && booking.status === "confirmed" && !(booking as any).paidAt && parseFloat(booking.totalAmount || "0") > 0 && (
              <Button 
                variant="default" 
                size="sm"
                onClick={() => setLocation(`/booking/${booking.id}`)}
                disabled={isOffline}
              >
                Pay Now
              </Button>
            )}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setLocation(`/booking/${booking.id}/detail`)}
              disabled={isOffline}
            >
              View Details
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setLocation(`/messages/${booking.id}`)}
            >
              <MessageSquare className="h-4 w-4 mr-1" />
              {isProviderView ? "Message" : "Message Provider"}
            </Button>
            {!isProviderView && canCancel && isDemo && (
              <Button 
                variant="outline" 
                size="sm"
                className="text-amber-700 border-amber-300 hover:bg-amber-50 hover:text-amber-800"
                onClick={() => cancelBooking.mutate({ bookingId: booking.id, reason: "Demo booking cancelled by user" })}
                disabled={cancelBooking.isPending}
              >
                <XCircle className="h-4 w-4 mr-2" />
                {cancelBooking.isPending ? "Cancelling..." : "Cancel Demo Booking"}
              </Button>
            )}
            {!isProviderView && canCancel && !isDemo && (
              <Button 
                variant="outline" 
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setShowCancelDialog(true)}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Cancel Booking
              </Button>
            )}
            {!isProviderView && !isOffline && booking.status === "completed" && !booking.reviewId && (
              <Button 
                variant="default" 
                size="sm"
                onClick={() => setLocation(`/booking/${booking.id}/review`)}
              >
                Leave Review
              </Button>
            )}
            {!isProviderView && !isOffline && ["completed", "cancelled", "no_show"].includes(booking.status) && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setLocation(`/service/${booking.serviceId}`)}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Book Again
              </Button>
            )}
            {/* Provider: Remove from list */}
            {isProviderView && ["completed", "cancelled", "no_show", "refunded"].includes(booking.status) && onRemove && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => onRemove(booking.id)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Remove
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cancel Booking Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Cancel Booking
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this booking?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Service info */}
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="font-medium">{serviceName}</p>
              <p className="text-sm text-muted-foreground">
                {formatDate(booking.bookingDate)} at {formatTimeForDisplay(booking.startTime)}
              </p>
              {booking.totalPrice && (
                <p className="text-sm font-medium mt-1">${booking.totalPrice}</p>
              )}
            </div>

            {/* Refund policy info */}
            <div className={`p-3 rounded-lg border ${
              refundInfo.type === "full" 
                ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800" 
                : refundInfo.type === "partial"
                ? "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800"
                : "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800"
            }`}>
              <p className={`text-sm font-medium ${
                refundInfo.type === "full" 
                  ? "text-green-700 dark:text-green-400" 
                  : refundInfo.type === "partial"
                  ? "text-amber-700 dark:text-amber-400"
                  : "text-red-700 dark:text-red-400"
              }`}>
                {refundInfo.type === "full" && "✓ "}
                {refundInfo.type === "partial" && "⚠ "}
                {refundInfo.type === "none" && "✗ "}
                {refundInfo.message}
              </p>
            </div>

            {/* Reason */}
            <div>
              <label className="text-sm font-medium mb-1 block">Reason for cancellation (optional)</label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-none"
                placeholder="Let the provider know why you're cancelling..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Keep Booking
            </Button>
            <Button 
              variant="destructive"
              onClick={() => cancelBooking.mutate({ 
                bookingId: booking.id,
                reason: cancelReason || "Customer requested cancellation",
              })}
              disabled={cancelBooking.isPending}
            >
              {cancelBooking.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                "Confirm Cancellation"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function QuoteRequestsSection({
  quotes,
  onRespond,
  onDecline,
  onDelete,
  isDeclinePending,
  isDeletePending,
}: {
  quotes: any[];
  onRespond: (id: number) => void;
  onDecline: (id: number) => void;
  onDelete: (id: number) => void;
  isDeclinePending: boolean;
  isDeletePending: boolean;
}) {
  if (!quotes || quotes.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground mb-2">No quote requests yet</p>
          <p className="text-sm text-muted-foreground">
            When customers request custom quotes, they'll appear here
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {quotes.map((quote: any) => (
        <Card key={quote.id} className={quote.status === "pending" ? "border-amber-300 bg-amber-50/30" : ""}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg">{quote.title}</CardTitle>
                <CardDescription className="mt-1">
                  From: {quote.customerName || "Customer"}
                  {quote.customerEmail && ` (${quote.customerEmail})`}
                </CardDescription>
              </div>
              <Badge variant={
                quote.status === "pending" ? "secondary" :
                quote.status === "quoted" ? "default" :
                quote.status === "accepted" ? "outline" :
                quote.status === "booked" ? "default" :
                "destructive"
              }>
                {quote.status === "pending" ? "Awaiting Your Quote" :
                 quote.status === "quoted" ? "Quote Sent" :
                 quote.status === "accepted" ? "Accepted" :
                 quote.status === "booked" ? "Booked" :
                 quote.status === "declined" ? "Declined" :
                 quote.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">{quote.description}</p>
            
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-4">
              {quote.preferredDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(quote.preferredDate).toLocaleDateString()}
                  {quote.preferredTime && ` at ${quote.preferredTime}`}
                </span>
              )}
              {quote.location && (
                <span className="flex items-center gap-1">
                  <Globe className="h-3.5 w-3.5" />
                  {quote.location}
                </span>
              )}
              {quote.locationType && (
                <span className="flex items-center gap-1">
                  {quote.locationType === "mobile" ? "Mobile" :
                   quote.locationType === "fixed_location" ? "At Location" :
                   "Virtual"}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {new Date(quote.createdAt).toLocaleDateString()}
              </span>
            </div>

            {/* Show quoted amount if already responded */}
            {quote.status === "quoted" && quote.quotedAmount && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800 mb-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-800 dark:text-blue-300">Your Quote</span>
                  <span className="text-lg font-bold text-blue-900 dark:text-blue-200">
                    {formatPrice(parseFloat(quote.quotedAmount))}
                  </span>
                </div>
                {quote.quotedDurationMinutes && (
                  <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                    Est. duration: {formatDuration(quote.quotedDurationMinutes)}
                  </p>
                )}
                {quote.providerNotes && (
                  <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">{quote.providerNotes}</p>
                )}
              </div>
            )}

            {/* Action buttons */}
            {quote.status === "pending" && (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => onRespond(quote.id)}
                >
                  <DollarSign className="h-4 w-4 mr-1" />
                  Send Quote
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDecline(quote.id)}
                  disabled={isDeclinePending}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Decline
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => onDelete(quote.id)}
                  disabled={isDeletePending}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </div>
            )}
            {quote.status !== "pending" && (
              <div className="flex justify-end mt-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => onDelete(quote.id)}
                  disabled={isDeletePending}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Customer Quotes Section - shows quotes the customer has requested
function CustomerQuotesSection() {
  const { data: quotes, isLoading } = trpc.provider.myQuotes.useQuery();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [quotePaymentChoices, setQuotePaymentChoices] = useState<Record<number, "online" | "pay_at_location">>({});
  const selectedQuote = quotes?.find((quote: any) => quotePaymentChoices[quote.id] === "pay_at_location");
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

  if (isLoading) {
    return <BookingsSkeleton />;
  }

  if (!quotes || quotes.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No quote requests yet</h3>
          <p className="text-muted-foreground mb-4">
            Browse providers and request custom quotes for services that need personalized pricing
          </p>
          <Button onClick={() => setLocation("/browse")}>Browse Services</Button>
        </CardContent>
      </Card>
    );
  }

  const statusConfig: Record<string, { label: string; color: string }> = {
    pending: { label: "Awaiting Quote", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
    quoted: { label: "Quote Received", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
    accepted: { label: "Accepted", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
    declined: { label: "Declined", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
    expired: { label: "Expired", color: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300" },
    booked: { label: "Booked", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
  };

  return (
    <div className="space-y-4">
      {quotes.map((quote: any) => {
        const status = statusConfig[quote.status] || statusConfig.pending;
        return (
          <Card key={quote.id}>
            <CardContent className="p-5">
              <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="font-semibold text-base truncate">{quote.title}</h3>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{quote.description}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {quote.preferredDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(quote.preferredDate).toLocaleDateString()}
                        {quote.preferredTime && ` at ${quote.preferredTime}`}
                      </span>
                    )}
                    {quote.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {quote.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Requested {new Date(quote.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Provider's Quote Response */}
              {quote.status === "quoted" && quote.quotedAmount && (
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2">
                    <span className="font-semibold text-blue-800 dark:text-blue-300">Provider's Quote</span>
                    <span className="text-xl font-bold text-blue-900 dark:text-blue-200">
                      ${(parseFloat(quote.quotedAmount) / 100).toFixed(2)}
                    </span>
                  </div>
                  {quote.quotedDurationMinutes && (
                    <p className="text-sm text-blue-700 dark:text-blue-400">
                      Estimated duration: {quote.quotedDurationMinutes} min
                    </p>
                  )}
                  {quote.providerNotes && (
                    <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
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
                      <input type="radio" name={`customer-quote-payment-${quote.id}`} checked={(quotePaymentChoices[quote.id] || "online") === "online"} onChange={() => setQuotePaymentChoices((v) => ({ ...v, [quote.id]: "online" }))} /> Pay online
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <input type="radio" name={`customer-quote-payment-${quote.id}`} checked={quotePaymentChoices[quote.id] === "pay_at_location"} onChange={() => setQuotePaymentChoices((v) => ({ ...v, [quote.id]: "pay_at_location" }))} disabled={!!selectedQuoteOffline && !selectedQuoteOffline.enabled && selectedQuote?.id === quote.id} /> Pay at Location
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
                      onClick={() => updateStatus.mutate({ quoteId: quote.id, status: "declined" })}
                      disabled={updateStatus.isPending}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Decline
                    </Button>
                  </div>
                </div>
              )}

              {/* Accepted/Booked */}
              {(quote.status === "accepted" || quote.status === "booked") && quote.quotedAmount && (
                <div className="mt-4 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-green-800 dark:text-green-300 text-sm">
                      {quote.status === "booked" ? "Booking Created" : "Quote Accepted"} — ${(parseFloat(quote.quotedAmount) / 100).toFixed(2)}
                    </p>
                    {quote.bookingId && (
                      <Button size="sm" variant="outline" className="text-xs" onClick={() => setLocation(`/bookings/${quote.bookingId}`)}>
                        View Booking
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {quote.status === "declined" && quote.declineReason && (
                <div className="mt-3 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
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
  );
}

function SavedDraftsTab() {
  const [, setLocation] = useLocation();
  const { data: drafts, isLoading } = trpc.bulkDraft.list.useQuery();
  const deleteDraft = trpc.bulkDraft.delete.useMutation();
  const utils = trpc.useUtils();
  const [sortBy, setSortBy] = useState<"modified" | "eventDate" | "name">("modified");
  const [filterType, setFilterType] = useState<string>("all");

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete draft "${name || "Untitled"}"? This cannot be undone.`)) return;
    try {
      await deleteDraft.mutateAsync({ id });
      utils.bulkDraft.list.invalidate();
      toast.success("Draft deleted");
    } catch {
      toast.error("Failed to delete draft");
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "No date set";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const formatUpdatedAt = (ts: string | Date) => {
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Get unique event types for the filter dropdown
  const eventTypes = useMemo(() => {
    if (!drafts) return [];
    const types = new Set<string>();
    drafts.forEach((d: any) => {
      if (d.eventType) types.add(d.eventType);
    });
    return Array.from(types).sort();
  }, [drafts]);

  // Filter and sort drafts
  const filteredAndSortedDrafts = useMemo(() => {
    if (!drafts) return [];
    let result = [...drafts];

    // Filter by event type
    if (filterType !== "all") {
      result = result.filter((d: any) => d.eventType === filterType);
    }

    // Sort
    result.sort((a: any, b: any) => {
      switch (sortBy) {
        case "eventDate": {
          const dateA = a.eventDate ? new Date(a.eventDate).getTime() : 0;
          const dateB = b.eventDate ? new Date(b.eventDate).getTime() : 0;
          return dateB - dateA; // Newest event date first
        }
        case "name": {
          const nameA = (a.name || "Untitled").toLowerCase();
          const nameB = (b.name || "Untitled").toLowerCase();
          return nameA.localeCompare(nameB);
        }
        case "modified":
        default: {
          const modA = new Date(a.updatedAt).getTime();
          const modB = new Date(b.updatedAt).getTime();
          return modB - modA; // Most recently modified first
        }
      }
    });

    return result;
  }, [drafts, filterType, sortBy]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!drafts || drafts.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Archive className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium mb-2">No drafts</p>
          <p className="text-muted-foreground mb-4">
            When you save a bulk booking as a draft, it will appear here so you can resume it later.
          </p>
          <Button onClick={() => setLocation("/bulk-booking")}>
            <Layers className="h-4 w-4 mr-2" />
            Start Bulk Booking
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with count + New button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filteredAndSortedDrafts.length} of {drafts.length} draft{drafts.length !== 1 ? "s" : ""}
        </p>
        <Button variant="outline" size="sm" onClick={() => setLocation("/bulk-booking")}>
          <Layers className="h-4 w-4 mr-2" />
          New Bulk Booking
        </Button>
      </div>

      {/* Filter & Sort Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="w-[160px] h-9 text-sm">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="modified">Last Modified</SelectItem>
              <SelectItem value="eventDate">Event Date</SelectItem>
              <SelectItem value="name">Name (A-Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {eventTypes.length > 0 && (
          <div className="flex items-center gap-2">
            <ListFilter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[170px] h-9 text-sm">
                <SelectValue placeholder="Event type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Event Types</SelectItem>
                {eventTypes.map((type) => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Draft Cards */}
      {filteredAndSortedDrafts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">No drafts match the selected filter.</p>
            <Button variant="link" size="sm" onClick={() => setFilterType("all")} className="mt-2">
              Clear filter
            </Button>
          </CardContent>
        </Card>
      ) : (
        filteredAndSortedDrafts.map((draft: any) => {
          const slots = Array.isArray(draft.slots) ? draft.slots : [];
          const providerCount = slots.length;

          return (
            <Card key={draft.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-base truncate">
                        {draft.name || "Untitled Draft"}
                      </h3>
                      {draft.eventType && (
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {draft.eventType}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(draft.eventDate)}
                      </span>
                      {draft.eventVenue && (
                        <span className="flex items-center gap-1 truncate max-w-[200px]">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          {draft.eventVenue}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {providerCount} provider{providerCount !== 1 ? "s" : ""}
                      </span>
                      <span className="text-xs text-muted-foreground/70">
                        Updated {formatUpdatedAt(draft.updatedAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => setLocation(`/bulk-booking?draft=${draft.id}`)}
                      className="gap-1.5"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Resume
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(draft.id, draft.name)}
                      disabled={deleteDraft.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}


function BookingPagination({
  currentPage,
  totalPages,
  total,
  perPage,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  total: number;
  perPage: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const start = (currentPage - 1) * perPage + 1;
  const end = Math.min(currentPage * perPage, total);

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("ellipsis");
      const rangeStart = Math.max(2, currentPage - 1);
      const rangeEnd = Math.min(totalPages - 1, currentPage + 1);
      for (let i = rangeStart; i <= rangeEnd; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push("ellipsis");
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t">
      <p className="text-sm text-muted-foreground">
        Showing {start}–{end} of {total} bookings
      </p>
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
            />
          </PaginationItem>
          {getPageNumbers().map((page, idx) =>
            page === "ellipsis" ? (
              <PaginationItem key={`ellipsis-${idx}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={page}>
                <PaginationLink
                  isActive={page === currentPage}
                  onClick={() => onPageChange(page)}
                  className="cursor-pointer"
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            )
          )}
          <PaginationItem>
            <PaginationNext
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
