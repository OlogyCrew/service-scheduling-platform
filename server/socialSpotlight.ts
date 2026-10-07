import { and, eq, isNull } from "drizzle-orm";
import { serviceCategories, services, serviceProviders, users } from "../drizzle/schema";
import { requireDb } from "./db/connection";

export const DJ_SPOTLIGHT = { id: 20, name: "DJ & MUSIC SERVICES", slug: "dj-music-services" } as const;

/** Recheck at both drafting and publishing. No demo or pending-review provider is promoted. */
export async function isDjSpotlightAvailable(): Promise<boolean> {
  const db = await requireDb();
  const rows = await db.select({ serviceId: services.id })
    .from(serviceCategories)
    .innerJoin(services, and(
      eq(services.categoryId, serviceCategories.id),
      eq(services.isActive, true), isNull(services.deletedAt),
    ))
    .innerJoin(serviceProviders, and(
      eq(serviceProviders.id, services.providerId),
      eq(serviceProviders.isActive, true),
      eq(serviceProviders.isOfficial, false),
      eq(serviceProviders.verificationStatus, "verified"),
      isNull(serviceProviders.deletedAt),
    ))
    .innerJoin(users, and(
      eq(users.id, serviceProviders.userId), eq(users.role, "provider"), isNull(users.deletedAt),
    ))
    .where(and(
      eq(serviceCategories.id, DJ_SPOTLIGHT.id),
      eq(serviceCategories.slug, DJ_SPOTLIGHT.slug),
      eq(serviceCategories.isActive, true),
    )).limit(1);
  return rows.length > 0;
}
