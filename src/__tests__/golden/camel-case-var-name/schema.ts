import { pgTable, integer, varchar, primaryKey } from "drizzle-orm/pg-core";

export const userRoles = pgTable(
  "user_roles",
  {
    userId: integer("user_id").notNull(),
    roleId: integer("role_id").notNull(),
    assignedAt: varchar("assigned_at", { length: 100 }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] })]
);
