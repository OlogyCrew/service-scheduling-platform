import { eq, and, gte, lte, desc, asc, sql, inArray } from "drizzle-orm";
import {
  bookings,
  bookingSessions,
  payments,
  reviews,
  messages,
  services,
  serviceProviders,
  users,
  notifications,
  promoRedemptions,
  referralCredits,
  quoteRequests,
  offlineBookingPayments,
  type Booking,
} from "../../drizzle/schema";
import { getDb } from "./connection";
import { addCalendarDays, OLOGYCREW_BOOKING_TIME_ZONE, zonedDateTimeToUtc } from "../../shared/bookingPolicy";

// ============================================================================
// BOOKING MANAGEMENT
// ============================================================================

export async function createBooking(data: typeof bookings.$inferInsert): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(bookings).values(data);
  return result[0].insertId;
}

export class BookingReservationConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingReservationConflictError";
  }
}

export class QuoteConversionConflictError extends Error {
  constructor(message = "This quote has already changed or was converted.") {
    super(message);
    this.name = "QuoteConversionConflictError";
  }
}

type AtomicBookingSession = Omit<typeof bookingSessions.$inferInsert, "bookingId">;

function intervalFor(date: string, startTime: string, endTime?: string | null, durationMinutes = 60) {
  const normalizedStart = startTime.slice(0, 5);
  const normalizedEnd = endTime?.slice(0, 5) || calculateCalendarEndTime(normalizedStart, durationMinutes);
  const endDate = normalizedEnd <= normalizedStart ? addCalendarDays(date, 1) : date;
  const start = zonedDateTimeToUtc(date, normalizedStart, OLOGYCREW_BOOKING_TIME_ZONE);
  const end = zonedDateTimeToUtc(endDate, normalizedEnd, OLOGYCREW_BOOKING_TIME_ZONE);
  if (!start || !end || end <= start) throw new Error("Invalid booking interval");
  return { start, end };
}

