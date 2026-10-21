import { Activity, Bell, Briefcase, CalendarDays, Crown, FileText, LayoutDashboard, MessageSquare, Settings, Share2, Shield, ShieldCheck, Star, UserPlus, Users, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type AdminNavItem = { id: string; label: string; icon: LucideIcon };
export type AdminNavGroup = { label: string; ownerOnly?: boolean; items: AdminNavItem[] };
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  { label: "Workspace", items: [{ id: "overview", label: "Overview", icon: LayoutDashboard }] },
  { label: "Marketplace", items: [
    { id: "users", label: "Users", icon: Users }, { id: "providers", label: "Providers", icon: Briefcase },
    { id: "bookings", label: "Bookings", icon: CalendarDays }, { id: "subscriptions", label: "Subscriptions", icon: Crown },
  ] },
  { label: "Support & Moderation", items: [
    { id: "support", label: "Support", icon: MessageSquare }, { id: "reviews", label: "Reviews", icon: Star },
    { id: "documents", label: "Documents", icon: FileText },
  ] },
  { label: "Growth & Communications", items: [
    { id: "referrals", label: "Referrals", icon: UserPlus }, { id: "push", label: "Push", icon: Bell },
    { id: "social-media", label: "Social Media", icon: Share2 },
  ] },
  { label: "Platform", items: [
    { id: "audit", label: "Audit Log", icon: Activity }, { id: "settings", label: "Settings", icon: Settings },
  ] },
  { label: "Owner Controls", ownerOnly: true, items: [
    { id: "team", label: "Team", icon: Shield }, { id: "legal", label: "Legal Terms", icon: FileText },
    { id: "partner", label: "Partner Split", icon: Wallet }, { id: "customers-pilot", label: "Customers Rollout", icon: ShieldCheck },
  ] },
];
export function getAdminNavGroups(isOwnerAdmin: boolean) {
  return ADMIN_NAV_GROUPS.filter(group => !group.ownerOnly || isOwnerAdmin);
}
export function resolveAdminSection(requested: string | null, isOwnerAdmin: boolean): string {
  return getAdminNavGroups(isOwnerAdmin).some(group => group.items.some(item => item.id === requested)) ? requested! : "overview";
}
export function getAdminSectionLabel(section: string) {
  return ADMIN_NAV_GROUPS.flatMap(group => group.items).find(item => item.id === section)?.label ?? "Overview";
}
