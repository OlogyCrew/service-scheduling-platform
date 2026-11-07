import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Clock3, RefreshCw, ShieldAlert } from "lucide-react";

const DIMENSION_LABELS: Record<string, string> = {
  account: "Account",
  email: "Email identity",
  stripe_customer: "Stripe Customer",
  provider: "Provider",
  booking: "Booking",
  ip: "Network address",
};

function dateLabel(value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function PaymentSecurityPanel() {
  const utils = trpc.useUtils();
  const monitor = trpc.admin.getPaymentVelocityMonitor.useQuery(undefined, { refetchInterval: 30_000 });
  const audit = trpc.admin.getAuditLog.useQuery({ page: 1, limit: 50 });
  const release = trpc.admin.releasePaymentVelocityCooldown.useMutation({
    onSuccess: () => {
      toast.success("Cooldown released and recorded in the audit log");
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

  if (monitor.isLoading) return <LoadingSpinner message="Loading payment security monitor..." />;
  if (monitor.isError || !monitor.data) {
    return <Card><CardContent className="p-6" role="alert">Payment security monitoring is unavailable. Please try again.</CardContent></Card>;
  }

  const { rules, counters, summary } = monitor.data;
  const activeCounters = counters.filter((counter) => counter.isBlocked || counter.attemptCount > 0);

  return (
    <div className="space-y-6">
      <Card className="border-l-4 border-l-amber-500">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-amber-600" />Payment Security Monitor</CardTitle>
              <CardDescription className="mt-1">Review automated payment-attempt controls without exposing email addresses, IPs, card data, or Stripe identifiers.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => monitor.refetch()} disabled={monitor.isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${monitor.isFetching ? "animate-spin" : ""}`} />Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border bg-muted/20 p-4"><p className="text-xs text-muted-foreground">Blocked dimensions</p><p className="mt-1 text-2xl font-semibold">{summary.blockedDimensions}</p></div>
            <div className="rounded-xl border bg-muted/20 p-4"><p className="text-xs text-muted-foreground">Tracked dimensions</p><p className="mt-1 text-2xl font-semibold">{summary.trackedDimensions}</p></div>
            <div className="rounded-xl border bg-muted/20 p-4"><p className="text-xs text-muted-foreground">Attempts in view</p><p className="mt-1 text-2xl font-semibold">{summary.attemptsInView}</p></div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <Badge variant={rules.enabled ? "default" : "secondary"}>{rules.enabled ? "Automated controls on" : "Controls disabled"}</Badge>
            <span className="text-muted-foreground">{rules.windowMinutes}-minute windows · {rules.cooldownMinutes}-minute cooldowns</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Attempt history</CardTitle>
          <CardDescription>Recent counters are grouped by security dimension. Raw identifiers are intentionally not shown.</CardDescription>
        </CardHeader>
        <CardContent>
          {activeCounters.length === 0 ? (
            <div className="py-10 text-center"><CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" /><p className="mt-2 font-medium">No active payment velocity activity</p><p className="text-sm text-muted-foreground">The automated controls are ready and no counters are currently blocked.</p></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Dimension</TableHead><TableHead>Attempts</TableHead><TableHead>Rule</TableHead><TableHead>Last attempt</TableHead><TableHead>Cooldown</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                <TableBody>
                  {activeCounters.map((counter) => (
                    <TableRow key={counter.id}>
                      <TableCell className="font-medium">{DIMENSION_LABELS[counter.dimension] || counter.dimension}</TableCell>
                      <TableCell>{counter.attemptCount}</TableCell>
                      <TableCell>{counter.threshold} / window</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{dateLabel(counter.lastAttemptAt)}</TableCell>
                      <TableCell>
                        {counter.isBlocked ? <Badge variant="destructive"><Clock3 className="mr-1 h-3 w-3" />Until {dateLabel(counter.blockedUntil)}</Badge> : <Badge variant="secondary">Monitoring</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        {counter.isBlocked ? <Button variant="outline" size="sm" onClick={() => release.mutate({ counterId: counter.id })} disabled={release.isPending}>Release</Button> : <span className="text-xs text-muted-foreground">No action</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-600" />Admin override history</CardTitle><CardDescription>Every release and rule change is recorded. Block records show only the triggering dimension, never the raw subject.</CardDescription></CardHeader>
        <CardContent>
          {audit.isLoading ? <LoadingSpinner message="Loading security history..." /> : securityHistory.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No security-control audit events yet.</p> : (
            <div className="space-y-2">
              {securityHistory.slice(0, 12).map((entry: any) => (
                <div key={entry.id} className="flex flex-col gap-1 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div><p className="text-sm font-medium">{entry.action === "release_payment_velocity_cooldown" ? "Cooldown released" : entry.action === "update_payment_velocity_controls" ? "Rules updated" : "Payment velocity block recorded"}</p><p className="text-xs text-muted-foreground">{entry.actorName || `Admin #${entry.actorId}`} · {dateLabel(entry.createdAt)}</p></div>
                  <span className="text-xs text-muted-foreground">{entry.action === "payment_velocity_blocked" ? (entry.details?.dimension ? DIMENSION_LABELS[entry.details.dimension] || entry.details.dimension : "Automated control") : "Admin action"}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
