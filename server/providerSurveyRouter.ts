import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { createAuditEntry } from "./db/auditLog";
import {
  createProviderSurveyCampaign,
  getLatestProviderSurveyCampaign,
  getProviderSurveyByToken,
  getProviderSurveyDashboard,
  sendProviderSurveyCampaign,
  submitProviderSurveyResponse,
} from "./providerSurvey";

const answerValue = z.union([z.string().trim().min(1).max(500), z.array(z.string().trim().min(1).max(500)).min(1).max(10)]);

export const providerSurveyRouter = router({
  getByToken: publicProcedure
    .input(z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }))
    .query(async ({ input }) => {
      const survey = await getProviderSurveyByToken(input.token);
      if (!survey) throw new TRPCError({ code: "NOT_FOUND", message: "This survey link is invalid, expired, or closed." });
      return survey;
    }),

  submit: publicProcedure
    .input(z.object({
      token: z.string().regex(/^[a-f0-9]{64}$/),
      answers: z.record(z.string().min(1).max(80), answerValue).refine((answers) => Object.keys(answers).length >= 6, "Please answer each survey question."),
    }))
    .mutation(async ({ input }) => submitProviderSurveyResponse(input.token, input.answers)),

  getDashboard: adminProcedure.query(async () => getProviderSurveyDashboard()),

  prepareCampaign: adminProcedure.mutation(async ({ ctx }) => {
    const existing = await getLatestProviderSurveyCampaign();
    if (existing && existing.status !== "closed") {
      throw new TRPCError({ code: "CONFLICT", message: "A provider survey campaign already exists. Review it before preparing another." });
    }
    const result = await createProviderSurveyCampaign(ctx.user!.id);
    await createAuditEntry({ actorId: ctx.user!.id, action: "prepare_provider_survey", targetType: "system", targetId: result.campaignId, details: result });
    return result;
  }),

  sendCampaign: adminProcedure
    .input(z.object({ campaignId: z.number().int().positive(), confirmation: z.literal("SEND_PROVIDER_SURVEY") }))
    .mutation(async ({ ctx, input }) => {
      const result = await sendProviderSurveyCampaign(input.campaignId);
      await createAuditEntry({ actorId: ctx.user!.id, action: "send_provider_survey", targetType: "system", targetId: input.campaignId, details: result });
      return result;
    }),
});
