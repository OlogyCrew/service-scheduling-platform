import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { trpc } from "@/lib/trpc";
import { formatDuration, getDurationPricingLabel } from "../../../shared/duration";
import { getServiceTypeLabel } from "../../../shared/serviceTypeLabels";
import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation, useParams, useSearch, Link } from "wouter";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import { Calendar } from "@/components/ui/calendar";
import { MapPin, Clock, DollarSign, Star, ChevronRight, CheckCircle, CheckCircle2, ArrowLeft, Info, Image as ImageIcon, Tag, X, Loader2, Gift, CalendarRange, Repeat, CalendarDays, Share2, Bell, BellOff, CreditCard, ShieldCheck, AlertTriangle, Sunrise, Sun, Sunset, Moon } from "lucide-react";
import { formatTimeForDisplay, type TimeSlot } from "@shared/timeSlots";
import { getBookingDateViolation, OLOGYCREW_BOOKING_TIME_ZONE } from "@shared/bookingPolicy";
import { ReviewList } from "@/components/shared/ReviewList";
import { NavHeader } from "@/components/shared/NavHeader";
import { ShareProfile } from "@/components/ShareProfile";
import { HelpTip, HelpBanner } from "@/components/shared/HelpTip";
import { formatPrice } from "@shared/formatPrice";
import { PaymentMethods } from "@/components/PaymentMethods";
import { AdaptiveQuoteRequestCard } from "@/components/booking/AdaptiveQuoteRequestCard";
import { getAdaptiveBookingDecision } from "../../../shared/adaptiveBooking";


type BookingStep = "date" | "time" | "details" | "confirm";
type BookingType = "single" | "multi_day" | "recurring";

/** Maps raw server error messages to user-friendly descriptions */
function getBookingErrorMessage(raw?: string): string {
  if (!raw) return "Something went wrong. Please try again.";
  const lower = raw.toLowerCase();
  if (lower.includes("time slot") || lower.includes("already booked") || lower.includes("conflict"))
    return "This time slot was just booked by someone else. Please pick a different time.";
  if (lower.includes("not available") || lower.includes("unavailable"))
    return "The provider is not available at this time. Try another date or time.";
  if (lower.includes("unauthorized") || lower.includes("unauthenticated"))
    return "Your session has expired. Please sign in again to continue.";
  if (lower.includes("network") || lower.includes("fetch"))
    return "Network error — please check your connection and try again.";
  if (lower.includes("capacity") || lower.includes("full"))
    return "This session is full. You can join the waitlist or pick another time.";
  return raw;
}

// Category IDs that support multi-day bookings
const MULTI_DAY_CATEGORIES = new Set([
  15, // AUDIO VISUAL CREW
  19, // TV/FILM CREW
  177, // EVENT PLANNING & MANAGEMENT
  202, // DAY LABOR
  179, // HOME RENOVATION and REMODELING
  199, // PARTY & EVENT RENTALS
  148, // POWER WASHING & EXTERIOR CLEANING
  200, // HOME ENERGY SOLUTIONS
]);

