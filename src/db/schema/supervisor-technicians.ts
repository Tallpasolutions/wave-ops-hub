import {
  pgTable,
  uuid,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";
import { technicians } from "./technicians";

export const supervisorTechnicians = pgTable(
  "supervisor_technicians",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    supervisorId: uuid("supervisor_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    technicianId: uuid("technician_id")
      .notNull()
      .references(() => technicians.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("uq_supervisor_technician").on(table.supervisorId, table.technicianId),
    index("idx_supervisor_technicians_supervisor").on(table.supervisorId),
    index("idx_supervisor_technicians_technician").on(table.technicianId),
  ],
);

export type SupervisorTechnician = typeof supervisorTechnicians.$inferSelect;
export type NewSupervisorTechnician = typeof supervisorTechnicians.$inferInsert;
