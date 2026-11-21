import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProviderWorkspaceShell } from "@/components/provider/ProviderWorkspaceShell";
import { ProviderBusinessProfileDialog } from "@/components/provider/ProviderBusinessProfileDialog";
import { ProviderSetupChecklist } from "@/components/provider/ProviderSetupChecklist";
import { ProviderPulseStat } from "@/components/workspace/ProviderPulseStat";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  BriefcaseBusiness,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  FileText,
  MessageSquare,
  Pencil,
  Plus,
  ReceiptText,
  Share2,
  Star,
  Store,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import "./ProviderWorkspaceOverview.css";

const attentionIcons = {
  booking: CalendarClock,
  quote: MessageSquare,
  invoice: ReceiptText,
  setup: AlertCircle,
};

const attentionStyles = {
  critical: { wrap: "border-red-200 bg-red-50/70", icon: "bg-red-100 text-red-700", badge: "bg-red-100 text-red-700" },
  time: { wrap: "border-amber-200 bg-amber-50/60", icon: "bg-amber-100 text-amber-700", badge: "bg-amber-100 text-amber-700" },
  operational: { wrap: "border-slate-200 bg-white", icon: "bg-slate-100 text-slate-700", badge: "bg-slate-100 text-slate-600" },
};

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function relativeAge(value: string | Date) {
  const deltaMinutes = Math.round((new Date(value).getTime() - Date.now()) / 60000);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (Math.abs(deltaMinutes) < 60) return formatter.format(deltaMinutes, "minute");
  const deltaHours = Math.round(deltaMinutes / 60);
  if (Math.abs(deltaHours) < 24) return formatter.format(deltaHours, "hour");
  return formatter.format(Math.round(deltaHours / 24), "day");
}

