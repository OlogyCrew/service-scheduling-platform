import { useState, useMemo, useEffect } from "react";
import { formatPrice } from "@shared/formatPrice";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NavHeader } from "@/components/shared/NavHeader";
import {
  ProviderWorkspaceBackground,
  ProviderWorkspacePageHeader,
  ProviderWorkspaceShell,
} from "@/components/provider/ProviderWorkspaceShell";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  User,
  Ban,
  Trash2,
  Plus,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
} from "lucide-react";

type ViewMode = "month" | "week";

interface CalendarEvent {
  id: number;
  bookingNumber: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  status: string;
  serviceName: string | null;
  customerName: string | null;
  locationType: string | null;
  totalAmount: string | null;
  venueName?: string | null;
  isSession?: boolean;
  sessionNumber?: number;
  totalSessions?: number;
  sessionStatus?: string;
  parentBookingId?: number;
}

interface BlockedDate {
  id: number;
  overrideDate: string;
  startTime: string | null;
  endTime: string | null;
  isAvailable: boolean;
  reason: string | null;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  pending: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  confirmed: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  in_progress: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  completed: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  cancelled: { bg: "bg-red-50", text: "text-red-700 line-through", border: "border-red-200" },
  scheduled: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  rescheduled: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  blocked: { bg: "bg-gray-100", text: "text-gray-500", border: "border-gray-300" },
};

