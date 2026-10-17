import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

const dbMocks = vi.hoisted(() => ({
  acknowledgeTermsNotice: vi.fn(),
  createTermsDraft: vi.fn(),
  getPendingTermsNotice: vi.fn(),
  getPublicTermsVersion: vi.fn(),
  getTermsAudienceUsers: vi.fn(),
  getTermsDeliverySummary: vi.fn(),
  getTermsVersionById: vi.fn(),
  listTermsVersions: vi.fn(),
  markTermsNoticeShown: vi.fn(),
  publishTermsVersion: vi.fn(),
  updateTermsDraft: vi.fn(),
}));
const deliverTermsUpdate = vi.hoisted(() => vi.fn());
const createAuditEntry = vi.hoisted(() => vi.fn());

vi.mock("./db/terms", () => dbMocks);
vi.mock("./termsNotifications", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./termsNotifications")>();
  return { ...actual, deliverTermsUpdate };
});
vi.mock("./db/auditLog", () => ({ createAuditEntry }));

import { termsRouter } from "./termsRouter";
import { buildTermsUpdateEmail } from "./termsNotifications";

const now = new Date("2026-09-04T16:00:00.000Z");
const effectiveAt = new Date("2026-10-15T12:00:00.000Z");
const version = {
  id: 12,
  version: "2026-10-15",
  title: "OlogyCrew Terms of Use",
  summary: "We clarified platform services, payments, and dispute-resolution provisions.",
  content: "# OlogyCrew Terms of Use\n\n" + "Complete legally reviewed Terms content. ".repeat(20),
  status: "draft" as const,
  audience: "all" as const,
  acceptanceMode: "notice" as const,
  effectiveAt,
  materialArbitrationChanges: false,
  arbitrationSection: null,
  optOutDeadline: null,
  contactEmail: "info@ologycrew.com",
  companyAddress: "123 Example Street, Atlanta, GA 30303",
  createdBy: 1,
  publishedBy: null,
  publishedAt: null,
  createdAt: now,
  updatedAt: now,
};

function caller(user: Record<string, unknown>) {
  return termsRouter.createCaller({ user, req: {}, res: {} } as any);
}

const owner = { id: 1, openId: "owner-open-id", role: "admin", adminRole: "super_admin", email: "garychisolm30@gmail.com" };
const supportAdmin = { id: 2, openId: "support-open-id", role: "admin", adminRole: "support_agent", email: "support@ologycrew.com" };
const customer = { id: 22, openId: "customer-open-id", role: "customer", adminRole: null, email: "customer@example.invalid" };

