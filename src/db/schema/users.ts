import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const users = pgTable("users", {
  id: uuid("id").primaryKey(), // ID vem da auth.users do Supabase
  tenantId: uuid("tenant_id").references(() => tenants.id),
  email: varchar("email", { length: 255 }).notNull().unique(),
  fullName: varchar("full_name", { length: 255 }),
  role: varchar("role", { length: 50 }).notNull(), // admin, manager, etc
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
