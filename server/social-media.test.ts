import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  ENV: {
    facebookPageAccessToken: "",
    facebookPageId: "",
    linkedinAccessToken: "",
    linkedinOrganizationId: "",
  },
  invokeLLM: vi.fn(),
  requireDb: vi.fn(),
  selectedRows: [] as Array<Record<string, unknown>>,
  insertedValues: [] as Array<Record<string, unknown>>,
  updateValues: [] as Array<Record<string, unknown>>,
  updateAffectedRows: [] as number[],
  insertId: 101,
  djAvailable: vi.fn(),
}));

vi.mock("./_core/llm", () => ({ invokeLLM: state.invokeLLM }));
vi.mock("./_core/env", () => ({ ENV: state.ENV }));
vi.mock("./db/connection", () => ({ requireDb: state.requireDb }));
vi.mock("./socialSpotlight", () => ({
  DJ_SPOTLIGHT: { id: 20, name: "DJ & MUSIC SERVICES", slug: "dj-music-services" },
  isDjSpotlightAvailable: state.djAvailable,
}));

function createDb() {
  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => state.selectedRows),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((values: Record<string, unknown>) => {
        state.insertedValues.push(values);
        return { $returningId: vi.fn(async () => [{ id: state.insertId }]) };
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: Record<string, unknown>) => {
        state.updateValues.push(values);
        return {
          where: vi.fn(async () => [{ affectedRows: state.updateAffectedRows.shift() ?? 1 }]),
        };
      }),
    })),
  };
  state.requireDb.mockResolvedValue(db);
  return db;
}

