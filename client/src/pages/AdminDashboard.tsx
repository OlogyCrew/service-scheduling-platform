import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { formatPrice } from "@shared/formatPrice";
import { useProtectedPage } from "@/hooks/useProtectedPage";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { toast } from "sonner";
import { 
  Users, 
  Briefcase, 
  DollarSign, 
  TrendingUp, 
  CheckCircle, 
  XCircle,
  Ban,
  Undo2,
  Crown,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Percent,
  UserPlus,
  UserMinus,
  Star,
  Flag,
  Eye,
  EyeOff,
  Trash2,
  FileText,
  Shield,
  RefreshCw,
  ShieldCheck,
  MessageSquare,
  Send,
  Clock,
  Mail,
  MailCheck,
  Plus,
  Pencil,
  Copy,
  Inbox,
  AlertCircle,
  CheckCircle2,
  Archive,
  Zap,
  Search,
  Download,
  Bell,
  Smartphone,
  Wifi,
  WifiOff,
  Activity,
  Calendar,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Share2,
  Settings,
  ChevronRight,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Link, useSearch, useLocation } from "wouter";
import AdminSocialMedia from "./AdminSocialMedia";
import { AdminTermsManagement } from "./admin/AdminTermsManagement";
import { formatCurrency, formatDate } from "@/lib/dateUtils";
import { formatTimeForDisplay } from "@shared/timeSlots";
import { NavHeader } from "@/components/shared/NavHeader";
import { TeamManagementPanel } from "./admin/TeamManagementPanel";
import { AuditLogPanel } from "./admin/AuditLogPanel";
import { CustomersPilotHealthPanel } from "./admin/CustomersPilotHealthPanel";
import { AdminNavigation } from "./admin/AdminNavigation";
import { getAdminSectionLabel, resolveAdminSection } from "./admin/adminNavigation";
import { AdminBookingsPanel } from "./admin/AdminBookingsPanel";
import "./admin/AdminWorkspace.css";