function calculateCalendarEndTime(startTime: string, durationMinutes: number) {
  const [hours, minutes] = startTime.split(":").map(Number);
  const total = (hours * 60 + minutes + durationMinutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

type CalendarInterval = { serviceId: number; date: string; startTime: string; endTime?: string | null; durationMinutes?: number };

function assertCalendarIntervalAvailable(input: {
  requested: CalendarInterval;
  existing: CalendarInterval[];
  isGroupClass: boolean;
  maxCapacity: number;
}) {
  const proposed = intervalFor(input.requested.date, input.requested.startTime, input.requested.endTime);
  const overlapping = input.existing.filter((currentInterval) => {
    const current = intervalFor(currentInterval.date, currentInterval.startTime, currentInterval.endTime, currentInterval.durationMinutes);
    return proposed.start < current.end && current.start < proposed.end;
  });
  if (!input.isGroupClass) {
    if (overlapping.length > 0) throw new BookingReservationConflictError("This time slot is no longer available.");
    return;
  }

  const compatible = overlapping.filter((current) =>
    current.serviceId === input.requested.serviceId &&
    current.date === input.requested.date &&
    current.startTime === input.requested.startTime
  );
  if (compatible.length !== overlapping.length) {
    throw new BookingReservationConflictError("This time slot is no longer available.");
  }
  if (compatible.length >= Math.max(1, input.maxCapacity)) {
    throw new BookingReservationConflictError(`This class is full (${Math.max(1, input.maxCapacity)} spots).`);
  }
}

/**
 * Serializes calendar checks per provider and inserts the booking plus optional
 * sessions in the same transaction. Every booking writer that reserves time
 * must use this helper to prevent concurrent overbooking.
 */
export async function createBookingWithCalendarGuard(input: {
  booking: typeof bookings.$inferInsert;
  sessions?: AtomicBookingSession[];
  isGroupClass: boolean;
  maxCapacity: number;
  quoteId?: number;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const requestedSessions = input.sessions?.length
    ? input.sessions.map((session) => ({ date: session.sessionDate, startTime: session.startTime, endTime: session.endTime }))
    : [{ date: input.booking.bookingDate, startTime: input.booking.startTime, endTime: input.booking.endTime }];
  const dates = requestedSessions.map((session) => session.date).sort();
  const queryStart = addCalendarDays(dates[0], -1);
  const queryEnd = addCalendarDays(dates[dates.length - 1], 1);

  return await db.transaction(async (tx: any) => {
    if (input.quoteId !== undefined) {
      const quoteRows = await tx.execute(
        sql`SELECT id, quoteStatus AS status, bookingId, validUntil FROM quote_requests WHERE id = ${input.quoteId} FOR UPDATE`,
      );
      const lockedQuote = quoteRows[0]?.[0];
      if (!lockedQuote || lockedQuote.status !== "quoted" || lockedQuote.bookingId) {
        throw new QuoteConversionConflictError();
      }
      if (lockedQuote.validUntil && new Date(lockedQuote.validUntil).getTime() <= Date.now()) {
        throw new QuoteConversionConflictError("This quote has expired. Please request a new quote.");
      }
    }
    await tx.execute(sql`SELECT id FROM service_providers WHERE id = ${input.booking.providerId} FOR UPDATE`);

    const existingSingleBookings = await tx.select().from(bookings).where(and(
      eq(bookings.providerId, input.booking.providerId),
      gte(bookings.bookingDate, queryStart),
      lte(bookings.bookingDate, queryEnd),
      eq(bookings.bookingType, "single"),
      inArray(bookings.status, ["pending", "confirmed", "in_progress"] as any),
    ));
    const existingSessionRows = await tx.select({
      session: bookingSessions,
      serviceId: bookings.serviceId,
    })
      .from(bookingSessions)
      .innerJoin(bookings, eq(bookingSessions.bookingId, bookings.id))
      .where(and(
        eq(bookings.providerId, input.booking.providerId),
        gte(bookingSessions.sessionDate, queryStart),
        lte(bookingSessions.sessionDate, queryEnd),
        eq(bookingSessions.status, "scheduled"),
        inArray(bookings.status, ["pending", "confirmed", "in_progress"] as any),
      ));

    const existingIntervals = [
      ...existingSingleBookings.map((booking: any) => ({
        serviceId: booking.serviceId,
        date: booking.bookingDate,
        startTime: booking.startTime,
        endTime: booking.endTime,
      })),
      ...existingSessionRows.map((row: any) => ({
        serviceId: row.serviceId,
        date: row.session.sessionDate,
        startTime: row.session.startTime,
        endTime: row.session.endTime,
      })),
    ];

    for (const requested of requestedSessions) {
      assertCalendarIntervalAvailable({
        requested: { serviceId: input.booking.serviceId, ...requested },
        existing: existingIntervals,
        isGroupClass: input.isGroupClass,
        maxCapacity: input.maxCapacity,
      });
    }

    const result = await tx.insert(bookings).values(input.booking);
    const bookingId = result[0].insertId;
    if (input.sessions?.length) {
      await tx.insert(bookingSessions).values(input.sessions.map((session) => ({ ...session, bookingId })));
    }
    if (input.quoteId !== undefined) {
      await tx.update(quoteRequests)
        .set({ status: "booked", bookingId })
        .where(and(eq(quoteRequests.id, input.quoteId), eq(quoteRequests.status, "quoted")));
    }
    return bookingId;
  });
}

export async function rescheduleSessionWithCalendarGuard(input: {
  bookingId: number;
  sessionId: number;
  providerId: number;
  serviceId: number;
  originalDate: string;
  newDate: string;
  newStartTime: string;
  newEndTime: string;
  sessionNumber: number;
  isGroupClass: boolean;
  maxCapacity: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.transaction(async (tx: any) => {
    await tx.execute(sql`SELECT id FROM service_providers WHERE id = ${input.providerId} FOR UPDATE`);
    const sessionRows = await tx.execute(
      sql`SELECT id, status, bookingId FROM booking_sessions WHERE id = ${input.sessionId} FOR UPDATE`,
    );
    const lockedSession = sessionRows[0]?.[0];
    if (!lockedSession || lockedSession.status !== "scheduled" || lockedSession.bookingId !== input.bookingId) {
      throw new BookingReservationConflictError("This session has already changed.");
    }

    const queryStart = addCalendarDays(input.newDate, -1);
    const queryEnd = addCalendarDays(input.newDate, 1);
    const singleRows = await tx.select().from(bookings).where(and(
      eq(bookings.providerId, input.providerId),
      gte(bookings.bookingDate, queryStart),
      lte(bookings.bookingDate, queryEnd),
      eq(bookings.bookingType, "single"),
      inArray(bookings.status, ["pending", "confirmed", "in_progress"] as any),
    ));
    const scheduledRows = await tx.select({ session: bookingSessions, serviceId: bookings.serviceId })
      .from(bookingSessions)
      .innerJoin(bookings, eq(bookingSessions.bookingId, bookings.id))
      .where(and(
        eq(bookings.providerId, input.providerId),
        gte(bookingSessions.sessionDate, queryStart),
        lte(bookingSessions.sessionDate, queryEnd),
        eq(bookingSessions.status, "scheduled"),
        inArray(bookings.status, ["pending", "confirmed", "in_progress"] as any),
      ));
    const existing: CalendarInterval[] = [
      ...singleRows.map((row: any) => ({ serviceId: row.serviceId, date: row.bookingDate, startTime: row.startTime, endTime: row.endTime })),
      ...scheduledRows
        .filter((row: any) => row.session.id !== input.sessionId)
        .map((row: any) => ({ serviceId: row.serviceId, date: row.session.sessionDate, startTime: row.session.startTime, endTime: row.session.endTime })),
    ];
    assertCalendarIntervalAvailable({
      requested: { serviceId: input.serviceId, date: input.newDate, startTime: input.newStartTime, endTime: input.newEndTime },
      existing,
      isGroupClass: input.isGroupClass,
      maxCapacity: input.maxCapacity,
    });

    const result = await tx.insert(bookingSessions).values({
      bookingId: input.bookingId,
      sessionDate: input.newDate,
      startTime: input.newStartTime,
      endTime: input.newEndTime,
      sessionNumber: input.sessionNumber,
      status: "scheduled",
    });
    const newSessionId = result[0].insertId;
    await tx.update(bookingSessions).set({
      status: "rescheduled" as any,
      rescheduledToSessionId: newSessionId,
      rescheduledFromDate: input.originalDate,
      rescheduledAt: new Date(),
    }).where(and(eq(bookingSessions.id, input.sessionId), eq(bookingSessions.status, "scheduled")));
    return newSessionId;
  });
}

export async function updateBookingTimingWithCalendarGuard(input: {
  bookingId: number;
  providerId: number;
  serviceId: number;
  bookingDate: string;
  startTime: string;
  endTime: string;
  isGroupClass: boolean;
  maxCapacity: number;
  values: {
    startTime: string;
    endTime: string;
    durationMinutes: number;
    subtotal: string;
    platformFee: string;
    totalAmount: string;
    depositAmount: string;
    remainingAmount: string;
  };
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.transaction(async (tx: any) => {
    await tx.execute(sql`SELECT id FROM service_providers WHERE id = ${input.providerId} FOR UPDATE`);
    const bookingRows = await tx.execute(
      sql`SELECT id, status, bookingType FROM bookings WHERE id = ${input.bookingId} FOR UPDATE`,
    );
    const lockedBooking = bookingRows[0]?.[0];
    if (!lockedBooking || lockedBooking.bookingType !== "single" || !["pending", "confirmed"].includes(lockedBooking.status)) {
      throw new BookingReservationConflictError("This booking can no longer be edited.");
    }

    const queryStart = addCalendarDays(input.bookingDate, -1);
    const queryEnd = addCalendarDays(input.bookingDate, 1);
    const singleRows = await tx.select().from(bookings).where(and(
      eq(bookings.providerId, input.providerId),
      gte(bookings.bookingDate, queryStart),
      lte(bookings.bookingDate, queryEnd),
      eq(bookings.bookingType, "single"),
      inArray(bookings.status, ["pending", "confirmed", "in_progress"] as any),
    ));
    const scheduledRows = await tx.select({ session: bookingSessions, serviceId: bookings.serviceId })
      .from(bookingSessions)
      .innerJoin(bookings, eq(bookingSessions.bookingId, bookings.id))
      .where(and(
        eq(bookings.providerId, input.providerId),
        gte(bookingSessions.sessionDate, queryStart),
        lte(bookingSessions.sessionDate, queryEnd),
        eq(bookingSessions.status, "scheduled"),
        inArray(bookings.status, ["pending", "confirmed", "in_progress"] as any),
      ));
    const existing: CalendarInterval[] = [
      ...singleRows
        .filter((row: any) => row.id !== input.bookingId)
        .map((row: any) => ({ serviceId: row.serviceId, date: row.bookingDate, startTime: row.startTime, endTime: row.endTime })),
      ...scheduledRows.map((row: any) => ({
        serviceId: row.serviceId,
        date: row.session.sessionDate,
        startTime: row.session.startTime,
        endTime: row.session.endTime,
      })),
    ];
    assertCalendarIntervalAvailable({
      requested: { serviceId: input.serviceId, date: input.bookingDate, startTime: input.startTime, endTime: input.endTime },
      existing,
      isGroupClass: input.isGroupClass,
      maxCapacity: input.maxCapacity,
    });
    await tx.update(bookings).set(input.values).where(and(
      eq(bookings.id, input.bookingId),
      inArray(bookings.status, ["pending", "confirmed"] as any),
    ));
  });
}

export async function getBookingById(id: number): Promise<Booking | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getBookingByNumber(bookingNumber: string): Promise<Booking | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(bookings).where(eq(bookings.bookingNumber, bookingNumber)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getCustomerBookings(customerId: number, status?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(bookings.customerId, customerId)];
  if (status && status !== "all") conditions.push(eq(bookings.status, status as any));
  return await db.select({
    booking: bookings,
    offlinePaymentStatus: offlineBookingPayments.status,
    offlinePaymentMethod: offlineBookingPayments.offlinePaymentMethod,
    offlineOriginalAmountDue: offlineBookingPayments.originalAmountDue,
    offlineAmountReceived: offlineBookingPayments.amountReceived,
    offlinePaidAt: offlineBookingPayments.paidAt,
    offlineWaivedAt: offlineBookingPayments.waivedAt,
  }).from(bookings)
    .leftJoin(offlineBookingPayments, eq(offlineBookingPayments.bookingId, bookings.id))
    .where(and(...conditions))
    .orderBy(desc(bookings.createdAt))
    .then(rows => rows.map(({ booking, ...offline }) => ({ ...booking, ...offline })));
}

export async function getProviderBookings(providerId: number, status?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(bookings.providerId, providerId)];
  if (status && status !== "all") conditions.push(eq(bookings.status, status as any));
  const results = await db.select({
    id: bookings.id,
    bookingNumber: bookings.bookingNumber,
    customerId: bookings.customerId,
    providerId: bookings.providerId,
    serviceId: bookings.serviceId,
    bookingDate: bookings.bookingDate,
    startTime: bookings.startTime,
    endTime: bookings.endTime,
    durationMinutes: bookings.durationMinutes,
    status: bookings.status,
    subtotal: bookings.subtotal,
    platformFee: bookings.platformFee,
    totalAmount: bookings.totalAmount,
    depositAmount: bookings.depositAmount,
    remainingAmount: bookings.remainingAmount,
    locationType: bookings.locationType,
    serviceAddressLine1: bookings.serviceAddressLine1,
    serviceCity: bookings.serviceCity,
    serviceState: bookings.serviceState,
    servicePostalCode: bookings.servicePostalCode,
    venueName: bookings.venueName,
    customerNotes: bookings.customerNotes,
    providerNotes: bookings.providerNotes,
    travelFee: bookings.travelFee,
    createdAt: bookings.createdAt,
    updatedAt: bookings.updatedAt,
    customerName: users.name,
    customerFirstName: users.firstName,
    customerLastName: users.lastName,
    customerEmail: users.email,
  }).from(bookings)
    .leftJoin(users, eq(bookings.customerId, users.id))
    .where(and(...conditions))
    .orderBy(desc(bookings.createdAt));
  // Construct proper customerName from available fields
  return results.map(r => ({
    ...r,
    customerName: r.customerName || 
      [r.customerFirstName, r.customerLastName].filter(Boolean).join(" ") || 
      null,
  }));
}

export async function getAllBookings() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(bookings).orderBy(desc(bookings.createdAt));
}

export async function getBookingsByDateRange(providerId: number, startDate: string, endDate: string) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(bookings)
    .where(and(
      eq(bookings.providerId, providerId),
      gte(bookings.bookingDate, startDate),
      lte(bookings.bookingDate, endDate),
      inArray(bookings.status, ["pending", "confirmed", "in_progress"] as any)
    ))
    .orderBy(bookings.bookingDate, bookings.startTime);
}

export async function updateBookingStatus(bookingId: number, status: string, additionalData?: Record<string, any>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateData: Record<string, any> = { status };
  if (additionalData) {
    Object.assign(updateData, additionalData);
  }
  await db.update(bookings).set(updateData).where(eq(bookings.id, bookingId));
}

export async function updateBookingTiming(bookingId: number, data: {
  startTime: string;
  endTime: string;
  durationMinutes: number;
  subtotal: string;
  platformFee: string;
  totalAmount: string;
  depositAmount: string;
  remainingAmount: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(bookings).set({
    startTime: data.startTime,
    endTime: data.endTime,
    durationMinutes: data.durationMinutes,
    subtotal: data.subtotal,
    platformFee: data.platformFee,
    totalAmount: data.totalAmount,
    depositAmount: data.depositAmount,
    remainingAmount: data.remainingAmount,
  } as any).where(eq(bookings.id, bookingId));
}

// ============================================================================
// CANCELLATION & REFUND HELPERS
// ============================================================================

export async function cancelBooking(bookingId: number, data: {
  cancellationReason: string;
  cancelledBy: "customer" | "provider" | "admin";
  cancelledAt: Date;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  await database.update(bookings)
    .set({
      status: "cancelled",
      cancellationReason: data.cancellationReason,
      cancelledBy: data.cancelledBy,
      cancelledAt: data.cancelledAt,
    } as any)
    .where(eq(bookings.id, bookingId));
}

// ============================================================================
// BOOKING REMINDERS
// ============================================================================

export async function getBookingsNeedingReminders(): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  const in23h = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000);
  const upcomingBookings = await db.select()
    .from(bookings)
    .where(and(
      eq(bookings.status, "confirmed"),
      eq(bookings.reminderSent, false),
      gte(sql`CONCAT(${bookings.bookingDate}, ' ', ${bookings.startTime})`, in23h.toISOString().replace('T', ' ').slice(0, 19)),
      lte(sql`CONCAT(${bookings.bookingDate}, ' ', ${bookings.startTime})`, in25h.toISOString().replace('T', ' ').slice(0, 19)),
    ));
  return upcomingBookings;
}

export async function markReminderSent(bookingId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(bookings).set({ reminderSent: true }).where(eq(bookings.id, bookingId));
}

export async function getUpcomingBookingsForUser(userId: number): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  return await db.select()
    .from(bookings)
    .where(and(
      eq(bookings.customerId, userId),
      eq(bookings.status, "confirmed"),
      gte(sql`CONCAT(${bookings.bookingDate}, ' ', ${bookings.startTime})`, now.toISOString().replace('T', ' ').slice(0, 19)),
    ))
    .orderBy(asc(bookings.bookingDate), asc(bookings.startTime));
}

// ============================================================================
// BOOKING EXPORT HELPERS
// ============================================================================

export async function getCustomerBookingsWithDetails(customerId: number, status?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(bookings.customerId, customerId)];
  if (status && status !== "all") {
    conditions.push(eq(bookings.status, status as any));
  }
  const results = await db.select({
    id: bookings.id,
    bookingNumber: bookings.bookingNumber,
    bookingDate: bookings.bookingDate,
    startTime: bookings.startTime,
    endTime: bookings.endTime,
    durationMinutes: bookings.durationMinutes,
    status: bookings.status,
    locationType: bookings.locationType,
    subtotal: bookings.subtotal,
    platformFee: bookings.platformFee,
    totalAmount: bookings.totalAmount,
    travelFee: bookings.travelFee,
    customerNotes: bookings.customerNotes,
    createdAt: bookings.createdAt,
    serviceName: services.name,
    providerName: serviceProviders.businessName,
  }).from(bookings)
    .leftJoin(services, eq(bookings.serviceId, services.id))
    .leftJoin(serviceProviders, eq(bookings.providerId, serviceProviders.id))
    .where(and(...conditions))
    .orderBy(desc(bookings.bookingDate));
  return results;
}

