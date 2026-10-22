// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { AI_DISCOVERY_LEGAL_RELEASE } from "../shared/legalPolicyRelease";
Object.assign(globalThis, { React });
const state = vi.hoisted(() => ({record:null as any, search:"", acknowledge:vi.fn()}));
vi.mock("wouter", () => ({useSearch:()=>state.search}));
vi.mock("../client/src/components/shared/NavHeader", () => ({NavHeader:()=>React.createElement("nav",null,"Navigation")}));
vi.mock("../client/src/components/shared/PageHeader", () => ({PageHeader:({title}:any)=>React.createElement("h1",null,title)}));
vi.mock("../client/src/_core/hooks/useAuth", () => ({useAuth:()=>({isAuthenticated:false})}));
vi.mock("streamdown", () => ({Streamdown:({children}:any)=>React.createElement("div",null,children)}));
vi.mock("sonner", () => ({toast:{success:vi.fn(),error:vi.fn()}}));
vi.mock("../client/src/lib/trpc", () => ({trpc:{useUtils:()=>({terms:{pendingNotice:{invalidate:vi.fn()}}}),terms:{current:{useQuery:()=>({data:state.record,isLoading:false})},pendingNotice:{useQuery:()=>({data:null})},acknowledge:{useMutation:()=>({mutate:state.acknowledge,isPending:false})},history:{useQuery:()=>({data:[]})}}}}));
import TermsOfService from "../client/src/pages/TermsOfService";
function record(){return {version:AI_DISCOVERY_LEGAL_RELEASE.version,title:"OlogyCrew Terms of Use",summary:"Coordinated Terms and Privacy update",content:"## 1. Approved Terms",status:"published",effectiveAt:new Date(AI_DISCOVERY_LEGAL_RELEASE.effectiveAt),publishedAt:new Date("2026-10-22T16:00:00Z"),acceptanceMode:"notice",materialArbitrationChanges:false,arbitrationSection:null,optOutDeadline:null,contactEmail:"info@ologycrew.com",companyAddress:"171 Prestwick Dr., Hoschton, GA 30548"};}
describe("coordinated Terms page presentation",()=>{
  beforeEach(()=>{vi.useFakeTimers({toFake:["Date"]}); vi.setSystemTime(new Date("2026-10-22T16:00:00Z"));state.record=record();state.search="";vi.clearAllMocks();});
  afterEach(()=>{cleanup();vi.useRealTimers();});
  it("clearly distinguishes the upcoming version and links both the effective baseline and revised Privacy",()=>{
    render(React.createElement(TermsOfService));
    expect(screen.getByText("Upcoming Terms")).toBeTruthy();
    expect(screen.getByRole("link",{name:"Read the currently effective Terms"}).getAttribute("href")).toBe("/terms?version=2026-06-24");
    expect(screen.getByRole("link",{name:"Review the revised Privacy Policy"}).getAttribute("href")).toBe("/privacy?version=2026-11-23-ai-discovery");
    expect(document.body.textContent).toContain("November 23, 2026");
    expect(document.body.textContent).toContain("12:00 AM Eastern Time");
    expect(state.acknowledge).not.toHaveBeenCalled();
  });
  it("stops calling the version upcoming exactly at the Eastern effective instant",()=>{
    vi.setSystemTime(new Date(AI_DISCOVERY_LEGAL_RELEASE.effectiveAt));
    render(React.createElement(TermsOfService));
    expect(screen.queryByText("Upcoming Terms")).toBeNull();
    expect(screen.getByText("Current Terms")).toBeTruthy();
    expect(screen.queryByRole("link",{name:"Read the currently effective Terms"})).toBeNull();
  });
  it("does not expose a private draft through a public version query",()=>{
    state.record=null;state.search="?version=2026-11-23-ai-discovery";
    render(React.createElement(TermsOfService));
    expect(screen.getByRole("heading",{name:"Terms version not found"})).toBeTruthy();
    expect(screen.queryByText("Upcoming Terms")).toBeNull();
  });
});
