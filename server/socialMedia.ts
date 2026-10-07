import { ENV } from "./_core/env";
import { invokeLLM } from "./_core/llm";
import { requireDb } from "./db/connection";
import { socialPosts } from "../drizzle/schema";
import { and, eq, inArray } from "drizzle-orm";
import { OLOGYCREW_ORIGIN, SOCIAL_POST_TEMPLATES } from "../shared/socialPostTemplates";
import {
  ADMIN_SOCIAL_PLATFORMS,
  normalizeAdminSocialPlatforms,
  type AdminSocialPlatform,
} from "../shared/adminSocialPlatforms";

const LINKEDIN_VERSION = "202609";
const PUBLISHABLE_STATUSES = ["draft", "scheduled", "pending", "partial", "failed"] as const;
const APPROVED_MEDIA_PATHS: Set<string> = new Set(
  Object.values(SOCIAL_POST_TEMPLATES).map((template) => template.imagePath),
);

type SocialPostType = "provider_recruitment" | "customer_attraction";

type SocialMedia = {
  mediaUrl: string;
  mediaAlt: string;
  targetUrl: string;
};

type GeneratedSocialPost = {
  content: string;
  postType: SocialPostType;
  categoryId?: number;
  categoryName?: string;
} & SocialMedia;

type SavedSocialPost = {
  id: number;
  content: string;
  postType: string;
  categoryId?: number | null;
  categoryName?: string | null;
  platforms: string[] | null;
  results?: PlatformPublishResult[] | null;
  status: string;
  mediaUrl?: string | null;
  mediaAlt?: string | null;
  targetUrl?: string | null;
};

type PublishResult = {
  success: boolean;
  postId?: string;
  error?: string;
};

type PlatformPublishResult = PublishResult & { platform: AdminSocialPlatform };

type SocialPostInsert = {
  content: string;
  postType: string;
  categoryId?: number | null;
  categoryName?: string | null;
  platforms: string[];
  status: string;
  mediaUrl?: string | null;
  mediaAlt?: string | null;
  targetUrl?: string | null;
  createdAt?: number;
};

function publicOlogyCrewUrl(path: string): string {
  return new URL(path, OLOGYCREW_ORIGIN).toString();
}

function socialMediaFor(postType: SocialPostType): SocialMedia {
  const template = postType === "provider_recruitment"
    ? SOCIAL_POST_TEMPLATES.provider
    : SOCIAL_POST_TEMPLATES.customer;
  return {
    // Keep approved storage URLs relative in drafts/previews. They are promoted
    // to absolute URLs only at the Facebook/LinkedIn HTTP boundary.
    mediaUrl: template.imagePath,
    mediaAlt: template.alt,
    targetUrl: template.destination,
  };
}

function fallbackSocialMedia(): SocialMedia {
  return {
    mediaUrl: SOCIAL_POST_TEMPLATES.spotlight.imagePath,
    mediaAlt: SOCIAL_POST_TEMPLATES.spotlight.alt,
    targetUrl: SOCIAL_POST_TEMPLATES.spotlight.destination,
  };
}

/**
 * Alternate customer and provider creative by UTC week. Category spotlights are
 * deliberately not generated: a category URL must only be promoted after a
 * provider/service availability check, which this small publisher does not make.
 */
function weeklyPostType(now = Date.now()): SocialPostType {
  const day = new Date(now);
  const monday = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return Math.floor((monday - Date.UTC(1970, 0, 5)) / (7 * 24 * 60 * 60 * 1000)) % 2 === 0
    ? "customer_attraction"
    : "provider_recruitment";
}

function includeTargetUrl(content: string, targetUrl: string): string {
  const publicTargetUrl = publicOlogyCrewUrl(targetUrl);
  return content.includes(publicTargetUrl) ? content : `${content}\n\n${publicTargetUrl}`;
}