function formatTime(value: string | null) {
  if (!value) return "Time pending";
  const [hourText, minute = "00"] = value.split(":");
  const hour = Number(hourText);
  if (!Number.isFinite(hour)) return value;
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${minute.slice(0, 2)} ${suffix}`;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export default function ProviderWorkspaceOverview() {
  const { user } = useAuth();
  const [shared, setShared] = useState(false);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [date, setDate] = useState<string | null>(null);
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
    setDate(localDateKey());
  }, []);
  const { data, isLoading, error } = trpc.providerOverview.get.useQuery(
    { localDate: date ?? "2000-01-01" },
    { enabled: date !== null },
  );
  const { data: customersAccess } = trpc.customers.getAccess.useQuery();
  const firstName = user?.firstName || user?.name?.split(" ")[0] || "there";
  const todayLabel = useMemo(
    () => hasMounted
      ? new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date())
      : "Today",
    [hasMounted],
  );

  async function sharePage() {
    if (!data?.provider.profileSlug) {
      toast.info("Create your public page link first");
      return;
    }
    const url = `https://ologycrew.com/${data.provider.profileSlug}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: data.provider.businessName, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
      setShared(true);
      toast.success("Public page ready to share", { description: url });
    } catch (shareError) {
      if ((shareError as Error)?.name !== "AbortError") {
        await navigator.clipboard.writeText(url);
        setShared(true);
        toast.success("Public page link copied", { description: url });
      }
    }
  }

  if (isLoading) return <ProviderWorkspaceSkeleton />;

  if (error) {
    return (
      <Card className="mx-auto mt-10 max-w-xl border-red-200 bg-red-50/60">
        <CardContent className="p-6 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-red-600" />
          <h1 className="mt-3 text-xl font-bold">We couldn’t load your workspace</h1>
          <p className="mt-2 text-sm text-muted-foreground">Your account data was not changed. Refresh the page or open the existing dashboard.</p>
          <Button asChild className="mt-5"><Link href="/provider/dashboard">Open dashboard</Link></Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="mx-auto mt-10 max-w-xl">
        <CardContent className="p-7 text-center">
          <Store className="mx-auto h-9 w-9 text-primary" />
          <h1 className="mt-3 text-xl font-bold">Create your provider profile</h1>
          <p className="mt-2 text-sm text-muted-foreground">Complete your provider setup before opening the business workspace.</p>
          <Button asChild className="mt-5"><Link href="/provider/onboarding">Continue setup</Link></Button>
        </CardContent>
      </Card>
    );
  }

  const requestCount = data.attention.filter((item) => item.kind === "booking" || item.kind === "quote").length;

  return (
    <>
    <ProviderWorkspaceShell
      active="overview"
      businessName={data.provider.businessName}
      profileSlug={data.provider.profileSlug}
      isPageLive={data.provider.isPageLive}
      customersVisible={customersAccess?.visible}
      bookingBadgeCount={requestCount}
      contentClassName="ology-provider-overview-content"
    >
          <section className="ology-provider-hero relative overflow-hidden rounded-[28px] px-5 py-6 text-white sm:px-8 sm:py-8">
            <div className="ology-provider-hero-ornament absolute -right-16 -top-20 h-56 w-56 rounded-full" aria-hidden="true" />
            <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <div className="ology-provider-hero-status mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium">
                  <span className={`h-2 w-2 rounded-full ${data.provider.isPageLive ? "bg-emerald-400" : "bg-amber-400"}`} />
                  {data.provider.isPageLive ? "Your page is live and bookable" : "Your public page needs attention"}
                </div>
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{hasMounted ? greeting() : "Welcome"}, {firstName}.</h1>
                <p className="ology-provider-hero-copy mt-2 max-w-2xl text-sm sm:text-base">
                  {requestCount > 0 ? `You have ${requestCount} customer ${requestCount === 1 ? "request" : "requests"} to review` : "You’re caught up on customer requests"}
                  {data.today.length > 0 ? ` and ${data.today.length} ${data.today.length === 1 ? "service" : "services"} scheduled today.` : "."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="ology-provider-hero-secondary" onClick={() => setProfileEditorOpen(true)}>
                  <Pencil className="mr-2 h-4 w-4" />Edit Profile
                </Button>
                <Button asChild className="ology-provider-hero-primary">
                  <Link href="/my-bookings" aria-label="Open My Bookings">
                    <CalendarDays className="mr-2 h-4 w-4" />Bookings
                  </Link>
                </Button>
              </div>
            </div>
          </section>

          <ProviderSetupChecklist setup={data.setup} onEditProfile={() => setProfileEditorOpen(true)} />

          <section className="mt-6" aria-labelledby="attention-heading">
            <div className="mb-3 flex items-end justify-between gap-4">
              <div><p className="ology-provider-kicker ology-provider-kicker-alert text-xs font-semibold uppercase tracking-[0.16em]">Prioritized for you</p><h2 id="attention-heading" className="ology-provider-section-title mt-1 text-xl font-bold tracking-tight sm:text-2xl">Needs attention</h2></div>
              <span className="ology-provider-count rounded-full border px-2.5 py-1 text-xs">{data.attention.length} open</span>
            </div>
            {data.attention.length > 0 ? (
              <div className="grid gap-3">
                {data.attention.map((item) => {
                  const Icon = attentionIcons[item.kind];
                  const styles = attentionStyles[item.tone];
                  return (
                    <Link key={item.id} href={item.href} data-tone={item.tone} className={`ology-provider-attention-item group flex items-center gap-3 rounded-2xl border p-3 text-left transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99] sm:gap-4 sm:p-4 ${styles.wrap}`}>
                      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${styles.icon}`}><Icon className="h-5 w-5" /></span>
                      <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="font-semibold text-slate-950">{item.title}</span><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${styles.badge}`}>{hasMounted ? relativeAge(item.timestamp) : "Recent"}</span></span><span className="mt-1 block text-sm text-slate-600">{item.detail}</span></span>
                      <span className="ology-provider-attention-action hidden items-center gap-2 text-sm font-semibold sm:flex">{item.actionLabel}<ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
                      <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 sm:hidden" />
                    </Link>
                  );
                })}
              </div>
            ) : (
              <Card className="ology-provider-caughtup shadow-sm"><CardContent className="flex items-center gap-3 p-5"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Check className="h-5 w-5" /></span><div><p className="font-semibold text-emerald-950">You are caught up</p><p className="text-sm text-emerald-800">Nothing needs your response right now.</p></div></CardContent></Card>
            )}
          </section>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <section className="ology-provider-panel rounded-3xl border p-5 sm:p-6" aria-labelledby="today-heading">
              <div className="flex items-start justify-between gap-4"><div><p className="ology-provider-kicker text-xs font-semibold uppercase tracking-[0.16em]">{todayLabel}</p><h2 id="today-heading" className="mt-1 text-xl font-bold">Today</h2></div><Button asChild variant="ghost" size="sm"><Link href="/provider/calendar">Open calendar<ArrowRight className="ml-1.5 h-4 w-4" /></Link></Button></div>
              {data.today.length > 0 ? <><div className="mt-5 space-y-1">{data.today.map((item, index) => <div key={item.id} className="relative grid grid-cols-[74px_14px_minmax(0,1fr)] gap-3 pb-5 last:pb-0"><p className="pt-0.5 text-sm font-semibold text-slate-700">{formatTime(item.time)}</p><div className="relative flex justify-center"><span className={`z-10 mt-1.5 h-3 w-3 rounded-full ring-4 ring-white ${item.status === "pending" ? "bg-amber-500" : "bg-emerald-500"}`} />{index < data.today.length - 1 ? <span className="absolute bottom-[-8px] top-3 w-px bg-slate-200" /> : null}</div><Link href={item.href} className="rounded-xl p-2 text-left hover:bg-slate-50"><p className="font-semibold text-slate-950">{item.title}</p><p className="mt-0.5 text-sm text-slate-500">{item.customerName}{item.venueName ? ` · ${item.venueName}` : item.city ? ` · ${item.city}${item.state ? `, ${item.state}` : ""}` : ""}</p></Link></div>)}</div><div className={`mt-5 flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${data.todayHasConflict ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}>{data.todayHasConflict ? <AlertCircle className="h-4 w-4" /> : <Check className="h-4 w-4" />}{data.todayHasConflict ? "Two bookings overlap. Review your calendar before confirming." : "No schedule conflicts detected today."}</div></> : <div className="mt-5 rounded-2xl border border-dashed border-slate-200 p-6 text-center"><CalendarDays className="mx-auto h-7 w-7 text-slate-400" /><p className="mt-2 font-semibold text-slate-800">No services scheduled today</p><p className="mt-1 text-sm text-slate-500">Your confirmed bookings will appear here automatically.</p></div>}
            </section>

            <section className="ology-provider-panel rounded-3xl border p-5 sm:p-6" aria-labelledby="quick-heading">
              <p className="ology-provider-kicker text-xs font-semibold uppercase tracking-[0.16em]">Common tasks</p><h2 id="quick-heading" className="mt-1 text-xl font-bold">Quick actions</h2><p className="mt-1 text-sm text-slate-600">Go directly to the tools providers use most.</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <QuickAction href="/provider/services/new" icon={Plus} label="Add service" detail="Publish an offer" />
                <QuickAction href="/provider/availability" icon={Clock3} label="Block time" detail="Protect your calendar" />
                <QuickAction href={data.canUseInvoices ? "/provider/invoices" : "/provider/subscription"} icon={FileText} label={data.canUseInvoices ? "Send invoice" : "Unlock invoices"} detail={data.canUseInvoices ? "Request payment" : "View provider plans"} />
                <button type="button" title="Copy or share your public OlogyCrew business link" onClick={sharePage} className="ology-provider-action group rounded-2xl border p-3 text-left transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] sm:p-4"><span className={`ology-provider-action-icon flex h-10 w-10 items-center justify-center rounded-xl ${shared ? "bg-emerald-100 text-emerald-700" : "bg-blue-50 text-[#174a73]"}`}>{shared ? <Check className="h-5 w-5" /> : <Share2 className="h-5 w-5" />}</span><span className="mt-3 block text-sm font-semibold text-slate-950">{shared ? "Link copied" : "Share page"}</span><span className="mt-0.5 block text-xs leading-snug text-slate-500">Copy your business link</span></button>
              </div>
            </section>
          </div>

          <section className="ology-provider-panel mt-6 rounded-3xl border p-5 sm:p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="ology-provider-kicker text-xs font-semibold uppercase tracking-[0.16em]">Business pulse</p><h2 className="mt-1 text-xl font-bold">This month at a glance</h2></div><Link href="/provider/analytics" className="ology-provider-text-link self-start text-sm font-semibold hover:underline">View analytics</Link></div>
            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <ProviderPulseStat icon={Banknote} label="Collected" value={formatMoney(data.pulse.collectedThisMonth)} detail="Completed services this month" />
              <ProviderPulseStat icon={BriefcaseBusiness} label="Completed jobs" value={String(data.pulse.completedThisMonth)} detail={`${data.pulse.upcomingCount} upcoming`} />
              {customersAccess?.visible ? <Link href="/provider/customers" className="rounded-2xl"><ProviderPulseStat icon={Users} label="Customers" value={String(data.pulse.totalCustomers)} detail={`${data.pulse.returningCustomers} returning · Open Customers`} /></Link> : <ProviderPulseStat icon={Users} label="Customers" value={String(data.pulse.totalCustomers)} detail={`${data.pulse.returningCustomers} returning`} />}
              <ProviderPulseStat icon={Star} label="Average rating" value={data.pulse.totalReviews > 0 ? data.pulse.averageRating.toFixed(1) : "New"} detail={`${data.pulse.totalReviews} ${data.pulse.totalReviews === 1 ? "review" : "reviews"}`} />
            </div>
          </section>
    </ProviderWorkspaceShell>
    <ProviderBusinessProfileDialog open={profileEditorOpen} onOpenChange={setProfileEditorOpen} />
    </>
  );
}

function QuickAction({ href, icon: Icon, label, detail }: { href: string; icon: typeof Plus; label: string; detail: string }) {
  return <Link href={href} title={`${label}: ${detail}`} className="ology-provider-action group rounded-2xl border p-3 text-left transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 active:scale-[0.98] sm:p-4"><span className="ology-provider-action-icon flex h-10 w-10 items-center justify-center rounded-xl"><Icon className="h-5 w-5" /></span><span className="mt-3 block text-sm font-semibold text-slate-950">{label}</span><span className="mt-0.5 block text-xs leading-snug text-slate-600">{detail}</span></Link>;
}


function ProviderWorkspaceSkeleton() {
  return <div className="container max-w-7xl py-8"><div className="grid animate-pulse gap-6 lg:grid-cols-[232px_minmax(0,1fr)]"><div className="hidden h-96 rounded-2xl bg-slate-100 lg:block" /><div><div className="h-44 rounded-[28px] bg-slate-200" /><div className="mt-6 space-y-3"><div className="h-20 rounded-2xl bg-slate-100" /><div className="h-20 rounded-2xl bg-slate-100" /></div><div className="mt-6 grid gap-6 xl:grid-cols-2"><div className="h-72 rounded-3xl bg-slate-100" /><div className="h-72 rounded-3xl bg-slate-100" /></div></div></div></div>;
}
