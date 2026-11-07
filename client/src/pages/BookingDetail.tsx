import { useState, useMemo } from "react";
import { useParams, useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { formatDuration } from "../../../shared/duration";
import { formatTimeForDisplay } from "@shared/timeSlots";
import { formatPrice } from "@shared/formatPrice";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { NavHeader } from "@/components/shared/NavHeader";
import { OfflinePaymentPanel } from "@/components/OfflinePaymentPanel";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/dateUtils";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  DollarSign,
  User,
  Mail,
  Phone,
  MessageSquare,
  Star,
  CheckCircle2,
  XCircle,
  FileText,
  CreditCard,
  Send,
  CalendarPlus,
  Download,
  RefreshCw,
  RotateCcw,
  ListChecks,
  Heart,
} from "lucide-react";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  in_progress: "bg-purple-100 text-purple-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  no_show: "bg-gray-100 text-gray-800",
  refunded: "bg-orange-100 text-orange-800",
};

const sessionStatusColors: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  rescheduled: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  no_show: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

function BookingTipCard({ providerId, providerName }: { providerId: number; providerName: string }) {
  const { data: tipInfo } = trpc.provider.getPublicTipInfo.useQuery({ providerId });

  if (!tipInfo) return null;

  return (
    <Card className="border-pink-200 bg-gradient-to-br from-pink-50/50 to-white dark:from-pink-950/20 dark:to-background">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Heart className="h-5 w-5 text-pink-500 fill-pink-500" />
          Leave a Tip for {providerName}
        </CardTitle>
        <CardDescription>
          {tipInfo.tipThankYouMessage || "100% goes directly to them — zero platform fees"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {tipInfo.tipZelleHandle && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-muted border">
            <div className="flex items-center gap-2">
              <span>💲</span>
              <div>
                <p className="text-xs text-muted-foreground">Zelle</p>
                <p className="text-sm font-medium">{tipInfo.tipZelleHandle}</p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(tipInfo.tipZelleHandle!); toast.success("Copied Zelle info!"); }}>
              Copy
            </Button>
          </div>
        )}
        {tipInfo.tipCashAppHandle && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-muted border">
            <div className="flex items-center gap-2">
              <span>💵</span>
              <div>
                <p className="text-xs text-muted-foreground">Cash App</p>
                <p className="text-sm font-medium">{tipInfo.tipCashAppHandle}</p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(tipInfo.tipCashAppHandle!); toast.success("Copied Cash App tag!"); }}>
              Copy
            </Button>
          </div>
        )}
        {tipInfo.tipVenmoHandle && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-muted border">
            <div className="flex items-center gap-2">
              <span>🔵</span>
              <div>
                <p className="text-xs text-muted-foreground">Venmo</p>
                <p className="text-sm font-medium">{tipInfo.tipVenmoHandle}</p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(tipInfo.tipVenmoHandle!); toast.success("Copied Venmo username!"); }}>
              Copy
            </Button>
          </div>
        )}
        <p className="text-xs text-center text-muted-foreground pt-2">
          Open your preferred app and send directly to show your appreciation
        </p>
      </CardContent>
    </Card>
  );
}

