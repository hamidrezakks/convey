import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { generateUuidV7 } from '../../utils/id';

export const tenants = pgTable('tenants', {
  id: uuid('id')
    .$defaultFn(() => generateUuidV7())
    .primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