/** Generate a factual, image-backed post plan. This function never publishes. */
export async function generateSocialPost(): Promise<GeneratedSocialPost> {
  const postType = weeklyPostType();
  const media = socialMediaFor(postType);
  const audiencePrompt = postType === "provider_recruitment"
    ? "Invite independent service providers to create a listing and manage bookings with OlogyCrew."
    : "Invite customers to explore and book services through OlogyCrew.";

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: "You write concise, accurate social posts for OlogyCrew, a service scheduling platform. Do not invent provider availability, testimonials, reviews, verification, guarantees, prices, or outcomes.",
      },
      {
        role: "user",
        content: `${audiencePrompt} Write 2-3 professional, engaging sentences with at most two emojis and 2-3 relevant hashtags. Include this exact call-to-action URL: ${publicOlogyCrewUrl(media.targetUrl)}. Do not use testimonials or claims that providers are verified. Return only the post text.`,
      },
    ],
  });

  const generatedContent = String(response.choices?.[0]?.message?.content ?? "").trim();
  if (!generatedContent) {
    throw new Error("Social post generation returned empty content");
  }

  return {
    content: includeTargetUrl(generatedContent, media.targetUrl),
    postType,
    ...media,
  };
}

function hasApprovedMediaUrl(mediaUrl: string): boolean {
  try {
    const url = new URL(mediaUrl);
    return url.origin === OLOGYCREW_ORIGIN && APPROVED_MEDIA_PATHS.has(url.pathname);
  } catch {
    return APPROVED_MEDIA_PATHS.has(mediaUrl);
  }
}

function externalMediaUrl(mediaUrl: string): string {
  if (!hasApprovedMediaUrl(mediaUrl)) {
    throw new Error("Media URL is not an approved OlogyCrew asset");
  }
  return new URL(mediaUrl, OLOGYCREW_ORIGIN).toString();
}

function safeErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error) || !error.message) return fallback;
  return error.message
    .replace(/(access[_ -]?token|authorization|bearer)\s*[:= ]\s*[^,\s]+/gi, "$1=[redacted]")
    .slice(0, 300);
}

async function postToFacebook(content: string, media?: Pick<SocialMedia, "mediaUrl" | "mediaAlt">): Promise<PublishResult> {
  if (!ENV.facebookPageAccessToken || !ENV.facebookPageId) {
    return { success: false, error: "Facebook credentials not configured" };
  }

  if (media?.mediaUrl && !hasApprovedMediaUrl(media.mediaUrl)) {
    return { success: false, error: "Facebook media URL is not an approved OlogyCrew asset" };
  }

  const hasMedia = Boolean(media?.mediaUrl);
  const endpoint = hasMedia
    ? `https://graph.facebook.com/v26.0/${ENV.facebookPageId}/photos`
    : `https://graph.facebook.com/v26.0/${ENV.facebookPageId}/feed`;
  const payload = hasMedia
    ? {
        url: externalMediaUrl(media!.mediaUrl),
        caption: content,
        alt_text_custom: media!.mediaAlt || fallbackSocialMedia().mediaAlt,
        access_token: ENV.facebookPageAccessToken,
      }
    : {
        message: content,
        access_token: ENV.facebookPageAccessToken,
      };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({})) as { id?: string; post_id?: string };
    if (response.ok && (data.post_id || data.id)) {
      return { success: true, postId: data.post_id || data.id };
    }
    return { success: false, error: `Facebook API error (${response.status})` };
  } catch (error) {
    return { success: false, error: `Facebook request failed: ${safeErrorMessage(error, "unknown error")}` };
  }
}

function linkedinHeaders(includeJsonContentType = true): HeadersInit {
  return {
    Authorization: `Bearer ${ENV.linkedinAccessToken}`,
    ...(includeJsonContentType ? { "Content-Type": "application/json" } : {}),
    "LinkedIn-Version": LINKEDIN_VERSION,
    "X-Restli-Protocol-Version": "2.0.0",
  };
}

async function linkedinAuthor(): Promise<string> {
  const configuredOrganization = ENV.linkedinOrganizationId.trim();
  if (!configuredOrganization) throw new Error("LinkedIn organization ID not configured");
  return configuredOrganization.startsWith("urn:li:organization:")
    ? configuredOrganization
    : `urn:li:organization:${configuredOrganization}`;
}