function jsonResponse(body: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

describe("Social Media Module", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    // First UTC Monday is the customer template, making generation deterministic.
    vi.setSystemTime(new Date("1970-01-05T00:00:00.000Z"));
    vi.clearAllMocks();
    Object.assign(state.ENV, {
      facebookPageAccessToken: "",
      facebookPageId: "",
      linkedinAccessToken: "",
      linkedinOrganizationId: "",
    });
    state.selectedRows = [];
    state.insertedValues = [];
    state.updateValues = [];
    state.updateAffectedRows = [];
    state.insertId = 101;
    state.djAvailable.mockResolvedValue(true);
    state.invokeLLM.mockResolvedValue({
      choices: [{ message: { content: "Find a service professional for your next project. #services #booking" } }],
    });
    createDb();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("saves an exact image-backed preview using a relative template path and never publishes", async () => {
    const { previewSocialPost } = await import("./socialMedia");
    const result = await previewSocialPost();

    expect(result).toMatchObject({
      postId: 101,
      postType: "customer_attraction",
      mediaUrl: "/manus-storage/ologycrew-find-services_87aa5845.jpg",
      targetUrl: "/browse",
    });
    expect(result.mediaAlt).toContain("Find the right person");
    expect(result.content).toContain("https://ologycrew.com/browse");
    expect(state.insertedValues).toEqual([expect.objectContaining({
      content: result.content,
      mediaUrl: result.mediaUrl,
      mediaAlt: result.mediaAlt,
      targetUrl: result.targetUrl,
      status: "draft",
      platforms: ["facebook", "linkedin"],
    })]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects empty LLM output instead of saving an unusable draft", async () => {
    state.invokeLLM.mockResolvedValue({ choices: [{ message: { content: "   " } }] });
    const { previewSocialPost } = await import("./socialMedia");

    await expect(previewSocialPost()).rejects.toThrow("Social post generation returned empty content");
    expect(state.insertedValues).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("generates a DJ category card only if verified live supply still exists", async () => {
    vi.setSystemTime(new Date("1970-01-19T00:00:00.000Z"));
    const { generateSocialPost } = await import("./socialMedia");
    const generated = await generateSocialPost();
    expect(generated).toMatchObject({
      postType: "category_spotlight", categoryId: 20, categoryName: "DJ & MUSIC SERVICES",
      targetUrl: "/category/dj-music-services",
      mediaUrl: "/manus-storage/ologycrew-dj-music-distinct_a53ec1e5.jpg",
    });
    expect(generated.content).toContain("https://ologycrew.com/category/dj-music-services");
    expect(state.djAvailable).toHaveBeenCalledOnce();

    state.djAvailable.mockResolvedValue(false);
    const safeFallback = await generateSocialPost();
    expect(safeFallback.postType).toBe("customer_attraction");
    expect(safeFallback.targetUrl).toBe("/browse");
  });

  it("refuses to publish a saved DJ spotlight if eligible supply disappeared after drafting", async () => {
    state.selectedRows = [{
      id: 49, content: "DJ category copy", postType: "category_spotlight", categoryId: 20,
      platforms: ["facebook", "linkedin"], status: "draft", targetUrl: "/category/dj-music-services",
      mediaUrl: "/manus-storage/ologycrew-dj-music-distinct_a53ec1e5.jpg",
    }];
    state.djAvailable.mockResolvedValue(false);
    const { publishSocialPost } = await import("./socialMedia");
    await expect(publishSocialPost(49)).rejects.toThrow("not currently eligible");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(state.updateValues).toEqual([]);
  });

  it("publishes a saved image preview to Facebook Page and the token holder's LinkedIn profile", async () => {
    state.ENV.facebookPageAccessToken = "facebook-secret";
    state.ENV.facebookPageId = "page-42";
    state.ENV.linkedinAccessToken = "linkedin-secret";
    state.ENV.linkedinOrganizationId = "org-77";
    state.selectedRows = [{
      id: 42,
      content: "Find a service professional for your next project.\n\nhttps://ologycrew.com/browse",
      postType: "customer_attraction",
      platforms: ["facebook", "linkedin"],
      status: "draft",
      mediaUrl: "/manus-storage/ologycrew-find-services_87aa5845.jpg",
      mediaAlt: "Accessible customer image",
      targetUrl: "/browse",
    }];
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ id: "fb-photo-1" }, 200))
      .mockResolvedValueOnce(jsonResponse({ sub: "member-123" }, 200))
      .mockResolvedValueOnce(jsonResponse({ value: { uploadUrl: "https://upload.linkedin.test/image", image: "urn:li:image:abc" } }, 200))
      .mockResolvedValueOnce(new Response("image-bytes", { status: 200, headers: { "Content-Type": "image/jpeg" } }))
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(jsonResponse({}, 201, { "x-restli-id": "urn:li:share:99" }));
    const { publishSocialPost } = await import("./socialMedia");

    const result = await publishSocialPost(42);

    expect(result).toEqual({
      success: true,
      results: [
        { platform: "facebook", success: true, postId: "fb-photo-1" },
        { platform: "linkedin", success: true, postId: "urn:li:share:99", destination: "personal_profile", format: "image" },
      ],
    });
    expect(state.invokeLLM).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(6);

    const [facebookUrl, facebookRequest] = fetchMock.mock.calls[0];
    expect(facebookUrl).toBe("https://graph.facebook.com/v26.0/page-42/photos");
    expect(JSON.parse(facebookRequest.body)).toEqual({
      url: "https://ologycrew.com/manus-storage/ologycrew-find-services_87aa5845.jpg",
      caption: state.selectedRows[0].content,
      alt_text_custom: "Accessible customer image",
      access_token: "facebook-secret",
    });

    expect(fetchMock.mock.calls[1][0]).toBe("https://api.linkedin.com/v2/userinfo");
    const [initializeUrl, initializeRequest] = fetchMock.mock.calls[2];
    expect(initializeUrl).toBe("https://api.linkedin.com/rest/images?action=initializeUpload");
    expect(initializeRequest.headers).toMatchObject({
      Authorization: "Bearer linkedin-secret",
      "LinkedIn-Version": expect.stringMatching(/^20\d{4}$/),
      "X-Restli-Protocol-Version": "2.0.0",
    });
    expect(JSON.parse(initializeRequest.body)).toEqual({
      initializeUploadRequest: { owner: "urn:li:person:member-123" },
    });

    expect(fetchMock.mock.calls[3][0]).toBe("https://ologycrew.com/manus-storage/ologycrew-find-services_87aa5845.jpg");
    expect(fetchMock.mock.calls[4][0]).toBe("https://upload.linkedin.test/image");
    expect(fetchMock.mock.calls[4][1]).toMatchObject({ method: "PUT", headers: { "Content-Type": "image/jpeg" } });

    const [postsUrl, postsRequest] = fetchMock.mock.calls[5];
    expect(postsUrl).toBe("https://api.linkedin.com/rest/posts");
    expect(JSON.parse(postsRequest.body)).toEqual({
      author: "urn:li:person:member-123",
      commentary: state.selectedRows[0].content,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      content: { media: { id: "urn:li:image:abc", altText: "Accessible customer image" } },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    });
    expect(state.updateValues).toEqual([
      { status: "publishing" },
      expect.objectContaining({ status: "posted", results: result.results }),
    ]);
  });

  it("uses the legacy Facebook feed and LinkedIn personal-profile text payload for a historical draft without media", async () => {
    state.ENV.facebookPageAccessToken = "facebook-secret";
    state.ENV.facebookPageId = "page-42";
    state.ENV.linkedinAccessToken = "linkedin-secret";
    state.ENV.linkedinOrganizationId = "urn:li:organization:org-77";
    state.selectedRows = [{
      id: 43,
      content: "A historical text-only post",
      postType: "manual",
      platforms: ["facebook", "linkedin"],
      status: "scheduled",
      mediaUrl: null,
      mediaAlt: null,
      targetUrl: null,
    }];
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ id: "fb-feed-1" }, 200))
      .mockResolvedValueOnce(jsonResponse({ sub: "member-123" }, 200))
      .mockResolvedValueOnce(jsonResponse({}, 201, { "x-restli-id": "urn:li:share:historic" }));
    const { publishSocialPost } = await import("./socialMedia");

    const result = await publishSocialPost(43);

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toBe("https://graph.facebook.com/v26.0/page-42/feed");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      message: "A historical text-only post",
      access_token: "facebook-secret",
    });
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.linkedin.com/v2/userinfo");
    expect(fetchMock.mock.calls[2][0]).toBe("https://api.linkedin.com/v2/ugcPosts");
    const linkedInPayload = JSON.parse(fetchMock.mock.calls[2][1].body);
    expect(linkedInPayload.author).toBe("urn:li:person:member-123");
    expect(linkedInPayload.specificContent["com.linkedin.ugc.ShareContent"].shareCommentary.text).toBe("A historical text-only post");
  });

  it("refuses non-publishable saved rows before making external calls", async () => {
    state.selectedRows = [{
      id: 44,
      content: "Already published",
      postType: "manual",
      platforms: ["facebook"],
      status: "posted",
    }];
    const { publishSocialPost } = await import("./socialMedia");

    await expect(publishSocialPost(44)).rejects.toThrow("Post is not eligible for publishing");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(state.updateValues).toEqual([]);
  });

  it("does not dispatch when the conditional publishing claim loses a concurrent race", async () => {
    state.selectedRows = [{
      id: 45,
      content: "Draft claimed elsewhere",
      postType: "manual",
      platforms: ["facebook"],
      status: "draft",
    }];
    state.updateAffectedRows = [0];
    const { publishSocialPost } = await import("./socialMedia");

    await expect(publishSocialPost(45)).rejects.toThrow("Post is no longer eligible for publishing");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns separate configured-platform errors without issuing real HTTP requests when credentials are absent", async () => {
    state.selectedRows = [{
      id: 46,
      content: "Draft without credentials",
      postType: "manual",
      platforms: ["facebook", "linkedin"],
      status: "draft",
    }];
    const { publishSocialPost } = await import("./socialMedia");

    const result = await publishSocialPost(46);

    expect(result).toEqual({
      success: false,
      results: [
        { platform: "facebook", success: false, error: "Facebook credentials not configured" },
        { platform: "linkedin", success: false, error: "LinkedIn credentials not configured" },
      ],
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(state.updateValues[1]).toMatchObject({ status: "failed" });
  });

  it("retries only a previously failed channel and preserves the successful platform ID", async () => {
    state.selectedRows = [{
      id: 47, content: "Approved copy", postType: "manual",
      platforms: ["facebook", "linkedin"], status: "partial", mediaUrl: null,
      results: [
        { platform: "facebook", success: true, postId: "fb-already-posted" },
        { platform: "linkedin", success: false, error: "Temporary error" },
      ],
    }];
    state.ENV.linkedinAccessToken = "linkedin-secret";
    state.ENV.linkedinOrganizationId = "org-77";
    fetchMock.mockResolvedValueOnce(jsonResponse({ sub: "member-123" }, 200))
      .mockResolvedValueOnce(jsonResponse({}, 201, { "x-restli-id": "urn:li:share:recovered" }));
    const { publishSocialPost } = await import("./socialMedia");
    const result = await publishSocialPost(47);
    expect(result).toEqual({ success: true, results: [
      { platform: "facebook", success: true, postId: "fb-already-posted" },
      { platform: "linkedin", success: true, postId: "urn:li:share:recovered", destination: "personal_profile", format: "text" },
    ] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.linkedin.com/v2/userinfo");
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.linkedin.com/v2/ugcPosts");
    expect(state.updateValues[1]).toMatchObject({ status: "posted" });
  });

  it("posts to the token holder's profile even if the organization ID is absent", async () => {
    state.selectedRows = [{ id: 48, content: "Personal profile post", postType: "manual", platforms: ["linkedin"], status: "draft" }];
    state.ENV.linkedinAccessToken = "linkedin-secret";
    fetchMock.mockResolvedValueOnce(jsonResponse({ sub: "member-123" }, 200))
      .mockResolvedValueOnce(jsonResponse({}, 201, { "x-restli-id": "urn:li:share:personal" }));
    const { publishSocialPost } = await import("./socialMedia");
    const result = await publishSocialPost(48);
    expect(result).toMatchObject({ success: true, results: [{ platform: "linkedin", destination: "personal_profile", format: "text" }] });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).author).toBe("urn:li:person:member-123");
  });

  it("falls back to the same personal-profile caption when LinkedIn member image upload is unavailable, never reposting Facebook", async () => {
    state.ENV.linkedinAccessToken = "linkedin-secret";
    state.ENV.linkedinOrganizationId = "unusable-org";
    state.selectedRows = [{
      id: 49, content: "Approved social caption\n\nhttps://ologycrew.com/browse", postType: "customer_attraction",
      platforms: ["facebook", "linkedin"], status: "partial",
      mediaUrl: "/manus-storage/ologycrew-find-services_87aa5845.jpg", mediaAlt: "Illustrative customer card",
      results: [{ platform: "facebook", success: true, postId: "fb-already-posted" },
        { platform: "linkedin", success: false, error: "Previous organization image upload 400" }],
    }];
    fetchMock.mockResolvedValueOnce(jsonResponse({ sub: "member-123" }, 200))
      .mockResolvedValueOnce(jsonResponse({ message: "image upload unavailable" }, 400))
      .mockResolvedValueOnce(jsonResponse({}, 201, { "x-restli-id": "urn:li:share:personal-text" }));
    const { publishSocialPost } = await import("./socialMedia");
    const result = await publishSocialPost(49);
    expect(result).toEqual({ success: true, results: [
      { platform: "facebook", success: true, postId: "fb-already-posted" },
      { platform: "linkedin", success: true, postId: "urn:li:share:personal-text", destination: "personal_profile", format: "text" },
    ] });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.linkedin.com/v2/userinfo");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).initializeUploadRequest.owner).toBe("urn:li:person:member-123");
    expect(fetchMock.mock.calls[2][0]).toBe("https://api.linkedin.com/v2/ugcPosts");
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).specificContent["com.linkedin.ugc.ShareContent"].shareCommentary.text).toBe(state.selectedRows[0].content);
  });

  it("does not duplicate an image post with a text fallback after LinkedIn returns an ambiguous 5xx", async () => {
    state.ENV.linkedinAccessToken = "linkedin-secret";
    state.selectedRows = [{
      id: 51, content: "Copy and target URL", postType: "manual", platforms: ["linkedin"], status: "draft",
      mediaUrl: "/manus-storage/ologycrew-find-services_87aa5845.jpg", mediaAlt: "Illustrative card",
    }];
    fetchMock.mockResolvedValueOnce(jsonResponse({ sub: "member-123" }, 200))
      .mockResolvedValueOnce(jsonResponse({ value: { uploadUrl: "https://upload.linkedin.test/image", image: "urn:li:image:abc" } }, 200))
      .mockResolvedValueOnce(new Response("image-bytes", { status: 200, headers: { "Content-Type": "image/jpeg" } }))
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(jsonResponse({ message: "Server error" }, 500));
    const { publishSocialPost } = await import("./socialMedia");
    const result = await publishSocialPost(51);
    expect(result.success).toBe(false);
    expect(result.results[0].error).toContain("500");
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(fetchMock.mock.calls.some(([url]) => url === "https://api.linkedin.com/v2/ugcPosts")).toBe(false);
  });

  it("does not send a profile post when LinkedIn userinfo cannot resolve an authorized member", async () => {
    state.ENV.linkedinAccessToken = "linkedin-secret";
    state.selectedRows = [{ id: 50, content: "Copy", postType: "manual", platforms: ["linkedin"], status: "draft" }];
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 401));
    const { publishSocialPost } = await import("./socialMedia");
    const result = await publishSocialPost(50);
    expect(result.success).toBe(false);
    expect(result.results[0].error).toContain("identity unavailable");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
