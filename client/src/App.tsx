import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { PWAInstallBanner } from "./components/PWAInstallBanner";
import { OfflineBanner } from "./components/OfflineBanner";
import { RoleGuard } from "./components/RoleGuard";
import { ProviderOnlyGuard } from "./components/ProviderOnlyGuard";
import { Footer } from "./components/shared/Footer";
import { PreviewEnvironmentBanner } from "./components/shared/PreviewEnvironmentBanner";
import { HelpChatWidget } from "./components/HelpChatWidget";
import { TermsUpdateBanner } from "./components/TermsUpdateBanner";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getCanonicalProviderDashboardDestination } from "@/lib/providerDashboardRedirect";
import { getCanonicalExploreDestination } from "@/lib/customerExplore";

// ─── Page Imports ───────────────────────────────────────────────────────────

// Core pages
import Home from "./pages/Home";
import Browse from "./pages/Browse";
import Experiences from "./pages/Experiences";
import CategoryDetail from "./pages/CategoryDetail";
import ServiceDetail from "./pages/ServiceDetail";
import PublicProviderProfile from "./pages/PublicProviderProfile";

// Auth & onboarding
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import Verify2FA from "./pages/Verify2FA";
import RoleSelection from "./pages/RoleSelection";
import ProviderOnboarding from "./pages/ProviderOnboarding";

// Booking flow
import BookingConfirmation from "./pages/BookingConfirmation";
import BulkBooking from "./pages/BulkBooking";
import MonthlyPlanner from "./pages/MonthlyPlanner";
import BookingDetail from "./pages/BookingDetail";
import MyBookings from "./pages/MyBookings";
import MyQuotes from "./pages/MyQuotes";
import MyWaitlist from "./pages/MyWaitlist";

// Messaging
import Conversations from "./pages/Conversations";
import Messages from "./pages/Messages";
import DirectMessage from "./pages/DirectMessage";

// Provider dashboard & tools
import ProviderDashboard from "./pages/ProviderDashboard";
import CreateService from "./pages/CreateService";
import ManageAvailability from "./pages/ManageAvailability";
import ProviderCalendar from "./pages/ProviderCalendar";
import ProviderReviews from "./pages/ProviderReviews";
import WidgetGenerator from "./pages/WidgetGenerator";
import PromoCodes from "./pages/PromoCodes";
import BookingAnalytics from "./pages/BookingAnalytics";
import Promotions from "./pages/Promotions";
import Invoices from "./pages/Invoices";
import BillingHistory from "./pages/BillingHistory";
import Receipts from "./pages/Receipts";
import { ProviderBookings, ProviderServices, ProviderFinances, ProviderTools, ProviderPayouts, ProviderPortfolio, ProviderQuotes } from "./pages/ProviderTabPage";
import ProviderAnalyticsPage from "./pages/ProviderAnalyticsPage";
import ProviderMyPage from "./pages/ProviderMyPage";
import ProviderCustomers from "./pages/ProviderCustomers";
import ProviderCustomerDetail from "./pages/ProviderCustomerDetail";

// User features
import UserProfile from "./pages/UserProfile";
import SubscriptionManagement from "./pages/SubscriptionManagement";
import Notifications from "./pages/Notifications";
import NotificationSettings from "./pages/NotificationSettings";
import Referrals from "./pages/Referrals";
import SavedProviders from "./pages/SavedProviders";
import CustomerPricing from "./pages/CustomerPricing";
import AccountSubscription from "./pages/AccountSubscription";
import CustomerBillingHistory from "./pages/CustomerBillingHistory";

// Reviews
import SubmitReview from "./pages/SubmitReview";
import CustomerReviews from "./pages/CustomerReviews";

// Embed / external
import EmbedBooking from "./pages/EmbedBooking";
import Unsubscribe from "./pages/Unsubscribe";

// Static / info pages
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import HelpCenter from "./pages/HelpCenter";
import ReferralProgram from "./pages/ReferralProgram";
import FeaturedProfessionals from "./pages/FeaturedProfessionals";
import PromotionDetail from "./pages/PromotionDetail";
import ProviderBenefits from "./pages/ProviderBenefits";
import PlatformProducts from "./pages/PlatformProducts";
import ProviderSurvey from "./pages/ProviderSurvey";

// Admin
import AdminDashboard from "./pages/AdminDashboard";
import EmailPreview from "./pages/EmailPreview";
import UserDetailPage from "./pages/admin/UserDetailPage";

// Isolated UX review prototypes
import ProviderOverviewPrototype from "./pages/prototype/ProviderOverviewPrototype";
import CustomerHomePrototype from "./pages/prototype/CustomerHomePrototype";
import AdaptiveBookingPrototype from "./pages/prototype/AdaptiveBookingPrototype";
import PublicHomepageRefreshPrototype from "./pages/prototype/PublicHomepageRefreshPrototype";
import PublicHomepageOriginalMessagePrototype from "./pages/prototype/PublicHomepageOriginalMessagePrototype";
import PublicHomepageDemoPrototype from "./pages/prototype/PublicHomepageDemoPrototype";
import PublicHomepageLiveReview from "./pages/prototype/PublicHomepageLiveReview";

