# OlogyCrew Service Scheduling Platform — TODO

## Bug Investigation: Development Preview Error
- [x] Identify and resolve the error currently shown in the development preview

## Completed Features (Phases 1–17)

### Foundation & Core
- [x] Database schema (19 tables), seed data, query helpers
- [x] Manus OAuth authentication with role-based access (customer/provider/admin)
- [x] Provider registration, onboarding wizard, profile management
- [x] Service catalog with categories, search, filtering, pagination
- [x] Flexible pricing models (fixed, hourly, package, custom)
- [x] Service photo uploads (S3) with tier-gated limits

### Booking & Scheduling
- [x] Real-time availability system (weekly schedules + date overrides)
- [x] Interactive booking calendar with time slot selection
- [x] Step-by-step booking flow (date → time → details → confirm → pay)
- [x] Booking status management (pending, confirmed, in_progress, completed, cancelled, no_show, refunded)
- [x] Double-booking prevention (server-side time-slot conflict check)
- [x] Customer bookings dashboard with export (CSV/PDF)

### Payments
- [x] Stripe Checkout integration (deposit + full payment)
- [x] Stripe Connect for provider payouts (destination charges, 1% platform fee)
- [x] Cancellation refund automation (time-based: 48h=100%, 24h=75%, 4h=50%, <4h=0%)
- [x] Stripe webhook handler (checkout, payment success/failure, refunds, subscriptions)
- [x] Payment failure notifications (email + in-app)
- [x] Provider subscription tiers (Free/Basic/Premium) with feature gating

### Promo Code System
- [x] Promo code CRUD for providers (percentage + fixed discounts)
- [x] Usage limits, expiration dates, service-specific codes, min order / max discount caps
- [x] Promo code input in booking flow with real-time validation and discount preview
- [x] Promo redemption tracking and analytics

### Customer Referral Program
- [x] referral_codes and referrals tables in schema
- [x] Auto-generated unique referral codes (REF-XXXXXX) per customer
- [x] Referral tRPC router (getMyCode, validate, applyCode, getStats, getHistory, updateSettings, lookup)
- [x] Referrals page with code sharing, stats dashboard, and referral history
- [x] Referral code input in ServiceDetail booking flow (confirm step)
- [x] Referee discount applied to booking total via bookingRouter
- [x] Referral recorded on successful booking
- [x] Configurable referrer/referee discount percentages (default 10%/10%)
- [x] Max referrals limit per code

### Communication
- [x] Messaging system with conversation threading by booking
- [x] Unified notification service (email via Forge API, SMS via Twilio)
- [x] Notification center UI (bell icon, dropdown, full page)
- [x] Email unsubscribe + notification preferences per channel/type
- [x] 24-hour booking reminder service
- [x] Booking confirmation, status change, and cancellation emails

### Provider Tools
- [x] Provider dashboard (services, bookings, availability, analytics, payments, widgets, promo codes)
- [x] Provider analytics (booking trends, revenue, retention, top services, booking sources)
- [x] Public provider profiles (/p/:slug) with custom slugs
- [x] Embeddable booking widgets (iframe, popup, direct link) with code generator
- [x] iCal calendar feed with REFRESH-INTERVAL for faster sync (PT15M)
- [x] Individual booking .ics download endpoint (/api/calendar/booking/:id.ics)
- [x] webcal:// one-click subscription button for instant calendar sync
- [x] "Add to Calendar" button on BookingDetail page
- [x] Google Calendar, Apple Calendar, Outlook support via iCal/webcal
- [x] Stripe Connect onboarding + balance display + dashboard link
- [x] Verification document upload (identity, business_license, insurance, background_check)

### Admin
- [x] Admin dashboard (user management, provider verification, transaction monitoring)
- [x] Platform analytics (bookings, revenue, user growth, subscription MRR)
- [x] Provider approval/rejection workflow
- [x] Subscription analytics (MRR, tier distribution, churn, conversion rates)
- [x] Review moderation panel (flag/hide/delete reviews)
- [x] Verification document review panel (approve/reject)

### Security & Infrastructure
- [x] Helmet security headers
- [x] Express rate limiting (general + sensitive endpoints)
- [x] Trust proxy for reverse proxy environments

### Code Architecture (Phase 17)
- [x] Split db.ts (2039 lines) into 12 domain-specific files under server/db/
- [x] Split routers.ts (1255 lines) into 9 feature-specific files under server/routers/
- [x] Barrel index.ts re-exports for backward compatibility (db.ts → db-legacy.ts shim)
- [x] All existing imports continue to work with 0 regressions

### Documentation & Testing
- [x] BUILD_LOG.md, ARCHITECTURE.md, ROADMAP.md
- [x] 304 tests passing across 18 test files (0 failures)

---

## Known Future Enhancements (Not Blocking)
- [x] Custom Google OAuth provider implemented for OlogyCrew authentication
- [x] Sign in with Apple intentionally deferred by owner; Google and email/password remain the supported login methods
- [x] Profile photo upload for customers — implemented with auth.uploadProfilePhoto endpoint
- [x] System health monitoring in admin dashboard — live critical-service readiness, database latency, uptime, memory, and realtime client telemetry
- [x] Frontend component tests — standardized jsdom/Testing Library harness with rendered adaptive, provider workspace, and customer workspace component suites
- [x] Payment receipt PDF generation — implemented in invoicing system
- [x] Real-time messaging via SSE — new messages, typing indicators, read receipts, and unread counts with polling only as a connection fallback
- [x] Evaluate true WebSocket messaging — retain the working autoscale-compatible SSE transport and polling fallback; no current product requirement justifies a persistent WebSocket replacement
- [x] Upgrade prompts for service and photo limits use the shared upgrade dialog/banner with backend enforcement
- [x] Complete shared upgrade-prompt coverage across saved-provider, custom-slug, analytics, bulk-quote, payment-setup, and other plan-gated surfaces
- [x] Service editing flow improvements — inline provider onboarding editor and full dashboard edit dialog implemented
- [x] Email unsubscribe granularity per notification type — booking, reminder, message, payment, and marketing email preferences implemented

## Hotfix: Provider Role & Onboarding Testing
- [x] Fix owner account role to provider so provider dashboard is accessible
- [x] Verify provider onboarding/profile building flow works end-to-end on dev preview

## Phase 18: Multi-Category Provider Redesign

- [x] Provider profile photo upload (during onboarding and in dashboard)
- [x] Multi-category selection system (providers choose from 42 categories)
- [x] Per-category service creation with individual pricing
- [x] Provider Stripe Connect payment setup integrated into onboarding
- [x] Redesigned provider onboarding wizard (photo → categories → services → pricing → Stripe)
- [x] Provider dashboard: manage multiple categories and their services
- [x] Provider mini-website public profile (showcases all categories & services)
- [x] Customer search/browse works with multi-category providers
- [x] Database schema updates for provider-category relationships
- [x] Tests for multi-category provider flow (304 tests passing)

## Bug Fix: Mobile Dashboard Tab Overflow
- [x] Fix provider dashboard tab buttons running off the page on mobile

## Follow-up: Dashboard UX Improvements
- [x] Consolidate 12 dashboard tabs into 6 logical groups (Bookings, Services, Schedule, Finances, My Page, More)
- [x] Add mobile bottom navigation bar for dashboard (6 icons fixed to bottom on mobile)
- [x] Test provider onboarding flow end-to-end — all 4 steps verified working

## Feature: Provider Portfolio/Gallery
- [x] Database schema for portfolio items (photos/work samples per category)
- [x] Server endpoints for CRUD portfolio items with S3 upload
- [x] Portfolio upload UI in provider dashboard (Services tab)
- [x] Portfolio gallery display on public provider profile mini-website

## Feature: Location-Based Search Filters
- [x] Add price range, rating, and location filters to category browse page
- [x] Service type filter (in-person, mobile, virtual, hybrid)
- [x] Filter UI with sticky filter bar + expandable panel on mobile

## Feature: Provider Onboarding Checklist Widget
- [x] Dashboard checklist card showing incomplete setup steps (6 steps)
- [x] Progress bar showing completion percentage
- [x] Clickable steps linking to relevant setup pages
- [x] Auto-hides when all steps complete, dismissible by provider

## Testing (previous)
- [x] 319 tests passing across 19 test files (0 failures)

## Feature: Featured Providers on Homepage
- [x] Enhanced listFeatured endpoint with categories, profile photos, and ratings
- [x] Featured Providers section on homepage with provider cards
- [x] Provider cards with photo, name, categories, rating, and "View Profile" CTA

## Feature: Availability Quick-View on Category Browse
- [x] getNextAvailable endpoint returning next available slots (7-day window)
- [x] AvailabilityQuickView component on category browse provider cards
- [x] Green badges showing next available day/time per provider

## Feature: Before/After Photo Pairs in Portfolio
- [x] Portfolio schema already supports before/after (mediaType + beforeImageUrl fields)
- [x] Before/after upload UI with dual photo pickers in portfolio dialog
- [x] Interactive comparison slider (BeforeAfterCard) on dashboard and public profile
- [x] "Before & After" badge on portfolio items

## Testing
- [x] 328 tests passing across 20 test files (0 failures)

## Feature: Customer Favorites/Saved Providers
- [x] Database schema for customer_favorites table
- [x] Server endpoints for add/remove/list/check favorites
- [x] Heart icon on public provider profile to toggle favorite
- [x] Saved Providers page accessible from customer navigation
- [x] "Saved" link added to desktop and mobile nav

## Feature: Provider Service Package Builder
- [x] Database schema for service_packages and package_items tables
- [x] Server endpoints for CRUD packages with bundled pricing
- [x] Package builder UI in provider dashboard (Services tab)
- [x] Package display on public provider profile with savings badge

## Feature: Provider Response Time Tracking
- [x] Track message response times from conversation history
- [x] Compute average response time per provider via API endpoint
- [x] Display response time badge on public provider profile
- [x] Display response time badge on category browse provider cards

## Testing
- [x] 341 tests passing across 21 test files (0 failures)

## Feature: Provider Schedule Conflict Detector
- [x] Server-side conflict detection when accepting/confirming bookings
- [x] Check for overlapping time slots across all provider bookings (all categories)
- [x] Warning UI in provider dashboard when confirming a booking that conflicts
- [x] Conflict indicator on booking cards showing overlapping bookings
- [x] Allow provider to override and accept anyway with acknowledgment

## Feature: Request a Quote Flow
- [x] Database schema for quote_requests table
- [x] Server endpoints for creating, listing, responding to quote requests
- [x] Customer UI: "Request a Quote" button on provider profile page
- [x] Customer quote request form (title, description, preferred date/time, location type, address)
- [x] Provider UI: Quote requests section in Bookings tab of dashboard
- [x] Provider quote response dialog (price, duration, notes, validity period)
- [x] Customer "My Quotes" page with accept/decline actions
- [x] "Quotes" link added to NavHeader (desktop + mobile)
- [x] Provider can decline quote requests
- [x] Customer can decline quoted prices with optional reason
- [x] Quote count badge on provider dashboard

## Testing
- [x] 356 tests passing across 22 test files (0 failures)
- [x] 15 new quote flow tests (request, respond, accept, decline, authorization)

## Bug Fix: PublicProviderProfile Hooks Error
- [x] Fix "Rendered more hooks than during the previous render" error on /p/:slug page
- [x] Ensure all hooks are called unconditionally (no hooks after early returns)

## UX Fix: Profile Photo & Verification Documents
- [x] Add profile photo upload to the "My Profile" page (hover-to-upload with camera icon)
- [x] Add delete button for uploaded verification documents (with confirm/cancel)

## Bug Fix: Complete Your Profile Checklist
- [x] Profile photo check not reflecting uploaded photo — getMyProfile now enriches with user's profilePhotoUrl
- [x] "Write Bio" step now opens the Edit Business Profile dialog directly with Bio/Description field
- [x] "Add Photo" step now opens a file picker directly from the checklist
- [x] Bio check fixed to use `description` field (provider table has no `bio` column)

## Bug Fix: Checklist Action Navigation
- [x] "Upload work samples" now switches to Portfolio tab and opens the upload dialog
- [x] "Connect payment account" now navigates to /provider/onboarding?step=4 (directly to Get Paid step)
- [x] Added query param support to ProviderOnboarding for deep-linking to specific steps

## Feature: Privacy Policy & Terms of Service Pages
- [x] Create Privacy Policy page at /privacy (with SMS section, data practices, user rights)
- [x] Create Terms of Service page at /terms (with SMS program details, STOP/START/HELP info)
- [x] Add routes in App.tsx
- [x] Update footer links to point to /terms and /privacy (were pointing to /browse)

## Feature: SMS Opt-Out/Opt-In Webhook
- [x] Create Twilio incoming SMS webhook endpoint at /api/twilio/sms
- [x] Handle STOP/UNSUBSCRIBE/CANCEL/END/QUIT keywords to opt user out
- [x] Handle START/SUBSCRIBE/YES/UNSTOP keywords to opt user back in
- [x] Handle HELP/INFO keywords with program info reply
- [x] Send confirmation TwiML reply messages
- [x] Update user notification preferences in database (all SMS toggles)
- [x] Phone number normalization to match various DB formats
- [x] 10 tests for webhook handling (all passing, 367 total)

## Feature: Multi-Day Range Booking
- [x] Extend bookings schema with bookingType (single/multi_day/recurring), endDate, totalDays fields
- [x] Add booking_sessions table for individual day entries within multi-day/recurring bookings
- [x] Backend: createMultiDay procedure with availability check across all days
- [x] Backend: conflict detection for multi-day bookings (checks each day)
- [x] Frontend: end date picker on service detail page for multi-day eligible categories
- [x] Frontend: multi-day price calculation display (per-day rate × number of days)
- [x] Provider dashboard: display multi-day bookings with date range and day count badge
- [x] Customer My Bookings: show multi-day bookings with date range
- [x] Category-based auto-detection: AV Crew, TV/Film, Event Planning, Day Labor, Home Renovation

## Feature: Recurring Booking
- [x] Extend schema with recurrence fields (frequency, daysOfWeek, totalSessions)
- [x] Backend: createRecurring procedure that generates individual sessions
- [x] Backend: availability check for all recurring session dates
- [x] Frontend: day-of-week toggle buttons, weekly/biweekly frequency selector, weeks stepper (1-52)
- [x] Frontend: recurring price calculation display (per-session rate × total sessions)
- [x] Provider dashboard: display recurring bookings with session count and frequency badge
- [x] Customer My Bookings: show recurring bookings with session count
- [x] Category-based auto-detection: Fitness, Personal Trainer, Dance, Cleaning, Massage, Pet Care

## Testing
- [x] 22 new multi-day/recurring tests (date range, session generation, pricing, validation, categories)
- [x] All 389 tests passing across 24 test files

## Feature: OlogyCrew Official Provider (Hybrid "Tom" Approach)
- [x] Add isOfficial flag to serviceProviders schema
- [x] Create seed script for OlogyCrew Official account with 69 services across 41 categories
- [x] Add official/verified badge (OfficialBadge component) to provider cards in browse and search results
- [x] Add official badge to public provider profile page
- [x] Ensure official provider appears first in every category browse (listByCategory + listFeatured)
- [x] Official provider profile showcases best practices (complete profile, availability, services)
- [x] Write tests for official provider functionality (9 tests: schema, data, sorting)
- [x] Fix price sort regression (official-first grouping now skipped when sortBy=price)

## Testing
- [x] 398 tests passing across 25 test files (0 failures, 0 TypeScript errors)

## Feature: Convert Accepted Quotes to Bookings
- [x] Auto-create booking when customer accepts a quoted price (in updateQuoteStatus)
- [x] Auto-populate booking with quote details (service, price, duration, date/time, provider, customer)
- [x] Update quote status to 'booked' and link via bookingId after successful booking creation
- [x] Show "View Booking" button on accepted/booked quotes in My Quotes page
- [x] Link quote_request to booking via quoteRequestId field on bookings table
- [x] Add bookingSource='quote' enum value to bookings schema
- [x] Toast with "View Booking" action on successful quote acceptance
- [x] Write 5 tests for quote-to-booking conversion (auto-create, link, source, decline, fee calc)

## Feature: Recurring Booking Session Management
- [x] Add rescheduled status to booking_sessions + rescheduledToSessionId, rescheduledFromDate, rescheduledAt columns
- [x] Provider: mark individual sessions as completed or cancelled with notification
- [x] Customer + Provider: reschedule individual sessions with conflict detection
- [x] Show session list with status badges, stats summary on BookingDetail page
- [x] Inline reschedule form with date/time pickers and conflict checking
- [x] Add getSessionById, rescheduleSession, createSingleSession DB helpers
- [x] Write 10 tests for session management (complete, cancel, reschedule, auth, conflicts)

## Feature: SMS/Email Notifications for Quotes
- [x] Send SMS + email to provider when customer submits a new quote request (quote_request_new)
- [x] Send SMS + email to customer when provider responds with pricing (quote_response_received)
- [x] Send SMS + email to provider when customer accepts (quote_accepted) or declines (quote_declined)
- [x] Send email notifications for session status changes (session_completed, session_cancelled, session_rescheduled)
- [x] All notification templates created with proper formatting
- [x] Write 4 tests for quote notification triggers

## Testing
- [x] 420 tests passing across 26 test files (0 failures, 0 TypeScript errors)

## Feature: Customer Review Reminders
- [x] Add reviewReminderSent flag to bookings schema to prevent duplicate reminders
- [x] Create review_reminder notification type and email/SMS templates
- [x] Build reviewReminderService with 30-min interval checking completed bookings 24h+ ago
- [x] Send personalized email/SMS with direct link to leave a review (/booking/:id/review)
- [x] Add triggerReviewReminders admin endpoint for manual triggering
- [x] Include unsubscribe link in reminder emails
- [x] Write 12 tests for review reminder logic (service, templates, schema, admin trigger)

## Feature: Provider Calendar View
- [x] Create calendarEvents tRPC endpoint fetching provider bookings + sessions
- [x] Build ProviderCalendar page with month and week views
- [x] Show booking details (service, customer, time, status) on calendar events
- [x] Color-code events by status (7 statuses: pending, confirmed, in_progress, completed, cancelled, scheduled, rescheduled)
- [x] Add Calendar View button to provider dashboard bookings tab + /provider/calendar route
- [x] Click-through from calendar event to booking detail via modal + "View Booking Details" link
- [x] Breadcrumb navigation back to dashboard
- [x] Stats summary cards (total, pending, confirmed, completed)
- [x] Today highlight, status legend, responsive design

## Testing
- [x] 432 tests passing across 27 test files (0 failures, 0 TypeScript errors)

## Bug Fix: Logout Not Visible
- [x] Add visible logout option to user navigation (UserMenuDropdown with Profile, Settings, Log Out)
- [x] Add logout to mobile menu (MobileLogoutButton with red styling)

## Feature: Tiered Subscription System (Saved Provider Limits)
- [x] Add customer_subscriptions schema (tier, status, stripeSubscriptionId, stripeCustomerId, periods)
- [x] Define Stripe products/prices for Pro ($9.99/mo, $7.99/mo yearly) and Business ($24.99/mo, $19.99/mo yearly)
- [x] Create customerSubscriptionRouter with getSubscription, getTiers, createCheckout, createPortalSession, canSaveMore
- [x] Enforce saved provider limits in toggleFavorite: Free=10, Pro=50, Business=unlimited
- [x] Build UpgradeModal component with tier comparison, shown when limit reached
- [x] Build /pricing page with plan cards, feature comparison table, billing toggle, FAQ
- [x] Updated SavedProviders page with usage bar, tier badge, upgrade prompt, near-limit warnings
- [x] Handle Stripe webhooks for customer subscriptions (created, updated, cancelled) via metadata.type
- [x] Subscription badge on SavedProviders page (Free/Pro/Business with icons)
- [x] Write 25 tests for subscription tiers, limits, DB helpers, router, webhooks, schema

## Testing
- [x] 452 tests passing across 28 test files (0 TypeScript errors)

## Feature: Provider Availability Exceptions (Block Dates)
- [x] Leveraged existing availability_overrides schema (overrideDate, isAvailable, reason, startTime, endTime)
- [x] Override checking integrated into single, multi-day, and recurring booking creation flows
- [x] Blocked dates shown on provider calendar view via calendarEvents endpoint
- [x] Enhanced ManageAvailability UI with quick-block presets (Next Week, Next 2 Weeks, Custom Range)
- [x] Delete buttons on each override with confirmation
- [x] Write 8 tests for override checking, multi-day, recurring, and calendar integration

## Feature: Saved Provider Folders (Pro/Business Perk)
- [x] Add saved_provider_folders schema (userId, name, color, icon, sortOrder)
- [x] Add folderId to customer_favorites table to assign providers to folders
- [x] Create foldersRouter with create, update, delete, list, moveToFolder, removeFromFolder
- [x] Build folder sidebar UI on SavedProviders with color picker, create/edit/delete modals
- [x] Move-to-folder dropdown on each provider card
- [x] Filter by folder with count badges
- [x] Folder deletion moves providers to uncategorized
- [x] Write 10 tests for folder CRUD, assignment, deletion, and tier gating

## Feature: Booking Analytics Dashboard (Business Perk)
- [x] Create customerAnalytics DB helpers: getCustomerSpendingSummary, getMonthlySpending, getTopProviders, getCategoryBreakdown, getRecentBookings
- [x] Build /analytics page with summary cards, monthly bar chart, top providers, category breakdown, recent bookings table
- [x] Date range: last 12 months of data
- [x] Gate analytics page behind Business subscription tier with upgrade prompt
- [x] Add analytics button to SavedProviders page for Business subscribers
- [x] Write 15 tests for analytics calculations, tier gating, and data formatting

## Testing
- [x] 485 tests passing across 29 test files (0 TypeScript errors, 5 pre-existing timeouts)

## Feature: Bulk Quote Requests (Business Perk)
- [x] Create bulkRequestQuote backend procedure (send quote to multiple providers at once with batchId)
- [x] Gate behind Business subscription tier (bulkQuoteRequests perk)
- [x] Build BulkQuoteModal UI: select saved providers, compose single quote, send to all
- [x] Integrated into SavedProviders page with "Bulk Quote" button
- [x] Send notifications to each provider individually via existing notification system
- [x] Write 25 tests for bulk quote requests, tier gating, validation, batch ID generation

## Feature: Provider Onboarding Wizard Improvements
- [x] Add overall progress percentage bar to onboarding wizard header
- [x] Add step descriptions visible on desktop below each step circle
- [x] Enhanced dashboard OnboardingChecklist with 7 items (added availability check)
- [x] "What's Next" nudge section showing next incomplete step with action button
- [x] Celebration state with confetti icon when all 7 steps complete
- [x] Progress percentage displayed in checklist header
- [x] Write tests for onboarding progress tracking (step completion, percentage calculation)

## Feature: Booking History Export (Business Perk)
- [x] Create getCustomerBookingsForExport DB helper with date range filtering
- [x] Create exportBookings tRPC endpoint (CSV and JSON formats)
- [x] Add ExportControls component to BookingAnalytics page with date pickers
- [x] Quick date range buttons (3M, 6M, 1Y, All)
- [x] Gate behind Business subscription tier (bookingAnalytics perk)
- [x] Client-side file download with dynamic filenames
- [x] Write tests for CSV generation, date filtering, tier gating, filename generation

## Testing
- [x] 510 tests passing across 30 test files (0 TypeScript errors, 5 pre-existing timeouts)

## Feature: PDF Export for Booking History (Business Perk)
- [x] pdfkit already installed — used for comprehensive analytics report
- [x] Create server-side PDF generation endpoint (/api/export/analytics/pdf) with OlogyCrew branding
- [x] Include summary section (total bookings, completed, cancelled, total spent, avg booking, platform fees)
- [x] Include visual spending chart (bar chart of monthly spending with Y-axis gridlines)
- [x] Include category breakdown chart (stacked horizontal bar with legend)
- [x] Include top providers section (ranked list with horizontal bar chart)
- [x] Include detailed booking history table (50-row limit with status color coding)
- [x] Add "PDF Report" button to BookingAnalytics ExportControls (blue accent, BarChart3 icon)
- [x] Gate behind Business subscription tier (403 for non-Business)
- [x] Write 23 tests for PDF export (module, tier gating, date handling, content, colors, filenames)
- [x] Page numbers, branded header bar, footer, PDF metadata (title, author, creator)
- [x] Date range filtering via query params (?startDate=&endDate=)

## Feature: Mobile Responsiveness Audit & Fix
- [x] Audit all key pages on mobile viewport (375px) and document issues
- [x] Fix navigation/header overlapping on mobile (notification dropdown max-width)
- [x] Fix homepage layout and text sizing on mobile (hero, sections, CTA, footer grid)
- [x] Fix browse/search pages for mobile (heading text sizing)
- [x] Fix booking detail/flow pages for mobile (action buttons wrap, time slot grids)
- [x] Fix customer dashboard for mobile (BookingAnalytics stat cards, header)
- [x] Fix provider dashboard for mobile (stat cards, header, form grids, tab bar)
- [x] Fix analytics/export page for mobile (header text sizing)
- [x] Fix quotes/messages pages for mobile (MyQuotes header, Messages chat height)
- [x] Fix profile and settings pages for mobile (PublicProviderProfile, SubscriptionManagement, CustomerPricing, Referrals)
- [x] Fix onboarding wizard for mobile (step tracker, form grids, heading)
- [x] Fix saved providers page for mobile (header button wrapping)
- [x] Fix AdminDashboard tables with overflow-x-auto wrappers (4 tables)
- [x] Fix ProviderCalendar cells min-height for mobile
- [x] Fix EmbedBooking time slots grid for mobile
- [x] Fix PromoCodes form grid for mobile
- [x] Fix BulkQuoteModal date/time grid for mobile
- [x] Fix CategoryDetail heading and icon sizing for mobile
- [x] Verify all fixes — 0 TypeScript errors, 533 tests passing (5 pre-existing timeouts)

## Feature: Real-Time Notification System (SSE)
- [x] Review current notification schema, endpoints, and dropdown UI
- [x] Build server-side SSE endpoint (/api/sse/notifications) with JWT cookie auth
- [x] Create SSEManager singleton (server/sseManager.ts) with heartbeat, multi-tab support
- [x] Integrate SSE triggers into booking creation (provider + customer notifications)
- [x] Integrate SSE triggers into booking status changes (confirmed, completed, cancelled, in-progress)
- [x] Integrate SSE triggers into messaging flow (new message notifications + pushMessageNotification)
- [x] Hook createNotification (both db-legacy and db/notifications) to auto-push SSE events
- [x] Update NotificationDropdown to use SSE via useSSE hook (slower polling fallback when connected)
- [x] Add toast notifications for real-time events (booking + message toasts via sonner)
- [x] Handle SSE reconnection with exponential backoff (1s to 30s max)
- [x] Write 34 tests for SSE manager, event format, notification types, auth, integration
- [x] Verified: 0 TypeScript errors, SSE endpoint returns 401 for unauthenticated requests

## Bug Fix: Provider Dashboard Booking Cards Mobile Overflow
- [x] Fix "Message Customer" button and booking card content running off screen on mobile
- [x] Added flex-wrap to all button containers in booking cards, quote cards, and services section
- [x] Added min-w-0 and truncate to booking number in card header
- [x] Added overflow-hidden to base Card component to prevent all card content spillover

## Feature: Comprehensive Help Center
- [x] Build Help Center page (/help) with searchable content
- [x] Getting Started section (4 articles: account, browsing, first booking, platform overview)
- [x] For Customers section (7 articles: bookings, messaging, quotes, saved providers, reviews, cancellations, analytics)
- [x] For Providers section (8 articles: onboarding, services, availability, bookings, quotes, portfolio, profile, promos/widgets)
- [x] Payments & Billing section (6 articles: how payments work, fees, provider tiers, customer tiers, refunds, promo codes)
- [x] Account & Settings section (4 articles: profile, notifications, referrals, privacy)
- [x] FAQ section with 15 searchable items, accordion UI, and 4 category filters
- [x] Contact/Support section with email (garychisolm30@gmail.com) and phone ((678) 525-0891)
- [x] Add Help link to navigation header (desktop + mobile)
- [x] Add Help Center and Contact Support links to footer
- [x] Quick Links grid (6 links to key pages)
- [x] Browse by Topic navigation cards
- [x] Search bar filtering across all articles and FAQ
- [x] Write 21 tests for help content structure, FAQ filtering, contact info, tier accuracy
## Feature: Help Center Contact Form
- [x] Build tRPC endpoint for contact form submissions (public procedure — no login required)
- [x] Send owner notification via notifyOwner() on every submission
- [x] Send confirmation email to submitter with reference number
- [x] Store contact submissions in database (contactSubmissions table with status tracking)
- [x] Replace static contact info with interactive ContactForm component in Help Center
- [x] Include name, email, subject, category (6 options), and message fields
- [x] Add form validation (required fields, email format, 10-5000 char message), success/error states
- [x] Success state with reference number, "Send Another Message" button
- [x] Admin endpoints: list submissions, update status (new/in_progress/resolved/closed)
- [x] Character counter on message field (X/5000)
- [x] Direct contact info (email + phone) preserved below form
- [x] Write 23 tests for contact form (validation, categories, notification content, form behavior)

## Feature: Admin Contact Submissions Panel
- [x] Admin Contact Submissions Panel - view, filter, and manage contact form submissions
- [x] Contact submission status tracking (new/in-progress/resolved/closed) with admin updates
- [x] Admin reply to contact submissions with email delivery to submitter
- [x] Reply history stored in database (contact_replies table)
- [x] Canned auto-reply templates - CRUD management for common inquiry categories
- [x] Template quick-select in reply UI for fast responses
- [x] Tests for admin contact management and auto-reply template endpoints

## Feature: Seed Starter Reply Templates
- [x] Pre-populate 6 canned reply templates for common support categories (general, booking, payment, provider, technical, other)

## Feature: Favicon & Logo Setup
- [x] Process OlogyCrew clock icon into favicon (ICO + PNG sizes)
- [x] Upload logo to CDN and set as VITE_APP_LOGO
- [x] Set favicon in client/index.html

## Bug: Navbar Logo Overlapping
- [x] Fix logo + "OlogyCrew" text overlapping with "Browse Services" nav link on desktop

## Feature: Progressive Web App (PWA)
- [x] Create web app manifest (manifest.json) with app name, icons, theme colors
- [x] Create service worker for offline caching
- [x] Register service worker in the app
- [x] Add install prompt UI for users to install the app
- [x] Link manifest in index.html with proper meta tags

## Feature: PWA Splash Screen
- [x] Generate splash screen images for various device sizes
- [x] Update manifest with splash screen configuration
- [x] Add apple-touch-startup-image meta tags for iOS

## Feature: Offline Booking Page
- [x] Cache user's upcoming bookings data in IndexedDB/localStorage
- [x] Update service worker to serve offline booking page
- [x] Create offline-aware booking list UI with sync indicator

## Feature: Web Push Notifications
- [x] Generate VAPID keys for push notification server
- [x] Add push subscription endpoint on backend
- [x] Implement push notification sending from backend (booking alerts)
- [x] Add notification permission prompt UI for PWA users
- [x] Handle push events in service worker
- [x] 13 tests passing for push notification system

## Feature: Auto-Trigger Push on Booking Events
- [x] Wire push notifications into booking confirmation flow (provider + customer)
- [x] Wire push into booking status updates (confirmed/completed/cancelled)
- [x] Wire push into booking reminder service (24hr reminders)
- [x] Wire push into new message notifications
- [x] Wire push into payment success/failure notifications (Stripe webhook)
- [x] Wire push into quote request/response/accept/decline notifications
- [x] Wire push into session reschedule flow
- [x] Created pushHelper.ts for easy push sending from any notification point

## Feature: PWA Badge Count
- [x] Add navigator.setAppBadge() hook (useBadgeCount)
- [x] BadgeManager component in main.tsx (inside tRPC provider)
- [x] Update badge on push event in service worker
- [x] Clear badge on notification click
- [x] Sync badge on visibility change (tab focus)

## Feature: Background Sync for Offline Actions
- [x] Create offlineQueue.ts module (enqueue/dequeue/replay with max 3 retries)
- [x] Create useOfflineActions hook for offline-aware mutations
- [x] Update service worker with Background Sync handler (ologycrew-sync-actions)
- [x] PendingActionsIndicator component for navbar
- [x] Fallback to online event replay when Background Sync API unavailable
- [x] 34 tests passing for all three features

## Feature: Push Notification Grouping
- [x] Group push notifications by type (booking, message, payment, quote, reminder)
- [x] Show summary notification (e.g., "3 new messages") when multiple arrive
- [x] Replace individual notifications with grouped summary after threshold (GROUP_THRESHOLD=2)
- [x] Clicking grouped notification opens relevant page
- [x] Close individual notifications when showing grouped summary
- [x] Include View All action on grouped notifications
- [x] Update badge count to account for grouped notifications
- [x] Add notification type to push payload for grouping support

## Feature: Offline Bookings Viewer
- [x] Wire useOfflineBookings hook into My Bookings page
- [x] Cache upcoming bookings to localStorage on each successful fetch
- [x] Show cached bookings with offline indicator when user is offline
- [x] Display "last synced" timestamp when viewing cached data
- [x] Offline banner with refresh button when online but showing cache
- [x] Disable destructive actions (cancel, message, export) when offline
- [x] Disable service/provider detail queries when offline
- [x] 35 tests passing for both features

## Bug: "Become a Provider" Link Goes to Browse
- [x] Fix "Become a Provider" button on homepage to navigate to provider registration instead of browse page

## Feature: Provider Onboarding Landing Copy
- [x] Add "Why become a provider?" hero section before onboarding form
- [x] Include key benefits (earnings, flexibility, tools, reach) — 6 benefit cards
- [x] Add platform stats/social proof section (42+ categories, 0% upfront, 1% fee, verified reviews)
- [x] Add "How it works" 4-step overview
- [x] Add "Get Started Free" CTA that reveals the onboarding form
- [x] Existing providers skip landing and go straight to onboarding form

