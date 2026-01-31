import { pgTable, serial, integer, text, index } from "drizzle-orm/pg-core";

export const posts = pgTable(
  "posts",
  {
    id: serial("id").primaryKey(),
    authorId: integer("author_id"),
    title: text("title"),
  },
  (t) => [index("posts_author_id_idx").on(t.authorId)]
);
