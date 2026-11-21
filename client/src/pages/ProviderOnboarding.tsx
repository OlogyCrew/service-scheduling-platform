import { useState, useMemo, useRef, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useProtectedPage } from "@/hooks/useProtectedPage";
import { trpc } from "@/lib/trpc";
import { formatDuration, DURATION_PRESETS } from "../../../shared/duration";
import { getServiceTypeLabel } from "../../../shared/serviceTypeLabels";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  User,
  Grid3X3,
  Wrench,
  CreditCard,
  Loader2,
  Camera,
  Plus,
  X,
  Search,
  DollarSign,
  Clock,
  Rocket,
  TrendingUp,
  Calendar,
  Shield,
  Star,
  Users,
  Zap,
  ArrowRight,
  Crown,
} from "lucide-react";
import { NavHeader } from "@/components/shared/NavHeader";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { MessageSquareQuote, HelpCircle, ChevronDown, Pencil, Trash2 } from "lucide-react";
import { formatPrice } from "@shared/formatPrice";
import { CATEGORY_ICONS } from "@/lib/categoryIcons";
import { PLATFORM_SUBSCRIPTIONS_PAUSED, PLATFORM_SUBSCRIPTION_PAUSE_DETAIL, PLATFORM_SUBSCRIPTION_PAUSE_MESSAGE } from "@shared/providerPaymentPause";

// ============================================================================
// CATEGORY ICON MAP — visual icons for each category
// ============================================================================

const ALL_STEPS = [
  { id: 1, title: "Your Plan", icon: Zap, description: "Choose a subscription" },
  { id: 2, title: "Your Profile", icon: User, description: "Photo, name & location" },
  { id: 3, title: "Your Categories", icon: Grid3X3, description: "Choose your categories" },
  { id: 4, title: "Your Services", icon: Wrench, description: "Add services & pricing" },
  { id: 5, title: "Get Paid", icon: CreditCard, description: "Connect Stripe" },
];

