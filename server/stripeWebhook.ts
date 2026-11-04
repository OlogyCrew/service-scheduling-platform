import { Request, Response } from "express";
import Stripe from "stripe";
import { ENV } from "./_core/env";
import * as db from "./db";
import * as promotionDb from "./db/promotions";
import * as invoiceDb from "./db/invoices";
import { sendNotification } from "./notifications";
import { sendPushNotification } from "./notifications/pushHelper";
import { executePartnerTransfer } from "./partnerSplit";
import { generateInvoicePdf } from "./services/invoicePdf";
import { getStripeSubscriptionPeriod, isStripeResourceMissing, mapStripeSubscriptionStatus } from "./stripeSubscriptionLifecycle";
import { CUSTOMER_PLANS, PROVIDER_PLANS } from "../shared/entitlements";
import { createSubscriptionInAppNotice } from "./subscriptionNotifications";
import { queueCrmBookingProjection, queueCrmInvoiceProjection } from "./crm/sourceHooks";
import { fulfillReferralAndNotify } from "./referralFulfillment";
import { dollarsToCents } from "./referralRewardPolicy";
const stripe = new Stripe(ENV.stripeSecretKey, {
  apiVersion: "2026-01-28.clover",
});

export function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const subscription = invoice.parent?.subscription_details?.subscription ?? (invoice as any).subscription;
  if (!subscription) return null;
  return typeof subscription === "string" ? subscription : subscription.id;
}

async function getSubscriptionNotificationContext(subscription: Stripe.Subscription) {
  const type = subscription.metadata?.type;
  const tier = subscription.metadata?.tier;
  if (type === "customer_subscription") {
    const userId = Number(subscription.metadata?.userId);
    if (!userId || (tier !== "pro" && tier !== "business")) return null;
    const user = await db.getUserById(userId);
    if (!user?.email) return null;
    return {
      recipient: { userId, email: user.email, name: user.name || undefined },
      data: {
        customerName: user.name || undefined,
        tier: CUSTOMER_PLANS[tier].name,
        billingUrl: "/customer/subscription",
      },
      currentStatus: (await db.getCustomerSubscription(userId))?.status,
    };
  }

  const providerId = Number(subscription.metadata?.providerId);
  if (!providerId || (tier !== "basic" && tier !== "premium")) return null;
  const provider = await db.getProviderById(providerId);
  if (!provider) return null;
  const user = await db.getUserById(provider.userId);
  if (!user?.email) return null;
  return {
    recipient: { userId: user.id, email: user.email, name: user.name || undefined },
    data: {
      customerName: user.name || undefined,
      businessName: provider.businessName || undefined,
      tier: PROVIDER_PLANS[tier].name,
      billingUrl: "/provider/subscription",
    },
    currentStatus: (await db.getProviderSubscription(providerId))?.status,
  };
}