describe("owner-controlled Terms workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Freeze only Date, not promise/timer scheduling, so fixture dates stay
    // deterministic and the production future-effective-date guard is tested.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    dbMocks.listTermsVersions.mockResolvedValue([]);
    dbMocks.getTermsAudienceUsers.mockResolvedValue([]);
    dbMocks.getTermsDeliverySummary.mockResolvedValue({ total: 0, pending: 0, sent: 0, failed: 0, skipped: 0, inAppNotified: 0, shown: 0, acknowledged: 0, accepted: 0 });
  });

  afterEach(() => vi.useRealTimers());

  it("blocks non-owner administrators from legal publication controls", async () => {
    await expect(caller(supportAdmin).adminList()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("creates a future-dated draft and records an audit event", async () => {
    dbMocks.createTermsDraft.mockResolvedValue(12);
    const result = await caller(owner).createDraft({
      version: version.version,
      title: version.title,
      summary: version.summary,
      content: version.content,
      audience: version.audience,
      acceptanceMode: version.acceptanceMode,
      effectiveAt,
      materialArbitrationChanges: false,
      arbitrationSection: null,
      optOutDeadline: null,
      contactEmail: version.contactEmail,
      companyAddress: version.companyAddress,
    });
    expect(result).toEqual({ id: 12 });
    expect(dbMocks.createTermsDraft).toHaveBeenCalledWith(expect.objectContaining({ createdBy: 1, version: "2026-10-15" }));
    expect(createAuditEntry).toHaveBeenCalledWith(expect.objectContaining({ action: "create_terms_draft", targetType: "terms_version", targetId: 12 }));
  });

  it("rejects a draft whose effective date is not in the future", async () => {
    await expect(caller(owner).createDraft({
      version: version.version,
      title: version.title,
      summary: version.summary,
      content: version.content,
      audience: version.audience,
      acceptanceMode: version.acceptanceMode,
      effectiveAt: new Date("2020-01-01T00:00:00.000Z"),
      materialArbitrationChanges: false,
      arbitrationSection: null,
      optOutDeadline: null,
      contactEmail: version.contactEmail,
      companyAddress: version.companyAddress,
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("requires opt-out details when material arbitration changes are enabled", async () => {
    await expect(caller(owner).createDraft({
      version: version.version,
      title: version.title,
      summary: version.summary,
      content: version.content,
      audience: version.audience,
      acceptanceMode: version.acceptanceMode,
      effectiveAt,
      materialArbitrationChanges: true,
      arbitrationSection: null,
      optOutDeadline: null,
      contactEmail: version.contactEmail,
      companyAddress: version.companyAddress,
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("publishes exactly one draft, runs idempotent delivery, and audits the result", async () => {
    dbMocks.getTermsVersionById.mockResolvedValue(version);
    const publishedVersion = { ...version, status: "published" as const, publishedBy: 1, publishedAt: now };
    dbMocks.publishTermsVersion.mockResolvedValue({ version: publishedVersion, recipients: [{ id: 22 }] });
    deliverTermsUpdate.mockResolvedValue({ total: 1, pending: 0, sent: 1, failed: 0, skipped: 0, inAppNotified: 1, shown: 0, acknowledged: 0, accepted: 0 });
    const result = await caller(owner).publish({ id: 12, confirmation: "PUBLISH" });
    expect(result.delivery.sent).toBe(1);
    expect(dbMocks.publishTermsVersion).toHaveBeenCalledWith(12, 1);
    expect(deliverTermsUpdate).toHaveBeenCalledWith(publishedVersion);
    expect(createAuditEntry).toHaveBeenCalledWith(expect.objectContaining({ action: "publish_terms_version", targetId: 12 }));
  });

  it("rejects publication once the effective time is reached without delivering notices", async () => {
    vi.setSystemTime(effectiveAt);
    dbMocks.getTermsVersionById.mockResolvedValue(version);
    await expect(caller(owner).publish({ id: 12, confirmation: "PUBLISH" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(dbMocks.publishTermsVersion).not.toHaveBeenCalled();
    expect(deliverTermsUpdate).not.toHaveBeenCalled();
  });

  it("does not allow a published Terms record to be edited or republished", async () => {
    dbMocks.getTermsVersionById.mockResolvedValue({ ...version, status: "published" });
    await expect(caller(owner).publish({ id: 12, confirmation: "PUBLISH" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("marks only the signed-in user's notice shown and acknowledged", async () => {
    dbMocks.acknowledgeTermsNotice.mockResolvedValue({ ...version, status: "published" });
    await caller(customer).markShown({ noticeId: 55 });
    const result = await caller(customer).acknowledge({ noticeId: 55 });
    expect(dbMocks.markTermsNoticeShown).toHaveBeenCalledWith(22, 55);
    expect(dbMocks.acknowledgeTermsNotice).toHaveBeenCalledWith(22, 55);
    expect(result).toMatchObject({ success: true, version: "2026-10-15", acceptanceMode: "notice" });
  });

  it("returns only public legal fields and never creator or recipient records", async () => {
    dbMocks.getPublicTermsVersion.mockResolvedValue({ ...version, status: "published", publishedBy: 1, publishedAt: now });
    const result = await caller(customer).current({ version: "2026-10-15" });
    expect(result).toMatchObject({ version: "2026-10-15", title: version.title });
    expect(result).not.toHaveProperty("createdBy");
    expect(result).not.toHaveProperty("publishedBy");
  });
});

describe("approved Terms update email", () => {
  it("includes the effective date, direct links, summary, recipient, and continued-use language", () => {
    const email = buildTermsUpdateEmail({ ...version, status: "published", publishedBy: 1, publishedAt: now }, { firstName: "Gary", email: "gary@example.com" });
    expect(email.subject).toContain("OlogyCrew Terms of Use");
    expect(email.text).toContain("Hello Gary");
    expect(email.text).toContain("October 15, 2026");
    expect(email.text).toContain(version.summary);
    expect(email.text).toContain("https://www.ologycrew.com/terms?version=2026-10-15");
    expect(email.text).toContain("By continuing to access, use, or subscribe");
    expect(email.text).toContain("gary@example.com");
    expect(email.text).not.toContain("opt-out instructions");
  });

  it("adds arbitration opt-out language only when legally approved fields are complete", () => {
    const email = buildTermsUpdateEmail({ ...version, status: "published", publishedBy: 1, publishedAt: now, materialArbitrationChanges: true, arbitrationSection: "7", optOutDeadline: new Date("2026-10-01T12:00:00.000Z") }, { firstName: "Winston", email: "winston@example.com" });
    expect(email.text).toContain("opt-out instructions in Section 7 by October 1, 2026");
    expect(email.html).toContain("Dispute-resolution update");
  });

  it("escapes user-controlled values in the HTML email", () => {
    const email = buildTermsUpdateEmail({ ...version, status: "published", publishedBy: 1, publishedAt: now, summary: "Clarified <script>alert('x')</script> language." }, { firstName: "<Admin>", email: "safe@example.com" });
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("&lt;Admin&gt;");
  });
});

describe("Terms workflow user interface contracts", () => {
  const root = path.resolve(process.cwd());
  const adminSource = fs.readFileSync(path.join(root, "client/src/pages/admin/AdminTermsManagement.tsx"), "utf8");
  const bannerSource = fs.readFileSync(path.join(root, "client/src/components/TermsUpdateBanner.tsx"), "utf8");
  const termsSource = fs.readFileSync(path.join(root, "client/src/pages/TermsOfService.tsx"), "utf8");
  const appSource = fs.readFileSync(path.join(root, "client/src/App.tsx"), "utf8");

  it("provides owner-controlled draft, preview, explicit publish, and retry actions without an automatic scheduler", () => {
    expect(adminSource).toContain("Preview only");
    expect(adminSource).toContain("Publish and notify");
    expect(adminSource).toContain("Resume delivery");
    expect(adminSource).toContain("Published versions are immutable");
    expect(adminSource).not.toContain("setInterval");
    expect(adminSource).not.toContain("node-cron");
  });

  it("mounts one persistent authenticated banner and records shown or acknowledged state", () => {
    expect(appSource).toContain("<TermsUpdateBanner />");
    expect(bannerSource).toContain("terms.pendingNotice");
    expect(bannerSource).toContain("terms.markShown");
    expect(bannerSource).toContain("terms.acknowledge");
    expect(bannerSource).toContain("Review Terms");
  });

  it("renders managed Terms, supports prior versions, and retains the June 2026 baseline", () => {
    expect(termsSource).toContain("ManagedTermsOfService");
    expect(termsSource).toContain("TermsVersionHistory");
    expect(termsSource).toContain('currentVersion="2026-06-24"');
    expect(termsSource).toContain("Accept updated Terms");
  });
});
