import { eq } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
  pgTable,
  serial,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { analyzeTable } from "./table-analyzer.js";

describe("analyzeTable", () => {
  describe("primary key detection", () => {
    it("detects single column primary key", () => {
      const users = pgTable("users", {
        id: serial("id").primaryKey(),
        name: text("name"),
      });

      const result = analyzeTable(users);

      expect(result.name).toBe("users");
      expect(result.primaryKey).not.toBeNull();
      expect(result.primaryKey?.columns[0]?.name).toBe("id");
      expect(result.primaryKey?.columns[0]?.tsType).toBe("number");
    });

    it("returns null for composite primary key", () => {
      const userRoles = pgTable(
        "user_roles",
        {
          userId: integer("user_id"),
          roleId: integer("role_id"),
        },
        (t) => [t.userId, t.roleId],
      );

      const result = analyzeTable(userRoles);

      expect(result.primaryKey).toBeNull();
    });

    it("returns null when no primary key exists", () => {
      const logs = pgTable("logs", {
        message: text("message"),
        level: text("level"),
      });

      const result = analyzeTable(logs);

      expect(result.primaryKey).toBeNull();
    });
  });

  describe("index detection", () => {
    it("detects single column unique index", () => {
      const users = pgTable(
        "users",
        {
          id: serial("id").primaryKey(),
          email: varchar("email", { length: 255 }),
        },
        (t) => [uniqueIndex("users_email_idx").on(t.email)],
      );

      const result = analyzeTable(users);

      expect(result.indexes).toHaveLength(1);
      expect(result.indexes[0]?.name).toBe("users_email_idx");
      expect(result.indexes[0]?.columns[0]?.name).toBe("email");
      expect(result.indexes[0]?.columns[0]?.tsType).toBe("string");
      expect(result.indexes[0]?.unique).toBe(true);
    });

    it("detects single column non-unique index", () => {
      const posts = pgTable(
        "posts",
        {
          id: serial("id").primaryKey(),
          authorId: integer("author_id"),
        },
        (t) => [index("posts_author_id_idx").on(t.authorId)],
      );

      const result = analyzeTable(posts);

      expect(result.indexes).toHaveLength(1);
      expect(result.indexes[0]?.name).toBe("posts_author_id_idx");
      expect(result.indexes[0]?.columns[0]?.name).toBe("author_id");
      expect(result.indexes[0]?.unique).toBe(false);
    });

    it("detects multiple indexes", () => {
      const posts = pgTable(
        "posts",
        {
          id: serial("id").primaryKey(),
          authorId: integer("author_id"),
          category: varchar("category", { length: 100 }),
          externalId: uuid("external_id"),
        },
        (t) => [
          index("posts_author_id_idx").on(t.authorId),
          index("posts_category_idx").on(t.category),
          uniqueIndex("posts_external_id_idx").on(t.externalId),
        ],
      );

      const result = analyzeTable(posts);

      expect(result.indexes).toHaveLength(3);

      const authorIdx = result.indexes.find(
        (i) => i.name === "posts_author_id_idx",
      );
      expect(authorIdx?.columns[0]?.name).toBe("author_id");
      expect(authorIdx?.unique).toBe(false);

      const categoryIdx = result.indexes.find(
        (i) => i.name === "posts_category_idx",
      );
      expect(categoryIdx?.columns[0]?.name).toBe("category");
      expect(categoryIdx?.unique).toBe(false);

      const externalIdx = result.indexes.find(
        (i) => i.name === "posts_external_id_idx",
      );
      expect(externalIdx?.columns[0]?.name).toBe("external_id");
      expect(externalIdx?.unique).toBe(true);
    });

    it("skips composite indexes", () => {
      const posts = pgTable(
        "posts",
        {
          id: serial("id").primaryKey(),
          authorId: integer("author_id"),
          category: varchar("category", { length: 100 }),
        },
        (t) => [index("posts_composite_idx").on(t.authorId, t.category)],
      );

      const result = analyzeTable(posts);

      expect(result.indexes).toHaveLength(0);
    });

    it("detects composite index with multiple columns", () => {
      const posts = pgTable(
        "posts",
        {
          id: serial("id").primaryKey(),
          authorId: integer("author_id"),
          category: varchar("category", { length: 100 }),
        },
        (t) => [index("posts_author_category_idx").on(t.authorId, t.category)],
      );

      const result = analyzeTable(posts);

      expect(result.indexes).toHaveLength(1);
      expect(result.indexes[0]?.name).toBe("posts_author_category_idx");
      expect(result.indexes[0]?.columns).toHaveLength(2);
      expect(result.indexes[0]?.columns[0]?.name).toBe("author_id");
      expect(result.indexes[0]?.columns[0]?.tsType).toBe("number");
      expect(result.indexes[0]?.columns[1]?.name).toBe("category");
      expect(result.indexes[0]?.columns[1]?.tsType).toBe("string");
      expect(result.indexes[0]?.unique).toBe(false);
    });

    it("skips conditional indexes (with WHERE clause)", () => {
      const users = pgTable(
        "users",
        {
          id: serial("id").primaryKey(),
          email: varchar("email", { length: 255 }),
          isActive: integer("is_active"),
        },
        (t) => [
          uniqueIndex("users_active_email_idx")
            .on(t.email)
            .where(eq(t.isActive, 1)),
        ],
      );

      const result = analyzeTable(users);

      expect(result.indexes).toHaveLength(0);
    });

    it("handles bigint type correctly", () => {
      const items = pgTable(
        "items",
        {
          id: serial("id").primaryKey(),
          externalId: bigint("external_id", { mode: "bigint" }),
        },
        (t) => [uniqueIndex("items_external_id_idx").on(t.externalId)],
      );

      const result = analyzeTable(items);

      expect(result.indexes).toHaveLength(1);
      expect(result.indexes[0]?.columns[0]?.tsType).toBe("bigint");
    });
  });
});