// Not Found
import NotFound from "./pages/NotFound";

// ─── Router ──────────────────────────────────────────────────────────────────
function ProviderDashboardRoute() {
  const [, setLocation] = useLocation();
  const canonicalDestination = getCanonicalProviderDashboardDestination(window.location.search);

  useEffect(() => {
    if (canonicalDestination) {
      setLocation(canonicalDestination, { replace: true });
    }
  }, [canonicalDestination, setLocation]);

  if (canonicalDestination) return null;
  return <ProviderDashboard />;
}

function LegacySearchRoute() {
  const [, setLocation] = useLocation();
  const destination = getCanonicalExploreDestination(window.location.search);

  useEffect(() => {
    setLocation(destination, { replace: true });
  }, [destination, setLocation]);

  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/signup" component={SignUp} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/verify-2fa" component={Verify2FA} />
      <Route path="/select-role" component={RoleSelection} />
      <Route path="/preview/provider-overview" component={ProviderOverviewPrototype} />
      <Route path="/preview/customer-home" component={CustomerHomePrototype} />
      <Route path="/preview/adaptive-booking" component={AdaptiveBookingPrototype} />
      <Route path="/preview/public-home-refresh" component={PublicHomepageRefreshPrototype} />
      <Route path="/preview/public-home-original" component={PublicHomepageOriginalMessagePrototype} />
      <Route path="/preview/public-home-demo" component={PublicHomepageDemoPrototype} />
      <Route path="/preview/public-home-live" component={PublicHomepageLiveReview} />
      <Route path="/" component={Home} />
      <Route path="/for-providers" component={ProviderBenefits} />
      <Route path="/platform" component={PlatformProducts} />
      <Route path="/browse" component={Browse} />
      <Route path="/experiences" component={Experiences} />
      <Route path="/featured" component={FeaturedProfessionals} />
      <Route path="/featured/promo/:id" component={PromotionDetail} />
      <Route path="/search" component={LegacySearchRoute} />
      <Route path="/category/:slug" component={CategoryDetail} />
      <Route path="/provider/dashboard" component={ProviderDashboardRoute} />
      <Route path="/provider/customers/:contactId">{() => <ProviderOnlyGuard featureName="Customers"><ProviderCustomerDetail /></ProviderOnlyGuard>}</Route>
      <Route path="/provider/customers">{() => <ProviderOnlyGuard featureName="Customers"><ProviderCustomers /></ProviderOnlyGuard>}</Route>
      <Route path="/provider/bookings">{() => { window.location.replace("/my-bookings"); return null; }}</Route>
      <Route path="/provider/services">{() => <ProviderOnlyGuard featureName="Services"><ProviderServices /></ProviderOnlyGuard>}</Route>
      <Route path="/provider/analytics">{() => <ProviderOnlyGuard featureName="Analytics"><ProviderAnalyticsPage /></ProviderOnlyGuard>}</Route>
      <Route path="/provider/finances">{() => <ProviderOnlyGuard featureName="Finances"><ProviderFinances /></ProviderOnlyGuard>}</Route>
      <Route path="/provider/tools">{() => <ProviderOnlyGuard featureName="Business Tools"><ProviderTools /></ProviderOnlyGuard>}</Route>
      <Route path="/provider/payouts">{() => <ProviderOnlyGuard featureName="Payouts"><ProviderPayouts /></ProviderOnlyGuard>}</Route>
      <Route path="/provider/portfolio">{() => <ProviderOnlyGuard featureName="Portfolio"><ProviderPortfolio /></ProviderOnlyGuard>}</Route>
      <Route path="/provider/quotes">{() => <ProviderOnlyGuard featureName="Quotes"><ProviderQuotes /></ProviderOnlyGuard>}</Route>
      <Route path="/provider/my-page">{() => <ProviderOnlyGuard featureName="My Page"><ProviderMyPage /></ProviderOnlyGuard>}</Route>
      <Route path="/provider/services/new">{() => <ProviderOnlyGuard featureName="Create Service"><CreateService /></ProviderOnlyGuard>}</Route>
      <Route path="/provider/availability">{() => <ProviderOnlyGuard featureName="Availability Management"><ManageAvailability /></ProviderOnlyGuard>}</Route>
      <Route path="/provider/calendar">{() => <ProviderOnlyGuard featureName="Calendar"><ProviderCalendar /></ProviderOnlyGuard>}</Route>
      <Route path="/service/:id" component={ServiceDetail} />
      <Route path="/booking/:id" component={BookingConfirmation} />
      <Route path="/bulk-booking" component={BulkBooking} />
      <Route path="/monthly-planner" component={MonthlyPlanner} />
      <Route path="/my-bookings" component={MyBookings} />
      <Route path="/messages" component={Conversations} />
      <Route path="/messages/:bookingId" component={Messages} />
      <Route path="/dm/:conversationId" component={DirectMessage} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/users/:id" component={UserDetailPage} />
      <Route path="/admin/email-preview" component={EmailPreview} />
      <Route path="/booking/:id/review" component={SubmitReview} />
      <Route path="/my-reviews" component={CustomerReviews} />
      <Route path="/provider/reviews">{() => <ProviderOnlyGuard featureName="Reviews"><ProviderReviews /></ProviderOnlyGuard>}</Route>
      <Route path="/account" component={UserProfile} />
      <Route path="/profile">{() => { window.location.replace("/account"); return null; }}</Route>
      <Route path="/p/:slug" component={PublicProviderProfile} />
      <Route path="/provider/subscription">{() => <ProviderOnlyGuard featureName="Subscription Plans"><SubscriptionManagement /></ProviderOnlyGuard>}</Route>
      <Route path="/provider/onboarding">{() => <ProviderOnlyGuard featureName="Provider Profile Setup"><ProviderOnboarding /></ProviderOnlyGuard>}</Route>
      <Route path="/notifications" component={Notifications} />
      <Route path="/notification-settings" component={NotificationSettings} />
      <Route path="/unsubscribe/:token" component={Unsubscribe} />
      <Route path="/provider-survey/:token" component={ProviderSurvey} />
      <Route path="/embed/book/:serviceId" component={EmbedBooking} />
      <Route path="/embed/provider/:providerId" component={EmbedBooking} />
      <Route path="/provider/widgets">{() => <ProviderOnlyGuard featureName="Widgets"><WidgetGenerator /></ProviderOnlyGuard>}</Route>
      <Route path="/provider/promo-codes">{() => <ProviderOnlyGuard featureName="Promo Codes"><PromoCodes /></ProviderOnlyGuard>}</Route>
      <Route path="/provider/promotions">{() => <ProviderOnlyGuard featureName="Promotions"><Promotions /></ProviderOnlyGuard>}</Route>
      <Route path="/provider/invoices">{() => <ProviderOnlyGuard featureName="Invoices"><Invoices /></ProviderOnlyGuard>}</Route>
      <Route path="/provider/billing">{() => <ProviderOnlyGuard featureName="Billing History"><BillingHistory /></ProviderOnlyGuard>}</Route>
      <Route path="/receipts" component={Receipts} />
      <Route path="/booking/:id/detail" component={BookingDetail} />
      <Route path="/referrals" component={Referrals} />
      <Route path="/saved-providers" component={SavedProviders} />
      <Route path="/my-quotes" component={MyQuotes} />
      <Route path="/my-waitlist" component={MyWaitlist} />
      <Route path="/pricing" component={CustomerPricing} />
      <Route path="/customer/subscription" component={AccountSubscription} />
      <Route path="/customer/billing" component={CustomerBillingHistory} />
      <Route path="/analytics">{() => <ProviderOnlyGuard featureName="Analytics"><BookingAnalytics /></ProviderOnlyGuard>}</Route>
      <Route path="/privacy" component={PrivacyPolicy} />
      <Route path="/terms" component={TermsOfService} />
      <Route path="/help" component={HelpCenter} />
      <Route path="/referral-program" component={ReferralProgram} />
      <Route path="/404" component={NotFound} />
      <Route path="/:slug" component={PublicProviderProfile} />
      <Route component={NotFound} />
    </Switch>
  );
}