// ============================================================================
// CALENDAR FEED HELPERS
// ============================================================================

export async function getProviderCalendarBookings(providerId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select({
    id: bookings.id,
    bookingNumber: bookings.bookingNumber,
    bookingDate: bookings.bookingDate,
    startTime: bookings.startTime,
    endTime: bookings.endTime,
    status: bookings.status,
    locationType: bookings.locationType,
    customerNotes: bookings.customerNotes,
    totalAmount: bookings.totalAmount,
    serviceAddressLine1: bookings.serviceAddressLine1,
    serviceCity: bookings.serviceCity,
    serviceState: bookings.serviceState,
    servicePostalCode: bookings.servicePostalCode,
    venueName: bookings.venueName,
    serviceName: services.name,
    customerName: users.name,
  }).from(bookings)
    .leftJoin(services, eq(bookings.serviceId, services.id))
    .leftJoin(users, eq(bookings.customerId, users.id))
    .where(and(
      eq(bookings.providerId, providerId),
      inArray(bookings.status, ["pending", "confirmed", "in_progress", "completed"] as any)
    ))
    .orderBy(desc(bookings.bookingDate));
}


// ============================================================================
// SCHEDULE CONFLICT DETECTION
// ============================================================================

/**
 * Check for overlapping bookings for a provider on a given date/time range.
 * Looks across ALL categories/services for the provider.
 * Returns conflicting bookings (excludes the booking being checked if provided).
 */
