import { defineConfig } from "vitest/config";
import path from "node:path";

const root = path.resolve(import.meta.dirname);

// These suites mock tRPC/auth and perform no database or external-service calls.
// Keep them separate from the product suite's shared-database cleanup hooks.
export default defineConfig({
  root,
  resolve: {
    alias: {
      "@": path.join(root, "client/src"),
      "@shared": path.join(root, "shared"),
    },
    dedupe: ["react", "react-dom"],
  },
  esbuild: { jsx: "automatic" },
  test: {
    environment: "jsdom",
    include: [
      "server/offline-payment-provider-ui.test.tsx",
      "server/offline-payment-customer-ui.test.tsx",
    ],
    globalSetup: [],
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
  },
});
