import { defineConfig } from "vitest/config";
import path from "node:path";

const root = path.resolve(import.meta.dirname);

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
    include: ["server/hydration-connectivity-ui.test.tsx"],
    globalSetup: [],
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
  },
});
