import { defineConfig } from "vitest/config";
import path from "node:path";

const root = path.resolve(import.meta.dirname);

// Standalone: never import/merge vitest.config.ts, whose global setup cleans DBs.
// Disable Vite dotenv loading as well; invoke this config in a scrubbed process.
export default defineConfig({
  root,
  envDir: false,
  resolve: {
    alias: {
      "@": path.join(root, "client/src"),
      "@shared": path.join(root, "shared"),
    },
    dedupe: ["react", "react-dom"],
  },
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    environmentMatchGlobs: [
      ["server/provider-payment-pause-ui.test.tsx", "jsdom"],
    ],
    include: [
      "server/provider-payment-pause.test.ts",
      "server/provider-payment-pause-ui.test.tsx",
    ],
    globalSetup: [],
    setupFiles: [],
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
  },
});
