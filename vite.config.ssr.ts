import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

const root = import.meta.dirname;
export default defineConfig({
  mode: "production",
  root,
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(root, "client", "src"),
      "@shared": path.resolve(root, "shared"),
      "@assets": path.resolve(root, "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  ssr: { noExternal: ["streamdown"] },
  build: {
    ssr: path.resolve(root, "client/src/entry-server.tsx"),
    outDir: path.resolve(root, "dist/server-ssr"),
    emptyOutDir: true,
    rollupOptions: { output: { format: "esm", entryFileNames: "entry-server.js" } },
  },
});
