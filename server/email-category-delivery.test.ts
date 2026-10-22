import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ preferences: vi.fn(), token: vi.fn() }));
vi.mock("./db", () => ({
  getEmailNotificationPreferences: mocks.preferences,
  ensureNotificationUnsubscribeToken: mocks.token,
}));
vi.mock("./_core/env", () => ({ ENV: { sendgridApiKey: "test-only-not-a-real-key" } }));
import { EmailProvider } from "./notifications/providers/email";

const prefs = { emailEnabled: true, bookingEmail: true, reminderEmail: true, messageEmail: true, paymentEmail: true, marketingEmail: false };
const fetchMock = vi.fn();
function notification(type = "booking_confirmed", userId = 42) {
  return { type, channel: "email", recipient: { userId, email: "recipient@example.invalid" }, data: { customerName: "Test", serviceName: "Test service", bookingId: 123 } } as any;
}
function payload() { return JSON.parse(fetchMock.mock.calls[0][1].body); }
beforeEach(() => {
  vi.clearAllMocks();
  mocks.preferences.mockResolvedValue({ ...prefs });
  mocks.token.mockResolvedValue("a".repeat(64));
  fetchMock.mockResolvedValue({ ok: true, status: 202 });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("email category enforcement at delivery", () => {
  it.each([
    ["booking_confirmed", "bookingEmail"], ["reminder_24h", "reminderEmail"],
    ["message_received", "messageEmail"], ["payment_received", "paymentEmail"],
    ["welcome_customer", "marketingEmail"],
  ])("suppresses %s when its category is disabled without touching the sender", async (type, key) => {
    mocks.preferences.mockResolvedValue({ ...prefs, [key]: false });
    expect(await new EmailProvider().send(notification(type))).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.token).not.toHaveBeenCalled();
  });
  it("master unsubscribe suppresses all optional categories including account lifecycle", async () => {
    mocks.preferences.mockResolvedValue({ ...prefs, emailEnabled: false, marketingEmail: true });
    for (const type of ["booking_confirmed", "reminder_24h", "message_received", "payment_received", "welcome_customer", "trial_expired"]) {
      expect(await new EmailProvider().send(notification(type))).toBe(false);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("fails closed when preference lookup fails", async () => {
    mocks.preferences.mockRejectedValue(new Error("database unavailable"));
    expect(await new EmailProvider().send(notification())).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("cannot silently send optional email without a working unsubscribe token", async () => {
    mocks.token.mockRejectedValue(new Error("token persistence failed"));
    expect(await new EmailProvider().send(notification())).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rechecks choices after token creation instead of undoing a concurrent unsubscribe", async () => {
    mocks.preferences.mockResolvedValueOnce({ ...prefs }).mockResolvedValueOnce({ ...prefs, bookingEmail: false });
    expect(await new EmailProvider().send(notification())).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("honors fresh defaults but never invents marketing consent", async () => {
    mocks.preferences.mockResolvedValue(null);
    expect(await new EmailProvider().send(notification("welcome_customer"))).toBe(false);
    expect(await new EmailProvider().send(notification())).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("includes actual unsubscribe and preference links in HTML/plain text and transport headers", async () => {
    expect(await new EmailProvider().send(notification())).toBe(true);
    const p = payload();
    const url = `https://ologycrew.com/unsubscribe/${"a".repeat(64)}`;
    for (const part of p.content) {
      expect(part.value).toContain(url);
      expect(part.value).toContain("https://ologycrew.com/notification-settings");
    }
    expect(p.headers["List-Unsubscribe"]).toBe(`<${url}>`);
    expect(p.headers).not.toHaveProperty("List-Unsubscribe-Post");
  });
  it("refuses unknown types or unattributed optional recipients", async () => {
    expect(await new EmailProvider().send(notification("unknown_campaign"))).toBe(false);
    expect(await new EmailProvider().send(notification("welcome_customer", 0))).toBe(false);
    expect(await new EmailProvider().send(notification("booking_confirmed", 0))).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("preserves existing external invoice delivery without granting a generic bypass", async () => {
    expect(await new EmailProvider().send(notification("invoice_sent", 0))).toBe(true);
    const p = payload();
    for (const part of p.content) expect(part.value).toContain("https://ologycrew.com/notification-settings");
    expect(await new EmailProvider().send(notification("invoice_overdue", 0))).toBe(false);
  });
});

describe("explicit necessary-email path", () => {
  it.each(["security", "legal", "support"] as const)("preserves %s despite disabled preferences and lookup failures", async (purpose) => {
    mocks.preferences.mockRejectedValue(new Error("database unavailable"));
    mocks.token.mockRejectedValue(new Error("database unavailable"));
    const sent = await EmailProvider.sendRaw("recipient@example.invalid", "Necessary notice", "<p>Notice</p>", "Notice", "noreply", { purpose, userId: 42 });
    expect(sent).toBe(true);
    expect(mocks.preferences).not.toHaveBeenCalled();
    const p = payload();
    for (const part of p.content) {
      expect(part.value).toContain("https://ologycrew.com/notification-settings");
      expect(part.value.toLowerCase()).toContain("unsubscribe");
    }
  });
  it("denies unclassified raw mail instead of a default unrestricted bypass", async () => {
    expect(await EmailProvider.sendRaw("recipient@example.invalid", "Unknown", "<p>Unknown</p>", "Unknown")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("preserves explicitly requested guest support acknowledgments", async () => {
    expect(await new EmailProvider().send(notification("contact_received", 0))).toBe(true);
    expect(mocks.preferences).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