function imageContentType(mediaUrl: string, sourceType: string | null): string {
  if (sourceType?.startsWith("image/")) return sourceType;
  if (mediaUrl.toLowerCase().endsWith(".png")) return "image/png";
  if (mediaUrl.toLowerCase().endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

async function uploadLinkedInImage(media: Pick<SocialMedia, "mediaUrl" | "mediaAlt">, owner: string): Promise<string> {
  if (!hasApprovedMediaUrl(media.mediaUrl)) {
    throw new Error("LinkedIn media URL is not an approved OlogyCrew asset");
  }

  const initializeResponse = await fetch("https://api.linkedin.com/rest/images?action=initializeUpload", {
    method: "POST",
    headers: linkedinHeaders(),
    body: JSON.stringify({ initializeUploadRequest: { owner } }),
  });
  const initialized = await initializeResponse.json().catch(() => ({})) as {
    value?: { uploadUrl?: string; image?: string };
  };
  const uploadUrl = initialized.value?.uploadUrl;
  const imageUrn = initialized.value?.image;
  if (!initializeResponse.ok || !uploadUrl || !imageUrn) {
    throw new Error(`LinkedIn image initialization failed (${initializeResponse.status})`);
  }

  const imageResponse = await fetch(externalMediaUrl(media.mediaUrl));
  if (!imageResponse.ok) {
    throw new Error(`OlogyCrew image download failed (${imageResponse.status})`);
  }

  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": imageContentType(media.mediaUrl, imageResponse.headers.get("content-type")) },
    body: await imageResponse.arrayBuffer(),
  });
  if (!uploadResponse.ok) {
    throw new Error(`LinkedIn image upload failed (${uploadResponse.status})`);
  }

  return imageUrn;
}

async function postToLinkedIn(content: string, media?: Pick<SocialMedia, "mediaUrl" | "mediaAlt">): Promise<PublishResult> {
  if (!ENV.linkedinAccessToken) {
    return { success: false, error: "LinkedIn credentials not configured" };
  }

  try {
    // When an organization is configured, every API request uses that exact
    // organization author. We intentionally never fall back to a member author.
    const author = await linkedinAuthor();
    const imageUrn = media?.mediaUrl ? await uploadLinkedInImage(media, author) : undefined;
    const payload = {
      author,
      commentary: content,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      ...(imageUrn
        ? { content: { media: { id: imageUrn, altText: media?.mediaAlt || fallbackSocialMedia().mediaAlt } } }
        : {}),
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    };
    const response = await fetch("https://api.linkedin.com/rest/posts", {
      method: "POST",
      headers: linkedinHeaders(),
      body: JSON.stringify(payload),
    });
    if (response.status === 201) {
      return { success: true, postId: response.headers.get("x-restli-id") || "published" };
    }
    return { success: false, error: `LinkedIn API error (${response.status})` };
  } catch (error) {
    return { success: false, error: `LinkedIn request failed: ${safeErrorMessage(error, "unknown error")}` };
  }
}

async function insertSocialPost(
  db: Awaited<ReturnType<typeof requireDb>>,
  values: SocialPostInsert,
): Promise<{ id: number }> {
  const [inserted] = await db.insert(socialPosts).values(values).$returningId();
  return inserted;
}

async function claimForPublishing(
  db: Awaited<ReturnType<typeof requireDb>>,
  socialPostId: number,
): Promise<void> {
  const claimResult = await db.update(socialPosts)
    .set({ status: "publishing" })
    .where(and(
      eq(socialPosts.id, socialPostId),
      inArray(socialPosts.status, [...PUBLISHABLE_STATUSES]),
    ));
  const affectedRows = (claimResult as Array<{ affectedRows?: number }>)[0]?.affectedRows;
  if (affectedRows !== 1) {
    throw new Error("Post is no longer eligible for publishing");
  }
}

