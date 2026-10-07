import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { requireDb } from "../db/connection";
import { socialPosts } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { publishSocialPost, previewSocialPost } from "../socialMedia";
import { hasAdminClearance } from "../adminPolicy";
import { ADMIN_SOCIAL_PLATFORMS } from "../../shared/adminSocialPlatforms";
import { OLOGYCREW_ORIGIN, SOCIAL_POST_TEMPLATES } from "../../shared/socialPostTemplates";
import { createHeartbeatJob, deleteHeartbeatJob } from "../_core/heartbeat";
import { DJ_SPOTLIGHT, isDjSpotlightAvailable } from "../socialSpotlight";

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!hasAdminClearance(ctx.user)) throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  return next({ ctx });
});

async function cancelScheduledPost(postId: number) {
  const db = await requireDb();
  const [post] = await db.select().from(socialPosts).where(eq(socialPosts.id, postId)).limit(1);
  if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "Post not found" });
  if (post.scheduleCronTaskUid) {
    // A failed cancel must stop the manual publish; otherwise the future callback could duplicate it.
    await deleteHeartbeatJob(post.scheduleCronTaskUid, "");
    await db.update(socialPosts).set({ scheduleCronTaskUid: null, scheduledAt: null, status: "draft" })
      .where(eq(socialPosts.id, postId));
  }
}

export const socialMediaRouter = router({
  listPosts: adminProcedure
    .input(z.object({ page: z.number().default(1), limit: z.number().default(20) }).optional())
    .query(async ({ input }) => {
      const db = await requireDb();
      const page = input?.page ?? 1;
      const limit = input?.limit ?? 20;
      return db.select().from(socialPosts).orderBy(desc(socialPosts.createdAt)).limit(limit).offset((page - 1) * limit);
    }),

  spotlightAvailable: adminProcedure.query(() => isDjSpotlightAvailable()),

  previewPost: adminProcedure.mutation(() => previewSocialPost()),

  publishPost: adminProcedure
    .input(z.object({ postId: z.number().optional() }).optional())
    .mutation(async ({ input }) => {
      if (input?.postId) await cancelScheduledPost(input.postId);
      return publishSocialPost(input?.postId);
    }),

  createPost: adminProcedure
    .input(z.object({
      content: z.string().trim().min(1).max(2000),
      platforms: z.array(z.enum(ADMIN_SOCIAL_PLATFORMS)).min(1),
      template: z.enum(["customer", "provider", "spotlight"]).default("customer"),
      scheduledAt: z.number().int().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const template = SOCIAL_POST_TEMPLATES[input.template];
      const destinationUrl = new URL(template.destination, OLOGYCREW_ORIGIN).toString();
      const caption = input.content.includes(destinationUrl) ? input.content : `${input.content}\n\n${destinationUrl}`;
      if (input.template === "spotlight" && !await isDjSpotlightAvailable()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "DJ spotlight requires an active verified non-demo provider and service." });
      }
      if (input.scheduledAt) {
        if (process.env.NODE_ENV !== "production") {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Schedule posts after publishing this checkpoint; preview can save drafts safely." });
        }
        const delay = input.scheduledAt - Date.now();
        if (delay < 120_000 || delay > 29 * 86_400_000) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a time between two minutes and 29 days from now." });
        }
      }
      const [inserted] = await db.insert(socialPosts).values({
        content: caption, postType: input.template === "spotlight" ? "category_spotlight" : "manual",
        categoryId: input.template === "spotlight" ? DJ_SPOTLIGHT.id : null,
        categoryName: input.template === "spotlight" ? DJ_SPOTLIGHT.name : null,
        platforms: input.platforms,
        mediaUrl: template.imagePath, mediaAlt: template.alt, targetUrl: template.destination,
        status: "draft", createdAt: Date.now(),
      }).$returningId();
      if (!input.scheduledAt) return { success: true, id: inserted.id, scheduled: false };

      // Heartbeats are recurring; schedule at the selected minute, then retire the task after delivery.
      const date = new Date(Math.ceil(input.scheduledAt / 60_000) * 60_000);
      const cron = `0 ${date.getUTCMinutes()} ${date.getUTCHours()} ${date.getUTCDate()} ${date.getUTCMonth() + 1} *`;
      const job = await createHeartbeatJob({
        name: `social-draft-${inserted.id}`, cron, path: "/api/scheduled/social-draft",
        description: `Publish OlogyCrew social draft ${inserted.id} once and retire task`,
      }, "");
      try {
        await db.update(socialPosts).set({
          scheduleCronTaskUid: job.taskUid, scheduledAt: input.scheduledAt, status: "scheduled",
        }).where(eq(socialPosts.id, inserted.id));
      } catch (error) {
        await deleteHeartbeatJob(job.taskUid, "").catch(() => undefined);
        throw error;
      }
      return { success: true, id: inserted.id, scheduled: true };
    }),

  publishExisting: adminProcedure
    .input(z.object({ postId: z.number() }))
    .mutation(async ({ input }) => {
      await cancelScheduledPost(input.postId);
      return publishSocialPost(input.postId);
    }),

  deletePost: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await cancelScheduledPost(input.id);
      const db = await requireDb();
      await db.delete(socialPosts).where(eq(socialPosts.id, input.id));
      return { success: true };
    }),
});
