import { useState, useMemo, useEffect } from "react";
import { Link } from "wouter";
import { NavHeader } from "@/components/shared/NavHeader";
import { useAuth } from "@/_core/hooks/useAuth";
import { OLOGYCREW_PUBLIC_ORIGIN } from "@shared/publicUrls";
import "./HelpCenter.css";
import {
  Search,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Users,
  Briefcase,
  CreditCard,
  Settings,
  HelpCircle,
  Phone,
  ArrowRight,
  Calendar,
  MessageSquare,
  Star,
  Heart,
  FileText,
  Shield,
  Clock,
  DollarSign,
  UserPlus,
  Palette,
  BarChart3,
  Gift,
  Bell,
  MapPin,
  Camera,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";

// ─── Help Content Data ────────────────────────────────────────────────────────

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

interface GuideSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  description: string;
  articles: {
    title: string;
    content: string;
    link?: string;
    linkText?: string;
  }[];
}

const guideSections: GuideSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: <BookOpen className="h-5 w-5" />,
    description: "New to OlogyCrew? Start here to learn the basics.",
    articles: [
      {
        title: "Creating Your Account",
        content:
          "Sign up for OlogyCrew by clicking the \"Sign In\" button in the top navigation. After your first login, you'll be asked to choose your role — Customer (looking to book services) or Provider (offering services). Don't worry, this isn't permanent! Customers can become providers later from their profile page, and providers can always browse and book services too. Once you've selected your role, you'll be taken to your personalized experience.",
      },
      {
        title: "Switching Between Customer & Provider Views",
        content:
          "OlogyCrew is built around the \"Work, Live, Play\" concept — providers are people too, and they can also book services as customers. If you're a provider, you'll see a toggle switch in the navigation bar that lets you flip between Provider view (manage your business, dashboard, bookings received) and Customer view (browse services, make bookings, leave reviews). The platform automatically switches your view based on where you navigate — for example, visiting your Dashboard switches to Provider view, while browsing services switches to Customer view.",
      },
      {
        title: "Browsing & Searching Services",
        content:
          "Use Explore in the navigation to browse every service category or find specific services and providers by keyword, location, price, and provider options. The page starts with categories, then changes to matching providers and services when you search or apply a filter. Use the X button or Clear All Filters to return to the category directory.",
        link: "/browse",
        linkText: "Explore Services",
      },
      {
        title: "Booking from an AI Assistant's Review Link",
        content:
          "Some AI assistants can search OlogyCrew's public services and prepare a review link for you. Not every assistant supports this. Opening a review link does not create a booking, send a quote request, reserve a time slot, or charge you. You remain in control of the final submission on OlogyCrew.\n\nOpen the link on ologycrew.com and check the provider, service, current price or quote requirement, date, time and location. A suggested time must still be available and explicitly confirmed. For a quote-only service, review the scope and location before sending your request; a request is not a confirmed booking or payment. Sign in if needed, then review again before submitting.\n\nReview links expire after 30 minutes. If a link expires or is invalid, ask for a fresh link or find the service manually in Explore. Availability can change before submission; the link does not hold a time slot.\n\nDemo services are samples, not real providers to hire. Agent service searches exclude official demos by default; an assistant can explicitly include samples for testing. Check that you are choosing a real provider before proceeding.\n\nDo not post your review link publicly: it can carry project and location notes. Do not include passwords, payment-card details or sensitive documents in an assistant request. Contact Support if a link opens the wrong service or your intended details are missing.",
        link: "/browse",
        linkText: "Find a Service Manually",
      },
      {
        title: "Sharing OlogyCrew",
        content:
          "At the bottom of the site, use Share OlogyCrew to open a Facebook or LinkedIn sharing window, or select Copy link to copy the public homepage address. These controls share only https://ologycrew.com/ — never your account or private workspace. To recommend a particular professional instead, use Share on that provider's public profile.",
      },
      {
        title: "Making Your First Booking",
        content:
          "Find a service you need, click on it to view details including pricing, duration, and availability. Select your preferred date and time slot, add any notes for the provider, and confirm your booking. You'll receive a confirmation with all the details. The provider will then confirm or suggest an alternative time.",
      },
      {
        title: "Understanding the Platform",
        content:
          "OlogyCrew connects customers with trusted service professionals across dozens of categories. Providers set their own services, pricing, and availability. Customers can browse, book, message providers, request quotes, and leave reviews. Payments are processed securely through Stripe, and both parties receive notifications at every step.",
      },
    ],
  },
  {
    id: "for-customers",
    title: "For Customers",
    icon: <Users className="h-5 w-5" />,
    description: "Everything you need to know about booking and managing services.",
    articles: [
      {
        title: "How Bookings Work",
        content:
          "When you book a service, the provider receives a notification and can confirm, reschedule, or discuss details with you via messaging. Booking statuses include: Pending (awaiting provider confirmation), Confirmed (provider accepted), In Progress (service started), Completed (service finished), and Cancelled. View all your bookings from the \"My Bookings\" page. If you're also a provider, you'll see two tabs: \"Bookings I Made\" (services you booked as a customer) and \"Bookings I Received\" (bookings from your customers).",
        link: "/my-bookings",
        linkText: "View My Bookings",
      },
      {
        title: "Messaging Providers",
        content:
          "Each booking has a built-in messaging thread where you can communicate directly with your provider. Discuss details, share photos, ask questions, or coordinate logistics — all in one place. You'll receive real-time notifications when you get a new message. Access your conversations from the \"Messages\" icon in the navigation bar.",
      },
      {
        title: "Requesting Quotes",
        content:
          "Not sure about pricing? Send a quote request to any provider describing what you need, your preferred dates, and budget. Providers will respond with a custom quote. You can compare quotes from multiple providers before deciding. Manager-tier customers can send bulk quote requests to multiple providers at once from the Saved Providers page.",
        link: "/my-quotes",
        linkText: "View My Quotes",
      },
      {
        title: "Saving Favorite Providers",
        content:
          "Found a provider you love? Click the heart icon on their profile or service to save them. Organize saved providers into folders for easy access. Individual accounts can save up to 5 providers, Coordinator up to 50, and Manager subscribers get unlimited saves.",
        link: "/saved-providers",
        linkText: "View Saved Providers",
      },
      {
        title: "Leaving Reviews",
        content:
          "After a completed booking, you'll be prompted to leave a review. Rate your experience from 1 to 5 stars and write a detailed review to help other customers. Your reviews help providers build their reputation and help the community make informed decisions.",
      },
      {
        title: "Cancelling a Booking",
        content:
          "You can cancel a booking from the booking detail page. Please note that cancellation policies vary by provider — some may have cancellation fees or time restrictions. Check the provider's cancellation policy before booking. If you need to reschedule instead, contact the provider through messaging first.",
      },
      {
        title: "Understanding Time Slot Availability",
        content:
          "When you select a date to book a service, you'll see available time slots displayed as buttons. Slots that are already booked or overlap with existing bookings are grayed out and cannot be selected — this prevents double-bookings and ensures the provider is available when you arrive. If all slots on a particular day are grayed out, the provider is fully booked for that date. Try selecting a different day or check back later for cancellations.",
      },
      {
        title: "Booking Group Classes",
        content:
          "Some services are offered as group classes — such as fitness classes, dance lessons, or workshops. When browsing a group class, you'll see how many spots are remaining for each time slot (e.g., \"3 spots left\"). You can book as long as spots are available. Once all spots are filled, that time slot becomes unavailable. Group classes are a great way to enjoy services at a lower per-person cost while meeting others with similar interests.",
      },
      {
        title: "Joining a Waitlist",
        content:
          "When a group class time slot is completely full, you'll see a \"Notify Me\" button instead of the regular booking button. Tap it to join the waitlist for that specific date and time. If someone cancels their booking, you'll automatically receive a notification letting you know a spot has opened up. You can then book the newly available slot before anyone else. To manage your waitlist entries, visit the My Waitlist page from the navigation menu.",
        link: "/my-waitlist",
        linkText: "View My Waitlist",
      },
      {
        title: "Managing Your Waitlist",
        content:
          "Your My Waitlist page shows all the group classes you're waiting for, organized into three sections: 'Spots Available' (a spot just opened — book now!), 'Waiting' (still full, you'll be notified when a spot opens), and 'Past' (expired or already booked). You can leave a waitlist at any time by clicking the remove button. When a spot opens, you'll receive both an in-app notification and an email so you never miss your chance to book.",
        link: "/my-waitlist",
        linkText: "View My Waitlist",
      },
      {
        title: "Custom Duration Bookings",
        content:
          "For services that charge by the hour — such as DJs, photographers, event planners, AV crews, TV/film crews, dance instructors, fitness trainers, personal trainers, day labor, handymen, power washing, home cleaning, virtual events, and party & event rentals — you can set a custom duration instead of choosing a preset time slot. Toggle on 'Custom Duration' during booking, then pick your start and end times. The system automatically calculates the total cost based on the provider's hourly rate multiplied by the number of hours. Overnight bookings (e.g., 8 PM to 2 AM) are fully supported.",
      },
      {
        title: "Bulk Booking",
        content:
          "Plan entire events with multiple providers in one session. Go to My Bookings and click 'Bulk Book'. Step 1: Enter your event details \u2014 select the event date, choose an event type (Wedding, Corporate Event, Birthday Party, Concert, Festival, Private Party, etc.), and enter the venue name and address. Step 2: Add service providers \u2014 select a service category (e.g., DJ & Music, Photography, AV Crew), choose a specific provider, pick their service, and set individual start/end times for each. Add as many providers across different categories as you need. The Visual Timeline shows all providers' time slots as colored bars across the day so you can instantly see overlaps and gaps. The Dynamic Cost Calculator displays estimated totals based on each provider's pricing model (fixed, hourly, or package). Use 'Save as Draft' to save your event plan and return later \u2014 drafts are stored in your account and can be loaded, edited, or deleted anytime.",
        link: "/bulk-booking",
        linkText: "Start Bulk Booking",
      },
      {
        title: "Monthly Planner",
        content:
          "The Monthly Planner gives you a visual calendar-based approach to scheduling. Go to My Bookings and click the 'Monthly Planner' button. You'll see a full month grid — click on any date to add a provider or event for that day. Search and select providers, see all your planned events as colored markers on the calendar, navigate between months to plan ahead, and confirm all bookings at once when you're ready. Perfect for logistics managers or anyone who thinks in terms of 'which dates need coverage.'",
        link: "/monthly-planner",
        linkText: "Open Monthly Planner",
      },
      {
        title: "Quick Re-book",
        content:
          "Had a great experience with a provider? Use Quick Re-book to schedule them again with minimal effort. On your My Bookings page, completed and past bookings show a 'Re-book' button. Click it to jump straight into a new booking with the same provider and service pre-selected — just pick a new date and time.",
        link: "/my-bookings",
        linkText: "View My Bookings",
      },
      {
        title: "Editing Booking Duration",
        content:
          "Need to extend or shorten a booking? For pending or confirmed hourly bookings, you can edit the duration directly from the Booking Detail page. Click 'Edit Duration', adjust your start and end times, and the system recalculates the total cost in real-time based on the provider's hourly rate. The updated amount is reflected immediately.",
      },
      {
        title: "Location Types",
        content:
          "OlogyCrew supports multiple location types for services: Mobile (provider comes to you), At My Location (you go to the provider), Virtual (online session), Flexible (either party can host), Microsoft Teams, Zoom, and Other. When booking, the location type determines whether you need to provide an address. Virtual, Teams, and Zoom bookings don't require a physical address.",
      },
      {
        title: "Booking Analytics",
        content:
          "Manager-tier customers have access to a detailed analytics dashboard showing spending trends, booking history, category breakdowns, and top providers. You can also export your booking history as CSV, JSON, or a branded PDF report with charts.",
        link: "/analytics",
        linkText: "View Analytics",
      },
      {
        title: "Provider Relationship Messages",
        content:
          "You control whether providers with a qualified OlogyCrew relationship may send you an occasional in-app follow-up from Customers. Permission is off by default. Turn it on or off from Notification Settings at any time. A provider must review the exact draft and confirm each message; this permission does not enable marketing email, SMS, push notifications, bulk messages, or automatic follow-ups. Turning permission off blocks future Customers relationship messages but does not remove messages already in your OlogyCrew conversation history.",
        link: "/notification-settings",
        linkText: "Manage Relationship Message Permission",
      },
      {
        title: "Becoming a Provider",
        content:
          "Want to offer your own services? You don't need a separate account. Visit your Profile page and you'll see a \"Become a Provider\" card that walks you through the process. Click \"Get Started\" to begin the provider onboarding wizard. Once complete, you'll have access to both customer and provider features — book services and offer your own, all from one account.",
        link: "/account",
        linkText: "View Profile",
      },
    ],
  },
  {
    id: "for-providers",
    title: "For Providers",
    icon: <Briefcase className="h-5 w-5" />,
    description: "Set up your business and start accepting bookings.",
    articles: [
      {
        title: "Provider Onboarding",
        content:
          "There are two ways to become a provider: (1) Choose \"Provider\" when you first sign up and see the role selection screen, or (2) Click \"Become a Provider\" from your profile page if you initially signed up as a customer. Either way, you'll enter the onboarding wizard — a simple 5-step process:\n\n1. Profile — Set up your business profile with a description, location, and contact info\n2. Skills — Choose your service categories from the current directory\n3. Services — Add your services with pricing and duration\n4. Your Plan — Choose your subscription tier (Starter, Pro, or Business) or start a free 14-day Pro trial\n5. Get Paid — Connect your Stripe account to receive payments\n\nYour dashboard shows a checklist of what's complete.",
        link: "/provider/onboarding",
        linkText: "Start Onboarding",
      },
      {
        title: "Managing Your Services",
        content:
          "From the Services page in your provider workspace, you can add, edit, or remove services at any time. Each service includes a name, description, category, pricing (fixed, hourly, or custom), duration, and location type (mobile, in-shop, or virtual). Your tier determines your limits: Starter gets 1 category and up to 3 services, Pro gets up to 5 categories and 10 services, and Business gets unlimited categories and services.",
        link: "/provider/services",
        linkText: "Manage Services",
      },
      {
        title: "Setting Your Availability",
        content:
          "Set your weekly availability schedule so customers know when you're available. You can set different hours for each day of the week, block off specific dates, and manage your calendar from the Provider Calendar page. Customers can only book during your available time slots.",
        link: "/provider/availability",
        linkText: "Manage Availability",
      },
      {
        title: "Blocking Time on Your Calendar",
        content:
          "Need to take time off for a vacation, personal appointment, or just a break? Use the \"Block Time\" button on your Provider Calendar to block off specific dates or time ranges. Blocked time appears in gray on your calendar with a ban icon, and customers won't be able to book during those times. You can block a full day or just specific hours (e.g., block 12:00–2:00 PM for lunch). To quickly block a date, double-click it on the calendar. View and manage all your upcoming blocked dates in the sidebar, where you can also delete blocks you no longer need.",
        link: "/provider/calendar",
        linkText: "View Calendar",
      },
      {
        title: "Understanding Your Calendar Colors",
        content:
          "Your Provider Calendar uses color-coding to help you see your schedule at a glance:\n\n• Blue — Confirmed bookings\n• Amber/Yellow — Pending bookings (awaiting your confirmation)\n• Purple — In-progress bookings (service currently happening)\n• Green — Completed bookings\n• Red — Cancelled bookings\n• Gray — Blocked time (personal time, vacations)\n\nClick on any booking or blocked time entry to see full details. The calendar supports both month and week views — use the toggle at the top to switch between them.",
        link: "/provider/calendar",
        linkText: "View Calendar",
      },
      {
        title: "Creating Group Class Services",
        content:
          "If you offer group services like fitness classes, dance lessons, or workshops, you can enable the \"Group Class\" option when creating or editing a service. Toggle on \"This is a group class\" and set the maximum number of participants (e.g., 10 for a yoga class, 20 for a workshop). Customers will see how many spots are remaining when they book. Once all spots are filled for a time slot, it automatically becomes unavailable. This is perfect for categories like Fitness Classes & Trainers, Dance Lessons & Instructors, and similar group-based services.",
      },
      {
        title: "Viewing Your Waitlist",
        content:
          "When your group classes are full, customers can join a waitlist for specific time slots. You can view all waitlist entries from the Waitlist section in My Dashboard. Entries are grouped by service and date, showing each customer's name, position in line, and status. When a booking is cancelled, the next person on the waitlist is automatically notified that a spot has opened. You can also manually remove entries if needed. A healthy waitlist is a great sign — it means demand for your classes is high!",
      },
      {
        title: "Handling Bookings",
        content:
          "When a customer books your service, you'll receive a notification. From your dashboard, you can confirm the booking, start the service when it's time, and mark it as completed when finished. You can also cancel if needed (though this affects your rating). Each booking has a messaging thread for coordinating with the customer.",
      },
      {
        title: "Responding to Quote Requests",
        content:
          "Customers may send you quote requests for custom work. Review them on your provider Quotes page and respond with your pricing, estimated timeline, and any notes. Quick responses help customers decide how to proceed.",
        link: "/provider/quotes",
        linkText: "Open Provider Quotes",
      },
      {
        title: "Using Customers for Your Provider Business",
        content:
          "Customers organizes only your provider business's qualified OlogyCrew relationships from bookings, quotes, payments, invoices, eligible messages, and booking-linked reviews. Existing source records remain authoritative. Leads, Customers, Follow-ups, and Activity help you review your own history without creating external contacts or exposing another provider's customers.\n\nPrivate notes are visible only to your provider account. Follow-ups are manual reminders and never contact the customer. Manual stages change only how a relationship is organized. Message drafts remain private until you deliberately review and confirm an eligible in-app message; the customer's current permission is checked again at send time. Nothing runs automatically.\n\nCustomer history is available on Starter. Pro or Business is required for private notes, follow-ups, manual stages, and message drafts. If paid access ends, existing private records are retained but hidden until qualifying access returns. Contact Support if Customers shows the wrong provider, an unknown relationship, or a message you did not deliberately confirm.",
        link: "/provider/customers",
        linkText: "Open Customers",
      },
      {
        title: "Building Your Portfolio",
        content:
          "Showcase your work on your provider Portfolio page. You can add single photos or before/after comparisons so potential customers can see your services in action.",
        link: "/provider/portfolio",
        linkText: "Open Portfolio",
      },
      {
        title: "Your Public Profile",
        content:
          "Every provider gets a public profile page that customers can view. It shows your services, reviews, portfolio, availability, and business information. Pro and Business subscribers can customize their profile URL slug for a more professional look (e.g., /your-business-name). When you share your profile link on social media (Facebook, Twitter/X, LinkedIn, etc.), a rich preview card is automatically generated with your business name, description, and photo — making your profile look professional and clickable.",
      },
      {
        title: "How AI Assistants Find Your Services",
        content:
          "Compatible AI assistants can read OlogyCrew's public service and provider information, check current availability, and prepare a customer-reviewed booking or quote link. Discovery does not guarantee recommendations or new bookings, and not every assistant uses OlogyCrew's public API.\n\nKeep service names, descriptions, prices, duration, location and availability accurate. Clearly distinguish directly bookable work from services requiring a custom quote. Active, eligible public listings can appear in discovery; official demos are excluded from normal agent service searches.\n\nThe customer must review and submit on OlogyCrew. A prepared link does not reserve your calendar, create a booking or quote request, or collect payment. Continue managing confirmed bookings and submitted quote requests through your existing provider workspace.\n\nPrivate customer details, provider notes and booking history are not part of public discovery. Your public standing or reviewed evidence is not a guarantee of service quality. Contact Support if the public listing shows inaccurate information after you update your services.",
        link: "/provider/services",
        linkText: "Review Your Services",
      },
      {
        title: "Provider & Customer View Switcher",
        content:
          "As a provider, you can also browse and book services as a customer. Use the toggle in the navigation bar to switch between Provider view and Customer view. In Provider view, you see your dashboard, received bookings, and business tools. In Customer view, you see the regular browsing experience, your made bookings, and saved providers. The platform remembers your preference and auto-switches based on where you navigate.",
      },
      {
        title: "Promo Codes & Widgets",
        content:
          "Create promo codes to offer discounts and attract new customers. You can also generate embeddable booking widgets to add to your own website or social media, letting customers book directly from anywhere.",
        link: "/provider/promo-codes",
        linkText: "Manage Promo Codes",
      },
      {
        title: "Provider Standing & Evidence Review",
        content:
          "OlogyCrew keeps provider standing separate from evidence review. Standing is an automated profile-and-activity score based on profile completeness, payment setup, completed OlogyCrew bookings, booking-linked reviews, and account age. Its public labels are New (0–19), Building History (20–49), Established (50–79), and Top Activity (80–100). Standing is not credential verification.\n\nIdentity, business registration, professional license, insurance, and background-check evidence are submitted and reviewed separately. Uploading evidence creates a Pending state; only current, approved evidence receives a specific ‘reviewed’ label. A reviewed signal does not guarantee quality, safety, or suitability.",
        link: "/provider/dashboard",
        linkText: "View Your Provider Standing",
      },
      {
        title: "14-Day Pro Trial",
        content:
             "New providers can start a free 14-day Pro trial — no credit card required. During the trial, you get access to all Pro features: up to 5 service categories, up to 10 services, 3 photos per service, custom profile URL slug, priority search placement, and analytics dashboard. Start your trial during onboarding (Step 4: Your Plan) or from the Subscription Management page.\n\nYou'll receive email notifications at key milestones: 7 days remaining, 3 days remaining, 1 day remaining, and when the trial expires. If you don't upgrade before the trial ends, your account automatically reverts to the free Starter tier (1 category, 3 services). You can upgrade to Pro ($12/mo) or Business ($20/mo) at any time — save up to 20% with annual billing.",
        link: "/provider/subscription",
        linkText: "Manage Subscription",
      },
      {
        title: "Service & Photo Limits",
        content:
          "Each subscription tier has different limits for categories, services, and photos:\n\n• Starter (Free) — 1 category, up to 3 services, 1 photo per service\n• Pro ($12/mo) — Up to 5 categories, up to 10 services, 3 photos per service\n• Business ($20/mo) — Unlimited categories, unlimited services, 5 photos per service\n\nWhen you reach your tier's limit, you'll see an upgrade prompt with a comparison of what each tier offers. You can upgrade at any time from the Subscription Management page. If you're on a trial and it expires, your services remain but you won't be able to add new ones beyond the Starter limit.",
        link: "/provider/subscription",
        linkText: "Upgrade Your Plan",
      },
    ],
  },
  {
    id: "payments",
    title: "Payments & Billing",
    icon: <CreditCard className="h-5 w-5" />,
    description: "How payments, subscriptions, and billing work.",
    articles: [
      {
        title: "How Payments Work",
        content:
          "All payments on OlogyCrew are processed securely through Stripe. When you book a service, you'll be redirected to a secure Stripe checkout page to complete payment. Your payment information is never stored on our servers — Stripe handles all sensitive data with bank-level encryption.",
      },
      {
        title: "Platform Fees",
        content:
          "OlogyCrew charges a small 1% platform fee on each booking transaction. This fee is included in the total amount shown at checkout. There are no hidden fees — what you see is what you pay.",
      },
      {
        title: "Provider Subscription Plans",
        content:
          "Providers can choose from three subscription tiers:\n\n• Starter (Free) — 1 service category, up to 3 services, 1 photo per service, basic profile, standard search placement\n\n• Pro ($12/mo or $10.08/mo billed annually) — Up to 5 categories, up to 10 services, 3 photos per service, custom URL slug, priority search placement, analytics dashboard\n\n• Business ($20/mo or $16.00/mo billed annually) — Unlimited categories, unlimited services, 5 photos per service, featured listing badge, top search placement, full analytics, custom branding, priority support\n\nSave up to 20% by choosing annual billing (16% off Pro, 20% off Business)! Use the Monthly/Annual toggle on the pricing page to compare. New providers can start a free 14-day Pro trial — no credit card required — to experience all Pro features before committing.",
        link: "/provider/subscription",
        linkText: "Manage Subscription",
      },
      {
        title: "Customer Subscription Plans",
        content:
          "Booking services on OlogyCrew is always free. Customers who manage multiple providers or large crews can optionally upgrade for enhanced organization and priority features:\n\n• Individual (Free) — Save up to 5 providers, book any service, message providers, leave reviews, request quotes\n\n• Coordinator ($12/mo or $10.08/mo billed annually) — Save up to 50 providers, priority booking requests, and organize providers into folders\n\n• Manager ($20/mo or $16.00/mo billed annually) — Unlimited saved providers, bulk quote requests, booking analytics & spend reports, booking exports, and dedicated support\n\nThe Manager plan is ideal for logistics managers, agencies, and production companies who coordinate large crews or book many providers regularly.",
        link: "/pricing",
        linkText: "View Pricing",
      },
      {
        title: "Refunds & Cancellations",
        content:
          "Refund policies depend on the provider's cancellation terms and the booking status. If a booking is cancelled before the provider confirms, a full refund is typically issued. For confirmed bookings, the provider's cancellation policy applies. If you have a dispute, contact the provider through messaging first, then reach out to our support team if needed.",
      },
      {
        title: "Using Promo Codes",
        content:
          "Providers may offer promo codes for discounts on their services. Enter the promo code during checkout to apply the discount. Promo codes may have expiration dates, usage limits, or minimum booking requirements — check the terms when applying.",
      },
    ],
  },
  {
    id: "account",
    title: "Account & Settings",
    icon: <Settings className="h-5 w-5" />,
    description: "Manage your profile, notifications, and preferences.",
    articles: [
      {
        title: "Your Profile",
        content:
          "Access your profile from the user menu in the top-right corner. Update your name, profile photo, phone number, and other details. Your profile page includes a completion indicator that shows your progress — a checklist highlights which fields still need attention (name, email, phone, photo). Once your profile is 100% complete, the indicator disappears. A complete profile helps providers communicate with you and improves your booking experience.",
        link: "/account",
        linkText: "Edit Profile",
      },
      {
        title: "Notification Settings",
        content:
          "OlogyCrew sends notifications for booking updates, new messages, quote responses, and more. You receive real-time in-app notifications (shown in the bell icon), plus email alerts. Customize which notifications you receive from the Notification Settings page.",
        link: "/notification-settings",
        linkText: "Notification Settings",
      },
      {
        title: "Referral Program",
        content:
          "Share your unique referral link with a friend or provider. A signup is tracked, but it does not earn a reward on its own. When the referred account completes an eligible paid booking as a customer, you earn a tier-based credit on the net amount captured at award time. Unpaid, fully refunded, and official demo bookings do not qualify. See your referral activity, balance, and expiry dates on the Referrals page; credits expire 90 days after they're earned.",
        link: "/referrals",
        linkText: "View Referrals",
      },
      {
        title: "Privacy & Security",
        content:
          "We take your privacy seriously. Your personal information is protected and never shared without your consent. Payments are processed through Stripe's secure infrastructure. Review our Privacy Policy and Terms of Service for full details.",
        link: "/privacy",
        linkText: "Privacy Policy",
      },
      {
        title: "Installing OlogyCrew on Your Device",
        content:
          "OlogyCrew can be installed as an app on your phone, tablet, or computer for a faster, native-like experience without the browser bar.\n\n• iPhone (Safari only): Open OlogyCrew in Safari, tap the Share button (square with upward arrow) at the bottom, scroll down and tap 'Add to Home Screen', then tap 'Add'. Note: this only works in Safari — not Chrome or other browsers on iPhone.\n\n• Android (Chrome): Open in Chrome. You may see an automatic install banner — tap Install. If not, tap the three-dot menu (⋮) and select 'Install app' or 'Add to Home screen'.\n\n• Desktop (Chrome/Edge): Click the 'Install App' button in the banner at the bottom of the page, or find it in the footer or your user menu dropdown.\n\nOnce installed, OlogyCrew opens in its own window and works just like a native app. You can always find the 'Install App' link in the footer or user menu if you dismissed the banner.",
      },
      {
        title: "Navigation & Getting Around",
        content:
          "Every page on OlogyCrew includes a navigation header and breadcrumbs so you always know where you are and can easily get back. Use the back button at the top of any detail page to return to the previous screen. The navigation bar provides quick access to your bookings, messages, notifications, and profile from anywhere on the platform.",
      },
    ],
  },
];

