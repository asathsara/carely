import { and, desc, eq, gte, ilike, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/db/schema/audit-log";
import { user } from "@/lib/db/schema/auth";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const COLOMBO_OFFSET = "+05:30";

export type AuditQueryInput = {
  user?: string | null;
  action?: string | null;
  from?: string | null;
  to?: string | null;
  page?: string | null;
  pageSize?: string | null;
};

export class AuditQueryError extends Error {
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = "AuditQueryError";
  }
}

function optionalText(value: string | null | undefined, label: string, max: number) {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  if (normalized.length > max) {
    throw new AuditQueryError(`${label} must be ${max} characters or fewer.`);
  }
  return normalized;
}

function positiveInteger(
  value: string | null | undefined,
  label: string,
  fallback: number,
  max: number
) {
  if (!value) return fallback;
  if (!/^\d+$/.test(value)) {
    throw new AuditQueryError(`${label} must be a positive integer.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) {
    throw new AuditQueryError(`${label} must be between 1 and ${max}.`);
  }
  return parsed;
}

function calendarDate(value: string | null | undefined, label: string) {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AuditQueryError(`${label} must use YYYY-MM-DD format.`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new AuditQueryError(`${label} must be a valid calendar date.`);
  }
  return value;
}

function colomboStartOfDay(value: string) {
  return new Date(`${value}T00:00:00${COLOMBO_OFFSET}`);
}

function colomboStartOfNextDay(value: string) {
  const next = colomboStartOfDay(value);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

export async function queryAuditLog(input: AuditQueryInput = {}) {
  const userFilter = optionalText(input.user, "user", 200);
  const actionFilter = optionalText(input.action, "action", 80);
  const from = calendarDate(input.from, "from");
  const to = calendarDate(input.to, "to");
  const page = positiveInteger(input.page, "page", 1, 1_000_000);
  const pageSize = positiveInteger(
    input.pageSize,
    "pageSize",
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE
  );

  if (from && to && from > to) {
    throw new AuditQueryError("from must be on or before to.");
  }

  const filters: SQL[] = [];
  if (userFilter) {
    const pattern = `%${userFilter}%`;
    const match = or(
      ilike(auditLog.userId, pattern),
      ilike(user.name, pattern),
      ilike(user.email, pattern)
    );
    if (match) filters.push(match);
  }
  if (actionFilter) filters.push(ilike(auditLog.action, `%${actionFilter}%`));
  if (from) filters.push(gte(auditLog.createdAt, colomboStartOfDay(from)));
  if (to) filters.push(lt(auditLog.createdAt, colomboStartOfNextDay(to)));

  const where = and(...filters);
  const offset = (page - 1) * pageSize;
  const [countRows, rows] = await Promise.all([
    db
      .select({ total: sql<number>`count(*)`.mapWith(Number) })
      .from(auditLog)
      .leftJoin(user, eq(auditLog.userId, user.id))
      .where(where),
    db
      .select({
        id: auditLog.id,
        userId: auditLog.userId,
        actorName: user.name,
        actorRole: user.role,
        action: auditLog.action,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        metadata: auditLog.metadata,
        createdAt: auditLog.createdAt,
      })
      .from(auditLog)
      .leftJoin(user, eq(auditLog.userId, user.id))
      .where(where)
      .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
      .limit(pageSize)
      .offset(offset),
  ]);

  const total = countRows[0]?.total ?? 0;
  return {
    entries: rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}