export async function handleStripeWebhook(req: Request, res: Response) {
  const sig = req.headers["stripe-signature"];

  if (!sig) {
    return res.status(400).send("Missing stripe-signature header");
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      ENV.stripeWebhookSecret
    );
  } catch (err: any) {
    console.error("[Stripe Webhook] Signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle test events
  if (event.id.startsWith("evt_test_")) {
    console.log("[Webhook] Test event detected, returning verification response");
    return res.json({ verified: true });
  }

  console.log("[Stripe Webhook] Event received:", event.type);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentSucceeded(paymentIntent);
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentFailed(paymentIntent);
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        await handleRefund(charge);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCancelled(subscription);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentSucceeded(invoice);
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error("[Stripe Webhook] Error processing event:", error);
    res.status(500).send(`Webhook processing error: ${error.message}`);
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log("[Stripe] Checkout completed:", session.id);

  // Handle promotion payments
  if (session.metadata?.type === "promotion") {
    await handlePromotionPayment(session);
    return;
  }

  // Handle invoice payments
  if (session.metadata?.type === "invoice_payment") {
    await handleInvoicePayment(session);
    return;
  }

  // Handle subscription checkouts (split is handled by invoice.payment_succeeded event)
  if (session.metadata?.type === "provider_subscription" || session.metadata?.type === "customer_subscription") {
    console.log(`[Stripe] Subscription checkout completed: ${session.metadata.type}, tier: ${session.metadata.tier || "unknown"}`);
    // The revenue split for subscriptions is triggered by invoice.payment_succeeded
    // which fires when the subscription invoice is paid (including the first payment)
    return;
  }

  const bookingId = session.metadata?.bookingId;
  const paymentType = session.metadata?.paymentType;

  if (!bookingId) {
    console.log("[Stripe] No bookingId in session metadata, skipping (not a booking checkout)");
    return;
  }

  const booking = await db.getBookingById(parseInt(bookingId));
  if (!booking) {
    console.error("[Stripe] Booking not found:", bookingId);
    return;
  }

  const stripePaymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  if (stripePaymentIntentId && session.payment_status === "paid" && session.amount_total != null) {
    await db.upsertBookingPaymentByStripeIntent({
      bookingId: booking.id,
      paymentType: paymentType === "deposit" ? "deposit" : paymentType === "final" ? "final" : "full",
      amount: (session.amount_total / 100).toFixed(2),
      currency: session.currency || "usd",
      status: "captured",
      stripePaymentIntentId,
      processedAt: new Date(),
    });
  }

  // Update booking with payment information
  if (paymentType === "deposit") {
    await db.updateBookingStatus(parseInt(bookingId), booking.status, {
      depositPaidAt: new Date().toISOString(),
      stripePaymentIntentId: session.payment_intent as string,
    });
    console.log(`[Stripe] Deposit payment recorded for booking ${bookingId}`);
  } else {
    await db.updateBookingStatus(parseInt(bookingId), booking.status === "pending" ? "confirmed" : booking.status, {
      paidAt: new Date().toISOString(),
      stripePaymentIntentId: session.payment_intent as string,
    });
    console.log(`[Stripe] Full payment recorded for booking ${bookingId}`);
  }
  queueCrmBookingProjection(booking.id);
  if (stripePaymentIntentId && session.payment_status === "paid" && session.amount_total != null) {
    await fulfillReferralAndNotify(booking.id);
  }

  // Send email notifications
  const customer = await db.getUserById(booking.customerId);
  const provider = await db.getProviderById(booking.providerId);
  const service = await db.getServiceById(booking.serviceId);
  
  if (customer && customer.email) {
    await sendNotification({
      type: paymentType === "deposit" ? "payment_received" : "booking_confirmed",
      channel: "email",
      recipient: {
        userId: customer.id,
        email: customer.email,
        name: customer.name || "Customer",
      },
      data: {
        bookingId: booking.id,
        bookingNumber: booking.bookingNumber,
        serviceName: service?.name || "Service",
        providerName: provider?.businessName || "Provider",
        amount: paymentType === "deposit" ? booking.depositAmount || "0" : booking.totalAmount || "0",
        date: booking.bookingDate,
        time: booking.startTime,
        // bookingUrl removed — templates now use bookingId directly
      },
    });
  }
  // Push notification for payment success
  if (customer) {
    sendPushNotification(
      paymentType === "deposit" ? "payment_received" : "booking_confirmed",
      { userId: customer.id, name: customer.name || "Customer" },
      {
        bookingNumber: booking.bookingNumber,
        serviceName: service?.name || "Service",
        providerName: provider?.businessName || "Provider",
        amount: paymentType === "deposit" ? booking.depositAmount || "0" : booking.totalAmount || "0",
        date: booking.bookingDate,
        time: booking.startTime,
      }
    );
  }

  // Auto-generate receipt for booking payment
  try {
    await generateBookingReceipt(booking, session, customer, provider, service, paymentType);
  } catch (err: any) {
    console.error(`[Receipt] Failed to generate receipt for booking ${bookingId}:`, err.message);
  }

  // Partner revenue split: transfer 40% of the platform fee to partner
  // The platform fee is 1% of the booking amount
  const bookingAmount = paymentType === "deposit"
    ? parseFloat(booking.depositAmount || "0")
    : parseFloat(booking.totalAmount || "0");
  const platformFee = bookingAmount * 0.01; // 1% platform fee

  if (platformFee > 0) {
    try {
      // Extract charge ID from the checkout session's payment intent for source_transaction
      let bookingChargeId: string | undefined;
      if (session.payment_intent) {
        try {
          const piId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent.id;
          const paymentIntent = await stripe.paymentIntents.retrieve(piId);
          if (paymentIntent.latest_charge) {
            bookingChargeId = typeof paymentIntent.latest_charge === "string" ? paymentIntent.latest_charge : paymentIntent.latest_charge.id;
          }
        } catch (err: any) {
          console.warn(`[Stripe] Could not get charge ID for booking split: ${err.message}`);
        }
      }

      const splitResult = await executePartnerTransfer({
        totalRevenue: platformFee,
        sourceType: "booking_platform_fee",
        sourceId: session.payment_intent as string || session.id,
        sourceDescription: `Booking #${booking.bookingNumber} platform fee (1% of $${bookingAmount.toFixed(2)}) - ${service?.name || "Service"} by ${provider?.businessName || "Provider"}`,
        chargeId: bookingChargeId,
      });
      if (splitResult.success) {
        console.log(`[Partner Split] Booking ${booking.bookingNumber}: platform fee $${platformFee.toFixed(2)}, partner share $${splitResult.amount}`);
      } else {
        console.error(`[Partner Split] Failed for booking ${booking.bookingNumber}: ${splitResult.error}`);
      }
    } catch (err: any) {
      console.error(`[Partner Split] Error processing booking fee split: ${err.message}`);
    }
  }
}

async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log("[Stripe] Payment succeeded:", paymentIntent.id);
  const bookingId = Number(paymentIntent.metadata?.bookingId || 0);
  if (!bookingId) return;
  const paymentType = paymentIntent.metadata?.paymentType === "deposit"
    ? "deposit" as const
    : paymentIntent.metadata?.paymentType === "final"
      ? "final" as const
      : "full" as const;
  await db.upsertBookingPaymentByStripeIntent({
    bookingId,
    paymentType,
    amount: (paymentIntent.amount_received / 100).toFixed(2),
    currency: paymentIntent.currency,
    status: "captured",
    stripePaymentIntentId: paymentIntent.id,
    processedAt: new Date(),
  });
  queueCrmBookingProjection(bookingId);
  await fulfillReferralAndNotify(bookingId);
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  console.log("[Stripe] Payment failed:", paymentIntent.id);

  // Find the booking associated with this payment intent
  const payment = await db.getPaymentByStripePaymentIntentId(paymentIntent.id);
  const bookingId = payment?.bookingId || Number(paymentIntent.metadata?.bookingId || 0);
  if (!bookingId) {
    console.log(`[Stripe] No booking found for failed payment_intent: ${paymentIntent.id}`);
    return;
  }

  const booking = await db.getBookingById(bookingId);
  if (!booking) return;

  const paymentType = payment?.paymentType === "deposit" || paymentIntent.metadata?.paymentType === "deposit"
    ? "deposit" as const
    : payment?.paymentType === "final" || paymentIntent.metadata?.paymentType === "final"
      ? "final" as const
      : "full" as const;
  await db.upsertBookingPaymentByStripeIntent({
    bookingId,
    paymentType,
    amount: payment?.amount || (paymentIntent.amount / 100).toFixed(2),
    currency: payment?.currency || paymentIntent.currency,
    status: "failed",
    stripePaymentIntentId: paymentIntent.id,
    failureReason: paymentIntent.last_payment_error?.message || "Stripe payment failed",
    processedAt: new Date(),
  });
  queueCrmBookingProjection(bookingId);

  const customer = await db.getUserById(booking.customerId);
  const service = await db.getServiceById(booking.serviceId);
  const provider = await db.getProviderById(booking.providerId);

  // Send payment failure notification to customer via email
  if (customer?.email) {
    await sendNotification({
      type: "payment_failed",
      channel: "email",
      recipient: {
        userId: customer.id,
        email: customer.email,
        name: customer.name || "Customer",
      },
      data: {
        bookingId: booking.id,
        bookingNumber: booking.bookingNumber,
        serviceName: service?.name || "Service",
        providerName: provider?.businessName || "Provider",
        customerName: customer.name || "Customer",
        amount: booking.totalAmount || "0",
        // paymentUrl removed — templates now use bookingId directly
      },
    });
    console.log(`[Stripe] Payment failure notification sent to customer ${customer.id} for booking ${booking.bookingNumber}`);
  }
  // Push notification for payment failure
  if (customer) {
    sendPushNotification("payment_failed", { userId: customer.id, name: customer.name || "Customer" }, {
      bookingNumber: booking.bookingNumber,
      serviceName: service?.name || "Service",
      amount: booking.totalAmount || "0",
    });
  }

  // Also create an in-app notification
  try {
    await db.createNotification({
      userId: customer!.id,
      notificationType: "payment",
      title: "Payment Failed",
      message: `Your payment for booking #${booking.bookingNumber} could not be processed. Please try again.`,
      relatedBookingId: booking.id,
    });
  } catch (err) {
    console.error("[Stripe] Failed to create in-app notification for payment failure:", err);
  }
}

