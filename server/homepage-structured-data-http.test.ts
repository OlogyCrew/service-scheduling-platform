import express from "express";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { serveStatic } from "./_core/vite";

let server: Server;
let origin: string;
let fixture: string;
const resolvePath = path.resolve.bind(path);

function schemas(html: string): any[] {
  return [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)]
    .flatMap((match) => JSON.parse(match[1]));
}

beforeAll(async () => {
  fixture = fs.mkdtempSync(path.join(os.tmpdir(), "ology-homepage-metadata-"));
  fs.mkdirSync(path.join(fixture, "assets"));
  fs.writeFileSync(path.join(fixture, "index.html"), '<!doctype html><html><head><title>OlogyCrew</title></head><body><div id="root"></div></body></html>\n');
  fs.writeFileSync(path.join(fixture, "assets", "fixture.js"), 'window.staticAssetPreserved = true;\n');
  fs.writeFileSync(path.join(fixture, "googlefixture.html"), 'google-site-verification: googlefixture.html\n');
  vi.spyOn(path, "resolve").mockImplementation((...parts: string[]) => {
    if (parts.length === 2 && parts[0].endsWith("server/_core") && parts[1] === "public") return fixture;
    return resolvePath(...parts);
  });
  const app = express();
  serveStatic(app);
  await new Promise<void>((done) => { server = app.listen(0, "127.0.0.1", done); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected ephemeral HTTP listener");
  origin = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  if (server) await new Promise<void>((done, reject) => server.close((error) => error ? reject(error) : done()));
  vi.restoreAllMocks();
  if (fixture) fs.rmSync(fixture, { recursive: true, force: true });
});

describe("production homepage structured data routing", () => {
  it.each(["/", "/?ref=PRIVATE-REF"])('injects Website and Organization data in HTTP HTML for %s', async (url) => {
    const response = await fetch(`${origin}${url}`);
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    const data = schemas(html);
    expect(data.map((item) => item["@type"])).toEqual(["WebSite", "Organization"]);
    expect(data[0].url).toBe("https://ologycrew.com");
    expect(data[0].potentialAction.target.urlTemplate).toBe("https://ologycrew.com/browse?q={search_term_string}");
    expect(html.match(/property="og:title"/g)).toHaveLength(1);
    expect(html).not.toContain("PRIVATE-REF");
    expect(html).not.toContain(origin);
  });

  it("preserves static JavaScript and Google HTML-file domain verification", async () => {
    const asset = await fetch(`${origin}/assets/fixture.js`);
    expect(asset.status).toBe(200);
    expect(await asset.text()).toBe("window.staticAssetPreserved = true;\n");
    const verification = await fetch(`${origin}/googlefixture.html`);
    expect(verification.status).toBe(200);
    expect(await verification.text()).toBe("google-site-verification: googlefixture.html\n");
  });

  it("keeps handoff HTML private and avoids adding homepage schema to login", async () => {
    const response = await fetch(`${origin}/login?returnTo=service&handoff=private-test-token`);
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(schemas(html)).toHaveLength(0);
    expect(html).not.toContain("private-test-token");
  });
});
