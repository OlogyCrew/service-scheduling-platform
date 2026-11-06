import { useMemo, useState } from "react";
import { useRoute } from "wouter";
import { CheckCircle2, ClipboardList, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { PROVIDER_SURVEY_QUESTIONS } from "@shared/providerSurvey";

export default function ProviderSurvey() {
  const [, params] = useRoute("/provider-survey/:token");
  const token = params?.token ?? "";
  const survey = trpc.providerSurvey.getByToken.useQuery({ token }, { enabled: /^[a-f0-9]{64}$/.test(token), retry: false });
  const submit = trpc.providerSurvey.submit.useMutation();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const ready = useMemo(() => PROVIDER_SURVEY_QUESTIONS.every((question) => answers[question.id]), [answers]);

  if (!/^[a-f0-9]{64}$/.test(token) || survey.isError) {
    return <SurveyShell><Card><CardHeader><CardTitle>This survey link is unavailable</CardTitle><CardDescription>The link may be invalid, expired, or already closed.</CardDescription></CardHeader></Card></SurveyShell>;
  }
  if (survey.isLoading || !survey.data) return <SurveyShell><Card><CardContent className="flex items-center gap-3 p-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading your survey…</CardContent></Card></SurveyShell>;
  if (survey.data.submitted || submitted) {
    return <SurveyShell><Card><CardHeader><CheckCircle2 className="h-10 w-10 text-emerald-600" /><CardTitle>Thank you for sharing your experience.</CardTitle><CardDescription>Your answers were recorded for the OlogyCrew team.</CardDescription></CardHeader></Card></SurveyShell>;
  }

  const updateAnswer = (id: string, value: string) => setAnswers((previous) => ({ ...previous, [id]: value }));
  const send = async () => {
    if (!ready) { toast.error("Please answer each question before submitting."); return; }
    try {
      await submit.mutateAsync({ token, answers });
      setSubmitted(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We couldn't save your responses. Please try again.");
    }
  };

  return <SurveyShell>
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-[#f3f1e7] p-6 sm:p-8">
        <div className="flex items-center gap-3 text-[#0e4b43]"><ClipboardList className="h-6 w-6" /><span className="text-xs font-semibold uppercase tracking-[0.18em]">OlogyCrew provider voice</span></div>
        <CardTitle className="mt-4 text-3xl text-[#123f3b]">Help us improve how providers use OlogyCrew.</CardTitle>
        <CardDescription className="max-w-2xl text-base">Hi {survey.data.providerName || "there"}. This short survey takes about two minutes and helps us improve booking, scheduling, and payment options for your business.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-7 p-6 sm:p-8">
        {PROVIDER_SURVEY_QUESTIONS.map((question, index) => <div key={question.id} className="space-y-3">
          <Label className="text-base font-semibold text-slate-900">{index + 1}. {question.label}</Label>
          {question.id === "improvement" ? <Select value={answers[question.id]} onValueChange={(value) => updateAnswer(question.id, value)}><SelectTrigger><SelectValue placeholder="Choose one" /></SelectTrigger><SelectContent>{question.options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select> :
            <RadioGroup value={answers[question.id] ?? ""} onValueChange={(value) => updateAnswer(question.id, value)} className="grid gap-2 sm:grid-cols-2">{question.options.map((option) => <label key={option} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm transition-colors hover:bg-slate-50"><RadioGroupItem value={option} id={`${question.id}-${option}`} /><span>{option}</span></label>)}</RadioGroup>}
          {(question.id === "uses" || question.id === "serviceType" || question.id === "improvement") && answers[question.id] === "Other" ? <Textarea value={answers[`${question.id}Other`] ?? ""} onChange={(event) => setAnswers((previous) => ({ ...previous, [`${question.id}Other`]: event.target.value }))} placeholder="Tell us a little more (optional)" maxLength={500} /> : null}
        </div>)}
        <div className="flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground">Your response is used by OlogyCrew to improve the provider experience.</p><Button onClick={send} disabled={!ready || submit.isPending}>{submit.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : "Submit survey"}</Button></div>
      </CardContent>
    </Card>
  </SurveyShell>;
}

function SurveyShell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-[#f8f6ee] px-4 py-10 sm:py-16"><div className="mx-auto w-full max-w-3xl"><div className="mb-8 flex items-center justify-between"><span className="text-lg font-bold tracking-tight text-[#123f3b]">Ology<span className="text-[#d3654b]">Crew</span></span><span className="text-xs text-slate-500">Provider survey</span></div>{children}</div></main>;
}
