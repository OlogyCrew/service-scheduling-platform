import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireDb: vi.fn(), preview: vi.fn(), publish: vi.fn(), createJob: vi.fn(), deleteJob: vi.fn() }));
vi.mock("./db/connection", () => ({ requireDb: mocks.requireDb }));
vi.mock("./socialMedia", () => ({ previewSocialPost: mocks.preview, publishSocialPost: mocks.publish }));
vi.mock("./_core/heartbeat", () => ({ createHeartbeatJob: mocks.createJob, deleteHeartbeatJob: mocks.deleteJob }));
import { socialMediaRouter } from "./routers/socialMediaRouter";

const user = (role: string, email: string) => ({ role, email, adminRole: role === "admin" ? "super_admin" : null });
const caller = (role: string, email: string) => socialMediaRouter.createCaller({ user: user(role, email) } as never);
const admin = () => caller("admin", "garychisolm30@gmail.com");
let savedPost: Record<string, unknown> | undefined;
let inserted: Record<string, unknown> | undefined;
let changes: Record<string, unknown>[];

beforeEach(() => {
  vi.resetAllMocks();
  savedPost = undefined;
  inserted = undefined;
  changes = [];
  mocks.requireDb.mockResolvedValue({
    insert: () => ({ values: (row: Record<string, unknown>) => {
      inserted = row;
      return { $returningId: async () => [{ id: 200 }] };
    } }),
    select: () => ({ from: () => ({ where: () => ({ limit: async () => savedPost ? [savedPost] : [] }) }) }),
    update: () => ({ set: (row: Record<string, unknown>) => { changes.push(row); return { where: async () => undefined }; } }),
  });
  mocks.preview.mockResolvedValue({ postId: 100, content: "exact preview", mediaUrl: "/manus-storage/approved.jpg" });
  mocks.publish.mockResolvedValue({ success: true, results: [] });
  mocks.createJob.mockResolvedValue({ taskUid: "cron-uid" });
  mocks.deleteJob.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe("Admin social image-post router", () => {
  it("denies guests and users without named admin clearance before creating any post", async () => {
    await expect(caller("customer", "member@example.com").createPost({ content: "Hi", platforms: ["facebook"], template: "customer" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller("admin", "unapproved@example.com").previewPost()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.requireDb).not.toHaveBeenCalled();
    expect(mocks.preview).not.toHaveBeenCalled();
  });
  it("persists approved artwork and the actual public destination with the manual caption", async () => {
    const result = await admin().createPost({ content: "Meet the people behind the craft.", platforms: ["facebook", "linkedin"], template: "provider" });
    expect(result).toEqual({ success: true, id: 200, scheduled: false });
    expect(inserted).toMatchObject({
      content: "Meet the people behind the craft.\n\nhttps://ologycrew.com/for-providers",
      platforms: ["facebook", "linkedin"], status: "draft",
      mediaUrl: "/manus-storage/ologycrew-for-providers_ee456d77.jpg",
      targetUrl: "/for-providers",
    });
    expect(mocks.createJob).not.toHaveBeenCalled();
  });
  it("publishes precisely the saved preview ID, never a newly generated post", async () => {
    savedPost = { id: 100, status: "draft", scheduleCronTaskUid: null };
    expect(await admin().previewPost()).toMatchObject({ postId: 100 });
    await admin().publishPost({ postId: 100 });
    expect(mocks.publish).toHaveBeenCalledWith(100);
    expect(mocks.createJob).not.toHaveBeenCalled();
  });
  it("refuses preview-environment scheduling instead of saving a fake scheduled row", async () => {
    await expect(admin().createPost({ content: "Join us", platforms: ["facebook"], scheduledAt: Date.now() + 3600000 })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(inserted).toBeUndefined();
    expect(mocks.createJob).not.toHaveBeenCalled();
  });
  it("creates a task-bound Heartbeat for a real production scheduled draft", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const result = await admin().createPost({ content: "Find your next service", platforms: ["facebook"], template: "customer", scheduledAt: Date.now() + 3600000 });
    expect(result).toEqual({ success: true, id: 200, scheduled: true });
    expect(mocks.createJob).toHaveBeenCalledWith(expect.objectContaining({ name: "social-draft-200", path: "/api/scheduled/social-draft", cron: expect.stringMatching(/^0 \d+ \d+ \d+ \d+ \*$/) }), "");
    expect(changes).toContainEqual(expect.objectContaining({ scheduleCronTaskUid: "cron-uid", status: "scheduled" }));
  });
  it("does not publish or delete a scheduled post if its existing task cannot be cancelled", async () => {
    savedPost = { id: 110, status: "scheduled", scheduleCronTaskUid: "cron-uid" };
    mocks.deleteJob.mockRejectedValueOnce(new Error("Heartbeat unavailable"));
    await expect(admin().publishExisting({ postId: 110 })).rejects.toThrow("Heartbeat unavailable");
    expect(mocks.publish).not.toHaveBeenCalled();
  });
});