// ─── App Shell ───────────────────────────────────────────────────────────────
function AppContent() {
  const [location] = useLocation();
  const { loading: authLoading } = useAuth();
  const [showContent, setShowContent] = useState(false);

  // Wait for auth to resolve before showing any page content
  // This prevents the flash of wrong content (e.g., public homepage before dashboard)
  useEffect(() => {
    if (!authLoading) {
      setShowContent(true);
    }
  }, [authLoading]);

  // Hide footer on embed pages and admin dashboard
  const isPrototype = location.startsWith("/preview/");
  const isDemoProfile = location === "/demo-ologycrew" || location === "/p/demo-ologycrew";
  const isPricingPage = location === "/pricing";
  const isHelpPage = location === "/help";
  const isPlatformPage = location === "/platform";
  const hideFooter = location.startsWith("/embed") || location.startsWith("/admin") || isPrototype;

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);

  // Show minimal loading screen while auth resolves
  if (!showContent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page">
        <div className="animate-pulse">
          <img
            src="https://d2xsxph8kpxj0f.cloudfront.net/310519663275372790/QD7eHrqop9F5cN2Q4sYGpD/logo-navbar_38427c60.png"
            alt="OlogyCrew"
            className="h-8 opacity-50"
          />
        </div>
      </div>
    );
  }

  return (
    <>
      {!location.startsWith("/embed") && !isPrototype && <PreviewEnvironmentBanner />}
      <RoleGuard>
        <TermsUpdateBanner />
        <Router />
      </RoleGuard>
      {!hideFooter && <Footer compactPublicHome={location === "/" || location === "/for-providers" || isPlatformPage} />}
      {!isPrototype && !isDemoProfile && !isPricingPage && !isHelpPage && !isPlatformPage && <PWAInstallBanner />}
      {!location.startsWith("/embed") && !isPrototype && <HelpChatWidget />}
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster position="bottom-left" />
          <OfflineBanner />
          <AppContent />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
