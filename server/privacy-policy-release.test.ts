// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { createElement } from "react";
import { createHash } from "node:crypto";
Object.assign(globalThis, { React });

const pageState = vi.hoisted(() => ({ search: "" }));

vi.mock("@/components/shared/NavHeader", () => ({ NavHeader: () => null }));
vi.mock("@/components/shared/PageHeader", () => ({ PageHeader: ({title}:any) => createElement("h1",null,title) }));
vi.mock("streamdown", () => ({ Streamdown: ({ children }: { children: string }) => createElement("div",null,children.split("\n").filter(Boolean).map((line,index)=>createElement("div",{key:index},line.replace(/^#+ /,"")))) }));
vi.mock("wouter", () => ({ useSearch: () => pageState.search }));

import PrivacyPolicy from "../client/src/pages/PrivacyPolicy";
import {
  PRIVACY_POLICY_EFFECTIVE_AT,
  REVISED_PRIVACY_POLICY_CONTENT,
  getPrivacyPolicyPresentation,
} from "../client/src/pages/legal/privacyPolicyContent";

describe("privacy policy release presentation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    pageState.search = "";
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("shows the revised full policy as an upcoming policy by default before its effective instant, with a prominent link to the still-effective June 18 policy", () => {
    vi.setSystemTime(new Date("2026-11-23T04:59:59.999Z"));

    render(createElement(PrivacyPolicy));

    expect(screen.getByRole("status").textContent).toContain("Upcoming policy");
    expect(screen.getByText(/Revision date: October 22, 2026/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "View the current June 18, 2026 Privacy Policy" }).getAttribute("href"))
      .toBe("/privacy?version=2026-06-18");
    expect(screen.getByText("Public Discovery and Review-Link Context")).toBeTruthy();
  });

  it("uses the exact effective-instant boundary: the revised policy becomes current at 2026-11-23T05:00:00Z", () => {
    expect(getPrivacyPolicyPresentation(null, new Date("2026-11-23T04:59:59.999Z"))?.state).toBe("upcoming");
    expect(getPrivacyPolicyPresentation(null, new Date(PRIVACY_POLICY_EFFECTIVE_AT))?.state).toBe("current");

    vi.setSystemTime(new Date(PRIVACY_POLICY_EFFECTIVE_AT));
    render(createElement(PrivacyPolicy));

    expect(screen.getByRole("status").textContent).toContain("Current Privacy Policy");
    expect(screen.queryByText("Upcoming policy")).toBeNull();
  });

  it("resolves only the stable revised and June 18 version queries and preserves the June 18 policy as current before the effective instant and prior afterward", () => {
    const beforeEffective = new Date("2026-11-23T04:59:59.999Z");
    const afterEffective = new Date(PRIVACY_POLICY_EFFECTIVE_AT);

    expect(getPrivacyPolicyPresentation("2026-11-23-ai-discovery", beforeEffective)?.state).toBe("upcoming");
    expect(getPrivacyPolicyPresentation("2026-11-23-ai-discovery", afterEffective)?.state).toBe("current");
    expect(getPrivacyPolicyPresentation("2026-06-18", beforeEffective)?.state).toBe("current");
    expect(getPrivacyPolicyPresentation("2026-06-18", afterEffective)?.state).toBe("prior");

    pageState.search = "?version=2026-06-18";
    vi.setSystemTime(beforeEffective);
    render(createElement(PrivacyPolicy));
    expect(screen.getByRole("status").textContent).toContain("Current Privacy Policy");
    expect(screen.getByText(/Your contact information is used solely for transactional communications related to the Service/)).toBeTruthy();
    expect(screen.getByText("13. Contact Us")).toBeTruthy();
    expect(screen.getByRole("link", {name: "Review the upcoming Privacy Policy"}).getAttribute("href")).toBe("/privacy?version=2026-11-23-ai-discovery");
  });

  it("shows an explicit not-found state for an unknown version rather than substituting a policy", () => {
    pageState.search = "?version=unrecognized-policy";
    render(createElement(PrivacyPolicy));

    expect(screen.getByText("Privacy Policy version not found")).toBeTruthy();
    expect(screen.getByText(/not published or does not exist/)).toBeTruthy();
    expect(screen.queryByText("Public Discovery and Review-Link Context")).toBeNull();
    expect(screen.queryByText(/Your contact information is used solely for transactional communications/)).toBeNull();
  });

  it("retains all 13 approved revised sections and critical approved language while excluding review and release-blocker markers", () => {
    const normalized = REVISED_PRIVACY_POLICY_CONTENT.replace(/\s+/g, " ").trim();
    expect(createHash("sha256").update(normalized).digest("hex")).toBe("03f20168e35040ae68dddc2fdfc9a56c90185f2b0a159fd5157a460170067c35");
    for (let section = 1; section <= 13; section += 1) {
      expect(REVISED_PRIVACY_POLICY_CONTENT).toContain(`## ${section}.`);
    }

    expect(REVISED_PRIVACY_POLICY_CONTENT).toContain("These features use a generative-model service configured through Forge.");
    expect(REVISED_PRIVACY_POLICY_CONTENT).toContain("Marketing & Promotions is off by default.");
    expect(REVISED_PRIVACY_POLICY_CONTENT).toContain("short-lived encrypted link");
    expect(REVISED_PRIVACY_POLICY_CONTENT).toContain("Card payment credentials are collected and processed by Stripe through Stripe Checkout");
    expect(REVISED_PRIVACY_POLICY_CONTENT).toContain("We will post any revised Privacy Policy with its effective date.");

    for (const marker of ["UNPUBLISHED REVIEW DRAFT", "NOT EFFECTIVE", "RELEASE GATE", "OWNER/COUNSEL", "Prepared:", "Coordinated proposed version", "Proposed effective date"]) {
      expect(REVISED_PRIVACY_POLICY_CONTENT).not.toContain(marker);
    }
  });
});
