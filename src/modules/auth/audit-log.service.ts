import { createHash } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db';
import { type AuditLog, auditLogs } from '../../db/schema';
import { generateMessageId } from '../../utils/id';
import { logger } from '../../utils/logger';

export enum UserRole {
  ORG_ADMIN = 'ORG_ADMIN',
  DEVELOPER = 'DEVELOPER',
  SUPPORT_AGENT = 'SUPPORT_AGENT',
  AUDITOR = 'AUDITOR',
}

export interface RecordAuditLogParams {
  tenantId: string;
  team: string;
  actorId: string;
  actorRole: UserRole | string;
  action: string;
  resourceType: string;
  resourceId: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

let lastKnownHash = 'GENESIS_BLOCK_0000000000000000000000000000000000000000000000000000';

function computeEntryHash(prevHash: string, params: RecordAuditLogParams, timestampIso: string): string {
  const raw = `${prevHash}|${params.tenantId}|${params.team}|${params.actorId}|${params.actorRole}|${params.action}|${params.resourceType}|${params.resourceId}|${JSON.stringify(params.details || {})}|${timestampIso}`;
  return createHash('sha256').update(raw).digest('hex');
}

export const AuditLogService = {
  /**
   * Records a tamper-evident audit log entry in PostgreSQL.
   */
  async record(params: RecordAuditLogParams): Promise<AuditLog> {
    const now = new Date();
    const id = `audit_${generateMessageId()}`;
    const prevHash = lastKnownHash;
    const hash = computeEntryHash(prevHash, params, now.toISOString());
    lastKnownHash = hash;

    try {
      const [entry] = await db
        .insert(auditLogs)
        .values({
          id,
          tenantId: params.tenantId,
          team: params.team,
          actorId: params.actorId,
          actorRole: params.actorRole,
          action: params.action,
          resourceType: params.resourceType,
          resourceId: params.resourceId,
          details: params.details,
          prevHash,
          hash,
          ipAddress: params.ipAddress,
          createdAt: now,
        })
        .returning();

      return entry;
    } catch (err) {
      logger.error('AuditLogService', `Failed to write audit log entry: ${(err as Error).message}`, { params });
      throw err;
    }
  },

  /**
   * Queries audit logs with pagination and tenant isolation.
   */
  async listLogs(params: {
    tenantId: string;
    team?: string;
    action?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ total: number; items: AuditLog[] }> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    const conditions = [eq(auditLogs.tenantId, params.tenantId)];
    if (params.team) {
      conditions.push(eq(auditLogs.team, params.team));
    }
    if (params.action) {
      conditions.push(eq(auditLogs.action, params.action));
    }

    const items = await db
      .select()
      .from(auditLogs)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      total: items.length,
      items,
    };
  },

  /**
   * Redacts sensitive recipient PII fields for users in SUPPORT_AGENT role.
   */
  maskPiiForSupportRole<T extends Record<string, unknown>>(data: T): T {
    if (!data || typeof data !== 'object') return data;
    const cloned = JSON.parse(JSON.stringify(data));

    if (cloned.recipients && typeof cloned.recipients === 'object') {
      if (typeof cloned.recipients.email === 'string') {
        const [local, domain] = cloned.recipients.email.split('@');
        cloned.recipients.email = `${local.slice(0, 1)}***@${domain || '***'}`;
      }
      if (typeof cloned.recipients.phone === 'string') {
        cloned.recipients.phone = `${cloned.recipients.phone.slice(0, 4)}****${cloned.recipients.phone.slice(-2)}`;
      }
      if (typeof cloned.recipients.whatsapp === 'string') {
        cloned.recipients.whatsapp = `${cloned.recipients.whatsapp.slice(0, 4)}****${cloned.recipients.whatsapp.slice(-2)}`;
      }
    }

    return cloned;
  },
};