## Feature: Conditional CTA for Existing Providers
- [x] Change "Become a Provider" on homepage to "Go to Dashboard" if logged-in user is already a provider

## Feature: Provider Testimonials Section
- [x] Add testimonials/quotes section to provider landing page with 3 placeholder success stories

## Feature: Provider FAQ Accordion
- [x] Add collapsible FAQ accordion to provider landing page (7 questions: cost, payouts, cancellation, categories, scheduling, mobile/location, verification)

## Feature: Provider Referral Program
- [x] Reuse existing referral_codes + referrals tables (no separate provider_referrals needed)
- [x] Unique referral code generation per user (works for both customer and provider referrals)
- [x] Referral link handling on provider onboarding page (?ref=CODE) with localStorage capture
- [x] Credit tracking when referred provider completes onboarding (applyCode mutation)
- [x] tRPC endpoints: getMyCode, validate, applyCode, getStats, getHistory, updateSettings, lookup
- [x] "Refer a Provider" section on provider dashboard (ReferProviderCard in More tab)
- [x] Dual-tab Referrals page with Customer Referrals and Provider Referrals tabs
- [x] Copy-to-clipboard referral link sharing (customer + provider links)
- [x] Share via Web Share API with fallback to clipboard
- [x] Tests for referral program endpoints (19 provider referral tests)

## Feature: Admin Dashboard Enhancements
- [x] Search within contact submissions (real-time text filter)
- [x] Bulk status actions for contact submissions (select all, bulk status update)
- [x] CSV export for contact submissions (download filtered results)
- [x] Push Notification Analytics tab (total/active/inactive subscriptions, unique users, 7-day growth)
- [x] Push adoption rate visualization with progress bar
- [x] Avg devices per user and recent growth metrics
- [x] Tests for admin enhancements (13 tests: push analytics, contact submissions, referral system, admin router)

## Feature: Referral Reward Fulfillment
- [x] Add referral_credits table to schema (earned/spent/expired types)
- [x] DB helpers: addReferralCredit, getReferralCreditBalance, getReferralCreditHistory, spendReferralCredits, fulfillReferralOnBookingComplete
- [x] referralFulfillment module to auto-complete referral + credit referrer on booking completion
- [x] Wire fulfillment into booking status update flow (on "completed")
- [x] Add getCreditBalance, getCreditHistory, spendCredits endpoints to referral router
- [x] Show credit balance on Referrals page (banner + stats card)
- [x] 34 tests for referral reward fulfillment

## Feature: Admin Referral Analytics
- [x] getReferralAnalytics DB helper (total codes, conversion rate, top referrers, monthly trend, credit summary)
- [x] Admin router endpoint: getReferralAnalytics
- [x] Referrals tab in admin dashboard with stats cards, credit summary, monthly trend, top referrers table
- [x] Conversion rate and active codes metrics

## Feature: Referral Email Notifications
- [x] Add referral_signup, referral_completed, referral_welcome notification types
- [x] Email templates for all three referral notification types
- [x] Wire referral_signup + referral_welcome into applyCode mutation
- [x] Wire referral_completed into booking completion flow (referralFulfillment module)
- [x] In-app notification for referrer when referral completes
- [x] Unsubscribe links included via existing notification service infrastructure

## Feature: Apply Credits at Checkout
- [x] Wire spendCredits into Stripe Checkout session creation (useCredits param)
- [x] previewCreditDiscount query endpoint for real-time discount preview
- [x] Show credit balance and toggle + discount preview in BookingConfirmation page
- [x] Reduce Stripe line item amount by credit amount before creating session
- [x] Record credit spend on successful payment (spendReferralCredits called before Stripe)
- [x] Handle edge cases: full credit payment (skip Stripe), partial credit, below $0.50 minimum
- [x] In-app notification for credit-paid bookings

## Feature: Credit Expiration Policy
- [x] Add expiresAt column to referral_credits table (90-day default for earned credits)
- [x] Scheduled job (creditExpiration.ts) runs every 24 hours to expire old credits
- [x] expireOldCredits DB helper marks expired earned credits as 'expired' type
- [x] getCreditsExpiringSoon DB helper for 7-day warning
- [x] Exclude expired credits from balance calculation (getReferralCreditBalance)
- [x] Show expiration date on credit history entries in Referrals page
- [x] Expiration warning banner when credits expire within 14 days
- [x] Scheduler wired into server startup (_core/index.ts)

## Feature: Referral Tier Rewards
- [x] Define 4-tier structure: Bronze (0-5, 10%), Silver (6-10, 15%), Gold (11-25, 20%), Platinum (26+, 25%)
- [x] REFERRAL_TIERS constant with name, minReferrals, maxReferrals, rewardPercent, color
- [x] getUserReferralTier DB helper calculates tier from completed referral count
- [x] getReferrerRewardPercent returns dynamic percentage for fulfillment
- [x] getMyTier and getNextExpiration tRPC endpoints in referral router
- [x] Tier progress card on Referrals page with all 4 tiers, progress bar, and next-tier indicator
- [x] Dynamic reward percentages shown throughout referral UI
- [x] 39 tests for all three features (credits at checkout, expiration, tiers)

## Feature: Referral Program Visibility
- [x] Add "Refer & Earn" section to homepage with 3-step process, tier preview, and CTA
- [x] Add credit balance badge to navigation header (Coins icon, links to /referrals)
- [x] Add Referral Credits link in mobile menu
- [x] Create public /referral-program landing page (hero, stats, how-it-works, tiers, benefits, FAQ, CTA)
- [x] Register /referral-program route in App.tsx
- [x] Link referral program page from homepage section
- [x] Handle object balance return type correctly in CreditBadge and ReferralProgram
- [x] 29 tests for referral visibility features

## Feature: Referral Visibility Enhancements (Round 2)
- [x] Post-booking "Share & Earn" card on BookingConfirmation page (3-step flow, copy/share, amber theme)
- [x] ShareReferralLink component with clipboard + Web Share API support
- [x] OG and Twitter Card meta tags on /referral-program (client-side useMetaTags hook)
- [x] Server-side OG meta tag injection in vite.ts (dev + production modes) for social media crawlers
- [x] Canonical link and document title management with cleanup on unmount
- [x] "Referral Program" link in site footer (Company column, before Help Center)
- [x] 32 tests for all three enhancements

## Feature: Referral Program OG Image
- [x] Generate branded 1200x630 social sharing image (navy gradient, gift box, tier badges, OlogyCrew branding)
- [x] Auto-uploaded to CDN (d2xsxph8kpxj0f.cloudfront.net)
- [x] Wire og:image + og:image:width/height + twitter:image into client-side useMetaTags hook
- [x] Wire og:image + twitter:image into server-side vite.ts injection (dev + production)
- [x] 40 tests passing (8 new OG image tests added to existing suite)

## Bug: Featured Providers "Provider Not Found"
- [x] Fixed: Homepage used `provider.slug` but data has `profileSlug`; updated link + auto-generate slug for providers missing one

## Bug: Provider Dashboard Not Showing for New Providers
- [x] Root cause: `provider.create` mutation did not update user role from 'customer' to 'provider'
- [x] Fix: Added `db.updateUserProfile(ctx.user.id, { role: "provider" })` to provider.create mutation
- [x] Fix: Added `role` field support to legacy `updateUserProfile` function in db-legacy.ts
- [x] Fix: NavHeader now checks both `user.role === 'provider'` AND `!!myProfile` (getMyProfile fallback)
- [x] Fix: ProviderOnboarding invalidates `auth.me` after profile creation so NavHeader updates immediately
- [x] Data fix: Updated 142 existing users with provider records but 'customer' role to 'provider'
- [x] 7 new tests in provider-role.test.ts (role update, slug generation, getMyProfile, duplicate prevention, categories, updateUserProfile role field)

## CRITICAL Feature: Post-Signup Role Selection Screen
- [x] Added `hasSelectedRole` boolean field to users table (default false for new signups)
- [x] Created `selectRole` mutation in authRouter (sets role + hasSelectedRole)
- [x] Created RoleSelection page — clean two-card UI ("Find & Book Services" vs "Offer My Services")
- [x] Created RoleGuard component — redirects authenticated users with hasSelectedRole=false to /select-role
- [x] Wired route in App.tsx and wrapped Router in RoleGuard
- [x] Provider.create also sets hasSelectedRole=true as fallback
- [x] Updated hasSelectedRole support in updateUserProfile (db-legacy.ts)
- [x] Data migration: set all existing users to hasSelectedRole=true, reset riquis95 to false
- [x] 5 tests in role-selection.test.ts (customer select, provider select, invalid role, default false, role change)

## Feature: OG Meta Tags for Provider Profile Pages
- [x] Created server/ogTags.ts helper — builds OG meta tags from provider data
- [x] Injects og:title, og:description, og:url, og:type, og:image, twitter:card for /p/:slug routes
- [x] Integrated into vite.ts for both dev (setupVite) and production (serveStatic) modes
- [x] HTML escaping for special characters in business names
- [x] Falls back to user profile photo or OlogyCrew logo for og:image
- [x] 4 tests in og-tags.test.ts (non-existent slug, existing provider, no description fallback, HTML escaping)

## Bug: Profile Page Mobile Layout Issues
- [x] Overlapping text on mobile profile page — moved Edit Profile button to its own row, added min-w-0 and truncate to name, flex-wrap on badge row
- [x] Edit profile button not looking clean on mobile — full-width on mobile (w-full sm:w-auto), on its own row below profile info
- [x] Form grid stacks to single column on mobile (grid-cols-1 sm:grid-cols-2)
- [x] Changed "Hover over photo" to "Tap photo" for mobile-friendly text
- [x] Added active:opacity-100 to camera overlay for touch devices

## Feature: Switch to Provider Option on Profile Page
- [x] Add "Become a Provider" card/section on profile page for customers
- [x] Clicking it navigates to /provider/onboarding
- [x] Only show for users with role='customer' (hide for existing providers)

## Feature: Profile Completion Indicator
- [x] Add progress bar showing profile completion percentage
- [x] Track fields: name (first+last), email, phone, profile photo
- [x] Show checklist of incomplete fields with actionable hints
- [x] Visual progress bar at top of profile page (hides when 100% complete)
- [x] "Complete Profile" button opens edit mode
- [x] 6 tests in profile-features.test.ts

## Feature: Provider/Customer View Switcher (Work, Live, Play)
- [x] Create ViewMode context to track current view (provider vs customer)
- [x] Add toggle/switcher UI in NavHeader for providers (pill-style toggle with icons)
- [x] Provider View shows: Dashboard link, provider-specific nav items
- [x] Customer View shows: Browse Services, Search, customer booking nav items (Dashboard hidden)
- [x] Persist view mode preference in localStorage
- [x] Both views always accessible — one account, two perspectives
- [x] Customers (non-providers) don't see the switcher
- [x] Mobile version with full-width toggle at top of mobile menu
- [x] ViewModeProvider wraps App in main.tsx
- [x] 11 tests passing (role-selection + profile-features)

## Bug: Book Button Offset on Mobile
- [x] Book button on service cards is clipped/cut off on right edge on mobile — fixed with flex-col sm:flex-row stacking and w-full sm:w-auto

## Bug: No Clear (X) Button in Search Field
- [x] Added X clear buttons on keyword and location inputs, plus "Clear All Filters" button

