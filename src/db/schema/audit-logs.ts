import { jsonb, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';
import { generateMessageId } from '../../utils/id';

export const auditLogs = pgTable('audit_logs', {
  id: varchar('id', { length: 64 })
    .$defaultFn(() => `audit_${generateMessageId()}`)
    .primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull(),
  team: varchar('team', { length: 64 }).notNull(),
  actorId: varchar('actor_id', { length: 64 }).notNull(),
  actorRole: varchar('actor_role', { length: 32 }).notNull(),
  action: varchar('action', { length: 64 }).notNull(),
  resourceType: varchar('resource_type', { length: 64 }).notNull(),
  resourceId: varchar('resource_id', { length: 64 }).notNull(),
  details: jsonb('details'),
  prevHash: varchar('prev_hash', { length: 64 }),
  hash: varchar('hash', { length: 64 }).notNull(),
  ipAddress: varchar('ip_address', { length: 45 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