export async function checkProviderConflicts(
  providerId: number,
  bookingDate: string,
  startTime: string,
  endTime: string,
  excludeBookingId?: number
): Promise<Array<Booking & { serviceName?: string }>> {
  const db = await getDb();
  if (!db) return [];

  const conditions = [
    eq(bookings.providerId, providerId),
    eq(bookings.bookingDate, bookingDate),
    inArray(bookings.status, ["pending", "confirmed", "in_progress"] as any),
    // Time overlap: existing.start < new.end AND existing.end > new.start
    sql`${bookings.startTime} < ${endTime}`,
    sql`${bookings.endTime} > ${startTime}`,
  ];

  const results = await db
    .select({
      id: bookings.id,
      bookingNumber: bookings.bookingNumber,
      customerId: bookings.customerId,
      providerId: bookings.providerId,
      serviceId: bookings.serviceId,
      bookingDate: bookings.bookingDate,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
      durationMinutes: bookings.durationMinutes,
      status: bookings.status,
      locationType: bookings.locationType,
      serviceAddressLine1: bookings.serviceAddressLine1,
      serviceAddressLine2: bookings.serviceAddressLine2,
      serviceCity: bookings.serviceCity,
      serviceState: bookings.serviceState,
      servicePostalCode: bookings.servicePostalCode,
      customerNotes: bookings.customerNotes,
      providerNotes: bookings.providerNotes,
      subtotal: bookings.subtotal,
      travelFee: bookings.travelFee,
      platformFee: bookings.platformFee,
      totalAmount: bookings.totalAmount,
      depositAmount: bookings.depositAmount,
      remainingAmount: bookings.remainingAmount,
      cancellationReason: bookings.cancellationReason,
      cancelledBy: bookings.cancelledBy,
      cancelledAt: bookings.cancelledAt,
      confirmedAt: bookings.confirmedAt,
      startedAt: bookings.startedAt,
      completedAt: bookings.completedAt,
      createdAt: bookings.createdAt,
      updatedAt: bookings.updatedAt,
      serviceName: services.name,
    })
    .from(bookings)
    .leftJoin(services, eq(bookings.serviceId, services.id))
    .where(and(...conditions))
    .orderBy(bookings.startTime);

  // Filter out the booking being checked (if updating an existing booking)
  if (excludeBookingId) {
    return results.filter((b) => b.id !== excludeBookingId) as any;
  }
  return results as any;
}


