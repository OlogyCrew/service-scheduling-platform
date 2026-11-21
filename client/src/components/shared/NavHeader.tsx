import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
// getLoginUrl kept for backward compat if needed elsewhere
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import {
  MessageSquare,
  Calendar,
  Bell,
  Menu,
  X,
  MessageCircleQuestion,
  Sparkles,
  User,
  Briefcase,
  CheckCheck,
  ExternalLink,
  Heart,
  FileText,
  LogOut,
  Settings,
  ChevronDown,
  Coins,
  CreditCard,
  Download,
  Shield,
  Trash2,
  Grid3X3,
  HelpCircle,
  Clock,
  LayoutDashboard,
  Compass,
  Award,
  ShieldCheck,
  BarChart3,
  Image,
  Rocket,
  UserCircle,
  Star,
  Tag,
  Gift,
  BookOpen,
  Users,
  UserCog,
  Search,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useState, useRef, useEffect, useCallback } from "react";
import { useSSE } from "@/hooks/useSSE";
import { toast } from "sonner";
import { ViewModeSwitcher, ViewModeSwitcherMobile } from "@/components/ViewModeSwitcher";
import { useViewMode } from "@/contexts/ViewModeContext";
import { usePWAInstallContext } from "@/contexts/PWAInstallContext";
import "./PublicBrandHeader.css";
import "./MobileAccountMenu.css";

