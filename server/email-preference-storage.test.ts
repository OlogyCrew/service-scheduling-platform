import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db/connection", () => ({ getDb: mocks.getDb }));
import { getEmailNotificationPreferences, ensureNotificationUnsubscribeToken } from "./db/notifications";

beforeEach(() => vi.clearAllMocks());
function database(rows: any[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const select = vi.fn(() => ({ from: () => ({ where: () => ({ limit }) }) }));
  const upsert = vi.fn().mockResolvedValue({});
  const values = vi.fn(() => ({ onDuplicateKeyUpdate: upsert }));
  const insert = vi.fn(() => ({ values }));
  return { select, insert, values, upsert };
}
describe("strict email preference storage", () => {
  it("does not confuse unavailable database with a new account's missing row", async () => {
    mocks.getDb.mockResolvedValue(null);
    await expect(getEmailNotificationPreferences(42)).rejects.toThrow("Database not available");
    const d = database([]); mocks.getDb.mockResolvedValue(d);
    await expect(getEmailNotificationPreferences(42)).resolves.toBeNull();
  });
  it("propagates database lookup errors rather than failing open", async () => {
    mocks.getDb.mockResolvedValue({ select() { throw new Error("connection lost"); } });
    await expect(getEmailNotificationPreferences(42)).rejects.toThrow("connection lost");
  });
  it("returns actual preferences without modifying any flag", async () => {
    const row = { emailEnabled: true, bookingEmail: false, marketingEmail: false };
    const d = database([row]); mocks.getDb.mockResolvedValue(d);
    expect(await getEmailNotificationPreferences(42)).toBe(row);
    expect(d.insert).not.toHaveBeenCalled();
  });
  it("token upsert updates only the token and reuses the winning persisted token", async () => {
    const token = "b".repeat(64); const d = database([{ unsubscribeToken: token }]);
    mocks.getDb.mockResolvedValue(d);
    expect(await ensureNotificationUnsubscribeToken(42)).toBe(token);
    const inserted = d.values.mock.calls[0][0] as any;
    expect(Object.keys(inserted).sort()).toEqual(["unsubscribeToken", "userId"]);
    expect(inserted.unsubscribeToken).toMatch(/^[a-f0-9]{64}$/);
    expect(Object.keys((d.upsert.mock.calls[0][0] as any).set)).toEqual(["unsubscribeToken"]);
  });
  it("fails closed if token cannot be read back", async () => {
    const d = database([]); mocks.getDb.mockResolvedValue(d);
    await expect(ensureNotificationUnsubscribeToken(42)).rejects.toThrow("unsubscribe token");
  });
});
