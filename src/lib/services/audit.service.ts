import { db } from "../db";
import { auditLog } from "../db/schema";
import { ulid } from "ulid";
import { desc, eq, and, like, sql } from "drizzle-orm";

type EntityType = "node" | "proxy" | "cert" | "template" | "system";
type AuditResult = "success" | "failure";

export async function logAudit(
  action: string,
  entityType: EntityType,
  entityId: string | null = null,
  nodeId: string | null = null,
  details: Record<string, unknown> | null = null,
  result: AuditResult = "success"
) {
  await db.insert(auditLog).values({
    id: ulid(),
    action,
    entityType,
    entityId,
    nodeId,
    details: details ? JSON.stringify(details) : null,
    result,
  });
}

export async function getAuditLogs(options: {
  page?: number;
  pageSize?: number;
  entityType?: EntityType;
  nodeId?: string;
  action?: string;
} = {}) {
  const { page = 1, pageSize = 50, entityType, nodeId, action } = options;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (entityType) conditions.push(eq(auditLog.entityType, entityType));
  if (nodeId) conditions.push(eq(auditLog.nodeId, nodeId));
  if (action) conditions.push(like(auditLog.action, `%${action}%`));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [entries, countResult] = await Promise.all([
    db
      .select()
      .from(auditLog)
      .where(where)
      .orderBy(desc(auditLog.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(auditLog)
      .where(where),
  ]);

  const total = countResult[0]?.count || 0;

  return {
    entries: entries.map((e) => ({
      ...e,
      details: e.details ? JSON.parse(e.details) : null,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}