async function handleRefund(charge: Stripe.Charge) {
  console.log("[Stripe] Refund processed:", charge.id);
  
  const paymentIntentId = typeof charge.payment_intent === "string" 
    ? charge.payment_intent 
    : charge.payment_intent?.id;
  
  if (!paymentIntentId) {
    console.log("[Stripe] No payment_intent on refund charge");
    return;
  }

  // Find the payment record by Stripe payment intent ID
  const payment = await db.getPaymentByStripePaymentIntentId(paymentIntentId);
  if (!payment) {
    console.log(`[Stripe] No local payment record for payment_intent: ${paymentIntentId}`);
    return;
  }

  const refundAmountDollars = (charge.amount_refunded / 100).toFixed(2);

  // Stripe reports cumulative amount_refunded. A replayed older partial
  // refund must never decrease the locally recorded refund.
  if (dollarsToCents(refundAmountDollars) > dollarsToCents(payment.refundAmount || "0.00")) {
    await db.updatePaymentRefund(payment.id, {
      status: "refunded",
      refundAmount: refundAmountDollars,
      refundReason: "Refund confirmed by Stripe webhook",
      refundedAt: new Date(),
    });
    console.log(`[Stripe] Payment ${payment.id} marked as refunded: $${refundAmountDollars}`);
  }

  // Send refund confirmation notification to customer
  const booking = payment.bookingId ? await db.getBookingById(payment.bookingId) : null;
  if (payment.bookingId) queueCrmBookingProjection(payment.bookingId);
  if (booking) {
    const customer = await db.getUserById(booking.customerId);
    if (customer?.email) {
      await sendNotification({
        type: "refund_processed",
        channel: "email",
        recipient: { userId: customer.id, email: customer.email, name: customer.name || "Customer" },
        data: {
          bookingNumber: booking.bookingNumber,
          refundAmount: refundAmountDollars,
          originalAmount: booking.totalAmount || "0",
        },
      });
    }
  }

  // Auto-generate credit note for the refund
  try {
    if (booking) {
      const provider = await db.getProviderById(booking.providerId);
      const customer = await db.getUserById(booking.customerId);
      
      // Find the original receipt/invoice for this booking
      const existingInvoices = await invoiceDb.getInvoicesByBookingId(booking.id);
      const originalInvoice = existingInvoices.find((i: any) => i.type === "receipt" || i.type === "invoice");

      const creditNoteNumber = await invoiceDb.getNextInvoiceNumber(booking.providerId);
      const refundAmountCents = charge.amount_refunded;

      await invoiceDb.createInvoice(
        {
          invoiceNumber: creditNoteNumber,
          type: "credit_note",
          providerId: booking.providerId,
          customerId: booking.customerId,
          bookingId: booking.id,
          promotionId: null,
          paymentId: payment.id,
          status: "paid",
          subtotal: refundAmountCents,
          taxRate: "0",
          taxAmount: 0,
          total: refundAmountCents,
          issueDate: new Date(),
          dueDate: null,
          paidAt: new Date(),
          stripePaymentIntentId: paymentIntentId,
          stripeCheckoutSessionId: null,
          pdfUrl: null,
          notes: `Refund for Booking #${booking.bookingNumber}${originalInvoice ? ` (ref: ${originalInvoice.invoiceNumber})` : ""}`,
          customerEmail: customer?.email || null,
          originalInvoiceId: originalInvoice?.id || null,
        },
        [{
          description: `Refund - Booking #${booking.bookingNumber}`,
          quantity: "1",
          unitPrice: refundAmountCents,
          amount: refundAmountCents,
          serviceId: booking.serviceId || null,
        }]
      );
      console.log(`[Credit Note] Generated ${creditNoteNumber} for refund on booking ${booking.bookingNumber}`);
    }
  } catch (err: any) {
    console.error(`[Credit Note] Failed to generate credit note for refund:`, err.message);
  }

  console.log(`[Stripe] Refund confirmed for payment_intent: ${paymentIntentId}, amount: $${refundAmountDollars}`);
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const subscriptionType = subscription.metadata?.type;
  const stripeStatus = mapStripeSubscriptionStatus(subscription.status);
  const stripeCustomerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id || "";
  const { currentPeriodStart, currentPeriodEnd } = getStripeSubscriptionPeriod(subscription as any);

  // Handle customer subscriptions
  if (subscriptionType === "customer_subscription") {
    const userId = subscription.metadata?.userId;
    const tier = subscription.metadata?.tier as "pro" | "business" | undefined;
    if (!userId || !tier) {
      console.error("[Stripe] Missing userId or tier in customer subscription metadata");
      return;
    }
    const existingSub = await db.getCustomerSubscription(parseInt(userId));
    await db.upsertCustomerSubscription({
      userId: parseInt(userId),
      tier,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId,
      status: stripeStatus,
      currentPeriodStart,
      currentPeriodEnd,
      trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : undefined,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    });
    const tierOrder = { free: 0, pro: 1, business: 2 } as const;
    const previousTier = existingSub?.tier || "free";
    if (stripeStatus === "active" && tierOrder[tier] > tierOrder[previousTier]) {
      const user = await db.getUserById(parseInt(userId));
      if (user?.email) {
        await sendNotification({
          type: "subscription_upgraded",
          channel: "email",
          recipient: { userId: user.id, email: user.email, name: user.name || undefined },
          data: {
            customerName: user.name || undefined,
            tier: CUSTOMER_PLANS[tier].name,
            previousTier: CUSTOMER_PLANS[previousTier].name,
            amount: String(CUSTOMER_PLANS[tier].monthlyPrice),
          },
        });
        await createSubscriptionInAppNotice({
          userId: user.id,
          type: "subscription_upgraded",
          title: `Plan upgraded to ${CUSTOMER_PLANS[tier].name}`,
          message: `Your ${CUSTOMER_PLANS[tier].name} customer-plan access is active.`,
          actionUrl: "/customer/subscription",
        });
      }
    }
    console.log(`[Stripe] Customer subscription ${subscription.id} updated for user ${userId}: ${tier} (${stripeStatus})`);
    return;
  }

  // Handle provider subscriptions (existing logic)
  const providerId = subscription.metadata?.providerId;
  const tier = subscription.metadata?.tier as "basic" | "premium" | undefined;
  
  if (!providerId || !tier) {
    console.error("[Stripe] Missing providerId or tier in subscription metadata");
    return;
  }

  // Get previous tier to detect upgrades
  const existingSub = await db.getProviderSubscription(parseInt(providerId));
  const previousTier = existingSub?.tier || "free";

  await db.upsertProviderSubscription({
    providerId: parseInt(providerId),
    tier,
    stripeSubscriptionId: subscription.id,
    stripeCustomerId,
    status: stripeStatus,
    currentPeriodStart,
    currentPeriodEnd,
    trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : undefined,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });

  // Send upgrade notification if tier changed upward
  const tierOrder: Record<string, number> = { free: 0, basic: 1, premium: 2 };
  if (stripeStatus === "active" && tierOrder[tier] > tierOrder[previousTier]) {
    const provider = await db.getProviderById(parseInt(providerId));
    if (provider) {
      const user = await db.getUserById(provider.userId);
      if (user?.email) {
        const { SUBSCRIPTION_TIERS } = await import("./products");
        await sendNotification({
          type: "subscription_upgraded",
          channel: "email",
          recipient: { userId: user.id, email: user.email, name: user.name || undefined },
          data: {
            tier: SUBSCRIPTION_TIERS[tier].name,
            previousTier: SUBSCRIPTION_TIERS[previousTier as keyof typeof SUBSCRIPTION_TIERS]?.name || previousTier,
            businessName: provider.businessName || undefined,
            amount: String(SUBSCRIPTION_TIERS[tier].monthlyPrice),
          },
        });
        await createSubscriptionInAppNotice({
          userId: user.id,
          type: "subscription_upgraded",
          title: `Plan upgraded to ${SUBSCRIPTION_TIERS[tier].name}`,
          message: `${SUBSCRIPTION_TIERS[tier].name} provider access is active for ${provider.businessName || "your business"}.`,
          actionUrl: "/provider/subscription",
        });
      }
    }
  }

  console.log(`[Stripe] Subscription ${subscription.id} updated for provider ${providerId}: ${tier} (${stripeStatus})`);
}

