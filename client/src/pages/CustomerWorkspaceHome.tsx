import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CustomerWorkspaceShell } from "@/components/customer/CustomerWorkspaceShell";
import { CustomerEmptyState } from "@/components/workspace/CustomerEmptyState";
import { trpc } from "@/lib/trpc";
import { customerSearchHref } from "../../../shared/customerHomeLogic";
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Car,
  Check,
  ChevronRight,
  Clock3,
  FileText,
  Gift,
  Heart,
  Home,
  MapPin,
  MessageSquare,
  Paintbrush,
  ReceiptText,
  Scissors,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

const suggestions = ["Audio engineer for an event", "Mobile barber tomorrow", "House cleaning this weekend", "Website help for my business"];

const categoryFamilies = [
  { label: "Home", hint: "Cleaning, repairs, renovation", icon: Home, query: "Home services" },
  { label: "Personal care", hint: "Barbers, salon, wellness", icon: Scissors, query: "Personal care" },
  { label: "Events", hint: "Audio, DJs, photography", icon: Users, query: "Event services" },
  { label: "Auto", hint: "Detailing and maintenance", icon: Car, query: "Auto services" },
  { label: "Professional", hint: "IT, finance, coaching", icon: BriefcaseBusiness, query: "Professional services" },
  { label: "Projects", hint: "Custom and multi-day work", icon: Paintbrush, query: "Custom project" },
];

const customerTools = [
  { label: "Saved providers", href: "/saved-providers", icon: Heart },
  { label: "My quotes", href: "/my-quotes", icon: FileText },
  { label: "Receipts", href: "/receipts", icon: ReceiptText },
  { label: "Referrals", href: "/referral-program", icon: Gift },
  { label: "Plans", href: "/customer/subscription", icon: ShieldCheck },
];

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTime(value: string) {
  const [hourText, minute = "00"] = value.split(":");
  const hour = Number(hourText);
  if (!Number.isFinite(hour)) return value;
  return `${hour % 12 || 12}:${minute.slice(0, 2)} ${hour >= 12 ? "PM" : "AM"}`;
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date(year, month - 1, day));
}

function firstName(name?: string | null, explicit?: string | null) {
  return explicit || name?.split(" ")[0] || "there";
}