const faqItems: FAQItem[] = [
  {
    question: "Is it free to create an account?",
    answer:
      "Yes! Creating an account is completely free for both customers and providers. Customers can browse, book, and message providers on the free plan. Providers can list up to 3 services on the free Starter plan. Optional paid subscriptions unlock additional features.",
    category: "General",
  },
  {
    question: "How do I book a service?",
    answer:
      "Browse or search for the service you need, select a provider, choose your preferred date and time from their available slots, add any special instructions, and confirm your booking. You'll be guided through secure payment via Stripe. Note: grayed-out time slots are already booked or unavailable — only highlighted slots can be selected.",
    category: "Bookings",
  },
  {
    question: "What are group classes and how do I book one?",
    answer:
      "Some services are offered as group classes (e.g., fitness classes, dance lessons, workshops). When viewing a group class, you'll see how many spots are remaining for each time slot — for example, '3 spots left'. You can book as long as there are spots available. Once all spots are filled, that time slot becomes unavailable. Group classes are a great way to enjoy services at a lower per-person cost.",
    category: "Bookings",
  },
  {
    question: "Why are some time slots grayed out?",
    answer:
      "Grayed-out time slots indicate that the provider is unavailable during that time. This could be because: (1) another customer has already booked that slot, (2) the provider has blocked off that time for personal reasons, or (3) the time slot overlaps with an existing booking. Only available (highlighted) slots can be selected for booking.",
    category: "Bookings",
  },
  {
    question: "Can I cancel or reschedule a booking?",
    answer:
      "Yes. You can cancel from the booking detail page. To reschedule, contact the provider through the booking's messaging thread to agree on a new time. Cancellation policies vary by provider, so check their terms before booking.",
    category: "Bookings",
  },
  {
    question: "How do I become a service provider?",
    answer:
      "There are two ways: (1) When you first sign up, choose \"Provider\" on the role selection screen, or (2) If you already have a customer account, go to your Profile page and click the \"Become a Provider\" card. Either way, you'll enter the 5-step onboarding wizard: set up your business profile, choose your service categories (1 category on Starter, up to 5 on Pro, unlimited on Business), add services with pricing, select your subscription plan (or start a free 14-day Pro trial), and connect Stripe for payments. The entire process takes about 10 minutes.",
    category: "Providers",
  },
  {
    question: "What service categories are available?",
    answer:
      "Explore the current service directory for categories including Barber Shop, Salon, Massage Therapist, Personal Trainer, Handyman, Photography, DJ & Music, Event Planning, Home Cleaning, Auto Detailing, Tech Support, Cybersecurity, Dance Lessons, and Pet Care. The available categories and services may change as providers join.",
    category: "General",
  },
  {
    question: "How are payments processed?",
    answer:
      "All payments are processed securely through Stripe. Your card information is never stored on our servers. OlogyCrew charges a 1% platform fee on each transaction, which is included in the total shown at checkout.",
    category: "Payments",
  },
  {
    question: "What if I have a problem with a service?",
    answer:
      "First, contact the provider directly through the booking's messaging thread to try to resolve the issue. If you can't reach a resolution, contact our support team by calling (678) 525-0891 or using the contact form on this page and we'll help mediate.",
    category: "General",
  },
  {
    question: "Can I offer services in multiple categories?",
    answer:
      "Yes! The number of categories you can offer depends on your subscription tier:\n\n• Starter (Free) — 1 service category\n• Pro ($12/mo) — Up to 5 categories\n• Business ($20/mo) — Unlimited categories\n\nFor example, a salon on the Pro plan could offer services under \"In-Salon Services\", \"Locks & Twist Hairstyles\", \"Mobile Salon\", and more. Upgrade anytime to unlock more categories from the Subscription Management page.",
    category: "Providers",
  },
  {
    question: "How do I offer group classes as a provider?",
    answer:
      "When creating or editing a service, toggle on 'This is a group class' and set the maximum number of participants. For example, set it to 10 for a yoga class or 20 for a workshop. Customers will see how many spots remain for each time slot. Once all spots are filled, the slot automatically closes. This is ideal for categories like Fitness Classes & Trainers, Dance Lessons & Instructors, and similar group-based services.",
    category: "Providers",
  },
  {
    question: "How do I block off time on my calendar?",
    answer:
      "Go to your Provider Calendar and click the 'Block Time' button. Select the date(s) and optionally set specific start/end times (or block the full day). Blocked time appears in gray on your calendar and prevents customers from booking during those times. You can also double-click any date on the calendar to quickly block it. To remove a block, find it in the 'Upcoming Blocked Dates' sidebar and click the delete button.",
    category: "Providers",
  },
  {
    question: "What do the colors on my provider calendar mean?",
    answer:
      "Your calendar uses color-coding: Blue = Confirmed bookings, Amber/Yellow = Pending bookings, Purple = In-progress, Green = Completed, Red = Cancelled, Gray = Blocked time (personal time off). Click any entry to see full details.",
    category: "Providers",
  },
  {
    question: "How do quote requests work?",
    answer:
      "Customers can send quote requests describing what they need, their preferred dates, and budget. Providers receive the request and respond with custom pricing. Customers can compare quotes from multiple providers before deciding. Manager-tier customers can send bulk quotes to multiple providers at once.",
    category: "Bookings",
  },
  {
    question: "Is there a mobile app?",
    answer:
      "OlogyCrew is a Progressive Web App (PWA) that you can install directly to your device's home screen for a native app-like experience — no app store needed! On iPhone: open the site in Safari, tap the Share button (square with arrow), then tap 'Add to Home Screen'. On Android: open in Chrome and tap 'Install App' from the menu, or look for the install banner. On Desktop: click the 'Install App' button in the banner or find it in the footer/user menu. Once installed, OlogyCrew opens in its own window without the browser bar, just like a native app.",
    category: "General",
  },
  {
    question: "How do I install OlogyCrew on my iPhone?",
    answer:
      "Apple requires a specific process to add web apps to your iPhone: (1) Open OlogyCrew in Safari — this only works in Safari, not Chrome or other browsers. (2) Tap the Share button at the bottom of the screen (the square with an upward arrow). (3) Scroll down and tap 'Add to Home Screen'. (4) Tap 'Add' in the top right. The app will appear on your home screen and open without the Safari browser bar. You can also find the 'Install App' link in the footer or user menu at any time.",
    category: "General",
  },
  {
    question: "How do I install OlogyCrew on my Android device?",
    answer:
      "On Android, open OlogyCrew in Chrome. You may see an automatic 'Add to Home Screen' banner — just tap Install. If no banner appears, tap the three-dot menu (⋮) in the top right corner and select 'Install app' or 'Add to Home screen'. The app will install and appear on your home screen as a standalone app. Samsung Internet and Firefox also support installation through their respective menus.",
    category: "General",
  },
  {
    question: "How do I get more visibility as a provider?",
    answer:
      "Your visibility is influenced by provider standing and subscription tier. Build standing by completing your profile, uploading quality portfolio work, setting up eligible payments, completing OlogyCrew bookings, and earning reviews tied to completed bookings. The standing labels are Building History, Established, and Top Activity; they describe profile and platform activity, not credential verification. Pro and Business add the search-priority benefit defined by the plan catalog.",
    category: "Providers",
  },
  {
    question: "Can I embed a booking widget on my own website?",
    answer:
      "Yes! Providers can generate embeddable booking widgets from the Widget Generator page on their dashboard. Copy the embed code and paste it into your website to let customers book directly from your site.",
    category: "Providers",
  },
  {
    question: "What types of bookings are supported?",
    answer:
      "OlogyCrew supports single bookings, multi-day bookings (for projects spanning multiple days), recurring bookings (weekly, bi-weekly, or monthly sessions), custom duration bookings (pick your own start/end times for hourly services), bulk bookings (schedule multiple providers at once), and monthly planner bookings (visual calendar-based scheduling). The booking type depends on the service category and what the provider has configured.",
    category: "Bookings",
  },
  {
    question: "What is Custom Duration and how does it work?",
    answer:
      "Custom Duration lets you set your own start and end times for services that charge by the hour. Instead of choosing a preset time slot, toggle on 'Custom Duration' during booking, pick your start time and end time, and the system calculates the total cost automatically (hourly rate × hours). This is available for 14 service categories including DJs, photographers, event planners, AV crews, TV/film crews, dance instructors, fitness trainers, personal trainers, day labor, handymen, power washing, home cleaning, virtual events, and party & event rentals. Overnight bookings (e.g., 8 PM to 2 AM) are fully supported.",
    category: "Bookings",
  },
  {
    question: "How does Bulk Booking work?",
    answer:
      "Bulk Booking is an event-centric planning tool. Go to My Bookings and click 'Bulk Book'. First, enter your event details: select the date, choose an event type (Wedding, Corporate Event, Birthday, Concert, etc.), and enter the venue. Then add providers: pick a service category, choose a provider, select their service, and set their individual start/end times. Add as many providers as you need. The page includes a Visual Timeline showing all providers' time slots as colored bars, a Dynamic Cost Calculator with estimated totals, and a 'Save as Draft' option to save your plan for later.",
    category: "Bookings",
  },
  {
    question: "What is the Visual Timeline in Bulk Booking?",
    answer:
      "The Visual Timeline is a horizontal bar chart that appears as you add providers to your bulk booking. Each provider's time slot is shown as a colored bar across the event day, with hour markers from the earliest start to the latest end time. It helps you instantly see scheduling overlaps, gaps, and the overall flow of your event. The timeline updates in real-time as you add, remove, or adjust provider times.",
    category: "Bookings",
  },
  {
    question: "How does the cost estimate work in Bulk Booking?",
    answer:
      "The Dynamic Cost Calculator automatically estimates your total event cost based on each provider's pricing model. For hourly services, it multiplies the rate by the duration. For fixed-price services, it shows the flat fee. Package-based services display the package price. Services requiring custom quotes are flagged separately. The estimate updates in real-time as you add or remove providers.",
    category: "Bookings",
  },
  {
    question: "Can I save a bulk booking as a draft?",
    answer:
      "Yes! Click 'Save Draft' at any point during your bulk booking planning. Your event details, selected providers, and time slots are all saved to your account. You can name your drafts for easy identification. When you return to the Bulk Booking page, your saved drafts appear at the top — click 'Load' to resume where you left off, or 'Delete' to remove drafts you no longer need.",
    category: "Bookings",
  },
  {
    question: "What is the Monthly Planner?",
    answer:
      "The Monthly Planner is a visual calendar-based scheduling tool. Go to My Bookings and click 'Monthly Planner'. You'll see a full month grid — click any date to add a provider or event. Search and select providers, see planned events as colored markers, navigate between months, and confirm all bookings at once. It's perfect for anyone who plans by thinking 'which dates need coverage' rather than 'which providers do I need.'",
    category: "Bookings",
  },
  {
    question: "How do I re-book a provider I've used before?",
    answer:
      "On your My Bookings page, completed and past bookings show a 'Re-book' button. Click it to jump straight into a new booking with the same provider and service pre-selected — just pick a new date and time. No need to search for them again.",
    category: "Bookings",
  },
  {
    question: "Can I change the duration of an existing booking?",
    answer:
      "Yes! For pending or confirmed hourly bookings, you can edit the duration from the Booking Detail page. Click 'Edit Duration', adjust your start and end times, and the system recalculates the total cost in real-time. This is useful if your event runs longer or shorter than originally planned.",
    category: "Bookings",
  },
  {
    question: "What location types are available for services?",
    answer:
      "OlogyCrew supports seven location types: Mobile (provider comes to you), At My Location/Public Venue (you go to the provider), Virtual (online session), Flexible (either party can host), Microsoft Teams, Zoom, and Other. The location type determines whether you need to provide an address during booking. Virtual, Teams, and Zoom bookings don't require a physical address.",
    category: "General",
  },
  {
    question: "How do notifications work?",
    answer:
      "You'll receive real-time in-app notifications (shown in the bell icon in the navigation bar) for booking updates, new messages, and quote responses. Click any notification to mark it as read and navigate to the relevant page. Use the 'Clear All' button in the notification dropdown to dismiss all notifications at once. You also receive email notifications. Customize your notification preferences in Settings.",
    category: "General",
  },
  {
    question: "Do providers set their own prices?",
    answer:
      "Yes, providers have full control over their pricing. They can set fixed prices, hourly rates, or custom pricing for each service. Some providers also offer deposits or payment plans for larger bookings.",
    category: "Payments",
  },
  {
    question: "How do I switch between customer and provider mode?",
    answer:
      "If you're a provider, you'll see a toggle switch in the navigation bar that lets you flip between Provider view and Customer view. Provider view shows your dashboard, received bookings, and business tools. Customer view shows the regular browsing experience and your made bookings. The platform also auto-switches based on where you navigate.",
    category: "General",
  },
  {
    question: "I signed up as a customer but want to be a provider — how do I switch?",
    answer:
      "Go to your Profile page and you'll see a \"Become a Provider\" card. Click \"Get Started\" to begin the provider onboarding wizard. Once complete, you'll have access to both customer and provider features from the same account — no need to create a new one.",
    category: "Providers",
  },
  {
    question: "Can I book services as a provider?",
    answer:
      "Absolutely! OlogyCrew is built around the \"Work, Live, Play\" concept — providers are people too. Use the view switcher in the navigation bar to switch to Customer view, and you can browse, book, and review services just like any other customer. Your bookings as a customer are kept separate from the bookings you receive as a provider.",
    category: "Providers",
  },
  {
    question: "What is the profile completion indicator?",
    answer:
      "Your Profile page shows a progress bar and checklist highlighting which fields still need attention (name, email, phone number, profile photo). Once all fields are filled in, the indicator disappears. A complete profile helps providers communicate with you and improves your overall experience.",
    category: "General",
  },
  {
    question: "What are provider standing and evidence-review badges?",
    answer:
      "Provider standing is automatically calculated from profile completeness and OlogyCrew activity. The labels are New (0–19), Building History (20–49), Established (50–79), and Top Activity (80–100). Standing is not credential verification. Evidence-review badges are separate: OlogyCrew displays a specific identity, business registration, professional license, insurance, or background-check label only after that evidence is approved and current. Uploading a document alone does not earn a badge.",
    category: "Providers",
  },
  {
    question: "What is the 14-day Pro trial?",
    answer:
      "New providers can try the Pro tier free for 14 days — no credit card required. You get access to all Pro features including up to 5 service categories, up to 10 services, 3 photos per service, custom URL slug, and priority search placement. Start your trial during onboarding or from the Subscription Management page. You'll receive email reminders at 7, 3, and 1 day before expiry. If you don't upgrade, your account reverts to the free Starter tier (1 category, 3 services).",
    category: "Providers",
  },
  {
    question: "Can I save money with annual billing?",
    answer:
      "Yes! Both provider and customer subscriptions offer annual billing at a discount. Pro saves 16% ($10.08/mo billed annually at $120.96/year instead of $12/mo). Business saves 20% ($16.00/mo billed annually at $192.00/year instead of $20/mo). Use the Monthly/Annual toggle on the pricing or subscription page to compare and switch.",
    category: "Payments",
  },
  {
    question: "What happens when I reach my service or photo limit?",
    answer:
      "Each subscription tier has limits on how many categories, services, and photos you can add. When you reach your limit, you'll see an upgrade prompt showing what each tier offers. Your existing content is never deleted — you just can't add new ones beyond your tier's limit until you upgrade. Starter allows 1 category, 3 services (1 photo each). Pro allows 5 categories, 10 services (3 photos each). Business offers unlimited categories and services (5 photos each).",
    category: "Providers",
  },
  {
    question: "How does search ranking work?",
    answer:
      "Provider standing reflects profile completeness and activity on OlogyCrew; it is not credential verification. Search placement can also reflect the visibility benefits of a provider's current plan. Check the public Pricing page for current plan benefits. A paid plan does not guarantee a specific position in every search result.",
    category: "Providers",
  },
  {
    question: "How do I join a waitlist for a full group class?",
    answer:
      "When a group class time slot is completely full, you'll see a 'Notify Me' button instead of the regular booking button. Tap it to join the waitlist for that specific date and time. You'll be automatically notified when a spot opens up due to a cancellation. Visit the My Waitlist page from the navigation menu to see all your waitlist entries and their status.",
    category: "Bookings",
  },
  {
    question: "How will I be notified when a waitlist spot opens?",
    answer:
      "When someone cancels their booking for a group class you're on the waitlist for, you'll receive both an in-app notification (bell icon) and an email letting you know a spot is available. Act quickly — spots are first-come, first-served once they open up. Your My Waitlist page will also update to show 'Spot Available' status for that entry.",
    category: "Bookings",
  },
  {
    question: "How do I see who's on my waitlist? (Providers)",
    answer:
      "Go to My Dashboard and look for the Waitlist section. You'll see all customers waiting for your group classes, organized by service and date. Each entry shows the customer's name, their position in line, the date/time they're waiting for, and their current status. When a booking is cancelled, the system automatically notifies the next person in line.",
    category: "Providers",
  },
];

