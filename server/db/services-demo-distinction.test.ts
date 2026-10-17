import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./connection", () => ({ getDb }));

import { searchPublicServicesForAgents } from "./services";

function containsColumn(value: unknown, columnName: string, seen = new Set<unknown>()): boolean {
  if (!value || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  const candidate = value as { name?: unknown };
  if (candidate.name === columnName) return true;
  return Object.values(value).some((child) => containsColumn(child, columnName, seen));
}

function containsStringChunk(value: unknown, expected: string, seen = new Set<unknown>()): boolean {
  if (!value || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  const candidate = value as { value?: unknown };
  if (Array.isArray(candidate.value) && candidate.value.includes(expected)) return true;
  return Object.values(value).some((child) => containsStringChunk(child, expected, seen));
}

function queryDouble(rows: unknown[]) {
  const whereCalls: unknown[] = [];
  const orderByCalls: unknown[][] = [];
  let selectCount = 0;
  const database = {
    select: () => {
      const isCountQuery = selectCount++ === 1;
      const chain: any = {
        from: () => chain,
        innerJoin: () => chain,
        where: (condition: unknown) => {
          whereCalls.push(condition);
          return isCountQuery ? Promise.resolve([{ total: 1 }]) : chain;
        },
        orderBy: (...expressions: unknown[]) => {
          orderByCalls.push(expressions);
          return chain;
        },
        limit: () => chain,
        offset: () => Promise.resolve(rows),
      };
      return chain;
    },
  };
  return { database, whereCalls, orderByCalls };
}

describe("searchPublicServicesForAgents demo distinction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("excludes official demos by default and shares that exact filter with count and paginated rows", async () => {
    const query = queryDouble([{ id: 1, isDemo: false }]);
    getDb.mockResolvedValue(query.database);

    const result = await searchPublicServicesForAgents({ includeDemo: false, limit: 5, offset: 10 });

    expect(result).toEqual({ rows: [{ id: 1, isDemo: false }], total: 1 });
    expect(query.whereCalls).toHaveLength(2);
    expect(query.whereCalls[0]).toBe(query.whereCalls[1]);
    expect(query.orderByCalls).toHaveLength(1);
    expect(containsColumn(query.whereCalls[0], "isOfficial")).toBe(true);
  });

  it("includes demos only when requested and orders real providers ahead of official demos", async () => {
    const query = queryDouble([{ id: 1, isDemo: false }, { id: 2, isDemo: true }]);
    getDb.mockResolvedValue(query.database);

    const result = await searchPublicServicesForAgents({ includeDemo: true, limit: 5, offset: 0 });

    expect(result.rows).toEqual([{ id: 1, isDemo: false }, { id: 2, isDemo: true }]);
    expect(query.whereCalls).toHaveLength(2);
    expect(query.whereCalls[0]).toBe(query.whereCalls[1]);
    expect(query.orderByCalls).toHaveLength(1);
    expect(containsColumn(query.orderByCalls[0][0], "isOfficial")).toBe(true);
    expect(containsStringChunk(query.orderByCalls[0][0], " asc")).toBe(true);
  });
});
