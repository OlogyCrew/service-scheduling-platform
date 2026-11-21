import React from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider, dehydrate } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { Router } from "wouter";
import { trpc } from "@/lib/trpc";
import App from "./App";
import { BadgeManager } from "./components/BadgeManager";
import { ViewModeProvider } from "./contexts/ViewModeContext";
import { PWAInstallProvider } from "./contexts/PWAInstallContext";
import { shouldRetryApiQuery } from "./lib/apiErrorHandling";
import type { HeadMeta } from "./ssr/prefetch";

export async function render(url: string, prefetch: (queryClient: QueryClient) => Promise<HeadMeta>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: shouldRetryApiQuery, staleTime: 30_000 } } });
  const head = await prefetch(queryClient);
  const client = trpc.createClient({ links: [httpBatchLink({ url: "/api/trpc", transformer: superjson })] });
  const split = url.indexOf("?");
  const ssrPath = split === -1 ? url : url.slice(0, split) || "/";
  const ssrSearch = split === -1 ? "" : url.slice(split);
  const html = renderToString(
    <QueryClientProvider client={queryClient}>
      <trpc.Provider client={client} queryClient={queryClient}>
        <Router ssrPath={ssrPath} ssrSearch={ssrSearch}>
          <BadgeManager /><ViewModeProvider><PWAInstallProvider><App /></PWAInstallProvider></ViewModeProvider>
        </Router>
      </trpc.Provider>
    </QueryClientProvider>
  );
  return { html, state: JSON.stringify(superjson.serialize(dehydrate(queryClient))), head };
}
