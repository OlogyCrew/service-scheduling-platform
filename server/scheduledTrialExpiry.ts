import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import * as db from "./db";
import { sendNotification, sendMultiChannelNotification } from "./notifications";
import { getDb } from "./db/connection";
import { customerSubscriptions } from "../drizzle/schema";
import { providerSubscriptions } from "../drizzle/schema";
import { eq, and, lte, isNotNull } from "drizzle-orm";
import { getPaymentEligibilityDecision } from "./paymentEligibility";

/**
 * Scheduled handler: /api/scheduled/trial-expiry
 * 
 * Runs daily to check for expired trials (both provider and customer)
 * and sends notification alerts informing users their trial has ended
 * and they need to add payment information.
 */
export async function handleScheduledTrialExpiry(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) {
      return res.status(403).json({ error: "cron-only" });
    }

    // Do not acquire the DB, normalize records, or send conversion reminders
    // during review. Existing expiry dates and entitlement rules are preserved.
    if (!getPaymentEligibilityDecision("customer_trial").allowed || !getPaymentEligibilityDecision("platform_subscription").allowed) {
      return res.json({
        ok: true, paused: true, customerTrialsExpired: 0,
        providerTrialsExpired: 0, notificationsSent: 0, errors: [],
        processedAt: new Date().toISOString(),
      });
    }

    const now = new Date();
    const results = {
      customerTrialsExpired: 0,
      providerTrialsExpired: 0,
      notificationsSent: 0,
      errors: [] as string[],
    };

    const database = await getDb();
    if (!database) {
      return res.status(500).json({ error: "Database not available" });
    }

    // 1. Find expired customer trials
    const expiredCustomerTrials = await database
      .select()
      .from(customerSubscriptions)
      .where(
        and(
          eq(customerSubscriptions.status, "trialing"),
          isNotNull(customerSubscriptions.trialEndsAt),
          lte(customerSubscriptions.trialEndsAt, now)
        )
      );

    for (const sub of expiredCustomerTrials) {
      try {
        // Downgrade to free
        await db.upsertCustomerSubscription({
          userId: sub.userId,
          tier: "free",
          status: "active",
          trialEndsAt: undefined,
          currentPeriodStart: undefined,
          currentPeriodEnd: undefined,
        });

        // Get user info for notification
        const userInfo = await db.getUserById(sub.userId);
        if (userInfo?.email) {
          const sent = await sendMultiChannelNotification(
            {
              type: "trial_expired",
              recipient: {
                userId: sub.userId,
                email: userInfo.email,
                name: userInfo.name || "there",
              },
              data: {
                providerName: userInfo.name || "there",
                upgradeUrl: "/pricing",
                message: "Your free trial has ended. Please add your credit card information to continue accessing your plan benefits.",
              },
            },
            ["email"]
          );
          if (Object.values(sent).some(Boolean)) {
            results.notificationsSent++;
          }
        }

        // Also create an in-app notification
        await db.createNotification({
          userId: sub.userId,
          notificationType: "trial_expired",
          title: "Your Free Trial Has Ended",
          message: "Your trial period has ended. Please add your credit card information to continue accessing your plan benefits. Visit the Pricing page to subscribe.",
          isRead: false,
          isSentEmail: true,
          isSentSms: false,
        });

        results.customerTrialsExpired++;
      } catch (err: any) {
        results.errors.push(`Customer ${sub.userId}: ${err.message}`);
      }
    }

    // 2. Find expired provider trials
    const expiredProviderTrials = await database
      .select()
      .from(providerSubscriptions)
      .where(
        and(
          eq(providerSubscriptions.status, "trialing"),
          isNotNull(providerSubscriptions.trialEndsAt),
          lte(providerSubscriptions.trialEndsAt, now)
        )
      );

    for (const sub of expiredProviderTrials) {
      try {
        // Downgrade to free
        await db.upsertProviderSubscription({
          providerId: sub.providerId,
          tier: "free",
          status: "active",
          trialEndsAt: undefined,
          currentPeriodStart: undefined,
          currentPeriodEnd: undefined,
        });

        // Get provider and user info for notification
        const provider = await db.getProviderById(sub.providerId);
        if (provider) {
          const userInfo = await db.getUserById(provider.userId);
          if (userInfo?.email) {
            const sent = await sendMultiChannelNotification(
              {
                type: "trial_expired",
                recipient: {
                  userId: userInfo.id,
                  email: userInfo.email,
                  name: provider.businessName || userInfo.name || "there",
                },
                data: {
                  providerName: provider.businessName || userInfo.name || "there",
                  upgradeUrl: "/provider/subscription",
                  message: "Your free trial has ended. Please add your credit card information to continue accessing your Pro plan benefits.",
                },
              },
              ["email"]
            );
            if (Object.values(sent).some(Boolean)) {
              results.notificationsSent++;
            }
          }

          // Also create an in-app notification
          if (provider.userId) {
            await db.createNotification({
              userId: provider.userId,
              notificationType: "trial_expired",
              title: "Your Pro Trial Has Ended",
              message: "Your trial period has ended. Please add your credit card information to continue accessing your Pro plan benefits. Visit your Subscription settings to upgrade.",
              actionUrl: "/provider/subscription",
              isRead: false,
              isSentEmail: true,
              isSentSms: false,
            });
          }
        }

        results.providerTrialsExpired++;
      } catch (err: any) {
        results.errors.push(`Provider ${sub.providerId}: ${err.message}`);
      }
    }

    console.log(`[ScheduledTrialExpiry] Processed: ${results.customerTrialsExpired} customer trials, ${results.providerTrialsExpired} provider trials, ${results.notificationsSent} notifications sent`);

    return res.json({
      ok: true,
      ...results,
      processedAt: now.toISOString(),
    });
  } catch (err: any) {
    console.error("[ScheduledTrialExpiry] Fatal error:", err);
    return res.status(500).json({
      error: err.message,
      stack: err.stack,
      context: { url: req.url, taskUid: (err as any).taskUid },
      timestamp: new Date().toISOString(),
    });
  }
}
