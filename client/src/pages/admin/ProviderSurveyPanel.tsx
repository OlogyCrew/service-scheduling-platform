import { useState } from "react";
import type { ReactNode } from "react";
import { ClipboardList, Mail, RefreshCw, Send, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export function ProviderSurveyPanel() {
  const utils = trpc.useUtils();
  const { data, isLoading, refetch, isFetching } = trpc.providerSurvey.getDashboard.useQuery();
  const prepare = trpc.providerSurvey.prepareCampaign.useMutation({
    onSuccess: (result) => { toast.success(`Survey prepared for ${result.eligibleRecipients} opted-in providers.`); utils.providerSurvey.getDashboard.invalidate(); },
    onError: (error) => toast.error(error.message),
  });
  const send = trpc.providerSurvey.sendCampaign.useMutation({
    onSuccess: (result) => { toast.success(`Survey send complete: ${result.sent} sent, ${result.failed} failed.`); utils.providerSurvey.getDashboard.invalidate(); },
    onError: (error) => toast.error(error.message),
  });
  const [confirmation, setConfirmation] = useState("");

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading survey workspace…</p>;
  const campaign = data?.campaign;
  const recipientCount = data?.recipients.length ?? 0;
  const sentCount = data?.recipients.filter((recipient) => recipient.status === "sent" || recipient.status === "responded").length ?? 0;
  const responseCount = data?.responses.length ?? 0;

  return <div className="space-y-6">
    <Card className="border-[#cbd9c0] bg-[#f3f5ed]">
      <CardHeader>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><CardTitle className="flex items-center gap-2 text-[#123f3b]"><ClipboardList className="h-5 w-5" />Provider experience survey</CardTitle><CardDescription className="mt-2 max-w-2xl">A neutral, optional survey to learn how providers use OlogyCrew. Only providers who opted into marketing email are eligible. Responses stay in this admin workspace.</CardDescription></div><Button variant="outline" onClick={() => refetch()} disabled={isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />Refresh</Button></div>
      </CardHeader>
      <CardContent>
        {!campaign ? <div className="flex flex-col gap-3 rounded-xl border border-dashed bg-white/60 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">No campaign prepared</p><p className="text-sm text-muted-foreground">Preparing creates private tokenized links but does not send email.</p></div><Button onClick={() => prepare.mutate()} disabled={prepare.isPending}><ClipboardList className="mr-2 h-4 w-4" />Prepare survey</Button></div> : <div className="space-y-5"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{campaign.status}</Badge><span className="text-sm text-muted-foreground">{campaign.name}</span></div><div className="grid gap-3 sm:grid-cols-3"><Metric icon={<Users className="h-4 w-4" />} label="Eligible recipients" value={recipientCount} /><Metric icon={<Mail className="h-4 w-4" />} label="Sent" value={sentCount} /><Metric icon={<ClipboardList className="h-4 w-4" />} label="Replies" value={responseCount} /></div>{campaign.status !== "sent" && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">{recipientCount === 0 ? <><p className="font-medium text-amber-900">No eligible recipients yet</p><p className="mt-1 text-sm text-amber-800">No email was sent. Providers need a valid email address and must opt in to marketing email in their notification settings before they can receive this optional survey.</p></> : <><p className="font-medium text-amber-900">Sending is a deliberate admin action</p><p className="mt-1 text-sm text-amber-800">This sends the neutral survey to eligible providers through the existing marketing-email consent and unsubscribe controls.</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><Input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Type SEND_PROVIDER_SURVEY" aria-label="Survey send confirmation" className="bg-white sm:max-w-xs" /><Button variant="default" disabled={confirmation !== "SEND_PROVIDER_SURVEY" || send.isPending} onClick={() => send.mutate({ campaignId: campaign.id, confirmation: "SEND_PROVIDER_SURVEY" })}><Send className="mr-2 h-4 w-4" />Send survey</Button></div></>}</div>}</div>}
      </CardContent>
    </Card>

    {data?.responses.length ? <Card><CardHeader><CardTitle>Provider replies</CardTitle><CardDescription>Admin-only responses. No Stripe status or risk label is shown to the provider.</CardDescription></CardHeader><CardContent className="space-y-4">{data.responses.map((response) => <div key={response.id} className="rounded-xl border p-4"><div className="flex flex-col justify-between gap-2 sm:flex-row"><div><p className="font-medium">{response.providerName}</p><p className="text-xs text-muted-foreground">{response.providerUserName || "Provider"}</p></div><span className="text-xs text-muted-foreground">{response.submittedAt ? new Date(response.submittedAt).toLocaleString() : ""}</span></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{Object.entries(response.answers || {}).map(([question, answer]) => <div key={question} className="rounded-lg bg-muted/40 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{question}</p><p className="mt-1 text-sm">{Array.isArray(answer) ? answer.join(", ") : answer}</p></div>)}</div></div>)}</CardContent></Card> : campaign ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No provider replies yet. Replies will appear here after providers complete the survey.</CardContent></Card> : null}

    {data?.recipients.length ? <Card><CardHeader><CardTitle>Campaign recipients</CardTitle><CardDescription>Eligibility and delivery state only; token hashes are never shown.</CardDescription></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead><tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground"><th className="p-2">Provider</th><th className="p-2">Email</th><th className="p-2">Status</th><th className="p-2">Responded</th></tr></thead><tbody>{data.recipients.map((recipient) => <tr key={recipient.id} className="border-b last:border-0"><td className="p-2 font-medium">{recipient.providerName}</td><td className="p-2 text-muted-foreground">{recipient.emailSnapshot}</td><td className="p-2"><Badge variant="secondary">{recipient.status}</Badge></td><td className="p-2 text-muted-foreground">{recipient.respondedAt ? new Date(recipient.respondedAt).toLocaleString() : "—"}</td></tr>)}</tbody></table></div></CardContent></Card> : null}
  </div>;
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) { return <div className="rounded-xl border bg-white/70 p-4"><div className="flex items-center gap-2 text-muted-foreground">{icon}<span className="text-xs font-medium uppercase tracking-wide">{label}</span></div><p className="mt-2 text-2xl font-semibold text-[#123f3b]">{value}</p></div>; }
