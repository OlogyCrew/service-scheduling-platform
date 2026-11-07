import { useRef, useState, type FormEvent } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Banknote } from "lucide-react";
import {
  OFFLINE_PAYMENT_METHOD_LABELS,
  formatOfflinePaymentAmount,
  formatOfflinePaymentTimestamp,
  getOfflinePaymentPresentation,
  type OfflinePaymentMethod,
  type OfflinePaymentRecord,
} from "@shared/offlinePaymentPresentation";

type Props = { payment: OfflinePaymentRecord; canManage: boolean };

/** No optimistic payment state: all amounts and history come from getForBooking. */
export function OfflinePaymentPanel({ payment, canManage }: Props) {
  const utils = trpc.useUtils();
  const confirmPayment = trpc.offlinePayment.confirmPayment.useMutation();
  const waivePayment = trpc.offlinePayment.waivePayment.useMutation();
  const [action, setAction] = useState<"paid" | "waived" | null>(null);
  const [method, setMethod] = useState<OfflinePaymentMethod | "">("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Protect same-tick duplicate submits and dismissal before React rerenders.
  const submissionLock = useRef(false);
  const presentation = getOfflinePaymentPresentation(payment);
  const pending = submitting || confirmPayment.isPending || waivePayment.isPending;
  const eligible = canManage && presentation.isDue;
  const isReceipt = action === "paid";
  const amount = formatOfflinePaymentAmount(presentation.originalAmount);

  const openAction = (next: "paid" | "waived") => {
    if (submissionLock.current || pending || !eligible) return;
    setMethod("");
    setNote("");
    setReason("");
    setAcknowledged(false);
    setInlineError(null);
    setSuccessMessage(null);
    setAction(next);
  };

  const closeDialog = () => {
    if (submissionLock.current || pending) return;
    setAction(null);
    setInlineError(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submissionLock.current || pending) return;
    setInlineError(null);
    if (!eligible || !action) {
      setInlineError("This payment can no longer be changed. Refresh the booking to view its current status.");
      return;
    }
    if (!acknowledged) {
      setInlineError(isReceipt ? "Confirm that you actually received the full amount." : "Confirm that you intend to waive the full amount.");
      return;
    }
    if (isReceipt && !method) {
      setInlineError("Select the method used to receive payment.");
      return;
    }
    if (isReceipt && note.length > 1000) {
      setInlineError("Payment note must be 1,000 characters or fewer.");
      return;
    }
    if (!isReceipt && (!reason.trim() || reason.trim().length > 2000)) {
      setInlineError("Enter a waiver reason of 1 to 2,000 characters.");
      return;
    }

    submissionLock.current = true;
    setSubmitting(true);
    let settled = false;
    try {
      const result = isReceipt
        ? await confirmPayment.mutateAsync({
            bookingId: payment.bookingId,
            amountReceived: payment.originalAmountDue,
            offlinePaymentMethod: method as OfflinePaymentMethod,
            paymentNote: note.trim() || null,
          })
        : await waivePayment.mutateAsync({
            bookingId: payment.bookingId,
            waiverAmount: payment.originalAmountDue,
            waiverReason: reason.trim(),
          });
      if (!result || result.bookingId !== payment.bookingId || result.status !== action) {
        setInlineError("The server response did not confirm settlement. Refresh the booking before trying again.");
        return;
      }
      // Only refresh caches after a confirmed mutation success, never on an error.
      const refreshes = await Promise.allSettled([
        Promise.resolve().then(() => utils.offlinePayment.getForBooking.invalidate({ bookingId: payment.bookingId })),
        Promise.resolve().then(() => utils.booking.getDetail.invalidate({ id: payment.bookingId })),
        Promise.resolve().then(() => utils.offlinePayment.listProviderOutstanding.invalidate()),
      ]);
      settled = true;
      setAction(null);
      setSuccessMessage(
        `${isReceipt ? "Full payment recorded." : "Full payment waived."}${refreshes.some((refresh) => refresh.status === "rejected") ? " The booking could not be refreshed; reload to view the latest ledger." : ""}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const internal = /failed query|sqlstate|params:|insert into|update `|select .* from/i.test(message) || message.length > 240;
      setInlineError(internal || !message ? "The payment was not saved. Please retry; if the problem continues, contact support. No settlement has been confirmed." : message);
    } finally {
      // A successful action is also gated by the refreshed ledger below.
      submissionLock.current = false;
      setSubmitting(false);
      if (!settled) setSuccessMessage(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Banknote className="h-5 w-5 text-primary" />
          Pay at Location
        </CardTitle>
        <CardDescription>
          Payment is arranged directly with the provider. No online charge is made for this booking.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div><dt className="text-muted-foreground">Offline payment status</dt><dd className="mt-1"><Badge variant="outline">{presentation.statusLabel}</Badge></dd></div>
          <div><dt className="text-muted-foreground">Original agreed amount</dt><dd className="font-semibold">{amount}</dd></div>
          <div><dt className="text-muted-foreground">Outstanding balance</dt><dd className="font-semibold">{formatOfflinePaymentAmount(presentation.outstandingBalance)}</dd></div>
          <div><dt className="text-muted-foreground">Amount received</dt><dd>{formatOfflinePaymentAmount(presentation.amountReceived)}</dd></div>
          <div><dt className="text-muted-foreground">Amount waived</dt><dd>{formatOfflinePaymentAmount(presentation.amountWaived)}</dd></div>
          <div><dt className="text-muted-foreground">Payment method</dt><dd>{presentation.methodLabel}</dd></div>
        </dl>
        <div className="rounded-lg bg-muted/50 p-3">
          <h3 className="text-sm font-medium">Provider payment instructions</h3>
          <p className="text-sm whitespace-pre-wrap break-words mt-1">{payment.providerInstructions || "Arrange payment directly with your provider. No additional instructions were provided."}</p>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div><dt className="text-muted-foreground">Confirmed by user ID</dt><dd>{payment.confirmedByUserId ?? "Not recorded"}</dd></div>
          <div><dt className="text-muted-foreground">Payment received at</dt><dd>{formatOfflinePaymentTimestamp(payment.paidAt)}</dd></div>
          <div><dt className="text-muted-foreground">Waived by user ID</dt><dd>{payment.waivedByUserId ?? "Not recorded"}</dd></div>
          <div><dt className="text-muted-foreground">Waived at</dt><dd>{formatOfflinePaymentTimestamp(payment.waivedAt)}</dd></div>
          <div className="sm:col-span-2"><dt className="text-muted-foreground">Payment note</dt><dd className="whitespace-pre-wrap break-words">{payment.paymentNote || "Not recorded"}</dd></div>
          <div className="sm:col-span-2"><dt className="text-muted-foreground">Waiver reason</dt><dd className="whitespace-pre-wrap break-words">{payment.waiverReason || "Not recorded"}</dd></div>
        </dl>
        <p className="text-xs text-muted-foreground">Only full payment or a full waiver can be recorded. A waiver is not a payment receipt.</p>
        {successMessage && <p role="status" className="text-sm">{successMessage}</p>}
        {eligible && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => openAction("paid")} disabled={pending || !!successMessage}>Mark as Paid</Button>
            <Button variant="outline" onClick={() => openAction("waived")} disabled={pending || !!successMessage}>Waive Payment</Button>
          </div>
        )}
        {!canManage && presentation.isDue && <p className="text-sm text-muted-foreground">Only the booking provider or an authorized administrator can record receipt or a waiver. Customers cannot mark this payment as paid.</p>}

        <Dialog open={action !== null} onOpenChange={(open) => { if (!open) closeDialog(); }}>
          <DialogContent
            className="max-h-[calc(100dvh-3rem)] overflow-y-auto min-w-0"
            showCloseButton={!pending}
            onEscapeKeyDown={(event) => { if (submissionLock.current || pending) event.preventDefault(); }}
            onInteractOutside={(event) => { if (submissionLock.current || pending) event.preventDefault(); }}
          >
            <DialogHeader>
              <DialogTitle>{isReceipt ? "Record full offline payment" : "Waive full offline payment"}</DialogTitle>
              <DialogDescription>
                {isReceipt ? "Record money you have already received outside the platform. This does not charge the customer." : "Release the customer from the full amount due. No money will be recorded as received."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} noValidate className="space-y-4" aria-busy={pending}>
              <div className="space-y-2">
                <Label htmlFor="offline-full-amount">{isReceipt ? "Full amount received (USD)" : "Full waiver amount (USD)"}</Label>
                <Input id="offline-full-amount" value={payment.originalAmountDue} readOnly />
                <p className="text-xs text-muted-foreground">{amount} — partial payments and partial waivers are not supported.</p>
              </div>
              {isReceipt ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="offline-payment-method">Payment method (required)</Label>
                    <select id="offline-payment-method" className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={method} required disabled={pending} onChange={(event) => setMethod(event.target.value as OfflinePaymentMethod | "")}>
                      <option value="">Select the received payment method</option>
                      {Object.entries(OFFLINE_PAYMENT_METHOD_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="offline-payment-note">Payment note (optional)</Label>
                    <Textarea id="offline-payment-note" value={note} maxLength={1000} disabled={pending} onChange={(event) => setNote(event.target.value)} />
                    <p className="text-xs text-muted-foreground">Up to 1,000 characters. Do not include sensitive account details.</p>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="offline-waiver-reason">Waiver reason (required)</Label>
                  <Textarea id="offline-waiver-reason" value={reason} maxLength={2000} required disabled={pending} onChange={(event) => setReason(event.target.value)} />
                  <p className="text-xs text-muted-foreground">Up to 2,000 characters. This reason is saved with the waiver.</p>
                </div>
              )}
              <div className="flex items-start gap-2">
                <Checkbox id="offline-settlement-acknowledgement" checked={acknowledged} disabled={pending} onCheckedChange={(checked) => setAcknowledged(checked === true)} />
                <Label htmlFor="offline-settlement-acknowledgement" className="text-sm leading-normal">
                  {isReceipt ? `I confirm I actually received the full ${amount} from the customer.` : `I confirm I intend to waive the full ${amount} and no payment was received for this waiver.`}
                </Label>
              </div>
              {inlineError && <p role="alert" className="text-sm text-destructive break-words [overflow-wrap:anywhere]">{inlineError}</p>}
              <DialogFooter>
                <Button type="button" variant="outline" disabled={pending} onClick={closeDialog}>Cancel</Button>
                <Button type="submit" disabled={pending || !eligible || !acknowledged || (isReceipt ? !method : !reason.trim())}>
                  {pending ? "Saving…" : isReceipt ? "Confirm full payment" : "Confirm full waiver"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