function getStatusColor(status: string) {
  return STATUS_COLORS[status] || { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200" };
}

function formatTime(time: string): string {
  if (!time) return "";
  const [h, m] = time.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function getWeekDates(date: Date): Date[] {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay());
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ProviderCalendar() {
  const { user, loading: authLoading } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(() => new Date(2000, 0, 1));
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [blockForm, setBlockForm] = useState({
    date: "",
    allDay: true,
    startTime: "09:00",
    endTime: "17:00",
    reason: "",
  });

  const [copied, setCopied] = useState(false);
  const [showSyncPanel, setShowSyncPanel] = useState(false);
  const utils = trpc.useUtils();

  useEffect(() => {
    setCurrentDate(new Date());
  }, []);

  const { data: calendarData, isLoading } = trpc.booking.calendarEvents.useQuery(undefined, {
    enabled: !!user,
  });

  const { data: providerProfile } = trpc.provider.getMyProfile.useQuery(undefined, {
    enabled: !!user,
  });

  const { data: customersAccess } = trpc.customers.getAccess.useQuery(undefined, {
    enabled: !!user,
  });

  const { data: feedData } = trpc.provider.getCalendarFeedUrl.useQuery(undefined, {
    enabled: !!user,
  });

  const createOverride = trpc.availability.createOverride.useMutation({
    onSuccess: () => {
      toast.success("Time blocked successfully");
      utils.booking.calendarEvents.invalidate();
      setShowBlockDialog(false);
      setBlockForm({ date: "", allDay: true, startTime: "09:00", endTime: "17:00", reason: "" });
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteOverride = trpc.availability.deleteOverride.useMutation({
    onSuccess: () => {
      toast.success("Block removed");
      utils.booking.calendarEvents.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  // Build blocked dates map from overrides
  const blockedDatesMap = useMemo(() => {
    const map = new Map<string, BlockedDate[]>();
    if (!calendarData?.overrides) return map;
    for (const override of calendarData.overrides) {
      if (!override.isAvailable) {
        const dateKey = override.overrideDate;
        if (!map.has(dateKey)) map.set(dateKey, []);
        map.get(dateKey)!.push(override as BlockedDate);
      }
    }
    return map;
  }, [calendarData]);

  const eventsMap = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    if (!calendarData) return map;

    const bookingsWithSessions = new Set(
      calendarData.sessions.map((s: any) => s.bookingId)
    );

    for (const booking of calendarData.bookings) {
      if (bookingsWithSessions.has(booking.id)) continue;
      const dateKey = booking.bookingDate;
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push({
        id: booking.id,
        bookingNumber: booking.bookingNumber,
        bookingDate: booking.bookingDate,
        startTime: booking.startTime || "",
        endTime: booking.endTime || "",
        status: booking.status,
        serviceName: booking.serviceName,
        customerName: booking.customerName,
        locationType: booking.locationType,
        totalAmount: booking.totalAmount,
        venueName: (booking as any).venueName || null,
      });
    }

    for (const session of calendarData.sessions) {
      const dateKey = session.sessionDate;
      if (!dateKey) continue;
      const parent = session.parentBooking;
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push({
        id: session.bookingId,
        bookingNumber: parent?.bookingNumber || `BK-${session.bookingId}`,
        bookingDate: session.sessionDate,
        startTime: session.startTime || parent?.startTime || "",
        endTime: session.endTime || parent?.endTime || "",
        status: session.status || parent?.status || "scheduled",
        serviceName: parent?.serviceName || null,
        customerName: parent?.customerName || null,
        locationType: parent?.locationType || null,
        totalAmount: parent?.totalAmount || null,
        venueName: (parent as any)?.venueName || null,
        isSession: true,
        sessionNumber: session.sessionNumber,
        totalSessions: session.totalSessions || undefined,
        sessionStatus: session.status,
        parentBookingId: session.bookingId,
      });
    }

    map.forEach((events) => {
      events.sort((a: CalendarEvent, b: CalendarEvent) => a.startTime.localeCompare(b.startTime));
    });

    return map;
  }, [calendarData]);

  const stats = useMemo(() => {
    if (!calendarData) return { total: 0, pending: 0, confirmed: 0, completed: 0, blocked: 0 };
    const bookings = calendarData.bookings || [];
    const blockedCount = calendarData.overrides?.filter((o: any) => !o.isAvailable).length || 0;
    return {
      total: bookings.length,
      pending: bookings.filter((b: any) => b.status === "pending").length,
      confirmed: bookings.filter((b: any) => b.status === "confirmed").length,
      completed: bookings.filter((b: any) => b.status === "completed").length,
      blocked: blockedCount,
    };
  }, [calendarData]);

  // Upcoming blocked dates for sidebar
  const upcomingBlocks = useMemo(() => {
    if (!calendarData?.overrides) return [];
    const today = formatDateKey(new Date());
    return calendarData.overrides
      .filter((o: any) => !o.isAvailable && o.overrideDate >= today)
      .sort((a: any, b: any) => a.overrideDate.localeCompare(b.overrideDate))
      .slice(0, 5);
  }, [calendarData]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-page">
        <NavHeader />
        <ProviderWorkspaceBackground>
          <div className="container max-w-7xl py-8">
            <div className="grid animate-pulse gap-6 lg:grid-cols-[232px_minmax(0,1fr)]">
              <div className="hidden h-96 rounded-2xl bg-slate-100 lg:block" />
              <div className="space-y-5"><div className="h-36 rounded-[26px] bg-slate-200" /><div className="h-96 rounded-2xl bg-slate-100" /></div>
            </div>
          </div>
        </ProviderWorkspaceBackground>
      </div>
    );
  }

  if (!user) {
    window.location.href = getLoginUrl();
    return null;
  }

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const navigateMonth = (direction: number) => {
    const newDate = new Date(currentDate);
    if (viewMode === "month") {
      newDate.setMonth(newDate.getMonth() + direction);
    } else {
      newDate.setDate(newDate.getDate() + direction * 7);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => setCurrentDate(new Date());
  const todayKey = formatDateKey(new Date());

  const openBlockDialog = (dateKey?: string) => {
    setBlockForm({
      date: dateKey || formatDateKey(new Date()),
      allDay: true,
      startTime: "09:00",
      endTime: "17:00",
      reason: "",
    });
    setShowBlockDialog(true);
  };

  const handleBlockTime = () => {
    if (!blockForm.date) {
      toast.error("Please select a date");
      return;
    }
    createOverride.mutate({
      overrideDate: blockForm.date,
      startTime: blockForm.allDay ? undefined : blockForm.startTime,
      endTime: blockForm.allDay ? undefined : blockForm.endTime,
      isAvailable: false,
      reason: blockForm.reason || undefined,
    });
  };

  const renderMonthView = () => {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);

    return (
      <div className="border rounded-lg overflow-hidden">
        <div className="grid grid-cols-7 bg-muted/50">
          {DAY_NAMES.map((day) => (
            <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2 border-b">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} className="min-h-[60px] sm:min-h-[100px] border-b border-r bg-muted/20" />;
            }
            const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayEvents = eventsMap.get(dateKey) || [];
            const dayBlocks = blockedDatesMap.get(dateKey) || [];
            const isToday = dateKey === todayKey;
            const isFullDayBlocked = dayBlocks.some(b => !b.startTime && !b.endTime);

            return (
              <div
                key={dateKey}
                className={`min-h-[60px] sm:min-h-[100px] border-b border-r p-1 cursor-pointer group ${
                  isFullDayBlocked
                    ? "bg-gray-100 dark:bg-gray-800/50"
                    : isToday
                    ? "bg-primary/5"
                    : "bg-background hover:bg-muted/30"
                }`}
                onDoubleClick={() => openBlockDialog(dateKey)}
              >
                <div className="flex items-center justify-between">
                  <div className={`text-xs font-medium mb-1 ${isToday ? "text-primary font-bold" : "text-muted-foreground"}`}>
                    {isToday ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs">
                        {day}
                      </span>
                    ) : (
                      day
                    )}
                  </div>
                  {isFullDayBlocked && (
                    <Ban className="h-3 w-3 text-gray-500" />
                  )}
                </div>
                <div className="space-y-0.5">
                  {/* Show blocked time indicators */}
                  {dayBlocks.map((block, bIdx) => (
                    <div
                      key={`block-${block.id}-${bIdx}`}
                      className="w-full text-left text-[10px] leading-tight px-1 py-0.5 rounded truncate border bg-gray-100 text-gray-500 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 flex items-center gap-0.5"
                    >
                      <Ban className="h-2.5 w-2.5 flex-shrink-0" />
                      {block.startTime && block.endTime
                        ? `${formatTime(block.startTime)}-${formatTime(block.endTime)}`
                        : "Blocked"}
                      {block.reason && <span className="ml-0.5">({block.reason})</span>}
                    </div>
                  ))}
                  {/* Show booking events */}
                  {dayEvents.slice(0, dayBlocks.length > 0 ? 2 : 3).map((event, eIdx) => {
                    const colors = getStatusColor(event.sessionStatus || event.status);
                    return (
                      <button
                        key={`${event.id}-${eIdx}`}
                        onClick={(e) => { e.stopPropagation(); setSelectedEvent(event); }}
                        className={`w-full text-left text-[10px] leading-tight px-1 py-0.5 rounded truncate border ${colors.bg} ${colors.text} ${colors.border} hover:opacity-80 transition-opacity`}
                      >
                        <span className="font-medium">{formatTime(event.startTime)}</span>{" "}
                        {event.serviceName || event.bookingNumber}
                        {event.venueName && event.locationType === "fixed_location" && (
                          <span className="opacity-70"> · {event.venueName}</span>
                        )}
                      </button>
                    );
                  })}
                  {(dayEvents.length + dayBlocks.length) > 3 && (
                    <div className="text-[10px] text-muted-foreground pl-1">
                      +{dayEvents.length + dayBlocks.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const weekDates = getWeekDates(currentDate);
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
      <div className="border rounded-lg overflow-hidden">
        <div className="grid grid-cols-[60px_repeat(7,1fr)] bg-muted/50 border-b">
          <div className="text-center text-xs text-muted-foreground py-2" />
          {weekDates.map((date) => {
            const dateKey = formatDateKey(date);
            const isToday = dateKey === todayKey;
            const dayBlocks = blockedDatesMap.get(dateKey) || [];
            const isFullDayBlocked = dayBlocks.some(b => !b.startTime && !b.endTime);
            return (
              <div key={dateKey} className={`text-center py-2 border-l ${isToday ? "bg-primary/10" : ""} ${isFullDayBlocked ? "bg-gray-100 dark:bg-gray-800/50" : ""}`}>
                <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  {DAY_NAMES[date.getDay()]}
                  {isFullDayBlocked && <Ban className="h-3 w-3 text-gray-500" />}
                </div>
                <div className={`text-sm font-medium ${isToday ? "text-primary" : ""}`}>
                  {isToday ? (
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground">
                      {date.getDate()}
                    </span>
                  ) : (
                    date.getDate()
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="max-h-[600px] overflow-y-auto">
          {hours.map((hour) => (
            <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] min-h-[60px]">
              <div className="text-xs text-muted-foreground text-right pr-2 pt-1 border-r">
                {hour === 0 ? "12 AM" : hour <= 12 ? `${hour} ${hour < 12 ? "AM" : "PM"}` : `${hour - 12} PM`}
              </div>
              {weekDates.map((date) => {
                const dateKey = formatDateKey(date);
                const dayEvents = eventsMap.get(dateKey) || [];
                const dayBlocks = blockedDatesMap.get(dateKey) || [];
                const hourEvents = dayEvents.filter((e) => {
                  const eventHour = parseInt(e.startTime.split(":")[0]);
                  return eventHour === hour;
                });
                // Check if this hour is blocked
                const isHourBlocked = dayBlocks.some(b => {
                  if (!b.startTime && !b.endTime) return true; // full day block
                  if (b.startTime && b.endTime) {
                    const blockStart = parseInt(b.startTime.split(":")[0]);
                    const blockEnd = parseInt(b.endTime.split(":")[0]);
                    return hour >= blockStart && hour < blockEnd;
                  }
                  return false;
                });

                return (
                  <div key={`${dateKey}-${hour}`} className={`border-l border-b relative min-h-[60px] ${isHourBlocked ? "bg-gray-50 dark:bg-gray-800/30" : ""}`}>
                    {isHourBlocked && hourEvents.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[9px] text-muted-foreground">Blocked</span>
                      </div>
                    )}
                    {hourEvents.map((event, eIdx) => {
                      const colors = getStatusColor(event.sessionStatus || event.status);
                      return (
                        <button
                          key={`${event.id}-${eIdx}`}
                          onClick={() => setSelectedEvent(event)}
                          className={`absolute left-0.5 right-0.5 text-[10px] leading-tight px-1.5 py-1 rounded border ${colors.bg} ${colors.text} ${colors.border} hover:opacity-80 transition-opacity z-10`}
                          style={{ top: `${eIdx * 28}px` }}
                        >
                          <div className="font-medium truncate">
                            {formatTime(event.startTime)} - {formatTime(event.endTime)}
                          </div>
                          <div className="truncate">{event.serviceName || event.bookingNumber}</div>
                          {event.venueName && event.locationType === "fixed_location" && (
                            <div className="truncate opacity-70">{event.venueName}</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderEventDetail = () => {
    if (!selectedEvent) return null;
    const colors = getStatusColor(selectedEvent.sessionStatus || selectedEvent.status);

    return (
      <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => setSelectedEvent(null)}>
        <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg">{selectedEvent.serviceName || "Service"}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">{selectedEvent.bookingNumber}</p>
              </div>
              <Badge className={`${colors.bg} ${colors.text} border ${colors.border}`}>
                {selectedEvent.isSession
                  ? `Session ${selectedEvent.sessionNumber}${selectedEvent.totalSessions ? ` of ${selectedEvent.totalSessions}` : ""}`
                  : (selectedEvent.sessionStatus || selectedEvent.status)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <span>{new Date(selectedEvent.bookingDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{formatTime(selectedEvent.startTime)} — {formatTime(selectedEvent.endTime)}</span>
            </div>
            {selectedEvent.customerName && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{selectedEvent.customerName}</span>
              </div>
            )}
            {selectedEvent.locationType && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="capitalize">
                  {selectedEvent.locationType.replace("_", " ")}
                  {selectedEvent.venueName && selectedEvent.locationType === "fixed_location" && (
                    <> — {selectedEvent.venueName}</>
                  )}
                </span>
              </div>
            )}
            {selectedEvent.totalAmount && (
              <div className="text-sm font-medium">
                Total: ${formatPrice(parseFloat(selectedEvent.totalAmount))}
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Link href={`/booking/${selectedEvent.id}/detail`}>
                <Button size="sm" className="w-full">View Booking Details</Button>
              </Link>
              <Button size="sm" variant="outline" onClick={() => setSelectedEvent(null)}>
                Close
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-page">
      <NavHeader />
      <ProviderWorkspaceShell
        active="calendar"
        businessName={providerProfile?.businessName}
        profileSlug={providerProfile?.profileSlug}
        isPageLive={Boolean(providerProfile?.profileSlug)}
        customersVisible={customersAccess?.visible}
        contentClassName="[&_[data-slot=card]]:rounded-2xl [&_[data-slot=card]]:border-slate-200 [&_[data-slot=card]]:shadow-[0_18px_50px_-42px_rgba(15,23,42,0.5)]"
      >
        <ProviderWorkspacePageHeader
          eyebrow="Schedule and availability"
          title="My Calendar"
          description="View bookings and sessions, protect unavailable time, and keep your external calendar in sync."
          actions={(
            <Button className="bg-white text-[#174a73] hover:bg-blue-50" onClick={() => openBlockDialog()}>
              <Ban className="mr-2 h-4 w-4" />Block time
            </Button>
          )}
        />

        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-[#174a73]" />
            <span className="text-sm font-semibold text-slate-800">Calendar controls</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setShowSyncPanel(!showSyncPanel)}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Sync
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday}>Today</Button>
            <div className="flex items-center border rounded-md">
              <Button variant={viewMode === "month" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("month")} className="rounded-r-none">Month</Button>
              <Button variant={viewMode === "week" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("week")} className="rounded-l-none">Week</Button>
            </div>
          </div>
        </div>

        {/* Calendar Sync Panel */}
        {showSyncPanel && feedData && (
          <Card className="ology-provider-workspace-info mt-5 mb-6 border-primary/20 bg-primary/5">
            <CardContent className="py-4 px-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-primary" />
                  Sync Your Calendar
                </h3>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowSyncPanel(false)}>
                  Close
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Keep your bookings in sync with your personal calendar. Changes update automatically every 15 minutes.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => window.open(feedData.googleCalUrl, '_blank')}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <path d="M18 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2z" stroke="currentColor" strokeWidth="2" />
                    <path d="M16 2v4M8 2v4M4 10h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Google Calendar
                  <ExternalLink className="h-3 w-3" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    const webcalUrl = feedData.feedUrl.replace(/^https?:/, 'webcal:');
                    window.location.href = webcalUrl;
                  }}
                >
                  <CalendarIcon className="h-4 w-4" />
                  Apple Calendar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    navigator.clipboard.writeText(feedData.feedUrl);
                    setCopied(true);
                    toast.success("iCal feed URL copied! Paste it into any calendar app.");
                    setTimeout(() => setCopied(false), 3000);
                  }}
                >
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied!" : "Copy iCal URL"}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-3">
                For Outlook: Copy the iCal URL and add it as a calendar subscription.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="mt-5 grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <Card><CardContent className="py-3 px-4"><div className="text-2xl font-bold">{stats.total}</div><div className="text-xs text-muted-foreground">Total Bookings</div></CardContent></Card>
          <Card><CardContent className="py-3 px-4"><div className="text-2xl font-bold text-amber-600">{stats.pending}</div><div className="text-xs text-muted-foreground">Pending</div></CardContent></Card>
          <Card><CardContent className="py-3 px-4"><div className="text-2xl font-bold text-blue-600">{stats.confirmed}</div><div className="text-xs text-muted-foreground">Confirmed</div></CardContent></Card>
          <Card><CardContent className="py-3 px-4"><div className="text-2xl font-bold text-emerald-600">{stats.completed}</div><div className="text-xs text-muted-foreground">Completed</div></CardContent></Card>
          <Card><CardContent className="py-3 px-4"><div className="text-2xl font-bold text-gray-500">{stats.blocked}</div><div className="text-xs text-muted-foreground">Blocked Days</div></CardContent></Card>
        </div>

        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-semibold">
            {viewMode === "month"
              ? `${MONTH_NAMES[month]} ${year}`
              : (() => {
                  const weekDates = getWeekDates(currentDate);
                  const start = weekDates[0];
                  const end = weekDates[6];
                  if (start.getMonth() === end.getMonth()) {
                    return `${MONTH_NAMES[start.getMonth()]} ${start.getDate()} - ${end.getDate()}, ${year}`;
                  }
                  return `${MONTH_NAMES[start.getMonth()]} ${start.getDate()} - ${MONTH_NAMES[end.getMonth()]} ${end.getDate()}, ${year}`;
                })()}
          </h2>
          <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {isLoading ? (
          <div className="animate-pulse h-96 bg-muted rounded-lg" />
        ) : (
          viewMode === "month" ? renderMonthView() : renderWeekView()
        )}

        <div className="flex flex-wrap gap-3 mt-4 text-xs">
          {Object.entries(STATUS_COLORS).map(([status, colors]) => (
            <div key={status} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded ${colors.bg} border ${colors.border}`} />
              <span className="capitalize text-muted-foreground">{status.replace("_", " ")}</span>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground mt-2">
          Tip: Double-click any date to quickly block it off.
        </p>

        {/* Upcoming Blocked Dates */}
        {upcomingBlocks.length > 0 && (
          <Card className="mt-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Ban className="h-4 w-4" />
                Upcoming Blocked Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {upcomingBlocks.map((block: any) => (
                  <div key={block.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-800/50 rounded-md">
                    <div>
                      <div className="text-sm font-medium">
                        {new Date(block.overrideDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {block.startTime && block.endTime
                          ? `${formatTime(block.startTime)} - ${formatTime(block.endTime)}`
                          : "All day"}
                        {block.reason && ` — ${block.reason}`}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => deleteOverride.mutate({ overrideId: block.id })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {renderEventDetail()}

        {/* Block Time Dialog */}
        <Dialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Ban className="h-5 w-5" />
                Block Time Off
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={blockForm.date}
                  onChange={(e) => setBlockForm({ ...blockForm, date: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="block-all-day"
                  checked={blockForm.allDay}
                  onChange={(e) => setBlockForm({ ...blockForm, allDay: e.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor="block-all-day" className="cursor-pointer mb-0">Block entire day</Label>
              </div>
              {!blockForm.allDay && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Start Time</Label>
                    <Input
                      type="time"
                      value={blockForm.startTime}
                      onChange={(e) => setBlockForm({ ...blockForm, startTime: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>End Time</Label>
                    <Input
                      type="time"
                      value={blockForm.endTime}
                      onChange={(e) => setBlockForm({ ...blockForm, endTime: e.target.value })}
                    />
                  </div>
                </div>
              )}
              <div>
                <Label>Reason (optional)</Label>
                <Textarea
                  value={blockForm.reason}
                  onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })}
                  placeholder="e.g., Personal time, Vacation, Lunch break..."
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBlockDialog(false)}>Cancel</Button>
              <Button onClick={handleBlockTime} disabled={createOverride.isPending}>
                {createOverride.isPending ? "Blocking..." : "Block Time"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </ProviderWorkspaceShell>
    </div>
  );
}