export default function CustomerWorkspaceHome() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [date, setDate] = useState<string | null>(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [searchLocation, setSearchLocation] = useState("");
  const [timing, setTiming] = useState("Any time");
  const { data, isLoading, error } = trpc.customerHome.get.useQuery(
    { localDate: date ?? "2000-01-01" },
    { enabled: date !== null },
  );

  useEffect(() => {
    setHasMounted(true);
    setDate(localDateKey());
    setSearchLocation([user?.billingCity, user?.billingState].filter(Boolean).join(", "));
  }, [user?.billingCity, user?.billingState]);

  const greeting = useMemo(() => {
    if (!hasMounted) return "Welcome";
    const hour = new Date().getHours();
    return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  }, [hasMounted]);

  function beginSearch(event?: FormEvent, overrideQuery?: string) {
    event?.preventDefault();
    const request = (overrideQuery ?? query).trim();
    if (!request) {
      toast.info("Tell us what you need", { description: "Try a service, project, or event in your own words." });
      return;
    }
    setLocation(customerSearchHref({ query: request, location: searchLocation, timing }));
  }

  if (isLoading) return <CustomerWorkspaceShell active="home"><CustomerHomeSkeleton /></CustomerWorkspaceShell>;

  if (error || !data) {
    return <CustomerWorkspaceShell active="home"><Card className="mx-auto mt-10 max-w-xl border-red-200 bg-red-50/60"><CardContent className="p-7 text-center"><h1 className="text-xl font-bold">We couldn’t load your customer home</h1><p className="mt-2 text-sm text-muted-foreground">Your account was not changed. You can still browse services or view your bookings.</p><div className="mt-5 flex justify-center gap-2"><Button asChild><Link href="/browse">Browse services</Link></Button><Button asChild variant="outline"><Link href="/my-bookings">My bookings</Link></Button></div></CardContent></Card></CustomerWorkspaceShell>;
  }

  const primaryAction = data.actions[0];
  const nextBooking = data.upcoming[0];

  return (
    <CustomerWorkspaceShell active="home">

      <section className="ology-customer-home-hero relative overflow-hidden rounded-[30px] bg-[#0e3c5f] px-5 py-8 text-white shadow-[0_28px_80px_-44px_rgba(14,60,95,0.9)] sm:px-8 sm:py-10 lg:px-12 lg:py-12">
        <div className="absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_16%_20%,rgba(85,189,232,0.25),transparent_30%),radial-gradient(circle_at_84%_0%,rgba(74,222,128,0.12),transparent_26%)]" />
        <div className={`relative grid items-end gap-8 ${primaryAction ? "lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.55fr)]" : ""}`}>
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-blue-50"><Sparkles className="h-3.5 w-3.5" />Find the right service without guessing the category</div>
            <p className="text-sm font-medium text-blue-200">{greeting}, {firstName(user?.name, user?.firstName)}.</p>
            <h1 className="mt-2 max-w-3xl text-3xl font-bold tracking-[-0.035em] sm:text-4xl lg:text-5xl">What do you need help with?</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100 sm:text-base">Describe the service, project, or event. We’ll help you find services to book or providers who can prepare a quote.</p>
            <form className="mt-6 rounded-2xl bg-white p-2 shadow-2xl" onSubmit={beginSearch}>
              <div className="flex items-center gap-2"><Search className="ml-2 h-5 w-5 shrink-0 text-slate-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try “audio engineer for a church event”" className="h-12 border-0 bg-transparent px-1 text-base text-slate-950 shadow-none focus-visible:ring-0" aria-label="Describe the service you need" /><Button type="submit" size="lg" className="hidden h-11 shrink-0 bg-[#156a9a] px-5 hover:bg-[#105b86] sm:inline-flex">Find services</Button></div>
              <div className="grid gap-2 border-t border-slate-100 pt-2 sm:grid-cols-[1fr_1fr_auto]">
                <label className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"><MapPin className="h-4 w-4 text-[#156a9a]" /><span className="sr-only">Location</span><input value={searchLocation} onChange={(event) => setSearchLocation(event.target.value)} placeholder="City or ZIP" className="min-w-0 flex-1 bg-transparent outline-none" /></label>
                <label className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"><CalendarDays className="h-4 w-4 text-[#156a9a]" /><span className="sr-only">When</span><select value={timing} onChange={(event) => setTiming(event.target.value)} className="min-w-0 flex-1 bg-transparent outline-none"><option>Any time</option><option>Today</option><option>Tomorrow</option><option>This weekend</option><option>Choose a date</option></select></label>
                <Button type="submit" className="h-11 bg-[#156a9a] hover:bg-[#105b86] sm:hidden">Find services</Button>
              </div>
            </form>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-blue-100"><span className="font-semibold">Try:</span>{suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => setQuery(suggestion)} className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 transition-colors hover:bg-white/20">{suggestion}</button>)}</div>
          </div>

          {primaryAction ? <div className="ology-customer-home-primary-action rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-300 text-amber-950">{primaryAction.kind === "quote" ? <Clock3 className="h-5 w-5" /> : <Star className="h-5 w-5" />}</span><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-200">Needs your action</p><p className="font-semibold">{primaryAction.title}</p></div></div><p className="mt-4 text-sm leading-6 text-blue-50">{primaryAction.detail}</p><Button asChild className="mt-4 w-full bg-white text-[#174a73] hover:bg-blue-50"><Link href={primaryAction.href}>{primaryAction.actionLabel}<ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div> : null}
        </div>
      </section>

      <div className="ology-customer-home-content">
      {data.actions.length > 1 ? <section className="mt-7"><div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Waiting for you</p><h2 className="mt-1 text-2xl font-bold tracking-tight">Needs your action</h2></div><span className="rounded-full border bg-white px-2.5 py-1 text-xs text-slate-600">{data.actions.length} open</span></div><div className="grid gap-3 md:grid-cols-2">{data.actions.slice(1).map((action) => <Link key={action.id} href={action.href} title={action.actionLabel} className="group flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">{action.kind === "quote" ? <Clock3 className="h-5 w-5" /> : <Star className="h-5 w-5" />}</span><span className="min-w-0 flex-1"><span className="block font-semibold text-slate-950">{action.title}</span><span className="mt-0.5 block truncate text-sm text-slate-600">{action.detail}</span></span><ChevronRight className="h-5 w-5 text-slate-400 transition-transform group-hover:translate-x-0.5" /></Link>)}</div></section> : !primaryAction ? <div className="mt-6 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Check className="h-5 w-5" /></span><div><p className="font-semibold text-emerald-950">You’re all caught up</p><p className="text-sm text-emerald-800">No quotes or completed services need your response.</p></div></div> : null}

      <div className="mt-7 grid gap-7 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <section aria-labelledby="upcoming-heading"><div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Your next service</p><h2 id="upcoming-heading" className="mt-1 text-2xl font-bold tracking-tight">Upcoming</h2></div><Link href="/my-bookings" className="text-sm font-semibold text-[#174a73] hover:underline">View all</Link></div>{nextBooking ? <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_55px_-38px_rgba(15,23,42,0.55)]"><div className="grid md:grid-cols-[176px_minmax(0,1fr)]"><div className="ology-customer-upcoming-date flex min-h-36 flex-col justify-between bg-[#dff3fb] p-5 text-[#123f63]"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/80"><CalendarDays className="h-5 w-5" /></div><div><p className="text-3xl font-bold">{Number(nextBooking.bookingDate.slice(-2))}</p><p className="text-sm font-semibold">{formatDate(nextBooking.bookingDate)}</p><p className="mt-1 text-xs">{formatTime(nextBooking.startTime)} start</p></div></div><div className="p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${nextBooking.status === "confirmed" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{nextBooking.status === "confirmed" ? "Confirmed" : nextBooking.status === "in_progress" ? "In progress" : "Awaiting confirmation"}</span><h3 className="mt-3 text-xl font-bold">{nextBooking.serviceName}</h3><p className="mt-1 text-sm text-slate-600">{nextBooking.providerName}{nextBooking.venueName ? ` · ${nextBooking.venueName}` : nextBooking.city ? ` · ${nextBooking.city}${nextBooking.state ? `, ${nextBooking.state}` : ""}` : ""}</p></div><div className="text-right"><p className="text-lg font-bold">${nextBooking.totalAmount.toFixed(2)}</p><p className="text-xs text-slate-500">Booking total</p></div></div><div className="mt-6 flex flex-wrap gap-2"><Button asChild><Link href={nextBooking.detailHref}>View booking</Link></Button><Button asChild variant="outline" className="bg-white"><Link href={nextBooking.messageHref}><MessageSquare className="mr-2 h-4 w-4" />Message</Link></Button></div></div></div></article> : <CustomerEmptyState icon={CalendarDays} title="No upcoming bookings" description="Describe what you need above or browse services to get started." action={{ href: "/browse", label: "Browse services" }} />}</section>

        <section aria-labelledby="rebook-heading"><div className="mb-3"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-700">Your service relationships</p><h2 id="rebook-heading" className="mt-1 text-2xl font-bold tracking-tight">Book again</h2></div>{data.rebook.length > 0 ? <div className="space-y-3">{data.rebook.map((item) => <article key={`${item.providerId}-${item.serviceId}`} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#153f61] text-sm font-bold text-white">{item.providerName.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><div className="min-w-0 flex-1"><h3 className="truncate font-semibold">{item.providerName}</h3><p className="truncate text-sm text-slate-600">{item.serviceName}</p><p className="mt-0.5 truncate text-xs text-slate-400">Last booked {formatDate(item.lastBookedDate)}{(item.providerReviewCount || 0) > 0 ? ` · ${item.providerRating.toFixed(1)} ★` : ""}</p></div><Button asChild size="sm" variant="outline" className="bg-white"><Link href={item.href} title={`Book ${item.serviceName} with ${item.providerName} again`}>Rebook</Link></Button></article>)}</div> : <CustomerEmptyState icon={Clock3} title="Your trusted providers will appear here" description="After a service is completed, you can return to the same provider in one tap." />}</section>
      </div>

      <section className="mt-9" aria-labelledby="explore-heading"><div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Browse without the long directory</p><h2 id="explore-heading" className="mt-1 text-2xl font-bold tracking-tight">Explore by need</h2><p className="mt-1 text-sm text-slate-500">Start broad, then refine by place, time, and service type.</p></div><Link href="/browse" className="self-start text-sm font-semibold text-[#174a73] hover:underline">View all categories</Link></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{categoryFamilies.map((category) => { const Icon = category.icon; return <button key={category.label} type="button" title={`Search ${category.hint}`} onClick={() => beginSearch(undefined, category.query)} className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md active:scale-[0.99]"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-[#156a9a]"><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block font-semibold">{category.label}</span><span className="mt-0.5 block text-xs text-slate-500">{category.hint}</span></span><ChevronRight className="h-5 w-5 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-600" /></button>; })}</div></section>

      <section className="ology-customer-home-tools mt-9 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Everything else stays close</p><h2 className="mt-1 text-xl font-bold">Your tools</h2><p className="mt-1 text-sm text-slate-500">Advanced tools remain available without competing with your next task.</p></div></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">{customerTools.map((tool) => { const Icon = tool.icon; return <Link key={tool.href} href={tool.href} title={`Open ${tool.label}`} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-blue-50 hover:text-[#174a73]"><Icon className="h-4 w-4" />{tool.label}</Link>; })}</div></section>

      <section className="ology-customer-home-trust mt-5 grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 sm:grid-cols-3 sm:p-6"><TrustPoint icon={ShieldCheck} title="Know what is verified" detail="See identity, business, insurance, and completed-work signals separately." /><TrustPoint icon={Star} title="Reviews tied to real work" detail="Verified reviews are connected to completed OlogyCrew bookings." /><TrustPoint icon={Building2} title="Keep the relationship" detail="Return to the same provider, details, messages, and receipts in one place." /></section>

      </div>
    </CustomerWorkspaceShell>
  );
}

function TrustPoint({ icon: Icon, title, detail }: { icon: typeof ShieldCheck; title: string; detail: string }) {
  return <div className="flex gap-3 rounded-2xl bg-slate-50 p-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#156a9a] shadow-sm"><Icon className="h-5 w-5" /></span><div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p></div></div>;
}

function CustomerHomeSkeleton() {
  return <div className="animate-pulse"><div className="h-80 rounded-[30px] bg-slate-200" /><div className="mt-7 grid gap-7 xl:grid-cols-2"><div className="h-72 rounded-3xl bg-slate-100" /><div className="h-72 rounded-3xl bg-slate-100" /></div><div className="mt-7 h-64 rounded-3xl bg-slate-100" /></div>;
}
