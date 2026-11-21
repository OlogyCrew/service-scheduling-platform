import { describe, expect, it } from "vitest";
import { composeSsrHtml } from "./_core/vite";

const shell = '<!doctype html><html><head><!--app-head--></head><body><div id="root"><!--app-html--></div></body></html>';
const response = (path: string, title: string, body: string, notFound = false) => composeSsrHtml(shell, {
  html: `<main id="page-content"><h1>${body}</h1></main>`,
  state: JSON.stringify({ json: { queries: [{ queryKey: [path], state: { data: body } }] } }),
  head: { title, description: `Description for ${body}`, canonicalPath: path, notFound, noindex: notFound },
}, "https://ologycrew.com");

describe("SSR raw HTML responses", () => {
  it.each([
    ["category", "/category/handyman", "Handyman Services"],
    ["provider", "/p/demo-ologycrew", "Demo Provider"],
    ["service", "/service/330001", "A2"],
  ])("renders useful %s body content and route metadata", (_kind, path, content) => {
    const html = response(path, `${content} | OlogyCrew`, content);
    expect(html).toContain(`<h1>${content}</h1>`);
    expect(html).toContain(`<title>${content} | OlogyCrew</title>`);
    expect(html).toContain(`name="description" content="Description for ${content}"`);
    expect(html).toContain(`rel="canonical" href="https://ologycrew.com${path}"`);
    expect(html).not.toContain("property=\"og:title\"");
    expect(html).toContain("__RQ_STATE__");
    expect(html).toContain('name="robots" content="index, follow"');
  });

  it("returns a noindex document for a genuine missing record", () => {
    const html = response("/service/does-not-exist", "OlogyCrew — Local work, well done", "Service not found", true);
    expect(html).toContain("<h1>Service not found</h1>");
    expect(html).toContain('name="robots" content="noindex, nofollow"');
    expect(html).toContain('rel="canonical" href="https://ologycrew.com/service/does-not-exist"');
  });

  it("escapes database-controlled head values", () => {
    const html = response('/p/<x>', 'A <script>alert(1)</script>', 'Provider');
    expect(html).not.toContain('<script>alert(1)</script></title>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});