// ─── FAQ Accordion Item ───────────────────────────────────────────────────────

function FAQAccordionItem({ item }: { item: FAQItem }) {
  return (
    <details className="ology-help-faq-item">
      <summary>
        <span className="font-medium pr-4">{item.question}</span>
        <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
      </summary>
      <div className="ology-help-answer whitespace-pre-line">{item.answer}</div>
    </details>
  );
}

// Featured resources point into the same articles used by the collection browser.
const featuredResources = [
  { sectionId: "for-customers", title: "How Bookings Work", label: "FOR CUSTOMERS", icon: <Calendar aria-hidden="true" /> },
  { sectionId: "for-providers", title: "Provider Onboarding", label: "FOR PROVIDERS", icon: <Briefcase aria-hidden="true" /> },
  { sectionId: "payments", title: "How Payments Work", label: "PAYMENTS & BILLING", icon: <CreditCard aria-hidden="true" /> },
] as const;

type ResourceArticle = GuideSection["articles"][number];
type ResourceMatch = { section: GuideSection; article: ResourceArticle };

function ResourceReader({ match }: { match: ResourceMatch | null }) {
  return <div className="ology-help-reader" aria-live="polite">
    {match ? <article aria-labelledby="help-active-article-title">
      <span className="ology-help-eyebrow">{match.section.title} / Guide</span>
      <h3 id="help-active-article-title">{match.article.title}</h3>
      <p className="ology-help-reader-content whitespace-pre-line">{match.article.content}</p>
      {match.article.link && <Link href={match.article.link} className="ology-help-inline-link">
        {match.article.linkText} <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>}
    </article> : <div className="ology-help-reader-empty">
      <BookOpen className="h-8 w-8" aria-hidden="true" />
      <h3>Choose a guide to read</h3>
      <p>Select a resource from the list. Its full instructions will open here without taking you away from the library.</p>
    </div>}
  </div>;
}

