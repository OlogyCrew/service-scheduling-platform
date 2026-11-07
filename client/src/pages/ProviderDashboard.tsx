import { useState, useMemo, useRef, useEffect } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Area, AreaChart, PieChart, Pie, Cell
} from "recharts";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { CATEGORY_ICONS } from "@/lib/categoryIcons";
import { toast } from "sonner";
import { 
  Calendar, 
  DollarSign, 
  Package, 
  Star,
  Clock,
  CheckCircle2,
  Pencil,
  Trash2,
  Eye,
  XCircle,
  TrendingUp,
  Wallet,
  CreditCard,
  Link2,
  Copy,
  ExternalLink,
  AlertCircle,
  Image as ImageIcon,
  Crown,
  Code2,
  BarChart3,
  Users,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Globe,
  Smartphone,
  CalendarPlus,
  Clipboard,
  Tag,
  FileCheck,
  Upload,
  FileText,
  Shield,
  Grid3X3,
  Plus,
  Settings,
  ChevronDown,
  ChevronRight,
  X,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  BellRing,
  Heart,
  User,
  Loader2,
  Search,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useViewMode } from "@/contexts/ViewModeContext";
import { getLoginUrl } from "@/const";
import { NavHeader } from "@/components/shared/NavHeader";
import { ShareProfile } from "@/components/ShareProfile";
import { formatCurrency } from "@/lib/dateUtils";
import { formatDuration, DURATION_PRESETS } from "../../../shared/duration";
import { getServiceTypeLabel } from "../../../shared/serviceTypeLabels";
import { PhotoUpload } from "@/components/PhotoUpload";
import { Checkbox } from "@/components/ui/checkbox";
import { UpgradePrompt, UpgradeBanner } from "@/components/UpgradePrompt";
import { isPlanGateError } from "@/lib/upgradeGate";
import { TrustBadge, TrustScoreProgress } from "@/components/TrustBadge";
import { TrialStatusBanner } from "@/components/TrialBanner";
import { HelpTip, HelpBanner } from "@/components/shared/HelpTip";
import { formatPrice } from "@shared/formatPrice";
import { formatTimeForDisplay } from "@shared/timeSlots";
import { ImageCropper } from "@/components/ImageCropper";
import { ProviderBusinessProfileDialog } from "@/components/provider/ProviderBusinessProfileDialog";
import {
  ProviderWorkspacePageHeader,
  ProviderWorkspaceShell,
  type ProviderWorkspaceSection,
} from "@/components/provider/ProviderWorkspaceShell";
import { ProviderDashboardSkeleton } from "@/components/DashboardSkeleton";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";

