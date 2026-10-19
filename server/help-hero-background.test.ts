import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const styles = readFileSync(resolve(root, "client/src/pages/HelpCenter.css"), "utf8");
const page = readFileSync(resolve(root, "client/src/pages/HelpCenter.tsx"), "utf8");
const helpRoot = styles.match(/\.ology-help\s*\{([^}]+)\}/)?.[1] ?? "";

describe("Help hero background containment", () => {
  it("contains the first hero margin so its top gap is painted by the Help paper background", () => {
    expect(helpRoot).toMatch(/display:\s*flow-root\s*;/);
    expect(helpRoot).toContain("background: var(--help-paper);");
    expect(helpRoot).toContain("--help-paper: var(--ology-brand-paper);");
    expect(page).toContain('<main className="ology-help">');
    // A formatting context fixes margin collapse without adding a scroll container
    // that could interfere with the existing sticky resource reader.
    expect(helpRoot).not.toMatch(/overflow\s*:/);
  });

  it("preserves the hero's desktop/mobile spacing and original photo treatment", () => {
    expect(styles).toContain("margin: 30px auto 0;");
    expect(styles).toContain("margin-top: 12px; border-radius: 5px;");
    expect(styles).toContain("border-radius: 10px 10px 0 0; overflow: hidden;");
    expect(page).toContain('src="/manus-storage/ology-help-people-desktop_4322e033.webp" alt=""');
    expect(page).toContain('srcSet="/manus-storage/ology-help-people-mobile_40581fc7.webp"');
    expect(styles).toContain(".ology-help-hero::after");
  });
});
