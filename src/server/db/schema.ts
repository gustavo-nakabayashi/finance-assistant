// Example model schema from the Drizzle docs
// https://orm.drizzle.team/docs/sql-schema-declaration

import { sql } from "drizzle-orm";
import {
  pgTableCreator,
  timestamp,
  varchar,
  boolean,
  pgTable,
} from "drizzle-orm/pg-core";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator(
  (name) => `finance-assistant_${name}`,
);

export const PAID = "PAID";
export const PENDING = "PENDING";

export const documentsTable = createTable("documents", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  paid: boolean("paid").default(false).notNull(),
  payment_code: varchar("payment_code", { length: 1024 }).notNull(),
  value: varchar("value", { length: 1024 }).notNull(),
  expiration_date: varchar("date", { length: 1024 }).notNull(),
  created_at: timestamp("created_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).$onUpdate(
    () => new Date(),
  ),
});

export const paymentEventsTable = pgTable("payment_events", {
  id: varchar("id", { length: 36 }).primaryKey(),
  description: varchar("description", { length: 1024 }),
  created_at: timestamp("created_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).$onUpdate(
    () => new Date(),
  ),
});
