import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Clock3, RefreshCw, ShieldAlert } from "lucide-react";

const DIMENSION_LABELS: Record<string, string> = {
  account: "Account",
  email: "Email identity",
  stripe_customer: "Stripe Customer",
  provider: "Provider",
  booking: "Booking",
  ip: "Network address",
};
const DIMENSIONS = Object.keys(DIMENSION_LABELS);
const RULES = DIMENSIONS.map((dimension) => ({ value: `${dimension}_attempt_threshold`, label: `${DIMENSION_LABELS[dimension]} attempt threshold` }));

function dateLabel(value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function PaymentSecurityPanel() {
  const utils = trpc.useUtils();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dimension, setDimension] = useState("all");
  const [status, setStatus] = useState<"all" | "blocked" | "monitoring">("all");
  const [rule, setRule] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedCounter, setSelectedCounter] = useState<any | null>(null);
  const [reason, setReason] = useState("");

  const queryInput = useMemo(() => ({
    startDate: startDate ? new Date(`${startDate}T00:00:00`) : undefined,
    endDate: endDate ? new Date(`${endDate}T23:59:59.999`) : undefined,
    dimension: dimension !== "all" ? dimension as any : undefined,
    status,
    rule: rule !== "all" ? rule as any : undefined,
    page,
    limit: 25,
  }), [startDate, endDate, dimension, status, rule, page]);

  const monitor = trpc.admin.getPaymentVelocityMonitor.useQuery(queryInput, { refetchInterval: 30_000 });
  const audit = trpc.admin.getAuditLog.useQuery({ page: 1, limit: 50 });
  const release = trpc.admin.releasePaymentVelocityCooldown.useMutation({
    onSuccess: () => {
      toast.success("Cooldown released and recorded in the audit log");
      setSelectedCounter(null);
      setReason("");
      utils.admin.getPaymentVelocityMonitor.invalidate();
      utils.admin.getAuditLog.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const securityHistory = useMemo(() =>
    (audit.data?.entries || []).filter((entry: any) =>
      entry.action === "payment_velocity_blocked" ||
      entry.action === "release_payment_velocity_cooldown" ||
      entry.action === "update_payment_velocity_controls"
    ), [audit.data?.entries]);

  const resetFilters = () => {
    setStartDate(""); setEndDate(""); setDimension("all"); setStatus("all"); setRule("all"); setPage(1);
  };
  const hasFilters = !!startDate || !!endDate || dimension !== "all" || status !== "all" || rule !== "all";
  const submitRelease = () => {
    if (!selectedCounter || !reason.trim()) {
      toast.error("Enter a reason before releasing this cooldown");
      return;
    }
    release.mutate({
      counterId: selectedCounter.id,
      expectedUpdatedAt: new Date(selectedCounter.updatedAt),
      expectedBlockedUntil: new Date(selectedCounter.blockedUntil),
      reason: reason.trim(),
    });
  };

  if (monitor.isLoading) return <LoadingSpinner message="Loading payment security monitor..." />;
  if (monitor.isError || !monitor.data) {
    return <Card><CardContent className="p-6" role="alert">Payment security monitoring is unavailable. Please try again.</CardContent></Card>;
  }

  const { rules, counters, summary, pagination } = monitor.data;
  return (
    <div className="space-y-6">
      <Card className="border-l-4 border-l-amber-500">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-amber-600" />Payment Security Monitor</CardTitle>
              <CardDescription className="mt-1">Review automated payment-attempt controls without exposing email addresses, IPs, card data, or Stripe identifiers.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => monitor.refetch()} disabled={monitor.isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${monitor.isFetching ? "animate-spin" : ""}`} />Refresh</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border bg-muted/20 p-4"><p className="text-xs text-muted-foreground">Blocked in page</p><p className="mt-1 text-2xl font-semibold">{summary.blockedDimensions}</p></div>
            <div className="rounded-xl border bg-muted/20 p-4"><p className="text-xs text-muted-foreground">Matching dimensions</p><p className="mt-1 text-2xl font-semibold">{summary.trackedDimensions}</p></div>
            <div className="rounded-xl border bg-muted/20 p-4"><p className="text-xs text-muted-foreground">Attempts in page</p><p className="mt-1 text-2xl font-semibold">{summary.attemptsInView}</p></div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm"><Badge variant={rules.enabled ? "default" : "secondary"}>{rules.enabled ? "Automated controls on" : "Controls disabled"}</Badge><span className="text-muted-foreground">{rules.windowMinutes}-minute windows · {rules.cooldownMinutes}-minute cooldowns</span></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>Filters</CardTitle><CardDescription>Filters run on the server and return only privacy-safe counter summaries.</CardDescription></div>{hasFilters && <Button variant="ghost" size="sm" onClick={resetFilters}>Clear filters</Button>}</div></CardHeader>
        <CardContent><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-sm"><span className="mb-1 block text-muted-foreground">From date</span><Input type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); setPage(1); }} /></label>
          <label className="text-sm"><span className="mb-1 block text-muted-foreground">To date</span><Input type="date" value={endDate} onChange={(event) => { setEndDate(event.target.value); setPage(1); }} /></label>
          <div className="text-sm"><span className="mb-1 block text-muted-foreground">Security dimension</span><Select value={dimension} onValueChange={(value) => { setDimension(value); setPage(1); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All dimensions</SelectItem>{DIMENSIONS.map((value) => <SelectItem key={value} value={value}>{DIMENSION_LABELS[value]}</SelectItem>)}</SelectContent></Select></div>
          <div className="text-sm"><span className="mb-1 block text-muted-foreground">Status</span><Select value={status} onValueChange={(value) => { setStatus(value as typeof status); setPage(1); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="blocked">Blocked payment attempts</SelectItem><SelectItem value="monitoring">Monitoring only</SelectItem></SelectContent></Select></div>
          <div className="text-sm"><span className="mb-1 block text-muted-foreground">Triggered rule</span><Select value={rule} onValueChange={(value) => { setRule(value); setPage(1); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All rules</SelectItem>{RULES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
        </div></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Attempt history</CardTitle><CardDescription>“Blocked” means a payment attempt was stopped by a velocity cooldown. It is not an account suspension. Account is one possible rule scope, but it does not disable the user account. Raw identifiers are intentionally not shown.</CardDescription></CardHeader>
        <CardContent>
          {counters.length === 0 ? <div className="py-10 text-center"><CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" /><p className="mt-2 font-medium">No matching payment security activity</p><p className="text-sm text-muted-foreground">Try widening the filters or check back after new payment attempts.</p></div> : <>
            <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Rule scope</TableHead><TableHead>Status</TableHead><TableHead>Attempts</TableHead><TableHead>Threshold</TableHead><TableHead>Last attempt</TableHead><TableHead>Restriction</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader><TableBody>
              {counters.map((counter) => <TableRow key={counter.id}>
                <TableCell><p className="font-medium">{DIMENSION_LABELS[counter.dimension] || counter.dimension}</p><p className="text-xs text-muted-foreground">{counter.restrictionScope}</p><p className="text-xs text-muted-foreground">{counter.triggeredRule}</p></TableCell>
                <TableCell>{counter.isBlocked ? <Badge variant="destructive">Blocked attempt</Badge> : <Badge variant="secondary">Monitoring</Badge>}</TableCell>
                <TableCell>{counter.attemptCount}</TableCell><TableCell>{counter.threshold} / window</TableCell><TableCell className="whitespace-nowrap text-muted-foreground">{dateLabel(counter.lastAttemptAt)}</TableCell>
                <TableCell>{counter.isBlocked ? <Badge variant="destructive"><Clock3 className="mr-1 h-3 w-3" />Until {dateLabel(counter.blockedUntil)}</Badge> : <span className="text-xs text-muted-foreground">No active cooldown</span>}</TableCell>
                <TableCell className="text-right">{counter.isBlocked ? <Button variant="outline" size="sm" onClick={() => { setSelectedCounter(counter); setReason(""); }} disabled={release.isPending}>Review release</Button> : <span className="text-xs text-muted-foreground">No action</span>}</TableCell>
              </TableRow>)}
            </TableBody></Table></div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">Showing {pagination.total === 0 ? 0 : ((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}</p><div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1 || monitor.isFetching}><ChevronLeft className="h-4 w-4" />Previous</Button><span className="text-sm text-muted-foreground">Page {pagination.page} of {Math.max(1, pagination.totalPages)}</span><Button variant="outline" size="sm" onClick={() => setPage((value) => value + 1)} disabled={page >= pagination.totalPages || monitor.isFetching}>Next<ChevronRight className="h-4 w-4" /></Button></div></div>
          </>}
        </CardContent>
      </Card>

      <Card><CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-600" />Admin override history</CardTitle><CardDescription>Every release records the administrator, timestamp, reason, restriction type, verified state, and outcome.</CardDescription></CardHeader><CardContent>{audit.isLoading ? <LoadingSpinner message="Loading security history..." /> : securityHistory.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No security-control audit events yet.</p> : <div className="space-y-2">{securityHistory.slice(0, 12).map((entry: any) => <div key={entry.id} className="rounded-lg border p-3"><div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm font-medium">{entry.action === "release_payment_velocity_cooldown" ? "Cooldown released" : entry.action === "update_payment_velocity_controls" ? "Rules updated" : "Payment velocity block recorded"}</p><p className="text-xs text-muted-foreground">{entry.actorName || `Admin #${entry.actorId}`} · {dateLabel(entry.createdAt)}</p></div>{entry.details?.reason && <p className="mt-1 text-sm text-muted-foreground">Reason: {entry.details.reason}</p>}<p className="mt-1 text-xs text-muted-foreground">{entry.details?.restrictionType || "Automated payment-attempt control"} · {entry.details?.outcome || "recorded"}</p></div>)}</div>}</CardContent></Card>

      <Dialog open={!!selectedCounter} onOpenChange={(open) => { if (!open && !release.isPending) { setSelectedCounter(null); setReason(""); } }}><DialogContent><DialogHeader><DialogTitle>Review payment-attempt cooldown</DialogTitle><DialogDescription>This releases only the displayed payment-attempt cooldown. It does not unsuspend an account, change Stripe, or override another security rule. The current restriction state will be verified again when you submit.</DialogDescription></DialogHeader><div className="rounded-lg bg-muted/40 p-3 text-sm"><p><strong>Scope:</strong> {selectedCounter ? selectedCounter.restrictionScope : "—"}</p><p><strong>Expires:</strong> {selectedCounter ? dateLabel(selectedCounter.blockedUntil) : "—"}</p></div><label className="text-sm"><span className="mb-1 block font-medium">Reason <span className="text-destructive">*</span></span><Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain why this cooldown is being released" maxLength={500} /></label><DialogFooter><Button variant="outline" onClick={() => setSelectedCounter(null)} disabled={release.isPending}>Cancel</Button><Button onClick={submitRelease} disabled={release.isPending || reason.trim().length < 3}>{release.isPending ? "Verifying…" : "Release cooldown"}</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
