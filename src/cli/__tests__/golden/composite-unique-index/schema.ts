import {
  pgTable,
  serial,
  integer,
  varchar,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const posts = pgTable(
  "posts",
  {
    id: serial("id").primaryKey(),
    authorId: integer("author_id").notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
  },
  (t) => [uniqueIndex("posts_author_slug_idx").on(t.authorId, t.slug)]
);