async function handleSubscriptionCancelled(subscription: Stripe.Subscription) {
  const subscriptionType = subscription.metadata?.type;
  const stripeCustomerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id || "";

  // Handle customer subscription cancellation
  if (subscriptionType === "customer_subscription") {
    const userId = subscription.metadata?.userId;
    if (!userId) return;
    await db.upsertCustomerSubscription({
      userId: parseInt(userId),
      tier: "free",
      stripeSubscriptionId: subscription.id,
      stripeCustomerId,
      status: "cancelled",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: subscription.ended_at ? new Date(subscription.ended_at * 1000) : new Date(),
    });
    const user = await db.getUserById(parseInt(userId));
    if (user?.email) {
      await sendNotification({
        type: "subscription_cancelled",
        channel: "email",
        recipient: { userId: user.id, email: user.email, name: user.name || undefined },
        data: { customerName: user.name || undefined, tier: CUSTOMER_PLANS.free.name },
      });
      await createSubscriptionInAppNotice({
        userId: user.id,
        type: "subscription_cancelled",
        title: "Customer subscription ended",
        message: "Paid customer-plan access has ended. Your account is now on Individual.",
        actionUrl: "/customer/subscription",
      });
    }
    console.log(`[Stripe] Customer subscription cancelled for user ${userId}`);
    return;
  }

  // Handle provider subscription cancellation (existing logic)
  const providerId = subscription.metadata?.providerId;
  if (!providerId) return;

  await db.upsertProviderSubscription({
    providerId: parseInt(providerId),
    tier: "free",
    stripeSubscriptionId: subscription.id,
    stripeCustomerId,
    status: "cancelled",
    cancelAtPeriodEnd: false,
    currentPeriodEnd: subscription.ended_at ? new Date(subscription.ended_at * 1000) : new Date(),
  });

  console.log(`[Stripe] Subscription cancelled for provider ${providerId}`);

  // Notify provider
  const provider = await db.getProviderById(parseInt(providerId));
  if (provider) {
    const user = await db.getUserById(provider.userId);
    if (user?.email) {
      await sendNotification({
        type: "subscription_cancelled",
        channel: "email",
        recipient: { userId: user.id, email: user.email, name: user.name || "Provider" },
        data: { customerName: user.name || undefined, businessName: provider.businessName, tier: `${PROVIDER_PLANS.free.name} (Free)` },
      });
      await createSubscriptionInAppNotice({
        userId: user.id,
        type: "subscription_cancelled",
        title: "Provider subscription ended",
        message: "Paid provider access has ended. Your business is now on Starter.",
        actionUrl: "/provider/subscription",
      });
    }
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  console.log(`[Stripe] Invoice payment failed for customer: ${customerId}`);
  const subscriptionId = getInvoiceSubscriptionId(invoice);
  if (!subscriptionId) return;

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const context = await getSubscriptionNotificationContext(subscription);
    await handleSubscriptionUpdate(subscription);
    if (!context) return;
    const { currentPeriodEnd } = getStripeSubscriptionPeriod(subscription as any);
    await sendNotification({
      type: "subscription_payment_failed",
      channel: "email",
      recipient: context.recipient,
      data: {
        ...context.data,
        amount: `$${((invoice.amount_due || 0) / 100).toFixed(2)}`,
        accessEndsAt: currentPeriodEnd && currentPeriodEnd > new Date() ? currentPeriodEnd.toISOString() : undefined,
      },
    });
    await createSubscriptionInAppNotice({
      userId: context.recipient.userId,
      type: "subscription_payment_failed",
      title: "Subscription payment needs attention",
      message: currentPeriodEnd && currentPeriodEnd > new Date()
        ? `Update billing to keep ${context.data.tier} access after ${currentPeriodEnd.toLocaleDateString("en-US")}.`
        : `Update billing to restore ${context.data.tier} access.`,
      actionUrl: context.data.billingUrl,
    });
  } catch (error: any) {
    if (isStripeResourceMissing(error)) {
      console.warn(`[Stripe] Ignoring invoice failure for deleted subscription ${subscriptionId}`);
      return;
    }
    console.error(`[Stripe] Failed to synchronize subscription payment failure for ${subscriptionId}:`, error.message);
  }
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  // Only process subscription invoices (not one-time payments)
  const subscriptionDetails = invoice.parent?.subscription_details;
  if (!subscriptionDetails) {
    // Check billing_reason as fallback for subscription-related invoices
    const isSubscription = invoice.billing_reason && [
      "subscription_create", "subscription_cycle", "subscription_update", "subscription_threshold"
    ].includes(invoice.billing_reason);
    if (!isSubscription) {
      console.log("[Stripe] Invoice is not subscription-related, skipping partner split");
      return;
    }
  }

  const amountPaid = (invoice.amount_paid || 0) / 100; // Convert cents to dollars
  if (amountPaid <= 0) {
    console.log("[Stripe] Invoice amount is zero (trial/free), skipping partner split");
    return;
  }

  // Extract the charge ID from the invoice for source_transaction
  // This ties the transfer to the specific charge, preventing "insufficient funds" errors
  // that occur when Stripe auto-pays out the platform balance before the transfer
  let chargeId: string | undefined;

  // In newer Stripe API versions, charge/payment_intent are on invoice.payments items
  // Try to get the charge from the invoice's payments list
  try {
    if (invoice.payments?.data?.length) {
      const payment = invoice.payments.data[0];
      if (payment.payment?.charge) {
        chargeId = typeof payment.payment.charge === "string" ? payment.payment.charge : payment.payment.charge.id;
        console.log(`[Stripe] Invoice ${invoice.id} has charge from payments: ${chargeId}`);
      } else if (payment.payment?.payment_intent) {
        // Get charge from the payment intent
        const piId = typeof payment.payment.payment_intent === "string" ? payment.payment.payment_intent : payment.payment.payment_intent.id;
        const paymentIntent = await stripe.paymentIntents.retrieve(piId);
        if (paymentIntent.latest_charge) {
          chargeId = typeof paymentIntent.latest_charge === "string" ? paymentIntent.latest_charge : paymentIntent.latest_charge.id;
          console.log(`[Stripe] Got charge from payment intent: ${chargeId}`);
        }
      }
    } else {
      // Fallback: list invoice payments via API
      const invoicePayments = await stripe.invoicePayments.list({ invoice: invoice.id, limit: 1 });
      if (invoicePayments.data.length > 0) {
        const ip = invoicePayments.data[0];
        if (ip.payment?.payment_intent) {
          const piId = typeof ip.payment.payment_intent === "string" ? ip.payment.payment_intent : ip.payment.payment_intent.id;
          const paymentIntent = await stripe.paymentIntents.retrieve(piId);
          if (paymentIntent.latest_charge) {
            chargeId = typeof paymentIntent.latest_charge === "string" ? paymentIntent.latest_charge : paymentIntent.latest_charge.id;
            console.log(`[Stripe] Got charge from listed payment intent: ${chargeId}`);
          }
        } else if (ip.payment?.charge) {
          chargeId = typeof ip.payment.charge === "string" ? ip.payment.charge : ip.payment.charge.id;
          console.log(`[Stripe] Got charge from listed invoice payment: ${chargeId}`);
        }
      }
    }
  } catch (err: any) {
    console.warn(`[Stripe] Could not extract charge ID from invoice: ${err.message}`);
  }

  const subscriptionId = getInvoiceSubscriptionId(invoice);

  // Try to get subscription metadata to determine type
  let sourceType: "provider_subscription" | "customer_subscription" = "provider_subscription";
  let sourceDescription = "";
  let subscriptionForNotification: Stripe.Subscription | null = null;
  let previousSubscriptionStatus: string | undefined;

  try {
    if (subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      subscriptionForNotification = subscription;
      const notificationContext = await getSubscriptionNotificationContext(subscription);
      previousSubscriptionStatus = notificationContext?.currentStatus;
      await handleSubscriptionUpdate(subscription);
      const subType = subscription.metadata?.type;
      const tier = subscription.metadata?.tier;

      if (subType === "customer_subscription") {
        sourceType = "customer_subscription";
        const userId = subscription.metadata?.userId;
        sourceDescription = `Customer subscription (${tier || "unknown"} tier, user ${userId || "unknown"}) - Invoice ${invoice.id}`;
      } else {
        sourceType = "provider_subscription";
        const providerId = subscription.metadata?.providerId;
        sourceDescription = `Provider subscription (${tier || "unknown"} tier, provider ${providerId || "unknown"}) - Invoice ${invoice.id}`;
      }
    } else {
      sourceDescription = `Subscription payment - Invoice ${invoice.id}`;
    }
  } catch (err: any) {
    console.warn(`[Stripe] Could not retrieve subscription ${subscriptionId}: ${err.message}`);
    sourceDescription = `Subscription payment - Invoice ${invoice.id}`;
  }

  if (subscriptionForNotification) {
    try {
      const context = await getSubscriptionNotificationContext(subscriptionForNotification);
      if (context) {
        const { currentPeriodEnd } = getStripeSubscriptionPeriod(subscriptionForNotification as any);
        const isRestored = (invoice as any).attempt_count > 1
          || previousSubscriptionStatus === "past_due"
          || previousSubscriptionStatus === "incomplete";
        if (isRestored || invoice.billing_reason === "subscription_cycle") {
          await sendNotification({
            type: isRestored ? "subscription_payment_restored" : "subscription_renewed",
            channel: "email",
            recipient: context.recipient,
            data: {
              ...context.data,
              amount: `$${amountPaid.toFixed(2)}`,
              accessEndsAt: currentPeriodEnd?.toISOString(),
            },
          });
          await createSubscriptionInAppNotice({
            userId: context.recipient.userId,
            type: isRestored ? "subscription_payment_restored" : "subscription_renewed",
            title: isRestored ? "Subscription payment restored" : "Subscription renewed",
            message: isRestored
              ? `${context.data.tier} paid-plan access is active again.`
              : `${context.data.tier} renewed${currentPeriodEnd ? ` through ${currentPeriodEnd.toLocaleDateString("en-US")}` : ""}.`,
            actionUrl: context.data.billingUrl,
          });
        }
      }
    } catch (error: any) {
      console.error(`[Stripe] Failed to send subscription payment success notification for ${subscriptionId}:`, error.message);
    }
  }

  // Execute the 40% partner transfer
  const result = await executePartnerTransfer({
    totalRevenue: amountPaid,
    sourceType,
    sourceId: invoice.id,
    sourceDescription,
    chargeId,
  });

  if (result.success) {
    console.log(`[Partner Split] Subscription invoice ${invoice.id}: $${amountPaid} total, $${result.amount} transferred to partner`);
  } else {
    console.error(`[Partner Split] Failed for invoice ${invoice.id}: ${result.error}`);
  }
}

