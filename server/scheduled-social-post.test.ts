import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

const mock = vi.hoisted(() => ({
  authenticate: vi.fn(), requireDb: vi.fn(), generate: vi.fn(), publish: vi.fn(), retire: vi.fn(),
}));
vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: mock.authenticate } }));
vi.mock("./_core/heartbeat", () => ({ deleteHeartbeatJob: mock.retire }));
vi.mock("./db/connection", () => ({ requireDb: mock.requireDb }));
vi.mock("./socialMedia", () => ({ generateSocialPost: mock.generate, publishSocialPost: mock.publish }));
import { handleScheduledSocialPost, handleScheduledSocialDraft, WEEKLY_SOCIAL_TASK_SETTING } from "./scheduledSocialPost";

function res() {
  return { code: 200, body: null as any,
    status(n: number) { this.code = n; return this; },
    json(data: any) { this.body = data; return this; },
  };
}
const req = (path: string) => ({ url: path, body: { taskUid: "attacker-owned", postId: 999 } }) as Request;
function database({ binding = "weekly-task", post = null as any } = {}) {
  const saved = { post };
  const api = {
    select: (fields?: Record<string, unknown>) => ({ from: () => ({ where: () => ({ limit: async () => fields ? [{ value: binding }] : saved.post ? [saved.post] : [] }) }) }),
    insert: () => ({ values: (value: any) => ({ onDuplicateKeyUpdate: async () => { saved.post = { id: 5, ...value }; } }) }),
    update: () => ({ set: () => ({ where: vi.fn().mockResolvedValue(undefined) }) }),
  };
  return { api, saved };
}
beforeEach(() => {
  vi.resetAllMocks();
  mock.authenticate.mockResolvedValue({ isCron: true, taskUid: "weekly-task" });
  mock.publish.mockResolvedValue({ success: true, results: [{ platform: "facebook", success: true }] });
  mock.generate.mockResolvedValue({ content: "Original approved copy", postType: "customer_attraction", mediaUrl: "/manus-storage/card.jpg", mediaAlt: "People", targetUrl: "/browse" });
  mock.retire.mockResolvedValue(undefined);
});

describe("secured social Heartbeats", () => {
  it("rejects ordinary or unauthenticated requests before reaching the database", async () => {
    mock.authenticate.mockResolvedValueOnce({ isCron: false, taskUid: "weekly-task" });
    const one = res();
    await handleScheduledSocialPost(req("/api/scheduled/social-post"), one as unknown as Response);
    expect(one.code).toBe(403);
    mock.authenticate.mockRejectedValueOnce(new Error("No session"));
    const two = res();
    await handleScheduledSocialDraft(req("/api/scheduled/social-draft"), two as unknown as Response);
    expect(two.code).toBe(403);
    expect(mock.requireDb).not.toHaveBeenCalled();
    expect(mock.publish).not.toHaveBeenCalled();
  });
  it("binds the weekly campaign to its saved task UID and stores one post per UTC week", async () => {
    expect(WEEKLY_SOCIAL_TASK_SETTING).toBe("weekly_social_post_task_uid");
    const { api, saved } = database();
    mock.requireDb.mockResolvedValue(api);
    const response = res();
    await handleScheduledSocialPost(req("/api/scheduled/social-post"), response as unknown as Response);
    expect(response.code).toBe(200);
    expect(saved.post?.weeklyKey).toMatch(/^weekly-\d{4}-\d{2}-\d{2}$/);
    expect(saved.post?.mediaUrl).toBe("/manus-storage/card.jpg");
    expect(mock.publish).toHaveBeenCalledWith(5);
    expect(mock.generate).toHaveBeenCalledTimes(1);
  });
  it("ignores a retired weekly task without generating or publishing", async () => {
    mock.requireDb.mockResolvedValue(database({ binding: "different-task" }).api);
    const response = res();
    await handleScheduledSocialPost(req("/api/scheduled/social-post"), response as unknown as Response);
    expect(response.body).toEqual({ ok: true, skipped: "orphan" });
    expect(mock.generate).not.toHaveBeenCalled();
    expect(mock.publish).not.toHaveBeenCalled();
  });
  it("uses the authenticated per-draft UID, not the caller body, and retires the task after publishing", async () => {
    const { api } = database({ post: { id: 11, status: "scheduled", scheduledAt: Date.now() - 10_000, scheduleCronTaskUid: "weekly-task" } });
    mock.requireDb.mockResolvedValue(api);
    const response = res();
    await handleScheduledSocialDraft(req("/api/scheduled/social-draft"), response as unknown as Response);
    expect(response.code).toBe(200);
    expect(mock.publish).toHaveBeenCalledWith(11);
    expect(mock.retire).toHaveBeenCalledWith("weekly-task", "");
  });
  it("never publishes an early, already-posted, or missing scheduled draft", async () => {
    for (const post of [null, { id: 11, status: "scheduled", scheduledAt: Date.now() + 600_000 }, { id: 11, status: "posted", scheduledAt: Date.now() - 10_000 }]) {
      mock.requireDb.mockResolvedValueOnce(database({ post }).api);
      const response = res();
      await handleScheduledSocialDraft(req("/api/scheduled/social-draft"), response as unknown as Response);
      expect(response.code).toBe(200);
    }
    expect(mock.publish).not.toHaveBeenCalled();
  });
});
