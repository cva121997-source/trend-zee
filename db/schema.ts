import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const products=sqliteTable('products',{id:text('id').primaryKey(),data:text('data').notNull(),archived:integer('archived').notNull().default(0)});
export const records=sqliteTable('records',{id:text('id').primaryKey(),kind:text('kind').notNull(),owner:text('owner').notNull(),data:text('data').notNull(),created:text('created').notNull(),updated:text('updated').notNull()},t=>[index('records_kind_owner').on(t.kind,t.owner)]);
