import { pgTable, uuid, text } from "drizzle-orm/pg-core";

export const items = pgTable("items", {
  id: uuid("id").primaryKey(),
  name: text("name"),
});