function ProviderDashboardFrame({
  active,
  provider,
  customersVisible,
  actions,
  children,
}: {
  active?: ProviderWorkspaceSection;
  provider: any;
  customersVisible?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  if (!active) return <div className="container py-8">{children}</div>;

  const page = active === "services"
    ? {
        eyebrow: "Your offers",
        title: "Services",
        description: "Manage what customers can book, your categories, portfolio, and service packages.",
      }
    : active === "money"
      ? {
          eyebrow: "Business finances",
          title: "Money",
          description: "Track earnings, completed work, payment setup, payouts, and your provider plan.",
        }
      : {
          eyebrow: "Grow and manage your business",
          title: "Business Tools",
          description: "Manage reviews, promotions, tipping, estimates, referrals, service options, and verification in one place.",
        };

  return (
    <ProviderWorkspaceShell
      active={active}
      businessName={provider?.businessName}
      profileSlug={provider?.profileSlug}
      isPageLive={Boolean(provider?.profileSlug)}
      customersVisible={customersVisible}
      contentClassName="[&_[data-slot=card]]:rounded-2xl [&_[data-slot=card]]:border-slate-200 [&_[data-slot=card]]:shadow-[0_18px_50px_-42px_rgba(15,23,42,0.5)]"
    >
      <ProviderWorkspacePageHeader {...page} actions={actions} />
      <div className="mt-6">{children}</div>
    </ProviderWorkspaceShell>
  );
}

// ============================================================================
// SERVICE PHOTOS MANAGER
// ============================================================================
function ServicePhotosManager({ serviceId, onClose, maxPhotos = 1 }: { serviceId: number; onClose: () => void; maxPhotos?: number }) {
  const utils = trpc.useUtils();
  const { data: photos, refetch } = trpc.service.getPhotos.useQuery({ serviceId });

  return (
    <div>
      <PhotoUpload
        serviceId={serviceId}
        existingPhotos={(photos || []).map((p: any) => ({
          id: p.id,
          url: p.photoUrl,
          caption: p.caption,
          displayOrder: p.sortOrder || 0,
        }))}
        maxPhotos={maxPhotos}
        onPhotosChanged={() => {
          refetch();
          utils.service.listByProvider.invalidate();
        }}
      />
    </div>
  );
}

function PayAtLocationSettingsSection() {
  const { data: settings, isLoading } = trpc.offlinePayment.getProviderSettings.useQuery();
  const { data: provider } = trpc.provider.getMine.useQuery();
  const { data: services } = trpc.service.listByProvider.useQuery({ providerId: provider?.id || 0 }, { enabled: !!provider?.id });
  const [enabled, setEnabled] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [serviceIds, setServiceIds] = useState<number[]>([]);
  const utils = trpc.useUtils();

  useEffect(() => {
    if (settings) {
      setEnabled(settings.enabled);
      setInstructions(settings.instructions || "");
      setServiceIds(settings.serviceIds || []);
    }
  }, [settings]);

  const save = trpc.offlinePayment.updateProviderSettings.useMutation({
    onSuccess: () => {
      toast.success("Pay-at-Location settings saved");
      utils.offlinePayment.getProviderSettings.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  if (isLoading) return <Card><CardContent className="p-5 text-sm text-muted-foreground">Loading Pay-at-Location settings...</CardContent></Card>;
  const providerServices = (services || []) as any[];
  return (
    <Card className="border-amber-200 bg-amber-50/40 shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Pay at Location</CardTitle>
        <CardDescription>Let customers reserve eligible services and settle directly with you. Existing Stripe payment settings are unchanged.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4 rounded-lg border bg-white p-3">
          <div><Label htmlFor="pay-at-location-enabled">Accept Pay at Location</Label><p className="text-xs text-muted-foreground">Disable this to stop new offline bookings; history remains visible.</p></div>
          <Switch id="pay-at-location-enabled" checked={enabled} onCheckedChange={setEnabled} />
        </div>
        <div className="space-y-2"><Label htmlFor="pay-at-location-instructions">Customer instructions</Label><Textarea id="pay-at-location-instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Where and when should customers pay?" maxLength={2000} /></div>
        <div className="space-y-2"><Label>Eligible services</Label><div className="grid gap-2 sm:grid-cols-2">
          {providerServices.map((service) => <label key={service.id} className="flex items-center gap-2 rounded border bg-white p-2 text-sm"><Checkbox checked={serviceIds.includes(service.id)} onCheckedChange={(checked) => setServiceIds((current) => checked ? (current.includes(service.id) ? current : current.concat(service.id)) : current.filter((id) => id !== service.id))} />{service.name}</label>)}
        </div></div>
        <Button onClick={() => save.mutate({ enabled, instructions, serviceIds })} disabled={save.isPending}>{save.isPending ? "Saving..." : "Save Pay-at-Location settings"}</Button>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// STRIPE CONNECT SECTION
// ============================================================================
function StripeConnectSection({ provider, currentTier }: { provider: any; currentTier?: string }) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const { data: connectStatus, isLoading } = trpc.stripeConnect.getStatus.useQuery();
  const { data: balance } = trpc.stripeConnect.getBalance.useQuery(undefined, {
    enabled: connectStatus?.connected && connectStatus?.chargesEnabled,
  });

  const startOnboarding = trpc.stripeConnect.startOnboarding.useMutation({
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (err) => toast.error(err.message),
  });

  const getDashboardLink = trpc.stripeConnect.getDashboardLink.useMutation({
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (err) => toast.error(err.message),
  });

  const getOnboardingLink = trpc.stripeConnect.getOnboardingLink.useMutation({
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return <div className="animate-pulse text-muted-foreground">Loading payment status...</div>;
  }

  // Not connected yet
  if (!connectStatus?.connected) {
    const isFree = connectStatus?.requiresPaidPlan ?? (!currentTier || currentTier === "free");
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Accept Payments</h2>
          <p className="text-muted-foreground mt-1">Connect your Stripe account to receive payments directly from clients</p>
        </div>

        {isFree ? (
          <Card className="border-dashed border-2 border-amber-500/30">
            <CardContent className="py-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto">
                <CreditCard className="w-8 h-8 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Upgrade Required</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mt-2">
                  Payment account setup requires a Pro ($12/mo) or Business ($20/mo) subscription.
                  Upgrade your plan to start accepting payments from clients.
                </p>
              </div>
              <Button size="lg" onClick={() => setUpgradeOpen(true)}>
                Upgrade Your Plan
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed border-2">
            <CardContent className="py-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <CreditCard className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Set Up Payments</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mt-2">
                  Connect with Stripe to accept credit cards, debit cards, and other payment methods.
                  Payments go directly to your bank account — the platform takes just a 1% service fee.
                </p>
              </div>
              <Button
                size="lg"
                onClick={() => startOnboarding.mutate({ origin: window.location.origin })}
                disabled={startOnboarding.isPending}
              >
                <CreditCard className="w-4 h-4 mr-2" />
                {startOnboarding.isPending ? "Setting up..." : "Connect with Stripe"}
              </Button>
              <p className="text-xs text-muted-foreground">You'll be redirected to Stripe to complete setup</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">How it works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">1</div>
              <p>Connect your Stripe account (takes about 5 minutes)</p>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">2</div>
              <p>Clients pay when they book your services</p>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">3</div>
              <p>Money goes directly to your bank account (minus 1% platform fee)</p>
            </div>
          </CardContent>
        </Card>
        <UpgradePrompt
          open={upgradeOpen}
          onClose={() => setUpgradeOpen(false)}
          reason="payments"
          currentTier={(currentTier || "free") as "free" | "basic" | "premium"}
        />
      </div>
    );
  }

  if (connectStatus.requiresPaidPlan) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Payment Collection Paused</h2>
          <p className="text-muted-foreground mt-1">Your Stripe connection is retained, but Starter does not include on-platform payment collection.</p>
        </div>
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="py-8 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-amber-600 mx-auto" />
            <div>
              <h3 className="text-lg font-semibold">Upgrade to Resume Customer Payments</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mt-2">
                Upgrade to Pro or Business to resume collecting booking payments and using invoices. Your connected Stripe account and payout history remain available.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
              <Button onClick={() => setUpgradeOpen(true)}>View Paid Plans</Button>
              <Button variant="outline" onClick={() => getDashboardLink.mutate()} disabled={getDashboardLink.isPending}>
                <ExternalLink className="w-4 h-4 mr-2" />
                {getDashboardLink.isPending ? "Loading..." : "Open Stripe Dashboard"}
              </Button>
            </div>
          </CardContent>
        </Card>
        <UpgradePrompt
          open={upgradeOpen}
          onClose={() => setUpgradeOpen(false)}
          reason="payments"
          currentTier="free"
        />
      </div>
    );
  }

  // Connected but onboarding incomplete
  if (!connectStatus.detailsSubmitted || connectStatus.status === "onboarding") {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Complete Payment Setup</h2>
          <p className="text-muted-foreground mt-1">Your Stripe account needs additional information</p>
        </div>

        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="py-8 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-amber-600 mx-auto" />
            <div>
              <h3 className="text-lg font-semibold">Onboarding Incomplete</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mt-2">
                Stripe needs more information to activate your account. Click below to continue where you left off.
              </p>
            </div>
            <Button
              onClick={() => getOnboardingLink.mutate({ origin: window.location.origin })}
              disabled={getOnboardingLink.isPending}
            >
              {getOnboardingLink.isPending ? "Loading..." : "Continue Setup"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fully connected
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Payments</h2>
          <p className="text-muted-foreground mt-1">Your Stripe account is connected and active</p>
        </div>
        <Badge variant="default" className="gap-1">
          <CheckCircle2 className="w-3 h-3" /> Active
        </Badge>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Balance</CardTitle>
            <Wallet className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(balance?.available || 0)}</div>
            <p className="text-xs text-muted-foreground">Ready for payout</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(balance?.pending || 0)}</div>
            <p className="text-xs text-muted-foreground">Processing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Payouts</CardTitle>
            <CreditCard className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{connectStatus.payoutsEnabled ? "Enabled" : "Pending"}</div>
            <p className="text-xs text-muted-foreground">Direct to your bank</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Manage Your Payments</CardTitle>
          <CardDescription>View detailed transaction history, manage payouts, and update your bank info on Stripe</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => getDashboardLink.mutate()}
            disabled={getDashboardLink.isPending}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            {getDashboardLink.isPending ? "Loading..." : "Open Stripe Dashboard"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// PUBLIC PROFILE SECTION
// ============================================================================
function PublicProfileSection({ provider, currentTier }: { provider: any; currentTier: "free" | "basic" | "premium" }) {
  const utils = trpc.useUtils();
  const [editingSlug, setEditingSlug] = useState(false);
  const [slugInput, setSlugInput] = useState("");
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const generateSlug = trpc.provider.generateSlug.useMutation({
    onSuccess: (data) => {
      utils.provider.getMyProfile.invalidate();
      toast.success(`Profile URL created: /${data.slug}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateSlug = trpc.provider.updateSlug.useMutation({
    onSuccess: (data) => {
      utils.provider.getMyProfile.invalidate();
      setEditingSlug(false);
      toast.success(`Profile URL updated to /${data.slug}`);
    },
    onError: (err) => {
      if (isPlanGateError(err)) {
        setUpgradeOpen(true);
        return;
      }
      toast.error(err.message);
    },
  });

  const profileUrl = provider.profileSlug
    ? `https://ologycrew.com/${provider.profileSlug}`
    : null;
  // Use the /api/og/ URL for sharing — this serves proper OG meta tags for social media previews
  const shareableUrl = provider.profileSlug
    ? `https://ologycrew.com/${provider.profileSlug}`
    : null;

  const copyUrl = () => {
    if (shareableUrl) {
      navigator.clipboard.writeText(shareableUrl);
      toast.success("Profile link copied! This link shows your profile preview on social media.");
    }
  };

  if (!provider.profileSlug) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Your Public Page</h2>
          <p className="text-muted-foreground mt-1">Create a shareable profile page — your own mini-website</p>
        </div>

        <Card className="border-dashed border-2">
          <CardContent className="py-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Link2 className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Create Your Public Profile</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mt-2">
                Get a shareable link that shows your services, reviews, and business info.
                Share it on social media, business cards, or anywhere you want clients to find you.
              </p>
            </div>
            <Button
              size="lg"
              onClick={() => generateSlug.mutate()}
              disabled={generateSlug.isPending}
            >
              <Link2 className="w-4 h-4 mr-2" />
              {generateSlug.isPending ? "Creating..." : "Create My Page"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Your Public Page</h2>
        <p className="text-muted-foreground mt-1">Share this link with clients — it's your mini-website</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your Profile Link</CardTitle>
          <CardDescription>Share this URL with clients, on social media, or on your business cards</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-muted rounded-md px-3 py-2 text-sm font-mono truncate">
              {profileUrl}
            </div>
            <Button variant="outline" size="icon" onClick={copyUrl} title="Copy link">
              <Copy className="w-4 h-4" />
            </Button>
            <Link href={`/${provider.profileSlug}`} target="_blank">
              <Button variant="outline" size="icon" title="Preview">
                <ExternalLink className="w-4 h-4" />
              </Button>
            </Link>
            <ShareProfile
              url={profileUrl!}
              
              title={provider.businessName}
              description={provider.description || `Book services from ${provider.businessName} on OlogyCrew`}
              size="icon"
              variant="outline"
            />
          </div>

          {editingSlug ? (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">https://ologycrew.com/</div>
              <Input
                value={slugInput}
                onChange={(e) => setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="your-custom-url"
                className="w-full text-base"
                autoFocus
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                style={{ fontSize: '16px' }}
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => updateSlug.mutate({ slug: slugInput })}
                  disabled={updateSlug.isPending || slugInput.length < 3}
                >
                  {updateSlug.isPending ? "Saving..." : "Save"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingSlug(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => { setSlugInput(provider.profileSlug || ""); setEditingSlug(true); }}>
              <Pencil className="w-3 h-3 mr-1" /> Customize URL
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What clients see</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Your public page includes:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Your business name, description, and verification status</li>
            <li>All your active services with pricing</li>
            <li>Customer reviews and ratings</li>
            <li>Location and service area</li>
            <li>Direct booking links for each service</li>
          </ul>
        </CardContent>
      </Card>
      <UpgradePrompt
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        reason="custom_slug"
        currentTier={currentTier}
      />
    </div>
  );
}

// ============================================================================
// TIPPING SETTINGS SECTION
// ============================================================================
function TipSettingsSection() {
  const { data: tipSettings, isLoading } = trpc.provider.getTipSettings.useQuery();
  const utils = trpc.useUtils();
  const [enabled, setEnabled] = useState(false);
  const [zelleHandle, setZelleHandle] = useState("");
  const [cashAppHandle, setCashAppHandle] = useState("");
  const [venmoHandle, setVenmoHandle] = useState("");
  const [thankYouMessage, setThankYouMessage] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (tipSettings) {
      setEnabled(tipSettings.tippingEnabled);
      setZelleHandle(tipSettings.tipZelleHandle || "");
      setCashAppHandle(tipSettings.tipCashAppHandle || "");
      setVenmoHandle(tipSettings.tipVenmoHandle || "");
      setThankYouMessage(tipSettings.tipThankYouMessage || "");
    }
  }, [tipSettings]);

  const updateMutation = trpc.provider.updateTipSettings.useMutation({
    onSuccess: () => {
      toast.success("Tip settings saved!");
      utils.provider.getTipSettings.invalidate();
      setHasChanges(false);
    },
    onError: () => toast.error("Failed to save tip settings"),
  });

  const handleSave = () => {
    updateMutation.mutate({
      tippingEnabled: enabled,
      tipZelleHandle: zelleHandle || null,
      tipCashAppHandle: cashAppHandle || null,
      tipVenmoHandle: venmoHandle || null,
      tipThankYouMessage: thankYouMessage || null,
    });
  };

  if (isLoading) return <Card><CardContent className="py-8 text-center"><p className="text-muted-foreground">Loading tip settings...</p></CardContent></Card>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Heart className="h-6 w-6 text-pink-500" />
            Tipping
          </h2>
          <p className="text-muted-foreground mt-1">
            Let customers show appreciation directly — zero platform fees, 100% goes to you
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-6">
          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-medium">Enable Tipping</Label>
              <p className="text-sm text-muted-foreground mt-0.5">
                When enabled, customers will see a "Leave a Tip" option on your profile and after completed bookings
              </p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={(val) => { setEnabled(val); setHasChanges(true); }}
            />
          </div>

          {enabled && (
            <>
              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground mb-4">
                  Add your payment handles below. Customers will choose how to send their tip directly to you — no fees, no middleman.
                </p>

                <div className="space-y-4">
                  <div>
                    <Label className="flex items-center gap-2">
                      <span className="text-lg">💲</span> Zelle (email or phone)
                    </Label>
                    <Input
                      placeholder="your@email.com or (555) 123-4567"
                      value={zelleHandle}
                      onChange={(e) => { setZelleHandle(e.target.value); setHasChanges(true); }}
                      className="mt-1.5"
                    />
                  </div>

                  <div>
                    <Label className="flex items-center gap-2">
                      <span className="text-lg">💵</span> Cash App ($Cashtag)
                    </Label>
                    <Input
                      placeholder="$YourCashTag"
                      value={cashAppHandle}
                      onChange={(e) => { setCashAppHandle(e.target.value); setHasChanges(true); }}
                      className="mt-1.5"
                    />
                  </div>

                  <div>
                    <Label className="flex items-center gap-2">
                      <span className="text-lg">🔵</span> Venmo (@username)
                    </Label>
                    <Input
                      placeholder="@YourVenmoUsername"
                      value={venmoHandle}
                      onChange={(e) => { setVenmoHandle(e.target.value); setHasChanges(true); }}
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <Label className="flex items-center gap-2 text-base font-medium">
                  <span className="text-lg">✍️</span> Personalized Thank-You Message
                </Label>
                <p className="text-sm text-muted-foreground mt-0.5 mb-2">
                  Write a short message that appears on your tip card. Make it personal!
                </p>
                <textarea
                  placeholder="e.g., Thanks for choosing me! Your support means the world."
                  value={thankYouMessage}
                  onChange={(e) => { setThankYouMessage(e.target.value.slice(0, 200)); setHasChanges(true); }}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                  rows={3}
                  maxLength={200}
                />
                <p className="text-xs text-muted-foreground text-right mt-1">{thankYouMessage.length}/200</p>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">How it works:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Customers see your tip options after a completed booking and on your public profile</li>
                  <li>They tap their preferred method and send directly — OlogyCrew never touches your tips</li>
                  <li>You keep 100% of every tip, always</li>
                </ul>
              </div>
            </>
          )}

          {hasChanges && (
            <div className="flex justify-end pt-2">
              <Button onClick={handleSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving..." : "Save Tip Settings"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// FREE ESTIMATES TOGGLE SECTION (provider-level setting, not a category)
// ============================================================================
function FreeEstimatesSection() {
  const { data: settings, isLoading } = trpc.provider.getEstimateSettings.useQuery();
  const utils = trpc.useUtils();
  const [enabled, setEnabled] = useState(false);
  const [note, setNote] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (settings) {
      setEnabled(settings.offersEstimates);
      setNote(settings.estimateNote || "");
    }
  }, [settings]);

  const updateMutation = trpc.provider.updateEstimateSettings.useMutation({
    onSuccess: () => {
      toast.success("Free estimate settings saved!");
      utils.provider.getEstimateSettings.invalidate();
      setHasChanges(false);
    },
    onError: () => toast.error("Failed to save settings"),
  });

  const handleSave = () => {
    updateMutation.mutate({
      offersEstimates: enabled,
      estimateNote: note || undefined,
    });
  };

  if (isLoading) return <Card><CardContent className="py-8 text-center"><p className="text-muted-foreground">Loading estimate settings...</p></CardContent></Card>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-green-600" />
            Free Estimates
          </h2>
          <p className="text-muted-foreground mt-1">
            Let customers know you offer free estimates — a great way to attract new business
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-medium">I Offer Free Estimates</Label>
              <p className="text-sm text-muted-foreground mt-0.5">
                When enabled, a "Free Estimates" badge appears on your profile and service cards
              </p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={(val) => { setEnabled(val); setHasChanges(true); }}
            />
          </div>

          {enabled && (
            <div className="border-t pt-4">
              <Label className="text-base font-medium">Estimate Details (optional)</Label>
              <p className="text-sm text-muted-foreground mt-0.5 mb-2">
                Add a note about what qualifies for a free estimate
              </p>
              <Input
                placeholder='e.g., "Free estimates for projects over $200" or "Free in-home estimates within 20 miles"'
                value={note}
                onChange={(e) => { setNote(e.target.value.slice(0, 255)); setHasChanges(true); }}
              />
              <p className="text-xs text-muted-foreground text-right mt-1">{note.length}/255</p>
            </div>
          )}

          {hasChanges && (
            <div className="flex justify-end pt-2">
              <Button onClick={handleSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving..." : "Save Estimate Settings"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// EMERGENCY SERVICE SECTION
// ============================================================================
function EmergencyServiceSection() {
  const { data: settings, isLoading } = trpc.provider.getEmergencyServiceSetting.useQuery();
  const utils = trpc.useUtils();
  const [enabled, setEnabled] = useState(false);
  const [hoursType, setHoursType] = useState<"24_7" | "after_hours" | "custom">("24_7");
  const [hoursNote, setHoursNote] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (settings) {
      setEnabled(settings.offersEmergencyService);
      setHoursType(settings.emergencyHoursType || "24_7");
      setHoursNote(settings.emergencyHoursNote || "");
    }
  }, [settings]);

  const updateMutation = trpc.provider.updateEmergencyServiceSetting.useMutation({
    onSuccess: () => {
      toast.success("Emergency service setting saved!");
      utils.provider.getEmergencyServiceSetting.invalidate();
      setHasChanges(false);
    },
    onError: () => toast.error("Failed to save setting"),
  });

  const handleSave = () => {
    updateMutation.mutate({
      offersEmergencyService: enabled,
      emergencyHoursType: hoursType,
      emergencyHoursNote: hoursNote || undefined,
    });
  };

  if (isLoading) return <Card><CardContent className="py-8 text-center"><p className="text-muted-foreground">Loading emergency service settings...</p></CardContent></Card>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-red-500" />
            Emergency Service
          </h2>
          <p className="text-muted-foreground mt-1">
            Let customers know you're available for emergency calls — highly relevant for plumbers, electricians, and HVAC pros
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-medium">I Offer Emergency Service</Label>
              <p className="text-sm text-muted-foreground mt-0.5">
                When enabled, an "Emergency Service Available" badge appears on your profile and search cards
              </p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={(val) => { setEnabled(val); setHasChanges(true); }}
            />
          </div>

          {enabled && (
            <div className="space-y-4 border-t pt-4">
              <div>
                <Label className="text-sm font-medium">Emergency Hours</Label>
                <p className="text-xs text-muted-foreground mb-2">When are you available for emergency calls?</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { value: "24_7" as const, label: "24/7", desc: "Available anytime" },
                    { value: "after_hours" as const, label: "After Hours", desc: "Evenings & weekends" },
                    { value: "custom" as const, label: "Custom", desc: "Specify below" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => { setHoursType(option.value); setHasChanges(true); }}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${
                        hoursType === option.value
                          ? "border-red-500 bg-red-50 dark:bg-red-950/20"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <span className="font-medium text-sm block">{option.label}</span>
                      <span className="text-xs text-muted-foreground">{option.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {(hoursType === "after_hours" || hoursType === "custom") && (
                <div>
                  <Label className="text-sm font-medium">
                    {hoursType === "after_hours" ? "After-Hours Details" : "Custom Hours"}
                  </Label>
                  <p className="text-xs text-muted-foreground mb-1">
                    {hoursType === "after_hours"
                      ? "e.g., \"Mon-Fri 6PM-10PM, Weekends 8AM-10PM\""
                      : "Describe your emergency availability"}
                  </p>
                  <textarea
                    value={hoursNote}
                    onChange={(e) => { setHoursNote(e.target.value); setHasChanges(true); }}
                    maxLength={200}
                    rows={2}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder={hoursType === "after_hours" ? "Mon-Fri 6PM-10PM, Sat-Sun 8AM-10PM" : "Describe your emergency hours..."}
                  />
                  <p className="text-xs text-muted-foreground text-right mt-1">{hoursNote.length}/200</p>
                </div>
              )}

              <div className="bg-red-500/5 rounded-lg p-4">
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Tip:</strong> Customers looking for emergency services are often willing to pay premium rates.
                  Consider adding an "Emergency" service with a higher price to your service list.
                </p>
              </div>
            </div>
          )}

          {hasChanges && (
            <div className="flex justify-end pt-2">
              <Button onClick={handleSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving..." : "Save Emergency Setting"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// REFER A PROVIDER CARD
// ============================================================================
function ReferProviderCard() {
  const { data: myCode, isLoading } = trpc.referral.getMyCode.useQuery();
  const { data: stats } = trpc.referral.getStats.useQuery();
  const [copied, setCopied] = useState(false);

  const referralLink = myCode
    ? `https://ologycrew.com/provider/onboarding?ref=${myCode.code}`
    : "";

  const copyLink = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Referral link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = () => {
    if (!referralLink) return;
    if (navigator.share) {
      navigator.share({
        title: "Join OlogyCrew as a Provider",
        text: "I've been using OlogyCrew to manage my service bookings and it's great! Sign up with my referral link and we both earn credits.",
        url: referralLink,
      }).catch(() => {});
    } else {
      copyLink();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Refer a Provider</h2>
          <p className="text-muted-foreground mt-1">
            Share your referral link with fellow service professionals and earn credits when they join
          </p>
        </div>
        <Link href="/referrals">
          <Button variant="outline">
            <BarChart3 className="h-4 w-4 mr-2" />
            View All Referrals
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="py-4 text-center">
              <div className="text-2xl font-bold text-primary">{stats.totalReferrals}</div>
              <div className="text-xs text-muted-foreground">Total Referrals</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <div className="text-2xl font-bold text-emerald-600">{stats.completedReferrals}</div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <div className="text-2xl font-bold text-amber-600">{stats.pendingReferrals}</div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <div className="text-2xl font-bold text-emerald-600">${stats.totalEarnings}</div>
              <div className="text-xs text-muted-foreground">Credits Earned</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Referral Link Card */}
      <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border-emerald-200 dark:border-emerald-800">
        <CardContent className="py-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex-1 w-full">
              <Label className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-1 block">
                Your Provider Referral Link
              </Label>
              {isLoading ? (
                <div className="h-10 bg-white/50 rounded-md animate-pulse" />
              ) : (
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={referralLink}
                    className="bg-white dark:bg-background text-sm font-mono"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyLink}
                    className="shrink-0"
                  >
                    {copied ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    onClick={shareLink}
                    className="shrink-0 bg-emerald-600 hover:bg-emerald-700"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
          {myCode && (
            <p className="text-xs text-muted-foreground mt-3">
              Referral code: <span className="font-mono font-semibold">{myCode.code}</span>
              {" "}&middot;{" "}
              You earn {myCode.referrerDiscountPercent}% credit &middot; They get {myCode.refereeDiscountPercent}% off their first booking
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// VERIFICATION DOCUMENTS TAB
// ============================================================================
function VerificationDocumentsTab() {
  const { data: documents, isLoading } = trpc.verification.myDocuments.useQuery();
  const utils = trpc.useUtils();
  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState<"identity" | "business_license" | "professional_license" | "insurance" | "background_check">("identity");
  const [deletingDocId, setDeletingDocId] = useState<number | null>(null);
  const [evidenceForm, setEvidenceForm] = useState({
    documentLabel: "Government ID",
    issuer: "",
    credentialIdentifier: "",
    jurisdiction: "",
    issuedDate: "",
    expirationDate: "",
  });

  const deleteDoc = trpc.verification.deleteDocument.useMutation({
    onSuccess: () => {
      toast.success("Document deleted successfully");
      utils.verification.myDocuments.invalidate();
      setDeletingDocId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const uploadDoc = trpc.verification.upload.useMutation({
    onSuccess: () => {
      toast.success("Document uploaded successfully. It will be reviewed by our team.");
      utils.verification.myDocuments.invalidate();
      setUploading(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File must be under 10MB");
      return;
    }
    if (!evidenceForm.documentLabel.trim()) {
      toast.error("Add a document label before uploading");
      return;
    }
    if (selectedType === "insurance" && !evidenceForm.expirationDate) {
      toast.error("Insurance evidence requires an expiration date");
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadDoc.mutate({
        documentType: selectedType,
        documentLabel: evidenceForm.documentLabel.trim(),
        issuer: evidenceForm.issuer.trim() || undefined,
        credentialIdentifier: evidenceForm.credentialIdentifier.trim() || undefined,
        jurisdiction: evidenceForm.jurisdiction.trim() || undefined,
        issuedDate: evidenceForm.issuedDate || undefined,
        expirationDate: evidenceForm.expirationDate || undefined,
        documentData: base64,
        contentType: file.type || "application/pdf",
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const docTypes = [
    { value: "identity", label: "Government ID", description: "Driver's license, passport, or state ID" },
    { value: "business_license", label: "Business Registration", description: "Business registration or formation evidence" },
    { value: "professional_license", label: "Professional License", description: "Occupational or professional license" },
    { value: "insurance", label: "Insurance Certificate", description: "Liability or professional insurance" },
    { value: "background_check", label: "Background Check", description: "Background check clearance" },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
      case "verified": return <Badge className="bg-green-100 text-green-800">Evidence reviewed</Badge>;
      case "rejected": return <Badge variant="destructive">Rejected</Badge>;
      case "expired": return <Badge className="bg-amber-100 text-amber-800">Expired</Badge>;
      case "revoked": return <Badge variant="destructive">Revoked</Badge>;
      default: return <Badge variant="secondary">Pending Review</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-blue-600" />
          Verification Evidence
        </h2>
        <p className="text-muted-foreground mt-1">
          Submit evidence for separate identity, business, license, insurance, or background-check review. Uploading a document is not approval, and OlogyCrew does not issue a blanket “verified provider” claim.
        </p>
      </div>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upload Document</CardTitle>
          <CardDescription>Select a document type and upload a file (PDF, JPG, PNG — max 10MB)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {docTypes.map((dt) => (
              <button
                key={dt.value}
                onClick={() => {
                  setSelectedType(dt.value as typeof selectedType);
                  setEvidenceForm(form => ({ ...form, documentLabel: dt.label }));
                }}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  selectedType === dt.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <FileText className="h-5 w-5 mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">{dt.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{dt.description}</p>
              </button>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Document label *</Label>
              <Input value={evidenceForm.documentLabel} onChange={e => setEvidenceForm({ ...evidenceForm, documentLabel: e.target.value })} placeholder="e.g. Georgia Electrical License" />
            </div>
            <div className="space-y-1">
              <Label>Issuer or carrier</Label>
              <Input value={evidenceForm.issuer} onChange={e => setEvidenceForm({ ...evidenceForm, issuer: e.target.value })} placeholder="Issuing agency or insurer" />
            </div>
            <div className="space-y-1">
              <Label>Credential or policy ID</Label>
              <Input value={evidenceForm.credentialIdentifier} onChange={e => setEvidenceForm({ ...evidenceForm, credentialIdentifier: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Jurisdiction</Label>
              <Input value={evidenceForm.jurisdiction} onChange={e => setEvidenceForm({ ...evidenceForm, jurisdiction: e.target.value })} placeholder="e.g. Georgia" />
            </div>
            <div className="space-y-1">
              <Label>Issue date</Label>
              <Input type="date" value={evidenceForm.issuedDate} onChange={e => setEvidenceForm({ ...evidenceForm, issuedDate: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Expiration date {selectedType === "insurance" ? "*" : ""}</Label>
              <Input type="date" value={evidenceForm.expirationDate} onChange={e => setEvidenceForm({ ...evidenceForm, expirationDate: e.target.value })} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading || uploadDoc.isPending}
              />
              <div className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
                <Upload className="h-4 w-4" />
                {uploading || uploadDoc.isPending ? "Uploading..." : "Choose File & Upload"}
              </div>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Existing Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : !documents || documents.length === 0 ? (
            <div className="text-center py-8">
              <FileCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No documents uploaded yet</p>
              <p className="text-sm text-muted-foreground mt-1">Upload your first document above to start the verification process</p>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((doc: any) => (
                <div key={doc.id} className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{doc.documentLabel || doc.documentType.replaceAll("_", " ")}</p>
                      <p className="text-xs text-muted-foreground">
                        Uploaded {new Date(doc.createdAt).toLocaleDateString()}
                      </p>
                      {doc.rejectionReason && doc.verificationStatus === "rejected" && (
                        <p className="text-xs text-red-600 mt-1">Reason: {doc.rejectionReason}</p>
                      )}
                      {doc.revocationReason && doc.verificationStatus === "revoked" && (
                        <p className="text-xs text-red-600 mt-1">Revoked: {doc.revocationReason}</p>
                      )}
                      {doc.expirationDate && (
                        <p className="text-xs text-muted-foreground">Expires {new Date(`${doc.expirationDate}T00:00:00`).toLocaleDateString()}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(doc.state || doc.verificationStatus)}
                    <Button variant="ghost" size="sm" onClick={async () => {
                      try {
                        const result = await utils.client.verification.viewDocument.query({ documentId: doc.id });
                        window.open(result.url, "_blank", "noopener,noreferrer");
                      } catch (error: any) {
                        toast.error(error.message || "Unable to open document");
                      }
                    }}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {(doc.verificationStatus === "pending" || doc.verificationStatus === "rejected") && (
                      deletingDocId === doc.id ? (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteDoc.mutate({ documentId: doc.id })}
                            disabled={deleteDoc.isPending}
                          >
                            {deleteDoc.isPending ? "Deleting..." : "Confirm"}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeletingDocId(null)}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setDeletingDocId(doc.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// MAIN DASHBOARD
// ============================================================================
export default function ProviderDashboard(props: { initialTab?: string; hideChrome?: boolean } & Record<string, any> = {}) {
  const { initialTab, hideChrome } = props;
  const workspaceActive: ProviderWorkspaceSection | undefined = props.workspaceActive;
  const { user, isAuthenticated, loading } = useAuth();
  const [location, setLocation] = useLocation();
  const { isProviderView } = useViewMode();

  // Redirect to My Bookings if user switches to customer view
  useEffect(() => {
    if (!isProviderView && location !== "/my-bookings") {
      setLocation("/my-bookings");
    }
  }, [isProviderView, location, setLocation]);

  const utils = trpc.useUtils();

  // Handle Stripe return/refresh URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stripeParam = params.get("stripe");
    if (stripeParam === "return") {
      toast.success("Stripe account connected successfully! You're all set to receive payments.");
      params.delete("stripe");
      const newUrl = params.toString()
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;
      window.history.replaceState({}, "", newUrl);
      // Invalidate stripe status to refresh
      utils.stripeConnect.getStatus.invalidate();
      utils.provider.getMyProfile.invalidate();
    } else if (stripeParam === "refresh") {
      toast.info("Stripe session expired. Please try connecting again.");
      params.delete("stripe");
      const newUrl = params.toString()
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, []);

  const [editingService, setEditingService] = useState<any>(null);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [businessToolsSearch, setBusinessToolsSearch] = useState("");
  const [openBusinessToolGroups, setOpenBusinessToolGroups] = useState<string[]>([]);
  const [editingBio, setEditingBio] = useState(false);
  const [bioText, setBioText] = useState("");
  const [serviceForm, setServiceForm] = useState<any>({});
  const [deletingServiceId, setDeletingServiceId] = useState<number | null>(null);
  const [managingPhotosServiceId, setManagingPhotosServiceId] = useState<number | null>(null);
  const [showPortfolioUpload, setShowPortfolioUpload] = useState(false);
  const [portfolioUploadCategory, setPortfolioUploadCategory] = useState<number | undefined>(undefined);
  const [portfolioTitle, setPortfolioTitle] = useState("");
  const [portfolioDescription, setPortfolioDescription] = useState("");
  const [portfolioMediaType, setPortfolioMediaType] = useState<"image" | "before_after">("image");
  const [portfolioBeforeUrl, setPortfolioBeforeUrl] = useState("");
  const [portfolioAfterUrl, setPortfolioAfterUrl] = useState("");
  const [activeTab, setActiveTab] = useState(() => {
    if (initialTab) return initialTab;
    const params = new URLSearchParams(window.location.search);
    return params.get("tab") || "bookings";
  });
  const [showPackageDialog, setShowPackageDialog] = useState(false);
  const [conflictBookingId, setConflictBookingId] = useState<number | null>(null);
  const [deletingBookingId, setDeletingBookingId] = useState<number | null>(null);
  const [showConflictWarning, setShowConflictWarning] = useState(false);
  const [conflictData, setConflictData] = useState<any[]>([]);
  const [packageName, setPackageName] = useState("");
  const [packageDescription, setPackageDescription] = useState("");
  const [packagePrice, setPackagePrice] = useState("");
  const [packageServiceIds, setPackageServiceIds] = useState<number[]>([]);
  const [respondingQuoteId, setRespondingQuoteId] = useState<number | null>(null);
  const [quoteAmount, setQuoteAmount] = useState("");
  const [quoteDuration, setQuoteDuration] = useState("");
  const [quoteNotes, setQuoteNotes] = useState("");
  const [quoteValidDays, setQuoteValidDays] = useState("7");
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<"service_limit" | "photo_limit" | "general">("general");
  const profilePhotoInputRef = useRef<HTMLInputElement>(null);
  const [providerCropSrc, setProviderCropSrc] = useState<string | null>(null);
  const [showProviderCropper, setShowProviderCropper] = useState(false);
  
  const uploadProfilePhoto = trpc.provider.uploadProfilePhoto.useMutation({
    onSuccess: () => {
      utils.provider.getMyProfile.invalidate();
      utils.auth.me.invalidate();
      setShowProviderCropper(false);
      setProviderCropSrc(null);
      toast.success("Profile photo updated!");
    },
    onError: (err) => toast.error(err.message || "Failed to upload photo"),
  });

  const handleProfilePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo must be under 5MB");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setProviderCropSrc(reader.result as string);
      setShowProviderCropper(true);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleProviderCropComplete = (croppedBase64: string, contentType: string) => {
    uploadProfilePhoto.mutate({ photoData: croppedBase64, contentType: contentType as "image/jpeg" | "image/png" | "image/webp" | "image/gif" });
  };

  const { data: provider } = trpc.provider.getMyProfile.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: customersAccess } = trpc.customers.getAccess.useQuery(undefined, {
    enabled: isAuthenticated && Boolean(workspaceActive),
  });
  const { data: trustProfile } = trpc.verification.myTrustProfile.useQuery(undefined, {
    enabled: isAuthenticated && !!provider,
  });
  
  const { data: services } = trpc.service.listMine.useQuery(undefined, {
    enabled: !!provider,
  });
  useEffect(() => {
    if (!services) return;
    if (window.location.hash === "#portfolio-work-samples") {
      window.requestAnimationFrame(() => {
        document.getElementById("portfolio-work-samples")?.scrollIntoView({ block: "start" });
      });
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get("portfolio") === "upload") {
      setShowPortfolioUpload(true);
      params.delete("portfolio");
      const query = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
    }
  }, [services]);
  // Auto-open edit modal from URL param (e.g., from onboarding page)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const editId = params.get("edit");
    if (editId && services) {
      const svc = services.find((s: any) => s.id === parseInt(editId));
      if (svc) {
        openEditService(svc);
        params.delete("edit");
        const newUrl = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
        window.history.replaceState({}, "", newUrl);
      }
    }
  }, [services]);

  const { data: mySubscription } = trpc.subscription.mySubscription.useQuery(undefined, {
    enabled: !!provider,
  });

  const currentTier = (mySubscription?.currentTier || "free") as "free" | "basic" | "premium";
  const serviceLimit = mySubscription?.tierConfig?.limits?.maxServices || 3;
  const serviceCount = services?.length || 0;

  const { data: myCategories } = trpc.provider.getMyCategories.useQuery(undefined, {
    enabled: !!provider,
  });

  const { data: allCategories } = trpc.category.list.useQuery();
  
  const { data: bookings } = trpc.booking.listForProvider.useQuery(undefined, {
    enabled: !!provider,
  });

  const { data: earnings } = trpc.provider.earnings.useQuery(undefined, {
    enabled: !!provider,
  });

  const { data: analytics } = trpc.provider.analytics.useQuery(undefined, {
    enabled: !!provider,
  });

  const { data: providerQuotes } = trpc.provider.providerQuotes.useQuery(undefined, {
    enabled: !!provider,
  });
  const { data: quoteCount } = trpc.provider.quoteCount.useQuery(undefined, {
    enabled: !!provider,
  });

  // Trust score
  const { data: trustBreakdown } = trpc.trust.getMyTrustBreakdown.useQuery(undefined, {
    enabled: !!provider,
  });

  // Waitlist entries for provider's group classes
  const { data: waitlistEntries } = trpc.waitlist.providerEntries.useQuery(undefined, {
    enabled: !!provider,
  });

  const removeFromWaitlist = trpc.waitlist.providerRemove.useMutation({
    onSuccess: () => {
      utils.waitlist.providerEntries.invalidate();
      toast.success("Removed from waitlist");
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

  const updateBookingStatus = trpc.booking.updateStatus.useMutation({
    onSuccess: () => {
      utils.booking.listForProvider.invalidate();
      utils.provider.earnings.invalidate();
      toast.success("Booking updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateService = trpc.service.update.useMutation({
    onSuccess: () => {
      utils.service.listMine.invalidate();
      setEditingService(null);
      toast.success("Service updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteService = trpc.service.delete.useMutation({
    onSuccess: () => {
      utils.service.listMine.invalidate();
      setDeletingServiceId(null);
      toast.success("Service deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteBooking = trpc.booking.delete.useMutation({
    onSuccess: () => {
      utils.booking.listForProvider.invalidate();
      setDeletingBookingId(null);
      toast.success("Booking removed");
    },
    onError: (err) => toast.error(err.message),
  });

  const { data: portfolio } = trpc.provider.getPortfolio.useQuery(undefined, {
    enabled: !!provider,
  });

  const uploadPortfolioPhoto = trpc.provider.uploadPortfolioPhoto.useMutation();
  const addPortfolioItem = trpc.provider.addPortfolioItem.useMutation({
    onSuccess: () => {
      utils.provider.getPortfolio.invalidate();
      setShowPortfolioUpload(false);
      setPortfolioTitle("");
      setPortfolioDescription("");
      setPortfolioUploadCategory(undefined);
      setPortfolioMediaType("image");
      setPortfolioBeforeUrl("");
      setPortfolioAfterUrl("");
      toast.success("Work sample added to your portfolio!");
    },
    onError: (err) => toast.error(err.message),
  });
  const deletePortfolioItem = trpc.provider.deletePortfolioItem.useMutation({
    onSuccess: () => {
      utils.provider.getPortfolio.invalidate();
      toast.success("Portfolio item removed");
    },
    onError: (err) => toast.error(err.message),
  });

  const createPackage = trpc.provider.createPackage.useMutation({
    onSuccess: () => {
      trpc.useUtils().provider.myPackages.invalidate();
      setShowPackageDialog(false);
      setPackageName("");
      setPackageDescription("");
      setPackagePrice("");
      setPackageServiceIds([]);
      toast.success("Package created!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateProvider = trpc.provider.update.useMutation({
    onSuccess: () => {
      utils.provider.getMyProfile.invalidate();
      toast.success("Profile updated");
    },
    onError: (err) => toast.error(err.message),
  });

  if (loading) {
    return <ProviderDashboardSkeleton />;
  }

  if (!isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  if (!provider) {
    setLocation("/provider/onboarding");
    return null;
  }

  const pendingBookings = bookings?.filter(b => b.status === "pending").length || 0;
  const confirmedBookings = bookings?.filter(b => b.status === "confirmed").length || 0;
  const totalServices = services?.length || 0;
  const providerPublicPageHref = provider.profileSlug ? `/${provider.profileSlug}` : null;
  const normalizedBusinessToolsSearch = businessToolsSearch.trim().toLowerCase();
  const matchesBusinessToolSearch = (...terms: string[]) => (
    !normalizedBusinessToolsSearch || terms.some((term) => term.includes(normalizedBusinessToolsSearch))
  );
  const searchesReputationGroup = ["reputation", "reputation and trust"].includes(normalizedBusinessToolsSearch);
  const searchesGrowthGroup = ["growth", "growth and promotion"].includes(normalizedBusinessToolsSearch);
  const searchesPricingGroup = ["pricing", "pricing and payments"].includes(normalizedBusinessToolsSearch);
  const showReviewsTool = searchesReputationGroup || matchesBusinessToolSearch("customer reviews", "reviews", "ratings", "feedback", "respond to reviews");
  const showVerificationTool = searchesReputationGroup || matchesBusinessToolSearch("verification", "credentials", "documents", "trust", "insurance", "background check");
  const showPromoTool = searchesGrowthGroup || matchesBusinessToolSearch("promo codes", "promotion", "discounts", "offers", "marketing");
  const showReferralTool = searchesGrowthGroup || matchesBusinessToolSearch("refer a provider", "referrals", "invite providers", "rewards");
  const showTipsTool = searchesPricingGroup || matchesBusinessToolSearch("tips", "tipping", "gratuity", "payments");
  const showEstimatesTool = searchesPricingGroup || matchesBusinessToolSearch("free estimates", "estimates", "quotes");
  const showEmergencyTool = matchesBusinessToolSearch("emergency service", "urgent service", "service options", "availability");
  const visibleBusinessToolGroups = [
    (showReviewsTool || showVerificationTool) && "reputation",
    (showPromoTool || showReferralTool) && "growth",
    (showTipsTool || showEstimatesTool) && "pricing",
    showEmergencyTool && "service-options",
  ].filter(Boolean) as string[];
  const displayedBusinessToolGroups = normalizedBusinessToolsSearch
    ? visibleBusinessToolGroups
    : openBusinessToolGroups;

  const openEditProfile = () => {
    setProfileEditorOpen(true);
  };

  const openEditService = (service: any) => {
    setServiceForm({
      id: service.id,
      name: service.name || "",
      description: service.description || "",
      serviceType: service.serviceType || "fixed_location",
      categoryId: service.categoryId,
      pricingModel: service.pricingModel || "fixed",
      basePrice: service.basePrice || "",
      hourlyRate: service.hourlyRate || "",
      durationMinutes: service.durationMinutes || 60,
      cancellationPolicy: service.cancellationPolicy || "",
      depositRequired: service.depositRequired ?? false,
      depositType: service.depositType || "fixed",
      depositAmount: service.depositAmount || "",
      depositPercentage: service.depositPercentage || "",
      requireUpfrontPayment: service.requireUpfrontPayment ?? false,
      isGroupClass: service.isGroupClass ?? false,
      maxCapacity: service.maxCapacity || 1,
    });
    setEditingService(service);
  };

  return (
    <div className="min-h-screen bg-page">
      <NavHeader />

      <ProviderDashboardFrame
        active={workspaceActive}
        provider={provider}
        customersVisible={customersAccess?.visible}
        actions={workspaceActive === "services" ? (
          serviceCount >= serviceLimit && currentTier !== "premium" ? (
            <Button className="bg-white text-[#174a73] hover:bg-blue-50" onClick={() => {
              setUpgradeReason("service_limit");
              setShowUpgradePrompt(true);
            }}>
              <Crown className="mr-2 h-4 w-4" />Upgrade to add more
            </Button>
          ) : (
            <Button asChild className="bg-white text-[#174a73] hover:bg-blue-50">
              <Link href="/provider/services/new"><Plus className="mr-2 h-4 w-4" />Add service</Link>
            </Button>
          )
        ) : workspaceActive === "money" ? (
          <Button asChild className="bg-white text-[#174a73] hover:bg-blue-50">
            <Link href="/provider/subscription"><Crown className="mr-2 h-4 w-4" />Manage subscription</Link>
          </Button>
        ) : undefined}
      >
        {!hideChrome && <>
        {/* Welcome Section */}
        <div className="mb-8 flex flex-col sm:flex-row items-start justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2">Welcome back, {provider.businessName}!</h1>
            <p className="text-muted-foreground">Manage your services, bookings, and availability</p>
            <div className="flex items-center gap-2 mt-2">
              {trustProfile?.isOfficialDemo ? (
                <Badge variant="secondary">Official OlogyCrew demo</Badge>
              ) : (
                <Badge variant={trustProfile?.evidence.identity.state === "verified" ? "default" : "secondary"}>
                  Identity evidence: {trustProfile?.evidence.identity.state.replace("_", " ") || "not submitted"}
                </Badge>
              )}
              {provider.averageRating && parseFloat(provider.averageRating) > 0 && (
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                  {parseFloat(provider.averageRating).toFixed(1)} ({provider.totalReviews} reviews)
                </span>
              )}
            </div>
          </div>
          <Button variant="outline" onClick={openEditProfile}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit Profile
          </Button>
        </div>

        {/* Quick Bio Card */}
        <Card className="mb-6">
          <CardContent className="py-4">
            {editingBio ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Bio / Description</Label>
                  <span className="text-xs text-muted-foreground">{bioText.length}/500</span>
                </div>
                <Textarea
                  value={bioText}
                  onChange={(e) => setBioText(e.target.value.slice(0, 500))}
                  rows={4}
                  placeholder="Tell customers about your experience, skills, and what makes your services unique..."
                  autoFocus
                  className="resize-none"
                />
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      updateProvider.mutate({ description: bioText }, {
                        onSuccess: () => {
                          setEditingBio(false);
                          toast.success("Bio updated!");
                        }
                      });
                    }}
                    disabled={updateProvider.isPending}
                  >
                    {updateProvider.isPending ? "Saving..." : "Save"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingBio(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Your Bio</p>
                  {provider.description ? (
                    <p className="text-sm line-clamp-2">{provider.description}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No bio yet — add one so customers know what you're about.</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={() => {
                    setBioText(provider.description || "");
                    setEditingBio(true);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  Edit
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Trial Status Banner */}
        <TrialStatusBanner />

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Bookings</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingBookings}</div>
              <p className="text-xs text-muted-foreground">Awaiting your response</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Confirmed</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{confirmedBookings}</div>
              <p className="text-xs text-muted-foreground">Upcoming bookings</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Services</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalServices}</div>
              <p className="text-xs text-muted-foreground">Services offered</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(Number(earnings?.totalEarnings || 0))}</div>
              <p className="text-xs text-muted-foreground">From completed jobs</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Tips Banner */}
        <HelpBanner
          text="Tip: Respond to pending bookings within 24 hours to maintain a high trust score. Complete your profile, add portfolio photos, and collect reviews to rank higher in search results."
          variant="tip"
          className="mb-4"
        />

        {/* Trust Score Widget */}
        {trustBreakdown && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-lg">Your Trust Score</CardTitle>
              <CardDescription>Build your reputation to attract more customers</CardDescription>
            </CardHeader>
            <CardContent>
              <TrustScoreProgress
                score={trustBreakdown.score}
                level={trustBreakdown.level}
                breakdown={trustBreakdown.breakdown}
                tips={trustBreakdown.tips}
              />
            </CardContent>
          </Card>
        )}

        {/* Onboarding Checklist Widget */}
        <OnboardingChecklist
          provider={provider}
          services={services}
          myCategories={myCategories}
          portfolio={portfolio}
          connectStatus={undefined}
          onEditProfile={() => setProfileEditorOpen(true)}
          onUploadPhoto={() => profilePhotoInputRef.current?.click()}
          onUploadPortfolio={() => {
            setActiveTab("portfolio");
            setTimeout(() => setShowPortfolioUpload(true), 100);
          }}
        />
        {/* Hidden file input for profile photo upload from checklist */}
        <input
          ref={profilePhotoInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleProfilePhotoUpload}
        />

        {/* Image Cropper Dialog */}
        <ImageCropper
          open={showProviderCropper}
          imageSrc={providerCropSrc}
          onClose={() => { setShowProviderCropper(false); setProviderCropSrc(null); }}
          onCropComplete={handleProviderCropComplete}
          isUploading={uploadProfilePhoto.isPending}
        />
        </>}

        {/* Main Content Tabs - Consolidated from 12 to 6 */}
        <Tabs id="dashboard-tabs" defaultValue="bookings" className="space-y-6 scroll-mt-16" value={activeTab} onValueChange={(v) => { setActiveTab(v); document.getElementById("dashboard-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
          {/* Desktop Tab Bar */}
          {!hideChrome && <div className="hidden md:block">
            <TabsList className="inline-flex h-auto gap-1 w-full p-1">
              <Button asChild variant="ghost" size="sm" className="h-auto flex-1 px-3 py-2 text-sm">
                <Link href="/my-bookings" aria-label="Open My Bookings">
                  <Calendar className="h-4 w-4 mr-1.5" />Bookings
                </Link>
              </Button>
              <TabsTrigger value="services" className="flex-1 text-sm px-3 py-2"><Package className="h-4 w-4 mr-1.5" />Services</TabsTrigger>
              <TabsTrigger value="schedule" className="flex-1 text-sm px-3 py-2"><Clock className="h-4 w-4 mr-1.5" />Schedule</TabsTrigger>
              <TabsTrigger value="finances" className="flex-1 text-sm px-3 py-2"><DollarSign className="h-4 w-4 mr-1.5" />Finances</TabsTrigger>
              {providerPublicPageHref ? (
                <Button asChild variant="ghost" size="sm" className="h-auto flex-1 px-3 py-2 text-sm">
                  <Link href={providerPublicPageHref} aria-label="Open my public provider page">
                    <Globe className="h-4 w-4 mr-1.5" />My Page
                  </Link>
                </Button>
              ) : (
                <TabsTrigger value="my-page" className="flex-1 text-sm px-3 py-2"><Globe className="h-4 w-4 mr-1.5" />My Page</TabsTrigger>
              )}
              <Button asChild variant="ghost" size="sm" className="h-auto flex-1 px-3 py-2 text-sm">
                <Link href="/provider/tools" aria-label="Open Business Tools">
                  <Settings className="h-4 w-4 mr-1.5" />More
                </Link>
              </Button>
            </TabsList>
          </div>}

          {!hideChrome && <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border shadow-lg">
            <div className="grid grid-cols-6 h-16">
              <Link
                href="/my-bookings"
                aria-label="Open My Bookings"
                className="flex flex-col items-center justify-center gap-0.5 text-[10px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <Calendar className="h-5 w-5" />
                Bookings
              </Link>
              {[
                { value: "services", icon: Package, label: "Services" },
                { value: "schedule", icon: Clock, label: "Schedule" },
                { value: "finances", icon: DollarSign, label: "Finances" },
              ].map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  onClick={() => { setActiveTab(value); document.getElementById("dashboard-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                  className={`flex flex-col items-center justify-center gap-0.5 text-[10px] transition-colors ${
                    activeTab === value
                      ? "text-primary font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className={`h-5 w-5 ${activeTab === value ? "text-primary" : ""}`} />
                  {label}
                </button>
              ))}
              {providerPublicPageHref ? (
                <Link
                  href={providerPublicPageHref}
                  aria-label="Open my public provider page"
                  className="flex flex-col items-center justify-center gap-0.5 text-[10px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <Globe className="h-5 w-5" />
                  My Page
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => { setActiveTab("my-page"); document.getElementById("dashboard-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                  className={`flex flex-col items-center justify-center gap-0.5 text-[10px] transition-colors ${activeTab === "my-page" ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Globe className={`h-5 w-5 ${activeTab === "my-page" ? "text-primary" : ""}`} />
                  My Page
                </button>
              )}
              <Link
                href="/provider/tools"
                aria-label="Open Business Tools"
                className="flex flex-col items-center justify-center gap-0.5 text-[10px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <Settings className="h-5 w-5" />
                More
              </Link>
            </div>
          </div>}

          {/* Bookings Tab */}
          <TabsContent value="bookings" className="space-y-4 pb-20 md:pb-0">
          <SectionErrorBoundary fallbackTitle="Bookings couldn't load">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold">Bookings</h2>
                <HelpTip text="View and manage all customer bookings. Confirm pending bookings promptly to maintain a high response rate and build trust with customers." variant="info" />
              </div>
              <Link href="/provider/calendar">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Calendar className="h-4 w-4" />
                  Calendar View
                </Button>
              </Link>
            </div>

            {!bookings || bookings.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">No bookings yet</p>
                  <p className="text-sm text-muted-foreground">
                    Bookings will appear here once customers start booking your services
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {bookings.map((booking: any) => (
                  <Card key={booking.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-lg truncate">{booking.serviceName || 'Service'}</CardTitle>
                          <p className="text-xs text-muted-foreground font-mono mt-0.5">{booking.bookingNumber}</p>
                          <CardDescription>
                            {booking.bookingType === "multi_day" && booking.endDate
                              ? `${new Date(booking.bookingDate).toLocaleDateString()} — ${new Date(booking.endDate).toLocaleDateString()}`
                              : new Date(booking.bookingDate).toLocaleDateString()} at {formatTimeForDisplay(booking.startTime)}
                          </CardDescription>
                          {booking.bookingType && booking.bookingType !== "single" && (
                            <Badge variant="outline" className="mt-1 w-fit text-xs">
                              {booking.bookingType === "multi_day"
                                ? `Multi-Day (${booking.totalDays || "—"} days)`
                                : `Recurring (${booking.recurrenceTotalSessions || "—"} sessions • ${booking.recurrenceFrequency || "weekly"})`}
                            </Badge>
                          )}
                        </div>
                        <Badge variant={
                          booking.status === "pending" ? "secondary" :
                          booking.status === "confirmed" ? "default" :
                          booking.status === "completed" ? "outline" :
                          "destructive"
                        }>
                          {booking.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <p className="text-sm font-medium mb-1">Location</p>
                          <p className="text-sm text-muted-foreground capitalize">{booking.locationType?.replace('_', ' ')}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-1">{booking.bookingType === "multi_day" ? "Duration / Day" : booking.bookingType === "recurring" ? "Duration / Session" : "Duration"}</p>
                          <p className="text-sm text-muted-foreground">{formatDuration(booking.durationMinutes)}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-1">Total Amount</p>
                          <p className="text-sm font-semibold">{formatCurrency(parseFloat(booking.totalAmount || "0"))}</p>
                        </div>
                      </div>
                      {booking.customerNotes && (
                        <div className="mb-4">
                          <p className="text-sm font-medium mb-1">Customer Notes</p>
                          <p className="text-sm text-muted-foreground">{booking.customerNotes}</p>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {booking.status === "pending" && (
                          <>
            <Button 
              size="sm" 
              onClick={async () => {
                try {
                  const result = await utils.booking.checkConflicts.fetch({ bookingId: booking.id });
                  if (result.hasConflicts) {
                    setConflictBookingId(booking.id);
                    setConflictData(result.conflicts);
                    setShowConflictWarning(true);
                  } else {
                    updateBookingStatus.mutate({ id: booking.id, status: "confirmed" });
                  }
                } catch {
                  updateBookingStatus.mutate({ id: booking.id, status: "confirmed" });
                }
              }}
              disabled={updateBookingStatus.isPending}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Accept
            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => updateBookingStatus.mutate({ id: booking.id, status: "cancelled", cancellationReason: "Declined by provider" })}
                              disabled={updateBookingStatus.isPending}
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
                              onClick={() => updateBookingStatus.mutate({ id: booking.id, status: "in_progress" })}
                              disabled={updateBookingStatus.isPending}
                            >
                              Start Service
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => updateBookingStatus.mutate({ id: booking.id, status: "cancelled", cancellationReason: "Cancelled by provider" })}
                              disabled={updateBookingStatus.isPending}
                            >
                              Cancel
                            </Button>
                          </>
                        )}
                        {booking.status === "in_progress" && (
                          <Button 
                            size="sm" 
                            onClick={() => updateBookingStatus.mutate({ id: booking.id, status: "completed" })}
                            disabled={updateBookingStatus.isPending}
                          >
                            Mark Complete
                          </Button>
                        )}
                        <Link href={`/booking/${booking.id}/detail`}>
                          <Button size="sm" variant="ghost">
                            <Eye className="h-4 w-4 mr-1" />
                            View Details
                          </Button>
                        </Link>
                        <Link href={`/messages/${booking.id}`}>
                          <Button size="sm" variant="ghost">
                            Message Customer
                          </Button>
                        </Link>
                        {["cancelled", "completed", "no_show", "refunded"].includes(booking.status) && (
                          <Button 
                            size="sm" 
                            variant="ghost"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeletingBookingId(booking.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Remove
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* ============================================================ */}
            {/* QUOTE REQUESTS SECTION                                       */}
            {/* ============================================================ */}
            <div className="border-t pt-6 mt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold">Quote Requests</h2>
                  {(quoteCount?.pending || 0) > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {quoteCount?.pending} pending
                    </Badge>
                  )}
                </div>
              </div>

              {!providerQuotes || providerQuotes.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground mb-2">No quote requests yet</p>
                    <p className="text-sm text-muted-foreground">
                      When customers request custom quotes, they'll appear here
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {providerQuotes.map((quote: any) => (
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
                              onClick={() => setRespondingQuoteId(quote.id)}
                            >
                              <DollarSign className="h-4 w-4 mr-1" />
                              Send Quote
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => declineQuoteRequest.mutate({ quoteId: quote.id, status: "declined", reason: "Unable to fulfill this request" })}
                              disabled={declineQuoteRequest.isPending}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Decline
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                if (confirm("Are you sure you want to delete this quote request? This cannot be undone.")) {
                                  deleteQuoteRequest.mutate({ quoteId: quote.id });
                                }
                              }}
                              disabled={deleteQuoteRequest.isPending}
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
                              onClick={() => {
                                if (confirm("Are you sure you want to delete this quote request? This cannot be undone.")) {
                                  deleteQuoteRequest.mutate({ quoteId: quote.id });
                                }
                              }}
                              disabled={deleteQuoteRequest.isPending}
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
              )}
            </div>

            {/* Waitlist Section */}
            {waitlistEntries && waitlistEntries.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center gap-2 mb-4">
                  <BellRing className="h-5 w-5 text-amber-600" />
                  <h3 className="text-lg font-semibold">Waitlist</h3>
                  <Badge variant="secondary" className="ml-1">{waitlistEntries.length}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Customers waiting for spots in your group classes. They'll be auto-notified when a spot opens.
                </p>
                <div className="space-y-3">
                  {(() => {
                    // Group entries by service + date
                    const grouped: Record<string, typeof waitlistEntries> = {};
                    waitlistEntries.forEach((entry: any) => {
                      const key = `${entry.serviceName}|${entry.bookingDate}`;
                      if (!grouped[key]) grouped[key] = [];
                      grouped[key].push(entry);
                    });
                    return Object.entries(grouped).map(([key, entries]) => {
                      const [serviceName, bookingDate] = key.split("|");
                      return (
                        <Card key={key}>
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <CardTitle className="text-base">{serviceName}</CardTitle>
                                <CardDescription>
                                  {new Date(bookingDate + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                                  {" · "}
                                  {(entries as any[])[0]?.startTime
                                    ? formatTimeForDisplay((entries as any[])[0].startTime)
                                    : ""}
                                </CardDescription>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                <Users className="h-3 w-3 mr-1" />
                                {(entries as any[]).length} waiting
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <div className="divide-y">
                              {(entries as any[]).map((entry: any) => (
                                <div key={entry.id} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                                  <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                      #{entry.position}
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium">{entry.userName}</p>
                                      <p className="text-xs text-muted-foreground">
                                        Joined {new Date(entry.createdAt).toLocaleDateString()}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge
                                      variant={entry.status === "notified" ? "default" : "secondary"}
                                      className="text-xs"
                                    >
                                      {entry.status === "waiting" && "Waiting"}
                                      {entry.status === "notified" && "Notified"}
                                      {entry.status === "booked" && "Booked"}
                                      {entry.status === "expired" && "Expired"}
                                    </Badge>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                      onClick={() => removeFromWaitlist.mutate({ id: entry.id })}
                                      disabled={removeFromWaitlist.isPending}
                                      title="Remove from waitlist"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    });
                  })()}
                </div>
              </div>
            )}
          </SectionErrorBoundary>
          </TabsContent>

          {/* Services Tab — grouped by category */}
          <TabsContent value="services" className="space-y-6 pb-20 md:pb-0">
          <SectionErrorBoundary fallbackTitle="Services couldn't load">
            {workspaceActive === "services" ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <HelpTip text="Add services you offer within your chosen categories. Each service needs a name, price, and duration. Customers will see these when browsing your profile." variant="info" />
                  <span>{serviceCount} service{serviceCount === 1 ? "" : "s"} across {myCategories?.length || 0} categor{myCategories?.length === 1 ? "y" : "ies"}</span>
                </div>
                <Button asChild variant="outline" size="sm" className="bg-white">
                  <Link href="/provider/onboarding"><Grid3X3 className="mr-1 h-4 w-4" />Categories</Link>
                </Button>
              </div>
            ) : (
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold">My Categories & Services</h2>
                  <HelpTip text="Add services you offer within your chosen categories. Each service needs a name, price, and duration. Customers will see these when browsing your profile." variant="info" />
                </div>
                <p className="text-sm text-muted-foreground mt-1">Manage the categories you serve and the services you offer in each</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/provider/onboarding">
                  <Button variant="outline" size="sm">
                    <Grid3X3 className="h-4 w-4 mr-1" /> Categories
                  </Button>
                </Link>
                {serviceCount >= serviceLimit && currentTier !== "premium" ? (
                  <Button size="sm" className="bg-amber-700 hover:bg-amber-800 text-white" onClick={() => {
                    setUpgradeReason("service_limit");
                    setShowUpgradePrompt(true);
                  }}>
                    <Crown className="h-4 w-4 mr-1" /> Upgrade to Add More
                  </Button>
                ) : (
                  <Link href="/provider/services/new">
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-1" /> Add Service
                    </Button>
                  </Link>
                )}
              </div>
            </div>
            )}

            {/* Tier limit banner */}
            <UpgradeBanner
              reason="service_limit"
              currentTier={currentTier}
              currentCount={serviceCount}
              maxCount={serviceLimit}
              onUpgradeClick={() => {
                setUpgradeReason("service_limit");
                setShowUpgradePrompt(true);
              }}
            />

            {/* Active Categories with their services */}
            {myCategories && myCategories.length > 0 ? (
              myCategories.map((pc: any) => {
                const cat = pc.category;
                if (!cat) return null;
                const catServices = services?.filter((s: any) => s.categoryId === cat.id) || [];
                const displayName = cat.name.split(" ").map((w: string) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
                return (
                  <Card key={cat.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <span className="text-xl">{CATEGORY_ICONS[cat.id] || "📦"}</span>
                          {displayName}
                          <Badge variant="outline" className="text-xs ml-1">
                            {catServices.length} service{catServices.length !== 1 ? "s" : ""}
                          </Badge>
                        </CardTitle>
                        <Link href="/provider/services/new">
                          <Button size="sm" variant="outline">
                            <Plus className="h-3.5 w-3.5 mr-1" /> Add
                          </Button>
                        </Link>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {catServices.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground text-sm border rounded-lg bg-muted/30 border-dashed">
                          No services in this category yet
                        </div>
                      ) : (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {catServices.map((service: any) => (
                            <div key={service.id} className="p-3 rounded-lg border bg-card">
                              <div className="flex items-start justify-between">
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-sm truncate">{service.name}</p>
                                  {service.description && (
                                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{service.description}</p>
                                  )}
                                </div>
                                <div className="text-right ml-2 flex-shrink-0">
                                  <span className="font-semibold text-sm text-primary">
                                    {service.pricingModel === "fixed" && service.basePrice && formatCurrency(parseFloat(service.basePrice))}
                                    {service.pricingModel === "hourly" && service.hourlyRate && `${formatCurrency(parseFloat(service.hourlyRate))}/hr`}
                                    {service.pricingModel === "package" && service.basePrice && formatCurrency(parseFloat(service.basePrice))}
                                    {service.pricingModel === "custom_quote" && "Quote"}
                                    {service.pricingModel === "consultation" && "Free"}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                <span>{getServiceTypeLabel(service.serviceType, service.categoryId)}</span>
                                {service.durationMinutes && <span>· {formatDuration(service.durationMinutes)}</span>}
                              </div>
                              <div className="flex gap-1 mt-2 pt-2 border-t">
                                <Button size="sm" variant="ghost" className="h-7 text-xs flex-1" onClick={() => openEditService(service)}>
                                  <Pencil className="h-3 w-3 mr-1" /> Edit
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 text-xs flex-1" onClick={() => setManagingPhotosServiceId(service.id)}>
                                  <ImageIcon className="h-3 w-3 mr-1" /> Photos
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => setDeletingServiceId(service.id)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No categories selected</h3>
                  <p className="text-muted-foreground mb-4">Select the service categories you offer to start adding services</p>
                  <Link href="/provider/onboarding">
                    <Button>Select Your Categories</Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* ── PORTFOLIO / WORK SAMPLES ── */}
            <div id="portfolio-work-samples" className="scroll-mt-24 border-t pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2"><ImageIcon className="h-5 w-5" /> Portfolio & Work Samples</h3>
                  <p className="text-sm text-muted-foreground mt-1">Showcase your best work to attract more customers</p>
                </div>
                <Button size="sm" onClick={() => setShowPortfolioUpload(true)}>
                  <Upload className="h-4 w-4 mr-1" /> Add Work
                </Button>
              </div>
              <PortfolioGallery categories={myCategories} />
            </div>

            {/* Service Packages Section */}
            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2"><Package className="h-5 w-5" /> Service Packages</h3>
                  <p className="text-sm text-muted-foreground mt-1">Bundle multiple services together with a discount</p>
                </div>
                <Button size="sm" onClick={() => setShowPackageDialog(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Create Package
                </Button>
              </div>
              <PackagesList />
            </div>

            {/* Services without a matching category */}
            {services && services.length > 0 && myCategories && (() => {
              const myCatIds = new Set(myCategories.map((pc: any) => pc.categoryId));
              const uncategorized = services.filter((s: any) => !myCatIds.has(s.categoryId));
              if (uncategorized.length === 0) return null;
              return (
                <Card className="border-dashed">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg text-muted-foreground">Other Services</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {uncategorized.map((service: any) => (
                        <div key={service.id} className="p-3 rounded-lg border bg-card">
                          <p className="font-medium text-sm">{service.name}</p>
                          <div className="flex gap-1 mt-2 pt-2 border-t">
                            <Button size="sm" variant="ghost" className="h-7 text-xs flex-1" onClick={() => openEditService(service)}>
                              <Pencil className="h-3 w-3 mr-1" /> Edit
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => setDeletingServiceId(service.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })()}
          </SectionErrorBoundary>
          </TabsContent>

          {/* === SCHEDULE TAB (Availability + Calendar Sync) === */}
          <TabsContent value="schedule" className="space-y-6 pb-20 md:pb-0">
          <SectionErrorBoundary fallbackTitle="Schedule couldn't load">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold">Manage Availability</h2>
                <HelpTip text="Set your weekly working hours so customers know when you're available. You can also block specific dates for vacations or personal time." variant="info" />
              </div>
            </div>
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">Manage your availability</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Set your weekly schedule and manage date-specific overrides
                </p>
                <Button onClick={() => setLocation("/provider/availability")}>
                  Manage Availability
                </Button>
              </CardContent>
            </Card>
          
            {/* Calendar Sync sub-section */}
            <div className="border-t pt-6">
              <CalendarSyncSection />
            </div>
          </SectionErrorBoundary>
          </TabsContent>

          {/* === FINANCES TAB (Earnings + Payments) === */}
          <TabsContent value="finances" className="space-y-6 pb-20 md:pb-0">
          <SectionErrorBoundary fallbackTitle="Finances couldn't load">
            {workspaceActive !== "money" ? <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold">Finances</h2>
                  <HelpTip text="Track your income from completed bookings. Earnings are deposited to your connected Stripe account. Pending payouts reflect confirmed bookings not yet completed." variant="info" />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">Review earnings, completed work, payment setup, and your subscription.</p>
              </div>
            </div> : null}

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
                  <Wallet className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(Number(earnings?.totalEarnings || 0))}</div>
                  <p className="text-xs text-muted-foreground">All time</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">This Month</CardTitle>
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(Number(earnings?.thisMonthEarnings || 0))}</div>
                  <p className="text-xs text-muted-foreground">Current month</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
                  <Clock className="h-4 w-4 text-amber-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(Number(earnings?.pendingPayouts || 0))}</div>
                  <p className="text-xs text-muted-foreground">From confirmed bookings</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Completed Jobs</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{earnings?.completedBookings || 0}</div>
                  <p className="text-xs text-muted-foreground">Total completed</p>
                </CardContent>
              </Card>
            </div>

            {/* Completed bookings list */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Completed Bookings</CardTitle>
              </CardHeader>
              <CardContent>
                {bookings?.filter(b => b.status === "completed").length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No completed bookings yet</p>
                ) : (
                  <div className="space-y-3">
                    {bookings?.filter(b => b.status === "completed").slice(0, 10).map((booking: any) => (
                      <div key={booking.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div>
                          <p className="text-sm font-medium">{booking.bookingNumber}</p>
                          <p className="text-xs text-muted-foreground">{new Date(booking.bookingDate).toLocaleDateString()}</p>
                        </div>
                        <p className="font-semibold">{formatCurrency(parseFloat(booking.subtotal || "0"))}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          
            {/* Stripe Connect & Payments sub-section */}
            <div className="border-t pt-6">
              <StripeConnectSection provider={provider} currentTier={currentTier} />
            </div>

            {/* Subscription Plan */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Subscription Plan</CardTitle>
                <CardDescription>Upgrade your plan to unlock more features</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      <Badge variant="outline" className={`gap-1.5 px-2.5 py-0.5 ${
                        currentTier === "premium" ? "text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40" :
                        currentTier === "basic" ? "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40" :
                        "text-muted-foreground bg-muted"
                      }`}>
                        {currentTier === "premium" ? "Business" : currentTier === "basic" ? "Pro" : "Starter"} Plan
                      </Badge>
                    </p>
                    <p className="text-sm text-muted-foreground">Manage your subscription, upgrade, or view plan details</p>
                  </div>
                  <Link href="/provider/subscription">
                    <Button variant="outline" size="sm">
                      <Crown className="h-4 w-4 mr-1" />
                      Manage Subscription
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </SectionErrorBoundary>
          </TabsContent>

          {/* === MY PAGE TAB (Public Profile + Analytics + Embed Widget) === */}
          <TabsContent value="my-page" className="space-y-6 pb-20 md:pb-0">
          <SectionErrorBoundary fallbackTitle="My Page couldn't load">
            <PublicProfileSection provider={provider} currentTier={currentTier} />

          {/* Analytics sub-section inside My Page */}
            <div>
              <h2 className="text-2xl font-bold">Business Analytics</h2>
              <p className="text-muted-foreground mt-1">Track your performance, revenue trends, and customer insights</p>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
                  <Users className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics?.customerRetention?.totalCustomers ?? 0}</div>
                  <p className="text-xs text-muted-foreground">Unique customers</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Returning Customers</CardTitle>
                  <RefreshCw className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics?.customerRetention?.returningCustomers ?? 0}</div>
                  <p className="text-xs text-muted-foreground">{analytics?.customerRetention?.retentionRate ?? 0}% retention rate</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Bookings/Customer</CardTitle>
                  <BarChart3 className="h-4 w-4 text-purple-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics?.customerRetention?.avgBookingsPerCustomer ?? 0}</div>
                  <p className="text-xs text-muted-foreground">Per unique customer</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Refund Rate</CardTitle>
                  <CreditCard className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics?.refundAnalytics?.refundRate ?? 0}%</div>
                  <p className="text-xs text-muted-foreground">{analytics?.refundAnalytics?.totalRefunds ?? 0} total refunds</p>
                </CardContent>
              </Card>
            </div>

            {/* Booking Trends Chart (Recharts) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Booking Trends</CardTitle>
                <CardDescription>Monthly booking volume over the last 12 months</CardDescription>
              </CardHeader>
              <CardContent>
                {(!analytics?.bookingTrends || analytics.bookingTrends.length === 0) ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No trend data yet. Bookings will appear here over time.</p>
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.bookingTrends.map((m: any) => ({
                        month: m.month,
                        completed: Number(m.completedBookings),
                        cancelled: Number(m.cancelledBookings),
                        total: Number(m.totalBookings),
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                          labelStyle={{ fontWeight: 600 }}
                        />
                        <Legend />
                        <Bar dataKey="completed" name="Completed" fill="#22c55e" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="cancelled" name="Cancelled" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Revenue Over Time Chart (Recharts) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Revenue Over Time</CardTitle>
                <CardDescription>Monthly revenue from completed bookings</CardDescription>
              </CardHeader>
              <CardContent>
                {(!analytics?.bookingTrends || analytics.bookingTrends.length === 0) ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No revenue data yet</p>
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analytics.bookingTrends.map((m: any) => ({
                        month: m.month,
                        revenue: Number(m.revenue),
                      }))}>
                        <defs>
                          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                          formatter={(value: number) => [`${formatPrice(value)}`, "Revenue"]}
                        />
                        <Area type="monotone" dataKey="revenue" stroke="#6366f1" fill="url(#revenueGradient)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Booking Source Breakdown - Pie Chart */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Booking Sources</CardTitle>
                  <CardDescription>Where your bookings come from</CardDescription>
                </CardHeader>
                <CardContent>
                  {(!analytics?.bookingSources || analytics.bookingSources.length === 0) ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No booking data yet</p>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={analytics.bookingSources.map((s: any) => {
                              const labels: Record<string, string> = {
                                direct: "Direct", embed_widget: "Widget", provider_page: "Profile", api: "API",
                              };
                              return { name: labels[s.source] || s.source, value: Number(s.count) };
                            })}
                            cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                            paddingAngle={3} dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            {analytics.bookingSources.map((_: any, idx: number) => (
                              <Cell key={idx} fill={["#3b82f6", "#22c55e", "#a855f7", "#f97316", "#6b7280"][idx % 5]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Top Services */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Top Performing Services</CardTitle>
                  <CardDescription>Most booked services by volume</CardDescription>
                </CardHeader>
                <CardContent>
                  {(!analytics?.topServices || analytics.topServices.length === 0) ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No service data yet</p>
                  ) : (
                    <div className="space-y-3">
                      {analytics.topServices.map((svc: any, idx: number) => (
                        <div key={svc.serviceId} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-bold text-primary">#{idx + 1}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{svc.serviceName || `Service #${svc.serviceId}`}</p>
                            <p className="text-xs text-muted-foreground">{svc.totalBookings} bookings ({svc.completedBookings} completed)</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-semibold">{formatCurrency(Number(svc.revenue))}</p>
                            {Number(svc.avgRating) > 0 && (
                              <p className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                                <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                {Number(svc.avgRating).toFixed(1)} ({svc.reviewCount})
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          
          {/* Embed Widget sub-section inside My Page */}
            <div className="space-y-4">
              <div>
                <h2 className="text-2xl font-bold">Embed Booking Widget</h2>
                <p className="text-muted-foreground mt-1">Add a booking calendar to your website so clients can book directly</p>
              </div>
              <Card>
                <CardContent className="py-8 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <Code2 className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Get Your Embed Code</h3>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto mt-2">
                      Generate a customizable booking widget you can embed on your website, share on social media, or add to your email signature.
                    </p>
                  </div>
                  <Link href="/provider/widgets">
                    <Button size="lg">
                      <Code2 className="w-4 h-4 mr-2" />
                      Open Widget Generator
                    </Button>
                  </Link>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Quick Links</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">Your Profile Page</p>
                      <p className="text-xs text-muted-foreground">Your public profile link for sharing</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => {
                      const url = provider.profileSlug
                        ? `https://ologycrew.com/${provider.profileSlug}`
                        : `https://ologycrew.com/${provider.id}`;
                      navigator.clipboard.writeText(url);
                      toast.success("Profile URL copied!");
                    }}>
                      <Copy className="w-3 h-3 mr-1" /> Copy URL
                    </Button>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">All Services Widget</p>
                      <p className="text-xs text-muted-foreground">Shows all your services with a picker</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => {
                      navigator.clipboard.writeText(`https://ologycrew.com/embed/provider/${provider.id}`);
                      toast.success("Widget URL copied!");
                    }}>
                      <Copy className="w-3 h-3 mr-1" /> Copy URL
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </SectionErrorBoundary>
          </TabsContent>

          {/* === SETTINGS/MORE TAB (Reviews + Promo Codes + Verification) === */}
          <TabsContent value="settings" className="space-y-6 pb-20 md:pb-0">
          <SectionErrorBoundary fallbackTitle="Settings couldn't load">
            <Card className="border-slate-200 bg-white/95 shadow-sm">
              <CardContent className="p-4 sm:p-5">
                <label htmlFor="business-tools-search" className="text-sm font-semibold text-slate-900">Find a business tool</label>
                <div className="relative mt-2">
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="business-tools-search"
                    value={businessToolsSearch}
                    onChange={(event) => setBusinessToolsSearch(event.target.value)}
                    className="h-10 bg-white pl-9 pr-10"
                    placeholder="Search business tools..."
                    aria-label="Search Business Tools"
                  />
                  {businessToolsSearch ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1 h-8 w-8 text-slate-500"
                      onClick={() => setBusinessToolsSearch("")}
                      aria-label="Clear Business Tools search"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-slate-500">Try reviews, promo codes, tips, estimates, or verification.</p>
              </CardContent>
            </Card>

            {visibleBusinessToolGroups.length > 0 ? (
              <Accordion
                type="multiple"
                value={displayedBusinessToolGroups}
                onValueChange={setOpenBusinessToolGroups}
                className="space-y-3"
              >
                {(showReviewsTool || showVerificationTool) ? (
                  <AccordionItem value="reputation" className="rounded-2xl border border-slate-200 bg-white px-4 shadow-sm sm:px-5">
                    <AccordionTrigger className="py-5 hover:no-underline">
                      <span className="flex min-w-0 items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#174a73]"><Shield className="h-5 w-5" /></span>
                        <span className="min-w-0">
                          <span className="block font-bold text-slate-950">Reputation & trust</span>
                          <span className="mt-0.5 block text-xs font-normal text-slate-500">Reviews, credentials, and verification</span>
                        </span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pb-5">
                      {showReviewsTool ? (
                        <Card className="border-slate-200 shadow-none">
                          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><Star className="h-5 w-5" /></span>
                            <div className="min-w-0 flex-1">
                              <h3 className="font-semibold text-slate-950">Customer Reviews</h3>
                              <p className="mt-1 text-sm text-slate-500">View and respond to customer feedback.</p>
                            </div>
                            <Button size="sm" onClick={() => setLocation("/provider/reviews")}>View Reviews</Button>
                          </CardContent>
                        </Card>
                      ) : null}
                      {showVerificationTool ? <VerificationDocumentsTab /> : null}
                    </AccordionContent>
                  </AccordionItem>
                ) : null}

                {(showPromoTool || showReferralTool) ? (
                  <AccordionItem value="growth" className="rounded-2xl border border-slate-200 bg-white px-4 shadow-sm sm:px-5">
                    <AccordionTrigger className="py-5 hover:no-underline">
                      <span className="flex min-w-0 items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><TrendingUp className="h-5 w-5" /></span>
                        <span className="min-w-0">
                          <span className="block font-bold text-slate-950">Growth & promotion</span>
                          <span className="mt-0.5 block text-xs font-normal text-slate-500">Discounts, referrals, and provider rewards</span>
                        </span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pb-5">
                      {showPromoTool ? (
                        <Card className="border-slate-200 shadow-none">
                          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Tag className="h-5 w-5" /></span>
                            <div className="min-w-0 flex-1">
                              <h3 className="font-semibold text-slate-950">Promo Codes</h3>
                              <p className="mt-1 text-sm text-slate-500">Create discounts to attract new customers and reward loyal clients.</p>
                            </div>
                            <Button asChild size="sm"><Link href="/provider/promo-codes">Manage Promo Codes</Link></Button>
                          </CardContent>
                        </Card>
                      ) : null}
                      {showReferralTool ? <ReferProviderCard /> : null}
                    </AccordionContent>
                  </AccordionItem>
                ) : null}

                {(showTipsTool || showEstimatesTool) ? (
                  <AccordionItem value="pricing" className="rounded-2xl border border-slate-200 bg-white px-4 shadow-sm sm:px-5">
                    <AccordionTrigger className="py-5 hover:no-underline">
                      <span className="flex min-w-0 items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><DollarSign className="h-5 w-5" /></span>
                        <span className="min-w-0">
                          <span className="block font-bold text-slate-950">Pricing & payments</span>
                          <span className="mt-0.5 block text-xs font-normal text-slate-500">Tips, estimates, and customer pricing options</span>
                        </span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pb-5">
                      <PayAtLocationSettingsSection />
                      {showTipsTool ? <TipSettingsSection /> : null}
                      {showEstimatesTool ? <FreeEstimatesSection /> : null}
                    </AccordionContent>
                  </AccordionItem>
                ) : null}

                {showEmergencyTool ? (
                  <AccordionItem value="service-options" className="rounded-2xl border border-slate-200 bg-white px-4 shadow-sm sm:px-5">
                    <AccordionTrigger className="py-5 hover:no-underline">
                      <span className="flex min-w-0 items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-700"><BellRing className="h-5 w-5" /></span>
                        <span className="min-w-0">
                          <span className="block font-bold text-slate-950">Service options</span>
                          <span className="mt-0.5 block text-xs font-normal text-slate-500">Urgent and emergency service preferences</span>
                        </span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="pb-5">
                      <EmergencyServiceSection />
                    </AccordionContent>
                  </AccordionItem>
                ) : null}
              </Accordion>
            ) : (
              <Card className="border-dashed border-slate-300 bg-white/80 shadow-none">
                <CardContent className="p-10 text-center">
                  <Search className="mx-auto h-8 w-8 text-slate-400" />
                  <h3 className="mt-3 font-semibold text-slate-900">No business tools found</h3>
                  <p className="mt-1 text-sm text-slate-500">Try a different term such as reviews, tips, promo codes, or verification.</p>
                  <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => setBusinessToolsSearch("")}>Clear search</Button>
                </CardContent>
              </Card>
            )}
          </SectionErrorBoundary>
          </TabsContent>
        </Tabs>
      </ProviderDashboardFrame>

      <ProviderBusinessProfileDialog open={profileEditorOpen} onOpenChange={setProfileEditorOpen} />

      {/* Edit Service Dialog */}
      <Dialog open={!!editingService} onOpenChange={() => setEditingService(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Service</DialogTitle>
            <DialogDescription>Update service details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto flex-1 pr-2">
            <div>
              <Label>Service Name</Label>
              <Input value={serviceForm.name || ""} onChange={e => setServiceForm({ ...serviceForm, name: e.target.value })} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={serviceForm.description || ""} onChange={e => setServiceForm({ ...serviceForm, description: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Service Type</Label>
                <Select value={serviceForm.serviceType || "fixed_location"} onValueChange={(value) => setServiceForm({ ...serviceForm, serviceType: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {serviceForm.categoryId === 20 ? (
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
              <div>
                <Label>Duration</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={serviceForm.durationMinutes || 60}
                  onChange={e => setServiceForm({ ...serviceForm, durationMinutes: parseInt(e.target.value) || 60 })}
                >
                  {DURATION_PRESETS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Pricing Model</Label>
                <Select value={serviceForm.pricingModel || "fixed"} onValueChange={(value) => setServiceForm({ ...serviceForm, pricingModel: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed Price</SelectItem>
                    <SelectItem value="hourly">Hourly Rate</SelectItem>
                    <SelectItem value="package">Package Deal</SelectItem>
                    <SelectItem value="custom_quote">Custom Quote</SelectItem>
                    <SelectItem value="consultation">Consultation (Free)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(serviceForm.pricingModel === "fixed" || serviceForm.pricingModel === "package") && (
                <div>
                  <Label>Base Price ($)</Label>
                  <Input type="number" step="0.01" value={serviceForm.basePrice || ""} onChange={e => setServiceForm({ ...serviceForm, basePrice: e.target.value })} />
                </div>
              )}
              {serviceForm.pricingModel === "hourly" && (
                <div>
                  <Label>Hourly Rate ($)</Label>
                  <Input type="number" step="0.01" value={serviceForm.hourlyRate || ""} onChange={e => setServiceForm({ ...serviceForm, hourlyRate: e.target.value })} />
                </div>
              )}
              {serviceForm.pricingModel === "custom_quote" || serviceForm.pricingModel === "consultation" ? <div /> : null}
            </div>
            <div>
              <Label>Cancellation Policy</Label>
              <Textarea value={serviceForm.cancellationPolicy || ""} onChange={e => setServiceForm({ ...serviceForm, cancellationPolicy: e.target.value })} rows={2} />
            </div>
            {/* Deposit Settings */}
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="edit-deposit-required"
                  checked={serviceForm.depositRequired || false}
                  onChange={e => setServiceForm({ ...serviceForm, depositRequired: e.target.checked, ...(!e.target.checked && { depositAmount: "", depositPercentage: "" }) })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="edit-deposit-required" className="mb-0 cursor-pointer">Require Deposit</Label>
              </div>
              {serviceForm.depositRequired && (
                <div className="space-y-3 pt-1">
                  <div>
                    <Label>Deposit Type</Label>
                    <select
                      className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                      value={serviceForm.depositType || "fixed"}
                      onChange={e => setServiceForm({ ...serviceForm, depositType: e.target.value, depositAmount: "", depositPercentage: "" })}
                    >
                      <option value="fixed">Fixed Amount ($)</option>
                      <option value="percentage">Percentage (%)</option>
                    </select>
                  </div>
                  {serviceForm.depositType === "percentage" ? (
                    <div>
                      <Label>Deposit Percentage (%)</Label>
                      <Input
                        type="number"
                        min="1"
                        max="100"
                        step="1"
                        value={serviceForm.depositPercentage || ""}
                        onChange={e => setServiceForm({ ...serviceForm, depositPercentage: e.target.value })}
                        placeholder="e.g. 25"
                      />
                    </div>
                  ) : (
                    <div>
                      <Label>Deposit Amount ($)</Label>
                      <Input
                        type="number"
                        min="0.50"
                        step="0.01"
                        value={serviceForm.depositAmount || ""}
                        onChange={e => setServiceForm({ ...serviceForm, depositAmount: e.target.value })}
                        placeholder="e.g. 50.00"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Require Upfront Payment toggle */}
            <div className="border rounded-lg p-4 space-y-2 bg-muted/30">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="edit-require-upfront"
                  checked={serviceForm.requireUpfrontPayment || false}
                  onChange={e => setServiceForm({ ...serviceForm, requireUpfrontPayment: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="edit-require-upfront" className="mb-0 cursor-pointer">Require Upfront Payment</Label>
              </div>
              <p className="text-xs text-muted-foreground pl-7">
                {serviceForm.requireUpfrontPayment
                  ? "Customers must pay immediately when booking. They will not have the option to pay after confirmation."
                  : "Customers can choose to pay now or pay after you confirm the booking."}
              </p>
            </div>

            {/* Group Class / Capacity - hidden for DJ & Music Services (category 20) */}
            {serviceForm.categoryId !== 20 && (
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Group Class / Capacity</Label>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="edit-group-class"
                  checked={serviceForm.isGroupClass || false}
                  onChange={e => setServiceForm({ ...serviceForm, isGroupClass: e.target.checked, maxCapacity: e.target.checked ? 10 : 1 })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="edit-group-class" className="mb-0 cursor-pointer">This is a group class/session</Label>
              </div>
              {serviceForm.isGroupClass && (
                <div>
                  <Label>Maximum Participants Per Session</Label>
                  <Input
                    type="number"
                    min="2"
                    max="100"
                    value={serviceForm.maxCapacity || 10}
                    onChange={e => setServiceForm({ ...serviceForm, maxCapacity: parseInt(e.target.value) || 10 })}
                    placeholder="10"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Customers will see remaining spots when booking.</p>
                </div>
              )}
            </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingService(null)}>Cancel</Button>
            <Button onClick={() => {
              const payload = { ...serviceForm };
              // Prevent NaN from empty deposit fields
              if (!payload.depositRequired) {
                payload.depositAmount = undefined;
                payload.depositPercentage = undefined;
                payload.depositType = undefined;
              } else if (payload.depositType === "percentage") {
                payload.depositAmount = undefined;
                payload.depositPercentage = payload.depositPercentage || undefined;
              } else {
                payload.depositPercentage = undefined;
                payload.depositAmount = payload.depositAmount || undefined;
              }
              updateService.mutate(payload);
            }} disabled={updateService.isPending}>
              {updateService.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Photos Dialog */}
      <Dialog open={!!managingPhotosServiceId} onOpenChange={() => setManagingPhotosServiceId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Service Photos</DialogTitle>
            <DialogDescription>Upload, remove, or set cover photos for your service</DialogDescription>
          </DialogHeader>
          {managingPhotosServiceId && (
            <ServicePhotosManager
              serviceId={managingPhotosServiceId}
              onClose={() => setManagingPhotosServiceId(null)}
              maxPhotos={mySubscription?.tierConfig?.limits?.maxPhotosPerService || 1}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Portfolio Upload Dialog */}
      <Dialog open={showPortfolioUpload} onOpenChange={(open) => {
        setShowPortfolioUpload(open);
        if (!open) {
          setPortfolioMediaType("image");
          setPortfolioBeforeUrl("");
          setPortfolioAfterUrl("");
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Work Sample</DialogTitle>
            <DialogDescription>Upload photos showcasing your work</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Type Toggle */}
            <div>
              <Label>Type</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                <Button
                  type="button"
                  variant={portfolioMediaType === "image" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPortfolioMediaType("image")}
                >
                  Single Photo
                </Button>
                <Button
                  type="button"
                  variant={portfolioMediaType === "before_after" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPortfolioMediaType("before_after")}
                >
                  Before & After
                </Button>
              </div>
            </div>

            <div>
              <Label>Category (optional)</Label>
              <select
                className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={portfolioUploadCategory || ""}
                onChange={(e) => setPortfolioUploadCategory(e.target.value ? Number(e.target.value) : undefined)}
              >
                <option value="">General</option>
                {myCategories?.map((pc: any) => (
                  <option key={pc.categoryId} value={pc.categoryId}>
                    {pc.category?.name?.split(" ").map((w: string) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Title (optional)</Label>
              <Input value={portfolioTitle} onChange={(e) => setPortfolioTitle(e.target.value)} placeholder="e.g., Kitchen Renovation" />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea value={portfolioDescription} onChange={(e) => setPortfolioDescription(e.target.value)} placeholder="Brief description of this work" rows={2} />
            </div>

            {portfolioMediaType === "image" ? (
              /* Single Photo Upload */
              <div>
                <Label>Photo</Label>
                <input
                  type="file"
                  accept="image/*"
                  className="mt-1 w-full text-sm"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 10 * 1024 * 1024) { toast.error("File must be under 10MB"); return; }
                    const reader = new FileReader();
                    reader.onload = async () => {
                      const base64 = (reader.result as string).split(",")[1];
                      try {
                        const { url } = await uploadPortfolioPhoto.mutateAsync({ base64, mimeType: file.type, fileName: file.name });
                        await addPortfolioItem.mutateAsync({
                          imageUrl: url,
                          categoryId: portfolioUploadCategory,
                          title: portfolioTitle || undefined,
                          description: portfolioDescription || undefined,
                          mediaType: "image",
                        });
                      } catch (err: any) { toast.error(err.message || "Upload failed"); }
                    };
                    reader.readAsDataURL(file);
                  }}
                />
              </div>
            ) : (
              /* Before & After Upload */
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Before Photo */}
                  <div>
                    <Label className="text-sm">Before Photo</Label>
                    {portfolioBeforeUrl ? (
                      <div className="relative mt-1">
                        <img src={portfolioBeforeUrl} alt="Before" className="w-full h-32 object-cover rounded-md border" />
                        <button
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                          onClick={() => setPortfolioBeforeUrl("")}
                        >&times;</button>
                      </div>
                    ) : (
                      <input
                        type="file"
                        accept="image/*"
                        className="mt-1 w-full text-xs"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 10 * 1024 * 1024) { toast.error("File must be under 10MB"); return; }
                          const reader = new FileReader();
                          reader.onload = async () => {
                            const base64 = (reader.result as string).split(",")[1];
                            try {
                              const { url } = await uploadPortfolioPhoto.mutateAsync({ base64, mimeType: file.type, fileName: file.name });
                              setPortfolioBeforeUrl(url);
                            } catch (err: any) { toast.error(err.message || "Upload failed"); }
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    )}
                  </div>
                  {/* After Photo */}
                  <div>
                    <Label className="text-sm">After Photo</Label>
                    {portfolioAfterUrl ? (
                      <div className="relative mt-1">
                        <img src={portfolioAfterUrl} alt="After" className="w-full h-32 object-cover rounded-md border" />
                        <button
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                          onClick={() => setPortfolioAfterUrl("")}
                        >&times;</button>
                      </div>
                    ) : (
                      <input
                        type="file"
                        accept="image/*"
                        className="mt-1 w-full text-xs"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 10 * 1024 * 1024) { toast.error("File must be under 10MB"); return; }
                          const reader = new FileReader();
                          reader.onload = async () => {
                            const base64 = (reader.result as string).split(",")[1];
                            try {
                              const { url } = await uploadPortfolioPhoto.mutateAsync({ base64, mimeType: file.type, fileName: file.name });
                              setPortfolioAfterUrl(url);
                            } catch (err: any) { toast.error(err.message || "Upload failed"); }
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    )}
                  </div>
                </div>
                {portfolioBeforeUrl && portfolioAfterUrl && (
                  <Button
                    className="w-full"
                    onClick={async () => {
                      try {
                        await addPortfolioItem.mutateAsync({
                          imageUrl: portfolioAfterUrl,
                          beforeImageUrl: portfolioBeforeUrl,
                          categoryId: portfolioUploadCategory,
                          title: portfolioTitle || undefined,
                          description: portfolioDescription || undefined,
                          mediaType: "before_after",
                        });
                      } catch (err: any) { toast.error(err.message || "Save failed"); }
                    }}
                    disabled={addPortfolioItem.isPending}
                  >
                    {addPortfolioItem.isPending ? "Saving..." : "Save Before & After"}
                  </Button>
                )}
              </div>
            )}

            {(uploadPortfolioPhoto.isPending || addPortfolioItem.isPending) && (
              <p className="text-sm text-muted-foreground">Uploading...</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Service Confirmation */}
      <Dialog open={!!deletingServiceId} onOpenChange={() => setDeletingServiceId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Service</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this service? This action cannot be undone. Existing bookings for this service will not be affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingServiceId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deletingServiceId && deleteService.mutate({ id: deletingServiceId })} disabled={deleteService.isPending}>
              {deleteService.isPending ? "Deleting..." : "Delete Service"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Booking Confirmation */}
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
            <Button variant="destructive" onClick={() => deletingBookingId && deleteBooking.mutate({ id: deletingBookingId })} disabled={deleteBooking.isPending}>
              {deleteBooking.isPending ? "Removing..." : "Remove Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Package Creation Dialog */}
      <Dialog open={showPackageDialog} onOpenChange={(open) => {
        if (!open) {
          setShowPackageDialog(false);
          setPackageName("");
          setPackageDescription("");
          setPackagePrice("");
          setPackageServiceIds([]);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Service Package</DialogTitle>
            <DialogDescription>Bundle multiple services together with a combined price</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Package Name</Label>
              <Input
                placeholder="e.g., Full Event Package"
                value={packageName}
                onChange={(e) => setPackageName(e.target.value)}
              />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input
                placeholder="e.g., DJ + Photography + AV Setup for your event"
                value={packageDescription}
                onChange={(e) => setPackageDescription(e.target.value)}
              />
            </div>
            <div>
              <Label>Package Price ($)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="99.99"
                value={packagePrice}
                onChange={(e) => setPackagePrice(e.target.value)}
              />
              {services && packageServiceIds.length > 0 && (() => {
                const total = services
                  .filter((s: any) => packageServiceIds.includes(s.id))
                  .reduce((sum: number, s: any) => sum + Number(s.price || 0), 0);
                const savings = total - Number(packagePrice || 0);
                return total > 0 ? (
                  <p className="text-xs text-muted-foreground mt-1">
                    Individual total: {formatPrice(total)}
                    {savings > 0 && <span className="text-green-600 ml-1">(Customer saves {formatPrice(savings)})</span>}
                  </p>
                ) : null;
              })()}
            </div>
            <div>
              <Label>Select Services to Bundle</Label>
              <div className="mt-2 max-h-48 overflow-y-auto space-y-2 border rounded-lg p-3">
                {services && services.length > 0 ? services.map((service: any) => (
                  <label key={service.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1.5 rounded">
                    <input
                      type="checkbox"
                      checked={packageServiceIds.includes(service.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setPackageServiceIds([...packageServiceIds, service.id]);
                        } else {
                          setPackageServiceIds(packageServiceIds.filter(id => id !== service.id));
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm flex-1">{service.name}</span>
                    <span className="text-xs text-muted-foreground">{formatPrice(Number(service.price || 0))}</span>
                  </label>
                )) : (
                  <p className="text-sm text-muted-foreground text-center py-2">No services available. Add services first.</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPackageDialog(false)}>Cancel</Button>
            <Button
              disabled={!packageName || !packagePrice || packageServiceIds.length < 2}
              onClick={() => {
                const originalPrice = services
                  ? services
                      .filter((s: any) => packageServiceIds.includes(s.id))
                      .reduce((sum: number, s: any) => sum + Number(s.price || 0), 0)
                  : 0;
                createPackage.mutate({
                  name: packageName,
                  description: packageDescription || undefined,
                  packagePrice: packagePrice,
                  originalPrice: originalPrice.toString(),
                  serviceIds: packageServiceIds,
                });
              }}
            >
              Create Package
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Conflict Warning Dialog */}
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

      {/* Respond to Quote Dialog */}
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

      {/* Upgrade Prompt Dialog */}
      <UpgradePrompt
        open={showUpgradePrompt}
        onClose={() => setShowUpgradePrompt(false)}
        reason={upgradeReason}
        currentTier={currentTier}
        currentCount={upgradeReason === "service_limit" ? serviceCount : undefined}
        currentLimit={upgradeReason === "service_limit" ? serviceLimit : undefined}
      />
    </div>
  );
}


// ============================================================================
// CALENDAR SYNC SECTION
// ============================================================================

// ============================================================================
// ONBOARDING CHECKLIST WIDGET
// ============================================================================
function OnboardingChecklist({
  provider,
  services,
  myCategories,
  portfolio,
  connectStatus,
  onEditProfile,
  onUploadPhoto,
  onUploadPortfolio,
}: {
  provider: any;
  services: any[] | undefined;
  myCategories: any[] | undefined;
  portfolio: any[] | undefined;
  connectStatus: any;
  onEditProfile?: () => void;
  onUploadPhoto?: () => void;
  onUploadPortfolio?: () => void;
}) {
  const { data: stripeStatus } = trpc.stripeConnect.getStatus.useQuery();
  const { data: mySchedule } = trpc.availability.getMySchedule.useQuery();
  const [, setLocation] = useLocation();
  const [dismissed, setDismissed] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  const steps = useMemo(() => {
    const hasPhoto = !!provider.profilePhotoUrl;
    const hasBio = !!provider.description && provider.description.length > 10;
    const hasCategories = (myCategories?.length || 0) > 0;
    const hasServices = (services?.length || 0) > 0;
    const hasPortfolio = (portfolio?.length || 0) > 0;
    const hasStripe = stripeStatus?.paymentCollectionEnabled;
    const hasAvailability = (mySchedule?.length || 0) > 0;

    return [
      {
        id: "photo",
        label: "Add a profile photo",
        description: "Help customers recognize you",
        done: hasPhoto,
        action: () => onUploadPhoto ? onUploadPhoto() : setLocation("/account"),
        actionLabel: "Add Photo",
        priority: 1,
      },
      {
        id: "bio",
        label: "Write your bio / description",
        description: "Tell customers about your experience",
        done: hasBio,
        action: () => onEditProfile ? onEditProfile() : setLocation("/provider/onboarding"),
        actionLabel: "Write Bio",
        priority: 2,
      },
      {
        id: "categories",
        label: "Select service categories",
        description: "Choose the types of services you offer",
        done: hasCategories,
        action: () => setLocation("/provider/onboarding"),
        actionLabel: "Select Categories",
        priority: 3,
      },
      {
        id: "services",
        label: "Add at least one service",
        description: "Create a service with pricing so customers can book",
        done: hasServices,
        action: () => setLocation("/provider/services/new"),
        actionLabel: "Add Service",
        priority: 4,
      },
      {
        id: "availability",
        label: "Set your availability",
        description: "Let customers know when you're available",
        done: hasAvailability,
        action: () => setLocation("/provider/availability"),
        actionLabel: "Set Schedule",
        priority: 5,
      },
      {
        id: "portfolio",
        label: "Upload work samples",
        description: "Showcase your best work to attract customers",
        done: hasPortfolio,
        action: () => onUploadPortfolio ? onUploadPortfolio() : setLocation("/provider/onboarding"),
        actionLabel: "Upload",
        priority: 6,
      },
      {
        id: "stripe",
        label: "Connect payment account",
        description: "Set up Stripe to receive payments",
        done: !!hasStripe,
        action: () => setLocation("/provider/onboarding?step=4"),
        actionLabel: "Connect Stripe",
        priority: 7,
      },
    ];
  }, [provider, services, myCategories, portfolio, stripeStatus, mySchedule, setLocation, onEditProfile, onUploadPhoto, onUploadPortfolio]);

  const completedCount = steps.filter((s: any) => s.done).length;
  const totalSteps = steps.length;
  const allDone = completedCount === totalSteps;
  const progress = Math.round((completedCount / totalSteps) * 100);

  // Find the next incomplete step for the "What's Next" nudge
  const nextStep = useMemo(() => {
    return steps.find(s => !s.done);
  }, [steps]);

  // Show celebration when all done
  useMemo(() => {
    if (allDone && !dismissed) {
      setShowCelebration(true);
    }
  }, [allDone]);

  if (dismissed && !showCelebration) return null;

  // Celebration state when all steps complete
  if (allDone && showCelebration) {
    return (
      <Card className="mb-8 border-green-500/30 bg-gradient-to-r from-green-500/5 via-emerald-500/5 to-teal-500/5">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center">
              <Sparkles className="h-7 w-7 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-green-700 dark:text-green-400">Profile Complete!</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Your profile is fully set up and ready to receive bookings. Customers can now find and book your services.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setShowCelebration(false); setDismissed(true); }}
              className="text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (dismissed) return null;

  return (
    <Card className="mb-8 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Circular progress indicator */}
            <div className="relative flex-shrink-0">
              <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-muted" />
                <circle
                  cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="2.5"
                  className="text-primary transition-all duration-700"
                  strokeDasharray={`${progress * 0.974} 100`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-primary">
                {progress}%
              </span>
            </div>
            <div>
              <CardTitle className="text-lg">
                Complete Your Profile
              </CardTitle>
              <CardDescription className="mt-0.5">
                {completedCount} of {totalSteps} steps done
              </CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setDismissed(true)} className="text-muted-foreground">
            <X className="h-4 w-4" />
          </Button>
        </div>
        {/* Linear progress bar */}
        <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* "What's Next" nudge for the next incomplete step */}
        {nextStep && (
          <div
            className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20 cursor-pointer hover:bg-primary/10 transition-colors"
            onClick={() => nextStep.action()}
          >
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <ArrowRight className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-primary">Next: {nextStep.label}</p>
              <p className="text-xs text-muted-foreground">{nextStep.description}</p>
            </div>
            <Button size="sm" className="h-7 text-xs shrink-0">
              {nextStep.actionLabel}
            </Button>
          </div>
        )}

        {/* All steps grid — exclude the "next" step since it's already highlighted above */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
          {steps.filter((s: any) => s !== nextStep).map((step: any, idx: number) => (
            <div
              key={step.id}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                step.done
                  ? "bg-muted/30 border-transparent"
                  : step === nextStep
                  ? "bg-primary/5 border-primary/20 cursor-pointer hover:border-primary/40"
                  : "bg-background border-border hover:border-primary/30 cursor-pointer"
              }`}
              onClick={() => !step.done && step.action()}
            >
              <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                step.done ? "bg-green-500/20 text-green-600" : "bg-muted text-muted-foreground"
              }`}>
                {step.done ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <span className="text-xs font-medium">{idx + 1}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${step.done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  {step.label}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">{step.description}</p>
              </div>
              {!step.done && (
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// BEFORE/AFTER COMPARISON CARD
// ============================================================================
function BeforeAfterCard({ beforeUrl, afterUrl }: { beforeUrl: string; afterUrl: string }) {
  const [sliderPos, setSliderPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setSliderPos((x / rect.width) * 100);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full cursor-col-resize select-none overflow-hidden"
      onMouseMove={(e) => { if (e.buttons === 1) handleMove(e.clientX); }}
      onTouchMove={(e) => handleMove(e.touches[0].clientX)}
    >
      {/* After image (full) */}
      <img src={afterUrl} alt="After" className="absolute inset-0 w-full h-full object-cover" />
      {/* Before image (clipped) */}
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${sliderPos}%` }}>
        <img src={beforeUrl} alt="Before" className="absolute inset-0 w-full h-full object-cover" style={{ minWidth: containerRef.current?.offsetWidth || '100%' }} />
      </div>
      {/* Slider line */}
      <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg" style={{ left: `${sliderPos}%` }}>
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center">
          <span className="text-[10px] text-gray-500">↔</span>
        </div>
      </div>
      {/* Labels */}
      <span className="absolute top-1 left-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded">Before</span>
      <span className="absolute top-1 right-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded">After</span>
    </div>
  );
}

// ============================================================================
// PORTFOLIO GALLERY (inside dashboard)
// ============================================================================
function PortfolioGallery({ categories }: { categories: any[] | undefined }) {
  const { data: portfolio } = trpc.provider.getPortfolio.useQuery();
  const utils = trpc.useUtils();
  const deleteItem = trpc.provider.deletePortfolioItem.useMutation({
    onSuccess: () => {
      utils.provider.getPortfolio.invalidate();
      toast.success("Removed");
    },
  });

  if (!portfolio || portfolio.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center">
          <ImageIcon className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No portfolio items yet</p>
          <p className="text-xs text-muted-foreground mt-1">Upload photos of your work to attract more customers</p>
        </CardContent>
      </Card>
    );
  }

  // Group by category
  const grouped = new Map<number | null, any[]>();
  for (const item of portfolio) {
    const key = item.categoryId;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(item);
  }

  return (
    <div className="space-y-4">
      {Array.from(grouped.entries()).map(([catId, items]) => {
        const cat = categories?.find((c: any) => c.categoryId === catId)?.category;
        const catName = cat ? cat.name.split(" ").map((w: string) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ") : "General";
        return (
          <div key={catId ?? "general"}>
            <p className="text-sm font-medium mb-2 flex items-center gap-1">
              <span>{catId ? CATEGORY_ICONS[catId] || "\uD83D\uDCE6" : "\uD83D\uDDBC\uFE0F"}</span> {catName}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {items.map((item: any) => (
                <div key={item.id} className="group relative rounded-lg overflow-hidden border bg-card aspect-square">
                  {item.mediaType === "before_after" && item.beforeImageUrl ? (
                    <BeforeAfterCard beforeUrl={item.beforeImageUrl} afterUrl={item.imageUrl} />
                  ) : (
                    <img src={item.imageUrl} alt={item.title || "Portfolio"} className="w-full h-full object-cover" />
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                    {item.mediaType === "before_after" && (
                      <Badge className="absolute top-1 left-1 text-[9px] bg-blue-500">Before & After</Badge>
                    )}
                    {item.title && <p className="text-white text-xs font-medium truncate">{item.title}</p>}
                    {item.description && <p className="text-white/70 text-[10px] truncate">{item.description}</p>}
                    <button
                      className="absolute top-1 right-1 bg-red-500/80 hover:bg-red-600 text-white rounded-full p-1"
                      onClick={() => deleteItem.mutate({ id: item.id })}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PackagesList() {
  const { data: packages, isLoading } = trpc.provider.myPackages.useQuery();
  const utils = trpc.useUtils();
  const deletePackage = trpc.provider.deletePackage.useMutation({
    onSuccess: () => {
      utils.provider.myPackages.invalidate();
      toast.success("Package deleted");
    },
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading packages...</div>;
  }

  if (!packages || packages.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center">
          <Package className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No packages yet. Bundle your services to offer discounts!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {packages.map((pkg: any) => {
        const discount = pkg.originalPrice && pkg.price
          ? Math.round((1 - Number(pkg.price) / Number(pkg.originalPrice)) * 100)
          : 0;
        return (
          <Card key={pkg.id} className="relative">
            {discount > 0 && (
              <Badge className="absolute top-3 right-3 bg-green-500 text-white">
                {discount}% off
              </Badge>
            )}
            <CardContent className="p-4">
              <h4 className="font-semibold">{pkg.name}</h4>
              {pkg.description && <p className="text-sm text-muted-foreground mt-1">{pkg.description}</p>}
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-lg font-bold text-primary">{formatPrice(Number(pkg.price))}</span>
                {pkg.originalPrice && Number(pkg.originalPrice) > Number(pkg.price) && (
                  <span className="text-sm text-muted-foreground line-through">{formatPrice(Number(pkg.originalPrice))}</span>
                )}
              </div>
              {pkg.services && pkg.services.length > 0 && (
                <div className="mt-2 space-y-1">
                  {pkg.services.map((svc: any, i: number) => (
                    <div key={i} className="text-xs text-muted-foreground flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                      {svc.serviceName}
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3 pt-2 border-t">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-destructive"
                  onClick={() => deletePackage.mutate({ packageId: pkg.id })}
                  disabled={deletePackage.isPending}
                >
                  <Trash2 className="h-3 w-3 mr-1" /> Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function CalendarSyncSection() {
  const { data: calendarData, isLoading } = trpc.provider.getCalendarFeedUrl.useQuery();
  const [copied, setCopied] = useState(false);

  const copyFeedUrl = () => {
    if (calendarData?.feedUrl) {
      navigator.clipboard.writeText(calendarData.feedUrl);
      setCopied(true);
      toast.success("Calendar feed URL copied!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading calendar settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Calendar Sync</h2>
        <p className="text-muted-foreground mt-1">
          Sync your OlogyCrew bookings with Google Calendar, Apple Calendar, or Outlook to avoid double-bookings
        </p>
      </div>

      {/* Feed URL Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-primary" />
            Your Calendar Feed URL
          </CardTitle>
          <CardDescription>
            Subscribe to this URL in any calendar app to automatically sync your bookings. Updates every 15 minutes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={calendarData?.feedUrl || ""}
              className="font-mono text-xs"
            />
            <Button variant="outline" size="icon" onClick={copyFeedUrl}>
              <Clipboard className={`h-4 w-4 ${copied ? "text-green-600" : ""}`} />
            </Button>
          </div>
          {/* One-click subscribe buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                if (calendarData?.feedUrl) {
                  const webcalUrl = calendarData.feedUrl.replace(/^https?:\/\//, "webcal://");
                  window.location.href = webcalUrl;
                  toast.success("Opening calendar app...");
                }
              }}
            >
              <CalendarPlus className="h-4 w-4 mr-2" />
              Subscribe with Calendar App
            </Button>
            {calendarData?.googleCalUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(calendarData.googleCalUrl, "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Add to Google Calendar
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            This URL is private — only share it with calendar apps you trust. It includes all your confirmed, pending, and completed bookings.
          </p>
        </CardContent>
      </Card>

      {/* Setup Instructions */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Google Calendar */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Calendar className="h-4 w-4 text-blue-600" />
              </div>
              Google Calendar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
              <li>Open Google Calendar</li>
              <li>Click "+" next to "Other calendars"</li>
              <li>Select "From URL"</li>
              <li>Paste your feed URL</li>
              <li>Click "Add calendar"</li>
            </ol>
            {calendarData?.googleCalUrl && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => window.open(calendarData.googleCalUrl, "_blank")}
              >
                <ExternalLink className="h-3 w-3 mr-2" />
                Add to Google Calendar
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Apple Calendar */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <Calendar className="h-4 w-4 text-gray-600" />
              </div>
              Apple Calendar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
              <li>Open Calendar app</li>
              <li>Go to File → New Calendar Subscription</li>
              <li>Paste your feed URL</li>
              <li>Set auto-refresh to "Every 15 minutes"</li>
              <li>Click "Subscribe"</li>
            </ol>
          </CardContent>
        </Card>

        {/* Outlook */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                <Calendar className="h-4 w-4 text-indigo-600" />
              </div>
              Outlook
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
              <li>Open Outlook Calendar</li>
              <li>Click "Add calendar"</li>
              <li>Select "Subscribe from web"</li>
              <li>Paste your feed URL</li>
              <li>Click "Import"</li>
            </ol>
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card className="bg-muted/50 border-dashed">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>How it works:</strong> Your calendar app will periodically check this URL for updates (usually every 15-60 minutes depending on the app).</p>
              <p>New bookings, cancellations, and status changes will automatically appear in your synced calendar. Each booking includes the service name, customer name, location, and amount.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