// ─── Quick Links ──────────────────────────────────────────────────────────────

const quickLinks = [
  { icon: <Calendar className="h-5 w-5" />, label: "My Bookings", href: "/my-bookings" },
  { icon: <MessageSquare className="h-5 w-5" />, label: "Messages", href: "/messages" },
  { icon: <Heart className="h-5 w-5" />, label: "Saved Providers", href: "/saved-providers" },
  { icon: <FileText className="h-5 w-5" />, label: "My Quotes", href: "/my-quotes" },
  { icon: <Star className="h-5 w-5" />, label: "Browse Services", href: "/browse" },
  { icon: <Bell className="h-5 w-5" />, label: "Notifications", href: "/notification-settings" },
];

// ─── Main Component ───────────────────────────────────────────────────────────

// ─── Contact Form Component ──────────────────────────────────────────────────

function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<string>("general");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [refId, setRefId] = useState<number | null>(null);

  const submitMutation = trpc.contact.submit.useMutation({
    onSuccess: (data) => {
      setSubmitted(true);
      setRefId(data.id);
      toast.success("Message sent! We'll get back to you soon.");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to send message. Please try again.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }
    submitMutation.mutate({
      name: name.trim(),
      email: email.trim(),
      subject: subject.trim(),
      category: category as "general" | "booking" | "payment" | "provider" | "technical" | "other",
      message: message.trim(),
    });
  };

  const handleReset = () => {
    setName("");
    setEmail("");
    setSubject("");
    setCategory("general");
    setMessage("");
    setSubmitted(false);
    setRefId(null);
  };

  if (submitted) {
    return (
      <Card className="ology-help-contact-form">
        <CardContent className="py-8 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-[#e8eecd] flex items-center justify-center mb-4">
            <CheckCircle2 className="h-8 w-8 text-[#123332]" />
          </div>
          <h3 className="text-xl font-semibold text-[#123332] mb-2">We received your message.</h3>
          <p className="mb-1">
            Thank you for reaching out. Please keep your reference number for follow-up.
          </p>
          {refId && (
            <p className="text-sm font-bold text-[#123332] mb-4">Reference #: {refId}</p>
          )}
          <Button variant="outline" onClick={handleReset} className="ology-help-reset gap-2 mt-4">
            <Send className="h-4 w-4" />
            Send Another Message
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="ology-help-contact-form">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5 text-primary" />
          Send Us a Message
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Fill out the form below and we'll get back to you as soon as possible. All fields marked with * are required.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact-name">Your Name *</Label>
              <Input
                id="contact-name"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-email">Email Address *</Label>
              <Input
                id="contact-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={320}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact-subject">Subject *</Label>
              <Input
                id="contact-subject"
                placeholder="How can we help?"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                maxLength={500}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-category">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="contact-category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General Inquiry</SelectItem>
                  <SelectItem value="booking">Booking Issue</SelectItem>
                  <SelectItem value="payment">Payment & Billing</SelectItem>
                  <SelectItem value="provider">Provider Support</SelectItem>
                  <SelectItem value="technical">Technical Issue</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-message">Message *</Label>
            <Textarea
              id="contact-message"
              placeholder="Please describe your issue or question in detail. Include any relevant booking numbers, dates, or screenshots if applicable."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              minLength={10}
              maxLength={5000}
              rows={5}
              className="resize-y"
            />
            <p className="text-xs text-muted-foreground text-right">
              {message.length}/5000 characters
            </p>
          </div>

          <Button
            type="submit"
            disabled={submitMutation.isPending}
            className="ology-help-submit w-full sm:w-auto gap-2"
          >
            {submitMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send Message
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function HelpCenter() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [activeSectionId, setActiveSectionId] = useState("getting-started");
  const [activeArticleTitle, setActiveArticleTitle] = useState<string | null>(null);
  const [showAllFAQ, setShowAllFAQ] = useState(false);
  const { isAuthenticated } = useAuth();

  const { data: platformContactInfo } = trpc.platformSettings.getAll.useQuery();
  const contactPhone = platformContactInfo?.contact_phone || "(678) 525-0891";
  const contactEmail = platformContactInfo?.contact_email || "info@ologycrew.com";
  const businessHours = platformContactInfo?.business_hours || "Mon-Fri 9:00 AM - 6:00 PM EST";
  const contactAddress = platformContactInfo?.contact_address || "";

  const filteredFAQ = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return faqItems.filter((item) =>
      (activeCategory === "all" || item.category === activeCategory) &&
      (!query || item.question.toLowerCase().includes(query) || item.answer.toLowerCase().includes(query))
    );
  }, [searchQuery, activeCategory]);

  const filteredSections = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return guideSections;
    return guideSections.map((section) => ({
      ...section,
      articles: section.articles.filter((article) =>
        article.title.toLowerCase().includes(query) || article.content.toLowerCase().includes(query)
      ),
    })).filter((section) => section.articles.length > 0);
  }, [searchQuery]);
  const searching = Boolean(searchQuery.trim());
  const guideCount = filteredSections.reduce((count, section) => count + section.articles.length, 0);
  const shownFAQ = searching || activeCategory !== "all" || showAllFAQ ? filteredFAQ : filteredFAQ.slice(0, 8);
  const faqCategories = ["all", "General", "Bookings", "Providers", "Payments"];
  const activeSection = guideSections.find((section) => section.id === activeSectionId) ?? guideSections[0];
  const selectedResource: ResourceMatch | null = searching
    ? filteredSections.flatMap((section) => section.articles.map((article) => ({ section, article })))
        .find((match) => match.section.id === activeSectionId && match.article.title === activeArticleTitle) ?? null
    : activeSection.articles.map((article) => ({ section: activeSection, article }))
        .find((match) => match.article.title === activeArticleTitle) ?? null;

  const selectCollection = (id: string) => {
    setSearchQuery("");
    setActiveSectionId(id);
    setActiveArticleTitle(null);
    window.history.replaceState(null, "", `#${id}`);
    requestAnimationFrame(() => document.getElementById("resource-library")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    }));
  };

  const openResource = (sectionId: string, articleTitle: string) => {
    setSearchQuery("");
    setActiveSectionId(sectionId);
    setActiveArticleTitle(articleTitle);
    window.history.replaceState(null, "", `#${sectionId}`);
    requestAnimationFrame(() => document.getElementById("help-resource-reader")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    }));
  };

  useEffect(() => {
    const oldTitle = document.title;
    document.title = "OlogyCrew Help & Resources — Find the Right Guide";
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const createdCanonical = !canonical;
    const oldCanonical = canonical?.href;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = `${OLOGYCREW_PUBLIC_ORIGIN}/help`;
    return () => {
      document.title = oldTitle;
      if (createdCanonical) canonical?.remove();
      else if (canonical && oldCanonical) canonical.href = oldCanonical;
    };
  }, []);

  useEffect(() => {
    const scrollToHash = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      if (guideSections.some((section) => section.id === hash)) {
        setActiveSectionId(hash);
        setActiveArticleTitle(null);
      }
      if (hash === "contact" || hash === "faq" || guideSections.some((section) => section.id === hash)) {
        requestAnimationFrame(() => document.getElementById(hash === "contact" || hash === "faq" ? hash : "resource-library")?.scrollIntoView({ behavior: "auto", block: "start" }));
      }
    };
    scrollToHash();
    window.addEventListener("hashchange", scrollToHash);
    return () => window.removeEventListener("hashchange", scrollToHash);
  }, []);

  return (
    <>
      <NavHeader />
      <main className="ology-help">
        <section className="ology-help-hero" aria-labelledby="help-title">
          <picture className="ology-help-hero-photo" aria-hidden="true">
            <source media="(max-width: 600px)" srcSet="/manus-storage/ology-help-people-mobile_40581fc7.webp" />
            <img src="/manus-storage/ology-help-people-desktop_4322e033.webp" alt="" width="2400" height="1029" loading="eager" fetchPriority="high" />
          </picture>
          <div className="ology-help-shell ology-help-hero-content">
              <span className="ology-help-eyebrow"><BookOpen className="h-4 w-4" aria-hidden="true" /> OlogyCrew Help &amp; Resources</span>
              <h1 id="help-title">Find the right <em>resource.</em></h1>
              <p className="ology-help-hero-copy">Practical guides for finding a service, managing bookings, and growing your business. Explore a collection or search the library.</p>
              <div className="ology-help-search">
                <label htmlFor="help-search" className="sr-only">Search help guides and common questions</label>
                <Search className="ology-help-search-icon" aria-hidden="true" />
                <input id="help-search" type="search" autoComplete="off" placeholder="Search help resources" value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setActiveArticleTitle(null); }} />
                {searchQuery && <button type="button" className="ology-help-search-clear" aria-label="Clear help search" onClick={() => setSearchQuery("")}>Clear</button>}
              </div>
              <p className="ology-help-hero-tip">Not sure where to start? Try “booking,” “provider,” or “payment”.</p>
              <a href="#contact" className="ology-help-hero-support">Need a person? Contact support <ArrowRight className="h-4 w-4" aria-hidden="true" /></a>
          </div>
        </section>

        <div className="ology-help-shell ology-help-body">
          {!searching && <section className="ology-help-section" aria-labelledby="help-paths-title">
            <div className="ology-help-section-heading">
              <span className="ology-help-eyebrow">Featured resources</span>
              <h2 id="help-paths-title">A good place to begin.</h2>
              <p>Start with one of these guides, then explore the full library below.</p>
            </div>
            <div className="ology-help-featured-grid">
              {featuredResources.map((resource, index) => <button type="button" key={resource.title}
                className={`ology-help-featured-card ology-help-featured-card-${index + 1}`}
                onClick={() => openResource(resource.sectionId, resource.title)}>
                <span className="ology-help-featured-icon">{resource.icon}</span>
                <span className="ology-help-featured-label">{resource.label} · GUIDE</span>
                <strong>{resource.title}</strong>
                <span className="ology-help-featured-action">Read guide <ArrowRight className="h-4 w-4" aria-hidden="true" /></span>
              </button>)}
            </div>
          </section>}

          {searching && <div className="ology-help-section-heading" aria-live="polite">
            <h2>Search results</h2>
            <p>{guideCount} {guideCount === 1 ? "guide" : "guides"} and {filteredFAQ.length} {filteredFAQ.length === 1 ? "question" : "questions"} for “{searchQuery.trim()}”.</p>
          </div>}
          {searching && filteredSections.length === 0 && filteredFAQ.length === 0 &&
            <div className="ology-help-empty" role="status">
              <HelpCircle className="h-8 w-8 mx-auto mb-3" aria-hidden="true" />
              <h3>No matching answers yet</h3>
              <p>Try a different search or send us a message below.</p>
              <button type="button" className="ology-help-more" onClick={() => { setSearchQuery(""); setActiveCategory("all"); }}>Clear search</button>
            </div>}

          {(!searching || filteredSections.length > 0) && <section id="resource-library" className="ology-help-section" aria-labelledby="help-guides-title">
            <div className="ology-help-section-heading">
              <span className="ology-help-eyebrow">The resource library</span>
              <h2 id="help-guides-title">{searching ? "Guides matching your search" : "Browse by topic."}</h2>
              <p>{searching ? "Choose a result to read it here." : "Choose a collection, then select a guide to open the full answer. All collections are free to browse."}</p>
            </div>
            {!searching && <div className="ology-help-collection-grid" role="group" aria-label="Resource collections">
              {guideSections.map((section) => <button type="button" key={section.id} className="ology-help-collection-card"
                aria-pressed={activeSectionId === section.id} onClick={() => selectCollection(section.id)}>
                <span className="ology-help-collection-icon">{section.icon}</span>
                <strong>{section.title}</strong>
                <span>{section.description}</span>
                <small>{section.articles.length} {section.articles.length === 1 ? "guide" : "guides"} <ArrowRight className="h-4 w-4" aria-hidden="true" /></small>
              </button>)}
            </div>}
            <div className="ology-help-library-grid" id="help-resource-reader">
              <div className="ology-help-resource-index">
                <div className="ology-help-resource-index-heading">
                  <span className="ology-help-eyebrow">{searching ? "Search results" : "Selected collection"}</span>
                  <h3>{searching ? `${guideCount} ${guideCount === 1 ? "guide" : "guides"}` : activeSection.title}</h3>
                  {!searching && <p>{activeSection.description}</p>}
                </div>
                {(searching ? filteredSections.flatMap((section) => section.articles.map((article) => ({ section, article })))
                  : activeSection.articles.map((article) => ({ section: activeSection, article }))).map(({ section, article }) =>
                  <button type="button" key={`${section.id}-${article.title}`} className="ology-help-resource-item"
                    aria-pressed={selectedResource?.article.title === article.title && selectedResource?.section.id === section.id}
                    onClick={() => {
                      setActiveArticleTitle(article.title);
                      setActiveSectionId(section.id);
                      if (window.matchMedia("(max-width: 760px)").matches) {
                        requestAnimationFrame(() => document.getElementById("help-resource-reader")?.scrollIntoView({
                          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
                          block: "start",
                        }));
                      }
                    }}>
                    <span>{article.title}<small>{searching ? section.title : "Guide"}</small></span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>)}
              </div>
              <ResourceReader match={selectedResource} />
            </div>
            {!searching && <nav className="ology-help-quick" aria-label="Popular help shortcuts">
              <span className="ology-help-quick-label">Go to a tool</span>
              {quickLinks.map((link) => <Link key={link.label} href={link.href} className="ology-help-quick-link">
                {link.icon}<span>{link.label}</span>
              </Link>)}
              {!isAuthenticated && <span className="text-sm" style={{ color: "var(--ology-brand-muted)" }}>Account pages require sign-in.</span>}
            </nav>}
          </section>}

          {(!searching || filteredFAQ.length > 0) && <section id="faq" className="ology-help-section" aria-labelledby="help-faq-title" style={{ scrollMarginTop: 94 }}>
            <div className="ology-help-section-heading">
              <span className="ology-help-eyebrow">Common questions</span>
              <h2 id="help-faq-title">Quick answers.</h2>
              <p>Looking for a short answer? Choose a topic or open a question below.</p>
            </div>
            <div className="ology-help-filter-row" aria-label="Filter frequently asked questions">
              {faqCategories.map((cat) => <button key={cat} type="button" className="ology-help-filter"
                aria-pressed={activeCategory === cat} onClick={() => { setActiveCategory(cat); setShowAllFAQ(false); }}>
                {cat === "all" ? "All topics" : cat}
              </button>)}
            </div>
            {shownFAQ.length > 0 ? <div className="ology-help-faq-list">
              {shownFAQ.map((item) => <FAQAccordionItem key={item.question} item={item} />)}
            </div> : <div className="ology-help-empty" role="status">No questions match this topic and search. Try another filter.</div>}
            {!searching && activeCategory === "all" && filteredFAQ.length > shownFAQ.length &&
              <button type="button" className="ology-help-more" onClick={() => setShowAllFAQ(true)}>
                Show all {filteredFAQ.length} questions <ArrowRight className="h-4 w-4 inline ml-1" aria-hidden="true" />
              </button>}
          </section>}

          <section id="contact" className="ology-help-section" aria-labelledby="help-contact-title" style={{ scrollMarginTop: 94 }}>
            <div className="ology-help-section-heading">
              <span className="ology-help-eyebrow">Talk to us</span>
              <h2 id="help-contact-title">Still need a hand?</h2>
              <p>Tell us what's happening. The contact form works whether or not you're signed in.</p>
            </div>
            <div className="ology-help-contact-grid">
              <ContactForm />
              <div className="ology-help-contact-card">
                <div><Phone className="h-5 w-5 mb-3" aria-hidden="true" /><h3>Call us</h3><p>{businessHours}</p><a href={`tel:${contactPhone.replace(/[^+\d]/g, "")}`}>{contactPhone}</a></div>
                <div><MessageSquare className="h-5 w-5 mb-3" aria-hidden="true" /><h3>Email support</h3><p>Prefer email? Write to our support address.</p><a href={`mailto:${contactEmail}`}>{contactEmail}</a></div>
                {contactAddress && <div><MapPin className="h-5 w-5 mb-3" aria-hidden="true" /><h3>Our location</h3><p>{contactAddress}</p></div>}
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
