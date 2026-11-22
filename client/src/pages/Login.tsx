import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Eye, EyeOff, Mail, Lock, AlertCircle, ExternalLink, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/_core/hooks/useAuth";
import { appendAuthReturnPath, normalizeAuthReturnPath } from "@shared/authReturnPath";
import { ologyCrewPublicUrl } from "@shared/publicUrls";
import { isEmbeddedBrowserContext, isUnpublishedPreviewHost } from "@/lib/previewEnvironment";

export default function Login() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [browserLocation, setBrowserLocation] = useState<{
    search: string;
    hostname: string;
    href: string;
  } | null>(null);
  useEffect(() => {
    setBrowserLocation({
      search: window.location.search,
      hostname: window.location.hostname,
      href: window.location.href,
    });
  }, []);
  const urlParams = useMemo(() => new URLSearchParams(browserLocation?.search ?? ""), [browserLocation?.search]);
  const returnTo = normalizeAuthReturnPath(urlParams.get("returnTo"));
  const isPreview = isUnpublishedPreviewHost(browserLocation?.hostname ?? "");
  const isEmbeddedPreview = isPreview && isEmbeddedBrowserContext();
  const previewLoginUrl = browserLocation?.href ?? ologyCrewPublicUrl(appendAuthReturnPath("/login", returnTo));
  const publishedLoginUrl = ologyCrewPublicUrl(
    appendAuthReturnPath("/login", returnTo),
  );
  const publishedPasswordUrl = ologyCrewPublicUrl("/forgot-password");

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      if (!user.emailVerified) {
        setLocation(appendAuthReturnPath("/verify-email", returnTo));
      } else if (!user.hasSelectedRole) {
        setLocation(appendAuthReturnPath("/select-role", returnTo));
      } else if (returnTo) {
        setLocation(returnTo);
      } else if (user.role === "admin") {
        setLocation("/admin");
      } else {
        // Both customers and providers go to OlogyCrew landing page
        setLocation("/");
      }
    }
  }, [user, setLocation, returnTo]);

  if (user) return null;

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }

      // If 2FA is required, redirect to verification page
      if (data.requires2FA) {
        sessionStorage.setItem("2fa_userId", String(data.userId));
        sessionStorage.setItem("2fa_email", data.email || "");
        const twoFactorParams = new URLSearchParams({
          userId: String(data.userId),
          email: data.email || "",
          redirect: returnTo || (data.user?.role === "admin" ? "/admin" : "/"),
        });
        window.location.href = `/verify-2fa?${twoFactorParams.toString()}`;
        return;
      }
      // If account uses Google sign-in, auto-redirect to Google OAuth
      if (data.redirectToGoogle) {
        const origin = window.location.origin;
        const googleParams = new URLSearchParams({ origin });
        if (returnTo) googleParams.set("returnTo", returnTo);
        window.location.href = `/api/auth/google?${googleParams.toString()}`;
        return;
      }

      // Redirect based on user state
      if (!data.user.emailVerified) {
        window.location.href = appendAuthReturnPath("/verify-email", returnTo);
      } else if (!data.user.hasSelectedRole) {
        window.location.href = appendAuthReturnPath("/select-role", returnTo);
      } else if (returnTo) {
        window.location.href = returnTo;
      } else if (data.user.role === "admin") {
        window.location.href = "/admin";
      } else {
        // Both customers and providers go to OlogyCrew landing page
        window.location.href = "/";
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    const origin = window.location.origin;
    // Pass audience and planTier from selected plan so server can auto-assign role and persist plan
    let audience = "";
    let planTier = "";
    try {
      const stored = localStorage.getItem("ologycrew_selected_plan");
      if (stored) {
        const plan = JSON.parse(stored);
        audience = plan.audience || "";
        planTier = plan.tier || "";
      }
    } catch {}
    const params = new URLSearchParams({ origin });
    if (audience) params.set("audience", audience);
    if (planTier) params.set("planTier", planTier);
    if (returnTo) params.set("returnTo", returnTo);
    window.location.href = `/api/auth/google?${params.toString()}`;
  };

  // Check for error params from Google OAuth callback
  const callbackError = urlParams.get("error");
  const callbackMessage = urlParams.get("message");

  const getErrorMessage = () => {
    if (error) return error;
    if (callbackMessage) return decodeURIComponent(callbackMessage);
    switch (callbackError) {
      case "rate_limited":
        return "Google sign-in is temporarily unavailable due to too many attempts. Please wait a moment and try again.";
      case "token_exchange_failed":
        return "Sign in failed. Please try again. If the issue persists, try clearing your browser cookies.";
      case "user_info_failed":
        return "Could not retrieve your Google account information. Please try again.";
      case "account_creation_failed":
        return "Failed to create your account. Please try again.";
      case "no_code":
        return "Sign in was cancelled or interrupted. Please try again.";
      case "callback_failed":
        return "Sign in failed due to a server error. Please try again later.";
      default:
        return "Sign in failed. Please try again.";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-page px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <Link href="/">
            <h1 className="text-3xl font-bold text-slate-900 cursor-pointer">OlogyCrew</h1>
          </Link>
          <p className="text-slate-600 mt-2">Welcome back! Sign in to your account.</p>
        </div>

        <Card className="shadow-lg border-0">
          <CardContent className="p-6 space-y-6">
            {/* Error messages */}
            {(error || callbackError) && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{getErrorMessage()}</span>
              </div>
            )}

            {isPreview && (
              <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
                <div className="flex items-start gap-2">
                  <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <div className="space-y-1">
                    <p className="font-semibold">Sign in to test unpublished changes</p>
                    <p className="text-blue-800">
                      {isEmbeddedPreview
                        ? "Open this preview in its own tab, then sign in with your OlogyCrew email and password."
                        : "Sign in below with your OlogyCrew email and password to test this unpublished version."}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  {isEmbeddedPreview && (
                    <Button asChild type="button" size="sm" className="bg-blue-700 hover:bg-blue-800">
                      <a href={previewLoginUrl} target="_blank" rel="noreferrer">
                        Open preview in new tab
                        <ExternalLink className="ml-2 h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                    </Button>
                  )}
                  <Button asChild type="button" size="sm" variant="outline" className="border-blue-300 bg-white text-blue-800 hover:bg-blue-100">
                    <a href={publishedPasswordUrl} target="_blank" rel="noreferrer">
                      Create or reset password
                      <ExternalLink className="ml-2 h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  </Button>
                </div>
                <p className="text-xs text-blue-700">
                  Google-only account? Create a password once on the published site. This keeps Google sign-in enabled and lets the same account sign into the preview.
                </p>
              </div>
            )}

            {/* Google Sign In */}
            {isPreview ? (
              <Button asChild type="button" variant="outline" className="h-12 w-full border-slate-300 text-base font-medium hover:bg-slate-50">
                <a href={publishedLoginUrl} target="_blank" rel="noreferrer">
                  <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Google sign-in on published site
                  <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
                </a>
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full h-12 text-base font-medium border-slate-300 hover:bg-slate-50"
                onClick={handleGoogleLogin}
              >
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 0 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Continue with Google
              </Button>
            )}

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-white text-slate-500">
                  {isPreview ? "sign in to preview with email" : "or sign in with email"}
                </span>
              </div>
            </div>

            {/* Email/Password Form */}
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-11"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                    Password
                  </Label>
                  {isPreview ? (
                    <a href={publishedPasswordUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                      Create/reset password
                    </a>
                  ) : (
                    <Link href="/forgot-password" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                      Forgot password?
                    </Link>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 h-11"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 text-base font-medium bg-blue-600 hover:bg-blue-700"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Sign up link */}
        <p className="text-center mt-6 text-slate-600">
          Don't have an account?{" "}
          <Link href={appendAuthReturnPath("/signup", returnTo)} className="text-blue-600 hover:text-blue-700 font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
