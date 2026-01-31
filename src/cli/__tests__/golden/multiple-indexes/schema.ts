import {
  pgTable,
  serial,
  integer,
  varchar,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const posts = pgTable(
  "posts",
  {
    id: serial("id").primaryKey(),
    authorId: integer("author_id"),
    slug: varchar("slug", { length: 255 }),
    categoryId: integer("category_id"),
  },
  (t) => [
    uniqueIndex("posts_slug_idx").on(t.slug),
    index("posts_author_id_idx").on(t.authorId),
    index("posts_category_id_idx").on(t.categoryId),
  ]
);
