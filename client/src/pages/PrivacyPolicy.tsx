import { NavHeader } from "@/components/shared/NavHeader";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  LEGACY_PRIVACY_POLICY_VERSION,
  PRIVACY_POLICY_EFFECTIVE_AT,
  REVISED_PRIVACY_POLICY_VERSION,
  getPrivacyPolicyPresentation,
} from "@/pages/legal/privacyPolicyContent";
import { Streamdown } from "streamdown";
import { useSearch } from "wouter";

const EFFECTIVE_DATE_LABEL = "November 23, 2026, 12:00 AM Eastern Time";

export default function PrivacyPolicy() {
  const search = useSearch();
  const requestedVersion = new URLSearchParams(search).get("version");
  const presentation = getPrivacyPolicyPresentation(requestedVersion);

  if (!presentation) return <PrivacyPolicyNotFound requestedVersion={requestedVersion} />;

  const currentPolicyHref = `/privacy?version=${encodeURIComponent(
    presentation.state === "upcoming" ? LEGACY_PRIVACY_POLICY_VERSION : REVISED_PRIVACY_POLICY_VERSION,
  )}`;

  return (
    <div className="min-h-screen bg-page">
      <NavHeader />
      <main className="container max-w-3xl py-12">
        <PageHeader
          title="Privacy Policy"
          backHref="/"
          breadcrumbs={[{ label: "Privacy Policy" }, ...(requestedVersion ? [{ label: presentation.version }] : [])]}
        />

        <PrivacyPolicyStatus
          state={presentation.state}
          revisionDate={presentation.revisionDate}
          currentPolicyHref={currentPolicyHref}
        />

        <div className="prose prose-neutral mt-8 max-w-none dark:prose-invert">
          <Streamdown>{presentation.content}</Streamdown>
        </div>
      </main>
    </div>
  );
}

function PrivacyPolicyStatus({
  state,
  revisionDate,
  currentPolicyHref,
}: {
  state: "upcoming" | "current" | "prior";
  revisionDate: string;
  currentPolicyHref: string;
}) {
  if (state === "upcoming") {
    return (
      <section className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-950" role="status" aria-label="Upcoming privacy policy">
        <p className="font-semibold">Upcoming policy</p>
        <p className="mt-1 text-sm leading-6 text-blue-900">
          Revision date: {revisionDate}. This revised Privacy Policy is scheduled to take effect on {EFFECTIVE_DATE_LABEL}.
        </p>
        <a
          className="mt-4 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          href={currentPolicyHref}
        >
          View the current June 18, 2026 Privacy Policy
        </a>
      </section>
    );
  }

  if (state === "prior") {
    return (
      <section className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-900" role="status" aria-label="Prior privacy policy">
        <p className="font-semibold">Prior Privacy Policy</p>
        <p className="mt-1 text-sm leading-6 text-slate-700">Revision date: {revisionDate}. This version was superseded on {EFFECTIVE_DATE_LABEL}.</p>
        <a className="mt-3 inline-flex text-sm font-medium text-primary hover:underline" href={currentPolicyHref}>View the current Privacy Policy</a>
      </section>
    );
  }

  return (
    <section className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-950" role="status" aria-label="Current privacy policy">
      <p className="font-semibold">Current Privacy Policy</p>
      <p className="mt-1 text-sm leading-6 text-blue-900">
        Revision date: {revisionDate}{revisionDate === "October 22, 2026" ? `. Effective ${EFFECTIVE_DATE_LABEL}.` : "."}
      </p>
      {revisionDate === "June 18, 2026" ? <a className="mt-3 inline-flex text-sm font-medium text-primary hover:underline" href={`/privacy?version=${REVISED_PRIVACY_POLICY_VERSION}`}>Review the upcoming Privacy Policy</a> : null}
    </section>
  );
}

function PrivacyPolicyNotFound({ requestedVersion }: { requestedVersion: string | null }) {
  return (
    <div className="min-h-screen bg-page">
      <NavHeader />
      <main className="container max-w-3xl py-12">
        <PageHeader
          title="Privacy Policy version not found"
          backHref="/privacy"
          breadcrumbs={[{ label: "Privacy Policy" }, ...(requestedVersion ? [{ label: requestedVersion }] : [])]}
        />
        <p className="mt-4 text-muted-foreground">This Privacy Policy version is not published or does not exist.</p>
        <a className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90" href="/privacy">
          View Privacy Policy
        </a>
      </main>
    </div>
  );
}

export { PRIVACY_POLICY_EFFECTIVE_AT };