export async function publishSocialPost(postId?: number): Promise<{
  success: boolean;
  results: PlatformPublishResult[];
}> {
  const db = await requireDb();
  let post: SavedSocialPost;

  if (postId !== undefined) {
    const [savedPost] = await db.select().from(socialPosts).where(eq(socialPosts.id, postId));
    if (!savedPost) throw new Error("Post not found");
    post = savedPost as SavedSocialPost;
    if (!PUBLISHABLE_STATUSES.includes(post.status as (typeof PUBLISHABLE_STATUSES)[number])) {
      throw new Error("Post is not eligible for publishing");
    }
  } else {
    const generated = await generateSocialPost();
    const inserted = await insertSocialPost(db, {
      content: generated.content,
      postType: generated.postType,
      categoryId: generated.categoryId || null,
      categoryName: generated.categoryName || null,
      mediaUrl: generated.mediaUrl,
      mediaAlt: generated.mediaAlt,
      targetUrl: generated.targetUrl,
      platforms: [...ADMIN_SOCIAL_PLATFORMS],
      status: "pending",
      createdAt: Date.now(),
    });
    post = {
      id: inserted.id,
      content: generated.content,
      postType: generated.postType,
      platforms: [...ADMIN_SOCIAL_PLATFORMS],
      status: "pending",
      mediaUrl: generated.mediaUrl,
      mediaAlt: generated.mediaAlt,
      targetUrl: generated.targetUrl,
    };
  }

  if (!post.content.trim()) {
    throw new Error("Post content is empty");
  }

  // This conditional state transition prevents concurrent cron/admin attempts
  // from dispatching the same saved draft twice.
  await claimForPublishing(db, post.id);

  const platforms = normalizeAdminSocialPlatforms(post.platforms);
  const media = post.mediaUrl
    ? { mediaUrl: post.mediaUrl, mediaAlt: post.mediaAlt || fallbackSocialMedia().mediaAlt }
    : undefined;
  const publishers: Record<AdminSocialPlatform, (content: string, selectedMedia?: Pick<SocialMedia, "mediaUrl" | "mediaAlt">) => Promise<PublishResult>> = {
    facebook: postToFacebook,
    linkedin: postToLinkedIn,
  };

  const previousResults = post.results ?? [];
  const completed = previousResults.filter((item) => item.success && platforms.includes(item.platform as AdminSocialPlatform));
  const remaining = platforms.filter((platform) => !completed.some((item) => item.platform === platform));
  const attempted = await Promise.all(
    remaining.map(async (platform): Promise<PlatformPublishResult> => ({
      platform,
      ...(await publishers[platform](post.content, media)),
    })),
  );
  const results = [...completed, ...attempted] as PlatformPublishResult[];
  const succeeded = results.filter((result) => result.success).length;
  const status = results.length > 0 && succeeded === results.length
    ? "posted"
    : succeeded > 0
      ? "partial"
      : "failed";

  await db.update(socialPosts)
    .set({ results, status, postedAt: Date.now() })
    .where(eq(socialPosts.id, post.id));

  return { success: results.length > 0 && succeeded === results.length, results };
}

export async function previewSocialPost(): Promise<{
  content: string;
  postType: string;
  categoryName?: string;
  mediaUrl: string;
  mediaAlt: string;
  targetUrl: string;
  postId: number;
}> {
  const generated = await generateSocialPost();
  const db = await requireDb();
  const inserted = await insertSocialPost(db, {
    content: generated.content,
    postType: generated.postType,
    categoryId: generated.categoryId || null,
    categoryName: generated.categoryName || null,
    mediaUrl: generated.mediaUrl,
    mediaAlt: generated.mediaAlt,
    targetUrl: generated.targetUrl,
    platforms: [...ADMIN_SOCIAL_PLATFORMS],
    status: "draft",
    createdAt: Date.now(),
  });

  return {
    content: generated.content,
    postType: generated.postType,
    categoryName: generated.categoryName,
    mediaUrl: generated.mediaUrl,
    mediaAlt: generated.mediaAlt,
    targetUrl: generated.targetUrl,
    postId: inserted.id,
  };
}
