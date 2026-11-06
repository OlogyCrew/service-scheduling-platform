import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import {
  notificationPreferences,
  providerSurveyCampaigns,
  providerSurveyRecipients,
  providerSurveyResponses,
  serviceProviders,
  users,
} from "../drizzle/schema";
import { getDb } from "./db/connection";
import { sendNotification } from "./notifications";
import { OLOGYCREW_PUBLIC_ORIGIN } from "../shared/publicUrls";
import { PROVIDER_SURVEY_QUESTIONS } from "../shared/providerSurvey";

export const PROVIDER_SURVEY_NAME = "Provider experience survey — November 2026";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function makeToken(): string {
  return randomBytes(32).toString("hex");
}

function surveyUrl(token: string): string {
  return `${OLOGYCREW_PUBLIC_ORIGIN}/provider-survey/${token}`;
}

export async function getLatestProviderSurveyCampaign() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [campaign] = await db.select().from(providerSurveyCampaigns).orderBy(desc(providerSurveyCampaigns.createdAt)).limit(1);
  return campaign ?? null;
}

export async function createProviderSurveyCampaign(createdByUserId: number, name = PROVIDER_SURVEY_NAME) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [campaign] = await db.insert(providerSurveyCampaigns).values({ name, createdByUserId }).$returningId();
  if (!campaign) throw new Error("Unable to create survey campaign");

  const eligibleProviders = await db.select({
    providerId: serviceProviders.id,
    userId: users.id,
    email: users.email,
  }).from(serviceProviders)
    .innerJoin(users, eq(serviceProviders.userId, users.id))
    .leftJoin(notificationPreferences, eq(notificationPreferences.userId, users.id))
    .where(and(
      eq(serviceProviders.isActive, true),
      eq(serviceProviders.isOfficial, false),
      isNull(serviceProviders.deletedAt),
      isNull(users.deletedAt),
      sql`${users.email} IS NOT NULL AND TRIM(${users.email}) <> ''`,
      sql`COALESCE(${notificationPreferences.emailEnabled}, 1) = 1`,
      sql`COALESCE(${notificationPreferences.marketingEmail}, 0) = 1`,
    ));

  if (eligibleProviders.length > 0) {
    await db.insert(providerSurveyRecipients).values(eligibleProviders.map((provider) => ({
      campaignId: campaign.id,
      providerId: provider.providerId,
      userId: provider.userId,
      emailSnapshot: provider.email!,
      tokenHash: hashToken(makeToken()),
    })));
  }
  return { campaignId: campaign.id, eligibleRecipients: eligibleProviders.length };
}

export async function sendProviderSurveyCampaign(campaignId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [campaign] = await db.select().from(providerSurveyCampaigns).where(eq(providerSurveyCampaigns.id, campaignId)).limit(1);
  if (!campaign) throw new Error("Survey campaign not found");
  if (campaign.status === "closed" || campaign.status === "sent") throw new Error("This survey campaign has already been sent or closed");

  const recipients = await db.select({
    recipient: providerSurveyRecipients,
    providerName: serviceProviders.businessName,
    userName: users.name,
    userEmail: users.email,
  }).from(providerSurveyRecipients)
    .innerJoin(serviceProviders, eq(providerSurveyRecipients.providerId, serviceProviders.id))
    .innerJoin(users, eq(providerSurveyRecipients.userId, users.id))
    .where(and(
      eq(providerSurveyRecipients.campaignId, campaignId),
      or(eq(providerSurveyRecipients.status, "invited"), eq(providerSurveyRecipients.status, "failed")),
      eq(serviceProviders.isActive, true),
      isNull(serviceProviders.deletedAt),
      isNull(users.deletedAt),
    ));

  await db.update(providerSurveyCampaigns).set({ status: "sending" }).where(eq(providerSurveyCampaigns.id, campaignId));
  let sent = 0;
  let failed = 0;
  for (const item of recipients) {
    const token = makeToken();
    await db.update(providerSurveyRecipients).set({ tokenHash: hashToken(token) }).where(eq(providerSurveyRecipients.id, item.recipient.id));
    const delivered = await sendNotification({
      type: "provider_survey",
      channel: "email",
      recipient: { userId: item.recipient.userId, email: item.userEmail ?? item.recipient.emailSnapshot, name: item.userName ?? item.providerName },
      data: { providerName: item.providerName, surveyUrl: surveyUrl(token) },
    });
    await db.update(providerSurveyRecipients).set({
      status: delivered ? "sent" : "failed",
      sentAt: delivered ? new Date() : null,
    }).where(eq(providerSurveyRecipients.id, item.recipient.id));
    if (delivered) sent += 1;
    else failed += 1;
  }
  await db.update(providerSurveyCampaigns).set({ status: failed > 0 ? "sending" : "sent", sentAt: new Date() }).where(eq(providerSurveyCampaigns.id, campaignId));
  return { attempted: recipients.length, sent, failed };
}

