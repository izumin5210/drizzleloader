import { pgTable, serial, varchar, uniqueIndex } from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 255 }),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)]
);
