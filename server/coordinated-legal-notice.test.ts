import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TermsVersion } from "../drizzle/schema";
import { AI_DISCOVERY_LEGAL_RELEASE } from "../shared/legalPolicyRelease";

const sendRaw = vi.hoisted(() => vi.fn());
const createNotification = vi.hoisted(() => vi.fn());
const db = vi.hoisted(() => ({getTermsDeliveryRecipients: vi.fn(), getTermsDeliverySummary: vi.fn(), markTermsEmailDelivery: vi.fn(), markTermsInAppNotified: vi.fn()}));
vi.mock("./notifications/providers/email", () => ({EmailProvider: {sendRaw}}));
vi.mock("./db/notifications", () => ({createNotification}));
vi.mock("./db/terms", () => db);
import { buildTermsUpdateEmail, deliverTermsUpdate } from "./termsNotifications";

const release: TermsVersion = {
  id: 1, version: AI_DISCOVERY_LEGAL_RELEASE.version, title: "OlogyCrew Terms of Use",
  summary: "AI-assisted public discovery and customer-reviewed links; coordinated Privacy disclosures and necessary-email exceptions.",
  content: "## 1. Acceptance of Terms\n\nReviewed complete content.", status: "draft", audience: "all", acceptanceMode: "notice",
  effectiveAt: new Date(AI_DISCOVERY_LEGAL_RELEASE.effectiveAt), materialArbitrationChanges: false,
  arbitrationSection: null, optOutDeadline: null, contactEmail: "info@ologycrew.com",
  companyAddress: "171 Prestwick Dr., Hoschton, GA 30548", createdBy: 1, publishedBy: null, publishedAt: null,
  createdAt: new Date("2026-10-22T16:00:00Z"), updatedAt: new Date("2026-10-22T16:00:00Z"),
};

describe("coordinated legal release notice", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it("previews both version-specific documents with the confirmed date and no arbitration change", () => {
    const email = buildTermsUpdateEmail(release, {name: "Gary", email: "preview@example.com"});
    expect(email.subject).toBe("Important updates to the OlogyCrew Terms of Use and Privacy Policy");
    expect(email.text).toContain("November 23, 2026");
    expect(email.text).toContain("Privacy Policy will also take effect");
    expect(email.text).toContain("/privacy?version=2026-11-23-ai-discovery");
    expect(email.html).toContain("Review the updated Privacy Policy");
    expect(email.text).toContain(release.companyAddress);
    expect(email.text).not.toContain("opt-out instructions");
    expect(email.text).not.toContain("accept the updated Privacy Policy");
    expect(email.text).not.toContain("UNPUBLISHED");
    expect(sendRaw).not.toHaveBeenCalled();
    expect(createNotification).not.toHaveBeenCalled();
  });
  it("does not claim a Privacy update for a different Terms-only release", () => {
    const email = buildTermsUpdateEmail({...release,version:"2027-02-01",effectiveAt:new Date("2027-02-01T12:00:00Z")},{email:"preview@example.com"});
    expect(email.subject).toBe("Important updates to the OlogyCrew Terms of Use");
    expect(email.text).not.toContain("Privacy Policy will also take effect");
    expect(email.html).not.toContain("Review the updated Privacy Policy");
    expect(email.text).toContain("Privacy Policy: https://www.ologycrew.com/privacy");
  });
  it("mentions both policies in the existing per-user notice, preserving the legal sender and sent-recipient skip", async () => {
    db.getTermsDeliveryRecipients.mockResolvedValue([
      {notice:{id:11,inAppNotifiedAt:null,emailStatus:"pending"},user:{id:7,name:"Gary",firstName:"Gary",email:"preview@example.com",emailVerified:true}},
      {notice:{id:12,inAppNotifiedAt:new Date(),emailStatus:"sent"},user:{id:8,email:"already@example.com",emailVerified:true}},
    ]);
    db.getTermsDeliverySummary.mockResolvedValue({sent:1}); sendRaw.mockResolvedValue(true);
    await deliverTermsUpdate({...release,status:"published",publishedAt:new Date()});
    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({title:"OlogyCrew Terms of Use and Privacy Policy updated",message:expect.stringContaining("Privacy Policy"),actionUrl:"/terms?version=2026-11-23-ai-discovery"}));
    expect(sendRaw).toHaveBeenCalledTimes(1);
    expect(sendRaw).toHaveBeenCalledWith("preview@example.com",expect.stringContaining("Privacy Policy"),expect.any(String),expect.any(String),"info",{purpose:"legal",userId:7});
  });
});
