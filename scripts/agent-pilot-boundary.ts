// Only for the local test harness; not mounted by the OlogyCrew app server.
const publicUiReads = new Set([
  "auth.me", "service.getById", "provider.getById", "review.listByProvider",
  "service.getPhotos", "availability.getSchedule", "availability.getOverrides",
  "availability.getPublicTimeSlots",
]);

export function isAllowedAgentPilotRequest(method: string, originalUrl: string): boolean {
  const path = originalUrl.split("?")[0];
  if (method === "POST") return path === "/api/trpc/agentHandoff.resolve";
  if (method !== "GET" || !path.startsWith("/api/trpc/")) return false;
  const procedures = path.slice("/api/trpc/".length).split(",");
  return procedures.length > 0 && procedures.every((procedure) => publicUiReads.has(procedure));
}
