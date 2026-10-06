import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { NavHeader } from "@/components/shared/NavHeader";
import "./NotificationSettings.css";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { getLoginUrl } from "@/const";
import { ArrowLeft, Bell, Mail, MessageSquare, Loader2, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { PushNotificationSettings } from "@/components/PushNotificationSettings";

interface Prefs {
  emailEnabled: boolean;
  smsEnabled: boolean;
  bookingEmail: boolean;
  reminderEmail: boolean;
  messageEmail: boolean;
  paymentEmail: boolean;
  marketingEmail: boolean;
  relationshipMessageEnabled: boolean;
  bookingSms: boolean;
  reminderSms: boolean;
  messageSms: boolean;
  paymentSms: boolean;
}

const DEFAULT_PREFS: Prefs = {
  emailEnabled: true,
  smsEnabled: true,
  bookingEmail: true,
  reminderEmail: true,
  messageEmail: true,
  paymentEmail: true,
  marketingEmail: false,
  relationshipMessageEnabled: false,
  bookingSms: true,
  reminderSms: true,
  messageSms: false,
  paymentSms: false,
};

export default function NotificationSettings() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const utils = trpc.useUtils();

  const { data: serverPrefs, isLoading } = trpc.notification.getPreferences.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const updatePrefs = trpc.notification.updatePreferences.useMutation({
    onSuccess: () => {
      utils.notification.getPreferences.invalidate();
      toast.success("Notification preferences saved");
    },
    onError: () => {
      toast.error("Failed to save preferences");
    },
  });

  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);

  useEffect(() => {
    if (serverPrefs) {
      setPrefs({
        emailEnabled: serverPrefs.emailEnabled,
        smsEnabled: serverPrefs.smsEnabled,
        bookingEmail: serverPrefs.bookingEmail,
        reminderEmail: serverPrefs.reminderEmail,
        messageEmail: serverPrefs.messageEmail,
        paymentEmail: serverPrefs.paymentEmail,
        marketingEmail: serverPrefs.marketingEmail,
        relationshipMessageEnabled: serverPrefs.relationshipMessageEnabled,
        bookingSms: serverPrefs.bookingSms,
        reminderSms: serverPrefs.reminderSms,
        messageSms: serverPrefs.messageSms,
        paymentSms: serverPrefs.paymentSms,
      });
    }
  }, [serverPrefs]);

  function toggle(key: keyof Prefs) {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    updatePrefs.mutate(updated);
  }

  if (authLoading) {
    return (
      <div className="ology-settings-page min-h-screen bg-page">
        <NavHeader />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="ology-settings-page min-h-screen bg-page">
        <NavHeader />
        <div className="container py-16 text-center">
          <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-2">Sign in to manage preferences</h1>
          <p className="text-muted-foreground mb-6">
            You need to be signed in to manage notification preferences.
          </p>
          <a href={getLoginUrl()}>
            <Button>Sign In</Button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="ology-settings-page min-h-screen bg-page">
      <NavHeader />

      <div className="ology-settings-content container max-w-2xl py-8">
        {/* Header */}
        <div className="ology-settings-heading flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Notification Settings</h1>
            <p className="text-sm text-muted-foreground">
              Control how and when you receive notifications
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Push Notifications */}
            <PushNotificationSettings />

            <Card className="ology-settings-relationship">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ShieldCheck className="ology-settings-relationship-icon h-5 w-5" />
                  Provider relationship messages
                </CardTitle>
                <CardDescription>
                  Choose whether providers you have an OlogyCrew relationship with may send you an occasional in-app follow-up.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-start justify-between gap-5">
                  <div className="min-w-0">
                    <Label htmlFor="relationship-message-enabled" className="text-sm font-medium">Allow relationship messages</Label>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">This is off by default. It does not enable marketing emails, texts, or push notifications, and you can turn it off again at any time.</p>
                  </div>
                  <Switch id="relationship-message-enabled" checked={prefs.relationshipMessageEnabled} onCheckedChange={() => toggle("relationshipMessageEnabled")} aria-label="Allow provider relationship messages" />
                </div>
              </CardContent>
            </Card>

            {/* Master Channel Toggles */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Notification Channels</CardTitle>
                <CardDescription>
                  Enable or disable entire notification channels
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <Label className="text-sm font-medium">Email Notifications</Label>
                      <p className="text-xs text-muted-foreground">
                        Receive notifications via email
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={prefs.emailEnabled}
                    onCheckedChange={() => toggle("emailEnabled")}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <Label className="text-sm font-medium">SMS Notifications</Label>
                      <p className="text-xs text-muted-foreground">
                        Receive text message notifications
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full">Coming Soon</span>
                    <Switch
                      checked={false}
                      disabled
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Email Preferences */}
            <Card className={!prefs.emailEnabled ? "opacity-50 pointer-events-none" : ""}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Email Preferences
                </CardTitle>
                <CardDescription>
                  Choose which types of emails you want to receive
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Booking Updates</Label>
                    <p className="text-xs text-muted-foreground">
                      Confirmations, cancellations, and status changes
                    </p>
                  </div>
                  <Switch
                    checked={prefs.bookingEmail}
                    onCheckedChange={() => toggle("bookingEmail")}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Appointment Reminders</Label>
                    <p className="text-xs text-muted-foreground">
                      24-hour reminders before your appointments
                    </p>
                  </div>
                  <Switch
                    checked={prefs.reminderEmail}
                    onCheckedChange={() => toggle("reminderEmail")}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Messages</Label>
                    <p className="text-xs text-muted-foreground">
                      New messages from providers or customers
                    </p>
                  </div>
                  <Switch
                    checked={prefs.messageEmail}
                    onCheckedChange={() => toggle("messageEmail")}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Payment Receipts</Label>
                    <p className="text-xs text-muted-foreground">
                      Payment confirmations and receipts
                    </p>
                  </div>
                  <Switch
                    checked={prefs.paymentEmail}
                    onCheckedChange={() => toggle("paymentEmail")}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Marketing & Promotions</Label>
                    <p className="text-xs text-muted-foreground">
                      Special offers, new features, and platform updates
                    </p>
                  </div>
                  <Switch
                    checked={prefs.marketingEmail}
                    onCheckedChange={() => toggle("marketingEmail")}
                  />
                </div>
              </CardContent>
            </Card>

            {/* SMS Preferences - Coming Soon */}
            <Card className="opacity-60 pointer-events-none">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  SMS Preferences
                  <span className="text-xs font-medium text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full">Coming Soon</span>
                </CardTitle>
                <CardDescription>
                  SMS notifications will be available in a future update. We'll notify you when this feature launches.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Booking Updates</Label>
                    <p className="text-xs text-muted-foreground">
                      Confirmations and status changes via text
                    </p>
                  </div>
                  <Switch checked={false} disabled />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Appointment Reminders</Label>
                    <p className="text-xs text-muted-foreground">
                      Text reminders before your appointments
                    </p>
                  </div>
                  <Switch checked={false} disabled />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Messages</Label>
                    <p className="text-xs text-muted-foreground">
                      Text alerts for new messages
                    </p>
                  </div>
                  <Switch checked={false} disabled />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Payment Alerts</Label>
                    <p className="text-xs text-muted-foreground">
                      Text alerts for payment activity
                    </p>
                  </div>
                  <Switch checked={false} disabled />
                </div>
              </CardContent>
            </Card>

            {/* Info note */}
            <p className="text-xs text-muted-foreground text-center">
              You can also unsubscribe from emails using the link at the bottom of any email we send you.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