// --- Promotion Payment Handler ---

const TIER_DURATION_HOURS: Record<string, number> = {
  quick_boost: 24,
  category_spotlight: 168,
  homepage_feature: 168,
  smart_bundle: 168,
};

async function handlePromotionPayment(session: Stripe.Checkout.Session) {
  const promotionId = session.metadata?.promotionId;
  const tier = session.metadata?.tier;

  if (!promotionId) {
    console.error("[Stripe Promotion] No promotionId in session metadata");
    return;
  }

  console.log(`[Stripe Promotion] Activating promotion ${promotionId} (tier: ${tier})`);

  const durationHours = TIER_DURATION_HOURS[tier || ""] || 168;
  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + durationHours * 60 * 60 * 1000);

  await promotionDb.activatePromotion(parseInt(promotionId), startDate, endDate);

  // Store payment intent ID if available
  if (session.payment_intent) {
    await promotionDb.updatePromotionPaymentIntent(
      parseInt(promotionId),
      session.payment_intent as string
    );
  }

  console.log(`[Stripe Promotion] Promotion ${promotionId} activated: ${startDate.toISOString()} → ${endDate.toISOString()}`);
}


async function handleInvoicePayment(session: Stripe.Checkout.Session) {
  const invoiceId = session.metadata?.invoiceId;
  if (!invoiceId) {
    console.error("[Stripe] No invoiceId in invoice_payment session metadata");
    return;
  }

  const invoice = await invoiceDb.getInvoiceById(parseInt(invoiceId));
  if (!invoice) {
    console.error("[Stripe] Invoice not found:", invoiceId);
    return;
  }

  // Mark invoice as paid
  await invoiceDb.updateInvoiceStatus(parseInt(invoiceId), "paid", {
    paidAt: new Date(),
    stripePaymentIntentId: session.payment_intent as string,
  });
  if (invoice.customerId > 0 && invoice.type === "invoice") queueCrmInvoiceProjection(invoice.id);

  // Generate receipt PDF if not already generated
  if (!invoice.pdfUrl) {
    try {
      const provider = await db.getProviderById(invoice.providerId);
      const customer = await db.getUserById(invoice.customerId);
      const providerUser = provider ? await db.getUserById(provider.userId) : null;
      const customerName = customer ? `${customer.firstName || ""} ${customer.lastName || ""}`.trim() || customer.name || "Customer" : "Customer";
      const providerAddress = provider ? [provider.addressLine1, provider.city, provider.state, provider.postalCode].filter(Boolean).join(", ") || undefined : undefined;

      const pdfUrl = await generateInvoicePdf({
        invoice: { ...invoice, status: "paid", paidAt: new Date() },
        providerName: provider?.businessName || "Provider",
        providerEmail: providerUser?.email || undefined,
        providerPhone: providerUser?.phone || undefined,
        providerAddress,
        providerLogoUrl: provider?.businessLogoUrl || undefined,
        customerName,
        customerEmail: invoice.customerEmail || customer?.email || undefined,
      });
      await invoiceDb.updateInvoicePdfUrl(parseInt(invoiceId), pdfUrl);
    } catch (err: any) {
      console.error(`[Receipt] Failed to generate PDF for invoice ${invoiceId}:`, err.message);
    }
  }

  // Send email notification to provider that invoice was paid
  const provider = await db.getProviderById(invoice.providerId);
  if (provider) {
    const providerUser = await db.getUserById(provider.userId);
    if (providerUser?.email) {
      await sendNotification({
        type: "payment_received",
        channel: "email",
        recipient: {
          userId: providerUser.id,
          email: providerUser.email,
          name: providerUser.name || "Provider",
        },
        data: {
          invoiceNumber: invoice.invoiceNumber,
          amount: (invoice.total / 100).toFixed(2),
          providerName: provider.businessName,
        },
      });
    }
  }

  console.log(`[Stripe] Invoice ${invoice.invoiceNumber} marked as paid`);
}

