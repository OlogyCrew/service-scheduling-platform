import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getAllPlatformSettings, getPlatformSetting, bulkUpsertPlatformSettings } from "../db/platformSettings";
import { createAuditEntry } from "../db/auditLog";

export const platformSettingsRouter = router({
  /**
   * Get all platform settings (public — used by Contact page, footer, etc.)
   */
  getAll: publicProcedure.query(async () => {
    const settings = await getAllPlatformSettings();
    delete settings.payment_velocity_rules;
    return settings;
  }),

  /**
   * Get a single setting by key (public)
   */
  get: publicProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ input }) => {
      if (input.key === "payment_velocity_rules") {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const value = await getPlatformSetting(input.key);
      return { key: input.key, value };
    }),

  /**
   * Update platform settings (admin only)
   */
  update: protectedProcedure
    .input(
      z.object({
        settings: z.record(z.string(), z.string()),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can update platform settings" });
      }
      await bulkUpsertPlatformSettings(input.settings);
      if (Object.prototype.hasOwnProperty.call(input.settings, "payment_velocity_rules")) {
        let details: Record<string, unknown> = { settingKey: "payment_velocity_rules" };
        try {
          const parsed = JSON.parse(input.settings.payment_velocity_rules);
          details = {
            settingKey: "payment_velocity_rules",
            enabled: parsed?.enabled !== false,
            windowMinutes: parsed?.windowMinutes,
            cooldownMinutes: parsed?.cooldownMinutes,
            dimensions: Object.keys(parsed?.thresholds || {}),
          };
        } catch {
          details.invalidValue = true;
        }
        await createAuditEntry({ actorId: ctx.user.id, action: "update_payment_velocity_controls", targetType: "system", targetId: 0, details });
      }
      return { success: true };
    }),
});