function NotificationDropdown() {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();
  const [sseConnected, setSseConnected] = useState(false);

  // Fetch initial data (polling as fallback, but SSE will push updates)
  const { data: notifData } = trpc.notification.list.useQuery(
    { unreadOnly: false },
    {
      enabled: isAuthenticated && open,
      refetchInterval: open ? (sseConnected ? false : 60000) : false,
    }
  );
  const { data: countData } = trpc.notification.unreadCount.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: sseConnected ? false : 60000,
  });

  // Real-time SSE connection
  const handleSSENotification = useCallback((data: any) => {
    // Invalidate queries to refresh the list
    utils.notification.list.invalidate();
    utils.notification.unreadCount.invalidate();

    // Show toast for new notification
    toast(data.title || "New Notification", {
      description: data.message?.slice(0, 100) || "",
      duration: 5000,
    });
  }, [utils]);

  const handleSSEUnreadCount = useCallback((_data: any) => {
    utils.notification.unreadCount.invalidate();
  }, [utils]);

  const handleSSENewMessage = useCallback((data: any) => {
    // Invalidate message-related queries
    utils.notification.list.invalidate();
    utils.notification.unreadCount.invalidate();
    utils.message.unreadCount.invalidate();

    toast(`Message from ${data.senderName || "Someone"}`, {
      description: data.messagePreview?.slice(0, 80) || "New message received",
      duration: 4000,
    });
  }, [utils]);

  useSSE({
    enabled: isAuthenticated,
    onNotification: handleSSENotification,
    onUnreadCount: handleSSEUnreadCount,
    onNewMessage: handleSSENewMessage,
    onConnected: () => setSseConnected(true),
    onDisconnected: () => setSseConnected(false),
  });

  const markRead = trpc.notification.markAsRead.useMutation({
    onSuccess: () => {
      utils.notification.list.invalidate();
      utils.notification.unreadCount.invalidate();
    },
  });
  const markAllRead = trpc.notification.markAllRead.useMutation({
    onMutate: async () => {
      await utils.notification.list.cancel();
      await utils.notification.unreadCount.cancel();
      const prevList = utils.notification.list.getData({ unreadOnly: false });
      // Optimistically mark all as read
      if (prevList) {
        utils.notification.list.setData({ unreadOnly: false }, prevList.map((n: any) => ({ ...n, isRead: true })));
      }
      utils.notification.unreadCount.setData(undefined, { count: 0 });
      return { prevList };
    },
    onSuccess: () => {
      utils.notification.list.invalidate();
      utils.notification.unreadCount.invalidate();
    },
    onError: (_err, _vars, context) => {
      if (context?.prevList) {
        utils.notification.list.setData({ unreadOnly: false }, context.prevList);
      }
      toast.error("Failed to mark notifications as read");
    },
  });
  const clearAll = trpc.notification.clearAll.useMutation({
    onMutate: async () => {
      // Cancel outgoing refetches so they don't overwrite our optimistic update
      await utils.notification.list.cancel();
      await utils.notification.unreadCount.cancel();
      // Snapshot previous values
      const prevList = utils.notification.list.getData({ unreadOnly: false });
      const prevCount = utils.notification.unreadCount.getData();
      // Optimistically clear
      utils.notification.list.setData({ unreadOnly: false }, []);
      utils.notification.unreadCount.setData(undefined, { count: 0 });
      return { prevList, prevCount };
    },
    onSuccess: () => {
      utils.notification.list.invalidate();
      utils.notification.unreadCount.invalidate();
      toast.success("All notifications cleared");
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.prevList) {
        utils.notification.list.setData({ unreadOnly: false }, context.prevList);
      }
      if (context?.prevCount) {
        utils.notification.unreadCount.setData(undefined, context.prevCount);
      }
      toast.error("Failed to clear notifications");
    },
  });

  const unreadCount = countData?.count ?? 0;
  const notifications = notifData ?? [];
  const recent = notifications.slice(0, 8);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function getIcon(type: string) {
    switch (type) {
      case "booking_created":
      case "booking_confirmed":
        return "📅";
      case "booking_cancelled":
        return "❌";
      case "booking_completed":
        return "✅";
      case "reminder_24h":
      case "reminder_1h":
        return "⏰";
      case "payment_received":
        return "💰";
      case "message_received":
        return "💬";
      case "review_received":
        return "⭐";
      default:
        return "🔔";
    }
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        className="relative public-brand-icon"
        onClick={() => setOpen(!open)}
      >
        <Bell className="h-5 w-5 lg:h-4 lg:w-4" />
        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-4 min-w-[16px] flex items-center justify-center p-0 text-[9px]"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </Badge>
        )}
      </Button>

      {open && (
        <div className="fixed left-1/2 -translate-x-1/2 top-16 mt-2 w-[380px] max-w-[calc(100vw-2rem)] lg:absolute lg:left-auto lg:translate-x-0 lg:right-0 lg:top-full bg-white rounded-lg shadow-xl border z-[100] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
            <h3 className="font-semibold text-sm">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  className="text-xs text-primary hover:underline flex items-center gap-1 disabled:opacity-50"
                  onClick={() => markAllRead.mutate()}
                  disabled={markAllRead.isPending}
                >
                  <CheckCheck className="h-3 w-3" />
                  {markAllRead.isPending ? "Marking..." : "Mark all read"}
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  className="text-xs text-destructive hover:underline flex items-center gap-1 disabled:opacity-50"
                  onClick={() => clearAll.mutate()}
                  disabled={clearAll.isPending}
                >
                  <Trash2 className="h-3 w-3" />
                  {clearAll.isPending ? "Clearing..." : "Clear all"}
                </button>
              )}
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-[400px] overflow-y-auto">
            {recent.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No notifications yet
              </div>
            ) : (
              recent.map((n: any) => (
                <div
                  key={n.id}
                  className={`flex gap-3 px-4 py-3 border-b last:border-0 hover:bg-gray-50 cursor-pointer transition-colors ${
                    !n.isRead ? "bg-blue-50/50" : ""
                  }`}
                  onClick={async () => {
                    if (!n.isRead) {
                      try {
                        await markRead.mutateAsync({ notificationId: n.id });
                      } catch {}
                    }
                    if (n.actionUrl) {
                      window.location.href = n.actionUrl;
                      setOpen(false);
                    }
                  }}
                >
                  <span className="text-lg mt-0.5 shrink-0">{getIcon(n.notificationType)}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${!n.isRead ? "font-medium" : ""}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {n.message}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {timeAgo(n.createdAt)}
                    </p>
                  </div>
                  {!n.isRead && (
                    <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2" />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t px-4 py-2 bg-gray-50">
              <Link
                href="/notifications"
                className="text-xs text-primary hover:underline flex items-center justify-center gap-1"
                onClick={() => setOpen(false)}
              >
                View all notifications
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CreditBadge() {
  const { isAuthenticated } = useAuth();
  const { data: balance } = trpc.referral.getCreditBalance.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const balanceStr = typeof balance === "object" && balance ? balance.balance : "0";
  const creditAmount = parseFloat(balanceStr || "0");
  if (!isAuthenticated || creditAmount <= 0) return null;

  return (
    <Link href="/referrals">
      <Button
        variant="ghost"
        size="sm"
        className="relative h-9 gap-1.5 px-2.5 text-amber-700 hover:text-amber-800 hover:bg-amber-50"
        title="Referral Credits"
      >
        <Coins className="h-4 w-4" />
        <span className="text-xs font-semibold">${creditAmount.toFixed(0)}</span>
      </Button>
    </Link>
  );
}

function UserMenuDropdown({ user }: { user: any }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { logout } = useAuth();
  const { isInstalled, triggerInstall } = usePWAInstallContext();
  const { isProviderView } = useViewMode();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="sm"
        className="gap-1 public-brand-account"
        onClick={() => setOpen(!open)}
      >
        <User className="h-4 w-4" />
        <span className="max-w-[120px] truncate">{user?.name || user?.email}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-xl border z-[100] overflow-hidden py-1 public-brand-account-menu">
          <Link
            href="/account"
            className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors"
            onClick={() => setOpen(false)}
          >
            <User className="h-4 w-4 text-muted-foreground" />
            My Account
          </Link>
          <Link
            href={isProviderView ? "/provider/subscription" : "/customer/subscription"}
            className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors"
            onClick={() => setOpen(false)}
          >
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            My Subscription
          </Link>
          <Link
            href={isProviderView ? "/provider/billing" : "/customer/billing"}
            className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors"
            onClick={() => setOpen(false)}
          >
            <FileText className="h-4 w-4 text-muted-foreground" />
            Billing History
          </Link>
          <Link
            href="/notification-settings"
            className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors"
            onClick={() => setOpen(false)}
          >
            <Settings className="h-4 w-4 text-muted-foreground" />
            Settings
          </Link>
          <Link
            href="/help"
            className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors"
            onClick={() => setOpen(false)}
          >
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
            Help
          </Link>
          {user?.role === "admin" && (
            <>
              <div className="border-t my-1" />
              <Link
                href="/admin"
                className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-blue-50 transition-colors text-blue-700 font-medium"
                onClick={() => setOpen(false)}
              >
                <Shield className="h-4 w-4" />
                Admin Dashboard
              </Link>
            </>
          )}
          {!isInstalled && (
            <button
              className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors w-full text-left"
              onClick={() => {
                setOpen(false);
                triggerInstall();
              }}
            >
              <Download className="h-4 w-4 text-muted-foreground" />
              Install App
            </button>
          )}
          <div className="border-t my-1" />
          <button
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors w-full text-left"
            onClick={() => {
              setOpen(false);
              // Navigate directly to the logout endpoint - this guarantees
              // the browser processes the Set-Cookie header before loading the next page
              window.location.href = "/api/auth/logout";
            }}
          >
            <LogOut className="h-4 w-4" />
            Log Out
          </button>
        </div>
      )}
    </div>
  );
}

export function ProfileLoadingSkeleton() {
  return (
    <div className="flex items-center gap-2 px-2.5" aria-label="Loading your profile" role="status">
      <Skeleton className="h-7 w-7 rounded-full" />
      <Skeleton className="hidden h-3.5 w-20 sm:block" />
      <span className="sr-only">Loading your profile</span>
    </div>
  );
}

// Mobile menu tile data - matches LoggedInHome.tsx landing page tiles exactly
const MOBILE_PROVIDER_TILES = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/provider/dashboard", color: "bg-gray-100", iconColor: "text-gray-700" },
  { label: "Bookings", icon: Calendar, href: "/my-bookings", color: "bg-blue-100", iconColor: "text-blue-600" },
  { label: "Services", icon: Briefcase, href: "/provider/services", color: "bg-purple-100", iconColor: "text-purple-600" },
  { label: "Schedule", icon: Clock, href: "/provider/availability", color: "bg-green-100", iconColor: "text-green-600" },
  { label: "Messages", icon: MessageSquare, href: "/messages", color: "bg-sky-100", iconColor: "text-sky-600" },
  { label: "Analytics", icon: BarChart3, href: "/provider/analytics", color: "bg-amber-100", iconColor: "text-amber-700" },
  { label: "Payouts", icon: CreditCard, href: "/provider/payouts", color: "bg-emerald-100", iconColor: "text-emerald-600" },
  { label: "Boost", icon: Rocket, href: "/provider/promotions", color: "bg-purple-100", iconColor: "text-purple-600" },
  { label: "My Page", icon: UserCircle, href: "/provider/my-page", color: "bg-teal-100", iconColor: "text-teal-600" },
  { label: "Invoices", icon: FileText, href: "/provider/invoices", color: "bg-orange-100", iconColor: "text-orange-600" },
  { label: "Widgets", icon: Grid3X3, href: "/provider/widgets", color: "bg-rose-100", iconColor: "text-rose-600" },
  { label: "Reviews", icon: Star, href: "/provider/reviews", color: "bg-teal-100", iconColor: "text-teal-600" },
  { label: "Featured", icon: Award, href: "/featured", color: "bg-yellow-100", iconColor: "text-yellow-600" },
  { label: "Plans", icon: ShieldCheck, href: "/provider/subscription", color: "bg-rose-100", iconColor: "text-rose-600" },
  { label: "Help", icon: HelpCircle, href: "/help", color: "bg-cyan-100", iconColor: "text-cyan-600" },
  { label: "Profile", icon: UserCog, href: "/provider/onboarding", color: "bg-violet-100", iconColor: "text-violet-600" },
  { label: "Account", icon: Settings, href: "/account", color: "bg-slate-100", iconColor: "text-slate-600" },
];

const MOBILE_CUSTOMER_TILES = [
  { label: "Explore", icon: Compass, href: "/browse", color: "bg-blue-100", iconColor: "text-blue-600" },
  { label: "Featured", icon: Award, href: "/featured", color: "bg-yellow-100", iconColor: "text-yellow-600" },
  { label: "My Bookings", icon: BookOpen, href: "/my-bookings", color: "bg-green-100", iconColor: "text-green-600" },
  { label: "Messages", icon: MessageSquare, href: "/messages", color: "bg-sky-100", iconColor: "text-sky-600" },
  { label: "Saved", icon: Heart, href: "/saved-providers", color: "bg-pink-100", iconColor: "text-pink-600" },
  { label: "Waitlist", icon: Clock, href: "/my-waitlist", color: "bg-amber-100", iconColor: "text-amber-700" },
  { label: "Referrals", icon: Gift, href: "/referral-program", color: "bg-emerald-100", iconColor: "text-emerald-600" },
  { label: "Alerts", icon: Bell, href: "/notifications", color: "bg-orange-100", iconColor: "text-orange-600" },
  { label: "Reviews", icon: Star, href: "/my-reviews", color: "bg-teal-100", iconColor: "text-teal-600" },
  { label: "Receipts & Invoices", icon: CreditCard, href: "/receipts", color: "bg-orange-100", iconColor: "text-orange-600" },
  { label: "Plans", icon: ShieldCheck, href: "/customer/subscription", color: "bg-rose-100", iconColor: "text-rose-600" },
  { label: "Help", icon: HelpCircle, href: "/help", color: "bg-cyan-100", iconColor: "text-cyan-600" },
  { label: "Account", icon: Settings, href: "/account", color: "bg-slate-100", iconColor: "text-slate-600" },
];

const MOBILE_ADMIN_TILES = [
  { label: "Admin", icon: LayoutDashboard, href: "/admin", color: "bg-red-100", iconColor: "text-red-600" },
  { label: "Users", icon: Users, href: "/admin?tab=users", color: "bg-violet-100", iconColor: "text-violet-600" },
];

function MobileMenuTiles({ isAuthenticated, isProvider, isAdmin, isProviderView, unreadMessages, onClose }: {
  isAuthenticated: boolean;
  isProvider: boolean;
  isAdmin: boolean;
  isProviderView: boolean;
  unreadMessages: number;
  onClose: () => void;
}) {
  // Determine which tiles to show based on view mode (same logic as landing page)
  const baseTiles = isAuthenticated
    ? (isProviderView ? MOBILE_PROVIDER_TILES : MOBILE_CUSTOMER_TILES)
    : MOBILE_CUSTOMER_TILES.filter(t => ["/browse", "/featured", "/pricing", "/help"].includes(t.href));

  // Prepend admin tiles and deduplicate (same as landing page)
  const allTiles = isAdmin
    ? [...MOBILE_ADMIN_TILES, ...baseTiles].filter((tile, idx, arr) => arr.findIndex(t => t.href === tile.href) === idx)
    : baseTiles;

  return (
    <div className="grid grid-cols-4 gap-2">
      {allTiles.map((tile) => {
        const Icon = tile.icon;
        return (
          <Link key={`${tile.label}-${tile.href}`} href={tile.href} onClick={onClose}>
            <div className="flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl hover:bg-muted/50 active:bg-muted active:scale-95 transition-all">
              <div className={`h-11 w-11 rounded-2xl ${tile.color} flex items-center justify-center relative`}>
                <Icon className={`h-6 w-6 ${tile.iconColor}`} />
                {tile.label === "Messages" && unreadMessages > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadMessages}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-medium text-center leading-tight">{tile.label}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function MobileLogoutButton({ onClose }: { onClose: () => void }) {
  return (
    <div>
      <button
        className="flex items-center gap-3 w-full px-3 py-3 rounded-lg hover:bg-red-50 active:bg-red-100 transition-colors"
        onClick={() => {
          onClose();
          // Navigate directly to the logout endpoint - this guarantees
          // the browser processes the Set-Cookie header before loading the next page
          window.location.href = "/api/auth/logout";
        }}
      >
        <LogOut className="h-5 w-5 text-red-500" />
        <span className="text-[15px] font-medium text-red-600">Log Out</span>
      </button>
    </div>
  );
}

export function NavHeader({ forcePublic = false }: { forcePublic?: boolean } = {}) {
  const { user, loading: authLoading, isAuthenticated: accountAuthenticated } = useAuth();
  const isAuthenticated = accountAuthenticated && !forcePublic;
  const [hasMounted, setHasMounted] = useState(false);
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileHeaderRef = useRef<HTMLElement>(null);
  const [mobileMenuTop, setMobileMenuTop] = useState(64);

  useEffect(() => setHasMounted(true), []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const positionBelowHeader = () => setMobileMenuTop(mobileHeaderRef.current?.getBoundingClientRect().bottom ?? 64);
    positionBelowHeader();
    window.addEventListener("resize", positionBelowHeader);
    window.addEventListener("scroll", positionBelowHeader, { passive: true });
    return () => {
      window.removeEventListener("resize", positionBelowHeader);
      window.removeEventListener("scroll", positionBelowHeader);
    };
  }, [mobileMenuOpen]);

  // Poll slowly as a fallback; SSE invalidates this query immediately for new messages.
  const { data: unreadCount } = trpc.message.unreadCount.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 60000,
  });

  // Check for provider profile as fallback (in case role hasn't been updated yet)
  const { data: myProfile } = trpc.provider.getMyProfile.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const unreadMessages = typeof unreadCount === "number" ? unreadCount : 0;

  const isProvider = user?.role === "provider" || !!myProfile;
  const isAdmin = user?.role === "admin";
  const { isProviderView, isCustomerView, canSwitch } = useViewMode();
  const { isInstalled: pwaInstalled, triggerInstall: pwaInstall } = usePWAInstallContext();

  return (
    <header ref={mobileHeaderRef} className={`border-b sticky top-0 public-brand-header ${mobileMenuOpen ? "z-[60]" : "z-50"}`}>
      <div className="public-brand-inner">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" aria-label="OlogyCrew homepage" className="public-brand-logo flex items-center gap-2.5 shrink-0" onClick={() => setMobileMenuOpen(false)}>
            <img
              src="/manus-storage/ologycrew-demo-mark_075b3913.png"
              alt=""
              className="h-[34px] w-[34px] object-contain"
            />
            <span className="public-brand-wordmark whitespace-nowrap" aria-hidden="true">Ology<span className="public-brand-wordmark-accent">Crew</span></span>
          </Link>

          {/* Desktop Nav - hidden per user request */}

          {/* Right side actions */}
          <div className="hidden lg:flex items-center gap-1">
            {/* Search / Explore */}
            <Link href="/browse" aria-label="Search services and providers">
              <Button variant="ghost" size="icon" className="relative h-9 w-9 public-brand-icon" title="Search">
                <Search className="h-4 w-4" />
              </Button>
            </Link>

            {isAuthenticated ? (
              <>
                {/* Credit Balance */}
                <CreditBadge />

                {/* Notifications Dropdown */}
                {isAuthenticated && <NotificationDropdown />}

                {/* View Mode Switcher for providers */}
                <ViewModeSwitcher />

                {/* My Dashboard — hidden per user request */}

                {/* Admin Dashboard */}
                {isAdmin && (
                  <Link href="/admin">
                    <Button variant="outline" size="sm" className="text-xs px-2.5 public-brand-admin">
                      <Shield className="h-3.5 w-3.5 mr-1" />
                      Admin
                    </Button>
                  </Link>
                )}

                {/* User menu dropdown */}
                <UserMenuDropdown user={user} />
              </>
            ) : hasMounted && authLoading && !forcePublic ? (
              <ProfileLoadingSkeleton />
            ) : (
              <>
                <Link href="/pricing">
                  <Button variant="ghost" size="sm" className="public-brand-nav-link">Pricing</Button>
                </Link>
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="public-brand-nav-link">Sign In</Button>
                </Link>
                <Link href="/pricing">
                  <Button size="sm" className="public-brand-cta">Get Started</Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile actions: Search + AI Assistant + Notifications + Hamburger */}
          <div className="flex lg:hidden items-center gap-1">
            {/* Search customer Explore (mobile) */}
            <Link href="/browse" aria-label="Search services and providers">
              <Button variant="ghost" size="icon" className="relative h-10 w-10 public-brand-icon" title="Search">
                <Search className="h-5 w-5" />
              </Button>
            </Link>

            {/* AI Assistant button (mobile only) */}
            <Button
              variant="ghost"
              size="icon"
              className="relative h-10 w-10 public-brand-icon"
              onClick={() => window.dispatchEvent(new Event('toggle-help-chat'))}
              title="AI Assistant"
            >
              <Sparkles className="h-6 w-6" />
            </Button>

            {/* Notification bell (mobile only) */}
            {isAuthenticated && <NotificationDropdown />}

            {/* Hamburger menu */}
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 public-brand-icon"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls={mobileMenuOpen ? "ology-mobile-account-menu" : undefined}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Full-Screen App Menu */}
        {mobileMenuOpen && (
          <div id="ology-mobile-account-menu" role="navigation" aria-label="Mobile menu" className="ology-mobile-menu lg:hidden fixed inset-x-0 bottom-0 z-50 overflow-y-auto" style={{ top: mobileMenuTop }}>
            <div className="flex flex-col h-full">
              {/* User Profile Summary */}
              {isAuthenticated && user ? (
                <div className="ology-mobile-menu-identity px-6 py-5 border-b">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      {user.profilePhotoUrl ? (
                        <AvatarImage src={user.profilePhotoUrl} alt={user.name || ""} className="object-cover" />
                      ) : null}
                      <AvatarFallback className="ology-mobile-menu-avatar text-lg font-semibold">
                        {(user.name || user.email || "?")[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="ology-mobile-menu-name font-semibold text-base truncate">{user.name || "User"}</p>
                      <p className="ology-mobile-menu-email text-sm truncate">{user.email}</p>
                      {(isProvider || isAdmin) && (
                        <div className="flex gap-1.5 mt-1">
                          {isProvider && <Badge variant="secondary" className="ology-mobile-menu-provider-badge text-[10px] px-1.5 py-0">Provider</Badge>}
                          {isAdmin && <Badge variant="default" className="ology-mobile-menu-admin-badge text-[10px] px-1.5 py-0">Admin</Badge>}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* View Mode Switcher */}
                  <div className="ology-mobile-menu-mode mt-3">
                    <ViewModeSwitcherMobile />
                  </div>
                </div>
              ) : (
                <div className="ology-mobile-menu-identity px-6 py-5 border-b">
                  <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                    <Button className={`w-full h-12 text-base ${isAuthenticated ? "" : "public-brand-cta"}`}>Sign In to Get Started</Button>
                  </Link>
                </div>
              )}
              {/* Tile Grid Navigation */}
              <div className="ology-mobile-menu-content flex-1 px-5 py-5 overflow-y-auto">
                {isAuthenticated ? (
                  <div className="ology-mobile-menu-grid grid grid-cols-4 gap-2">
                    <Link href="/account" onClick={() => setMobileMenuOpen(false)}>
                      <div className="ology-mobile-menu-tile flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl">
                        <div className="ology-mobile-menu-tile-icon h-11 w-11 rounded-2xl flex items-center justify-center" data-tone="neutral">
                          <User className="h-6 w-6" />
                        </div>
                        <span className="text-[11px] font-medium text-center leading-tight">My Account</span>
                      </div>
                    </Link>
                    {myProfile?.profileSlug && (
                      <Link href={`/${myProfile.profileSlug}`} onClick={() => setMobileMenuOpen(false)}>
                        <div className="ology-mobile-menu-tile flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl">
                          <div className="ology-mobile-menu-tile-icon h-11 w-11 rounded-2xl flex items-center justify-center" data-tone="leaf">
                            <ExternalLink className="h-6 w-6" />
                          </div>
                          <span className="text-[11px] font-medium text-center leading-tight">My Page</span>
                        </div>
                      </Link>
                    )}
                    {myProfile && (
                      <Link href="/provider/calendar" onClick={() => setMobileMenuOpen(false)}>
                        <div className="ology-mobile-menu-tile flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl">
                          <div className="ology-mobile-menu-tile-icon h-11 w-11 rounded-2xl flex items-center justify-center" data-tone="sage">
                            <Calendar className="h-6 w-6" />
                          </div>
                          <span className="text-[11px] font-medium text-center leading-tight">My Calendar</span>
                        </div>
                      </Link>
                    )}
                    <Link href={isProviderView ? "/provider/subscription" : "/customer/subscription"} onClick={() => setMobileMenuOpen(false)}>
                      <div className="ology-mobile-menu-tile flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl">
                        <div className="ology-mobile-menu-tile-icon h-11 w-11 rounded-2xl flex items-center justify-center" data-tone="leaf">
                          <CreditCard className="h-6 w-6" />
                        </div>
                        <span className="text-[11px] font-medium text-center leading-tight">My Subscription</span>
                      </div>
                    </Link>
                    <Link href={isProviderView ? "/provider/billing" : "/customer/billing"} onClick={() => setMobileMenuOpen(false)}>
                      <div className="ology-mobile-menu-tile flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl">
                        <div className="ology-mobile-menu-tile-icon h-11 w-11 rounded-2xl flex items-center justify-center" data-tone="coral">
                          <FileText className="h-6 w-6" />
                        </div>
                        <span className="text-[11px] font-medium text-center leading-tight">Billing History</span>
                      </div>
                    </Link>
                    <Link href="/notification-settings" onClick={() => setMobileMenuOpen(false)}>
                      <div className="ology-mobile-menu-tile flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl">
                        <div className="ology-mobile-menu-tile-icon h-11 w-11 rounded-2xl flex items-center justify-center" data-tone="neutral">
                          <Settings className="h-6 w-6" />
                        </div>
                        <span className="text-[11px] font-medium text-center leading-tight">Settings</span>
                      </div>
                    </Link>
                    <Link href="/help" onClick={() => setMobileMenuOpen(false)}>
                      <div className="ology-mobile-menu-tile flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl">
                        <div className="ology-mobile-menu-tile-icon h-11 w-11 rounded-2xl flex items-center justify-center" data-tone="sage">
                          <HelpCircle className="h-6 w-6" />
                        </div>
                        <span className="text-[11px] font-medium text-center leading-tight">Help</span>
                      </div>
                    </Link>
                    {!pwaInstalled && (
                      <button onClick={() => { setMobileMenuOpen(false); pwaInstall(); }} className="w-full">
                        <div className="ology-mobile-menu-tile flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl">
                          <div className="ology-mobile-menu-tile-icon h-11 w-11 rounded-2xl flex items-center justify-center" data-tone="leaf">
                            <Download className="h-6 w-6" />
                          </div>
                          <span className="text-[11px] font-medium text-center leading-tight">Install App</span>
                        </div>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="ology-mobile-menu-grid grid grid-cols-4 gap-2">
                    <Link href="/browse" onClick={() => setMobileMenuOpen(false)}>
                      <div className="ology-mobile-menu-tile flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl">
                        <div className="ology-mobile-menu-tile-icon h-11 w-11 rounded-2xl flex items-center justify-center" data-tone="sage">
                          <Compass className="h-6 w-6" />
                        </div>
                        <span className="text-[11px] font-medium text-center leading-tight">Browse</span>
                      </div>
                    </Link>
                    <Link href="/platform" onClick={() => setMobileMenuOpen(false)}>
                      <div className="ology-mobile-menu-tile flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl">
                        <div className="ology-mobile-menu-tile-icon h-11 w-11 rounded-2xl flex items-center justify-center" data-tone="leaf">
                          <Grid3X3 className="h-6 w-6" />
                        </div>
                        <span className="text-[11px] font-medium text-center leading-tight">Platform</span>
                      </div>
                    </Link>
                    <Link href="/pricing" onClick={() => setMobileMenuOpen(false)}>
                      <div className="ology-mobile-menu-tile flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl">
                        <div className="ology-mobile-menu-tile-icon h-11 w-11 rounded-2xl flex items-center justify-center" data-tone="leaf">
                          <CreditCard className="h-6 w-6" />
                        </div>
                        <span className="text-[11px] font-medium text-center leading-tight">Pricing</span>
                      </div>
                    </Link>
                    <Link href="/help" onClick={() => setMobileMenuOpen(false)}>
                      <div className="ology-mobile-menu-tile flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl">
                        <div className="ology-mobile-menu-tile-icon h-11 w-11 rounded-2xl flex items-center justify-center" data-tone="sage">
                          <HelpCircle className="h-6 w-6" />
                        </div>
                        <span className="text-[11px] font-medium text-center leading-tight">Help</span>
                      </div>
                    </Link>
                  </div>
                )}
              </div>
              {/* Log Out */}
              {isAuthenticated && (
                <div className="ology-mobile-menu-footer px-4 py-4 border-t mt-auto">
                  <MobileLogoutButton onClose={() => setMobileMenuOpen(false)} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
