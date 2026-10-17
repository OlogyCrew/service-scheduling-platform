import { eq, and, desc, asc, sql, or, like, inArray, isNull } from "drizzle-orm";
import {
  serviceCategories,
  services,
  servicePhotos,
  serviceProviders,
  providerCategories,
  providerSubscriptions,
  users,
  type Service,
  type ProviderCategory,
} from "../../drizzle/schema";
import { getDb } from "./connection";

// ============================================================================
// SERVICE CATEGORY MANAGEMENT
// ============================================================================

export async function getAllCategories() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(serviceCategories)
    .where(eq(serviceCategories.isActive, true))
    .orderBy(asc(serviceCategories.sortOrder), asc(serviceCategories.name));
}

export async function getPublicCategoriesWithServiceCounts() {
  const db = await getDb();
  if (!db) return [];

  return db.select({
    id: serviceCategories.id,
    name: serviceCategories.name,
    slug: serviceCategories.slug,
    description: serviceCategories.description,
    serviceCount: sql<number>`COUNT(DISTINCT CASE
      WHEN ${serviceProviders.id} IS NOT NULL AND ${users.id} IS NOT NULL
      THEN ${services.id}
      ELSE NULL
    END)`,
  })
    .from(serviceCategories)
    .leftJoin(services, and(
      eq(services.categoryId, serviceCategories.id),
      eq(services.isActive, true),
      isNull(services.deletedAt),
    ))
    .leftJoin(serviceProviders, and(
      eq(services.providerId, serviceProviders.id),
      eq(serviceProviders.isActive, true),
      isNull(serviceProviders.deletedAt),
    ))
    .leftJoin(users, and(
      eq(serviceProviders.userId, users.id),
      isNull(users.deletedAt),
    ))
    .where(eq(serviceCategories.isActive, true))
    .groupBy(
      serviceCategories.id,
      serviceCategories.name,
      serviceCategories.slug,
      serviceCategories.description,
      serviceCategories.sortOrder,
    )
    .orderBy(asc(serviceCategories.sortOrder), asc(serviceCategories.name));
}

export type PublicAgentServiceSearchInput = {
  query?: string;
  category?: string;
  city?: string;
  state?: string;
  minPrice?: number;
  maxPrice?: number;
  /** The public agent endpoint always supplies this; undefined preserves existing internal callers. */
  includeDemo?: boolean;
  limit: number;
  offset: number;
};

