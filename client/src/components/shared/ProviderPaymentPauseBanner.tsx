import { PROVIDER_PAYMENTS_PAUSED, PROVIDER_PAYMENT_PAUSE_DETAIL, PROVIDER_PAYMENT_PAUSE_MESSAGE } from "@shared/providerPaymentPause";

export function ProviderPaymentPauseBanner() {
  if (!PROVIDER_PAYMENTS_PAUSED) return null;

  return (
    <section
      role="status"
      aria-label="Provider payment collection paused"
      className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-amber-950"
    >
      <div className="mx-auto max-w-6xl space-y-1">
        <p className="text-sm font-semibold">{PROVIDER_PAYMENT_PAUSE_MESSAGE}</p>
        <p className="text-xs leading-relaxed">{PROVIDER_PAYMENT_PAUSE_DETAIL}</p>
      </div>
    </section>
  );
}
