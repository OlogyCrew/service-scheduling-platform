import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { platformSettings, socialPosts } from "../drizzle/schema";
import { sdk } from "./_core/sdk";
import { deleteHeartbeatJob } from "./_core/heartbeat";
import { requireDb } from "./db/connection";
import { generateSocialPost, publishSocialPost } from "./socialMedia";
import { ADMIN_SOCIAL_PLATFORMS } from "../shared/adminSocialPlatforms";

export const WEEKLY_SOCIAL_TASK_SETTING = "weekly_social_post_task_uid";

async function taskIdentity(req: Request): Promise<string | null> {
  try {
    const user = await sdk.authenticateRequest(req);
    return user.isCron && user.taskUid ? user.taskUid : null;
  } catch {
    return null;
  }
}

function utcMondayKey(now: Date): string {
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return `weekly-${monday.toISOString().slice(0, 10)}`;
}

function fail(req: Request, res: Response, error: unknown, taskUid?: string) {
  console.error("[SocialMedia] Scheduled post failed:", error);
  return res.status(500).json({
    error: error instanceof Error ? error.message : String(error),
    context: { url: req.url, taskUid },
    timestamp: new Date().toISOString(),
  });
}

/** The existing Monday Heartbeat can create at most one campaign row per UTC week. */
export async function handleScheduledSocialPost(req: Request, res: Response) {
  const uid = await taskIdentity(req);
  if (!uid) return res.status(403).json({ error: "cron-only" });
  try {
    const db = await requireDb();
    const [binding] = await db.select({ value: platformSettings.settingValue }).from(platformSettings)
      .where(eq(platformSettings.settingKey, WEEKLY_SOCIAL_TASK_SETTING)).limit(1);
    if (binding?.value !== uid) return res.json({ ok: true, skipped: "orphan" });

    const key = utcMondayKey(new Date());
    let [post] = await db.select().from(socialPosts).where(eq(socialPosts.weeklyKey, key)).limit(1);
    if (!post) {
      const generated = await generateSocialPost();
      // A retried or concurrent Heartbeat may race here. The unique key preserves one post.
      await db.insert(socialPosts).values({
        content: generated.content, postType: generated.postType,
        categoryId: generated.categoryId ?? null, categoryName: generated.categoryName ?? null,
        mediaUrl: generated.mediaUrl, mediaAlt: generated.mediaAlt, targetUrl: generated.targetUrl,
        platforms: [...ADMIN_SOCIAL_PLATFORMS], status: "draft", weeklyKey: key,
      }).onDuplicateKeyUpdate({ set: { weeklyKey: key } });
      [post] = await db.select().from(socialPosts).where(eq(socialPosts.weeklyKey, key)).limit(1);
    }
    if (!post) throw new Error("Weekly social post was not saved");
    if (post.status === "posted" || post.status === "publishing") {
      return res.json({ ok: true, skipped: post.status, postId: post.id });
    }
    const result = await publishSocialPost(post.id);
    if (!result.success) return res.status(500).json({ success: false, results: result.results, postId: post.id });
    return res.json({ success: true, results: result.results, postId: post.id });
  } catch (error) {
    return fail(req, res, error, uid);
  }
}

/** One-time job: lookup by the authenticated task UID, never by the caller's body. */
export async function handleScheduledSocialDraft(req: Request, res: Response) {
  const uid = await taskIdentity(req);
  if (!uid) return res.status(403).json({ error: "cron-only" });
  try {
    const db = await requireDb();
    const [post] = await db.select().from(socialPosts).where(eq(socialPosts.scheduleCronTaskUid, uid)).limit(1);
    if (!post) return res.json({ ok: true, skipped: "orphan" });
    if (post.status === "posted") {
      await deleteHeartbeatJob(uid, "");
      await db.update(socialPosts).set({ scheduleCronTaskUid: null }).where(eq(socialPosts.id, post.id));
      return res.json({ ok: true, skipped: "posted" });
    }
    if (post.status === "publishing") return res.json({ ok: true, skipped: "publishing" });
    if (!["scheduled", "partial", "failed"].includes(post.status) || !post.scheduledAt) {
      return res.json({ ok: true, skipped: "not-scheduled" });
    }
    if (post.scheduledAt > Date.now() + 60_000) return res.json({ ok: true, skipped: "not-due" });
    const result = await publishSocialPost(post.id);
    if (!result.success) return res.status(500).json({ success: false, results: result.results, postId: post.id });
    // One-time scheduling is achieved with a platform-owned Heartbeat that is retired after delivery.
    try {
      await deleteHeartbeatJob(uid, "");
      await db.update(socialPosts).set({ scheduleCronTaskUid: null }).where(eq(socialPosts.id, post.id));
    } catch (error) { console.warn("[SocialMedia] Could not retire completed task", error); }
    return res.json({ success: true, results: result.results, postId: post.id });
  } catch (error) {
    return fail(req, res, error, uid);
  }
}
