import { beforeEach, describe, expect, it, vi } from "vitest";

const sendRaw = vi.hoisted(() => vi.fn());

vi.mock("./notifications/providers/email", () => ({ EmailProvider: { sendRaw } }));

import { sendAccountDeletionEmail } from "./accountDeletionEmail";
import { sendTwoFactorEmail } from "./twoFactor";

describe("essential security email routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendRaw.mockResolvedValue(true);
  });

  it("routes a 2FA OTP through the raw provider with the security purpose", async () => {
    await expect(sendTwoFactorEmail("member@example.invalid", "123456", "Member")).resolves.toBe(true);

    expect(sendRaw).toHaveBeenCalledWith(
      "member@example.invalid",
      "123456 is your OlogyCrew verification code",
      expect.stringContaining("123456"),
      "Hi Member, your OlogyCrew verification code is: 123456. This code expires in 10 minutes.",
      "noreply",
      { purpose: "security" },
    );
  });

  it("preserves failed 2FA delivery as a false result", async () => {
    sendRaw.mockResolvedValue(false);

    await expect(sendTwoFactorEmail("member@example.invalid", "123456")).resolves.toBe(false);
  });

  it("routes the account-deletion confirmation through the raw provider with the security purpose", async () => {
    await expect(sendAccountDeletionEmail("member@example.invalid", "Member")).resolves.toBe(true);

    expect(sendRaw).toHaveBeenCalledWith(
      "member@example.invalid",
      "Your OlogyCrew Account Has Been Deleted",
      expect.stringContaining("Account Deleted"),
      "Hi Member, your OlogyCrew account has been deleted. Your personal information has been anonymized and your profile is no longer visible. If this was done in error, contact support@ologycrew.com.",
      "noreply",
      { purpose: "security" },
    );
  });

  it("preserves non-throwing failure when deletion mail transport rejects", async () => {
    sendRaw.mockRejectedValue(new Error("transport unavailable"));
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(sendAccountDeletionEmail("member@example.invalid", "Member")).resolves.toBe(false);

    error.mockRestore();
  });
});
