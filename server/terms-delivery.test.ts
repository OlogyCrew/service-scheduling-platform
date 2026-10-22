import { beforeEach, describe, expect, it, vi } from "vitest";

const createNotification = vi.hoisted(() => vi.fn());
const termsDb = vi.hoisted(() => ({
  getTermsDeliveryRecipients: vi.fn(),
  getTermsDeliverySummary: vi.fn(),
  markTermsEmailDelivery: vi.fn(),
  markTermsInAppNotified: vi.fn(),
}));
const sendRaw = vi.hoisted(() => vi.fn());

vi.mock("./db/notifications", () => ({ createNotification }));
vi.mock("./db/terms", () => termsDb);
vi.mock("./notifications/providers/email", () => ({ EmailProvider: { sendRaw } }));

import { deliverTermsUpdate } from "./termsNotifications";

const version = {
  id: 91,
  version: "2026-10-15",
  title: "OlogyCrew Terms of Use",
  summary: "We clarified important platform, payment, and dispute-resolution provisions.",
  content: "# Terms\n\nComplete Terms content",
  status: "published" as const,
  audience: "all" as const,
  acceptanceMode: "notice" as const,
  effectiveAt: new Date("2026-10-15T12:00:00.000Z"),
  materialArbitrationChanges: false,
  arbitrationSection: null,
  optOutDeadline: null,
  contactEmail: "info@ologycrew.com",
  companyAddress: "123 Example Street, Atlanta, GA 30303",
  createdBy: 1,
  publishedBy: 1,
  publishedAt: new Date("2026-09-04T12:00:00.000Z"),
  createdAt: new Date("2026-09-04T12:00:00.000Z"),
  updatedAt: new Date("2026-09-04T12:00:00.000Z"),
};

describe("Terms update delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    termsDb.getTermsDeliverySummary.mockResolvedValue({ total: 2, pending: 0, sent: 1, failed: 0, skipped: 1, inAppNotified: 2, shown: 0, acknowledged: 0, accepted: 0 });
    createNotification.mockResolvedValue({ insertId: 1 });
  });

  it("creates in-app notices for every recipient, emails verified addresses, and skips unverified addresses", async () => {
    termsDb.getTermsDeliveryRecipients.mockResolvedValue([
      { notice: { id: 11, inAppNotifiedAt: null, emailStatus: "pending" }, user: { id: 1, firstName: "Gary", name: "Gary Chisolm", email: "gary@example.com", emailVerified: true } },
      { notice: { id: 12, inAppNotifiedAt: null, emailStatus: "pending" }, user: { id: 2, firstName: "Fresh", name: "Fresh", email: "fresh@example.com", emailVerified: false } },
    ]);
    sendRaw.mockResolvedValue(true);

    const summary = await deliverTermsUpdate(version);

    expect(createNotification).toHaveBeenCalledTimes(2);
    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({ notificationType: "terms_updated", actionUrl: "/terms?version=2026-10-15" }));
    expect(termsDb.markTermsInAppNotified).toHaveBeenCalledTimes(2);
    expect(sendRaw).toHaveBeenCalledTimes(1);
    expect(sendRaw).toHaveBeenCalledWith(
      "gary@example.com",
      expect.stringContaining("Terms of Use"),
      expect.stringContaining("OlogyCrew"),
      expect.stringContaining("October 15, 2026"),
      "info",
      { purpose: "legal", userId: 1 },
    );
    expect(termsDb.markTermsEmailDelivery).toHaveBeenCalledWith(11, { status: "sent" });
    expect(termsDb.markTermsEmailDelivery).toHaveBeenCalledWith(12, { status: "skipped", reason: "No verified email address" });
    expect(summary.sent).toBe(1);
  });

  it("records provider rejection as a retryable delivery failure", async () => {
    termsDb.getTermsDeliveryRecipients.mockResolvedValue([
      { notice: { id: 21, inAppNotifiedAt: new Date(), emailStatus: "failed" }, user: { id: 3, firstName: "Winston", name: "Winston", email: "winston@example.com", emailVerified: true } },
    ]);
    sendRaw.mockResolvedValue(false);
    await deliverTermsUpdate(version, false);
    expect(createNotification).not.toHaveBeenCalled();
    expect(termsDb.getTermsDeliveryRecipients).toHaveBeenCalledWith(91, false);
    expect(termsDb.markTermsEmailDelivery).toHaveBeenCalledWith(21, { status: "failed", reason: "Email provider rejected or could not deliver the request" });
  });

  it("continues email delivery even if a single in-app notification fails", async () => {
    termsDb.getTermsDeliveryRecipients.mockResolvedValue([
      { notice: { id: 31, inAppNotifiedAt: null, emailStatus: "pending" }, user: { id: 4, firstName: "Adonis", name: "Adonis", email: "adonis@example.com", emailVerified: true } },
    ]);
    createNotification.mockRejectedValueOnce(new Error("temporary database error"));
    sendRaw.mockResolvedValue(true);
    await deliverTermsUpdate(version);
    expect(termsDb.markTermsInAppNotified).not.toHaveBeenCalled();
    expect(sendRaw).toHaveBeenCalledTimes(1);
    expect(termsDb.markTermsEmailDelivery).toHaveBeenCalledWith(31, { status: "sent" });
  });
});