// ============================================================================
// ADD SERVICE DIALOG
// ============================================================================
function AddServiceDialog({
  open,
  onClose,
  categoryId,
  categoryName,
  onSuccess,
  editingService,
}: {
  open: boolean;
  onClose: () => void;
  categoryId: number;
  categoryName: string;
  onSuccess: () => void;
  editingService?: any;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [serviceType, setServiceType] = useState("fixed_location");
  const [pricingModel, setPricingModel] = useState("fixed");
  const [basePrice, setBasePrice] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [duration, setDuration] = useState(60);

  // Pre-populate fields when editing
  useEffect(() => {
    if (editingService) {
      setName(editingService.name || "");
      setDescription(editingService.description || "");
      setServiceType(editingService.serviceType || "fixed_location");
      setPricingModel(editingService.pricingModel || "fixed");
      setBasePrice(editingService.basePrice || "");
      setHourlyRate(editingService.hourlyRate || "");
      setDuration(editingService.durationMinutes || 60);
    } else {
      setName(""); setDescription(""); setBasePrice(""); setHourlyRate("");
      setServiceType("fixed_location"); setPricingModel("fixed"); setDuration(60);
    }
  }, [editingService]);

  const createService = trpc.service.create.useMutation({
    onSuccess: () => {
      toast.success(`Service "${name}" added!`);
      setName("");
      setDescription("");
      setBasePrice("");
      setHourlyRate("");
      onSuccess();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateService = trpc.service.update.useMutation({
    onSuccess: () => {
      toast.success(`Service "${name}" updated!`);
      onSuccess();
      onClose();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error("Service name is required");
      return;
    }
    const data = {
      name: name.trim(),
      categoryId,
      description: description || undefined,
      serviceType: serviceType as any,
      pricingModel: pricingModel as any,
      basePrice: pricingModel === "fixed" || pricingModel === "package" ? basePrice : undefined,
      hourlyRate: pricingModel === "hourly" ? hourlyRate : undefined,
      durationMinutes: duration,
    };
    if (editingService) {
      updateService.mutate({ id: editingService.id, ...data });
    } else {
      createService.mutate(data);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            {editingService ? `Edit ${editingService.name}` : `Add Service to ${categoryName}`}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Service Name *</Label>
            <Input
              placeholder="e.g., Classic Haircut, Full Mix & Master"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              placeholder="What's included in this service?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Service Type</Label>
              <Select value={serviceType} onValueChange={setServiceType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categoryId === 20 ? (
                    <>
                      <SelectItem value="fixed_location">Public Venue</SelectItem>
                      <SelectItem value="mobile">Private Location</SelectItem>
                      <SelectItem value="virtual">Virtual Stream</SelectItem>
                      <SelectItem value="flexible">Flexible</SelectItem>
                      <SelectItem value="teams">Microsoft Teams</SelectItem>
                      <SelectItem value="zoom">Zoom</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="fixed_location">At My Location</SelectItem>
                      <SelectItem value="mobile">Mobile (I Travel)</SelectItem>
                      <SelectItem value="virtual">Virtual / Online</SelectItem>
                      <SelectItem value="flexible">Flexible</SelectItem>
                      <SelectItem value="teams">Microsoft Teams</SelectItem>
                      <SelectItem value="zoom">Zoom</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Duration</Label>
              <Select value={duration.toString()} onValueChange={(v) => setDuration(parseInt(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DURATION_PRESETS.map(p => (
                    <SelectItem key={p.value} value={p.value.toString()}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Pricing</Label>
              <Select value={pricingModel} onValueChange={setPricingModel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed Price</SelectItem>
                  <SelectItem value="hourly">Hourly Rate</SelectItem>
                  <SelectItem value="package">Package</SelectItem>
                  <SelectItem value="custom_quote">Custom Quote</SelectItem>
                  <SelectItem value="consultation">Consultation (Free)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(pricingModel === "fixed" || pricingModel === "package") && (
              <div className="space-y-2">
                <Label>Price ($)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                  min={0}
                  step={0.01}
                />
              </div>
            )}
            {pricingModel === "hourly" && (
              <div className="space-y-2">
                <Label>Hourly Rate ($)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  min={0}
                  step={0.01}
                />
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={createService.isPending}>
            {createService.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add Service
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// MAIN ONBOARDING COMPONENT
// ============================================================================
// ============================================================================
// WHY BECOME A PROVIDER — LANDING SECTION
// ============================================================================
function WhyBecomeProvider({ onGetStarted }: { onGetStarted: () => void }) {
  const benefits = [
    {
      icon: DollarSign,
      title: "Build Your Business",
      description: "Set your own prices, choose your services, and create a professional profile. Online provider payments are temporarily paused while Stripe reviews the account.",
    },
    {
      icon: Calendar,
      title: "Manage Your Schedule",
      description: "Full control over your availability with weekly schedules, date overrides, and automatic double-booking prevention.",
    },
    {
      icon: Users,
      title: "Reach New Customers",
      description: "Get discovered by customers searching across 48+ service categories. Your public profile showcases your work and reviews.",
    },
    {
      icon: Zap,
      title: "Instant Booking Tools",
      description: "Embeddable booking widgets, shareable links, and a mini-website — let customers book you from anywhere on the web.",
    },
    {
      icon: TrendingUp,
      title: "Grow with Analytics",
      description: "Track booking trends, revenue, customer retention, and top services with built-in analytics on your dashboard.",
    },
    {
      icon: Shield,
      title: "Built-In Trust & Safety",
      description: "Verified provider badges, customer reviews, secure payments, and automated refund policies protect you and your customers.",
    },
  ];

  const steps = [
    { number: "1", title: "Create Your Profile", desc: "Add your photo, business name, and location in under 2 minutes." },
    { number: "2", title: "Choose Your Categories", desc: "Select from 48+ service categories that match your skills." },
    { number: "3", title: "Add Your Services", desc: "List your services with pricing, duration, and descriptions." },
    { number: "4", title: "Start Getting Booked", desc: "Complete your profile and services so customers can discover you. Online provider payments can be connected after Stripe review is complete." },
  ];

  return (
    <div className="min-h-screen bg-page">
      <NavHeader />

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-primary/10 to-transparent" />
        <div className="container max-w-5xl py-16 sm:py-24 relative">
          <div className="text-center max-w-3xl mx-auto">
            <Badge variant="secondary" className="mb-4 px-4 py-1.5 text-sm font-medium">
              <Rocket className="h-3.5 w-3.5 mr-1.5" />
              Build Your Digital Home
            </Badge>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-tight">
              Your Business Deserves a
              <span className="text-primary block sm:inline"> Digital Home</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground mt-4 max-w-2xl mx-auto leading-relaxed">
              Get discovered and get booked. OlogyCrew gives you a professional profile and booking tools while online provider payments are temporarily paused during Stripe's account review.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
              <Button size="lg" className="text-base px-8" onClick={onGetStarted}>
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <p className="text-sm text-muted-foreground">
                Setup takes less than 5 minutes
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Grid */}
      <section className="py-16 bg-muted/30">
        <div className="container max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold">Why Providers Choose OlogyCrew</h2>
            <p className="text-muted-foreground mt-2 max-w-xl mx-auto">
              Everything you need to run your service business, built into one platform.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((benefit) => {
              const Icon = benefit.icon;
              return (
                <Card key={benefit.title} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{benefit.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{benefit.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16">
        <div className="container max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold">Get Started in 4 Simple Steps</h2>
            <p className="text-muted-foreground mt-2">
              From sign-up to your first booking — it's that easy.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {steps.map((step, i) => (
              <div key={step.number} className="flex gap-4 p-5 rounded-xl bg-card border hover:border-primary/30 transition-colors">
                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg shrink-0">
                  {step.number}
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 bg-muted/30">
        <div className="container max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold">What Providers Are Saying</h2>
            <p className="text-muted-foreground mt-2">
              Hear from service professionals who grew their business with OlogyCrew.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                name: "Marcus T.",
                role: "Mobile Barber",
                quote: "I went from 5 clients a week to over 20 in my first month. The booking system handles everything so I can focus on cutting hair.",
                rating: 5,
              },
              {
                name: "Jasmine R.",
                role: "Massage Therapist",
                quote: "The scheduling tools are a game-changer. Clients book directly, I get reminders, and payments land in my account automatically.",
                rating: 5,
              },
              {
                name: "David K.",
                role: "Handyman Services",
                quote: "I love that I can set my own prices and availability. The 1% fee is nothing compared to what other platforms charge. Highly recommend.",
                rating: 5,
              },
            ].map((testimonial) => (
              <Card key={testimonial.name} className="border-0 shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex gap-0.5 mb-3">
                    {Array.from({ length: testimonial.rating }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed italic mb-4">
                    "{testimonial.quote}"
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{testimonial.name}</p>
                      <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof / Stats */}
      <section className="py-12 bg-primary text-primary-foreground">
        <div className="container max-w-4xl">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl sm:text-4xl font-bold">47+</div>
              <div className="text-sm opacity-80 mt-1">Service Categories</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold">0%</div>
              <div className="text-sm opacity-80 mt-1">Upfront Cost</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold">1%</div>
              <div className="text-sm opacity-80 mt-1">Platform Fee</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold">
                <Star className="h-8 w-8 sm:h-10 sm:w-10 inline" />
              </div>
              <div className="text-sm opacity-80 mt-1">Verified Reviews</div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16">
        <div className="container max-w-3xl">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold">Frequently Asked Questions</h2>
            <p className="text-muted-foreground mt-2">
              Everything you need to know before getting started.
            </p>
          </div>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="cost">
              <AccordionTrigger className="text-left text-base">
                How much does it cost to become a provider?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                Signing up on the Starter plan is free. You can build your profile, list eligible services, manage availability, and receive booking requests. Online provider payment collection and paid plan checkout are temporarily unavailable while Stripe reviews OlogyCrew's account.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="payouts">
              <AccordionTrigger className="text-left text-base">
                How and when do I get paid?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                Online provider payment collection and Stripe Connect setup are temporarily unavailable while Stripe reviews OlogyCrew's account. You can still complete your profile, list services, manage availability, and receive booking requests. Do not treat an unpaid booking or invoice as paid.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="cancellation">
              <AccordionTrigger className="text-left text-base">
                What happens if a customer cancels?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                You set your own cancellation policy during onboarding. Options include flexible (full refund up to 24 hours before), moderate (50% refund up to 48 hours before), or strict (no refund within 7 days). Cancellations and refunds are handled automatically based on your chosen policy.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="categories">
              <AccordionTrigger className="text-left text-base">
                Can I offer services in multiple categories?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                Absolutely! You can select as many categories as you like during onboarding and add services under each one. Whether you're a barber who also does mobile detailing, or a photographer who offers event planning, OlogyCrew supports multi-category providers.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="schedule">
              <AccordionTrigger className="text-left text-base">
                How does scheduling work?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                You set your weekly availability with specific time slots for each day. You can also add date-specific overrides for holidays or special hours. The system automatically prevents double-bookings and sends reminders to both you and your customers 24 hours before each appointment.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="mobile">
              <AccordionTrigger className="text-left text-base">
                Can I offer both mobile and in-location services?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                Yes! Each service can be set as fixed-location (customers come to you), mobile (you go to the customer), or both. You can set different pricing for mobile vs. in-location services and define your service radius for mobile bookings.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="verification">
              <AccordionTrigger className="text-left text-base">
                How do I get verified?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                Complete your profile, add services, connect Stripe for payments, and maintain a good review rating. Verified providers get a badge on their profile, higher search visibility, and increased trust from potential customers.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Refer a Provider */}
      <section className="py-16 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20">
        <div className="container max-w-4xl">
          <div className="text-center mb-8">
            <Badge variant="secondary" className="mb-3 px-3 py-1 text-sm">
              <Users className="h-3.5 w-3.5 mr-1.5" />
              Referral Program
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-bold">Know a Great Provider? Refer Them!</h2>
            <p className="text-muted-foreground mt-2 max-w-xl mx-auto">
              Earn credits when you refer other service professionals to OlogyCrew. The more providers you bring, the more you earn.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
            <Card className="border-0 shadow-sm text-center">
              <CardContent className="pt-6">
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-3">
                  <Users className="h-6 w-6 text-emerald-600" />
                </div>
                <h3 className="font-semibold mb-1">Share Your Link</h3>
                <p className="text-sm text-muted-foreground">Get your unique referral link from your dashboard and share it with fellow professionals.</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm text-center">
              <CardContent className="pt-6">
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="h-6 w-6 text-emerald-600" />
                </div>
                <h3 className="font-semibold mb-1">They Sign Up</h3>
                <p className="text-sm text-muted-foreground">When your referral creates their provider profile and completes their first booking, you both earn rewards.</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm text-center">
              <CardContent className="pt-6">
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-3">
                  <DollarSign className="h-6 w-6 text-emerald-600" />
                </div>
                <h3 className="font-semibold mb-1">Earn Credits</h3>
                <p className="text-sm text-muted-foreground">Get discount credits on your next bookings. No limit on how many providers you can refer!</p>
              </CardContent>
            </Card>
          </div>
          <div className="text-center">
            <Button variant="outline" size="lg" className="text-base" onClick={onGetStarted}>
              Join & Start Referring
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16">
        <div className="container max-w-3xl text-center">
          <h2 className="text-2xl sm:text-3xl font-bold">Ready to Grow Your Business?</h2>
          <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
            Join OlogyCrew today and start reaching new customers. 
            No contracts, no monthly fees — just a simple 1% per transaction.
          </p>
          <Button size="lg" className="mt-6 text-base px-8" onClick={onGetStarted}>
            Create Your Provider Profile
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// MAIN ONBOARDING COMPONENT
// ============================================================================
export default function ProviderOnboarding() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  // Always show the wizard for logged-in users — the marketing hero is only for unauthenticated visitors
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [currentStep, setCurrentStep] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const step = parseInt(params.get("step") || "1", 10);
    return step >= 1 && step <= 5 ? step : 1;
  });

  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Capture referral code from URL and store in localStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get("ref");
    if (refCode) {
      localStorage.setItem("provider_referral_code", refCode.toUpperCase().trim());
      // Clean the URL without losing other params
      params.delete("ref");
      const newUrl = params.toString()
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, []);

  useProtectedPage();

  // Data queries
  const { data: existingProvider, isLoading: providerLoading } = trpc.provider.getMyProfile.useQuery();
  const { data: categories } = trpc.category.list.useQuery();
  const { data: myCategories, refetch: refetchMyCategories } = trpc.provider.getMyCategories.useQuery(undefined, {
    enabled: !!existingProvider,
  });
  const { data: myServices, refetch: refetchMyServices } = trpc.service.listMine.useQuery(undefined, {
    enabled: !!existingProvider,
  });
  const deleteService = trpc.service.delete.useMutation({
    onSuccess: () => { toast.success("Service deleted"); refetchMyServices(); },
    onError: (err: any) => toast.error(err.message),
  });

  // Step 1: Profile
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [acceptsMobile, setAcceptsMobile] = useState(false);
  const [acceptsFixedLocation, setAcceptsFixedLocation] = useState(true);
  const [acceptsVirtual, setAcceptsVirtual] = useState(false);
  const [serviceRadius, setServiceRadius] = useState(25);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Step 2: Categories
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<number>>(new Set());
  const [categorySearch, setCategorySearch] = useState("");

  // Step 3: Services
  const [addServiceDialogOpen, setAddServiceDialogOpen] = useState(false);
  const [editingServiceData, setEditingServiceData] = useState<any>(null);
  const [addServiceCategoryId, setAddServiceCategoryId] = useState<number>(0);
  const [addServiceCategoryName, setAddServiceCategoryName] = useState("");

  // Mutations
  const createProvider = trpc.provider.create.useMutation({
    onSuccess: () => {
      utils.provider.getMyProfile.invalidate();
      utils.auth.me.invalidate(); // Refresh user role so NavHeader shows Dashboard link
      toast.success("Profile created!");
    },
    onError: (err) => toast.error(err.message),
  });
  const updateProvider = trpc.provider.update.useMutation({
    onSuccess: () => {
      utils.provider.getMyProfile.invalidate();
      toast.success("Profile updated!");
    },
    onError: (err) => toast.error(err.message),
  });

  const uploadProfilePhoto = trpc.provider.uploadProfilePhoto.useMutation({
    onSuccess: (data) => {
      setPhotoPreview(data.url);
      toast.success("Photo uploaded!");
    },
    onError: (err) => toast.error(err.message),
  });

  const setMyCategories = trpc.provider.setMyCategories.useMutation({
    onSuccess: () => {
      refetchMyCategories();
      toast.success("Categories saved!");
      setCurrentStep(4);
    },
    onError: (err) => toast.error(err.message),
  });

  const validateReferralMutation = trpc.referral.validate.useMutation();
  const applyReferralMutation = trpc.referral.applyCode.useMutation({
    onSuccess: () => {
      toast.success("Referral code applied! You and your referrer will both earn credits.");
    },
  });

  const startOnboarding = trpc.stripeConnect.startOnboarding.useMutation({
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (err) => {
      if (err.message.includes("Invalid") || err.message.includes("API")) {
        toast.error("Stripe is not available right now. You can set this up later from your dashboard.");
      } else {
        toast.error(err.message);
      }
    },
  });

  // Tier selection mutations
  const selectFreeTier = trpc.subscription.selectFreeTier.useMutation({
    onSuccess: () => {
      setSelectedTier("free");
      utils.subscription.mySubscription.invalidate();
      toast.success("Starter plan selected! You can upgrade anytime.");
      setCurrentStep(2);
    },
    onError: (err) => toast.error(err.message),
  });

  const startTrial = trpc.subscription.startProfessionalTrial.useMutation({
    onSuccess: () => {
      setSelectedTier("basic");
      utils.subscription.mySubscription.invalidate();
      toast.success("Pro trial started! You have 14 days of full access.");
      setCurrentStep(2);
    },
    onError: (err) => toast.error(err.message),
  });

  const createCheckout = trpc.subscription.createCheckout.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (err) => toast.error(err.message),
  });

  // Photo upload handler
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo must be under 5MB");
      return;
    }
    setUploadingPhoto(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        setPhotoPreview(reader.result as string);
        if (existingProvider) {
          uploadProfilePhoto.mutate({ photoData: base64, contentType: file.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif" });
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Step 4: Tier selection
  const { data: currentSubscription } = trpc.subscription.mySubscription.useQuery(undefined, {
    enabled: !!existingProvider,
  });
  const [selectedTier, setSelectedTier] = useState<"free" | "basic" | "premium" | null>(null);
  const [billingInterval, setBillingInterval] = useState<"month" | "year">("month");

  // Pre-select plan from pricing page selection (localStorage first, then DB fallback)
  useEffect(() => {
    const stored = localStorage.getItem("ologycrew_selected_plan");
    if (stored && !selectedTier) {
      try {
        const plan = JSON.parse(stored);
        if (plan.audience === "provider" && ["free", "basic", "premium"].includes(plan.tier)) {
          setSelectedTier(plan.tier as "free" | "basic" | "premium");
          if (plan.interval === "year") setBillingInterval("year");
          return;
        }
      } catch {}
    }
    // Fallback: read from user's pendingPlanTier in DB (survives across devices/sessions)
    if (!selectedTier && user && (user as any).pendingPlanTier) {
      const tier = (user as any).pendingPlanTier;
      if (["free", "basic", "premium"].includes(tier)) {
        setSelectedTier(tier as "free" | "basic" | "premium");
        // Also store in localStorage for the auto-activation logic
        localStorage.setItem("ologycrew_selected_plan", JSON.stringify({
          tier,
          audience: (user as any).pendingPlanAudience || "provider",
          name: tier === "free" ? "Starter" : tier === "basic" ? "Pro" : "Business",
          price: tier === "free" ? "0" : tier === "basic" ? "12" : "20",
          interval: "month",
        }));
      }
    }
  }, [user]);
  // Pre-populate profile form from existing provider data
  useEffect(() => {
    if (existingProvider) {
      setBusinessName(existingProvider.businessName || "");
      setBusinessType(existingProvider.businessType || "");
      setDescription(existingProvider.description || "");
      setCity(existingProvider.city || "");
      setState(existingProvider.state || "");
      setPostalCode(existingProvider.postalCode || "");
      setAcceptsMobile(existingProvider.acceptsMobile ?? false);
      setAcceptsFixedLocation(existingProvider.acceptsFixedLocation ?? true);
      setAcceptsVirtual(existingProvider.acceptsVirtual ?? false);
      setServiceRadius(existingProvider.serviceRadiusMiles || 25);
      if (existingProvider.profilePhotoUrl) {
        setPhotoPreview(existingProvider.profilePhotoUrl);
      }
    }
  }, [existingProvider]);

  // Check if provider already has an active subscription (skip plan step)
  const hasActivePlan = !!currentSubscription?.subscription && currentSubscription.currentTier !== "free";
  const hasUsedTrial = currentSubscription?.subscription?.trialEndsAt != null;

  // Derive visible steps: skip step 1 (Plan) if already subscribed to a paid plan
  const STEPS = useMemo(() => {
    if (hasActivePlan) {
      return ALL_STEPS.filter(s => s.id !== 1);
    }
    return ALL_STEPS;
  }, [hasActivePlan]);

  // If provider already has an active subscription, skip the plan step and go to profile
  useEffect(() => {
    if (hasActivePlan && currentStep === 1) {
      setCurrentStep(2);
    }
  }, [hasActivePlan, currentStep]);

  // Step completion tracking
  const tierSelected = !!currentSubscription?.subscription || selectedTier !== null;
  const stepComplete = useMemo(() => ({
    1: tierSelected || hasActivePlan,
    2: !!existingProvider,
    3: (myCategories?.length ?? 0) > 0,
    4: (myServices?.length ?? 0) > 0,
    5: existingProvider?.payoutEnabled === true,
  }), [existingProvider, myCategories, myServices, tierSelected, hasActivePlan]);

  // Initialize selected categories from existing data
  useMemo(() => {
    if (myCategories && myCategories.length > 0 && selectedCategoryIds.size === 0) {
      setSelectedCategoryIds(new Set(myCategories.map((c: any) => c.categoryId)));
    }
  }, [myCategories]);

  // Filtered categories for search
  const filteredCategories = useMemo(() => {
    if (!categories) return [];
    if (!categorySearch.trim()) return categories;
    const term = categorySearch.toLowerCase();
    return categories.filter((c: any) => c.name.toLowerCase().includes(term));
  }, [categories, categorySearch]);

  // Group services by category
  const servicesByCategory = useMemo(() => {
    if (!myServices || !categories) return new Map();
    const map = new Map<number, { category: any; services: any[] }>();
    for (const service of myServices) {
      if (!map.has(service.categoryId)) {
        const cat = categories.find((c: any) => c.id === service.categoryId);
        map.set(service.categoryId, { category: cat, services: [] });
      }
      map.get(service.categoryId)!.services.push(service);
    }
    return map;
  }, [myServices, categories]);

  // Handlers
  const handleCreateProfile = async () => {
    if (!businessName.trim() || !businessType) {
      toast.error("Business name and type are required");
      return;
    }
    await createProvider.mutateAsync({
      businessName: businessName.trim(),
      businessType: businessType as any,
      description: description || undefined,
      city: city || undefined,
      state: state || undefined,
      postalCode: postalCode || undefined,
      serviceRadiusMiles: acceptsMobile ? serviceRadius : undefined,
      acceptsMobile,
      acceptsFixedLocation,
      acceptsVirtual,
    });

    // Upload photo if selected before provider was created
    if (photoPreview && photoPreview.startsWith("data:")) {
      const base64 = photoPreview.split(",")[1];
      const contentType = photoPreview.split(";")[0].split(":")[1];
      uploadProfilePhoto.mutate({ photoData: base64, contentType: contentType as "image/jpeg" | "image/png" | "image/webp" | "image/gif" });
    }

    // Track provider referral if one was captured
    const refCode = localStorage.getItem("provider_referral_code");
    if (refCode) {
      try {
        const validation = await validateReferralMutation.mutateAsync({ code: refCode });
        if (validation.valid && validation.referralCodeId && validation.referrerId) {
          await applyReferralMutation.mutateAsync({
            referralCodeId: validation.referralCodeId,
            referrerId: validation.referrerId,
          });
        }
        localStorage.removeItem("provider_referral_code");
      } catch {
        // Referral tracking is best-effort, don't block onboarding
        localStorage.removeItem("provider_referral_code");
      }
    }

    // Auto-activate plan from localStorage after profile is created
    const storedPlan = localStorage.getItem("ologycrew_selected_plan");
    if (storedPlan && !currentSubscription?.subscription) {
      try {
        const plan = JSON.parse(storedPlan);
        if (plan.audience === "provider") {
          if (plan.tier === "free") {
            await selectFreeTier.mutateAsync();
          } else if (plan.tier === "basic" || plan.tier === "premium") {
            await startTrial.mutateAsync({ tier: plan.tier });
          }
          localStorage.removeItem("ologycrew_selected_plan");
          // Clear the pending plan from the user's DB record
          try { await utils.client.auth.clearPendingPlan.mutate(); } catch {}
        }
      } catch (err) {
        // Plan activation is best-effort during profile creation
        console.error("[Onboarding] Auto-plan activation failed:", err);
      }
    }

    setCurrentStep(3);
  };
  const handleUpdateProfile = async () => {
    if (!businessName.trim() || !businessType) {
      toast.error("Business name and type are required");
      return;
    }
    await updateProvider.mutateAsync({
      businessName: businessName.trim(),
      description: description || undefined,
      city: city || undefined,
      state: state || undefined,
      postalCode: postalCode || undefined,
      serviceRadiusMiles: acceptsMobile ? serviceRadius : undefined,
      acceptsMobile,
      acceptsFixedLocation,
      acceptsVirtual,
    });
    // Upload new photo if changed
    if (photoPreview && photoPreview.startsWith("data:")) {
      const base64 = photoPreview.split(",")[1];
      const contentType = photoPreview.split(";")[0].split(":")[1];
      uploadProfilePhoto.mutate({ photoData: base64, contentType: contentType as "image/jpeg" | "image/png" | "image/webp" | "image/gif" });
    }
    setCurrentStep(3);
  };

  const handleSaveCategories = () => {
    if (selectedCategoryIds.size === 0) {
      toast.error("Select at least one category");
      return;
    }
    setMyCategories.mutate({ categoryIds: Array.from(selectedCategoryIds) });
  };

  const toggleCategory = (id: number) => {
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openAddServiceDialog = (categoryId: number, categoryName: string) => {
    setAddServiceCategoryId(categoryId);
    setAddServiceCategoryName(categoryName);
    setAddServiceDialogOpen(true);
  };

  if (providerLoading) {
    return (
      <div className="min-h-screen bg-page">
        <NavHeader />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Show landing page for new users who haven't started onboarding yet
  if (!existingProvider && !showOnboarding) {
    return <WhyBecomeProvider onGetStarted={() => setShowOnboarding(true)} />;
  }

  return (
    <div className="min-h-screen bg-page">
      <NavHeader />

      <div className="container max-w-4xl py-8 overflow-visible">
        {/* Header with overall progress */}
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold">Build Your Digital Home</h1>
          <p className="text-muted-foreground mt-2">
            Set up your profile, list your services, and start getting booked — all in one place
          </p>
          {/* Overall completion percentage */}
          <div className="mt-4 max-w-xs mx-auto">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-muted-foreground">Overall Progress</span>
              <span className="font-semibold text-primary">
                {Math.round((Object.values(stepComplete).filter(Boolean).length / 5) * 100)}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${(Object.values(stepComplete).filter(Boolean).length / 5) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8 sm:mb-10 px-4 sm:px-6 overflow-visible">
          {STEPS.map((step, index) => {
            const isComplete = stepComplete[step.id as keyof typeof stepComplete];
            const isCurrent = currentStep === step.id;
            const Icon = step.icon;
            return (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => setCurrentStep(step.id)}
                  className={`flex flex-col items-center gap-1.5 transition-all ${isCurrent ? "scale-110" : ""}`}
                >
                  <div
                    className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all shrink-0 ${
                      isComplete
                        ? "bg-green-500 text-white"
                        : isCurrent
                        ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isComplete ? <CheckCircle className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <span className={`text-xs font-medium ${isCurrent ? "text-primary" : "text-muted-foreground"}`}>
                    {step.title}
                  </span>
                  <span className="text-[10px] text-muted-foreground hidden sm:block">
                    {step.description}
                  </span>
                </button>
                {index < STEPS.length - 1 && (
                  <div className={`w-4 sm:w-8 md:w-16 h-0.5 mx-0.5 sm:mx-1 shrink-0 ${isComplete ? "bg-green-500" : "bg-muted"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* ================================================================ */}
        {/* STEP 1: YOUR PROFILE                                             */}
        {/* ================================================================ */}
        {currentStep === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Your Profile
              </CardTitle>
              <CardDescription>
                Your photo and business info — this is what customers see first
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <>
                  {/* Profile Photo */}
                  <div className="flex flex-col items-center gap-3">
                    <div
                      className="relative w-28 h-28 rounded-full bg-muted border-2 border-dashed border-muted-foreground/30 flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors overflow-hidden"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {photoPreview ? (
                        <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <Camera className="h-8 w-8 text-muted-foreground" />
                      )}
                      {uploadingPhoto && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <Loader2 className="h-6 w-6 animate-spin text-white" />
                        </div>
                      )}
                    </div>
                    <button
                      className="text-sm text-primary hover:underline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {photoPreview ? "Change Photo" : "Add Profile Photo"}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoSelect}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Business Name *</Label>
                      <Input
                        placeholder="e.g., Chisolm Audio, Elite Barber Studio"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Business Type *</Label>
                      <Select value={businessType} onValueChange={setBusinessType}>
                        <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sole_proprietor">Sole Proprietor</SelectItem>
                          <SelectItem value="llc">LLC</SelectItem>
                          <SelectItem value="corporation">Corporation</SelectItem>
                          <SelectItem value="partnership">Partnership</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>About You / Your Business</Label>
                    <Textarea
                      placeholder="Tell customers what makes you special — your experience, certifications, what you're passionate about..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>City</Label>
                      <Input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>State</Label>
                      <Input placeholder="State" value={state} onChange={(e) => setState(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>ZIP Code</Label>
                      <Input placeholder="ZIP" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label className="text-base font-semibold">How do you serve clients?</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="text-sm font-medium">In-Person</p>
                          <p className="text-xs text-muted-foreground">At your location</p>
                        </div>
                        <Switch checked={acceptsFixedLocation} onCheckedChange={setAcceptsFixedLocation} />
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="text-sm font-medium">Mobile</p>
                          <p className="text-xs text-muted-foreground">Travel to clients</p>
                        </div>
                        <Switch checked={acceptsMobile} onCheckedChange={setAcceptsMobile} />
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="text-sm font-medium">Virtual</p>
                          <p className="text-xs text-muted-foreground">Online sessions</p>
                        </div>
                        <Switch checked={acceptsVirtual} onCheckedChange={setAcceptsVirtual} />
                      </div>
                    </div>
                  </div>

                  {acceptsMobile && (
                    <div className="space-y-2">
                      <Label>Service Radius (miles)</Label>
                      <Input
                        type="number"
                        value={serviceRadius}
                        onChange={(e) => setServiceRadius(parseInt(e.target.value) || 25)}
                        min={1}
                        max={200}
                      />
                    </div>
                  )}

                  <div className="flex justify-between">
                    {existingProvider && (
                      <Button variant="outline" onClick={() => setCurrentStep(3)}>
                        Skip <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    )}
                    <div className="ml-auto">
                      {existingProvider ? (
                        <Button onClick={handleUpdateProfile} disabled={updateProvider.isPending}>
                          {updateProvider.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Save Changes & Continue
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      ) : (
                        <Button onClick={handleCreateProfile} disabled={createProvider.isPending}>
                          {createProvider.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Create Profile & Continue
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      )}
                    </div>
                  </div>
                </>
            </CardContent>
          </Card>
        )}

        {/* ================================================================ */}
        {/* STEP 2: YOUR SKILLS (Multi-Category Selection)                   */}
        {/* ================================================================ */}
        {currentStep === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Grid3X3 className="h-5 w-5" />
                Your Provider Categories
              </CardTitle>
              <CardDescription>
                Select every category you can provide services in. You're multi-talented — show it!
                A chef who also does power washing? A DJ who cuts hair? Select them all.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search categories..."
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Selected count */}
              {selectedCategoryIds.size > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-muted-foreground">
                    {selectedCategoryIds.size} selected:
                  </span>
                  {Array.from(selectedCategoryIds).map((id) => {
                    const cat = categories?.find((c: any) => c.id === id);
                    if (!cat) return null;
                    return (
                      <Badge
                        key={id}
                        variant="secondary"
                        className="gap-1 cursor-pointer hover:bg-destructive/10"
                        onClick={() => toggleCategory(id)}
                      >
                        {CATEGORY_ICONS[id] || "📦"} {cat.name}
                        <X className="h-3 w-3" />
                      </Badge>
                    );
                  })}
                </div>
              )}

              {/* Category Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredCategories.map((cat: any) => {
                  const isSelected = selectedCategoryIds.has(cat.id);
                  return (
                    <button
                      key={cat.id}
                      onClick={() => toggleCategory(cat.id)}
                      className={`p-3 rounded-xl border-2 text-left transition-all hover:shadow-md ${
                        isSelected
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "border-transparent bg-muted/50 hover:border-muted-foreground/20"
                      }`}
                    >
                      <div className="text-2xl mb-1">{CATEGORY_ICONS[cat.id] || "📦"}</div>
                      <div className="text-xs font-medium leading-tight line-clamp-2">
                        {cat.name.split(" ").map((w: string) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ")}
                      </div>
                      {isSelected && (
                        <CheckCircle className="h-4 w-4 text-primary mt-1" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setCurrentStep(2)}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button onClick={handleSaveCategories} disabled={setMyCategories.isPending || selectedCategoryIds.size === 0}>
                  {setMyCategories.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Categories & Continue ({selectedCategoryIds.size})
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ================================================================ */}
        {/* STEP 3: YOUR SERVICES (Per-Category)                             */}
        {/* ================================================================ */}
        {currentStep === 4 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Add Your Services
              </CardTitle>
              <CardDescription>
                Add specific services under each category you selected. Set your own pricing for each.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Show each selected category with its services */}
              {myCategories && myCategories.length > 0 ? (
                myCategories.map((pc: any) => {
                  const cat = pc.category;
                  if (!cat) return null;
                  const catServices = myServices?.filter((s: any) => s.categoryId === cat.id) || [];
                  const displayName = cat.name.split(" ").map((w: string) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");

                  return (
                    <div key={cat.id} className="border rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{CATEGORY_ICONS[cat.id] || "📦"}</span>
                          <h3 className="font-semibold">{displayName}</h3>
                          <Badge variant="outline" className="text-xs">
                            {catServices.length} service{catServices.length !== 1 ? "s" : ""}
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openAddServiceDialog(cat.id, displayName)}
                        >
                          <Plus className="h-4 w-4 mr-1" /> Add Service
                        </Button>
                      </div>

                      {catServices.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground text-sm border rounded-lg bg-muted/30">
                          No services yet — add your first service in this category
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {catServices.map((service: any) => (
                            <div
                              key={service.id}
                              className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border"
                            >
                              <div>
                                <p className="font-medium text-sm">{service.name}</p>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                                  {service.durationMinutes && (
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" /> {formatDuration(service.durationMinutes)}
                                    </span>
                                  )}
                                  <span>{getServiceTypeLabel(service.serviceType, service.categoryId)}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                              <button onClick={() => { setEditingServiceData(service); setAddServiceCategoryId(service.categoryId); setAddServiceCategoryName(categories?.find((c: any) => c.id === service.categoryId)?.name || ""); setAddServiceDialogOpen(true); }} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Edit service"><Pencil className="h-3.5 w-3.5" /></button>
                              <button onClick={() => { if (confirm(`Delete "${service.name}"?`)) deleteService.mutate({ id: service.id }); }} className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors" title="Delete service"><Trash2 className="h-3.5 w-3.5" /></button>
                              <div className="text-right">
                                <span className="font-semibold text-sm text-primary">
                                  {service.pricingModel === "fixed" && `${formatPrice(parseFloat(service.basePrice || "0"))}`}
                                  {service.pricingModel === "hourly" && `${formatPrice(parseFloat(service.hourlyRate || "0"))}/hr`}
                                  {service.pricingModel === "package" && `${formatPrice(parseFloat(service.basePrice || "0"))}`}
                                  {service.pricingModel === "custom_quote" && "Quote"}
                                  {service.pricingModel === "consultation" && "Free"}
                                </span>
                              </div>
                            </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Grid3X3 className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>Go back to Step 2 and select your categories first</p>
                  <Button variant="outline" className="mt-4" onClick={() => setCurrentStep(3)}>
                    <ChevronLeft className="h-4 w-4 mr-1" /> Select Categories
                  </Button>
                </div>
              )}

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setCurrentStep(3)}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button
                  onClick={() => setCurrentStep(5)}
                  disabled={(myServices?.length ?? 0) === 0}
                >
                  Continue
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ================================================================ */}
        {/* STEP 4: CHOOSE YOUR PLAN (Tier Selection)                        */}
        {/* ================================================================ */}
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Choose Your Plan
              </CardTitle>
              <CardDescription>
                Pick the plan that fits your business. You can always upgrade or downgrade later.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Monthly / Annual Toggle */}
              <div className="flex items-center justify-center gap-3">
                <span className={`text-sm font-medium transition-colors ${
                  billingInterval === "month" ? "text-foreground" : "text-muted-foreground"
                }`}>Monthly</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={billingInterval === "year"}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    billingInterval === "year" ? "bg-primary" : "bg-muted"
                  }`}
                  onClick={() => setBillingInterval(prev => prev === "month" ? "year" : "month")}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-lg ring-0 transition-transform ${
                    billingInterval === "year" ? "translate-x-5" : "translate-x-0"
                  }`} />
                </button>
                <span className={`text-sm font-medium transition-colors ${
                  billingInterval === "year" ? "text-foreground" : "text-muted-foreground"
                }`}>Annual</span>
                {billingInterval === "year" && (
                  <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px] px-1.5 py-0.5">
                    Save 20%
                  </Badge>
                )}
              </div>

              {/* Tier Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Free Tier */}
                <div
                  className={`relative p-5 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md ${
                    selectedTier === "free" || (currentSubscription?.currentTier === "free" && !selectedTier)
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-transparent bg-muted/50 hover:border-muted-foreground/20"
                  }`}
                  onClick={() => setSelectedTier("free")}
                >
                  {currentSubscription?.currentTier === "free" ? (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-10">
                      <Badge className="bg-green-600 text-white border-0 shadow-sm whitespace-nowrap text-[10px] px-2">Current Plan</Badge>
                    </div>
                  ) : selectedTier === "free" && !currentSubscription?.subscription ? (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-10">
                      <Badge className="bg-gray-600 text-white border-0 shadow-sm whitespace-nowrap text-[10px] px-2">Your Selected Plan</Badge>
                    </div>
                  ) : null}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                      <Star className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Starter</h3>
                      <p className="text-xs text-muted-foreground">Free forever</p>
                    </div>
                  </div>
                  <div className="mb-3">
                    <span className="text-2xl font-bold">$0</span>
                    <span className="text-muted-foreground text-sm">/month</span>
                  </div>
                  <ul className="space-y-1.5 text-sm">
                    <li className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" /> 1 service category</li>
                    <li className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" /> Up to 3 services</li>
                    <li className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" /> 1 photo per service</li>
                    <li className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" /> Basic public profile</li>
                    <li className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" /> Booking management</li>
                  </ul>
                  {/* Action button */}
                  <div className="mt-4">
                    {currentSubscription?.currentTier === "free" ? (
                      <Button variant="outline" size="sm" className="w-full" disabled>
                        Current Plan
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" className="w-full" onClick={(e) => { e.stopPropagation(); setSelectedTier("free"); if (!existingProvider) setCurrentStep(2); }}>
                        Select Starter
                      </Button>
                    )}
                  </div>
                </div>

                {/* Basic Tier */}
                <div
                  className={`relative p-5 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md ${
                    selectedTier === "basic" || currentSubscription?.currentTier === "basic"
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-transparent bg-muted/50 hover:border-muted-foreground/20"
                  }`}
                  onClick={() => setSelectedTier("basic")}
                >
                  {currentSubscription?.currentTier === "basic" ? (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-10">
                      <Badge className="bg-green-600 text-white border-0 shadow-sm whitespace-nowrap text-[10px] px-2">Current Plan</Badge>
                    </div>
                  ) : selectedTier === "basic" && !currentSubscription?.subscription ? (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-10">
                      <Badge className="bg-primary text-primary-foreground border-0 shadow-sm whitespace-nowrap text-[10px] px-2">Your Selected Plan</Badge>
                    </div>
                  ) : !hasUsedTrial ? (
                    <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] px-2">14-Day Free Trial</Badge>
                  ) : null}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Pro</h3>
                      <p className="text-xs text-muted-foreground">
                        {billingInterval === "year" ? "$10.08/mo billed annually" : "$12/month"}
                      </p>
                    </div>
                  </div>
                  <div className="mb-3">
                    {billingInterval === "year" ? (
                      <>
                        <span className="text-2xl font-bold">$10</span>
                        <span className="text-muted-foreground text-sm">.08/mo</span>
                        <span className="ml-2 text-xs line-through text-muted-foreground">$12</span>
                      </>
                    ) : (
                      <>
                        <span className="text-2xl font-bold">$12</span>
                        <span className="text-muted-foreground text-sm">/mo</span>
                      </>
                    )}
                  </div>
                  <ul className="space-y-1.5 text-sm">
                    <li className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" /> Up to 5 categories</li>
                    <li className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" /> Up to 10 services</li>
                    <li className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" /> 3 photos per service</li>
                    <li className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" /> Priority search placement</li>
                    <li className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" /> Business analytics</li>
                  </ul>
                  {billingInterval === "year" && (
                    <div className="mt-3 text-center">
                      <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px]">
                        Save $23.04/year (16% off)
                      </Badge>
                    </div>
                  )}
                  {/* Action button */}
                  <div className="mt-4">
                    {currentSubscription?.currentTier === "basic" ? (
                      <Button variant="outline" size="sm" className="w-full" disabled>
                        Current Plan
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" className="w-full" onClick={(e) => { e.stopPropagation(); setSelectedTier("basic"); if (!existingProvider) setCurrentStep(2); }}>
                        {!hasUsedTrial ? "Start Free Trial" : "Select Pro"}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Premium Tier */}
                <div
                  className={`relative p-5 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md ${
                    selectedTier === "premium" || currentSubscription?.currentTier === "premium"
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-transparent bg-muted/50 hover:border-muted-foreground/20"
                  }`}
                  onClick={() => setSelectedTier("premium")}
                >
                  {currentSubscription?.currentTier === "premium" ? (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-10">
                      <Badge className="bg-green-600 text-white border-0 shadow-sm whitespace-nowrap text-[10px] px-2">Current Plan</Badge>
                    </div>
                  ) : selectedTier === "premium" && !currentSubscription?.subscription ? (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-10">
                      <Badge className="bg-amber-500 text-white border-0 shadow-sm whitespace-nowrap text-[10px] px-2">Your Selected Plan</Badge>
                    </div>
                  ) : !hasUsedTrial ? (
                    <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[10px] px-2">14-Day Free Trial</Badge>
                  ) : null}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <Crown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Business</h3>
                      <p className="text-xs text-muted-foreground">
                        {billingInterval === "year" ? "$16.00/mo billed annually" : "$20/month"}
                      </p>
                    </div>
                  </div>
                  <div className="mb-3">
                    {billingInterval === "year" ? (
                      <>
                        <span className="text-2xl font-bold">$16</span>
                        <span className="text-muted-foreground text-sm">.00/mo</span>
                        <span className="ml-2 text-xs line-through text-muted-foreground">$20</span>
                      </>
                    ) : (
                      <>
                        <span className="text-2xl font-bold">$20</span>
                        <span className="text-muted-foreground text-sm">/mo</span>
                      </>
                    )}
                  </div>
                  <ul className="space-y-1.5 text-sm">
                    <li className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" /> Unlimited categories</li>
                    <li className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" /> Unlimited services</li>
                    <li className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" /> 5 photos per service</li>
                    <li className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" /> Featured listing badge</li>
                    <li className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" /> Full analytics suite</li>
                  </ul>
                  {billingInterval === "year" && (
                    <div className="mt-3 text-center">
                      <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px]">
                        Save $48.00/year (20% off)
                      </Badge>
                    </div>
                  )}
                  {/* Action button */}
                  <div className="mt-4">
                    {currentSubscription?.currentTier === "premium" ? (
                      <Button variant="outline" size="sm" className="w-full" disabled>
                        Current Plan
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" className="w-full" onClick={(e) => { e.stopPropagation(); setSelectedTier("premium"); if (!existingProvider) setCurrentStep(2); }}>
                        {!hasUsedTrial ? "Start Free Trial" : "Select Business"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* 14-day Pro Trial Banner */}
              {!hasUsedTrial && !selectedTier && (!currentSubscription?.subscription || currentSubscription?.currentTier === "free") && (
                <div className="p-4 rounded-lg bg-gradient-to-r from-blue-500/10 to-primary/10 border border-blue-500/20">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Zap className="h-4 w-4 text-blue-500" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm">Try Pro free for 14 days</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Get up to 5 categories, 10 service listings, priority search placement, business analytics, and a custom profile URL.
                        No credit card required — automatically reverts to Starter if you don't subscribe.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
                      onClick={() => { if (!existingProvider) { setSelectedTier("basic"); setCurrentStep(2); } else { startTrial.mutate(); } }}
                      disabled={startTrial.isPending}
                    >
                      {startTrial.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Start Free Trial"
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* All plans include */}
              <div className="text-center text-xs text-muted-foreground">
                All plans include: Booking management &middot; Customer messaging &middot; A public provider page. Pro and Business add Stripe payment collection and invoicing.
              </div>
              <div className="flex justify-end pt-4">
                <div className="flex gap-2">
                  {/* If no tier change selected (current plan stays), just continue */}
                  {(!selectedTier || selectedTier === currentSubscription?.currentTier) ? (
                    <Button
                      onClick={() => {
                        if (!existingProvider) {
                          // No provider profile yet - just advance, plan activates after profile creation
                          if (!selectedTier) setSelectedTier("free");
                          setCurrentStep(2);
                        } else if (!currentSubscription?.subscription) {
                          selectFreeTier.mutate();
                        } else {
                          setCurrentStep(2);
                        }
                      }}
                      disabled={selectFreeTier.isPending}
                    >
                      {selectFreeTier.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Continue
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  ) : selectedTier === "free" ? (
                    <Button
                      onClick={() => {
                        if (!existingProvider) {
                          setCurrentStep(2);
                        } else {
                          selectFreeTier.mutate();
                        }
                      }}
                      disabled={selectFreeTier.isPending}
                    >
                      {selectFreeTier.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Switch to Starter
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  ) : selectedTier === "basic" ? (
                    <Button
                      onClick={() => {
                        if (!existingProvider) {
                          setCurrentStep(2);
                        } else {
                          startTrial.mutate({ tier: "basic" });
                        }
                      }}
                      disabled={startTrial.isPending}
                    >
                      {startTrial.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {!hasUsedTrial ? "Start 14-Day Pro Trial" : "Select Pro"}
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  ) : selectedTier === "premium" ? (
                    <Button
                      onClick={() => {
                        if (!existingProvider) {
                          setCurrentStep(2);
                        } else {
                          startTrial.mutate({ tier: "premium" });
                        }
                      }}
                      disabled={startTrial.isPending}
                    >
                      {startTrial.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {!hasUsedTrial ? "Start 14-Day Business Trial" : "Select Business"}
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  ) : (
                    <Button onClick={() => setCurrentStep(2)}>
                      Continue
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ================================================================ */}
        {/* STEP 5: GET PAID (Stripe Connect)                                */}
        {/* ================================================================ */}
        {currentStep === 5 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Connect Your Payment Account
              </CardTitle>
              <CardDescription>
                Stripe/provider online payments are temporarily unavailable while Stripe reviews OlogyCrew's account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {PLATFORM_SUBSCRIPTIONS_PAUSED && !existingProvider?.payoutEnabled && (
                <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                  <p className="font-medium">{PLATFORM_SUBSCRIPTION_PAUSE_MESSAGE}</p>
                  <p className="mt-1 text-sm">{PLATFORM_SUBSCRIPTION_PAUSE_DETAIL}</p>
                </div>
              )}

              {existingProvider?.payoutEnabled ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold">Payments Connected</h3>
                  <p className="text-muted-foreground mt-1">You're all set to receive payments</p>
                </div>
              ) : (selectedTier === "free" || (!selectedTier && (!currentSubscription?.subscription || currentSubscription?.currentTier === "free"))) ? (
                <div className="text-center py-8">
                  <Shield className="h-12 w-12 text-amber-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold">Upgrade Required</h3>
                  <p className="text-muted-foreground mt-1 max-w-md mx-auto">
                    {PLATFORM_SUBSCRIPTION_PAUSE_DETAIL}
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg border text-center">
                      <p className="text-2xl font-bold text-green-600">$0</p>
                      <p className="text-sm text-muted-foreground">To start on Starter</p>
                    </div>
                    <div className="p-4 rounded-lg border text-center">
                      <p className="text-2xl font-bold">Paused</p>
                      <p className="text-sm text-muted-foreground">Online provider payments</p>
                    </div>
                    <div className="p-4 rounded-lg border text-center">
                      <p className="text-2xl font-bold">Later</p>
                      <p className="text-sm text-muted-foreground">Stripe setup after review</p>
                    </div>
                  </div>

                  <div className="bg-muted/50 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">How it works:</h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>1. Finish your profile, categories, services, and availability</li>
                      <li>2. Keep receiving booking requests and managing your schedule</li>
                      <li>3. Online provider payment collection remains paused during Stripe review</li>
                      <li>4. We will announce when Stripe setup and paid collection are available again</li>
                    </ul>
                  </div>
                </>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCurrentStep(4)}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <div className="flex gap-2">
                  {!existingProvider?.payoutEnabled && (
                    <>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          toast.success("Welcome! You can set up payments later from your dashboard.");
                          setLocation("/");
                        }}
                      >
                        Skip for now
                      </Button>
                      <Button
                        onClick={() => startOnboarding.mutate({ origin: window.location.origin })}
                        disabled={PLATFORM_SUBSCRIPTIONS_PAUSED || startOnboarding.isPending}
                        title={PLATFORM_SUBSCRIPTIONS_PAUSED ? PLATFORM_SUBSCRIPTION_PAUSE_MESSAGE : undefined}
                      >
                        {startOnboarding.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        {PLATFORM_SUBSCRIPTIONS_PAUSED ? "Stripe setup unavailable" : "Connect Stripe Account"}
                      </Button>
                    </>
                  )}
                  {existingProvider?.payoutEnabled && <Button
                    onClick={() => {
                      toast.success("Welcome to OlogyCrew! Your profile is live.");
                      setLocation("/provider/dashboard");
                    }}
                  >
                    <Rocket className="h-4 w-4 mr-1" />
                    Go to Dashboard
                  </Button>}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Service Dialog */}
      <AddServiceDialog
        open={addServiceDialogOpen}
        onClose={() => { setAddServiceDialogOpen(false); setEditingServiceData(null); }}
        editingService={editingServiceData}
        categoryId={addServiceCategoryId}
        categoryName={addServiceCategoryName}
        onSuccess={() => {
          refetchMyServices();
          utils.service.listMine.invalidate();
        }}
      />
    </div>
  );
}
