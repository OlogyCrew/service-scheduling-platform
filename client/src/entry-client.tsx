import { hydrateRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider, hydrate } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { trpc } from "@/lib/trpc";
import App from "./App";
import { BadgeManager } from "./components/BadgeManager";
import { ViewModeProvider } from "./contexts/ViewModeContext";
import { PWAInstallProvider } from "./contexts/PWAInstallContext";
import { shouldRetryApiQuery } from "./lib/apiErrorHandling";
import "./index.css";

declare global { interface Window { __RQ_STATE__?: string } }
const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: shouldRetryApiQuery, staleTime: 30_000 } },
});
const state = window.__RQ_STATE__ ? superjson.deserialize(JSON.parse(window.__RQ_STATE__)) : undefined;
if (state) hydrate(queryClient, state as any);
const client = trpc.createClient({
  links: [httpBatchLink({ url: "/api/trpc", transformer: superjson, maxURLLength: 2048, fetch: (input, init) => fetch(input, { ...init, credentials: "include" }) })],
});
hydrateRoot(document.getElementById("root")!,
  <QueryClientProvider client={queryClient}>
    <trpc.Provider client={client} queryClient={queryClient}>
      <BadgeManager /><ViewModeProvider><PWAInstallProvider><App /></PWAInstallProvider></ViewModeProvider>
    </trpc.Provider>
  </QueryClientProvider>
);
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => undefined));
