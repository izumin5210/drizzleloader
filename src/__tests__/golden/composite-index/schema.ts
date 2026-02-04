import {
  pgTable,
  serial,
  integer,
  varchar,
  index,
} from "drizzle-orm/pg-core";

export const posts = pgTable(
  "posts",
  {
    id: serial("id").primaryKey(),
    authorId: integer("author_id").notNull(),
    category: varchar("category", { length: 100 }).notNull(),
    title: varchar("title", { length: 255 }),
  },
  (t) => [index("posts_author_category_idx").on(t.authorId, t.category)]
);
