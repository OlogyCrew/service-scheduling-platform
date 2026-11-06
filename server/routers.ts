// ============================================================================
// MAIN APP ROUTER — thin merge file
// All domain routers are split into individual files under ./routers/
// ============================================================================

import { systemRouter } from "./_core/systemRouter";
import { router } from "./_core/trpc";

// Split routers (Phase 17)
import { authRouter } from "./routers/authRouter";
import { providerRouter } from "./routers/providerRouter";
import { categoryRouter } from "./routers/categoryRouter";
import { serviceRouter } from "./routers/serviceRouter";
import { bookingRouter } from "./routers/bookingRouter";
import { reviewRouter } from "./routers/reviewRouter";
import { messageRouter } from "./routers/messageRouter";
import { notificationRouter } from "./routers/notificationRouter";
import { availabilityRouter } from "./routers/availabilityRouter";

// Pre-existing separate routers
import { stripeRouter } from "./stripeRouter";
import { stripeConnectRouter } from "./stripeConnectRouter";
import { adminRouter } from "./adminRouter";
import { subscriptionRouter } from "./subscriptionRouter";
import { widgetRouter } from "./widgetRouter";
import { promoRouter } from "./promoRouter";
import { verificationRouter } from "./verificationRouter";
import { referralRouter } from "./referralRouter";
import { customerSubscriptionRouter } from "./customerSubscriptionRouter";
import { foldersRouter } from "./foldersRouter";
import { contactRouter } from "./contactRouter";
import { pushRouter } from "./pushRouter";
import { bulkDraftRouter } from "./bulkDraftRouter";
import { eventTemplateRouter } from "./eventTemplateRouter";
import { trustRouter } from "./trustRouter";
import { waitlistRouter } from "./routers/waitlistRouter";
import { platformSettingsRouter } from "./routers/platformSettingsRouter";
import { helpChatRouter } from "./helpChatRouter";
import { promotionRouter } from "./promotionRouter";
import { invoiceRouter } from "./invoiceRouter";
import { socialMediaRouter } from "./routers/socialMediaRouter";
import { providerOverviewRouter } from "./providerOverviewRouter";
import { customerHomeRouter } from "./customerHomeRouter";
import { termsRouter } from "./termsRouter";
import { crmOperationsRouter } from "./crmOperationsRouter";
import { customersRouter } from "./customersRouter";
import { agentHandoffRouter } from "./routers/agentHandoffRouter";
import { providerSurveyRouter } from "./providerSurveyRouter";

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  provider: providerRouter,
  category: categoryRouter,
  service: serviceRouter,
  booking: bookingRouter,
  review: reviewRouter,
  message: messageRouter,
  notification: notificationRouter,
  availability: availabilityRouter,
  stripe: stripeRouter,
  stripeConnect: stripeConnectRouter,
  subscription: subscriptionRouter,
  admin: adminRouter,
  widget: widgetRouter,
  promo: promoRouter,
  verification: verificationRouter,
  referral: referralRouter,
  customerSubscription: customerSubscriptionRouter,
  folders: foldersRouter,
  contact: contactRouter,
  push: pushRouter,
  trust: trustRouter,
  waitlist: waitlistRouter,
  bulkDraft: bulkDraftRouter,
  eventTemplate: eventTemplateRouter,
  platformSettings: platformSettingsRouter,
  helpChat: helpChatRouter,
  promotion: promotionRouter,
  invoice: invoiceRouter,
  socialMedia: socialMediaRouter,
  providerOverview: providerOverviewRouter,
  customerHome: customerHomeRouter,
  terms: termsRouter,
  crmOperations: crmOperationsRouter,
  customers: customersRouter,
  agentHandoff: agentHandoffRouter,
  providerSurvey: providerSurveyRouter,
});

export type AppRouter = typeof appRouter;