async function generateBookingReceipt(
  booking: any,
  session: Stripe.Checkout.Session,
  customer: any,
  provider: any,
  service: any,
  paymentType: string | undefined
) {
  const invoiceNumber = await invoiceDb.getNextInvoiceNumber(booking.providerId);
  const amount = paymentType === "deposit"
    ? Math.round(parseFloat(booking.depositAmount || "0") * 100)
    : Math.round(parseFloat(booking.totalAmount || "0") * 100);

  if (amount <= 0) return;

  const description = paymentType === "deposit"
    ? `Deposit for ${service?.name || "Service"} - Booking #${booking.bookingNumber}`
    : `${service?.name || "Service"} - Booking #${booking.bookingNumber}`;

  // Create the receipt invoice record
  const result = await invoiceDb.createInvoice(
    {
      invoiceNumber,
      type: "receipt",
      providerId: booking.providerId,
      customerId: booking.customerId,
      bookingId: booking.id,
      promotionId: null,
      paymentId: null,
      status: "paid",
      subtotal: amount,
      taxRate: "0",
      taxAmount: 0,
      total: amount,
      issueDate: new Date(),
      dueDate: null,
      paidAt: new Date(),
      stripePaymentIntentId: session.payment_intent as string || null,
      stripeCheckoutSessionId: session.id,
      pdfUrl: null,
      notes: null,
      customerEmail: customer?.email || null,
      originalInvoiceId: null,
    },
    [{
      description,
      quantity: "1",
      unitPrice: amount,
      amount,
      serviceId: booking.serviceId || null,
    }]
  );

  // Generate PDF
  const customerName = customer ? `${customer.firstName || ""} ${customer.lastName || ""}`.trim() || customer.name || "Customer" : "Customer";
  const providerUser = provider ? await db.getUserById(provider.userId) : null;
  const providerAddress = provider ? [provider.addressLine1, provider.city, provider.state, provider.postalCode].filter(Boolean).join(", ") || undefined : undefined;

  const invoice = await invoiceDb.getInvoiceById(result.id);
  if (invoice) {
    const pdfUrl = await generateInvoicePdf({
      invoice,
      providerName: provider?.businessName || "Provider",
      providerEmail: providerUser?.email || undefined,
      providerPhone: providerUser?.phone || undefined,
      providerAddress,
      providerLogoUrl: provider?.businessLogoUrl || undefined,
      customerName,
      customerEmail: customer?.email || undefined,
    });
    await invoiceDb.updateInvoicePdfUrl(result.id, pdfUrl);
  }

  console.log(`[Receipt] Auto-generated receipt ${invoiceNumber} for booking ${booking.bookingNumber}`);
}