function SystemHealthOverview() {
  const { data, isLoading, refetch, isFetching } = trpc.admin.getSystemHealth.useQuery(undefined, {
    refetchInterval: 60_000,
    retry: 1,
  });

  if (isLoading || !data) {
    return <Card className="mb-6"><CardContent className="p-5 text-sm text-muted-foreground">Checking platform health…</CardContent></Card>;
  }

  const healthItems = [
    { label: "Database", ready: data.database.ready, detail: data.database.ready ? `${data.database.latencyMs} ms response` : data.database.error || "Unavailable", icon: Activity },
    { label: "Payments", ready: data.integrations.payments, detail: data.integrations.payments ? "Stripe configured" : "Configuration required", icon: DollarSign },
    { label: "Email", ready: data.integrations.email, detail: data.integrations.email ? "SendGrid configured" : "Configuration required", icon: Mail },
    { label: "Realtime", ready: data.realtime.ready, detail: `${data.realtime.connectedClients} connected · ${data.realtime.transport}`, icon: Wifi },
  ];

  return (
    <Card className={`mb-6 border-l-4 ${data.status === "healthy" ? "border-l-emerald-500" : "border-l-amber-500"}`}>
      <CardHeader className="pb-3">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg"><Activity className="h-5 w-5" />System Health</CardTitle>
            <CardDescription>
              {data.status === "healthy" ? "Critical services are ready" : "One or more critical services need attention"}
              {` · ${Math.floor(data.uptimeSeconds / 3600)}h uptime · ${data.memory.heapUsedMb} MB heap`}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <details className="ology-admin-health-details" open={data.status !== "healthy" ? true : undefined}>
        <summary className="ology-admin-health-summary">Integration details</summary>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {healthItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-xl border bg-muted/20 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-medium">{item.label}</span></div>
                  <span className={`h-2.5 w-2.5 rounded-full ${item.ready ? "bg-emerald-500" : "bg-amber-500"}`} aria-label={item.ready ? `${item.label} ready` : `${item.label} needs attention`} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{item.detail}</p>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-right text-[11px] text-muted-foreground">Checked {new Date(data.checkedAt).toLocaleTimeString()}</p>
        </details>
      </CardContent>
    </Card>
  );
}

function SubscriptionAnalyticsPanel() {
  const { data: analytics, isLoading } = trpc.admin.getSubscriptionAnalytics.useQuery();
  const [selectedTierGroup, setSelectedTierGroup] = useState<"free" | "basic" | "premium" | "trialing" | null>(null);
  const tierMembers = trpc.admin.getSubscriptionTierMembers.useQuery(
    { group: selectedTierGroup ?? "free" },
    { enabled: selectedTierGroup !== null },
  );

  if (isLoading) return <LoadingSpinner message="Loading analytics..." />;
  if (!analytics) return null;

  const totalTierCount = analytics.tiers.free + analytics.tiers.basic + analytics.tiers.premium;
  const basicPct = totalTierCount > 0 ? (analytics.tiers.basic / totalTierCount) * 100 : 0;
  const premiumPct = totalTierCount > 0 ? (analytics.tiers.premium / totalTierCount) * 100 : 0;
  const freePct = totalTierCount > 0 ? (analytics.tiers.free / totalTierCount) * 100 : 0;
  const tierDetails = {
    free: { title: "Starter providers", description: "Providers whose current effective access is Starter.", count: analytics.tiers.free },
    basic: { title: "Pro providers", description: "Providers whose current effective access is Pro.", count: analytics.tiers.basic },
    premium: { title: "Business providers", description: "Providers whose current effective access is Business.", count: analytics.tiers.premium },
    trialing: { title: "Currently trialing providers", description: "Providers in an active trial. They also appear in their effective Pro or Business tier.", count: analytics.tiers.trialing },
  } as const;
  const selectedTierDetails = selectedTierGroup ? tierDetails[selectedTierGroup] : null;
  const tierName = (tier: "free" | "basic" | "premium") => ({ free: "Starter", basic: "Pro", premium: "Business" })[tier];
  const lifecycleLabel = (state: string) => ({
    free: "Starter access",
    active: "Active",
    trialing: "Trial active",
    cancelling: "Cancels at period end",
    past_due_grace: "Past due — grace period",
    trial_expired: "Trial expired",
    past_due_suspended: "Past due — access suspended",
    paused: "Paused",
    incomplete: "Setup incomplete",
    cancelled: "Cancelled",
  }[state] ?? state.replaceAll("_", " "));
  const lifecycleClassName = (state: string) => {
    if (state === "active") return "border-emerald-200 bg-emerald-50 text-emerald-800";
    if (state === "trialing") return "border-amber-200 bg-amber-50 text-amber-800";
    if (state === "free") return "border-slate-200 bg-slate-50 text-slate-700";
    return "border-orange-200 bg-orange-50 text-orange-800";
  };

  return (
    <div className="space-y-6">
      {/* MRR and Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Monthly Recurring Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(analytics.mrr)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {analytics.payingSubscribers} revenue-generating subscription{analytics.payingSubscribers !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Paid-Plan Access</CardTitle>
            <Crown className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.activeSubscribers}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {analytics.providerActiveSubscribers} provider · {analytics.customerActiveSubscribers} customer
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Churn Rate</CardTitle>
            {analytics.churnRate > 5 ? (
              <ArrowUpRight className="h-4 w-4 text-red-500" />
            ) : (
              <ArrowDownRight className="h-4 w-4 text-green-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${analytics.churnRate > 5 ? 'text-red-600' : 'text-green-600'}`}>
              {analytics.churnRate}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {analytics.cancelledThisMonth} cancelled this month
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">New This Month</CardTitle>
            <UserPlus className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{analytics.newThisMonth}</div>
            <p className="text-xs text-muted-foreground mt-1">
              new subscriptions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tier Distribution and Conversion */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tier Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Tier Distribution
            </CardTitle>
            <CardDescription>Effective provider access after lifecycle rules</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Visual bar chart */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setSelectedTierGroup("free")}
                className="group block w-full rounded-lg p-2 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-haspopup="dialog"
                aria-label={`View ${analytics.tiers.free} Starter providers`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1 text-sm font-medium group-hover:underline">Starter (Free)<ChevronRight className="h-3.5 w-3.5" /></span>
                  <span className="text-sm text-muted-foreground">{analytics.tiers.free} ({freePct.toFixed(0)}%)</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-gray-400 rounded-full transition-all" style={{ width: `${freePct}%` }} />
                </div>
              </button>
              <button
                type="button"
                onClick={() => setSelectedTierGroup("basic")}
                className="group block w-full rounded-lg p-2 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-haspopup="dialog"
                aria-label={`View ${analytics.tiers.basic} Pro providers`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1 text-sm font-medium group-hover:underline">Pro ($12/mo)<ChevronRight className="h-3.5 w-3.5" /></span>
                  <span className="text-sm text-muted-foreground">{analytics.tiers.basic} ({basicPct.toFixed(0)}%)</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${basicPct}%` }} />
                </div>
              </button>
              <button
                type="button"
                onClick={() => setSelectedTierGroup("premium")}
                className="group block w-full rounded-lg p-2 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-haspopup="dialog"
                aria-label={`View ${analytics.tiers.premium} Business providers`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1 text-sm font-medium group-hover:underline">Business ($20/mo)<ChevronRight className="h-3.5 w-3.5" /></span>
                  <span className="text-sm text-muted-foreground">{analytics.tiers.premium} ({premiumPct.toFixed(0)}%)</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${premiumPct}%` }} />
                </div>
              </button>
              {analytics.tiers.trialing > 0 && (
                <div className="pt-2 border-t">
                  <button
                    type="button"
                    onClick={() => setSelectedTierGroup("trialing")}
                    className="group flex w-full items-center justify-between rounded-lg p-2 text-left transition-colors hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
                    aria-haspopup="dialog"
                    aria-label={`View ${analytics.tiers.trialing} trialing providers`}
                  >
                    <span className="flex items-center gap-1 text-sm font-medium text-amber-700 group-hover:underline">Currently Trialing<ChevronRight className="h-3.5 w-3.5" /></span>
                    <span className="text-sm text-amber-700">{analytics.tiers.trialing}</span>
                  </button>
                </div>
              )}
              <p className="px-2 text-xs text-muted-foreground">Select a tier to see its providers.</p>
            </div>
          </CardContent>
        </Card>

        {/* Conversion Rates */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5" />
              Conversion Rates
            </CardTitle>
            <CardDescription>How providers move between tiers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-gray-400" />
                    <span className="text-sm">Starter</span>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                    <div className="h-3 w-3 rounded-full bg-blue-500" />
                    <span className="text-sm">Pro</span>
                  </div>
                </div>
                <div className="text-3xl font-bold">{analytics.conversionRates.freeToBasic}%</div>
                <p className="text-xs text-muted-foreground mt-1">of all providers have upgraded to Pro or higher</p>
              </div>

              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-blue-500" />
                    <span className="text-sm">Pro</span>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                    <div className="h-3 w-3 rounded-full bg-purple-500" />
                    <span className="text-sm">Business</span>
                  </div>
                </div>
                <div className="text-3xl font-bold">{analytics.conversionRates.basicToPremium}%</div>
                <p className="text-xs text-muted-foreground mt-1">of paid subscribers have upgraded to Business</p>
              </div>
            </div>

            <div className="p-3 rounded-lg border border-dashed">
              <p className="text-xs text-muted-foreground text-center">
                Revenue per provider: {analytics.totalProviders > 0 ? formatCurrency(analytics.mrr / analytics.totalProviders) : '$0.00'}/mo avg
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={selectedTierGroup !== null} onOpenChange={(open) => { if (!open) setSelectedTierGroup(null); }}>
        <DialogContent className="flex max-h-[85vh] w-[calc(100%-2rem)] max-w-2xl flex-col overflow-hidden p-0 sm:w-full">
          <DialogHeader className="px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {selectedTierDetails?.title ?? "Tier providers"}
            </DialogTitle>
            <DialogDescription>
              {selectedTierDetails?.description} {selectedTierDetails ? `${selectedTierDetails.count} provider${selectedTierDetails.count === 1 ? "" : "s"} in the dashboard total.` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 overflow-y-auto border-t px-4 py-4 sm:px-6">
            {tierMembers.isLoading ? (
              <div className="flex min-h-40 items-center justify-center"><LoadingSpinner message="Loading providers..." /></div>
            ) : tierMembers.isError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
                <p className="text-sm font-medium text-red-900">We couldn’t load this tier.</p>
                <p className="mt-1 text-xs text-red-700">{tierMembers.error.message}</p>
                <Button variant="outline" size="sm" className="mt-3 bg-white" onClick={() => tierMembers.refetch()}>
                  <RefreshCw className="mr-2 h-4 w-4" />Retry
                </Button>
              </div>
            ) : tierMembers.data?.members.length ? (
              <div className="space-y-3">
                {tierMembers.data.members.map((member) => {
                  const accountName = [member.firstName, member.lastName].filter(Boolean).join(" ") || member.userName || "Unnamed account";
                  const location = [member.city, member.state].filter(Boolean).join(", ");
                  const initials = (member.businessName || accountName).split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
                  return (
                    <div key={member.providerId} className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarImage src={member.profilePhotoUrl ?? undefined} alt="" />
                          <AvatarFallback className="bg-muted text-xs font-semibold">{initials || "P"}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <p className="truncate font-semibold">{member.businessName}</p>
                              <p className="truncate text-sm text-muted-foreground">{accountName}{member.email ? ` · ${member.email}` : ""}</p>
                              {location && <p className="mt-1 text-xs text-muted-foreground">{location}</p>}
                            </div>
                            <Badge variant="outline" className={`w-fit shrink-0 ${lifecycleClassName(member.lifecycleState)}`}>
                              {lifecycleLabel(member.lifecycleState)}
                            </Badge>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span>Effective: <strong className="font-medium text-foreground">{tierName(member.effectiveTier)}</strong></span>
                            {member.configuredTier !== member.effectiveTier && (
                              <span>Configured: <strong className="font-medium text-foreground">{tierName(member.configuredTier)}</strong></span>
                            )}
                            {member.accessEndsAt && <span>Access ends {new Date(member.accessEndsAt).toLocaleDateString()}</span>}
                            {member.requiresBillingAction && <span className="font-medium text-orange-700">Billing action needed</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 p-6 text-center">
                <Users className="h-8 w-8 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">No providers in this group</p>
                <p className="mt-1 text-xs text-muted-foreground">The list will update automatically when effective access changes.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const searchString = useSearch();
  const urlTab = new URLSearchParams(searchString).get("tab");
  const [activeTab, setActiveTab] = useState(urlTab || "overview");
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  
  useProtectedPage();

  // Bulk trust recalculation
  const [recalculateResult, setRecalculateResult] = useState<{ updated: number } | null>(null);
  const recalculateAllTrust = trpc.trust.recalculateAll.useMutation({
    onSuccess: (data) => {
      setRecalculateResult(data);
      utils.admin.listProviders.invalidate();
      utils.admin.searchProvidersFiltered.invalidate();
      toast.success(`Trust scores recalculated for ${data.updated} providers`);
    },
    onError: (err) => toast.error(err.message),
  });

  const isAdmin = user?.role === "admin";
  const isOwnerAdmin = isAdmin && user?.adminRole === "super_admin";
  const visibleTab = !isOwnerAdmin && ["partner", "team", "legal", "customers-pilot"].includes(activeTab) ? "overview" : resolveAdminSection(activeTab, isOwnerAdmin);
  useEffect(() => { setActiveTab(resolveAdminSection(urlTab, isOwnerAdmin)); }, [urlTab, isOwnerAdmin]);
  const selectSection = (section: string) => {
    const next = resolveAdminSection(section, isOwnerAdmin);
    setActiveTab(next);
    navigate(`/admin?tab=${next}`);
  };
  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } = trpc.admin.getStats.useQuery(undefined, { enabled: isAdmin && visibleTab === "overview" });
  const { data: overviewBookings, isLoading: overviewBookingsLoading } = trpc.admin.searchBookingsFiltered.useQuery({ page: 1, limit: 5 }, { enabled: isAdmin && visibleTab === "overview" });
  const bookings = overviewBookings?.bookings;
  const { data: pendingEvidence } = trpc.verification.listPending.useQuery(undefined, { enabled: isAdmin && visibleTab === "overview" });

  const suspendUser = trpc.admin.suspendUser.useMutation({
    onSuccess: () => {
      utils.admin.listUsers.invalidate();
      utils.admin.searchUsersFiltered.invalidate();
      utils.admin.getStats.invalidate();
      toast.success("User suspended");
    },
    onError: (err) => toast.error(err.message),
  });

  const unsuspendUser = trpc.admin.unsuspendUser.useMutation({
    onSuccess: () => {
      utils.admin.listUsers.invalidate();
      utils.admin.searchUsersFiltered.invalidate();
      toast.success("User unsuspended");
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleProviderActive = trpc.admin.toggleProviderActive.useMutation({
    onSuccess: (_data, variables) => {
      utils.admin.listProviders.invalidate();
      utils.admin.searchProvidersFiltered.invalidate();
      toast.success(variables.isActive ? "Provider activated" : "Provider deactivated");
    },
    onError: (err) => toast.error(err.message),
  });

  if (authLoading) {
    return <LoadingSpinner message="Loading admin dashboard..." />;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You don't have permission to access this page.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button>Go Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="ology-admin">
      <NavHeader />

      <div className="ology-admin-workspace">
        <Tabs value={visibleTab} onValueChange={selectSection} orientation="vertical" activationMode="manual" className="ology-admin-grid">
          <AdminNavigation isOwnerAdmin={isOwnerAdmin} activeSection={visibleTab} />
          <main className="ology-admin-content" aria-labelledby="admin-section-heading">
        <div className="ology-admin-heading">
          <h1 id="admin-section-heading">{visibleTab === "overview" ? "Admin Overview" : getAdminSectionLabel(visibleTab)}</h1>
          <p>Platform management and oversight</p>
          <div className="ology-admin-scope-note">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <p><strong>Real activity view:</strong> official demo and reserved test records are excluded from users, providers, bookings, reviews, subscriptions, and KPI totals.</p>
          </div>
        </div>

          <TabsContent value="overview" aria-labelledby="admin-section-heading">
          {statsLoading ? <LoadingSpinner message="Loading overview..." /> : statsError ? <Card><CardContent className="p-6" role="alert"><p>Overview is unavailable. Please try again.</p><Button variant="outline" className="mt-3" onClick={() => refetchStats()}>Retry overview</Button></CardContent></Card> : <>
        {/* Stats Overview */}
        <div className="ology-admin-metrics">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                +{stats?.newUsersThisMonth || 0} this month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Providers</CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalProviders || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {pendingEvidence?.length || 0} pending evidence review{pendingEvidence?.length === 1 ? "" : "s"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalBookings || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats?.bookingsThisMonth || 0} this month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Platform Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(Number(stats?.totalRevenue || 0))}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(Number(stats?.revenueThisMonth || 0))} this month
              </p>
            </CardContent>
          </Card>
        </div>

            <div className="ology-admin-overview-grid">
              <div className="ology-admin-overview-stack">
              <Card>
                <CardHeader>
                  <CardTitle>Pending Evidence Reviews</CardTitle>
                  <CardDescription>Submitted provider evidence awaiting an admin decision</CardDescription>
                </CardHeader>
                <CardContent>
                  {!pendingEvidence || pendingEvidence.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No pending evidence</p>
                  ) : (
                    <div className="space-y-3">
                      {pendingEvidence.slice(0, 5).map((item: any) => (
                        <div key={item.document.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2 border-b last:border-0">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{item.providerName}</p>
                            <p className="text-xs text-muted-foreground">{item.document.documentLabel || item.document.documentType.replaceAll("_", " ")}</p>
                          </div>
                          <Button size="sm" variant="outline" className="text-xs px-2" onClick={() => selectSection("documents")}>
                            Review evidence
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Bulk Booking Activity
                  </CardTitle>
                  <CardDescription>Event planning drafts and bulk bookings</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-2xl font-bold">{stats?.totalBulkDrafts || 0}</p>
                      <p className="text-xs text-muted-foreground">Total Drafts Saved</p>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-2xl font-bold">{stats?.bulkDraftsThisMonth || 0}</p>
                      <p className="text-xs text-muted-foreground">New This Month</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">Users can save event plans as drafts with multiple providers, timelines, and cost estimates before submitting.</p>
                </CardContent>
              </Card>
              </div>
              <div className="ology-admin-overview-stack">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Bookings</CardTitle>
                  <CardDescription>Latest platform bookings</CardDescription>
                </CardHeader>
                <CardContent>
                  {overviewBookingsLoading ? <p className="text-sm text-muted-foreground py-4">Loading recent bookings…</p> : !bookings ? <p className="text-sm text-muted-foreground py-4">Recent bookings are unavailable.</p> : bookings.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No bookings yet</p>
                  ) : (
                    <div className="space-y-3">
                      {bookings?.slice(0, 5).map((booking: any) => (
                        <div key={booking.id} className="flex flex-col items-start sm:flex-row sm:items-center justify-between gap-2 py-2 border-b last:border-0">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{booking.serviceName || 'Service'}</p>
                            <p className="text-xs text-muted-foreground font-mono break-all">{booking.bookingNumber}</p>
                            <p className="text-xs text-muted-foreground">{booking.bookingDate}</p>
                          </div>
                          <div className="flex shrink-0 self-end sm:self-auto items-center gap-2">
                            <span className="text-sm font-medium">{formatCurrency(parseFloat(booking.totalAmount || "0"))}</span>
                            <Badge variant={
                              booking.status === "completed" ? "default" :
                              booking.status === "confirmed" ? "default" :
                              booking.status === "cancelled" ? "destructive" :
                              "secondary"
                            }>
                              {booking.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              </div>
            </div>
            <div className="ology-admin-overview-health"><SystemHealthOverview /></div>
            </>}
          </TabsContent>

          {/* Subscriptions Tab */}
          <TabsContent value="subscriptions" aria-labelledby="admin-section-heading">
            <SubscriptionAnalyticsPanel />
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" aria-labelledby="admin-section-heading">
            <UsersFilterPanel suspendUser={suspendUser} unsuspendUser={unsuspendUser} />
          </TabsContent>

          {/* Providers Tab */}
          <TabsContent value="providers" aria-labelledby="admin-section-heading">
            {/* Bulk Trust Recalculation Card */}
            <Card className="mb-6 border-amber-200 bg-amber-50/50">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
                <div className="min-w-0">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-amber-600 shrink-0" />
                    Trust Score Management
                  </CardTitle>
                  <CardDescription className="mt-1">Recalculate trust scores for all active providers based on current data</CardDescription>
                </div>
                <Button
                  onClick={() => recalculateAllTrust.mutate()}
                  disabled={recalculateAllTrust.isPending}
                  className="bg-amber-600 hover:bg-amber-700 shrink-0 w-full sm:w-auto text-xs sm:text-sm"
                >
                  {recalculateAllTrust.isPending ? (
                    <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Recalculating...</>
                  ) : (
                    <><RefreshCw className="h-4 w-4 mr-2" />Recalculate All</>
                  )}
                </Button>
              </CardHeader>
              {recalculateResult && (
                <CardContent className="pt-0">
                  <div className="flex items-center gap-2 text-sm text-green-700 bg-green-100 rounded-lg px-3 py-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Successfully recalculated trust scores for {recalculateResult.updated} providers
                  </div>
                </CardContent>
              )}
            </Card>

            <ProvidersFilterPanel toggleProviderActive={toggleProviderActive} />
          </TabsContent>

          {/* Bookings Tab */}
          <TabsContent value="bookings" aria-labelledby="admin-section-heading">
            <AdminBookingsPanel />
          </TabsContent>

          {/* Reviews Moderation Tab */}
          <TabsContent value="reviews" aria-labelledby="admin-section-heading">
            <ReviewModerationPanel />
          </TabsContent>

          {/* Verification Documents Tab */}
          <TabsContent value="documents" aria-labelledby="admin-section-heading">
            <DocumentReviewPanel />
          </TabsContent>

          {/* Support / Contact Submissions Tab */}
          <TabsContent value="support" aria-labelledby="admin-section-heading">
            <ContactSubmissionsPanel />
          </TabsContent>

          <TabsContent value="referrals" aria-labelledby="admin-section-heading">
            <ReferralAnalyticsPanel />
          </TabsContent>

          <TabsContent value="push" aria-labelledby="admin-section-heading">
            <PushAnalyticsPanel />
          </TabsContent>

          {/* Team Management Tab */}
          {isOwnerAdmin ? <TabsContent value="team" aria-labelledby="admin-section-heading">
            <TeamManagementPanel />
          </TabsContent> : null}

          {/* Audit Log Tab */}
          <TabsContent value="audit" aria-labelledby="admin-section-heading">
            <AuditLogPanel />
          </TabsContent>

          {/* Partner Revenue Split Tab */}
          {isOwnerAdmin ? <TabsContent value="partner" aria-labelledby="admin-section-heading">
            <PartnerSplitPanel />
          </TabsContent> : null}

          {/* Social Media Tab */}
          <TabsContent value="social-media" aria-labelledby="admin-section-heading">
            <AdminSocialMedia />
          </TabsContent>

          {isOwnerAdmin ? <TabsContent value="legal" aria-labelledby="admin-section-heading">
            <AdminTermsManagement />
          </TabsContent> : null}

          {user?.adminRole === "super_admin" ? <TabsContent value="customers-pilot" aria-labelledby="admin-section-heading">
            <CustomersPilotHealthPanel />
          </TabsContent> : null}

          {/* Platform Settings Tab */}
          <TabsContent value="settings" aria-labelledby="admin-section-heading">
            <PlatformSettingsPanel />
          </TabsContent>
          </main>
        </Tabs>
      </div>
    </div>
  );
}

// ============================================================================
// REVIEW MODERATION PANEL
// ============================================================================
function ReviewModerationPanel() {
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [reviewSearch, setReviewSearch] = useState("");
  const [flagDialogOpen, setFlagDialogOpen] = useState(false);
  const [selectedReviewId, setSelectedReviewId] = useState<number | null>(null);
  const [flagReason, setFlagReason] = useState("");
  const utils = trpc.useUtils();

  const { data: reviews, isLoading } = trpc.admin.listReviews.useQuery({ flaggedOnly });

  const flagReview = trpc.admin.flagReview.useMutation({
    onSuccess: () => { toast.success("Review flagged"); utils.admin.listReviews.invalidate(); setFlagDialogOpen(false); setFlagReason(""); },
    onError: (e) => toast.error(e.message),
  });
  const unflagReview = trpc.admin.unflagReview.useMutation({
    onSuccess: () => { toast.success("Review unflagged"); utils.admin.listReviews.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const hideReview = trpc.admin.hideReview.useMutation({
    onSuccess: () => { toast.success("Review hidden"); utils.admin.listReviews.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteReview = trpc.admin.deleteReview.useMutation({
    onSuccess: () => { toast.success("Review deleted"); utils.admin.listReviews.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle>Review Moderation</CardTitle>
            <CardDescription>Manage and moderate user reviews</CardDescription>
          </div>
          <Button
            variant={flaggedOnly ? "default" : "outline"}
            size="sm"
            className="w-full sm:w-auto text-xs sm:text-sm"
            onClick={() => setFlaggedOnly(!flaggedOnly)}
          >
            <Flag className="h-4 w-4 mr-1" />
            {flaggedOnly ? "Showing Flagged" : "Show Flagged Only"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Review Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search reviews..."
            value={reviewSearch}
            onChange={(e) => setReviewSearch(e.target.value)}
            className="pl-9 pr-9 text-sm"
          />
          {reviewSearch && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setReviewSearch("")}
            >
              <XCircle className="h-4 w-4" />
            </button>
          )}
        </div>
        {isLoading ? (
          <LoadingSpinner message="Loading reviews..." />
        ) : !reviews || reviews.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">{flaggedOnly ? "No flagged reviews" : "No reviews yet"}</p>
        ) : (
          <div className="space-y-4">
            {reviews.filter((item: any) => {
              if (!reviewSearch.trim()) return true;
              const q = reviewSearch.toLowerCase();
              return (item.customerName || "").toLowerCase().includes(q) ||
                (item.providerName || "").toLowerCase().includes(q) ||
                (item.review.reviewText || "").toLowerCase().includes(q);
            }).map((item: any) => (
              <div key={item.review.id} className={`p-4 rounded-lg border ${item.review.isFlagged ? 'border-red-200 bg-red-50/50' : ''}`}>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1 sm:gap-2 mb-1">
                      <span className="font-medium text-sm">{item.customerName}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="text-xs sm:text-sm text-muted-foreground truncate">{item.providerName}</span>
                    </div>
                    <div className="flex items-center gap-1 mb-1">
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${i < item.review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                        ))}
                      </div>
                      {item.review.isFlagged && (
                        <Badge variant="destructive" className="text-xs ml-1">
                          {item.review.flaggedReason === "HIDDEN_BY_ADMIN" ? "Hidden" : "Flagged"}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{item.review.reviewText || "No text"}</p>
                    {item.review.flaggedReason && item.review.flaggedReason !== "HIDDEN_BY_ADMIN" && (
                      <p className="text-xs text-red-600 mt-1">Flag reason: {item.review.flaggedReason}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">{new Date(item.review.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {!item.review.isFlagged ? (
                      <Button size="sm" variant="ghost" onClick={() => { setSelectedReviewId(item.review.id); setFlagDialogOpen(true); }}>
                        <Flag className="h-4 w-4 text-orange-600" />
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => unflagReview.mutate({ reviewId: item.review.id })}>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => hideReview.mutate({ reviewId: item.review.id })}>
                      <EyeOff className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => {
                      if (confirm("Permanently delete this review?")) deleteReview.mutate({ reviewId: item.review.id });
                    }}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Flag Dialog */}
      <Dialog open={flagDialogOpen} onOpenChange={setFlagDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Flag Review</DialogTitle>
            <DialogDescription>Provide a reason for flagging this review</DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Reason for flagging..."
            value={flagReason}
            onChange={(e) => setFlagReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setFlagDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => selectedReviewId && flagReview.mutate({ reviewId: selectedReviewId, reason: flagReason })}
              disabled={!flagReason.trim()}
            >
              Flag Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============================================================================
// DOCUMENT REVIEW PANEL
// ============================================================================
function DocumentReviewPanel() {
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected" | "revoked">("all");
  const [docSearch, setDocSearch] = useState("");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [reviewAction, setReviewAction] = useState<"reject" | "revoke">("reject");
  const utils = trpc.useUtils();

  const { data: documents, isLoading } = trpc.verification.listAll.useQuery(
    statusFilter !== "all" ? { status: statusFilter } : undefined
  );

  const reviewDoc = trpc.verification.review.useMutation({
    onSuccess: (data) => {
      toast.success(`Evidence ${data.state}`);
      utils.verification.listAll.invalidate();
      setRejectDialogOpen(false);
      setRejectReason("");
    },
    onError: (e) => toast.error(e.message),
  });

  const revokeDoc = trpc.verification.revoke.useMutation({
    onSuccess: () => {
      toast.success("Evidence revoked");
      utils.verification.listAll.invalidate();
      setRejectDialogOpen(false);
      setRejectReason("");
    },
    onError: (e) => toast.error(e.message),
  });

  const openDocument = async (documentId: number) => {
    try {
      const result = await utils.client.verification.viewDocument.query({ documentId });
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      toast.error(error.message || "Unable to open document");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved": return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case "rejected": return <Badge variant="destructive">Rejected</Badge>;
      case "expired": return <Badge className="bg-amber-100 text-amber-800">Expired</Badge>;
      case "revoked": return <Badge variant="destructive">Revoked</Badge>;
      default: return <Badge variant="secondary">Pending</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle>Provider Evidence Review</CardTitle>
            <CardDescription>Review each identity, business, license, insurance, or background-check record independently</CardDescription>
          </div>
          <Select value={statusFilter} onValueChange={value => setStatusFilter(value as typeof statusFilter)}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="revoked">Revoked</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {/* Document Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={docSearch}
            onChange={(e) => setDocSearch(e.target.value)}
            className="pl-9 pr-9 text-sm"
          />
          {docSearch && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setDocSearch("")}
            >
              <XCircle className="h-4 w-4" />
            </button>
          )}
        </div>
        {isLoading ? (
          <LoadingSpinner message="Loading documents..." />
        ) : !documents || documents.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No documents found</p>
        ) : (
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Document Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.filter((item: any) => {
                if (!docSearch.trim()) return true;
                const q = docSearch.toLowerCase();
                return (item.providerName || "").toLowerCase().includes(q) ||
                  (item.document.documentType || "").toLowerCase().includes(q) ||
                  (item.document.documentLabel || "").toLowerCase().includes(q) ||
                  (item.document.issuer || "").toLowerCase().includes(q);
              }).map((item: any) => (
                <TableRow key={item.document.id}>
                  <TableCell className="font-medium">{item.providerName}</TableCell>
                  <TableCell>
                    <p className="font-medium">{item.document.documentLabel || item.document.documentType.replaceAll("_", " ")}</p>
                    <p className="text-xs text-muted-foreground">{[item.document.issuer, item.document.jurisdiction].filter(Boolean).join(" · ") || item.document.documentType.replaceAll("_", " ")}</p>
                    {item.document.expirationDate && <p className="text-xs text-muted-foreground">Expires {new Date(`${item.document.expirationDate}T00:00:00`).toLocaleDateString()}</p>}
                  </TableCell>
                  <TableCell>{getStatusBadge(item.document.state || item.document.verificationStatus)}</TableCell>
                  <TableCell>{new Date(item.document.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openDocument(item.document.id)}><Eye className="h-4 w-4" /></Button>
                      {item.document.verificationStatus === "pending" && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => reviewDoc.mutate({ documentId: item.document.id, status: "approved" })}
                            disabled={reviewDoc.isPending}
                          >
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setReviewAction("reject"); setSelectedDocId(item.document.id); setRejectDialogOpen(true); }}
                            disabled={reviewDoc.isPending}
                          >
                            <XCircle className="h-4 w-4 text-red-500" />
                          </Button>
                        </>
                      )}
                      {item.document.verificationStatus === "approved" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Revoke approved evidence"
                          onClick={() => { setReviewAction("revoke"); setSelectedDocId(item.document.id); setRejectDialogOpen(true); }}
                          disabled={revokeDoc.isPending}
                        >
                          <XCircle className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
           </Table>
          </div>
        )}
      </CardContent>
      {/* Reject or revoke evidence dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{reviewAction === "revoke" ? "Revoke Approved Evidence" : "Reject Evidence"}</DialogTitle>
            <DialogDescription>{reviewAction === "revoke" ? "Revocation removes the public signal but preserves the audit history." : "Provide a reason the provider can use when submitting replacement evidence."}</DialogDescription>
          </DialogHeader>
          <Input
            placeholder={reviewAction === "revoke" ? "Reason for revocation..." : "Reason for rejection..."}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!selectedDocId) return;
                if (reviewAction === "revoke") revokeDoc.mutate({ documentId: selectedDocId, reason: rejectReason });
                else reviewDoc.mutate({ documentId: selectedDocId, status: "rejected", rejectionReason: rejectReason });
              }}
              disabled={rejectReason.trim().length < 5 || reviewDoc.isPending || revokeDoc.isPending}
            >
              {reviewAction === "revoke" ? "Revoke Evidence" : "Reject Evidence"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============================================================================
// CONTACT SUBMISSIONS PANEL
// ============================================================================
function ContactSubmissionsPanel() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);
  const [replyDialogOpen, setReplyDialogOpen] = useState(false);
  const [replyMessage, setReplyMessage] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | undefined>();
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateMode, setTemplateMode] = useState<"create" | "edit">("create");
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);
  const [templateForm, setTemplateForm] = useState({ name: "", category: "general", subject: "", body: "" });
  const [detailOpen, setDetailOpen] = useState(false);

  const utils = trpc.useUtils();

  // Queries
  const { data: submissions, isLoading } = trpc.contact.list.useQuery(
    {
      limit: 100,
      ...(statusFilter !== "all" ? { status: statusFilter as any } : {}),
      ...(categoryFilter !== "all" ? { category: categoryFilter as any } : {}),
    }
  );

  const { data: stats } = trpc.contact.getStats.useQuery();
  const { data: templates } = trpc.contact.listTemplates.useQuery();
  const { data: replies } = trpc.contact.getReplies.useQuery(
    { submissionId: selectedSubmission?.id ?? 0 },
    { enabled: !!selectedSubmission }
  );

  // Mutations
  const updateStatus = trpc.contact.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Status updated");
      utils.contact.list.invalidate();
      utils.contact.getStats.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const sendReply = trpc.contact.reply.useMutation({
    onSuccess: (data) => {
      toast.success(data.emailSent ? "Reply sent via email" : "Reply saved (email delivery pending)");
      setReplyDialogOpen(false);
      setReplyMessage("");
      setSelectedTemplateId(undefined);
      utils.contact.getReplies.invalidate();
      utils.contact.list.invalidate();
      utils.contact.getStats.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const createTemplate = trpc.contact.createTemplate.useMutation({
    onSuccess: () => {
      toast.success("Template created");
      setTemplateDialogOpen(false);
      resetTemplateForm();
      utils.contact.listTemplates.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateTemplate = trpc.contact.updateTemplate.useMutation({
    onSuccess: () => {
      toast.success("Template updated");
      setTemplateDialogOpen(false);
      resetTemplateForm();
      utils.contact.listTemplates.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteTemplate = trpc.contact.deleteTemplate.useMutation({
    onSuccess: () => {
      toast.success("Template deleted");
      utils.contact.listTemplates.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  function resetTemplateForm() {
    setTemplateForm({ name: "", category: "general", subject: "", body: "" });
    setEditingTemplate(null);
    setTemplateMode("create");
  }

  function openEditTemplate(template: any) {
    setTemplateMode("edit");
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      category: template.category,
      subject: template.subject,
      body: template.body,
    });
    setTemplateDialogOpen(true);
  }

  function applyTemplate(template: any) {
    setReplyMessage(template.body);
    setSelectedTemplateId(template.id);
    toast.success(`Template "${template.name}" applied`);
  }

  function openReplyDialog(submission: any) {
    setSelectedSubmission(submission);
    setReplyMessage("");
    setSelectedTemplateId(undefined);
    setReplyDialogOpen(true);
  }

  function openDetailDialog(submission: any) {
    setSelectedSubmission(submission);
    setDetailOpen(true);
  }

  // Filter submissions by search query
  const filteredSubmissions = submissions?.filter((sub: any) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      sub.name?.toLowerCase().includes(q) ||
      sub.email?.toLowerCase().includes(q) ||
      sub.subject?.toLowerCase().includes(q) ||
      sub.message?.toLowerCase().includes(q) ||
      String(sub.id).includes(q)
    );
  });

  // Bulk status update
  function bulkUpdateStatus(newStatus: string) {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    let completed = 0;
    ids.forEach((id) => {
      updateStatus.mutate(
        { id, status: newStatus as any },
        {
          onSuccess: () => {
            completed++;
            if (completed === ids.length) {
              setSelectedIds(new Set());
              toast.success(`Updated ${ids.length} submissions to ${newStatus.replace("_", " ")}`);
            }
          },
        }
      );
    });
  }

  // Toggle selection
  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (!filteredSubmissions) return;
    if (selectedIds.size === filteredSubmissions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredSubmissions.map((s: any) => s.id)));
    }
  }

  // CSV Export
  function exportCSV() {
    const data = filteredSubmissions || submissions;
    if (!data || data.length === 0) {
      toast.error("No submissions to export");
      return;
    }
    const headers = ["ID", "Name", "Email", "Subject", "Category", "Status", "Message", "Date"];
    const rows = data.map((sub: any) => [
      sub.id,
      `"${(sub.name || "").replace(/"/g, '""')}"`,
      `"${(sub.email || "").replace(/"/g, '""')}"`,
      `"${(sub.subject || "").replace(/"/g, '""')}"`,
      sub.category,
      sub.status,
      `"${(sub.message || "").replace(/"/g, '""').replace(/\n/g, " ")}"`,
      new Date(sub.createdAt).toISOString(),
    ]);
    const csv = [headers.join(","), ...rows.map((r: any[]) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contact-submissions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${data.length} submissions to CSV`);
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "new": return <Badge className="bg-blue-100 text-blue-800 border-blue-200"><Inbox className="h-3 w-3 mr-1" />New</Badge>;
      case "in_progress": return <Badge className="bg-amber-100 text-amber-800 border-amber-200"><Clock className="h-3 w-3 mr-1" />In Progress</Badge>;
      case "resolved": return <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle2 className="h-3 w-3 mr-1" />Resolved</Badge>;
      case "closed": return <Badge className="bg-gray-100 text-gray-800 border-gray-200"><Archive className="h-3 w-3 mr-1" />Closed</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      general: "bg-slate-100 text-slate-700",
      booking: "bg-indigo-100 text-indigo-700",
      payment: "bg-emerald-100 text-emerald-700",
      provider: "bg-purple-100 text-purple-700",
      technical: "bg-red-100 text-red-700",
      other: "bg-gray-100 text-gray-700",
    };
    return <Badge className={colors[category] || colors.other}>{category}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-4 pb-3">
              <div className="text-xs text-muted-foreground">New</div>
              <div className="text-2xl font-bold text-blue-600">{stats.new}</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="pt-4 pb-3">
              <div className="text-xs text-muted-foreground">In Progress</div>
              <div className="text-2xl font-bold text-amber-600">{stats.in_progress}</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="pt-4 pb-3">
              <div className="text-xs text-muted-foreground">Resolved</div>
              <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-gray-400">
            <CardContent className="pt-4 pb-3">
              <div className="text-xs text-muted-foreground">Closed</div>
              <div className="text-2xl font-bold text-gray-600">{stats.closed}</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="pt-4 pb-3">
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, subject..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 pr-10 text-sm"
        />
        {searchQuery && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setSearchQuery("")}
          >
            <XCircle className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filters + Bulk Actions + Export + Template Manager */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="general">General</SelectItem>
            <SelectItem value="booking">Booking</SelectItem>
            <SelectItem value="payment">Payment</SelectItem>
            <SelectItem value="provider">Provider</SelectItem>
            <SelectItem value="technical">Technical</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-200">
            <span className="text-xs font-medium text-blue-700">{selectedIds.size} selected</span>
            <Select onValueChange={(val) => bulkUpdateStatus(val)}>
              <SelectTrigger className="h-7 w-[130px] text-xs">
                <SelectValue placeholder="Set status..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Mark as New</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <button
              className="text-xs text-blue-600 hover:text-blue-800 underline"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </button>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportCSV}
            title="Export to CSV"
          >
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { resetTemplateForm(); setTemplateDialogOpen(true); }}
          >
            <Zap className="h-4 w-4 mr-1" />
            Templates ({templates?.length || 0})
          </Button>
        </div>
      </div>

      {/* Submissions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Contact Submissions
          </CardTitle>
          <CardDescription>View and respond to customer inquiries from the Help Center</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingSpinner message="Loading submissions..." />
          ) : !filteredSubmissions || filteredSubmissions.length === 0 ? (
            <div className="text-center py-12">
              <Inbox className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No submissions found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {searchQuery ? "Try a different search term" : statusFilter !== "all" || categoryFilter !== "all" ? "Try adjusting your filters" : "Contact form submissions will appear here"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {searchQuery && (
                <p className="text-xs text-muted-foreground mb-2">
                  Showing {filteredSubmissions.length} of {submissions?.length || 0} submissions
                </p>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <input
                        type="checkbox"
                        checked={filteredSubmissions.length > 0 && selectedIds.size === filteredSubmissions.length}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300"
                      />
                    </TableHead>
                    <TableHead className="w-[60px]">ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubmissions.map((sub: any) => (
                    <TableRow key={sub.id} className={`${sub.status === "new" ? "bg-blue-50/30" : ""} ${selectedIds.has(sub.id) ? "bg-blue-50/50" : ""}`}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(sub.id)}
                          onChange={() => toggleSelect(sub.id)}
                          className="rounded border-gray-300"
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">#{sub.id}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{sub.name}</p>
                          <p className="text-xs text-muted-foreground">{sub.email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <p className="text-sm truncate">{sub.subject}</p>
                      </TableCell>
                      <TableCell>{getCategoryBadge(sub.category)}</TableCell>
                      <TableCell>{getStatusBadge(sub.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(sub.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openDetailDialog(sub)} title="View details">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openReplyDialog(sub)} title="Reply">
                            <Send className="h-4 w-4 text-blue-500" />
                          </Button>
                          <Select
                            value={sub.status}
                            onValueChange={(val) => updateStatus.mutate({ id: sub.id, status: val as any })}
                          >
                            <SelectTrigger className="h-8 w-[120px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="new">New</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="resolved">Resolved</SelectItem>
                              <SelectItem value="closed">Closed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Submission #{selectedSubmission?.id}
            </DialogTitle>
            <DialogDescription>Contact form submission details</DialogDescription>
          </DialogHeader>
          {selectedSubmission && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Name</p>
                  <p className="font-medium">{selectedSubmission.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <a href={`mailto:${selectedSubmission.email}`} className="font-medium text-blue-600 hover:underline">
                    {selectedSubmission.email}
                  </a>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Category</p>
                  {getCategoryBadge(selectedSubmission.category)}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  {getStatusBadge(selectedSubmission.status)}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Submitted</p>
                  <p className="text-sm">{formatDate(selectedSubmission.createdAt)}</p>
                </div>
                {selectedSubmission.resolvedAt && (
                  <div>
                    <p className="text-xs text-muted-foreground">Resolved</p>
                    <p className="text-sm">{formatDate(selectedSubmission.resolvedAt)}</p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Subject</p>
                <p className="font-medium">{selectedSubmission.subject}</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Message</p>
                <div className="p-3 bg-muted/50 rounded-lg text-sm whitespace-pre-wrap">
                  {selectedSubmission.message}
                </div>
              </div>

              {/* Reply History */}
              {replies && replies.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    Reply History ({replies.length})
                  </p>
                  <div className="space-y-3">
                    {replies.map((r: any) => (
                      <div key={r.reply.id} className="p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-blue-700">
                            {r.adminName || "Admin"}
                          </span>
                          <div className="flex items-center gap-2">
                            {r.reply.emailSent ? (
                              <span className="text-xs text-green-600 flex items-center gap-1">
                                <MailCheck className="h-3 w-3" /> Email sent
                              </span>
                            ) : (
                              <span className="text-xs text-amber-700 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" /> Email pending
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {formatDate(r.reply.createdAt)}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{r.reply.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <DialogFooter className="flex-wrap gap-2">
                <Button variant="outline" onClick={() => setDetailOpen(false)}>Close</Button>
                <Button onClick={() => { setDetailOpen(false); openReplyDialog(selectedSubmission); }}>
                  <Send className="h-4 w-4 mr-1" />
                  Reply
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reply Dialog */}
      <Dialog open={replyDialogOpen} onOpenChange={setReplyDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Reply to {selectedSubmission?.name}
            </DialogTitle>
            <DialogDescription>
              Re: {selectedSubmission?.subject} (#{selectedSubmission?.id})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Original message preview */}
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Original message:</p>
              <p className="text-sm line-clamp-3">{selectedSubmission?.message}</p>
            </div>

            {/* Template Quick-Select */}
            {templates && templates.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  Quick Templates
                </p>
                <div className="flex flex-wrap gap-2">
                  {templates
                    .filter((t: any) => t.category === selectedSubmission?.category || t.category === "general")
                    .slice(0, 6)
                    .map((t: any) => (
                      <Button
                        key={t.id}
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => applyTemplate(t)}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        {t.name}
                      </Button>
                    ))}
                </div>
              </div>
            )}

            {/* Reply message */}
            <div>
              <Textarea
                placeholder="Type your reply..."
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                rows={8}
                className="resize-y"
              />
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-muted-foreground">
                  {replyMessage.length}/10,000 characters
                </p>
                {selectedTemplateId && (
                  <p className="text-xs text-blue-600">Using template</p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReplyDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => selectedSubmission && sendReply.mutate({
                submissionId: selectedSubmission.id,
                message: replyMessage,
                templateId: selectedTemplateId,
              })}
              disabled={!replyMessage.trim() || sendReply.isPending}
            >
              {sendReply.isPending ? (
                <>Sending...</>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-1" />
                  Send Reply
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Management Dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={(open) => { if (!open) resetTemplateForm(); setTemplateDialogOpen(open); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              {templateMode === "edit" ? "Edit Template" : "Reply Templates"}
            </DialogTitle>
            <DialogDescription>
              {templateMode === "edit" ? "Update the template details" : "Create and manage canned reply templates for quick responses"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Template Form */}
            <div className="p-4 border rounded-lg space-y-3">
              <p className="text-sm font-medium">{templateMode === "edit" ? "Edit Template" : "New Template"}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  placeholder="Template name (e.g., Booking Confirmation)"
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm(f => ({ ...f, name: e.target.value }))}
                />
                <Select
                  value={templateForm.category}
                  onValueChange={(val) => setTemplateForm(f => ({ ...f, category: val }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="booking">Booking</SelectItem>
                    <SelectItem value="payment">Payment</SelectItem>
                    <SelectItem value="provider">Provider</SelectItem>
                    <SelectItem value="technical">Technical</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Input
                placeholder="Subject line"
                value={templateForm.subject}
                onChange={(e) => setTemplateForm(f => ({ ...f, subject: e.target.value }))}
              />
              <Textarea
                placeholder="Template body text..."
                value={templateForm.body}
                onChange={(e) => setTemplateForm(f => ({ ...f, body: e.target.value }))}
                rows={5}
                className="resize-y"
              />
              <div className="flex gap-2">
                {templateMode === "edit" ? (
                  <>
                    <Button
                      size="sm"
                      onClick={() => editingTemplate && updateTemplate.mutate({
                        id: editingTemplate.id,
                        ...templateForm,
                        category: templateForm.category as any,
                      })}
                      disabled={!templateForm.name.trim() || !templateForm.body.trim() || updateTemplate.isPending}
                    >
                      Save Changes
                    </Button>
                    <Button size="sm" variant="outline" onClick={resetTemplateForm}>Cancel</Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => createTemplate.mutate({
                      ...templateForm,
                      category: templateForm.category as any,
                    })}
                    disabled={!templateForm.name.trim() || !templateForm.body.trim() || !templateForm.subject.trim() || createTemplate.isPending}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Create Template
                  </Button>
                )}
              </div>
            </div>

            {/* Existing Templates List */}
            {templates && templates.length > 0 && templateMode !== "edit" && (
              <div>
                <p className="text-sm font-medium mb-3">Existing Templates ({templates.length})</p>
                <div className="space-y-2">
                  {templates.map((t: any) => (
                    <div key={t.id} className="p-3 border rounded-lg flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm">{t.name}</p>
                          {getCategoryBadge(t.category)}
                          {t.usageCount > 0 && (
                            <span className="text-xs text-muted-foreground">Used {t.usageCount}x</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{t.subject}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{t.body}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="sm" variant="ghost" onClick={() => openEditTemplate(t)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(`Delete template "${t.name}"?`)) {
                              deleteTemplate.mutate({ id: t.id });
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {templates && templates.length === 0 && templateMode !== "edit" && (
              <div className="text-center py-6">
                <Zap className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No templates yet</p>
                <p className="text-xs text-muted-foreground">Create your first template above to speed up replies</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


// ============================================================================
// REFERRAL ANALYTICS PANEL
// ============================================================================
function ReferralAnalyticsPanel() {
  const { data: refStats, isLoading } = trpc.admin.getReferralAnalytics.useQuery();

  if (isLoading) return <LoadingSpinner message="Loading referral analytics..." />;
  if (!refStats) return null;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <UserPlus className="h-4 w-4 text-blue-500" />
              <div className="text-xs text-muted-foreground">Total Referrals</div>
            </div>
            <div className="text-2xl font-bold text-blue-600">{refStats.totalReferrals}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <div className="text-xs text-muted-foreground">Completed</div>
            </div>
            <div className="text-2xl font-bold text-green-600">{refStats.completedReferrals}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-amber-600" />
              <div className="text-xs text-muted-foreground">Pending</div>
            </div>
            <div className="text-2xl font-bold text-amber-600">{refStats.pendingReferrals}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Percent className="h-4 w-4 text-purple-500" />
              <div className="text-xs text-muted-foreground">Conversion Rate</div>
            </div>
            <div className="text-2xl font-bold text-purple-600">{refStats.conversionRate}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Credits & Codes Overview */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Credit Summary
            </CardTitle>
            <CardDescription>Platform-wide referral credit activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
                <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">Credits Earned</p>
                <p className="text-2xl font-bold text-green-600">{formatPrice(parseFloat(refStats.totalCreditsEarned))}</p>
              </div>
              <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                <p className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-1">Credits Spent</p>
                <p className="text-2xl font-bold text-blue-600">{formatPrice(parseFloat(refStats.totalCreditsSpent))}</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Active Referral Codes</span>
                <span className="font-semibold">{refStats.activeCodes} / {refStats.totalCodes}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Monthly Trend
            </CardTitle>
            <CardDescription>Referrals over the last 12 months</CardDescription>
          </CardHeader>
          <CardContent>
            {refStats.monthlyTrend.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No referral data yet</p>
            ) : (
              <div className="space-y-2">
                {refStats.monthlyTrend.map((m: any) => (
                  <div key={m.month} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-16 shrink-0">{m.month}</span>
                    <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                        style={{ width: `${Math.max(5, (m.total / Math.max(...refStats.monthlyTrend.map((t: any) => t.total), 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium w-8 text-right">{m.total}</span>
                    <span className="text-xs text-green-600 w-8 text-right">({Number(m.completed) || 0})</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Referrers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5" />
            Top Referrers
          </CardTitle>
          <CardDescription>Users who have referred the most people to the platform</CardDescription>
        </CardHeader>
        <CardContent>
          {refStats.topReferrers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No referrers yet</p>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead className="text-center">Total Referrals</TableHead>
                  <TableHead className="text-center">Completed</TableHead>
                  <TableHead className="text-right">Total Earned</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {refStats.topReferrers.map((r: any, i: number) => (
                  <TableRow key={r.userId}>
                    <TableCell>
                      {i === 0 ? (
                        <span className="text-amber-700 dark:text-amber-400 font-bold">#1</span>
                      ) : i === 1 ? (
                        <span className="text-muted-foreground font-bold">#2</span>
                      ) : i === 2 ? (
                        <span className="text-amber-700 font-bold">#3</span>
                      ) : (
                        <span className="text-muted-foreground">#{i + 1}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{r.userName || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{r.userEmail || ""}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-semibold">{r.totalReferrals}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={Number(r.completedReferrals) > 0 ? "default" : "secondary"}>
                        {Number(r.completedReferrals) || 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-green-600">
                      {formatPrice(parseFloat(r.totalEarned || "0"))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// PUSH NOTIFICATION ANALYTICS PANEL
// ============================================================================
function PushAnalyticsPanel() {
  const { data: pushStats, isLoading } = trpc.admin.getPushAnalytics.useQuery();

  if (isLoading) return <LoadingSpinner message="Loading push analytics..." />;
  if (!pushStats) return null;

  const adoptionRate = pushStats.totalSubscriptions > 0
    ? Math.round((pushStats.activeSubscriptions / pushStats.totalSubscriptions) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Push Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Bell className="h-4 w-4 text-blue-500" />
              <div className="text-xs text-muted-foreground">Total Subscriptions</div>
            </div>
            <div className="text-2xl font-bold text-blue-600">{pushStats.totalSubscriptions}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Wifi className="h-4 w-4 text-green-600" />
              <div className="text-xs text-muted-foreground">Active</div>
            </div>
            <div className="text-2xl font-bold text-green-600">{pushStats.activeSubscriptions}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-400">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <WifiOff className="h-4 w-4 text-red-500" />
              <div className="text-xs text-muted-foreground">Inactive</div>
            </div>
            <div className="text-2xl font-bold text-red-500">{pushStats.inactiveSubscriptions}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-purple-500" />
              <div className="text-xs text-muted-foreground">Unique Users</div>
            </div>
            <div className="text-2xl font-bold text-purple-600">{pushStats.uniqueUsers}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-4 w-4 text-amber-600" />
              <div className="text-xs text-muted-foreground">Last 7 Days</div>
            </div>
            <div className="text-2xl font-bold text-amber-600">{pushStats.recentSubscriptions}</div>
          </CardContent>
        </Card>
      </div>

      {/* Adoption Rate */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Push Notification Adoption
          </CardTitle>
          <CardDescription>
            Overview of browser push notification subscriptions across the platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Adoption Rate Bar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Adoption Rate</span>
                <span className="text-sm font-bold text-primary">{adoptionRate}%</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all"
                  style={{ width: `${adoptionRate}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {pushStats.activeSubscriptions} of {pushStats.totalSubscriptions} subscriptions are active
              </p>
            </div>

            {/* Key Insights */}
            <div className="grid md:grid-cols-2 gap-4 pt-4 border-t">
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium mb-1">Avg Devices per User</p>
                <p className="text-2xl font-bold">
                  {pushStats.uniqueUsers > 0
                    ? (pushStats.activeSubscriptions / pushStats.uniqueUsers).toFixed(1)
                    : "0"}
                </p>
                <p className="text-xs text-muted-foreground">Active subscriptions per unique user</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium mb-1">Recent Growth</p>
                <p className="text-2xl font-bold text-emerald-600">
                  +{pushStats.recentSubscriptions}
                </p>
                <p className="text-xs text-muted-foreground">New subscriptions in the last 7 days</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


// ============================================================================
// PROVIDERS FILTER PANEL
// ============================================================================
function ProvidersFilterPanel({ toggleProviderActive }: { toggleProviderActive: any }) {
  const [providerSearch, setProviderSearch] = useState("");
  const [verificationFilter, setVerificationFilter] = useState("all");
  const [providerPage, setProviderPage] = useState(1);
  const [sortBy, setSortBy] = useState<"rating" | "joined" | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | undefined>(undefined);
  const utils = trpc.useUtils();

  const { data: filteredProviders, isLoading } = trpc.admin.searchProvidersFiltered.useQuery({
    query: providerSearch || undefined,
    verificationStatus: verificationFilter !== "all" ? verificationFilter as any : undefined,
    sortBy,
    sortOrder,
    page: providerPage,
    limit: 20,
  });

  const toggleSort = (column: "rating" | "joined") => {
    if (sortBy !== column) {
      setSortBy(column);
      setSortOrder("desc");
    } else if (sortOrder === "desc") {
      setSortOrder("asc");
    } else {
      setSortBy(undefined);
      setSortOrder(undefined);
    }
    setProviderPage(1);
  };

  const clearFilters = () => {
    setProviderSearch("");
    setVerificationFilter("all");
    setSortBy(undefined);
    setSortOrder(undefined);
    setProviderPage(1);
  };

  const hasFilters = providerSearch || verificationFilter !== "all" || sortBy;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Provider Management</CardTitle>
            <CardDescription>Search, filter, and manage service providers. Verify or reject pending applications.</CardDescription>
          </div>
          {hasFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <XCircle className="h-3.5 w-3.5 mr-1" />
              Clear All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Search & Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-0 sm:min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by business name, city..."
              value={providerSearch}
              onChange={(e) => { setProviderSearch(e.target.value); setProviderPage(1); }}
              className="pl-9 pr-9 text-sm"
            />
            {providerSearch && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => { setProviderSearch(""); setProviderPage(1); }}
              >
                <XCircle className="h-4 w-4" />
              </button>
            )}
          </div>
          <Select value={verificationFilter} onValueChange={(v) => { setVerificationFilter(v); setProviderPage(1); }}>
            <SelectTrigger className="w-[130px] sm:w-[150px] text-xs sm:text-sm">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results */}
        {isLoading ? (
          <LoadingSpinner />
        ) : !filteredProviders || filteredProviders.providers.length === 0 ? (
          <div className="text-center py-8">
            <Briefcase className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-muted-foreground">No providers found matching your criteria</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Business Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Identity Evidence</TableHead>
                    <TableHead>
                      <button
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                        onClick={() => toggleSort("rating")}
                        title="Click to sort by rating"
                      >
                        Rating
                        {sortBy === "rating" ? (
                          sortOrder === "desc" ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                        onClick={() => toggleSort("joined")}
                        title="Click to sort by join date"
                      >
                        Joined
                        {sortBy === "joined" ? (
                          sortOrder === "desc" ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProviders.providers.map((provider: any) => (
                    <TableRow key={provider.id}>
                      <TableCell className="font-medium">{provider.businessName}</TableCell>
                      <TableCell className="capitalize">{provider.businessType?.replace('_', ' ')}</TableCell>
                      <TableCell>{provider.city ? `${provider.city}, ${provider.state}` : "N/A"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            provider.trustProfile?.evidence.identity.state === "verified" ? "default" :
                            ["rejected", "revoked"].includes(provider.trustProfile?.evidence.identity.state) ? "destructive" :
                            "secondary"
                          }
                        >
                          {provider.trustProfile?.isOfficialDemo
                            ? "official demo"
                            : provider.trustProfile?.evidence.identity.state.replace("_", " ") || "not submitted"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                          <span>{provider.averageRating ? parseFloat(provider.averageRating).toFixed(1) : "N/A"}</span>
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(provider.createdAt)}</TableCell>
                      <TableCell>
                        <Badge variant={provider.isActive ? "default" : "destructive"} className={provider.isActive ? "bg-green-600 hover:bg-green-700" : ""}>
                          {provider.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          <span className="self-center text-xs text-muted-foreground">Review evidence in Documents</span>
                          <Button
                            size="sm"
                            variant={provider.isActive ? "outline" : "default"}
                            className={provider.isActive ? "text-red-600 border-red-300 hover:bg-red-50" : "bg-green-600 hover:bg-green-700"}
                            onClick={() => { toggleProviderActive.mutate({ providerId: provider.id, isActive: !provider.isActive }); utils.admin.searchProvidersFiltered.invalidate(); }}
                            disabled={toggleProviderActive.isPending}
                            title={provider.isActive ? "Deactivate this provider's profile" : "Activate this provider's profile"}
                          >
                            {provider.isActive ? "Deactivate" : "Activate"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Showing {((filteredProviders.page - 1) * 20) + 1}–{Math.min(filteredProviders.page * 20, filteredProviders.total)} of {filteredProviders.total} providers
              </p>
              {filteredProviders.totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setProviderPage(p => Math.max(1, p - 1))}
                    disabled={providerPage <= 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground px-2">Page</span>
                  <input
                    type="number"
                    min={1}
                    max={filteredProviders.totalPages}
                    value={providerPage}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val) && val >= 1 && val <= filteredProviders.totalPages) {
                        setProviderPage(val);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = parseInt((e.target as HTMLInputElement).value);
                        if (!isNaN(val) && val >= 1 && val <= filteredProviders.totalPages) {
                          setProviderPage(val);
                        }
                      }
                    }}
                    className="w-14 h-8 text-center text-sm border rounded-md bg-background"
                  />
                  <span className="text-sm text-muted-foreground">of {filteredProviders.totalPages}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setProviderPage(p => p + 1)}
                    disabled={providerPage >= filteredProviders.totalPages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}


// ============================================================================
// USERS FILTER PANEL
// ============================================================================
function UsersFilterPanel({ suspendUser, unsuspendUser }: { suspendUser: any; unsuspendUser: any }) {
  const [userSearch, setUserSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [userPage, setUserPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const utils = trpc.useUtils();

  const bulkDelete = trpc.admin.bulkDeleteUsers.useMutation({
    onSuccess: (data: any) => {
      toast.success(data.message);
      setSelectedIds(new Set());
      setShowDeleteConfirm(false);
      utils.admin.searchUsersFiltered.invalidate();
      utils.admin.listUsers.invalidate();
      utils.admin.getStats.invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (users: any[]) => {
    const nonAdminUsers = users.filter((u: any) => u.role !== "admin");
    const allSelected = nonAdminUsers.every((u: any) => selectedIds.has(u.id));
    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        nonAdminUsers.forEach((u: any) => next.delete(u.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        nonAdminUsers.forEach((u: any) => next.add(u.id));
        return next;
      });
    }
  };

  const { data: filteredUsers, isLoading } = trpc.admin.searchUsersFiltered.useQuery({
    query: userSearch || undefined,
    role: roleFilter !== "all" ? roleFilter as any : undefined,
    status: statusFilter !== "all" ? statusFilter as any : undefined,
    page: userPage,
    limit: 20,
  });

  const clearFilters = () => {
    setUserSearch("");
    setRoleFilter("all");
    setStatusFilter("all");
    setUserPage(1);
  };

  const hasFilters = userSearch || roleFilter !== "all" || statusFilter !== "all";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>User Management</CardTitle>
            <CardDescription>Search, filter, and manage all platform users. Click a user to view their full profile.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={bulkDelete.isPending}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Delete {selectedIds.size} Selected
              </Button>
            )}
            {hasFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                <XCircle className="h-3.5 w-3.5 mr-1" />
                Clear All
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Search & Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-0 sm:min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email..."
              value={userSearch}
              onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }}
              className="pl-9 pr-9 text-sm"
            />
            {userSearch && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setUserSearch("")}
              >
                <XCircle className="h-4 w-4" />
              </button>
            )}
          </div>
          <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setUserPage(1); }}>
            <SelectTrigger className="w-[110px] sm:w-[130px] text-xs sm:text-sm">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="customer">Customer</SelectItem>
              <SelectItem value="provider">Provider</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setUserPage(1); }}>
            <SelectTrigger className="w-[110px] sm:w-[130px] text-xs sm:text-sm">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results */}
        {isLoading ? (
          <LoadingSpinner />
        ) : !filteredUsers || filteredUsers.users.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-muted-foreground">No users found matching your criteria</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
                        checked={filteredUsers.users.filter((u: any) => u.role !== "admin").length > 0 && filteredUsers.users.filter((u: any) => u.role !== "admin").every((u: any) => selectedIds.has(u.id))}
                        onChange={() => toggleSelectAll(filteredUsers.users)}
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.users.map((u: any) => (
                    <TableRow key={u.id} className={`cursor-pointer hover:bg-muted/50 ${selectedIds.has(u.id) ? 'bg-muted/30' : ''}`}>
                      <TableCell>
                        {u.role !== "admin" && (
                          <input
                            type="checkbox"
                            className="rounded border-gray-300"
                            checked={selectedIds.has(u.id)}
                            onChange={() => toggleSelect(u.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        <Link href={`/admin/users/${u.id}`} className="flex items-center gap-2 text-primary hover:underline">
                          <Avatar className="h-8 w-8">
                            {u.profilePhotoUrl && <AvatarImage src={u.profilePhotoUrl} alt={u.name || "User"} />}
                            <AvatarFallback className="text-xs bg-muted">
                              {u.name ? u.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() : "?"}
                            </AvatarFallback>
                          </Avatar>
                          <span>{u.name || "N/A"}</span>
                        </Link>
                      </TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                            {u.role}
                          </Badge>
                          {u.hasProviderProfile && u.role !== "provider" && (
                            <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200">
                              Provider
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <PlanBadge user={u} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(u.createdAt)}</TableCell>
                      <TableCell>
                        {u.deletedAt ? (
                          <Badge variant="destructive">Suspended</Badge>
                        ) : !u.emailVerified ? (
                          <Badge variant="outline" className="text-amber-700 border-amber-700">Unverified</Badge>
                        ) : (
                          <Badge variant="outline" className="text-green-600 border-green-600">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Link href={`/admin/users/${u.id}`}>
                            <Button size="sm" variant="ghost">
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                          {u.role !== "admin" && (
                            u.deletedAt ? (
                              <Button size="sm" variant="outline" onClick={() => unsuspendUser.mutate({ userId: u.id })} disabled={unsuspendUser.isPending}>
                                <Undo2 className="h-3.5 w-3.5 mr-1" />
                                Unsuspend
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" className="text-destructive" onClick={() => suspendUser.mutate({ userId: u.id })} disabled={suspendUser.isPending}>
                                <Ban className="h-3.5 w-3.5 mr-1" />
                                Suspend
                              </Button>
                            )
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Showing {((filteredUsers.page - 1) * 20) + 1}–{Math.min(filteredUsers.page * 20, filteredUsers.total)} of {filteredUsers.total} users
              </p>
              {filteredUsers.totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setUserPage(p => Math.max(1, p - 1))}
                    disabled={userPage <= 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground px-2">Page</span>
                  <input
                    type="number"
                    min={1}
                    max={filteredUsers.totalPages}
                    value={userPage}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val) && val >= 1 && val <= filteredUsers.totalPages) {
                        setUserPage(val);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = parseInt((e.target as HTMLInputElement).value);
                        if (!isNaN(val) && val >= 1 && val <= filteredUsers.totalPages) {
                          setUserPage(val);
                        }
                      }
                    }}
                    className="w-14 h-8 text-center text-sm border rounded-md bg-background"
                  />
                  <span className="text-sm text-muted-foreground">of {filteredUsers.totalPages}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setUserPage(p => p + 1)}
                    disabled={userPage >= filteredUsers.totalPages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
            </CardContent>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Bulk Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete {selectedIds.size} user(s)? This will remove all their data including bookings, reviews, messages, and provider profiles. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => bulkDelete.mutate({ userIds: Array.from(selectedIds) })}
              disabled={bulkDelete.isPending}
            >
              {bulkDelete.isPending ? "Deleting..." : `Delete ${selectedIds.size} User(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
// ============================================================================
// PARTNER REVENUE SPLIT PANEL
// ============================================================================

/** Plan badge for the admin Users table */
function PlanBadge({ user }: { user: any }) {
  const badges: React.ReactNode[] = [];

  const lifecycleSuffix = (state?: string, accessEndsAt?: string | Date | null) => {
    if (state === "trialing") return " (trial)";
    if (state === "past_due_grace") return " (payment due)";
    if (state === "cancelling") {
      if (!accessEndsAt) return " (ending)";
      return ` (ends ${new Date(accessEndsAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })})`;
    }
    return "";
  };

  const needsBillingAction = (configuredTier: string | null | undefined, effectiveTier: string | null | undefined, requiresAction?: boolean) =>
    !!requiresAction && !!configuredTier && configuredTier !== "free" && effectiveTier === "free";

  // Provider subscription
  if (user.providerSubTier && user.providerSubTier !== "free") {
    const tierLabel = user.providerSubTier === "basic" ? "Pro" : user.providerSubTier === "premium" ? "Business" : user.providerSubTier;
    const needsAttention = user.providerRequiresBillingAction || user.providerEntitlementState === "cancelling";
    badges.push(
      <Badge
        key="prov"
        variant="secondary"
        className={needsAttention
          ? "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900 dark:text-amber-200 dark:border-amber-800"
          : "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-800"}
        title={`Provider entitlement: ${user.providerEntitlementState || "active"}`}
      >
        {tierLabel}{lifecycleSuffix(user.providerEntitlementState, user.providerAccessEndsAt)}
      </Badge>
    );
  } else if (user.hasProviderProfile || user.role === "provider") {
    badges.push(
      <Badge key="prov-free" variant="outline" className="text-gray-500 border-gray-300">
        Starter
      </Badge>
    );
    if (needsBillingAction(user.providerConfiguredTier, user.providerSubTier, user.providerRequiresBillingAction)) {
      badges.push(<Badge key="prov-action" variant="destructive">Provider billing action</Badge>);
    }
  }

  // Customer subscription
  if (user.customerSubTier && user.customerSubTier !== "free") {
    const tierLabel = user.customerSubTier === "pro" ? "Coordinator" : user.customerSubTier === "business" ? "Manager" : user.customerSubTier;
    const needsAttention = user.customerRequiresBillingAction || user.customerEntitlementState === "cancelling";
    badges.push(
      <Badge
        key="cust"
        variant="secondary"
        className={needsAttention
          ? "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900 dark:text-amber-200 dark:border-amber-800"
          : "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900 dark:text-emerald-300 dark:border-emerald-800"}
        title={`Customer entitlement: ${user.customerEntitlementState || "active"}`}
      >
        {tierLabel}{lifecycleSuffix(user.customerEntitlementState, user.customerAccessEndsAt)}
      </Badge>
    );
  } else if (user.role === "customer") {
    badges.push(
      <Badge key="cust-free" variant="outline" className="text-gray-500 border-gray-300">
        Individual
      </Badge>
    );
    if (needsBillingAction(user.customerConfiguredTier, user.customerSubTier, user.customerRequiresBillingAction)) {
      badges.push(<Badge key="cust-action" variant="destructive">Customer billing action</Badge>);
    }
  }

  if (badges.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return <div className="flex gap-1 flex-wrap">{badges}</div>;
}

function WebhookStatusBanner() {
  const { data: webhookStatus } = trpc.admin.getWebhookStatus.useQuery();
  if (!webhookStatus) return null;
  const isHealthy = webhookStatus.configured && webhookStatus.webhookSecretSet && webhookStatus.partnerAccountSet;
  const verificationUnavailable = !webhookStatus.configured && !!webhookStatus.error && webhookStatus.webhookSecretSet && webhookStatus.partnerAccountSet;
  return (
    <div className={`rounded-lg border p-3 flex items-center gap-3 ${isHealthy ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950' : verificationUnavailable ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950' : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950'}`}>
      <div className={`h-2.5 w-2.5 rounded-full ${isHealthy ? 'bg-green-500' : verificationUnavailable ? 'bg-amber-500' : 'bg-red-500'} animate-pulse`} />
      <div className="flex-1">
        <p className={`text-sm font-medium ${isHealthy ? 'text-green-700 dark:text-green-300' : verificationUnavailable ? 'text-amber-800 dark:text-amber-200' : 'text-red-700 dark:text-red-300'}`}>
          {isHealthy ? 'Webhook Active' : verificationUnavailable ? 'Stripe verification unavailable in this environment' : 'Webhook Issue Detected'}
        </p>
        <p className="text-xs text-muted-foreground">
          {webhookStatus.endpoints?.[0]?.url || (verificationUnavailable ? 'Webhook secret and partner account are configured; endpoint status could not be queried.' : 'No endpoint configured')}
          {webhookStatus.endpoints?.[0]?.enabledEvents && ` (${webhookStatus.endpoints[0].enabledEvents.length} events)`}
        </p>
      </div>
      {!isHealthy && !verificationUnavailable && (
        <div className="text-xs text-red-600 dark:text-red-400">
          {!webhookStatus.configured && 'No webhook endpoint '}
          {!webhookStatus.webhookSecretSet && 'Missing webhook secret '}
          {!webhookStatus.partnerAccountSet && 'Missing partner account'}
        </div>
      )}
    </div>
  );
}

function PartnerSplitPanel() {
  const [dateRange, setDateRange] = useState<"all" | "this_month" | "last_month" | "this_quarter" | "last_quarter" | "this_year" | "custom">("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const dateFilter = useMemo(() => {
    const now = new Date();
    let startDate: string | undefined;
    let endDate: string | undefined;

    switch (dateRange) {
      case "this_month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
        break;
      case "last_month":
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();
        break;
      case "this_quarter": {
        const qStart = Math.floor(now.getMonth() / 3) * 3;
        startDate = new Date(now.getFullYear(), qStart, 1).toISOString();
        endDate = new Date(now.getFullYear(), qStart + 3, 0, 23, 59, 59).toISOString();
        break;
      }
      case "last_quarter": {
        const qStart = Math.floor(now.getMonth() / 3) * 3 - 3;
        startDate = new Date(now.getFullYear(), qStart, 1).toISOString();
        endDate = new Date(now.getFullYear(), qStart + 3, 0, 23, 59, 59).toISOString();
        break;
      }
      case "this_year":
        startDate = new Date(now.getFullYear(), 0, 1).toISOString();
        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59).toISOString();
        break;
      case "custom":
        startDate = customStart ? new Date(customStart).toISOString() : undefined;
        endDate = customEnd ? new Date(customEnd + "T23:59:59").toISOString() : undefined;
        break;
      default:
        break;
    }
    return { startDate, endDate };
  }, [dateRange, customStart, customEnd]);

  const { data: summary, isLoading: summaryLoading } = trpc.admin.getPartnerTransferSummary.useQuery({
    startDate: dateFilter.startDate,
    endDate: dateFilter.endDate,
  });
  const { data: transfers, isLoading: transfersLoading } = trpc.admin.getPartnerTransfers.useQuery({
    startDate: dateFilter.startDate,
    endDate: dateFilter.endDate,
    limit: 50,
    offset: 0,
  });
  const { data: monthlyData } = trpc.admin.getPartnerMonthlyBreakdown.useQuery({ months: 12 });

  const handleExportCSV = async () => {
    try {
      const exportData = transfers || [];
      if (exportData.length === 0) {
        toast.error("No data to export");
        return;
      }

      const headers = ["Date", "Source Type", "Description", "Total Revenue", "Partner Amount (40%)", "Platform Amount (60%)", "Status", "Stripe Transfer ID"];
      const rows = exportData.map((t: any) => [
        new Date(t.createdAt).toLocaleDateString(),
        t.sourceType,
        `"${(t.sourceDescription || "").replace(/"/g, '""')}"`,
        parseFloat(t.totalRevenue || "0").toFixed(2),
        parseFloat(t.amount || "0").toFixed(2),
        (parseFloat(t.totalRevenue || "0") - parseFloat(t.amount || "0")).toFixed(2),
        t.status,
        t.stripeTransferId || "N/A",
      ]);

      const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `partner-transfers-${dateRange}-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV exported successfully");
    } catch {
      toast.error("Failed to export CSV");
    }
  };

  if (summaryLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Date Range Filter + Export */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={dateRange} onValueChange={(v: any) => setDateRange(v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
              <SelectItem value="this_quarter">This Quarter</SelectItem>
              <SelectItem value="last_quarter">Last Quarter</SelectItem>
              <SelectItem value="this_year">This Year</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {dateRange === "custom" && (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="w-[150px]"
              placeholder="Start date"
            />
            <span className="text-muted-foreground">to</span>
            <Input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="w-[150px]"
              placeholder="End date"
            />
          </div>
        )}

        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!transfers || transfers.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Webhook Status */}
      <WebhookStatusBanner />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Revenue</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(summary?.totalRevenue || 0)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Gross revenue from unique split sources</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Your Share (60%)</CardDescription>
            <CardTitle className="text-2xl text-green-600">{formatCurrency(summary?.platformShare || 0)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Platform owner revenue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Partner Share (40%)</CardDescription>
            <CardTitle className="text-2xl text-blue-600">{formatCurrency((summary as any)?.partnerOwed || 0)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(summary?.totalTransferred || 0)} transferred
              {((summary as any)?.partnerOutstanding || 0) > 0 && (
                <span className="text-amber-600 ml-1">• {formatCurrency((summary as any)?.partnerOutstanding || 0)} outstanding</span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Transfer Status</CardDescription>
            <CardTitle className="text-2xl">{summary?.completedCount || 0} / {summary?.totalCount || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {summary?.failedCount ? <span className="text-red-500">{summary.failedCount} failed</span> : "All successful"}
              {(summary?.deferredCount || 0) > 0 && <span className="text-amber-600 ml-1">• {summary?.deferredCount} below transfer minimum</span>}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Monthly Revenue Breakdown
          </CardTitle>
          <CardDescription>Your 60% share vs Partner's 40% share over the last 12 months</CardDescription>
        </CardHeader>
        <CardContent>
          {!monthlyData || monthlyData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No monthly data yet. Chart will populate as transactions are processed.
            </p>
          ) : (
            <MonthlyRevenueChart data={monthlyData} />
          )}
        </CardContent>
      </Card>

      {/* Revenue Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>From Subscriptions</CardDescription>
            <CardTitle className="text-lg">{formatCurrency(summary?.subscriptionRevenue || 0)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Gross provider + customer subscription revenue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>From Booking Fees</CardDescription>
            <CardTitle className="text-lg">{formatCurrency(summary?.bookingFeeRevenue || 0)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Gross 1% booking-fee revenue subject to the split</p>
          </CardContent>
        </Card>
      </div>

      {/* Transfer History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Transfer History</CardTitle>
              <CardDescription>Partner revenue split transfers{dateRange !== "all" ? " (filtered)" : ""}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {transfersLoading ? (
            <LoadingSpinner />
          ) : !transfers || transfers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No transfers yet. Transfers will appear here once subscription payments or booking fees are processed.
            </p>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Total Revenue</TableHead>
                  <TableHead>Partner Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((transfer: any) => (
                  <TableRow key={transfer.id}>
                    <TableCell className="text-xs">{formatDate(transfer.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {transfer.sourceType === "provider_subscription" ? "Provider Sub" :
                         transfer.sourceType === "customer_subscription" ? "Customer Sub" :
                         "Booking Fee"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{transfer.sourceDescription}</TableCell>
                    <TableCell className="text-sm">{formatCurrency(parseFloat(transfer.totalRevenue || "0"))}</TableCell>
                    <TableCell className="text-sm font-medium">{formatCurrency(parseFloat(transfer.amount || "0"))}</TableCell>
                    <TableCell>
                      <Badge variant={
                        transfer.status === "completed" ? "default" :
                        transfer.status === "failed" ? "destructive" :
                        "secondary"
                      }>
                        {transfer.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MonthlyRevenueChart({ data }: { data: Array<{ month: string; totalRevenue: number; platformShare: number; partnerShare: number; transferCount: number }> }) {
  // Format month labels
  const chartData = data.map((d) => {
    const [year, month] = d.month.split("-");
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return {
      label: `${monthNames[parseInt(month) - 1]} ${year}`,
      platformShare: d.platformShare,
      partnerShare: d.partnerShare,
      total: d.totalRevenue,
    };
  });

  const maxValue = Math.max(...chartData.map(d => d.total), 1);

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-green-500" />
          <span className="text-muted-foreground">Your Share (60%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-blue-500" />
          <span className="text-muted-foreground">Partner Share (40%)</span>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="flex items-end gap-2 h-[200px] border-b border-l pl-1 pb-1">
        {chartData.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group relative">
            {/* Tooltip */}
            <div className="absolute bottom-full mb-2 hidden group-hover:block bg-popover text-popover-foreground border rounded-md shadow-md p-2 text-xs z-10 whitespace-nowrap">
              <p className="font-medium">{d.label}</p>
              <p className="text-green-600">You: {formatCurrency(d.platformShare)}</p>
              <p className="text-blue-600">Partner: {formatCurrency(d.partnerShare)}</p>
              <p className="text-muted-foreground">Total: {formatCurrency(d.total)}</p>
            </div>
            {/* Stacked bars */}
            <div className="w-full flex flex-col justify-end" style={{ height: `${(d.total / maxValue) * 100}%` }}>
              <div
                className="w-full bg-blue-500 rounded-t-sm"
                style={{ height: d.total > 0 ? `${(d.partnerShare / d.total) * 100}%` : "0%" }}
              />
              <div
                className="w-full bg-green-500"
                style={{ height: d.total > 0 ? `${(d.platformShare / d.total) * 100}%` : "0%" }}
              />
            </div>
            {/* Label */}
            <span className="text-[10px] text-muted-foreground truncate w-full text-center">
              {d.label.split(" ")[0]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}


// ============================================================================
// PLATFORM SETTINGS PANEL
// ============================================================================
function PlatformSettingsPanel() {
  const { data: settings, isLoading } = trpc.platformSettings.getAll.useQuery();
  const utils = trpc.useUtils();

  const [form, setForm] = useState({
    contact_phone: "",
    contact_email: "",
    contact_address: "",
    business_hours: "",
    support_email: "",
  });
  const [hasLoaded, setHasLoaded] = useState(false);

  // Populate form when settings load
  if (settings && !hasLoaded) {
    setForm({
      contact_phone: settings.contact_phone || "",
      contact_email: settings.contact_email || "",
      contact_address: settings.contact_address || "",
      business_hours: settings.business_hours || "",
      support_email: settings.support_email || "",
    });
    setHasLoaded(true);
  }

  const updateSettings = trpc.platformSettings.update.useMutation({
    onSuccess: () => {
      toast.success("Platform settings updated");
      utils.platformSettings.getAll.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSave = () => {
    updateSettings.mutate({ settings: form });
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Platform Contact Information
          </CardTitle>
          <CardDescription>
            Manage the contact details displayed on the Help Center and Contact Us page. Changes take effect immediately.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Phone Number</label>
              <Input
                value={form.contact_phone}
                onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                placeholder="(678) 525-0891"
              />
              <p className="text-xs text-muted-foreground">Displayed on the Contact Us page</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Contact Email</label>
              <Input
                value={form.contact_email}
                onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                placeholder="info@ologycrew.com"
              />
              <p className="text-xs text-muted-foreground">General contact email shown to users</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Support Email</label>
              <Input
                value={form.support_email}
                onChange={(e) => setForm({ ...form, support_email: e.target.value })}
                placeholder="support@ologycrew.com"
              />
              <p className="text-xs text-muted-foreground">Used in confirmation emails and support replies</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Business Hours</label>
              <Input
                value={form.business_hours}
                onChange={(e) => setForm({ ...form, business_hours: e.target.value })}
                placeholder="Mon-Fri 9:00 AM - 6:00 PM EST"
              />
              <p className="text-xs text-muted-foreground">Displayed alongside phone support info</p>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Business Address</label>
            <Textarea
              value={form.contact_address}
              onChange={(e) => setForm({ ...form, contact_address: e.target.value })}
              placeholder="123 Main St, Suite 100, Atlanta, GA 30301"
              rows={2}
            />
            <p className="text-xs text-muted-foreground">Physical address (optional, shown on Contact page if provided)</p>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={updateSettings.isPending}>
              {updateSettings.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