export async function searchPublicServicesForAgents(input: PublicAgentServiceSearchInput) {
  const db = await getDb();
  if (!db) return { rows: [], total: 0 };

  const conditions = [
    eq(services.isActive, true),
    isNull(services.deletedAt),
    eq(serviceProviders.isActive, true),
    isNull(serviceProviders.deletedAt),
    isNull(users.deletedAt),
    eq(serviceCategories.isActive, true),
  ];

  // Official providers are OlogyCrew demos. Keep legacy internal callers unchanged
  // when they omit the option, while the agent endpoint defaults it to false.
  if (input.includeDemo === false) {
    conditions.push(eq(serviceProviders.isOfficial, false));
  }

  const query = input.query?.trim();
  if (query) {
    const term = `%${query}%`;
    conditions.push(or(
      like(services.name, term),
      like(services.description, term),
      like(serviceProviders.businessName, term),
      like(serviceCategories.name, term),
    )!);
  }

  const category = input.category?.trim();
  if (category) {
    const categoryTerm = `%${category}%`;
    conditions.push(or(
      eq(serviceCategories.slug, category.toLowerCase()),
      like(serviceCategories.name, categoryTerm),
    )!);
  }
  if (input.city?.trim()) {
    conditions.push(sql`LOWER(${serviceProviders.city}) LIKE ${`%${input.city.trim().toLowerCase()}%`}`);
  }
  if (input.state?.trim()) {
    conditions.push(sql`LOWER(${serviceProviders.state}) = ${input.state.trim().toLowerCase()}`);
  }

  const publicPrice = sql<number>`CASE
    WHEN ${services.pricingModel} = 'hourly' THEN COALESCE(
      CAST(${services.hourlyRate} AS DECIMAL(10, 2)),
      CAST(${services.basePrice} AS DECIMAL(10, 2))
    )
    WHEN ${services.pricingModel} = 'consultation' THEN 0
    WHEN ${services.pricingModel} = 'custom_quote' THEN NULL
    ELSE CAST(${services.basePrice} AS DECIMAL(10, 2))
  END`;
  if (input.minPrice !== undefined) conditions.push(sql`${publicPrice} >= ${input.minPrice}`);
  if (input.maxPrice !== undefined) conditions.push(sql`${publicPrice} <= ${input.maxPrice}`);

  const whereClause = and(...conditions);
  const [rows, totalRows] = await Promise.all([
    db.select({
      id: services.id,
      providerId: services.providerId,
      categoryId: services.categoryId,
      categoryName: serviceCategories.name,
      categorySlug: serviceCategories.slug,
      name: services.name,
      description: services.description,
      serviceType: services.serviceType,
      pricingModel: services.pricingModel,
      basePrice: services.basePrice,
      hourlyRate: services.hourlyRate,
      durationMinutes: services.durationMinutes,
      depositRequired: services.depositRequired,
      depositType: services.depositType,
      depositAmount: services.depositAmount,
      depositPercentage: services.depositPercentage,
      cancellationPolicy: services.cancellationPolicy,
      isExperience: services.isExperience,
      minGuests: services.minGuests,
      maxCapacity: services.maxCapacity,
      pricePerPerson: services.pricePerPerson,
      businessName: serviceProviders.businessName,
      providerSlug: serviceProviders.profileSlug,
      providerCity: serviceProviders.city,
      providerState: serviceProviders.state,
      providerRating: serviceProviders.averageRating,
      providerReviewCount: serviceProviders.totalReviews,
      providerOfficial: serviceProviders.isOfficial,
      isDemo: serviceProviders.isOfficial,
      providerTrustLevel: serviceProviders.trustLevel,
    })
      .from(services)
      .innerJoin(serviceProviders, eq(services.providerId, serviceProviders.id))
      .innerJoin(users, eq(serviceProviders.userId, users.id))
      .innerJoin(serviceCategories, eq(services.categoryId, serviceCategories.id))
      .where(whereClause)
      .orderBy(
        input.includeDemo === true ? asc(serviceProviders.isOfficial) : desc(serviceProviders.isOfficial),
        desc(serviceProviders.trustScore),
        desc(serviceProviders.averageRating),
        asc(services.name),
      )
      .limit(input.limit)
      .offset(input.offset),
    db.select({ total: sql<number>`COUNT(DISTINCT ${services.id})` })
      .from(services)
      .innerJoin(serviceProviders, eq(services.providerId, serviceProviders.id))
      .innerJoin(users, eq(serviceProviders.userId, users.id))
      .innerJoin(serviceCategories, eq(services.categoryId, serviceCategories.id))
      .where(whereClause),
  ]);

  return { rows, total: Number(totalRows[0]?.total ?? 0) };
}