export default function BookingDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [messageText, setMessageText] = useState("");
  const [rescheduleSessionId, setRescheduleSessionId] = useState<number | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleStartTime, setRescheduleStartTime] = useState("");
  const [rescheduleEndTime, setRescheduleEndTime] = useState("");
  const [sessionNotes, setSessionNotes] = useState("");
  const [showEditDuration, setShowEditDuration] = useState(false);
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const utils = trpc.useUtils();

  const bookingId = parseInt(id || "0");
  const { data, isLoading, error } = trpc.booking.getDetail.useQuery(
    { id: bookingId },
    { enabled: bookingId > 0 }
  );

  // A ledger row, not current provider settings, identifies an offline booking.
  // Null is the only successful read that permits the existing online card.
  const offlinePaymentQuery = trpc.offlinePayment.getForBooking.useQuery(
    { bookingId },
    { enabled: bookingId > 0 && !!data?.booking && !!user, retry: false }
  );
  const currentProviderQuery = trpc.provider.getMyProfile.useQuery(undefined, {
    enabled: !!user && !!data?.booking && data.booking.customerId !== user.id && user.role !== "admin",
    retry: false,
  });

  // Fetch sessions for multi-day/recurring bookings
  const isMultiSession = data?.booking?.bookingType && data.booking.bookingType !== "single";
  const { data: sessions } = trpc.booking.getSessions.useQuery(
    { bookingId },
    { enabled: bookingId > 0 && !!isMultiSession }
  );

  const updateStatus = trpc.booking.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Booking status updated");
      utils.booking.getDetail.invalidate({ id: bookingId });
    },
    onError: (e) => toast.error(e.message),
  });

  const updateSessionStatus = trpc.booking.updateSessionStatus.useMutation({
    onSuccess: () => {
      toast.success("Session status updated");
      utils.booking.getSessions.invalidate({ bookingId });
      utils.booking.getDetail.invalidate({ id: bookingId });
    },
    onError: (e) => toast.error(e.message),
  });

  const rescheduleSession = trpc.booking.rescheduleSession.useMutation({
    onSuccess: () => {
      toast.success("Session rescheduled successfully");
      setRescheduleSessionId(null);
      setRescheduleDate("");
      setRescheduleStartTime("");
      setRescheduleEndTime("");
      utils.booking.getSessions.invalidate({ bookingId });
      utils.booking.getDetail.invalidate({ id: bookingId });
    },
    onError: (e) => toast.error(e.message),
  });

  const editDuration = trpc.booking.editDuration.useMutation({
    onSuccess: (result) => {
      toast.success(`Duration updated! New total: $${result.newTotalAmount}`);
      setShowEditDuration(false);
      setEditStartTime("");
      setEditEndTime("");
      utils.booking.getDetail.invalidate({ id: bookingId });
    },
    onError: (e) => toast.error(e.message),
  });

  const sendMessage = trpc.message.send.useMutation({
    onSuccess: () => {
      toast.success("Message sent");
      setMessageText("");
      utils.booking.getDetail.invalidate({ id: bookingId });
    },
    onError: (e) => toast.error(e.message),
  });

  // Session summary stats
  const sessionStats = useMemo(() => {
    if (!sessions || sessions.length === 0) return null;
    const total = sessions.length;
    const completed = sessions.filter((s: any) => s.status === "completed").length;
    const cancelled = sessions.filter((s: any) => s.status === "cancelled").length;
    const rescheduled = sessions.filter((s: any) => s.status === "rescheduled").length;
    const scheduled = sessions.filter((s: any) => s.status === "scheduled").length;
    return { total, completed, cancelled, rescheduled, scheduled };
  }, [sessions]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-page">
        <NavHeader />
        <div className="container py-12">
          <LoadingSpinner message="Loading booking details..." />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-page">
        <NavHeader />
        <div className="container py-12 text-center">
          <p className="text-muted-foreground">Booking not found or access denied</p>
          <Button variant="outline" className="mt-4" onClick={() => setLocation("/provider/dashboard")}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const { booking, customer, service, payment, messages, review } = data;
  const provider = data.provider;
  const isCustomer = user && booking.customerId === user.id;
  const isProvider = !!user && !isCustomer && !currentProviderQuery.error && currentProviderQuery.data?.id === booking.providerId;
  // Customer-side views remain read-only, including an admin's own booking.
  // The backend independently enforces ownership/admin authority for mutations.
  const canManageOfflinePayment = !!user && !isCustomer && (isProvider || user.role === "admin");

  const handleSendMessage = () => {
    if (!messageText.trim() || !customer) return;
    sendMessage.mutate({
      recipientId: customer.id,
      messageText: messageText.trim(),
      bookingId: booking.id,
    });
  };

  const handleReschedule = (sessionId: number) => {
    if (!rescheduleDate || !rescheduleStartTime || !rescheduleEndTime) {
      toast.error("Please fill in all reschedule fields");
      return;
    }
    rescheduleSession.mutate({
      sessionId,
      bookingId,
      newDate: rescheduleDate,
      newStartTime: rescheduleStartTime,
      newEndTime: rescheduleEndTime,
    });
  };

  return (
    <div className="min-h-screen bg-page">
      <NavHeader />

      {/* Demo Mode Active Banner */}
      {(provider as any)?.isOfficial && (
        <div className="sticky top-0 z-50 bg-amber-700 text-white text-center py-2 px-4 shadow-md">
          <p className="text-sm font-semibold flex items-center justify-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-white animate-pulse" />
            Demo Mode Active — This is a free test booking. No charges will be applied.
          </p>
        </div>
      )}

      <div className="container py-8 max-w-5xl mx-auto px-4">
        {/* Back button + header */}
        <div className="flex items-center gap-2 sm:gap-4 mb-6 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold">{booking.bookingNumber}</h1>
              <Badge className={statusColors[booking.status] || "bg-gray-100"}>
                {booking.status.replace("_", " ")}
              </Badge>
              {booking.bookingSource === "quote" && (
                <Badge variant="outline" className="text-xs border-sky-300 text-sky-700 dark:text-sky-300">
                  From Quote
                </Badge>
              )}
              {booking.bookingType && booking.bookingType !== "single" && (
                <Badge variant="outline" className="text-xs">
                  {booking.bookingType === "multi_day" ? "Multi-Day" : "Recurring"}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Created {formatDate(booking.createdAt)}
            </p>
          </div>
          {/* Quick actions */}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setLocation(`/messages/${booking.id}`)}
            >
              <MessageSquare className="h-4 w-4 mr-1" />
              Message
            </Button>
            {booking.status === "pending" && (
              <>
                <Button
                  size="sm"
                  onClick={() => updateStatus.mutate({ id: booking.id, status: "confirmed" })}
                  disabled={updateStatus.isPending}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateStatus.mutate({ id: booking.id, status: "cancelled", cancellationReason: "Declined by provider" })}
                  disabled={updateStatus.isPending}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Decline
                </Button>
              </>
            )}
            {booking.status === "confirmed" && (
              <>
                <Button
                  size="sm"
                  onClick={() => updateStatus.mutate({ id: booking.id, status: "in_progress" })}
                  disabled={updateStatus.isPending}
                >
                  Start Service
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateStatus.mutate({ id: booking.id, status: "cancelled", cancellationReason: "Cancelled by provider" })}
                  disabled={updateStatus.isPending}
                >
                  Cancel
                </Button>
              </>
            )}
            {booking.status === "in_progress" && (
              <Button
                size="sm"
                onClick={() => updateStatus.mutate({ id: booking.id, status: "completed" })}
                disabled={updateStatus.isPending}
              >
                Mark Complete
              </Button>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Left column: Booking + Sessions + Payment */}
          <div className="md:col-span-2 space-y-6">
            {/* Booking Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Booking Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Service</p>
                    <p className="font-medium">{service?.name || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Date</p>
                    <p className="font-medium flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {booking.bookingDate ? new Date(booking.bookingDate).toLocaleDateString() : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Time</p>
                    <p className="font-medium flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {booking.startTime ? formatTimeForDisplay(booking.startTime) : "N/A"} {booking.endTime ? `- ${formatTimeForDisplay(booking.endTime)}` : ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Duration</p>
                    <p className="font-medium">{formatDuration(booking.durationMinutes)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Location Type</p>
                    <p className="font-medium capitalize flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {booking.locationType?.replace("_", " ") || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Amount</p>
                    <p className="font-medium text-lg flex items-center gap-1">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      {formatCurrency(parseFloat(booking.totalAmount || "0"))}
                    </p>
                  </div>
                </div>
                {booking.customerNotes && (
                  <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Customer Notes</p>
                    <p className="text-sm">{booking.customerNotes}</p>
                  </div>
                )}
                {(booking as any).venueName && (
                  <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Venue Name</p>
                    <p className="text-sm">{(booking as any).venueName}</p>
                  </div>
                )}
                {booking.serviceAddressLine1 && (
                  <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Service Address</p>
                    <p className="text-sm">{booking.serviceAddressLine1}{booking.serviceAddressLine2 ? `, ${booking.serviceAddressLine2}` : ""}</p>
                  </div>
                )}
                {booking.cancellationReason && (
                  <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-sm font-medium text-red-800 mb-1">Cancellation Reason</p>
                    <p className="text-sm text-red-700">{booking.cancellationReason}</p>
                  </div>
                )}
                {/* Add to Calendar / Download .ics */}
                {booking.status !== "cancelled" && (
                  <div className="mt-4 flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        window.open(`/api/calendar/booking/${booking.id}/download.ics`, "_blank");
                        toast.success("Calendar event downloaded");
                      }}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download .ics
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const title = encodeURIComponent(`${service?.name || "Service"} - OlogyCrew`);
                        const dateStr = booking.bookingDate.replace(/-/g, "");
                        const startStr = (booking.startTime || "00:00:00").replace(/:/g, "");
                        const endStr = (booking.endTime || "01:00:00").replace(/:/g, "");
                        const dates = `${dateStr}T${startStr}/${dateStr}T${endStr}`;
                        const details = encodeURIComponent(`Booking #${booking.bookingNumber}`);
                        const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}`;
                        window.open(gcalUrl, "_blank");
                      }}
                    >
                      <CalendarPlus className="h-4 w-4 mr-1" />
                      Add to Google Calendar
                    </Button>
                    {/* Edit Duration button - only for customer, pending/confirmed single bookings with hourly pricing */}
                    {booking.customerId === user?.id && ['pending', 'confirmed'].includes(booking.status) && booking.bookingType === 'single' && service?.pricingModel === 'hourly' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowEditDuration(!showEditDuration);
                          if (!showEditDuration) {
                            // Pre-fill with current times
                            setEditStartTime(booking.startTime?.slice(0, 5) || "");
                            setEditEndTime(booking.endTime?.slice(0, 5) || "");
                          }
                        }}
                      >
                        <Clock className="h-4 w-4 mr-1" />
                        {showEditDuration ? "Cancel Edit" : "Edit Duration"}
                      </Button>
                    )}
                  </div>
                )}

                {/* Edit Duration Form */}
                {showEditDuration && (
                  <div className="mt-4 border rounded-lg p-4 bg-muted/30 space-y-3">
                    <p className="text-sm font-medium">Change Service Duration</p>
                    <p className="text-xs text-muted-foreground">Adjust the start and end time. The total will be recalculated based on the provider's hourly rate ({service?.hourlyRate ? `$${service.hourlyRate}/hr` : 'N/A'}).</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Start Time</label>
                        <Input
                          type="time"
                          value={editStartTime}
                          onChange={(e) => setEditStartTime(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">End Time</label>
                        <Input
                          type="time"
                          value={editEndTime}
                          onChange={(e) => setEditEndTime(e.target.value)}
                        />
                      </div>
                    </div>
                    {editStartTime && editEndTime && (() => {
                      const [sH, sM] = editStartTime.split(":").map(Number);
                      const [eH, eM] = editEndTime.split(":").map(Number);
                      let mins = (eH * 60 + eM) - (sH * 60 + sM);
                      if (mins <= 0) mins += 24 * 60;
                      const hours = mins / 60;
                      const rate = parseFloat(service?.hourlyRate || "0");
                      const newTotal = hours * rate;
                      return (
                        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">New Duration</span>
                            <span className="font-medium">{formatDuration(mins)}</span>
                          </div>
                          <div className="flex justify-between text-sm mt-1">
                            <span className="text-muted-foreground">Rate</span>
                            <span className="font-medium">${service?.hourlyRate}/hr</span>
                          </div>
                          <div className="flex justify-between text-sm mt-1 font-semibold text-primary">
                            <span>New Estimated Total</span>
                            <span>{formatPrice(newTotal)}</span>
                          </div>
                        </div>
                      );
                    })()}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          if (!editStartTime || !editEndTime) {
                            toast.error("Please select both start and end times");
                            return;
                          }
                          editDuration.mutate({
                            bookingId: booking.id,
                            newStartTime: editStartTime,
                            newEndTime: editEndTime,
                          });
                        }}
                        disabled={editDuration.isPending || !editStartTime || !editEndTime}
                      >
                        {editDuration.isPending ? "Updating..." : "Save New Duration"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setShowEditDuration(false);
                          setEditStartTime("");
                          setEditEndTime("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Session Management for multi-day/recurring bookings */}
            {isMultiSession && sessions && sessions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ListChecks className="h-5 w-5 text-primary" />
                    Sessions ({sessions.length})
                  </CardTitle>
                  {sessionStats && (
                    <CardDescription className="flex gap-3 mt-1">
                      <span className="text-green-600">{sessionStats.completed} completed</span>
                      <span className="text-blue-600">{sessionStats.scheduled} scheduled</span>
                      {sessionStats.rescheduled > 0 && <span className="text-amber-700">{sessionStats.rescheduled} rescheduled</span>}
                      {sessionStats.cancelled > 0 && <span className="text-red-600">{sessionStats.cancelled} cancelled</span>}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {sessions.map((session: any) => (
                      <div
                        key={session.id}
                        className={`p-4 rounded-lg border ${
                          session.status === "rescheduled" ? "opacity-60 bg-muted/30" : "bg-card"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="text-center min-w-[48px]">
                              <p className="text-xs text-muted-foreground">Session</p>
                              <p className="text-lg font-bold">#{session.sessionNumber}</p>
                            </div>
                            <div>
                              <p className="font-medium">
                                {new Date(session.sessionDate).toLocaleDateString("en-US", {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </p>
                              <p className="text-sm text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatTimeForDisplay(session.startTime)} - {formatTimeForDisplay(session.endTime)}
                              </p>
                              {session.rescheduledFromDate && (
                                <p className="text-xs text-amber-700 mt-0.5">
                                  Rescheduled from {new Date(session.rescheduledFromDate).toLocaleDateString()}
                                </p>
                              )}
                              {session.providerNotes && (
                                <p className="text-xs text-muted-foreground mt-0.5 italic">
                                  Note: {session.providerNotes}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={sessionStatusColors[session.status] || "bg-gray-100"}>
                              {session.status}
                            </Badge>
                            {/* Action buttons for scheduled sessions */}
                            {session.status === "scheduled" && (
                              <div className="flex gap-1">
                                {isProvider && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                                      onClick={() => updateSessionStatus.mutate({
                                        sessionId: session.id,
                                        bookingId,
                                        status: "completed",
                                      })}
                                      disabled={updateSessionStatus.isPending}
                                      title="Mark completed"
                                    >
                                      <CheckCircle2 className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                      onClick={() => updateSessionStatus.mutate({
                                        sessionId: session.id,
                                        bookingId,
                                        status: "cancelled",
                                      })}
                                      disabled={updateSessionStatus.isPending}
                                      title="Cancel session"
                                    >
                                      <XCircle className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                  onClick={() => {
                                    setRescheduleSessionId(session.id);
                                    setRescheduleDate("");
                                    setRescheduleStartTime(session.startTime);
                                    setRescheduleEndTime(session.endTime);
                                  }}
                                  title="Reschedule session"
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Reschedule form */}
                        {rescheduleSessionId === session.id && (
                          <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                            <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2 flex items-center gap-1">
                              <RefreshCw className="h-4 w-4" />
                              Reschedule Session #{session.sessionNumber}
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div>
                                <label className="text-xs text-muted-foreground">New Date</label>
                                <Input
                                  type="date"
                                  value={rescheduleDate}
                                  onChange={(e) => setRescheduleDate(e.target.value)}
                                  min={new Date().toISOString().split("T")[0]}
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground">Start Time</label>
                                <Input
                                  type="time"
                                  value={rescheduleStartTime}
                                  onChange={(e) => setRescheduleStartTime(e.target.value)}
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground">End Time</label>
                                <Input
                                  type="time"
                                  value={rescheduleEndTime}
                                  onChange={(e) => setRescheduleEndTime(e.target.value)}
                                  className="h-8 text-sm"
                                />
                              </div>
                            </div>
                            <div className="flex gap-2 mt-2">
                              <Button
                                size="sm"
                                onClick={() => handleReschedule(session.id)}
                                disabled={rescheduleSession.isPending}
                                className="h-7 text-xs"
                              >
                                {rescheduleSession.isPending ? "Rescheduling..." : "Confirm Reschedule"}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setRescheduleSessionId(null)}
                                className="h-7 text-xs"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Payment Info */}
            {offlinePaymentQuery.error ? (
              <Card>
                <CardHeader><CardTitle className="text-lg">Payment information unavailable</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <p role="alert" className="text-sm text-destructive">Unable to verify this booking's payment record. No payment actions are available until it can be loaded.</p>
                  <Button variant="outline" size="sm" disabled={offlinePaymentQuery.isFetching} onClick={() => void offlinePaymentQuery.refetch()}>
                    {offlinePaymentQuery.isFetching ? "Retrying…" : "Retry payment information"}
                  </Button>
                </CardContent>
              </Card>
            ) : offlinePaymentQuery.data === undefined ? (
              <Card>
                <CardHeader><CardTitle className="text-lg">Payment Information</CardTitle></CardHeader>
                <CardContent><p role="status" className="text-sm text-muted-foreground">Loading payment information…</p></CardContent>
              </Card>
            ) : offlinePaymentQuery.data !== null ? (
              <OfflinePaymentPanel key={booking.id} payment={offlinePaymentQuery.data} canManage={canManageOfflinePayment} />
            ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Payment Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(provider as any)?.isOfficial ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                    <p className="text-sm font-medium text-amber-800">Demo Booking — No Payment Required</p>
                    <p className="text-xs text-amber-700 mt-1">This was a free demo to experience the booking flow.</p>
                  </div>
                ) : payment ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Payment Status</p>
                        <Badge className={payment.status === "captured" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                          {payment.status}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Amount</p>
                        <p className="font-medium">{formatCurrency(parseFloat(payment.amount || "0"))}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Platform Fee</p>
                        <p className="font-medium">{formatCurrency(parseFloat(booking.platformFee || "0"))}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Payment Method</p>
                        <p className="font-medium capitalize">{payment.paymentMethod || "Stripe"}</p>
                      </div>
                    </div>
                    {payment.status === "captured" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => window.open(`/api/receipt/${booking.id}/pdf`, "_blank")}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download Receipt
                      </Button>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">No payment recorded yet</p>
                )}
              </CardContent>
            </Card>
            )}

            {/* Messages */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  Messages ({messages.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {messages.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No messages yet</p>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto mb-4">
                    {messages.map((msg: any) => (
                      <div
                        key={msg.id}
                        className={`p-3 rounded-lg ${
                          msg.senderId === user?.id
                            ? "bg-primary/10 ml-8"
                            : "bg-muted mr-8"
                        }`}
                      >
                        <p className="text-sm">{msg.messageText}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(msg.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                {/* Send message */}
                {customer && booking.status !== "cancelled" && booking.status !== "refunded" && (
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Type a message..."
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      className="min-h-[60px]"
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!messageText.trim() || sendMessage.isPending}
                      className="self-end"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right column: Customer + Review */}
          <div className="space-y-6">
            {/* Customer Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Customer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {customer ? (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{customer.name || "Unknown"}</p>
                      </div>
                    </div>
                    {customer.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <a href={`mailto:${customer.email}`} className="text-primary hover:underline">
                          {customer.email}
                        </a>
                      </div>
                    )}
                    {customer.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <a href={`tel:${customer.phone}`} className="text-primary hover:underline">
                          {customer.phone}
                        </a>
                      </div>
                    )}
                    <Link href={`/messages/${booking.id}`}>
                      <Button variant="outline" size="sm" className="w-full mt-2">
                        <MessageSquare className="h-4 w-4 mr-1" />
                        Open Full Chat
                      </Button>
                    </Link>
                    {isCustomer && provider && (
                      <Link href={`/messages/${booking.id}`}>
                        <Button variant="default" size="sm" className="w-full mt-2">
                          <MessageSquare className="h-4 w-4 mr-1" />
                          Message Provider
                        </Button>
                      </Link>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground">Customer info unavailable</p>
                )}
              </CardContent>
            </Card>

            {/* Review */}
            {review && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Star className="h-5 w-5 text-amber-600" />
                    Customer Review
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-1 mb-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${i < review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
                      />
                    ))}
                    <span className="text-sm font-medium ml-1">{review.rating}/5</span>
                  </div>
                  {review.reviewText && (
                    <p className="text-sm text-muted-foreground">{review.reviewText}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Tip Provider - shown to customers on completed bookings */}
            {isCustomer && booking.status === "completed" && provider && (
              <BookingTipCard providerId={provider.id} providerName={provider.businessName} />
            )}

            {/* Status Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <div>
                      <p className="text-sm font-medium">Created</p>
                      <p className="text-xs text-muted-foreground">{formatDate(booking.createdAt)}</p>
                    </div>
                  </div>
                  {booking.confirmedAt && (
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <div>
                        <p className="text-sm font-medium">Confirmed</p>
                        <p className="text-xs text-muted-foreground">{formatDate(booking.confirmedAt)}</p>
                      </div>
                    </div>
                  )}
                  {booking.completedAt && (
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-green-600" />
                      <div>
                        <p className="text-sm font-medium">Completed</p>
                        <p className="text-xs text-muted-foreground">{formatDate(booking.completedAt)}</p>
                      </div>
                    </div>
                  )}
                  {booking.cancelledAt && (
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      <div>
                        <p className="text-sm font-medium">Cancelled</p>
                        <p className="text-xs text-muted-foreground">{formatDate(booking.cancelledAt)}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-gray-400" />
                    <div>
                      <p className="text-sm font-medium">Last Updated</p>
                      <p className="text-xs text-muted-foreground">{formatDate(booking.updatedAt)}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
