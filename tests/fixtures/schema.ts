import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  bigint,
  boolean,
  timestamp,
  uuid,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    name: text("name"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)]
);

export const posts = pgTable(
  "posts",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    content: text("content"),
    authorId: integer("author_id").notNull(),
    category: varchar("category", { length: 100 }),
    viewCount: bigint("view_count", { mode: "bigint" }),
    externalId: uuid("external_id"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [
    index("posts_author_id_idx").on(t.authorId),
    index("posts_category_idx").on(t.category),
    uniqueIndex("posts_external_id_idx").on(t.externalId),
  ]
);