export async function getCategoryById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(serviceCategories).where(eq(serviceCategories.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getCategoryBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(serviceCategories).where(eq(serviceCategories.slug, slug)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============================================================================
// PROVIDER-CATEGORY MANAGEMENT (multi-category support)
// ============================================================================

export async function getProviderCategories(providerId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    id: providerCategories.id,
    providerId: providerCategories.providerId,
    categoryId: providerCategories.categoryId,
    isActive: providerCategories.isActive,
    createdAt: providerCategories.createdAt,
    categoryName: serviceCategories.name,
    categorySlug: serviceCategories.slug,
  }).from(providerCategories)
    .innerJoin(serviceCategories, eq(providerCategories.categoryId, serviceCategories.id))
    .where(and(
      eq(providerCategories.providerId, providerId),
      eq(providerCategories.isActive, true),
      eq(serviceCategories.isActive, true),
    ))
    .orderBy(providerCategories.createdAt);
  return rows;
}

export async function addProviderCategory(providerId: number, categoryId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Use INSERT IGNORE to handle duplicates gracefully
  try {
    await db.insert(providerCategories).values({ providerId, categoryId });
  } catch (err: any) {
    // If duplicate, just ignore
    if (err?.code === 'ER_DUP_ENTRY' || err?.message?.includes('Duplicate')) return;
    throw err;
  }
}

export async function addProviderCategories(providerId: number, categoryIds: number[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (categoryIds.length === 0) return;
  for (const categoryId of categoryIds) {
    await addProviderCategory(providerId, categoryId);
  }
}

export async function removeProviderCategory(providerId: number, categoryId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(providerCategories)
    .where(and(eq(providerCategories.providerId, providerId), eq(providerCategories.categoryId, categoryId)));
}

export async function setProviderCategories(providerId: number, categoryIds: number[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Remove all existing
  await db.delete(providerCategories).where(eq(providerCategories.providerId, providerId));
  // Add new ones
  if (categoryIds.length > 0) {
    await db.insert(providerCategories).values(
      categoryIds.map(categoryId => ({ providerId, categoryId }))
    );
  }
}

export async function getProvidersByCategory(categoryId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  // Only return providers who have at least one active service in this category
  const rows = await db.selectDistinct({ providerId: services.providerId })
    .from(services)
    .where(and(eq(services.categoryId, categoryId), eq(services.isActive, true)));
  return rows.map(r => r.providerId);
}

// ============================================================================
// SERVICE MANAGEMENT
// ============================================================================

export async function createService(data: typeof services.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(services).values(data);
  return result;
}

export async function getServiceById(id: number): Promise<Service | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(services).where(eq(services.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getServicesByProviderId(providerId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(services)
    .where(and(eq(services.providerId, providerId), eq(services.isActive, true)))
    .orderBy(services.name);
}

export async function getExperiences() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    id: services.id,
    providerId: services.providerId,
    categoryId: services.categoryId,
    name: services.name,
    description: services.description,
    serviceType: services.serviceType,
    pricingModel: services.pricingModel,
    basePrice: services.basePrice,
    hourlyRate: services.hourlyRate,
    durationMinutes: services.durationMinutes,
    isExperience: services.isExperience,
    minGuests: services.minGuests,
    maxCapacity: services.maxCapacity,
    pricePerPerson: services.pricePerPerson,
    whatsIncluded: services.whatsIncluded,
    isActive: services.isActive,
    createdAt: services.createdAt,
    businessName: serviceProviders.businessName,
    providerSlug: serviceProviders.profileSlug,
    providerCity: serviceProviders.city,
    providerState: serviceProviders.state,
    providerProfilePhotoUrl: users.profilePhotoUrl,
  })
    .from(services)
    .innerJoin(serviceProviders, eq(services.providerId, serviceProviders.id))
    .innerJoin(users, eq(serviceProviders.userId, users.id))
    .where(and(
      eq(services.isExperience, true),
      eq(services.isActive, true),
      eq(serviceProviders.isActive, true)
    ))
    .orderBy(desc(services.createdAt));
  return rows;
}

export async function getServicesByCategory(categoryId: number) {
  const db = await getDb();
  if (!db) return [];
  // Only return services from active providers
  const rows = await db.select({
    id: services.id,
    providerId: services.providerId,
    categoryId: services.categoryId,
    name: services.name,
    description: services.description,
    serviceType: services.serviceType,
    pricingModel: services.pricingModel,
    basePrice: services.basePrice,
    hourlyRate: services.hourlyRate,
    durationMinutes: services.durationMinutes,
    isActive: services.isActive,
    createdAt: services.createdAt,
    updatedAt: services.updatedAt,
  })
    .from(services)
    .innerJoin(serviceProviders, eq(services.providerId, serviceProviders.id))
    .where(and(
      eq(services.categoryId, categoryId),
      eq(services.isActive, true),
      eq(serviceProviders.isActive, true)
    ))
    .orderBy(services.name);
  return rows;
}

export async function searchServices(searchTerm: string) {
  const db = await getDb();
  if (!db) return [];
  const term = `%${searchTerm}%`;
  // Search services by name/description AND by provider business name
  // Priority ranking: trust score (primary) + subscription tier boost (secondary)
  const hasPaidSearchAccess = sql<boolean>`(
    ${providerSubscriptions.status} = 'active'
    OR (${providerSubscriptions.status} = 'trialing' AND ${providerSubscriptions.trialEndsAt} > NOW())
    OR (${providerSubscriptions.status} = 'past_due' AND ${providerSubscriptions.currentPeriodEnd} > NOW())
    OR (${providerSubscriptions.status} = 'cancelled' AND ${providerSubscriptions.cancelAtPeriodEnd} = true AND ${providerSubscriptions.currentPeriodEnd} > NOW())
  )`;
  const tierBoost = sql<number>`CASE 
    WHEN ${providerSubscriptions.tier} = 'premium' AND ${hasPaidSearchAccess} THEN 30
    WHEN ${providerSubscriptions.tier} = 'basic' AND ${hasPaidSearchAccess} THEN 15
    ELSE 0
  END`;
  const rankScore = sql<number>`(COALESCE(${serviceProviders.trustScore}, 0) + ${tierBoost})`;

  const rows = await db
    .select({
      id: services.id,
      providerId: services.providerId,
      categoryId: services.categoryId,
      name: services.name,
      description: services.description,
      serviceType: services.serviceType,
      pricingModel: services.pricingModel,
      basePrice: services.basePrice,
      hourlyRate: services.hourlyRate,
      durationMinutes: services.durationMinutes,
      depositRequired: services.depositRequired,
      depositType: services.depositType,
      depositAmount: services.depositAmount,
      depositPercentage: services.depositPercentage,
      cancellationPolicy: services.cancellationPolicy,
      specialRequirements: services.specialRequirements,
      bufferTimeMinutes: services.bufferTimeMinutes,
      isActive: services.isActive,
      createdAt: services.createdAt,
      updatedAt: services.updatedAt,
      deletedAt: services.deletedAt,
      businessName: serviceProviders.businessName,
      providerSlug: serviceProviders.profileSlug,
      providerProfilePhotoUrl: users.profilePhotoUrl,
      trustScore: serviceProviders.trustScore,
      trustLevel: serviceProviders.trustLevel,
    })
    .from(services)
    .innerJoin(serviceProviders, eq(services.providerId, serviceProviders.id))
    .innerJoin(users, eq(serviceProviders.userId, users.id))
    .leftJoin(providerSubscriptions, eq(serviceProviders.id, providerSubscriptions.providerId))
    .where(and(
      eq(services.isActive, true),
      eq(serviceProviders.isActive, true),
      or(
        like(services.name, term),
        like(services.description, term),
        like(serviceProviders.businessName, term)
      )
    ))
    .orderBy(
      desc(serviceProviders.isOfficial),
      desc(rankScore),
      desc(serviceProviders.averageRating)
    )
    .limit(50);
  return rows;
}

/**
 * Search providers by business name. Returns enriched provider objects
 * with categories and profile photo for display in search results.
 */
export async function searchProviders(searchTerm: string) {
  const db = await getDb();
  if (!db) return [];
  const term = `%${searchTerm}%`;
  // Priority ranking: trust score (primary) + subscription tier boost (secondary)
  const hasPaidSearchAccess = sql<boolean>`(
    ${providerSubscriptions.status} = 'active'
    OR (${providerSubscriptions.status} = 'trialing' AND ${providerSubscriptions.trialEndsAt} > NOW())
    OR (${providerSubscriptions.status} = 'past_due' AND ${providerSubscriptions.currentPeriodEnd} > NOW())
    OR (${providerSubscriptions.status} = 'cancelled' AND ${providerSubscriptions.cancelAtPeriodEnd} = true AND ${providerSubscriptions.currentPeriodEnd} > NOW())
  )`;
  const tierBoost = sql<number>`CASE 
    WHEN ${providerSubscriptions.tier} = 'premium' AND ${hasPaidSearchAccess} THEN 30
    WHEN ${providerSubscriptions.tier} = 'basic' AND ${hasPaidSearchAccess} THEN 15
    ELSE 0
  END`;
  const rankScore = sql<number>`(COALESCE(${serviceProviders.trustScore}, 0) + ${tierBoost})`;

  const rows = await db
    .select({
      id: serviceProviders.id,
      userId: serviceProviders.userId,
      businessName: serviceProviders.businessName,
      description: serviceProviders.description,
      city: serviceProviders.city,
      state: serviceProviders.state,
      averageRating: serviceProviders.averageRating,
      totalReviews: serviceProviders.totalReviews,
      totalBookings: serviceProviders.totalBookings,
      profileSlug: serviceProviders.profileSlug,
      isOfficial: serviceProviders.isOfficial,
      isFeatured: serviceProviders.isFeatured,
      verificationStatus: serviceProviders.verificationStatus,
      profilePhotoUrl: users.profilePhotoUrl,
      trustScore: serviceProviders.trustScore,
      trustLevel: serviceProviders.trustLevel,
      offersEstimates: serviceProviders.offersEstimates,
      offersEmergencyService: serviceProviders.offersEmergencyService,
    })
    .from(serviceProviders)
    .innerJoin(users, eq(serviceProviders.userId, users.id))
    .leftJoin(providerSubscriptions, eq(serviceProviders.id, providerSubscriptions.providerId))
    .where(and(
      eq(serviceProviders.isActive, true),
      or(
        like(serviceProviders.businessName, term),
        like(serviceProviders.description, term)
      )
    ))
    .orderBy(
      desc(serviceProviders.isOfficial),
      desc(rankScore),
      desc(serviceProviders.averageRating)
    )
    .limit(50);
  return rows;
}

export async function getServicesByProvider(providerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(services)
    .where(and(eq(services.providerId, providerId), eq(services.isActive, true)))
    .orderBy(services.name);
}

// ============================================================================
// SERVICE UPDATE & DELETE
// ============================================================================

export async function updateService(serviceId: number, data: {
  name?: string;
  description?: string;
  categoryId?: number;
  serviceType?: string;
  pricingModel?: string;
  basePrice?: string;
  hourlyRate?: string;
  durationMinutes?: number;
  depositRequired?: boolean;
  depositType?: string;
  depositAmount?: string;
  depositPercentage?: string;
  cancellationPolicy?: string;
  specialRequirements?: string;
  isActive?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateData: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) updateData[key] = value;
  }
  if (Object.keys(updateData).length === 0) return;
  await db.update(services).set(updateData).where(eq(services.id, serviceId));
}

export async function deleteService(serviceId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(services)
    .set({ isActive: false, deletedAt: new Date() })
    .where(eq(services.id, serviceId));
}

export async function getActiveServiceCount(providerId: number): Promise<number> {
  const database = await getDb();
  if (!database) return 0;
  const result = await database
    .select({ count: sql<number>`COUNT(*)` })
    .from(services)
    .where(and(eq(services.providerId, providerId), eq(services.isActive, true)));
  return result[0]?.count || 0;
}

// ============================================================================
// SERVICE PHOTO HELPERS
// ============================================================================

export async function addServicePhoto(data: {
  serviceId: number;
  photoUrl: string;
  caption?: string;
  sortOrder?: number;
  isPrimary?: boolean;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  await database.insert(servicePhotos).values({
    serviceId: data.serviceId,
    photoUrl: data.photoUrl,
    caption: data.caption || null,
    sortOrder: data.sortOrder || 0,
    isPrimary: data.isPrimary || false,
  });
}

export async function getServicePhotos(serviceId: number) {
  const database = await getDb();
  if (!database) return [];
  return database.select().from(servicePhotos)
    .where(eq(servicePhotos.serviceId, serviceId))
    .orderBy(servicePhotos.sortOrder);
}

export async function getPhotosForServices(serviceIds: number[]) {
  if (serviceIds.length === 0) return [];
  const database = await getDb();
  if (!database) return [];
  return database.select().from(servicePhotos)
    .where(inArray(servicePhotos.serviceId, serviceIds))
    .orderBy(servicePhotos.sortOrder);
}

export async function deleteServicePhoto(photoId: number) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  await database.delete(servicePhotos).where(eq(servicePhotos.id, photoId));
}

export async function updateServicePhotoOrder(photoId: number, sortOrder: number) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  await database.update(servicePhotos).set({ sortOrder }).where(eq(servicePhotos.id, photoId));
}

export async function setServicePrimaryPhoto(serviceId: number, photoId: number) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  await database.update(servicePhotos).set({ isPrimary: false }).where(eq(servicePhotos.serviceId, serviceId));
  await database.update(servicePhotos).set({ isPrimary: true }).where(eq(servicePhotos.id, photoId));
}
