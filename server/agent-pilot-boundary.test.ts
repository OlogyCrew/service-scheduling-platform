import { describe, expect, it } from "vitest";
import { isAllowedAgentPilotRequest } from "../scripts/agent-pilot-boundary";

describe("controlled agent browser pilot boundary", () => {
  it("allows the audited UI reads and the existing non-transactional resolver", () => {
    expect(isAllowedAgentPilotRequest("GET", "/api/trpc/auth.me,service.getById?batch=1")).toBe(true);
    expect(isAllowedAgentPilotRequest("GET", "/api/trpc/availability.getSchedule?input=example")).toBe(true);
    expect(isAllowedAgentPilotRequest("POST", "/api/trpc/agentHandoff.resolve?batch=1")).toBe(true);
  });

  it.each([
    "/api/trpc/booking.create", "/api/trpc/booking.createMultiDay",
    "/api/trpc/booking.createRecurring", "/api/trpc/provider.requestQuote",
    "/api/trpc/stripe.createCheckoutSession", "/api/trpc/message.send",
    "/api/trpc/auth.logout", "/api/auth/login", "/api/trpc/agentHandoff.resolve,booking.create",
  ])("rejects transactional or authentication submission %s", (url) => {
    expect(isAllowedAgentPilotRequest("POST", url)).toBe(false);
  });

  it("rejects private read queries, mixed batches and path tricks", () => {
    for (const url of ["/api/trpc/booking.list", "/api/trpc/auth.me,booking.list", "/api/trpc/auth.me/../booking.create", "/api/trpc/", "/api/trpc/agentHandoff.resolve/extra"]) {
      expect(isAllowedAgentPilotRequest("GET", url)).toBe(false);
      expect(isAllowedAgentPilotRequest("POST", url)).toBe(false);
    }
    expect(isAllowedAgentPilotRequest("DELETE", "/api/trpc/auth.me")).toBe(false);
  });
});