export async function getProviderSurveyByToken(token: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db.select({
    recipient: providerSurveyRecipients,
    campaign: providerSurveyCampaigns,
    providerName: serviceProviders.businessName,
  }).from(providerSurveyRecipients)
    .innerJoin(providerSurveyCampaigns, eq(providerSurveyRecipients.campaignId, providerSurveyCampaigns.id))
    .innerJoin(serviceProviders, eq(providerSurveyRecipients.providerId, serviceProviders.id))
    .where(eq(providerSurveyRecipients.tokenHash, hashToken(token)))
    .limit(1);
  if (!row || row.campaign.status === "closed") return null;
  const [response] = await db.select().from(providerSurveyResponses).where(eq(providerSurveyResponses.recipientId, row.recipient.id)).limit(1);
  return { recipientId: row.recipient.id, campaignId: row.campaign.id, providerName: row.providerName, submitted: Boolean(response) };
}

export async function submitProviderSurveyResponse(token: string, answers: Record<string, string | string[]>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [recipient] = await db.select().from(providerSurveyRecipients).where(eq(providerSurveyRecipients.tokenHash, hashToken(token))).limit(1);
  if (!recipient) throw new Error("Survey link is invalid or expired");
  const [existing] = await db.select().from(providerSurveyResponses).where(eq(providerSurveyResponses.recipientId, recipient.id)).limit(1);
  if (existing) return { submitted: true, alreadySubmitted: true };
  await db.insert(providerSurveyResponses).values({ campaignId: recipient.campaignId, recipientId: recipient.id, providerId: recipient.providerId, answers });
  await db.update(providerSurveyRecipients).set({ status: "responded", respondedAt: new Date() }).where(eq(providerSurveyRecipients.id, recipient.id));
  return { submitted: true, alreadySubmitted: false };
}

export async function getProviderSurveyDashboard(campaignId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const campaign = campaignId
    ? (await db.select().from(providerSurveyCampaigns).where(eq(providerSurveyCampaigns.id, campaignId)).limit(1))[0]
    : (await db.select().from(providerSurveyCampaigns).orderBy(desc(providerSurveyCampaigns.createdAt)).limit(1))[0];
  if (!campaign) return null;
  const recipients = await db.select({
    recipient: providerSurveyRecipients,
    providerName: serviceProviders.businessName,
    providerUserName: users.name,
  }).from(providerSurveyRecipients)
    .innerJoin(serviceProviders, eq(providerSurveyRecipients.providerId, serviceProviders.id))
    .innerJoin(users, eq(providerSurveyRecipients.userId, users.id))
    .where(eq(providerSurveyRecipients.campaignId, campaign.id))
    .orderBy(desc(providerSurveyRecipients.respondedAt), desc(providerSurveyRecipients.createdAt));
  const responses = await db.select({ response: providerSurveyResponses, providerName: serviceProviders.businessName, providerUserName: users.name })
    .from(providerSurveyResponses)
    .innerJoin(serviceProviders, eq(providerSurveyResponses.providerId, serviceProviders.id))
    .innerJoin(users, eq(serviceProviders.userId, users.id))
    .where(eq(providerSurveyResponses.campaignId, campaign.id))
    .orderBy(desc(providerSurveyResponses.submittedAt));
  return {
    campaign,
    recipients: recipients.map(({ recipient, providerName, providerUserName }) => ({ ...recipient, providerName, providerUserName, tokenHash: undefined })),
    responses: responses.map(({ response, providerName, providerUserName }) => ({ ...response, providerName, providerUserName })),
  };
}
