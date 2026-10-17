import express from "express";
import fs from "node:fs/promises";
import { serveStatic } from "../server/_core/vite";
import { isAllowedAgentPilotRequest } from "./agent-pilot-boundary";

// Temporary LOCAL pilot harness, not a deployment. No reminders, auth sessions,
// booking, quote, messaging or payment endpoints are started here.
process.env.NODE_ENV = "development"; // serveStatic resolves the built dist/public directory.
const app = express();
app.use(express.json({ limit: "64kb" }));
const port = Number(process.env.PILOT_BROWSER_PORT ?? 3101);
let blocked = 0;
app.get("/__pilot_status", (_req, res) => res.json({ mode: "read-only-plus-handoff-resolution", blockedSubmissions: blocked }));
app.get("/__pilot_review/:mode", async (req, res) => {
  if (!["direct", "quote"].includes(req.params.mode)) return res.sendStatus(404);
  const state = JSON.parse(await fs.readFile(process.env.PILOT_STATE_PATH ?? "/tmp/ologycrew-agent-pilot-state.json", "utf8"));
  res.set("Cache-Control", "private, no-store");
  res.set("Referrer-Policy", "no-referrer");
  res.redirect(state.handoffs[req.params.mode].relativeUrl);
});
app.use("/api/", async (req, res) => {
  if (!isAllowedAgentPilotRequest(req.method, req.originalUrl)) {
    blocked += 1;
    return res.status(403).json({ error: "Controlled pilot: this request is not a permitted read or handoff resolution. No transaction is allowed." });
  }
  try {
    const response = await fetch(`http://127.0.0.1:3000${req.originalUrl}`, {
      method: req.method,
      headers: req.method === "POST" ? { "Content-Type": "application/json" } : {},
      body: req.method === "POST" ? JSON.stringify(req.body) : undefined,
    });
    for (const name of ["content-type", "cache-control", "referrer-policy"]) {
      const value = response.headers.get(name);
      if (value) res.setHeader(name, value);
    }
    res.status(response.status).send(await response.text());
  } catch {
    res.status(503).json({ error: "Read-only pilot upstream unavailable" });
  }
});
serveStatic(app);
const server = app.listen(port, "127.0.0.1", () => console.log(`Controlled browser pilot ready at http://127.0.0.1:${port}; transactions blocked.`));
for (const signal of ["SIGTERM", "SIGINT"] as const) process.on(signal, () => server.close(() => process.exit(0)));