// Category IDs that support recurring bookings
const RECURRING_CATEGORIES = new Set([
  109, // FITNESS CLASSES & TRAINERS
  12, // PERSONAL TRAINER
  195, // DANCE LESSONS & INSTRUCTORS
  188, // HOME CLEANING
  10, // MASSAGE THERAPIST
  11, // PET CARE and GROOMING
  158, // PERSONAL and PROFESSIONAL COACHING
  193, // HEALTH and WELLNESS SERVICES
  155, // VIRTUAL ASSISTANT
]);

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function ServicePhotoGallery({ serviceId }: { serviceId: number }) {
  const [selectedPhoto, setSelectedPhoto] = useState(0);
  const { data: photos } = trpc.service.getPhotos.useQuery({ serviceId });

  if (!photos || photos.length === 0) return null;

  return (
    <div className="space-y-2">
      {/* Main photo */}
      <div className="rounded-xl overflow-hidden bg-muted aspect-[16/9]">
        <img
          src={photos[selectedPhoto]?.photoUrl}
          alt={photos[selectedPhoto]?.caption || "Service photo"}
          className="w-full h-full object-cover"
        />
      </div>
      {/* Thumbnails */}
      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((photo: any, index: number) => (
            <button
              key={photo.id}
              onClick={() => setSelectedPhoto(index)}
              className={`rounded-lg overflow-hidden flex-shrink-0 w-16 h-16 border-2 transition-colors ${
                selectedPhoto === index ? "border-primary" : "border-transparent hover:border-muted-foreground/30"
              }`}
            >
              <img
                src={photo.photoUrl}
                alt={photo.caption || `Photo ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ServiceDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const entryContext = useMemo(() => new URLSearchParams(searchString), [searchString]);
  const fromProvider = entryContext.get("from_provider");
  const handoffToken = entryContext.get("handoff") || "";
  const serviceId = Number.parseInt(id || "", 10);
  const {
    data: agentHandoff,
    error: agentHandoffError,
    mutate: resolveAgentHandoff,
  } = trpc.agentHandoff.resolve.useMutation();
  const resolvedHandoffToken = useRef("");
  useEffect(() => {
    if (!handoffToken || !Number.isInteger(serviceId) || serviceId <= 0) return;
    if (resolvedHandoffToken.current === handoffToken) return;
    resolvedHandoffToken.current = handoffToken;
    resolveAgentHandoff({ token: handoffToken, expectedServiceId: serviceId });
  }, [handoffToken, serviceId, resolveAgentHandoff]);
  const initialIntent = agentHandoff?.intent || entryContext.get("intent") || "";
  const initialLocation = agentHandoff?.location || entryContext.get("location") || "";
  const timingHint = agentHandoff?.timing || entryContext.get("timing") || "";
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState("");
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [bookingStep, setBookingStep] = useState<BookingStep>("date");
  const agentPreferredTimeApplied = useRef("");
  
  // Multi-day & recurring booking state
  const [bookingType, setBookingType] = useState<BookingType>("single");
  const [endDate, setEndDate] = useState<Date>();
  const [recurringDays, setRecurringDays] = useState<number[]>([]);
  const [recurringFrequency, setRecurringFrequency] = useState<"weekly" | "biweekly">("weekly");
  const [recurringWeeks, setRecurringWeeks] = useState(4);
  
  const { data: service } = trpc.service.getById.useQuery({ id: parseInt(id!) });
  const { data: provider } = trpc.provider.getById.useQuery(
    { id: service?.providerId || 0 },
    { enabled: !!service }
  );
  const canAcceptPlatformPayments = !!(provider as any)?.canAcceptPlatformPayments;
  const { data: reviews } = trpc.review.listByProvider.useQuery(
    { providerId: service?.providerId || 0 },
    { enabled: !!service }
  );
  
  // Fetch provider's weekly schedule
  const { data: weeklySchedule } = trpc.availability.getSchedule.useQuery(
    { providerId: service?.providerId || 0 },
    { enabled: !!service }
  );

  // Fetch overrides for the next 90 days for calendar highlighting
  const [overrideRange] = useState(() => {
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 90);
    return {
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
    };
  });

  const { data: allOverrides } = trpc.availability.getOverrides.useQuery(
    {
      providerId: service?.providerId || 0,
      ...overrideRange,
    },
    { enabled: !!service }
  );
  
  // Fetch privacy-safe, server-computed availability for the selected date.
  const selectedDateStr = selectedDate
    ? selectedDate.toISOString().split("T")[0]
    : undefined;

  const { data: publicTimeSlots } = trpc.availability.getPublicTimeSlots.useQuery(
    {
      serviceId: service?.id || 0,
      date: selectedDateStr || "",
    },
    { enabled: !!service && !!selectedDateStr }
  );

  // Waitlist: check if user is on waitlist for this service+date
  const { data: waitlistStatus, refetch: refetchWaitlist } = trpc.waitlist.checkStatus.useQuery(
    {
      serviceId: parseInt(id!),
      bookingDate: selectedDateStr || "",
      startTime: selectedTime || "00:00",
    },
    { enabled: !!selectedDateStr && !!selectedTime && isAuthenticated && !!service?.isGroupClass }
  );

  const joinWaitlistMutation = trpc.waitlist.join.useMutation({
    onSuccess: () => {
      toast.success("You've been added to the waitlist! We'll notify you when a spot opens up.");
      refetchWaitlist();
    },
    onError: (err) => toast.error(err.message),
  });

  const leaveWaitlistMutation = trpc.waitlist.leave.useMutation({
    onSuccess: () => {
      toast.success("You've been removed from the waitlist.");
      refetchWaitlist();
    },
    onError: (err) => toast.error(err.message),
  });

  // Compute which days of week the provider works
  const availableDays = useMemo(() => {
    if (!weeklySchedule) return new Set<number>();
    return new Set(
      weeklySchedule
        .filter((s: any) => s.isAvailable)
        .map((s: any) => s.dayOfWeek as number)
    );
  }, [weeklySchedule]);

  // Build a set of override dates that are blocked
  const blockedOverrideDates = useMemo(() => {
    if (!allOverrides) return new Set<string>();
    return new Set(
      allOverrides
        .filter((o: any) => !o.isAvailable)
        .map((o: any) => o.overrideDate as string)
    );
  }, [allOverrides]);

  // Calendar disabled logic: past dates + days provider doesn't work + blocked overrides
  const isDateDisabled = (date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) return true;

    const dayOfWeek = date.getDay();
    const dateStr = date.toISOString().split("T")[0];
    if (service && getBookingDateViolation({
      bookingDate: dateStr,
      maxAdvanceBookingDays: service.maxAdvanceBookingDays,
      timeZone: OLOGYCREW_BOOKING_TIME_ZONE,
    })) return true;

    // If there's a blocked override for this date, disable it
    if (blockedOverrideDates.has(dateStr)) return true;

    // If provider has no schedule for this day of week, disable it
    if (weeklySchedule && weeklySchedule.length > 0 && !availableDays.has(dayOfWeek)) {
      return true;
    }

    return false;
  };

  // Generate available time slots when date is selected
  useEffect(() => {
    if (!selectedDate || !service || !weeklySchedule) {
      setAvailableSlots([]);
      return;
    }
    
    setAvailableSlots((publicTimeSlots || []) as TimeSlot[]);
  }, [selectedDate, service, weeklySchedule, publicTimeSlots]);

  // Auto-advance to time step when date is selected (single-day only)
  useEffect(() => {
    if (selectedDate && bookingStep === "date" && bookingType === "single") {
      setBookingStep("time");
      setSelectedTime("");
    }
  }, [selectedDate, bookingType]);
  
  const utils = trpc.useUtils();

  // Auto-fill booking form with dummy data for demo provider
  useEffect(() => {
    if ((provider as any)?.isOfficial && bookingStep === "details") {
      const needsAddress = service?.serviceType === "mobile" || service?.serviceType === "hybrid";
      const isFlexible = service?.serviceType === "flexible";
      setBookingForm((prev) => {
        // Only auto-fill if fields are empty (don't overwrite user edits)
        if (prev.addressLine1 || prev.notes) return prev;
        return {
          ...prev,
          addressLine1: needsAddress || isFlexible ? "123 Demo Street" : prev.addressLine1,
          city: needsAddress || isFlexible ? "Demo City" : prev.city,
          state: needsAddress || isFlexible ? "CA" : prev.state,
          postalCode: needsAddress || isFlexible ? "90210" : prev.postalCode,
          venueName: isFlexible ? "Demo Venue" : prev.venueName,
          djLocationType: isFlexible ? "public_venue" as const : prev.djLocationType,
          notes: "This is a demo booking — just testing the process!",
        };
      });
    }
  }, [provider, bookingStep, service?.serviceType]);

  const [bookingError, setBookingError] = useState<string | null>(null);

  const createBooking = trpc.booking.create.useMutation({
    onSuccess: (data) => {
      setBookingError(null);
      // Record referral if a referral code was applied
      if (referralApplied?.valid) {
        applyReferral.mutate({
          referralCodeId: referralApplied.referralCodeId,
          referrerId: referralApplied.referrerId,
          bookingId: data.id,
          discountAmount: (getNumericPrice() * referralApplied.refereeDiscountPercent / 100).toFixed(2),
        });
        localStorage.removeItem("customer_referral_code");
      }
      // Demo provider: skip payment entirely
      if ((provider as any)?.isOfficial) {
        toast.success("Demo booking confirmed! No payment needed — this is a free demo.");
        setLocation(`/booking/${data.id}`);
        return;
      }
      const isPriced = service?.pricingModel !== "custom_quote" && service?.pricingModel !== "consultation";
      const paymentRequested = isPriced && (service?.requireUpfrontPayment || paymentChoice === "pay_now");
      if (paymentRequested && canAcceptPlatformPayments) {
        toast.success("Booking created! Redirecting to payment...");
        handlePayment(data.id);
      } else {
        toast.success(paymentRequested && !canAcceptPlatformPayments
          ? "Booking request sent! This provider will arrange payment after confirming."
          : "Booking request sent! The provider will confirm your booking.");
        setLocation(`/booking/${data.id}`);
      }
    },
    onError: (error) => {
      const msg = getBookingErrorMessage(error.message);
      setBookingError(msg);
      toast.error(msg);
    },
  });
  
  // Multi-day booking mutation
  const createMultiDay = trpc.booking.createMultiDay.useMutation({
    onSuccess: (data) => {
      setBookingError(null);
      if (!data) return;
      // Demo provider: skip payment entirely
      if ((provider as any)?.isOfficial) {
        toast.success("Demo booking confirmed! No payment needed — this is a free demo.");
        setLocation(`/booking/${data.id}`);
        return;
      }
      const isPriced = service?.pricingModel !== "custom_quote" && service?.pricingModel !== "consultation";
      const paymentRequested = isPriced && (service?.requireUpfrontPayment || paymentChoice === "pay_now");
      if (paymentRequested && canAcceptPlatformPayments) {
        toast.success("Multi-day booking created! Redirecting to payment...");
        handlePayment(data.id);
      } else {
        toast.success(paymentRequested && !canAcceptPlatformPayments
          ? "Multi-day booking request sent! This provider will arrange payment after confirming."
          : "Multi-day booking request sent! The provider will confirm your booking.");
        setLocation(`/booking/${data.id}`);
      }
    },
    onError: (error) => {
      const msg = getBookingErrorMessage(error.message);
      setBookingError(msg);
      toast.error(msg);
    },
  });

  // Recurring booking mutation
  const createRecurring = trpc.booking.createRecurring.useMutation({
    onSuccess: (data) => {
      setBookingError(null);
      if (!data) return;
      // Demo provider: skip payment entirely
      if ((provider as any)?.isOfficial) {
        toast.success("Demo booking confirmed! No payment needed — this is a free demo.");
        setLocation(`/booking/${data.id}`);
        return;
      }
      const isPriced = service?.pricingModel !== "custom_quote" && service?.pricingModel !== "consultation";
      const paymentRequested = isPriced && (service?.requireUpfrontPayment || paymentChoice === "pay_now");
      if (paymentRequested && canAcceptPlatformPayments) {
        toast.success("Recurring booking created! Redirecting to payment...");
        handlePayment(data.id);
      } else {
        toast.success(paymentRequested && !canAcceptPlatformPayments
          ? "Recurring booking request sent! This provider will arrange payment after confirming."
          : "Recurring booking request sent! The provider will confirm your booking.");
        setLocation(`/booking/${data.id}`);
      }
    },
    onError: (error) => {
      const msg = getBookingErrorMessage(error.message);
      setBookingError(msg);
      toast.error(msg);
    },
  });

  const createCheckout = trpc.stripe.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      setBookingError(null);
      if (data.url) {
        window.location.href = data.url;
      } else if ((data as any).isDemo) {
        toast.success("Demo booking confirmed! No payment needed.");
        setLocation(`/booking/${(data as any).bookingId || ''}/confirmation`);
      } else if (data.paidWithCredits) {
        toast.success("Booking paid in full with referral credits!");
        setLocation("/my-bookings");
      }
    },
    onError: (error) => {
      const msg = error.message?.includes("connect")
        ? "Payment system is temporarily unavailable. Your booking was saved — you can pay later from your bookings page."
        : error.message || "Failed to create checkout session. Please try again.";
      setBookingError(msg);
      toast.error(msg);
    },
  });
  
  const handlePayment = (bookingId: number) => {
    createCheckout.mutate({ bookingId });
  };

  const [bookingForm, setBookingForm] = useState({
    addressLine1: "",
    city: "",
    state: "",
    postalCode: "",
    venueName: "",
    djLocationType: "" as "" | "public_venue" | "private_location" | "virtual_stream",
    notes: "",
  });

  useEffect(() => {
    if (!agentHandoff || agentHandoff.mode !== "direct") return;

    if (agentHandoff.preferredDate) {
      setSelectedDate(new Date(`${agentHandoff.preferredDate}T12:00:00`));
    }

    const handoffNotes = [
      agentHandoff.intent,
      agentHandoff.location ? `Requested location: ${agentHandoff.location}` : null,
      agentHandoff.timing ? `Requested timing: ${agentHandoff.timing}` : null,
    ].filter(Boolean).join("\n\n");
    if (handoffNotes) {
      setBookingForm((current) => current.notes ? current : { ...current, notes: handoffNotes });
    }
  }, [agentHandoff]);

  useEffect(() => {
    if (
      !agentHandoff?.preferredDate ||
      !agentHandoff.preferredTime ||
      agentHandoff.mode !== "direct" ||
      !selectedDate ||
      weeklySchedule === undefined ||
      allOverrides === undefined ||
      publicTimeSlots === undefined
    ) return;

    const selectedDateValue = selectedDate.toISOString().split("T")[0];
    if (selectedDateValue !== agentHandoff.preferredDate) return;

    const prefillKey = `${agentHandoff.issuedAt}:${agentHandoff.preferredDate}:${agentHandoff.preferredTime}`;
    if (agentPreferredTimeApplied.current === prefillKey) return;

    if (availableSlots.some((slot) => slot.available && slot.time === agentHandoff.preferredTime)) {
      agentPreferredTimeApplied.current = prefillKey;
      setSelectedTime(agentHandoff.preferredTime);
    }
  }, [agentHandoff, selectedDate, weeklySchedule, allOverrides, publicTimeSlots, availableSlots]);

  // Custom duration state (for DJ & Music services category 20)
  const [useCustomDuration, setUseCustomDuration] = useState(false);
  const [customStartTime, setCustomStartTime] = useState("");
  const [customEndTime, setCustomEndTime] = useState("");

  // Calculate custom duration in minutes
  const customDurationMinutes = useMemo(() => {
    if (!useCustomDuration || !customStartTime || !customEndTime) return 0;
    const [startH, startM] = customStartTime.split(":").map(Number);
    const [endH, endM] = customEndTime.split(":").map(Number);
    let startTotal = startH * 60 + startM;
    let endTotal = endH * 60 + endM;
    // Handle overnight (e.g., 10 PM to 2 AM)
    if (endTotal <= startTotal) endTotal += 24 * 60;
    return endTotal - startTotal;
  }, [useCustomDuration, customStartTime, customEndTime]);

  // Calculate custom duration price based on hourly rate
  const customDurationPrice = useMemo(() => {
    if (!service || !useCustomDuration || customDurationMinutes <= 0) return 0;
    const hourlyRate = service.hourlyRate ? parseFloat(service.hourlyRate) : 0;
    if (hourlyRate <= 0) return 0;
    return (hourlyRate * customDurationMinutes) / 60;
  }, [service, useCustomDuration, customDurationMinutes]);

  // Promo code state
  const [promoCode, setPromoCode] = useState("");

  // Referral code state
  const [referralCode, setReferralCode] = useState("");
  const [referralValidating, setReferralValidating] = useState(false);
  const [referralApplied, setReferralApplied] = useState<{
    valid: boolean;
    referralCodeId: number;
    referrerId: number;
    refereeDiscountPercent: number;
  } | null>(null);
  const validateReferral = trpc.referral.validate.useMutation();
  const applyReferral = trpc.referral.applyCode.useMutation();

  // Auto-fill referral code from localStorage (captured from /?ref=CODE link)
  useEffect(() => {
    const storedRef = localStorage.getItem("customer_referral_code");
    if (storedRef && !referralCode && !referralApplied) {
      setReferralCode(storedRef);
      // Auto-validate the stored referral code
      setReferralValidating(true);
      validateReferral.mutate(
        { code: storedRef },
        {
          onSuccess: (result) => {
            if (result.valid) {
              setReferralApplied(result as any);
            } else {
              // Invalid code, clear it from storage
              localStorage.removeItem("customer_referral_code");
            }
          },
          onError: () => {
            localStorage.removeItem("customer_referral_code");
          },
          onSettled: () => setReferralValidating(false),
        }
      );
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [promoApplied, setPromoApplied] = useState<{
    valid: boolean;
    promoCodeId: number | null;
    code: string;
    discountAmount: number;
    finalAmount: number;
    description: string | null;
  } | null>(null);

  const getNumericPrice = () => {
    if (!service) return 0;
    // For custom duration (DJ, Photography, Event Planning), return the calculated price
    if (useCustomDuration && customDurationPrice > 0 && [20, 17, 177, 15, 19, 195, 109, 12, 202, 9, 148, 188, 201, 199].includes(service.categoryId)) {
      return customDurationPrice;
    }
    if (service.pricingModel === "fixed" && service.basePrice) return parseFloat(service.basePrice);
    if (service.pricingModel === "hourly" && (service.hourlyRate || service.basePrice)) return parseFloat(service.hourlyRate || service.basePrice || "0");
    if (service.pricingModel === "package" && service.basePrice) return parseFloat(service.basePrice);
    return 0;
  };

  const [promoValidating, setPromoValidating] = useState(false);

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) {
      toast.error("Please enter a promo code");
      return;
    }
    if (!service) return;
    setPromoValidating(true);
    try {
      const result = await utils.promo.validate.fetch({
        code: promoCode.trim().toUpperCase(),
        serviceId: service.id,
        orderAmount: getNumericPrice(),
      });
      if (result) {
        setPromoApplied(result as any);
        if (result.valid) {
          toast.success(`Promo code applied! You save ${formatPrice(result.discountAmount)}`);
        } else {
          toast.error((result as any).error || "Invalid promo code");
          setPromoApplied(null);
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to validate promo code");
      setPromoApplied(null);
    } finally {
      setPromoValidating(false);
    }
  };

  const handleRemovePromo = () => {
    setPromoCode("");
    setPromoApplied(null);
  };

  // Determine available booking types based on service category
  const supportsMultiDay = service ? MULTI_DAY_CATEGORIES.has(service.categoryId) : false;
  const supportsRecurring = service ? RECURRING_CATEGORIES.has(service.categoryId) : false;
  const hasMultipleTypes = supportsMultiDay || supportsRecurring;
  const adaptiveDecision = service ? getAdaptiveBookingDecision(service) : null;

  // Compute multi-day total days
  const multiDayCount = useMemo(() => {
    if (!selectedDate || !endDate) return 0;
    const diff = endDate.getTime() - selectedDate.getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)) + 1);
  }, [selectedDate, endDate]);

  // Compute recurring session count
  const recurringSessionCount = useMemo(() => {
    if (recurringDays.length === 0 || recurringWeeks === 0) return 0;
    const weekIncrement = recurringFrequency === "biweekly" ? 2 : 1;
    // Approximate: days per week * total cycles
    const totalCycles = Math.ceil(recurringWeeks / weekIncrement);
    return recurringDays.length * totalCycles;
  }, [recurringDays, recurringFrequency, recurringWeeks]);

  // Compute total price based on booking type
  const getMultiDayPrice = () => {
    const perDay = getNumericPrice();
    return perDay * multiDayCount;
  };

  const getRecurringPrice = () => {
    const perSession = getNumericPrice();
    return perSession * recurringSessionCount;
  };

  const handleBooking = () => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl(
        handoffToken ? `${window.location.pathname}${window.location.search}` : undefined,
      );
      return;
    }
    if (!service) return;

    if (bookingType === "multi_day") {
      if (!selectedDate || !endDate || !selectedTime) {
        toast.error("Please select start date, end date, and time");
        return;
      }
      const startDateStr = selectedDate.toISOString().split("T")[0];
      const endDateStr = endDate.toISOString().split("T")[0];
      const endTime = calculateEndTime(selectedTime, service.durationMinutes || 60);
      const multiRawLocType = service.serviceType as "mobile" | "fixed_location" | "virtual" | "hybrid" | "flexible" | "teams" | "zoom";
      const multiEffectiveLocType = multiRawLocType === "flexible"
        ? (bookingForm.djLocationType === "public_venue" ? "fixed_location"
          : bookingForm.djLocationType === "private_location" ? "mobile"
          : bookingForm.djLocationType === "virtual_stream" ? "virtual"
          : "flexible")
        : multiRawLocType;
      const multiNeedsAddress = multiEffectiveLocType === "mobile" || multiEffectiveLocType === "fixed_location" || multiEffectiveLocType === "hybrid";
      createMultiDay.mutate({
        serviceId: service.id,
        startDate: startDateStr,
        endDate: endDateStr,
        startTime: selectedTime,
        endTime,
        locationType: multiEffectiveLocType,
        serviceAddressLine1: multiNeedsAddress ? bookingForm.addressLine1 : undefined,
        serviceCity: multiNeedsAddress ? bookingForm.city : undefined,
        serviceState: multiNeedsAddress ? bookingForm.state : undefined,
        servicePostalCode: multiNeedsAddress ? bookingForm.postalCode : undefined,
        venueName: (multiEffectiveLocType === "fixed_location" && bookingForm.venueName) ? bookingForm.venueName : undefined,
        customerNotes: bookingForm.notes || undefined,
        bookingSource: "direct",
      });
      return;
    }

    if (bookingType === "recurring") {
      if (!selectedDate || !selectedTime || recurringDays.length === 0) {
        toast.error("Please select a start date, time, and at least one day of the week");
        return;
      }
      const startDateStr = selectedDate.toISOString().split("T")[0];
      const endTime = calculateEndTime(selectedTime, service.durationMinutes || 60);
      const recurRawLocType = service.serviceType as "mobile" | "fixed_location" | "virtual" | "hybrid" | "flexible" | "teams" | "zoom";
      const recurEffectiveLocType = recurRawLocType === "flexible"
        ? (bookingForm.djLocationType === "public_venue" ? "fixed_location"
          : bookingForm.djLocationType === "private_location" ? "mobile"
          : bookingForm.djLocationType === "virtual_stream" ? "virtual"
          : "flexible")
        : recurRawLocType;
      const recurNeedsAddress = recurEffectiveLocType === "mobile" || recurEffectiveLocType === "fixed_location" || recurEffectiveLocType === "hybrid";
      createRecurring.mutate({
        serviceId: service.id,
        startDate: startDateStr,
        startTime: selectedTime,
        endTime,
        frequency: recurringFrequency,
        daysOfWeek: recurringDays,
        totalWeeks: recurringWeeks,
        locationType: recurEffectiveLocType,
        serviceAddressLine1: recurNeedsAddress ? bookingForm.addressLine1 : undefined,
        serviceCity: recurNeedsAddress ? bookingForm.city : undefined,
        serviceState: recurNeedsAddress ? bookingForm.state : undefined,
        servicePostalCode: recurNeedsAddress ? bookingForm.postalCode : undefined,
        venueName: (recurEffectiveLocType === "fixed_location" && bookingForm.venueName) ? bookingForm.venueName : undefined,
        customerNotes: bookingForm.notes || undefined,
        bookingSource: "direct",
      });
      return;
    }

    // Single day booking (original flow)
    if (!selectedDate || !selectedTime) {
      toast.error("Please select a date and time");
      return;
    }

    // For custom duration categories, validate the end time
    const isCustomDurationCategory = [20, 17, 177, 15, 19, 195, 109, 12, 202, 9, 148, 188, 201, 199].includes(service.categoryId);
    if (isCustomDurationCategory && useCustomDuration) {
      if (!customStartTime || !customEndTime) {
        toast.error("Please select both start and end times for your custom duration");
        return;
      }
      if (customDurationMinutes <= 0) {
        toast.error("End time must be after start time");
        return;
      }
    }

    const dateStr = selectedDate.toISOString().split("T")[0];
    const actualDuration = (isCustomDurationCategory && useCustomDuration && customDurationMinutes > 0)
      ? customDurationMinutes
      : (service.durationMinutes || 60);
    const actualStartTime = (isCustomDurationCategory && useCustomDuration) ? customStartTime : selectedTime;
    const endTime = calculateEndTime(actualStartTime, actualDuration);

    // Determine effective location type — for flexible services, use customer's choice
    const rawLocType = service.serviceType as "mobile" | "fixed_location" | "virtual" | "hybrid" | "flexible" | "teams" | "zoom";
    const effectiveLocType: typeof rawLocType = rawLocType === "flexible"
      ? (bookingForm.djLocationType === "public_venue" ? "fixed_location"
        : bookingForm.djLocationType === "private_location" ? "mobile"
        : bookingForm.djLocationType === "virtual_stream" ? "virtual"
        : "flexible")
      : rawLocType;
    const needsAddress = effectiveLocType === "mobile" || effectiveLocType === "fixed_location" || effectiveLocType === "hybrid";

    // Calculate subtotal for custom duration
    const subtotal = (isCustomDurationCategory && useCustomDuration && customDurationPrice > 0)
      ? customDurationPrice.toFixed(2)
      : undefined;

    createBooking.mutate({
      serviceId: service.id,
      bookingDate: dateStr,
      startTime: actualStartTime,
      endTime,
      durationMinutes: actualDuration,
      locationType: effectiveLocType,
      serviceAddressLine1: needsAddress ? bookingForm.addressLine1 : undefined,
      serviceCity: needsAddress ? bookingForm.city : undefined,
      serviceState: needsAddress ? bookingForm.state : undefined,
      servicePostalCode: needsAddress ? bookingForm.postalCode : undefined,
      venueName: (effectiveLocType === "fixed_location" && bookingForm.venueName) ? bookingForm.venueName : undefined,
      customerNotes: bookingForm.notes || undefined,
      bookingSource: "direct",
      paymentMethod: paymentChoice === "pay_at_location" ? "pay_at_location" : "online",
      subtotal,
      promoCodeId: promoApplied?.valid ? promoApplied.promoCodeId ?? undefined : undefined,
      referralCodeId: referralApplied?.valid ? referralApplied.referralCodeId : undefined,
    });
  };

  const isBookingPending = createBooking.isPending || createMultiDay.isPending || createRecurring.isPending;
  const isBookingSuccess = createBooking.isSuccess || createMultiDay.isSuccess || createRecurring.isSuccess;

  // Payment timing choice: "pay_now" or "pay_after_confirmation"
  const [paymentChoice, setPaymentChoice] = useState<"pay_now" | "pay_after_confirmation" | "pay_at_location">("pay_now");

  const calculateEndTime = (startTime: string, durationMinutes: number): string => {
    const [hours, minutes] = startTime.split(":").map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;
    return `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`;
  };

  const getPrice = () => {
    if (!service) return null;
    if (service.pricingModel === "fixed" && service.basePrice) {
      return `${formatPrice(parseFloat(service.basePrice))}`;
    }
    if (service.pricingModel === "hourly" && (service.hourlyRate || service.basePrice)) {
      return `${formatPrice(parseFloat(service.hourlyRate || service.basePrice || "0"))}/hour`;
    }
    if (service.pricingModel === "package" && service.basePrice) {
      return `${formatPrice(parseFloat(service.basePrice))}`;
    }
    if (service.pricingModel === "custom_quote") {
      return "Custom Quote";
    }
    if (service.pricingModel === "consultation") {
      return "Free";
    }
    return "Contact for pricing";
  };

  const averageRating =
    reviews && reviews.length > 0
      ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length
      : 0;

  if (!service) {
    return (
      <div className="min-h-screen bg-page">
        <NavHeader />
        <div className="bg-muted/30 border-b">
          <div className="container py-3">
            <div className="h-4 w-48 bg-muted rounded animate-pulse" />
          </div>
        </div>
        <div className="container py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left column skeleton */}
            <div className="lg:col-span-2 space-y-6">
              <div className="rounded-xl bg-muted aspect-[16/9] animate-pulse" />
              <div className="space-y-3">
                <div className="h-8 w-3/4 bg-muted rounded animate-pulse" />
                <div className="h-4 w-1/2 bg-muted rounded animate-pulse" />
                <div className="flex gap-3 mt-4">
                  <div className="h-6 w-20 bg-muted rounded-full animate-pulse" />
                  <div className="h-6 w-24 bg-muted rounded-full animate-pulse" />
                  <div className="h-6 w-16 bg-muted rounded-full animate-pulse" />
                </div>
                <div className="h-20 w-full bg-muted rounded-lg animate-pulse mt-4" />
              </div>
            </div>
            {/* Right column skeleton - booking card */}
            <div className="lg:col-span-1">
              <div className="rounded-xl border bg-card p-6 space-y-4">
                <div className="h-6 w-2/3 bg-muted rounded animate-pulse" />
                <div className="h-4 w-full bg-muted rounded animate-pulse" />
                <div className="flex gap-2 mt-3">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="w-7 h-7 rounded-full bg-muted animate-pulse" />
                  ))}
                </div>
                <div className="h-64 w-full bg-muted rounded-lg animate-pulse mt-4" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const availableCount = availableSlots.filter((s) => s.available).length;
  const totalSlots = availableSlots.length;

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

      {/* Breadcrumb */}
      <div className="bg-muted/30 border-b">
        <div className="container py-3">
          <nav className="flex items-center gap-1 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link href="/browse" className="hover:text-foreground transition-colors">
              Browse
            </Link>
            {(fromProvider || provider) && (
              <>
                <ChevronRight className="h-3.5 w-3.5" />
                <Link href={`/${fromProvider || provider?.profileSlug || provider?.id}`} className="hover:text-foreground transition-colors truncate max-w-[180px]">
                  {provider?.businessName || "Provider"}
                </Link>
              </>
            )}
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-foreground font-medium truncate max-w-[200px]">
              {service.name}
            </span>
          </nav>
        </div>
      </div>

      <div className="container py-8 max-w-6xl">
        {agentHandoff ? (
          <div className="mb-6 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950" data-testid="agent-handoff-review-notice">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 flex-none text-sky-700" />
              <div>
                <p className="font-semibold">Review the details prepared by your AI assistant</p>
                <p className="mt-1 leading-5 text-sky-900">
                  Nothing has been booked, quoted, held, or charged. Confirm the provider, service, availability, location, price or quote path, and terms before you submit.
                </p>
              </div>
            </div>
          </div>
        ) : agentHandoffError ? (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950" data-testid="agent-handoff-error-notice">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-none text-amber-700" />
              <div>
                <p className="font-semibold">This AI handoff cannot be used</p>
                <p className="mt-1 leading-5">{agentHandoffError.message} You can still review and start this service manually.</p>
              </div>
            </div>
          </div>
        ) : null}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Service Details - Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Photo Gallery */}
            <ServicePhotoGallery serviceId={parseInt(id!)} />

            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl sm:text-2xl md:text-3xl mb-2">{service.name}</CardTitle>
                    <CardDescription className="text-base">
                      by{" "}
                      <span className="font-medium text-foreground">
                        {provider?.businessName || "Provider"}
                      </span>
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {reviews && reviews.length > 0 && (
                      <div className="flex items-center gap-1 bg-warning/10 px-3 py-1.5 rounded-full">
                        <Star className="h-4 w-4 fill-warning text-warning" />
                        <span className="font-semibold text-sm">{averageRating.toFixed(1)}</span>
                        <span className="text-muted-foreground text-sm">
                          ({reviews.length})
                        </span>
                      </div>
                    )}
                    <ShareProfile
                      url={`${window.location.origin}/service/${id}`}
                      title={`${service.name} — ${provider?.businessName || 'OlogyCrew'}`}
                      description={service.description || `Book ${service.name} on OlogyCrew`}
                      trigger={
                        <Button variant="outline" size="icon" className="h-9 w-9">
                          <Share2 className="h-4 w-4" />
                        </Button>
                      }
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2">About This Service</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {service.description || "No description provided"}
                  </p>
                </div>

                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5">
                    <DollarSign className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">{getDurationPricingLabel(service.durationMinutes) || "Price"}</p>
                      <p className="font-semibold">{getPrice()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5">
                    <Clock className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Duration</p>
                      <p className="font-semibold">{formatDuration(service.durationMinutes)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5">
                    <MapPin className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Location</p>
                      <p className="font-semibold">
                        {getServiceTypeLabel(service.serviceType, service.categoryId)}
                      </p>
                    </div>
                  </div>
                </div>

                {adaptiveDecision?.mode !== "quote" && !(provider as any)?.isOfficial && (
                  <PaymentMethods size="sm" className="mt-2" />
                )}

                {adaptiveDecision?.mode !== "quote" && service.depositRequired && (
                  <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 p-4 rounded-lg">
                    <Info className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-900">Deposit Required</p>
                      <p className="text-sm text-amber-700">
                        {service.depositType === "fixed"
                          ? `A ${formatPrice(parseFloat(service.depositAmount || "0"))} deposit is required at booking.`
                          : `A ${service.depositPercentage}% deposit is required at booking.`}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment & Security FAQ */}
            {adaptiveDecision?.mode !== "quote" && !(provider as any)?.isOfficial && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-600" />
                    <CardTitle className="text-lg">Payment & Security</CardTitle>
                  </div>
                  <CardDescription>Common questions about payments on OlogyCrew</CardDescription>
                </CardHeader>
                <CardContent className="space-y-0">
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="methods">
                      <AccordionTrigger className="text-sm font-medium">What payment methods are accepted?</AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground">
                        We accept all major credit and debit cards (Visa, Mastercard, American Express, Discover), Apple Pay, Google Pay, and Stripe Link for one-click checkout. All payments are processed securely through Stripe.
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="security">
                      <AccordionTrigger className="text-sm font-medium">Is my payment information secure?</AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground">
                        Absolutely. We never store your card details on our servers. All payment processing is handled by Stripe, a PCI Level 1 certified payment processor — the highest level of security certification available. Your data is encrypted end-to-end.
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="charged">
                      <AccordionTrigger className="text-sm font-medium">When am I charged?</AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground">
                        You are charged at the time of booking. If the service requires a deposit, only the deposit amount is charged upfront, with the remaining balance due at the time of service. You'll see the exact amount before confirming.
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="refund">
                      <AccordionTrigger className="text-sm font-medium">What is the refund policy?</AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground">
                        Cancellations made 48+ hours before your appointment receive a full refund. Cancellations 24–48 hours before receive 75%. Cancellations 4–24 hours before receive 50%. Cancellations less than 4 hours before are non-refundable. Refunds are processed back to your original payment method within 5–10 business days.
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="receipt">
                      <AccordionTrigger className="text-sm font-medium">Will I receive a receipt?</AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground">
                        Yes! A confirmation email with payment details is sent immediately after booking. You can also view and download invoices from your booking history at any time.
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="dispute">
                      <AccordionTrigger className="text-sm font-medium">What if I have a payment issue?</AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground">
                        If you experience any payment issues, you can contact the provider directly through our messaging system, or reach out to OlogyCrew support. We're here to help resolve any billing concerns quickly.
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
            )}

            {/* Reviews */}
            {reviews && reviews.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Customer Reviews</CardTitle>
                </CardHeader>
                <CardContent>
                  <ReviewList
                    reviews={reviews}
                    averageRating={
                      provider?.averageRating ? Number(provider.averageRating) : undefined
                    }
                    totalReviews={
                      provider?.totalReviews ? Number(provider.totalReviews) : undefined
                    }
                    showProviderResponse={true}
                  />
                </CardContent>
              </Card>
            )}
          </div>

          {/* Booking Panel - Right Column */}
          <div className="lg:col-span-1">
            {adaptiveDecision?.mode === "quote" ? (
              <AdaptiveQuoteRequestCard
                key={agentHandoff ? `agent-${agentHandoff.issuedAt}` : "adaptive-quote"}
                decision={adaptiveDecision}
                service={{
                  id: service.id,
                  name: service.name,
                  categoryId: service.categoryId,
                  serviceType: service.serviceType,
                }}
                provider={provider}
                initialIntent={initialIntent}
                initialLocation={initialLocation}
                timingHint={timingHint}
                initialPreferredDate={agentHandoff?.preferredDate}
                initialPreferredTime={agentHandoff?.preferredTime}
                loginReturnPath={handoffToken ? `${window.location.pathname}${window.location.search}` : undefined}
              />
            ) : (
            <Card className="sticky top-20 shadow-medium">
              <CardHeader className="pb-3">
                {adaptiveDecision ? (
                  <Badge className="mb-1 w-fit border-[#b9d9e8] bg-[#edf8fc] text-[#174a73] hover:bg-[#edf8fc]">
                    {adaptiveDecision.label}
                  </Badge>
                ) : null}
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xl">{adaptiveDecision?.heading || "Book This Service"}</CardTitle>
                  <HelpTip text="Select a date, choose an available time slot, add any special requests, then confirm and pay. Grayed-out slots are already booked." variant="info" />
                </div>
                <CardDescription>
                  {adaptiveDecision?.explanation || "Follow the steps below to complete your booking"}
                </CardDescription>
                {/* Step indicator */}
                <div className="flex items-center gap-2 mt-3">
                  {(["date", "time", "details", "confirm"] as BookingStep[]).map(
                    (step, idx) => {
                      const steps: BookingStep[] = ["date", "time", "details", "confirm"];
                      const currentIdx = steps.indexOf(bookingStep);
                      const isActive = idx === currentIdx;
                      const isComplete = idx < currentIdx;
                      return (
                        <div key={step} className="flex items-center gap-1">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                              isComplete
                                ? "bg-primary text-primary-foreground"
                                : isActive
                                ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {isComplete ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              idx + 1
                            )}
                          </div>
                          {idx < 3 && (
                            <div
                              className={`w-6 h-0.5 ${
                                idx < currentIdx ? "bg-primary" : "bg-muted"
                              }`}
                            />
                          )}
                        </div>
                      );
                    }
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Booking Type Selector */}
                {hasMultipleTypes && bookingStep === "date" && (
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Booking Type</Label>
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        onClick={() => { setBookingType("single"); setEndDate(undefined); setRecurringDays([]); }}
                        className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                          bookingType === "single"
                            ? "border-primary bg-primary/5"
                            : "border-muted hover:border-muted-foreground/30"
                        }`}
                      >
                        <CalendarDays className={`h-5 w-5 flex-shrink-0 ${bookingType === "single" ? "text-primary" : "text-muted-foreground"}`} />
                        <div>
                          <p className="text-sm font-medium">Single Day</p>
                          <p className="text-xs text-muted-foreground">Book for one date</p>
                        </div>
                      </button>
                      {supportsMultiDay && (
                        <button
                          onClick={() => { setBookingType("multi_day"); setRecurringDays([]); }}
                          className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                            bookingType === "multi_day"
                              ? "border-primary bg-primary/5"
                              : "border-muted hover:border-muted-foreground/30"
                          }`}
                        >
                          <CalendarRange className={`h-5 w-5 flex-shrink-0 ${bookingType === "multi_day" ? "text-primary" : "text-muted-foreground"}`} />
                          <div>
                            <p className="text-sm font-medium">Multi-Day</p>
                            <p className="text-xs text-muted-foreground">Consecutive days (e.g., 3-day event)</p>
                          </div>
                        </button>
                      )}
                      {supportsRecurring && (
                        <button
                          onClick={() => { setBookingType("recurring"); setEndDate(undefined); }}
                          className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                            bookingType === "recurring"
                              ? "border-primary bg-primary/5"
                              : "border-muted hover:border-muted-foreground/30"
                          }`}
                        >
                          <Repeat className={`h-5 w-5 flex-shrink-0 ${bookingType === "recurring" ? "text-primary" : "text-muted-foreground"}`} />
                          <div>
                            <p className="text-sm font-medium">Recurring</p>
                            <p className="text-xs text-muted-foreground">Weekly or biweekly schedule</p>
                          </div>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Step 1: Date Selection */}
                {bookingStep === "date" && (
                  <div>
                    <Label className="mb-2 block text-sm font-semibold">
                      {bookingType === "multi_day" ? "Step 1: Select Start Date" : bookingType === "recurring" ? "Step 1: Select Start Date" : "Step 1: Select a Date"}
                    </Label>
                    {weeklySchedule && weeklySchedule.length > 0 && (
                      <div className="mb-3 flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-3 rounded-full bg-primary/20 border border-primary/40 inline-block" />
                          Available
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-3 rounded-full bg-muted inline-block" />
                          Unavailable
                        </span>
                      </div>
                    )}
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => {
                        setSelectedDate(date);
                      }}
                      disabled={isDateDisabled}
                      className="rounded-md border"
                      modifiers={{
                        available: (date: Date) => !isDateDisabled(date),
                      }}
                      modifiersClassNames={{
                        available: "font-semibold text-primary",
                      }}
                    />
                    {!weeklySchedule || weeklySchedule.length === 0 ? (
                      <p className="text-sm text-amber-700 mt-3 flex items-center gap-1">
                        <Info className="h-4 w-4" />
                        This provider hasn't set their availability yet.
                      </p>
                    ) : null}

                    {/* Multi-Day: End Date Picker */}
                    {bookingType === "multi_day" && selectedDate && (
                      <div className="mt-4">
                        <Label className="mb-2 block text-sm font-semibold">Select End Date</Label>
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={(date) => setEndDate(date)}
                          disabled={(date) => {
                            if (!selectedDate) return true;
                            return date < selectedDate || date < new Date(new Date().setHours(0,0,0,0));
                          }}
                          className="rounded-md border"
                        />
                        {selectedDate && endDate && (
                          <div className="mt-3 bg-primary/5 border border-primary/20 rounded-lg p-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">Total Days</span>
                              <Badge variant="secondary" className="text-sm">{multiDayCount} day{multiDayCount !== 1 ? "s" : ""}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} — {endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </p>
                            {getNumericPrice() > 0 && (
                              <p className="text-sm font-semibold text-primary mt-1">
                                Estimated Total: {formatPrice(getMultiDayPrice())}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Recurring: Day of Week & Frequency */}
                    {bookingType === "recurring" && selectedDate && (
                      <div className="mt-4 space-y-4">
                        <div>
                          <Label className="mb-2 block text-sm font-semibold">Days of the Week</Label>
                          <div className="flex flex-wrap gap-2">
                            {DAY_NAMES.map((day, idx) => (
                              <button
                                key={idx}
                                onClick={() => {
                                  setRecurringDays(prev =>
                                    prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx].sort()
                                  );
                                }}
                                className={`w-10 h-10 rounded-full text-xs font-medium transition-all ${
                                  recurringDays.includes(idx)
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                                }`}
                              >
                                {day}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <Label className="mb-2 block text-sm font-semibold">Frequency</Label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => setRecurringFrequency("weekly")}
                              className={`p-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                                recurringFrequency === "weekly"
                                  ? "border-primary bg-primary/5 text-primary"
                                  : "border-muted text-muted-foreground hover:border-muted-foreground/30"
                              }`}
                            >
                              Weekly
                            </button>
                            <button
                              onClick={() => setRecurringFrequency("biweekly")}
                              className={`p-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                                recurringFrequency === "biweekly"
                                  ? "border-primary bg-primary/5 text-primary"
                                  : "border-muted text-muted-foreground hover:border-muted-foreground/30"
                              }`}
                            >
                              Biweekly
                            </button>
                          </div>
                        </div>

                        <div>
                          <Label className="mb-2 block text-sm font-semibold">Duration (weeks)</Label>
                          <div className="flex items-center gap-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setRecurringWeeks(Math.max(1, recurringWeeks - 1))}
                              className="h-9 w-9 p-0"
                            >
                              -
                            </Button>
                            <span className="text-lg font-semibold w-12 text-center">{recurringWeeks}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setRecurringWeeks(Math.min(52, recurringWeeks + 1))}
                              className="h-9 w-9 p-0"
                            >
                              +
                            </Button>
                            <span className="text-sm text-muted-foreground">weeks</span>
                          </div>
                        </div>

                        {recurringDays.length > 0 && (
                          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">Total Sessions</span>
                              <Badge variant="secondary" className="text-sm">{recurringSessionCount}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {recurringDays.map(d => DAY_NAMES_FULL[d]).join(", ")} • {recurringFrequency === "weekly" ? "Every week" : "Every 2 weeks"} • {recurringWeeks} weeks
                            </p>
                            {getNumericPrice() > 0 && (
                              <p className="text-sm font-semibold text-primary mt-1">
                                Estimated Total: {formatPrice(getRecurringPrice())}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Next button for multi-day and recurring */}
                    {(bookingType === "multi_day" || bookingType === "recurring") && selectedDate && (
                      <Button
                        className="w-full mt-4"
                        onClick={() => {
                          if (bookingType === "multi_day" && !endDate) {
                            toast.error("Please select an end date");
                            return;
                          }
                          if (bookingType === "recurring" && recurringDays.length === 0) {
                            toast.error("Please select at least one day of the week");
                            return;
                          }
                          setBookingStep("time");
                          setSelectedTime("");
                        }}
                      >
                        Next: Choose a Time
                      </Button>
                    )}
                  </div>
                )}

                {/* Step 2: Time Selection */}
                {bookingStep === "time" && selectedDate && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-sm font-semibold">
                        Step 2: Choose a Time
                      </Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setBookingStep("date");
                          setSelectedTime("");
                        }}
                        className="text-xs h-7"
                      >
                        <ArrowLeft className="h-3 w-3 mr-1" />
                        Change Date
                      </Button>
                    </div>

                    {/* Selected date display */}
                    <div className="bg-muted/50 rounded-lg p-3 mb-3">
                      <p className="text-sm font-medium">
                        {selectedDate.toLocaleDateString("en-US", {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                      {totalSlots > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {availableCount} of {totalSlots} slots available
                          {service?.isGroupClass && service.maxCapacity > 1 && (
                            <span className="ml-1">
                              (Group class · up to {service.maxCapacity} per session)
                            </span>
                          )}
                        </p>
                      )}
                    </div>

                    {/* Custom Duration option for DJ & Music, Photography, Event Planning services */}
                    {[20, 17, 177, 15, 19, 195, 109, 12, 202, 9, 148, 188, 201, 199].includes(service?.categoryId) && service?.pricingModel === "hourly" && (
                      <div className="mb-4 border rounded-lg p-3 bg-muted/30">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={useCustomDuration}
                            onChange={(e) => {
                              setUseCustomDuration(e.target.checked);
                              if (!e.target.checked) {
                                setCustomStartTime("");
                                setCustomEndTime("");
                              }
                            }}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                          <span className="text-sm font-medium">Custom Duration</span>
                          <span className="text-xs text-muted-foreground">(set your own start & end time)</span>
                        </label>

                        {useCustomDuration && (
                          <div className="mt-3 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs text-muted-foreground mb-1 block">Start Time</Label>
                                <input
                                  type="time"
                                  value={customStartTime}
                                  onChange={(e) => setCustomStartTime(e.target.value)}
                                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                                />
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground mb-1 block">End Time</Label>
                                <input
                                  type="time"
                                  value={customEndTime}
                                  onChange={(e) => setCustomEndTime(e.target.value)}
                                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                                />
                              </div>
                            </div>

                            {customStartTime && customEndTime && customDurationMinutes > 0 && (
                              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground">Duration</span>
                                  <span className="font-medium">{formatDuration(customDurationMinutes)}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm mt-1">
                                  <span className="text-muted-foreground">Rate</span>
                                  <span className="font-medium">{formatPrice(parseFloat(service.hourlyRate || "0"))}/hr</span>
                                </div>
                                <Separator className="my-2" />
                                <div className="flex items-center justify-between text-sm font-semibold text-primary">
                                  <span>Estimated Total</span>
                                  <span>{formatPrice(customDurationPrice)}</span>
                                </div>
                              </div>
                            )}

                            {customStartTime && customEndTime && customDurationMinutes <= 0 && (
                              <p className="text-xs text-destructive">End time must be after start time</p>
                            )}

                            {customStartTime && customEndTime && customDurationMinutes > 0 && (
                              <Button
                                className="w-full"
                                onClick={() => {
                                  setSelectedTime(customStartTime);
                                  setBookingStep("details");
                                }}
                              >
                                Continue with Custom Duration
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Standard time slot selection (hidden when custom duration is active) */}
                    {(!useCustomDuration || ![20, 17, 177, 15, 19, 195, 109, 12, 202, 9, 148, 188, 201, 199].includes(service?.categoryId)) && (<>
                    {agentHandoff?.preferredTime && selectedTime === agentHandoff.preferredTime && (
                      <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-950">
                        Your AI assistant suggested <strong>{formatTimeForDisplay(agentHandoff.preferredTime)}</strong>. Select the highlighted time to confirm and continue.
                      </div>
                    )}
                    {!weeklySchedule ? (
                      /* Skeleton while schedule is loading */
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div key={i} className="h-9 rounded-md bg-muted animate-pulse" />
                        ))}
                      </div>
                    ) : availableSlots.length === 0 ? (
                      <div className="text-center py-6">
                        <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">
                          No available time slots for this date.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3"
                          onClick={() => {
                            setBookingStep("date");
                            setSelectedDate(undefined);
                            setSelectedTime("");
                          }}
                        >
                          Pick Another Date
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                        {(() => {
                          // Group slots by time of day
                          const groups: { label: string; icon: React.ReactNode; slots: typeof availableSlots }[] = [];
                          const morning = availableSlots.filter(s => { const h = parseInt(s.time.split(':')[0]); return h >= 5 && h < 12 && !s.isNextDay; });
                          const afternoon = availableSlots.filter(s => { const h = parseInt(s.time.split(':')[0]); return h >= 12 && h < 17 && !s.isNextDay; });
                          const evening = availableSlots.filter(s => { const h = parseInt(s.time.split(':')[0]); return h >= 17 && h < 21 && !s.isNextDay; });
                          const night = availableSlots.filter(s => { const h = parseInt(s.time.split(':')[0]); return ((h >= 21 || h < 5) && !s.isNextDay); });
                          const nextDay = availableSlots.filter(s => s.isNextDay);

                          if (morning.length > 0) groups.push({ label: "Morning", icon: <Sunrise className="h-3.5 w-3.5" />, slots: morning });
                          if (afternoon.length > 0) groups.push({ label: "Afternoon", icon: <Sun className="h-3.5 w-3.5" />, slots: afternoon });
                          if (evening.length > 0) groups.push({ label: "Evening", icon: <Sunset className="h-3.5 w-3.5" />, slots: evening });
                          if (night.length > 0) groups.push({ label: "Night", icon: <Moon className="h-3.5 w-3.5" />, slots: night });
                          if (nextDay.length > 0) groups.push({ label: "Next Day", icon: <Moon className="h-3.5 w-3.5" />, slots: nextDay });

                          return groups.map((group) => (
                            <div key={group.label}>
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <span className="text-muted-foreground">{group.icon}</span>
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{group.label}</span>
                                {group.label === "Next Day" && (
                                  <Badge variant="outline" className="text-[9px] h-4 px-1 py-0 border-amber-400 text-amber-600 bg-amber-50">
                                    Past Midnight
                                  </Badge>
                                )}
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {group.slots.map((slot) => (
                                  <div key={slot.time + (slot.isNextDay ? '-next' : '')} className="flex flex-col items-center">
                                    <Button
                                      variant={
                                        selectedTime === slot.time ? "default" : "outline"
                                      }
                                      disabled={!slot.available}
                                      onClick={() => {
                                        setSelectedTime(slot.time);
                                        setBookingStep("details");
                                      }}
                                      className={`h-auto py-1.5 text-xs flex flex-col items-center gap-0.5 w-full ${
                                        !slot.available
                                          ? "opacity-40"
                                          : selectedTime === slot.time
                                          ? ""
                                          : "hover:border-primary hover:text-primary"
                                      }`}
                                    >
                                      <span className={!slot.available ? "line-through" : ""}>
                                        {formatTimeForDisplay(slot.time)}
                                        {slot.isNextDay && <span className="ml-1 text-[9px] text-amber-600 font-normal">+1</span>}
                                      </span>
                                      {service?.isGroupClass && slot.maxCapacity > 1 && (
                                        <span className={`text-[10px] font-normal ${
                                          !slot.available
                                            ? "text-destructive"
                                            : slot.spotsRemaining <= 3
                                            ? "text-amber-700"
                                            : "text-muted-foreground"
                                        }`}>
                                          {slot.available
                                            ? `${slot.spotsRemaining} spot${slot.spotsRemaining !== 1 ? "s" : ""} left`
                                            : "Full"}
                                        </span>
                                      )}
                                      {!service?.isGroupClass && !slot.available && (
                                        <span className="text-[10px] font-normal text-destructive">Booked</span>
                                      )}
                                    </Button>
                                    {/* Join Waitlist button for full group class slots */}
                                    {service?.isGroupClass && !slot.available && isAuthenticated && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-[10px] text-primary hover:text-primary/80 px-1 -mt-1"
                                        onClick={() => {
                                          joinWaitlistMutation.mutate({
                                            serviceId: parseInt(id!),
                                            providerId: service.providerId,
                                            bookingDate: selectedDateStr!,
                                            startTime: slot.time,
                                          });
                                        }}
                                        disabled={joinWaitlistMutation.isPending}
                                      >
                                        <Bell className="h-3 w-3 mr-0.5" />
                                        Notify Me
                                      </Button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    )}
                    </>)}
                  </div>
                )}

                {/* Step 3: Details */}
                {bookingStep === "details" && selectedDate && selectedTime && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-sm font-semibold">
                        Step 3: Booking Details
                      </Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setBookingStep("time")}
                        className="text-xs h-7"
                      >
                        <ArrowLeft className="h-3 w-3 mr-1" />
                        Change Time
                      </Button>
                    </div>

                    {/* Demo auto-fill notice */}
                    {(provider as any)?.isOfficial && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-amber-600 shrink-0" />
                        <p className="text-xs text-amber-700">Demo mode: Form pre-filled with sample data. Just click "Review Booking" to continue!</p>
                      </div>
                    )}

                    {/* Summary so far */}
                    <div className="bg-muted/50 rounded-lg p-3 mb-4 space-y-1">
                      <p className="text-sm">
                        <span className="text-muted-foreground">Date:</span>{" "}
                        <span className="font-medium">
                          {selectedDate.toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </p>
                      <p className="text-sm">
                        <span className="text-muted-foreground">Time:</span>{" "}
                        <span className="font-medium">
                          {useCustomDuration && [20, 17, 177, 15, 19, 195, 109, 12, 202, 9, 148, 188, 201, 199].includes(service.categoryId)
                            ? `${formatTimeForDisplay(customStartTime)} - ${formatTimeForDisplay(customEndTime)}`
                            : `${formatTimeForDisplay(selectedTime)} - ${formatTimeForDisplay(calculateEndTime(selectedTime, service.durationMinutes || 60))}`
                          }
                        </span>
                      </p>
                      {useCustomDuration && [20, 17, 177, 15, 19, 195, 109, 12, 202, 9, 148, 188, 201, 199].includes(service.categoryId) && customDurationMinutes > 0 && (
                        <p className="text-sm">
                          <span className="text-muted-foreground">Duration:</span>{" "}
                          <span className="font-medium">{formatDuration(customDurationMinutes)}</span>
                        </p>
                      )}
                    </div>

                    {/* Location Type Picker for FLEXIBLE services */}
                    {service.serviceType === "flexible" && (
                      <div className="space-y-3 mb-4">
                        <p className="text-sm font-medium">Where would you like this service?</p>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => setBookingForm({ ...bookingForm, djLocationType: "public_venue", addressLine1: "", city: "", state: "", postalCode: "", venueName: "" })}
                            className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-center transition-colors ${
                              bookingForm.djLocationType === "public_venue"
                                ? "border-primary bg-primary/5 text-primary"
                                : "border-border hover:border-muted-foreground/50"
                            }`}
                          >
                            <MapPin className="h-5 w-5" />
                            <span className="text-xs font-medium">Public Venue</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setBookingForm({ ...bookingForm, djLocationType: "private_location", addressLine1: "", city: "", state: "", postalCode: "", venueName: "" })}
                            className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-center transition-colors ${
                              bookingForm.djLocationType === "private_location"
                                ? "border-primary bg-primary/5 text-primary"
                                : "border-border hover:border-muted-foreground/50"
                            }`}
                          >
                            <MapPin className="h-5 w-5" />
                            <span className="text-xs font-medium">Private Location</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setBookingForm({ ...bookingForm, djLocationType: "virtual_stream", addressLine1: "", city: "", state: "", postalCode: "", venueName: "" })}
                            className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-center transition-colors ${
                              bookingForm.djLocationType === "virtual_stream"
                                ? "border-primary bg-primary/5 text-primary"
                                : "border-border hover:border-muted-foreground/50"
                            }`}
                          >
                            <Clock className="h-5 w-5" />
                            <span className="text-xs font-medium">Virtual Stream</span>
                          </button>
                        </div>

                        {/* Public Venue: Venue Name + Address */}
                        {bookingForm.djLocationType === "public_venue" && (
                          <div className="space-y-3 pt-2">
                            <Input
                              placeholder="Venue Name (e.g., The Grand Ballroom)"
                              value={bookingForm.venueName}
                              onChange={(e) => setBookingForm({ ...bookingForm, venueName: e.target.value })}
                            />
                            <Input
                              placeholder="Street Address"
                              value={bookingForm.addressLine1}
                              onChange={(e) => setBookingForm({ ...bookingForm, addressLine1: e.target.value })}
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <Input
                                placeholder="City"
                                value={bookingForm.city}
                                onChange={(e) => setBookingForm({ ...bookingForm, city: e.target.value })}
                              />
                              <Input
                                placeholder="State"
                                value={bookingForm.state}
                                onChange={(e) => setBookingForm({ ...bookingForm, state: e.target.value })}
                              />
                            </div>
                            <Input
                              placeholder="Postal Code"
                              value={bookingForm.postalCode}
                              onChange={(e) => setBookingForm({ ...bookingForm, postalCode: e.target.value })}
                            />
                          </div>
                        )}

                        {/* Private Location: Address only */}
                        {bookingForm.djLocationType === "private_location" && (
                          <div className="space-y-3 pt-2">
                            <Input
                              placeholder="Street Address"
                              value={bookingForm.addressLine1}
                              onChange={(e) => setBookingForm({ ...bookingForm, addressLine1: e.target.value })}
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <Input
                                placeholder="City"
                                value={bookingForm.city}
                                onChange={(e) => setBookingForm({ ...bookingForm, city: e.target.value })}
                              />
                              <Input
                                placeholder="State"
                                value={bookingForm.state}
                                onChange={(e) => setBookingForm({ ...bookingForm, state: e.target.value })}
                              />
                            </div>
                            <Input
                              placeholder="Postal Code"
                              value={bookingForm.postalCode}
                              onChange={(e) => setBookingForm({ ...bookingForm, postalCode: e.target.value })}
                            />
                          </div>
                        )}

                        {/* Virtual Stream: No additional fields */}
                        {bookingForm.djLocationType === "virtual_stream" && (
                          <p className="text-xs text-muted-foreground italic pt-1">No additional location details needed for virtual streams.</p>
                        )}
                      </div>
                    )}

                    {/* Fixed location (Public Venue) - non-flexible services */}
                    {service.serviceType === "fixed_location" && (
                      <div className="space-y-3 mb-4">
                        <p className="text-sm font-medium">Venue Details</p>
                        <Input
                          placeholder="Venue Name (e.g., The Grand Ballroom)"
                          value={bookingForm.venueName}
                          onChange={(e) => setBookingForm({ ...bookingForm, venueName: e.target.value })}
                        />
                        <Input
                          placeholder="Street Address"
                          value={bookingForm.addressLine1}
                          onChange={(e) => setBookingForm({ ...bookingForm, addressLine1: e.target.value })}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            placeholder="City"
                            value={bookingForm.city}
                            onChange={(e) => setBookingForm({ ...bookingForm, city: e.target.value })}
                          />
                          <Input
                            placeholder="State"
                            value={bookingForm.state}
                            onChange={(e) => setBookingForm({ ...bookingForm, state: e.target.value })}
                          />
                        </div>
                        <Input
                          placeholder="Postal Code"
                          value={bookingForm.postalCode}
                          onChange={(e) => setBookingForm({ ...bookingForm, postalCode: e.target.value })}
                        />
                      </div>
                    )}

                    {/* Mobile / Hybrid - non-flexible services */}
                    {(service.serviceType === "mobile" || service.serviceType === "hybrid") && (
                      <div className="space-y-3 mb-4">
                        <p className="text-sm font-medium">Service Address</p>
                        <Input
                          placeholder="Street Address"
                          value={bookingForm.addressLine1}
                          onChange={(e) => setBookingForm({ ...bookingForm, addressLine1: e.target.value })}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            placeholder="City"
                            value={bookingForm.city}
                            onChange={(e) => setBookingForm({ ...bookingForm, city: e.target.value })}
                          />
                          <Input
                            placeholder="State"
                            value={bookingForm.state}
                            onChange={(e) => setBookingForm({ ...bookingForm, state: e.target.value })}
                          />
                        </div>
                        <Input
                          placeholder="Postal Code"
                          value={bookingForm.postalCode}
                          onChange={(e) => setBookingForm({ ...bookingForm, postalCode: e.target.value })}
                        />
                      </div>
                    )}

                    <div className="mb-4">
                      <div className="flex items-center gap-1.5">
                        <Label htmlFor="notes" className="text-sm">
                          Special Requests (optional)
                        </Label>
                        <HelpTip text="Let the provider know about any preferences, allergies, or specific needs. This helps them prepare for your appointment." />
                      </div>
                      <Textarea
                        id="notes"
                        value={bookingForm.notes}
                        onChange={(e) =>
                          setBookingForm({
                            ...bookingForm,
                            notes: e.target.value,
                          })
                        }
                        placeholder="Any special requests or notes for the provider..."
                        rows={3}
                        className="mt-1"
                      />
                    </div>

                    <Button
                      className="w-full"
                      onClick={() => setBookingStep("confirm")}
                    >
                      Review Booking
                    </Button>
                  </div>
                )}

                {/* Step 4: Confirm */}
                {bookingStep === "confirm" && selectedDate && selectedTime && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-sm font-semibold">
                        Step 4: Confirm & Pay
                      </Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setBookingStep("details")}
                        className="text-xs h-7"
                      >
                        <ArrowLeft className="h-3 w-3 mr-1" />
                        Edit Details
                      </Button>
                    </div>

                    <div className="space-y-3 mb-4">
                      <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                        <h4 className="font-semibold text-sm">{service.name}</h4>
                        <p className="text-xs text-muted-foreground">
                          with {provider?.businessName}
                        </p>
                        <Separator />
                        {bookingType === "multi_day" && endDate ? (
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                              <CalendarRange className="h-4 w-4 text-primary" />
                              <span className="font-medium">Multi-Day Booking</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <p className="text-muted-foreground text-xs">Start Date</p>
                                <p className="font-medium">{selectedDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground text-xs">End Date</p>
                                <p className="font-medium">{endDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground text-xs">Total Days</p>
                                <p className="font-medium">{multiDayCount} day{multiDayCount !== 1 ? "s" : ""}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground text-xs">Daily Time</p>
                                <p className="font-medium">{formatTimeForDisplay(selectedTime)}</p>
                              </div>
                            </div>
                          </div>
                        ) : bookingType === "recurring" ? (
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                              <Repeat className="h-4 w-4 text-primary" />
                              <span className="font-medium">Recurring Booking</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <p className="text-muted-foreground text-xs">Starts</p>
                                <p className="font-medium">{selectedDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground text-xs">Time</p>
                                <p className="font-medium">{formatTimeForDisplay(selectedTime)}</p>
                              </div>
                              <div className="col-span-2">
                                <p className="text-muted-foreground text-xs">Schedule</p>
                                <p className="font-medium">{recurringDays.map(d => DAY_NAMES_FULL[d]).join(", ")}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground text-xs">Frequency</p>
                                <p className="font-medium capitalize">{recurringFrequency}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground text-xs">Sessions</p>
                                <p className="font-medium">{recurringSessionCount} sessions over {recurringWeeks} weeks</p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <p className="text-muted-foreground text-xs">Date</p>
                              <p className="font-medium">
                                {selectedDate.toLocaleDateString("en-US", {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">Time</p>
                              <p className="font-medium">
                                {useCustomDuration && [20, 17, 177, 15, 19, 195, 109, 12, 202, 9, 148, 188, 201, 199].includes(service.categoryId)
                                  ? `${formatTimeForDisplay(customStartTime)} - ${formatTimeForDisplay(customEndTime)}`
                                  : formatTimeForDisplay(selectedTime)
                                }
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">Duration</p>
                              <p className="font-medium">
                                {useCustomDuration && [20, 17, 177, 15, 19, 195, 109, 12, 202, 9, 148, 188, 201, 199].includes(service.categoryId) && customDurationMinutes > 0
                                  ? formatDuration(customDurationMinutes)
                                  : formatDuration(service.durationMinutes)
                                }
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">Type</p>
                              <p className="font-medium">
                                {service.serviceType === "flexible" && bookingForm.djLocationType
                                  ? bookingForm.djLocationType === "public_venue" ? "Public Venue"
                                    : bookingForm.djLocationType === "private_location" ? "Private Location"
                                    : "Virtual Stream"
                                  : getServiceTypeLabel(service.serviceType, service.categoryId)
                                }
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Show address in confirm step for flexible services */}
                        {service.serviceType === "flexible" && bookingForm.djLocationType && bookingForm.djLocationType !== "virtual_stream" && bookingForm.addressLine1 && (
                          <>
                            <Separator />
                            <div>
                              <p className="text-muted-foreground text-xs">{bookingForm.djLocationType === "public_venue" ? "Venue" : "Address"}</p>
                              {bookingForm.venueName && <p className="text-sm font-medium">{bookingForm.venueName}</p>}
                              <p className="text-sm">{bookingForm.addressLine1}{bookingForm.city ? `, ${bookingForm.city}` : ""}{bookingForm.state ? `, ${bookingForm.state}` : ""} {bookingForm.postalCode}</p>
                            </div>
                          </>
                        )}

                        {bookingForm.notes && (
                          <>
                            <Separator />
                            <div>
                              <p className="text-muted-foreground text-xs">Notes</p>
                              <p className="text-sm">{bookingForm.notes}</p>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Referral Code Input */}
                      <div className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Gift className="h-4 w-4 text-purple-500" />
                          <span>Have a referral code?</span>
                        </div>
                        {referralApplied?.valid ? (
                          <div className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-lg p-3">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-purple-600" />
                              <div>
                                <p className="text-sm font-medium text-purple-800">
                                  {referralCode}
                                </p>
                                <p className="text-xs text-purple-600">
                                  {referralApplied.refereeDiscountPercent}% off your booking!
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setReferralCode("");
                                setReferralApplied(null);
                              }}
                              className="h-7 w-7 p-0 text-purple-700 hover:text-red-600 hover:bg-red-50"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <Input
                              placeholder="Enter referral code (e.g. REF-XXXXX)"
                              value={referralCode}
                              onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && referralCode.trim()) {
                                  setReferralValidating(true);
                                  validateReferral.mutate(
                                    { code: referralCode.trim() },
                                    {
                                      onSuccess: (result) => {
                                        if (result.valid) {
                                          setReferralApplied(result as any);
                                          toast.success(`Referral code applied! ${result.refereeDiscountPercent}% off!`);
                                        } else {
                                          toast.error(result.error || "Invalid referral code");
                                          setReferralApplied(null);
                                        }
                                      },
                                      onError: (err) => {
                                        toast.error(err.message || "Failed to validate");
                                        setReferralApplied(null);
                                      },
                                      onSettled: () => setReferralValidating(false),
                                    }
                                  );
                                }
                              }}
                              className="flex-1 uppercase text-sm h-9"
                              disabled={referralValidating}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (!referralCode.trim()) return;
                                setReferralValidating(true);
                                validateReferral.mutate(
                                  { code: referralCode.trim() },
                                  {
                                    onSuccess: (result) => {
                                      if (result.valid) {
                                        setReferralApplied(result as any);
                                        toast.success(`Referral code applied! ${result.refereeDiscountPercent}% off!`);
                                      } else {
                                        toast.error(result.error || "Invalid referral code");
                                        setReferralApplied(null);
                                      }
                                    },
                                    onError: (err) => {
                                      toast.error(err.message || "Failed to validate");
                                      setReferralApplied(null);
                                    },
                                    onSettled: () => setReferralValidating(false),
                                  }
                                );
                              }}
                              disabled={referralValidating || !referralCode.trim()}
                              className="h-9 px-4"
                            >
                              {referralValidating ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Apply"
                              )}
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Promo Code Input */}
                      <div className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Tag className="h-4 w-4 text-primary" />
                          <span>Have a promo code?</span>
                        </div>
                        {promoApplied?.valid ? (
                          <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-3">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                              <div>
                                <p className="text-sm font-medium text-green-800">
                                  {promoApplied.code}
                                </p>
                                <p className="text-xs text-green-600">
                                  {promoApplied.description || `You save ${formatPrice(promoApplied.discountAmount)}`}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleRemovePromo}
                              className="h-7 w-7 p-0 text-green-700 hover:text-red-600 hover:bg-red-50"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <Input
                              placeholder="Enter code"
                              value={promoCode}
                              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                              onKeyDown={(e) => e.key === "Enter" && handleApplyPromo()}
                              className="flex-1 uppercase text-sm h-9"
                              disabled={promoValidating}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleApplyPromo}
                              disabled={promoValidating || !promoCode.trim()}
                              className="h-9 px-4"
                            >
                              {promoValidating ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Apply"
                              )}
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Pricing */}
                      <div className="border rounded-lg p-4 space-y-2">
                        {useCustomDuration && [20, 17, 177, 15, 19, 195, 109, 12, 202, 9, 148, 188, 201, 199].includes(service.categoryId) && customDurationMinutes > 0 ? (
                          <>
                            <div className="flex justify-between text-sm">
                              <span>Hourly Rate</span>
                              <span className="font-medium">{formatPrice(parseFloat(service.hourlyRate || "0"))}/hr</span>
                            </div>
                            <div className="flex justify-between text-sm text-muted-foreground">
                              <span>{formatDuration(customDurationMinutes)} ({(customDurationMinutes / 60).toFixed(1)} hrs)</span>
                              <span className="font-medium">{formatPrice(customDurationPrice)}</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex justify-between text-sm">
                            <span>{bookingType === "multi_day" ? `Price per Day` : bookingType === "recurring" ? `Price per Session` : getDurationPricingLabel(service.durationMinutes) === "Day Rate" ? "Day Rate" : `Service Price`}</span>
                            <span className="font-medium">{getPrice()}</span>
                          </div>
                        )}
                        {bookingType === "multi_day" && (
                          <div className="flex justify-between text-sm text-muted-foreground">
                            <span>× {multiDayCount} days</span>
                            <span className="font-medium">{formatPrice(getMultiDayPrice())}</span>
                          </div>
                        )}
                        {bookingType === "recurring" && (
                          <div className="flex justify-between text-sm text-muted-foreground">
                            <span>× {recurringSessionCount} sessions</span>
                            <span className="font-medium">{formatPrice(getRecurringPrice())}</span>
                          </div>
                        )}
                        {referralApplied?.valid && (
                          <div className="flex justify-between text-sm text-purple-700">
                            <span className="flex items-center gap-1">
                              <Gift className="h-3 w-3" />
                              Referral Discount ({referralApplied.refereeDiscountPercent}%)
                            </span>
                            <span className="font-medium">
                              -{formatPrice(getNumericPrice() * referralApplied.refereeDiscountPercent / 100)}
                            </span>
                          </div>
                        )}
                        {promoApplied?.valid && promoApplied.discountAmount > 0 && (
                          <div className="flex justify-between text-sm text-green-700">
                            <span className="flex items-center gap-1">
                              <Tag className="h-3 w-3" />
                              Promo Discount
                            </span>
                            <span className="font-medium">-{formatPrice(promoApplied.discountAmount)}</span>
                          </div>
                        )}
                        {service.depositRequired && (
                          <div className="flex justify-between text-sm text-amber-700">
                            <span>Deposit Due Now</span>
                            <span className="font-medium">
                              {service.depositType === "fixed"
                                ? `${formatPrice(parseFloat(service.depositAmount || "0"))}`
                                : `${service.depositPercentage}%`}
                            </span>
                          </div>
                        )}
                        <Separator />
                        <div className="flex justify-between font-semibold">
                          <span>Total</span>
                          <span>
                            {promoApplied?.valid && promoApplied.discountAmount > 0
                              ? `${formatPrice(promoApplied.finalAmount)}`
                              : useCustomDuration && [20, 17, 177, 15, 19, 195, 109, 12, 202, 9, 148, 188, 201, 199].includes(service.categoryId) && customDurationPrice > 0
                              ? `${formatPrice(customDurationPrice)}`
                              : bookingType === "multi_day"
                              ? `${formatPrice(getMultiDayPrice())}`
                              : bookingType === "recurring"
                              ? `${formatPrice(getRecurringPrice())}`
                              : getPrice()}
                          </span>
                        </div>
                        {promoApplied?.valid && promoApplied.discountAmount > 0 && (
                          <p className="text-xs text-green-600 text-right">
                            You save {formatPrice(promoApplied.discountAmount)}!
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Simulated Payment Step for Demo Provider */}
                    {(provider as any)?.isOfficial ? (
                      <div className="space-y-3">
                        {/* Simulated payment card UI */}
                        <div className="border-2 border-dashed border-amber-300 rounded-lg p-4 bg-amber-50/50 space-y-3">
                          <div className="flex items-center gap-2 mb-2">
                            <CreditCard className="h-5 w-5 text-amber-600" />
                            <span className="text-sm font-semibold text-amber-800">Payment Method (Demo)</span>
                          </div>
                          {/* Mock card input fields */}
                          <div className="space-y-2">
                            <div className="bg-white border border-gray-200 rounded-md p-3 flex items-center gap-3">
                              <div className="flex gap-1">
                                <div className="w-8 h-5 bg-blue-600 rounded-sm" />
                                <div className="w-8 h-5 bg-red-500 rounded-sm" />
                                <div className="w-8 h-5 bg-yellow-500 rounded-sm" />
                              </div>
                              <span className="text-sm text-muted-foreground flex-1">•••• •••• •••• 4242</span>
                              <ShieldCheck className="h-4 w-4 text-green-600" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="bg-white border border-gray-200 rounded-md p-2.5">
                                <span className="text-xs text-muted-foreground">12/28</span>
                              </div>
                              <div className="bg-white border border-gray-200 rounded-md p-2.5">
                                <span className="text-xs text-muted-foreground">•••</span>
                              </div>
                            </div>
                          </div>
                          <div className="bg-amber-100 border border-amber-200 rounded-md p-2.5 text-center">
                            <p className="text-xs font-medium text-amber-800">
                              ✓ No credit card required for demo bookings
                            </p>
                            <p className="text-xs text-amber-700 mt-0.5">
                              This simulates the payment experience — you won't be charged
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={handleBooking}
                          disabled={isBookingPending || isBookingSuccess}
                          className={`w-full transition-all duration-300 bg-amber-700 hover:bg-amber-800 text-white ${isBookingSuccess ? 'bg-green-600 hover:bg-green-600 cursor-default scale-[0.98]' : isBookingPending ? 'opacity-90' : ''}`}
                          size="lg"
                        >
                          {isBookingSuccess ? (
                            <span className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 animate-in fade-in" />
                              Demo Booking Complete!
                            </span>
                          ) : isBookingPending ? (
                            <span className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Processing demo booking...
                            </span>
                          ) : "Complete Demo Booking (Free)"}
                        </Button>
                      </div>
                    ) : service.pricingModel !== "custom_quote" && service.pricingModel !== "consultation" && getNumericPrice() > 0 && !service.requireUpfrontPayment && canAcceptPlatformPayments ? (
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-center text-muted-foreground">How would you like to pay?</p>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setPaymentChoice("pay_now")}
                            className={`p-3 rounded-lg border-2 text-left transition-all ${
                              paymentChoice === "pay_now"
                                ? "border-primary bg-primary/5"
                                : "border-muted hover:border-muted-foreground/30"
                            }`}
                          >
                            <CreditCard className={`h-5 w-5 mb-1 ${paymentChoice === "pay_now" ? "text-primary" : "text-muted-foreground"}`} />
                            <p className="text-sm font-medium">Pay Now</p>
                            <p className="text-xs text-muted-foreground">Secure your spot instantly</p>
                          </button>
                          <button
                            type="button"
                            onClick={() => setPaymentChoice("pay_at_location")}
                            className={`p-3 rounded-lg border-2 text-left transition-all ${
                              paymentChoice === "pay_at_location"
                                ? "border-primary bg-primary/5"
                                : "border-muted hover:border-muted-foreground/30"
                            }`}
                          >
                            <MapPin className={`h-5 w-5 mb-1 ${paymentChoice === "pay_at_location" ? "text-primary" : "text-muted-foreground"}`} />
                            <p className="text-sm font-medium">Pay at Location</p>
                            <p className="text-xs text-muted-foreground">Pay the provider in person</p>
                          </button>
                          <button
                            type="button"
                            onClick={() => setPaymentChoice("pay_after_confirmation")}
                            className={`p-3 rounded-lg border-2 text-left transition-all ${
                              paymentChoice === "pay_after_confirmation"
                                ? "border-primary bg-primary/5"
                                : "border-muted hover:border-muted-foreground/30"
                            }`}
                          >
                            <ShieldCheck className={`h-5 w-5 mb-1 ${paymentChoice === "pay_after_confirmation" ? "text-primary" : "text-muted-foreground"}`} />
                            <p className="text-sm font-medium">Pay Later</p>
                            <p className="text-xs text-muted-foreground">Pay after provider confirms</p>
                          </button>
                        </div>
                        <Button
                          onClick={handleBooking}
                          disabled={isBookingPending || isBookingSuccess}
                          className={`w-full transition-all duration-300 ${isBookingSuccess ? 'bg-green-600 hover:bg-green-600 cursor-default scale-[0.98]' : isBookingPending ? 'opacity-90' : ''}`}
                          size="lg"
                        >
                          {isBookingSuccess ? (
                            <span className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 animate-in fade-in" />
                              Request Sent!
                            </span>
                          ) : isBookingPending ? (
                            <span className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Processing your booking...
                            </span>
                          ) : paymentChoice === "pay_now"
                            ? (service.depositRequired ? "Pay Deposit & Book" : "Pay & Book")
                            : "Submit Booking Request"}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        onClick={handleBooking}
                        disabled={isBookingPending || isBookingSuccess}
                        className={`w-full transition-all duration-300 ${isBookingSuccess ? 'bg-green-600 hover:bg-green-600 cursor-default scale-[0.98]' : isBookingPending ? 'opacity-90' : ''}`}
                        size="lg"
                      >
                        {isBookingSuccess ? (
                          <span className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 animate-in fade-in" />
                            Request Sent!
                          </span>
                        ) : isBookingPending ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Processing your booking...
                          </span>
                        ) : service.requireUpfrontPayment && canAcceptPlatformPayments
                          ? (service.depositRequired ? "Pay Deposit & Book" : "Pay & Book")
                          : bookingType === "multi_day"
                          ? `Confirm ${multiDayCount}-Day Booking`
                          : bookingType === "recurring"
                          ? `Confirm ${recurringSessionCount} Sessions`
                          : "Confirm Booking"}
                      </Button>
                    )}

                    {/* Inline error display with retry */}
                    {bookingError && !isBookingPending && !isBookingSuccess && (
                      <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg animate-in fade-in slide-in-from-top-1">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs text-destructive font-medium">{bookingError}</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-1.5 h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 px-2"
                              onClick={() => {
                                setBookingError(null);
                                handleBooking();
                              }}
                            >
                              Try Again
                            </Button>
                          </div>
                          <button
                            onClick={() => setBookingError(null)}
                            className="text-destructive/60 hover:text-destructive"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}

                    {!isAuthenticated && (
                      <p className="text-xs text-center text-muted-foreground mt-2">
                        You'll be asked to sign in before completing the booking.
                      </p>
                    )}
                    {isAuthenticated && user && !user.emailVerified && (
                      <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-xs text-amber-800 text-center">
                          ⚠️ Please verify your email address to complete bookings.{" "}
                          <a href="/verify-email" className="underline font-medium">Resend verification email</a>
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
