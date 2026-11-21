import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * Connectivity state intentionally starts online so SSR and the first client
 * render are identical. The browser's actual state is read after hydration.
 */
export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const updateConnection = () => setIsOffline(!navigator.onLine);
    updateConnection();
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      className="fixed bottom-4 left-1/2 z-[100] -translate-x-1/2 rounded-full border border-amber-200/90 bg-amber-50/95 px-3.5 py-2 text-xs font-medium text-amber-950 shadow-lg backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
      role="status"
      aria-live="polite"
    >
      <span className="inline-flex items-center gap-2">
        <WifiOff className="h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden="true" />
        <span>Offline — changes will resume when you reconnect</span>
      </span>
    </div>
  );
}
