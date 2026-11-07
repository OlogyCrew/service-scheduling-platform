import { desc, eq } from "drizzle-orm";
import { paymentVelocityCounters } from "../../drizzle/schema";
import { getDb } from "./connection";

export async function getPaymentVelocityCounters(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(paymentVelocityCounters)
    .orderBy(desc(paymentVelocityCounters.updatedAt))
    .limit(Math.min(Math.max(limit, 1), 200));
}

export async function releasePaymentVelocityCooldown(counterId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database temporarily unavailable");
  await db.update(paymentVelocityCounters)
    .set({ attemptCount: 0, blockedUntil: null })
    .where(eq(paymentVelocityCounters.id, counterId));
}
