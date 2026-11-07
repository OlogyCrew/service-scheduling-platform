import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CheckCircle, Calendar, Clock, MapPin, DollarSign, Gift, Loader2, Share2, Copy, Users, XCircle, Search } from "lucide-react";
import { useLocation, useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { formatTimeForDisplay } from "@shared/timeSlots";
import { toast } from "sonner";
import { NavHeader } from "@/components/shared/NavHeader";
import { formatPrice } from "@shared/formatPrice";
import { PaymentMethods } from "@/components/PaymentMethods";

function ShareReferralLink() {
  const { data: myCode } = trpc.referral.getMyCode.useQuery();
  const [copied, setCopied] = useState(false);

  const referralLink = myCode ? `${window.location.origin}/?ref=${myCode.code}` : "";

  const handleCopy = () => {
    if (referralLink) {
      navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success("Referral link copied!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (navigator.share && referralLink) {
      try {
        await navigator.share({
          title: "Join OlogyCrew",
          text: "Book trusted service professionals and get a discount with my referral link!",
          url: referralLink,
        });
      } catch {
        handleCopy();
      }
    } else {
      handleCopy();
    }
  };

  if (!myCode) return null;

  return (
    <div className="flex gap-2">
      <div className="flex-1 bg-white rounded-lg border border-amber-200 px-3 py-2 text-sm text-amber-800 truncate font-mono">
        {referralLink}
      </div>
      <Button
        size="sm"
        variant="outline"
        className="border-amber-300 text-amber-700 hover:bg-amber-100"
        onClick={handleCopy}
      >
        <Copy className="h-4 w-4" />
        {copied ? "Copied!" : "Copy"}
      </Button>
      <Button
        size="sm"
        className="bg-amber-600 hover:bg-amber-700 text-white"
        onClick={handleShare}
      >
        <Share2 className="h-4 w-4" />
        Share
      </Button>
    </div>
  );
}

export default function BookingConfirmation() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [useCredits, setUseCredits] = useState(true);

  // Credit balance
  const { data: creditBalance } = trpc.referral.getCreditBalance.useQuery(
    undefined,
    { enabled: !!user }
  );

  // Credit preview for this booking
  const { data: creditPreview } = trpc.stripe.previewCreditDiscount.useQuery(
    { bookingId: parseInt(id!) },
    { enabled: !!id && !!user && useCredits }
  );

  const createCheckout = trpc.stripe.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      } else if (data.paidWithCredits && !data.url) {
        toast.success("Booking paid in full with referral credits!");
        setLocation("/my-bookings");
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create checkout session");
    },
  });

  const cancelDemo = trpc.booking.cancel.useMutation({
    onSuccess: () => {
      toast.success("Demo booking cancelled successfully!");
      setLocation("/my-bookings");
    },
    onError: (err: any) => toast.error(err.message || "Failed to cancel demo booking"),
  });

  const handlePayment = () => {
    if (!id) return;
    createCheckout.mutate({
      bookingId: parseInt(id),
      useCredits,
    });
  };

  const { data: booking, isLoading } = trpc.booking.getById.useQuery({ id: parseInt(id!) });
  const { data: service } = trpc.service.getById.useQuery(
    { id: booking?.serviceId || 0 },
    { enabled: !!booking }
  );
  const { data: provider } = trpc.provider.getById.useQuery(
    { id: booking?.providerId || 0 },
    { enabled: !!booking }
  );
  const { data: offlinePayment } = trpc.offlinePayment.getForBooking.useQuery(
    { bookingId: booking?.id || 0 },
    { enabled: !!booking }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!booking || !service || !provider) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Booking Not Found</CardTitle>
            <CardDescription>The booking you're looking for doesn't exist.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/")}>Go Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getPrice = () => {
    // If booking has a stored totalAmount, use it (covers custom duration bookings)
    if (booking.totalAmount && parseFloat(booking.totalAmount) > 0) {
      return `${formatPrice(parseFloat(booking.totalAmount))}`;
    }
    if (service.pricingModel === "fixed" && service.basePrice) {
      return `${formatPrice(parseFloat(service.basePrice))}`;
    }
    if (service.pricingModel === "hourly" && service.hourlyRate) {
      // Use the actual booked duration, not the service default
      const hours = (booking.durationMinutes || service.durationMinutes || 60) / 60;
      return `${formatPrice((parseFloat(service.hourlyRate) * hours))}`;
    }
    return "TBD";
  };

  const getPriceNum = () => {
    // If booking has a stored totalAmount, use it (covers custom duration bookings)
    if (booking.totalAmount && parseFloat(booking.totalAmount) > 0) {
      return parseFloat(booking.totalAmount);
    }
    if (service.pricingModel === "fixed" && service.basePrice) {
      return parseFloat(service.basePrice);
    }
    if (service.pricingModel === "hourly" && service.hourlyRate) {
      // Use the actual booked duration, not the service default
      const hours = (booking.durationMinutes || service.durationMinutes || 60) / 60;
      return parseFloat(service.hourlyRate) * hours;
    }
    return 0;
  };

  const getDepositAmount = () => {
    if (!service.depositRequired) return null;

    const totalPrice = getPriceNum();

    if (service.depositType === "fixed") {
      return parseFloat(service.depositAmount || "0");
    } else {
      return totalPrice * (parseFloat(service.depositPercentage || "0") / 100);
    }
  };

  const depositAmount = getDepositAmount();
  const availableCredits = parseFloat(creditBalance?.balance || "0");
  const creditDiscount = parseFloat(creditPreview?.applicableCredit || "0");
  const hasCredits = availableCredits > 0;

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

      <div className="container py-12 max-w-3xl">
        {offlinePayment ? (
          <Card className="mb-6 border-amber-200 bg-amber-50/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Pay at Location</CardTitle>
              <CardDescription>Payment status: <span className="font-semibold capitalize">{offlinePayment.status}</span></CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>Amount due: <span className="font-semibold">{formatPrice(Number(offlinePayment.originalAmountDue))}</span></p>
              {offlinePayment.providerInstructions ? <p className="text-muted-foreground">Provider instructions: {offlinePayment.providerInstructions}</p> : null}
              <p className="text-xs text-muted-foreground">Only the provider or an authorized administrator can record payment or waive this amount.</p>
            </CardContent>
          </Card>
        ) : null}

        {/* Success Message */}
        <div className="text-center mb-8">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
            (booking as any).paidAt ? 'bg-green-100' : booking.status === 'confirmed' ? 'bg-blue-100' : 'bg-green-100'
          }`}>
            <CheckCircle className={`h-8 w-8 ${
              (booking as any).paidAt ? 'text-green-600' : booking.status === 'confirmed' ? 'text-blue-600' : 'text-green-600'
            }`} />
          </div>
          <h1 className="text-3xl font-bold mb-2">
            {(booking as any).paidAt
              ? "Booking Confirmed & Paid!"
              : booking.status === "confirmed"
              ? "Booking Confirmed — Payment Required"
              : "Booking Request Submitted!"}
          </h1>
          <p className="text-muted-foreground">
            {(booking as any).paidAt
              ? "Your booking is fully confirmed and paid."
              : booking.status === "confirmed"
              ? "The provider has confirmed your booking. Please complete payment to secure your spot."
              : "Your booking has been submitted and is pending provider confirmation."}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Booking Number: <span className="font-mono font-semibold">{booking.bookingNumber}</span>
          </p>
        </div>

        {/* Booking Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{service.name}</CardTitle>
            <CardDescription>by {provider.businessName}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-semibold">{formatDate(booking.bookingDate)}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Time</p>
                  <p className="font-semibold">
                    {formatTimeForDisplay(booking.startTime)} - {formatTimeForDisplay(booking.endTime)}
                  </p>
                </div>
              </div>

              {(booking as any).venueName && (
                <div className="flex items-start gap-3 md:col-span-2">
                  <MapPin className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Venue</p>
                    <p className="font-semibold">{(booking as any).venueName}</p>
                  </div>
                </div>
              )}

              {booking.locationType === "mobile" && booking.serviceAddressLine1 && (
                <div className="flex items-start gap-3 md:col-span-2">
                  <MapPin className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Service Location</p>
                    <p className="font-semibold">
                      {booking.serviceAddressLine1}
                      {booking.serviceAddressLine2 && `, ${booking.serviceAddressLine2}`}
                    </p>
                    <p className="text-sm">
                      {booking.serviceCity}, {booking.serviceState} {booking.servicePostalCode}
                    </p>
                  </div>
                </div>
              )}

              {booking.locationType === "fixed_location" && provider.addressLine1 && (
                <div className="flex items-start gap-3 md:col-span-2">
                  <MapPin className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Provider Location</p>
                    <p className="font-semibold">{provider.addressLine1}</p>
                    <p className="text-sm">
                      {provider.city}, {provider.state} {provider.postalCode}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {booking.customerNotes && (
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-1">Your Notes</p>
                <p className="text-sm">{booking.customerNotes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Information */}
        {(provider as any)?.isOfficial ? (
          <Card className="mb-6 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-800">
                Demo Booking — No Charge
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-amber-700">
                This is a demo booking with <strong>Demo - OlogyCrew</strong>. No payment is required.
                You just experienced how easy it is to book a service on OlogyCrew!
              </p>
              <p className="text-xs text-amber-700">
                Ready to book a real provider? Browse our categories to find the perfect service for you.
              </p>
            </CardContent>
          </Card>
        ) : !(provider as any)?.canAcceptPlatformPayments ? (
          <Card className="mb-6 border-blue-200 bg-blue-50/60">
            <CardHeader>
              <CardTitle>Payment Arranged with Provider</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                This provider is not currently accepting online payments through OlogyCrew. No charge has been created. The provider can confirm your booking and arrange payment directly with you.
              </p>
            </CardContent>
          </Card>
        ) : (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Payment Information
              {hasCredits && (
                <Badge variant="outline" className="border-emerald-300 text-emerald-600 text-xs font-normal">
                  <Gift className="h-3 w-3 mr-1" /> Credits Available
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Service Price</span>
              <span className="font-semibold">{getPrice()}</span>
            </div>

            {depositAmount && (
              <div className="flex justify-between items-center text-primary">
                <span>Deposit Required</span>
                <span className="font-semibold">{formatPrice(depositAmount)}</span>
              </div>
            )}

            {/* Credit Application Toggle */}
            {hasCredits && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gift className="h-4 w-4 text-emerald-600" />
                    <Label className="text-sm font-medium text-emerald-700">
                      Apply Referral Credits
                    </Label>
                  </div>
                  <Switch
                    checked={useCredits}
                    onCheckedChange={setUseCredits}
                  />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-emerald-600">Available balance</span>
                  <span className="font-semibold text-emerald-600">{formatPrice(availableCredits)}</span>
                </div>
                {useCredits && creditDiscount > 0 && (
                  <div className="flex justify-between text-sm pt-2 border-t border-emerald-200">
                    <span className="text-emerald-700 font-medium">Credit discount</span>
                    <span className="font-bold text-emerald-700">-{formatPrice(creditDiscount)}</span>
                  </div>
                )}
                {useCredits && creditPreview?.coversFullAmount && (
                  <p className="text-xs text-emerald-600 font-medium">
                    Your credits fully cover this payment — no card needed!
                  </p>
                )}
              </div>
            )}

            {/* Total */}
            {depositAmount ? (
              <>
                <div className="flex justify-between items-center pt-3 border-t">
                  <span className="font-semibold">
                    {useCredits && creditDiscount > 0 ? "Deposit After Credits" : "Deposit Due"}
                  </span>
                  <div className="text-right">
                    {useCredits && creditDiscount > 0 && (
                      <span className="text-sm text-muted-foreground line-through mr-2">
                        {formatPrice(depositAmount)}
                      </span>
                    )}
                    <span className="font-bold text-lg">
                      {formatPrice(Math.max(0, depositAmount - creditDiscount))}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Remaining balance due after service completion
                </p>
              </>
            ) : (
              <>
                {useCredits && creditDiscount > 0 && (
                  <div className="flex justify-between items-center pt-3 border-t">
                    <span className="font-semibold">Total After Credits</span>
                    <div className="text-right">
                      <span className="text-sm text-muted-foreground line-through mr-2">
                        {getPrice()}
                      </span>
                      <span className="font-bold text-lg">
                        {formatPrice(Math.max(0, getPriceNum() - creditDiscount))}
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}

            {!depositAmount && booking.status === "pending" && (
              <p className="text-sm text-muted-foreground">
                Payment will be processed after provider confirms the booking.
              </p>
            )}

            <Separator className="my-3" />
            <PaymentMethods size="sm" className="mt-2" />
          </CardContent>
        </Card>
        )}

        {/* Next Steps */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>What's Next?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                1
              </div>
              <div>
                <p className="font-semibold">Provider Review</p>
                <p className="text-sm text-muted-foreground">
                  {provider.businessName} will review your booking request and confirm availability.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                2
              </div>
              <div>
                <p className="font-semibold">Email Confirmation</p>
                <p className="text-sm text-muted-foreground">
                  You'll receive an email once the provider confirms your booking.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                3
              </div>
              <div>
                <p className="font-semibold">Service Day</p>
                <p className="text-sm text-muted-foreground">
                  Show up at the scheduled time and enjoy your service!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Share & Earn Referral Card */}
        <Card className="mb-6 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <Gift className="h-5 w-5" />
              Share & Earn Rewards
            </CardTitle>
            <CardDescription className="text-amber-700">
              Love your experience? Share OlogyCrew with friends and earn credits toward your next booking!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-white/70 rounded-lg p-3">
                <Share2 className="h-5 w-5 mx-auto mb-1 text-amber-600" />
                <p className="text-xs font-medium text-amber-800">Share Link</p>
              </div>
              <div className="bg-white/70 rounded-lg p-3">
                <Users className="h-5 w-5 mx-auto mb-1 text-amber-600" />
                <p className="text-xs font-medium text-amber-800">They Book</p>
              </div>
              <div className="bg-white/70 rounded-lg p-3">
                <DollarSign className="h-5 w-5 mx-auto mb-1 text-amber-600" />
                <p className="text-xs font-medium text-amber-800">You Earn</p>
              </div>
            </div>

            {user && (
              <ShareReferralLink />
            )}

            <div className="text-center">
              <Link href="/referral-program">
                <Button variant="link" className="text-amber-700 hover:text-amber-900 text-sm p-0">
                  Learn more about our Referral Program →
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Review CTA for completed bookings */}
        {booking.status === "completed" && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>How was your experience?</CardTitle>
              <CardDescription>Share your feedback to help others</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => setLocation(`/booking/${id}/review`)}
                className="w-full"
              >
                Write a Review
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          {/* Cancel Demo Booking Button */}
          {(provider as any)?.isOfficial && user && booking.customerId === user.id && (booking.status === "pending" || booking.status === "confirmed") && (
            <Button
              variant="outline"
              className="w-full text-amber-700 border-amber-300 hover:bg-amber-50 hover:text-amber-800"
              onClick={() => {
                cancelDemo.mutate({ bookingId: booking.id, reason: "Demo booking cancelled by user" });
              }}
              disabled={cancelDemo.isPending}
            >
              <XCircle className="h-4 w-4 mr-2" />
              {cancelDemo.isPending ? "Cancelling..." : "Cancel Demo Booking"}
            </Button>
          )}

          {/* Find Real Providers CTA for demo bookings */}
          {(provider as any)?.isOfficial && (
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-4">
              <p className="text-sm font-medium text-foreground mb-2">Ready to book a real service?</p>
              <p className="text-xs text-muted-foreground mb-3">You've seen how easy it is! Now find real providers in your area.</p>
              <Button
                onClick={() => setLocation("/browse")}
                className="w-full gap-2"
              >
                <Search className="h-4 w-4" />
                Find Real Providers
              </Button>
            </div>
          )}

          <div className="flex gap-4">
            {user && booking.customerId === user.id && !(provider as any)?.isOfficial && (provider as any)?.canAcceptPlatformPayments && depositAmount && !(booking as any).depositPaidAt && (
              <Button
                onClick={() => handlePayment()}
                disabled={createCheckout.isPending}
                className="flex-1"
              >
                {createCheckout.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</>
                ) : useCredits && creditPreview?.coversFullAmount ? (
                  <>Pay with Credits</>
                ) : (
                  <>Pay Deposit ({formatPrice(Math.max(0, depositAmount - (useCredits ? creditDiscount : 0)))})</>
                )}
              </Button>
            )}
            {user && booking.customerId === user.id && !(provider as any)?.isOfficial && (provider as any)?.canAcceptPlatformPayments && !depositAmount && !(booking as any).paidAt && booking.status === "confirmed" && (
              <Button
                onClick={() => handlePayment()}
                disabled={createCheckout.isPending}
                className="flex-1"
              >
                {createCheckout.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</>
                ) : useCredits && creditPreview?.coversFullAmount ? (
                  <>Pay with Credits</>
                ) : (
                  <>Pay Now ({formatPrice(Math.max(0, getPriceNum() - (useCredits ? creditDiscount : 0)))})</>
                )}
              </Button>
            )}
            <Button
              onClick={() => setLocation("/my-bookings")}
              className="flex-1"
              variant={depositAmount && !(booking as any).depositPaidAt ? "outline" : "default"}
            >
              View My Bookings
            </Button>
            <Button
              variant="outline"
              onClick={() => setLocation("/")}
              className="flex-1"
            >
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