// ============================================================================
// BOOKING DELETION
// ============================================================================

/**
 * Delete a booking and all related records (sessions, payments, reviews, messages).
 * Only allowed for bookings with status: cancelled, completed, no_show, refunded.
 */
export async function deleteBooking(bookingId: number): Promise<void> {
  const database = await getDb();
  if (!database) throw new Error("Database not available");

  // Delete/nullify related records first (foreign key constraints)
  await database.delete(bookingSessions).where(eq(bookingSessions.bookingId, bookingId));
  await database.delete(messages).where(eq(messages.bookingId, bookingId));
  await database.delete(reviews).where(eq(reviews.bookingId, bookingId));
  await database.delete(payments).where(eq(payments.bookingId, bookingId));
  // Nullify references in notifications (relatedBookingId is nullable)
  await database.update(notifications).set({ relatedBookingId: null }).where(eq(notifications.relatedBookingId, bookingId));
  // Nullify references in promo_redemptions and referral_credits (bookingId is nullable)
  await database.update(promoRedemptions).set({ bookingId: null }).where(eq(promoRedemptions.bookingId, bookingId));
  await database.update(referralCredits).set({ bookingId: null }).where(eq(referralCredits.bookingId, bookingId));
  // Finally delete the booking itself
  await database.delete(bookings).where(eq(bookings.id, bookingId));
}