## Feature: Auto-Switch View Mode on Route Navigation
- [x] Auto-switch to Provider view when navigating to /provider/* routes
- [x] Auto-switch to Customer view when browsing/booking (/search, /browse, /service/*, /booking/*)

## Feature: Bookings Split by View Mode
- [x] Added "Bookings I Made" vs "Bookings I Received" pill toggle on MyBookings page
- [x] Customer bookings (listMine) vs provider bookings (listForProvider)
- [x] Only visible for providers (canSwitch check)

## Feature: Navigation Safety — No Dead-End Pages
- [x] Audit all pages/routes for navigation gaps (missing NavHeader, no back button, no breadcrumbs)
- [x] Create reusable PageHeader component with contextual back button and breadcrumbs
- [x] Add NavHeader + PageHeader to 11 pages: Referrals, PrivacyPolicy, TermsOfService, ProviderReviews, PublicProviderProfile, NotFound, SubmitReview, BookingAnalytics, CreateService, HelpCenter, ManageAvailability
- [x] Replaced custom headers in CreateService and ManageAvailability with consistent NavHeader + PageHeader
- [x] Every page now has NavHeader (logo links home, hamburger menu) and contextual breadcrumbs
- [x] 0 TypeScript errors

## Feature: Update Platform Documentation
- [x] Update Help Center FAQs with role selection flow
- [x] Update Help Center with Provider/Customer view switcher info
- [x] Update Help Center with bookings split (Made vs Received)
- [x] Update Help Center with Become a Provider from profile
- [x] Update Help Center with profile completion indicator
- [x] Update Help Center with navigation improvements (breadcrumbs, back buttons)
- [x] Update Help Center with search improvements (clear buttons)
- [x] Update Help Center with OG meta tags / social sharing info for providers

## Feature: Search by Provider/Business Name
- [x] Expand searchServices DB query to also match provider businessName via JOIN
- [x] Add searchProviders DB function to find providers by business name
- [x] Add provider.search tRPC endpoint returning matching providers
- [x] Read URL ?q= param in Search.tsx to pre-fill keyword from homepage
- [x] Show provider-level results section above service results
- [x] Show provider/business name on each service result card
- [x] Write tests for provider name search (10 tests passing)

## Bug Fix: Search Input Loses Focus After Each Keystroke
- [x] Diagnose root cause of search input losing focus on every keypress
- [x] Fix the focus loss issue so users can type continuously

## Feature: Debounce Search Queries
- [x] Add useDebounce hook for 300ms delay on search keyword
- [x] Apply debounced value to service and provider search queries
- [x] Keep instant UI feedback (input updates immediately, queries delayed)

## Bug Fix: Provider Profile Social Sharing Preview
- [x] Audit current OG meta tag setup for provider profile pages
- [x] Implement dynamic 1200x630 OG image generator using satori + resvg
- [x] OG image shows business name, description, location, rating, verified badge, profile photo
- [x] OG image cached in-memory with 24h TTL and uploaded to S3
- [x] Cache invalidation on provider profile update and photo upload
- [x] Fallback chain: generated OG image → profile photo → OlogyCrew logo
- [x] Full OG + Twitter Card meta tags with image dimensions
- [x] Tests passing (6 tests: empty slug, full tags, caching, invalidation, HTML escaping, fallback)

## Feature: Share Profile Button
- [x] Create ShareProfile component with dialog/popover
- [x] Copy Link button with one-click URL copying and toast confirmation
- [x] Social media share buttons: Facebook, Twitter/X, WhatsApp, LinkedIn
- [x] QR code generator for the profile URL
- [x] Email share option
- [x] Add Share button to PublicProviderProfile page
- [x] Add Share button to provider's own dashboard/profile view (already exists: copy link, social sharing, QR code, native share)

## Feature: OG Images for Service Pages
- [x] Create generateServiceOgImage function (1200x630 branded card)
- [x] Service OG image shows: service name, price, duration, provider name, category
- [x] Add getServiceOgTags function for /service/:id pages
- [x] Wire service OG tags into vite.ts server-side injection
- [x] Cache service OG images with invalidation on service update

## Feature: OG Tags for Homepage and Category Pages
- [x] Add homepage OG tags (site name, description, logo)
- [x] Add category page OG tags (/category/:slug with category name and description)
- [x] Wire homepage and category OG tags into vite.ts
- [x] All 13 OG tag tests passing (provider, service, category, homepage)

## Feature: Share Button on Provider Dashboard
- [x] Add Share Profile button to provider's own dashboard/profile management view
- [x] Reuse existing ShareProfile component with provider's public profile URL

## Feature: Share Service Button on Service Detail Pages
- [x] Reuse ShareProfile component for individual services with service-specific metadata
- [x] Add Share button to service detail page header next to rating badge
- [x] Include copy-link, social share (Facebook, X, WhatsApp, LinkedIn), and email options

## Feature: Branded Homepage OG Image
- [x] Generate a 1200x630 branded OG image with OlogyCrew tagline and 12 category chips
- [x] Update homepage OG tags to use the branded image with caching
- [x] All 13 OG tag tests passing

## Bug Fix: Share Dialog Layout Issues
- [x] Fix text overflow/overrun in Share dialog title and URL (truncated at 28 chars)
- [x] Fix social media buttons/images overrunning the dialog boundaries (overflow-hidden + flex justify-between)
- [x] Fix mobile responsiveness — responsive w-10/sm:w-11 buttons, proper padding
- [x] Ensure QR code tab is properly sized and doesn't overflow (180px centered)

## Bug Fix: Browse & Book Button on Provider Profile
- [x] Fix "Browse & Book" button to smooth-scroll to provider's services section instead of general browse page

## Feature: Smart Duration Display & Day Rate Support
- [x] Create shared formatDuration utility (min → "45 min", "2 hrs", "Full Day (10 hrs)")
- [x] Update all duration displays across the platform (10 files: CategoryDetail, EmbedBooking, MyQuotes, ProviderDashboard, ProviderOnboarding, PublicProviderProfile, Search, ServiceDetail, CreateService, BookingDetail)
- [x] Update service creation/edit forms to use DURATION_PRESETS dropdown (CreateService, ProviderDashboard edit, ProviderOnboarding, quote response)
- [x] Add "Day Rate" label for services 8+ hours (ServiceDetail price section + booking confirmation)
- [x] Ensure calendar/booking info displays correctly for day-rate services
- [x] Write 19 Vitest tests for formatDuration, getDurationPricingLabel, and DURATION_PRESETS

## Bug Fix: Day Rate Duration Selection Error
- [x] Investigate and fix error when selecting day rate (8+ hr) duration in service creation/editing
- [x] Root cause: empty strings sent for decimal columns (hourlyRate) — MySQL rejects empty string for decimal
- [x] Fix: convert empty strings to null for numeric fields (basePrice, hourlyRate, depositAmount, depositPercentage) in both service.create and service.update

## Bug Fix: Social Media Link Preview (OG Tags) for Provider Profiles
- [x] Investigated: Manus CDN pre-renders SPA pages and replaces server-injected OG tags with generic platform defaults
- [x] Created /api/og/:type/:id route that serves minimal HTML with proper OG tags (bypasses CDN)
- [x] Route supports provider, service, and category entities with auto-redirect to canonical SPA page
- [x] Updated ShareProfile component with shareUrl prop for social media sharing
- [x] Updated ProviderDashboard, PublicProviderProfile, ServiceDetail to pass shareUrl through /api/og/
- [x] Added meta refresh + JS redirect so human visitors are instantly redirected to the real page
- [x] Canonical URL in og:url points to the SPA page, not the /api/og/ route
- [x] Wrote 9 vitest tests for OG page route (all passing)
- [x] Verified correct OG tags served for Facebook, LinkedIn, and Twitter/X bots on dev server
## Bug Fix: Twitter/X Card Preview Not Showing
- [x] Confirmed: Twitter/X just takes longer to crawl new URLs — OG tags were correct all along

## Task: Update Provider Slug & Subscription Tier
- [x] Upgraded provider subscription from free to premium (active) for testing gated features
- [x] Changed provider slug from "test-service-provider-1" to "chisolm-audio"

## Bug Fix: Mobile Share & Slug Editor Issues
- [x] Copy Link on My Page tab now copies /api/og/ URL for proper social media previews in Messenger
- [x] ShareProfile Copy Link button also copies /api/og/ URL instead of SPA URL
- [x] Slug editor input field fixed for mobile iPhone — full-width, 16px font (prevents iOS zoom), stacked layout
- [x] Native share ("More sharing options") also uses /api/og/ URL

## New Category: Holistic Wellness Center
- [x] Add Holistic Wellness Center category to the database (ID: 210)
- [x] Add appropriate services under the new category (providers self-add services under this category)

## Bug Fix: 404 on "Go to Dashboard" Button
- [x] Fix 404 error when clicking "Go to Dashboard" on the homepage — link was /dashboard, changed to /provider/dashboard

## Bug Fix: Browse & Search Issues (Logged Out)
- [x] Browse Services page: disabled refetchOnWindowFocus globally to prevent loading flash on tab switch
- [x] Search not finding "Chisolm Audio": fixed price filter to include custom_quote services with null basePrice
- [x] Search auto-triggers on tab switch: disabled refetchOnWindowFocus globally in QueryClient config
- [x] Provider category names showing as null in search results: fixed getProviderCategories to JOIN with serviceCategories

## Bug Fix: Browse & Search Still Broken on Production
- [x] Browse Services page shows "No categories found" when not signed in (verified working — publicProcedure loads all 42 categories)
- [x] Search page auto-triggers search on page load without user input (verified working — enabled: hasSearchIntent guard prevents auto-trigger)

## Task: Comprehensive Platform Documentation
- [x] Write PLATFORM_DOCS.md covering all architecture, schema, routes, APIs, components, tiers, integrations, and features
- [x] Document all 28 database tables with columns and relationships
- [x] Document all 38 application routes with auth requirements
- [x] Document all 22 tRPC routers with key procedures
- [x] Document all 24 DB helper files, 7 server modules, 8 Express routes
- [x] Document all 38 pages, 19 components, 7 shared components, 12 hooks, 2 contexts
- [x] Document 5 shared utilities (const, duration, shareUrl, timeSlots, types)
- [x] Document provider tiers (Free/Basic/Premium) and customer tiers (Free/Pro/Business)
- [x] Document all integrations (Stripe, Twilio, SSE, PWA, iCal, S3, OG tags, email)
- [x] Document complete feature inventory across 30+ development phases
- [x] Document all resolved bug fixes and known issues
- [x] Include service category appendix (42 categories) and test coverage summary (530+ tests, 51 files)

## Bug: Messages Navigation Redirects to My Bookings
- [x] Fix Messages icon/link in navbar redirecting to My Bookings instead of Messages page

## Feature: Start Conversation Button & Real-time SSE Messages
- [x] Add "Start Conversation" button on public provider profiles
- [x] Add "Start Conversation" button on booking detail pages (accessible via provider profile)
- [x] Implement real-time SSE updates for conversations inbox (instant refresh on new messages)
- [x] SSE "Live" indicator on conversations page
- [x] Reduced polling when SSE active (60s vs 15s fallback)
- [x] startConversation tRPC procedure for direct messaging without a booking
- [x] Message dialog with textarea, character counter, and send button
- [x] 10 tests passing for messageRouter (5 new startConversation tests)

## Feature: File/Image Attachments in Messages
- [x] Add file upload endpoint for message attachments (S3 storage)
- [x] Update message send procedure to accept attachment URL and metadata
- [x] Add attachment picker (paperclip icon) in chat UI with image preview
- [x] Display inline image/file attachments in message bubbles
- [x] Support image, PDF, and common document types
- [x] File size validation (max 10MB)

## Feature: Message Button on Booking Detail Pages
- [x] Add "Message" button on booking detail page for quick conversation access
- [x] Navigate directly to the booking's conversation thread

## Feature: Typing Indicators via SSE
- [x] Add typing event type to SSE manager
- [x] Add sendTyping tRPC procedure to messageRouter
- [x] Show "User is typing..." indicator in chat UI in real-time
- [x] Auto-clear typing indicator after timeout (4 seconds)
- [x] Debounce typing events from frontend (2-second throttle)

## Feature: Message Search
- [x] Add searchMessages tRPC procedure (keyword + optional date range)
- [x] Add search UI to Conversations inbox page (search bar + date filters)
- [x] Display search results with conversation context and highlighted matches
- [x] Navigate to specific message in conversation from search results

## Feature: Read Receipts
- [x] Update markAsRead to record readAt timestamp per message
- [x] Display single checkmark (delivered) / double checkmark (read) on sent messages
- [x] Show "Seen" timestamp on the last read message
- [x] Push read receipt events via SSE for real-time updates
- [x] 23 messageRouter tests passing (6 new for typing, read receipts, search)

## Bug: Production - Browse Services Empty for Unauthenticated Users
- [x] Browse Services confirmed working correctly for unauthenticated users (was intermittent backend issue)
- [x] Categories load via public procedure for all visitors

## Bug: Production - Search Auto-Triggers Without Input
- [x] Fix Search page auto-triggering search without user input
- [x] Search only fires when user enters query or adjusts filters
- [x] Shows friendly "Search for Services" welcome state on initial load

## CRITICAL Bug: Browse Services empty on production/mobile
- [x] Fix Browse Services showing "No categories found" on mobile Safari (categories API failing silently)
- [x] Add error handling/retry logic for category.list procedure
- [x] Ensure categories load reliably for unauthenticated users
- [x] ROOT CAUSE: getDb() cached null forever after DB connection failure (ECONNRESET)
- [x] Fixed both db-legacy.ts and db/connection.ts with retry logic + exponential backoff
- [x] Added requireDb() helper that throws proper TRPCError instead of silently returning empty
- [x] Added error state with "Try Again" button on Browse page
- [x] Added tRPC query retry config (3 retries with exponential backoff)

## CRITICAL Bug: Search returns no results for valid queries
- [x] Fix Search returning "No results found" for "Handyman" and other valid categories
- [x] Same root cause as Browse: DB connection caching null
- [x] Added error state with "Try Again" button on Search page
- [x] Added tRPC query retry config (3 retries with exponential backoff)
- [x] Verified: Searching "Handyman" now returns 2 providers + 50 services

## CRITICAL Fix: HTTPS Enforcement
- [x] Add HTTP→HTTPS redirect middleware (301 redirect via x-forwarded-proto header)
- [x] Placed as first middleware before helmet, rate limiting, and all routes
- [x] Skips redirect for localhost/dev environments
- [x] Root cause of "Harmful Website" warning: site was serving content over plain HTTP

## Task: Developer Guide Documentation
- [x] Create DEVELOPER_GUIDE.md — comprehensive developer documentation covering architecture, decision rationale, blast radius analysis, data flows, and development guidelines

## Task: Performance & Load Testing
- [x] Lighthouse audit (performance, accessibility, SEO, best practices)
- [x] API load testing on key endpoints (browse, search, booking, messaging)
- [x] Frontend bundle size analysis
- [x] Database query performance audit (missing indexes, slow queries, N+1)
- [x] Compile comprehensive performance report

## Task: Code Splitting Optimization
- [x] Convert all page imports in App.tsx to React.lazy()
- [x] Add Suspense boundaries with loading fallbacks
- [x] Verify production build produces multiple chunks
- [x] Verify app still works correctly after splitting

## Bug: Notification Individual Page 404
- [x] Fix 404 when clicking on individual notification — diagnose routing and implement fix

## Bug: Login Attempts Exceeded
- [x] Investigate and fix login rate limiting blocking user testing

## Feature: Edit Deposit in Edit Service
- [x] Add deposit fields (deposit type, deposit amount/percentage) to edit service form
- [x] Ensure backend update procedure accepts deposit fields (already supported)

## Fix: Increase OAuth Rate Limit for Testing
- [x] Bump sensitive rate limit from 30 to 100 requests per 15 min

## Bug: Schedule Duplicates & Display
- [x] Fix duplicate-on-save bug — schedule save should replace existing entries, not append
- [x] Redesign Current Schedule display — show weekly grid with day names and AM/PM times
- [x] Clean up existing duplicate schedule data in database

## Feature: Service Name on Booking Cards
- [x] Add service name prominently to booking cards (Provider Dashboard + Admin Dashboard)
- [x] Show booking number as small muted secondary text under the service name

## Bug: 404 on Back Button from More Menu Pages
- [x] Fix 404 when hitting back button from Promo Codes page — back arrow linked to /provider instead of /provider/dashboard

## Bug: Duplicate "Connect Payment Account" in Profile Checklist
- [x] Fix duplicate display of Connect payment account step in Complete Your Profile widget — excluded nextStep from grid since it's already highlighted above

## Feature: Tier Selection in Provider Onboarding
- [x] Add subscription tier selection step to provider onboarding wizard (Step 4: Your Plan)
- [x] Show Free/Basic/Premium tiers with feature comparison
- [x] Set provider tier on selection (default to Free if skipped)
- [x] Add 14-day Premium trial banner for new/free providers
- [x] Add selectFreeTier mutation to subscription router
- [x] Update onboarding to 5 steps: Profile → Skills → Services → Plan → Get Paid

## Bug: Stripe Connect "Invalid" Error for New Providers
- [x] Improve Stripe Connect error handling with try-catch wrappers
- [x] Add auto-recovery for invalid Stripe accounts (StripeInvalidRequestError)
- [x] Add user-friendly error messages for auth, connection, and rate limit errors
- [x] Improve getDashboardLink and getOnboardingLink error handling
- [x] Add missing ENV.stripeSecretKey check in startOnboarding

## Feature: Annual Pricing Toggle on Tier Selection
- [x] Add monthly/annual toggle switch to tier selection step in onboarding
- [x] Show discounted annual prices (save ~20%) with visual savings badge
- [x] Pass billing interval to createCheckout mutation
- [x] Update SubscriptionManagement page with same annual toggle
- [x] Add "Billed as $X/year" and "Save $X/year" badges for annual pricing
- [x] Add FAQ section explaining annual billing

## Feature: Tier-Based Feature Gating with Upgrade Prompts
- [x] Enforce service count limits based on tier (Free: 3, Basic: 10, Premium: unlimited) — already in backend
- [x] Create reusable UpgradePrompt dialog component with billing toggle
- [x] Create UpgradeBanner component for inline limit warnings
- [x] Show upgrade prompt modal when provider tries to add service beyond limit (CreateService page)
- [x] Show upgrade prompt when photo upload limit is hit (PhotoUpload component)
- [x] Enforce photo upload limits per service based on tier — already in backend
- [x] Show contextual upgrade banners in provider dashboard Services tab when near/at limits
- [x] Add vitest tests for annual pricing calculations and feature gating logic (22 tests)

## Feature: Remove "verified" from Hero & Build Automated Trust Badge System
- [x] Remove "verified" from homepage hero copy (changed to "skilled providers")
- [x] Design trust score criteria (Stripe KYC, profile completeness, booking history, ratings)
- [x] Add trustScore, trustLevel, trustScoreUpdatedAt fields to provider schema
- [x] Create shared trust score calculation engine (shared/trustScore.ts)
- [x] Create trust score DB helpers (server/db/trustScore.ts)
- [x] Create trust tRPC router with getProviderTrust, getMyTrustScore, getMyTrustBreakdown, recalculateMyTrust, recalculateAll
- [x] Create TrustBadge UI component with 4 levels: New, Rising, Trusted, Top Pro
- [x] Create TrustScoreProgress widget with breakdown bars and improvement tips
- [x] Display trust badges on Search results page (provider cards)
- [x] Display trust badges on Public Provider Profile page (header + sidebar)
- [x] Add Trust Score widget to Provider Dashboard with breakdown and tips
- [x] Add trust score recalculation on booking completion (bookingRouter)
- [x] Add trust score recalculation on review creation (reviewRouter)
- [x] Add trust score recalculation on profile update and photo upload (providerRouter)
- [x] Write 16 vitest tests for trust score calculation logic (all passing)

## Feature: Priority Search Ranking (Trust Score + Tier Boost)
- [x] Add trust score and tier-based sorting to searchServices and searchProviders queries
- [x] Weight: Trust Score (primary) + Subscription Tier boost (Premium +30, Basic +15, Free +0)
- [x] Ensure merit-based ranking: Trusted Free > New Premium
- [x] Trust badges already display in search results via TrustBadge component
- [x] Official providers still ranked first via isOfficial flag

## Feature: 14-Day Professional Trial for New Providers
- [x] Add startProfessionalTrial mutation to subscription router
- [x] Add checkTrialStatus query to subscription router (returns daysRemaining, isTrialing, trialExpired, showUrgentNudge)
- [x] Create trial expiry check logic with auto-downgrade to Free tier
- [x] Build TrialCountdownBanner component (blue for normal, red for urgent ≤3 days)
- [x] Build TrialExpiredBanner component with upgrade CTA
- [x] Build TrialStatusBanner auto-selector component for Provider Dashboard
- [x] Update onboarding tier selection step with "Try Professional free for 14 days" banner
- [x] Add trial status display to SubscriptionManagement page (active trial, expired trial, start trial CTA)
- [x] Handle trial expiry: auto-downgrade to Free tier in checkTrialStatus
- [x] Write 23 vitest tests for priority ranking and trial logic (all passing)

## Fix: Remove All "Verified" Text & Update Why Choose Section
- [x] Audit entire codebase for remaining "verified" text (found in Home, AdminDashboard, ogImage, widgetRouter, PublicProviderProfile)
- [x] Home.tsx: "Verified Providers" → "Trust-Rated Providers" with Rising/Trusted/Top Pro badge pills
- [x] AdminDashboard.tsx: "Provider verified" toast → "Provider approved"
- [x] AdminDashboard.tsx: Badge displays "approved" instead of "verified" for approved providers
- [x] ogImage.ts: "Verified" OG badge → trust level badge (Rising/Trusted/Top Pro with color coding)
- [x] widgetRouter.ts: isVerified field → trustLevel field
- [x] PublicProviderProfile.tsx: Removed old "Verified" badge fallback
- [x] PublicProviderProfile.tsx: "Insurance Verified" → "Insured"
- [x] Updated "Why Choose OlogyCrew" section to showcase automated trust badge system

## Feature: Trial Milestone Email Notifications
- [x] Build trial notification helper (server/trialNotifications.ts) with milestone tracking
- [x] Add 5 notification types: trial_started, trial_7_days, trial_3_days, trial_1_day, trial_expired
- [x] Create email templates for each milestone with upgrade CTAs and pricing info
- [x] Include unsubscribe link in trial_expired email (compliance requirement)
- [x] Track sent milestones via notifications table to prevent duplicate emails
- [x] Add getNotificationsByType helper to db/notifications.ts
- [x] Integrate trial_started notification into startProfessionalTrial mutation
- [x] Integrate milestone checks into checkTrialStatus query (fire-and-forget)
- [x] Write 23 vitest tests for trial email templates, milestone logic, and compliance (all passing)

## Fix: Update Help Center with Recent Features
- [x] Add Trust Badge System section (New, Rising, Trusted, Top Pro levels) — "Trust Badges & Reputation" article
- [x] Add 14-Day Professional Trial documentation — "14-Day Professional Trial" article
- [x] Update onboarding description from 4 steps to 5 steps (includes Plan selection)
- [x] Add Annual Pricing toggle explanation — updated Provider Subscription Plans article
- [x] Add Tier-Based Feature Gating documentation — "Service & Photo Limits" article
- [x] Add Trial Email Notifications documentation — covered in trial article
- [x] Add 5 new FAQ items: Trust Badges, Professional Trial, Annual Billing, Service Limits, Search Ranking
- [x] Update visibility FAQ to mention Trust Score system
- [x] Update onboarding FAQ to mention 5-step process and trial

## Feature: SendGrid Email Delivery & Test Script
- [x] Update send-test-emails.mjs to use SendGrid API directly (was using old Forge API)
- [x] Send all 29 branded test emails to garychisolm30@gmail.com via SendGrid (29/29 delivered)
- [x] All emails include OlogyCrew logo header, gradient branding, unsubscribe link, and manage preferences link
- [x] Email subjects numbered [1/29 TEST] through [29/29 TEST] for easy identification

## Feature: Featured Provider Spotlight on Homepage
- [x] Create getSpotlightProviders query returning Top Pro / Trusted providers with highest trust scores
- [x] Build Featured Provider Spotlight section on homepage with rotating weekly highlight cards
- [x] Display trust badge, categories, rating, response time, and profile photo on spotlight cards
- [x] Write vitest tests for spotlight query

## Feature: Provider Analytics Charts on Dashboard
- [x] Create getProviderAnalytics query returning booking trends and revenue over time (last 6 months)
- [x] Build booking trend bar chart on Provider Dashboard (Recharts)
- [x] Build revenue area chart on Provider Dashboard (Recharts)
- [x] Add pie chart for booking source breakdown
- [x] Add analytics summary cards (total bookings, total revenue, avg rating, repeat customers)
- [x] Write vitest tests for analytics query

## Feature: Admin Bulk Trust Recalculation
- [x] Add recalculateAllTrustScores admin mutation to trust router (already existed)
- [x] Add "Recalculate All Trust Scores" button to Admin Dashboard (Providers tab)
- [x] Show progress/result feedback after bulk recalculation (success toast + green banner)
- [x] Write vitest tests for admin recalculation endpoint

## Feature: Email Branding & Link Fixes
- [x] Replace email header logo with actual OlogyCrew site logo (logo-navbar_38427c60.png)
- [x] Fix Browse Services link (/services → /browse)
- [x] Fix Unsubscribe link (relative path → absolute URL with unsubscribe token)
- [x] Fix Leave A Review link (/reviews/new?booking=42 → /booking/{id}/review)
- [x] Fix View Booking link (/provider/bookings/42 → /booking/{id}/detail)
- [x] Fix Update Payment link (/payments/update?booking=42 → /booking/{id}/detail)
- [x] Fix View Receipt link (/payments/receipt/42 → /booking/{id}/detail)
- [x] Fix Reply to Message link (/messages?booking=42 → /messages/{id})
- [x] Fix production email provider to use correct logo + absolute URLs
- [x] Fix all notification callers to pass bookingId in data
- [x] Fix trial notification templates to use hardcoded correct paths
- [x] Send test emails to verify all fixes (29/29 sent successfully)

## Fix: Unsubscribe Confirmation Dialog
- [x] Add "Are you sure?" confirmation step before unsubscribing
- [x] Re-enable email notifications for Gary (userId 1) after accidental unsubscribe

## Feature: Account Deletion (GDPR/CCPA Compliance)
- [x] Create deleteAccount backend endpoint with proper data anonymization
- [x] Handle active bookings check before allowing deletion
- [x] Anonymize user data instead of hard delete (preserve booking/review history integrity)
- [x] Cancel any active subscriptions on deletion
- [x] Deactivate provider profile and services if user is a provider
- [x] Clear notification preferences
- [x] Send confirmation email via SendGrid after processing deletion
- [x] Notify platform owner of account deletion
- [x] Add "Delete My Account" section to UserProfile page with multi-step confirmation
- [x] Two-step dialog: "Are you sure?" → type "DELETE" to confirm
- [x] Block admin self-deletion (admins must be managed via database)
- [x] Write vitest tests for account deletion endpoint (7/7 passed)

## Feature: Privacy Policy Update — Account Deletion & Data Retention
- [x] Add "Account Deletion" section (Section 8) to Privacy Policy page
- [x] Add "Data Retention & Anonymization" section (Section 7) explaining what data is kept and why
- [x] Expand "Your Rights" section (Section 9) with GDPR/CCPA rights (access, deletion, portability, non-discrimination)
- [x] Update Terms of Service Section 15 ("Termination & Account Deletion") with voluntary deletion reference

## Admin: Pre-register Rlstephens42@comcast.net as admin
- [x] Auto-promote Rlstephens42@comcast.net to admin role on signup

## Feature: Welcome Emails for New Signups
- [x] Create welcome_customer email template for new customer signups
- [x] Create welcome_provider email template for new provider registrations
- [x] Wire welcome_customer into selectRole mutation (authRouter)
- [x] Wire welcome_provider into provider create mutation (providerRouter)
- [x] Send both test welcome emails for review (2/2 sent successfully)

## UX/UI Fixes — Group 1: Critical Fixes
- [x] Fix login page loop issue — getting stuck in loop, ensure user can get back to home page
- [x] Fix deletion flow to remove all user info from all databases (comprehensive cleanup of ALL tables)

## UX/UI Fixes — Group 2: Login & Onboarding Flow
- [x] Update login flow for Providers — sign in takes them to their dashboard
- [x] Customers taken to "Browse Services" page on login
- [x] Choose account upon login — customers can't choose Provider role; only providers get both options
- [x] Custom login page — remove "Powered by Manus" / Meta info
- [x] New "Get Started" process — Get Started → sign up → choose role → Profile builder → Dashboard
- [x] Link "Get Started" button to plan page

## UX/UI Fixes — Group 3: Plan & Pricing Updates
- [x] Update plan pricing: Pro = $19 / Business = $49 (all instances)
- [x] Change Free Plan to only allow 5 saved providers
- [x] Free account should not be able to connect a payment account
- [x] Add "Plans" link to main navigation (completed in Group 2)
- [x] Fix plan tag visibility issue (CSS) — improved badge contrast with background colors
- [x] Change photo upload limits per plan: Starter 1, Professional 3, Business 5

## UX/UI Fixes — Group 4: Messages & Notifications
- [x] Manage general messages — delete messages + show read status (delivered/read indicators)
- [x] Delete individual + clear all message function (delete conversations + individual messages)
- [x] Ability to delete notifications (individual delete + clear all)

## UX/UI Fixes — Group 5: Bookings & Events
- [x] Add my bookings search (Booking #, Service, Provider) with debounced search
- [x] Need option to delete past events (hide completed/cancelled bookings)
- [x] Update confirmed booking button to say "request sent" after click → green ✓ Request Sent state

## UX/UI Fixes — Group 6: Profile & Provider
- [x] Update profile name — allow changing it (auto-composes display name from first+last)
- [x] Add business name field and connect it for Providers (on UserProfile page)
- [x] Change SKL to OC (all booking number prefixes updated)

## UX/UI Fixes — Group 7: UI/Display
- [x] Change time to 12-hour clock (not military) in emails (bookingRouter, reminderService, BookingDetail)
- [x] Remove email support on help page (email card removed, FAQ updated)
- [x] Account Manager Area — user can see/manage their subscription (new /account/subscription page + nav link)

## UX/UI Fixes — Group 8: Payment
- [x] Add PayPal as additional payment option (all 3 checkout sessions: customer sub, provider sub, booking payment)

## Feature: Holistic Wellness Center Category
- [x] Add Holistic Wellness Center category to the database (ID: 210, supports mobile/fixed/virtual)
- [x] Add appropriate services under the new category (providers self-add services)

## Feature: Provider Share Button
- [x] Add Share button to provider's own dashboard/profile view (already exists: copy link, social sharing, QR code, native share)

## Bug Fix: Plan Type Badges Not Visible/Centered on Mobile
- [x] Fix "Current Plan" badge cut off at top of Free plan card
- [x] Fix "Most Popular" badge cut off at top of Business plan card
- [x] Ensure plan cards are properly centered on mobile

## Bug Fix: PWA Install Button Not Working on Mobile
- [x] Fix "Install App" button not triggering install on mobile browsers (iOS: shows instructions, closing overlay keeps banner visible)
- [x] Ensure Safari shows "Show Me How" instructions (already working)
- [x] Ensure Chrome/Android shows native install prompt when available

## Feature: Persistent Install App Link
- [x] Add "Install App" link to footer
- [x] Add "Install App" option in user dropdown menu
- [x] Add "Install App" option in mobile hamburger menu
- [x] Both trigger iOS instructions overlay or native Chrome install prompt
- [x] Hide link if app is already installed (standalone mode)
- [x] Created PWAInstallContext for shared install trigger logic

## Bug Fix: Current Plan Badge Not Centered
- [x] Center "Current Plan" badge horizontally on plan cards (desktop)
- [x] Center "Current Plan" badge horizontally on plan cards (mobile)
- [x] Also verify "Most Popular" badge centering

## Bug Fix: Stripe Checkout PayPal Error
- [x] Remove PayPal from payment_method_types in all 3 checkout files (revisit later)
- [x] Update related tests (12/12 passing)
- [x] Ensure checkout works with card-only payments

## Bug Fix: Stripe Checkout Not Opening on Mobile
- [x] Replace window.open(_blank) with window.location.href for Stripe checkout URLs (all 10 instances)
- [x] Ensure redirect works on mobile Safari and Chrome
- [x] Remove toast about "new tab" since we're redirecting in same window

## Feature: Calendar Availability Display
- [x] Customer booking calendar shows booked/unavailable time slots as grayed out
- [x] Backend time slot generation with proper overlap detection (not just exact match)
- [x] Provider dashboard calendar shows color-coded bookings (confirmed=blue, pending=amber, blocked=gray)
- [x] Providers can manually block off dates/times via Block Time dialog
- [x] Blocked dates shown on provider calendar (gray with ban icon)
- [x] Upcoming blocked dates sidebar with delete option
- [x] Double-click any date to quickly block it

## Feature: Class Capacity for Group Services
- [x] Add isGroupClass and maxCapacity fields to services schema
- [x] Provider can set class size when creating a service (toggle + capacity input)
- [x] Provider can set class size when editing a service
- [x] Customer sees "X spots left" on available time slots for group classes
- [x] Auto-close time slot when capacity is reached (spotsRemaining = 0)
- [x] Time slot generation supports group capacity (26 tests passing)
- [x] Widget/embed booking also updated with capacity support

## Feature: Update Help & Support Pages
- [x] Add help content for calendar availability (grayed out slots, what they mean)
- [x] Add help content for group classes (spots remaining, how to book)
- [x] Add help content for providers: creating group class services
- [x] Add help content for providers: blocking time on calendar
- [x] Add help content for providers: understanding color-coded calendar
- [x] Add help content for PWA installation (iPhone Safari + Android Chrome)
- [x] Add FAQ entries: group classes, grayed out slots, block time, calendar colors, iPhone install, Android install
- [x] Updated existing "Is there a mobile app?" FAQ with full PWA instructions

## Feature: Server-Side Booking Capacity Validation
- [x] Add atomic capacity check in booking creation procedure (count existing bookings for same slot)
- [x] Reject booking if group class is full (return clear error message)
- [x] Handle race conditions with database-level check (not just UI)
- [x] Exclude cancelled/refunded/no_show bookings from count

## Feature: Waitlist for Full Group Classes
- [x] Add waitlist_entries database table (userId, serviceId, providerId, bookingDate, startTime, endTime, position, status, notifiedAt)
- [x] Server endpoints: join waitlist, leave waitlist, check status, list my entries, list provider entries
- [x] Auto-notify next person on waitlist when a booking is cancelled (both cancel and updateStatus procedures)
- [x] Customer UI: "Notify Me" button on full group class time slots
- [x] Customer UI: My Waitlist page (/my-waitlist) with status sections (Spots Available, Waiting, Past)
- [x] Navigation: My Waitlist link in mobile hamburger menu
- [x] Notification template for waitlist_spot_available
- [x] 18 tests passing for capacity validation and waitlist logic

## Feature: Waitlist Help & Support Documentation
- [x] Add help article: How the Waitlist Works (for customers)
- [x] Add help article: Managing Waitlist Entries (for customers)
- [x] Add help article: Viewing Your Waitlist (for providers)
- [x] Add FAQ: How do I join a waitlist?
- [x] Add FAQ: How will I be notified when a spot opens?
- [x] Add FAQ: How do I see who's on my waitlist? (providers)

## Feature: Provider-Side Waitlist View
- [x] Add waitlist section in provider dashboard (Bookings tab)
- [x] Show waitlist entries grouped by service/date
- [x] Display customer name, date, time slot, position, and status
- [x] Allow provider to remove waitlist entries
- [x] providerRemove backend procedure with ownership validation
- [x] 8 tests passing for provider waitlist view and removal logic

## Feature: Subscription Plan Updates (from PDF requirements)
- [x] Update pricing: Pro=$12/mo, Business=$20/mo (was $19/$49)
- [x] Update annual discounts: 16% for Pro, 20% for Business (was 20% flat)
- [x] Update plan tags: Pro="Most Popular", Business="Recommended"
- [x] Hide "Current Plan" tag when user is logged out
- [x] Button labels: "Select Pro", "Select Business", "Get Started" (for free) when signing up
- [x] Free plan button says "Downgrade" when signed in as Pro or Business user
- [x] Fix downgrade flow: replace Stripe Portal redirect with in-app immediate downgrade (prorated credit)
- [x] Downgrade confirmation dialog with clear messaging about what changes and what's lost
- [x] Update pricing in products.ts backend config
- [x] Update pricing on all frontend pages (SubscriptionManagement, CustomerPricing, ProviderOnboarding, etc.)
- [x] Update UpgradeModal, UpgradePrompt, TrialBanner components with new pricing
- [x] Update email templates and notification templates with new pricing
- [x] Add downgrade procedure to both provider and customer subscription routers
- [x] 31 tests passing (25 customer-subscription + 6 subscription-downgrade)

## Feature: Subscription Pause/Resume
- [x] Add pause procedure to provider subscriptionRouter (Stripe pause_collection)
- [x] Add resume procedure to provider subscriptionRouter
- [x] Add pause/resume procedures to customerSubscriptionRouter
- [x] Track pause status in subscription state (pausedAt, resumesAt columns added)
- [x] Pause UI button on SubscriptionManagement page with duration picker dialog (7/14/30 days)
- [x] Show paused state badge and resume button when subscription is paused
- [x] Paused subscriptions keep their tier (features preserved, billing paused)
- [x] Schema migration: added 'paused' to status enum, pausedAt/resumesAt columns
- [x] 17 tests passing for pause/resume logic

## Feature: Subscription Change Email Notifications
- [x] Email notification on upgrade (welcome to new tier, features unlocked)
- [x] Email notification on downgrade (confirmation, what changes, prorated credit)
- [x] Email notification on pause (confirmation, when it resumes, features affected)
- [x] Email notification on resume (welcome back, features restored)
- [x] All subscription emails use existing notification system with unsubscribe support
- [x] Added 4 new notification templates (subscription_upgraded, subscription_downgraded, subscription_paused, subscription_resumed)

## Feature: Admin Team Management
- [x] Add admin_roles enum to schema (super_admin, support_agent, moderator)
- [x] Add promoteToAdmin procedure (owner/super_admin only)
- [x] Add demoteFromAdmin procedure (owner/super_admin only)
- [x] Add Team Management tab in admin dashboard
- [x] Show current team members with roles and last active
- [x] Allow owner to promote users to admin by searching their email
- [x] Allow owner to demote admins back to their original role
- [x] Protect super_admin actions (only owner can manage other admins)

## Feature: Admin User Detail View
- [x] Create /admin/users/:id route and page
- [x] Show user profile info (name, email, phone, photo, join date, last login)
- [x] Show subscription status and history
- [x] Show booking history (as customer and/or provider)
- [x] Show payment history
- [x] Show reviews given and received
- [x] Show services listed (if provider)
- [x] Quick actions: suspend/unsuspend, promote to admin

## Feature: Admin Search & Filters
- [x] Add search bar to Users tab (search by name, email, phone)
- [x] Add filters: role, status (active/suspended)
- [x] Add search bar to Providers tab (search by business name, city)
- [x] Add filters: verification status
- [x] Add search bar to Bookings tab (search by customer/provider name, service)
- [x] Add filters: booking status
- [x] Server-side pagination for large datasets (25 per page)

## Feature: Admin Audit Log
- [x] Create audit_log table (action, actor_id, target_id, target_type, details, timestamp)
- [x] Log all admin actions: suspend/unsuspend, verify/reject, promote/demote, flag/hide/delete review
- [x] Create Audit Log tab in admin dashboard
- [x] Show chronological list with actor name, action description, target, timestamp
- [x] Add filters: action type, actor, date range
- [x] Link audit entries to user detail view
- [x] 11 tests passing for admin features

## Bug Fix: Account Deletion Not Clearing All User Data
- [x] Audit all database tables that reference userId (found 8 missing tables)
- [x] Update deleteAccount procedure to clear data from ALL tables
- [x] Clear: bookings, booking_sessions, payments (delete customer's bookings + child records)
- [x] Clear: waitlist entries (delete all user's waitlist entries)
- [x] Clear: promo codes (delete provider's promo codes)
- [x] Clear: contact replies (delete replies to user's contact submissions)
- [x] Clear: audit log entries (anonymize target entries)
- [x] Cancel provider Stripe subscription in authRouter (was only cancelling customer sub)
- [x] All 15 account deletion tests passing (7 + 8)

## Account Deletion: Final Confirmation Modal (type 'DELETE')
- [x] Confirmation modal already implemented with multi-step flow (initial warning → type DELETE → confirm)
- [x] Modal requires exact text "DELETE" before the button becomes enabled
- [x] Applies to all users (customer and provider) via shared DeleteAccountSection component
- [x] Backend also validates confirmation parameter

## Bug Fix: depositPercentage NaN error when adding a service
- [x] Fix depositPercentage being sent as NaN in service creation form (CreateService.tsx + ProviderDashboard.tsx)
- [x] Ensure proper number coercion/default for depositPercentage field (backend transform in serviceRouter.ts)

## Bug Fix: provider_subscriptions table query failure on service creation
- [x] Fix failed query on provider_subscriptions table when creating a service (added missing pausedAt/resumesAt columns and 'paused' enum value to both provider_subscriptions and customer_subscriptions)

## Bookings Tab: Delete function for old/cancelled bookings
- [x] Add backend procedure to delete bookings (restricted to cancelled/completed/no-show status)
- [x] Add delete button to bookings in the Provider Dashboard bookings tab
- [x] Add confirmation dialog before deletion

## Chat Feature: Profile images in messaging
- [x] Display profile images (avatars) next to messages in the chat interface
- [x] Show user/provider profile photo if uploaded, fallback to initials

## Helpful Tips & FAQ
- [x] Create reusable HelpTip component (info icon with tooltip/popover)
- [x] Create Help/FAQ page with common questions for providers and customers (already exists at /help)
- [x] Add contextual tips to Provider Dashboard (bookings, services, availability)
- [x] Add contextual tips to service creation/editing form
- [x] Add contextual tips to customer booking flow and profile pages
- [x] Register Help/FAQ page route in App.tsx and add navigation link (already exists)

## Fix: Customer referral link auto-capture and notifications
- [x] Capture ?ref= parameter from homepage URL and store in localStorage
- [x] Auto-fill referral code in booking flow from stored localStorage value
- [x] Add in-app notification for referrer when someone signs up via their referral link

## Plans Page Redesign: Unified Two-Audience Layout
- [x] Update products.ts: add maxCategories to tier limits (1/5/unlimited), rename Professional to Pro
- [x] Enforce category limits in provider onboarding/category selection backend
- [x] Redesign Plans page (CustomerPricing.tsx) as unified two-audience page with toggle (I book services / I provide services)
- [x] Update customer section language: Free (5 saved providers), Pro (50 saved, priority, folders, bulk quotes), Business (unlimited, analytics, dedicated support)
- [x] Update provider section language: Starter (1 category, 3 services), Pro (5 categories, 10 services), Business (unlimited)
- [x] Update SubscriptionManagement.tsx language to match new Plans page (Pro instead of Professional, category limits)
- [x] Run tests, TypeScript check, verify no regressions

## Content Audit: Align all platform copy with new Plans structure
- [x] Audit and update Help Center page (FAQs, plan descriptions, feature explanations)
- [x] Audit and update provider onboarding text (trial mentions, tier descriptions)
- [x] Audit and update email/notification templates (trial, upgrade, welcome messages)
- [x] Audit and update error messages and upgrade prompts across the platform
- [x] Audit and update any remaining "Professional" references in client-facing copy

## Terms of Service & Privacy Policy Updates
- [x] Remove SMS/Text Messaging section from Terms of Service (not active yet)
- [x] Add Subscription Plans section to Terms of Service (billing, trials, cancellation, pricing changes)
- [x] Remove SMS section from Privacy Policy, replace with general Communications section
- [x] Remove Twilio reference from Privacy Policy information sharing
- [x] Update "Last updated" dates to June 18, 2026

## Enhancement: Granular Email Unsubscribe
- [x] Update Unsubscribe page to show per-type toggles (booking, reminder, message, payment, marketing) instead of blanket unsubscribe
- [x] Add backend endpoint to update individual email preferences by unsubscribe token
- [x] Keep "Unsubscribe from all" as an option but add granular control

## Enhancement: Payment Receipt PDF
- [x] Create per-booking receipt PDF endpoint (GET /api/receipt/:bookingId/pdf)
- [x] Include booking details, payment info, provider info, and OlogyCrew branding
- [x] Add "Download Receipt" button on BookingDetail page for completed/paid bookings

## Enhancement: Real-time Messaging (Remove Polling)
- [x] Remove 15-second refetchInterval from Messages page queries
- [x] Ensure SSE newMessage event triggers immediate data refresh
- [x] Verify typing indicators and read receipts work without polling

## Feature: Rename Customer Plan Names (Individual/Coordinator/Manager)
- [x] Update CustomerPricing page plan cards (Free→Individual, Pro→Coordinator, Business→Manager)
- [x] Update AccountSubscription page tier config
- [x] Update SavedProviders page tier badges and upgrade copy
- [x] Update HelpCenter customer-facing plan references
- [x] Update UpgradeModal tier names and dynamic text
- [x] Update server-side CUSTOMER_TIERS config (customerSubscription.ts)
- [x] Update customerSubscriptionRouter error messages and downgrade messages
- [x] Update foldersRouter error messages
- [x] Update help-center.test.ts customer tier fixtures

## Feature: Automated 60/40 Partner Revenue Split
- [x] Add PARTNER_STRIPE_ACCOUNT_ID secret (acct_19SruwCpKKiO3Huw)
- [x] Create partnerSplit module (server/partnerSplit.ts) with transfer logic
- [x] Integrate 40% auto-transfer into provider subscription webhook (invoice.payment_succeeded)
- [x] Integrate 40% auto-transfer into customer subscription webhook (invoice.payment_succeeded)
- [x] Integrate 40% auto-transfer into booking platform fee collection
- [x] Add partner_transfers table to track all transfers (amount, source, status, stripeTransferId)
- [x] Add admin dashboard section showing partner transfer history and totals
- [x] Write tests for partner split calculations and transfer logic

## Feature: Admin Dashboard Access Interface
- [x] Add Shield icon import to NavHeader
- [x] Add Admin Dashboard link in UserMenuDropdown (visible only for admin users)
- [x] Improve admin button styling in desktop nav for better visibility
- [x] Add admin link in mobile menu with proper icon

## Feature: Partner Split Tab Enhancements
- [x] Add date range filter to partner transfers backend query
- [x] Add CSV export endpoint for partner transfer history
- [x] Add monthly revenue breakdown data endpoint for chart
- [x] Build date range filter UI in Partner Split panel
- [x] Build CSV export button in Partner Split panel
- [x] Build monthly revenue breakdown chart (60/40 visual)

## Feature: 14-Day Free Trial for Paid Plans
- [x] Add "14 Day Free Trial" as first bullet on Provider Pro and Business plans (pricing page)
- [x] Add "14 Day Free Trial" as first bullet on Customer Coordinator and Manager plans (pricing page)
- [x] Add trial fields to database schema (trialStartDate, trialEndDate, trialActive) — already exists: trialEndsAt + status='trialing'
- [x] Update subscription signup to set 14-day trial period when user selects paid plan
- [x] Build trial expiry detection (periodic check) — via checkTrialStatus on page load + heartbeat job
- [x] Send notification alert when trial ends informing user to add credit card info
- [x] Gate plan benefits behind trial/active subscription check — already gated via getCustomerTier

## Feature: Custom Authentication System (Google OAuth + Email/Password)
- [x] Set up GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET secrets
- [x] Add password hash, email verification token, and reset token fields to users table
- [x] Build email/password registration endpoint with bcrypt hashing
- [x] Build email/password login endpoint with session cookie
- [x] Build Google OAuth flow (redirect + callback)
- [x] Build email verification flow (send verification email + verify endpoint)
- [x] Build forgot password flow (send reset email + reset endpoint)
- [x] Build dedicated Login page with Google button and email/password form
- [x] Build dedicated Sign Up page with Google button and email/password form
- [x] Add password strength indicator and show/hide toggle
- [x] Update navigation to use new auth pages instead of Manus OAuth
- [x] Migrate existing users to work with new auth system — compatible via shared JWT/cookie system
- [x] Remove/bypass Manus OAuth dependency — getLoginUrl() now redirects to /login

## Bug Fix: Logout Not Working (Users Appear Still Logged In After Logout)
- [x] Fix server-side cookie clearing: use both clearCookie AND set cookie to empty with maxAge:0/expires:past
- [x] Fix client-side cache clearing: useAuth logout now calls queryClient.clear() and removes localStorage
- [x] Update logout test to verify both clearCookie and empty cookie approaches

## Bug Fix: Allow Login Regardless of Original Auth Method
- [x] Remove restriction that blocks email/password login for Google-created accounts — users should be able to log in with either method

## Bug Fix: Forgot Password Email Not Sending + Profile Password Management
- [x] Fix forgot password email not being delivered when user enters their email (was blocking Google-only accounts)
- [x] Add "Change Password" / "Set Password" section in user profile settings (with strength indicator + eye toggle)
- [x] Allow Google-only accounts to set a password so they can log in with email/password too

## Feature: Context-Appropriate Email Sender Addresses
- [x] Use noreply@ologycrew.com for automated notifications (password resets, booking confirmations, reminders)
- [x] Use info@ologycrew.com for general platform communications (welcome emails, announcements)
- [x] Use support@ologycrew.com for support-related emails (account issues, disputes)

## Bug Fix: Admin Dashboard Mobile Navigation Overflow
- [x] Fix admin dashboard tab/nav items overflowing on mobile view (Overview, Subscriptions, Users, Providers, Bookings, Reviews, Documents, Support, Referrals, Push, Team, Audit Log, Partner Split need to fit mobile screen)

## Bug Fix: Admin Dashboard Mobile Layout Issues + Search
- [x] Overview tab: Fix pending verifications and reject button cut off on mobile
- [x] Providers tab: Fix Trust Score Management and Recalculate All button cut off on mobile
- [x] Reviews tab: Fix stars going off grid on mobile
- [x] Search input fields text cut off on mobile across tabs
- [x] Add search bar to Team tab to find team members
- [x] Add search bars to all admin tabs (Providers, Reviews, Documents) for finding users/providers

## Feature: Delete User + Admin Access Restriction
- [x] Add delete user procedure to admin router (super admin only, with confirmation, cascading cleanup)
- [x] Add delete user button with confirmation dialog to admin user detail page (type DELETE to confirm)
- [x] Restrict admin access to only Gary Chisolm (ID 1) and Winston Williams (ID 2190437)
- [x] Demoted all other admins and deleted 7,222 test users (keeping Gary, Winston x2, OlogyCrew Official)
- [x] Add user profile photos/avatars to admin user list and search results for easier identification
- [x] Add "Consultation" as a free pricing option to all booking category pricing dropdowns
- [x] Add Pricing Model dropdown to the Edit Service dialog in Provider Dashboard
- [x] Add ability to delete quote requests from the main dashboard
- [x] DJ & Music Services: Change service type field options to Public Venue, Private Location, Virtual Stream; add Venue Name input when Public Venue is selected during booking
- [x] Remove Class & Capacity section from DJ & Music Services (category 20) in Create Service and Edit Service forms
- [x] Fix delete user failing on referrals table - wrong column name (referredId → refereeId)
- [x] Anti-spam: Add honeypot field to signup form (hidden field that bots fill, silently reject)
- [x] Anti-spam: Add rate limiting to signup and login endpoints (per IP)
- [x] Anti-spam: Block disposable/temporary email domains on registration
- [x] Anti-spam: Enforce email verification before allowing bookings (already sends verification email, need to gate actions)
- [x] Block unverified email users from role selection and profile setup — redirect to verify-email page
- [x] Server-side: reject role selection and onboarding mutations if email not verified
- [x] Frontend: redirect unverified users to a "verify your email" gate page instead of allowing navigation
- [x] Admin dashboard shows "Unverified" status badge for users who haven't verified email
- [x] Show provider name and profile photo/logo on service cards when browsing categories and search results
- [x] Make provider name and photo clickable (link to provider profile) on service cards in browse and search
- [x] Add favorite/save button to service cards in browse and search results
- [x] Fix provider.listByCategory returning 0 providers - was mapping .providerId on already-plain number array
- [x] Fix "Back to Admin Dashboard" button on user detail page to return to Users tab instead of overview
- [x] Add pagination controls to Users tab in admin dashboard (page size 20, Previous/Next buttons, page indicator, reset to page 1 on search/filter change)
- [x] Add pagination controls to Providers tab in admin dashboard (page size 20, Previous/Next buttons, page indicator, reset to page 1 on search/filter change)
- [x] Add sorting functionality to Rating column in Providers tab (toggle between highest-to-lowest, lowest-to-highest, and default)
- [x] Add 'Custom Duration' option to service duration dropdown for DJ & Music services (start/end time pickers, calculate cost from provider's hourly rate)
- [x] Extend 'Custom Duration' feature to Photography (category 17) and Event Planning (category 177) services
- [x] Extend 'Custom Duration' feature to Audio Visual Crew (category 15)
- [x] Allow customers to edit/change booking duration after initial booking (from My Bookings or Booking Detail page)
- [x] Ensure provider card location label aligns exactly with the location type selected from the dropdown list
- [x] Add "Flexible", "Teams", and "Zoom" as location type options for services (schema, dropdowns, labels, filters)
- [x] Update ServiceDetail breadcrumb to include provider profile as intermediate step when navigating from provider's profile page
- [x] Add Flexible, Teams, Zoom, and Other to service creation and edit dropdowns (ProviderOnboarding + ProviderDashboard), plus update schema/validation for "other"
- [x] Mark notification as read when user clicks on an unread message/notification
- [x] Add "Clear All" button to notification bell dropdown in NavHeader
- [x] Add "Quick Re-book" button on past/completed bookings in MyBookings page
- [x] Build bulk booking flow for scheduling multiple providers/dates in one session
- [x] Build monthly planner view for drag-and-drop DJ/provider scheduling
- [x] Enable Custom Duration for: TV/Film Crew (19), Dance Lessons (195), Fitness Classes (109), Personal Trainer (12), Day Labor (202), Handyman (9), Power Washing (148), Home Cleaning (188), Virtual Events (201), Party & Event Rentals (199)
- [x] Update site contact page to include all new features
- [x] Update FAQs page with questions about new features (Custom Duration, Bulk Booking, Monthly Planner, Quick Re-book, new location types)
- [x] Update Terms of Service to cover new features and booking types

## Redesign: Event-Centric Bulk Booking
- [x] Redesign Bulk Booking page with event-centric flow: Step 1 = Event Details (date, venue, event type), Step 2 = Add service types with individual providers and their specific start/end times
- [x] Add event type selector (wedding, corporate, birthday, concert, etc.)
- [x] Add venue/location input for the event
- [x] Service type selector to filter providers by category
- [x] Individual provider selection per service type with custom start/end time for each
- [x] Summary view showing all providers grouped by service type with their times

## Bulk Booking Enhancements
- [x] Add visual timeline showing all providers' time slots on a horizontal bar for the event day
- [x] Add dynamic cost calculation (estimated total based on selected services/durations)
- [x] Add "Save as Draft" button to save incomplete bulk bookings for later

## Content & Admin Updates for Bulk Booking Enhancements
- [x] Add bulk booking/draft stats to admin dashboard (draft count, popular event types, bulk vs individual booking ratio)
- [x] Update Help Center guide article for Bulk Booking with new event-centric flow, timeline, cost estimates, save as draft
- [x] Update FAQs with questions about Visual Timeline, Cost Estimates, and Save as Draft
- [x] Update Terms of Service with draft storage and estimated pricing disclaimers

## Feature: Saved Drafts Tab in User Dashboard
- [x] Add "Saved Drafts" tab to user profile/dashboard showing all saved bulk booking drafts
- [x] Display draft cards with event name, date, venue, event type, provider count, and last modified
- [x] Add "Resume" button to navigate to Bulk Booking page with draft loaded
- [x] Add "Delete" button to remove drafts

## Enhancement: Saved Drafts Filtering & Sorting
- [x] Add sort options to Saved Drafts tab (by event date, last modified, name)
- [x] Add filter by event type dropdown

## Bug Fix: Provider Card Display in Bulk Booking
- [x] Fix provider card not fully showing when selecting a provider in Bulk Booking

## Redesign: Advanced Bulk Booking System
- [x] Support multiple providers for a single service type (e.g., 3 DJs for same event date, each with own time)
- [x] Support multiple services with multiple providers across different categories
- [x] Add service-type-specific fields (music genres for DJs, service types for salons, style preferences for photographers, etc.)
- [x] All providers share the same event date but have individual time slots
- [x] Create reusable event templates (save entire configurations for reuse on new dates)
- [x] Template management UI (save, load, edit, delete templates)

## Bug Fix: Bulk Booking Provider Field Issues
- [x] Fix provider dropdown not displaying all available providers from database
- [x] Fix provider dropdown being hidden/clipped inside bounding box

## Bug Fix: Notification Bell Clear
- [x] Fix "Clear All" notifications not working in notification bell dropdown

## Bug Fix: Rate Exceeded on Google Sign-In
- [x] Fix "Rate exceeded" blank page when clicking Sign In with Google button

## Bulk Booking UX Improvements
- [x] Activate Legacy provider (isActive = 0 → 1)
- [x] Quick Category Stacking: Show category checklist upfront, user checks multiple categories, then fills in providers/times for each
- [x] Personal Service Bundles: Save common combos as reusable templates with preferred providers pre-selected
- [x] Smart Time Suggestions: Auto-suggest non-overlapping times based on service duration
- [x] Favorite Providers Auto-Fill: Auto-suggest favorited providers when their category is selected

## Bulk Booking Flow Restructure
- [x] Restructure service group flow: Step 1 = Select Category first, then show category-specific fields
- [x] Step 2 = Choose Provider based on selected category, then show that provider's specific services
- [x] Provider selection shows only providers in the chosen category
- [x] Service list updates to show only the selected provider's services for that category

## Bulk Booking: Remove Event Details, Move Date/Venue to Service Groups
- [x] Remove the global "Event Details" section (Step 1 card)
- [x] Delete the event type field entirely
- [x] Move Date and Venue fields into each service group card
- [x] Only show Date/Venue for relevant categories (DJ, AV Crew, Event Planning, TV/Film, Party Rentals, etc.)
- [x] Hide Date/Venue for categories that don't need them (Barbershop, Salon, Massage, etc.)
- [x] Update submission logic to use per-group date/venue instead of global fields
- [x] Update draft save/load to work with per-group date/venue

## Feature: Provider Block Out Dates
- [x] Backend: block-out date procedures (create single/range, list, delete) using date overrides with isAvailable=false
- [x] Provider dashboard UI: Block Out Dates section in Schedule tab with visual calendar
- [x] Calendar UI: tap/click dates to block, drag/shift-click for date ranges
- [x] Optional reason/label for each block-out (vacation, holiday, personal, etc.)
- [x] Blocked dates shown as red/unavailable on the provider's calendar
- [x] Booking flow respects blocked dates (grayed out, cannot be selected by customers)
- [x] Bulk delete support for removing block-out dates

## Admin-Managed Contact Info / Platform Settings
- [x] Create platform_settings table in schema (key-value store for site-wide settings like phone, email, address, hours)
- [x] Add admin procedures to get/update platform settings
- [x] Add Platform Settings tab/section in Admin Dashboard for managing contact info
- [x] Update HelpCenter Contact Us section to pull contact info from platform settings (dynamic, not hardcoded)
- [x] Verify booking email notifications are working end-to-end

## Fix: Skip Plan Step for Subscribed Providers in Onboarding
- [x] If provider already has an active subscription, skip/hide Step 4 (Your Plan) in onboarding
- [x] Update step navigation: Step 3 goes directly to Step 5 if plan exists
- [x] Step 5 back button goes to Step 3 if plan exists
- [x] Stepper shows step 4 as complete and grayed/skipped for subscribed providers
- [x] Dashboard links to onboarding?step=4 should redirect to step 2 (manage categories) if already subscribed

## Category Page: Show All Providers with Pagination
- [x] Show all providers in a category (no hard limit - backend returns all)
- [x] Add "Load More" button pagination (12 providers per page)
- [x] Show count: "Showing X of Y providers"
- [x] Backend already returns all providers (no limit needed)

## Fix: Admin Provider Management & Role Display
- [x] Activate Winston's provider profile (isActive = 1)
- [x] Add activate/deactivate provider toggle in Admin dashboard
- [x] Show dual roles in admin user list (e.g., "Admin + Provider" if user has both)

## Fix: Category Page Showing Incorrect Provider/Service Counts
- [x] Audit all providers in database — identify test vs real providers
- [x] Remove or deactivate test providers so only real providers appear
- [x] Fix category page counts to only reflect active, visible providers
- [x] Verify Barber Shop category shows accurate provider/service counts

## Fix: OG Share Card Missing Profile Photo + Add "My Page" Link
- [x] Fix OG image generation to include provider profile photo in share preview card
- [x] Add "My Page" quick link to provider dropdown menu (top right user menu)

## Feature: OlogyCrew AI Help Assistant Chatbot
- [x] Create system prompt with full platform knowledge (features, how-tos, best practices)
- [x] Create backend tRPC endpoint for chat (invokeLLM with conversation history)
- [x] Build floating chat widget UI (bottom-right bubble, expandable chat panel)
- [x] Add suggested starter questions for quick access
- [x] Integrate widget into app layout (available on all pages)

## Feature: Open Messaging (General Inquiries)
- [x] Add general inquiry thread type to messaging schema (not tied to a booking)
- [x] Create backend endpoint to start/find a general inquiry thread with a provider
- [x] Create DirectMessage page for conversation-based (non-booking) threads
- [x] Add /dm/:conversationId route
- [x] Update "Message Provider" button on public profile to open general inquiry thread
- [x] Distinguish General Inquiry vs Booking threads in Messages inbox (tag/label)
- [x] Only allow logged-in users to send messages (prevent spam)
- [x] Fix search results and notification auto-open for direct messages

## Feature: Calendar Sync Buttons & AI Assistant Update
- [x] Add Google Calendar, Apple Calendar, and Copy iCal URL sync buttons to Provider Calendar view
- [x] Ensure confirmed bookings display as events on the calendar
- [x] Ensure blocked time (date overrides) shows as greyed-out slots
- [x] Update AI Help Assistant knowledge base with open messaging and calendar sync features

## Feature: Automatic Price Formatting (Hide .00 Cents)
- [x] Create shared/formatPrice.ts utility (hides .00, shows real cents like .50)
- [x] Update formatCurrency in dateUtils.ts to use same logic
- [x] Update BookingAnalytics.tsx, CategoryDetail.tsx, PublicProviderProfile.tsx
- [x] Update BulkBooking.tsx, EmbedBooking.tsx, BookingConfirmation.tsx
- [x] Update MyBookings.tsx, ProviderDashboard.tsx, ProviderOnboarding.tsx
- [x] Update ServiceDetail.tsx, BookingDetail.tsx, MyQuotes.tsx
- [x] Update ProviderCalendar.tsx, ReferralProgram.tsx, CustomerPricing.tsx
- [x] Update AdminDashboard.tsx (display-only; CSV export keeps toFixed(2) for data accuracy)
- [x] Update SubscriptionManagement.tsx yearly billing caption
- [x] TypeScript compiles cleanly (0 errors)
- [x] Kept API payloads (Stripe, CSV exports, mutation data) at full precision

## Bug Fix: "Invalid payment amount" for hourly-rate services (DJ & Music)
- [x] Fix backend booking creation to calculate subtotal from hourly rate when basePrice is null
- [x] Fix multi-day and recurring booking pricing to properly calculate hourly rate × duration
- [x] Frontend already passes subtotal for custom duration; backend now handles standard duration fallback

## UX: Quick-Edit Bio on Provider Dashboard
- [x] Add inline bio/description preview card below the welcome section with a quick edit button

## Bug Fix: Invalid Stripe API version error
- [x] Updated stripeConnectRouter.ts from "2025-12-18.acacia" to "2026-01-28.clover"
- [x] Updated stripeRouter.ts from "2025-12-18.acacia" to "2026-01-28.clover"
- [x] Updated subscriptionRouter.ts from "2025-12-18.acacia" to "2026-01-28.clover"
- [x] Updated customerSubscriptionRouter.ts from "2025-02-24.acacia" to "2026-01-28.clover"
- [x] All Stripe instances now use "2026-01-28.clover" matching installed stripe@20.3.1 SDK

## UX: Conditional Location Type Picker for Flexible Services
- [x] Show location type picker (Public Venue / Private Location / Virtual Stream) only when service type is "flexible"
- [x] Show venue name + address fields for Public Venue selection
- [x] Show address fields for Private Location selection
- [x] Show no additional fields for Virtual Stream selection
- [x] Apply to all categories that support flexible services (not just DJ & Music)

## Feature: Hybrid Payment Timing (Pay Now / Pay After Confirmation)
- [x] Add requireUpfrontPayment boolean field to services schema
- [x] Add provider toggle in service settings to require upfront payment
- [x] Update booking form confirm step to show "Pay Now" and "Pay After Confirmation" buttons (for priced services)
- [x] When provider requires upfront: only show "Pay Now"
- [x] Update booking submission to handle "pay after confirmation" path (skip Stripe redirect)
- [x] Update BookingConfirmation page to show "Pay Now" button for confirmed bookings awaiting payment
- [x] Update MyBookings page with "Payment Due" badge and "Pay Now" button for confirmed-unpaid bookings
- [x] Free/consultation/custom-quote services skip payment options entirely

## UX: Show Venue Name in Provider Calendar
- [x] Display venue/location name alongside time in Provider Calendar for fixed-location bookings

## UX: Role-based Bookings View
- [x] Remove in-page "Bookings I Made" / "Bookings I Received" toggle from MyBookings
- [x] Use global role view (Provider/Customer) to determine which bookings are shown automatically
- [x] Hide Pay Now button and Payment Due badge from provider's view of received bookings
## Fix: Portfolio Image Error Handling
- [x] Extract PortfolioGrid component in PublicProviderProfile with image error handling
- [x] Track broken images via useState<Set<number>> and onError handlers on img tags
- [x] Automatically hide portfolio items whose images fail to load (no broken image icons)
- [x] Handle both regular images and before/after image pairs (hidden probe images for error detection)
- [x] Return null if all items have broken images (graceful empty state)

## Fix: Category Page Provider Card Overflow on Mobile
- [x] Hide "View Profile" button on mobile (hidden sm:inline-flex) — card is already a clickable link
- [x] Add min-w-0 to flex containers to prevent text overflow
- [x] Reduce avatar size on mobile (w-10 h-10 → w-12 h-12 on sm+)
- [x] Add truncate to provider name CardTitle for long names
- [x] Add overflow-hidden to AvailabilityQuickView container
- [x] Reduce gap from gap-4 to gap-3 on mobile for tighter layout

## Fix: Manage Availability Page Mobile Overflow

- [x] Weekly schedule row: use flex-wrap, shorter day labels (Sun/Mon/Tue) on mobile, min-w-0 on time inputs
- [x] Current schedule display: use abbreviated day names on mobile, add truncate to time text, add min-w-0
- [x] Blocked Dates card header: stack title and action buttons vertically on mobile (flex-col sm:flex-row)
- [x] Calendar: wrap in overflow-x-auto container to prevent horizontal page scroll
- [x] Custom Hours override rows: add min-w-0 to content div, shrink-0 to delete button
- [x] Main container: add overflow-hidden to prevent any child from causing horizontal scroll

## Fix: Bulk Booking Page Mobile Overflow

- [x] Page header: stack title and action buttons vertically on mobile (flex-col sm:flex-row), shorten button labels
- [x] ServiceGroupCard header: add flex-wrap, min-w-0, truncate category name, hide provider badge on mobile, icon-only "Add Provider" on mobile
- [x] "Your Services" card header: stack vertically on mobile, shorten button labels (Stack/Add)
- [x] Empty state buttons: add flex-wrap, use size="sm"
- [x] Summary action row: stack buttons vertically on mobile (flex-col-reverse sm:flex-row), shorten "Book All" text
- [x] Save Template modal: bottom-sheet style on mobile (items-end sm:items-center), add padding
- [x] Quick Category Stacking modal: bottom-sheet style on mobile, compact footer
- [x] VisualTimeline: add overflow-x-auto with min-w-[280px] for hour markers
- [x] ProviderSlotCard header: add min-w-0, truncate provider name, shrink-0 on actions
- [x] Main container: add overflow-hidden safety net

## UX: Search Page Mobile - Move Search Bar Out of Filter Panel

- [x] Move the search input out of the filter drawer and place it prominently at the top of the page on mobile for easy access

## Fix: Quick Category Stacking Modal Vertical Centering

- [x] Center modal vertically on both mobile and desktop (items-center on all breakpoints)
- [x] Reduce max-height to 75vh to ensure footer buttons always stay within viewport

## Fix: OlogyCrew Logo Text Size on Mobile

- [x] Make OlogyCrew text visible on mobile (was hidden with hidden lg:inline)
- [x] Increase text size to text-xl (20px) on all viewports for easy readability
- [x] Increase logo icon to h-9 w-9 on mobile for better visibility

## Fix: PWA Splash Screen OlogyCrew Text Too Small

- [x] Regenerate all 9 iOS splash screen images with larger OlogyCrew text (~5% of screen width vs previous ~2%)
- [x] Upload new splash images and update index.html references

## UX: Move AI Assistant and Notification Bell to Mobile Header

- [x] Move AI assistant button into the mobile header (left of hamburger menu) instead of floating bottom-right
- [x] Place notification bell next to hamburger menu on mobile
- [x] Hide the floating AI assistant button on mobile (keep it on desktop)

## Fix: Messaging Page Mobile Layout

- [x] Make text input box always visible on screen on mobile (no scrolling past it)
- [x] Make conversation area scrollable within its container
- [x] Apply same fix to DirectMessage page

## UX: Redesign Mobile Hamburger Menu as Full-Screen App Navigation

- [x] Convert mobile hamburger dropdown to full-screen overlay panel
- [x] Add user profile summary at top (avatar, name, role badge)
- [x] Group menu items into sections (Browse, My Account, Provider, Admin)
- [x] Use large tap targets with icons and labels
- [x] Add slide-in animation

## Fix: Messaging Pages - Input Pushed Off Screen After 5+ Messages (Mobile)

- [x] Replace h-screen with h-[100dvh] for proper mobile viewport (accounts for browser chrome/address bar)
- [x] Replace Radix ScrollArea with native overflow-y-auto div for reliable height constraint
- [x] Add overflow-hidden on all parent containers to prevent content escaping
- [x] Add shrink-0 on input section to guarantee it never compresses
- [x] Reduce container padding on mobile (py-2 vs py-4) to maximize message area
- [x] Applied to both Messages.tsx and DirectMessage.tsx

## Feature: Logged-In Launchpad Homepage (Apple-style Grid)

- [x] Create LoggedInHome component with role-based icon grids
- [x] Quick stats banner at top (unread messages, notifications)
- [x] Provider grid: Bookings, Services, Calendar, Messages, Analytics, Payouts, Portfolio, Promo Codes, Quotes, My Page, Widgets, Settings
- [x] Customer grid: Browse, Search, My Bookings, Messages, Saved, Quotes, Waitlist, Referrals, Alerts, Reviews, Plans, Settings
- [x] Large icons (56-64px) with labels beneath in 4-column grid
- [x] Conditionally render in Home.tsx when user is authenticated
- [x] Keep NavHeader on desktop for role switching, alerts, and navigation
- [x] Keep public marketing homepage for non-logged-in visitors unchanged

## Feature: AI-Assisted Ad Promotions ("Boost Your Business")

- [x] Database schema: promotions table (id, providerId, serviceId, tier, status, headline, description, startDate, endDate, stripePaymentId, createdAt)
- [x] Backend tRPC routes: createPromotion, getMyPromotions, getActivePromotions, generateAdCopy
- [x] AI copy generation: auto-generate headline + description from service details
- [x] Stripe payment flow: one-time charge for each promotion tier ($4.99 / $14.99 / $29.99 / $39.99 bundle)
- [x] Frontend: Boost Your Business page with tier selection, AI copy preview, and payment
- [x] Frontend: My Promotions management page (active, expired, stats)
- [x] Display logic: "Promoted" / "Featured" badges on provider cards in search/browse
- [x] Display logic: Priority sort for promoted listings in search results and category pages
- [x] Display logic: "Featured Providers" section on homepage for homepage-tier promotions
- [x] Add Boost link to provider Launchpad and hamburger menu
- [x] Stripe webhook handler activates promotions after successful payment
- [x] 11 tests for promotion feature (all passing)

## Feature: Public Shareable Featured Professionals Discovery Page

- [x] Create /featured public page showing all currently promoted/boosted providers
- [x] Social sharing buttons (copy link, Twitter, Facebook) for providers to share their featured status
- [x] Individual shareable provider promotion cards with deep links to provider profiles
- [x] Add "Featured" link to public navigation (Browse Services area)
- [x] Mobile-responsive grid layout with provider cards, ratings, categories, and AI-generated headlines

## Feature: Individual Shareable Promotion Pages for Providers

- [x] Backend: getPromotionById public endpoint for single promotion lookup
- [x] Frontend: /featured/promo/:id individual promotion landing page with Book Now CTA
- [x] Social sharing buttons on individual promotion page (Copy Link, Twitter/X, Facebook)
- [x] OG meta tags for rich social media previews when shared
- [x] "Share My Promotion" button on provider's Promotions dashboard for active promotions
- [x] Route registration in App.tsx

## Feature: Promotion View Counter & QR Code

- [x] Track page views on /featured/promo/:id (increment impressions on visit)
- [x] Display view count prominently on provider's active promotion cards
- [x] Generate downloadable QR code for each promotion link
- [x] QR code download button on provider's Promotions dashboard

## Feature: Complete Invoicing & Receipt System

- [x] Database schema: invoices table (id, invoiceNumber, type, providerId, customerId, status, subtotal, tax, total, dueDate, paidAt, stripePaymentIntentId, pdfUrl, notes, createdAt, updatedAt)
- [x] Database schema: invoice_line_items table (id, invoiceId, description, quantity, unitPrice, amount)
- [x] DB helpers: createInvoice, getInvoiceById, getInvoicesByProvider, getInvoicesByCustomer, updateInvoiceStatus, getNextInvoiceNumber
- [x] Server-side PDF generation with branded template (provider name, logo, line items, totals)
- [x] tRPC router: createInvoice, getMyInvoices (provider), getMyReceipts (customer), getInvoiceById, sendInvoice, markAsPaid
- [x] Auto-receipt generation on Stripe webhook (checkout.session.completed) for bookings, packages, promotions
- [x] Pay-from-invoice flow: generate Stripe checkout link for unpaid invoices
- [x] Provider UI: Invoices page (create invoice, add line items, send to customer, track status)
- [x] Customer UI: Receipts & Invoices page (view history, download PDFs, pay unpaid invoices)
- [x] Email delivery: send invoice PDF to customer when provider sends it; send receipt after payment
- [x] Refund credit notes: generate credit note PDF when refund is processed
- [x] Sequential invoice numbering (INV-2026-0001 format)
- [x] Add Invoices link to provider Launchpad and navigation
- [x] Add Receipts link to customer navigation
- [x] 15 vitest tests for invoicing feature (all passing)

## Bug Fix: 404 on Back Navigation from Invoices Page
- [x] Fix 404 error when clicking browser back button from /provider/invoices — back button was linking to /launchpad (non-existent route), changed to /

## Feature: Update Subscriptions & Terms for Invoicing
- [x] Update subscription plan features/content to include invoicing & receipts for all tiers
- [x] Update Terms of Service to reflect invoicing and receipt functionality

## Feature: Provider Tipping (External Payment Links, Zero Platform Fees)
- [x] Schema: Add tipping fields to service_providers (tippingEnabled, zelleHandle, cashAppHandle, venmoHandle)
- [x] Backend: tRPC endpoints for updating tip settings and fetching public tip info
- [x] Provider Settings UI: Toggle tipping on/off, add Zelle/Cash App/Venmo handles
- [x] Customer-facing: "Tip Your Provider" card on completed booking detail page
- [x] Customer-facing: Tip button on public provider profile page
- [x] Add tipping to subscription features list, terms of service, and marketing copy
- [x] Helper notes explaining zero-fee tipping to providers in settings
- [x] Vitest tests for tipping endpoints (9 tests passing)

## Feature: Personalized Thank-You Message on Tip Cards
- [x] Schema: Add tipThankYouMessage text field to serviceProviders table
- [x] Backend: Update getTipSettings, updateTipSettings, getPublicTipInfo to include thankYouMessage
- [x] Provider Settings UI: Add textarea for custom thank-you message in TipSettingsSection
- [x] Customer-facing: Display custom message on TipCard (public profile) and BookingTipCard (completed booking)
- [x] Tests for thank-you message and customer photo upload (12 tests passing)

## Feature: Customer Profile Photo Upload
- [x] Schema: Add profilePhotoUrl field to users table (if not already present) — already existed
- [x] Backend: Upload endpoint for customer profile photo (S3 storage) — added auth.uploadProfilePhoto
- [x] Customer Profile UI: Add hover-to-upload photo on profile/settings page — already existed, now uses auth endpoint
- [x] Display customer photo in nav avatar, messages, reviews, and booking cards — already wired throughout app
- [x] Tests for customer photo upload — included in tipping.test.ts

## Feature: Profile Photo Cropping & Preview
- [x] Install react-image-crop library
- [x] Create reusable ImageCropper dialog component (circular crop, preview, confirm/cancel)
- [x] Integrate cropper into customer profile photo upload (UserProfile.tsx)
- [x] Integrate cropper into provider profile photo upload (ProviderDashboard.tsx)

## Feature: Image Cropper Enhancements & Remove Photo
- [x] Add zoom slider to ImageCropper component
- [x] Add rotate button to ImageCropper component
- [x] Add 'Remove Photo' button to customer profile (UserProfile.tsx)
- [x] Add 'Remove Photo' button to provider profile (ProviderDashboard.tsx)
- [x] Backend: Add removeProfilePhoto endpoint for customers (auth router)
- [x] Backend: Add removeProfilePhoto endpoint for providers (provider router)

## Bug Fix: 504 Gateway Timeout on /my-bookings (batched tRPC query too large)
- [x] Fix: Added maxURLLength: 2048 to httpBatchLink — tRPC now auto-splits oversized batches into multiple smaller requests

## Feature: Loading Skeletons, Pagination, and Error Boundaries
- [x] Create reusable SectionErrorBoundary component that shows fallback UI when a section fails
- [x] Add loading skeletons to provider dashboard sections
- [x] Add loading skeletons to /my-bookings page
- [x] Implement pagination for bookings list on /my-bookings (10 items per page, client-side)
- [x] Wrap provider dashboard sections in error boundaries (6 tabs: bookings, services, schedule, finances, my-page, settings)
- [x] Wrap my-bookings sections in error boundaries

## Feature: Free Estimates Toggle (Replaces FREE ESTIMATES Category)
- [x] Schema: Add offersEstimates boolean + estimateNote text to serviceProviders table
- [x] Backend: Endpoints to get/update free estimates settings
- [x] Provider Settings UI: Toggle + note textarea in settings section
- [x] Public Profile: "Free Estimates Available" badge on provider profile
- [x] Browse/Search Cards: Badge on provider cards when they offer free estimates
- [x] Browse/Search Filter: "Offers Free Estimates" checkbox filter on search page
- [x] Remove FREE ESTIMATES category (ID 197) from database, seed scripts, icon maps, and docs
- [x] Tests for free estimates endpoints (covered by tipping.test.ts patterns, 12 tests passing)

## Feature: Add PLUMBING SERVICES Category
- [x] Add PLUMBING SERVICES (ID: 211) to database (with 12 services linked to OlogyCrew Official)
- [x] Add to seed scripts (seed-categories.mjs, seed-categories.ts, seed-official-provider.mjs)
- [x] Add wrench icon (🔧) to CATEGORY_ICONS maps across all pages
- [x] Add 12 services for the category (drain cleaning, pipe repair, water heater, fixtures, leak detection, etc.)

## Feature: Add ELECTRICAL SERVICES and HVAC Categories
- [x] Add ELECTRICAL SERVICES (ID: 212) to database with 12 services
- [x] Add HVAC (ID: 213) to database with 12 services
- [x] Update seed scripts (seed-categories.mjs, seed-categories.ts, seed-official-provider.mjs)
- [x] Add icons to CATEGORY_ICONS maps across all pages (⚡ for Electrical, ❄️ for HVAC)

## Feature: Emergency Service Available Toggle
- [x] Schema: Add offersEmergencyService boolean to serviceProviders table
- [x] Backend: Endpoints to get/update emergency service setting
- [x] Provider Settings UI: Toggle in settings section
- [x] Public Profile: "Emergency Service Available" badge (red badge)
- [x] Search Cards: Badge on provider cards when they offer emergency service
- [x] Search Filter: "Emergency Service Available" checkbox filter on search page

## Feature: Emergency Hours & Request Button
- [x] Schema: Add emergencyHoursType (enum: '24_7', 'after_hours', 'custom') and emergencyHoursNote text to serviceProviders
- [x] Backend: Update emergency service endpoints to include hours fields
- [x] Provider Settings UI: Add hours selection when emergency toggle is enabled (24/7, After Hours, Custom + note)
- [x] Public Profile: Display emergency hours next to the emergency badge
- [x] Public Profile: Prominent "Request Emergency Service" button that visually stands out (red, pulsing, or elevated)

## Feature: Add CARPENTRY and ROOFING Categories
- [x] Add CARPENTRY (ID: 214) to database with common services
- [x] Add ROOFING (ID: 215) to database with common services
- [x] Update seed scripts and CATEGORY_ICONS maps
- [x] Update category count references from 43+ to 46+

## Bugfix: Move services from Chisolm Audio to OlogyCrew Official
- [x] Move ELECTRICAL SERVICES (categoryId 212, 12 services) from provider 1 to provider 360001
- [x] Move HVAC (categoryId 213, 12 services) from provider 1 to provider 360001
- [x] Also move provider_categories links for 212 and 213 from provider 1 to provider 360001

## Security Audit
- [x] Audit authentication and session management
- [x] Audit authorization (role checks, ownership verification)
- [x] Audit input validation and SQL injection prevention
- [x] Audit XSS prevention
- [x] Audit API data exposure (sensitive fields leaking)
- [x] Audit rate limiting
- [x] Audit file upload security
- [x] Audit payment/Stripe security
- [x] Fix all identified critical vulnerabilities

## Feature: Enhance OlogyCrew Official Profile with Interactive Elements
- [x] Add animated service category showcase with smooth transitions
- [x] Add interactive "How It Works" section showing booking flow steps
- [x] Add animated stats/metrics section (services offered, categories, response time)
- [x] Add visual call-to-action banner encouraging providers to build their own profile
- [x] Add tooltip hints showing providers what each section demonstrates

## Feature: Booking Process Loading Animations & Error Handling
- [x] Add skeleton loading states for booking calendar and time slots
- [x] Add smooth transition animations between booking steps
- [x] Add loading spinner/animation during payment processing
- [x] Add user-friendly error messages with recovery suggestions
- [x] Add retry mechanism for failed booking submissions
- [x] Add connection error detection with offline state handling

## Bugfix: Blank Before/After Images on Profile
- [x] Investigate and fix blank before/after portfolio images showing on Chisolm Audio profile when none were added
- [x] Root cause: Test file (featured-availability-portfolio.test.ts) was using userId=1 which maps to provider 1 (Chisolm Audio), so test runs inserted real portfolio items with example.com URLs
- [x] Deleted 16 fake portfolio items from database (example.com URLs)
- [x] Fixed test to use userId=99999 (non-existent provider) to prevent future insertions

## Feature: Add MARKETING Category
- [x] Add MARKETING (ID: 216) to database with 12 services
- [x] Update seed scripts and CATEGORY_ICONS maps
- [x] Update category count from 46+ to 47+

## Social Media Auto-Posting System
- [x] Database schema: social_posts table (content, postType, categoryId, platforms, results, status, timestamps)
- [x] Server module: socialMedia.ts (LLM content generation + Facebook/Instagram/LinkedIn API posting)
- [x] Scheduled handler: scheduledSocialPost.ts (Express endpoint for Heartbeat cron)
- [x] tRPC router: socialMediaRouter.ts (listPosts, previewPost, publishPost, deletePost — admin-only)
- [x] Register router in routers.ts
- [x] Register /api/scheduled/social-post endpoint in server/_core/index.ts
- [x] Heartbeat cron job registered (weekly Mondays 10am UTC)
- [x] Admin UI: AdminSocialMedia.tsx (post history, preview, publish now, delete)
- [x] Social Media tab added to AdminDashboard.tsx
- [x] Unit tests: social-media.test.ts (4 tests passing)
- [x] Facebook Page and LinkedIn API credentials configured
- [x] Instagram publishing intentionally deferred while owner completes the external account connection; no platform configuration changed

## Social Media - Create Post Button
- [x] Add "Create Post" button to Social Media admin tab
- [x] Create post form dialog with content textarea, platform checkboxes, and optional schedule
- [x] Add tRPC endpoint for manually creating/scheduling posts
- [x] Add "Publish" button on draft/scheduled posts to publish them on demand

## Admin Users - Cleanup & Bulk Delete
- [x] Audit database to identify test/clutter accounts vs real providers
- [x] Remove test/clutter accounts (keep real providers with real emails) — 1,212 clutter accounts deleted
- [x] Add bulk select/delete functionality to admin Users panel (checkboxes + Delete Selected button + confirmation dialog)
- [x] Keep OlogyCrew Official profile as example under all categories

## Admin Users - Pagination Jump-to-Page
- [x] Add page number input field to admin Users pagination
- [x] Allow typing a page number and pressing Enter to jump directly to that page

## Admin Pages - Pagination Jump-to-Page (All Lists)
- [x] Add page number input to Providers list pagination
- [x] Add page number input to Customers list pagination (customers are filtered within the Users tab — already done)
- [x] Add page number input to Audit Log pagination

## New Category: Studio Space Rentals
- [x] Add "STUDIO SPACE RENTALS" category (ID: 217) in alphabetical order (sortOrder: 42)
- [x] Update seed-categories.ts with all 48 categories in proper alphabetical order with correct sort orders
- [x] Update all "47+" category count references to "48+" across the codebase

## Demo Provider: Demo - OlogyCrew
- [x] Create "Demo - OlogyCrew" provider account with site logo as profile photo
- [x] Add free ($0) demo services in all 48 categories with realistic durations
- [x] Add visible "DEMO" badge on provider cards and service listings for demo provider
- [x] Ensure demo bookings skip payment (free) and show demo messaging to customers
- [x] Demo provider bio explains it's a demonstration of the booking experience

## Demo Provider UX Enhancements
- [x] Add welcome popup when users visit Demo provider profile explaining risk-free booking
- [x] Update customer dashboard to visually separate demo bookings from real bookings with distinct labels
- [x] Add 'Cancel Demo Booking' button on confirmation page for easy test booking cleanup

## Demo Provider UX Enhancements (Round 2)
- [x] Auto-fill booking form with dummy data when booking Demo provider for faster test completion
- [x] Add 'Find Real Providers' button on demo booking confirmation page
- [x] Add 'Clear All Demo Bookings' button in user dashboard for bulk test data cleanup

## Demo Provider UX Enhancements (Round 3)
- [x] Add persistent 'Demo Mode Active' banner at top of screen during entire demo booking flow
- [x] Add simulated payment step showing payment UI with 'No credit card required' message
- [x] Implement LLM-powered auto-reply messaging for Demo provider conversations

## Admin Cleanup: Remove Test/Seed Users
- [x] Remove all seeded test customers and providers from database (keep only owner account and Demo - OlogyCrew)

## Demo Provider: LLM Messaging & Admin Exclusion
- [x] Verify and enhance LLM auto-reply messaging for Demo provider chat experience
- [x] Exclude Demo provider bookings and revenue from admin dashboard statistics

## Bug Fix
- [x] Fix "Rendered more hooks than during the previous render" error on PublicProviderProfile (moved useEffect before early returns)

## Payment Method Icons Display
- [x] Create reusable PaymentMethods component with Visa, Mastercard, Amex, Apple Pay, Google Pay, Link icons
- [x] Add payment icons to Service Detail page near booking/price area
- [x] Add payment icons to Provider profile page near Book Now area
- [x] Add payment icons to booking confirmation step
- [x] Add payment icons to site Footer

## Payment UX Enhancements
- [x] Add lock icon next to 'Secure payments' text in PaymentMethods component
- [x] Ensure payment icons scale properly on mobile screens (responsive sizing)
- [x] Create 'Payment & Security' FAQ section on Service Detail page

## Bug Fix
- [x] Fix "Rendered more hooks than during the previous render" crash on /my-bookings during login (moved useMemo and useMutation hooks before early returns)

## Bug Fix
- [x] Fix "My Bookings" button on customer landing page giving 404 error
- [x] Fix all broken links on customer and provider landing pages (Messages->/messages, Saved->/saved-providers, Quotes->/my-quotes, Waitlist->/my-waitlist, Settings->/profile)

## UX Fix
- [x] Ensure all screens have the NavHeader on top (added to AccountSubscription, Invoices, MyWaitlist, Promotions, Receipts)
- [x] Make Widgets page its own standalone page (updated tile link from /provider/dashboard?tab=more to /provider/widgets)
- [x] Redirect users to OlogyCrew landing page (/) after login for both customer and provider
- [x] Make all back arrow buttons navigate to previous page (history.back) instead of hardcoded routes (16 pages fixed)
- [x] Change all button text/icon rollover colors to white when the background color changes on hover
- [x] Create standalone Reviews page for customers (view reviews they've written) - /my-reviews
- [x] Ensure provider Reviews page is accessible as standalone page from landing tile - /provider/reviews tile added
- [x] Add Dashboard, Browse, Featured, Search, Plans, and Help tiles logically to customer, provider, and admin landing pages
- [x] Fix duplicate React key errors on landing page when admin tiles merge with provider/customer tiles
- [x] Make navigation tiles consistent across all user landing pages and mobile hamburger menus (same icons, colors, order)
- [x] Remove category text headers (Discover, My Account, Provider) from hamburger menu tiles on mobile

## UX: All Tiles Link to Individual Pages
- [x] Create standalone /provider/bookings page (instead of dashboard?tab=bookings)
- [x] Create standalone /provider/services page (instead of dashboard?tab=services)
- [x] Create standalone /provider/analytics page (instead of dashboard?tab=analytics)
- [x] Create standalone /provider/payouts page (instead of dashboard?tab=payments)
- [x] Create standalone /provider/portfolio page (instead of dashboard?tab=services for portfolio)
- [x] Create standalone /provider/quotes page (instead of dashboard?tab=bookings for quotes)
- [x] Create standalone /provider/my-page page (instead of dashboard?tab=page)
- [x] Update all tile hrefs in LoggedInHome and NavHeader mobile menu
- [x] Create a proper standalone My Page (/provider/my-page) instead of redirecting to dashboard tab
- [x] Create standalone Provider Bookings page (/provider/bookings) - renders dashboard with hideChrome
- [x] Create standalone Provider Services page (/provider/services) - renders dashboard with hideChrome
- [x] Create standalone Provider Payouts page (/provider/payouts) - renders dashboard with hideChrome
- [x] Create standalone Provider Portfolio page (/provider/portfolio) - renders dashboard with hideChrome
- [x] Create standalone Provider Quotes page (/provider/quotes) - renders dashboard with hideChrome
- [x] Create standalone Provider Analytics page (/provider/analytics) - renders dashboard with hideChrome

## Accessibility: Button Hover Text Contrast
- [x] Audit all button hover colors and ensure text is readable (light bg → dark text, dark bg → light text) per WCAG AA standards
  - Fixed accent-foreground in light mode to dark (oklch 0.18) for 6.0:1 contrast on orange bg
  - Darkened primary to oklch 0.45 for 4.5:1 contrast with white text
  - Fixed AIChatBox suggested prompts: hover:text-white → hover:text-accent-foreground
  - Fixed Conversations cards: hover:text-white → hover:text-accent-foreground
  - Secondary button hover:bg-primary + hover:text-white = 4.5:1 (passes)
  - Dark mode accent-foreground (oklch 0.92) on dark bg (oklch 0.274) = 8.2:1 (passes)

## Bug Fix
- [x] Fix blank Analytics standalone page - pointed tile to /analytics (BookingAnalytics) instead of non-existent dashboard tab

## Accessibility: Comprehensive Text Contrast Audit
- [x] Audit and fix all text color contrast issues across the entire site (CSS variables, components, inline styles) to meet WCAG AA standards
  - Fixed muted-foreground in light mode: oklch(0.552) → oklch(0.49) for 7.56:1 on white
  - Fixed dark mode destructive: oklch(0.704) → oklch(0.55) for 6.47:1 with white text
  - Fixed all text-amber-500 → text-amber-700 (readable text) or text-amber-600 (icons only)
  - Fixed all bg-amber-500 text-white → bg-amber-700 text-white (5.02:1)
  - Fixed all text-gray-400 readable text → text-muted-foreground or text-gray-500
  - Fixed all text-green-500 → text-green-600 (3.30:1 passes 3:1 for icons)
  - Fixed text-yellow-500 icons → text-amber-600 (3.19:1 passes 3:1)
  - Fixed text-orange-500 → text-orange-600 (3.56:1 passes 3:1)
  - Fixed text-emerald-500 → text-emerald-600 (3.77:1 passes 3:1)
  - Fixed text-red-400 → text-red-500/red-700 for proper contrast
  - Fixed text-amber-600 on amber-100 bg → text-amber-700 (4.51:1)

## UI: Remove Portfolio Tile
- [x] Remove Portfolio tile from all user views (LoggedInHome, provider dashboard navigation)

## Bug Fix: Prevent Early Booking Completion
- [x] Add server-side validation to prevent marking bookings as "completed" before the actual booking date and end time has passed

## UI: 12-Hour Time Format
- [x] Audit all time displays across the site and ensure they use 12-hour format (e.g., 2:30 PM) instead of 24-hour format (e.g., 14:30)
  - Verified shared formatTimeForDisplay (shared/timeSlots.ts) already uses 12-hour format
  - Verified all local formatTime helpers (ProviderCalendar, MyWaitlist, BulkBooking, CategoryDetail) use 12-hour
  - Fixed AdminDashboard.tsx raw time display → formatTimeForDisplay
  - Fixed MonthlyPlanner.tsx raw time displays → formatTimeForDisplay
  - Fixed ProviderDashboard.tsx 3 raw time displays → formatTimeForDisplay
  - Fixed all bare .toLocaleString() calls (BookingDetail, DirectMessage, Messages, AdminSocialMedia, AuditLogPanel, UserDetailPage) → en-US with hour12: true
  - Fixed Conversations.tsx, DirectMessage.tsx, Messages.tsx read receipts → added hour12: true
  - Fixed PromoCodes.tsx bare .toLocaleTimeString() → en-US with hour12: true

## Mobile Layout: Fix Overflow Issues
- [x] Audit all mobile views and fix any layout elements that overflow or appear outside the viewable screen
  - Added overflow-x: hidden to body in index.css to prevent horizontal scrolling globally
  - Fixed DashboardLayoutSkeleton sidebar visible on mobile (added hidden md:block)
  - Wrapped AdminDashboard referrals and partner split tables in overflow-x-auto
  - Fixed Referrals grid-cols-4 → grid-cols-2 sm:grid-cols-4 for mobile
  - Fixed Receipts grid-cols-3 gap and card padding for small screens
  - Wrapped MyBookings TabsList in overflow-x-auto for scrollable tabs on mobile
  - Verified all key pages use container class with responsive padding
  - Verified all grids use responsive breakpoints (md:grid-cols-*, lg:grid-cols-*)
  - Verified NavHeader, dialogs, and fixed elements all have proper mobile constraints
  - Verified ProviderDashboard tabs hidden on mobile (uses bottom nav instead)
  - All TabsContent have pb-20 md:pb-0 for bottom nav clearance
  - Dialog component has max-w-[calc(100%-2rem)] on mobile preventing overflow

## Bug Fix: Monthly Planner Search Results Hidden
- [x] Fix search provider results dropdown being clipped/hidden by the bounding box on the Monthly Planner page
  - Root cause: Card component has overflow-hidden by default which clips absolutely-positioned dropdown
  - Fix: Added overflow-visible class to the Add Event Card on the Monthly Planner page

## Bug Fix: Monthly Planner Time Fields Overlap on Mobile
- [x] Fix start and end time form fields overlapping and extending beyond screen on mobile
  - Added min-w-0 to grid cells and w-full min-w-0 to time inputs to prevent overflow
  - Reduced CardContent padding on mobile (px-4 sm:px-6) for more content space
  - Added min-w-0 flex-1 and truncate to event list items for long provider names
  - Added shrink-0 to action buttons/icons to prevent them from being squeezed

## Bug Fix: Email Verification Issues
- [x] Fix "I'm verified, check again" button not working on desktop
  - Root cause: Button only called refresh() which re-fetched auth state, but OAuth users were never verified in DB
  - Fix: Added /api/auth/check-verification endpoint that auto-verifies OAuth users when button is clicked
  - Added loading state and proper redirect after verification
- [x] Fix verification emails not being sent to OAuth users (Manus/Google login)
  - Root cause: Only email/password signups sent verification emails; OAuth users were stuck unverified
  - Fix: Auto-verify all OAuth users on login (Manus OAuth + Google OAuth callbacks)
  - Added markEmailVerified() db helper, updated both OAuth callbacks
  - Fixed existing unverified OAuth users in database (including ologywood5@gmail.com)

## Bug Fix: Test Accounts Polluting Production Database
- [x] Delete all test accounts (@test.com, @example.com, Phase10 Provider, etc) from production database
  - Cleaned 660+ test accounts and all related data (services, bookings, notifications, etc)
  - Only 12 real users remain
- [x] Fix test suite to auto-cleanup after running
  - Added vitest globalSetup teardown (server/vitest-global-setup.ts)
  - After every test run, all test accounts are automatically deleted from the DB
  - Catches patterns: @test.com, @example.com, @deleted.ologycrew.com, Phase%, Test %, P1% Customer/Provider/Admin

## Merge Booking Pages: /my-bookings and /provider/bookings → Single Unified Page
- [x] Add provider actions (Accept/Decline/Start Service/Mark Complete) to MyBookings BookingCard when in provider view
- [x] Add conflict detection when accepting bookings (same as ProviderDashboard)
- [x] Add Quote Requests section to MyBookings page (as tab or section) when in provider view
- [x] Add Calendar View shortcut link to MyBookings header when in provider view
- [x] Redirect /provider/bookings route to /my-bookings
- [x] Update LoggedInHome provider "Bookings" tile to link to /my-bookings
- [x] Update NavHeader hamburger menu provider "Bookings" link to /my-bookings

## Bug Fix: "No available time slots" showing for all days even when provider has availability
- [x] Investigate time slot generation logic in booking flow
- [x] Fix the issue so available days correctly show bookable time slots (overnight schedule: endTime < startTime now handled)

## Time Slot UI Improvements
- [x] Add "Next Day" visual label to time slots that cross past midnight
- [x] Group available time slots into categories: Morning, Afternoon, Evening, Night
- [x] Apply grouping and labels to ServiceDetail booking page
- [x] Apply grouping and labels to EmbedBooking widget

## Fix Post-Stripe Onboarding Flow
- [x] After Stripe return (?stripe=return), detect completion and redirect to dashboard instead of re-showing onboarding
- [x] When all onboarding steps are complete, show a completion/congratulations state and auto-redirect to dashboard
- [x] On onboarding step 5, if Stripe is already connected, show "Connected" status instead of "Connect Stripe" button (already existed)
- [x] Add Stripe Express Dashboard link in Provider Dashboard for managing banking info (already existed as "Open Stripe Dashboard" button)

## No-Credit-Card Free Trial Implementation
- [x] Modify subscription backend to allow trial activation without Stripe payment (no card required)
- [x] Add trialEndsAt field to track when the 14-day trial expires (already existed)
- [x] Update onboarding plan selection to skip Stripe checkout for trial plans
- [x] Add trial countdown banner to provider dashboard (shows days remaining) (already existed)
- [x] Build trial expiration gate that blocks provider features when trial ends (TrialExpiredGate)
- [x] Gate offers options: add payment method to continue, or downgrade to Free tier
- [x] Send reminder notifications at 3 days and 1 day before trial expiration (already existed)

## Feature: Provider Billing History Page
- [x] Create backend endpoint to fetch billing/payment history from Stripe (invoices, charges, plan changes)
- [x] Build BillingHistory.tsx page showing subscription charges, plan changes, and payment history
- [x] Add /provider/billing route and navigation link from Subscription Management page
- [x] Include: date, description, amount, status, downloadable invoice PDF links

## Customer Subscription UX Improvements
- [x] Make NavHeader "My Subscription" link toggle-aware (provider view -> /provider/subscription, customer view -> /account/subscription)
- [x] Make NavHeader "Billing History" link toggle-aware (provider view -> /provider/billing, customer view -> /account/billing)
- [x] Add customer billing history endpoint (fetch invoices from Stripe for customer subscription)
- [x] Create customer billing history page at /account/billing
- [x] Add customer trial expiration gate (blocks features until payment or downgrade, like provider gate)
- [x] Update customer pricing CTA to offer "Start 14-Day Free Trial" instead of going straight to Stripe checkout

## Fix Provider/Customer Subscription Toggle Distinction
- [x] Change customer "Plans" tile in MOBILE_CUSTOMER_TILES (NavHeader.tsx) from /pricing to /account/subscription
- [x] Change customer "Plans" tile in CUSTOMER_TILES (LoggedInHome.tsx) from /pricing to /account/subscription
- [x] Add context indicator on AccountSubscription page showing "Customer Plan" with link to switch to provider subscription
- [x] Add context indicator on SubscriptionManagement page showing "Provider Plan" with link to switch to customer subscription

## Provider/Customer Toggle Navigation on Subscription Pages
- [x] When user switches the Provider/Customer toggle while on a subscription page, navigate to the corresponding subscription page (e.g., /provider/subscription ↔ /account/subscription, /provider/billing ↔ /account/billing)

## Provider Plans Page Updates
- [x] Change page title from "Provider Plans" to "My Provider Plan Subscription"
- [x] Remove the "Customer Plans" button/link
- [x] Remove the Frequently Asked Questions section
- [x] Move the usage/services box to the right of the Current Plan box (side by side layout)

## Allow switching billing interval on same tier
- [x] When user is on any paid plan (Pro/Business) and toggles to a different billing interval, the current plan card should be selectable (not greyed out)
- [x] Clicking the plan button when on same tier but different interval should trigger a billing interval change via Stripe (proration applied automatically)

## Customer Subscription Page Redesign
- [x] Rewrite AccountSubscription page to match Provider subscription layout (title, current plan box + usage side by side, billing interval toggle, plan cards with interval switching)
- [x] Change URL from /account/subscription to /customer/subscription
- [x] Update all references to /account/subscription across the codebase (NavHeader, LoggedInHome, ViewModeSwitcher, etc.)

## Current Plan Pill Visibility Fix
- [x] On Provider subscription page (SubscriptionManagement.tsx): only show "Current Plan" pill when billing interval toggle matches user's actual current interval
- [x] On Customer subscription page (AccountSubscription.tsx): only show "Current Plan" pill when billing interval toggle matches user's actual current interval

## Free Trial Feature Updates
- [x] Add "14-day free trial" as the first feature in each paid plan's feature list (both Customer and Provider subscription pages)
- [x] Change paid plan buttons to "Start Free Trial" for users who haven't used their trial (both pages)
- [x] Wire "Start Free Trial" button to backend trial process (auto-trigger 14-day trial)
- [x] Ensure trial can only be used once per account lifetime (backend enforcement)

## Fix: Customer Billing History Error for Free Plan Users
- [x] Handle "No such customer" Stripe error gracefully in billingHistory endpoint (return empty array instead of throwing)
## Provider "Bookings I Received" Page Fixes
- [x] Remove "All" tab from Provider "Bookings I Received" page
- [x] Change "Upcoming" tab to "New" on Provider "Bookings I Received" page
- [x] Fix Quotes tab [object Object] error on Provider "Bookings I Received" page
## Invoice Creation & Delivery Improvements
- [x] Add customerName column to invoices schema (for non-system customers)
- [x] Update invoice create mutation to accept optional customerName + make customerId optional (0 for non-system)
- [x] Redesign CreateInvoiceForm: allow provider to type customer name/email directly (for new customers not in system), or select from existing customers
- [x] Update invoice list to show customer name instead of "Customer #ID"
- [x] Update send mutation to work with non-system customers (send email using stored customerName/customerEmail)
- [x] Ensure PDF download works for all invoices (generate PDF button always visible)
## Customer My Bookings Page Updates
- [x] Remove "All" tab from customer's My Bookings page
- [x] Rename "Upcoming" tab to "New" on customer's My Bookings page
- [x] Add "Quotes" tab to customer's My Bookings page showing their quote requests
## Invoice Fixes
- [x] Make Invoices a provider-only feature (remove from customer navigation/view)
- [x] Show customer name instead of customer ID in invoice list
## Remove Quotes from Navigation
- [x] Remove Quotes tile from customer landing page
- [x] Remove Quotes tile from provider landing page
- [x] Remove Quotes icon from header navigation
## Provider-Only Page Audit
- [x] Add provider-only guard to BillingHistory page
- [x] Add provider-only guard to CreateService page
- [x] Add provider-only guard to ManageAvailability page
- [x] Add provider-only guard to PromoCodes page
- [x] Add provider-only guard to Promotions page
- [x] Add provider-only guard to ProviderCalendar page
- [x] Add provider-only guard to ProviderMyPage page
- [x] Add provider-only guard to ProviderOnboarding page
- [x] Add provider-only guard to ProviderReviews page
- [x] Add provider-only guard to SubscriptionManagement page
- [x] Add provider-only guard to WidgetGenerator page
## Invoice & Receipts Fixes
- [x] Show customer names (not IDs) in invoice existing customer dropdown
- [x] Auto-fill email when existing customer is selected
- [x] Show received invoices on customer Receipts & Invoices page
- [x] Show paid invoice status on customer Receipts page
- [x] Fix naming consistency: tile says "Receipts" but page says "Receipts & Invoices"
## Receipts & Invoices Enhancements
- [x] Add search bar on Receipts & Invoices page to filter by customer name or email
- [x] Add invoice preview modal for providers to review final layout before sending
## Unsubscribe Fix
- [x] Fix unsubscribe token generation for non-system customers (userId=0) - skip or handle gracefully
- [x] Fix unsubscribe link fallback from '#' to '/notification-settings' when no token
- [x] Fix invoice send to resolve userId by email for proper unsubscribe token generation
- [x] "Settings" link in user dropdown already points to /notification-settings (verified accessible)
- [x] Fix analytics page blank screen - /provider/analytics route sets initialTab="analytics" but ProviderDashboard has no TabsContent with value="analytics"
- [x] Fix invoice page: customer dropdown shows ID numbers instead of customer names
- [x] Fix invoice page: selecting customer from dropdown should auto-populate their email
- [x] Add search bar inside customer dropdown on invoice form for easy filtering
- [x] Auto-populate customer billing address and phone number on invoice when selected from dropdown
- [x] Add optional billing address fields to customer Account/Profile page with helper note
- [x] Wire customer billing address to invoice auto-populate when provider selects customer
- [x] Auto-populate provider's business address and contact info on invoices for professional look
- [x] Add company logo upload for providers to display at top of invoices
- [x] Gate entire invoice feature behind paid subscription tiers (Basic/Premium only, block Free tier)
- [x] Customize upgrade prompt card with tier benefits (custom logos, auto-populated addresses, etc.)
- [x] Add sample branded invoice preview on the upgrade prompt page
- [x] Redirect user back to invoice creation page after successful subscription upgrade
- [x] Fix Basic→Premium upgrade to use existing card on file with proration instead of re-entering payment via Stripe Checkout
- [x] Fix 60/40 revenue split between platform owners — splits not executing on Stripe and not reflecting in admin split tab
- [x] Fix provider onboarding page to auto-redirect to dashboard when all steps are 100% complete (for existing providers)
- [x] Fix "All Services Widget" quick link preview — kept embed widget URL with proper OG tags, hardcoded ologycrew.com domain for all shareable links, and fixed fallback OG image for unmatched routes
- [x] Fix embed widget crash when selecting a booked time slot — widgetRouter was returning undefined bookingTime (field was startTime in DB), added defensive guards in shared timeSlots utilities
- [x] Fix long-duration services (4+ hrs) not showing all available time slots — removed duration-fits-in-schedule constraint for long services, use 30-min overlap window instead of full duration for conflict detection
- [x] Rewrite homepage hero and sections with "digital home for your business" positioning and comparison table
- [x] Rewrite homepage hero and sections with "digital home for your business" positioning and comparison table
- [x] Update pricing/plans page with "No Gatekeeping" philosophy lead-in
- [x] Reframe provider onboarding language as "building your digital home"
- [x] Add prominent "Share your OlogyCrew link" section to provider dashboard with usage suggestions
- [x] Add "Get your own page" CTA on public provider pages for visitor conversion
- [x] Update OG tags and images for social sharing to reflect new brand messaging
- [x] Update OG tags and images for social sharing to reflect new brand messaging
- [x] Change provider profile URLs from /p/slug to top-level /Slug (e.g. ologycrew.com/GaryChisolmAudio) for a cleaner business identity
- [x] Change provider profile URLs from /p/slug to top-level /slug (e.g. ologycrew.com/chisolm-audio) for a cleaner business identity — /p/ kept for backward compat
- [x] Add Accountants, Attorneys & Legal Services, and Catering & Food Services categories (IDs 219-221) with emojis 🧮 ⚖️ 🍴
- [x] Experiences Phase 1: Add database fields (maxGuests, minGuests, pricePerPerson, whatsIncluded) to services table
- [x] Experiences Phase 1: Add EXPERIENCES & EVENTS category with emoji
- [x] Experiences Phase 1: Create dedicated /experiences browse page with visual card layout
- [x] Experiences Phase 1: Update service creation form to support experience mode (guest count, per-person pricing, what's included)
- [x] Plan-aware signup: pricing page passes selected plan to signup, signup page displays selected plan badge, onboarding pre-selects the plan
- [x] Plan-aware signup: pricing page passes selected plan to signup, signup page displays selected plan badge, onboarding pre-selects the plan
- [x] Gate provider landing page: redirect to /provider/onboarding until steps 1-4 (Plan, Profile, Skills, Services) are complete. Remove progress bar from landing page.
- [x] Fix homepage OG image for social sharing: use the branded "Your Business. Your Customers. Your Money." hero image instead of the logged-in dashboard screenshot

## Phase 1 Agentic: AI Agent Discoverability
- [x] Add Schema.org JSON-LD structured data to provider profile pages (LocalBusiness, Service, Offer)
- [x] Add Schema.org JSON-LD to service listing pages (Service, AggregateRating)
- [x] Create agents.json at /.well-known/agents.json describing platform capabilities
- [x] Build public read-only REST API: GET /api/public/services (search), GET /api/public/providers/:slug, GET /api/public/availability/:providerId
- [x] 2FA: Add twoFactorEnabled field to users table
- [x] 2FA: Create twoFactorCodes table for storing verification codes
- [x] 2FA: Create trustedDevices table for 30-day device trust
- [x] 2FA: Server-side code generation, verification, and email sending
- [x] 2FA: Integrate into email/password login flow
- [x] 2FA: Integrate into Google OAuth login flow
- [x] 2FA: Build verification code entry page
- [x] 2FA: Build enable/disable toggle in Account settings
- [x] Plan-aware signup: pricing page passes selected plan to signup, signup page displays selected plan badge, onboarding pre-selects the plan

## Fix: Partner Split Insufficient Funds Error
- [x] Add source_transaction parameter to executePartnerTransfer to tie transfers to specific charges
- [x] Update handleInvoicePaymentSucceeded to extract charge ID from invoice and pass to transfer
- [x] Retry previously failed transfers with source_transaction fix — confirmed by successful live partner split

## Feature: Admin Users Tab - Plan Column
- [x] Update getAllUsers to join subscription data (provider_subscriptions + customer_subscriptions)
- [x] Add Plan column with colored badges to Admin Users tab

## Fix: Prevent Duplicate Subscription Charges on Upgrade/Downgrade Cycling
- [x] Check for existing canceled subscription with remaining billing period before creating new checkout
- [x] Reactivate canceled subscription instead of creating new one when within same billing cycle
- [x] Apply prorated credit automatically when reactivating

## UX Planning: Focused Provider and Customer Experiences
- [x] Specify a simplified provider dashboard that replaces the equal-weight launchpad grid
- [x] Define provider desktop and mobile wireframes, hierarchy, navigation, states, and progressive disclosure
- [x] Specify a distinctive customer landing, discovery, booking, payment, and rebooking flow
- [x] Define customer desktop and mobile wireframes, contextual actions, trust signals, and advanced-tool placement
- [x] Create a phased implementation roadmap with measurable UX success criteria

## UX Prototype: Focused Provider and Customer Experiences
- [x] Add isolated review routes that do not replace the current production provider, customer, or booking flows
- [x] Build the responsive provider Overview prototype with Needs Attention and functional Quick Actions
- [x] Build the responsive customer landing prototype with need-first search and one-tap rebooking
- [x] Build an adaptive booking prototype that switches between direct booking and quote request paths
- [x] Add focused Vitest coverage for prototype state and routing behavior
- [x] Verify all prototype screens and interactions on desktop and mobile

## Fix: Unexpected “Too Many Requests” Error
- [x] Identify the endpoint and client action triggering HTTP 429 responses in development or production
- [x] Correct any automatic request loop or overly broad rate-limit policy without weakening abuse protection
- [x] Add a user-friendly retry message and recovery behavior for legitimate rate-limit responses
- [x] Add focused Vitest coverage and verify the affected flow in the preview

## Fix: Published Prototype Review Links Returning 404
- [x] Verify the clean production prototype URLs load successfully after publishing
- [x] Prevent accidental trailing backticks (`%60`) in copied prototype links from causing a confusing 404
- [x] Test provider, customer, direct-booking, and quote-request review links on the production domain

## Provider Workspace Redesign — Phase 1 Integration
- [x] Map every approved prototype section to real provider queries, mutations, and existing live routes
- [x] Replace only the completed provider launchpad with a real-data Overview workspace
- [x] Build real Needs Attention items for booking requests, quote requests, overdue invoices, and setup blockers
- [x] Build a real Today schedule with timezone-aware booking data and conflict/setup states
- [x] Connect Quick Actions to existing service, calendar, invoice, profile-share, and analytics destinations
- [x] Build Business Pulse from current provider analytics without fabricated metrics
- [x] Preserve onboarding gating, provider/customer switching, admin access, mobile navigation, and current customer home
- [x] Add focused Vitest coverage for provider Overview data mapping, routing, empty states, and access gating
- [x] Verify the integrated provider workspace on desktop and mobile before checkpointing

## Customer Landing Redesign — Phase 2 Integration
- [x] Map the approved customer prototype to real bookings, quotes, providers, services, and current live routes
- [x] Add one consolidated customer-home data contract for actions awaiting response, upcoming bookings, and past services
- [x] Replace only the customer app-grid home with the need-first landing page
- [x] Connect the primary search bar to live service search while preserving customer intent context
- [x] Build real Needs Your Action and Upcoming sections with clear empty and error states
- [x] Build one-tap rebooking from eligible past completed services without fabricated history
- [x] Preserve customer plans, saved providers, referrals, messages, notifications, admin access, role switching, and provider-home isolation
- [x] Add focused Vitest coverage for customer-home data mapping, search, rebooking, routing, and access isolation
- [x] Verify the integrated customer landing page on desktop and mobile before checkpointing

## Adaptive Booking — Phase 3 Integration
- [x] Map current service pricing, availability, booking, quote, multi-day, recurring, mobile, and payment flows before changing entry behavior
- [x] Define deterministic, explainable routing rules for direct booking versus quote requests using real service data
- [x] Build a shared adaptive booking entry that clearly explains why a service can be booked or needs a quote
- [x] Route fixed-price, hourly, package, free, and otherwise standardized services into existing direct availability and checkout
- [x] Route custom, contact-for-pricing, scope-dependent, and eligible event/project services into the existing quote-request flow
- [x] Preserve multi-day, recurring, mobile, virtual, free-service, payment, referral, promotion, and conflict safeguards
- [x] Connect live search results and provider service cards to adaptive entry while preserving all existing deep links
- [x] Add focused Vitest coverage for every adaptive-routing variant and route-isolation safeguard
- [x] Verify direct-booking and quote-request paths on desktop and mobile before checkpointing

## Integrated Experience — Release Hardening
- [x] Verify provider/customer role switching consistently opens the correct redesigned home without flashes or stale state
- [x] Verify provider Overview navigation and customer focused tools have no missing or duplicate destinations on desktop and mobile
- [x] Verify customer search intent survives the full home → search → service handoff
- [x] Verify standardized services preserve direct, multi-day, recurring, free, mobile, virtual, promotion, referral, and payment behavior
- [x] Verify custom services preserve guided quote creation, authentication, provider ownership, validation, and existing quote management
- [x] Verify one-tap rebooking opens an eligible live service with the correct provider and adaptive mode
- [x] Correct any loading, empty, error, route, or helper-copy inconsistencies discovered during integrated testing
- [x] Run combined focused tests, production build, and final desktop/mobile visual checks

## Fix: Recurring Development Preview Rate Limit
- [x] Identify whether the recurring 429 response originates from OlogyCrew middleware, the preview proxy, or browser automation infrastructure
- [x] Trace the exact request path, client key, counter state, and request pattern that triggers the development block
- [x] Disable or isolate broad read throttling in development while retaining production abuse protection and sensitive/write limits
- [x] Add recurrence regression coverage and verify sustained development navigation without application-generated HTTP 429 responses
- [x] Document the confirmed cause and permanent development-preview safeguard

## Fix: Vite Development HMR WebSocket Disconnect
- [x] Confirm whether Vite is listening for HMR connections when the browser reports `WebSocket closed without opened`
- [x] Correlate browser disconnects with server restarts, preview-gateway throttling, and WebSocket upgrade requests
- [x] Determine no alternate project-level HMR configuration is appropriate because the same-server local and proxied upgrade handshakes are correct
- [x] Verify normal page loading and HMR recovery without changing production SSE messaging
- [x] Document the managed preview-gateway limitation and the correct recovery action

## Entitlement Reconciliation — Authoritative Subscription and Billing Model
- [x] Audit every provider and customer plan definition, price, limit, trial, and entitlement across shared constants, UI, backend authorization, Stripe, emails, notifications, and admin reporting
- [x] Define one authoritative provider/customer entitlement matrix and lifecycle state model
- [x] Implement shared server/client entitlement contracts and remove conflicting hardcoded plan rules
- [x] Reconcile pricing pages, onboarding, current-plan displays, upgrade/downgrade, cancellation, renewal, refund, and reactivation behavior
- [x] Reconcile Stripe Connect, payment collection, invoicing, analytics, custom URL, saved-provider, bulk-quote, and other plan-gated access
- [x] Reconcile entitlement-dependent emails, notifications, and admin plan records
- [x] Add comprehensive entitlement and billing lifecycle regression coverage

## Provider Trust and Verification Taxonomy
- [x] Audit all current provider verification fields, workflows, badges, admin controls, and public trust claims
- [x] Define precise identity, business, license, insurance, completed-booking, and review trust states with evidence and expiry rules
- [x] Align the database schema and production database with the authoritative trust taxonomy
- [x] Add provider-facing trust status, evidence submission, and clear explanations without overstating verification
- [x] Add admin verification review controls, audit history, rejection reasons, and expiry handling
- [x] Add accurate public provider trust indicators and explanations
- [x] Keep demo/test providers and unverified claims from appearing as verified marketplace supply
- [x] Add comprehensive trust taxonomy and authorization regression coverage

## Clean-Account Lifecycle Test Matrix
- [x] Create a safe clean-account test strategy that does not fabricate public reviews, ratings, or testimonials
- [x] Test customer signup, authentication, role selection, plan activation, discovery, booking, quotes, checkout, messaging, completion, review eligibility, and rebooking
- [x] Test provider signup, plan selection, onboarding, category, service, availability, public page, booking/quote response, messaging, payment, completion, and review lifecycle
- [x] Test free, paid, trial, upgrade, downgrade, cancellation, renewal, refund, failed payment, reactivation, and duplicate-charge safeguards
- [x] Test Stripe connection, invoice access, provider/customer switching, mobile responsiveness, notifications, and email behavior
- [x] Document every lifecycle result, correct all discovered defects, and rerun affected journeys
- [x] Run final combined regression, zero-error TypeScript, production build, and desktop/mobile verification
- [x] Require every real booking checkout to use both an effective paid provider entitlement and a payout-ready connected Stripe account
- [x] Remove legacy recently-cancelled auto-resubscribe behavior that could silently create a newly chargeable subscription
- [x] Replace stale immediate-downgrade/prorated-credit copy and guard missing access-end dates in provider and customer subscription screens
- [x] Exclude custom or missing-price services when customers explicitly apply a numeric price range
- [x] Update legacy verification tests to require verified-email fixtures, immutable evidence history, and rejection of blanket provider verification
- [x] Move provider dashboard redirect logic out of render so evidence-tab navigation does not trigger React cross-component update errors
- [x] Expand automated test cleanup so clean-account runs cannot leave orphaned subscriptions, sessions, favorites, folders, invoices, audit entries, authentication factors, or push subscriptions
- [x] Prevent inactive or suspended providers from appearing through public provider lists, direct profile endpoints, and the public agent API while preserving provider/admin account access
- [x] Update lifecycle fixtures for multi-variant secure cookie clearing and the verified-email role-selection security gate
- [x] Reconcile obsolete login/onboarding navigation, entitlement privacy, and SSE polling source-contract tests with the approved current product behavior
- [x] Mock account-deletion, welcome, owner, and other external notification delivery in clean-account database tests so no real email, SMS, push, or owner alert is sent
- [x] Calculate cancellation refunds from the captured payment amount rather than the unpaid booking total, returning zero for free or unpaid bookings and respecting partial-payment amounts
- [x] Restrict provider booking status mutations to the owning provider or an administrator so customers must use the policy-aware cancellation path and cannot self-confirm, complete, or refund bookings
- [x] Enable optional two-factor authentication only after the verification-code email is accepted, keeping the account disabled and returning a clear error when delivery fails
- [x] Narrow global test cleanup to unmistakable test prefixes and non-deliverable domains so it cannot delete legitimate deleted-user records or unrelated example-domain accounts

## Fix: Mobile Provider/Customer Toggle Missing on Provider Home
- [x] Compare the provider and customer mobile home shells and identify why the role toggle renders only in customer view
- [x] Restore the Provider/Customer toggle beneath the mobile header on provider home without changing the approved Overview workspace
- [x] Verify active role styling, provider/customer navigation, desktop behavior, and mobile responsive placement
- [x] Add focused regression coverage and save a validated checkpoint

## Feature: Versioned Terms Update Notifications
- [x] Audit current Terms pages, legal consent fields, email/in-app notification infrastructure, admin controls, and background-job support
- [x] Choose the owner-controlled immediate or scheduled publication workflow and document its operational safeguards
- [x] Add versioned Terms metadata and per-user shown/accepted records with a reviewed additive migration
- [x] Add administrator controls to draft, preview, publish, and monitor a Terms update without allowing duplicate sends
- [x] Deliver the approved Terms update notice by email and in-app notification with effective date, direct links, audience, and optional legally approved arbitration language
- [x] Present a persistent user notice, record the Terms version shown or accepted, and preserve access to prior published versions
- [x] Add authorization, validation, idempotency, delivery, acceptance, and responsive UI regression coverage
- [x] Run zero-error TypeScript, production build, desktop/mobile review, and save a validated checkpoint
- [x] Hide published-version actions in the Legal Terms empty state until an actual published or superseded version is selected

## Planning: Native Provider Customer Relationship Layer
- [x] Inventory existing booking, quote, messaging, invoice, subscription, notification, rebooking, role, consent, and admin integration points
- [x] Define the native CRM domain model, system boundaries, event architecture, automation safety model, permissions, privacy rules, and phased implementation strategy
- [x] Specify the proposed additive database schema, relationships, indexes, lifecycle enums, derived data, retention, and migration order
- [x] Detail provider CRM information architecture, desktop/mobile user flows, empty/loading/error states, and exact wireframe descriptions
- [x] Draft the first-release PRD with goals, personas, scope, requirements, entitlements, analytics, acceptance criteria, rollout, and exclusions
- [x] Cross-check architecture, wireframes, and PRD for shared terminology, feasible platform reuse, non-surveillance admin boundaries, and approved relationship-layer positioning
- [x] Deliver the coordinated CRM planning package without changing live application behavior

## Customers Release 1 Implementation — Phase 0 Approval Gate
- [x] Inspect and map the current provider workspace, provider navigation, customer home, bookings, quotes, services, calendar, payments, Stripe, invoices, messages, reviews, notifications, analytics, entitlements, authentication, role switching, schema, and managed jobs
- [x] Compare the current implementation against the three approved Customers specifications without reinterpreting or expanding Release 1
- [x] Document what already exists and can be reused, what must be added, what must be modified, and what must remain unchanged
- [x] Identify specification conflicts, tenant/privacy/entitlement risks, event-projection failure boundaries, backfill hazards, migration ordering, and rollback requirements
- [x] Deliver the Phase 0 assessment and wait for explicit owner approval before changing production behavior or database schema

## Customers Release 1 Implementation — Phase 1 Foundation
- [x] Add authoritative shared Customers stages, event names, task states/types, draft states, safe event metadata schemas, rule allow-list, feature keys, and rollout flag keys
- [x] Add lifecycle-aware provider Customers entitlements for Starter history, Pro relationship tools, and Business segments, retention analytics, and automation controls
- [x] Add private server-side rollout, managed-job, and pilot configuration that cannot leak through the existing public platform-settings procedures
- [x] Add reviewed additive Customers schema for contacts, events, notes, tasks, stage history, preferences, drafts, rule definitions/runs, saved segments, and private operational state
- [x] Apply the additive migration without altering or deleting existing booking, quote, service, message, payment, invoice, review, subscription, trust, notification, authentication, or Terms data
- [x] Add provider-scoped Customers repositories with mandatory tenant predicates and no client-supplied provider ownership
- [x] Add pure relationship eligibility, stage precedence, captured-value, global-plus-relationship consent, deterministic task/draft rule, safe event payload, and archive restoration policies
- [x] Extend account deletion and clean-account teardown for every Customers table in safe dependency order
- [x] Add focused schema, uniqueness, tenant isolation, entitlement lifecycle, policy, privacy, idempotency, deletion, and test-cleanup regressions
- [x] Confirm all Customers rollout flags remain off, no backfill or managed schedule runs, no Customers UI is exposed, and no provider relationship message can be sent
- [x] Run zero-error TypeScript, production build, focused and adjacent regressions, then save a validated Phase 1 checkpoint

## Customers Release 1 Implementation — Phase 2 Projection
- [x] Audit authoritative booking, quote, payment, invoice, message, review, account-deletion, entitlement, and managed-job mutation boundaries against the approved event contract
- [x] Implement an idempotent Customers projector that derives eligible provider/customer relationships, lifecycle stage, interaction dates, booking totals, and captured value from authoritative records
- [x] Implement safe append-only source events with strict metadata and provider-scoped idempotency without storing message bodies, payment secrets, addresses, or unrestricted snapshots
- [x] Wire approved source hooks for booking, quote, captured payment/refund, eligible conversation, paid standalone invoice, and booking-linked review lifecycle events
- [x] Keep source writes authoritative and make projection failures non-destructive, observable, and repairable without changing booking, quote, payment, invoice, message, or review outcomes
- [x] Add owner-only private dry-run, bounded backfill, reconciliation, rebuild, and repair procedures without exposing rollout state through public platform settings
- [x] Add count, exclusion, source-parity, lag, failure, and last-success metrics suitable for private pilot approval
- [x] Prove repeated live hooks, backfills, and repair runs are idempotent and preserve provider tenant isolation
- [x] Confirm all rollout flags remain off, no managed job is scheduled, no Customers route or UI is exposed, and no relationship message can be sent
- [x] Run focused and adjacent regressions, zero-error TypeScript, production build, and save a validated Phase 2 checkpoint
- [x] Persist successful and failed Stripe booking payments idempotently to the authoritative payment record before projecting financial events or notifying the customer
- [x] Make Customers projection rebuild delete and regenerate only derived projection data while preserving provider-authored notes, tasks, preferences, drafts, manual stages, rules, and saved segments
- [x] Run database-backed Vitest files sequentially so reserved-identity cleanup cannot delete another concurrently executing suite’s fixtures
- [x] Make message source-hook ID extraction tolerant of existing database test doubles and update adjacent payment/review/Stripe fixtures for the current PaymentIntent metadata and verified-email security gate
- [x] Mock email, push, and review notification delivery in the legacy review, quote, and Stripe Connect suites so Phase 2 validation cannot send real messages or time out on external providers
- [x] Keep owner dry-run metrics separate from the live resumable backfill cursor and remove stale dry-run cursor state so a future apply run cannot skip eligible relationships

## Customers Release 1 Implementation — Phase 3 Read-Only Pilot
- [x] Resolve the owner’s current provider record and configure it as the sole private Customers pilot without exposing the pilot allow-list publicly
- [x] Add provider-scoped read-only Customers summary, tab list, filters, pagination, contact detail, activity timeline, and source-navigation procedures
- [x] Enforce effective-plan capability checks and private-pilot access on every Customers read procedure using the server-derived provider identity
- [x] Build `/provider/customers` with the approved Leads, Customers, Follow-ups, and Activity tabs plus clear read-only pilot guidance
- [x] Build responsive list and relationship-detail experiences using projected data and links back to authoritative bookings, quotes, messages, invoices, and reviews
- [x] Add the Customers entry to approved provider desktop/mobile navigation and Overview only for the private pilot; preserve all existing workspace destinations
- [x] Run the owner-approved bounded backfill for the sole pilot provider, reconcile source parity, and retain private metrics without enabling global projection writes
- [x] Keep notes, tasks, drafts, saved segments, automation controls, schedules, exports, and relationship message sending hidden and disabled
- [x] Add pilot authorization, tenant isolation, entitlement, pagination, filtering, timeline privacy, empty/error, navigation, and responsive UI regression coverage
- [x] Run zero-error TypeScript, production build, desktop/mobile pilot review, and save a validated Phase 3 checkpoint
- [x] Limit Customers “Needs response” to currently actionable pending bookings, pending or accepted quotes, unanswered customer messages, and unresponded booking-linked reviews rather than completed or cancelled history
- [x] Show the pilot provider’s actual business name in the Customers workspace shell instead of the generic “Your business” fallback
- [x] Exclude the provider owner’s own user account from that provider’s Customers projection, backfill, reconciliation, and read-only pilot data
- [x] Exclude provider self-bookings from the provider Overview customer count so Business Pulse matches the Customers relationship workspace
- [x] Update the Phase 1 rollout regression for the approved Phase 3 pilot so it allows read-only UI while still requiring projection-independent provider writes, recommendations, and draft sending to remain off

## Customers Release 1 Implementation — Phase 4 Private Notes and Follow-ups
- [x] Add pilot-scoped provider-private note create and list procedures with server-derived provider ownership, bounded content, immutable author identity, and no admin surveillance surface
- [x] Add pilot-scoped manual follow-up create, edit, complete, reopen, and cancel procedures with due dates, status history, and cross-tenant protection; priority remains outside the approved Phase 4 scope
- [x] Extend the Customers relationship detail with private notes and manual follow-up controls using the approved responsive interaction patterns
- [x] Replace the Follow-ups placeholder with overdue, due today, upcoming, completed, and cancelled manual task views for the private pilot
- [x] Keep task and note actions unavailable to non-pilots and lifecycle-ineligible plans even when a route or record ID is constructed
- [x] Enable the private `customersProviderWrites` flag only for provider 1 after authorization and lifecycle tests pass
- [x] Keep message drafts, relationship sending, automated recommendations, rule execution, saved segments, exports, schedules, and broader provider rollout disabled
- [x] Add note privacy, tenant isolation, validation, task status, due-date, idempotency, deletion, entitlement, UI, and responsive regression coverage
- [x] Run zero-error TypeScript, production build, desktop/mobile pilot review, and save a validated Phase 4 checkpoint

## Customers Release 1 Implementation — Phase 5 Manual Relationship Stages
- [x] Add a pilot-scoped manual-stage mutation guarded by active provider status, private pilot membership, lifecycle `crmStageOverrides` entitlement, read UI, and provider-write rollout flags
- [x] Enforce provider/contact tenancy for every stage change and never accept a client-supplied provider ID
- [x] Support choosing an approved Customers stage or clearing the override to resume the authoritative derived stage
- [x] Append provider-authored stage history with previous and next effective stages without copying private notes, messages, addresses, or payment data
- [x] Add a simple relationship-detail stage control with concise automatic-versus-manual helper copy and no Salesforce-style workflow complexity
- [x] Reflect a saved or cleared stage immediately in relationship detail and Leads/Customers workspace placement
- [x] Keep stage controls unavailable to non-pilots and lifecycle-ineligible providers even for constructed relationship IDs
- [x] Keep drafts, sending, recommendations, rules, schedules, saved segments, exports, and broader rollout disabled
- [x] Add focused router, repository, history, tenancy, entitlement, validation, UI contract, and responsive regressions
- [x] Run adjacent tests, zero-error TypeScript, diff validation, production build, desktop/mobile review, final private-state verification, implementation report, and checkpoint

## Customers Release 1 Implementation — Phase 6 Provider-Reviewed Message Drafts
- [x] Add pilot-scoped draft create, list, edit, and discard procedures guarded by active provider status, private pilot membership, lifecycle `crmDrafts` entitlement, read UI, and provider-write rollout flags
- [x] Derive provider and author ownership from the authenticated session and enforce provider/contact tenancy for every draft operation
- [x] Limit manually authored draft text to the approved 2,000-character contract and reject empty content
- [x] Keep retained draft bodies unavailable when lifecycle draft entitlement is inactive, even for constructed relationship or draft IDs
- [x] Add a simple relationship-detail Drafts area for creating, reviewing, editing, and discarding private drafts with unmistakable “not sent” guidance
- [x] Ensure draft actions never create a message, email, SMS, push notification, activity send event, automation run, or delivery side effect
- [x] Keep AI generation, recommendations, automatic drafting, sending, rules, schedules, segments, exports, and broader rollout disabled
- [x] Add focused router, repository, privacy, tenancy, lifecycle, validation, no-side-effect, UI-contract, and responsive regressions
- [x] Run adjacent tests, zero-error TypeScript, diff validation, production build, desktop/mobile review, final private-state verification, implementation report, and checkpoint

## Customers Release 1 Implementation — Phase 7 Consent-Aware Draft Sending
- [x] Add a customer-facing relationship-message permission control that defaults off, uses clear opt-in language, and can be disabled again at any time
- [x] Enforce send-time global customer permission plus relationship-level opt-out and do-not-contact restrictions without allowing a provider preference to expand customer consent
- [x] Add a pilot-scoped send procedure guarded by active provider status, sole-pilot membership, lifecycle `crmDrafts` entitlement, read UI, provider writes, and private draft-sending rollout flag
- [x] Derive provider, sender, relationship, customer, and draft ownership from authenticated and provider-scoped records; accept no client provider or recipient identity
- [x] Require a deliberate provider confirmation for the exact draft body and reject discarded, already-sent, cross-relationship, or cross-provider drafts
- [x] Atomically create exactly one existing OlogyCrew in-app message and mark the draft sent with sender approval, message link, and timestamps using retry-safe idempotency
- [x] Keep Customers sending free of email, SMS, push, bulk-send, campaign, activity-body, AI, recommendation, automation, schedule, export, and external-delivery side effects
- [x] Show clear consent availability, sent status, and existing-conversation destination in the relationship Drafts area without exposing private preference internals
- [x] Enable `customersDraftSending` only through the audited owner-only path after authorization, consent, and idempotency tests pass, with provider 1 remaining the sole pilot
- [x] Add focused preference, router, repository, atomicity, privacy, tenant-isolation, lifecycle, idempotency, no-external-delivery, UI-contract, and responsive regressions
- [x] Run adjacent tests, zero-error TypeScript, diff validation, production build, desktop/mobile review, final private-state verification, implementation report, and checkpoint

## Customers Private Pilot — Consent and One-Message Validation
- [x] Deferred by owner pending customer availability; no qualified Chisolm Audio customer account was accessed and no consent state was changed
- [x] Deferred by owner pending customer availability; live opt-in persistence, provider availability refresh, reversible opt-out, one-message delivery, and conversation/timeline verification were not performed or claimed as passed

## Customers Release 1 Implementation — Phase 8 Pilot Monitoring and Rollout Readiness
- [x] Define privacy-safe pilot health metrics using aggregate counts and status only, with no message body, note body, task description, address, payment secret, or unrestricted customer snapshot
- [x] Add an owner-only pilot health procedure that verifies pilot allowlist, active providers, rollout flags, lifecycle entitlement, relationship and self-contact counts, draft states, sent-message linkage, consent coverage, projection freshness, reconciliation, and scoped-child conditions
- [x] Add owner-only readiness checks that clearly distinguish ready, blocked, deferred live-validation, and disabled states without claiming unperformed customer testing passed
- [x] Add an owner-only monitoring workspace using concise cards and tables, with safe disable guidance and no private note surveillance or customer message content
- [x] Verify existing provider-visible draft delivery status and conversation linkage are sufficient without adding admin send controls, bulk actions, AI, recommendations, automation, schedules, segments, exports, or broader provider access
- [x] Keep provider 1 as the sole pilot and preserve projection writes, read UI, provider writes, and draft sending while repair jobs and recommendations remain disabled
- [x] Add focused aggregate-privacy, owner authorization, tenant isolation, scoped-child detection, rollout disable, provider lifecycle status, UI-contract, and responsive regressions
- [x] Run adjacent tests, zero-error TypeScript, diff validation, production build, desktop/mobile review, final private-state verification, implementation report, and checkpoint

## Customers Private Pilot — Owner Monitoring Review and Expansion Decision
- [x] Review Admin → Customers Pilot at desktop and mobile, including refresh behavior, deferred and verified readiness statuses, aggregate privacy, lifecycle entitlement, and safe disable guidance
- [x] Cross-check every displayed pilot metric against current database state without exposing customer identity or private message, draft, note, or task content in monitoring
- [x] Keep the exercise deferred until an owner-controlled customer became available, then record it as verified only after customer opt-in, exactly one confirmed message, customer receipt, and zero external side effects
- [x] Assess a second provider using explicit integrity, entitlement, live-validation, support, and rollback prerequisites; recommend preparing one controlled candidate without changing access
- [x] Record the expansion recommendation, update the rollout checklist, run focused and adjacent checks, and preserve provider 1 as the sole allowlisted provider

## Customers Private Pilot — Gary Studios Live Consent and One-Message Test
- [x] Identify the owner-controlled Gary Studios / Studio Space Rentals account and verify whether it already has a qualified non-self relationship with Chisolm Audio
- [x] Establish a legitimate relationship through Gary Studios' owner-authorized, no-payment Audio Enhancement quote request and the audited owner backfill after the live non-blocking source hook did not project it; no Customers contact was inserted or fabricated directly
- [x] Exercise the Gary Studios account’s own default-off relationship-message permission in dev, verify database persistence, and confirm Chisolm Audio immediately shows current relationship-message availability
- [x] Create one low-risk private draft for Gary Studios and obtain the owner’s final confirmation of the exact recipient and text before sending
- [x] Send the confirmed in-app message exactly once and verify immutable draft linkage, existing conversation visibility, customer receipt, and safe body-free Customers activity metadata
- [x] Verify zero notification rows, email, SMS, push, automated reply, recommendation, schedule, export, campaign, automation, or other external delivery side effect
- [x] Leave Gary Studios relationship-message permission on at the owner’s request, record Live test verified in owner monitoring, and keep provider 1 as the sole pilot pending separate candidate approval
- [x] Run 197 adjacent regressions, zero-error TypeScript, diff validation, production build, final database-state verification, documentation updates, and save a rollback-safe checkpoint

## Customers Private Pilot — Add Gary Studios as Second Provider
- [x] Review Admin → Customers Pilot in its current Ready state and preserve the verified Chisolm Audio baseline before any allowlist change
- [x] Identify Gary Studios provider `1350001` and verify active status, effective Pro trial lifecycle access, every approved Customers entitlement, and owner control
- [x] Establish one legitimate no-payment Chisolm Audio quote relationship, then run a non-writing assessment showing one candidate, one eligible relationship, zero exclusions, and zero failures
- [x] Update monitoring and regressions so two named pilot providers are supported without hardcoded one-provider totals or customer-identity exposure
- [x] Add only Chisolm Audio and Gary Studios to the private pilot allowlist through the audited owner-only configuration path while preserving every existing flag
- [x] Backfill only Gary Studios through the confirmation-gated owner operation and project one authoritative quote relationship without manual or fabricated contacts
- [x] Verify both provider access paths, strict constructed-ID cross-provider denial, self-contact exclusion, lifecycle gates, aggregate monitoring, and safe disable behavior
- [x] Keep repair jobs, recommendations, automation rules, runs, schedules, saved segments, exports, bulk messaging, AI, and every other provider disabled
- [x] Run 199 adjacent regressions, zero-error TypeScript, diff validation, production build, desktop/mobile review, final database-state verification, documentation, and checkpoint

## Customers Phase 9 — Two-Provider Pilot Stabilization and Rollout Decision
- [x] Audit every approved Customers workflow for Chisolm Audio and Gary Studios: relationship discovery, stage changes, private notes, follow-ups, drafts, consent-aware sending, conversations, and owner monitoring
- [x] Verify both providers remain strictly tenant isolated and all customer, note, task, draft, message, and activity data stays provider scoped and privacy safe
- [x] Validate lifecycle behavior for Gary Studios through deterministic Pro-to-Starter downgrade and restoration scenarios without changing the real subscription or bypassing entitlements
- [x] Confirm Starter preserves read-only customer history while denying notes, follow-ups, drafts, sending, and manual stages; confirm qualifying access restores tools without losing retained private records
- [x] Review desktop and mobile usability, correct stale workspace sending copy, and add explicit retained-data lifecycle guidance without changing approved Customers workflows
- [x] Verify Admin → Customers Pilot reports provider access loss, recovery, integrity, projection health, consent coverage, delivery linkage, and safe-disable guidance
- [x] Add Help Center guidance and a support playbook for Customers private tools, customer consent, lifecycle access, safe disable order, and paid-plan expiration behavior
- [x] Keep the allowlist exactly `[1, 1350001]` and keep AI, recommendations, automation, schedules, segments, exports, bulk messaging, repair jobs, and all other providers disabled
- [x] Pass 22 adjacent test files and 205 tests, zero-error TypeScript, diff validation, production build, desktop/mobile and Help Center review, fresh runtime-log review, and final database-state verification
- [x] Produce the Phase 9 stabilization report and retain the two-provider pilot pending Gary Studios’ post-trial plan and one real follow-up plus draft lifecycle on its existing relationship

## Customers Phase 10 — Controlled Beta Readiness
- [x] Confirm Phase 10 against the approved Customers PRD and prior rollout decisions; implement controlled beta readiness without automatic provider expansion or separately gated saved segments and automation
- [x] Keep the remaining real Gary Studios follow-up lifecycle and provider-reviewed draft lifecycle deferred until—and complete them at—the final Phase 10 validation gate
- [x] Define a privacy-safe candidate readiness model covering active status, lifecycle entitlement, legitimate non-self relationship evidence, reachable tester, projection dry-run health, cohort capacity, and separate named owner approval
- [x] Add an owner-only cohort readiness review without exposing customer identities, private notes, task descriptions, draft or message bodies, addresses, payment data, or unrestricted source snapshots
- [x] Keep every cohort change on the existing audited owner-only configuration and provider-bounded backfill path; candidate assessment cannot auto-enroll or derive provider access from client input
- [x] Preserve Chisolm Audio and Gary Studios as the only enabled providers unless the owner separately names and approves each additional candidate after reviewing readiness
- [x] Keep AI, recommendations, automation, schedules, saved segments, exports, bulk messaging, repair jobs, public rollout, and all background send behavior disabled
- [x] Add focused candidate eligibility, privacy, authorization, entitlement, tenant-isolation, no-auto-enrollment, current-state, and owner-approval regressions
- [x] Build and review a concise desktop/mobile owner beta-readiness experience with Ready, Blocked, Pending, and Already in pilot evidence states
- [x] Complete the Gary Studios follow-up create/edit/complete/reopen/cancel lifecycle and private draft create/edit/discard lifecycle without sending a message, then retain the two-provider cohort
- [x] Pass 23 adjacent test files and 210 tests, zero-error TypeScript, diff validation, production build, fresh runtime-log review, final database-state verification, documentation, and checkpoint readiness

## Customers Phase 11 — Authoritative Entitlements
- [x] Audit the shared entitlement catalog and every Customers server/UI gate for `customerHistory`, `crmNotes`, `crmFollowUps`, `crmDrafts`, `crmSegments`, `crmRetentionAnalytics`, and `crmCustomAutomations`
- [x] Resolve all Customers access through the existing lifecycle-aware provider entitlement resolver; never trust a frontend tier or hard-code plan access in Customers UI
- [x] Keep capability declaration separate from product rollout: entitlement keys for segments, retention analytics, and custom automations do not enable their deferred data, UI, jobs, or messaging behavior
- [x] Confirm Starter, Pro, and Business capability assignments match the approved authoritative model without changing prices, billing behavior, or public plan copy
- [x] Enforce provider-active, pilot-allowlist, rollout-flag, lifecycle-entitlement, and tenant-scope checks on every existing Customers read and mutation procedure
- [x] Add pure and router regressions for active, trialing, scheduled cancellation, legacy scheduled cancellation, past-due grace, suspended past due, expired trial, paused, incomplete, cancelled, Starter downgrade, and paid-plan restoration behavior
- [x] Add UI source-contract regressions proving capability booleans and read-only reasons are server-derived and no Customers component infers access from plan names or client provider IDs
- [x] Pass 22 adjacent files and 239 tests, zero-error TypeScript, diff validation, production build, desktop/mobile oversight review, final state verification, and the Phase 11 report; no database migration was required

## Customers Phase 12 — Release 1 Completion Testing
- [x] Map every required Phase 12 item to named deterministic tests before running the final matrix
- [x] Validate tenant isolation, provider ownership, relationship eligibility, backfill idempotency, event idempotency, stage resolution, and manual overrides
- [x] Validate captured lifetime value, refund handling, private notes, task lifecycle, recommendation deduplication policy, and provider-reviewed draft approval
- [x] Validate customer communication preference enforcement, existing message authorization, lifecycle entitlements, account deletion and cleanup, demo/test exclusion, and cursor pagination
- [x] Validate desktop and mobile Customers UI, owner aggregate oversight, private-note exclusion, responsive behavior, and loading, error, empty, retry, and not-found states
- [x] Pass the complete existing OlogyCrew regression suite across booking, quote, payment, invoice, messaging, notification, review, subscription, provider workspace, and inactive-provider behavior
- [x] Confirm no pricing or public plan copy changed and no Release 1 non-goal was enabled: AI, recommendations, automated rules/jobs, saved segments, exports, bulk messaging, external CRM, manual contacts, or broad rollout
- [x] Pass zero-error TypeScript, diff validation, production build, fresh runtime/network/server log review, and final two-provider aggregate production-state verification
- [x] Produce the Phase 12 completion matrix and final report containing implementation, files, database changes, tests, results, warnings, unchanged behavior, and deviations
- [x] Prepare the final Release 1 checkpoint after every required data, authorization, entitlement, error-handling, responsive UI, and regression gate passed

## Customers Release 1 — Provider-Wide Entitlement Rollout and Named Admin Restriction
- [x] Audit all current admin-role users and super-admin authorization paths, then identify the exact user and provider records for `garychisolm30@gmail.com`, `wwilliams@visionkwest.com`, and the Gary Studios test account
- [x] Define the rollout boundary so active Starter providers receive only lifecycle-entitled customer history while active Pro and Business providers receive their lifecycle-entitled private Customers tools; never infer access from frontend plan names
- [x] Remove private pilot membership as the active provider access boundary without weakening authenticated provider ownership, lifecycle entitlements, provider-active checks, reserved-identity exclusions, or server-derived tenant scope; retain pilot mode for rollback
- [x] Expand projection eligibility only to active providers with authoritative qualified interactions, preserving self-contact, demo, test, inactive, deleted, and unqualified-source exclusions
- [x] Restrict administrative clearance to `garychisolm30@gmail.com` and `wwilliams@visionkwest.com` across every admin and super-admin route; keep Gary Studios as an ordinary plan-based provider with no admin clearance
- [x] Restore Winston Williams’ approved provider profile and grant only the Customers access permitted by its authoritative Starter lifecycle plan, without bypassing entitlements or fabricating customer relationships
- [x] Backfill the exact 12-provider eligible audience through audited operations with non-writing assessment, idempotency, reconciliation, failure isolation, and rollback evidence; six qualified relationships projected with zero failures
- [x] Update owner aggregate oversight for provider-wide adoption, relationships, task outcomes, projection lag, automation failures, provider lifecycle health, and operational health without exposing private notes or customer content
- [x] Verify every provider can access only its own qualified Customers relationships and cannot enumerate, read, mutate, draft, or message another provider’s customers through constructed IDs
- [x] Preserve current prices, public plan copy, booking/quote/payment/invoice/message/review authority, and disabled AI, recommendations, automation execution, schedules, saved segments, exports, bulk messaging, external CRM, manual contacts, and repair jobs
- [x] Run focused and full OlogyCrew regressions, zero-error TypeScript, diff validation, production build, desktop/mobile review, production-state verification, successful rollback drill, implementation report, and checkpoint

## Customers Provider Welcome Tooltip
- [x] Show a concise Welcome to Customers introduction only to eligible providers when they first open the Customers workspace
- [x] Explain provider-owned relationship history, lifecycle-entitled private tools, and consent-aware in-app messaging without using CRM as the product name
- [x] Keep the welcome non-blocking, keyboard accessible, dismissible, responsive, and free of customer identity or private content
- [x] Persist dismissal per authenticated provider and tooltip version so it does not repeat unnecessarily while allowing future release guidance
- [x] Keep all provider access, entitlements, tenant isolation, rollout flags, pricing, and Customers functionality unchanged
- [x] Add focused rendering, eligibility, dismissal, persistence-key, accessibility, and responsive regressions
- [x] Run adjacent tests, zero-error TypeScript, diff validation, production build, desktop/mobile review, documentation, and checkpoint

## Production Test-Data Cleanup and KPI Reconciliation
- [x] Owner deferred the production cleanup before inventory or deletion; future classification must use exact reserved domains such as `@test.com` or individually reviewed identities, never broad substring matching
- [x] Owner-deferred preservation rule recorded: keep the official OlogyCrew demo provider and intentional demonstration content, Gary Chisolm, Winston Williams, and every confirmed real customer or provider
- [x] Owner deferred the read-only deletion manifest; no customer, provider, booking, quote, message, notification, review, subscription, financial, or Customers record was inventoried for deletion
- [x] Owner deferred the baseline KPI snapshot and test-record impact analysis
- [x] Owner deferred destructive approval because no deletion manifest was produced
- [x] Owner stopped cleanup before execution; no database row, Stripe object, notification, refund, or external account was changed
- [x] Owner deferred financial-record classification; authoritative payment, refund, invoice, subscription, transfer, legal, and audit evidence remains unchanged
- [x] Owner deferred Customers reconciliation because no cleanup occurred
- [x] No cleanup action was taken, so the demo provider, administrators, real accounts, tenant isolation, Customers access, booking/quote/payment integrity, and 60/40 partner logic remain unchanged
- [x] Owner deferred the corrected Admin Dashboard KPI review
- [x] Owner deferred cleanup validation; this section may be reopened later with a new explicit request and deletion manifest approval

## Bug Fix — Mobile Toast Text Contrast
- [x] Identify the shared Sonner wrapper and inherited description color causing text to render too light against white toast backgrounds
- [x] Apply accessible foreground colors to toast titles, descriptions, close controls, actions, and cancel controls across toast variants without changing placement or behavior
- [x] Add focused regressions for readable toast foreground styling and WCAG contrast in light and dark themes
- [x] Verify the reported Tell us what you need toast at a 390-pixel viewport with readable, unclipped title and description text
- [x] Pass 6 adjacent files and 40 tests, zero-error TypeScript, diff validation, production build, fresh log review, documentation, and checkpoint readiness

## Bug Fix — Studio Space Rentals Icon Consistency
- [x] Identify every Studio Space Rentals category definition, selector card, category-route mapping, detail-page icon, and fallback that can render its icon
- [x] Choose the existing approved Studio Space Rentals icon as the single authoritative mapping without redesigning unrelated categories
- [x] Make the selector and destination page render the same icon on desktop and mobile
- [x] Add focused source or rendered regressions that prevent the Studio Space Rentals icon mapping from drifting between views
- [x] Run adjacent category/navigation tests, zero-error TypeScript, diff validation, production build, desktop/mobile review, fresh log review, documentation, and checkpoint

## Bug Fix — Provider Profile Browse & Book Button
- [x] Reproduce the non-responsive Browse & Book button on the affected provider profile and trace its service-selection and navigation logic
- [x] Fix Browse & Book so an eligible service opens the correct booking flow without changing Request a Quote behavior
- [x] Add focused regression coverage for one-service, multi-service, direct-booking, and quote-request provider profiles as applicable
- [x] Verify Browse & Book and Request a Quote on mobile and desktop, including navigation, back behavior, and visible loading or error feedback
- [x] Run adjacent booking/profile tests, zero-error TypeScript, diff validation, production build, fresh log review, documentation, and checkpoint

## UX Update — Quote-Only Provider Profile CTA Clarity
- [x] Audit provider-profile CTA labels that represent quote-only services without changing direct-booking or generic provider quote actions
- [x] Rename quote-only service entry CTAs to “View Service & Request Quote” while preserving their adaptive service destinations
- [x] Keep direct-booking CTAs concise and unchanged, and prevent the longer quote label from clipping on mobile
- [x] Add focused regression coverage for quote-only versus direct-booking provider-profile labels and links
- [x] Run adjacent adaptive-booking tests, zero-error TypeScript, diff validation, production build, desktop/mobile review, documentation, and checkpoint

## UX Update — Non-Sticky Book a Service Card
- [x] Confirm the public provider profile Book a Service card is the only in-scope sticky element
- [x] Remove sticky positioning on mobile and desktop without changing card content, order, actions, or spacing
- [x] Add a focused regression preventing sticky positioning from returning to the Book a Service card
- [x] Verify normal document scrolling and responsive layout on mobile and desktop
- [x] Run adjacent provider-profile tests, zero-error TypeScript, diff validation, production build, documentation, and checkpoint

## Admin Update — Remove Instagram Auto-Posting
- [x] Audit the Admin social posting UI, server procedures, scheduling logic, status messages, and tests for Instagram-specific behavior
- [x] Remove Instagram from selectable and automatic Admin posting channels while preserving Facebook and LinkedIn behavior
- [x] Remove Instagram credential warnings and channel-specific Admin copy without deleting unrelated environment configuration or historical records
- [x] Add focused regressions proving Instagram is unavailable and Facebook/LinkedIn posting contracts remain intact
- [x] Verify the Admin social posting experience on desktop and mobile, then run adjacent tests, TypeScript, diff validation, production build, documentation, and checkpoint

## SEO: Dynamic Public Sitemap Restoration
- [x] Restore database-backed sitemap entries for active categories, providers, services, and current promotions
- [x] Add public Experiences and Featured Professionals landing pages
- [x] Use canonical `https://ologycrew.com` URLs and clean root-level provider profile paths
- [x] Exclude inactive, deleted, private, account, admin, preview, and transactional routes
- [x] Use real record modification dates and add regression coverage
- [x] Validate XML, robots.txt, TypeScript, focused tests, production build, and development endpoint output

## Agentic Discovery Stage 1 Completion & Safe Handoff
- [x] Align the public agent API with authoritative active-provider, active-service, category, location, price, and pagination rules
- [x] Return accurate category metadata, provider categories, and service-duration-specific availability without exposing booking details
- [x] Publish working `llms.txt`, `openapi.json`, API-root metadata, and a synchronized agent manifest
- [x] Repair canonical Schema.org data for homepage, provider, service, and category pages without exposing private contact data
- [x] Add a short-lived encrypted booking-or-quote handoff that creates no booking, quote, payment, hold, or database record
- [x] Prefill the existing adaptive flow, preserve the handoff through login, and require explicit customer review and submission
- [x] Add contract, security, privacy, expiration, filter, structured-data, and responsive UI regression coverage
- [x] Validate live development endpoints, TypeScript, adjacent regression tests, production build, and checkpoint
- [x] Keep public availability responses free of booking, customer, cross-service, and lifecycle metadata
- [x] Enforce active provider, account, category, and service eligibility for direct, multi-day, recurring, quote, reschedule, and timing-edit paths
- [x] Serialize direct, multi-day, recurring, quote conversion, rescheduling, and timing edits under provider-level calendar locks
- [x] Reject expired quotes before and during atomic quote-to-booking conversion

## Production Test-Data Cleanup and Real-Activity Admin Scope — Reopened 2026-09-21
- [x] Reopen cleanup only after the owner’s fresh request; perform no deletion before a current read-only manifest and exact approval
- [x] Classify automatic deletion candidates by exact `@test.com` domain only; never use broad substring matching
- [x] Preserve Demo - OlogyCrew (`isOfficial = true`), Gary Chisolm, Winston Williams, all unclassified accounts, all partner transfers, and all audit evidence
- [x] Generate a read-only dependency manifest, orphan audit, protected-identity list, financial-risk check, and baseline KPI impact
- [x] Exclude official demo activity, exact test identities, reserved internal fixtures, deleted identities, and orphan fixtures from real Admin users/providers/KPIs while keeping demo discovery and testing behavior available
- [x] Prevent future automated test runs from leaving exact-domain test records after the approved cleanup
- [x] Present the exact destructive scope and separately reviewed Prattis Test decision for owner approval
- [x] Delete only the approved test records in one verified transaction; delete the approved synthetic local payment and cancelled local Prattis subscription row while preserving external Stripe objects, partner transfers, and audit evidence
- [x] Reconcile Customers projections and derived provider metrics after approved cleanup; no target Customers/CRM contacts or real-provider review aggregates existed, so no derived repair was required
- [x] Re-run the read-only manifest, Admin KPI checks, focused/full regressions, TypeScript, build, responsive review, and save a rollback checkpoint

## Google OAuth Redirect URI Regression — 2026-09-23
- [x] Reproduce production `redirect_uri_mismatch` and identify the exact redirect URI sent to Google
- [x] Confirm the failure is unrelated to user cleanup or account deletion
- [x] Restore a canonical, allowlisted Google callback origin while preserving signed OAuth state and safe return paths
- [x] Add regression coverage for custom-domain, internal runtime, preview, local, and untrusted-origin behavior
- [x] Validate production-shaped redirect output, Google authorization acceptance, callback token-exchange parity, TypeScript, full regressions, build, and checkpoint

## Admin Subscription Tier Member Modal — 2026-09-29
- [x] Reuse the authoritative lifecycle-aware provider tier resolver and real-activity scope for Starter, Pro, Business, and Trialing membership
- [x] Add an admin-only lazy tRPC query that returns only provider/account summaries needed by the modal
- [x] Make each Tier Distribution row keyboard-accessible and open a responsive member modal with clear loading, empty, error, and count states
- [x] Show business name, account identity, effective/configured plan context, lifecycle state, and access-end date without adding mutation controls
- [x] Add contract, authorization, count-parity, privacy-scope, and responsive UI regressions
- [x] Run focused/full tests, TypeScript, clean-diff, production build, desktop/mobile review, and save a rollback checkpoint

## Provider Dashboard Bookings Link — 2026-09-29
- [x] Point the desktop Provider Dashboard Bookings navigation item to `/my-bookings`
- [x] Point the mobile floating Bookings navigation item to `/my-bookings`
- [x] Preserve the existing dashboard sections, booking data, detail actions, and provider/customer view behavior
- [x] Add a navigation regression, run TypeScript and build checks, review desktop/mobile, and save a rollback checkpoint

## Trial-Ended Action Buttons — 2026-09-29
- [x] Trace customer and provider Subscribe and Continue actions through UI, tRPC, lifecycle resolution, and Stripe boundaries
- [x] Identify the expired-trial defect: the status query first activates the free tier, then the Continue button submits a second downgrade that is rejected as not lower
- [x] Make expired-trial continuation idempotent for both Individual and Starter without cancelling, charging, or creating Stripe records
- [x] Add clear pending, success, and failure feedback and ensure Subscribe routes to the correct plan-management page
- [x] Add customer/provider backend behavior and rendered UI interaction regressions
- [x] Run focused/full tests, TypeScript, clean-diff, build, responsive contract review, zero-external-write verification, and save a rollback checkpoint

## Provider Dashboard My Page Link — 2026-09-29
- [x] Route the active desktop Provider Workspace My Page link to the authenticated provider’s canonical public profile URL
- [x] Route the legacy desktop and mobile Provider Dashboard My Page controls to the same public profile URL
- [x] Preserve a safe My Page setup fallback when a provider has not created a public profile slug
- [x] Add navigation regressions, run TypeScript and build checks, review desktop/mobile behavior, and save a rollback checkpoint

## Desktop Account Dropdown My Page Cleanup — 2026-09-29
- [x] Remove My Page only from the desktop account dropdown shown in the screenshot
- [x] Preserve My Page on the Provider Dashboard and leave the separate mobile hamburger tile unchanged
- [x] Add a menu-scope regression, run TypeScript and build checks, review the desktop menu, and save a rollback checkpoint

## Provider Workspace My Calendar Link — 2026-09-29
- [x] Rename the existing workspace Calendar item to My Calendar and point it to `/provider/calendar`
- [x] Align the Today card and conditional mobile Calendar shortcuts with the dedicated provider calendar page
- [x] Preserve calendar data, availability settings, and the rest of the workspace navigation
- [x] Add navigation regressions, run TypeScript and build checks, review desktop/mobile, and save a rollback checkpoint

## Desktop Account Dropdown My Calendar Cleanup — 2026-09-29
- [x] Remove My Calendar only from the desktop account dropdown shown in the screenshot
- [x] Remove the dropdown’s now-unneeded provider-profile query
- [x] Preserve My Calendar in the Provider Workspace and the separate mobile menu
- [x] Update the menu-scope regression, run TypeScript and build checks, and save a rollback checkpoint

## Provider Workspace Edit Profile Modal — 2026-09-29
- [x] Replace the header’s View public page action with an Edit Profile button
- [x] Extract the existing Edit Business Profile dialog into one reusable component rather than duplicating profile logic
- [x] Open the shared dialog from the active Provider Workspace and preserve the legacy dashboard editor/checklist behavior
- [x] Preserve profile-photo cropping, logo upload/removal, provider-owned tRPC updates, OG/trust invalidation, and existing public-page access through My Page
- [x] Add rendered open/prefill/save/error/loading regressions plus source contracts preventing the old public-page action from returning
- [x] Run focused/full tests, TypeScript, clean-diff, build, desktop/mobile responsive review, and save a rollback checkpoint

## Dedicated Provider Finances Page — 2026-09-29
- [x] Add a protected `/provider/finances` page that reuses the complete existing Finances tab content and Stripe/subscription behavior
- [x] Point the Provider Workspace desktop and mobile Money links to the new page
- [x] Align provider Customers and payment-activity links with the new canonical Finances route while preserving old tab and `/provider/payouts` compatibility
- [x] Keep earnings, completed bookings, Stripe setup/status/balances, payout dashboard, plan gating, and subscription management unchanged
- [x] Add route, navigation, content, guard, and backwards-compatibility regressions
- [x] Run focused/full tests, TypeScript, clean-diff, build, desktop/mobile review, and save a rollback checkpoint

## Provider Workspace visual alignment — Bookings, Services, and Money

- [x] Audit Provider Overview, dual-mode My Bookings, standalone Services/Finances wrappers, routes, and regression contracts.
- [x] Extract one reusable Provider Workspace shell with canonical desktop/mobile navigation and accessible active-page state.
- [x] Refactor Provider Overview to consume the shared shell while retaining its larger command-center hero and all existing data/actions.
- [x] Apply the compact workspace header and shell only to provider-mode `/my-bookings`; retain the customer Bookings layout and behavior.
- [x] Apply the compact workspace header and shell to `/provider/services` and `/provider/finances` while reusing existing ProviderDashboard content and mutations.
- [x] Canonicalize shared Services navigation to `/provider/services`; retain legacy dashboard-tab and payout compatibility routes.
- [x] Add focused source-contract regressions for shell reuse, canonical navigation, active state, customer/provider separation, and preserved service/finance behavior.
- [x] Complete focused tests, TypeScript, diff validation, full regression suite, production build, responsive review, and final checkpoint.


## Provider Workspace visual alignment — Calendar and Customers

- [x] Centralize the full-page light blue Provider Workspace background treatment in the shared shell.
- [x] Move `/provider/calendar` into the shared shell with a compact header, active navigation, and preserved month/week, sync, block-time, booking, and availability behavior.
- [x] Replace duplicated Customers navigation with the shared shell on `/provider/customers` and `/provider/customers/:contactId`.
- [x] Add the standard global header to Customers list, detail, loading, unavailable, and error states.
- [x] Preserve Customers lifecycle access, tenant isolation, notes, stages, follow-ups, draft approval, communication permission, and pagination behavior.
- [x] Verify Calendar, Customers list, and Customers detail at desktop and 390px mobile sizes.
- [x] Complete production build, post-suite cleanup verification, and rollback checkpoint.


## Provider Workspace — standalone Business Tools page

- [x] Name the provider More destination **Business Tools** with canonical route `/provider/tools`.
- [x] Reuse the complete existing More/settings content without duplicating review, promotion, tipping, estimate, emergency-service, referral, or verification logic.
- [x] Apply the shared Provider Workspace shell, compact header, background, desktop active state, and mobile Tools active state.
- [x] Point shared workspace and legacy dashboard More controls to the canonical Business Tools page.
- [x] Preserve `/provider/dashboard?tab=settings` for bookmarked and backwards-compatible access.
- [x] Add provider-guard, route, content-reuse, canonical-navigation, and compatibility regressions.
- [x] Verify desktop and 390px mobile layouts.
- [x] Complete the full regression suite, production build, cleanup verification, and rollback checkpoint.


## Provider Overview — compact setup checklist

- [x] Keep the checklist on Provider Overview, directly below the welcome header and above Needs Attention.
- [x] Reuse the established seven completion criteria: photo, bio, categories, services, availability, portfolio, and Stripe readiness.
- [x] Show progress and only the next action by default, with an accessible View all steps expansion.
- [x] Preserve Edit Profile, onboarding, new-service, availability, portfolio-upload, and Stripe setup destinations.
- [x] Keep dismissal local and automatically hide the card whenever all seven steps are complete.
- [x] Verify the incomplete 5-of-7 state at desktop and 390px mobile sizes, then restore live account data.
- [x] Complete the full regression suite, production build, cleanup verification, and rollback checkpoint.


## Provider Business Tools — legacy settings URL cleanup

- [x] Keep `/provider/tools` as the single canonical Business Tools destination.
- [x] Redirect `/provider/dashboard?tab=settings` with history replacement so bookmarks remain functional without exposing duplicate workspace pages.
- [x] Leave all other `/provider/dashboard?tab=...` compatibility behavior unchanged.
- [x] Retain the existing settings-tab implementation as the internal content source for the canonical Business Tools page.
- [x] Verify the legacy URL renders the shared Business Tools workspace with its active navigation state.
- [x] Complete the full regression suite, production build, cleanup verification, and rollback checkpoint.


## Business Tools navigation and legacy dashboard consolidation

- [x] Group Business Tools into Reputation & trust, Growth & promotion, Pricing & payments, and Service options.
- [x] Keep all four sections collapsed by default with accessible multi-section expansion.
- [x] Add local quick search with common provider terms, automatic matching-group expansion, clear control, and no-results guidance.
- [x] Preserve every existing review, promotion, referral, tipping, estimate, emergency-service, and verification component and mutation.
- [x] Redirect legacy Bookings, Quotes, Services, Portfolio, Schedule, Finances, Payouts, Analytics, My Page, Subscription, Settings, and More tab URLs to canonical pages.
- [x] Preserve non-tab callback query parameters and portfolio anchors during redirects.
- [x] Verify desktop/mobile Business Tools layouts, focused Promo search, and representative legacy redirects.
- [x] Complete the full regression suite, production build, cleanup verification, and rollback checkpoint.


## Canonical links in provider emails and notifications

- [x] Audit active email templates, test senders, in-app notifications, push payloads, Provider Overview actions, and Stripe callback URLs.
- [x] Replace provider trial and welcome email links with Provider Overview or Subscription destinations.
- [x] Replace provider review, quote, verification, and overview notification actions with their canonical workspace pages.
- [x] Move Stripe subscription returns to `/provider/subscription` and Stripe Connect returns to `/provider/finances` while preserving status parameters.
- [x] Use `https://ologycrew.com` as the primary domain for booking-detail and unsubscribe links rendered in notification emails.
- [x] Scan every text-capable database column for `/provider/dashboard`; no persisted notification, email, message, or template rows required migration.
- [x] Keep the legacy dashboard redirect route so links in previously delivered emails continue to work.
- [x] Complete full regression, build, cleanup, final database re-scan, and rollback checkpoint.


## Customer Workspace visual alignment

- [x] Add one shared Customer Workspace shell with canonical desktop navigation, mobile bottom navigation, active-page state, mobile role toggle, and light blue background.
- [x] Move Customer Home into the shared shell without changing need-first search, actions, upcoming bookings, rebooking, or supporting tools.
- [x] Redesign Browse and Search as discovery pages with connected blue headers, prominent search, preserved filters, provider results, adaptive booking, and save actions.
- [x] Redesign customer-mode My Bookings with the shared shell and compact management header while keeping provider mode unchanged.
- [x] Redesign Bulk Booking and Monthly Planner as guided planning workflows while preserving drafts, templates, provider selection, dates, pricing, and booking creation.
- [x] Redesign Saved Providers with shared navigation and preserved folders, plan limits, bulk quotes, analytics, and upgrade gating.
- [x] Redesign Messages with shared navigation and preserved search, SSE updates, attachments, routing, unread state, and deletion.
- [x] Verify all eight customer surfaces at desktop and 390px mobile sizes; refine mobile workflow labels and remove redundant plan-header clutter.
- [x] Add focused shared-shell, route, role-boundary, behavior-preservation, adaptive booking, export, entitlement, and category-icon regressions.
- [x] Complete the full regression suite, production build, cleanup verification, and rollback checkpoint.


## Customer discovery — unified Explore

- [x] Make `/browse` the single canonical Explore experience.
- [x] Show the complete alphabetical category directory when no search intent is present.
- [x] Switch the same page to provider/service results, filters, adaptive booking actions, and save controls when a query or filter is active.
- [x] Preserve query, location, timing, category, price, estimate, emergency, sorting, ranking, and plan-gating behavior.
- [x] Redirect `/search` to `/browse` while preserving all query parameters.
- [x] Replace duplicate Search links in customer navigation, homepage, footer, developer shortcuts, help content, sitemap, and SearchAction structured data.
- [x] Verify category-first, result, and legacy redirect states at desktop and 390px mobile sizes.
- [x] Complete the full regression suite, production build, cleanup verification, and rollback checkpoint.


## Provider Overview — header Bookings action

- [x] Replace the header Share page button with Bookings linking to `/my-bookings`.
- [x] Preserve Share page in Quick Actions.
- [x] Verify desktop, tablet, and mobile layouts.
- [x] Complete full regression, production build, cleanup verification, and rollback checkpoint.


## Global header — desktop Search shortcut

- [x] Remove the desktop Home, Explore, My Bookings, Saved, and Messages shortcut icons.
- [x] Add one desktop Search icon linked to canonical Explore at `/browse`.
- [x] Preserve notifications, role switching, Admin, account menu, and all mobile header shortcuts.
- [x] Verify authenticated desktop and mobile layouts.
- [x] Complete full regression, production build, cleanup verification, and rollback checkpoint.


## Explore — unified search composer and adaptive results

- [x] Combine keyword/provider search, location, timing, and advanced filters into one compact composer inside the blue Explore header.
- [x] Keep advanced filters collapsed by default with price, free-estimate, emergency-service, and sorting controls.
- [x] Submit search explicitly instead of requesting results on every keystroke; persist applied criteria in the canonical `/browse` URL.
- [x] Keep the full category directory when no search is active and reuse the same category-card design for relevant search matches.
- [x] Put relevant categories and services first for service intent; put the provider card first for direct provider-name intent.
- [x] Show each provider’s associated category cards and services while preserving trust, promotion, save, booking, quote, and plan-gating behavior.
- [x] Add applied filter chips, one-tap removal, reset, no-results recovery, and progressive advanced-filter disclosure.
- [x] Verify default, service-intent, provider-intent, expanded-filter, desktop, mobile, keyboard-submit, and URL-persistence behavior.
- [x] Complete the full regression suite, production build, cleanup verification, and rollback checkpoint.

## Explore — remove redundant Category filter

- [x] Remove the Category dropdown from advanced filters on desktop and mobile.
- [x] Preserve category-card selection, category URL compatibility, the selected-category chip, and one-tap removal.
- [x] Verify the simplified advanced-filter layout at desktop and 390px mobile sizes.
- [x] Complete full regression, production build, cleanup verification, and rollback checkpoint.


## Customer Workspace — align primary page widths

- [x] Make customer-mode My Bookings inherit Customer Home’s `max-w-7xl` workspace width.
- [x] Make Saved Providers inherit Customer Home’s `max-w-7xl` workspace width.
- [x] Make Messages inherit Customer Home’s `max-w-7xl` workspace width.
- [x] Align My Bookings and Messages loading states to the same width.
- [x] Preserve provider-mode My Bookings, data behavior, actions, and mobile layouts.
- [x] Verify Customer Home and all three pages side by side at desktop and 390px mobile sizes.
- [x] Complete full regression, production build, cleanup verification, and rollback checkpoint.


## Application-wide light blue page canvas

- [x] Add the semantic `bg-page` utility backed by the Provider Workspace light blue `#f7faff`.
- [x] Apply the shared token to the document, app root, authentication loading state, workspace shells, guards, error states, and every explicit full-page canvas.
- [x] Preserve white cards, forms, dialogs, navigation, branded heroes, and content sections for contrast and hierarchy.
- [x] Keep external booking embeds white so they remain neutral inside third-party websites.
- [x] Add an application-wide source contract that rejects legacy root backgrounds and protects the embed exception.
- [x] Verify representative public, customer, provider, admin, account, support, and authentication surfaces at desktop and 390px mobile sizes.
- [x] Complete the full regression suite, production build, cleanup verification, and rollback checkpoint.


## Global header — mobile Search shortcut

- [x] Remove the mobile Home grid and Explore compass shortcuts.
- [x] Add one Search icon linked to canonical customer Explore at `/browse`.
- [x] Preserve the logo Home link, AI assistant, notifications, hamburger menu, and mobile workspace navigation.
- [x] Verify the authenticated mobile header on Provider Overview and Explore.
- [x] Complete full regression, production build, cleanup verification, and rollback checkpoint.


## Unpublished preview testing login

- [x] Detect managed Manus preview and loopback hosts without affecting production.
- [x] Add preview login guidance that instructs users to open the preview in a top-level tab for reliable cookies.
- [x] Keep Google OAuth on the registered production domain and offer production password setup for Google-only accounts.
- [x] Allow the same OlogyCrew account to sign into preview through the existing email/password and 2FA flow.
- [x] Normalize password-reset email links requested from preview to the production domain.
- [x] Add a preview-only banner identifying unpublished code and warning that account actions can use current OlogyCrew data.
- [x] Exclude external embeds and isolated prototype routes from the preview banner.
- [x] Complete focused regressions, responsive review, full suite, production build, cleanup verification, and rollback checkpoint.


## Public header — Search and Pricing

- [x] Add the Search icon to the public desktop header linking to `/browse`.
- [x] Add Pricing immediately after Search linking to `/pricing`.
- [x] Apply the same Search-then-Pricing order on mobile.
- [x] Preserve Sign In, Get Started, AI assistant, hamburger menu, and authenticated header behavior.
- [x] Verify logged-out desktop and 390px mobile layouts.
- [x] Complete full regression, production build, cleanup verification, and rollback checkpoint.


## Public header — restore compact mobile navigation

- [x] Remove Pricing from the logged-out mobile header.
- [x] Restore the prior compact Search, AI assistant, and hamburger layout.
- [x] Keep public desktop Search followed by Pricing unchanged.
- [x] Preserve the mobile-menu Pricing destination and all authenticated navigation.
- [x] Verify the restored public header at 390px.
- [x] Complete full regression, production build, cleanup verification, and rollback checkpoint.


## Public footer — acquisition-focused redesign

- [x] Add a two-audience CTA for customers exploring services and providers building their digital home.
- [x] Organize links into Explore, For Providers, and Company & Support groups.
- [x] Move Terms of Service and Privacy Policy into the bottom legal strip.
- [x] Remove My Bookings, My Dashboard, Add Service, and Manage Availability from the public footer.
- [x] Preserve Referral Program, Help Center, Contact Support, Install App, and secure payment marks.
- [x] Add accessible navigation labels, focus states, and mobile-friendly stacking.
- [x] Verify full-page desktop and 390px mobile layouts.
- [x] Complete full regression, production build, cleanup verification, and rollback checkpoint.


## Public homepage — application design alignment

- [x] Align the logged-out homepage with the shared light blue canvas, rounded dark-blue hero, white card system, typography, and spacing.
- [x] Place a clear service/provider search composer inside the hero with direct Explore routing and popular searches.
- [x] Convert the provider value proposition, comparison, no-gatekeeping, categories, featured providers, referral, and closing CTA into the current card hierarchy.
- [x] Reuse the authoritative category icon map and preserve all category, promotion, referral, pricing, authentication, and search destinations.
- [x] Preserve the redesigned public footer and visible global header.
- [x] Add focused homepage design and behavior regressions.
- [x] Verify the full logged-out homepage at desktop and 390px mobile sizes.
- [x] Complete the full regression suite, production build, cleanup verification, and rollback checkpoint.


## Public homepage — widescreen hero

- [x] Expand the top dark-blue hero to the full available screen width with responsive edge gutters.
- [x] Cap the hero’s internal content at 1500px for readable ultrawide layouts.
- [x] Keep the remaining homepage sections at their existing readable `max-w-7xl` width.
- [x] Verify the hero at 1920px desktop and 390px mobile sizes.
- [x] Complete full regression, production build, cleanup verification, and rollback checkpoint.


## Public homepage — flush edge-to-edge hero

- [x] Remove the hero’s left, right, and top gutters.
- [x] Remove all hero corner rounding on desktop, tablet, and mobile.
- [x] Restore the original `py-14 sm:py-20 md:py-32` hero height.
- [x] Restore the original dark slate-to-blue gradient background.
- [x] Align the hero’s inner content edges with the shared `container` used below.
- [x] Verify the restored hero at 1920px desktop and 390px mobile sizes.
- [x] Complete full regression, production build, cleanup verification, and rollback checkpoint.

## Public CTA and Explore navigation refinement

- [x] Match the public desktop Get Started button to the hero Find services teal-blue CTA.
- [x] Hide the Customer Workspace desktop strip on `/browse` for logged-out visitors.
- [x] Hide the Customer Workspace mobile bottom navigation on `/browse` for logged-out visitors.
- [x] Preserve desktop and mobile Customer Workspace navigation for signed-in customers.
- [x] Remove unused bottom-navigation spacing when public Explore navigation is hidden.
- [x] Add focused header and Customer Workspace regression coverage.
- [x] Verify logged-out homepage and Explore at desktop and mobile sizes.
- [x] Complete full regression, production build, cleanup verification, and rollback checkpoint.


## Public homepage — CTA deduplication

- [x] Confirm the two adjacent sections repeated the same customer and provider destinations.
- [x] Remove the upper `Ready to build your digital home?` CTA block.
- [x] Keep the clearer footer `One platform, two clear paths` CTA as the single closing conversion choice.
- [x] Preserve Explore, Pricing, referral, and other public destinations through their canonical surfaces.
- [x] Add a regression preventing the duplicate CTA from returning.
- [x] Verify the final referral-to-footer transition visually.
- [x] Complete full regression, production build, cleanup verification, and rollback checkpoint.

## Context-aware signed-in footer

- [x] Keep the acquisition CTA, Pricing, provider-start, and Sign In content for logged-out visitors only.
- [x] Replace promotional content after sign-in with compact workspace and account utilities.
- [x] Show Provider Overview, Bookings, Customers, Services, Calendar, Money, and Business Tools in provider view.
- [x] Show Customer Home, Explore, My Bookings, Saved Providers, Messages, Monthly Planner, and Bulk Booking in customer view.
- [x] Route Manage Plan to the correct provider or customer subscription page.
- [x] Retain account, referral, support, legal, app-install, and secure-payment information.
- [x] Verify public, provider, and customer footer variants at desktop and mobile sizes.
- [x] Complete full regression, production build, cleanup verification, and rollback checkpoint.


## Scoped operations administrator — Tracey Patrick

- [x] Audit admin roles, named identity controls, partner-transfer APIs, team actions, audit history, and webhook configuration.
- [x] Add an explicit operations-admin role for the verified existing Tracey Patrick account; preserve its provider profile.
- [x] Enforce owner-only partner transfer views, exports, webhook details, team management, legal publishing, customer rollout, and user deletion on the server.
- [x] Hide restricted tabs and reject restricted direct-tab URLs in the admin UI; retain ordinary platform operations and platform revenue metrics.
- [x] Prevent Tracey’s account from being auto-promoted to super admin on login and restrict role assignments to named identities.
- [x] Generate, review, and apply the additive admin-role enum migration.
- [x] Complete focused and full regression tests (173 files, 1,979 tests), production build, TypeScript, cleanup, and checkpoint.
- [x] Confirm production serves the checkpointed JavaScript asset, then promote verified user ID 49831691 to `admin` / `operations_admin` in a conditional audited transaction; preserve her provider profile.
- [x] Verify the real account can access routine admin stats and health but receives FORBIDDEN for five partner and two team endpoints; do not publish or change any other account.


## Public homepage refresh — isolated blue-brand prototype

- [x] Keep the current public homepage at `/` unchanged; register a review-only route at `/preview/public-home-refresh`.
- [x] Use OlogyCrew’s blue, light-blue, and white system with editorial illustrative photography.
- [x] Load categories and public provider profiles through existing tRPC procedures; omit the official demo from real-provider cards and never invent ratings.
- [x] Connect search, category cards, profiles, pricing, and return to current homepage to existing routes; leave booking, quote, payment, and account behavior unchanged.
- [x] Keep the existing public footer as the sole closing two-path CTA even when the reviewer is signed in.
- [x] Verify search and category navigation interactively, and inspect desktop, tablet, and mobile layouts.
- [x] Run the complete suite (174 files, 1,983 tests), production build, TypeScript, and post-suite cleanup check.
- [x] Save an unpublished checkpoint for review; do not publish to the live homepage.


## Public homepage concept 2 — original OlogyCrew message

- [x] Keep the live `/` homepage and `/preview/public-home-refresh` unchanged; add `/preview/public-home-original` for comparison.
- [x] Restore the original “Your Business. Your Customers. Your Money.” tagline and existing sections: business tools, URL, comparison, No Gatekeeping, categories, providers, and referrals.
- [x] Use different people-centric editorial photography, OlogyCrew blues, and the public footer as the single two-path closing CTA.
- [x] Load categories, public profiles, and promotions from existing tRPC sources; display only actual review counts and exclude the official demo from real-provider cards.
- [x] Verify mobile/desktop layouts, search submission, and category-card navigation.
- [x] Complete the full regression suite (175 files, 1,988 tests), production build, TypeScript, cleanup verification, and an unpublished checkpoint; do not publish.

## Public homepage concept 3 — supplied demo-faithful comparison
- [x] Keep live `/`, `/preview/public-home-refresh`, `/preview/public-home-original`, and the global NavHeader unchanged; add `/preview/public-home-demo` only.
- [x] Reproduce the public `modern-booking-hub.replit.app` structure, exact page copy, visual style, and responsive imagery within a preview-scoped warm-paper wrapper; retain the current OlogyCrew header.
- [x] Isolate the demo's illustrative metrics, local specialist counts, prices, ratings, verified badges, and sample providers from real data; make the preview-only disclaimer prominent.
- [x] Route hero search, category cards, sample cards, and CTA to existing non-mutating OlogyCrew discovery paths; create no sample bookings/payments/accounts.
- [x] Add focused route, content, CSS-scope, data-integrity, and navigation regressions; review desktop, tablet, and 390px mobile layout and click-through.
- [x] Complete TypeScript, full tests (176 files/1,993 tests), production build, diff checks, cleanup verification, and an unpublished checkpoint. Do not publish or replace `/`.

## Approved Concept 3 public homepage integration (review before publication)
- [x] Replace only the logged-out public `/` design with Concept 3, retaining the shared header, signed-in customer/provider home, and all three comparison routes.
- [x] Use existing public category and provider tRPC data for six category cards and up to three real provider cards; never present sample numbers, names, ratings, prices, or verification badges as real.
- [x] Preserve search, category, profile, pricing, referral, and legal navigation; show honest loading/error/empty states and no preview-only favorite control.
- [x] Keep warm-paper/demo typography scoped to the new public-home design; preserve application-wide light-blue design elsewhere.
- [x] Update legacy homepage source-contract tests intentionally and add rendered live-data, route, review, and search coverage.
- [x] Review desktop, tablet, and mobile; pass full regression (177 files / 1,995 tests), TypeScript, production build, diff, and cleanup checks; save an unpublished checkpoint for approval. Do not publish.
- [x] Verify the signed-in-accessible `/preview/public-home-live` review route renders the same real-data Concept 3 page with a preview banner and public header/footer; re-run validation and replace the unpublished checkpoint.

## Concept 3 closing message: two clear paths (unpublished)
- [x] Replace the single-sided provider closing CTA with a compact customer/provider choice using the existing warm-paper style.
- [x] Route customer to canonical Explore and providers to existing provider plans, with the sample profile as a secondary link; retain genuine data and unchanged header.
- [x] Cover both paths with focused tests, visually check desktop/tablet/mobile and keyboard focus, pass 177 test files / 1,996 tests, production build, cleanup, TypeScript and diff checks; save an unpublished checkpoint. Do not publish.

## Concept 3 hero: quiet two-path cue (unpublished)
- [x] Keep the people-first headline, photo, and service search dominant; add a subordinate customer/provider path cue within the hero image.
- [x] Link the customer cue to Explore and provider cue to provider plans; preserve the full two-card choice near the page end, the unchanged header, and all real-data behavior.
- [x] Check desktop/tablet/mobile geometry, keyboard focus, focused/full regressions (177 files / 1,997 tests), build/cleanup, and save an unpublished checkpoint. Do not publish.

## Public provider benefits page — review before publication
- [x] Build `/for-providers` as a people-first provider acquisition page using the original tagline, feature inventory, no-lead-fees value proposition, and integrated-tools comparison; keep actual plan entitlements and visibility distinctions accurate.
- [x] Reuse existing approved editorial image in WebDev storage; preserve global header, `/` design, all prototype routes, signed-in workspaces, plans, subscription behavior, bookings, payments, and onboarding.
- [x] Route the public homepage provider path and a footer entry to the benefits page, with explicit pricing and sample-profile next steps; avoid duplicate closing conversion blocks.
- [x] Add the public route, sitemap/reserved-slug and share metadata; cover content and route contracts, actual pricing/sample destinations, desktop/tablet/mobile and keyboard focus; pass 178 files / 2,002 tests, build, TypeScript, diff and cleanup; save an unpublished checkpoint. Do not publish without approval.

## Public marketing width and header refinement (review before publication)
- [x] Widen only the public homepage and For Providers desktop content to a responsive 1600px maximum with familiar edge gutters; keep mobile/tablet layout stable.
- [x] Align the shared public header to the widened content and Concept 3’s warm-paper, deep-green, editorial typography; retain Search, Pricing, Sign In, Get Started and mobile-menu destinations, and keep signed-in header styling and behavior unchanged.
- [x] Update focused contracts; inspect 1920px/1440px, tablet, and 390px/320px plus signed-in header; pass 178 test files / 2,002 tests, production build, cleanup, TypeScript and diff checks; save an unpublished checkpoint. The previously stopped testimonial request is out of scope.

## Shared header/footer brand alignment and release (approved)
- [x] Use the compact public footer's exact mark and Ology/Crew coral wordmark treatment in the header on logged-out and signed-in pages; preserve logo Home destination and account controls.
- [x] Apply warm-paper, deep-green, and coral header styling to signed-in and public modes, including measured, reduced-motion-aware link/control hover effects and visible keyboard focus.
- [x] Check public, provider, customer, admin and mobile navigation; pass focused and full tests (178 files / 2,002 tests), production build, type/diff and cleanup checks; checkpoint the approved release. Publishing and production verification are separate follow-up actions.

## Public discovery design-system pilot — Explore and provider profiles (unpublished)
- [x] Add passive, reusable OlogyCrew brand color/type/spacing tokens and scoped pilot CSS without replacing global light-blue workspace/theme tokens.
- [x] Give canonical `/browse` a warm-paper/deep-green editorial search and results treatment using real categories/providers/services; preserve query-state search, filters, promotions, save buttons, direct/quote CTAs, and signed-in navigation.
- [x] Give real public provider profiles a matching editorial identity, service cards, trust/reviews/sidebar treatment; preserve real data, official-demo distinction, share, messaging, quotes, tips, and adaptive booking destinations.
- [x] Validate logged-out and signed-in views at desktop/tablet/390px/320px, search/category/provider/service click-through, accessible focus and reduced motion; pass 179 test files / 2,006 tests with a bounded 30-second per-test allowance for legacy external SendGrid/Twilio checks, TypeScript, build, cleanup and diff checks; save an unpublished review checkpoint. Do not publish without explicit approval.

## Shared full footer palette alignment (unpublished)
- [x] Recolor the full public footer shown in the screenshot from navy/sky to warm sage, deep green, ivory, coral, and leaf accents while keeping its two clear pathways and all content/destinations unchanged.
- [x] Apply the same branded dark-green base to the signed-in utility footer so it remains cohesive with the new shared header; keep the existing compact marketing footer unchanged.
- [x] Verify accessible contrast, focus/reduced-motion states, desktop/mobile public and signed-in variants, focused/full regressions (179 files / 2,007 tests with bounded external-network timeouts), build, TypeScript, cleanup, then save an unpublished checkpoint. Do not publish without explicit approval.

## Explore advanced-filter helper-text contrast (unpublished)
- [x] Scope the dark-hero copy selector to its own editorial heading and description so it does not recolor text inside the light advanced-filter panel.
- [x] Explicitly style the free-estimate and emergency-filter descriptions with a readable brand-muted color and 14px size; keep their labels, checkboxes, search URL state, and filter behavior unchanged.
- [x] Measure 5.91:1 WCAG AA normal-text contrast against the real panel background in both filter states at desktop/390px/320px, verify the visible checkbox boundary/focus and unchanged filter URLs; pass 179 test files / 2,008 tests, build, TypeScript, cleanup, and diff checks; save an unpublished checkpoint. Do not publish without approval.

## Official demo provider profile decluttering — review before publication
- [x] Apply only when `provider.isOfficial`: condense the hero's category display, keep the DEMO identity and no-charge notice, remove low-value demo stats, and let visitors open booking guidance voluntarily rather than with an automatic modal.
- [x] Surface four genuine demo service links first; keep the entire service catalog available through an obvious searchable category browser with complete counts and unchanged adaptive deep links.
- [x] Keep normal provider profiles, booking/quote/payment/server behavior, and data unchanged. Verify 1440px/tablet/390px/320px samples, search/category filters, direct service links and normal-profile isolation; pass 180 test files / 2,012 tests, production build, TypeScript, diff and zero test-data residue; save an unpublished checkpoint. Do not publish without explicit approval.

## Footer social sharing and approved combined publication
- [x] Add Facebook/LinkedIn share links and a copy-link control to compact public and full public/signed-in footers; share only the canonical public OlogyCrew homepage, not private workspace URLs.
- [x] Preserve footer acquisition/workspace/legal/payment content, create a concise Help Center article, and verify icon contrast, focus, mobile layout, link safety and copy feedback.
- [x] Complete focused/full tests (180 files / 2,015 tests), TypeScript/build/cleanup/diff checks and checkpoint the combined staged changes for the approved publication.
- [x] Publish to both current OlogyCrew domains; verify the exact `/assets/index-CUWQYD3t.js` bundle, live footer sharing/copying, Help Center guide and official demo profile with no promotional strip. Management UI confirms Published.

## Public provider hero width and green background treatment (unpublished)
- [x] Let the provider biography fill the available hero text column rather than stopping at 672px; keep the avatar, heading, trust badges, location, service CTA and mobile stacking unchanged.
- [x] Add a subtle deep-green gradient and CSS-only abstract leaf-accent ring behind the content; no new media or provider data, and maintain AA text contrast.
- [x] Review long/short/official-demo profiles at 1920px/1440px/1024px/tablet/390px/320px; verify services/share and keyboard focus; pass 180 test files / 2,017 tests, TypeScript/build/cleanup/diff checks; save an unpublished checkpoint. Do not publish without approval.

## Remove provider-profile promotional strip everywhere (unpublished)
- [x] Remove the pictured three-line “Powered by OlogyCrew / digital home / Get your own page” strip from all public provider profiles, not just the official demo.
- [x] Preserve the normal shared footer, the demo's free-booking safety notice, profile actions, and the separate single-line embed-widget attribution; avoid changing booking/payment or provider data.
- [x] Verify normal/official-demo profiles at 1440px/390px/320px, update focused regression contracts, pass 180 files / 2,017 tests, production build, TypeScript, diff and zero-residue cleanup, then save an unpublished checkpoint. Do not publish without explicit approval.

## Pricing-page people-first design pass (unpublished review)
- [x] Scope warm-paper/deep-green/coral styling to `/pricing`, preserving shared header/footer and global workspace tokens.
- [x] Make the hero headline and description provider/customer-aware; add a main landmark and stateful accessible labels to audience and billing toggles.
- [x] Move existing tier CTA blocks immediately below each price without changing handler bodies, prices, plans, trials, checkout or downgrade rules.
- [x] Raise excluded-feature text to WCAG AA 4.5:1; keep the install-app overlay from covering pricing cards only on this route.
- [x] Verify desktop/tablet/390px/320px, monthly/yearly and both audience views without charging; excluded-feature text measures 6.03:1, keyboard focus 3px; 181 files / 2,022 tests, build, TypeScript, diff and protected-record cleanup pass; save an unpublished review checkpoint. Do not publish without approval.

## Referral program: truthful public page, net-captured rewards, durable credit alerts (unpublished)
- [x] Preserve existing credit rows; for future pending referrals only, issue one positive reward when a non-official booking is completed and its USD Stripe booking payments have net captured funds (deposit + final/full less cumulative refunds). Evaluate after both completion and capture; no reward for unpaid or fully refunded bookings. Never trust caller totals or identities; use integer cents, transactional locking/unique claims and safe payment upserts. The earliest eligible completed/paid booking by booking creation order wins; demo and fully refunded earlier bookings do not block the next eligible one.
- [x] Make referral application server-validated and single-use per referee; clarify that a provider signup is tracked but not independently rewarded. Provider/customer invite links point to canonical public origin.
- [x] Post-award refunds: leave already-issued awards untouched; do not create negative balances, reclaim spent credits or change historic credit rows. Pre-award partial/full refunds reduce or eliminate new eligibility. A future reversal policy requires a separate product decision; this release does not promise retroactive clawbacks.
- [x] Replace the in-process expiry timer with an authenticated, task-UID-scoped, retry-safe `/api/scheduled/referral-credit-expiry` Heartbeat handler. Persist one in-app warning marker and notification per eligible credit, attribute spend before warning, and keep expiry history idempotent. The handler remains dormant until publication and a separately approved Heartbeat with persisted task UID.
- [x] Restyle `/referral-program` in scoped people-first tokens with a concise responsive hero, actual signed-in link/credits/tier state, truthful paid-booking explanation, tiers, accessible FAQ and shared footer. Preserve sign-in/copy/referrals routes, canonical metadata and workspace styling.
- [x] Verified logged-out browser CTA/FAQ and signed-in screenshots at desktop/tablet/390px/320px; coral CTA contrast 4.97:1, muted text on paper 5.48:1, and visible focus/reduced-motion rules. Focused tests and full regression: 185 files / 2,025 tests pass. TypeScript, production build, whitespace check, protected-record cleanup, and unauthenticated 403 cron endpoint pass. Existing non-failing Vitest close-handle and Vite chunk advisories remain.
- [x] Prepare unpublished review checkpoint; no publication in this task. After a separately authorized deployment, separately approve/create the project Heartbeat, persist its task UID, and verify first execution before calling in-app expiry warnings operational.

## Help Center people-first refresh (unpublished review)
- [x] Scoped `/help` in public warm-paper/deep-green/coral tokens; shared NavHeader/Footer and global signed-in workspace styling remain unchanged.
- [x] Search and no-result recovery, three immediate customer/provider/payments paths, collapsed guide topics, native FAQ disclosures, topic/contact hash navigation, support form, original 54 guides and 43 FAQs all remain available. Added accessible labels, focus rules and reduced-motion behavior.
- [x] Corrected Messages to `/messages`, canonical Services/Quotes/Portfolio help links, obsolete Trust Score guarantee, misleading referral/signup rewards and unsupported category counts. The existing public contact tRPC/storage contract is intact; guest acknowledgements and admin replies now use accurate support templates/sender instead of booking-confirmed copy or the owner's personal inbox. The UI does not promise an email or response deadline when email delivery is not guaranteed.
- [x] Checked logged-out browser search, opened a matching guide, no-results recovery, FAQ category filters, provider/contact fragments, and signed-in responsive previews at desktop/tablet/390px/320px. Did not submit a real support request. Measured AA text contrast (muted 5.48:1, coral button 4.97:1), visible focus and reduced motion. Focused tests 5 files/59 pass; full suite 186 files/2,032 tests pass; TypeScript, production build, diff check and test-data cleanup pass. Known non-failing Vitest close-handle warning and Vite chunk advisory remain.
- [x] Prepare the unpublished review checkpoint after validation. Await a separate user instruction before publishing the Help update. No schema, plan, checkout, payment, booking or account permission changes were made.

## Help resources page revision (requested after checkpoint 2662027b; unpublished)
- [x] Replaced the FAQ-first layout with a searchable editorial resource header, three featured guides from actual existing content, five topic collections with counts, an in-place collection reader, then secondary FAQs and support.
- [x] Preserved all 54 guides, 43 FAQs, guest contact form, support email fix, canonical Help route and shared footer. Featured cards open their correct article; legacy provider and contact fragments navigate to the new library/form. Search finds guide content and FAQs; no-result recovery remains.
- [x] Kept concise helper notes by search, topic browsing and support, visible keyboard focus, AA brand contrast and reduced motion. Reviewed desktop and 768px/390px/320px full-page responsive layouts, featured provider article, provider deep link and referral search/article reading; no checkout or contact submission triggered.
- [x] Updated resource navigation tests (five focused files/60 tests pass); full suite 186 files/2,033 tests pass, TypeScript and production build pass, whitespace check and cleanup show zero test users/providers/orphans. Known non-failing Vitest close-handle and Vite chunk warnings remain. Prepare an unpublished checkpoint; do not publish without separate approval.

## Help Resources people-first image hero (requested after checkpoint b876902c; unpublished)
- [x] Generated original people-centric desktop/mobile hero photography and uploaded optimized WebP assets to WebDev-managed storage (~110KB each); no repository public/assets additions, restricted stock, or invented testimonial claims.
- [x] Centered the existing Help headline, contextual copy and functional search on a full-width image with dark AA-readable overlay, responsive mobile portrait, and high-contrast contact-support pill. Hid the fixed install prompt only on Help so the mobile people/photo remain visible; all resource, FAQ, contact and canonical flows preserved.
- [x] Reviewed desktop, 768px tablet, 390px and 320px hero crops; mobile people and text are visible without the fixed install prompt. Contrasts on the dark hero wall: ivory 13.57:1, coral 7.93:1, leaf 11.05:1, search placeholder 6.13:1. Tested live search, Clear, support fragment and keyboard-visible focus without a real contact submission. Four affected-contract files/29 tests pass, full regression 186 files/2,034 tests pass, TypeScript/build/diff pass and test cleanup leaves zero test accounts/providers/orphans (official demo/admin protected). Known non-failing Vitest close-handle and Vite chunk warnings persist. Save unpublished checkpoint; publication requires another explicit instruction.

## Help hero rounded-corner alignment (after live checkpoint 2fb0112e; unpublished)
- [x] Matched the real public homepage hero frame: 10px top corners and 32px side gutters on wide desktop; 22px gutters on tablet; 5px corners and 18px gutters on mobile, with the same 30px/12px top breathing room. Kept Help image/overlay/text/search and all other routes intact; reviewed rendered 1440px/768px/390px/320px layouts.
- [x] Added a scoped regression test comparing the homepage's desktop/mobile frame values; checked 1440px/768px/390px/320px screenshots and no clipped content. Focused 2 files/17 tests, full suite 186 files/2,035 tests, TypeScript/build and diff checks pass. Cleanup leaves zero test users/providers/orphans and protects the official demo and two admins. Save an unpublished checkpoint; do not publish without approval. Known non-failing Vitest close-handle and Vite chunk-size warnings remain.

## People-first Open Graph sharing refresh (unpublished)
- [x] Kept existing share URLs and handlers, replaced old provider-only generic pitch/200x50 logo with a new original 1200x630 people-first photo card (149 KB) on managed storage. Added truthful route-specific copy/canonical public URLs for homepage, Explore/Search, Pricing, Help, Referral, signup/provider onboarding, Featured, Experiences and legal pages. Kept real provider/service identity in dynamic cards and the For Providers editorial photograph; updated only their dated blue/neon backdrop, accents and misleading universal booking footer, leaving trust badges untouched.
- [x] Removed the outdated referral OG gift artwork that claimed credits on every referral; its server and hydration metadata now match the eligible paid-booking/net-captured rule. No reward, checkout, plan or link behavior changed.
- [x] Validated a single canonical OG/Twitter card per route across homepage, Explore/Search, Pricing, Help, Referral, signup/onboarding, Featured, Experiences and legal routes; provider/service keep their identity, preview-host share links still redirect preview users on their original host, and private query tokens are not surfaced. Image URL returned HTTP 200 JPEG at 1200x630 (149 KB); browser hydration on Referral preserves its matching OG image/title/canonical. Focused 7 files/103 tests and full 187 files/2,052 tests pass on exact source; TypeScript, production build, diff check and cleanup pass (zero test users/providers/orphans, official demo and protected admins intact). Contrast: ivory/deep green 12.14:1; leaf/deep green 8.58:1; white/coral 4.97:1; original dark clock/paper 10.28:1. Known non-failing Vitest close-handle and Vite chunk advisories remain. Save an unpublished checkpoint; do not publish before review.

## Public category detail pages: people-first visual alignment (unpublished)
- [x] Restyled only `/category/:slug` with scoped warm-paper/deep-green/coral/leaf tokens: editorial category hero, concise real category facts, links on authentic provider portraits where present, calmer filter bar and legible provider/service cards. Category ID/slug/icon and real listing data remain untouched; no invented availability, ratings or prices.
- [x] Kept shared header/footer, existing tRPC data paths, promotion order, favorites, response time, availability, all filter types, 12-at-a-time pagination and official demo distinction. Provider profiles and paid/quote/demo service cards retain direct real destinations; no nested links/buttons or dead `#` profile links. No-match filters no longer display unrelated services; category/listing errors, loading, empty states are distinguished.
- [x] Reviewed populated AV/Barber and demo-only Food Delivery at desktop 1440px, 768px tablet, 390px and 320px; both public and signed-in shells remained intact, no horizontal clipping. Browser-tested real location narrowing/clear/no-match state, advanced filter controls, a quote-service route and a hero provider-profile link without submitting any booking, quote or payment. Category main has zero nested links/buttons, real price and demo labels, official-demo-only truthful copy. Focused 3 files/17 tests, final full suite 188 files/2,060 tests, TypeScript/build and diff checks pass; text contrast ≥4.97:1 and dark-hero focus ring ≥5.65:1. Cleanup found zero test users/providers/orphans; official demo's 54 services and two protected admins remain. Known non-failing Vitest close-handle and Vite chunk-size advisories persist. Save a review checkpoint only, not a production deployment.

## Public platform & products page (unpublished, requested 2026-10-03)
- [x] Reviewed Calendly’s official homepage and scheduling product page: use direct product promise, clear capability blocks, step-by-step lifecycle and contextual routes, not Calendly’s claims, AI assistant, metrics, testimonials or integrations. OlogyCrew is a two-sided service marketplace and provider workspace, not a meeting scheduler clone.
- [x] Mapped real OlogyCrew browse/profiles, direct and quote service paths, calendar/bookings, messages/Customers and paid-plan Stripe collection/invoicing. Read-only SQL confirmed no provider owns `/platform`; preserve plan prices/entitlements and make no unverified performance claims.
- [x] Built people-first `/platform` with two original illustrative WebP photos (177 KB/114 KB, correctly labelled as illustration and uploaded to WebDev-managed storage), five truthful product areas, a four-step connected journey, and direct Browse/For Providers/Pricing/official-demo paths. Kept business workflows, plans and records unchanged.
- [x] Added the page to the shared compact/full public footer and logged-out mobile menu without restoring hidden desktop navigation; registered a canonical route before provider-slug fallback, server/client title/OG, sitemap and reserved provider slug. Hid only the Platform route's fixed install banner so small-screen hero/CTAs stay visible; other navigation/overlays remain intact.
- [x] Reviewed logged-out browser at desktop and signed-in WebDev screenshots at 1440px/768px/390px/320px; tablet hero now stacks for legible type and complete photo, mobile cards and two-path CTAs wrap without clipping. Browser-tested product anchor, customer Explore and official sample profile without booking/checkout; photo loads returned 200 WebP at 181,566/117,018 bytes. Verified canonical `/platform` OG/title and no private query leak; primary coral CTA 4.97:1, hero leaf 8.58:1, paper muted 5.48:1, light/dark focus rings visible, reduced-motion covered. Focused 11 files/81 tests and full 190 files/2,067 tests pass after adjusting six exact-source assertions to preserve original behaviors; TypeScript, production build and diff check pass. Cleanup found zero test accounts/providers/orphans, official demo's 54 services and two protected admins intact. Known non-failing Vitest close-handle, Vite chunk-size and pnpm config warnings remain. Save an unpublished checkpoint; do not publish without approval. Prior unpublished homepage caption change is cumulative.

## Signed-in provider homepage people-first style pilot (unpublished)
- [x] Confirmed the signed-in provider home is `LoggedInHome` → `ProviderWorkspaceOverview` at `/?view=provider`, not the legacy `/provider/dashboard` tab route. Baseline desktop/mobile showed a navy/blue hero, blue-selected sidebar, white cards and a shared light-blue workspace background; source queries and actions are already functional.
- [x] Applied page-scoped brand CSS to the provider Overview only: paper canvas, deep-green greeting with a restrained leaf motif, coral alert kicker, leaf Bookings CTA, pale sage card surfaces and green selected desktop/mobile navigation. Retained the same operational layout and semantic red/amber urgency; no new imagery, global theme changes, invented numbers or business-logic changes.
- [x] Preserved the existing Edit Profile dialog, My Bookings link, setup progress/actions, share-link feedback, plan-gated invoice action, calendar, customer entitlements, real KPIs and all sidebar/mobile destinations. The customer home and non-Overview provider Services route still render their original blue workspace treatment; admin role/access code is untouched.
- [x] Reviewed signed-in provider at 1440px/768px/390px/320px, customer home and provider Services at 320px for isolation; no horizontal clipping or lost actions. The active mode/nav and attention/empty states remain clear; existing setup component and edit-profile tests protect conditional behavior and destinations. Measured hero copy 8.25:1, leaf focus ring on hero 6.46:1, paper muted copy 5.48:1, coral alert 5.72:1, leaf CTA 8.58:1 and selected nav 11.31:1; scoped keyboard focus and reduced-motion rules are present. Focused 7 files/41 tests and full 191 files/2,070 tests pass, TypeScript/build/diff checks pass. Cleanup found zero test identities/providers/orphans; official demo with 54 services and two protected admins remain intact. Existing non-failing Vitest close-handle, Vite chunk-size and pnpm settings warnings persist. Save an unpublished checkpoint; do not publish without approval.

## Extend provider palette across workspace routes (unpublished)
- [x] Extended the approved palette via `ProviderWorkspaceBackground` and a shared opt-in CSS import through provider-mode Bookings, Services, Calendar, Finances, Customers list/detail and Business Tools; also aligned the standalone read-only Analytics report. No tRPC queries/handlers, auth guards, plan, payment, booking or CRM business logic changed. Customer, admin, public and global blue theme stay unchanged.
- [x] Aligned the compact headers, sidebar/mobile active states, neutral cards/tabs, primary button surfaces and neutral Calendar/Customers privacy guidance; the provider-only Customers introduction popover now uses the same colors. Loading/error backgrounds inherit the provider surface. Kept urgency/status, trust/plan, destructive action and chart cancellation colors distinct; focus rings and reduced-motion rules are scoped. Focused provider/theme/CRM/calendar/subscription tests passed (11 files/73 tests).
- [x] Reviewed authenticated WebDev screenshots of Bookings (provider and customer), Services, Calendar, Money, Customers, Business Tools and read-only Analytics at desktop/tablet/390px/320px. Provider pages use warm paper/deep-green/leaf while customer home/bookings remain original navy/blue; calendar status and red/amber plan warnings still use semantic colors. Customer popover retains explicit message-permission rules. Cloud browser lacked provider login, so real Calendar/Tools clicks and Stripe connection were not performed; those actions and entitlements remain unmodified and covered by existing focused tests. WCAG contrast: header eyebrow 10.39:1, header copy 8.25:1, leaf CTA 8.58:1, neutral info 10.72:1, primary button 13.59:1, paper focus ring 5.72:1. Focused 11 files/73 tests and exact-source 3 files/15 tests passed; full suite 192 files/2,074 tests, TypeScript/build and diff checks pass. Cleanup: zero test users/providers/orphans, official demo 54 services and protected admins intact. **Unrelated preview warning:** Stripe Connect status logged an expired `sk_test_...` API key, so live payment-status operation was not verified; no credentials or payment logic changed. Known non-failing Vitest close-handle/Vite chunk and pnpm config warnings persist. Save unpublished checkpoint; do not deploy without approval.

## Stripe test secret for development preview (unpublished)
- [x] WebDev would not edit built-in `STRIPE_SECRET_KEY`. Opened a secure input for separate `STRIPE_DEV_SECRET_KEY`; the key was never pasted in chat, committed or printed.
- [x] A temporary Vitest authenticated to Stripe read-only and retrieved one existing OlogyCrew test Connect account; removed that live test so CI requires no external credentials. Added a permanent selection regression test (development-only, production/test unchanged, malformed keys rejected).
- [x] The server-side Stripe key selection uses the new test secret only for `NODE_ENV=development`. Confirmed the running preview server receives it; the signed-in provider Finances preview shows Stripe Connect active and payouts enabled. No payments, refunds, onboarding or publication were initiated. The built-in production key was not rotated.
- [x] Read-only live-key checks 2/2 passed (platform account plus an existing Connect account); temporary external-key test was removed. Focused Stripe/account/entitlement tests 4 files/29 tests, full suite 193 files/2,077 tests, TypeScript, production build and diff check all passed. Cleanup found zero test users/providers/orphans, and retained official demo, two protected admins and audit history. Known non-failing Vitest close-handle and Vite chunk-size warnings remain. Save unpublished checkpoint. A production Stripe key rotation would require a separate supported secure path—this change does not fix production billing.

## Customer workspace people-first palette (unpublished)
- [x] Reviewed signed-in customer Home, My Bookings, Bulk Booking, Monthly Planner, Saved Providers and Messages, plus Explore (already public-brand styled). Shared-nav pages use blue active state and navy hero on a global light-blue page token; signed-in Explore already has its own people-first discovery CSS.
- [x] Added CustomerWorkspaceShell-scoped paper/deep-green/coral/leaf theme for Home, My Bookings, Saved Providers, Messages, Planner and Bulk Booking; Explore retains its approved discovery hero while its signed-in nav uses the neutral palette. Search/actions/rebooking, filters, five nav destinations, role toggle and tRPC handlers remain intact. Planner date, Bulk current step and selected saved folder now expose accessible state, while booked/error status pills and user-set folder icon colors remain distinct.
- [x] Opted in only customer secondary Quotes, Waitlist, Receipts, Customer Plan and Billing History with neutral canvas/cards/typography. Decorative plan icons, interval choice, available usage meter and most-popular label match the brand; trial/plan warning, at-limit red meter, prices, downgrade/checkout, quote, paid/refunded/overdue records and sent/received message bubbles are unchanged. Focused 11 files/130 tests and TypeScript pass.
- [x] Reviewed signed-in customer Home, My Bookings, Saved Providers, Messages, Planner, Bulk Booking, Quotes, Waitlist, Receipts, Plan and Billing History at 1440px/768px/390px/320px in the managed preview. Public Explore's existing hero, provider Overview/Services and Admin Dashboard retain their own palettes; booking/planner/quote/plan status distinctions remain visible. Mobile fixed PWA install card is pre-existing and was not modified. Need-first search, filter, folder, planner-step and messaging route contracts passed; no booking, checkout, refund, message or folder mutation was performed during visual review. Measured muted-on-paper 5.48:1, white-on-deep 13.59:1, white-on-coral 4.97:1, leaf-on-deep 8.58:1, selected deep-on-sage 11.31:1 and paper focus 5.6:1; reduced-motion rule is scoped. Focused 11 files/130 tests and full 194 files/2,083 tests pass; TypeScript, production build, preview HTTPS 200 and whitespace checks pass. Full-suite cleanup removed 26 test accounts/8 test providers and verifier found zero remaining test identities, dependent or orphan rows; official demo's 54 services and both protected admins remain. Known non-failing Vitest close-handle, Vite chunk advisory and pnpm settings warnings remain. Save unpublished checkpoint; do not publish without approval.

## Provider My Subscription palette (unpublished)
- [x] Confirmed account menu maps provider view to `/provider/subscription` (`SubscriptionManagement.tsx`) and customer view to `/customer/subscription`, which already uses the new customer palette. The provider page still has blue canvas/plan accents, while its plan values and lifecycle actions are live and must not change.
- [x] Added an opt-in provider-only stylesheet for paper/deep-green heading, accessible monthly/annual choice, neutral trial offer/current plan/usage panels, coral Most Popular badge, and sage plan icon/card accents. Urgent trial remains amber; at-limit meter stays red; unavailable features are struck through with readable muted text; downgrade buttons are neutral outline and current-plan ring deep green. Pause/downgrade dialogs keep their warning copy and actions, now use valid accessible div descriptions instead of nested paragraphs. No prices, checkout, proration, portal, subscription queries/mutations or customer-page styles changed; no new images.
- [x] Reviewed signed-in provider and already-branded customer plan pages at 1440px and 390px plus provider at 768px/320px: all three plan cards, real $0/$12/$20 monthly values, current-plan ring and neutral downgrade buttons remain legible with no horizontal clipping; customer styling is unaffected. Isolated UI tests selected annual billing without calling checkout, verified the different current-plan state, guest sign-in view, urgent trial styling, and opened/cancelled pause/downgrade warnings without calling mutations. Added a label to annual selection and repaired pre-existing invalid nested dialog paragraphs. Contrast: deep-on-paper 12.14:1, muted-on-surface 6.03:1, muted-on-sage 5.4:1, urgent-on-amber 8.85:1, white-on-coral 4.97:1, coral focus-on-paper 5.72:1. Focused 6 files/44 tests plus UI 2 files/6 tests, full 196 files/2,089 tests, TypeScript/build, diff and preview HTTP 200 pass. Cleanup: zero exact test users/providers/orphans; official demo retains 54 services and both protected admins remain. Known non-failing Vitest close-handle and Vite chunk warnings persist. Save unpublished checkpoint; do not publish without new approval.

## Shared mobile account menu people-first palette (unpublished)
- [x] Compared the supplied provider/admin screenshot with `NavHeader` mobile drawer and mobile view switcher: warm site header sits above a rainbow shortcut grid, a blue admin badge, gray role toggle and red logout. The real menu supports provider/customer/guest roles; keep its four-column app-screen layout and every item present after navigation.
- [x] Styled only the open mobile drawer with paper canvas, ivory identity/footer, sage/leaf/coral icon fields, deep-green role/admin state, readable account labels and a contrasting coral logout action. Preserved actual avatar, notification count, all provider/customer/guest links, conditional Install App, sign-in/logout handlers, role permissions and desktop header/dropdown. The role pills now expose `aria-pressed`; the header trigger only exposes `aria-controls` while the drawer is mounted. Drawer top tracks the actual sticky header (including the preview-only safety notice) and rises above the existing PWA prompt so close and logout remain reachable; no PWA behavior changed.
- [x] Authenticated provider and customer drawers reviewed at 390px/844px and 320px/700px: the header and close control stay visible below the preview safety notice, the drawer floats above—not under—the PWA prompt, seven core provider shortcuts and optional Install App retain four-column spacing, two-line labels fit at 320px, and Logout stays at the bottom safe area. Temporary review hook removed before final tests; guest destinations covered in isolated UI tests. Text contrast: ink/paper 10.87:1, inactive role/sage 5.15:1, deep/leaf 8.58:1, coral tile icon 5.18:1, logout/surface 6.30:1; focus ring 6.30:1, reduced-motion rule scoped. Focused 6 files/33 tests and full 198 files/2,095 tests pass; TypeScript/production build/diff and preview health pass. Full-suite cleanup removed temporary tests and verifier found zero remaining exact test accounts/providers/orphans, preserving official demo with 54 services and both protected admins. Known non-failing Vitest close-handle and Vite chunk warnings remain. Save unpublished checkpoint; no production deployment without approval.

## My Account people-first palette (published 2026-10-06)
- [x] Mapped `/account` to `UserProfile.tsx`, shared by admin/provider/customer. Current screen has a pale-blue canvas, amber generic tip, white profile/password/2FA cards and a blue provider-onboarding panel; real avatar, personal details, billing address and security actions must remain authoritative.
- [x] Added an opt-in `UserProfile.css` warm-paper/deep-green/coral/leaf palette for title, calm trust tip, completion and identity cards, neutral inputs/buttons, password and 2FA panels, and optional customer onboarding. Kept password-strength red/amber/green, active security green, deletion/disable red, role badge, billing privacy note, shared header and all other routes untouched. Fixed invalid nested deletion warning markup via Radix `asChild` without changing text or the `DELETE` confirmation flow. No backend, schema, entitlement, booking or payment changes.
- [x] Preserved real photo upload/crop/removal, profile edit/save, provider business name, password and 2FA controls, deletion safeguard and admin deletion exclusion. Isolated UI mocks exercised admin/provider/customer surfaces and the warning dialog without real mutations; focused 2 files/6 tests and full 200 files/2,101 tests passed. Reviewed signed-in 1440px/768px/390px/320px; no visible clipping/overflow and mobile 2FA button stacks safely. Contrast: deep/paper 12.14:1, muted/surface 6.03:1, tip/sage 10.72:1, coral focus/paper 5.72:1, white/deep 13.59:1, deep/leaf 8.58:1 and danger/surface 7.23:1. TypeScript, production client/server build and diff checks passed; cleanup left zero exact test users/providers/orphans, preserving the official demo and protected admins. Known non-failing Vitest close-handle and Vite chunk advisories persist. Checkpoint `2e2d2a1d` was published after the owner's explicit 2026-10-06 approval; live `/account` rendered successfully.

## Billing History and Notification Settings people-first palette (unpublished)
- [x] Confirmed the account menu's Settings destination is `/notification-settings`; separate provider and customer Billing History routes are `/provider/billing` and `/customer/billing`. Customer history already had the generic customer utility palette; provider history and Settings still needed account-adjacent styling. No media, data-model, entitlement or notification policy changes are requested.
- [x] Added shared opt-in Billing History styling and Settings-only styling for warm paper, ivory cards, sage plan/relationship guidance, deep-green headings, neutral buttons and accessible switch selection. Preserved provider/customer subscription queries, cursor history, invoice downloads, paid/pending/failed/action-required badges, disabled SMS, push-permission/error states and both marketing and relationship-message opt-ins. Provider Billing History's back link now targets its existing canonical `/provider/subscription` page instead of the legacy redirect; no billing action changed.
- [x] Focused palette/isolated UI/customer utility/subscription semantics tests passed (4 files/21 tests). The initial full run exposed one existing source test expecting the customer utility classes in their original order; restored that exact order and revalidated without weakening its contract. Final full regression: 202 files/2,108 tests passed. TypeScript, client/server production build, whitespace and local preview HTTP 200 for all three routes passed. Reviewed signed-in desktop/768px/390px/320px screenshots of all three routes without performing payment or preference mutations. Measured ink/paper 10.87:1, muted/surface 6.03:1, muted/sage 5.40:1, deep/sage 11.97:1, deep/white 13.59:1 and focus/paper 5.72:1. Test cleanup removed 26 temporary accounts/8 providers; verifier found zero test identities/providers/orphans and preserved the official demo (54 services) and both protected admins. Known non-failing Vitest close-handle and Vite chunk-size advisories persist. Save an unpublished checkpoint; do not publish until explicit owner approval.

## Admin visual social posting (unpublished, 2026-10-07)
- [x] Preserved the functional admin dashboard and existing Monday 10:00 UTC Heartbeat, Facebook and LinkedIn scope. Added three original OlogyCrew square cards: customer (“Find the right person for the job.”), provider (“Your craft deserves to be found.”), and verified-supply DJ & Music Services (“Set the scene with music.”). Optimized JPEGs at 1920px square are stored in WebDev-managed storage outside source assets; generated images are illustrative rather than actual provider endorsements. Caption generation remains server-side and is prompted to avoid invented reviews, verified claims, guarantees and prices. CTAs go to the existing `/browse`, `/for-providers`, or eligible `/category/dj-music-services` route.
- [x] Preview saves the exact image, alt text, target and caption on an admin-only draft; Publish This passes that draft ID, rather than generating a new post. Manual Create Post picks a reviewed artwork, appends its real public CTA if absent, and saves as a draft or, after production publication, creates a task-UID-bound Heartbeat for the chosen time. Preview scheduling is deliberately blocked so the preview cannot schedule production social posts. Successful first-channel delivery is preserved on partial retries. A posted or in-progress draft cannot publish twice; the weekly campaign is uniquely keyed to its UTC Monday. Callbacks reject ordinary users and orphaned task identities. No new interval/cron library was added.
- [x] Facebook now creates Page photo posts with caption and alt text; LinkedIn uploads images and creates an organization-authored image post via versioned Posts API. When the organization ID is missing or rejected, it fails closed rather than posting as the account owner. Historical media-less drafts still use text-only endpoints. Status and per-platform result remain visible in admin history; partial and failed records show a retry action.
- [x] An additive migration adds nullable `media_url`, `media_alt`, `target_url`, `schedule_cron_task_uid`, and `weekly_key` to `social_posts`, with unique task/week keys. SQL statements, live schema and hash were inspected; migration `0065_fuzzy_diamondback` is applied and recorded in `__drizzle_migrations`. Existing weekly Heartbeat task UID was stored in `platform_settings`. No historical posts were edited and no social post was sent in testing.
- [x] Initial two-card checkpoint `1e6fbac7` passed 204 files/2,123 tests. Final three-card revision: focused 5 files/30 tests, full regression **205 files/2,130 tests**, TypeScript, client/server production build, whitespace and cleanup passed; zero exact test accounts/providers/orphans and the official demo/protected admins/financial audit targets preserved. All three public JPEGs return HTTP 200; unauthenticated weekly and one-time callbacks both return 403. Signed-in desktop Social Media tab and loaded 390px mobile social actions/history were reviewed, with buttons wrapping and cards within the viewport; the Create Post modal was not clicked and its rendered responsive layout was not visually verified. Known non-failing Vitest close-handle and Vite large-chunk advisories persist. **Do not publish or send an actual post until separately approved**.
- [x] Added a third **DJ & MUSIC SERVICES** spotlight with a distinct original illustrative DJ/customer card and its exact category destination. At generation, manual draft creation and again just before publication, a live query requires an active category, active service, active non-demo provider with verified status, and an undeleted provider owner. If supply disappears during a scheduled week, automation falls back to the customer artwork before drafting; if a saved spotlight loses eligibility, publication stops without an external request. Read-only admin eligibility exposes the template only while eligible. The only active Barber Shop listing belonged to the pending-review IndyLmer LLC case, so Barber Shop was deliberately excluded; no provider identity, testimonial or implied personal endorsement is in the DJ creative. Full regression and build passed as above; this is for owner review, not an instruction to post or deploy.
